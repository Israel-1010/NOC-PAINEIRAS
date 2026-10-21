import { getBeszelOverview, isBeszelConfigured, type BeszelOverview } from "./beszelClient";
import { getUnifiOverview, isUnifiConfigured, type UnifiOverview } from "./unifiClient";
import { getLinkConfig, getLinksHistory, getLinksLive, zbx } from "./zabbixClient";

// Agregacao do Zabbix para o Painel NOC (TV). Uma chamada, cache curto.

type ZbxHost = {
  hostid: string;
  name: string;
  interfaces?: { ip: string }[];
  hostgroups?: { name: string }[];
  parentTemplates?: { name: string }[];
  tags?: { tag: string; value: string }[];
};
type ZbxItem = { itemid: string; hostid: string; name: string; key_: string; lastvalue: string; lastclock: string; units: string };

// set/role = tags "conjunto"/"funcao" do host (ex.: Catraca 1 / Facial), cadastradas pelo painel.
export type NocHost = { id: string; name: string; ip: string; up: boolean | null; latencyMs: number | null; loss: number | null; problems: number; set: string; role: string };
export type NocGroup = { key: string; title: string; total: number; up: number; down: number; unknown: number; hosts: NocHost[] };

// Grupos do Zabbix -> secoes do painel (por palavra-chave no nome do grupo).
const sections = [
  { key: "switches", title: "Switches", match: /switch/i },
  { key: "antenas", title: "Antenas UniFi", match: /antena|unifi|wifi/i },
  { key: "servidores", title: "Servidores", match: /servidor|server/i },
  { key: "cftv", title: "CFTV", match: /cftv|camera|câmera/i },
  { key: "videowall", title: "Videowall / Mini PCs", match: /mini|videowall/i },
  { key: "catracas", title: "Catracas", match: /catraca/i },
  { key: "totens", title: "Totens", match: /totem/i },
  { key: "impressoras", title: "Impressoras", match: /impressora|printer/i },
  { key: "links", title: "Links", match: /^links$/i },
];

const num = (value: string | undefined) => (value === undefined || value === "" ? null : Number(value));

