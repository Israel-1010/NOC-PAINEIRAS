import { intuneConfig, isIntuneConfigured } from "./config";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type GraphToken = {
  access_token: string;
  expires_in: number;
};

export type IntuneDevice = {
  id: string;
  deviceName: string;
  userPrincipalName: string;
  emailAddress: string;
  operatingSystem: string;
  osVersion: string;
  complianceState: string;
  managementAgent: string;
  managedDeviceOwnerType: string;
  lastSyncDateTime: string;
  enrolledDateTime: string;
  azureADDeviceId: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
};

let tokenCache: CacheEntry<string> | null = null;
const responseCache = new Map<string, CacheEntry<unknown>>();

const mockDevices: IntuneDevice[] = [
  {
    id: "mock-note-ti-022",
    deviceName: "NOTE-TI-022",
    userPrincipalName: "fabiano.tecnologia@clubepaineiras.com.br",
    emailAddress: "fabiano.tecnologia@clubepaineiras.com.br",
    operatingSystem: "Windows",
    osVersion: "11 23H2",
    complianceState: "compliant",
    managementAgent: "mdm",
    managedDeviceOwnerType: "company",
    lastSyncDateTime: new Date().toISOString(),
    enrolledDateTime: "2026-07-02T12:30:00Z",
    azureADDeviceId: "mock-azuread-note-ti-022",
    manufacturer: "Dell Inc.",
    model: "Latitude 5440",
    serialNumber: "MOCK-5440-022",
  },
  {
    id: "mock-note-atd-041",
    deviceName: "NOTE-ATD-041",
    userPrincipalName: "central@clubepaineiras.com.br",
    emailAddress: "central@clubepaineiras.com.br",
    operatingSystem: "Windows",
    osVersion: "10 22H2",
    complianceState: "noncompliant",
    managementAgent: "mdm",
    managedDeviceOwnerType: "company",
    lastSyncDateTime: "2026-09-15T09:18:00Z",
    enrolledDateTime: "2025-11-10T13:00:00Z",
    azureADDeviceId: "mock-azuread-note-atd-041",
    manufacturer: "Lenovo",
    model: "ThinkPad E14",
    serialNumber: "MOCK-E14-041",
  },
  {
    id: "mock-ipad-dir-003",
    deviceName: "IPAD-DIR-003",
    userPrincipalName: "diretoria@clubepaineiras.com.br",
    emailAddress: "diretoria@clubepaineiras.com.br",
    operatingSystem: "iOS",
    osVersion: "18.4",
    complianceState: "unknown",
    managementAgent: "mdm",
    managedDeviceOwnerType: "company",
    lastSyncDateTime: "2026-09-10T16:25:00Z",
    enrolledDateTime: "2026-02-20T18:10:00Z",
    azureADDeviceId: "mock-azuread-ipad-dir-003",
    manufacturer: "Apple",
    model: "iPad Air",
    serialNumber: "MOCK-IPAD-003",
  },
];

function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>) {
  const cachedValue = responseCache.get(key) as CacheEntry<T> | undefined;
  if (cachedValue && cachedValue.expiresAt > Date.now()) {
    return Promise.resolve(cachedValue.value);
  }

  return loader().then((value) => {
    responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  });
}

function isMockMode() {
  return intuneConfig.useMock || !isIntuneConfigured();
}

function normalizeDevice(raw: Record<string, unknown>): IntuneDevice {
  return {
    id: String(raw.id || ""),
    deviceName: String(raw.deviceName || ""),
    userPrincipalName: String(raw.userPrincipalName || ""),
    emailAddress: String(raw.emailAddress || ""),
    operatingSystem: String(raw.operatingSystem || ""),
    osVersion: String(raw.osVersion || ""),
    complianceState: String(raw.complianceState || ""),
    managementAgent: String(raw.managementAgent || ""),
    managedDeviceOwnerType: String(raw.managedDeviceOwnerType || ""),
    lastSyncDateTime: String(raw.lastSyncDateTime || ""),
    enrolledDateTime: String(raw.enrolledDateTime || ""),
    azureADDeviceId: String(raw.azureADDeviceId || ""),
    manufacturer: String(raw.manufacturer || ""),
    model: String(raw.model || ""),
    serialNumber: String(raw.serialNumber || ""),
  };
}

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.value;
  }

  if (!isIntuneConfigured()) {
    throw new Error("Intune nao configurado. Preencha INTUNE_TENANT_ID, INTUNE_CLIENT_ID e INTUNE_CLIENT_SECRET.");
  }

  const body = new URLSearchParams({
    client_id: intuneConfig.clientId!,
    client_secret: intuneConfig.clientSecret!,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(intuneConfig.tenantId!)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<GraphToken> & { error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || `Falha ao autenticar no Microsoft Graph (${response.status}).`);
  }

  tokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 3600) - 120) * 1000,
  };

  return tokenCache.value;
}

