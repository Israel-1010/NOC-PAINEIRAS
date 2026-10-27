// Conector somente leitura do FortiAnalyzer (FortiView: ameacas, origens, destinos, aplicacoes,
// categorias de site e paises das ultimas 24 h).
// Variaveis: FORTIANALYZER_URL, FORTIANALYZER_ADOM (padrao root) e
//   - FortiAnalyzer Cloud (*.forticloud.com): FORTIANALYZER_USER/PASSWORD = API ID e senha do usuario
//     de API do IAM (perfil com "FortiAnalyzer Cloud" em Read/Write; Read Only nao libera o FortiView);
//   - FortiAnalyzer local: FORTIANALYZER_API_KEY (preferido) ou FORTIANALYZER_USER/PASSWORD.
// O resultado fica em cache por 5 min: as consultas do FortiView sao tarefas que levam alguns segundos.

import { adNames, maskIp } from "./adNames";

const baseUrl = (process.env.FORTIANALYZER_URL || "").trim().replace(/\/+$/, "");
const adom = (process.env.FORTIANALYZER_ADOM || "root").trim();
const user = process.env.FORTIANALYZER_USER || "";
const password = process.env.FORTIANALYZER_PASSWORD || "";
const apiKey = process.env.FORTIANALYZER_API_KEY || "";
const isCloud = /forticloud\.com/i.test(baseUrl);

export function isFortiAnalyzerConfigured() {
  return Boolean(baseUrl && (apiKey || (user && password)));
}

let session = "";

async function post<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`FortiAnalyzer respondeu ${response.status} (${text.slice(0, 80)}).`);
  }
}

async function login() {
  session = "";
  if (isCloud) {
    // FortiCloud: token OAuth do usuario de API (IAM) -> sessao da instancia.
    const token = await post<{ access_token?: string; message?: string }>("https://customerapiauth.fortinet.com/api/v1/oauth/token/", {
      username: user,
      password,
      client_id: "FortiAnalyzer",
      grant_type: "password",
    });
    if (!token.access_token) throw new Error(`FortiCloud recusou o usuário de API (${token.message || "sem token"}).`);
    const result = await post<{ session?: string; message?: string }>(`${baseUrl}/p/forticloud_jsonrpc_login/`, { access_token: token.access_token });
    if (!result.session) throw new Error(`FortiAnalyzer Cloud recusou o acesso (${result.message || "sem sessão"}). Confira o perfil do usuário de API no IAM.`);
    session = result.session;
    return;
  }
  if (apiKey) return; // chave de API vai no cabecalho, sem sessao
  const result = await post<{ session?: string; result?: { status?: { message?: string } }[] }>(`${baseUrl}/jsonrpc`, {
    id: 1,
    method: "exec",
    params: [{ url: "/sys/login/user", data: { user, passwd: password } }],
  });
  if (!result.session) throw new Error(`FortiAnalyzer recusou o login (${result.result?.[0]?.status?.message || "sem sessão"}).`);
  session = result.session;
}

type RpcResult<T> = { status?: { code: number; message: string }; data?: T };
// "result" vem como lista nas chamadas classicas e como objeto nas do FortiView.
type RpcResponse<T> = { result?: RpcResult<T>[] | RpcResult<T>; error?: { code: number; message: string } };

let rpcId = 1;
async function rpc<T>(method: string, params: Record<string, unknown>, retry = true): Promise<RpcResult<T>> {
  if (!isFortiAnalyzerConfigured()) throw new Error("FortiAnalyzer não configurado.");
  if (!session && !apiKey) await login();
  const headers: Record<string, string> = apiKey && !isCloud ? { Authorization: `Bearer ${apiKey}` } : {};
  const body = await post<RpcResponse<T>>(`${baseUrl}/jsonrpc`, { id: rpcId++, jsonrpc: "2.0", method, params: [params], ...(session ? { session } : {}) }, headers);
  const result = Array.isArray(body.result) ? body.result[0] : body.result;
  const code = result?.status?.code ?? body.error?.code;
  // -11 sem permissao / -6 sessao invalida: renova a sessao uma vez.
  if (retry && session && (code === -6 || /session|invalid|expired/i.test(body.error?.message || ""))) {
    await login();
    return rpc(method, params, false);
  }
  if (body.error) {
    throw new Error(/Access denied/i.test(body.error.message)
      ? "FortiAnalyzer: sem permissão para o FortiView (no IAM, o perfil do usuário de API precisa de FortiAnalyzer Cloud em Read/Write)."
      : `FortiAnalyzer: ${body.error.message}`);
  }
  return result ?? {};
}

