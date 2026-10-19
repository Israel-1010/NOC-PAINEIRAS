import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import type { AuthUser } from "./auth";
import { sessionSecret } from "./config";

// Conector somente leitura de controladoras UniFi Network instaladas em servidor (testado com 8.0).
// Aceita varias controladoras (ex.: uma de switches, outra de antenas); cada uma tem sua sessao,
// um unico login e cache de 30 s para nao pesar. Configuracao: formulario do Painel NOC (tem prioridade),
// salvo em data/unifi.json com as senhas criptografadas (AES-256-GCM, chave derivada do APP_SESSION_SECRET),
// ou as variaveis UNIFI_* (uma controladora).

type ControllerConfig = { id: string; name: string; url: string; user: string; password: string; sites: string[]; rejectUnauthorized: boolean };
type StoredController = { id: string; name: string; url: string; user: string; passwordEnc: string; sites: string[]; insecureTls: boolean };
type StoredConfig = { controllers: StoredController[]; updatedAt: string; updatedBy: string };
type LegacyStored = { url?: string; user?: string; passwordEnc?: string; sites?: string[]; insecureTls?: boolean; updatedAt?: string; updatedBy?: string };

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "unifi.json");
const envConfigured = Boolean(process.env.UNIFI_URL);
const key = crypto.createHash("sha256").update(`unifi:${sessionSecret}`).digest();

function encrypt(text: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64")).join(".");
}

function decrypt(value: string) {
  try {
    const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return ""; // segredo da sessao mudou: senha precisa ser informada de novo
  }
}

const splitSites = (value: unknown) =>
  (Array.isArray(value) ? value.map(String) : String(value || "").split(","))
    .map((site) => site.trim())
    .filter(Boolean);

const cleanUrl = (value: unknown) => String(value || "").trim().replace(/\/$/, "");

