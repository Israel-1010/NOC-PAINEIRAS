import { zbx } from "./zabbixClient";

// Cadastro de dispositivos monitorados por ping, direto no Zabbix (o Zabbix e quem pinga,
// gera os alertas e manda o WhatsApp). Cada dispositivo e um host com o template "ICMP Ping".
// Dispositivos que formam um conjunto (ex.: Catraca 1 = 2 controladoras + 2 faciais) levam as
// tags "conjunto" e "funcao" no host.
// Seguranca: so altera/remove hosts que tem APENAS o template de ping (nunca links, firewall,
// servidores com outros templates). Exige usuario do Zabbix com permissao de escrita.

const PING_TEMPLATE = "ICMP Ping";
const SET_TAG = "conjunto";
const ROLE_TAG = "funcao";

// Erro de uso (dado invalido, sem permissao): volta 400/403 em vez de 500.
class DeviceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

// Grupos oferecidos no cadastro (mesmas secoes do Painel NOC; CFTV e antenas ficam de fora).
const OFFERED_GROUPS = /switch|servidor|server|mini|videowall|links|impressora|printer|catraca|totem|rede|network/i;
// Tipos padrao: aparecem mesmo que o grupo ainda nao exista no Zabbix (criado no primeiro cadastro).
const STANDARD_TYPES = ["Catracas", "Totens", "Impressoras"];
const NEW_GROUP_PREFIX = "novo:";
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

type ZbxHost = {
  hostid: string;
  host: string;
  name: string;
  status: string;
  interfaces: { interfaceid: string; ip: string; main: string; type: string }[];
  hostgroups: { groupid: string; name: string }[];
  parentTemplates: { templateid: string; name: string }[];
  tags?: { tag: string; value: string }[];
};

export type Device = {
  id: string;
  name: string;
  ip: string;
  groupId: string;
  group: string;
  set: string;
  role: string;
  enabled: boolean;
  editable: boolean;
  removable: boolean;
  up: boolean | null;
  latencyMs: number | null;
};

function friendlyError(error: unknown): never {
  if (error instanceof DeviceError) throw error;
  const message = error instanceof Error ? error.message : String(error);
  if (/no permissions|permission|not authorised|not authorized/i.test(message)) {
    throw new DeviceError("O usuário do Zabbix configurado no portal não tem permissão de escrita. Use um usuário com acesso de edição aos grupos de hosts.", 403);
  }
  if (/already exists/i.test(message)) throw new DeviceError("Já existe um dispositivo com esse nome no Zabbix.");
  throw new DeviceError(message.replace(/^Zabbix:\s*/, ""), 502);
}

async function pingTemplateId() {
  const [template] = await zbx<{ templateid: string }[]>("template.get", { filter: { host: [PING_TEMPLATE] }, output: ["templateid"] });
  if (!template) throw new DeviceError(`Template "${PING_TEMPLATE}" não encontrado no Zabbix.`);
  return template.templateid;
}