const pad = (n: number) => String(n).padStart(2, "0");
const fazTime = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Row = Record<string, string | number>;

// FortiView: cria a tarefa e espera o resultado (ate ~25 s).
async function runView(view: string, sortBy: string, limit: number): Promise<Row[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  const task = await rpc<{ tid?: number }>("add", {
    url: `/fortiview/adom/${adom}/${view}/run`,
    apiver: 3,
    device: [{ devid: "All_FortiGate" }],
    "time-range": { start: fazTime(start), end: fazTime(end) },
    limit,
    "sort-by": [{ field: sortBy, order: "desc" }],
  });
  const tid = task.data?.tid ?? (task as { tid?: number }).tid;
  if (!tid) throw new Error(`FortiAnalyzer: a visão ${view} não iniciou.`);
  for (let attempt = 0; attempt < 30; attempt++) {
    // Resposta: { percentage, data: [linhas] } (em algumas versoes, { data: { percentage, data: [...] } }).
    const result = (await rpc<unknown>("get", { url: `/fortiview/adom/${adom}/${view}/run/${tid}`, apiver: 3 })) as { percentage?: number; data?: Row[] | { percentage?: number; data?: Row[] } };
    const nested = Array.isArray(result.data) ? undefined : result.data;
    const rows = Array.isArray(result.data) ? result.data : nested?.data;
    const pct = result.percentage ?? nested?.percentage;
    if (pct === 100 || (rows && pct === undefined)) return rows ?? [];
    await sleep(800);
  }
  throw new Error(`FortiAnalyzer: a visão ${view} demorou demais.`);
}

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export type AnalyzerOverview = {
  checkedAt: string;
  windowHours: number;
  totals: { bandwidth: number; sessions: number; sessionsBlocked: number; threatsBlocked: number; threatIncidents: number };
  threats: { name: string; type: string; level: string; incidents: number; blocked: number }[];
  sources: { ip: string; name: string; iface: string; device: string; bandwidth: number; sessions: number; threatsBlocked: number }[];
  destinations: { ip: string; app: string; bandwidth: number; upload: number; download: number; sessions: number }[];
  applications: { name: string; category: string; risk: string; users: number; bandwidth: number; sessionsBlocked: number }[];
  categories: { name: string; bandwidth: number; sessionsBlocked: number; threatsBlocked: number }[];
  countries: { name: string; bandwidth: number; sessions: number; sessionsBlocked: number; threatsBlocked: number }[];
  // Sessoes de VPN de usuarios (SSL / IPsec dial-up) ENCERRADAS nas ultimas 24 h: o FortiGate so manda o log
  // quando o tunel fecha. Quem esta conectado agora vem do Zabbix (item noc.fgt.sslvpn.tunnels).
  vpnUsers: { login: string; name: string; department: string; type: string; remoteIp: string; lastSeen: string; durationSec: number; bandwidth: number; connections: number }[];
  // Tuneis site-to-site (ex.: Oracle Cloud) nas ultimas 24 h.
  siteToSite: { name: string; remoteIp: string; bandwidth: number; durationSec: number }[];
};




// "15895,SSL|0,HTTPS|0,Cloudflare-CDN" -> "SSL, HTTPS, Cloudflare-CDN"
const appList = (value: unknown) =>
  String(value || "")
    .split("|")
    .map((part) => part.split(",").slice(1).join(","))
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");

