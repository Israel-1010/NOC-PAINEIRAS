import fs from "node:fs/promises";
import path from "node:path";

// Conector somente leitura da API JSON-RPC do Zabbix (testado com 7.0).
// Autenticacao: ZABBIX_API_TOKEN (recomendado) ou ZABBIX_USER/ZABBIX_PASSWORD.
const zabbixUrl = (process.env.ZABBIX_URL || "").replace(/\/$/, "");
const apiToken = process.env.ZABBIX_API_TOKEN || "";
const apiUser = process.env.ZABBIX_USER || "";
const apiPassword = process.env.ZABBIX_PASSWORD || "";

export function isZabbixConfigured() {
  return Boolean(zabbixUrl && (apiToken || (apiUser && apiPassword)));
}

export function zabbixHost() {
  try {
    return zabbixUrl ? new URL(zabbixUrl).host : "";
  } catch {
    return "";
  }
}

let sessionToken = "";

async function rpc<T>(method: string, params: unknown, auth = true): Promise<T> {
  if (!zabbixUrl) throw new Error("Zabbix nao configurado (ZABBIX_URL).");
  const token = auth ? apiToken || sessionToken : "";
  const response = await fetch(`${zabbixUrl}/api_jsonrpc.php`, {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json-rpc", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const payload = (await response.json().catch(() => ({}))) as { result?: T; error?: { message?: string; data?: string } };
  if (payload.error) {
    const message = `${payload.error.message || "Erro"} ${payload.error.data || ""}`.trim();
    const error = new Error(`Zabbix: ${message}`);
    (error as Error & { sessionExpired?: boolean }).sessionExpired = /re-login|not authori[sz]ed|session terminated|invalid session/i.test(message);
    throw error;
  }
  if (!response.ok) throw new Error(`Zabbix respondeu ${response.status}.`);
  return payload.result as T;
}

async function login() {
  sessionToken = await rpc<string>("user.login", { username: apiUser, password: apiPassword }, false);
}

// Chamada autenticada; refaz o login se a sessao expirar.
export async function zbx<T>(method: string, params: unknown): Promise<T> {
  if (!isZabbixConfigured()) throw new Error("Zabbix nao configurado. Defina ZABBIX_URL e ZABBIX_API_TOKEN (ou ZABBIX_USER/ZABBIX_PASSWORD).");
  if (!apiToken && !sessionToken) await login();
  try {
    return await rpc<T>(method, params);
  } catch (error) {
    if (!apiToken && (error as Error & { sessionExpired?: boolean }).sessionExpired) {
      await login();
      return rpc<T>(method, params);
    }
    throw error;
  }
}

export async function zabbixVersion() {
  return rpc<string>("apiinfo.version", [], false);
}

const cache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();
function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as Promise<T>;
  const value = loader();
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
  value.catch(() => cache.delete(key));
  return value;
}

/* ---------- Configuracao dos links ---------- */

export type LinkConfig = {
  id: string;
  name: string;
  contractedMbps: number;
  color: string;
  inItemId: string; // bits recebidos (download)
  outItemId: string; // bits enviados (upload)
  statusItemId: string; // status operacional da interface
  pingHostId: string; // host com template ICMP (ping/perda/latencia)
  enabled: boolean;
};

const dataDir = path.resolve(process.cwd(), "data");
const configPath = path.join(dataDir, "links.json");
const palette = ["#e01783", "#2e63d6", "#12936a", "#e0931f", "#7c3aed", "#0891b2"];

function parseContracted(text: string) {
  const match = /(\d+(?:[.,]\d+)?)\s*(G|M)/i.exec(text);
  if (!match) return 0;
  const value = Number(match[1].replace(",", "."));
  return match[2].toUpperCase() === "G" ? value * 1000 : value;
}

type ZbxItem = { itemid: string; hostid: string; name: string; key_: string; lastvalue: string; lastclock: string; units: string; value_type: string };
type ZbxHost = { hostid: string; name: string; hostgroups?: { name: string }[] };

// Sem configuracao salva: descobre os links (hosts do grupo "Links" + interface com o mesmo nome no firewall).
async function discoverLinks(): Promise<LinkConfig[]> {
  const groups = await zbx<{ groupid: string; name: string }[]>("hostgroup.get", { output: ["groupid", "name"], search: { name: "link" } });
  const linkHosts = groups.length
    ? await zbx<ZbxHost[]>("host.get", { groupids: groups.map((g) => g.groupid), output: ["hostid", "name"], selectParentTemplates: ["name"] })
    : [];
  const pingHosts = linkHosts.filter((host) => /^link\s/i.test(host.name));
  const interfaces = await zbx<ZbxItem[]>("item.get", {
    hostids: linkHosts.map((host) => host.hostid),
    output: ["itemid", "hostid", "name", "key_"],
    search: { key_: "net.if" },
  });

  return pingHosts.map((host, index) => {
    const provider = host.name.replace(/^link\s*/i, "").trim();
    const pattern = new RegExp(provider.replace(/[^a-z0-9]/gi, ""), "i");
    const ifName = interfaces
      .map((item) => /^Interface (.+?): Bits received$/.exec(item.name)?.[1] || "")
      .find((name) => name && pattern.test(name.replace(/[^a-z0-9]/gi, ""))) || "";
    const find = (suffix: string) => interfaces.find((item) => item.name === `Interface ${ifName}: ${suffix}`)?.itemid || "";
    return {
      id: `link-${host.hostid}`,
      name: provider.toUpperCase(),
      contractedMbps: parseContracted(ifName) || (/wcs|hostfiber/i.test(provider) ? 1000 : 0),
      color: palette[index % palette.length],
      inItemId: ifName ? find("Bits received") : "",
      outItemId: ifName ? find("Bits sent") : "",
      statusItemId: ifName ? find("Operational status") : "",
      pingHostId: host.hostid,
      enabled: true,
    };
  });
}

export async function getLinkConfig(): Promise<LinkConfig[]> {
  try {
    const raw = JSON.parse(await fs.readFile(configPath, "utf8")) as { links?: LinkConfig[] };
    if (Array.isArray(raw.links) && raw.links.length) return raw.links;
  } catch {
    /* sem arquivo: descobre automaticamente */
  }
  return cached("links:discover", 10 * 60 * 1000, discoverLinks);
}

export async function saveLinkConfig(input: unknown) {
  const source = (input && typeof input === "object" ? input : {}) as { links?: Partial<LinkConfig>[] };
  const links: LinkConfig[] = (Array.isArray(source.links) ? source.links : []).slice(0, 12).map((link, index) => ({
    id: String(link.id || `link-${Date.now()}-${index}`).slice(0, 60),
    name: String(link.name || `Link ${index + 1}`).slice(0, 40),
    contractedMbps: Math.max(0, Number(link.contractedMbps) || 0),
    color: /^#[0-9a-f]{6}$/i.test(String(link.color)) ? String(link.color) : palette[index % palette.length],
    inItemId: String(link.inItemId || "").replace(/\D/g, ""),
    outItemId: String(link.outItemId || "").replace(/\D/g, ""),
    statusItemId: String(link.statusItemId || "").replace(/\D/g, ""),
    pingHostId: String(link.pingHostId || "").replace(/\D/g, ""),
    enabled: link.enabled !== false,
  }));
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify({ links }, null, 2)}\n`, "utf8");
  cache.clear();
  return { links };
}

// Interfaces disponiveis para configurar (firewall/roteadores dos grupos de link).
export async function listLinkCandidates() {
  const groups = await zbx<{ groupid: string; name: string }[]>("hostgroup.get", { output: ["groupid", "name"] });
  const hosts = await zbx<ZbxHost[]>("host.get", {
    groupids: groups.filter((g) => /link|mikrotik|firewall|forti/i.test(g.name)).map((g) => g.groupid),
    output: ["hostid", "name"],
  });
  const items = await zbx<ZbxItem[]>("item.get", { hostids: hosts.map((h) => h.hostid), output: ["itemid", "hostid", "name", "lastvalue"], search: { key_: "net.if" } });
  const byHost = new Map(hosts.map((h) => [h.hostid, h.name]));
  const interfaces = new Map<string, { hostId: string; host: string; name: string; inItemId: string; outItemId: string; statusItemId: string; inBps: number; outBps: number }>();
  for (const item of items) {
    const match = /^Interface (.+?): (Bits received|Bits sent|Operational status)$/.exec(item.name);
    if (!match) continue;
    const key = `${item.hostid}:${match[1]}`;
    const entry = interfaces.get(key) || { hostId: item.hostid, host: byHost.get(item.hostid) || "", name: match[1], inItemId: "", outItemId: "", statusItemId: "", inBps: 0, outBps: 0 };
    if (match[2] === "Bits received") Object.assign(entry, { inItemId: item.itemid, inBps: Number(item.lastvalue) || 0 });
    if (match[2] === "Bits sent") Object.assign(entry, { outItemId: item.itemid, outBps: Number(item.lastvalue) || 0 });
    if (match[2] === "Operational status") entry.statusItemId = item.itemid;
    interfaces.set(key, entry);
  }
  return {
    interfaces: Array.from(interfaces.values()).filter((entry) => entry.inItemId && entry.outItemId).sort((a, b) => b.inBps + b.outBps - (a.inBps + a.outBps)),
    pingHosts: hosts.map((host) => ({ hostId: host.hostid, name: host.name })),
  };
}

/* ---------- Dados ao vivo e historico ---------- */

async function pingItems(hostIds: string[]) {
  if (!hostIds.length) return [] as ZbxItem[];
  return zbx<ZbxItem[]>("item.get", {
    hostids: hostIds,
    output: ["itemid", "hostid", "key_", "lastvalue", "lastclock"],
    filter: { key_: ["icmpping", "icmppingloss", "icmppingsec"] },
  });
}

export async function getLinksLive() {
  return cached("links:live", 8000, async () => {
    const links = (await getLinkConfig()).filter((link) => link.enabled);
    const itemIds = links.flatMap((link) => [link.inItemId, link.outItemId, link.statusItemId]).filter(Boolean);
    const [items, pings, problems] = await Promise.all([
      itemIds.length ? zbx<ZbxItem[]>("item.get", { itemids: itemIds, output: ["itemid", "hostid", "lastvalue", "lastclock"] }) : Promise.resolve([] as ZbxItem[]),
      pingItems(links.map((link) => link.pingHostId).filter(Boolean)),
      linkProblems(links),
    ]);
    const byId = new Map(items.map((item) => [item.itemid, item]));
    const now = Date.now() / 1000;

    return {
      checkedAt: new Date().toISOString(),
      links: links.map((link) => {
        const inItem = byId.get(link.inItemId);
        const outItem = byId.get(link.outItemId);
        const ping = (key: string) => pings.find((item) => item.hostid === link.pingHostId && item.key_ === key);
        const pingUp = ping("icmpping");
        const inBps = Number(inItem?.lastvalue || 0);
        const outBps = Number(outItem?.lastvalue || 0);
        const contracted = link.contractedMbps * 1e6;
        const operStatus = byId.get(link.statusItemId)?.lastvalue;
        const reachable = pingUp ? pingUp.lastvalue === "1" : operStatus ? operStatus === "1" : true;
        const lastClock = Math.max(Number(inItem?.lastclock || 0), Number(outItem?.lastclock || 0));
        return {
          id: link.id,
          name: link.name,
          color: link.color,
          contractedMbps: link.contractedMbps,
          inBps,
          outBps,
          usagePercent: contracted ? Math.round((Math.max(inBps, outBps) / contracted) * 1000) / 10 : null,
          online: reachable && operStatus !== "2",
          interfaceUp: operStatus ? operStatus === "1" : null,
          latencyMs: ping("icmppingsec") ? Math.round(Number(ping("icmppingsec")!.lastvalue) * 10000) / 10 : null,
          lossPercent: ping("icmppingloss") ? Number(ping("icmppingloss")!.lastvalue) : null,
          stale: lastClock ? now - lastClock > 600 : true,
          configured: Boolean(link.inItemId && link.outItemId),
        };
      }),
      problems,
    };
  });
}

async function linkProblems(links: LinkConfig[]) {
  const items = links.flatMap((link) => [link.inItemId, link.outItemId]).filter(Boolean);
  const hostIds = new Set(links.map((link) => link.pingHostId).filter(Boolean));
  if (items.length) {
    const owners = await zbx<ZbxItem[]>("item.get", { itemids: items, output: ["hostid"] });
    owners.forEach((item) => hostIds.add(item.hostid));
  }
  if (!hostIds.size) return [];
  const problems = await zbx<{ eventid: string; name: string; severity: string; clock: string; objectid: string }[]>("problem.get", {
    hostids: Array.from(hostIds),
    output: ["eventid", "name", "severity", "clock"],
    recent: false,
    sortfield: ["eventid"],
    sortorder: "DESC",
    limit: 30,
  });
  return problems.map((problem) => ({ id: problem.eventid, name: problem.name, severity: Number(problem.severity), at: new Date(Number(problem.clock) * 1000).toISOString() }));
}

const ranges: Record<string, { seconds: number; trend: boolean; bucket: number }> = {
  "1h": { seconds: 3600, trend: false, bucket: 60 },
  "6h": { seconds: 6 * 3600, trend: false, bucket: 300 },
  "24h": { seconds: 24 * 3600, trend: false, bucket: 900 },
  "7d": { seconds: 7 * 86400, trend: true, bucket: 3600 },
  "30d": { seconds: 30 * 86400, trend: true, bucket: 4 * 3600 },
};

type Point = { t: number; v: number; max?: number };

// Agrupa em baldes de tempo (media e pico) para graficos leves.
function bucketize(points: Point[], from: number, bucket: number) {
  const map = new Map<number, { sum: number; count: number; max: number }>();
  for (const point of points) {
    const key = from + Math.floor((point.t - from) / bucket) * bucket;
    const entry = map.get(key) || { sum: 0, count: 0, max: 0 };
    entry.sum += point.v;
    entry.count += 1;
    entry.max = Math.max(entry.max, point.max ?? point.v);
    map.set(key, entry);
  }
  return map;
}

async function seriesFor(itemIds: string[], range: { seconds: number; trend: boolean; bucket: number }) {
  const now = Math.floor(Date.now() / 1000);
  const from = now - range.seconds;
  if (!itemIds.length) return { from, now, points: new Map<string, Point[]>() };
  const points = new Map<string, Point[]>(itemIds.map((id) => [id, []]));
  if (range.trend) {
    const trends = await zbx<{ itemid: string; clock: string; value_avg: string; value_max: string }[]>("trend.get", {
      itemids: itemIds,
      time_from: from,
      time_till: now,
      output: ["itemid", "clock", "value_avg", "value_max"],
    });
    for (const row of trends) points.get(row.itemid)?.push({ t: Number(row.clock), v: Number(row.value_avg), max: Number(row.value_max) });
  } else {
    const types = await zbx<ZbxItem[]>("item.get", { itemids: itemIds, output: ["itemid", "value_type"] });
    for (const valueType of Array.from(new Set(types.map((item) => Number(item.value_type))))) {
      const ids = types.filter((item) => Number(item.value_type) === valueType).map((item) => item.itemid);
      const history = await zbx<{ itemid: string; clock: string; value: string }[]>("history.get", {
        history: valueType,
        itemids: ids,
        time_from: from,
        time_till: now,
        output: "extend",
        sortfield: "clock",
        sortorder: "ASC",
        limit: 100000,
      });
      for (const row of history) points.get(row.itemid)?.push({ t: Number(row.clock), v: Number(row.value) });
    }
  }
  return { from, now, points };
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

export async function getLinksHistory(rangeKey: string) {
  const range = ranges[rangeKey] || ranges["24h"];
  return cached(`links:history:${rangeKey}`, range.trend ? 5 * 60 * 1000 : 60 * 1000, async () => {
    const links = (await getLinkConfig()).filter((link) => link.enabled);
    const latencyItems = await pingItems(links.map((link) => link.pingHostId).filter(Boolean));
    const latencyByHost = new Map(latencyItems.filter((item) => item.key_ === "icmppingsec").map((item) => [item.hostid, item.itemid]));
    const trafficIds = links.flatMap((link) => [link.inItemId, link.outItemId]).filter(Boolean);
    const latencyIds = Array.from(latencyByHost.values());
    const { from, now, points } = await seriesFor([...trafficIds, ...latencyIds], range);

    const timeline = new Set<number>();
    const perLink = links.map((link) => {
      const inMap = bucketize(points.get(link.inItemId) || [], from, range.bucket);
      const outMap = bucketize(points.get(link.outItemId) || [], from, range.bucket);
      const latencyId = latencyByHost.get(link.pingHostId) || "";
      const latMap = bucketize(points.get(latencyId) || [], from, range.bucket);
      [inMap, outMap].forEach((map) => map.forEach((_value, key) => timeline.add(key)));
      const inValues = (points.get(link.inItemId) || []).map((point) => point.max ?? point.v);
      const outValues = (points.get(link.outItemId) || []).map((point) => point.max ?? point.v);
      const avg = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
      return {
        link,
        inMap,
        outMap,
        latMap,
        stats: {
          inPeak: Math.max(0, ...inValues),
          outPeak: Math.max(0, ...outValues),
          inAvg: avg((points.get(link.inItemId) || []).map((point) => point.v)),
          outAvg: avg((points.get(link.outItemId) || []).map((point) => point.v)),
          inP95: percentile(inValues, 95),
          outP95: percentile(outValues, 95),
        },
      };
    });

    const times = Array.from(timeline).sort((a, b) => a - b);
    const mbps = (entry?: { sum: number; count: number }) => (entry ? Math.round((entry.sum / entry.count / 1e6) * 10) / 10 : null);
    const ms = (entry?: { sum: number; count: number }) => (entry ? Math.round((entry.sum / entry.count) * 10000) / 10 : null);

    return {
      range: rangeKey in ranges ? rangeKey : "24h",
      from: new Date(from * 1000).toISOString(),
      to: new Date(now * 1000).toISOString(),
      bucketSeconds: range.bucket,
      links: perLink.map(({ link, inMap, outMap, latMap, stats }) => ({
        id: link.id,
        name: link.name,
        color: link.color,
        contractedMbps: link.contractedMbps,
        stats: {
          inPeakMbps: Math.round(stats.inPeak / 1e5) / 10,
          outPeakMbps: Math.round(stats.outPeak / 1e5) / 10,
          inAvgMbps: Math.round(stats.inAvg / 1e5) / 10,
          outAvgMbps: Math.round(stats.outAvg / 1e5) / 10,
          inP95Mbps: Math.round(stats.inP95 / 1e5) / 10,
          outP95Mbps: Math.round(stats.outP95 / 1e5) / 10,
        },
        series: times.map((t) => ({ t: t * 1000, in: mbps(inMap.get(t)), out: mbps(outMap.get(t)), latency: ms(latMap.get(t)) })),
      })),
    };
  });
}
