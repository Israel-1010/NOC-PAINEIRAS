// Windows 10 no Intune: quem ainda esta no 10, se da para ir ao 11 e o agendamento da atualizacao.
// O Intune nao tem acao "atualizar para o 11" por maquina: a politica "Feature updates" (Windows 11) e
// atribuida a um grupo do Entra, e o NOC poe/tira a maquina desse grupo; o Windows Update faz o resto
// (oferta, download, instalacao e reinicio conforme o anel de atualizacao).
// Permissoes de APLICATIVO no Graph (app do portal):
//   - DeviceManagementManagedDevices.Read.All: maquinas e prontidao do Windows 11 (Endpoint analytics);
//   - DeviceManagementConfiguration.Read.All: politica de feature update e a quem ela esta atribuida;
//   - GroupMember.ReadWrite.All: ver e mudar os membros do grupo da politica;
//   - DeviceManagementManagedDevices.PrivilegedOperations.All: sincronizar a maquina.
// Opcional: INTUNE_WIN11_PROFILE_ID (qual politica usar) e INTUNE_WIN11_EXCLUDE (nomes que nunca entram,
// separados por virgula; ex.: TOTEM,CATRACA,CAIXA).

import type { AuthUser } from "./auth";
import { isPortalAdmin } from "./accessStore";
import { intuneConfig } from "./config";
import { msRoles, msToken } from "./defenderClient";
import { writeAudit } from "./security";

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const GRAPH = "https://graph.microsoft.com";

async function request<T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const url = path.startsWith("https://") ? path : `${GRAPH}/${path.startsWith("/beta") ? path.slice(1) : `v1.0${path}`}`;
  const response = await fetch(url, {
    method,
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${await msToken()}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const message = (payload.error as { message?: string } | undefined)?.message || `erro ${response.status}`;
    throw new HttpError(`Microsoft Graph: ${message}`, response.status);
  }
  return payload as T;
}

// Segue o @odata.nextLink (o Graph pagina listas grandes).
async function requestAll<T>(path: string, pages = 15): Promise<T[]> {
  const items: T[] = [];
  let next = path;
  for (let page = 0; next && page < pages; page++) {
    const result = await request<{ value?: T[]; "@odata.nextLink"?: string }>("GET", next);
    items.push(...(result.value || []));
    next = result["@odata.nextLink"] || "";
  }
  return items;
}

/* ---------- Versao do Windows pelo build (o Graph devolve 10.0.x tambem para o Windows 11) ---------- */

const RELEASES: Record<number, string> = {
  19041: "2004",
  19042: "20H2",
  19043: "21H1",
  19044: "21H2",
  19045: "22H2",
  22000: "21H2",
  22621: "22H2",
  22631: "23H2",
  26100: "24H2",
  26200: "25H2",
};

export function windowsInfo(osVersion: string) {
  const [, , buildText = "0", ubr = ""] = String(osVersion || "").split(".");
  const build = Number(buildText) || 0;
  // Abaixo de 19041 sao Windows Server 2016/2019 (ou LTSC antigo): ficam fora desta atualizacao.
  const family = !build ? "unknown" : build >= 22000 ? "win11" : build >= 19041 ? "win10" : "server";
  const release = RELEASES[build] || "";
  const label =
    family === "win11"
      ? `Windows 11 ${release || `(build ${build})`}`
      : family === "win10"
        ? `Windows 10 ${release || `(build ${build})`}`
        : family === "server"
          ? build === 14393
            ? "Windows Server 2016"
            : build === 17763
              ? "Windows Server 2019 / LTSC 2019"
              : `Windows antigo (build ${build})`
          : "Windows";
  return { family, build, ubr, release, label };
}

/* ---------- Leitura ---------- */

type ManagedDevice = {
  id: string;
  deviceName: string;
  osVersion: string;
  model: string;
  manufacturer: string;
  userDisplayName: string;
  lastSyncDateTime: string;
  azureADDeviceId: string;
  freeStorageSpaceInBytes?: number;
};
type ReadinessRow = { deviceName?: string; upgradeEligibility?: string } & Record<string, unknown>;

