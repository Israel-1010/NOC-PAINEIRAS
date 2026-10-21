import { zbx } from "./zabbixClient";

// Cadastro de dispositivos monitorados por ping, direto no Zabbix (o Zabbix e quem pinga,
// gera os alertas e manda o WhatsApp). Cada dispositivo e um host com o template "ICMP Ping".
// Seguranca: so altera/remove hosts que tem APENAS o template de ping (nunca links, firewall,
// servidores com outros templates). Exige usuario do Zabbix com permissao de escrita.

const PING_TEMPLATE = "ICMP Ping";

// Erro de uso (dado invalido, sem permissao): volta 400/403 em vez de 500.
class DeviceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}
// Grupos oferecidos no cadastro (mesmas secoes do Painel NOC; CFTV e antenas ficam de fora).
const OFFERED_GROUPS = /switch|servidor|server|mini|videowall|links|impressora|printer|rede|network/i;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

type ZbxHost = {
  hostid: string;
  host: string;
  name: string;
  status: string;
  interfaces: { interfaceid: string; ip: string; main: string; type: string }[];
  hostgroups: { groupid: string; name: string }[];
  parentTemplates: { templateid: string; name: string }[];
};

export type Device = {
  id: string;
  name: string;
  ip: string;
  groupId: string;
  group: string;
  enabled: boolean;
  editable: boolean;
  removable: boolean;
  up: boolean | null;
  latencyMs: number | null;
};

function friendlyError(error: unknown): never {
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
  return groups
    // Fora: cameras/antenas, grupos padrao do Zabbix e grupos vazios que nao sao secao do painel (ex.: "Network" da UniFi).
    .filter((group) => OFFERED_GROUPS.test(group.name) && !/cftv|camera|antena/i.test(group.name) && !/^(zabbix servers|linux servers)$/i.test(group.name))
    .filter((group) => Number(group.hosts) > 0 || /switch|servidor|mini|videowall|^links$/i.test(group.name))
    .map(({ groupid, name }) => ({ groupid, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

const isPingOnly = (host: ZbxHost) => host.parentTemplates.length === 1 && host.parentTemplates[0].name === PING_TEMPLATE;
// Hosts dos links de internet dao latencia/estado aos links do painel: podem ser editados, nao removidos.
const isLinkHost = (host: ZbxHost) => host.hostgroups.some((group) => /link/i.test(group.name));

export async function listDevices() {
  const groups = await offeredGroups();
  if (!groups.length) return { groups: [], devices: [] as Device[] };
  const hosts = await zbx<ZbxHost[]>("host.get", {
    groupids: groups.map((group) => group.groupid),
    output: ["hostid", "host", "name", "status"],
    selectInterfaces: ["interfaceid", "ip", "main", "type"],
    selectHostGroups: ["groupid", "name"],
    selectParentTemplates: ["templateid", "name"],
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
      enabled: host.status === "0",
      editable: isPingOnly(host),
      removable: isPingOnly(host) && !isLinkHost(host),
      up: !ping || host.status !== "0" ? null : ping.lastvalue === "1",
      latencyMs: sec?.lastvalue ? Math.round(Number(sec.lastvalue) * 10000) / 10 : null,
    };
  });
  devices.sort((a, b) => a.group.localeCompare(b.group, "pt-BR") || a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  return { groups, devices };
}

function validate(input: Record<string, unknown>, groups: { groupid: string }[]) {
  const name = String(input.name || "").trim().replace(/\s+/g, " ");
  const ip = String(input.ip || "").trim();
  const groupId = String(input.groupId || "");
  if (!name || name.length > 80) throw new DeviceError("Informe o nome do dispositivo (até 80 caracteres).");
  if (!IPV4.test(ip)) throw new DeviceError("IP inválido. Exemplo: 10.0.1.50");
  if (!groups.some((group) => group.groupid === groupId)) throw new DeviceError("Escolha o tipo (grupo) do dispositivo.");
  return { name, ip, groupId };
}

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
  });
  if (!host) throw new DeviceError("Dispositivo não encontrado no Zabbix.");
  if (!isPingOnly(host)) throw new DeviceError("Este host tem outros monitoramentos além do ping; altere pelo Zabbix.");
  return host;
}

export async function createDevice(input: Record<string, unknown>) {
  const groups = await offeredGroups();
  const { name, ip, groupId } = validate(input, groups);
  try {
    const templateid = await pingTemplateId();
    const result = await zbx<{ hostids: string[] }>("host.create", {
      host: technicalName(name),
      name,
      groups: [{ groupid: groupId }],
      interfaces: [{ type: 1, main: 1, useip: 1, ip, dns: "", port: "10050" }],
      templates: [{ templateid }],
      description: "Cadastrado pelo Painel NOC (portal REDE-CLUBE).",
    });
    return { id: result.hostids[0], name, ip };
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
  };
  const next = validate({ ...current, ...input }, groups);
  try {
    const update: Record<string, unknown> = { hostid: id, name: next.name, groups: [{ groupid: next.groupId }] };
    if (typeof input.enabled === "boolean") update.status = input.enabled ? 0 : 1;
    if (next.name !== host.name) update.host = technicalName(next.name);
    await zbx("host.update", update);
    const main = host.interfaces.find((entry) => entry.main === "1") || host.interfaces[0];
    if (main && main.ip !== next.ip) await zbx("hostinterface.update", { interfaceid: main.interfaceid, ip: next.ip, useip: 1 });
    return { id, ...next };
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