async function loadGroups() {
  const groups = await zbx<{ groupid: string; name: string }[]>("hostgroup.get", { output: ["groupid", "name"], with_monitored_hosts: true });
  const sectionGroups = sections.map((section) => ({ ...section, groupIds: groups.filter((group) => section.match.test(group.name)).map((group) => group.groupid) }));
  const allIds = Array.from(new Set(sectionGroups.flatMap((section) => section.groupIds)));
  if (!allIds.length) return { groups: [] as NocGroup[], hostNames: new Map<string, string>() };

  const hosts = await zbx<ZbxHost[]>("host.get", { groupids: allIds, output: ["hostid", "name"], selectInterfaces: ["ip"], selectHostGroups: ["groupid", "name"], selectTags: ["tag", "value"], monitored_hosts: true });
  const pings = await zbx<ZbxItem[]>("item.get", {
    hostids: hosts.map((host) => host.hostid),
    output: ["hostid", "key_", "lastvalue", "lastclock"],
    filter: { key_: ["icmpping", "icmppingsec", "icmppingloss"] },
    monitored: true,
  });
  const ping = new Map<string, Record<string, string>>();
  for (const item of pings) {
    const entry = ping.get(item.hostid) || {};
    entry[item.key_] = item.lastvalue;
    ping.set(item.hostid, entry);
  }
  const hostNames = new Map(hosts.map((host) => [host.hostid, host.name]));

  const result: NocGroup[] = sectionGroups
    .filter((section) => section.groupIds.length)
    .map((section) => {
      // Hosts de link tambem estao em outros grupos no Zabbix: ficam so na secao de links.
      const isLinkHost = (host: ZbxHost) => (host.hostgroups || []).some((group) => /^links$/i.test(group.name));
      const members = hosts.filter((host) => (host.hostgroups || []).some((group) => section.match.test(group.name)) && (section.key === "links" || !isLinkHost(host)));
      const list: NocHost[] = members.map((host) => {
        const values = ping.get(host.hostid) || {};
        const up = values.icmpping === undefined ? null : values.icmpping === "1";
        return {
          id: host.hostid,
          name: host.name,
          ip: host.interfaces?.[0]?.ip || "",
          up,
          latencyMs: values.icmppingsec ? Math.round(Number(values.icmppingsec) * 10000) / 10 : null,
          loss: values.icmppingloss === undefined ? null : Math.round(Number(values.icmppingloss)),
          problems: 0,
          set: host.tags?.find((tag) => tag.tag === "conjunto")?.value || "",
          role: host.tags?.find((tag) => tag.tag === "funcao")?.value || "",
        };
      });
      // Problema primeiro, depois por nome.
      list.sort((a, b) => Number(a.up !== false) - Number(b.up !== false) || a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
      return {
        key: section.key,
        title: section.title,
        total: list.length,
        up: list.filter((host) => host.up === true).length,
        down: list.filter((host) => host.up === false).length,
        unknown: list.filter((host) => host.up === null).length,
        hosts: list,
      };
    });
  return { groups: result, hostNames };
}

async function loadProblems() {
  const triggers = await zbx<{ triggerid: string; description: string; priority: string; lastchange: string; hosts: { hostid: string; name: string }[]; hostgroups?: { name: string }[] }[]>("trigger.get", {
    output: ["triggerid", "description", "priority", "lastchange"],
    selectHosts: ["hostid", "name"],
    selectHostGroups: ["name"],
    filter: { value: 1 },
    monitored: true,
    skipDependent: true,
    expandDescription: true,
    sortfield: ["priority", "lastchange"],
    sortorder: "DESC",
    limit: 300,
  });
  // Categoria = secao do painel do grupo do host (links tem prioridade, como na grade de hosts).
  const categoryOf = (groups: { name: string }[] = []) => {
    if (groups.some((group) => /^links$/i.test(group.name))) return "links";
    return sections.find((section) => groups.some((group) => section.match.test(group.name)))?.key || "outros";
  };
  return triggers.map((trigger) => ({
    id: trigger.triggerid,
    host: trigger.hosts?.[0]?.name || "",
    hostId: trigger.hosts?.[0]?.hostid || "",
    name: trigger.description,
    severity: Number(trigger.priority),
    since: new Date(Number(trigger.lastchange) * 1000).toISOString(),
    category: categoryOf(trigger.hostgroups),
  }));
}

async function hostsByTemplate(pattern: RegExp) {
  const hosts = await zbx<ZbxHost[]>("host.get", { output: ["hostid", "name"], selectParentTemplates: ["name"], monitored_hosts: true });
  return hosts.filter((host) => (host.parentTemplates || []).some((template) => pattern.test(template.name)));
}

async function itemsOf(hostIds: string[]) {
  if (!hostIds.length) return [] as ZbxItem[];
  return zbx<ZbxItem[]>("item.get", { hostids: hostIds, output: ["itemid", "hostid", "name", "key_", "lastvalue", "lastclock", "units"], monitored: true });
}

const bracket = (key: string) => /\[(.*)\]$/.exec(key)?.[1] || "";

/* ---------- Seguranca do FortiGate (IPS / antivirus) ---------- */

// O template "FortiGate by SNMP" grava esses contadores como taxa por segundo; o valor instantaneo
// quase sempre e 0. Somamos o historico para ter o total real de eventos nas ultimas 24 h.
const SECURITY_KEYS = {
  detected: "ips.detected.total[fgIpsIntrusionsDetected.0]",
  blocked: "ips.blocked[fgIpsIntrusionsBlocked.0]",
  critical: "ips.detected.crit[fgIpsCritSevDetections.0]",
  high: "ips.detected.high[fgIpsHighSevDetections.0]",
  medium: "ips.detected.med[fgIpsMedSevDetections.0]",
  low: "ips.detected.low[fgIpsLowSevDetections.0]",
  info: "ips.detected.info[fgIpsInfoSevDetections.0]",
  signature: "ips.detected.sign[fgIpsSignatureDetections.0]",
  anomaly: "ips.detected.anomaly[fgIpsAnomalyDetections.0]",
} as const;
type SecurityKey = keyof typeof SECURITY_KEYS | "antivirus";
const SECURITY_WINDOW_H = 24;

export type FirewallSecurity = {
  windowHours: number;
  totals: Record<SecurityKey, number>;
  hourly: { t: number; detected: number; blocked: number }[];
  ipsDatabase: string;
};

async function loadSecurity(items: ZbxItem[]): Promise<FirewallSecurity | null> {
  const tracked = new Map<string, SecurityKey>();
  for (const [name, key] of Object.entries(SECURITY_KEYS) as [SecurityKey, string][]) {
    const item = items.find((entry) => entry.key_ === key);
    if (item) tracked.set(item.itemid, name);
  }
  // Antivirus vem por no do cluster (HA 1, HA 2): soma os dois.
  for (const item of items.filter((entry) => entry.key_.startsWith("ha.av.events["))) tracked.set(item.itemid, "antivirus");
  if (!tracked.size) return null;

  const now = Math.floor(Date.now() / 1000);
  const currentHour = now - (now % 3600);
  const from = currentHour - (SECURITY_WINDOW_H - 1) * 3600;
  const ids = Array.from(tracked.keys());
  const [trends, recent] = await Promise.all([
    zbx<{ itemid: string; clock: string; value_avg: string; num: string }[]>("trend.get", { itemids: ids, time_from: from, time_till: currentHour - 1, output: ["itemid", "clock", "value_avg", "num"] }),
    zbx<{ itemid: string; clock: string; value: string }[]>("history.get", { itemids: ids, history: 0, time_from: currentHour, sortfield: "clock", sortorder: "ASC", output: ["itemid", "clock", "value"] }),
  ]);

  const totals = Object.fromEntries([...Object.keys(SECURITY_KEYS), "antivirus"].map((name) => [name, 0])) as Record<SecurityKey, number>;
  const hours = new Map<number, { t: number; detected: number; blocked: number }>();
  for (let t = from; t <= currentHour; t += 3600) hours.set(t, { t: t * 1000, detected: 0, blocked: 0 });
  const add = (itemid: string, hour: number, events: number) => {
    const name = tracked.get(itemid);
    if (!name || !Number.isFinite(events) || events <= 0) return;
    totals[name] += events;
    const bucket = hours.get(hour);
    if (bucket && name === "detected") bucket.detected += events;
    if (bucket && name === "blocked") bucket.blocked += events;
  };
  // Horas fechadas: media da taxa x 3600 s.
  for (const trend of trends) add(trend.itemid, Number(trend.clock), Number(trend.value_avg) * 3600);
  // Hora atual: cada amostra vale a taxa ate a proxima (ou ate agora).
  const byItem = new Map<string, { clock: number; value: number }[]>();
  for (const point of recent) {
    const list = byItem.get(point.itemid) || [];
    list.push({ clock: Number(point.clock), value: Number(point.value) });
    byItem.set(point.itemid, list);
  }
  for (const [itemid, points] of byItem) {
    points.forEach((point, index) => {
      const next = points[index + 1]?.clock ?? now;
      add(itemid, currentHour, point.value * Math.max(0, Math.min(next - point.clock, 600)));
    });
  }

  const round = (value: number) => Math.round(value);
  return {
    windowHours: SECURITY_WINDOW_H,
    totals: Object.fromEntries(Object.entries(totals).map(([name, value]) => [name, round(value)])) as Record<SecurityKey, number>,
    hourly: Array.from(hours.values()).map((hour) => ({ t: hour.t, detected: round(hour.detected), blocked: round(hour.blocked) })),
    ipsDatabase: items.find((entry) => entry.key_ === "ips.database.version[fgSysVersionIps.0]")?.lastvalue || "",
  };
}

// Historico de 24 h nao muda a cada 8 s: guarda por 2 min.
let securityCache: { at: number; hostId: string; value: Promise<FirewallSecurity | null> } | null = null;
function securityFor(hostId: string, items: ZbxItem[]) {
  if (securityCache && securityCache.hostId === hostId && Date.now() - securityCache.at < 120000) return securityCache.value;
  const value = loadSecurity(items).catch(() => null);
  securityCache = { at: Date.now(), hostId, value };
  return value;
}

async function loadFirewalls() {
  const hosts = await hostsByTemplate(/fortigate/i);
  const items = await itemsOf(hosts.map((host) => host.hostid));
  const security = new Map(await Promise.all(hosts.map(async (host) => [host.hostid, await securityFor(host.hostid, items.filter((item) => item.hostid === host.hostid))] as const)));
  return hosts.map((host) => {
    const own = items.filter((item) => item.hostid === host.hostid);
    const get = (key: string) => own.find((item) => item.key_ === key)?.lastvalue;
    const like = (prefix: string) => own.filter((item) => item.key_.startsWith(prefix));

    const haIndexes = Array.from(new Set(like("ha.hostname[").map((item) => bracket(item.key_).split(".").pop())));
    const nodes = haIndexes.map((index) => {
      const pick = (prefix: string) => like(prefix).find((item) => bracket(item.key_).endsWith(`.${index}`))?.lastvalue;
      return {
        hostname: pick("ha.hostname[") || `Nó ${index}`,
        cpu: num(pick("ha.cpu.usage[")),
        memory: num(pick("ha.mem.usage[")),
        sessions: num(pick("ha.session.count[")),
        synced: pick("ha.sync.status[") === undefined ? null : pick("ha.sync.status[") === "1",
        trafficBps: num(pick("ha.net.usage[")),
      };
    });

    // Tuneis: agrupa fases pelo nome (status 2 = ativo).
    const tunnels = new Map<string, { name: string; up: number; total: number }>();
    for (const item of like("vpn.tunnel.status[")) {
      const name = /VPN (.+?): Tunnel Status/.exec(item.name)?.[1] || item.name;
      const entry = tunnels.get(name) || { name, up: 0, total: 0 };
      entry.total += 1;
      if (item.lastvalue === "2") entry.up += 1;
      tunnels.set(name, entry);
    }

    const sdwan = like("sdwan_health.latency[").map((item) => {
      const index = bracket(item.key_).split(".").pop();
      const member = /\]:\[(.+?)\]/.exec(item.name)?.[1] || index || "";
      const check = /SD-WAN \[(.+?)\]/.exec(item.name)?.[1] || "";
      const pick = (prefix: string) => like(prefix).find((entry) => bracket(entry.key_).endsWith(`.${index}`))?.lastvalue;
      return {
        member,
        check,
        latencyMs: item.lastvalue ? Math.round(Number(item.lastvalue) * 10) / 10 : null,
        jitterMs: pick("sdwan_health.jitter[") ? Math.round(Number(pick("sdwan_health.jitter[")) * 100) / 100 : null,
        loss: pick("sdwan_health.loss[") ? Math.round(Number(pick("sdwan_health.loss["))) : null,
        alive: pick("sdwan_health.state[") === undefined ? null : pick("sdwan_health.state[") === "0",
      };
    });

    const sensors = like("hw.sensor.value[").map((item) => {
      const index = bracket(item.key_).split(".").pop();
      const name = /Sensor (.+?): Value/.exec(item.name)?.[1] || item.name;
      const alarm = like("hw.sensor.status[").find((entry) => bracket(entry.key_).endsWith(`.${index}`))?.lastvalue;
      const kind = /temp/i.test(name) ? "temp" : /fan/i.test(name) ? "fan" : /psu|power/i.test(name) ? "psu" : "other";
      return { name, kind, value: num(item.lastvalue), alarm: alarm === undefined ? null : alarm !== "0" };
    });

    return {
      id: host.hostid,
      name: host.name,
      cpu: num(get("system.cpu.util[fgSysCpuUsage.0]")),
      memory: num(get("vm.memory.util[memoryUsedPercentage.0]")),
      sessions: num(get("net.ipv4.sessions[fgSysSesCount.0]")),
      uptimeSec: num(get("system.uptime[fgSysUpTime.0]")),
      haMode: get("ha.mode[fgHaSystemMode.0]") === "3" ? "Ativo-Passivo" : get("ha.mode[fgHaSystemMode.0]") === "2" ? "Ativo-Ativo" : get("ha.mode[fgHaSystemMode.0]") === "1" ? "Standalone" : "",
      haGroup: get("ha.cluster.group_name[fgHaGroupName.0]") || "",
      nodes,
      tunnels: Array.from(tunnels.values()).sort((a, b) => Number(a.up > 0) - Number(b.up > 0) || a.name.localeCompare(b.name)),
      sslVpnUsers: num(get("vpn.users.count[fgVpnSslStatsLoginUsers.0]")),
      sdwan,
      sensors,
      ips: { detected: num(get("ips.detected.total[fgIpsIntrusionsDetected.0]")), blocked: num(get("ips.blocked[fgIpsIntrusionsBlocked.0]")) },
      security: security.get(host.hostid) || null,
    };
  });
}

