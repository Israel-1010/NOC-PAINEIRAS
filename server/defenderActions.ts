// Menu "Microsoft Defender" do portal: tomar acao sobre incidentes, alertas, maquinas e quarentena.
// Mesmo app do Graph do Intune/SharePoint. O que cada parte precisa (permissao de APLICATIVO + consentimento):
//   - incidentes/alertas (Graph): SecurityIncident.ReadWrite.All, SecurityAlert.ReadWrite.All;
//   - maquinas (API do Defender for Endpoint, "WindowsDefenderATP"): Machine.Read.All, Machine.Isolate,
//     Machine.Scan, Machine.RestrictExecution, Machine.CollectForensics;
//   - quarentena de e-mail (Exchange Online, nao existe no Graph): Exchange.ManageAsApp e o app como membro
//     da funcao "Administrador de Segurança" no Entra ID.
// Toda alteracao passa pelo auditMutations do servidor (data/audit.log) e leva o nome de quem fez.

import https from "node:https";
import type { AuthUser } from "./auth";
import { graph, graphAll, graphWrite, msRoles, msToken } from "./defenderClient";
import { intuneConfig } from "./config";

class BadRequest extends Error {
  status = 400;
}

const MDE_SCOPE = "https://api.securitycenter.microsoft.com/.default";
const MDE_API = "https://api.securitycenter.microsoft.com/api";
const EXO_SCOPE = "https://outlook.office365.com/.default";

/* ---------- O que esta liberado ---------- */
export async function defenderCapabilities() {
  const [graphRoles, mdeRoles, exoRoles] = await Promise.all([msRoles(), msRoles(MDE_SCOPE), msRoles(EXO_SCOPE)]);
  return {
    incidents: graphRoles.some((role) => /SecurityIncident\.ReadWrite/.test(role)),
    alerts: graphRoles.some((role) => /SecurityAlert\.ReadWrite/.test(role)),
    machines: mdeRoles.some((role) => /^Machine\.Read/.test(role)),
    machineActions: {
      isolate: mdeRoles.includes("Machine.Isolate"),
      scan: mdeRoles.includes("Machine.Scan"),
      restrict: mdeRoles.includes("Machine.RestrictExecution"),
      collect: mdeRoles.includes("Machine.CollectForensics"),
    },
    quarantine: exoRoles.includes("Exchange.ManageAsApp"),
  };
}

/* ---------- Quem esta agindo (UPN do Entra ID a partir do login do AD) ---------- */
const upnCache = new Map<string, string>();
async function actorUpn(user?: AuthUser) {
  if (!user) return "";
  const login = user.login.toLowerCase();
  if (upnCache.has(login)) return upnCache.get(login)!;
  let upn = "";
  try {
    const result = await graph<{ value: { userPrincipalName: string }[] }>(
      `/users?$filter=onPremisesSamAccountName eq '${login.replace(/'/g, "''")}'&$select=userPrincipalName&$count=true`,
      { ConsistencyLevel: "eventual" },
    );
    upn = result.value[0]?.userPrincipalName || "";
  } catch {
    upn = "";
  }
  upnCache.set(login, upn);
  return upn;
}

const byWho = (user?: AuthUser) => (user ? `${user.name || user.login} (${user.login}) pelo portal NOC` : "portal NOC");

/* ---------- Incidentes e alertas (Graph) ---------- */
const INCIDENT_STATUS = ["active", "inProgress", "resolved", "redirected"];
const CLASSIFICATION = ["unknown", "falsePositive", "truePositive", "informationalExpectedActivity"];
const DETERMINATION = [
  "unknown", "apt", "malware", "securityPersonnel", "securityTesting", "unwantedSoftware", "other", "multiStagedAttack",
  "compromisedAccount", "phishing", "maliciousUserActivity", "notMalicious", "notEnoughDataToValidate", "confirmedUserActivity", "lineOfBusinessApplication",
];

type Incident = {
  id: string;
  displayName: string;
  severity: string;
  status: string;
  classification?: string;
  determination?: string;
  assignedTo?: string | null;
  createdDateTime: string;
  lastUpdateDateTime: string;
  incidentWebUrl?: string;
  customTags?: string[];
  comments?: { comment: string; createdByDisplayName?: string; createdDateTime?: string }[];
  alerts?: Record<string, unknown>[];
};

export async function listIncidents(status = "open") {
  const filter = status === "all" ? "" : status === "open" ? "&$filter=status ne 'resolved'" : `&$filter=status eq '${INCIDENT_STATUS.includes(status) ? status : "active"}'`;
  const incidents = await graphAll<Incident>(`/security/incidents?$top=50${filter}`, 6);
  return {
    incidents: incidents
      .map(({ alerts: _alerts, ...incident }) => incident)
      .sort((a, b) => b.createdDateTime.localeCompare(a.createdDateTime)),
  };
}

