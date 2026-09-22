import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const snmp = require("net-snmp") as any;

export type SnmpVersion = "1" | "2c" | "3";

export type SnmpDevice = {
  id: string;
  name: string;
  host: string;
  port: number;
  type: "Fortinet" | "UniFi" | "Switch" | "Firewall" | "Servidor" | "Outro";
  version: SnmpVersion;
  community: string;
  username: string;
  authProtocol: "none" | "md5" | "sha";
  authKey: string;
  privProtocol: "none" | "des" | "aes";
  privKey: string;
  timeoutMs: number;
  retries: number;
  enabled: boolean;
  notes: string;
  updatedAt: string;
};

export type SnmpMetric = {
  deviceId: string;
  ok: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string;
  sysName: string;
  sysDescr: string;
  sysObjectId: string;
  uptime: string;
  contact: string;
  location: string;
  interfaces: number | null;
};

type SnmpStore = {
  devices: SnmpDevice[];
  metrics: SnmpMetric[];
};

const dataDir = path.resolve("data");
const storePath = path.join(dataDir, "snmpDevices.json");
const oidMap = {
  sysDescr: "1.3.6.1.2.1.1.1.0",
  sysObjectId: "1.3.6.1.2.1.1.2.0",
  uptime: "1.3.6.1.2.1.1.3.0",
  contact: "1.3.6.1.2.1.1.4.0",
  sysName: "1.3.6.1.2.1.1.5.0",
  location: "1.3.6.1.2.1.1.6.0",
  interfaces: "1.3.6.1.2.1.2.1.0",
};

let writeQueue = Promise.resolve();

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.round(next)));
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeVersion(value: unknown): SnmpVersion {
  return value === "1" || value === "3" ? value : "2c";
}

function normalizeDevice(input: unknown): SnmpDevice {
  const source = input && typeof input === "object" ? input as Partial<SnmpDevice> : {};
  const type = source.type === "Fortinet" || source.type === "UniFi" || source.type === "Switch" || source.type === "Firewall" || source.type === "Servidor" || source.type === "Outro"
    ? source.type
    : "Switch";

  return {
    id: clean(source.id) || makeId("snmp"),
    name: clean(source.name) || clean(source.host) || "Dispositivo SNMP",
    host: clean(source.host),
    port: numberValue(source.port, 161, 1, 65535),
    type,
    version: normalizeVersion(source.version),
    community: clean(source.community) || "public",
    username: clean(source.username),
    authProtocol: source.authProtocol === "md5" || source.authProtocol === "sha" ? source.authProtocol : "none",
    authKey: clean(source.authKey),
    privProtocol: source.privProtocol === "des" || source.privProtocol === "aes" ? source.privProtocol : "none",
    privKey: clean(source.privKey),
    timeoutMs: numberValue(source.timeoutMs, 1800, 500, 15000),
    retries: numberValue(source.retries, 1, 0, 5),
    enabled: source.enabled !== false,
    notes: clean(source.notes),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeMetric(input: unknown): SnmpMetric {
  const source = input && typeof input === "object" ? input as Partial<SnmpMetric> : {};
  return {
    deviceId: clean(source.deviceId),
    ok: source.ok === true,
    checkedAt: clean(source.checkedAt) || new Date().toISOString(),
    latencyMs: typeof source.latencyMs === "number" ? source.latencyMs : null,
    message: clean(source.message),
    sysName: clean(source.sysName),
    sysDescr: clean(source.sysDescr),
    sysObjectId: clean(source.sysObjectId),
    uptime: clean(source.uptime),
    contact: clean(source.contact),
    location: clean(source.location),
    interfaces: typeof source.interfaces === "number" ? source.interfaces : null,
  };
}

function normalizeStore(input: unknown): SnmpStore {
  const source = input && typeof input === "object" ? input as Partial<SnmpStore> : {};
  return {
    devices: Array.isArray(source.devices) ? source.devices.map(normalizeDevice) : [],
    metrics: Array.isArray(source.metrics) ? source.metrics.map(normalizeMetric).filter((metric) => metric.deviceId) : [],
  };
}

async function readStore(): Promise<SnmpStore> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code === "ENOENT") {
      return { devices: [], metrics: [] };
    }
    throw error;
  }
}

async function writeStore(store: SnmpStore) {
  const normalized = normalizeStore(store);
  const writeTask = writeQueue.then(async () => {
    await fs.mkdir(dataDir, { recursive: true });
    const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, storePath);
  });
  writeQueue = writeTask.catch(() => undefined);
  await writeTask;
  return normalized;
}

function formatVarbindValue(value: unknown) {
  if (Buffer.isBuffer(value)) return value.toString("utf8").replace(/\u0000/g, "").trim();
  return clean(value);
}

