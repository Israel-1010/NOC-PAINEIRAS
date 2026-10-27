// Microsoft Defender (XDR + Intune) para o Painel NOC, somente leitura, pelo Microsoft Graph com o
// mesmo app do Intune/SharePoint (INTUNE_* ou SHAREPOINT_*). Permissoes de aplicativo usadas:
//   SecurityIncident.Read.All, SecurityAlert.Read.All, SecurityEvents.Read.All (Secure Score),
//   DeviceManagementManagedDevices.Read.All (estado do Defender por maquina e malware detectado).
// Cache de 5 min atualizado em segundo plano: o NOC nunca espera o Graph.

import { intuneConfig, isIntuneConfigured } from "./config";

export function isDefenderConfigured() {
  return isIntuneConfigured() && process.env.DEFENDER_ENABLED !== "false";
}

let token: { value: string; expiresAt: number } | null = null;

async function getToken() {
  if (token && token.expiresAt > Date.now() + 60000) return token.value;
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(intuneConfig.tenantId!)}/oauth2/v2.0/token`, {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: intuneConfig.clientId!,
      client_secret: intuneConfig.clientSecret!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!payload.access_token) throw new Error(payload.error_description?.split("\n")[0] || `Microsoft Graph recusou o login (${response.status}).`);
  token = { value: payload.access_token, expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 3600) - 120) * 1000 };
  return token.value;
}

// Listas paginadas (@odata.nextLink), ate `pages` paginas.
async function graphAll<T>(path: string, pages = 6): Promise<T[]> {
  const items: T[] = [];
  let next = path;
  for (let page = 0; next && page < pages; page++) {
    const result = await graph<{ value: T[]; "@odata.nextLink"?: string }>(next);
    items.push(...result.value);
    next = result["@odata.nextLink"]?.replace("https://graph.microsoft.com/v1.0", "") || "";
  }
  return items;
}

async function graph<T>(path: string): Promise<T> {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    signal: AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${await getToken()}`, Accept: "application/json" },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    const message = payload.error?.message || `erro ${response.status}`;
    throw new Error(/Missing application roles|permissions/i.test(message)
      ? `Microsoft Graph: falta permissÃ£o de aplicativo (${message.match(/required roles: ([\w.]+)/)?.[1] || "seguranÃ§a"}).`
      : `Microsoft Graph: ${message.slice(0, 160)}`);
  }
  return payload;
}

type GraphAlert = {
  id: string;
  incidentId?: string;
  status: string;
  severity: string;
  serviceSource: string;
  title: string;
  category?: string;
  createdDateTime: string;
  alertWebUrl?: string;
  evidence?: { "@odata.type": string; deviceDnsName?: string; userAccount?: { accountName?: string; userPrincipalName?: string }; fileDetails?: { fileName?: string }; verdict?: string }[];
};
type GraphIncident = { id: string; status: string; severity: string; displayName: string; createdDateTime: string; lastUpdateDateTime: string; assignedTo?: string | null; incidentWebUrl?: string };

export type DefenderAlert = {
  id: string;
  time: string;
  severity: string;
  status: string;
  // email / endpoint / identity / cloud / other
  source: string;
  title: string;
  device: string;
  user: string;
  file: string;
  url: string;
};

export type DefenderOverview = {
  checkedAt: string;
  secureScore: { current: number; max: number } | null;
  incidents: { id: string; severity: string; title: string; created: string; updated: string; assigned: string }[];
  alerts: DefenderAlert[];
  devices: { total: number; secured: number; deactivated: number; unknown: number; threat: { name: string; user: string; state: string }[] };
  malware: { name: string; category: string; severity: string; lastSeen: string; devices: string[] }[];
};

const SOURCE: [RegExp, string][] = [
  [/office365|exchange/i, "email"],
  [/endpoint|antivirus/i, "endpoint"],
  [/identity|entra|azureAd/i, "identity"],
  [/cloudApp|cloud/i, "cloud"],
];

function toAlert(alert: GraphAlert): DefenderAlert {
  const evidence = alert.evidence || [];
  const device = evidence.find((e) => e.deviceDnsName)?.deviceDnsName || "";
  const account = evidence.find((e) => e.userAccount?.accountName || e.userAccount?.userPrincipalName)?.userAccount;
  return {
    id: alert.id,
    time: alert.createdDateTime,
    severity: alert.severity,
    status: alert.status,
    source: SOURCE.find(([pattern]) => pattern.test(alert.serviceSource))?.[1] || "other",
    // Alguns titulos vem com um caractere invisivel no fim.
    title: alert.title.replace(/[â€‹\s]+$/g, ""),
    device: device.split(".")[0],
    user: account?.accountName || account?.userPrincipalName || "",
    file: evidence.find((e) => e.fileDetails?.fileName)?.fileDetails?.fileName || "",
    url: alert.alertWebUrl || "",
  };
}

