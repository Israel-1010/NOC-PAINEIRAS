import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Camera,
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
  WifiOff,
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
type NocData = {
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

type PageId = "overview" | "internet" | "switches" | "antenas" | "servidores" | "cftv";
const PAGES: { id: PageId; title: string; icon: typeof Activity }[] = [
  { id: "overview", title: "Visão geral", icon: Activity },
  { id: "internet", title: "Internet e Firewall", icon: Globe },
  { id: "switches", title: "Switches", icon: Network },
  { id: "antenas", title: "Antenas UniFi", icon: Radio },
  { id: "servidores", title: "Servidores e Datacenter", icon: Server },
  { id: "cftv", title: "CFTV e Videowall", icon: Camera },
];

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
    .replace(/: Link down/i, ": link caído");
}

function HostGrid({ group, compact }: { group: NocGroup; compact?: boolean }) {
  const allDown = group.total > 3 && group.down === group.total;
  const size = group.total > 60 ? "xs" : group.total > 36 ? "sm" : "md";
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

  return (
    <div className="noc-page noc-overview">
      <div className="noc-domains">
        <DomainTile title="Internet" icon={<Globe size={18} />} tone={linkTone} main={`${linksOnline}/${data.links.length}`} sub={`↓ ${rate(totalIn)} · ↑ ${rate(totalOut)}`} />
        <DomainTile
          title="Firewall"
          icon={<Shield size={18} />}
          tone={fwTone}
          main={fw ? pct(fw.cpu) : "—"}
          sub={fw ? `CPU · mem ${pct(fw.memory)} · ${(fw.sessions ?? 0).toLocaleString("pt-BR")} sessões` : "Sem FortiGate no Zabbix"}
        />
        {groupTile("switches", "Switches", <Network size={18} />)}
        {groupTile("antenas", "Antenas UniFi", <Radio size={18} />)}
        {groupTile("servidores", "Servidores", <Server size={18} />, data.hardware.length ? `hardware Dell ${data.hardware.length - hwBad}/${data.hardware.length} ok` : "")}
        {groupTile("cftv", "CFTV", <Camera size={18} />)}
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
          <section className="noc-card">
            <h3><Thermometer size={20} /> Hardware do firewall</h3>
            <div className="noc-hw-grid">
              <div className={alarms.length ? "tone-critical" : "tone-good"}><span>Alarmes</span><strong>{alarms.length ? alarms.length : "Nenhum"}</strong></div>
              <div><span>Maior temperatura</span><strong>{maxTemp === null ? "—" : `${Math.round(maxTemp)} °C`}</strong></div>
              <div className={psu.some((sensor) => sensor.alarm) ? "tone-critical" : "tone-good"}><span>Fontes</span><strong>{psu.filter((sensor) => !sensor.alarm).length}/{psu.length} OK</strong></div>
              <div className={fans.some((sensor) => sensor.alarm) ? "tone-critical" : "tone-good"}><span>Ventoinhas</span><strong>{fans.filter((sensor) => !sensor.alarm).length}/{fans.length} OK</strong></div>
              <div><span>Intrusões detectadas</span><strong>{fw.ips.detected ?? "—"}</strong></div>
              <div><span>Intrusões bloqueadas</span><strong>{fw.ips.blocked ?? "—"}</strong></div>
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

/* ---------- Painel (carrossel) ---------- */

export function NocWall({ tvKey, kiosk = false }: { tvKey?: string; kiosk?: boolean }) {
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
    const timer = window.setInterval(load, 30000);
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
      setPage((value) => (value + 1) % PAGES.length);
    }
  }, [elapsed, intervalSec]);

  const go = useCallback((delta: number) => {
    setElapsed(0);
    setPage((value) => (value + delta + PAGES.length) % PAGES.length);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
      }
      if (/^[1-6]$/.test(event.key)) {
        setElapsed(0);
        setPage(Number(event.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

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

  const current = PAGES[page];
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
            {PAGES.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={index === page}
                aria-label={entry.title}
                title={`${index + 1}. ${entry.title}`}
                className={index === page ? "active" : ""}
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
        ) : current.id === "switches" ? (
          <GroupPage data={data} keys={["switches"]} />
        ) : current.id === "antenas" ? (
          <GroupPage data={data} keys={["antenas"]} />
        ) : current.id === "servidores" ? (
          <ServersPage data={data} />
        ) : (
          <GroupPage data={data} keys={["cftv", "videowall"]} />
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
    </div>
  );
}