export async function getIncident(id: string) {
  const incident = await graph<Incident>(`/security/incidents/${encodeURIComponent(id)}?$expand=alerts`);
  return {
    incident: {
      ...incident,
      alerts: (incident.alerts || []).map((alert) => ({
        id: alert.id,
        title: alert.title,
        severity: alert.severity,
        status: alert.status,
        category: alert.category,
        serviceSource: alert.serviceSource,
        description: alert.description,
        recommendedActions: alert.recommendedActions,
        createdDateTime: alert.createdDateTime,
        alertWebUrl: alert.alertWebUrl,
        evidence: ((alert.evidence as Record<string, unknown>[]) || []).map((evidence) => ({
          type: String(evidence["@odata.type"] || "").replace("#microsoft.graph.security.", "").replace(/Evidence$/, ""),
          verdict: evidence.verdict,
          remediation: evidence.remediationStatus,
          device: (evidence as { deviceDnsName?: string }).deviceDnsName,
          mdeDeviceId: (evidence as { mdeDeviceId?: string }).mdeDeviceId,
          user: (evidence as { userAccount?: { userPrincipalName?: string; accountName?: string } }).userAccount?.userPrincipalName
            || (evidence as { userAccount?: { accountName?: string } }).userAccount?.accountName,
          file: (evidence as { fileDetails?: { fileName?: string; filePath?: string } }).fileDetails?.fileName,
          ip: (evidence as { ipAddress?: string }).ipAddress,
          url: (evidence as { url?: string }).url,
          subject: (evidence as { subject?: string }).subject,
          sender: (evidence as { senderEmailAddress?: string }).senderEmailAddress,
          recipient: (evidence as { recipientEmailAddress?: string }).recipientEmailAddress,
        })),
      })),
    },
  };
}

function cleanUpdate(body: Record<string, unknown>) {
  const update: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!INCIDENT_STATUS.includes(String(body.status)) && !["new", "inProgress", "resolved"].includes(String(body.status))) throw new BadRequest("Status inválido.");
    update.status = body.status;
  }
  if (body.classification !== undefined) {
    if (!CLASSIFICATION.includes(String(body.classification))) throw new BadRequest("Classificação inválida.");
    update.classification = body.classification;
  }
  if (body.determination !== undefined) {
    if (!DETERMINATION.includes(String(body.determination))) throw new BadRequest("Determinação inválida.");
    update.determination = body.determination;
  }
  return update;
}

// assignTo: "me" (quem esta logado), "" (ninguem) ou um e-mail/UPN.
async function resolveAssignee(value: unknown, user?: AuthUser) {
  if (value === undefined) return undefined;
  if (value === "me") {
    const upn = await actorUpn(user);
    if (!upn) throw new BadRequest("Não achei seu usuário no Microsoft 365 para atribuir.");
    return upn;
  }
  const text = String(value || "").trim();
  if (text && !/^[^@\s]+@[^@\s]+$/.test(text)) throw new BadRequest("Responsável deve ser um e-mail.");
  return text;
}

export async function updateIncident(id: string, body: Record<string, unknown>, user?: AuthUser) {
  const update = cleanUpdate(body);
  const assignee = await resolveAssignee(body.assignTo, user);
  if (assignee !== undefined) update.assignedTo = assignee;
  if (!Object.keys(update).length && !body.comment) throw new BadRequest("Nada para alterar.");
  if (Object.keys(update).length) await graphWrite("PATCH", `/security/incidents/${encodeURIComponent(id)}`, update);
  if (body.comment || Object.keys(update).length) {
    const what = [update.status && `status ${update.status}`, update.classification && `classificação ${update.classification}`, update.determination && `determinação ${update.determination}`, assignee !== undefined && `responsável ${assignee || "ninguém"}`]
      .filter(Boolean)
      .join(", ");
    const comment = [String(body.comment || "").trim(), what ? `[${what}]` : ""].filter(Boolean).join(" ");
    await graphWrite("POST", `/security/incidents/${encodeURIComponent(id)}/comments`, { "@odata.type": "microsoft.graph.security.alertComment", comment: `${comment} — ${byWho(user)}` });
  }
  return getIncident(id);
}

