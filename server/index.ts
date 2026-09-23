import cors from "cors";
import express from "express";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { adConfig, isAdConfigured, port } from "./config";
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
  getIntuneStatus,
  getIntuneSummary,
  listIntuneDevices,
} from "./intuneClient";
import {
  closeMilvusTicket,
  createMilvusTicket,
  getMilvusStatus,
  getMilvusSummary,
  getMilvusTicketDetails,
  listMilvusTickets,
} from "./milvusClient";
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

app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
}));
app.use(express.json());

function asyncRoute<T>(handler: (req: express.Request) => Promise<T>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      res.json(await handler(req));
    } catch (error) {
      const message = formatApiError(error);
      res.status(500).json({ ok: false, message });
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

app.get("/api/diagnostics/ad", async (_req, res) => {
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

app.post("/api/auth/login", async (req, res) => {
  try {
    const user = await authenticateAdUser(String(req.body?.login || ""), String(req.body?.password || ""), String(req.body?.domain || ""));
    const token = createSessionToken(user);
    res.json({ ok: true, token, user });
  } catch (error) {
    const message = formatApiError(error);
    res.status(message.includes("Informe") ? 400 : 401).json({ ok: false, message });
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

app.use("/api/ad", requireAuth);

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

app.use("/api/intune", requireAuth);

app.get("/api/intune/status", asyncRoute(() => getIntuneStatus()));
app.get("/api/intune/summary", asyncRoute(() => getIntuneSummary()));
app.get("/api/intune/devices", asyncRoute((req) => listIntuneDevices(String(req.query.search || ""), String(req.query.limit || ""))));
app.get("/api/intune/devices/:id", asyncRoute((req) => getIntuneDeviceDetails(String(req.params.id))));

app.use("/api/wifi", requireAuth);

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

app.use("/api/pop", requireAuth);

app.get("/api/pop/documents", asyncRoute((req) => listPopDocuments(String(req.query.search || ""))));

app.use("/api/snmp", requireAuth);

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

app.use("/api/tickets", requireAuth);

app.get("/api/tickets/status", asyncRoute(() => getMilvusStatus()));
app.get("/api/tickets/summary", asyncRoute(() => getMilvusSummary()));
app.get("/api/tickets", asyncRoute((req) => listMilvusTickets(String(req.query.search || ""), String(req.query.limit || ""))));
app.post("/api/tickets", asyncRoute((req) => createMilvusTicket(req.body || {})));
app.post("/api/tickets/:id/close", asyncRoute((req) => closeMilvusTicket(String(req.params.id), req.body || {})));
app.get("/api/tickets/:id", asyncRoute((req) => getMilvusTicketDetails(String(req.params.id))));

app.use("/api/ips", requireAuth);

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

app.use("/api/topology", requireAuth);

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

if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Rede Clube portal em http://0.0.0.0:${port}`);
});
