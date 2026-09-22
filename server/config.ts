import "dotenv/config";

export type AdConfig = {
  useMock: boolean;
  url?: string;
  tlsRejectUnauthorized: boolean;
  tlsCaFile?: string;
  baseDn?: string;
  bindDn?: string;
  bindPassword?: string;
  netbiosDomain?: string;
  usersBaseDn?: string;
  computersBaseDn?: string;
  groupsBaseDn?: string;
  extraDomains: string[];
};

export type IntuneConfig = {
  useMock: boolean;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
};

export type MilvusConfig = {
  useMock: boolean;
  baseUrl?: string;
  apiToken?: string;
  authHeader: string;
  authScheme: string;
  ticketsPath: string;
  ticketDetailsPath: string;
  createTicketPath: string;
  closeTicketPath: string;
};

export type WifiPortalConfig = {
  host?: string;
  port: number;
  user?: string;
  password?: string;
  connectTimeoutMs: number;
  queryTimeoutMs: number;
  associadosDatabase: string;
  associadosTable: string;
  colaboradoresDatabase: string;
  colaboradoresTable: string;
};

export const port = Number(process.env.PORT || 3333);
export const sessionSecret = process.env.APP_SESSION_SECRET || "rede-clube-dev-secret-change-me";

export const adConfig: AdConfig = {
  useMock: process.env.AD_USE_MOCK !== "false",
  url: process.env.AD_URL,
  tlsRejectUnauthorized: process.env.AD_TLS_REJECT_UNAUTHORIZED !== "false",
  tlsCaFile: process.env.AD_TLS_CA_FILE,
  baseDn: process.env.AD_BASE_DN,
  bindDn: process.env.AD_BIND_DN,
  bindPassword: process.env.AD_BIND_PASSWORD,
  netbiosDomain: process.env.AD_NETBIOS_DOMAIN,
  usersBaseDn: process.env.AD_USERS_BASE_DN,
  computersBaseDn: process.env.AD_COMPUTERS_BASE_DN,
  groupsBaseDn: process.env.AD_GROUPS_BASE_DN,
  extraDomains: (process.env.AD_EXTRA_DOMAINS || "clubepaineiras.com.br")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
};

export function isAdConfigured(config: AdConfig = adConfig) {
  return Boolean(config.url && config.baseDn && config.bindDn && config.bindPassword);
}

export const intuneConfig: IntuneConfig = {
  useMock: process.env.INTUNE_USE_MOCK !== "false",
  tenantId: process.env.INTUNE_TENANT_ID,
  clientId: process.env.INTUNE_CLIENT_ID,
  clientSecret: process.env.INTUNE_CLIENT_SECRET,
};

export function isIntuneConfigured(config: IntuneConfig = intuneConfig) {
  return Boolean(config.tenantId && config.clientId && config.clientSecret);
}

export const milvusConfig: MilvusConfig = {
  useMock: process.env.MILVUS_USE_MOCK !== "false",
  baseUrl: process.env.MILVUS_BASE_URL,
  apiToken: process.env.MILVUS_API_TOKEN,
  authHeader: process.env.MILVUS_AUTH_HEADER || "Authorization",
  authScheme: process.env.MILVUS_AUTH_SCHEME ?? "",
  ticketsPath: process.env.MILVUS_TICKETS_PATH || "/chamado/listagem?total_registros=1000",
  ticketDetailsPath: process.env.MILVUS_TICKET_DETAILS_PATH || "/chamado/listagem?total_registros=1000",
  createTicketPath: process.env.MILVUS_CREATE_TICKET_PATH || "/chamado/criar",
  closeTicketPath: process.env.MILVUS_CLOSE_TICKET_PATH || "",
};

export function isMilvusConfigured(config: MilvusConfig = milvusConfig) {
  return Boolean(config.baseUrl && config.apiToken);
}

export const wifiPortalConfig: WifiPortalConfig = {
  host: process.env.WIFI_DB_HOST,
  port: Number(process.env.WIFI_DB_PORT || 3306),
  user: process.env.WIFI_DB_USER,
  password: process.env.WIFI_DB_PASSWORD,
  connectTimeoutMs: Number(process.env.WIFI_DB_CONNECT_TIMEOUT_MS || 5000),
  queryTimeoutMs: Number(process.env.WIFI_DB_QUERY_TIMEOUT_MS || 8000),
  associadosDatabase: process.env.WIFI_ASSOCIADOS_DB_NAME || process.env.WIFI_DB_NAME || "wifi_portal",
  associadosTable: process.env.WIFI_ASSOCIADOS_TABLE || "Tb_associados",
  colaboradoresDatabase: process.env.WIFI_COLABORADORES_DB_NAME || "radius",
  colaboradoresTable: process.env.WIFI_COLABORADORES_TABLE || "radcheck",
};

export function isWifiPortalConfigured(config: WifiPortalConfig = wifiPortalConfig) {
  return Boolean(config.host && config.user && config.associadosDatabase && config.colaboradoresDatabase);
}