function loadStored(): StoredConfig | null {
  try {
    const raw = JSON.parse(fsSync.readFileSync(storePath, "utf8")) as StoredConfig & LegacyStored;
    if (Array.isArray(raw.controllers)) return raw;
    // Formato antigo (uma controladora so).
    if (raw.url) {
      return {
        controllers: [{ id: "c1", name: "Controladora", url: raw.url, user: raw.user || "", passwordEnc: raw.passwordEnc || "", sites: raw.sites || [], insecureTls: Boolean(raw.insecureTls) }],
        updatedAt: raw.updatedAt || "",
        updatedBy: raw.updatedBy || "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

function envController(): ControllerConfig {
  return {
    id: "env",
    name: "Controladora",
    url: cleanUrl(process.env.UNIFI_URL),
    user: process.env.UNIFI_USER || "",
    password: process.env.UNIFI_PASSWORD || "",
    sites: splitSites(process.env.UNIFI_SITES),
    // Controladoras costumam usar certificado autoassinado; desligue a validacao so se for o caso.
    rejectUnauthorized: process.env.UNIFI_TLS_REJECT_UNAUTHORIZED !== "false",
  };
}

function resolveConfig(): { source: "panel" | "env" | "none"; controllers: ControllerConfig[] } {
  const stored = loadStored();
  if (stored?.controllers.length) {
    const envUrl = cleanUrl(process.env.UNIFI_URL);
    return {
      source: "panel",
      controllers: stored.controllers.map((entry) => ({
        id: entry.id,
        name: entry.name || "Controladora",
        url: cleanUrl(entry.url),
        user: entry.user || "",
        // Sem senha salva no painel, aproveita a do servidor quando for a mesma controladora.
        password: entry.passwordEnc ? decrypt(entry.passwordEnc) : cleanUrl(entry.url) === envUrl ? process.env.UNIFI_PASSWORD || "" : "",
        sites: entry.sites || [],
        rejectUnauthorized: !entry.insecureTls,
      })),
    };
  }
  if (envConfigured) return { source: "env", controllers: [envController()] };
  return { source: "none", controllers: [] };
}

/* ---------- Sessao por controladora ---------- */

// Depois de um login recusado, espera antes de tentar de novo: a controladora bloqueia a conta
// quando recebe muitas tentativas erradas (e ai recusa ate a senha certa).
const LOGIN_BACKOFF_MS = 10 * 60 * 1000;

class Controller {
  cookie = "";
  blockedUntil = 0;
  lastLoginError = "";

  constructor(readonly cfg: ControllerConfig) {}

  get configured() {
    return Boolean(this.cfg.url && this.cfg.user && this.cfg.password);
  }

  get host() {
    try {
      return this.cfg.url ? new URL(this.cfg.url).host : "";
    } catch {
      return "";
    }
  }

  request(method: "GET" | "POST", route: string, body?: unknown): Promise<{ status: number; json: unknown; setCookie: string[] }> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.cfg.url}${route}`);
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const client = url.protocol === "http:" ? http : https;
      const req = client.request(
        url,
        {
          method,
          rejectUnauthorized: this.cfg.rejectUnauthorized,
          timeout: 15000,
          headers: {
            Accept: "application/json",
            ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
            ...(this.cookie ? { Cookie: this.cookie } : {}),
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

  async login(force = false) {
    if (!force && Date.now() < this.blockedUntil) {
      const minutes = Math.ceil((this.blockedUntil - Date.now()) / 60000);
      throw new Error(`${this.lastLoginError} Nova tentativa automática em ${minutes} min (para não bloquear a conta).`);
    }
    const response = await this.request("POST", "/api/login", { username: this.cfg.user, password: this.cfg.password });
    if (response.status !== 200) {
      const message = (response.json as { meta?: { msg?: string } } | null)?.meta?.msg || `HTTP ${response.status}`;
      this.lastLoginError =
        message === "api.err.Invalid"
          ? "Login recusado (api.err.Invalid): usuário/senha errados ou conta bloqueada temporariamente por excesso de tentativas."
          : `Login recusado (${message}).`;
      this.blockedUntil = Date.now() + LOGIN_BACKOFF_MS;
      throw new Error(this.lastLoginError);
    }
    this.blockedUntil = 0;
    this.lastLoginError = "";
    this.cookie = response.setCookie.map((entry) => entry.split(";")[0]).join("; ");
  }

  async api<T>(route: string): Promise<T[]> {
    if (!this.configured) throw new Error("Preencha endereço, usuário e senha.");
    if (!this.cookie) await this.login();
    let response = await this.request("GET", route);
    if (response.status === 401) {
      await this.login();
      response = await this.request("GET", route);
    }
    if (response.status !== 200) throw new Error(`Respondeu ${response.status} em ${route}.`);
    return ((response.json as { data?: T[] } | null)?.data || []) as T[];
  }

  async version() {
    const response = await this.request("GET", "/status");
    return (response.json as { meta?: { server_version?: string } } | null)?.meta?.server_version || "";
  }

  describeError(error: unknown) {
    const err = error as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException };
    const code = err?.code || err?.cause?.code || "";
    if (/ECONNREFUSED/.test(code)) return `A controladora recusou a conexão em ${this.host} (porta fechada ou serviço parado).`;
    if (/ETIMEDOUT|ENETUNREACH|EHOSTUNREACH/.test(code) || /tempo esgotado/i.test(err?.message || "")) return `Sem resposta de ${this.host}: o servidor do portal não alcança a controladora (rota/firewall).`;
    if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code)) return "Certificado da controladora não confiável: marque \"Aceitar certificado autoassinado\".";
    return err instanceof Error ? err.message : "Falha ao conectar.";
  }
}

let resolved = resolveConfig();
let controllers = resolved.controllers.map((cfg) => new Controller(cfg));

function reload() {
  resolved = resolveConfig();
  controllers = resolved.controllers.map((cfg) => new Controller(cfg));
  cache = null;
}

export function isUnifiConfigured() {
  return controllers.some((controller) => controller.configured);
}

export function unifiTargets() {
  return controllers.map((controller) => ({ name: controller.cfg.name, host: controller.host }));
}

/* ---------- Formulario ---------- */

// Para o formulario: nunca devolve senha.
export function getUnifiSettings() {
  const stored = resolved.source === "panel" ? loadStored() : null;
  return {
    source: resolved.source,
    envConfigured,
    controllers: controllers.map(({ cfg }) => ({
      id: cfg.id,
      name: cfg.name,
      url: cfg.url,
      user: cfg.user,
      hasPassword: Boolean(cfg.password),
      sites: cfg.sites.join(", "),
      insecureTls: !cfg.rejectUnauthorized,
    })),
    updatedAt: stored?.updatedAt || "",
    updatedBy: stored?.updatedBy || "",
  };
}

async function testController(controller: Controller) {
  const base = { id: controller.cfg.id, name: controller.cfg.name };
  if (!controller.configured) return { ...base, ok: false, message: "Preencha endereço, usuário e senha." };
  controller.cookie = "";
  try {
    await controller.login(true); // teste pedido pelo gestor ignora a espera
    const data = await loadController(controller);
    return { ...base, ok: true, message: `Conectado: UniFi ${data.version} · ${data.switches.length} switches · ${data.aps.length} antenas · ${data.wired + data.wireless} clientes` };
  } catch (error) {
    return { ...base, ok: false, message: controller.describeError(error) };
  }
}

// Testa cada controladora sem cache e devolve o motivo exato de cada falha.
export async function testUnifi() {
  cache = null;
  return { results: await Promise.all(controllers.map(testController)) };
}

export async function saveUnifiSettings(body: Record<string, unknown>, by: AuthUser) {
  const list = Array.isArray(body.controllers) ? (body.controllers as Record<string, unknown>[]) : [];
  if (list.length > 10) throw new Error("Limite de 10 controladoras.");
  const previous = loadStored();
  const envUrl = cleanUrl(process.env.UNIFI_URL);
  const entries: StoredController[] = list.map((item, index) => {
    const url = cleanUrl(item.url);
    if (!/^https?:\/\/[^/\s]+$/i.test(url)) throw new Error(`Endereço inválido na controladora ${index + 1}. Exemplo: https://10.0.0.56:8443`);
    const id = /^[a-z0-9-]{1,40}$/i.test(String(item.id || "")) ? String(item.id) : crypto.randomUUID().slice(0, 8);
    const newPassword = String(item.password || "");
    const kept = previous?.controllers.find((entry) => entry.id === id)?.passwordEnc || "";
    const fromEnv = !kept && url === envUrl && process.env.UNIFI_PASSWORD ? encrypt(process.env.UNIFI_PASSWORD) : "";
    return {
      id,
      name: String(item.name || "").trim().slice(0, 60) || `Controladora ${index + 1}`,
      url,
      user: String(item.user || "").trim().slice(0, 120),
      passwordEnc: newPassword ? encrypt(newPassword) : kept || fromEnv,
      sites: splitSites(item.sites),
      insecureTls: Boolean(item.insecureTls),
    };
  });
  const stored: StoredConfig = { controllers: entries, updatedAt: new Date().toISOString(), updatedBy: by.login };
  await fs.mkdir(dataDir, { recursive: true });
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(stored, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await fs.rename(tempPath, storePath);
  reload();
  return { ...getUnifiSettings(), ...(await testUnifi()) };
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
  total_max_power?: number;
  "system-stats"?: { cpu?: string | number; mem?: string | number };
  port_table?: RawPort[];
  radio_table_stats?: RawRadio[];
  uplink?: { type?: string; speed?: number; uplink_device_name?: string; uplink_remote_port?: number };
};

type RawClient = { is_wired?: boolean; ap_mac?: string; essid?: string };
type RawAlarm = { _id: string; datetime?: string; time?: number; msg?: string; key?: string };
type RawSite = { name: string; desc?: string };

/* ---------- Resumo para o Painel NOC ---------- */

export type UnifiSwitch = {
  id: string;
  controller: string;
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
  controller: string;
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
  controllers: { id: string; name: string; ok: boolean; message: string; version: string }[];
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

// Le uma controladora inteira (todos os sites escolhidos).
async function loadController(controller: Controller) {
  const allSites = await controller.api<RawSite>("/api/self/sites");
  const wanted = controller.cfg.sites;
  const sites = wanted.length ? allSites.filter((site) => wanted.includes(site.name) || wanted.includes(site.desc || "")) : allSites;
  const [loaded, version] = await Promise.all([
    Promise.all(
      sites.map(async (site) => {
        const [devices, clients, alarms] = await Promise.all([
          controller.api<RawDevice>(`/api/s/${site.name}/stat/device`),
          controller.api<RawClient>(`/api/s/${site.name}/stat/sta`),
          controller.api<RawAlarm>(`/api/s/${site.name}/list/alarm?archived=false`).catch(() => [] as RawAlarm[]),
        ]);
        return { site, devices, clients, alarms };
      }),
    ),
    controller.version().catch(() => ""),
  ]);

  const name = controller.cfg.name;
  const switches: UnifiSwitch[] = [];
  const aps: UnifiAp[] = [];
  const ssid = new Map<string, number>();
  const alarms: UnifiOverview["alarms"] = [];
  let wired = 0;
  let wireless = 0;

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
      const network = client.essid || "(oculta)";
      ssid.set(network, (ssid.get(network) || 0) + 1);
    }

    for (const device of devices) {
      const stats = device["system-stats"] || {};
      const base = {
        id: `${controller.cfg.id}:${device.mac}`,
        controller: name,
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
        id: `${controller.cfg.id}:${alarm._id}`,
        site: title,
        time: alarm.datetime || (alarm.time ? new Date(alarm.time).toISOString() : ""),
        message: alarm.msg || alarm.key || "Alarme",
      });
    }
  }

  return { version, sites: sites.map((site) => ({ name: site.name, title: site.desc || site.name })), switches, aps, ssid, alarms, wired, wireless };
}