export async function updateAlert(id: string, body: Record<string, unknown>, user?: AuthUser) {
  const update = cleanUpdate(body);
  const assignee = await resolveAssignee(body.assignTo, user);
  if (assignee !== undefined) update.assignedTo = assignee;
  if (Object.keys(update).length) await graphWrite("PATCH", `/security/alerts_v2/${encodeURIComponent(id)}`, update);
  if (body.comment) {
    await graphWrite("POST", `/security/alerts_v2/${encodeURIComponent(id)}/comments`, { "@odata.type": "microsoft.graph.security.alertComment", comment: `${String(body.comment).trim()} — ${byWho(user)}` });
  }
  return { ok: true };
}

/* ---------- Maquinas (Defender for Endpoint) ---------- */
async function mde<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${MDE_API}${path}`, {
    method,
    signal: AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${await msToken(MDE_SCOPE)}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = (text ? JSON.parse(text) : {}) as T & { error?: { message?: string } };
  if (!response.ok) {
    const message = payload.error?.message || `erro ${response.status}`;
    throw new Error(/Missing application roles|required roles/i.test(message)
      ? `Defender for Endpoint: falta a permissão ${message.match(/required roles: ([\w.]+)/)?.[1] || ""} no app (API WindowsDefenderATP).`
      : `Defender for Endpoint: ${message.slice(0, 200)}`);
  }
  return payload;
}

export async function listMachines() {
  const [machines, actions] = await Promise.all([
    mde<{ value: Record<string, unknown>[] }>("GET", "/machines?$top=1000"),
    mde<{ value: Record<string, unknown>[] }>("GET", "/machineactions?$top=100&$orderby=creationDateTimeUtc desc").catch(() => ({ value: [] })),
  ]);
  return {
    machines: machines.value.map((machine) => ({
      id: String(machine.id),
      name: String(machine.computerDnsName || "").split(".")[0],
      os: [machine.osPlatform, machine.version].filter(Boolean).join(" "),
      health: String(machine.healthStatus || ""),
      risk: String(machine.riskScore || ""),
      exposure: String(machine.exposureLevel || ""),
      av: String(machine.defenderAvStatus || ""),
      onboarding: String(machine.onboardingStatus || ""),
      lastSeen: String(machine.lastSeen || ""),
      ip: String(machine.lastIpAddress || ""),
      user: String((machine.loggedOnUsers as { accountName?: string }[] | undefined)?.[0]?.accountName || ""),
    })),
    actions: actions.value.map((action) => ({
      id: String(action.id),
      machineId: String(action.machineId),
      machine: String(action.computerDnsName || "").split(".")[0],
      type: String(action.type),
      status: String(action.status),
      requestor: String(action.requestor || ""),
      comment: String(action.requestorComment || ""),
      created: String(action.creationDateTimeUtc || ""),
    })),
  };
}

const MACHINE_ACTIONS: Record<string, { path: string; body: (comment: string, option: string) => Record<string, unknown> }> = {
  isolate: { path: "isolate", body: (comment, option) => ({ Comment: comment, IsolationType: option === "Selective" ? "Selective" : "Full" }) },
  unisolate: { path: "unisolate", body: (comment) => ({ Comment: comment }) },
  scan: { path: "runAntiVirusScan", body: (comment, option) => ({ Comment: comment, ScanType: option === "Full" ? "Full" : "Quick" }) },
  restrict: { path: "restrictCodeExecution", body: (comment) => ({ Comment: comment }) },
  unrestrict: { path: "unrestrictCodeExecution", body: (comment) => ({ Comment: comment }) },
  collect: { path: "collectInvestigationPackage", body: (comment) => ({ Comment: comment }) },
};

export async function machineAction(id: string, body: Record<string, unknown>, user?: AuthUser) {
  const action = MACHINE_ACTIONS[String(body.action)];
  if (!action) throw new BadRequest("Ação inválida.");
  const reason = String(body.comment || "").trim();
  if (reason.length < 5) throw new BadRequest("Escreva o motivo (aparece no Defender).");
  const result = await mde<Record<string, unknown>>("POST", `/machines/${encodeURIComponent(id)}/${action.path}`, action.body(`${reason} — ${byWho(user)}`, String(body.option || "")));
  return { ok: true, actionId: result.id, status: result.status };
}

/* ---------- Quarentena de e-mail (Exchange Online) ---------- */
// O Exchange Online nao expoe a quarentena no Graph; os cmdlets rodam pelo mesmo endpoint REST que o
// modulo ExchangeOnlineManagement usa (InvokeCommand), com token de aplicativo.
let orgDomain = "";
async function exoOrganization() {
  if (orgDomain) return orgDomain;
  const org = await graph<{ value: { verifiedDomains: { name: string; isInitial: boolean }[] }[] }>("/organization?$select=verifiedDomains");
  orgDomain = org.value[0]?.verifiedDomains.find((domain) => domain.isInitial)?.name || "";
  if (!orgDomain) throw new Error("Não achei o domínio inicial (onmicrosoft.com) do tenant.");
  return orgDomain;
}

// node:https em vez de fetch: quando o Exchange recusa (403 com corpo vazio), o fetch do Node ficava
// esperando para sempre e a tela travava.
function httpsPost(url: string, headers: Record<string, string>, body: string, timeoutMs: number) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const request = https.request(url, { method: "POST", timeout: timeoutMs, headers: { ...headers, "Content-Length": Buffer.byteLength(body) } }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode || 0, text: Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim() }));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("Exchange Online demorou demais para responder.")));
    request.on("error", reject);
    request.end(body);
  });
}

async function exo<T = Record<string, unknown>[]>(cmdlet: string, parameters: Record<string, unknown>): Promise<T> {
  const organization = await exoOrganization();
  const response = await httpsPost(
    `https://outlook.office365.com/adminapi/beta/${encodeURIComponent(intuneConfig.tenantId!)}/InvokeCommand`,
    {
      Authorization: `Bearer ${await msToken(EXO_SCOPE)}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-ResponseFormat": "json",
      "X-AnchorMailbox": `UPN:SystemMailbox{bb558c35-97f1-4cb9-8ff7-d53741dc928c}@${organization}`,
    },
    JSON.stringify({ CmdletInput: { CmdletName: cmdlet, Parameters: parameters } }),
    60000,
  );
  let payload: { value?: T; error?: { message?: string; details?: { message?: string }[] } } = {};
  try {
    payload = response.text ? JSON.parse(response.text) : {};
  } catch {
    payload = {};
  }
  if (response.status < 200 || response.status >= 300) {
    const message = payload.error?.details?.[0]?.message || payload.error?.message || "";
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Exchange Online recusou o acesso do app (${response.status}${message ? `: ${message.slice(0, 160)}` : ""}). Falta o app ter a função "Administrador de Segurança" no Entra ID (pode levar até 1 h para valer depois de atribuída).`);
    }
    throw new Error(`Exchange Online: ${message.slice(0, 200) || `erro ${response.status}`}`);
  }
  return (payload.value ?? ([] as unknown)) as T;
}

