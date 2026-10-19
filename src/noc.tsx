import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Flower2,
  Globe,
  HardDrive,
  Maximize2,
  MemoryStick,
  Minimize2,
  MonitorPlay,
  Network,
  Pause,
  Play,
  Radio,
  Server,
  Shield,
  ShieldCheck,
  Thermometer,
  Wifi,
  WifiOff,
  X,
  XCircle,
  Zap,
} from "lucide-react";

/* ---------- Tipos (espelham server/nocData.ts) ---------- */

type NocHost = { id: string; name: string; ip: string; up: boolean | null; latencyMs: number | null; loss: number | null; problems: number };
type NocGroup = { key: string; title: string; total: number; up: number; down: number; unknown: number; hosts: NocHost[] };
type NocProblem = { id: string; host: string; hostId: string; name: string; severity: number; since: string };
type Firewall = {
  id: string;
  name: string;
  cpu: number | null;
  memory: number | null;
  sessions: number | null;
  uptimeSec: number | null;
  haMode: string;
  haGroup: string;
  nodes: { hostname: string; cpu: number | null; memory: number | null; sessions: number | null; synced: boolean | null; trafficBps: number | null }[];
  tunnels: { name: string; up: number; total: number }[];
  sslVpnUsers: number | null;
  sdwan: { member: string; check: string; latencyMs: number | null; jitterMs: number | null; loss: number | null; alive: boolean | null }[];
  sensors: { name: string; kind: string; value: number | null; alarm: boolean | null }[];
  ips: { detected: number | null; blocked: number | null };
  security: {
    windowHours: number;
    totals: Record<"detected" | "blocked" | "critical" | "high" | "medium" | "low" | "info" | "signature" | "anomaly" | "antivirus", number>;
    hourly: { t: number; detected: number; blocked: number }[];
    ipsDatabase: string;
  } | null;
};
type Router = { id: string; name: string; model: string; cpu: number | null; memory: number | null; temperature: number | null; uptimeSec: number | null };
type Hardware = {
  id: string;
  name: string;
  model: string;
  health: "ok" | "warning" | "critical" | "unknown";
  psu: { ok: number; total: number };
  fans: { ok: number; total: number };
  disks: { ok: number; total: number; smartAlerts: number };
  raid: string;
  temps: { name: string; value: number | null }[];
};
type NocLink = {
  id: string;
  name: string;
  member: string;
  contractedMbps: number;
  inBps: number;
  outBps: number;
  usagePercent: number | null;
  online: boolean;
  latencyMs: number | null;
  lossPercent: number | null;
};
type TrafficLink = { id: string; name: string; series: { t: number; in: number | null; out: number | null }[] };
type UnifiSwitch = {
  id: string;
  controller: string;
  site: string;
  name: string;
  model: string;
  online: boolean;
  cpu: number | null;
  memory: number | null;
  temperature: number | null;
  uptimeSec: number | null;
  portsUp: number;
  portsTotal: number;
  portErrors: number;
  poeWatts: number;
  poeMaxWatts: number | null;
  clients: number;
  txBps: number | null;
  rxBps: number | null;
  version: string;
  uplink: string;
  upgradable: boolean;
};
type UnifiAp = {
  id: string;
  controller: string;
  site: string;
  name: string;
  model: string;
  online: boolean;
  cpu: number | null;
  memory: number | null;
  clients: number;
  satisfaction: number | null;
  radios: { band: string; channel: number | null; utilization: number | null; clients: number }[];
  txBps: number | null;
  rxBps: number | null;
  uptimeSec: number | null;
  version: string;
  uplink: string;
  upgradable: boolean;
};
type UnifiAlarm = { id: string; site: string; time: string; message: string };
type UnifiController = {
  id: string;
  name: string;
  ok: boolean;
  message: string;
  version: string;
  via: "direto" | "zabbix";
  sites: { name: string; title: string }[];
  switches: UnifiSwitch[];
  aps: UnifiAp[];
  clients: {
    total: number;
    wired: number;
    wireless: number;
    guests: number;
    satisfaction: number | null;
    bySsid: { ssid: string; count: number }[];
    byBand: { band: string; count: number }[];
  };
  traffic: { txBps: number; rxBps: number };
  alarms: UnifiAlarm[];
};
type Unifi = {
  version: string;
  controllers: UnifiController[];
  sites: { name: string; title: string }[];
  switches: UnifiSwitch[];
  aps: UnifiAp[];
  clients: { total: number; wired: number; wireless: number; bySsid: { ssid: string; count: number }[] };
  alarms: UnifiAlarm[];
};
type NocData = {
  unifi?: Unifi | null;
  unifiConfigured?: boolean;
  generatedAt: string;
  groups: NocGroup[];
  problems: NocProblem[];
  firewalls: Firewall[];
  routers: Router[];
  hardware: Hardware[];
  links: NocLink[];
  traffic: { links: TrafficLink[] } | null;
  errors: string[];
};

// Paginas fixas; cada controladora UniFi ganha a sua pagina ("unifi:<id>") depois de "internet".
type NocPage = { id: string; title: string; icon: typeof Activity; controllerId?: string };
const FIXED_PAGES: NocPage[] = [
  { id: "overview", title: "Visão geral", icon: Activity },
  { id: "internet", title: "Internet e Firewall", icon: Globe },
  { id: "antenas", title: "Antenas (ping do Zabbix)", icon: Radio },
  { id: "servidores", title: "Servidores e Datacenter", icon: Server },
  { id: "videowall", title: "Videowall", icon: MonitorPlay },
];

function buildPages(data: NocData | null): NocPage[] {
  const controllers = data?.unifi?.controllers || [];
  const unifiPages: NocPage[] = controllers.map((controller) => ({
    id: `unifi:${controller.id}`,
    title: `UniFi · ${controller.name}`,
    icon: controller.aps.length >= controller.switches.length ? Radio : Network,
    controllerId: controller.id,
  }));
  // Com antenas vindas da UniFi, a grade de ping do Zabbix vira redundante.
  const hasUnifiAps = controllers.some((controller) => controller.ok && controller.aps.length);
  const fixed = FIXED_PAGES.filter((page) => page.id !== "antenas" || !hasUnifiAps);
  return [...fixed.slice(0, 2), ...unifiPages, ...fixed.slice(2)];
}

// Severidades no padrao do Zabbix (sempre com rotulo).
const SEVERITY = [
  { label: "Não classificado", tone: "s0" },
  { label: "Informação", tone: "s1" },
  { label: "Atenção", tone: "s2" },
  { label: "Média", tone: "s3" },
  { label: "Alta", tone: "s4" },
  { label: "Desastre", tone: "s5" },
];