async function offeredGroups() {
  const groups = await zbx<{ groupid: string; name: string; hosts: string }[]>("hostgroup.get", { output: ["groupid", "name"], selectHosts: "count" });
  const offered = groups
    // Fora: cameras/antenas, grupos padrao do Zabbix e grupos vazios que nao sao secao do painel (ex.: "Network" da UniFi).
    .filter((group) => OFFERED_GROUPS.test(group.name) && !/cftv|camera|antena/i.test(group.name) && !/^(zabbix servers|linux servers)$/i.test(group.name))
    .filter((group) => Number(group.hosts) > 0 || /switch|servidor|mini|videowall|^links$|catraca|totem|impressora/i.test(group.name))
    .map(({ groupid, name }) => ({ groupid, name }));
  // Tipos padrao que ainda nao existem: oferecidos como "novo:<nome>".
  for (const type of STANDARD_TYPES) {
    if (!groups.some((group) => group.name.toLowerCase() === type.toLowerCase())) offered.push({ groupid: `${NEW_GROUP_PREFIX}${type}`, name: type });
  }
  return offered.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

// Cria o grupo de um tipo padrao na primeira vez que ele e usado.
async function resolveGroupId(groupId: string) {
  if (!groupId.startsWith(NEW_GROUP_PREFIX)) return groupId;
  const name = groupId.slice(NEW_GROUP_PREFIX.length);
  if (!STANDARD_TYPES.includes(name)) throw new DeviceError("Tipo de dispositivo inválido.");
  const [existing] = await zbx<{ groupid: string }[]>("hostgroup.get", { filter: { name: [name] }, output: ["groupid"] });
  if (existing) return existing.groupid;
  const created = await zbx<{ groupids: string[] }>("hostgroup.create", { name });
  return created.groupids[0];
}

const isPingOnly = (host: ZbxHost) => host.parentTemplates.length === 1 && host.parentTemplates[0].name === PING_TEMPLATE;
// Hosts dos links de internet dao latencia/estado aos links do painel: podem ser editados, nao removidos.
const isLinkHost = (host: ZbxHost) => host.hostgroups.some((group) => /link/i.test(group.name));
const tagValue = (host: ZbxHost, tag: string) => host.tags?.find((entry) => entry.tag === tag)?.value || "";

export async function listDevices() {
  const groups = await offeredGroups();
  const realIds = groups.map((group) => group.groupid).filter((id) => !id.startsWith(NEW_GROUP_PREFIX));
  if (!realIds.length) return { groups, devices: [] as Device[] };
  const hosts = await zbx<ZbxHost[]>("host.get", {
    groupids: realIds,
    output: ["hostid", "host", "name", "status"],
    selectInterfaces: ["interfaceid", "ip", "main", "type"],
    selectHostGroups: ["groupid", "name"],
    selectParentTemplates: ["templateid", "name"],
    selectTags: ["tag", "value"],
  });
  const pings = await zbx<{ hostid: string; key_: string; lastvalue: string }[]>("item.get", {
    hostids: hosts.map((host) => host.hostid),
    filter: { key_: ["icmpping", "icmppingsec"] },
    output: ["hostid", "key_", "lastvalue"],
  });
  const devices: Device[] = hosts.map((host) => {
    const group = host.hostgroups.find((entry) => groups.some((offered) => offered.groupid === entry.groupid)) || host.hostgroups[0];
    const ping = pings.find((item) => item.hostid === host.hostid && item.key_ === "icmpping");
    const sec = pings.find((item) => item.hostid === host.hostid && item.key_ === "icmppingsec");
    return {
      id: host.hostid,
      name: host.name,
      ip: host.interfaces.find((entry) => entry.main === "1")?.ip || host.interfaces[0]?.ip || "",
      groupId: group?.groupid || "",
      group: group?.name || "",
      set: tagValue(host, SET_TAG),
      role: tagValue(host, ROLE_TAG),
      enabled: host.status === "0",
      editable: isPingOnly(host),
      removable: isPingOnly(host) && !isLinkHost(host),
      up: !ping || host.status !== "0" ? null : ping.lastvalue === "1",
      latencyMs: sec?.lastvalue ? Math.round(Number(sec.lastvalue) * 10000) / 10 : null,
    };
  });
  devices.sort((a, b) => a.group.localeCompare(b.group, "pt-BR") || a.set.localeCompare(b.set, "pt-BR", { numeric: true }) || a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  return { groups, devices };
}

const clean = (value: unknown, max: number) => String(value || "").trim().replace(/\s+/g, " ").slice(0, max);

function validate(input: Record<string, unknown>, groups: { groupid: string }[]) {
  const set = clean(input.set, 60);
  const role = clean(input.role, 40);
  // Sem nome, mas com conjunto e funcao: "Catraca 1 - Facial".
  const name = clean(input.name, 120) || (set && role ? `${set} - ${role}` : "");
  const ip = String(input.ip || "").trim();
  const groupId = String(input.groupId || "");
  if (!name || name.length > 80) throw new DeviceError("Informe o nome do dispositivo (até 80 caracteres), ou o conjunto e a função.");
  if (!IPV4.test(ip)) throw new DeviceError("IP inválido. Exemplo: 10.0.1.50");
  if (!groups.some((group) => group.groupid === groupId)) throw new DeviceError("Escolha o tipo (grupo) do dispositivo.");
  return { name, ip, groupId, set, role };
}

const tagsFor = (set: string, role: string) => [
  ...(set ? [{ tag: SET_TAG, value: set }] : []),
  ...(role ? [{ tag: ROLE_TAG, value: role }] : []),
];

// Nome tecnico do host no Zabbix: so letras, numeros, espaco, ponto, hifen e sublinhado.
const technicalName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ._-]/g, "_")
    .slice(0, 120);

