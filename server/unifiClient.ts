import http from "node:http";
import https from "node:https";

// Conector somente leitura da controladora UniFi Network instalada em servidor (testado com 8.0).
// Um unico login por processo; os dados ficam em cache por 30 s para nao pesar a controladora.
const unifiUrl = (process.env.UNIFI_URL || "").replace(/\/$/, "");
const unifiUser = process.env.UNIFI_USER || "";
const unifiPassword = process.env.UNIFI_PASSWORD || "";
const unifiSites = (process.env.UNIFI_SITES || "")
  .split(",")
  .map((site) => site.trim())
  .filter(Boolean);
// Controladoras costumam usar certificado autoassinado; desligue a validacao so se for o caso.
const rejectUnauthorized = process.env.UNIFI_TLS_REJECT_UNAUTHORIZED !== "false";

export function isUnifiConfigured() {
  return Boolean(unifiUrl && unifiUser && unifiPassword);
}

export function unifiHost() {
  try {
    return unifiUrl ? new URL(unifiUrl).host : "";
  } catch {
    return "";
  }
}

let cookie = "";

function request(method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; json: unknown; setCookie: string[] }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${unifiUrl}${path}`);
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const client = url.protocol === "http:" ? http : https;
    const req = client.request(
      url,
      {
        method,
        rejectUnauthorized,
        timeout: 15000,
        headers: {
          Accept: "application/json",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json: unknown = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json, setCookie: res.headers["set-cookie"] || [] });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("UniFi: tempo esgotado.")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login() {
  const response = await request("POST", "/api/login", { username: unifiUser, password: unifiPassword });
  if (response.status !== 200) {
    const message = (response.json as { meta?: { msg?: string } } | null)?.meta?.msg || `HTTP ${response.status}`;
    throw new Error(`UniFi: login recusado (${message}).`);
  }
  cookie = response.setCookie.map((entry) => entry.split(";")[0]).join("; ");
}

async function api<T>(path: string): Promise<T[]> {
  if (!isUnifiConfigured()) throw new Error("UniFi nao configurado. Defina UNIFI_URL, UNIFI_USER e UNIFI_PASSWORD.");
  if (!cookie) await login();
  let response = await request("GET", path);
  if (response.status === 401) {
    await login();
    response = await request("GET", path);
  }
  if (response.status !== 200) throw new Error(`UniFi respondeu ${response.status} em ${path}.`);
  return ((response.json as { data?: T[] } | null)?.data || []) as T[];
}

export async function unifiVersion() {
  const response = await request("GET", "/status");
  return (response.json as { meta?: { server_version?: string } } | null)?.meta?.server_version || "";
}

/* ---------- Tipos da API (so os campos usados) ---------- */

type RawPort = {
  port_idx: number;
  name?: string;
  up?: boolean;
  enable?: boolean;
  speed?: number;
  is_uplink?: boolean;
  poe_enable?: boolean;
  poe_power?: string;
  rx_errors?: number;
  tx_errors?: number;
  "rx_bytes-r"?: number;
  "tx_bytes-r"?: number;
};

type RawRadio = { name?: string; radio?: string; channel?: number; cu_total?: number; num_sta?: number; satisfaction?: number };

type RawDevice = {
  mac: string;
  name?: string;
  model?: string;
  type?: string;
  state?: number;
  ip?: string;
  version?: string;
  uptime?: number;
  upgradable?: boolean;
  num_sta?: number;
  satisfaction?: number;
  general_temperature?: number;
  fan_level?: number;
  total_max_power?: number;
  "system-stats"?: { cpu?: string | number; mem?: string | number };
  port_table?: RawPort[];
  radio_table_stats?: RawRadio[];
  uplink?: { type?: string; speed?: number; uplink_device_name?: string; uplink_remote_port?: number };
};

type RawClient = { is_wired?: boolean; ap_mac?: string; essid?: string; radio?: string };
type RawAlarm = { _id: string; datetime?: string; time?: number; msg?: string; key?: string; subsystem?: string };
type RawSite = { name: string; desc?: string };

/* ---------- Resumo para o Painel NOC ---------- */

export type UnifiSwitch = {
  id: string;
  site: string;
  name: string;
  model: string;
  online: boolean;
  cpu: number | null;
  memory: number | null;
  temperature: number | null;
  uptimeSec: number | null;
  portsUp: number;
  portsTotal: number;
  portErrors: number;
  poeWatts: number;
  poeMaxWatts: number | null;
  clients: number;
  uplink: string;
  upgradable: boolean;
};

export type UnifiAp = {
  id: string;
  site: string;
  name: string;
  model: string;
  online: boolean;
  cpu: number | null;
  memory: number | null;
  clients: number;
  satisfaction: number | null;
  radios: { band: string; channel: number | null; utilization: number | null; clients: number }[];
  uplink: string;
  upgradable: boolean;
};

export type UnifiOverview = {
  generatedAt: string;
  version: string;
  sites: { name: string; title: string }[];
  switches: UnifiSwitch[];
  aps: UnifiAp[];
  clients: { total: number; wired: number; wireless: number; bySsid: { ssid: string; count: number }[] };
  alarms: { id: string; site: string; time: string; message: string }[];
};

const num = (value: unknown) => {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
};

const bandName = (radio?: string) => (radio === "ng" ? "2,4 GHz" : radio === "na" ? "5 GHz" : radio === "6e" ? "6 GHz" : radio || "rádio");

function uplinkLabel(device: RawDevice) {
  const link = device.uplink;
  if (!link) return "";
  const speed = link.speed ? (link.speed >= 1000 ? `${link.speed / 1000} Gbps` : `${link.speed} Mbps`) : "";
  const peer = link.uplink_device_name ? `${link.uplink_device_name}${link.uplink_remote_port ? ` porta ${link.uplink_remote_port}` : ""}` : link.type === "wireless" ? "sem fio" : "";
  return [peer, speed].filter(Boolean).join(" · ");
}

async function loadSite(site: RawSite) {
  const [devices, clients, alarms] = await Promise.all([
    api<RawDevice>(`/api/s/${site.name}/stat/device`),
    api<RawClient>(`/api/s/${site.name}/stat/sta`),
    api<RawAlarm>(`/api/s/${site.name}/list/alarm?archived=false`).catch(() => [] as RawAlarm[]),
  ]);
  return { site, devices, clients, alarms };
}

async function buildOverview(): Promise<UnifiOverview> {
  const allSites = await api<RawSite>("/api/self/sites");
  const sites = unifiSites.length ? allSites.filter((site) => unifiSites.includes(site.name) || unifiSites.includes(site.desc || "")) : allSites;
  const [loaded, version] = await Promise.all([Promise.all(sites.map(loadSite)), unifiVersion().catch(() => "")]);

  const switches: UnifiSwitch[] = [];
  const aps: UnifiAp[] = [];
  const ssid = new Map<string, number>();
  let wired = 0;
  let wireless = 0;
  const alarms: UnifiOverview["alarms"] = [];

  for (const { site, devices, clients, alarms: siteAlarms } of loaded) {
    const title = site.desc || site.name;
    const clientsByAp = new Map<string, number>();
    for (const client of clients) {
      if (client.is_wired) {
        wired += 1;
        continue;
      }
      wireless += 1;
      if (client.ap_mac) clientsByAp.set(client.ap_mac, (clientsByAp.get(client.ap_mac) || 0) + 1);
      const name = client.essid || "(oculta)";
      ssid.set(name, (ssid.get(name) || 0) + 1);
    }

    for (const device of devices) {
      const stats = device["system-stats"] || {};
      const base = {
        id: device.mac,
        site: title,
        name: device.name || device.mac,
        model: device.model || "",
        online: device.state === 1,
        cpu: num(stats.cpu),
        memory: num(stats.mem),
        uplink: uplinkLabel(device),
        upgradable: Boolean(device.upgradable),
      };
      if (device.type === "usw") {
        const ports = (device.port_table || []).filter((port) => port.enable !== false);
        switches.push({
          ...base,
          temperature: num(device.general_temperature),
          uptimeSec: device.uptime ?? null,
          portsUp: ports.filter((port) => port.up).length,
          portsTotal: ports.length,
          portErrors: ports.reduce((sum, port) => sum + (port.rx_errors || 0) + (port.tx_errors || 0), 0),
          poeWatts: Math.round(ports.reduce((sum, port) => sum + (num(port.poe_power) || 0), 0) * 10) / 10,
          poeMaxWatts: num(device.total_max_power),
          clients: device.num_sta || 0,
        });
      } else if (device.type === "uap") {
        aps.push({
          ...base,
          clients: clientsByAp.get(device.mac) ?? device.num_sta ?? 0,
          satisfaction: num(device.satisfaction),
          radios: (device.radio_table_stats || []).map((radio) => ({
            band: bandName(radio.radio),
            channel: radio.channel ?? null,
            utilization: num(radio.cu_total),
            clients: radio.num_sta || 0,
          })),
        });
      }
    }

    for (const alarm of siteAlarms.slice(0, 30)) {
      alarms.push({
        id: alarm._id,
        site: title,
        time: alarm.datetime || (alarm.time ? new Date(alarm.time).toISOString() : ""),
        message: alarm.msg || alarm.key || "Alarme",
      });
    }
  }

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "pt-BR", { numeric: true });
  return {
    generatedAt: new Date().toISOString(),
    version,
    sites: sites.map((site) => ({ name: site.name, title: site.desc || site.name })),
    switches: switches.sort(byName),
    aps: aps.sort((a, b) => Number(a.online) - Number(b.online) || b.clients - a.clients),
    clients: {
      total: wired + wireless,
      wired,
      wireless,
      bySsid: Array.from(ssid, ([name, count]) => ({ ssid: name, count })).sort((a, b) => b.count - a.count),
    },
    alarms: alarms.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 30),
  };
}

let cache: { expiresAt: number; value: Promise<UnifiOverview> } | null = null;

export function getUnifiOverview() {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const value = buildOverview();
  cache = { expiresAt: Date.now() + 30000, value };
  value.catch(() => {
    cache = null;
    cookie = "";
  });
  return value;
}