const QUARANTINE_TYPES = ["Spam", "HighConfSpam", "Phish", "HighConfPhish", "Malware", "Bulk", "SPOOF", "TransportRule", "FileTypeBlock"];

export async function listQuarantine(query: Record<string, unknown>) {
  const days = Math.min(30, Math.max(1, Number(query.days) || 7));
  const parameters: Record<string, unknown> = {
    StartReceivedDate: new Date(Date.now() - days * 864e5).toISOString(),
    EndReceivedDate: new Date().toISOString(),
    PageSize: 500,
    Page: 1,
  };
  if (QUARANTINE_TYPES.includes(String(query.type))) parameters.QuarantineTypes = [String(query.type)];
  if (query.released === "false") parameters.ReleaseStatus = ["NotReleased"];
  const recipient = String(query.recipient || "").trim();
  if (recipient) parameters.RecipientAddress = [recipient];
  const rows = await exo<Record<string, unknown>[]>("Get-QuarantineMessage", parameters);
  return { messages: rows.map(toQuarantineMessage) };
}

const asList = (value: unknown) => (Array.isArray(value) ? value.map(String) : value ? [String(value)] : []);

function toQuarantineMessage(row: Record<string, unknown>) {
  return {
    identity: String(row.Identity || ""),
    received: String(row.ReceivedTime || ""),
    sender: String(row.SenderAddress || ""),
    recipients: asList(row.RecipientAddress),
    subject: String(row.Subject || ""),
    type: String(row.QuarantineTypes || row.Type || ""),
    policy: String(row.PolicyName || ""),
    policyType: String(row.PolicyType || ""),
    released: String(row.ReleaseStatus || ""),
    releasedTo: asList(row.ReleasedUser),
    size: Number(row.Size || 0),
    expires: String(row.Expires || ""),
    direction: String(row.Direction || ""),
    messageId: String(row.MessageId || ""),
  };
}

function checkIdentity(identity: string) {
  if (!/^[\w-]+\\[\w-]+$/.test(identity)) throw new BadRequest("Mensagem inválida.");
  return identity;
}

export async function quarantineHeader(identity: string) {
  const result = await exo<{ Header?: string }[]>("Get-QuarantineMessageHeader", { Identity: checkIdentity(identity) });
  return { header: String(result[0]?.Header || "") };
}

