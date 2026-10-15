import cors from "cors";
import express from "express";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { adConfig, allowedLoginGroups, isAdConfigured, isProduction, loginAllowedOu, port, projectsConfig } from "./config";
import {
  claimAdmin,
  getMyAccess,
  isPortalAdmin,
  listAccess,
  requireAdmin,
  requireViews,
  resetUserViews,
  setDefaultViews,
  setPanelAdmin,
  setUserViews,
} from "./accessStore";
import {
  auditMutations,
  checkLoginThrottle,
  clearLoginFailures,
  registerLoginFailure,
  securityHeaders,
  writeAudit,
} from "./security";
import {
  addAdUserToGroup,
  authenticateAdUser,
  createAdUser,
  deleteAdComputer,
  getAdStatus,
  getAdComputerDetails,
  getAdSummary,
  getAdUserDetails,
  listAdComputers,
  listAdGroups,
  listAdOrganizationalUnits,
  listAdUsers,
  listAdUsersInOu,
  listLockedUsers,
  removeAdUserFromGroup,
  resolveAdUserIdentity,
  setAdUserEnabled,
  setAdUserPassword,
  moveAdComputerToOu,
  unlockAdUser,
  updateAdComputerProfile,
  updateAdUserProfile,
} from "./adClient";
import { createSessionToken, requireAuth, verifySessionToken } from "./auth";
import { listLockoutEvents } from "./eventLogs";
import {
  getIntuneDeviceDetails,
  getIntuneDeviceLapsCredential,
  getIntuneStatus,
  getIntuneSummary,
  listIntuneDevices,
} from "./intuneClient";
import {
  closeMilvusTicket,
  createMilvusTicket,
  getMilvusAssetsSummary,
  getMilvusStatus,
  getMilvusSummary,
  getMilvusTicketDetails,
  listMilvusTickets,
} from "./milvusClient";
import {
  getOffice365Details,
  getOffice365Status,
  getOffice365Summary,
  updateOffice365UserLicenses,
} from "./office365Client";
import {
  collectAllSnmpDevices,
  collectSnmpDevice,
  deleteSnmpDevice,
  getSnmpSummary,
  listSnmp,
  saveSnmpDevice,
  testSnmpDevice,
} from "./snmpAgent";
import { listPopDocuments } from "./sharePointClient";
import {
  createWifiRecord,
  deleteWifiRecord,
  getWifiSchema,
  getWifiStatus,
  listWifiRecords,
  updateWifiRecord,
} from "./wifiPortalClient";
import {
  createIp,
  createIpLink,
  createIpNetwork,
  deleteIp,
  deleteIpLink,
  getIpSummary,
  listIps,
  reimportIps,
  renameIpCategory,
  updateIpLink,
  updateIpNetworkVlan,
  updateIp,
} from "./ipInventoryClient";
import { getTopology, saveTopology } from "./topologyStore";
import {
  addTaskComment,
  checklistAction,
  createSpace,
  createTask,
  deleteSpace,
  deleteTask,
  getProjects,
  updateSpace,
  updateTask,
} from "./projectStore";
import type { AuthUser } from "./auth";
import type { ProjectAccess } from "./projectStore";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");
const execFileAsync = promisify(execFile);

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;

  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    const isPrivateIp = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
    const configuredOrigins = (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return configuredOrigins.includes(origin) || isLocalhost || isPrivateIp;
  } catch {
    return false;
  }
}

app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);
app.use(securityHeaders);
app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
}));
app.use(express.json({ limit: "2mb" }));
app.use("/api", auditMutations);

function asyncRoute<T>(handler: (req: express.Request) => Promise<T>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      res.json(await handler(req));
    } catch (error) {
      const message = formatApiError(error);
      const status = error && typeof error === "object" && "status" in error ? Number((error as { status?: unknown }).status) || 500 : 500;
      res.status(status).json({ ok: false, message });
    }
  };
}

function formatApiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro inesperado";

  if (message.includes("data 775")) {
    return "Conta usada para conectar no AD esta bloqueada (LDAP data 775). Desbloqueie a conta ou troque AD_BIND_DN/AD_BIND_PASSWORD.";
  }

  if (message.includes("data 52e")) {
    return "Credenciais invalidas para conectar no AD (LDAP data 52e). Confira AD_BIND_DN e AD_BIND_PASSWORD.";
  }

  if (message.includes("data 533")) {
    return "Conta usada para conectar no AD esta desabilitada (LDAP data 533).";
  }

  if (message.includes("data 532")) {
    return "Senha da conta usada para conectar no AD esta expirada (LDAP data 532).";
  }

  if (message.includes("problem 22") || message.includes("Invalid argument")) {
    return "O AD recusou a alteracao porque o atributo/conta e protegido ou o valor nao e permitido. Em contas internas como krbtgt, nao ative/desative pelo painel.";
  }

  return message.replace(/\u0000/g, "");
}

function parsePingLatency(output: string) {
  const match = /time[=<]\s*(\d+(?:[.,]\d+)?)\s*ms/i.exec(output) || /tempo[=<]\s*(\d+(?:[.,]\d+)?)\s*ms/i.exec(output);
  return match ? Number(match[1].replace(",", ".")) : null;
}

async function pingHost(ip: string) {
  const host = ip.trim();
  if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
    return { ip: host, ok: false, latencyMs: null, checkedAt: new Date().toISOString(), message: "IP ou host invalido." };
  }

  const args = process.platform === "win32"
    ? ["-n", "1", "-w", "1000", host]
    : ["-c", "1", "-W", "1", host];

  try {
    const { stdout } = await execFileAsync("ping", args, { timeout: 2500 });
    return {
      ip: host,
      ok: true,
      latencyMs: parsePingLatency(stdout),
      checkedAt: new Date().toISOString(),
      message: "Online",
    };
  } catch (error) {
    const output = error && typeof error === "object" && "stdout" in error ? String((error as { stdout?: unknown }).stdout || "") : "";
    return {
      ip: host,
      ok: false,
      latencyMs: parsePingLatency(output),
      checkedAt: new Date().toISOString(),
      message: "Sem resposta ao ping",
    };
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "rede-clube-api" });
});

app.get("/api/diagnostics/ad", requireAuth, requireViews(["ad"]), async (_req, res) => {
  let urlInfo = { protocol: "", host: "", port: "" };

  try {
    const parsedUrl = adConfig.url ? new URL(adConfig.url) : null;
    if (parsedUrl) {
      urlInfo = {
        protocol: parsedUrl.protocol.replace(":", ""),
        host: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "ldaps:" ? "636" : "389"),
      };
    }
  } catch {
    urlInfo = { protocol: "invalido", host: "", port: "" };
  }

  const diagnostics = {
    ok: false,
    configured: isAdConfigured(),
    useMock: adConfig.useMock,
    url: urlInfo,
    hasBaseDn: Boolean(adConfig.baseDn),
    hasBindDn: Boolean(adConfig.bindDn),
    hasBindPassword: Boolean(adConfig.bindPassword),
    netbiosDomain: adConfig.netbiosDomain || "",
    extraDomains: adConfig.extraDomains,
    tlsRejectUnauthorized: adConfig.tlsRejectUnauthorized,
    message: "",
  };

  if (adConfig.useMock || !isAdConfigured()) {
    res.status(200).json({
      ...diagnostics,
      message: "AD incompleto ou em modo mock no ambiente atual do servidor.",
    });
    return;
  }

  try {
    const status = await getAdStatus();
    res.json({
      ...diagnostics,
      ok: status.ok,
      message: status.message,
    });
  } catch (error) {
    res.status(500).json({
      ...diagnostics,
      message: formatApiError(error),
    });
  }
});

