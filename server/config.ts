import "dotenv/config";
import crypto from "node:crypto";

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
  assetsPath: string;
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

export type SharePointConfig = {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  hostname?: string;
  sitePath?: string;
  driveId?: string;
  folderItemId?: string;
  folderPath?: string;
  folderUrl?: string;
};

export const port = Number(process.env.PORT || 3333);
export const isProduction = process.env.NODE_ENV === "production";

function resolveSessionSecret() {
  const configured = process.env.APP_SESSION_SECRET || "";
  const knownDefaults = ["troque_este_segredo", "rede-clube-dev-secret-change-me"];
  const isMissing = !configured || knownDefaults.includes(configured);

  if (!isMissing) {
    if (configured.length < 32) {
      console.warn("[seguranca] APP_SESSION_SECRET tem menos de 32 caracteres. Gere um mais forte.");
    }
    return configured;
  }

  if (isProduction) {
    throw new Error("APP_SESSION_SECRET ausente ou com valor padrao. Gere com: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"");
  }

  // Dev: segredo aleatorio por execucao. Sessoes expiram a cada reinicio da API.
  console.warn("[seguranca] APP_SESSION_SECRET nao definido ou fraco; usando segredo temporario de desenvolvimento.");
  return crypto.randomBytes(48).toString("base64url");
}

export const sessionSecret = resolveSessionSecret();

// Grupos do AD autorizados a entrar no portal (CN do grupo, separados por virgula).
// Vazio = qualquer usuario autenticado no AD entra (nao recomendado em producao).
export const allowedLoginGroups = (process.env.APP_ALLOWED_GROUPS || "")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

function loginList(value?: string) {
  return (value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export const projectsConfig = {
  // OU do AD de onde vem a equipe (nome da OU ou DN completo).
  teamOu: process.env.PROJECTS_TEAM_OU || "Tecnologia",
  // Logins que gerenciam todos os projetos. Vazio = todos sao gestores (modo aberto).
  admins: loginList(process.env.PROJECTS_ADMINS),
  // Contas da OU que nao sao pessoas (servico, teste) e nao devem aparecer na equipe.
  teamExclude: loginList(process.env.PROJECTS_TEAM_EXCLUDE),
};

// Gestores do portal: veem tudo e controlam o acesso dos demais.
// APP_ADMINS; se vazio, usa PROJECTS_ADMINS.
// Gestores definidos por variavel (APP_ADMINS e PROJECTS_ADMINS). Tambem podem ser definidos pelo painel (data/access.json).
export const portalAdmins = Array.from(new Set([...loginList(process.env.APP_ADMINS), ...projectsConfig.admins]));

// So entra no portal quem estiver nesta OU do AD (nome ou DN). Padrao: Tecnologia.
// Defina LOGIN_ALLOWED_OU= (vazio) para desligar. Gestores sempre entram.
export const loginAllowedOu = process.env.LOGIN_ALLOWED_OU === undefined ? "Tecnologia" : process.env.LOGIN_ALLOWED_OU.trim();

if (!projectsConfig.admins.length) {
  console.warn("[projetos] PROJECTS_ADMINS vazio: todos os usuarios enxergam e gerenciam todos os projetos.");
}

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
  useMock: process.env.INTUNE_USE_MOCK === "true",
  tenantId: process.env.INTUNE_TENANT_ID || process.env.SHAREPOINT_TENANT_ID,
  clientId: process.env.INTUNE_CLIENT_ID || process.env.SHAREPOINT_CLIENT_ID,
  clientSecret: process.env.INTUNE_CLIENT_SECRET || process.env.SHAREPOINT_CLIENT_SECRET,
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
  assetsPath: process.env.MILVUS_ASSETS_PATH || "/dispositivos/listagem?total_registros=1000",
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
  connectTimeoutMs: Number(process.env.WIFI_DB_CONNECT_TIMEOUT_MS || 1500),
  queryTimeoutMs: Number(process.env.WIFI_DB_QUERY_TIMEOUT_MS || 3000),
  associadosDatabase: process.env.WIFI_ASSOCIADOS_DB_NAME || process.env.WIFI_DB_NAME || "wifi_portal",
  associadosTable: process.env.WIFI_ASSOCIADOS_TABLE || "Tb_associados",
  colaboradoresDatabase: process.env.WIFI_COLABORADORES_DB_NAME || "radius",
  colaboradoresTable: process.env.WIFI_COLABORADORES_TABLE || "radcheck",
};

export function isWifiPortalConfigured(config: WifiPortalConfig = wifiPortalConfig) {
  return Boolean(config.host && config.user && config.associadosDatabase && config.colaboradoresDatabase);
}

export const sharePointConfig: SharePointConfig = {
  tenantId: process.env.SHAREPOINT_TENANT_ID,
  clientId: process.env.SHAREPOINT_CLIENT_ID,
  clientSecret: process.env.SHAREPOINT_CLIENT_SECRET,
  hostname: process.env.SHAREPOINT_HOSTNAME,
  sitePath: process.env.SHAREPOINT_SITE_PATH,
  driveId: process.env.SHAREPOINT_DRIVE_ID,
  folderItemId: process.env.SHAREPOINT_FOLDER_ITEM_ID,
  folderPath: process.env.SHAREPOINT_FOLDER_PATH,
  folderUrl: process.env.SHAREPOINT_FOLDER_URL,
};

export function isSharePointConfigured(config: SharePointConfig = sharePointConfig) {
  return Boolean(
    config.tenantId &&
    config.clientId &&
    config.clientSecret &&
    (config.driveId || (config.hostname && config.sitePath)) &&
    (config.folderItemId || config.folderPath || config.folderUrl),
  );
}