async function loadHost(id: string) {
  const [host] = await zbx<ZbxHost[]>("host.get", {
    hostids: [id],
    output: ["hostid", "host", "name", "status"],
    selectInterfaces: ["interfaceid", "ip", "main", "type"],
    selectHostGroups: ["groupid", "name"],
    selectParentTemplates: ["templateid", "name"],
    selectTags: ["tag", "value"],
  });
  if (!host) throw new DeviceError("Dispositivo não encontrado no Zabbix.");
  if (!isPingOnly(host)) throw new DeviceError("Este host tem outros monitoramentos além do ping; altere pelo Zabbix.");
  return host;
}

export async function createDevice(input: Record<string, unknown>) {
  const groups = await offeredGroups();
  const { name, ip, groupId, set, role } = validate(input, groups);
  try {
    const [templateid, groupid] = await Promise.all([pingTemplateId(), resolveGroupId(groupId)]);
    const result = await zbx<{ hostids: string[] }>("host.create", {
      host: technicalName(name),
      name,
      groups: [{ groupid }],
      interfaces: [{ type: 1, main: 1, useip: 1, ip, dns: "", port: "10050" }],
      templates: [{ templateid }],
      tags: tagsFor(set, role),
      description: "Cadastrado pelo Painel NOC (portal REDE-CLUBE).",
    });
    return { id: result.hostids[0], name, ip, set, role };
  } catch (error) {
    friendlyError(error);
  }
}

export async function updateDevice(id: string, input: Record<string, unknown>) {
  const host = await loadHost(id);
  const groups = await offeredGroups();
  const current = {
    name: host.name,
    ip: host.interfaces.find((entry) => entry.main === "1")?.ip || "",
    groupId: host.hostgroups.find((entry) => groups.some((offered) => offered.groupid === entry.groupid))?.groupid || "",
    set: tagValue(host, SET_TAG),
    role: tagValue(host, ROLE_TAG),
  };
  const next = validate({ ...current, ...input }, groups);
  try {
    const groupid = await resolveGroupId(next.groupId);
    // Mantem outras tags do host; troca so conjunto/funcao.
    const otherTags = (host.tags || []).filter((entry) => entry.tag !== SET_TAG && entry.tag !== ROLE_TAG);
    const update: Record<string, unknown> = { hostid: id, name: next.name, groups: [{ groupid }], tags: [...otherTags, ...tagsFor(next.set, next.role)] };
    if (typeof input.enabled === "boolean") update.status = input.enabled ? 0 : 1;
    if (next.name !== host.name) update.host = technicalName(next.name);
    await zbx("host.update", update);
    const main = host.interfaces.find((entry) => entry.main === "1") || host.interfaces[0];
    if (main && main.ip !== next.ip) await zbx("hostinterface.update", { interfaceid: main.interfaceid, ip: next.ip, useip: 1 });
    return { id, ...next, groupId: groupid };
  } catch (error) {
    friendlyError(error);
  }
}

export async function deleteDevice(id: string) {
  const host = await loadHost(id);
  if (isLinkHost(host)) throw new DeviceError("Este host mede um link de internet do painel; ele pode ser editado, mas não removido.");
  try {
    await zbx("host.delete", [host.hostid]);
    return { ok: true, name: host.name };
  } catch (error) {
    friendlyError(error);
  }
}