async function isUserAllowed(login: string) {
  if (adConfig.useMock || !isAdConfigured()) return true;
  // Gestores sempre entram (evita trancar o portal se a OU mudar de nome).
  if (isPortalAdmin(login)) return true;

  if (loginAllowedOu) {
    const team = await listAdUsersInOu(loginAllowedOu);
    if (!team.items.some((member) => member.login.toLowerCase() === login.toLowerCase())) return false;
  }

  if (allowedLoginGroups.length) {
    const details = await getAdUserDetails(login);
    return details.groups.some((group) => allowedLoginGroups.includes(String(group.name).toLowerCase()));
  }
  return true;
}

app.post("/api/auth/login", async (req, res) => {
  const throttled = checkLoginThrottle(req);
  if (throttled) {
    res.status(429).json({ ok: false, message: throttled });
    return;
  }

  const attemptedLogin = String(req.body?.login || "");

  try {
    const user = await authenticateAdUser(attemptedLogin, String(req.body?.password || ""), String(req.body?.domain || ""));

    if (!(await isUserAllowed(user.login))) {
      writeAudit({ event: "login-negado-grupo", user: user.login, ip: req.ip });
      res.status(403).json({ ok: false, message: "Acesso restrito a equipe de Tecnologia. Se voce faz parte da equipe, fale com o gestor do portal." });
      return;
    }

    clearLoginFailures(req);
    writeAudit({ event: "login", user: user.login, ip: req.ip });
    const token = createSessionToken(user);
    res.json({ ok: true, token, user, access: await getMyAccess(user) });
  } catch (error) {
    const message = formatApiError(error);
    const isValidation = message.includes("Informe");
    if (!isValidation) {
      registerLoginFailure(req);
      writeAudit({ event: "login-falhou", user: attemptedLogin, ip: req.ip });
    }
    // Em producao nao revela se o usuario existe ou detalhes do LDAP.
    const isServerConfigIssue = /^(Login indisponivel|Conta usada para conectar|Senha da conta usada)/.test(message);
    const publicMessage = isProduction && !isValidation && !isServerConfigIssue ? "Registro ou senha invalidos." : message;
    res.status(isValidation ? 400 : 401).json({ ok: false, message: publicMessage });
  }
});

app.get("/api/auth/me", (req, res) => {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const user = token ? verifySessionToken(token) : null;

  if (!user) {
    res.status(401).json({ ok: false, message: "Sessao expirada ou nao autenticada." });
    return;
  }

  res.json({ ok: true, user });
});

/* ---------- Controle de acesso ao menu ---------- */

app.get("/api/access/me", requireAuth, asyncRoute((req) => getMyAccess(req.res?.locals.user)));
app.get("/api/access", requireAuth, requireAdmin, asyncRoute(async () => {
  let people: { login: string; name: string; title?: string }[] = [];
  let teamError = "";
  try {
    const team = await listAdUsersInOu(loginAllowedOu || projectsConfig.teamOu);
    people = team.items.filter((member) => !projectsConfig.teamExclude.includes(member.login.toLowerCase()));
  } catch (error) {
    teamError = error instanceof Error ? error.message : "Equipe indisponivel.";
  }
  return { ...(await listAccess(people)), teamError, loginAllowedOu };
}));
app.put("/api/access/users/:login", requireAuth, requireAdmin, asyncRoute((req) =>
  setUserViews(String(req.params.login), String(req.body?.name || ""), req.body?.views, req.res?.locals.user)));
app.delete("/api/access/users/:login", requireAuth, requireAdmin, asyncRoute((req) => resetUserViews(String(req.params.login))));
app.put("/api/access/defaults", requireAuth, requireAdmin, asyncRoute((req) => setDefaultViews(req.body?.views)));
app.post("/api/access/claim", requireAuth, asyncRoute((req) => claimAdmin(req.res?.locals.user)));
app.put("/api/access/admins/:login", requireAuth, requireAdmin, asyncRoute((req) =>
  setPanelAdmin(String(req.params.login), Boolean(req.body?.admin), req.res?.locals.user)));

app.use("/api/ad", requireAuth, requireViews(["ad", "tv"], ["ad"]));

