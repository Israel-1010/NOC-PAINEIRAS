// Conector somente leitura do FortiAnalyzer (FortiView: ameacas, origens, destinos, aplicacoes,
// categorias de site e paises das ultimas 24 h; alertas dos event handlers e antivirus de 7 dias).
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

// Fuso do FortiGate. O FortiView devolve o horario local do firewall em texto ("2026-10-27 12:22:56")
// e o mesmo valor como se fosse UTC no campo numerico (e_time_t): usar o numero adiantava 3 h.
const fortigateOffset = (process.env.FORTIANALYZER_TZ_OFFSET || "-03:00").trim();
const localTimeToIso = (value: unknown) => {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) return "";
  const date = new Date(`${text.replace(" ", "T")}${fortigateOffset}`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

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

// Busca de logs (logview): cria a busca e espera terminar (ate ~40 s). Linhas mais novas primeiro.
async function searchLogs(logtype: string, days: number, limit: number): Promise<{ total: number; rows: Row[] }> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 3600 * 1000);
  const task = await rpc<{ tid?: number }>("add", {
    url: `/logview/adom/${adom}/logsearch`,
    apiver: 3,
    device: [{ devid: "All_FortiGate" }],
    logtype,
    filter: "",
    "time-order": "desc",
    "time-range": { start: fazTime(start), end: fazTime(end) },
  });
  const tid = task.data?.tid ?? (task as { tid?: number }).tid;
  if (!tid) throw new Error(`FortiAnalyzer: a busca de logs ${logtype} não iniciou.`);
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = (await rpc<unknown>("get", { url: `/logview/adom/${adom}/logsearch/${tid}`, apiver: 3, offset: 0, limit })) as { percentage?: number; data?: Row[]; "total-count"?: number };
    if (result.percentage === 100) return { total: Number(result["total-count"]) || 0, rows: result.data || [] };
    await sleep(1000);
  }
  throw new Error(`FortiAnalyzer: a busca de logs ${logtype} demorou demais.`);
}

const decode = (value: unknown) => {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
};

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// action = pede atencao da equipe (vai para o WhatsApp e aparece primeiro no painel).
export type AnalyzerAlert = { id: string; time: string; severity: string; handler: string; subject: string; source: string; user: string; device: string; count: number; action: boolean };

// O que pede acao:
//   - critico e alto, menos os "Risky App/Destination" (uso de app/site de risco, nao ataque);
//   - medio so quando for ataque (forca bruta, malware, botnet...) ou falha do proprio FortiAnalyzer;
//   - nunca o que ja foi bloqueado, falso positivo conhecido, nem "Outbreak Alert" vindo da internet
//     (tentativas de exploit contra o firewall, dezenas por dia). Outbreak com origem interna conta.
const ATTACK = /brute|malware|malicious|virus|botnet|ransom|compromis|ioc|exploit|disk full|log.*(fail|stop|lost)/i;
// Ja bloqueado ou falso positivo conhecido (servidor DNS interno fazendo consultas reversas).
const NOISE = /\bblocked\b|DNS\.PTR\.Records\.Scan/i;
// Redes internas do clube (14.0.0.0/24 e a rede da VLAN 200, atras do MikroTik).
export const INTERNAL_IP = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|14\.0\.0\.)/;

function needsAction(alert: Omit<AnalyzerAlert, "action">) {
  const text = `${alert.handler} ${alert.subject}`;
  if (NOISE.test(text)) return false;
  if (/outbreak alert/i.test(alert.handler) && !INTERNAL_IP.test(alert.source)) return false;
  if (alert.severity === "critical") return true;
  if (alert.severity === "high") return !/^Risky /i.test(alert.handler);
  return alert.severity === "medium" && ATTACK.test(text);
}

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
  // Sessoes de VPN de usuarios (SSL / IPsec dial-up) das ultimas 24 h, com a ultima atividade registrada.
  // Quem esta conectado agora vem do Zabbix (item noc.fgt.sslvpn.tunnels); o painel cruza os dois.
  vpnUsers: { login: string; name: string; department: string; type: string; remoteIp: string; lastSeen: string; durationSec: number; bandwidth: number; connections: number }[];
  // Alertas dos event handlers do FortiAnalyzer (24 h), mais novos primeiro.
  alerts: AnalyzerAlert[];
  // Antivirus (7 dias): bloqueios agrupados por motivo + maquina + site; realVirus = com nome de virus/malware.
  antivirus: {
    total: number;
    realVirus: number;
    items: { reason: string; virus: string; srcip: string; iface: string; site: string; file: string; action: string; count: number; lastSeen: string }[];
  };
};

