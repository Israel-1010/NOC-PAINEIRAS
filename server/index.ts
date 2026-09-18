import cors from "cors";
import express from "express";
import { port } from "./config";
import {
  addAdUserToGroup,
  authenticateAdUser,
  createAdUser,
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

const app = express();

function isAllowedDevOrigin(origin?: string) {
  if (!origin) return true;

  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    const isDevPort = url.port === "5173";
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    const isPrivateIp = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);

    return isDevPort && (isLocalhost || isPrivateIp);
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedDevOrigin(origin));
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "rede-clube-api" });
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

app.listen(port, () => {
  console.log(`Rede Clube API em http://127.0.0.1:${port}`);
});