app.get("/api/ad/status", asyncRoute(() => getAdStatus()));
app.get("/api/ad/summary", asyncRoute(() => getAdSummary()));
app.get("/api/ad/users", asyncRoute((req) => listAdUsers(String(req.query.search || ""), String(req.query.limit || ""))));
app.get("/api/ad/users/resolve/:identity", asyncRoute((req) => resolveAdUserIdentity(String(req.params.identity))));
app.get("/api/ad/users/:samAccountName/details", asyncRoute((req) => getAdUserDetails(String(req.params.samAccountName))));
app.patch(
  "/api/ad/users/:samAccountName",
  asyncRoute((req) => updateAdUserProfile(String(req.params.samAccountName), req.body?.profile || {})),
);
app.patch(
  "/api/ad/users/:samAccountName/enabled",
  asyncRoute((req) => setAdUserEnabled(String(req.params.samAccountName), Boolean(req.body?.enabled))),
);
app.patch(
  "/api/ad/users/:samAccountName/password",
  asyncRoute((req) => setAdUserPassword(String(req.params.samAccountName), String(req.body?.password || ""), Boolean(req.body?.forceChangeAtLogon))),
);
app.post("/api/ad/users/:samAccountName/unlock", asyncRoute((req) => unlockAdUser(String(req.params.samAccountName))));
app.post(
  "/api/ad/users/:samAccountName/groups",
  asyncRoute((req) => addAdUserToGroup(String(req.params.samAccountName), String(req.body?.group || ""))),
);
app.delete(
  "/api/ad/users/:samAccountName/groups",
  asyncRoute((req) => removeAdUserFromGroup(String(req.params.samAccountName), String(req.body?.group || ""))),
);
app.get("/api/ad/computers", asyncRoute((req) => listAdComputers(String(req.query.search || ""), String(req.query.limit || ""))));
app.get("/api/ad/computers/:identity/details", asyncRoute((req) => getAdComputerDetails(String(req.params.identity))));
app.patch(
  "/api/ad/computers/:identity",
  asyncRoute((req) => updateAdComputerProfile(String(req.params.identity), req.body?.profile || {})),
);
app.patch(
  "/api/ad/computers/:identity/ou",
  asyncRoute((req) => moveAdComputerToOu(String(req.params.identity), String(req.body?.targetOu || ""))),
);
app.delete("/api/ad/computers/:identity", asyncRoute((req) => deleteAdComputer(String(req.params.identity))));
app.get("/api/ad/groups", asyncRoute((req) => listAdGroups(String(req.query.search || ""), String(req.query.limit || ""))));
app.get("/api/ad/ous", asyncRoute((req) => listAdOrganizationalUnits(String(req.query.search || ""), String(req.query.limit || 500))));
app.get("/api/ad/lockouts", asyncRoute((req) => listLockedUsers(String(req.query.limit || ""))));
app.get("/api/ad/lockout-events", asyncRoute((req) => listLockoutEvents(Number(req.query.hours || 24))));

app.post("/api/ad/users", asyncRoute((req) => createAdUser(req.body || {})));

app.post("/api/ad/groups/:group/members", (_req, res) => {
  res.status(501).json({
    ok: false,
    message: "Alteracao de grupos ainda bloqueada. Esta acao precisa de aprovacao e trilha de auditoria.",
  });
});

app.use("/api/intune", requireAuth, requireViews(["intune", "tv"], ["intune"]));

app.get("/api/intune/status", asyncRoute(() => getIntuneStatus()));
app.get("/api/intune/summary", asyncRoute(() => getIntuneSummary()));
app.get("/api/intune/devices", asyncRoute((req) => listIntuneDevices(String(req.query.search || ""), String(req.query.limit || ""))));
app.get("/api/intune/devices/:id/laps", requireViews(["intune"]), (req, res, next) => {
  writeAudit({ event: "laps-consultado", user: res.locals.user?.login, ip: req.ip, deviceId: String(req.params.id) });
  next();
}, asyncRoute((req) => getIntuneDeviceLapsCredential(String(req.params.id))));
app.get("/api/intune/devices/:id", asyncRoute((req) => getIntuneDeviceDetails(String(req.params.id))));