// Alertas dos event handlers (Event Monitor) das ultimas 24 h, mais novos primeiro.
// Chamada leve (sem tarefa): tambem usada pelo envio ao WhatsApp a cada 2 min.
export async function fetchAnalyzerAlerts(): Promise<AnalyzerAlert[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  // ~30 alertas por hora: 100 so cobria 3 h.
  const result = (await rpc<unknown>("get", { url: `/eventmgmt/adom/${adom}/alerts`, apiver: 3, limit: 1000, "time-range": { start: fazTime(start), end: fazTime(end) } })) as { data?: Row[] };
  const clean = (value: unknown) => (/^(N\/A|-)?$/i.test(String(value ?? "").trim()) ? "" : String(value).trim());
  return (result.data || [])
    .map((row) => ({
      id: String(row.alertid || ""),
      // alerttime e epoch de verdade (diferente do FortiView).
      time: num(row.alerttime) ? new Date(num(row.alerttime) * 1000).toISOString() : "",
      severity: String(row.severity || "").toLowerCase(),
      handler: String(row.triggername || ""),
      subject: decode(row.subject),
      source: clean(row.epip),
      user: clean(row.euname),
      device: clean(row.devname),
      count: num(row.logcount),
    }))
    .map((alert) => ({ ...alert, action: needsAction(alert) }))
    // A API nem sempre respeita o time-range: corta aqui as 24 h.
    .filter((alert) => alert.id && alert.time >= start.toISOString())
    .sort((a, b) => b.time.localeCompare(a.time));
}

// Antivirus dos ultimos 7 dias, agrupado por motivo + maquina + site.
async function loadAntivirus(): Promise<AnalyzerOverview["antivirus"]> {
  const { total, rows } = await searchLogs("virus", 7, 300);
  const groups = new Map<string, AnalyzerOverview["antivirus"]["items"][number]>();
  let realVirus = 0;
  for (const row of rows) {
    const virus = String(row.virus || "").trim();
    // "infected"/"botnet" = arquivo com virus de verdade; o resto (ex.: unknown content-encoding) e bloqueio por politica.
    const isVirus = /infected|botnet|malware|ransom/i.test(String(row.eventtype || "")) || Boolean(virus && virus !== "-" && !/unknown|oversize/i.test(virus));
    if (isVirus) realVirus++;
    const url = decode(row.url);
    const site = String(row.hostname || "") || (url.match(/^[a-z]+:\/\/([^/:]+)/i)?.[1] ?? "") || String(row.dstip || "");
    const reason = isVirus && virus ? virus : decode(row.msg) || String(row.eventtype || "");
    const key = [reason, row.srcip, site].join("|");
    const lastSeen = localTimeToIso(`${row.date} ${row.time}`);
    const group = groups.get(key);
    if (group) {
      group.count++;
      if (lastSeen > group.lastSeen) group.lastSeen = lastSeen;
    } else {
      groups.set(key, {
        reason,
        virus: isVirus ? virus || "malware" : "",
        srcip: String(row.srcip || ""),
        iface: String(row.srcintf || ""),
        site,
        file: decode(row.filename),
        action: String(row.action || ""),
        count: 1,
        lastSeen,
      });
    }
  }
  const items = [...groups.values()].sort((a, b) => Number(Boolean(b.virus)) - Number(Boolean(a.virus)) || b.lastSeen.localeCompare(a.lastSeen)).slice(0, 12);
  return { total: total || rows.length, realVirus, items };
}

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
  const logins = Array.from(new Set(vpnRows.map((row) => String(row.f_user || "")).filter(Boolean)));
  const names = await adNames(logins);
  // Alertas e antivirus nao derrubam o resto se falharem.
  const alerts = await fetchAnalyzerAlerts().catch(() => [] as AnalyzerAlert[]);
  const antivirus = await loadAntivirus().catch(() => ({ total: 0, realVirus: 0, items: [] }));
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
        return {
          login,
          name: names.get(login)?.name || login || "—",
          department: names.get(login)?.department || "",
          type: /ssl/i.test(String(row.vpn_type_group)) ? "SSL" : "IPsec",
          remoteIp: maskIp(String(row.remip || "")),
          // Ultima atividade registrada (horario do FortiGate); a sessao pode continuar aberta.
          lastSeen: localTimeToIso(row.end_time),
          durationSec: num(row.duration),
          bandwidth: num(row.bandwidth),
          connections: num(row.connections),
        };
      })
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
    alerts,
    antivirus,
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