async function loadRouters() {
  const hosts = await hostsByTemplate(/mikrotik/i);
  const items = await itemsOf(hosts.map((host) => host.hostid));
  return hosts.map((host) => {
    const own = items.filter((item) => item.hostid === host.hostid);
    const cpus = own.filter((item) => item.key_.startsWith("system.cpu.util[")).map((item) => Number(item.lastvalue));
    const get = (prefix: string) => own.find((item) => item.key_.startsWith(prefix))?.lastvalue;
    return {
      id: host.hostid,
      name: host.name,
      model: get("system.hw.model") || "",
      cpu: cpus.length ? Math.round(cpus.reduce((sum, value) => sum + value, 0) / cpus.length) : null,
      memory: num(get("vm.memory.util[")),
      temperature: num(get("sensor.temp.value[")),
      uptimeSec: num(get("system.hw.uptime[") || get("system.net.uptime[")),
    };
  });
}

// Dell iDRAC: 3 = ok, 4 = atencao, 5/6 = critico (padrao Dell).
function dellLevel(values: (string | undefined)[]) {
  const known = values.filter((value) => value !== undefined && value !== "" && value !== "0").map(Number);
  if (!known.length) return "unknown";
  if (known.some((value) => value >= 5)) return "critical";
  if (known.some((value) => value === 4)) return "warning";
  if (known.every((value) => value === 3)) return "ok";
  return "unknown";
}