app.use("/api/office365", requireAuth, requireViews(["office365", "tv"], ["office365"]));

app.get("/api/office365/status", asyncRoute(() => getOffice365Status()));
app.get("/api/office365/summary", asyncRoute(() => getOffice365Summary()));
app.get("/api/office365/details", asyncRoute(() => getOffice365Details()));
app.patch("/api/office365/users/:id/licenses", asyncRoute((req) => updateOffice365UserLicenses(String(req.params.id), req.body?.skuIds)));

app.use("/api/wifi", requireAuth, requireViews(["wifi"]));

app.get("/api/wifi/status", asyncRoute((req) => getWifiStatus(String(req.query.kind || ""))));
app.get("/api/wifi/:kind/schema", asyncRoute((req) => getWifiSchema(String(req.params.kind))));
app.get("/api/wifi/:kind", asyncRoute((req) => listWifiRecords(String(req.params.kind), {
  search: String(req.query.search || ""),
  page: String(req.query.page || "1"),
  pageSize: String(req.query.pageSize || "20"),
})));
app.post("/api/wifi/:kind", asyncRoute((req) => createWifiRecord(String(req.params.kind), req.body || {})));
app.patch("/api/wifi/:kind/:id", asyncRoute((req) => updateWifiRecord(String(req.params.kind), String(req.params.id), req.body || {})));
app.delete("/api/wifi/:kind/:id", asyncRoute((req) => deleteWifiRecord(String(req.params.kind), String(req.params.id))));

app.use("/api/pop", requireAuth, requireViews(["pop"]));

app.get("/api/pop/documents", asyncRoute((req) => listPopDocuments(String(req.query.search || ""))));

app.use("/api/snmp", requireAuth, requireViews(["snmp", "tv", "topology"], ["snmp"]));

app.get("/api/snmp/summary", asyncRoute(() => getSnmpSummary()));
app.get("/api/snmp", asyncRoute(() => listSnmp()));
app.post("/api/snmp/devices", asyncRoute(async (req) => ({
  ok: true,
  message: "Dispositivo SNMP salvo.",
  device: await saveSnmpDevice(req.body || {}),
})));
app.delete("/api/snmp/devices/:id", asyncRoute(async (req) => deleteSnmpDevice(String(req.params.id))));
app.post("/api/snmp/test", asyncRoute(async (req) => ({
  ok: true,
  metric: await testSnmpDevice(req.body || {}),
})));
app.post("/api/snmp/collect", asyncRoute(async () => ({
  ok: true,
  metrics: await collectAllSnmpDevices(),
})));
app.post("/api/snmp/devices/:id/collect", asyncRoute(async (req) => ({
  ok: true,
  metric: await collectSnmpDevice(String(req.params.id)),
})));

app.use("/api/tickets", requireAuth, requireViews(["milvusPortal", "tv"], ["milvusPortal"]));

app.get("/api/tickets/status", asyncRoute(() => getMilvusStatus()));
app.get("/api/tickets/summary", asyncRoute(() => getMilvusSummary()));
app.get("/api/tickets/assets-summary", asyncRoute(() => getMilvusAssetsSummary()));
app.get("/api/tickets", asyncRoute((req) => listMilvusTickets(String(req.query.search || ""), String(req.query.limit || ""))));
app.post("/api/tickets", asyncRoute((req) => createMilvusTicket(req.body || {})));
app.post("/api/tickets/:id/close", asyncRoute((req) => closeMilvusTicket(String(req.params.id), req.body || {})));
app.get("/api/tickets/:id", asyncRoute((req) => getMilvusTicketDetails(String(req.params.id))));

app.use("/api/ips", requireAuth, requireViews(["ips", "topology", "tv"], ["ips"]));