const INTERVAL_KEY = "rede-clube-noc-interval";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function headersFor(tvKey?: string): Record<string, string> {
  if (tvKey) return { "X-TV-Key": tvKey };
  try {
    const raw = window.localStorage.getItem("rede-clube-session");
    const token = raw ? (JSON.parse(raw) as { token?: string }).token || "" : "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/* ---------- Formatacao ---------- */

function rate(bps: number | null | undefined) {
  if (bps === null || bps === undefined) return "—";
  const mbps = bps / 1e6;
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  return `${mbps >= 100 ? Math.round(mbps) : mbps.toFixed(1)} Mbps`;
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}%`;
}

function duration(sinceIso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(sinceIso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} dias`;
}

function uptime(seconds: number | null) {
  if (!seconds) return "—";
  const days = Math.floor(seconds / 86400);
  return days ? `${days} dias` : `${Math.floor(seconds / 3600)} h`;
}

function groupTone(group?: NocGroup) {
  if (!group || !group.total) return "unknown";
  if (group.down === 0) return "good";
  if (group.down / group.total >= 0.5) return "critical";
  return "warning";
}

const toneIcon = (tone: string, size = 18) =>
  tone === "good" ? <CheckCircle2 size={size} /> : tone === "critical" ? <XCircle size={size} /> : tone === "warning" ? <AlertTriangle size={size} /> : <Activity size={size} />;

const toneLabel = (tone: string) => (tone === "good" ? "Normal" : tone === "critical" ? "Crítico" : tone === "warning" ? "Atenção" : "Sem dados");

/* ---------- Pecas ---------- */

function Meter({ label, value, warn = 70, crit = 90, icon }: { label: string; value: number | null; warn?: number; crit?: number; icon: React.ReactNode }) {
  const tone = value === null ? "unknown" : value >= crit ? "critical" : value >= warn ? "warning" : "good";
  return (
    <div className={`noc-meter tone-${tone}`}>
      <span>{icon} {label}</span>
      <strong>{pct(value)}</strong>
      <div className="noc-meter-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, value ?? 0)}%` }} /></div>
    </div>
  );
}

function AvailabilityBar({ group }: { group: NocGroup }) {
  if (!group.total) return null;
  return (
    <div className="noc-avail" role="img" aria-label={`${group.up} de ${group.total} online`}>
      {group.up ? <i className="up" style={{ flexGrow: group.up }} /> : null}
      {group.unknown ? <i className="unknown" style={{ flexGrow: group.unknown }} /> : null}
      {group.down ? <i className="down" style={{ flexGrow: group.down }} /> : null}
    </div>
  );
}

function DomainTile({ title, icon, tone, main, sub, children }: { title: string; icon: React.ReactNode; tone: string; main: string; sub: string; children?: React.ReactNode }) {
  return (
    <section className={`noc-domain tone-${tone}`}>
      <header>
        <span>{icon} {title}</span>
        <em>{toneIcon(tone, 16)} {toneLabel(tone)}</em>
      </header>
      <strong>{main}</strong>
      <small>{sub}</small>
      {children}
    </section>
  );
}

function ProblemList({ problems, limit }: { problems: NocProblem[]; limit: number }) {
  if (!problems.length) {
    return <p className="noc-all-clear"><ShieldCheck size={28} /> Nenhum problema ativo no Zabbix</p>;
  }
  return (
    <ol className="noc-problems">
      {problems.slice(0, limit).map((problem) => (
        <li key={problem.id} className={SEVERITY[problem.severity]?.tone}>
          <span className="noc-sev">{SEVERITY[problem.severity]?.label}</span>
          <strong>{problem.host}</strong>
          <span className="noc-problem-name">{translateProblem(problem.name)}</span>
          <time>há {duration(problem.since)}</time>
        </li>
      ))}
      {problems.length > limit ? <li className="noc-more">+ {problems.length - limit} problemas</li> : null}
    </ol>
  );
}

function translateProblem(name: string) {
  return name
    .replace(/^Unavailable by ICMP ping$/i, "Sem resposta (ping)")
    .replace(/High ICMP ping loss/i, "Perda de pacotes alta")
    .replace(/High ICMP ping response time/i, "Latência alta")
    .replace(/No SNMP data collection/i, "Sem coleta SNMP")
    .replace(/: Tunnel down/i, ": túnel VPN caído")
    .replace(/: Link down/i, ": link caído")
    .replace(/^Software Upgrade Available$/i, "Atualização de firmware disponível")
    .replace(/^One or more Switch is disconnected$/i, "Switch desconectado da controladora")
    .replace(/^One or more Acces+ Point is disconnected$/i, "Antena desconectada da controladora");
}

function HostGrid({ group, compact }: { group: NocGroup; compact?: boolean }) {
  const allDown = group.total > 3 && group.down === group.total;
  const size = group.total > 60 ? "xs" : group.total > 36 ? "sm" : group.total <= 12 ? "lg" : "md";
  return (
    <div className="noc-hostgrid-wrap">
      {allDown ? (
        <p className="noc-collect-warn">
          <AlertTriangle size={18} /> Todos os {group.total} sem resposta: provável falha de coleta do Zabbix (pinger sobrecarregado) ou rede inacessível a partir do servidor Zabbix.
        </p>
      ) : null}
      <div className={`noc-hostgrid size-${compact ? "xs" : size}`}>
        {group.hosts.map((host) => {
          const tone = host.up === null ? "unknown" : host.up ? (host.loss && host.loss > 0 ? "warning" : "good") : "critical";
          return (
            <div key={host.id} className={`noc-host tone-${tone}`} title={`${host.name} · ${host.ip}`}>
              <span className="noc-host-icon">{tone === "critical" ? <WifiOff size={14} /> : toneIcon(tone, 14)}</span>
              <strong>{host.name}</strong>
              <small>{host.up ? `${host.latencyMs ?? "—"} ms${host.loss ? ` · perda ${host.loss}%` : ""}` : host.up === false ? "OFFLINE" : "sem dados"}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroupHeader({ group }: { group: NocGroup }) {
  const tone = groupTone(group);
  const availability = group.total ? Math.round((group.up / group.total) * 1000) / 10 : 0;
  return (
    <div className={`noc-group-head tone-${tone}`}>
      <div><span>Online</span><strong>{group.up}</strong></div>
      <div className="bad"><span>Sem resposta</span><strong>{group.down}</strong></div>
      <div><span>Total</span><strong>{group.total}</strong></div>
      <div><span>Disponibilidade</span><strong>{pct(availability)}</strong></div>
      <div className="status">{toneIcon(tone, 26)} {toneLabel(tone)}</div>
    </div>
  );
}

function TrafficMini({ series, height = 110 }: { series: { t: number; in: number | null; out: number | null }[]; height?: number | "100%" }) {
  if (!series.length) return <p className="noc-empty">Sem histórico</p>;
  return (
    <ResponsiveContainer width="100%" height={height} minHeight={60}>
      <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: "#0b1430", border: "1px solid #2c3a5a", borderRadius: 8, color: "#eef2fb" }}
          labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          formatter={(value, key) => [rate(Number(value) * 1e6), key === "in" ? "Download" : "Upload"]}
        />
        <Area type="monotone" dataKey="in" stroke="#3987e5" strokeWidth={2} fill="#3987e5" fillOpacity={0.18} isAnimationActive={false} connectNulls />
        <Area type="monotone" dataKey="out" stroke="#d95926" strokeWidth={2} fill="#d95926" fillOpacity={0.12} isAnimationActive={false} connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---------- Paginas ---------- */

function OverviewPage({ data }: { data: NocData }) {
  const group = (key: string) => data.groups.find((entry) => entry.key === key);
  const fw = data.firewalls[0];
  const linksOnline = data.links.filter((link) => link.online).length;
  const linkTone = !data.links.length ? "unknown" : linksOnline === data.links.length ? "good" : linksOnline === 0 ? "critical" : "warning";
  const fwTone = !fw ? "unknown" : (fw.cpu ?? 0) >= 90 || fw.nodes.some((node) => node.synced === false) ? "critical" : (fw.cpu ?? 0) >= 70 || fw.tunnels.some((tunnel) => !tunnel.up) ? "warning" : "good";
  const totalIn = data.links.reduce((sum, link) => sum + link.inBps, 0);
  const totalOut = data.links.reduce((sum, link) => sum + link.outBps, 0);
  const hwBad = data.hardware.filter((hw) => hw.health !== "ok").length;
  const bySeverity = [5, 4, 3, 2].map((severity) => ({ severity, count: data.problems.filter((problem) => problem.severity === severity).length }));
  const combined = useMemo(() => {
    const series = new Map<number, { t: number; in: number; out: number }>();
    for (const link of data.traffic?.links || []) {
      for (const point of link.series) {
        const entry = series.get(point.t) || { t: point.t, in: 0, out: 0 };
        entry.in += point.in || 0;
        entry.out += point.out || 0;
        series.set(point.t, entry);
      }
    }
    return Array.from(series.values()).sort((a, b) => a.t - b.t);
  }, [data.traffic]);

  const groupTile = (key: string, title: string, icon: React.ReactNode, extra?: string) => {
    const entry = group(key);
    return (
      <DomainTile title={title} icon={icon} tone={groupTone(entry)} main={entry ? `${entry.up}/${entry.total}` : "—"} sub={entry ? `${entry.down} sem resposta${extra ? ` · ${extra}` : ""}` : "Grupo não encontrado no Zabbix"}>
        {entry ? <AvailabilityBar group={entry} /> : null}
      </DomainTile>
    );
  };

  // Antenas e switches: o numero real vem das controladoras UniFi (estado de cada aparelho na controladora).
  // Vale o ping do Zabbix quando a UniFi nao cobre a maior parte dos aparelhos (ex.: controladora de
  // switches ainda sem acesso e a outra so com 6 switches de CFTV).
  const okControllers = (data.unifi?.controllers || []).filter((controller) => controller.ok);
  const unifiTile = (kind: "aps" | "switches", zabbixKey: string, title: string, icon: React.ReactNode) => {
    const devices: { online: boolean }[] = okControllers.flatMap((controller): { online: boolean }[] => controller[kind]);
    const zabbixTotal = group(zabbixKey)?.total || 0;
    if (!devices.length || devices.length < zabbixTotal * 0.6) return groupTile(zabbixKey, title, icon);
    const up = devices.filter((device) => device.online).length;
    const unifiGroup: NocGroup = { key: zabbixKey, title, total: devices.length, up, down: devices.length - up, unknown: 0, hosts: [] };
    const failed = (data.unifi?.controllers || []).filter((controller) => !controller.ok).length;
    const label = kind === "aps" ? "desconectada(s)" : "desconectado(s)";
    return (
      <DomainTile
        title={title}
        icon={icon}
        tone={groupTone(unifiGroup)}
        main={`${up}/${devices.length}`}
        sub={`${devices.length - up} ${label} · UniFi${failed ? ` (${failed} controladora sem resposta)` : ""}`}
      >
        <AvailabilityBar group={unifiGroup} />
      </DomainTile>
    );
  };

  return (
    <div className="noc-page noc-overview">
      <div className="noc-domains">
        <DomainTile title="Internet" icon={<Globe size={18} />} tone={linkTone} main={`${linksOnline}/${data.links.length}`} sub={`↓ ${rate(totalIn)} · ↑ ${rate(totalOut)}`} />
        <DomainTile
          title="Firewall"
          icon={<Shield size={18} />}
          tone={fwTone}
          main={fw ? pct(fw.cpu) : "—"}
          sub={
            fw
              ? fw.security
                ? `CPU · ${fw.security.totals.blocked.toLocaleString("pt-BR")} bloqueios em 24 h`
                : `CPU · mem ${pct(fw.memory)} · ${(fw.sessions ?? 0).toLocaleString("pt-BR")} sessões`
              : "Sem FortiGate no Zabbix"
          }
        />
        {unifiTile("switches", "switches", "Switches", <Network size={18} />)}
        {unifiTile("aps", "antenas", "Antenas UniFi", <Radio size={18} />)}
        {groupTile("servidores", "Servidores", <Server size={18} />, data.hardware.length ? `hardware Dell ${data.hardware.length - hwBad}/${data.hardware.length} ok` : "")}
        {groupTile("videowall", "Videowall", <MonitorPlay size={18} />)}
      </div>

      <div className="noc-overview-bottom">
        <section className="noc-card noc-problems-card">
          <h3><AlertOctagon size={20} /> Problemas ativos <small>{data.problems.length} no Zabbix</small></h3>
          <ProblemList problems={data.problems} limit={14} />
        </section>
        <div className="noc-overview-side">
          <section className="noc-card">
            <h3>Por severidade</h3>
            <div className="noc-sev-tiles">
              {bySeverity.map((entry) => (
                <div key={entry.severity} className={`${SEVERITY[entry.severity].tone} ${entry.count ? "" : "zero"}`}>
                  <span>{SEVERITY[entry.severity].label}</span>
                  <strong>{entry.count}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="noc-card">
            <h3>Consumo de internet · 6 h <span className="noc-legend"><i className="in" /> Download <i className="out" /> Upload</span></h3>
            <div className="noc-fill"><TrafficMini series={combined} height="100%" /></div>
          </section>
        </div>
      </div>
    </div>
  );
}

// IPS/antivirus do FortiGate somados nas ultimas 24 h (o Zabbix guarda como taxa por segundo).
const SEC_LEVELS = [
  { key: "critical", label: "Crítica", tone: "s5" },
  { key: "high", label: "Alta", tone: "s4" },
  { key: "medium", label: "Média", tone: "s3" },
  { key: "low", label: "Baixa", tone: "s2" },
] as const;

function SecurityCard({ fw }: { fw: Firewall }) {
  const sec = fw.security;
  if (!sec) {
    return (
      <section className="noc-card">
        <h3><ShieldCheck size={20} /> Segurança</h3>
        <p className="noc-empty">Sem contadores de IPS no Zabbix.</p>
      </section>
    );
  }
  const { totals } = sec;
  const top = Math.max(1, ...SEC_LEVELS.map((level) => totals[level.key]));
  const serious = totals.critical + totals.high;
  return (
    <section className="noc-card noc-sec">
      <h3><ShieldCheck size={20} /> Segurança <small>últimas {sec.windowHours} h</small></h3>
      <div className="noc-sec-big">
        <div className="tone-good"><span>Ataques bloqueados</span><strong>{totals.blocked.toLocaleString("pt-BR")}</strong></div>
        <div className={serious ? "tone-warning" : ""}><span>Intrusões detectadas</span><strong>{totals.detected.toLocaleString("pt-BR")}</strong></div>
      </div>
      <ul className="noc-sec-levels">
        {SEC_LEVELS.map((level) => (
          <li key={level.key} className={level.tone}>
            <span>{level.label}</span>
            <div className="noc-hbar" aria-hidden="true"><i style={{ width: `${totals[level.key] ? Math.max(2, (totals[level.key] / top) * 100) : 0}%` }} /></div>
            <b>{totals[level.key].toLocaleString("pt-BR")}</b>
          </li>
        ))}
      </ul>
      <div className="noc-fill noc-sec-chart" aria-label="Intrusões detectadas por hora">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sec.hourly} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
            <XAxis dataKey="t" hide />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.06)" }}
              contentStyle={{ background: "#0b1430", border: "1px solid #2c3a5a", borderRadius: 8, color: "#eef2fb" }}
              labelFormatter={(t) => `${new Date(Number(t)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
              formatter={(value, key) => [Number(value).toLocaleString("pt-BR"), key === "detected" ? "Detectadas" : "Bloqueadas"]}
            />
            <Bar dataKey="detected" fill="#3987e5" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <small className="noc-sec-foot">
        Detecções por hora · antivírus {totals.antivirus.toLocaleString("pt-BR")}{sec.ipsDatabase ? ` · base IPS ${sec.ipsDatabase.replace(/\(.*\)/, "").trim()}` : ""}
      </small>
    </section>
  );
}

function InternetPage({ data }: { data: NocData }) {
  const fw = data.firewalls[0];
  const trafficById = new Map((data.traffic?.links || []).map((link) => [link.id, link]));
  const temps = (fw?.sensors || []).filter((sensor) => sensor.kind === "temp" && sensor.value !== null);
  const maxTemp = temps.length ? Math.max(...temps.map((sensor) => sensor.value || 0)) : null;
  const psu = (fw?.sensors || []).filter((sensor) => sensor.kind === "psu");
  const fans = (fw?.sensors || []).filter((sensor) => sensor.kind === "fan");
  const alarms = (fw?.sensors || []).filter((sensor) => sensor.alarm);

  return (
    <div className="noc-page noc-internet">
      <div className="noc-links">
        {data.links.map((link) => {
          const sd = fw?.sdwan.find((entry) => entry.member === link.member);
          const usageTone = !link.online ? "critical" : (link.usagePercent ?? 0) >= 90 ? "critical" : (link.usagePercent ?? 0) >= 70 ? "warning" : "good";
          return (
            <section key={link.id} className={`noc-card noc-link tone-${link.online ? "good" : "critical"}`}>
              <header>
                <h3>{link.name}</h3>
                <em className={`tone-${link.online ? "good" : "critical"}`}>{link.online ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {link.online ? "Online" : "Offline"}</em>
              </header>
              <div className="noc-link-now">
                <div><span><ArrowDown size={15} className="noc-in" /> Download</span><strong>{rate(link.inBps)}</strong></div>
                <div><span><ArrowUp size={15} className="noc-out" /> Upload</span><strong>{rate(link.outBps)}</strong></div>
                <div className={`noc-link-usage tone-${usageTone}`}><span>Uso</span><strong>{pct(link.usagePercent)}</strong><small>de {link.contractedMbps >= 1000 ? `${link.contractedMbps / 1000} Gbps` : `${link.contractedMbps} Mbps`}</small></div>
              </div>
              <div className="noc-fill"><TrafficMini series={trafficById.get(link.id)?.series || []} height="100%" /></div>
              <dl className="noc-sdwan">
                <div><dt>Latência</dt><dd>{sd?.latencyMs ?? link.latencyMs ?? "—"} ms</dd></div>
                <div><dt>Jitter</dt><dd>{sd?.jitterMs ?? "—"} ms</dd></div>
                <div><dt>Perda</dt><dd className={(sd?.loss ?? link.lossPercent ?? 0) > 0 ? "bad" : ""}>{sd?.loss ?? link.lossPercent ?? "—"}%</dd></div>
                <div><dt>SD-WAN</dt><dd>{sd ? (sd.alive ? "Ativo" : "Falhou") : "—"}</dd></div>
              </dl>
            </section>
          );
        })}
      </div>

      {fw ? (
        <div className="noc-fw">
          <section className="noc-card">
            <h3><Shield size={20} /> {fw.name} <small>{fw.haMode} · {fw.haGroup} · no ar há {uptime(fw.uptimeSec)}</small></h3>
            <div className="noc-fw-main">
              <Meter label="CPU" value={fw.cpu} icon={<Cpu size={15} />} />
              <Meter label="Memória" value={fw.memory} icon={<MemoryStick size={15} />} />
              <div className="noc-big-stat"><span>Sessões ativas</span><strong>{(fw.sessions ?? 0).toLocaleString("pt-BR")}</strong></div>
              <div className="noc-big-stat"><span>Usuários SSL-VPN</span><strong>{fw.sslVpnUsers ?? "—"}</strong></div>
            </div>
            <div className="noc-ha-nodes">
              {fw.nodes.map((node, index) => (
                <div key={node.hostname} className={`noc-ha-node ${node.synced === false ? "tone-critical" : "tone-good"}`}>
                  <strong>{node.hostname} <em>{index === 0 ? "Principal" : "Secundário"}</em></strong>
                  <span>CPU {pct(node.cpu)} · Mem {pct(node.memory)} · {(node.sessions ?? 0).toLocaleString("pt-BR")} sessões</span>
                  <small>{node.synced === false ? <><XCircle size={13} /> Fora de sincronia</> : <><CheckCircle2 size={13} /> Sincronizado</>}</small>
                </div>
              ))}
            </div>
          </section>
          <section className="noc-card">
            <h3><Zap size={20} /> Túneis VPN <small>{fw.tunnels.filter((tunnel) => tunnel.up).length}/{fw.tunnels.length} ativos</small></h3>
            <ul className="noc-tunnels">
              {fw.tunnels.map((tunnel) => (
                <li key={tunnel.name} className={tunnel.up ? "tone-good" : "tone-critical"}>
                  {tunnel.up ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <strong>{tunnel.name}</strong>
                  <span>{tunnel.up ? (tunnel.total > 1 ? `${tunnel.up}/${tunnel.total} fases` : "Ativo") : "Caído"}</span>
                </li>
              ))}
            </ul>
          </section>
          <SecurityCard fw={fw} />
          <section className="noc-card">
            <h3><Thermometer size={20} /> Hardware do firewall</h3>
            <div className="noc-hw-grid single">
              <div className={alarms.length ? "tone-critical" : "tone-good"}><span>Alarmes</span><strong>{alarms.length ? alarms.length : "Nenhum"}</strong></div>
              <div><span>Maior temperatura</span><strong>{maxTemp === null ? "—" : `${Math.round(maxTemp)} °C`}</strong></div>
              <div className={psu.some((sensor) => sensor.alarm) ? "tone-critical" : "tone-good"}><span>Fontes</span><strong>{psu.filter((sensor) => !sensor.alarm).length}/{psu.length} OK</strong></div>
              <div className={fans.some((sensor) => sensor.alarm) ? "tone-critical" : "tone-good"}><span>Ventoinhas</span><strong>{fans.filter((sensor) => !sensor.alarm).length}/{fans.length} OK</strong></div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function GroupPage({ data, keys }: { data: NocData; keys: string[] }) {
  const groups = keys.map((key) => data.groups.find((group) => group.key === key)).filter(Boolean) as NocGroup[];
  if (!groups.length) return <div className="noc-page"><p className="noc-empty">Grupo não encontrado no Zabbix.</p></div>;
  return (
    <div className={`noc-page noc-groups count-${groups.length}`}>
      {groups.map((group) => (
        <section key={group.key} className="noc-group">
          {groups.length > 1 ? <h3 className="noc-group-title">{group.title}</h3> : null}
          <GroupHeader group={group} />
          <HostGrid group={group} compact={groups.length > 1 && group.total > 30} />
        </section>
      ))}
    </div>
  );
}

function ServersPage({ data }: { data: NocData }) {
  const servers = data.groups.find((group) => group.key === "servidores");
  return (
    <div className="noc-page noc-servers">
      <div className="noc-servers-left">
        {servers ? <GroupHeader group={servers} /> : null}
        {servers ? <HostGrid group={servers} /> : <p className="noc-empty">Grupo de servidores não encontrado.</p>}
      </div>
      <div className="noc-servers-right">
        {data.hardware.map((hw) => (
          <section key={hw.id} className={`noc-card noc-hw tone-${hw.health === "ok" ? "good" : hw.health}`}>
            <h3><HardDrive size={18} /> {hw.name} <em>{toneIcon(hw.health === "ok" ? "good" : hw.health, 15)} {hw.health === "ok" ? "Saudável" : hw.health === "critical" ? "Crítico" : hw.health === "warning" ? "Atenção" : "Sem dados"}</em></h3>
            <small>{hw.model}</small>
            <div className="noc-hw-grid">
              <div className={hw.psu.ok < hw.psu.total ? "tone-critical" : "tone-good"}><span>Fontes</span><strong>{hw.psu.ok}/{hw.psu.total}</strong></div>
              <div className={hw.fans.ok < hw.fans.total ? "tone-critical" : "tone-good"}><span>Ventoinhas</span><strong>{hw.fans.ok}/{hw.fans.total}</strong></div>
              <div className={hw.disks.ok < hw.disks.total || hw.disks.smartAlerts ? "tone-critical" : "tone-good"}><span>Discos</span><strong>{hw.disks.ok}/{hw.disks.total}</strong></div>
              <div className={hw.raid === "ok" ? "tone-good" : "tone-critical"}><span>RAID</span><strong>{hw.raid === "ok" ? "OK" : hw.raid === "unknown" ? "—" : "Falha"}</strong></div>
              {hw.temps.slice(0, 2).map((temp) => (
                <div key={temp.name}><span>{temp.name.replace(/ Temp( Value)?$/i, "").replace("System Board ", "")}</span><strong>{temp.value ?? "—"} °C</strong></div>
              ))}
            </div>
          </section>
        ))}
        {data.routers.map((router) => (
          <section key={router.id} className="noc-card noc-hw">
            <h3><Network size={18} /> {router.name}</h3>
            <small>{router.model} · no ar há {uptime(router.uptimeSec)}</small>
            <div className="noc-fw-main">
              <Meter label="CPU" value={router.cpu} icon={<Cpu size={15} />} />
              <Meter label="Memória" value={router.memory} icon={<MemoryStick size={15} />} />
              <div className="noc-big-stat"><span>Temperatura</span><strong>{router.temperature ?? "—"} °C</strong></div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ---------- Pagina de uma controladora UniFi ---------- */

const total = (device: { txBps: number | null; rxBps: number | null }) => (device.txBps || 0) + (device.rxBps || 0);
const satisfactionTone = (value: number | null) => (value === null ? "unknown" : value >= 80 ? "good" : value >= 60 ? "warning" : "critical");
const onlineTone = (online: number, count: number) => (!count ? "unknown" : online === count ? "good" : online / count < 0.5 ? "critical" : "warning");

function HBarList({ rows, empty }: { rows: { label: string; count: number }[]; empty: string }) {
  if (!rows.length) return <p className="noc-empty">{empty}</p>;
  const top = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ul className="noc-ssid-list">
      {rows.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
          <div className="noc-hbar" aria-hidden="true"><i style={{ width: `${(row.count / top) * 100}%` }} /></div>
          <b>{row.count.toLocaleString("pt-BR")}</b>
        </li>
      ))}
    </ul>
  );
}

function ApTile({ ap, busiest, compact }: { ap: UnifiAp; busiest: number; compact: boolean }) {
  const busy = Math.max(0, ...ap.radios.map((radio) => radio.utilization ?? 0));
  const tone = !ap.online ? "critical" : busy >= 80 || (ap.satisfaction !== null && ap.satisfaction < 60) ? "warning" : "good";
  return (
    <div className={`noc-sw tone-${tone}`} title={`${ap.name} · ${ap.model} · ${ap.site}${total(ap) ? ` · tráfego ${rate(total(ap))}` : ""}${ap.version ? ` · firmware ${ap.version}` : ""}${ap.uptimeSec ? ` · ligada há ${uptime(ap.uptimeSec)}` : ""}`}>
      <strong>{tone === "critical" ? <WifiOff size={13} /> : toneIcon(tone, 13)} {ap.name}</strong>
      {ap.online ? (
        <>
          <div className="noc-sw-ports" aria-label={`${ap.clients} clientes`}><i style={{ width: `${(ap.clients / busiest) * 100}%` }} /></div>
          <small>
            <b>{ap.clients}</b> cli · {ap.radios.map((radio) => pct(radio.utilization)).join(" / ") || "—"}
            {!compact && total(ap) ? ` · ${rate(total(ap))}` : ""}
          </small>
        </>
      ) : (
        <small className="noc-sw-off">DESCONECTADA</small>
      )}
    </div>
  );
}

function SwitchTile({ sw }: { sw: UnifiSwitch }) {
  const tone = !sw.online ? "critical" : (sw.cpu ?? 0) >= 90 || (sw.temperature ?? 0) >= 75 ? "warning" : "good";
  const usage = sw.portsTotal ? (sw.portsUp / sw.portsTotal) * 100 : 0;
  return (
    <div className={`noc-sw tone-${tone}`} title={`${sw.name} · ${sw.model} · ${sw.site}${sw.uplink ? ` · uplink ${sw.uplink}` : ""}${sw.version ? ` · firmware ${sw.version}` : ""}`}>
      <strong>{tone === "critical" ? <WifiOff size={13} /> : toneIcon(tone, 13)} {sw.name}</strong>
      {sw.online ? (
        <>
          <div className="noc-sw-ports" aria-label={`${sw.portsUp} de ${sw.portsTotal} portas ativas`}><i style={{ width: `${usage}%` }} /></div>
          <small>
            <b>{sw.portsUp}/{sw.portsTotal}</b> portas · <Zap size={11} /> {Math.round(sw.poeWatts)} W · CPU {pct(sw.cpu)}
            {sw.temperature !== null ? ` · ${Math.round(sw.temperature)} °C` : ""}
          </small>
        </>
      ) : (
        <small className="noc-sw-off">DESCONECTADO</small>
      )}
    </div>
  );
}

const gridSize = (count: number) => (count > 60 ? "size-xxs" : count > 40 ? "size-xs" : count > 20 ? "size-sm" : "size-md");

function ControllerPage({ controller }: { controller: UnifiController }) {
  if (!controller.ok) {
    return (
      <div className="noc-page noc-unifi">
        <section className="noc-card noc-ctrl-down">
          <XCircle size={48} />
          <h3>Controladora {controller.name} sem resposta</h3>
          <p>{controller.message}</p>
          <small>{controller.via === "zabbix" ? "Lida pelo Zabbix (item NOC: resumo da controladora UniFi)." : "Acessada direto pelo portal. Veja o botão Wi-Fi no Painel NOC."}</small>
        </section>
      </div>
    );
  }

  const apsOnline = controller.aps.filter((ap) => ap.online).length;
  const swOnline = controller.switches.filter((sw) => sw.online).length;
  const apFocus = controller.aps.length >= controller.switches.length;
  const busiest = Math.max(1, ...controller.aps.map((ap) => ap.clients));
  const poe = controller.switches.reduce((sum, sw) => sum + sw.poeWatts, 0);
  const traffic = controller.traffic.txBps + controller.traffic.rxBps;
  const upgrades = controller.aps.filter((ap) => ap.upgradable).length + controller.switches.filter((sw) => sw.upgradable).length;
  const congested = controller.aps
    .filter((ap) => ap.online)
    .flatMap((ap) => ap.radios.filter((radio) => (radio.utilization ?? 0) >= 70).map((radio) => ({ ap: ap.name, ...radio })))
    .sort((a, b) => (b.utilization ?? 0) - (a.utilization ?? 0));
  const apTone = onlineTone(apsOnline, controller.aps.length);
  const swTone = onlineTone(swOnline, controller.switches.length);
  const satTone = satisfactionTone(controller.clients.satisfaction);

  return (
    <div className="noc-page noc-unifi">
      <div className="noc-group-head noc-ctrl-head">
        <div>
          <span>Clientes conectados</span>
          <strong>{controller.clients.total.toLocaleString("pt-BR")}</strong>
          <small>{controller.clients.wireless.toLocaleString("pt-BR")} Wi-Fi · {controller.clients.wired.toLocaleString("pt-BR")} cabo{controller.clients.guests ? ` · ${controller.clients.guests} convidados` : ""}</small>
        </div>
        <div className={`tone-${apTone}`}>
          <span>Antenas</span>
          <strong>{apsOnline}/{controller.aps.length}</strong>
          <small>{toneIcon(apTone, 13)} {controller.aps.length - apsOnline ? `${controller.aps.length - apsOnline} desconectada(s)` : "todas online"}</small>
        </div>
        <div className={`tone-${swTone}`}>
          <span>Switches</span>
          <strong>{swOnline}/{controller.switches.length}</strong>
          <small>{controller.switches.length ? <>{toneIcon(swTone, 13)} PoE {Math.round(poe).toLocaleString("pt-BR")} W</> : "nenhum nesta controladora"}</small>
        </div>
        <div>
          <span>Tráfego agora</span>
          <strong>{traffic ? rate(traffic) : "—"}</strong>
          <small>somando as antenas</small>
        </div>
        <div className={`tone-${satTone}`}>
          <span>Experiência Wi-Fi</span>
          <strong>{controller.clients.satisfaction === null ? "—" : `${controller.clients.satisfaction}%`}</strong>
          <small>satisfação média dos clientes</small>
        </div>
        <div className={controller.alarms.length || upgrades ? "tone-warning" : "tone-good"}>
          <span>Alarmes (7 dias)</span>
          <strong>{controller.alarms.length}</strong>
          <small>{upgrades ? `${upgrades} com firmware novo` : `UniFi ${controller.version}`}</small>
        </div>
      </div>

      <div className="noc-unifi-body">
        <section className="noc-card noc-unifi-switches">
          {apFocus ? (
            <>
              <h3><Radio size={20} /> Antenas <small>clientes · uso do canal 2,4 / 5 GHz · tráfego</small></h3>
              <div className={`noc-swgrid ${gridSize(controller.aps.length)}`}>
                {controller.aps.map((ap) => <ApTile key={ap.id} ap={ap} busiest={busiest} compact={controller.aps.length > 60} />)}
              </div>
            </>
          ) : (
            <>
              <h3><Network size={20} /> Switches <small>portas ativas · PoE · CPU · temperatura</small></h3>
              <div className={`noc-swgrid ${gridSize(controller.switches.length)}`}>
                {controller.switches.map((sw) => <SwitchTile key={sw.id} sw={sw} />)}
              </div>
            </>
          )}
        </section>

        <div className="noc-unifi-side noc-ctrl-side">
          <section className="noc-card">
            <h3><Wifi size={20} /> Clientes por banda</h3>
            <HBarList rows={controller.clients.byBand.map((entry) => ({ label: entry.band, count: entry.count }))} empty="Sem clientes no Wi-Fi." />
          </section>
          <section className="noc-card">
            <h3><Wifi size={20} /> Redes Wi-Fi</h3>
            <HBarList rows={controller.clients.bySsid.slice(0, 5).map((entry) => ({ label: entry.ssid, count: entry.count }))} empty="Sem clientes no Wi-Fi." />
          </section>
          {apFocus && controller.switches.length ? (
            <section className="noc-card">
              <h3><Network size={20} /> Switches <small>{swOnline}/{controller.switches.length} online</small></h3>
              <ul className="noc-mini-list">
                {[...controller.switches].sort((a, b) => Number(a.online) - Number(b.online)).slice(0, 5).map((sw) => (
                  <li key={sw.id} className={`tone-${sw.online ? "good" : "critical"}`}>
                    {sw.online ? <CheckCircle2 size={14} /> : <WifiOff size={14} />}
                    <span>{sw.name}</span>
                    <b>{sw.online ? `${sw.portsUp}/${sw.portsTotal} portas` : "desconectado"}</b>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {!apFocus && controller.aps.length ? (
            <section className="noc-card">
              <h3><Radio size={20} /> Antenas <small>{apsOnline}/{controller.aps.length} online</small></h3>
              <ul className="noc-mini-list">
                {controller.aps.slice(0, 5).map((ap) => (
                  <li key={ap.id} className={`tone-${ap.online ? "good" : "critical"}`}>
                    {ap.online ? <CheckCircle2 size={14} /> : <WifiOff size={14} />}
                    <span>{ap.name}</span>
                    <b>{ap.online ? `${ap.clients} clientes` : "desconectada"}</b>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="noc-card">
            <h3><AlertTriangle size={20} /> Canais congestionados <small>uso acima de 70%</small></h3>
            {congested.length ? (
              <ul className="noc-mini-list">
                {congested.slice(0, 5).map((entry) => (
                  <li key={`${entry.ap}-${entry.band}`} className={(entry.utilization ?? 0) >= 85 ? "tone-critical" : "tone-warning"}>
                    <AlertTriangle size={14} />
                    <span>{entry.ap}</span>
                    <b>{entry.band} canal {entry.channel ?? "—"} · {pct(entry.utilization)}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="noc-all-clear small"><ShieldCheck size={20} /> Nenhum canal congestionado</p>
            )}
          </section>
          <section className="noc-card noc-unifi-alarms">
            <h3><AlertTriangle size={20} /> Alarmes recentes</h3>
            {controller.alarms.length ? (
              <ol>
                {controller.alarms.slice(0, 4).map((alarm) => (
                  <li key={alarm.id}>
                    <span>{alarm.message}</span>
                    <time>{alarm.time ? `há ${duration(alarm.time)}` : ""}</time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="noc-all-clear small"><ShieldCheck size={20} /> Nenhum alarme nos últimos 7 dias</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}


type ControllerForm = { id: string; name: string; url: string; user: string; password: string; hasPassword: boolean; sites: string; insecureTls: boolean };
type TestResult = { id: string; name: string; ok: boolean; message: string; viaZabbix?: boolean };
type UnifiSettingsData = {
  source: "env" | "panel" | "none";
  envConfigured: boolean;
  controllers: Omit<ControllerForm, "password">[];
  updatedAt: string;
  updatedBy: string;
  results?: TestResult[];
};

const newController = (index: number): ControllerForm => ({
  id: "",
  name: index === 0 ? "Switches" : "Antenas",
  url: index === 0 ? "https://10.0.0.56:8443" : "https://192.168.2.10:8443",
  user: "",
  password: "",
  hasPassword: false,
  sites: "",
  insecureTls: true,
});

function UnifiSettings({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [list, setList] = useState<ControllerForm[]>([]);
  const [info, setInfo] = useState<UnifiSettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [error, setError] = useState("");

  async function test() {
    setTesting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/unifi/test`, { method: "POST", headers: headersFor() });
      const payload = (await response.json().catch(() => ({}))) as { results?: TestResult[]; message?: string };
      if (!response.ok) throw new Error(payload.message || `Servidor respondeu ${response.status}`);
      setResults(payload.results || []);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Falha ao testar.");
    } finally {
      setTesting(false);
    }
  }

  function apply(data: UnifiSettingsData) {
    setInfo(data);
    setList(data.controllers.length ? data.controllers.map((entry) => ({ ...entry, password: "" })) : [newController(0)]);
  }

  useEffect(() => {
    fetch(`${API_BASE}/api/unifi/settings`, { headers: headersFor() })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((payload as { message?: string }).message || `Servidor respondeu ${response.status}`);
        return payload as UnifiSettingsData;
      })
      .then((data) => {
        apply(data);
        if (data.controllers.length) test(); // mostra ja se a conexao atual funciona e, se nao, o motivo
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Falha ao carregar."));
  }, []);

  const update = (index: number, patch: Partial<ControllerForm>) => setList((value) => value.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setResults([]);
    try {
      const response = await fetch(`${API_BASE}/api/unifi/settings`, {
        method: "PUT",
        headers: { ...headersFor(), "Content-Type": "application/json" },
        body: JSON.stringify({ controllers: list.map(({ hasPassword: _hasPassword, ...entry }) => entry) }),
      });
      const payload = (await response.json().catch(() => ({}))) as UnifiSettingsData & { message?: string };
      if (!response.ok) throw new Error(payload.message || `Servidor respondeu ${response.status}`);
      apply(payload);
      setResults(payload.results || []);
      if (payload.results?.some((result) => result.ok)) onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="noc-modal-backdrop" onClick={onClose} />
      <form className="noc-modal" role="dialog" aria-modal="true" aria-label="Configurar controladoras UniFi" onSubmit={save}>
        <header>
          <h3><Wifi size={20} /> Controladoras UniFi</h3>
          <button type="button" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </header>
        <p className="noc-modal-hint">
          Use uma conta local "View Only" em cada controladora (sem 2FA e sem conta UI.com). As senhas ficam criptografadas no servidor e não são exibidas de novo.
          {info?.source === "env" ? " Hoje vale o que está nas variáveis UNIFI_* do servidor; o que você salvar aqui passa a valer no lugar delas." : ""}
        </p>
        {list.map((entry, index) => {
          const result = results.find((item) => item.id === entry.id);
          return (
            <fieldset key={entry.id || `novo-${index}`} className="noc-ctrl">
              <legend>
                <input aria-label="Nome da controladora" value={entry.name} maxLength={60} onChange={(event) => update(index, { name: event.target.value })} />
                <button type="button" aria-label={`Remover ${entry.name}`} title="Remover" onClick={() => setList((value) => value.filter((_, position) => position !== index))}>
                  <X size={15} />
                </button>
              </legend>
              <label>
                <span>Endereço</span>
                <input value={entry.url} placeholder="https://10.0.0.56:8443" onChange={(event) => update(index, { url: event.target.value })} />
              </label>
              <div className="noc-modal-row">
                <label>
                  <span>Usuário</span>
                  <input value={entry.user} autoComplete="off" onChange={(event) => update(index, { user: event.target.value })} />
                </label>
                <label>
                  <span>Senha {entry.hasPassword ? "(em branco = manter)" : ""}</span>
                  <input type="password" value={entry.password} autoComplete="new-password" onChange={(event) => update(index, { password: event.target.value })} />
                </label>
              </div>
              <div className="noc-modal-row">
                <label>
                  <span>Sites (vazio = todos)</span>
                  <input value={entry.sites} onChange={(event) => update(index, { sites: event.target.value })} />
                </label>
                <label className="check">
                  <input type="checkbox" checked={entry.insecureTls} onChange={(event) => update(index, { insecureTls: event.target.checked })} />
                  <span>Aceitar certificado autoassinado</span>
                </label>
              </div>
              {testing && entry.id ? <p className="noc-modal-result">Testando...</p> : null}
              {!testing && result ? <p className={`noc-modal-result ${result.ok ? "ok" : "bad"}`}>{result.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {result.message}</p> : null}
            </fieldset>
          );
        })}
        <button type="button" className="noc-ctrl-add" onClick={() => setList((value) => [...value, newController(value.length)])}>
          + Adicionar controladora
        </button>
        {results.some((result) => result.viaZabbix) ? (
          <fieldset className="noc-ctrl">
            <legend>Lidas pelo Zabbix</legend>
            <p className="noc-modal-hint">
              Para redes que o portal não alcança. Configure no Zabbix, no host da controladora, as macros {"{$NOC.UNIFI.USER}"} e {"{$NOC.UNIFI.PASSWORD}"} (item "NOC: resumo da controladora UniFi").
            </p>
            {results.filter((result) => result.viaZabbix).map((result) => (
              <p key={result.id} className={`noc-modal-result ${result.ok ? "ok" : "bad"}`}>
                {result.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />} <b>{result.name}</b>: {result.message.replace(/^Via Zabbix: /, "")}
              </p>
            ))}
          </fieldset>
        ) : null}
        {error ? <p className="noc-modal-result bad"><XCircle size={16} /> {error}</p> : null}
        {info?.updatedAt ? <small className="noc-modal-meta">Última alteração por {info.updatedBy} em {new Date(info.updatedAt).toLocaleString("pt-BR")}</small> : null}
        <footer>
          <button type="button" onClick={onClose}>Fechar</button>
          {info?.controllers.length ? <button type="button" disabled={testing || saving} onClick={test}>Testar conexões</button> : null}
          <button type="submit" className="primary" disabled={saving}>{saving ? "Salvando e testando..." : "Salvar e testar"}</button>
        </footer>
      </form>
    </>
  );
}

/* ---------- Painel (carrossel) ---------- */

export function NocWall({ tvKey, kiosk = false, isAdmin = false }: { tvKey?: string; kiosk?: boolean; isAdmin?: boolean }) {
  const [showUnifi, setShowUnifi] = useState(false);
  const [data, setData] = useState<NocData | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [intervalSec, setIntervalSec] = useState(() => {
    const fromUrl = Number(new URLSearchParams(window.location.search).get("intervalo"));
    if (fromUrl >= 5) return fromUrl;
    try {
      return Number(window.localStorage.getItem(INTERVAL_KEY)) || 20;
    } catch {
      return 20;
    }
  });
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Uma pagina por controladora UniFi; a lista so muda quando entra/sai uma controladora.
  const computed = buildPages(data);
  const pagesKey = computed.map((entry) => `${entry.id}|${entry.title}`).join(",");
  const pages = useMemo(() => computed, [pagesKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const pageCount = pages.length;

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/noc`, { headers: headersFor(tvKey) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((payload as { message?: string }).message || `Servidor respondeu ${response.status}`);
      setData(payload as NocData);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao atualizar.");
    }
  }, [tvKey]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10000); // quase tempo real; o servidor segura o Zabbix com cache curto
    return () => window.clearInterval(timer);
  }, [load]);

  // Relogio + avanco do carrossel.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
      if (!paused) setElapsed((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    if (elapsed >= intervalSec) {
      setElapsed(0);
      setPage((value) => (value + 1) % pageCount);
    }
  }, [elapsed, intervalSec, pageCount]);

  const go = useCallback((delta: number) => {
    setElapsed(0);
    setPage((value) => (value + delta + pageCount) % pageCount);
  }, [pageCount]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, .noc-modal")) return;
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
      }
      if (/^[1-9]$/.test(event.key) && Number(event.key) <= pageCount) {
        setElapsed(0);
        setPage(Number(event.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, pageCount]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(INTERVAL_KEY, String(intervalSec));
    } catch {
      /* preferencia local */
    }
  }, [intervalSec]);

  const current = pages[page % pageCount];
  const critical = data ? data.problems.filter((problem) => problem.severity >= 4).length : 0;
  const warnings = data ? data.problems.filter((problem) => problem.severity >= 2 && problem.severity < 4).length : 0;
  const globalTone = !data ? "unknown" : critical ? "critical" : warnings ? "warning" : "good";
  const stale = data ? Date.now() - new Date(data.generatedAt).getTime() > 120000 : false;

  return (
    <div className={`noc-root ${kiosk || fullscreen ? "noc-kiosk" : ""}`} ref={rootRef}>
      <header className="noc-top">
        <div className="noc-brand">
          <span className="noc-logo"><Flower2 size={22} /></span>
          <div>
            <strong>Paineiras NOC</strong>
            <small>Central de monitoramento</small>
          </div>
        </div>
        <div className="noc-page-title">
          <current.icon size={22} />
          <h1>{current.title}</h1>
          <div className="noc-dots" role="tablist" aria-label="Páginas do painel">
            {pages.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={entry.id === current.id}
                aria-label={entry.title}
                title={`${index + 1}. ${entry.title}`}
                className={entry.id === current.id ? "active" : ""}
                onClick={() => {
                  setElapsed(0);
                  setPage(index);
                }}
              />
            ))}
          </div>
        </div>
        <div className={`noc-global tone-${globalTone}`}>
          {toneIcon(globalTone, 22)}
          <div>
            <strong>{globalTone === "good" ? "Tudo operando" : globalTone === "critical" ? `${critical} críticos` : globalTone === "warning" ? `${warnings} alertas` : "Carregando"}</strong>
            <small>{data ? `${data.problems.length} problemas no Zabbix` : "aguardando dados"}</small>
          </div>
        </div>
        <div className="noc-clock">
          <strong>{now.toLocaleTimeString("pt-BR")}</strong>
          <small>{now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</small>
        </div>
        <div className="noc-controls">
          <button type="button" aria-label="Página anterior" title="Anterior (←)" onClick={() => go(-1)}><ChevronLeft size={18} /></button>
          <button type="button" aria-label={paused ? "Continuar" : "Pausar"} title={paused ? "Continuar (espaço)" : "Pausar (espaço)"} onClick={() => setPaused((value) => !value)}>
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button type="button" aria-label="Próxima página" title="Próxima (→)" onClick={() => go(1)}><ChevronRight size={18} /></button>
          <select value={intervalSec} onChange={(event) => setIntervalSec(Number(event.target.value))} aria-label="Tempo por página">
            {[10, 15, 20, 30, 45, 60].map((value) => <option key={value} value={value}>{value}s</option>)}
          </select>
          {!kiosk && isAdmin ? (
            <button type="button" className={data && !data.unifiConfigured ? "noc-attn" : ""} aria-label="Configurar controladora UniFi" title="Configurar controladora UniFi" onClick={() => setShowUnifi(true)}>
              <Wifi size={18} />
            </button>
          ) : null}
          {!kiosk ? (
            <button type="button" aria-label="Tela cheia" title="Tela cheia" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : rootRef.current?.requestFullscreen?.())}>
              {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          ) : null}
        </div>
      </header>
      <div className="noc-progress" aria-hidden="true"><i style={{ width: `${paused ? 100 : (elapsed / intervalSec) * 100}%` }} className={paused ? "paused" : ""} /></div>

      <div className="noc-stale-slot">
        {error || stale ? (
          <p className="noc-stale"><AlertTriangle size={16} /> {error ? `Falha ao atualizar: ${error}` : "Dados com mais de 2 minutos"} · exibindo a última leitura</p>
        ) : null}
      </div>

      <main className="noc-stage">
        {!data ? (
          <p className="noc-empty">Carregando dados do Zabbix...</p>
        ) : current.id === "overview" ? (
          <OverviewPage data={data} />
        ) : current.id === "internet" ? (
          <InternetPage data={data} />
        ) : current.controllerId ? (
          (() => {
            const controller = data.unifi?.controllers.find((entry) => entry.id === current.controllerId);
            return controller ? <ControllerPage controller={controller} /> : <p className="noc-empty">Controladora indisponível.</p>;
          })()
        ) : current.id === "antenas" ? (
          <GroupPage data={data} keys={["antenas"]} />
        ) : current.id === "servidores" ? (
          <ServersPage data={data} />
        ) : (
          <GroupPage data={data} keys={["videowall"]} />
        )}
      </main>

      <footer className="noc-ticker" aria-label="Alertas ativos">
        <span className="noc-ticker-label"><AlertOctagon size={16} /> Alertas</span>
        <div className="noc-ticker-track">
          {data?.problems.length ? (
            <div className="noc-ticker-run" style={{ animationDuration: `${Math.max(40, data.problems.length * 4)}s` }}>
              {[...data.problems.slice(0, 40), ...data.problems.slice(0, 40)].map((problem, index) => (
                <span key={`${problem.id}-${index}`} className={SEVERITY[problem.severity]?.tone}>
                  <b>{SEVERITY[problem.severity]?.label}</b> {problem.host} · {translateProblem(problem.name)} · há {duration(problem.since)}
                </span>
              ))}
            </div>
          ) : (
            <span className="noc-ticker-ok"><ShieldCheck size={16} /> Nenhum alerta ativo</span>
          )}
        </div>
        <span className="noc-updated">{data ? `atualizado ${new Date(data.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span>
      </footer>
      {showUnifi ? <UnifiSettings onClose={() => setShowUnifi(false)} onSaved={() => window.setTimeout(load, 1500)} /> : null}
    </div>
  );
}