// Resumo do cabecalho para quem nao le cabecalho: autenticacao (SPF/DKIM/DMARC), remetente real,
// para onde vao as respostas e o servidor/IP de origem.
function headerSummary(header: string) {
  // Junta as linhas dobradas do cabecalho (continuacao comeca com espaco).
  const unfolded = header.replace(/\r?\n[ \t]+/g, " ");
  const field = (name: string) => unfolded.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim() || "";
  const auth = field("Authentication-Results");
  const verdict = (name: string) => auth.match(new RegExp(`${name}=(\\w+)`, "i"))?.[1]?.toLowerCase() || "";
  const received = [...unfolded.matchAll(/^Received:\s*from\s+(\S+)\s*\(([^)]*)\)/gim)].map((match) => ({ host: match[1], detail: match[2] }));
  // O ultimo "Received" de fora da Microsoft e o servidor que entregou para o Exchange Online.
  const external = received.reverse().find((hop) => !/outlook\.com|microsoft\.com|office365\.com|protection\.outlook/i.test(hop.host));
  return {
    from: field("From"),
    replyTo: field("Reply-To"),
    returnPath: field("Return-Path"),
    to: field("To"),
    date: field("Date"),
    spf: verdict("spf"),
    dkim: verdict("dkim"),
    dmarc: verdict("dmarc"),
    compauth: verdict("compauth"),
    originHost: external?.host || "",
    originIp: external?.detail.match(/\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]{6,}/i)?.[0] || field("X-Originating-IP").replace(/[[\]]/g, ""),
    spamVerdict: field("X-Forefront-Antispam-Report").match(/SFV:(\w+)/)?.[1] || "",
    spamScore: field("X-Forefront-Antispam-Report").match(/SCL:(-?\d+)/)?.[1] || "",
  };
}

// Tudo de um e-mail para a tela: dados, resumo do cabecalho, cabecalho bruto e a previa do conteudo.
// A previa vem do Exchange (Preview-QuarantineMessage); a tela mostra so texto, sem carregar nada externo.
export async function quarantineDetail(identity: string) {
  checkIdentity(identity);
  const [message, header, preview] = await Promise.all([
    exo<Record<string, unknown>[]>("Get-QuarantineMessage", { Identity: identity }).then((rows) => (rows[0] ? toQuarantineMessage(rows[0]) : null)),
    exo<{ Header?: string }[]>("Get-QuarantineMessageHeader", { Identity: identity }).then((rows) => String(rows[0]?.Header || "")).catch(() => ""),
    exo<Record<string, unknown>[]>("Preview-QuarantineMessage", { Identity: identity })
      .then((rows) => rows[0] || null)
      .catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }) as Record<string, unknown>),
  ]);
  if (!message) throw new BadRequest("E-mail não encontrado na quarentena (pode ter expirado ou sido excluído).");
  const attachments = (preview?.Attachment || preview?.Attachments || []) as unknown;
  return {
    message,
    summary: header ? headerSummary(header) : null,
    header,
    preview: preview
      ? {
          error: String(preview.error || ""),
          body: String(preview.Body || ""),
          isHtml: Boolean(preview.IsHtml ?? /<\w+[^>]*>/.test(String(preview.Body || ""))),
          cc: asList(preview.Cc),
          attachments: (Array.isArray(attachments) ? attachments : [attachments])
            .filter(Boolean)
            .map((item) => (typeof item === "object" && item ? String((item as { FileName?: string; Name?: string }).FileName || (item as { Name?: string }).Name || "") : String(item)))
            .filter(Boolean),
        }
      : null,
  };
}

export async function quarantineAction(body: Record<string, unknown>, user?: AuthUser) {
  const identities = (Array.isArray(body.identities) ? body.identities : [])
    .map(String)
    .filter((identity) => /^[\w-]+\\[\w-]+$/.test(identity))
    .slice(0, 50);
  if (!identities.length) throw new BadRequest("Selecione ao menos uma mensagem.");
  const action = String(body.action);
  const results: { identity: string; ok: boolean; error?: string }[] = [];
  for (const identity of identities) {
    try {
      if (action === "release") {
        // Libera para todos os destinatarios; opcional: avisar a Microsoft que foi falso positivo.
        await exo("Release-QuarantineMessage", { Identity: identity, ReleaseToAll: true, ReportFalsePositive: body.reportFalsePositive === true });
      } else if (action === "delete") {
        await exo("Delete-QuarantineMessage", { Identity: identity });
      } else {
        throw new BadRequest("Ação inválida.");
      }
      results.push({ identity, ok: true });
    } catch (error) {
      if (error instanceof BadRequest) throw error;
      results.push({ identity, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { ok: results.every((result) => result.ok), results, by: byWho(user) };
}
