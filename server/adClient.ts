import { Attribute, Change, Client, Entry } from "ldapts";
import fs from "node:fs";
import { adConfig, AdConfig, isAdConfigured } from "./config";
import { mockAdSummary, mockComputers, mockGroups, mockLockouts, mockUsers } from "./mockAd";

const userAttributes = [
  "cn",
  "sAMAccountName",
  "displayName",
  "mail",
  "department",
  "title",
  "company",
  "telephoneNumber",
  "mobile",
  "physicalDeliveryOfficeName",
  "manager",
  "description",
  "employeeID",
  "employeeNumber",
  "userAccountControl",
  "msDS-User-Account-Control-Computed",
  "lockoutTime",
  "distinguishedName",
];

const userDetailAttributes = [
  ...userAttributes,
  "displayName",
  "givenName",
  "sn",
  "title",
  "company",
  "telephoneNumber",
  "mobile",
  "physicalDeliveryOfficeName",
  "manager",
  "memberOf",
  "whenCreated",
  "whenChanged",
  "lastLogonTimestamp",
  "pwdLastSet",
  "accountExpires",
  "description",
  "employeeID",
  "employeeNumber",
];

const computerAttributes = ["cn", "dNSHostName", "operatingSystem", "lastLogonTimestamp", "distinguishedName"];
const computerDetailAttributes = [
  ...computerAttributes,
  "operatingSystemVersion",
  "operatingSystemServicePack",
  "description",
  "location",
  "managedBy",
  "memberOf",
  "servicePrincipalName",
  "userAccountControl",
  "whenCreated",
  "whenChanged",
  "pwdLastSet",
];
const groupAttributes = ["cn", "description", "member", "distinguishedName"];
const organizationalUnitAttributes = ["ou", "description", "distinguishedName"];
const defaultUpnSuffix = "clubepaineiras.com.br";

const editableUserAttributes: Record<string, string> = {
  displayName: "displayName",
  mail: "mail",
  department: "department",
  title: "title",
  company: "company",
  telephoneNumber: "telephoneNumber",
  mobile: "mobile",
  office: "physicalDeliveryOfficeName",
  description: "description",
  employeeID: "employeeID",
  employeeNumber: "employeeNumber",
};

const createUserAttributes: Record<string, string> = {
  displayName: "displayName",
  givenName: "givenName",
  sn: "sn",
  mail: "mail",
  webPage: "wWWHomePage",
  department: "department",
  title: "title",
  company: "company",
  telephoneNumber: "telephoneNumber",
  mobile: "mobile",
  office: "physicalDeliveryOfficeName",
  description: "description",
  employeeID: "employeeID",
  employeeNumber: "employeeNumber",
  profilePath: "profilePath",
  scriptPath: "scriptPath",
  homeDirectory: "homeDirectory",
  homeDrive: "homeDrive",
};

type CacheEntry = {
  expiresAt: number;
  value?: unknown;
  promise?: Promise<unknown>;
};

const adCache = new Map<string, CacheEntry>();

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>) {
  const now = Date.now();
  const existing = adCache.get(key);

  if (existing?.value !== undefined && existing.expiresAt > now) {
    return existing.value as T;
  }

  if (existing?.promise) {
    return existing.promise as Promise<T>;
  }

  const promise = loader()
    .then((value) => {
      adCache.set(key, { expiresAt: Date.now() + ttlMs, value });
      return value;
    })
    .catch((error) => {
      adCache.delete(key);
      throw error;
    });

  adCache.set(key, { expiresAt: now + ttlMs, value: existing?.value, promise });
  return promise;
}

function clearAdCache() {
  adCache.clear();
}

function ldapFilterEscape(value: string) {
  return value.replace(/[\\*()\u0000]/g, (char) => {
    const code = char.charCodeAt(0).toString(16).padStart(2, "0");
    return `\\${code}`;
  });
}