async function buildOverview(): Promise<UnifiOverview> {
  const active = controllers.filter((controller) => controller.configured);
  const results = await Promise.all(
    active.map(async (controller) => {
      try {
        return { controller, data: await loadController(controller), error: "" };
      } catch (error) {
        controller.cookie = "";
        return { controller, data: null, error: controller.describeError(error) };
      }
    }),
  );
  const ok = results.filter((entry) => entry.data);
  // Nenhuma respondeu: erro para o painel esconder a pagina e mostrar o motivo.
  if (!ok.length) throw new Error(results.map((entry) => `UniFi ${entry.controller.cfg.name}: ${entry.error}`).join(" | ") || "UniFi sem controladora configurada.");

  const ssid = new Map<string, number>();
  for (const entry of ok) for (const [network, count] of entry.data!.ssid) ssid.set(network, (ssid.get(network) || 0) + count);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "pt-BR", { numeric: true });
  const wired = ok.reduce((sum, entry) => sum + entry.data!.wired, 0);
  const wireless = ok.reduce((sum, entry) => sum + entry.data!.wireless, 0);

  return {
    generatedAt: new Date().toISOString(),
    version: Array.from(new Set(ok.map((entry) => entry.data!.version).filter(Boolean))).join(", "),
    controllers: results.map(({ controller, data, error }) => ({
      id: controller.cfg.id,
      name: controller.cfg.name,
      ok: Boolean(data),
      message: data ? "" : error,
      version: data?.version || "",
    })),
    sites: ok.flatMap((entry) => entry.data!.sites),
    switches: ok.flatMap((entry) => entry.data!.switches).sort(byName),
    aps: ok.flatMap((entry) => entry.data!.aps).sort((a, b) => Number(a.online) - Number(b.online) || b.clients - a.clients),
    clients: {
      total: wired + wireless,
      wired,
      wireless,
      bySsid: Array.from(ssid, ([network, count]) => ({ ssid: network, count })).sort((a, b) => b.count - a.count),
    },
    alarms: ok
      .flatMap((entry) => entry.data!.alarms)
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 30),
  };
}

let cache: { expiresAt: number; value: Promise<UnifiOverview> } | null = null;

export function getUnifiOverview() {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const value = buildOverview();
  cache = { expiresAt: Date.now() + 30000, value };
  value.catch(() => {
    cache = null;
  });
  return value;
}