app.get("/api/ips/summary", asyncRoute(() => getIpSummary()));
app.get("/api/ips", asyncRoute((req) => listIps(String(req.query.search || ""), String(req.query.status || ""), String(req.query.category || ""))));
app.post("/api/ips", asyncRoute((req) => createIp(req.body || {})));
app.post("/api/ips/networks", asyncRoute((req) => createIpNetwork(req.body || {})));
app.patch("/api/ips/networks/vlan", asyncRoute((req) => updateIpNetworkVlan(req.body || {})));
app.post("/api/ips/links", asyncRoute((req) => createIpLink(req.body || {})));
app.patch("/api/ips/links/:id", asyncRoute((req) => updateIpLink(String(req.params.id), req.body || {})));
app.delete("/api/ips/links/:id", asyncRoute((req) => deleteIpLink(String(req.params.id))));
app.post("/api/ips/reimport", asyncRoute(() => reimportIps()));
app.patch("/api/ips/categories", asyncRoute((req) => renameIpCategory(req.body || {})));
app.patch("/api/ips/:id", asyncRoute((req) => updateIp(String(req.params.id), req.body || {})));
app.delete("/api/ips/:id", asyncRoute((req) => deleteIp(String(req.params.id))));

app.use("/api/topology", requireAuth, requireViews(["topology", "tv"], ["topology"]));

app.get("/api/topology", asyncRoute(async () => ({
  ok: true,
  topology: await getTopology(),
})));

app.put("/api/topology", asyncRoute(async (req) => ({
  ok: true,
  message: "Topologia salva no arquivo.",
  topology: await saveTopology(req.body?.topology || req.body || {}),
})));

app.post("/api/topology/ping", asyncRoute(async (req) => {
  const ips: unknown[] = Array.isArray(req.body?.ips) ? req.body.ips : [];
  const uniqueIps = (Array.from(new Set(ips.map((ip: unknown) => String(ip || "").trim()).filter(Boolean))) as string[]).slice(0, 100);
  const items = await Promise.all(uniqueIps.map((ip) => pingHost(ip)));
  return { ok: true, items };
}));

app.use("/api/projects", requireAuth, requireViews(["projects"]));

function projectAccess(req: express.Request): ProjectAccess {
  const user = (req.res?.locals.user || {}) as AuthUser;
  // Mesmo gestor do portal (variavel ou definido pelo painel); modo aberto = todos.
  const isAdmin = isPortalAdmin(String(user.login || ""));
  return { user, isAdmin };
}

function projectRoute<T>(handler: (req: express.Request, access: ProjectAccess) => Promise<T> | T) {
  return asyncRoute(async (req) => handler(req, projectAccess(req)));
}

app.get("/api/projects", projectRoute((_req, access) => getProjects(access)));
app.get("/api/projects/team", asyncRoute(async () => {
  const team = await listAdUsersInOu(projectsConfig.teamOu);
  return { ...team, items: team.items.filter((member) => !projectsConfig.teamExclude.includes(member.login.toLowerCase())) };
}));
app.post("/api/projects/spaces", projectRoute((req, access) => createSpace(req.body, access)));
app.patch("/api/projects/spaces/:id", projectRoute((req, access) => updateSpace(String(req.params.id), req.body, access)));
app.delete("/api/projects/spaces/:id", projectRoute((req, access) => deleteSpace(String(req.params.id), access)));
app.post("/api/projects/tasks", projectRoute((req, access) => createTask(req.body, access)));
app.patch("/api/projects/tasks/:id", projectRoute((req, access) => updateTask(String(req.params.id), req.body, access)));
app.delete("/api/projects/tasks/:id", projectRoute((req, access) => deleteTask(String(req.params.id), access)));
app.post("/api/projects/tasks/:id/comments", projectRoute((req, access) => addTaskComment(String(req.params.id), req.body, access)));
app.post(
  "/api/projects/tasks/:id/checklist/:itemId/:action",
  projectRoute((req, access) => checklistAction(String(req.params.id), String(req.params.itemId), String(req.params.action), access)),
);

if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Rede Clube portal em http://0.0.0.0:${port}`);
});
