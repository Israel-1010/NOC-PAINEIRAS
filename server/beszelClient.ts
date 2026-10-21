// Conector somente leitura do Beszel (monitor de servidores e containers, API do PocketBase).
// Variaveis: BESZEL_URL (aceita sem http://), BESZEL_USER e BESZEL_PASSWORD (use um usuario "readonly").
const rawUrl = (process.env.BESZEL_URL || "").trim().replace(/\/$/, "");
const baseUrl = rawUrl && !/^https?:\/\//i.test(rawUrl) ? `http://${rawUrl}` : rawUrl;
const user = process.env.BESZEL_USER || "";
const password = process.env.BESZEL_PASSWORD || "";

export function isBeszelConfigured() {
  return Boolean(baseUrl && user && password);
}

let token = "";

async function login() {
  const response = await fetch(`${baseUrl}/api/collections/users/auth-with-password`, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: user, password }),
  });
  const body = (await response.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!response.ok || !body.token) throw new Error(`Beszel: login recusado (${body.message || `HTTP ${response.status}`}).`);
  token = body.token;
}

async function get<T>(path: string): Promise<T> {
  if (!isBeszelConfigured()) throw new Error("Beszel não configurado (BESZEL_URL, BESZEL_USER, BESZEL_PASSWORD).");
  if (!token) await login();
  let response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: token }, signal: AbortSignal.timeout(15000) });
  if (response.status === 401 || response.status === 403) {
    await login();
    response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: token }, signal: AbortSignal.timeout(15000) });
  }
  if (!response.ok) throw new Error(`Beszel respondeu ${response.status} em ${path.split("?")[0]}.`);
  return (await response.json()) as T;
}

type List<T> = { items: T[]; totalItems: number };
type RawSystem = {
  id: string;
  name: string;
  host: string;
  status: string;
  info?: { cpu?: number; mp?: number; dp?: number; u?: number; t?: number; la?: number[]; v?: string; ct?: number };
};
type RawStats = {
  system: string;
  created: string;
  stats: { cpu?: number; m?: number; mu?: number; mp?: number; d?: number; du?: number; dp?: number; b?: number[]; la?: number[] };
};
type RawContainer = { id: string; name: string; image: string; status: string; health: number; cpu: number; memory: number; net: number; system: string; updated: number };

export type BeszelSystem = {
  id: string;
  name: string;
  host: string;
  status: "up" | "down" | "paused" | "pending" | string;
  cpu: number | null;
  memPct: number | null;
  memUsedGb: number | null;
  memTotalGb: number | null;
  diskPct: number | null;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
  netUpBps: number | null;
  netDownBps: number | null;
  load: number[];
  threads: number | null;
  uptimeSec: number | null;
  agent: string;
  history: { t: number; cpu: number | null; mem: number | null }[];
};

export type BeszelContainer = {
  id: string;
  system: string;
  name: string;
  image: string;
  status: string;
  // 0 sem healthcheck, 1 iniciando, 2 saudavel, 3 com falha
  health: number;
  cpu: number | null;
  memoryMb: number | null;
};

export type BeszelOverview = { generatedAt: string; systems: BeszelSystem[]; containers: BeszelContainer[] };

const round = (value: unknown, digits = 1) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);
const filter = (expression: string) => encodeURIComponent(expression);

async function build(): Promise<BeszelOverview> {
  const [systems, containers] = await Promise.all([
    get<List<RawSystem>>("/api/collections/systems/records?perPage=200&sort=name"),
    get<List<RawContainer>>("/api/collections/containers/records?perPage=500&sort=name").catch(() => ({ items: [] as RawContainer[], totalItems: 0 })),
  ]);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString().replace("T", " ");
  const enriched = await Promise.all(
    systems.items.map(async (system) => {
      // Ultima hora de estatisticas de 1 minuto: valores atuais + mini grafico.
      const stats = await get<List<RawStats>>(
        `/api/collections/system_stats/records?perPage=70&sort=-created&filter=${filter(`system='${system.id}' && type='1m' && created>='${since}'`)}`,
      ).catch(() => ({ items: [] as RawStats[], totalItems: 0 }));
      const last = stats.items[0]?.stats || {};
      const info = system.info || {};
      return {
        id: system.id,
        name: system.name.replace(/\s+/g, " ").trim(),
        host: system.host,
        status: system.status,
        cpu: round(info.cpu ?? last.cpu),
        memPct: round(info.mp ?? last.mp),
        memUsedGb: round(last.mu),
        memTotalGb: round(last.m),
        diskPct: round(info.dp ?? last.dp),
        diskUsedGb: round(last.du, 0),
        diskTotalGb: round(last.d, 0),
        // b = [enviado, recebido] em bytes/s
        netUpBps: last.b ? Math.round((last.b[0] || 0) * 8) : null,
        netDownBps: last.b ? Math.round((last.b[1] || 0) * 8) : null,
        load: (info.la || last.la || []).map((value) => Math.round(value * 100) / 100),
        threads: info.t ?? null,
        uptimeSec: info.u ?? null,
        agent: info.v || "",
        history: stats.items
          .slice()
          .reverse()
          .map((entry) => ({ t: new Date(entry.created.replace(" ", "T")).getTime(), cpu: round(entry.stats.cpu), mem: round(entry.stats.mp) })),
      } satisfies BeszelSystem;
    }),
  );
  const systemName = new Map(enriched.map((system) => [system.id, system.name]));
  return {
    generatedAt: new Date().toISOString(),
    systems: enriched,
    containers: containers.items.map((container) => ({
      id: container.id,
      system: systemName.get(container.system) || "",
      name: container.name,
      image: container.image,
      status: container.status,
      health: Number(container.health) || 0,
      cpu: round(container.cpu),
      memoryMb: round(container.memory, 0),
    })),
  };
}

let cache: { at: number; value: Promise<BeszelOverview> } | null = null;

export function getBeszelOverview() {
  if (cache && Date.now() - cache.at < 15000) return cache.value;
  const value = build();
  cache = { at: Date.now(), value };
  value.catch(() => {
    cache = null;
    token = "";
  });
  return value;
}