async function loadHardware() {
  const hosts = await hostsByTemplate(/idrac|poweredge|dell/i);
  const items = await itemsOf(hosts.map((host) => host.hostid));
  return hosts.map((host) => {
    const own = items.filter((item) => item.hostid === host.hostid);
    const find = (pattern: RegExp) => own.filter((item) => pattern.test(item.key_));
    const statusOf = (pattern: RegExp) => find(pattern).map((item) => item.lastvalue);
    const psu = statusOf(/sensor\.psu\.status/);
    const fans = statusOf(/sensor\.fan\.status/);
    const disks = statusOf(/physicaldisk\.status/);
    const smartAlerts = statusOf(/physicaldisk\.smart_status/).filter((value) => value !== "0").length;
    const raid = statusOf(/diskarray\.status/);
    const temps = find(/sensor\.temp\.value/).map((item) => ({ name: item.name.replace(/: Temperature.*$/, "").replace(/ Temperature$/, ""), value: num(item.lastvalue) }));
    const overall = own.find((item) => /system\.status\[/.test(item.key_))?.lastvalue;
    return {
      id: host.hostid,
      name: host.name,
      model: own.find((item) => /hw\.model/.test(item.key_))?.lastvalue || "",
      health: dellLevel([overall, ...psu, ...fans, ...disks, ...raid]),
      psu: { ok: psu.filter((value) => value === "3").length, total: psu.length },
      fans: { ok: fans.filter((value) => value === "3").length, total: fans.length },
      disks: { ok: disks.filter((value) => value === "3").length, total: disks.length, smartAlerts },
      raid: dellLevel(raid),
      temps: temps.slice(0, 4),
    };
  });
}

// Leitura quase em tempo real: dado com ate 8 s e devolvido na hora; mais velho que isso,
// devolve a ultima leitura e atualiza em segundo plano (uma unica busca por vez).
const FRESH_MS = 8000;
let current: { at: number; value: Promise<unknown> } | null = null;
let refreshing: Promise<unknown> | null = null;

export function getNocOverview() {
  if (current && Date.now() - current.at < FRESH_MS) return current.value;
  if (!refreshing) {
    const next = buildNocOverview();
    refreshing = next;
    next
      .then(() => {
        current = { at: Date.now(), value: next };
      })
      .catch(() => undefined)
      .finally(() => {
        refreshing = null;
      });
  }
  return current ? current.value : refreshing;
}

function buildNocOverview() {
  return (async () => {
    const settle = async <T,>(task: Promise<T>, fallback: T) => {
      try {
        return { data: await task, error: "" };
      } catch (error) {
        return { data: fallback, error: error instanceof Error ? error.message : "Falha" };
      }
    };
    const [groups, problems, firewalls, routers, hardware, links, traffic, unifi, beszel] = await Promise.all([
      settle(loadGroups(), { groups: [] as NocGroup[], hostNames: new Map<string, string>() }),
      settle(loadProblems(), [] as Awaited<ReturnType<typeof loadProblems>>),
      settle(loadFirewalls(), [] as Awaited<ReturnType<typeof loadFirewalls>>),
      settle(loadRouters(), [] as Awaited<ReturnType<typeof loadRouters>>),
      settle(loadHardware(), [] as Awaited<ReturnType<typeof loadHardware>>),
      settle(getLinksLive(), { checkedAt: "", links: [], problems: [] } as Awaited<ReturnType<typeof getLinksLive>>),
      settle(getLinksHistory("6h"), null as Awaited<ReturnType<typeof getLinksHistory>> | null),
      // Controladoras do portal e as lidas pelo Zabbix; null quando nao ha nenhuma.
      settle(getUnifiOverview(), null as UnifiOverview | null),
      // Servidores e containers (Beszel), quando configurado.
      isBeszelConfigured() ? settle(getBeszelOverview(), null as BeszelOverview | null) : Promise.resolve({ data: null as BeszelOverview | null, error: "" }),
    ]);

    // Liga cada link a porta do firewall (ex.: x2 = TELIUM) para cruzar com o SD-WAN.
    const linkMembers = new Map<string, string>();
    try {
      const config = await getLinkConfig();
      const ids = config.map((link) => link.inItemId).filter(Boolean);
      if (ids.length) {
        const named = await zbx<ZbxItem[]>("item.get", { itemids: ids, output: ["itemid", "name"] });
        for (const link of config) {
          const itemName = named.find((item) => item.itemid === link.inItemId)?.name || "";
          const member = /^Interface ([^(:]+)/.exec(itemName)?.[1]?.trim();
          if (member) linkMembers.set(link.id, member);
        }
      }
    } catch {
      /* sem cruzamento com SD-WAN */
    }

    // Conta problemas por host para destacar nos quadros.
    const byHost = new Map<string, number>();
    for (const problem of problems.data) byHost.set(problem.hostId, (byHost.get(problem.hostId) || 0) + 1);
    for (const group of groups.data.groups) for (const host of group.hosts) host.problems = byHost.get(host.id) || 0;

    return {
      generatedAt: new Date().toISOString(),
      groups: groups.data.groups,
      problems: problems.data,
      firewalls: firewalls.data,
      routers: routers.data,
      hardware: hardware.data,
      links: links.data.links.map((link) => ({ ...link, member: linkMembers.get(link.id) || "" })),
      traffic: traffic.data,
      unifi: unifi.data,
      unifiConfigured: isUnifiConfigured() || Boolean(unifi.data),
      beszel: beszel.data,
      errors: [groups, problems, firewalls, routers, hardware, links, traffic, unifi, beszel].map((entry) => entry.error).filter(Boolean),
    };
  })();
}
