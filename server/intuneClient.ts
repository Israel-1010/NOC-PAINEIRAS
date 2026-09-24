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
  userDisplayName: string;
  userPrincipalName: string;
  emailAddress: string;
  operatingSystem: string;
  osVersion: string;
  complianceState: string;
  managementAgent: string;
  managementState: string;
  managedDeviceOwnerType: string;
  deviceEnrollmentType: string;
  deviceCategoryDisplayName: string;
  lastSyncDateTime: string;
  enrolledDateTime: string;
  azureADDeviceId: string;
  azureADRegistered: boolean;
  manufacturer: string;
  model: string;
  serialNumber: string;
  isEncrypted: boolean;
  jailBroken: string;
  wiFiMacAddress: string;
  ethernetMacAddress: string;
  totalStorageSpaceInBytes: number;
  freeStorageSpaceInBytes: number;
  partnerReportedThreatState: string;
};

let tokenCache: CacheEntry<string> | null = null;
const responseCache = new Map<string, CacheEntry<unknown>>();

const mockDevices: IntuneDevice[] = [
  {
    id: "mock-note-ti-022",
    deviceName: "NOTE-TI-022",
    userDisplayName: "Fabiano Tecnologia",
    userPrincipalName: "fabiano.tecnologia@clubepaineiras.com.br",
    emailAddress: "fabiano.tecnologia@clubepaineiras.com.br",
    operatingSystem: "Windows",
    osVersion: "11 23H2",
    complianceState: "compliant",
    managementAgent: "mdm",
    managementState: "managed",
    managedDeviceOwnerType: "company",
    deviceEnrollmentType: "windowsAzureADJoin",
    deviceCategoryDisplayName: "Notebooks",
    lastSyncDateTime: new Date().toISOString(),
    enrolledDateTime: "2026-07-02T12:30:00Z",
    azureADDeviceId: "mock-azuread-note-ti-022",
    azureADRegistered: true,
    manufacturer: "Dell Inc.",
    model: "Latitude 5440",
    serialNumber: "MOCK-5440-022",
    isEncrypted: true,
    jailBroken: "False",
    wiFiMacAddress: "00-11-22-33-44-55",
    ethernetMacAddress: "00-11-22-33-44-56",
    totalStorageSpaceInBytes: 512 * 1024 * 1024 * 1024,
    freeStorageSpaceInBytes: 318 * 1024 * 1024 * 1024,
    partnerReportedThreatState: "activated",
  },
  {
    id: "mock-note-atd-041",
    deviceName: "NOTE-ATD-041",
    userDisplayName: "Central de Atendimento",
    userPrincipalName: "central@clubepaineiras.com.br",
    emailAddress: "central@clubepaineiras.com.br",
    operatingSystem: "Windows",
    osVersion: "10 22H2",
    complianceState: "noncompliant",
    managementAgent: "mdm",
    managementState: "managed",
    managedDeviceOwnerType: "company",
    deviceEnrollmentType: "windowsCoManagement",
    deviceCategoryDisplayName: "Atendimento",
    lastSyncDateTime: "2026-09-15T09:18:00Z",
    enrolledDateTime: "2025-11-10T13:00:00Z",
    azureADDeviceId: "mock-azuread-note-atd-041",
    azureADRegistered: true,
    manufacturer: "Lenovo",
    model: "ThinkPad E14",
    serialNumber: "MOCK-E14-041",
    isEncrypted: false,
    jailBroken: "False",
    wiFiMacAddress: "00-22-33-44-55-66",
    ethernetMacAddress: "00-22-33-44-55-67",
    totalStorageSpaceInBytes: 256 * 1024 * 1024 * 1024,
    freeStorageSpaceInBytes: 42 * 1024 * 1024 * 1024,
    partnerReportedThreatState: "unknown",
  },
  {
    id: "mock-ipad-dir-003",
    deviceName: "IPAD-DIR-003",
    userDisplayName: "Diretoria",
    userPrincipalName: "diretoria@clubepaineiras.com.br",
    emailAddress: "diretoria@clubepaineiras.com.br",
    operatingSystem: "iOS",
    osVersion: "18.4",
    complianceState: "unknown",
    managementAgent: "mdm",
    managementState: "managed",
    managedDeviceOwnerType: "company",
    deviceEnrollmentType: "appleBulkWithUser",
    deviceCategoryDisplayName: "Mobile",
    lastSyncDateTime: "2026-09-10T16:25:00Z",
    enrolledDateTime: "2026-02-20T18:10:00Z",
    azureADDeviceId: "mock-azuread-ipad-dir-003",
    azureADRegistered: true,
    manufacturer: "Apple",
    model: "iPad Air",
    serialNumber: "MOCK-IPAD-003",
    isEncrypted: true,
    jailBroken: "False",
    wiFiMacAddress: "00-33-44-55-66-77",
    ethernetMacAddress: "",
    totalStorageSpaceInBytes: 128 * 1024 * 1024 * 1024,
    freeStorageSpaceInBytes: 91 * 1024 * 1024 * 1024,
    partnerReportedThreatState: "unknown",
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
    userDisplayName: String(raw.userDisplayName || ""),
    userPrincipalName: String(raw.userPrincipalName || ""),
    emailAddress: String(raw.emailAddress || ""),
    operatingSystem: String(raw.operatingSystem || ""),
    osVersion: String(raw.osVersion || ""),
    complianceState: String(raw.complianceState || ""),
    managementAgent: String(raw.managementAgent || ""),
    managementState: String(raw.managementState || ""),
    managedDeviceOwnerType: String(raw.managedDeviceOwnerType || ""),
    deviceEnrollmentType: String(raw.deviceEnrollmentType || ""),
    deviceCategoryDisplayName: String(raw.deviceCategoryDisplayName || ""),
    lastSyncDateTime: String(raw.lastSyncDateTime || ""),
    enrolledDateTime: String(raw.enrolledDateTime || ""),
    azureADDeviceId: String(raw.azureADDeviceId || ""),
    azureADRegistered: Boolean(raw.azureADRegistered),
    manufacturer: String(raw.manufacturer || ""),
    model: String(raw.model || ""),
    serialNumber: String(raw.serialNumber || ""),
    isEncrypted: Boolean(raw.isEncrypted),
    jailBroken: String(raw.jailBroken || ""),
    wiFiMacAddress: String(raw.wiFiMacAddress || ""),
    ethernetMacAddress: String(raw.ethernetMacAddress || ""),
    totalStorageSpaceInBytes: Number(raw.totalStorageSpaceInBytes || 0),
    freeStorageSpaceInBytes: Number(raw.freeStorageSpaceInBytes || 0),
    partnerReportedThreatState: String(raw.partnerReportedThreatState || ""),
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
    "userDisplayName",
    "userPrincipalName",
    "emailAddress",
    "operatingSystem",
    "osVersion",
    "complianceState",
    "managementAgent",
    "managementState",
    "managedDeviceOwnerType",
    "deviceEnrollmentType",
    "deviceCategoryDisplayName",
    "lastSyncDateTime",
    "enrolledDateTime",
    "azureADDeviceId",
    "azureADRegistered",
    "manufacturer",
    "model",
    "serialNumber",
    "isEncrypted",
    "jailBroken",
    "wiFiMacAddress",
    "ethernetMacAddress",
    "totalStorageSpaceInBytes",
    "freeStorageSpaceInBytes",
    "partnerReportedThreatState",
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
          device.userDisplayName,
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
    "userDisplayName",
    "userPrincipalName",
    "emailAddress",
    "operatingSystem",
    "osVersion",
    "complianceState",
    "managementAgent",
    "managementState",
    "managedDeviceOwnerType",
    "deviceEnrollmentType",
    "deviceCategoryDisplayName",
    "lastSyncDateTime",
    "enrolledDateTime",
    "azureADDeviceId",
    "azureADRegistered",
    "manufacturer",
    "model",
    "serialNumber",
    "isEncrypted",
    "jailBroken",
    "wiFiMacAddress",
    "ethernetMacAddress",
    "totalStorageSpaceInBytes",
    "freeStorageSpaceInBytes",
    "partnerReportedThreatState",
  ].join(",");
  const payload = await graphGet<Record<string, unknown>>(`/deviceManagement/managedDevices/${encodeURIComponent(id)}?$select=${select}`);
  return { source: "graph", device: normalizeDevice(payload) };
}