async function load(): Promise<AnalyzerOverview> {
  // Uma visao por vez: o FortiAnalyzer Cloud limita tarefas simultaneas.
  const threats = await runView("top-threats", "threatweight", 10);
  const sources = await runView("top-sources", "bandwidth", 8);
  const destinations = await runView("top-destinations", "bandwidth", 6);
  const applications = await runView("top-applications", "bandwidth", 8);
  const categories = await runView("top-websites", "bandwidth", 6);
  const countries = await runView("top-countries", "bandwidth", 8);
  const vpnRows = await runView("ssl-dialup-ipsec", "bandwidth", 40);
  const tunnelRows = await runView("site-to-site-ipsec", "bandwidth", 12);
  const logins = Array.from(new Set(vpnRows.map((row) => String(row.f_user || "")).filter(Boolean)));
  const names = await adNames(logins);
  return {
    checkedAt: new Date().toISOString(),
    windowHours: 24,
    totals: {
      bandwidth: countries.reduce((sum, row) => sum + num(row.bandwidth), 0),
      sessions: countries.reduce((sum, row) => sum + num(row.sessions), 0),
      sessionsBlocked: countries.reduce((sum, row) => sum + num(row.session_block), 0),
      threatsBlocked: threats.reduce((sum, row) => sum + num(row.incident_block), 0),
      threatIncidents: threats.reduce((sum, row) => sum + num(row.incidents), 0),
    },
    threats: threats.map((row) => ({ name: String(row.threat || ""), type: String(row.threattype || ""), level: String(row.level_s || ""), incidents: num(row.incidents), blocked: num(row.incident_block) })),
    sources: sources.map((row) => ({
      ip: String(row.srcip || ""),
      name: String(row.f_user || row.unauthuser || (row.srcip_hostname !== row.srcip ? row.srcip_hostname : "") || ""),
      iface: String(row.srcintf || ""),
      // "18:e8:..,RouterOS 7.11.3 (stable) Sep/27/2023" -> "RouterOS 7.11.3"
      device: String(row.mac_devtype_agg || "").split("|")[0].split(",").slice(1).join(",").replace(/\s*\(.*$/, "").trim(),
      bandwidth: num(row.bandwidth),
      sessions: num(row.sessions),
      threatsBlocked: num(row.threat_block),
    })),
    destinations: destinations.map((row) => ({ ip: String(row.dstip_hostname || row.dstip || ""), app: appList(row.agg_app), bandwidth: num(row.bandwidth), upload: num(row.traffic_out), download: num(row.traffic_in), sessions: num(row.sessions) })),
    applications: applications.map((row) => ({ name: String(row.app_group || ""), category: String(row.appcat || ""), risk: String(row.risk || ""), users: num(row.num_users), bandwidth: num(row.bandwidth), sessionsBlocked: num(row.session_block) })),
    categories: categories.map((row) => ({ name: String(row.catdesc || ""), bandwidth: num(row.bandwidth), sessionsBlocked: num(row.session_block), threatsBlocked: num(row.threat_block) })),
    countries: countries.map((row) => ({ name: String(row.dstcountry || ""), bandwidth: num(row.bandwidth), sessions: num(row.sessions), sessionsBlocked: num(row.session_block), threatsBlocked: num(row.threat_block) })),
    vpnUsers: vpnRows
      .map((row) => {
        const login = String(row.f_user || "");
        const lastMs = num(row.e_time_t) * 1000;
        return {
          login,
          name: names.get(login)?.name || login || "—",
          department: names.get(login)?.department || "",
          type: /ssl/i.test(String(row.vpn_type_group)) ? "SSL" : "IPsec",
          remoteIp: maskIp(String(row.remip || "")),
          lastSeen: lastMs ? new Date(lastMs).toISOString() : "",
          durationSec: num(row.duration),
          bandwidth: num(row.bandwidth),
          connections: num(row.connections),
        };
      })
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
    siteToSite: tunnelRows.map((row) => ({ name: String(row.vpnname || ""), remoteIp: String(row.remip || ""), bandwidth: num(row.bandwidth), durationSec: num(row.duration) })),
  };
}

// Cache de 5 min com atualizacao em segundo plano: o NOC nunca espera o FortiView.
const FRESH_MS = 5 * 60 * 1000;
let cached: { at: number; data: AnalyzerOverview | null; error: string } = { at: 0, data: null, error: "" };
let refreshing: Promise<void> | null = null;

function refresh() {
  if (refreshing) return refreshing;
  refreshing = load()
    .then((data) => {
      cached = { at: Date.now(), data, error: "" };
    })
    .catch((error) => {
      // Mantem a ultima leitura boa e registra o erro.
      cached = { ...cached, at: Date.now(), error: error instanceof Error ? error.message : String(error) };
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// Para o NOC: devolve o que tem na hora (nada na primeira chamada) e renova em segundo plano;
// as 6 consultas do FortiView levam dezenas de segundos e nao podem segurar o painel.
export function getAnalyzerOverview(): { data: AnalyzerOverview | null; error: string; loading: boolean } {
  if (!cached.at || Date.now() - cached.at > FRESH_MS) void refresh();
  return { data: cached.data, error: cached.error, loading: !cached.data && !cached.error };
}

// Para testes e diagnostico: espera uma carga completa.
export async function loadAnalyzerNow() {
  await refresh();
  return cached;
}