const READINESS_CHECKS: Record<string, string> = {
  tpmCheckFailed: "TPM 2.0",
  secureBootCheckFailed: "Secure Boot",
  processorFamilyCheckFailed: "processador",
  processor64BitCheckFailed: "processador 64 bits",
  processorSpeedCheckFailed: "velocidade do processador",
  processorCoreCountCheckFailed: "núcleos do processador",
  ramCheckFailed: "memória",
  storageCheckFailed: "disco",
};

export type WindowsItem = {
  id: string;
  deviceName: string;
  user: string;
  model: string;
  label: string;
  family: string;
  build: number;
  lastSync: string;
  readiness: { status: "capable" | "notCapable" | "unknown"; failed: string[] };
  inGroup: boolean | null;
  blocked: string;
};

type Target = { profileId: string; profileName: string; version: string; groupId: string; groupName: string; dynamic: boolean; excludeGroupIds: string[] };

// fresh: token novo, para enxergar permissao recem-concedida sem reiniciar o portal.
export async function windowsCapabilities(fresh = false) {
  const roles = await msRoles(undefined, fresh);
  const groupWrite = roles.some((role) => role === "GroupMember.ReadWrite.All" || role === "Group.ReadWrite.All");
  const sync = roles.includes("DeviceManagementManagedDevices.PrivilegedOperations.All");
  const missing = [
    !roles.some((role) => /^DeviceManagementManagedDevices\.Read(Write)?\.All$/.test(role)) ? "DeviceManagementManagedDevices.Read.All" : "",
    !roles.some((role) => /^DeviceManagementConfiguration\.Read(Write)?\.All$/.test(role)) ? "DeviceManagementConfiguration.Read.All" : "",
    groupWrite ? "" : "GroupMember.ReadWrite.All",
    sync ? "" : "DeviceManagementManagedDevices.PrivilegedOperations.All",
  ].filter(Boolean);
  return { groupWrite, sync, missing };
}

async function findTarget(warnings: string[]): Promise<Target | null> {
  const profiles = await requestAll<{ id: string; displayName: string; featureUpdateVersion: string }>(
    "/beta/deviceManagement/windowsFeatureUpdateProfiles?$select=id,displayName,featureUpdateVersion",
  );
  const wanted = process.env.INTUNE_WIN11_PROFILE_ID;
  const profile = wanted ? profiles.find((entry) => entry.id === wanted) : profiles.find((entry) => /windows 11/i.test(entry.featureUpdateVersion));
  if (!profile) {
    warnings.push("Nenhuma política de atualização para o Windows 11 no Intune (Dispositivos → Atualizações do Windows → Atualizações de recursos).");
    return null;
  }
  const assignments = await requestAll<{ target?: { "@odata.type"?: string; groupId?: string } }>(`/beta/deviceManagement/windowsFeatureUpdateProfiles/${profile.id}/assignments`);
  const include = assignments.find((entry) => entry.target?.["@odata.type"] === "#microsoft.graph.groupAssignmentTarget" && entry.target.groupId);
  const excludeGroupIds = assignments
    .filter((entry) => entry.target?.["@odata.type"] === "#microsoft.graph.exclusionGroupAssignmentTarget" && entry.target.groupId)
    .map((entry) => entry.target!.groupId!);
  if (!include?.target?.groupId) {
    warnings.push(`A política "${profile.displayName}" não está atribuída a nenhum grupo.`);
    return { profileId: profile.id, profileName: profile.displayName, version: profile.featureUpdateVersion, groupId: "", groupName: "", dynamic: false, excludeGroupIds };
  }
  const groupId = include.target.groupId;
  let groupName = "";
  let dynamic = false;
  try {
    const group = await request<{ displayName?: string; membershipRule?: string | null; onPremisesSyncEnabled?: boolean | null }>("GET", `/groups/${groupId}?$select=displayName,membershipRule,onPremisesSyncEnabled`);
    groupName = group.displayName || "";
    // Grupo dinamico ou vindo do AD nao aceita membro posto pela API.
    dynamic = Boolean(group.membershipRule) || Boolean(group.onPremisesSyncEnabled);
    if (dynamic) warnings.push(`O grupo "${groupName}" é dinâmico ou vem do AD: o NOC não consegue pôr máquinas nele.`);
  } catch {
    /* sem permissao para ler o grupo: o nome fica em branco */
  }
  return { profileId: profile.id, profileName: profile.displayName, version: profile.featureUpdateVersion, groupId, groupName, dynamic, excludeGroupIds };
}