// Alertas dos ultimos N dias (mais novos primeiro). Tambem usado pelo envio ao WhatsApp.
export async function fetchDefenderAlerts(days = 7): Promise<DefenderAlert[]> {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const result = await graphAll<GraphAlert>(`/security/alerts_v2?$filter=createdDateTime ge ${since}&$top=100`, 4);
  return result.map(toAlert).sort((a, b) => b.time.localeCompare(a.time));
}

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2, informational: 3 };

async function load(): Promise<DefenderOverview> {
  const [incidents, alerts, score, devices, malware] = await Promise.all([
    graphAll<GraphIncident>("/security/incidents?$filter=status eq 'active'&$top=50"),
    fetchDefenderAlerts(7),
    graph<{ value: { currentScore: number; maxScore: number }[] }>("/security/secureScores?$top=1").catch(() => ({ value: [] })),
    graphAll<{ deviceName: string; userDisplayName?: string; partnerReportedThreatState?: string }>(
      "/deviceManagement/managedDevices?$top=999&$select=deviceName,userDisplayName,partnerReportedThreatState",
    ),
    graphAll<{ id: string; displayName: string; category: string; severity: string; lastDetectionDateTime: string }>("/deviceManagement/windowsMalwareInformation?$top=200"),
  ]);

  // Malware dos ultimos 90 dias, com as maquinas (uma chamada por malware; sao poucos).
  const recentMalware = malware
    .filter((item) => Date.now() - new Date(item.lastDetectionDateTime).getTime() < 90 * 864e5)
    .sort((a, b) => b.lastDetectionDateTime.localeCompare(a.lastDetectionDateTime))
    .slice(0, 10);
  const malwareDevices = await Promise.all(
    recentMalware.map((item) =>
      graph<{ value: { deviceName: string }[] }>(`/deviceManagement/windowsMalwareInformation/${item.id}/deviceMalwareStates?$top=20`)
        .then((result) => result.value.map((state) => state.deviceName).filter(Boolean))
        .catch(() => [] as string[]),
    ),
  );

  const state = (value?: string) => (value || "unknown").toLowerCase();
  return {
    checkedAt: new Date().toISOString(),
    secureScore: score.value[0] ? { current: score.value[0].currentScore, max: score.value[0].maxScore } : null,
    incidents: incidents
      .map((incident) => ({
        id: incident.id,
        severity: incident.severity,
        title: incident.displayName.replace(/[â€‹]/g, "").replace(/\s+/g, " ").trim(),
        created: incident.createdDateTime,
        updated: incident.lastUpdateDateTime,
        assigned: incident.assignedTo || "",
      }))
      .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4) || b.created.localeCompare(a.created)),
    alerts,
    devices: {
      total: devices.length,
      secured: devices.filter((device) => state(device.partnerReportedThreatState) === "secured").length,
      deactivated: devices.filter((device) => state(device.partnerReportedThreatState) === "deactivated").length,
      unknown: devices.filter((device) => ["unknown", "unavailable", "unresponsive"].includes(state(device.partnerReportedThreatState))).length,
      threat: devices
        .filter((device) => /severity|compromised|misconfigured/i.test(device.partnerReportedThreatState || ""))
        .map((device) => ({ name: device.deviceName, user: device.userDisplayName || "", state: device.partnerReportedThreatState || "" })),
    },
    malware: recentMalware.map((item, index) => ({
      name: item.displayName,
      category: item.category,
      severity: item.severity,
      lastSeen: item.lastDetectionDateTime,
      devices: malwareDevices[index],
    })),
  };
}

const FRESH_MS = 5 * 60 * 1000;
let cached: { at: number; data: DefenderOverview | null; error: string } = { at: 0, data: null, error: "" };
let refreshing: Promise<void> | null = null;

function refresh() {
  if (refreshing) return refreshing;
  refreshing = load()
    .then((data) => {
      cached = { at: Date.now(), data, error: "" };
    })
    .catch((error) => {
      cached = { ...cached, at: Date.now(), error: error instanceof Error ? error.message : String(error) };
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export function getDefenderOverview(): { data: DefenderOverview | null; error: string; loading: boolean } {
  if (!cached.at || Date.now() - cached.at > FRESH_MS) void refresh();
  return { data: cached.data, error: cached.error, loading: !cached.data && !cached.error };
}

export async function loadDefenderNow() {
  await refresh();
  return cached;
}