function formatUptime(value: unknown) {
  const centiseconds = Number(value);
  if (!Number.isFinite(centiseconds)) return clean(value);
  const seconds = Math.floor(centiseconds / 100);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function createSession(device: SnmpDevice) {
  const options = {
    port: device.port,
    retries: device.retries,
    timeout: device.timeoutMs,
    version: device.version === "1" ? snmp.Version1 : device.version === "3" ? snmp.Version3 : snmp.Version2c,
  };

  if (device.version !== "3") {
    return snmp.createSession(device.host, device.community, options);
  }

  const user = {
    name: device.username,
    level: device.privProtocol !== "none" ? snmp.SecurityLevel.authPriv : device.authProtocol !== "none" ? snmp.SecurityLevel.authNoPriv : snmp.SecurityLevel.noAuthNoPriv,
    authProtocol: device.authProtocol === "sha" ? snmp.AuthProtocols.sha : snmp.AuthProtocols.md5,
    authKey: device.authKey,
    privProtocol: device.privProtocol === "aes" ? snmp.PrivProtocols.aes : snmp.PrivProtocols.des,
    privKey: device.privKey,
  };

  return snmp.createV3Session(device.host, user, options);
}

async function snmpGet(device: SnmpDevice) {
  if (!device.host) {
    throw new Error("Informe o IP ou DNS do dispositivo.");
  }

  const session = createSession(device);
  const startedAt = Date.now();
  const oids = Object.values(oidMap);

  try {
    const varbinds = await new Promise<any[]>((resolve, reject) => {
      session.get(oids, (error: Error | null, response: any[]) => {
        if (error) reject(error);
        else resolve(response);
      });
    });

    const values = new Map<string, unknown>();
    varbinds.forEach((varbind) => {
      if (snmp.isVarbindError(varbind)) {
        values.set(varbind.oid, "");
      } else {
        values.set(varbind.oid, varbind.value);
      }
    });

    return {
      deviceId: device.id,
      ok: true,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      message: "SNMP respondeu",
      sysName: formatVarbindValue(values.get(oidMap.sysName)),
      sysDescr: formatVarbindValue(values.get(oidMap.sysDescr)),
      sysObjectId: formatVarbindValue(values.get(oidMap.sysObjectId)),
      uptime: formatUptime(values.get(oidMap.uptime)),
      contact: formatVarbindValue(values.get(oidMap.contact)),
      location: formatVarbindValue(values.get(oidMap.location)),
      interfaces: Number.isFinite(Number(values.get(oidMap.interfaces))) ? Number(values.get(oidMap.interfaces)) : null,
    } satisfies SnmpMetric;
  } finally {
    session.close();
  }
}

function failedMetric(device: SnmpDevice, error: unknown): SnmpMetric {
  return {
    deviceId: device.id,
    ok: false,
    checkedAt: new Date().toISOString(),
    latencyMs: null,
    message: error instanceof Error ? error.message : "Falha SNMP",
    sysName: "",
    sysDescr: "",
    sysObjectId: "",
    uptime: "",
    contact: "",
    location: "",
    interfaces: null,
  };
}

async function collectDeviceMetric(device: SnmpDevice) {
  try {
    return await snmpGet(device);
  } catch (error) {
    return failedMetric(device, error);
  }
}

export async function listSnmp() {
  const store = await readStore();
  return {
    devices: store.devices,
    metrics: store.metrics,
  };
}

export async function getSnmpSummary() {
  const store = await readStore();
  const metricByDevice = new Map(store.metrics.map((metric) => [metric.deviceId, metric]));
  const enabled = store.devices.filter((device) => device.enabled);
  const online = enabled.filter((device) => metricByDevice.get(device.id)?.ok).length;
  const offline = enabled.length - online;
  return {
    total: store.devices.length,
    enabled: enabled.length,
    online,
    offline,
  };
}

export async function saveSnmpDevice(input: unknown) {
  const store = await readStore();
  const device = normalizeDevice(input);
  const exists = store.devices.some((item) => item.id === device.id);
  const devices = exists
    ? store.devices.map((item) => item.id === device.id ? device : item)
    : [...store.devices, device];
  const nextStore = await writeStore({ ...store, devices });
  return nextStore.devices.find((item) => item.id === device.id) || device;
}

export async function deleteSnmpDevice(id: string) {
  const store = await readStore();
  await writeStore({
    devices: store.devices.filter((device) => device.id !== id),
    metrics: store.metrics.filter((metric) => metric.deviceId !== id),
  });
  return { ok: true };
}

export async function testSnmpDevice(input: unknown) {
  const device = normalizeDevice(input);
  return collectDeviceMetric(device);
}

export async function collectSnmpDevice(id: string) {
  const store = await readStore();
  const device = store.devices.find((item) => item.id === id);
  if (!device) throw new Error("Dispositivo SNMP nao encontrado.");

  const metric = await collectDeviceMetric(device);
  const metrics = [
    ...store.metrics.filter((item) => item.deviceId !== id),
    metric,
  ];
  await writeStore({ ...store, metrics });
  return metric;
}

export async function collectAllSnmpDevices() {
  const store = await readStore();
  const enabledDevices = store.devices.filter((device) => device.enabled);
  const collected = await Promise.all(enabledDevices.map((device) => collectDeviceMetric(device)));
  const collectedIds = new Set(collected.map((metric) => metric.deviceId));
  const metrics = [
    ...store.metrics.filter((metric) => !collectedIds.has(metric.deviceId)),
    ...collected,
  ];
  await writeStore({ ...store, metrics });
  return collected;
}