function ldapDnEscape(value: string) {
  return value
    .replace(/\\/g, "\\5c")
    .replace(/,/g, "\\,")
    .replace(/\+/g, "\\+")
    .replace(/"/g, '\\"')
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .replace(/;/g, "\\;")
    .replace(/^#/, "\\#")
    .replace(/^ /, "\\ ")
    .replace(/ $/, "\\ ");
}

function domainFromBaseDn() {
  return adConfig.baseDn
    ?.split(",")
    .map((part) => part.trim())
    .filter((part) => part.toUpperCase().startsWith("DC="))
    .map((part) => part.replace(/^DC=/i, ""))
    .join(".");
}

function defaultUserPrincipalName(samAccountName: string, requestedUpn = "") {
  const requested = requestedUpn.trim();
  const localPart = (requested.includes("@") ? requested.split("@")[0] : requested) || samAccountName;
  return `${localPart}@${defaultUpnSuffix}`;
}

function baseDnFromDomain(domain: string) {
  return domain
    .split(".")
    .map((part) => `DC=${part}`)
    .join(",");
}

function getConfiguredDomains() {
  const primaryDomain = domainFromBaseDn();
  const domains = [
    ...(primaryDomain && adConfig.baseDn ? [{ name: primaryDomain, baseDn: adConfig.baseDn }] : []),
    ...adConfig.extraDomains.map((domain) => ({ name: domain, baseDn: baseDnFromDomain(domain) })),
  ];
  const seen = new Set<string>();

  return domains.filter((domain) => {
    const key = domain.baseDn.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function netbiosDomainFromConfig() {
  const configured = adConfig.netbiosDomain?.trim();
  if (configured) return configured;

  const bindDn = adConfig.bindDn || "";
  if (bindDn.includes("\\")) {
    return bindDn.split("\\")[0];
  }

  return "";
}

function getSearchLimit(limit?: string | number) {
  const parsed = Number(limit || 25);
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(1, Math.min(parsed, 1000));
}

function asArray(value: unknown) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getAttr(entry: Entry, name: string) {
  const exact = entry[name];
  if (exact !== undefined) return exact;

  const key = Object.keys(entry).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? entry[key] : undefined;
}

function firstAttr(entry: Entry, name: string) {
  const value = getAttr(entry, name);
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function stringArrayAttr(entry: Entry, name: string) {
  return asArray(getAttr(entry, name))
    .map((item) => String(item || ""))
    .filter(Boolean);
}

function dnCommonName(dn: string) {
  const cn = dn
    .split(",")
    .find((part) => part.trim().toUpperCase().startsWith("CN="))
    ?.trim()
    .replace(/^CN=/i, "");

  return cn || dn;
}

function parentDnFromDn(dn: string) {
  return dn.split(",").slice(1).join(",");
}

function rdnFromDn(dn: string) {
  return dn.split(",")[0] || "";
}

function isDisabled(entry: Entry) {
  const value = Number(firstAttr(entry, "userAccountControl") || 0);
  return Boolean(value & 2);
}

function isLocked(entry: Entry) {
  const computedRaw = getAttr(entry, "msDS-User-Account-Control-Computed");
  const computedValue = Array.isArray(computedRaw) ? computedRaw[0] : computedRaw;
  if (computedValue !== undefined && computedValue !== "") {
    return Boolean(Number(computedValue) & 16);
  }

  return Number(firstAttr(entry, "lockoutTime") || 0) > 0;
}

function createClient(config: AdConfig = adConfig) {
  if (!isAdConfigured(config)) {
    throw new Error("AD nao configurado. Preencha AD_URL, AD_BASE_DN, AD_BIND_DN e AD_BIND_PASSWORD.");
  }

  const tlsOptions = config.url?.toLowerCase().startsWith("ldaps://")
    ? {
        rejectUnauthorized: config.tlsRejectUnauthorized,
        ...(config.tlsCaFile ? { ca: [fs.readFileSync(config.tlsCaFile)] } : {}),
      }
    : undefined;

  return new Client({
    url: config.url!,
    timeout: 8000,
    connectTimeout: 8000,
    ...(tlsOptions ? { tlsOptions } : {}),
  });
}

function getLoginBindCandidates(login: string, domain?: string) {
  const trimmed = login.trim();
  if (trimmed.includes("@") || trimmed.includes("\\")) {
    return [trimmed];
  }

  const domains = getConfiguredDomains().map((item) => item.name);
  const preferred = domain ? [domain] : [];
  const upnCandidates = Array.from(new Set([...preferred, ...domains])).map((item) => `${trimmed}@${item}`);
  const netbiosDomain = netbiosDomainFromConfig();
  const legacyCandidate = netbiosDomain ? [`${netbiosDomain}\\${trimmed}`] : [];

  return Array.from(new Set([...legacyCandidate, ...upnCandidates]));
}

async function withClient<T>(callback: (client: Client) => Promise<T>) {
  if (adConfig.useMock || !isAdConfigured()) {
    throw new Error("AD em modo mock ou incompleto.");
  }

  const client = createClient();

  try {
    await client.bind(adConfig.bindDn!, adConfig.bindPassword!);
    return await callback(client);
  } finally {
    await client.unbind().catch(() => undefined);
  }
}

async function search(client: Client, baseDn: string, filter: string, attributes: string[], sizeLimit = 25) {
  const options = {
    scope: "sub" as const,
    filter,
    attributes,
    paged: {
      pageSize: 500,
    },
    ...(sizeLimit > 0 ? { sizeLimit } : {}),
  };

  const result = await client.search(baseDn, {
    ...options,
  });

  return result.searchEntries;
}

async function count(client: Client, baseDn: string, filter: string) {
  const entries = await search(client, baseDn, filter, ["distinguishedName"], 0);
  return entries.length;
}

function createReplaceOrDeleteChange(attribute: string, value: string) {
  const trimmed = value.trim();
  return new Change({
    operation: trimmed ? "replace" : "delete",
    modification: new Attribute({
      type: attribute,
      values: trimmed ? [trimmed] : [],
    }),
  });
}

function createMembershipChange(operation: "add" | "delete", userDn: string) {
  return new Change({
    operation,
    modification: new Attribute({
      type: "member",
      values: [userDn],
    }),
  });
}

function createPasswordChange(password: string) {
  return new Change({
    operation: "replace",
    modification: new Attribute({
      type: "unicodePwd",
      values: [Buffer.from(`"${password}"`, "utf16le")],
    }),
  });
}

function validateStrongPassword(password: string) {
  if (password.length < 12) {
    throw new Error("A senha precisa ter pelo menos 12 caracteres.");
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error("A senha precisa ter maiuscula, minuscula, numero e simbolo.");
  }
}

async function findUserEntry(client: Client, samAccountName: string, attributes = userDetailAttributes) {
  const safeSam = ldapFilterEscape(samAccountName.trim());
  const filter = `(&(objectCategory=person)(objectClass=user)(sAMAccountName=${safeSam}))`;
  const entries = await search(client, adConfig.usersBaseDn || adConfig.baseDn!, filter, attributes, 1);
  const entry = entries[0];

  if (!entry) {
    throw new Error(`Usuario ${samAccountName} nao encontrado no AD.`);
  }

  return entry;
}

async function findUserIdentityEntry(client: Client, identity: string, attributes = userDetailAttributes) {
  const trimmed = identity.trim();

  if (/^[a-z]+=.+,/i.test(trimmed)) {
    return findUserByDn(client, trimmed, attributes);
  }

  const lookupIdentity = trimmed.includes("@") ? trimmed : trimmed.includes("\\") ? trimmed.split("\\").pop() || trimmed : trimmed;
  const safeIdentity = ldapFilterEscape(lookupIdentity);
  const filter = `(&(objectCategory=person)(objectClass=user)(|(sAMAccountName=${safeIdentity})(userPrincipalName=${safeIdentity})(mail=${safeIdentity})(employeeID=${safeIdentity})(employeeNumber=${safeIdentity})))`;
  const entries = await search(client, adConfig.usersBaseDn || adConfig.baseDn!, filter, attributes, 2);

  if (!entries.length) {
    throw new Error(`Usuario ${identity} nao encontrado no AD por login, registro ou matricula.`);
  }

  if (entries.length > 1) {
    throw new Error(`Mais de um usuario encontrado para ${identity}. Use o login ou o Distinguished Name.`);
  }

  return entries[0];
}

async function bindAsUser(bindIdentity: string, password: string) {
  const client = createClient();
  try {
    await client.bind(bindIdentity, password);
  } finally {
    await client.unbind().catch(() => undefined);
  }
}

async function ensureUserDoesNotExist(client: Client, samAccountName: string) {
  const safeSam = ldapFilterEscape(samAccountName.trim());
  const entries = await search(
    client,
    adConfig.usersBaseDn || adConfig.baseDn!,
    `(&(objectCategory=person)(objectClass=user)(sAMAccountName=${safeSam}))`,
    ["distinguishedName"],
    1,
  );

  if (entries.length) {
    throw new Error(`Ja existe usuario com login ${samAccountName}.`);
  }
}

async function findGroupDn(client: Client, groupIdentity: string) {
  const identity = groupIdentity.trim();
  if (!identity) {
    throw new Error("Informe o grupo.");
  }

  if (/^[a-z]+=.+,/i.test(identity)) {
    return identity;
  }

  const safeIdentity = ldapFilterEscape(identity);
  const filter = `(&(objectCategory=group)(|(cn=${safeIdentity})(sAMAccountName=${safeIdentity})))`;
  const entries = await search(client, adConfig.groupsBaseDn || adConfig.baseDn!, filter, ["distinguishedName"], 2);

  if (!entries.length) {
    throw new Error(`Grupo ${groupIdentity} nao encontrado no AD.`);
  }

  if (entries.length > 1) {
    throw new Error(`Mais de um grupo encontrado para ${groupIdentity}. Use o Distinguished Name.`);
  }

  return String(firstAttr(entries[0], "distinguishedName"));
}

async function resolveManagerDn(client: Client, managerIdentity: string) {
  const identity = managerIdentity.trim();
  if (!identity) return "";

  const manager = await findUserIdentityEntry(client, identity, ["distinguishedName"]);
  return String(firstAttr(manager, "distinguishedName"));
}

async function findUserByDn(client: Client, dn: string, attributes = userDetailAttributes) {
  const entries = await search(client, dn, "(objectClass=*)", attributes, 1);
  const entry = entries[0];

  if (!entry) {
    throw new Error(`Usuario ${dn} nao encontrado no AD.`);
  }

  return entry;
}

async function findComputerEntry(client: Client, identity: string, attributes = computerDetailAttributes) {
  const trimmed = identity.trim();

  if (/^[a-z]+=.+,/i.test(trimmed)) {
    const entries = await search(client, trimmed, "(objectCategory=computer)", attributes, 1);
    const entry = entries[0];

    if (!entry) {
      throw new Error(`Maquina ${identity} nao encontrada no AD.`);
    }

    return entry;
  }

  const safeIdentity = ldapFilterEscape(trimmed.replace(/\$$/, ""));
  const filter = `(&(objectCategory=computer)(|(cn=${safeIdentity})(cn=${safeIdentity}$)(dNSHostName=${safeIdentity})(sAMAccountName=${safeIdentity}$)))`;
  const entries = await search(client, adConfig.computersBaseDn || adConfig.baseDn!, filter, attributes, 2);

  if (!entries.length) {
    throw new Error(`Maquina ${identity} nao encontrada no AD.`);
  }

  if (entries.length > 1) {
    throw new Error(`Mais de uma maquina encontrada para ${identity}. Use o Distinguished Name.`);
  }

  return entries[0];
}

async function ensureOrganizationalUnitExists(client: Client, ouDn: string) {
  const trimmed = ouDn.trim();
  if (!trimmed) {
    throw new Error("Informe a OU de destino.");
  }

  const entries = await search(client, trimmed, "(objectClass=organizationalUnit)", ["distinguishedName"], 1);
  const entry = entries[0];

  if (!entry) {
    throw new Error(`OU ${ouDn} nao encontrada no AD.`);
  }

  return String(firstAttr(entry, "distinguishedName"));
}

export async function getAdStatus() {
  if (adConfig.useMock || !isAdConfigured()) {
    return {
      ok: true,
      source: "mock",
      configured: isAdConfigured(),
      message: "API em modo mock. Preencha .env e defina AD_USE_MOCK=false para consultar o AD.",
    };
  }

  await withClient(async () => undefined);
  return { ok: true, source: "ldap", configured: true, message: "Conectado ao Active Directory." };
}

export async function authenticateAdUser(login: string, password: string, domain?: string) {
  if (!login.trim() || !password) {
    throw new Error("Informe registro e senha do AD.");
  }

  if (adConfig.useMock || !isAdConfigured()) {
    return {
      login,
      name: login,
      domain: domain || "mock",
      department: "",
    };
  }

  const candidates = getLoginBindCandidates(login, domain);
  let authenticatedBind = "";
  let resolvedEntry: Entry | null = null;
  let fallbackLookupReached = false;
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      await bindAsUser(candidate, password);
      authenticatedBind = candidate;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!authenticatedBind) {
    try {
      resolvedEntry = await withClient((client) => {
        fallbackLookupReached = true;
        return findUserIdentityEntry(client, login, [
          "cn",
          "displayName",
          "sAMAccountName",
          "department",
          "distinguishedName",
        ]);
      });

      const userDn = String(firstAttr(resolvedEntry, "distinguishedName") || "");
      if (!userDn) {
        throw new Error(`Usuario ${login} encontrado sem Distinguished Name.`);
      }

      const resolvedSam = String(firstAttr(resolvedEntry, "sAMAccountName") || "");
      const resolvedCandidates = resolvedSam ? [...getLoginBindCandidates(resolvedSam, domain), userDn] : [userDn];
      let resolvedLastError: unknown;

      for (const candidate of Array.from(new Set(resolvedCandidates))) {
        try {
          await bindAsUser(candidate, password);
          authenticatedBind = candidate;
          break;
        } catch (error) {
          resolvedLastError = error;
        }
      }

      if (!authenticatedBind && resolvedLastError) {
        throw resolvedLastError;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!authenticatedBind) {
    const message = lastError instanceof Error ? lastError.message : "";
    if (!fallbackLookupReached && lastError instanceof Error) {
      throw lastError;
    }

    if (message.includes("nao encontrado no AD")) {
      throw lastError instanceof Error ? lastError : new Error("Usuario nao encontrado no AD.");
    }

    throw new Error("Registro ou senha invalidos. Se digitou o registro, confirme se ele esta preenchido em employeeID ou employeeNumber no AD.");
  }

  const lookupLogin = login.includes("@") ? login.split("@")[0] : login.includes("\\") ? login.split("\\").pop() || login : login;
  const authenticatedDomain = authenticatedBind.includes("@") ? authenticatedBind.split("@").pop() || "" : domain || "";

  if (resolvedEntry) {
    return {
      login: String(firstAttr(resolvedEntry, "sAMAccountName") || lookupLogin),
      name: String(firstAttr(resolvedEntry, "displayName") || firstAttr(resolvedEntry, "cn") || lookupLogin),
      domain: authenticatedDomain || domainFromBaseDn() || "",
      department: String(firstAttr(resolvedEntry, "department") || ""),
    };
  }

  let details: Awaited<ReturnType<typeof resolveAdUserIdentity>> | null = null;
  try {
    details = await resolveAdUserIdentity(lookupLogin);
  } catch {
    details = null;
  }

  if (!details) {
    return {
      login: lookupLogin,
      name: lookupLogin,
      domain: authenticatedDomain,
      department: "",
    };
  }

  return {
    login: String(details.profile.samAccountName || lookupLogin),
    name: String(details.profile.displayName || details.profile.cn || lookupLogin),
    domain: authenticatedDomain,
    department: String(details.profile.department || ""),
  };
}

export async function getAdSummary() {
  if (adConfig.useMock || !isAdConfigured()) {
    return mockAdSummary;
  }

  return cached("summary", 30000, () => withClient(async (client) => {
    const userBase = adConfig.usersBaseDn || adConfig.baseDn!;
    const computerBase = adConfig.computersBaseDn || adConfig.baseDn!;
    const groupBase = adConfig.groupsBaseDn || adConfig.baseDn!;

    const usersTotal = await count(client, userBase, "(&(objectCategory=person)(objectClass=user))");
    const usersDisabled = await count(client, userBase, "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=2))");
    const lockoutCandidates = await search(
      client,
      userBase,
      "(&(objectCategory=person)(objectClass=user)(lockoutTime>=1))",
      userAttributes,
      0,
    );
    const usersLocked = lockoutCandidates.filter(isLocked).length;
    const computersTotal = await count(client, computerBase, "(objectCategory=computer)");
    const groupsTotal = await count(client, groupBase, "(objectCategory=group)");

    return {
      source: "ldap",
      users: {
        total: usersTotal,
        enabled: usersTotal - usersDisabled,
        disabled: usersDisabled,
        locked: usersLocked,
      },
      computers: {
        total: computersTotal,
        domainJoined: computersTotal,
        inactive30d: 0,
      },
      groups: {
        total: groupsTotal,
        sensitive: 0,
      },
    };
  }));
}

export async function listAdUsers(query = "", limit?: string | number) {
  if (adConfig.useMock || !isAdConfigured()) {
    return { source: "mock", items: mockUsers };
  }

  const safeQuery = ldapFilterEscape(query.trim());
  const searchPart = safeQuery
    ? `(|(cn=*${safeQuery}*)(sAMAccountName=*${safeQuery}*)(mail=*${safeQuery}*))`
    : "";
  const filter = `(&(objectCategory=person)(objectClass=user)${searchPart})`;

  return cached(`users:${query}:${getSearchLimit(limit)}`, 45000, () => withClient(async (client) => {
    const entries = await search(client, adConfig.usersBaseDn || adConfig.baseDn!, filter, userAttributes, getSearchLimit(limit));
    const items = entries.map((entry) => ({
      cn: firstAttr(entry, "cn"),
      samAccountName: firstAttr(entry, "sAMAccountName"),
      displayName: firstAttr(entry, "displayName"),
      mail: firstAttr(entry, "mail"),
      department: firstAttr(entry, "department"),
      title: firstAttr(entry, "title"),
      company: firstAttr(entry, "company"),
      telephoneNumber: firstAttr(entry, "telephoneNumber"),
      mobile: firstAttr(entry, "mobile"),
      office: firstAttr(entry, "physicalDeliveryOfficeName"),
      managerDn: firstAttr(entry, "manager"),
      description: firstAttr(entry, "description"),
      employeeID: firstAttr(entry, "employeeID"),
      employeeNumber: firstAttr(entry, "employeeNumber"),
      enabled: !isDisabled(entry),
      locked: isLocked(entry),
      distinguishedName: firstAttr(entry, "distinguishedName"),
    }));

    return { source: "ldap", items };
  }));
}

export async function getAdUserDetails(samAccountName: string) {
  if (adConfig.useMock || !isAdConfigured()) {
    const user = mockUsers.find((item) => item.samAccountName.toLowerCase() === samAccountName.toLowerCase());

    return {
      source: "mock",
      profile: {
        cn: user?.cn || samAccountName,
        displayName: user?.cn || samAccountName,
        samAccountName,
        mail: user?.mail || "",
        department: user?.department || "",
        title: "Analista",
        company: "Rede Clube",
        telephoneNumber: "",
        mobile: "",
        office: "",
        description: "",
        employeeID: "",
        employeeNumber: "",
        manager: null,
        enabled: user?.enabled ?? true,
        locked: user?.locked ?? false,
        distinguishedName: "",
      },
      account: {
        userAccountControl: "",
        lockoutTime: "",
        lastLogonTimestamp: "",
        pwdLastSet: "",
        accountExpires: "",
        whenCreated: "",
        whenChanged: "",
      },
      groups: [
        { name: "GG-WiFi-Corporativo", distinguishedName: "CN=GG-WiFi-Corporativo,DC=mock" },
        { name: "GG-VPN-Usuarios", distinguishedName: "CN=GG-VPN-Usuarios,DC=mock" },
      ],
    };
  }

  return cached(`user-details:${samAccountName.toLowerCase()}`, 15000, () => withClient(async (client) => {
    const entry = await findUserEntry(client, samAccountName);

    const managerDn = String(firstAttr(entry, "manager") || "");
    const groups = stringArrayAttr(entry, "memberOf").map((dn) => ({
      name: dnCommonName(dn),
      distinguishedName: dn,
    }));

    return {
      source: "ldap",
      profile: {
        cn: firstAttr(entry, "cn"),
        displayName: firstAttr(entry, "displayName"),
        samAccountName: firstAttr(entry, "sAMAccountName"),
        mail: firstAttr(entry, "mail"),
        department: firstAttr(entry, "department"),
        title: firstAttr(entry, "title"),
        company: firstAttr(entry, "company"),
        telephoneNumber: firstAttr(entry, "telephoneNumber"),
        mobile: firstAttr(entry, "mobile"),
        office: firstAttr(entry, "physicalDeliveryOfficeName"),
        description: firstAttr(entry, "description"),
        employeeID: firstAttr(entry, "employeeID"),
        employeeNumber: firstAttr(entry, "employeeNumber"),
        manager: managerDn ? { name: dnCommonName(managerDn), distinguishedName: managerDn } : null,
        enabled: !isDisabled(entry),
        locked: isLocked(entry),
        distinguishedName: firstAttr(entry, "distinguishedName"),
      },
      account: {
        userAccountControl: firstAttr(entry, "userAccountControl"),
        lockoutTime: firstAttr(entry, "lockoutTime"),
        lastLogonTimestamp: firstAttr(entry, "lastLogonTimestamp"),
        pwdLastSet: firstAttr(entry, "pwdLastSet"),
        accountExpires: firstAttr(entry, "accountExpires"),
        whenCreated: firstAttr(entry, "whenCreated"),
        whenChanged: firstAttr(entry, "whenChanged"),
      },
      groups,
    };
  }));
}

export async function createAdUser(payload: Record<string, unknown>) {
  if (adConfig.useMock || !isAdConfigured()) {
    return { ok: true, source: "mock", message: "Usuario criado no modo mock.", user: payload };
  }

  return withClient(async (client) => {
    const samAccountName = String(payload.samAccountName || payload.employeeID || payload.employeeNumber || "").trim();
    const displayName = String(payload.displayName || "").trim();
    const givenName = String(payload.givenName || "").trim();
    const sn = String(payload.sn || "").trim();
    const targetOu = String(payload.targetOu || adConfig.usersBaseDn || adConfig.baseDn || "").trim();
    const initialPassword = String(payload.initialPassword || "").trim();
    const enableOnCreate = String(payload.enableOnCreate || "").toLowerCase() === "true";
    const groups = Array.isArray(payload.groups)
      ? payload.groups.map((group) => String(group || "").trim()).filter(Boolean)
      : String(payload.groups || "")
          .split(/[\n;]/)
          .map((group) => group.trim())
          .filter(Boolean);

    if (!samAccountName) {
      throw new Error("Informe o login/registro do usuario.");
    }

    if (!displayName) {
      throw new Error("Informe o nome exibido do usuario.");
    }

    if (!targetOu) {
      throw new Error("Informe a OU de destino ou configure AD_USERS_BASE_DN.");
    }

    if (enableOnCreate && !initialPassword) {
      throw new Error("Para criar usuario ativo, informe uma senha inicial.");
    }

    if (initialPassword) {
      validateStrongPassword(initialPassword);

      if (!adConfig.url?.toLowerCase().startsWith("ldaps://")) {
        throw new Error("Criar usuario com senha/ativo exige LDAPS. Ajuste AD_URL para ldaps:// e valide o certificado do DC.");
      }
    }

    await ensureUserDoesNotExist(client, samAccountName);

    const userPrincipalName = defaultUserPrincipalName(samAccountName, String(payload.userPrincipalName || ""));
    const managerIdentity = String(payload.managerDn || "").trim();
    const managerDn = managerIdentity ? await resolveManagerDn(client, managerIdentity) : "";
    const userDn = `CN=${ldapDnEscape(displayName)},${targetOu}`;
    const attributes: Record<string, string[] | string> = {
      objectClass: ["top", "person", "organizationalPerson", "user"],
      cn: displayName,
      name: displayName,
      displayName,
      sAMAccountName: samAccountName,
      userAccountControl: "514",
    };

    if (userPrincipalName && userPrincipalName.includes("@")) {
      attributes.userPrincipalName = userPrincipalName;
    }

    for (const [field, attribute] of Object.entries(createUserAttributes)) {
      const value = String(payload[field] ?? "").trim();
      if (value) {
        attributes[attribute] = value;
      }
    }

    if (managerDn) {
      attributes.manager = managerDn;
    }

    await client.add(userDn, attributes);

    if (initialPassword) {
      await client.modify(userDn, createPasswordChange(initialPassword));
      await client.modify(userDn, createReplaceOrDeleteChange("pwdLastSet", "0"));

      if (enableOnCreate) {
        await client.modify(userDn, createReplaceOrDeleteChange("userAccountControl", "512"));
      }
    }

    for (const group of groups) {
      const groupDn = await findGroupDn(client, group);
      await client.modify(groupDn, createMembershipChange("add", userDn));
    }

    clearAdCache();

    return {
      ok: true,
      source: "ldap",
      message: enableOnCreate && initialPassword
        ? `Usuario ${samAccountName} criado com sucesso em ${defaultUpnSuffix}, senha inicial definida e conta ativada.`
        : `Usuario ${samAccountName} criado com sucesso em ${defaultUpnSuffix}. A conta foi criada desativada; informe senha inicial e marque ativar para criar ativo.`,
      details: await getAdUserDetails(samAccountName),
    };
  });
}

export async function updateAdUserProfile(samAccountName: string, profile: Record<string, unknown>) {
  if (adConfig.useMock || !isAdConfigured()) {
    return { ok: true, source: "mock", message: "Usuario atualizado no modo mock." };
  }

  return withClient(async (client) => {
    const user = await findUserEntry(client, samAccountName, userDetailAttributes);
    const userDn = String(firstAttr(user, "distinguishedName"));
    const normalizedProfile = { ...profile };

    if (Object.prototype.hasOwnProperty.call(normalizedProfile, "managerDn")) {
      normalizedProfile.managerDn = await resolveManagerDn(client, String(normalizedProfile.managerDn ?? ""));
    }

    const changes = Object.entries(editableUserAttributes)
      .filter(([field]) => Object.prototype.hasOwnProperty.call(normalizedProfile, field))
      .filter(([field, attribute]) => String(firstAttr(user, attribute) || "").trim() !== String(normalizedProfile[field] ?? "").trim())
      .map(([field, attribute]) => createReplaceOrDeleteChange(attribute, String(normalizedProfile[field] ?? "")));

    if (Object.prototype.hasOwnProperty.call(normalizedProfile, "managerDn")) {
      const managerDn = String(normalizedProfile.managerDn ?? "");
      if (String(firstAttr(user, "manager") || "").trim() !== managerDn.trim()) {
        changes.push(createReplaceOrDeleteChange("manager", managerDn));
      }
    }

    if (!changes.length) {
      return getAdUserDetails(samAccountName);
    }

    await client.modify(userDn, changes);
    clearAdCache();
    return getAdUserDetails(samAccountName);
  });
}

export async function setAdUserEnabled(samAccountName: string, enabled: boolean) {
  if (adConfig.useMock || !isAdConfigured()) {
    return { ok: true, source: "mock", message: enabled ? "Usuario ativado no modo mock." : "Usuario desativado no modo mock." };
  }

  return withClient(async (client) => {
    const user = await findUserEntry(client, samAccountName, [
      "distinguishedName",
      "sAMAccountName",
      "userAccountControl",
      "isCriticalSystemObject",
    ]);
    const resolvedSam = String(firstAttr(user, "sAMAccountName") || samAccountName).toLowerCase();
    const isCritical = String(firstAttr(user, "isCriticalSystemObject") || "").toUpperCase() === "TRUE";

    if (resolvedSam === "krbtgt" || isCritical) {
      throw new Error("Conta protegida do Active Directory. Nao e permitido ativar/desativar esta conta pelo painel.");
    }

    const userDn = String(firstAttr(user, "distinguishedName"));
    const currentControl = Number(firstAttr(user, "userAccountControl") || 0);
    const nextControl = enabled ? currentControl & ~2 : currentControl | 2;

    if (currentControl === nextControl) {
      return getAdUserDetails(samAccountName);
    }

    await client.modify(userDn, createReplaceOrDeleteChange("userAccountControl", String(nextControl)));
    clearAdCache();
    return getAdUserDetails(samAccountName);
  });
}

export async function setAdUserPassword(samAccountName: string, password: string, forceChangeAtLogon: boolean) {
  const trimmedPassword = String(password || "");
  validateStrongPassword(trimmedPassword);

  if (adConfig.useMock || !isAdConfigured()) {
    return { ok: true, source: "mock", message: "Senha alterada no modo mock." };
  }

  if (!adConfig.url?.toLowerCase().startsWith("ldaps://")) {
    throw new Error("Alteracao de senha no AD exige LDAPS. Ajuste AD_URL para ldaps:// e valide o certificado do DC.");
  }

  return withClient(async (client) => {
    const user = await findUserEntry(client, samAccountName, ["distinguishedName", "sAMAccountName", "isCriticalSystemObject"]);
    const resolvedSam = String(firstAttr(user, "sAMAccountName") || samAccountName).toLowerCase();
    const isCritical = String(firstAttr(user, "isCriticalSystemObject") || "").toUpperCase() === "TRUE";

    if (resolvedSam === "krbtgt" || isCritical) {
      throw new Error("Conta protegida do Active Directory. Nao e permitido alterar senha desta conta pelo painel.");
    }

    const userDn = String(firstAttr(user, "distinguishedName"));
    await client.modify(userDn, createPasswordChange(trimmedPassword));

    if (forceChangeAtLogon) {
      await client.modify(userDn, createReplaceOrDeleteChange("pwdLastSet", "0"));
    }

    clearAdCache();
    return {
      ok: true,
      source: "ldap",
      message: `Senha de ${samAccountName} alterada.`,
    };
  });
}

export async function resolveAdUserIdentity(identity: string) {
  if (adConfig.useMock || !isAdConfigured()) {
    return {
      source: "mock",
      found: true,
      profile: {
        cn: identity,
        displayName: identity,
        samAccountName: identity,
        department: "",
        title: "",
        distinguishedName: "",
      },
    };
  }

  return cached(`resolve-user:${identity.toLowerCase()}`, 30000, () => withClient(async (client) => {
    const trimmed = identity.trim();
    if (!trimmed) {
      throw new Error("Informe o usuario.");
    }

    const entry = await findUserIdentityEntry(client, trimmed, [
      "cn",
      "displayName",
      "sAMAccountName",
      "department",
      "title",
      "employeeID",
      "employeeNumber",
      "distinguishedName",
    ]);

    return {
      source: "ldap",
      found: true,
      profile: {
        cn: firstAttr(entry, "cn"),
        displayName: firstAttr(entry, "displayName"),
        samAccountName: firstAttr(entry, "sAMAccountName"),
        department: firstAttr(entry, "department"),
        title: firstAttr(entry, "title"),
        employeeID: firstAttr(entry, "employeeID"),
        employeeNumber: firstAttr(entry, "employeeNumber"),
        distinguishedName: firstAttr(entry, "distinguishedName"),
      },
    };
  }));
}

export async function addAdUserToGroup(samAccountName: string, groupIdentity: string) {
  if (adConfig.useMock || !isAdConfigured()) {
    return { ok: true, source: "mock", message: "Grupo adicionado no modo mock." };
  }

  return withClient(async (client) => {
    const user = await findUserEntry(client, samAccountName, ["distinguishedName"]);
    const userDn = String(firstAttr(user, "distinguishedName"));
    const groupDn = await findGroupDn(client, groupIdentity);

    await client.modify(groupDn, createMembershipChange("add", userDn));
    clearAdCache();
    return getAdUserDetails(samAccountName);
  });
}

export async function removeAdUserFromGroup(samAccountName: string, groupIdentity: string) {
  if (adConfig.useMock || !isAdConfigured()) {
    return { ok: true, source: "mock", message: "Grupo removido no modo mock." };
  }

  return withClient(async (client) => {
    const user = await findUserEntry(client, samAccountName, ["distinguishedName"]);
    const userDn = String(firstAttr(user, "distinguishedName"));
    const groupDn = await findGroupDn(client, groupIdentity);

    await client.modify(groupDn, createMembershipChange("delete", userDn));
    clearAdCache();
    return getAdUserDetails(samAccountName);
  });
}

export async function unlockAdUser(samAccountName: string) {
  if (adConfig.useMock || !isAdConfigured()) {
    return { ok: true, source: "mock", message: "Usuario desbloqueado no modo mock." };
  }

  return withClient(async (client) => {
    const user = await findUserEntry(client, samAccountName, ["distinguishedName"]);
    const userDn = String(firstAttr(user, "distinguishedName"));

    await client.modify(userDn, createReplaceOrDeleteChange("lockoutTime", "0"));
    clearAdCache();

    return {
      ok: true,
      source: "ldap",
      message: `Usuario ${samAccountName} desbloqueado.`,
    };
  });
}

export async function listAdComputers(query = "", limit?: string | number) {
  if (adConfig.useMock || !isAdConfigured()) {
    return { source: "mock", items: mockComputers };
  }

  const safeQuery = ldapFilterEscape(query.trim());
  const searchPart = safeQuery ? `(|(cn=*${safeQuery}*)(dNSHostName=*${safeQuery}*))` : "";
  const filter = `(&(objectCategory=computer)${searchPart})`;

  return cached(`computers:${query}:${getSearchLimit(limit)}`, 60000, () => withClient(async (client) => {
    const entries = await search(client, adConfig.computersBaseDn || adConfig.baseDn!, filter, computerAttributes, getSearchLimit(limit));
    const items = entries.map((entry) => ({
      cn: firstAttr(entry, "cn"),
      dNSHostName: firstAttr(entry, "dNSHostName"),
      operatingSystem: firstAttr(entry, "operatingSystem"),
      lastLogonTimestamp: firstAttr(entry, "lastLogonTimestamp"),
      distinguishedName: firstAttr(entry, "distinguishedName"),
    }));

    return { source: "ldap", items };
  }));
}

export async function getAdComputerDetails(identity: string) {
  if (adConfig.useMock || !isAdConfigured()) {
    const computer = mockComputers.find((item) => item.cn.toLowerCase() === identity.toLowerCase()) || mockComputers[0];
    return {
      source: "mock",
      profile: {
        cn: computer?.cn || identity,
        dNSHostName: computer?.dNSHostName || "",
        operatingSystem: computer?.operatingSystem || "",
        operatingSystemVersion: "",
        operatingSystemServicePack: "",
        description: "",
        location: "",
        managedBy: null,
        distinguishedName: `CN=${computer?.cn || identity},OU=Computadores,DC=mock,DC=local`,
      },
      account: {
        userAccountControl: "",
        lastLogonTimestamp: computer?.lastLogonTimestamp || "",
        pwdLastSet: "",
        whenCreated: "",
        whenChanged: "",
      },
      organizationalUnit: {
        name: "Computadores",
        distinguishedName: "OU=Computadores,DC=mock,DC=local",
      },
      groups: [],
      servicePrincipalNames: [],
    };
  }

  return withClient(async (client) => {
    const entry = await findComputerEntry(client, identity, computerDetailAttributes);
    const dn = String(firstAttr(entry, "distinguishedName"));
    const managedByDn = String(firstAttr(entry, "managedBy") || "");
    const parentDn = parentDnFromDn(dn);

    return {
      source: "ldap",
      profile: {
        cn: String(firstAttr(entry, "cn") || ""),
        dNSHostName: String(firstAttr(entry, "dNSHostName") || ""),
        operatingSystem: String(firstAttr(entry, "operatingSystem") || ""),
        operatingSystemVersion: String(firstAttr(entry, "operatingSystemVersion") || ""),
        operatingSystemServicePack: String(firstAttr(entry, "operatingSystemServicePack") || ""),
        description: String(firstAttr(entry, "description") || ""),
        location: String(firstAttr(entry, "location") || ""),
        managedBy: managedByDn ? { name: dnCommonName(managedByDn), distinguishedName: managedByDn } : null,
        distinguishedName: dn,
      },
      account: {
        userAccountControl: String(firstAttr(entry, "userAccountControl") || ""),
        lastLogonTimestamp: String(firstAttr(entry, "lastLogonTimestamp") || ""),
        pwdLastSet: String(firstAttr(entry, "pwdLastSet") || ""),
        whenCreated: String(firstAttr(entry, "whenCreated") || ""),
        whenChanged: String(firstAttr(entry, "whenChanged") || ""),
      },
      organizationalUnit: {
        name: dnCommonName(parentDn),
        distinguishedName: parentDn,
      },
      groups: stringArrayAttr(entry, "memberOf").map((dnValue) => ({
        name: dnCommonName(dnValue),
        distinguishedName: dnValue,
      })),
      servicePrincipalNames: stringArrayAttr(entry, "servicePrincipalName"),
    };
  });
}

export async function updateAdComputerProfile(identity: string, profile: Record<string, unknown>) {
  if (adConfig.useMock || !isAdConfigured()) {
    return getAdComputerDetails(identity);
  }

  return withClient(async (client) => {
    const computer = await findComputerEntry(client, identity, computerDetailAttributes);
    const computerDn = String(firstAttr(computer, "distinguishedName"));
    const managedByValue = Object.prototype.hasOwnProperty.call(profile, "managedBy")
      ? await resolveManagerDn(client, String(profile.managedBy ?? ""))
      : undefined;
    const changes = [
      ...(Object.prototype.hasOwnProperty.call(profile, "description")
        ? [createReplaceOrDeleteChange("description", String(profile.description ?? ""))]
        : []),
      ...(Object.prototype.hasOwnProperty.call(profile, "location")
        ? [createReplaceOrDeleteChange("location", String(profile.location ?? ""))]
        : []),
      ...(managedByValue !== undefined ? [createReplaceOrDeleteChange("managedBy", managedByValue)] : []),
    ];

    if (!changes.length) {
      return getAdComputerDetails(identity);
    }

    await client.modify(computerDn, changes);
    clearAdCache();
    return getAdComputerDetails(computerDn);
  });
}

export async function moveAdComputerToOu(identity: string, targetOu: string) {
  if (adConfig.useMock || !isAdConfigured()) {
    return getAdComputerDetails(identity);
  }

  return withClient(async (client) => {
    const computer = await findComputerEntry(client, identity, ["cn", "distinguishedName"]);
    const currentDn = String(firstAttr(computer, "distinguishedName"));
    const destinationOu = await ensureOrganizationalUnitExists(client, targetOu);
    const currentParent = parentDnFromDn(currentDn);

    if (currentParent.toLowerCase() === destinationOu.toLowerCase()) {
      return getAdComputerDetails(currentDn);
    }

    const newDn = `${rdnFromDn(currentDn)},${destinationOu}`;
    await client.modifyDN(currentDn, newDn);
    clearAdCache();
    return getAdComputerDetails(newDn);
  });
}

export async function listAdGroups(query = "", limit?: string | number) {
  if (adConfig.useMock || !isAdConfigured()) {
    return { source: "mock", items: mockGroups };
  }

  const safeQuery = ldapFilterEscape(query.trim());
  const searchPart = safeQuery ? `(|(cn=*${safeQuery}*)(description=*${safeQuery}*))` : "";
  const filter = `(&(objectCategory=group)${searchPart})`;

  return cached(`groups:${query}:${getSearchLimit(limit)}`, 60000, () => withClient(async (client) => {
    const entries = await search(client, adConfig.groupsBaseDn || adConfig.baseDn!, filter, groupAttributes, getSearchLimit(limit));
    const items = entries.map((entry) => ({
      cn: firstAttr(entry, "cn"),
      description: firstAttr(entry, "description"),
      memberCount: asArray(getAttr(entry, "member")).length,
      distinguishedName: firstAttr(entry, "distinguishedName"),
    }));

    return { source: "ldap", items };
  }));
}

export async function listAdOrganizationalUnits(query = "", limit?: string | number) {
  if (adConfig.useMock || !isAdConfigured()) {
    return {
      source: "mock",
      domains: [{ name: "mock.local", baseDn: "DC=mock,DC=local" }],
      items: [
        { ou: "Usuarios", description: "", distinguishedName: "OU=Usuarios,DC=mock,DC=local" },
        { ou: "Tecnologia", description: "", distinguishedName: "OU=Tecnologia,DC=mock,DC=local" },
      ],
    };
  }

  const safeQuery = ldapFilterEscape(query.trim());
  const searchPart = safeQuery ? `(|(ou=*${safeQuery}*)(distinguishedName=*${safeQuery}*))` : "";
  const filter = `(&(objectClass=organizationalUnit)${searchPart})`;

  return cached(`ous:${query}:${getSearchLimit(limit)}`, 60000, () => withClient(async (client) => {
    const domains = getConfiguredDomains();
    const perDomainLimit = getSearchLimit(limit);
    const results = await Promise.all(
      domains.map(async (domain) => {
        try {
          return await search(client, domain.baseDn, filter, organizationalUnitAttributes, perDomainLimit);
        } catch {
          return [];
        }
      }),
    );
    const items = results
      .flat()
      .map((entry) => ({
        ou: firstAttr(entry, "ou"),
        description: firstAttr(entry, "description"),
        distinguishedName: firstAttr(entry, "distinguishedName"),
      }))
      .sort((a, b) => String(a.distinguishedName).localeCompare(String(b.distinguishedName)));

    return {
      source: "ldap",
      domains,
      items,
    };
  }));
}

export async function listLockedUsers(limit?: string | number) {
  if (adConfig.useMock || !isAdConfigured()) {
    return { source: "mock", items: mockLockouts };
  }

  return cached(`lockouts:${getSearchLimit(limit)}`, 8000, () => withClient(async (client) => {
    const entries = await search(
      client,
      adConfig.usersBaseDn || adConfig.baseDn!,
      "(&(objectCategory=person)(objectClass=user)(lockoutTime>=1))",
      userAttributes,
      0,
    );
    const items = entries
      .filter(isLocked)
      .slice(0, getSearchLimit(limit))
      .map((entry) => ({
        user: firstAttr(entry, "sAMAccountName"),
        cn: firstAttr(entry, "cn"),
        department: firstAttr(entry, "department"),
        lockoutTime: firstAttr(entry, "lockoutTime"),
        distinguishedName: firstAttr(entry, "distinguishedName"),
        source: "ldap",
      }));

    return { source: "ldap", items };
  }));
}