async function graphGet<T>(path: string) {
  const token = await getAccessToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message || `Microsoft Graph retornou erro ${response.status}.`);
  }

  return payload;
}

async function listGraphDevices() {
  const select = [
    "id",
    "deviceName",
    "userPrincipalName",
    "emailAddress",
    "operatingSystem",
    "osVersion",
    "complianceState",
    "managementAgent",
    "managedDeviceOwnerType",
    "lastSyncDateTime",
    "enrolledDateTime",
    "azureADDeviceId",
    "manufacturer",
    "model",
    "serialNumber",
  ].join(",");
  const payload = await graphGet<{ value?: Array<Record<string, unknown>> }>(`/deviceManagement/managedDevices?$top=500&$select=${select}`);
  return (payload.value || []).map(normalizeDevice);
}

function buildSummary(devices: IntuneDevice[], source: string) {
  const staleLimit = Date.now() - 1000 * 60 * 60 * 24 * 7;
  const compliant = devices.filter((device) => device.complianceState.toLowerCase() === "compliant").length;
  const nonCompliant = devices.filter((device) => device.complianceState.toLowerCase() === "noncompliant").length;
  const unknown = devices.filter((device) => !["compliant", "noncompliant"].includes(device.complianceState.toLowerCase())).length;
  const staleSync = devices.filter((device) => {
    const date = new Date(device.lastSyncDateTime);
    return Number.isNaN(date.getTime()) || date.getTime() < staleLimit;
  }).length;

  return {
    source,
    total: devices.length,
    compliant,
    nonCompliant,
    unknown,
    staleSync,
  };
}

export async function getIntuneStatus() {
  if (isMockMode()) {
    return {
      ok: true,
      source: "mock",
      configured: isIntuneConfigured(),
      message: "Intune em modo mock. Configure Microsoft Graph para dados reais.",
    };
  }

  await getAccessToken();
  return {
    ok: true,
    source: "graph",
    configured: true,
    message: "Conectado ao Microsoft Graph Intune.",
  };
}

export async function getIntuneSummary() {
  if (isMockMode()) {
    return buildSummary(mockDevices, "mock");
  }

  return cached("intune-summary", 60000, async () => buildSummary(await listGraphDevices(), "graph"));
}

export async function listIntuneDevices(query = "", limit?: string | number) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const search = query.trim().toLowerCase();
  const devices = isMockMode()
    ? mockDevices
    : await cached("intune-devices", 60000, listGraphDevices);
  const filtered = search
    ? devices.filter((device) =>
        [
          device.deviceName,
          device.userPrincipalName,
          device.emailAddress,
          device.operatingSystem,
          device.complianceState,
          device.manufacturer,
          device.model,
          device.serialNumber,
        ].join(" ").toLowerCase().includes(search),
      )
    : devices;

  return { source: isMockMode() ? "mock" : "graph", items: filtered.slice(0, safeLimit) };
}

export async function getIntuneDeviceDetails(id: string) {
  if (isMockMode()) {
    const device = mockDevices.find((item) => item.id === id || item.deviceName.toLowerCase() === id.toLowerCase());
    if (!device) {
      throw new Error("Dispositivo Intune nao encontrado.");
    }
    return { source: "mock", device };
  }

  const select = [
    "id",
    "deviceName",
    "userPrincipalName",
    "emailAddress",
    "operatingSystem",
    "osVersion",
    "complianceState",
    "managementAgent",
    "managedDeviceOwnerType",
    "lastSyncDateTime",
    "enrolledDateTime",
    "azureADDeviceId",
    "manufacturer",
    "model",
    "serialNumber",
  ].join(",");
  const payload = await graphGet<Record<string, unknown>>(`/deviceManagement/managedDevices/${encodeURIComponent(id)}?$select=${select}`);
  return { source: "graph", device: normalizeDevice(payload) };
}
