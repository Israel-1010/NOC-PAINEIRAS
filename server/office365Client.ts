import { intuneConfig, isIntuneConfigured } from "./config";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type GraphToken = {
  access_token: string;
  expires_in: number;
};

export type Office365User = {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  accountEnabled: boolean;
  department: string;
  jobTitle: string;
  createdDateTime: string;
  assignedLicenses: string[];
};

export type Office365License = {
  skuId: string;
  skuPartNumber: string;
  consumedUnits: number;
  enabledUnits: number;
  suspendedUnits: number;
  warningUnits: number;
  availableUnits: number;
  servicePlans: number;
};

export type Office365Group = {
  id: string;
  displayName: string;
  description: string;
  mail: string;
  mailEnabled: boolean;
  securityEnabled: boolean;
  groupTypes: string[];
  createdDateTime: string;
  assignedLicenses: string[];
};

let tokenCache: CacheEntry<string> | null = null;
const responseCache = new Map<string, CacheEntry<unknown>>();

function isOffice365Configured() {
  return isIntuneConfigured();
}

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

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.value;
  }

  if (!isOffice365Configured()) {
    throw new Error("Office 365 sem credenciais do Microsoft Graph. Configure INTUNE_* ou SHAREPOINT_*.");
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

async function graphGet<T>(path: string, retryOnAuthFailure = true): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "Rede Clube Portal/1.0",
      "ocp-client-name": "Rede Clube Portal",
      "ocp-client-version": "1.0",
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };

  if (!response.ok) {
    const message = payload.error?.message || `Microsoft Graph retornou erro ${response.status}.`;
    if (retryOnAuthFailure && response.status === 403 && /authorize|required permissions|privileges|permission/i.test(message)) {
      tokenCache = null;
      return graphGet<T>(path, false);
    }

    throw new Error(message);
  }

  return payload;
}

async function graphList<T>(path: string, limit = 500) {
  const items: T[] = [];
  let nextPath = path;

  while (nextPath && items.length < limit) {
    const payload = await graphGet<{ value?: T[]; "@odata.nextLink"?: string }>(nextPath);
    items.push(...(payload.value || []));
    const nextLink = payload["@odata.nextLink"];
    nextPath = nextLink ? nextLink.replace("https://graph.microsoft.com/v1.0", "") : "";
  }

  return items.slice(0, limit);
}

function normalizeLicense(raw: Record<string, unknown>): Office365License {
  const prepaidUnits = raw.prepaidUnits && typeof raw.prepaidUnits === "object" ? raw.prepaidUnits as Record<string, unknown> : {};
  const enabledUnits = Number(prepaidUnits.enabled || 0);
  const consumedUnits = Number(raw.consumedUnits || 0);

  return {
    skuId: String(raw.skuId || ""),
    skuPartNumber: String(raw.skuPartNumber || ""),
    consumedUnits,
    enabledUnits,
    suspendedUnits: Number(prepaidUnits.suspended || 0),
    warningUnits: Number(prepaidUnits.warning || 0),
    availableUnits: Math.max(0, enabledUnits - consumedUnits),
    servicePlans: Array.isArray(raw.servicePlans) ? raw.servicePlans.length : 0,
  };
}

function normalizeAssignedLicenses(raw: unknown, licenseNames: Map<string, string>) {
  return Array.isArray(raw)
    ? raw.map((item) => {
        const skuId = String((item as Record<string, unknown>)?.skuId || "");
        return licenseNames.get(skuId.toLowerCase()) || skuId;
      }).filter(Boolean)
    : [];
}

function normalizeUser(raw: Record<string, unknown>, licenseNames: Map<string, string>): Office365User {
  return {
    id: String(raw.id || ""),
    displayName: String(raw.displayName || ""),
    userPrincipalName: String(raw.userPrincipalName || ""),
    mail: String(raw.mail || ""),
    accountEnabled: Boolean(raw.accountEnabled),
    department: String(raw.department || ""),
    jobTitle: String(raw.jobTitle || ""),
    createdDateTime: String(raw.createdDateTime || ""),
    assignedLicenses: normalizeAssignedLicenses(raw.assignedLicenses, licenseNames),
  };
}

function normalizeGroup(raw: Record<string, unknown>, licenseNames: Map<string, string>): Office365Group {
  return {
    id: String(raw.id || ""),
    displayName: String(raw.displayName || ""),
    description: String(raw.description || ""),
    mail: String(raw.mail || ""),
    mailEnabled: Boolean(raw.mailEnabled),
    securityEnabled: Boolean(raw.securityEnabled),
    groupTypes: Array.isArray(raw.groupTypes) ? raw.groupTypes.map(String) : [],
    createdDateTime: String(raw.createdDateTime || ""),
    assignedLicenses: normalizeAssignedLicenses(raw.assignedLicenses, licenseNames),
  };
}

async function loadOffice365Data() {
  if (!isOffice365Configured()) {
    throw new Error("Office 365 sem credenciais do Microsoft Graph. Configure INTUNE_* ou SHAREPOINT_*.");
  }

  const rawLicenses = await graphList<Record<string, unknown>>(
    "/subscribedSkus?$select=skuId,skuPartNumber,consumedUnits,prepaidUnits,servicePlans",
    200,
  );
  const licenses = rawLicenses.map(normalizeLicense);
  const licenseNames = new Map(licenses.map((license) => [license.skuId.toLowerCase(), license.skuPartNumber]));

  const [rawUsers, rawGroups] = await Promise.all([
    graphList<Record<string, unknown>>(
      "/users?$top=999&$select=id,displayName,userPrincipalName,mail,accountEnabled,department,jobTitle,createdDateTime,assignedLicenses",
      5000,
    ),
    graphList<Record<string, unknown>>(
      "/groups?$top=999&$select=id,displayName,description,mail,mailEnabled,securityEnabled,groupTypes,createdDateTime,assignedLicenses",
      5000,
    ),
  ]);

  const users = rawUsers.map((item) => normalizeUser(item, licenseNames));
  const groups = rawGroups.map((item) => normalizeGroup(item, licenseNames));

  return { licenses, users, groups };
}

export async function getOffice365Status() {
  if (!isOffice365Configured()) {
    return {
      ok: false,
      source: "graph",
      configured: false,
      message: "Office 365 sem credenciais do Microsoft Graph. Configure INTUNE_* ou SHAREPOINT_*.",
    };
  }

  await getAccessToken();
  return {
    ok: true,
    source: "graph",
    configured: true,
    message: "Conectado ao Microsoft Graph Office 365.",
  };
}

export async function getOffice365Summary() {
  const data = await cached("office365-data", 60000, loadOffice365Data);
  const enabledUsers = data.users.filter((user) => user.accountEnabled).length;
  const licensedUsers = data.users.filter((user) => user.assignedLicenses.length).length;
  const licensedGroups = data.groups.filter((group) => group.assignedLicenses.length).length;
  const enabledLicenseUnits = data.licenses.reduce((total, license) => total + license.enabledUnits, 0);
  const consumedLicenseUnits = data.licenses.reduce((total, license) => total + license.consumedUnits, 0);

  return {
    source: "graph",
    users: data.users.length,
    enabledUsers,
    licensedUsers,
    groups: data.groups.length,
    licensedGroups,
    licenses: data.licenses.length,
    enabledLicenseUnits,
    consumedLicenseUnits,
    availableLicenseUnits: Math.max(0, enabledLicenseUnits - consumedLicenseUnits),
  };
}

export async function getOffice365Details() {
  const data = await cached("office365-data", 60000, loadOffice365Data);
  return { source: "graph", ...data };
}