// deviceId do Entra (= azureADDeviceId do Intune) de quem esta no grupo; null se o app nao pode ler.
async function groupDeviceIds(groupId: string) {
  const members = await requestAll<{ deviceId?: string }>(`/groups/${groupId}/members/microsoft.graph.device?$select=deviceId&$top=999`);
  return new Set(members.map((member) => String(member.deviceId || "").toLowerCase()).filter(Boolean));
}

const excludedNames = () =>
  String(process.env.INTUNE_WIN11_EXCLUDE || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const daysSince = (iso: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : 999);

async function load(fresh = false) {
  const warnings: string[] = [];
  // Primeiro as permissoes (com "fresh", troca o token guardado antes das outras leituras).
  const capabilities = await windowsCapabilities(fresh);
  const devices = await requestAll<ManagedDevice>(
    "/deviceManagement/managedDevices?$filter=operatingSystem eq 'Windows'&$select=id,deviceName,osVersion,model,manufacturer,userDisplayName,lastSyncDateTime,azureADDeviceId,freeStorageSpaceInBytes&$top=500",
  );

  // Prontidao para o Windows 11 (Endpoint analytics); se falhar, a lista continua sem ela.
  const readiness = new Map<string, ReadinessRow>();
  try {
    const rows = await requestAll<ReadinessRow>("/beta/deviceManagement/userExperienceAnalyticsWorkFromAnywhereMetrics('allDevices')/metricDevices?$top=999");
    for (const row of rows) readiness.set(String(row.deviceName || "").toLowerCase(), row);
  } catch (error) {
    warnings.push(`Prontidão para o Windows 11 indisponível: ${error instanceof Error ? error.message : error}`);
  }

  let target: Target | null = null;
  try {
    target = await findTarget(warnings);
  } catch (error) {
    warnings.push(`Não consegui ler a política de atualização: ${error instanceof Error ? error.message : error}`);
  }

  let members: Set<string> | null = null;
  const excludedIds = new Set<string>();
  if (target?.groupId) {
    try {
      members = await groupDeviceIds(target.groupId);
      for (const groupId of target.excludeGroupIds) for (const id of await groupDeviceIds(groupId)) excludedIds.add(id);
    } catch {
      warnings.push(`Para ver quem já está no grupo "${target.groupName || target.groupId}", o app precisa da permissão GroupMember.ReadWrite.All.`);
      members = null;
    }
  }

  const excluded = excludedNames();
  const items: WindowsItem[] = [];
  const totals = { win10: 0, win11: 0, server: 0, capable: 0, notCapable: 0, unknown: 0, inGroup: 0 };
  for (const device of devices) {
    const info = windowsInfo(device.osVersion);
    if (info.family === "win11") totals.win11++;
    if (info.family !== "win10" && info.family !== "server") continue;
    if (info.family === "server") totals.server++;
    else totals.win10++;
    const row = readiness.get(device.deviceName.toLowerCase());
    const status = row?.upgradeEligibility === "capable" ? "capable" : row?.upgradeEligibility === "notCapable" ? "notCapable" : "unknown";
    const failed = row ? Object.keys(READINESS_CHECKS).filter((key) => row[key] === true).map((key) => READINESS_CHECKS[key]) : [];
    const entraId = String(device.azureADDeviceId || "").toLowerCase();
    const inGroup = members ? members.has(entraId) : null;
    if (info.family === "win10") {
      if (status === "capable") totals.capable++;
      else if (status === "notCapable") totals.notCapable++;
      else totals.unknown++;
      if (inGroup) totals.inGroup++;
    }
    // Motivo para o NOC nao agendar (o servidor confere de novo na hora da acao).
    const blocked =
      info.family === "server"
        ? "servidor ou LTSC: fora desta atualização"
        : excluded.some((name) => device.deviceName.toLowerCase().includes(name)) || excludedIds.has(entraId)
          ? "na lista de exceções (não recebe esta atualização)"
          : status === "notCapable"
            ? `hardware incompatível com o Windows 11${failed.length ? ` (${failed.join(", ")})` : ""}`
            : status === "unknown"
              ? "sem relatório de compatibilidade no Intune"
              : !entraId || /^0{8}/.test(entraId)
                ? "máquina sem registro no Entra ID"
                : daysSince(device.lastSyncDateTime) > 7
                  ? `sem sincronizar com o Intune há ${daysSince(device.lastSyncDateTime)} dias`
                  : "";
    items.push({
      id: device.id,
      deviceName: device.deviceName,
      user: device.userDisplayName || "",
      model: [device.manufacturer, device.model].filter(Boolean).join(" "),
      label: info.label,
      family: info.family,
      build: info.build,
      lastSync: device.lastSyncDateTime,
      readiness: { status, failed },
      inGroup,
      blocked,
    });
  }
  items.sort((a, b) => Number(a.family === "server") - Number(b.family === "server") || a.deviceName.localeCompare(b.deviceName, "pt-BR", { numeric: true }));
  return {
    checkedAt: new Date().toISOString(),
    target: target ? { profileName: target.profileName, version: target.version, groupName: target.groupName, groupId: target.groupId, dynamic: target.dynamic } : null,
    totals,
    items,
    warnings,
    capabilities,
  };
}

// Cache de 10 min (a lista e a prontidao mudam devagar); "refresh" forca nova leitura.
let cache: { at: number; value: Promise<Awaited<ReturnType<typeof load>>> } | null = null;

export function getWindowsOverview(refresh = false) {
  if (!intuneConfig.tenantId || !intuneConfig.clientId || !intuneConfig.clientSecret) {
    throw new HttpError("Intune não configurado no servidor (INTUNE_* ou SHAREPOINT_*).", 503);
  }
  if (!refresh && cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.value;
  const value = load(refresh);
  cache = { at: Date.now(), value };
  value.catch(() => {
    cache = null;
  });
  return value;
}

/* ---------- Acoes (so gestor do portal) ---------- */

function requireManager(user?: AuthUser) {
  if (!user || !isPortalAdmin(user.login)) throw new HttpError("Somente o gestor do portal pode agendar ou cancelar a atualização do Windows.", 403);
}

async function entraObjectId(item: WindowsItem, devices: ManagedDevice[]) {
  const device = devices.find((entry) => entry.id === item.id);
  const deviceId = String(device?.azureADDeviceId || "");
  if (!deviceId) throw new HttpError(`${item.deviceName} não tem registro no Entra ID.`, 404);
  const found = await request<{ value?: { id: string }[] }>("GET", `/devices?$filter=deviceId eq '${deviceId.replace(/'/g, "''")}'&$select=id`);
  const objectId = found.value?.[0]?.id;
  if (!objectId) throw new HttpError(`${item.deviceName} não foi encontrada no Entra ID.`, 404);
  return objectId;
}

async function freshContext(id: string) {
  const overview = await getWindowsOverview(true);
  const item = overview.items.find((entry) => entry.id === id);
  if (!item) throw new HttpError("Máquina não encontrada entre as Windows 10 do Intune.", 404);
  if (!overview.target?.groupId) throw new HttpError("Não há política de atualização para o Windows 11 atribuída a um grupo no Intune.", 503);
  if (overview.target.dynamic) throw new HttpError(`O grupo "${overview.target.groupName}" é dinâmico ou vem do AD: o NOC não consegue mudar os membros dele.`, 503);
  if (!overview.capabilities.groupWrite) throw new HttpError("Falta a permissão GroupMember.ReadWrite.All no app do portal (Entra ID → Registros de aplicativo → Permissões de API).", 403);
  const devices = await requestAll<ManagedDevice>(`/deviceManagement/managedDevices?$filter=id eq '${id.replace(/'/g, "''")}'&$select=id,azureADDeviceId`);
  return { overview, item, devices, groupId: overview.target.groupId, groupName: overview.target.groupName };
}

function checkReason(body: Record<string, unknown>, item: WindowsItem) {
  const comment = String(body.comment || "").trim();
  if (comment.length < 5) throw new HttpError("Informe o motivo (mínimo 5 caracteres).", 400);
  if (String(body.confirmName || "").trim().toLowerCase() !== item.deviceName.toLowerCase()) throw new HttpError(`Digite o nome da máquina (${item.deviceName}) para confirmar.`, 400);
  return comment.slice(0, 500);
}

async function requestSync(id: string) {
  try {
    await request("POST", `/deviceManagement/managedDevices/${encodeURIComponent(id)}/syncDevice`);
    return true;
  } catch {
    return false;
  }
}

export async function scheduleWindows11(id: string, body: Record<string, unknown>, user?: AuthUser) {
  requireManager(user);
  const { overview, item, devices, groupId, groupName } = await freshContext(id);
  const comment = checkReason(body, item);
  if (item.blocked) throw new HttpError(`${item.deviceName}: ${item.blocked}.`, 422);
  if (item.inGroup) throw new HttpError(`${item.deviceName} já está na atualização para o Windows 11.`, 409);
  const objectId = await entraObjectId(item, devices);
  try {
    await request("POST", `/groups/${groupId}/members/$ref`, { "@odata.id": `${GRAPH}/v1.0/directoryObjects/${objectId}` });
  } catch (error) {
    if (!(error instanceof HttpError && error.status === 400 && /already exist/i.test(error.message))) throw error;
  }
  const synced = overview.capabilities.sync ? await requestSync(id) : false;
  writeAudit({ event: "win11-agendado", user: user?.login, device: item.deviceName, deviceId: id, group: groupName || groupId, comment, synced });
  cache = null;
  return {
    ok: true,
    message: `${item.deviceName} entrou na atualização para o ${overview.target?.version || "Windows 11"}. O Windows Update oferece nas próximas horas; a instalação reinicia a máquina conforme o anel de atualização.${synced ? " Sincronização pedida." : ""}`,
  };
}

export async function cancelWindows11(id: string, body: Record<string, unknown>, user?: AuthUser) {
  requireManager(user);
  const { item, devices, groupId, groupName } = await freshContext(id);
  const comment = checkReason(body, item);
  if (item.inGroup === false) throw new HttpError(`${item.deviceName} não está na atualização.`, 409);
  const objectId = await entraObjectId(item, devices);
  await request("DELETE", `/groups/${groupId}/members/${objectId}/$ref`);
  writeAudit({ event: "win11-cancelado", user: user?.login, device: item.deviceName, deviceId: id, group: groupName || groupId, comment });
  cache = null;
  return { ok: true, message: `${item.deviceName} saiu da atualização. Se a instalação já tiver começado, ela pode terminar mesmo assim.` };
}

export async function syncWindowsDevice(id: string, user?: AuthUser) {
  requireManager(user);
  const capabilities = await windowsCapabilities();
  if (!capabilities.sync) throw new HttpError("Falta a permissão DeviceManagementManagedDevices.PrivilegedOperations.All no app do portal.", 403);
  if (!(await requestSync(id))) throw new HttpError("O Intune recusou o pedido de sincronização.", 502);
  writeAudit({ event: "intune-sync", user: user?.login, deviceId: id });
  return { ok: true, message: "Sincronização pedida: a máquina procura políticas e atualizações na próxima vez que estiver ligada e online." };
}
