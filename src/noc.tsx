import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  KeyRound,
  Maximize2,
  MemoryStick,
  Minimize2,
  MonitorPlay,
  Network,
  Pause,
  Play,
  Printer,
  Radio,
  ScanFace,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
  Wifi,
  WifiOff,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { defenderName } from "./defenderNames";

/* ---------- Tipos (espelham server/nocData.ts) ---------- */

type NocHost = { id: string; name: string; ip: string; up: boolean | null; latencyMs: number | null; loss: number | null; problems: number; set: string; role: string };
type NocGroup = { key: string; title: string; total: number; up: number; down: number; unknown: number; hosts: NocHost[] };
type NocProblem = { id: string; host: string; hostId: string; name: string; severity: number; since: string; category: string };
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
  // Sem leitura de trafego ha mais de 10 min (o Zabbix parou de coletar este link).
  stale?: boolean;
  configured?: boolean;
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
  events: { time: string; key: string; message: string; site: string }[];
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
type BeszelSystem = {
  id: string;
  name: string;
  host: string;
  status: string;
  cpu: number | null;
  memPct: number | null;
  memUsedGb: number | null;
  memTotalGb: number | null;
  diskPct: number | null;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
  netUpBps: number | null;
  netDownBps: number | null;
  load: number[];
  threads: number | null;
  uptimeSec: number | null;
  agent: string;
  history: { t: number; cpu: number | null; mem: number | null }[];
};
type BeszelContainer = { id: string; system: string; name: string; image: string; status: string; health: number; cpu: number | null; memoryMb: number | null };
type Beszel = { systems: BeszelSystem[]; containers: BeszelContainer[]; containersError?: string };
// FortiAnalyzer (24 h); sem checkedAt enquanto a primeira consulta nao termina.
type Analyzer = {
  loading: boolean;
  error: string;
  checkedAt: string;
  windowHours: number;
  totals: { bandwidth: number; sessions: number; sessionsBlocked: number; threatsBlocked: number; threatIncidents: number };
  threats: { name: string; type: string; level: string; incidents: number; blocked: number }[];
  sources: { ip: string; name: string; iface: string; device: string; bandwidth: number; sessions: number; threatsBlocked: number }[];
  destinations: { ip: string; app: string; bandwidth: number; upload: number; download: number; sessions: number }[];
  applications: { name: string; category: string; risk: string; users: number; bandwidth: number; sessionsBlocked: number }[];
  categories: { name: string; bandwidth: number; sessionsBlocked: number; threatsBlocked: number }[];
  countries: { name: string; bandwidth: number; sessions: number; sessionsBlocked: number; threatsBlocked: number }[];
  vpnUsers?: { login: string; name: string; department: string; type: string; remoteIp: string; lastSeen: string; durationSec: number; bandwidth: number; connections: number }[];
  alerts?: { id: string; time: string; severity: string; handler: string; subject: string; source: string; user: string; device: string; count: number; action: boolean }[];
  antivirus?: {
    total: number;
    realVirus: number;
    items: { reason: string; virus: string; srcip: string; iface: string; site: string; file: string; action: string; count: number; lastSeen: string }[];
  };
  alertsError?: string;
  antivirusError?: string;
};
// Microsoft Defender (Graph); sem checkedAt enquanto a primeira consulta nao termina.
type Defender = {
  loading: boolean;
  error: string;
  checkedAt: string;
  secureScore: { current: number; max: number } | null;
  incidents: { id: string; severity: string; title: string; created: string; updated: string; assigned: string }[];
  alerts: { id: string; time: string; severity: string; status: string; source: string; title: string; device: string; user: string; file: string; url: string }[];
  devices: { total: number; secured: number; deactivated: number; unknown: number; threat: { name: string; user: string; state: string }[] };
  malware: { name: string; category: string; severity: string; lastSeen: string; devices: string[] }[];
};
// Quem esta na SSL-VPN agora (item SNMP do FortiGate no Zabbix), com nome do AD.
type VpnLive = { checkedAt: string; users: { login: string; name: string; department: string; remoteIp: string; connectedSec: number; bytesIn: number; bytesOut: number }[] };
type NocData = {
  vpn?: VpnLive | null;
  analyzer?: Analyzer | null;
  defender?: Defender | null;
  beszel?: Beszel | null;
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
  // Estado de cada fonte (Zabbix, UniFi, Beszel, FortiAnalyzer, Defender); at = ultima leitura boa.
  sources?: { id: string; label: string; ok: boolean; error: string; at: string }[];
  errors: string[];
};

// Fonte fora do ar (o painel avisa em vez de tratar lista vazia como "tudo certo").
const sourceDown = (data: NocData | null, id: string) => data?.sources?.find((source) => source.id === id && !source.ok) || null;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Pagina do carrossel: short = nome no chip do topo; seconds = tempo base na tela (ajustado pelo estado).
type NocPage = { id: string; title: string; short: string; icon: typeof Activity; seconds: number; controllerId?: string };
const PAGE = {
  overview: { id: "overview", title: "Visão geral", short: "Geral", icon: Activity, seconds: 25 },
  internet: { id: "internet", title: "Internet, firewall e VPN", short: "Internet", icon: Globe, seconds: 20 },
  antenas: { id: "antenas", title: "Antenas (ping do Zabbix)", short: "Antenas", icon: Radio, seconds: 15 },
  seguranca: { id: "seguranca", title: "Segurança", short: "Segurança", icon: ShieldAlert, seconds: 20 },
  servidores: { id: "servidores", title: "Servidores e Datacenter", short: "Servidores", icon: Server, seconds: 20 },
  acesso: { id: "acesso", title: "Acesso e atendimento", short: "Acesso", icon: ScanFace, seconds: 15 },
  trafego: { id: "trafego", title: "Tráfego da internet · 24 h", short: "Tráfego", icon: Network, seconds: 15 },
} satisfies Record<string, NocPage>;

// Grupos da pagina "Acesso e atendimento" (o videowall entrou aqui; antes tinha pagina propria).
const ACCESS_KEYS = ["catracas", "totens", "impressoras", "videowall"];

// Ordem: Visao geral, Internet, UniFi, Visao geral de novo, Seguranca, Servidores, Acesso e Trafego
// (a Visao geral volta no meio da volta para o "esta tudo bem?" nao esperar o carrossel inteiro).
function buildPages(data: NocData | null): NocPage[] {
  const controllers = data?.unifi?.controllers || [];
  const unifiPages: NocPage[] = controllers.map((controller) => ({
    id: `unifi:${controller.id}`,
    title: `UniFi · ${controller.name}`,
    short: controller.name,
    icon: controller.aps.length >= controller.switches.length ? Radio : Network,
    seconds: 15,
    controllerId: controller.id,
  }));
  // Todas as controladoras fora: a pagina continua no carrossel dizendo isso (em vez de sumir).
  if (!controllers.length && sourceDown(data, "unifi")) unifiPages.push({ id: "unifi-down", title: "UniFi", short: "UniFi", icon: Radio, seconds: 10 });
  // Com antenas vindas da UniFi, a grade de ping do Zabbix vira redundante.
  const hasUnifiAps = controllers.some((controller) => controller.ok && controller.aps.length);
  // Paginas de grupo so aparecem se o grupo existir e tiver hosts (ex.: grupo de ping das antenas foi esvaziado).
  const hasHosts = (key: string) => Boolean(data?.groups.find((group) => group.key === key)?.total);
  const pages: NocPage[] = [PAGE.overview, PAGE.internet, ...unifiPages];
  if (!hasUnifiAps && hasHosts("antenas")) pages.push(PAGE.antenas);
  pages.push({ ...PAGE.overview, id: "overview-2", seconds: 15 });
  if (data?.analyzer || data?.defender) pages.push(PAGE.seguranca);
  if (!data || hasHosts("servidores") || data.hardware.length || data.beszel?.systems.length) pages.push(PAGE.servidores);
  if (ACCESS_KEYS.some(hasHosts)) pages.push(PAGE.acesso);
  if (data?.analyzer) pages.push(PAGE.trafego);
  return pages;
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

// textMain: o numero grande e um estado escrito ("1 túnel caído"), em letra um pouco menor.
function DomainTile({ title, icon, tone, main, sub, textMain = false, children }: { title: string; icon: React.ReactNode; tone: string; main: string; sub: string; textMain?: boolean; children?: React.ReactNode }) {
  return (
    <section className={`noc-domain tone-${tone}`}>
      <header>
        <span>{icon} {title}</span>
        <em>{toneIcon(tone, 16)} {toneLabel(tone)}</em>
      </header>
      <strong className={textMain ? "is-text" : undefined}>{main}</strong>
      <small>{sub}</small>
      {children}
    </section>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  links: "Internet",
  switches: "Switch",
  servidores: "Servidor",
  videowall: "Videowall",
  catracas: "Catraca",
  totens: "Totem",
  impressoras: "Impressora",
  antenas: "Antena",
  cftv: "CFTV",
  outros: "Rede",
};
// Problema leve sem mudanca ha mais de 7 dias sai da lista principal (vai para o rodape de antigos);
// Alta e Desastre ficam sempre na lista, por mais antigos que sejam.
const RECENT_MS = 7 * 24 * 3600 * 1000;
const isRecent = (problem: NocProblem) => Date.now() - new Date(problem.since).getTime() < RECENT_MS;
const isMainProblem = (problem: NocProblem) => problem.severity >= 4 || isRecent(problem);

function ProblemList({ problems, limit, zabbixDown = false }: { problems: NocProblem[]; limit: number; zabbixDown?: boolean }) {
  if (!problems.length) {
    return zabbixDown ? (
      <p className="noc-all-clear tone-unknown"><AlertTriangle size={28} /> Zabbix sem resposta: lista de problemas indisponível</p>
    ) : (
      <p className="noc-all-clear"><ShieldCheck size={28} /> Nenhum problema ativo no Zabbix</p>
    );
  }
  const recent = problems.filter(isMainProblem);
  const old = problems.filter((problem) => !isMainProblem(problem));
  return (
    <div className="noc-problems-wrap">
      {recent.length ? (
        <ol className="noc-problems">
          {recent.slice(0, limit).map((problem) => (
            <li key={problem.id} className={SEVERITY[problem.severity]?.tone}>
              <span className="noc-sev">{SEVERITY[problem.severity]?.label}</span>
              <div className="noc-problem-main">
                <strong>{problem.host}</strong>
                <small>{CATEGORY_LABEL[problem.category] || "Rede"} · {translateProblem(problem.name)}</small>
              </div>
              <time>há {duration(problem.since)}</time>
            </li>
          ))}
          {recent.length > limit ? <li className="noc-more">+ {recent.length - limit} problemas</li> : null}
        </ol>
      ) : (
        <p className="noc-all-clear small"><ShieldCheck size={22} /> Nenhum problema grave ou dos últimos 7 dias</p>
      )}
      {old.length ? (
        <div className="noc-problems-old">
          <span>{old.length} {old.length === 1 ? "problema leve antigo" : "problemas leves antigos"} · sem mudança há mais de 7 dias</span>
          <p>{old.slice(0, 14).map((problem) => problem.host).join(" · ")}{old.length > 14 ? " · …" : ""}</p>
        </div>
      ) : null}
    </div>
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

// Grupo pequeno (ex.: videowall): cartoes com nome inteiro e detalhes. Na pagina inteira (ate 24)
// ocupam a tela em 3 colunas, ou 4 quando passam de 18.
function DeviceCards({ group, problems, page = false }: { group: NocGroup; problems: NocProblem[]; page?: boolean }) {
  return (
    <div className={`noc-devcards${page ? " is-page" : ""}${page && group.total > 18 ? " cols-4" : ""}`}>
      {group.hosts.map((host) => {
        const tone = host.up === null ? "unknown" : host.up ? (host.loss && host.loss > 0 ? "warning" : "good") : "critical";
        const down = problems.find((problem) => problem.hostId === host.id && /icmp|ping/i.test(problem.name));
        return (
          <div key={host.id} className={`noc-devcard tone-${tone}`}>
            <span className="noc-devcard-dot" aria-hidden="true">{tone === "critical" ? <WifiOff size={18} /> : toneIcon(tone, 18)}</span>
            <div className="noc-devcard-main">
              <strong title={host.name}>{host.name}</strong>
              <small>{host.ip || "sem IP"}</small>
            </div>
            <div className="noc-devcard-state">
              {host.up ? (
                <>
                  <b>{host.latencyMs ?? "—"} ms</b>
                  <small>{host.loss ? `perda ${host.loss}%` : "online"}</small>
                </>
              ) : host.up === false ? (
                <>
                  <b>OFFLINE</b>
                  <small>{down ? `há ${duration(down.since)}` : "sem resposta"}</small>
                </>
              ) : (
                <small>sem dados</small>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Catracas (conjuntos), totens e impressoras ---------- */

const hostTone = (host: NocHost) => (host.up === null ? "unknown" : host.up ? (host.loss && host.loss > 0 ? "warning" : "good") : "critical");

// Conjunto = hosts com a mesma tag "conjunto" (ex.: Catraca 1 = 2 controladoras + 2 faciais).
function SetCard({ name, hosts, problems }: { name: string; hosts: NocHost[]; problems: NocProblem[] }) {
  const up = hosts.filter((host) => host.up === true).length;
  const tone = up === hosts.length ? "good" : up === 0 ? "critical" : "warning";
  const label = tone === "good" ? "Operando" : tone === "critical" ? "Fora do ar" : `${hosts.length - up} com falha`;
  const ordered = [...hosts].sort((a, b) => (a.role || a.name).localeCompare(b.role || b.name, "pt-BR", { numeric: true }));
  return (
    <section className={`noc-set tone-${tone}`}>
      <header>
        <strong>{name}</strong>
        <em>{toneIcon(tone, 15)} {label}</em>
      </header>
      <ul>
        {ordered.map((host) => {
          const hTone = hostTone(host);
          const down = problems.find((problem) => problem.hostId === host.id && /icmp|ping/i.test(problem.name));
          return (
            <li key={host.id} className={`tone-${hTone}`} title={`${host.name} · ${host.ip}`}>
              <span className="noc-dev-dot" aria-hidden="true" />
              <span className="noc-set-role">{host.role || host.name}</span>
              <span className="noc-set-ip">{host.ip}</span>
              <b>{host.up ? `${host.latencyMs ?? "—"} ms` : host.up === false ? (down ? `OFFLINE há ${duration(down.since)}` : "OFFLINE") : "sem dados"}</b>
            </li>
          );
        })}
      </ul>
    </section>
  );
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
      <div className={group.down ? "bad" : ""}><span>Sem resposta</span><strong>{group.down}</strong></div>
      <div><span>Total</span><strong>{group.total}</strong></div>
      <div><span>Disponibilidade</span><strong>{pct(availability)}</strong></div>
      <div className="status">{toneIcon(tone, 26)} {toneLabel(tone)}</div>
    </div>
  );
}

function TrafficMini({ series, height = 110 }: { series: { t: number; in: number | null; out: number | null }[]; height?: number | "100%" }) {
  if (!series.length) return <p className="noc-empty">Sem histórico</p>;
  // Buraco (null) = periodo sem coleta no Zabbix; nao liga os lados com reta.
  if (series.filter((point) => point.in !== null || point.out !== null).length < 2) {
    return <p className="noc-empty">Poucos dados nesta janela: o Zabbix ficou sem coletar e o histórico está sendo retomado.</p>;
  }
  // Maior intervalo sem coleta (30 min ou mais) vira uma legenda no grafico.
  let gap: { from: number; to: number } | null = null;
  let runStart: number | null = null;
  series.forEach((point, index) => {
    const empty = point.in === null && point.out === null;
    if (empty && runStart === null) runStart = index;
    if ((!empty || index === series.length - 1) && runStart !== null) {
      const from = series[Math.max(0, runStart - 1)].t;
      const to = empty ? point.t : point.t;
      if (to - from >= 30 * 60000 && (!gap || to - from > gap.to - gap.from)) gap = { from, to };
      runStart = null;
    }
  });
  const hhmm = (t: number) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const gapNote = gap as { from: number; to: number } | null;
  return (
    <>
    {gapNote ? <span className="noc-gap-note">sem coleta do Zabbix {hhmm(gapNote.from)}–{hhmm(gapNote.to)}</span> : null}
    <ResponsiveContainer width="100%" height={height} minHeight={60}>
      <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: "#0b1430", border: "1px solid #2c3a5a", borderRadius: 8, color: "#eef2fb" }}
          labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          formatter={(value, key) => [rate(Number(value) * 1e6), key === "in" ? "Download" : "Upload"]}
        />
        <Area type="monotone" dataKey="in" stroke="#3987e5" strokeWidth={2} fill="#3987e5" fillOpacity={0.18} isAnimationActive={false} />
        <Area type="monotone" dataKey="out" stroke="#d95926" strokeWidth={2} fill="#d95926" fillOpacity={0.12} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
    </>
  );
}

/* ---------- Seguranca e trafego (FortiAnalyzer, 24 h) ---------- */
const fmtBytes = (bytes: number) => {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2).replace(".", ",")} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1).replace(".", ",")} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.round(bytes / 1e3)} kB`;
};
const fmtCount = (value: number) =>
  value >= 1e6 ? `${(value / 1e6).toFixed(1).replace(".", ",")} mi` : value >= 1e4 ? `${Math.round(value / 1e3)} mil` : value.toLocaleString("pt-BR");
const THREAT_NAMES: Record<string, string> = {
  "failed-connection": "Conexões que falharam",
  "blocked-connection": "Conexões bloqueadas pelo firewall",
  "DNS.PTR.Records.Scan": "Varredura de DNS reverso (IPS)",
};
const COUNTRY_NAMES: Record<string, string> = {
  "United States": "Estados Unidos", Brazil: "Brasil", Reserved: "Rede privada/reservada", Mexico: "México", Germany: "Alemanha",
  Ireland: "Irlanda", Netherlands: "Holanda", "United Kingdom": "Reino Unido", France: "França", Japan: "Japão", China: "China",
  Canada: "Canadá", Chile: "Chile", Argentina: "Argentina", Singapore: "Singapura", Spain: "Espanha", Russia: "Rússia",
};
const CATEGORY_NAMES: Record<string, string> = {
  "Information Technology": "Tecnologia da informação", "Content Servers": "Servidores de conteúdo", "Streaming Media and Download": "Streaming e downloads",
  "Search Engines and Portals": "Buscadores e portais", "Social Networking": "Redes sociais", Business: "Negócios", "News and Media": "Notícias",
  Advertising: "Publicidade", Education: "Educação", "Web-based Email": "E-mail web", Games: "Jogos", Shopping: "Compras",
  "Finance and Banking": "Bancos e finanças", "Government and Legal Organizations": "Governo", Entertainment: "Entretenimento", Unrated: "Sem categoria",
};
const LEVEL_NAMES: Record<string, string> = { critical: "Crítico", high: "Alto", medium: "Médio", low: "Baixo", info: "Info" };
const threatTone = (level: string) => (/critical|high/i.test(level) ? "critical" : /medium/i.test(level) ? "warning" : "muted");

// Lista com barra horizontal (uma serie so, valor ao lado; barra proporcional ao maior da lista).
function BarList<T>({ items, value, label, detail, extra }: { items: T[]; value: (item: T) => number; label: (item: T) => string; detail?: (item: T) => string; extra?: (item: T) => React.ReactNode }) {
  const top = Math.max(1, ...items.map(value));
  return (
    <ul className="noc-faz-list">
      {items.map((item, index) => (
        <li key={`${label(item)}-${index}`}>
          <div className="noc-faz-row">
            <span className="noc-faz-name" title={label(item)}>{label(item)}</span>
            {extra ? extra(item) : null}
            <b>{fmtBytes(value(item))}</b>
          </div>
          {detail ? <small>{detail(item)}</small> : null}
          <div className="noc-hbar" aria-hidden="true"><i style={{ width: `${Math.max(2, (value(item) / top) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Alertas de seguranca e antivirus (FortiAnalyzer) ---------- */
const ALERT_NAMES: [RegExp, string][] = [
  [/brute force/i, "Força bruta no login"],
  [/disk full/i, "Disco do FortiAnalyzer cheio"],
  [/outbreak alert/i, "Ataque conhecido (Outbreak)"],
  [/malicious code/i, "Código malicioso"],
  [/risky destination/i, "Acesso a destino de risco"],
  [/risky app/i, "Aplicativo de risco"],
  [/botnet/i, "Botnet detectada"],
  [/compromised/i, "Máquina possivelmente comprometida"],
];
const alertName = (handler: string, subject: string) => ALERT_NAMES.find(([pattern]) => pattern.test(`${handler} ${subject}`))?.[1] || handler || "Alerta";
const AV_REASONS: [RegExp, string][] = [
  [/unknown content-encoding/i, "Codificação desconhecida (bloqueio preventivo)"],
  [/oversize/i, "Arquivo grande demais para verificar"],
  [/infected|virus/i, "Arquivo com vírus"],
];
const avReason = (reason: string) => AV_REASONS.find(([pattern]) => pattern.test(reason))?.[1] || reason;
const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
// Alertas sem acao, resumidos por tipo (o FortiAnalyzer gera dezenas por hora).
const NOISE_KINDS: [RegExp, string][] = [
  [/outbreak|malicious code|botnet/i, "Ataques da internet barrados no firewall"],
  [/risky destination/i, "Acessos a sites de risco (bloqueados ou avisados)"],
  [/risky app/i, "Uso de aplicativos de risco"],
];

type AlertItem = NonNullable<Analyzer["alerts"]>[number];
type AlertGroup = { key: string; first: AlertItem; severity: string; last: string; alerts: number; events: number; sources: Set<string>; users: Set<string> };

// Um ataque que dispara varios handlers vira uma linha; forca bruta (de varios IPs) tambem.
function groupAlerts(alerts: AlertItem[]) {
  const groups = new Map<string, AlertGroup>();
  for (const alert of alerts) {
    const key = /brute/i.test(alert.handler) ? "brute" : `${alert.source}|${alert.subject}`;
    const group = groups.get(key) || { key, first: alert, severity: alert.severity, last: alert.time, alerts: 0, events: 0, sources: new Set<string>(), users: new Set<string>() };
    group.alerts++;
    group.events += Math.max(1, alert.count);
    if (alert.source) group.sources.add(alert.source);
    if (alert.user) group.users.add(alert.user);
    if ((SEVERITY_RANK[alert.severity] ?? 4) < (SEVERITY_RANK[group.severity] ?? 4)) group.severity = alert.severity;
    if (alert.time > group.last) group.last = alert.time;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4) || b.last.localeCompare(a.last));
}

const groupDetail = (group: AlertGroup) => {
  if (group.key === "brute") {
    const users = [...group.users];
    return `${group.sources.size} IPs de fora tentando logins: ${users.slice(0, 4).join(", ")}${users.length > 4 ? ` e +${users.length - 4}` : ""}`;
  }
  return [group.first.subject, group.first.source && `origem ${group.first.source}`].filter(Boolean).join(" · ");
};

/* ---------- Microsoft Defender (XDR + Intune) ---------- */
const DEFENDER_LEVEL: Record<string, string> = { high: "Alto", medium: "Médio", low: "Baixo", informational: "Info" };
const DEFENDER_RANK: Record<string, number> = { high: 0, medium: 1, low: 2, informational: 3 };
const defenderTone = (severity: string) => (severity === "high" ? "critical" : severity === "medium" ? "warning" : "muted");
const daysAgo = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return days <= 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`;
};

/* ---------- VPN e acesso remoto ---------- */
const fmtSince = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")}`;
};

// "hoje 12:22", "ontem 21:37" ou "24/10 20:05" (data real, sem confundir as ultimas 24 h com "hoje").
const fmtWhen = (iso: string) => {
  if (!iso) return "—";
  const date = new Date(iso);
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const day = (value: Date) => value.toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (day(date) === day(new Date())) return `hoje ${time}`;
  if (day(date) === day(yesterday)) return `ontem ${time}`;
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
};

function GroupPage({ data, keys }: { data: NocData; keys: string[] }) {
  const groups = keys.map((key) => data.groups.find((group) => group.key === key)).filter(Boolean) as NocGroup[];
  if (!groups.length) return <div className="noc-page"><p className="noc-empty">{sourceDown(data, "zabbix") ? "Zabbix sem resposta: estado destes aparelhos desconhecido." : "Grupo não encontrado no Zabbix."}</p></div>;
  return (
    <div className={`noc-page noc-groups count-${groups.length}`}>
      {groups.map((group) => (
        <section key={group.key} className="noc-group">
          {groups.length > 1 ? <h3 className="noc-group-title">{group.title}</h3> : null}
          <GroupHeader group={group} />
          {group.total <= (groups.length === 1 ? 24 : 12) ? <DeviceCards group={group} problems={data.problems} page={groups.length === 1} /> : <HostGrid group={group} compact={groups.length > 1 && group.total > 30} />}
        </section>
      ))}
    </div>
  );
}

// iDRAC sem o sensor (0 de 0) fica cinza "sem dado", nunca verde.
const partTone = (part: { ok: number; total: number }, alert = false) => (!part.total ? "tone-unknown" : part.ok < part.total || alert ? "tone-critical" : "tone-good");
const partCount = (part: { ok: number; total: number }) => (part.total ? `${part.ok}/${part.total}` : "sem dado");
const RAID_STATE: Record<string, { tone: string; label: string }> = {
  ok: { tone: "tone-good", label: "OK" },
  warning: { tone: "tone-warning", label: "Degradado" },
  critical: { tone: "tone-critical", label: "Falha" },
  unknown: { tone: "tone-unknown", label: "sem dado" },
};

const satisfactionTone = (value: number | null) => (value === null ? "unknown" : value >= 80 ? "good" : value >= 60 ? "warning" : "critical");
const onlineTone = (online: number, count: number) => (!count ? "unknown" : online === count ? "good" : online / count < 0.5 ? "critical" : "warning");

// Log da controladora em portugues: "AP[UniFi_Lutas] was disconnected" -> "Antena UniFi_Lutas desconectou".
function translateUnifiEvent(message: string, names?: Map<string, string>) {
  const device = /^(AP|Switch|Gateway|UDM|USG|USW|UAP)\[(.+?)\]\s*(.*)$/i.exec(message);
  if (!device) return message;
  // A controladora as vezes identifica o aparelho pelo MAC: troca pelo nome.
  if (names && /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(device[2])) device[2] = names.get(device[2].toLowerCase()) || device[2];
  const kind = /^(AP|UAP)$/i.test(device[1]) ? "Antena" : /^(Switch|USW)$/i.test(device[1]) ? "Switch" : "Gateway";
  const action = device[3]
    .replace(/^was disconnected.*$/i, "desconectou")
    .replace(/^was connected.*$/i, "voltou")
    .replace(/^was restarted.*$/i, "reiniciou")
    .replace(/^was upgraded.*$/i, "atualizou o firmware")
    .replace(/^was adopted.*$/i, "foi adotada")
    .replace(/^was deleted.*$/i, "foi removida")
    .replace(/^lost contact.*$/i, "perdeu contato")
    .replace(/^detected.*$/i, "detectou uma anomalia");
  return `${kind} ${device[2]} ${action}`;
}
const isDropEvent = (event: { key: string; message: string }) => /Lost_Contact|Disconnected/i.test(event.key) || /was disconnected/i.test(event.message);
const eventTime = (iso: string) => {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return date.toLocaleString("pt-BR", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/* ---------- Estado de cada pagina (chips do topo, estado global e tempo no carrossel) ---------- */

type Tone = "good" | "warning" | "critical" | "unknown";
// Pior estado da lista; "unknown" so quando nada tem leitura.
function worst(...tones: string[]): Tone {
  if (tones.includes("critical")) return "critical";
  if (tones.includes("warning")) return "warning";
  if (tones.length && tones.every((tone) => tone === "unknown")) return "unknown";
  return "good";
}

// Peso do estado no tempo da pagina: verde passa rapido, critico fica mais na tela.
const TONE_FACTOR: Record<Tone, number> = { good: 0.6, warning: 1, critical: 1.5, unknown: 1 };

// Algo fora do normal, para as listas "Com problema" (criticos primeiro).
type Issue = { key: string; tone: "critical" | "warning"; title: string; detail: string; when?: string };

const RECENT_ALERT_MS = 2 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
const downSince = (data: NocData, hostId: string) => {
  const down = data.problems.find((problem) => problem.hostId === hostId && /icmp|ping/i.test(problem.name));
  return down ? `há ${duration(down.since)}` : "";
};

function zabbixTone(data: NocData): Tone {
  if (sourceDown(data, "zabbix")) return "unknown";
  return data.problems.some((problem) => problem.severity >= 4) ? "critical" : data.problems.some((problem) => problem.severity >= 2) ? "warning" : "good";
}

function internetSummary(data: NocData) {
  const fw = data.firewalls[0];
  const noLeitura = (link: NocLink) => Boolean(link.stale && link.configured !== false);
  const offline = data.links.filter((link) => !link.online && !noLeitura(link));
  const noData = data.links.filter(noLeitura);
  const saturated = data.links.filter((link) => link.online && !noLeitura(link) && (link.usagePercent ?? 0) >= 90);
  const online = data.links.filter((link) => link.online && !noLeitura(link)).length;
  const linkTone: Tone = !data.links.length ? "unknown" : offline.length === data.links.length ? "critical" : offline.length || noData.length || saturated.length ? "warning" : "good";
  const tunnelsDown = fw ? fw.tunnels.filter((tunnel) => !tunnel.up) : [];
  const hwAlarms = fw ? fw.sensors.filter((sensor) => sensor.alarm) : [];
  const haBroken = fw ? fw.nodes.some((node) => node.synced === false) : false;
  const cpu = fw?.cpu ?? 0;
  const fwTone: Tone = !fw ? "unknown" : haBroken || cpu >= 90 ? "critical" : tunnelsDown.length || cpu >= 70 || hwAlarms.length ? "warning" : "good";
  // O motivo vai em destaque no quadro (antes o numero grande era a CPU e escondia a causa da cor).
  const fwState = !fw
    ? "—"
    : haBroken
      ? "HA fora de sincronia"
      : cpu >= 90
        ? `CPU ${pct(cpu)}`
        : tunnelsDown.length
          ? `${tunnelsDown.length} ${tunnelsDown.length === 1 ? "túnel caído" : "túneis caídos"}`
          : hwAlarms.length
            ? "Alarme de hardware"
            : cpu >= 70
              ? `CPU ${pct(cpu)}`
              : "OK";
  return { fw, online, offline, noData, saturated, linkTone, tunnelsDown, hwAlarms, fwTone, fwState, tone: worst(linkTone, fwTone) };
}

function securitySummary(data: NocData) {
  const analyzer = data.analyzer?.checkedAt ? data.analyzer : null;
  const defender = data.defender?.checkedAt ? data.defender : null;
  const groups = analyzer && !analyzer.alertsError ? groupAlerts((analyzer.alerts || []).filter((alert) => alert.action)) : [];
  const serious = (severity: string) => severity === "critical" || severity === "high";
  // Grave e recente (2 h) deixa vermelho; grave mais antigo so pede atencao (sem vermelho o dia inteiro).
  const urgentRecent = groups.filter((group) => serious(group.severity) && Date.now() - new Date(group.last).getTime() < RECENT_ALERT_MS).length;
  const threats = defender ? defender.devices.threat : [];
  const highIncidents = defender ? defender.incidents.filter((incident) => incident.severity === "high") : [];
  const newHigh = highIncidents.filter((incident) => Date.now() - new Date(incident.created).getTime() < DAY_MS).length;
  const virus = analyzer && !analyzer.antivirusError ? analyzer.antivirus?.realVirus || 0 : 0;
  const critical = urgentRecent + threats.length + newHigh + virus;
  const tone: Tone = !analyzer && !defender ? "unknown" : critical ? "critical" : groups.length || highIncidents.length ? "warning" : "good";
  return { analyzer, defender, groups, urgentRecent, threats, highIncidents, newHigh, virus, critical, tone };
}

function hardwareIssue(hw: Hardware): Issue | null {
  if (hw.health !== "critical" && hw.health !== "warning") return null;
  const parts = [
    hw.psu.ok < hw.psu.total ? `fontes ${hw.psu.ok}/${hw.psu.total}` : "",
    hw.fans.ok < hw.fans.total ? `ventoinhas ${hw.fans.ok}/${hw.fans.total}` : "",
    hw.disks.ok < hw.disks.total || hw.disks.smartAlerts ? `discos ${hw.disks.ok}/${hw.disks.total}${hw.disks.smartAlerts ? ` · ${hw.disks.smartAlerts} com alerta SMART` : ""}` : "",
    hw.raid === "warning" || hw.raid === "critical" ? `RAID ${RAID_STATE[hw.raid].label.toLowerCase()}` : "",
  ].filter(Boolean);
  return { key: `hw-${hw.id}`, tone: hw.health, title: hw.name, detail: parts.join(" · ") || "alerta no iDRAC" };
}

function serversSummary(data: NocData) {
  const group = data.groups.find((entry) => entry.key === "servidores");
  const issues: Issue[] = [];
  for (const host of group?.hosts || []) {
    if (host.up === false) issues.push({ key: `srv-${host.id}`, tone: "critical", title: host.name, detail: "sem resposta ao ping", when: downSince(data, host.id) });
  }
  for (const hw of data.hardware) {
    const issue = hardwareIssue(hw);
    if (issue) issues.push(issue);
  }
  const systems = data.beszel?.systems || [];
  const containers = data.beszel?.containers || [];
  for (const system of systems) {
    if (system.status !== "up") {
      issues.push({ key: `dk-${system.id}`, tone: system.status === "paused" ? "warning" : "critical", title: system.name, detail: system.status === "paused" ? "monitoramento pausado" : "servidor Docker fora do ar" });
      continue;
    }
    const high = [
      (system.diskPct ?? 0) >= 90 ? `disco ${pct(system.diskPct)}` : "",
      (system.memPct ?? 0) >= 92 ? `memória ${pct(system.memPct)}` : "",
      (system.cpu ?? 0) >= 90 ? `CPU ${pct(system.cpu)}` : "",
    ].filter(Boolean);
    if (high.length) issues.push({ key: `dk-${system.id}`, tone: "warning", title: system.name, detail: high.join(" · ") });
  }
  for (const container of containers) {
    if (container.health === 3) issues.push({ key: `ct-${container.id}`, tone: "critical", title: container.name, detail: `container com falha · ${container.system}` });
    else if (container.health === 1) issues.push({ key: `ct-${container.id}`, tone: "warning", title: container.name, detail: `container iniciando · ${container.system}` });
  }
  const tone = worst(
    groupTone(group),
    ...data.hardware.map((hw) => (hw.health === "ok" ? "good" : hw.health)),
    issues.some((issue) => issue.tone === "critical") ? "critical" : issues.length ? "warning" : "good",
  );
  return { group, issues, systems, containers, tone };
}

function accessTone(data: NocData): Tone {
  const groups = ACCESS_KEYS.map((key) => data.groups.find((group) => group.key === key)).filter((group): group is NocGroup => Boolean(group?.total));
  return groups.length ? worst(...groups.map((group) => groupTone(group))) : "unknown";
}

function controllerTone(controller: UnifiController): Tone {
  if (!controller.ok) return "critical";
  return worst(
    onlineTone(controller.aps.filter((ap) => ap.online).length, controller.aps.length),
    onlineTone(controller.switches.filter((sw) => sw.online).length, controller.switches.length),
  );
}

function pageTone(page: NocPage, data: NocData): Tone {
  if (page.controllerId) {
    const controller = data.unifi?.controllers.find((entry) => entry.id === page.controllerId);
    return controller ? controllerTone(controller) : "unknown";
  }
  switch (page.id) {
    case "overview":
    case "overview-2":
      return zabbixTone(data);
    case "internet":
      return internetSummary(data).tone;
    case "seguranca":
      return securitySummary(data).tone;
    case "servidores":
      return serversSummary(data).tone;
    case "acesso":
      return accessTone(data);
    case "antenas":
      return groupTone(data.groups.find((group) => group.key === "antenas"));
    case "unifi-down":
      return "critical";
    default:
      return "unknown";
  }
}

/* ---------- Pecas das paginas guiadas por "com problema" ---------- */

function IssueList({ issues, limit, empty }: { issues: Issue[]; limit: number; empty: string }) {
  if (!issues.length) return <p className="noc-secalerts-ok"><CheckCircle2 size={20} /> {empty}</p>;
  const sorted = [...issues].sort((a, b) => Number(b.tone === "critical") - Number(a.tone === "critical"));
  return (
    <ul className="noc-issues">
      {sorted.slice(0, limit).map((issue) => (
        <li key={issue.key} className={`tone-${issue.tone}`}>
          {issue.tone === "critical" ? <XCircle size={20} /> : <AlertTriangle size={20} />}
          <div className="noc-vpn-who">
            <strong title={issue.title}>{issue.title}</strong>
            <small title={issue.detail}>{issue.detail}</small>
          </div>
          {issue.when ? <b className="noc-secalerts-when">{issue.when}</b> : null}
        </li>
      ))}
      {sorted.length > limit ? <li className="noc-more">+ {sorted.length - limit} com problema</li> : null}
    </ul>
  );
}

// Todos os aparelhos so com nome e cor (com problema primeiro): o detalhe fica na lista "Com problema".
function NameGrid({ items, max = 180 }: { items: { id: string; name: string; tone: string }[]; max?: number }) {
  const rank = (tone: string) => (tone === "critical" ? 0 : tone === "warning" ? 1 : tone === "unknown" ? 2 : 3);
  const sorted = [...items].sort((a, b) => rank(a.tone) - rank(b.tone) || a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  const size = items.length > 120 ? "xs" : items.length > 60 ? "sm" : "md";
  return (
    <div className={`noc-names size-${size}`}>
      {sorted.slice(0, max).map((item) => (
        <span key={item.id} className={`tone-${item.tone}`} title={item.name}>{item.name}</span>
      ))}
      {sorted.length > max ? <span className="noc-names-more">+ {sorted.length - max}</span> : null}
    </div>
  );
}

/* ---------- Paginas ---------- */

function OverviewPage({ data }: { data: NocData }) {
  const group = (key: string) => data.groups.find((entry) => entry.key === key);
  const zabbixDown = Boolean(sourceDown(data, "zabbix"));
  const net = internetSummary(data);
  const sec = securitySummary(data);
  const srv = serversSummary(data);
  const totalIn = data.links.reduce((sum, link) => sum + link.inBps, 0);
  const totalOut = data.links.reduce((sum, link) => sum + link.outBps, 0);
  const severityLine = [5, 4, 3]
    .map((severity) => ({ severity, count: data.problems.filter((problem) => problem.severity === severity).length }))
    .map((entry) => `${SEVERITY[entry.severity].label} ${entry.count}`)
    .join(" · ");
  const combined = useMemo(() => {
    // Soma dos links; se nenhum link tem dado naquele momento, fica null (buraco), e nao zero.
    const series = new Map<number, { t: number; in: number | null; out: number | null }>();
    for (const link of data.traffic?.links || []) {
      for (const point of link.series) {
        const entry = series.get(point.t) || { t: point.t, in: null, out: null };
        if (point.in !== null) entry.in = (entry.in ?? 0) + point.in;
        if (point.out !== null) entry.out = (entry.out ?? 0) + point.out;
        series.set(point.t, entry);
      }
    }
    return Array.from(series.values()).sort((a, b) => a.t - b.t);
  }, [data.traffic]);
  // Pico de download nas 6 h (a serie vem em Mbps).
  const peak = combined.reduce<{ t: number; in: number | null } | null>((best, point) => ((point.in ?? -1) > (best?.in ?? -1) ? point : best), null);

  const groupTile = (key: string, title: string, icon: React.ReactNode) => {
    const entry = group(key);
    return (
      <DomainTile title={title} icon={icon} tone={groupTone(entry)} main={entry ? `${entry.up}/${entry.total}` : "—"} sub={entry ? (entry.down ? `${entry.down} sem resposta` : "todos respondendo") : zabbixDown ? "Sem coleta do Zabbix" : "Grupo não encontrado no Zabbix"}>
        {entry ? <AvailabilityBar group={entry} /> : null}
      </DomainTile>
    );
  };

  // Catracas, totens, impressoras e videowall num quadro so; o texto mostra so a excecao.
  const accessTile = () => {
    const parts = ACCESS_KEYS.map((key) => group(key)).filter((entry): entry is NocGroup => Boolean(entry?.total));
    if (!parts.length) return null;
    const total = parts.reduce((sum, entry) => sum + entry.total, 0);
    const up = parts.reduce((sum, entry) => sum + entry.up, 0);
    const unknown = parts.reduce((sum, entry) => sum + entry.unknown, 0);
    const combinedGroup: NocGroup = { key: "acesso", title: "Acesso e atendimento", total, up, down: total - up - unknown, unknown, hosts: [] };
    const down = parts.filter((entry) => entry.down).map((entry) => `${entry.title.toLowerCase()} ${entry.down} sem resposta`);
    return (
      <DomainTile title="Acesso" icon={<ScanFace size={18} />} tone={accessTone(data)} main={`${up}/${total}`} sub={down.join(" · ") || "catracas, totens, impressoras e videowall ok"}>
        <AvailabilityBar group={combinedGroup} />
      </DomainTile>
    );
  };

  // Antenas e switches: o numero real vem das controladoras UniFi; vale o ping do Zabbix quando a UniFi
  // nao cobre a maior parte dos aparelhos.
  const okControllers = (data.unifi?.controllers || []).filter((controller) => controller.ok);
  const failedControllers = (data.unifi?.controllers || []).filter((controller) => !controller.ok).length;
  const unifiTile = (kind: "aps" | "switches", zabbixKey: string, title: string, icon: React.ReactNode) => {
    const devices: { online: boolean }[] = okControllers.flatMap((controller): { online: boolean }[] => controller[kind]);
    const zabbixTotal = group(zabbixKey)?.total || 0;
    if (!devices.length && !zabbixTotal) return null;
    if (!devices.length || devices.length < zabbixTotal * 0.6) return groupTile(zabbixKey, title, icon);
    const up = devices.filter((device) => device.online).length;
    const unifiGroup: NocGroup = { key: zabbixKey, title, total: devices.length, up, down: devices.length - up, unknown: 0, hosts: [] };
    const label = kind === "aps" ? "desconectada(s)" : "desconectado(s)";
    // Controladora sem resposta deixa o quadro em atencao: parte dos aparelhos esta sem leitura.
    const tone = worst(groupTone(unifiGroup), failedControllers ? "warning" : "good");
    const sub = failedControllers ? `${failedControllers} controladora sem resposta` : devices.length - up ? `${devices.length - up} ${label}` : "todos conectados";
    return (
      <DomainTile title={title} icon={icon} tone={tone} main={`${up}/${devices.length}`} sub={sub}>
        <AvailabilityBar group={unifiGroup} />
      </DomainTile>
    );
  };

  const firstServerIssue = srv.issues.find((issue) => issue.tone === "critical") || srv.issues[0];
  const hwOk = data.hardware.filter((hw) => hw.health === "ok").length;
  const serversGroup = srv.group;

  return (
    <div className="noc-page noc-overview">
      <div className="noc-domains">
        <DomainTile
          title="Internet"
          icon={<Globe size={18} />}
          tone={net.linkTone}
          main={data.links.length ? `${net.online}/${data.links.length}` : "—"}
          sub={
            !data.links.length
              ? zabbixDown ? "Sem coleta do Zabbix" : "Nenhum link configurado"
              : net.offline.length
                ? `${net.offline.map((link) => link.name).join(", ")} offline`
                : net.saturated.length
                  ? `${net.saturated.map((link) => `${link.name} ${pct(link.usagePercent)}`).join(", ")} saturado`
                  : net.noData.length
                    ? `${net.noData.length} sem coleta`
                    : `↓ ${rate(totalIn)} · ↑ ${rate(totalOut)}`
          }
        />
        <DomainTile
          title="Firewall"
          icon={<Shield size={18} />}
          tone={net.fwTone}
          main={net.fwState}
          textMain={net.fwState !== "—"}
          sub={net.fw ? `CPU ${pct(net.fw.cpu)} · memória ${pct(net.fw.memory)}` : zabbixDown ? "Sem coleta do Zabbix" : "Sem FortiGate no Zabbix"}
        />
        {unifiTile("switches", "switches", "Switches", <Network size={18} />)}
        {unifiTile("aps", "antenas", "Antenas UniFi", <Radio size={18} />)}
        <DomainTile
          title="Servidores"
          icon={<Server size={18} />}
          tone={srv.tone}
          main={serversGroup ? `${serversGroup.up}/${serversGroup.total}` : "—"}
          sub={
            firstServerIssue
              ? `${firstServerIssue.title}: ${firstServerIssue.detail}`
              : [data.hardware.length ? `Dell ${hwOk}/${data.hardware.length} ok` : "", srv.containers.length ? `${srv.containers.length} containers ok` : ""].filter(Boolean).join(" · ") || (zabbixDown ? "Sem coleta do Zabbix" : "todos respondendo")
          }
        >
          {serversGroup ? <AvailabilityBar group={serversGroup} /> : null}
        </DomainTile>
        {accessTile()}
        {sec.analyzer || sec.defender ? (
          <DomainTile
            title="Segurança"
            icon={<ShieldAlert size={18} />}
            tone={sec.tone}
            main={sec.critical ? String(sec.critical) : sec.groups.length || sec.highIncidents.length ? String(sec.groups.length + sec.highIncidents.length) : "OK"}
            textMain={!sec.critical && !sec.groups.length && !sec.highIncidents.length}
            sub={sec.critical ? "pede ação agora" : sec.groups.length || sec.highIncidents.length ? "pedem atenção · veja Segurança" : "nada pedindo ação"}
          />
        ) : null}
      </div>

      <div className="noc-overview-bottom">
        <section className="noc-card noc-problems-card">
          <h3>
            <AlertOctagon size={20} /> Problemas ativos
            <small>{zabbixDown ? "Zabbix sem resposta" : severityLine}</small>
          </h3>
          <ProblemList problems={data.problems} limit={10} zabbixDown={zabbixDown} />
        </section>
        <div className="noc-overview-side">
          <section className="noc-card noc-net-now">
            <h3><Globe size={20} /> Internet agora <span className="noc-legend"><i className="in" /> Download <i className="out" /> Upload</span></h3>
            <div className="noc-net-now-figures">
              <div><ArrowDown size={22} className="noc-in" /> <strong>{rate(totalIn)}</strong></div>
              <div><ArrowUp size={22} className="noc-out" /> <strong>{rate(totalOut)}</strong></div>
            </div>
            <div className="noc-fill"><TrafficMini series={combined} height="100%" /></div>
            {peak?.in ? <small className="noc-net-peak">pico de download nas últimas 6 h: {rate(peak.in * 1e6)} às {hhmm(new Date(peak.t).toISOString())}</small> : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function InternetPage({ data }: { data: NocData }) {
  const net = internetSummary(data);
  const fw = net.fw;
  const trafficById = new Map((data.traffic?.links || []).map((link) => [link.id, link]));
  const temps = (fw?.sensors || []).filter((sensor) => sensor.kind === "temp" && sensor.value !== null);
  const maxTemp = temps.length ? Math.max(...temps.map((sensor) => sensor.value || 0)) : null;
  const psu = (fw?.sensors || []).filter((sensor) => sensor.kind === "psu");
  const fans = (fw?.sensors || []).filter((sensor) => sensor.kind === "fan");
  // "0/0 OK" quando o firewall nao informa o sensor engana: vira "sem sensor".
  const sensorCount = (list: Firewall["sensors"]) => (list.length ? `${list.filter((sensor) => !sensor.alarm).length}/${list.length} ok` : "sem sensor");
  const live = data.vpn?.users || [];
  // Sem leitura (nem lista, nem contador do FortiGate) fica "—", nunca "0".
  const liveCount = data.vpn ? live.length : fw?.sslVpnUsers ?? null;
  const VPN_LIMIT = 6;

  if (!data.links.length && !fw) {
    return (
      <div className="noc-page noc-internet">
        <p className="noc-empty">
          <AlertTriangle size={20} /> {sourceDown(data, "zabbix") ? "Zabbix sem resposta: estado dos links e do firewall desconhecido." : "Nenhum link de internet nem FortiGate no Zabbix."}
        </p>
      </div>
    );
  }

  return (
    <div className="noc-page noc-internet">
      <div className="noc-links">
        {data.links.map((link) => {
          const sd = fw?.sdwan.find((entry) => entry.member === link.member);
          // Sem leitura ha mais de 10 min: cinza "sem coleta", nunca "Online" com 0 Mbps.
          const noData = Boolean(link.stale && link.configured !== false);
          const usageTone = noData ? "unknown" : !link.online ? "critical" : (link.usagePercent ?? 0) >= 90 ? "critical" : (link.usagePercent ?? 0) >= 70 ? "warning" : "good";
          const state = noData ? "unknown" : !link.online ? "critical" : usageTone === "critical" ? "warning" : "good";
          return (
            <section key={link.id} className={`noc-card noc-link tone-${state}`}>
              <header>
                <h3>{link.name}</h3>
                <em className={`tone-${state}`}>
                  {noData ? <AlertTriangle size={16} /> : link.online ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {noData ? "Sem coleta" : link.online ? "Online" : "Offline"}
                </em>
              </header>
              <div className="noc-link-now">
                <div><span><ArrowDown size={15} className="noc-in" /> Download</span><strong>{rate(link.inBps)}</strong></div>
                <div><span><ArrowUp size={15} className="noc-out" /> Upload</span><strong>{rate(link.outBps)}</strong></div>
                <div className={`noc-link-usage tone-${usageTone}`}><span>Uso</span><strong>{pct(link.usagePercent)}</strong><small>de {link.contractedMbps >= 1000 ? `${link.contractedMbps / 1000} Gbps` : `${link.contractedMbps} Mbps`}</small></div>
              </div>
              <div className="noc-fill"><TrafficMini series={trafficById.get(link.id)?.series || []} height="100%" /></div>
              <dl className="noc-sdwan">
                <div><dt>Latência</dt><dd>{sd?.latencyMs ?? link.latencyMs ?? "—"}{(sd?.latencyMs ?? link.latencyMs) === null || (sd?.latencyMs ?? link.latencyMs) === undefined ? "" : " ms"}</dd></div>
                <div><dt>Perda</dt><dd className={(sd?.loss ?? link.lossPercent ?? 0) > 0 ? "bad" : ""}>{sd?.loss ?? link.lossPercent ?? "—"}{(sd?.loss ?? link.lossPercent) === null || (sd?.loss ?? link.lossPercent) === undefined ? "" : "%"}</dd></div>
                <div><dt>SD-WAN</dt><dd>{sd ? (sd.alive ? "Ativo" : "Falhou") : "—"}</dd></div>
              </dl>
            </section>
          );
        })}
      </div>

      <div className="noc-fw noc-fw3">
        {fw ? (
          <section className={`noc-card tone-${net.fwTone}`}>
            <h3><Shield size={20} /> {fw.name} <small>{net.fwState === "OK" ? "operando normalmente" : net.fwState}</small></h3>
            <div className="noc-fw-main">
              <Meter label="CPU" value={fw.cpu} icon={<Cpu size={15} />} />
              <Meter label="Memória" value={fw.memory} icon={<MemoryStick size={15} />} />
              <div className="noc-big-stat"><span>Sessões ativas</span><strong>{fw.sessions === null ? "—" : fw.sessions.toLocaleString("pt-BR")}</strong></div>
            </div>
            <div className="noc-ha-nodes">
              {fw.nodes.map((node, index) => (
                <div key={node.hostname} className={`noc-ha-node ${node.synced === false ? "tone-critical" : "tone-good"}`}>
                  <strong>{node.hostname} <em>{index === 0 ? "Principal" : "Secundário"}</em></strong>
                  <small>{node.synced === false ? <><XCircle size={13} /> Fora de sincronia</> : <><CheckCircle2 size={13} /> Sincronizado</>}</small>
                </div>
              ))}
            </div>
            <p className={`noc-fw-line tone-${net.hwAlarms.length ? "critical" : "good"}`}>
              <Thermometer size={16} /> {net.hwAlarms.length ? `${net.hwAlarms.length} alarme(s) de hardware` : "Hardware ok"} · {maxTemp === null ? "—" : `${Math.round(maxTemp)} °C`} · fontes {sensorCount(psu)} · ventoinhas {sensorCount(fans)}
            </p>
            {data.routers.map((router) => (
              <p key={router.id} className={`noc-fw-line tone-${(router.cpu ?? 0) >= 90 ? "critical" : (router.cpu ?? 0) >= 70 ? "warning" : "good"}`}>
                <Network size={16} /> {router.name} · CPU {pct(router.cpu)} · memória {pct(router.memory)}{router.temperature !== null ? ` · ${router.temperature} °C` : ""}
              </p>
            ))}
          </section>
        ) : null}
        {fw ? (
          <section className="noc-card">
            <h3><Zap size={20} /> Túneis VPN <small>{fw.tunnels.length - net.tunnelsDown.length}/{fw.tunnels.length} ativos</small></h3>
            {/* Todos os tuneis, caidos primeiro (o servidor ja ordena); o que nao cabe vira "+N". */}
            {fw.tunnels.length ? (
              <ul className="noc-tunnels">
                {fw.tunnels.slice(0, 9).map((tunnel) => (
                  <li key={tunnel.name} className={tunnel.up ? "tone-good" : "tone-critical"}>
                    {tunnel.up ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <strong>{tunnel.name}</strong>
                    <span>{tunnel.up ? (tunnel.total > 1 ? `${tunnel.up}/${tunnel.total} fases` : "Ativo") : "Caído"}</span>
                  </li>
                ))}
                {fw.tunnels.length > 9 ? <li className="noc-more">+ {fw.tunnels.length - 9} túneis</li> : null}
              </ul>
            ) : (
              <p className="noc-empty">Nenhum túnel VPN configurado no FortiGate.</p>
            )}
          </section>
        ) : null}
        <section className="noc-card noc-vpn-now">
          <h3><KeyRound size={20} /> VPN agora <small>{liveCount === null ? "sem leitura" : `${liveCount} ${liveCount === 1 ? "conectado" : "conectados"}`}</small></h3>
          {live.length ? (
            <ul className="noc-res">
              {live.slice(0, VPN_LIMIT).map((user) => (
                <li key={`${user.login}-${user.connectedSec}`}>
                  <strong title={user.name}>{user.name}</strong>
                  <span>há {fmtSince(user.connectedSec)}</span>
                </li>
              ))}
              {live.length > VPN_LIMIT ? <li className="noc-more">+ {live.length - VPN_LIMIT} conectados</li> : null}
            </ul>
          ) : (
            <p className="noc-empty">{data.vpn ? "Ninguém conectado na VPN agora." : liveCount === null ? "Sem leitura da VPN no FortiGate." : `${liveCount} conectado(s) · lista de nomes indisponível`}</p>
          )}
        </section>
      </div>
    </div>
  );
}

// Incidentes iguais (ex.: varios "e-mails removidos") viram uma linha com a quantidade.
function groupIncidents(incidents: Defender["incidents"]) {
  const groups = new Map<string, { title: string; original: string; severity: string; count: number; oldest: string; newest: string }>();
  for (const incident of incidents) {
    const title = defenderName(incident.title);
    const key = `${incident.severity}|${title}`;
    const group = groups.get(key) || { title, original: incident.title, severity: incident.severity, count: 0, oldest: incident.created, newest: incident.created };
    group.count++;
    if (incident.created < group.oldest) group.oldest = incident.created;
    if (incident.created > group.newest) group.newest = incident.created;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (DEFENDER_RANK[a.severity] ?? 4) - (DEFENDER_RANK[b.severity] ?? 4) || b.newest.localeCompare(a.newest));
}

// FortiAnalyzer (alertas e antivirus) + Microsoft Defender numa pagina so, organizada por "o que pede acao".
function SecurityPage({ data }: { data: NocData }) {
  const sec = securitySummary(data);
  const { analyzer, defender } = sec;
  const LIMIT = 5;
  if (!analyzer && !defender) {
    const failure = data.analyzer?.error || data.defender?.error;
    return <p className="noc-empty">{failure ? `Segurança indisponível: ${failure}` : "Consultando o FortiAnalyzer e o Microsoft Defender..."}</p>;
  }
  const incidentRows = defender ? groupIncidents(defender.incidents) : [];
  const unassignedHigh = sec.highIncidents.filter((incident) => !incident.assigned).length;
  const alerts = analyzer?.alerts || [];
  const attacks = alerts.filter((alert) => !alert.action && NOISE_KINDS[0][0].test(alert.handler)).length;
  const av = analyzer?.antivirus;
  const ipsBlocked = data.firewalls[0]?.security?.totals.blocked;
  const score = defender?.secureScore ? Math.round((defender.secureScore.current / defender.secureScore.max) * 100) : null;
  const lastSerious = sec.groups.find((group) => group.severity === "critical" || group.severity === "high");
  return (
    <div className="noc-page noc-sec2">
      <div className="noc-faz-kpis noc-kpirow">
        {analyzer ? (
          analyzer.alertsError ? (
            <div className="tone-unknown"><span>Pedem atenção</span><strong>—</strong><small>consulta de alertas falhou</small></div>
          ) : (
            <div className={`tone-${sec.urgentRecent ? "critical" : sec.groups.length ? "warning" : "good"}`}>
              <span>Pedem atenção</span>
              <strong>{sec.groups.length}</strong>
              <small>{sec.urgentRecent ? `${sec.urgentRecent} grave(s) nas últimas 2 h` : lastSerious ? `último grave ${fmtWhen(lastSerious.last)}` : "últimas 24 h"}</small>
            </div>
          )
        ) : null}
        {defender ? (
          <div className={sec.threats.length ? "tone-critical" : "tone-good"}>
            <span>Máquinas com ameaça</span>
            <strong>{sec.threats.length}</strong>
            <small>{sec.threats.length ? `${sec.threats.slice(0, 2).map((device) => device.name).join(", ")}${sec.threats.length > 2 ? ` e +${sec.threats.length - 2}` : ""}` : "nenhuma ameaça ativa"}</small>
          </div>
        ) : null}
        {defender ? (
          <div className={sec.newHigh ? "tone-critical" : sec.highIncidents.length ? "tone-warning" : "tone-good"}>
            <span>Incidentes altos</span>
            <strong>{sec.highIncidents.length}</strong>
            <small>{sec.highIncidents.length ? `${unassignedHigh} sem responsável${sec.newHigh ? ` · ${sec.newHigh} novo(s) hoje` : ""}` : "nenhum aberto"}</small>
          </div>
        ) : null}
        {analyzer ? (
          analyzer.antivirusError ? (
            <div className="tone-unknown"><span>Vírus (7 dias)</span><strong>—</strong><small>consulta do antivírus falhou</small></div>
          ) : (
            <div className={sec.virus ? "tone-critical" : "tone-good"}><span>Vírus (7 dias)</span><strong>{sec.virus}</strong><small>{sec.virus ? "arquivos infectados barrados" : "nenhum arquivo infectado"}</small></div>
          )
        ) : null}
      </div>

      <div className="noc-vpn-grid" style={{ gridTemplateColumns: analyzer && defender ? undefined : "minmax(0, 1fr)" }}>
        {analyzer ? (
          <section className="noc-card">
            <h3><AlertOctagon size={20} /> FortiAnalyzer · pedem ação <small>últimas 24 h · vão para o WhatsApp</small></h3>
            {analyzer.alertsError ? (
              <p className="noc-empty"><AlertTriangle size={18} /> Não foi possível consultar os alertas agora.</p>
            ) : sec.groups.length ? (
              <ul className="noc-secalerts-list">
                {sec.groups.slice(0, LIMIT).map((group) => (
                  <li key={group.key}>
                    <em className={`noc-faz-level tone-${threatTone(group.severity)}`}>{LEVEL_NAMES[group.severity] || group.severity}</em>
                    <div className="noc-vpn-who">
                      <strong title={group.first.handler}>{alertName(group.first.handler, group.first.subject)}{group.alerts > 1 ? <span className="noc-secalerts-count"> · {group.alerts} alertas</span> : null}</strong>
                      <small title={group.first.subject}>{groupDetail(group)}</small>
                    </div>
                    <b className="noc-secalerts-when">{fmtWhen(group.last)}</b>
                  </li>
                ))}
                {sec.groups.length > LIMIT ? <li className="noc-more">+ {sec.groups.length - LIMIT} pedindo atenção</li> : null}
              </ul>
            ) : (
              <p className="noc-secalerts-ok"><CheckCircle2 size={20} /> Nada pedindo ação nas últimas 24 h.</p>
            )}
          </section>
        ) : null}
        {defender ? (
          <section className="noc-card">
            <h3><ShieldAlert size={20} /> Defender · incidentes abertos <small>mais graves primeiro · agrupados</small></h3>
            {incidentRows.length ? (
              <ul className="noc-secalerts-list">
                {incidentRows.slice(0, LIMIT).map((row) => (
                  <li key={`${row.severity}-${row.title}`}>
                    <em className={`noc-faz-level tone-${defenderTone(row.severity)}`}>{DEFENDER_LEVEL[row.severity] || row.severity}</em>
                    <div className="noc-vpn-who">
                      <strong title={row.original}>{row.title}{row.count > 1 ? <span className="noc-secalerts-count"> · {row.count} incidentes</span> : null}</strong>
                      <small>{row.count > 1 ? `o mais antigo aberto ${daysAgo(row.oldest)}` : `aberto ${daysAgo(row.oldest)}`}</small>
                    </div>
                    <b className="noc-secalerts-when">{fmtWhen(row.newest)}</b>
                  </li>
                ))}
                {incidentRows.length > LIMIT ? <li className="noc-more">+ {incidentRows.length - LIMIT} outros tipos de incidente</li> : null}
              </ul>
            ) : (
              <p className="noc-secalerts-ok"><CheckCircle2 size={20} /> Nenhum incidente aberto.</p>
            )}
          </section>
        ) : null}
      </div>

      <div className="noc-foot-lines">
        {analyzer ? (
          <span>
            <b>Barrado sem ação:</b> {analyzer.alertsError ? "—" : fmtCount(attacks)} ataques da internet (24 h)
            {av && !analyzer.antivirusError ? ` · ${fmtCount(av.total)} bloqueios preventivos do antivírus (7 dias)` : ""}
            {ipsBlocked ? ` · IPS do firewall: ${fmtCount(ipsBlocked)} bloqueios (24 h)` : ""}
          </span>
        ) : null}
        {defender ? (
          <span>
            <b>Postura:</b> Secure Score {score === null ? "—" : `${score}%`} · {defender.devices.secured}/{defender.devices.total} máquinas com Defender ativo
            {defender.devices.deactivated ? ` · ${defender.devices.deactivated} sem Defender ativo` : ""}
          </span>
        ) : null}
        <small>{[analyzer ? `FortiAnalyzer ${fmtWhen(analyzer.checkedAt)}` : "", defender ? `Defender ${fmtWhen(defender.checkedAt)}` : ""].filter(Boolean).join(" · ")}</small>
      </div>
    </div>
  );
}

// Analise do trafego (FortiAnalyzer): fora do "esta tudo bem?", passa a cada duas voltas do carrossel.
function TrafficPage({ analyzer }: { analyzer: Analyzer }) {
  if (!analyzer.checkedAt) {
    return <p className="noc-empty">{analyzer.error ? `FortiAnalyzer: ${analyzer.error}` : "Consultando o FortiAnalyzer (as visões de 24 h levam alguns segundos)..."}</p>;
  }
  const { totals } = analyzer;
  const blockedPct = totals.sessions ? Math.round((totals.sessionsBlocked / totals.sessions) * 100) : 0;
  const ips = analyzer.threats.filter((threat) => threat.type === "ips" && threat.incidents > 0).slice(0, 5);
  const topIps = Math.max(1, ...ips.map((threat) => threat.incidents));
  return (
    <div className="noc-page noc-traffic">
      <div className="noc-faz-kpis noc-kpirow">
        <div><span>Tráfego da internet</span><strong>{fmtBytes(totals.bandwidth)}</strong><small>últimas {analyzer.windowHours} h</small></div>
        <div><span>Sessões</span><strong>{fmtCount(totals.sessions)}</strong><small>conexões abertas</small></div>
        <div><span>Sessões bloqueadas</span><strong>{blockedPct}%</strong><small>{fmtCount(totals.sessionsBlocked)} pelo firewall</small></div>
      </div>
      <div className="noc-cols3">
        <section className="noc-card">
          <h3><Network size={20} /> Quem mais usa</h3>
          <BarList items={analyzer.sources.slice(0, 5)} value={(source) => source.bandwidth} label={(source) => source.name || source.ip} />
        </section>
        <section className="noc-card">
          <h3><Activity size={20} /> Aplicações</h3>
          <BarList items={analyzer.applications.slice(0, 5)} value={(app) => app.bandwidth} label={(app) => app.name} />
        </section>
        <section className="noc-card">
          <h3><ShieldCheck size={20} /> Ameaças do IPS</h3>
          {ips.length ? (
            <ul className="noc-faz-list">
              {ips.map((threat) => (
                <li key={threat.name}>
                  <div className="noc-faz-row">
                    <span className="noc-faz-name" title={threat.name}>{THREAT_NAMES[threat.name] || threat.name}</span>
                    <b>{fmtCount(threat.incidents)}</b>
                  </div>
                  <div className="noc-hbar" aria-hidden="true"><i style={{ width: `${Math.max(2, (threat.incidents / topIps) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="noc-secalerts-ok"><CheckCircle2 size={20} /> Nenhuma ameaça do IPS em 24 h.</p>
          )}
        </section>
      </div>
      <small className="noc-faz-foot">FortiAnalyzer · atualizado {fmtWhen(analyzer.checkedAt)}{analyzer.error ? ` · última consulta falhou: ${analyzer.error}` : ""}</small>
    </div>
  );
}

const meterTone = (value: number | null, warn: number, crit: number) => (value === null ? "unknown" : value >= crit ? "critical" : value >= warn ? "warning" : "good");

// Servidores (ping), hardware Dell e Docker numa pagina so, guiada por "com problema".
function ServersPage({ data }: { data: NocData }) {
  const srv = serversSummary(data);
  const { group, systems, containers } = srv;
  const zabbixDown = Boolean(sourceDown(data, "zabbix"));
  const hwOk = data.hardware.filter((hw) => hw.health === "ok").length;
  const failing = containers.filter((container) => container.health === 3).length;
  const dockerUp = systems.filter((system) => system.status === "up").length;
  return (
    <div className="noc-page noc-srv2">
      <div className="noc-faz-kpis noc-kpirow">
        <div className={`tone-${groupTone(group)}`}>
          <span>Servidores (ping)</span>
          <strong>{group ? `${group.up}/${group.total}` : "—"}</strong>
          <small>{group ? (group.down ? `${group.down} sem resposta` : "todos respondendo") : zabbixDown ? "sem coleta do Zabbix" : "grupo não encontrado no Zabbix"}</small>
        </div>
        {data.hardware.length ? (
          <div className={`tone-${worst(...data.hardware.map((hw) => (hw.health === "ok" ? "good" : hw.health)))}`}>
            <span>Hardware Dell</span>
            <strong>{hwOk}/{data.hardware.length}</strong>
            <small>{hwOk === data.hardware.length ? "todos saudáveis" : `${data.hardware.length - hwOk} com alerta`}</small>
          </div>
        ) : null}
        {systems.length ? (
          <div className={dockerUp === systems.length ? "tone-good" : "tone-critical"}>
            <span>Servidores Docker</span>
            <strong>{dockerUp}/{systems.length}</strong>
            <small>{dockerUp === systems.length ? "todos online" : `${systems.length - dockerUp} fora do ar`}</small>
          </div>
        ) : null}
        {data.beszel ? (
          <div className={data.beszel.containersError ? "tone-unknown" : failing ? "tone-critical" : "tone-good"}>
            <span>Containers</span>
            <strong>{data.beszel.containersError ? "—" : containers.length}</strong>
            <small>{data.beszel.containersError ? "lista indisponível" : failing ? `${failing} com falha` : "rodando, nenhum com falha"}</small>
          </div>
        ) : null}
      </div>

      <div className="noc-vpn-grid">
        <section className="noc-card">
          <h3><AlertTriangle size={20} /> Com problema <small>{srv.issues.length ? `${srv.issues.length}` : "nenhum"}</small></h3>
          <IssueList issues={srv.issues} limit={6} empty="Nenhum servidor, hardware ou container com problema." />
        </section>
        <section className="noc-card">
          <h3><Cpu size={20} /> Recursos</h3>
          {systems.length || data.hardware.length ? (
            <ul className="noc-res">
              {systems.map((system) => {
                const online = system.status === "up";
                const tone = online ? worst(meterTone(system.cpu, 70, 90), meterTone(system.memPct, 80, 92), meterTone(system.diskPct, 80, 90)) : "critical";
                return (
                  <li key={system.id} className={`tone-${tone}`}>
                    <strong title={system.host}>{system.name}</strong>
                    {online ? (
                      <span>
                        CPU <em className={`tone-${meterTone(system.cpu, 70, 90)}`}>{pct(system.cpu)}</em> · memória <em className={`tone-${meterTone(system.memPct, 80, 92)}`}>{pct(system.memPct)}</em> · disco{" "}
                        <em className={`tone-${meterTone(system.diskPct, 80, 90)}`}>{pct(system.diskPct)}</em>
                      </span>
                    ) : (
                      <span>fora do ar</span>
                    )}
                  </li>
                );
              })}
              {data.hardware.map((hw) => {
                const temps = hw.temps.map((temp) => temp.value).filter((value): value is number => value !== null);
                return (
                  <li key={hw.id} className={`tone-${hw.health === "ok" ? "good" : hw.health}`}>
                    <strong>{hw.name}</strong>
                    <span>
                      {temps.length ? `${Math.max(...temps)} °C · ` : ""}fontes {partCount(hw.psu)} · discos {partCount(hw.disks)} · RAID {(RAID_STATE[hw.raid] || RAID_STATE.unknown).label}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="noc-empty">Sem Docker (Beszel) nem iDRAC no Zabbix.</p>
          )}
        </section>
      </div>

      {group ? (
        <section className="noc-card noc-names-card">
          <h3><Server size={20} /> Todos os servidores <small>{group.up}/{group.total} respondendo</small></h3>
          <NameGrid items={group.hosts.map((host) => ({ id: host.id, name: host.name, tone: hostTone(host) }))} />
        </section>
      ) : null}
    </div>
  );
}

// Catracas (por conjunto), totens, impressoras e videowall: conjunto ok vira uma linha, so o que falhou se abre.
function AccessPage({ data }: { data: NocData }) {
  const group = (key: string) => data.groups.find((entry) => entry.key === key);
  const turnstiles = group("catracas");
  // Catracas agrupadas por conjunto; sem conjunto, cada host vira o proprio "conjunto".
  const sets = new Map<string, NocHost[]>();
  for (const host of turnstiles?.hosts || []) {
    const key = host.set || host.name;
    sets.set(key, [...(sets.get(key) || []), host]);
  }
  const byName = (a: [string, NocHost[]], b: [string, NocHost[]]) => a[0].localeCompare(b[0], "pt-BR", { numeric: true });
  const setList = Array.from(sets.entries()).sort(byName);
  const failingSets = setList.filter(([, hosts]) => hosts.some((host) => host.up === false));
  const okSets = setList.filter(([, hosts]) => !hosts.some((host) => host.up === false));
  const others = ["totens", "impressoras", "videowall"].map(group).filter((entry): entry is NocGroup => Boolean(entry?.total));
  const icons: Record<string, React.ReactNode> = { totens: <MonitorPlay size={20} />, impressoras: <Printer size={20} />, videowall: <MonitorPlay size={20} /> };
  return (
    <div className="noc-page noc-acc2">
      <div className="noc-faz-kpis noc-kpirow">
        {turnstiles?.total ? (
          <div className={`tone-${failingSets.length ? (okSets.length ? "warning" : "critical") : "good"}`}>
            <span>Catracas</span>
            <strong>{okSets.length}/{setList.length}</strong>
            <small>{failingSets.length ? `${failingSets.length} conjunto(s) com falha` : "todos os conjuntos operando"}</small>
          </div>
        ) : null}
        {others.map((entry) => (
          <div key={entry.key} className={`tone-${groupTone(entry)}`}>
            <span>{entry.title}</span>
            <strong>{entry.up}/{entry.total}</strong>
            <small>{entry.down ? `${entry.down} sem resposta` : "todos online"}</small>
          </div>
        ))}
      </div>

      {turnstiles?.total ? (
        <section className="noc-card noc-acc2-sets">
          <h3><ScanFace size={20} /> Catracas <small>{setList.length} {setList.length === 1 ? "conjunto" : "conjuntos"} · {turnstiles.up}/{turnstiles.total} aparelhos online</small></h3>
          {failingSets.length ? (
            <div className="noc-sets">
              {failingSets.map(([name, hosts]) => <SetCard key={name} name={name} hosts={hosts} problems={data.problems} />)}
            </div>
          ) : (
            <p className="noc-secalerts-ok"><CheckCircle2 size={20} /> Todas as catracas operando.</p>
          )}
          {okSets.length ? (
            <div className="noc-setchips">
              {okSets.map(([name, hosts]) => (
                <span key={name}><CheckCircle2 size={15} /> {name} <small>{hosts.length}/{hosts.length}</small></span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {others.length ? (
        <div className="noc-cols3" style={{ gridTemplateColumns: `repeat(${others.length}, minmax(0, 1fr))` }}>
          {others.map((entry) => (
            <section key={entry.key} className="noc-card">
              <h3>{icons[entry.key]} {entry.title} <small>{entry.up}/{entry.total} online</small></h3>
              <IssueList
                issues={entry.hosts.filter((host) => host.up === false).map((host) => ({ key: host.id, tone: "critical" as const, title: host.name, detail: "sem resposta ao ping", when: downSince(data, host.id) }))}
                limit={4}
                empty={`Todos online (${entry.total}).`}
              />
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ControllerPage({ controller }: { controller: UnifiController }) {
  if (!controller.ok) {
    return (
      <div className="noc-page noc-unifi">
        <section className="noc-card noc-ctrl-down">
          <XCircle size={48} />
          <h3>Controladora {controller.name} sem resposta</h3>
          <p>{controller.message}</p>
          <small>{controller.via === "zabbix" ? "Lida pelo Zabbix (item NOC: resumo da controladora UniFi)." : "Acessada direto pelo portal."}</small>
        </section>
      </div>
    );
  }

  const apsOnline = controller.aps.filter((ap) => ap.online).length;
  const swOnline = controller.switches.filter((sw) => sw.online).length;
  const poe = controller.switches.reduce((sum, sw) => sum + sw.poeWatts, 0);
  const traffic = controller.traffic.txBps + controller.traffic.rxBps;
  const upgrades = controller.aps.filter((ap) => ap.upgradable).length + controller.switches.filter((sw) => sw.upgradable).length;
  const apTone = onlineTone(apsOnline, controller.aps.length);
  const swTone = onlineTone(swOnline, controller.switches.length);
  const satTone = satisfactionTone(controller.clients.satisfaction);
  // Quedas em 24 h: pelo log de eventos; sem eventos (consulta desligada), pelos alarmes de desconexao.
  const dayAgo = Date.now() - DAY_MS;
  const drops = controller.events.length
    ? controller.events.filter(isDropEvent).length
    : controller.alarms.filter((alarm) => /disconnected|lost contact/i.test(alarm.message) && new Date(alarm.time).getTime() >= dayAgo).length;
  // MAC -> nome (o id do aparelho termina no MAC, com ou sem prefixo da controladora).
  const deviceNames = new Map<string, string>([...controller.aps, ...controller.switches].map((device) => [device.id.slice(-17).toLowerCase(), device.name]));
  const busy = (ap: UnifiAp) => Math.max(0, ...ap.radios.map((radio) => radio.utilization ?? 0));

  // Com problema: desconectados, canais congestionados, switch quente/CPU alta, experiencia ruim.
  const issues: Issue[] = [
    ...controller.aps.filter((ap) => !ap.online).map((ap): Issue => ({ key: ap.id, tone: "critical", title: ap.name, detail: "antena desconectada da controladora" })),
    ...controller.switches.filter((sw) => !sw.online).map((sw): Issue => ({ key: sw.id, tone: "critical", title: sw.name, detail: "switch desconectado da controladora" })),
    ...controller.switches
      .filter((sw) => sw.online && ((sw.cpu ?? 0) >= 90 || (sw.temperature ?? 0) >= 75))
      .map((sw): Issue => ({ key: `${sw.id}-hot`, tone: "warning", title: sw.name, detail: [`CPU ${pct(sw.cpu)}`, sw.temperature !== null ? `${sw.temperature} °C` : ""].filter(Boolean).join(" · ") })),
    ...controller.aps
      .filter((ap) => ap.online)
      // Canal congestionado e desempenho, nao queda: fica em atencao (vermelho so para desconectado).
      .flatMap((ap) => ap.radios.filter((radio) => (radio.utilization ?? 0) >= 70).map((radio): Issue => ({ key: `${ap.id}-${radio.band}`, tone: "warning", title: ap.name, detail: `${radio.band} canal ${radio.channel ?? "—"} · uso do canal ${pct(radio.utilization)}` }))),
    ...controller.aps
      .filter((ap) => ap.online && ap.satisfaction !== null && ap.satisfaction < 60)
      .map((ap): Issue => ({ key: `${ap.id}-sat`, tone: "warning", title: ap.name, detail: `experiência ruim dos clientes (${ap.satisfaction}%)` })),
  ];
  const all = [
    ...controller.aps.map((ap) => ({ id: ap.id, name: ap.name, tone: !ap.online ? "critical" : busy(ap) >= 80 || (ap.satisfaction !== null && ap.satisfaction < 60) ? "warning" : "good" })),
    ...controller.switches.map((sw) => ({ id: sw.id, name: sw.name, tone: !sw.online ? "critical" : (sw.cpu ?? 0) >= 90 || (sw.temperature ?? 0) >= 75 ? "warning" : "good" })),
  ];
  const lastEvents = controller.events.slice(0, 4);

  return (
    <div className="noc-page noc-unifi noc-unifi2">
      {controller.message ? <p className="noc-collect-warn"><AlertTriangle size={18} /> {controller.message}</p> : null}
      <div className="noc-group-head noc-ctrl-head">
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
          <span>Clientes conectados</span>
          <strong>{controller.clients.total.toLocaleString("pt-BR")}</strong>
          <small>{controller.clients.wireless.toLocaleString("pt-BR")} Wi-Fi · {controller.clients.wired.toLocaleString("pt-BR")} cabo</small>
        </div>
        <div className={`tone-${satTone}`}>
          <span>Experiência Wi-Fi</span>
          <strong>{controller.clients.satisfaction === null ? "—" : `${controller.clients.satisfaction}%`}</strong>
          <small>satisfação média dos clientes</small>
        </div>
        <div>
          <span>Tráfego agora</span>
          <strong>{traffic ? rate(traffic) : "—"}</strong>
          <small>somando as antenas</small>
        </div>
        <div className={drops >= 3 ? "tone-warning" : ""}>
          <span>Quedas em 24 h</span>
          <strong>{drops}</strong>
          <small>{controller.alarms.length ? `${controller.alarms.length} alarmes abertos` : upgrades ? `${upgrades} com firmware novo` : `UniFi ${controller.version}`}</small>
        </div>
      </div>

      <div className="noc-unifi2-body">
        <section className="noc-card">
          <h3><AlertTriangle size={20} /> Com problema <small>{issues.length ? `${issues.length}` : "nenhum"}</small></h3>
          <IssueList issues={issues} limit={7} empty="Antenas e switches desta controladora sem problema." />
        </section>
        <section className="noc-card noc-names-card">
          <h3>
            <Radio size={20} /> Todos os aparelhos <small>{controller.aps.length} antenas · {controller.switches.length} switches</small>
          </h3>
          <NameGrid items={all} />
        </section>
      </div>

      <p className="noc-logline">
        <b>Log da controladora:</b>{" "}
        {lastEvents.length
          ? lastEvents.map((event, index) => (
              <span key={`${event.time}-${index}`} className={isDropEvent(event) ? "drop" : ""}>
                {eventTime(event.time)} {translateUnifiEvent(event.message, deviceNames)}
              </span>
            ))
          : "nenhum evento nas últimas 24 h"}
      </p>
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

/* ---------- Cadastro de dispositivos (ping no Zabbix) ---------- */

type Device = { id: string; name: string; ip: string; groupId: string; group: string; set: string; role: string; enabled: boolean; editable: boolean; removable: boolean; up: boolean | null; latencyMs: number | null };
const ROLE_SUGGESTIONS = ["Controladora", "Facial", "Leitor", "Totem de pagamento", "Impressora"];
type DeviceGroup = { groupid: string; name: string };

async function devicesApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/devices${path}`, { ...init, headers: { ...headersFor(), ...(init?.body ? { "Content-Type": "application/json" } : {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { message?: string }).message || `Servidor respondeu ${response.status}`);
  return payload as T;
}

function DevicesManager({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ name: "", ip: "", groupId: "", set: "", role: "" });
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string; ip: string; groupId: string; set: string; role: string } | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await devicesApi<{ groups: DeviceGroup[]; devices: Device[] }>("");
      setGroups(data.groups);
      setDevices(data.devices);
      // Tipo padrao: Switch (o mais comum); senao o primeiro da lista.
      setForm((value) => (value.groupId || !data.groups.length ? value : { ...value, groupId: (data.groups.find((group) => /switch/i.test(group.name)) || data.groups[0]).groupid }));
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Falha ao carregar." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function run(label: string, action: () => Promise<unknown>, success: string) {
    setBusy(label);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: success });
      await reload();
      onChanged();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Falha." });
    } finally {
      setBusy("");
    }
  }

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const base = form.name || form.role;
    const label = form.set && !base.toLowerCase().includes(form.set.toLowerCase()) ? `${form.set} - ${base}` : base;
    // Mantem tipo e conjunto para cadastrar o proximo aparelho do mesmo conjunto (ex.: o 2o facial da catraca).
    run("add", () => devicesApi("", { method: "POST", body: JSON.stringify(form) }), `${label} cadastrado. O Zabbix começa a pingar em até 1 minuto.`).then(() =>
      setForm((value) => ({ ...value, name: "", ip: "", role: "" })),
    );
  };
  const knownSets = Array.from(new Set(devices.map((device) => device.set).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const knownRoles = Array.from(new Set([...ROLE_SUGGESTIONS, ...devices.map((device) => device.role).filter(Boolean)]));
  const groupLabel = (group: DeviceGroup) => (group.groupid.startsWith("novo:") ? `${group.name} (novo)` : group.name);

  const term = filter.trim().toLowerCase();
  const shown = devices.filter((device) => !term || `${device.name} ${device.ip} ${device.group}`.toLowerCase().includes(term));
  const byGroup = groups.map((group) => ({ group, items: shown.filter((device) => device.groupId === group.groupid) })).filter((entry) => entry.items.length);

  return (
    <>
      <div className="noc-modal-backdrop" onClick={onClose} />
      <div className="noc-modal noc-dev-modal" role="dialog" aria-modal="true" aria-label="Dispositivos monitorados">
        <header>
          <h3><Network size={20} /> Dispositivos monitorados</h3>
          <button type="button" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </header>
        <p className="noc-modal-hint">Cada dispositivo vira um host no Zabbix com ping a cada 1 minuto. Se ficar mais de 5 minutos sem responder, o alerta vai para o WhatsApp.</p>

        <form className="noc-dev-add" onSubmit={add}>
          <label>
            <span>Tipo</span>
            <select value={form.groupId} onChange={(event) => setForm({ ...form, groupId: event.target.value })}>
              {groups.map((group) => <option key={group.groupid} value={group.groupid}>{groupLabel(group)}</option>)}
            </select>
          </label>
          <label><span>Conjunto (opcional)</span><input value={form.set} maxLength={60} list="noc-dev-sets" placeholder="ex.: Catraca 1" onChange={(event) => setForm({ ...form, set: event.target.value })} /></label>
          <label><span>Função (opcional)</span><input value={form.role} maxLength={40} list="noc-dev-roles" placeholder="ex.: Facial" onChange={(event) => setForm({ ...form, role: event.target.value })} /></label>
          <label><span>Nome</span><input value={form.name} maxLength={80} placeholder={form.set ? (form.role ? `${form.set} - ${form.role}` : "ex.: FACIAL-ENTRADA") : "ex.: Switch Portaria 3"} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label><span>IP</span><input value={form.ip} placeholder="10.0.1.50" inputMode="decimal" onChange={(event) => setForm({ ...form, ip: event.target.value })} /></label>
          <button type="submit" className="primary" disabled={busy === "add" || !form.ip || (!form.name && !(form.set && form.role))}
            title={form.set ? `No Zabbix fica "${form.set} - ..." (o nome se repete entre catracas)` : undefined}>{busy === "add" ? "Cadastrando..." : "+ Adicionar"}</button>
          <datalist id="noc-dev-sets">{knownSets.map((set) => <option key={set} value={set} />)}</datalist>
          <datalist id="noc-dev-roles">{knownRoles.map((role) => <option key={role} value={role} />)}</datalist>
        </form>

        {message ? <p className={`noc-modal-result ${message.ok ? "ok" : "bad"}`}>{message.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {message.text}</p> : null}

        <input className="noc-dev-filter" value={filter} placeholder={`Buscar entre ${devices.length} dispositivos (nome, IP ou tipo)`} onChange={(event) => setFilter(event.target.value)} />

        <div className="noc-dev-list">
          {loading ? <p className="noc-modal-hint">Carregando do Zabbix...</p> : null}
          {!loading && !byGroup.length ? <p className="noc-modal-hint">Nenhum dispositivo encontrado.</p> : null}
          {byGroup.map(({ group, items }) => (
            <section key={group.groupid}>
              <h4>{group.name} <small>{items.length}</small></h4>
              <ul>
                {items.map((device) => {
                  const tone = !device.enabled ? "unknown" : device.up === null ? "unknown" : device.up ? "good" : "critical";
                  const isEditing = editing?.id === device.id;
                  return (
                    <li key={device.id} className={`tone-${tone}`}>
                      <span className="noc-dev-dot" aria-hidden="true" />
                      {isEditing ? (
                        <>
                          <div className="noc-dev-edit-name">
                            <input value={editing.name} maxLength={80} aria-label="Nome" onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
                            <div>
                              <input value={editing.set} maxLength={60} list="noc-dev-sets" placeholder="Conjunto" aria-label="Conjunto" onChange={(event) => setEditing({ ...editing, set: event.target.value })} />
                              <input value={editing.role} maxLength={40} list="noc-dev-roles" placeholder="Função" aria-label="Função" onChange={(event) => setEditing({ ...editing, role: event.target.value })} />
                            </div>
                          </div>
                          <input value={editing.ip} aria-label="IP" onChange={(event) => setEditing({ ...editing, ip: event.target.value })} />
                          <select value={editing.groupId} aria-label="Tipo" onChange={(event) => setEditing({ ...editing, groupId: event.target.value })}>
                            {groups.map((entry) => <option key={entry.groupid} value={entry.groupid}>{groupLabel(entry)}</option>)}
                          </select>
                          <div className="noc-dev-actions">
                            <button type="button" className="primary" disabled={busy === device.id} onClick={() => run(device.id, () => devicesApi(`/${device.id}`, { method: "PATCH", body: JSON.stringify(editing) }), `${editing.name} atualizado.`).then(() => setEditing(null))}>Salvar</button>
                            <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <strong title={device.name}>
                            {device.name}
                            {device.set || device.role ? <small className="noc-dev-tag">{[device.set, device.role].filter(Boolean).join(" · ")}</small> : null}
                          </strong>
                          <span className="noc-dev-ip">{device.ip}</span>
                          <span className="noc-dev-state">{!device.enabled ? "pausado" : device.up === null ? "sem dados" : device.up ? `${device.latencyMs ?? "—"} ms` : "sem resposta"}</span>
                          <div className="noc-dev-actions">
                            {device.editable ? (
                              <>
                                <button type="button" onClick={() => setEditing({ id: device.id, name: device.name, ip: device.ip, groupId: device.groupId, set: device.set, role: device.role })}>Editar</button>
                                <button type="button" disabled={busy === device.id} onClick={() => run(device.id, () => devicesApi(`/${device.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !device.enabled }) }), device.enabled ? `${device.name} pausado.` : `${device.name} voltou a ser monitorado.`)}>
                                  {device.enabled ? "Pausar" : "Retomar"}
                                </button>
                                {device.removable ? (
                                <button
                                  type="button"
                                  className="danger"
                                  disabled={busy === device.id}
                                  onClick={() => {
                                    if (window.confirm(`Remover ${device.name} (${device.ip}) do monitoramento? O histórico dele no Zabbix também é apagado.`)) {
                                      run(device.id, () => devicesApi(`/${device.id}`, { method: "DELETE" }), `${device.name} removido.`);
                                    }
                                  }}
                                >
                                  Remover
                                </button>
                                ) : null}
                              </>
                            ) : (
                              <small title="Tem outros monitoramentos além do ping (ex.: SNMP, links, firewall)">gerenciado no Zabbix</small>
                            )}
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        <footer>
          <button type="button" onClick={onClose}>Fechar</button>
        </footer>
      </div>
    </>
  );
}

/* ---------- Painel (carrossel) ---------- */

export function NocWall({ tvKey, kiosk = false, isAdmin = false }: { tvKey?: string; kiosk?: boolean; isAdmin?: boolean }) {
  const [showUnifi, setShowUnifi] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
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
  const index = page % pageCount;
  const current = pages[index];
  // Tempo da pagina: base da pagina x estado (verde passa rapido, critico fica mais) x ritmo escolhido.
  const currentTone: Tone = data ? pageTone(current, data) : "unknown";
  const pageSeconds = Math.max(8, Math.round(current.seconds * TONE_FACTOR[currentTone] * (intervalSec / 20)));
  const [round, setRound] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/noc`, { headers: headersFor(tvKey) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((payload as { message?: string }).message || `Servidor respondeu ${response.status}`);
      // Cameras do CFTV sairam do painel: seus problemas tambem nao entram em contagens, lista e faixa.
      const next = payload as NocData;
      setData({ ...next, problems: next.problems.filter((problem) => problem.category !== "cftv") });
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
    if (elapsed < pageSeconds) return;
    let next = (index + 1) % pageCount;
    let nextRound = next === 0 ? round + 1 : round;
    // Trafego (analise, sem estado) passa so a cada duas voltas.
    if (pages[next]?.id === "trafego" && nextRound % 2 === 1) {
      next = (next + 1) % pageCount;
      if (next === 0) nextRound += 1;
    }
    setElapsed(0);
    setPage(next);
    setRound(nextRound);
  }, [elapsed, pageSeconds, index, pageCount, pages, round]);

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

  // Faixa de alertas: graves e o que mudou nos ultimos 7 dias (leves antigos ficam no rodape da Visao geral).
  const tickerProblems = data ? data.problems.filter(isMainProblem) : [];
  const stale = data ? Date.now() - new Date(data.generatedAt).getTime() > 120000 : false;
  const zabbixDown = sourceDown(data, "zabbix");
  // Estado de cada pagina (chips) e estado global = pior entre elas. Seguranca so pesa no global quando
  // critica: incidentes abertos antigos nao deixam o topo amarelo o dia inteiro.
  const pageStates = data ? pages.filter((entry) => entry.id !== "overview-2").map((entry) => ({ entry, tone: pageTone(entry, data) })) : [];
  const counted = pageStates.filter(({ entry }) => entry.id !== "trafego").map(({ entry, tone }) => ({ entry, tone: entry.id === "seguranca" && tone === "warning" ? "good" : tone }));
  const attention = counted.filter(({ tone }) => tone === "critical" || tone === "warning").map(({ entry }) => entry.short);
  const criticalCount = data
    ? data.problems.filter((problem) => problem.severity >= 4).length +
      securitySummary(data).critical +
      serversSummary(data).issues.filter((issue) => issue.tone === "critical" && !issue.key.startsWith("srv-")).length
    : 0;
  // Sem dado novo (servidor fora ou leitura velha) ou sem Zabbix, o estado e desconhecido: nunca "Tudo operando".
  const blind = Boolean(data && (error || stale || zabbixDown));
  const globalTone: Tone = !data || blind ? "unknown" : worst(...counted.map(({ tone }) => tone));
  const globalTitle = !data
    ? "Carregando"
    : error || stale
      ? "Sem dados atualizados"
      : zabbixDown
        ? "Zabbix sem resposta"
        : globalTone === "critical"
          ? criticalCount ? `${criticalCount} ${criticalCount === 1 ? "crítico" : "críticos"}` : "Crítico"
          : globalTone === "warning"
            ? "Atenção"
            : "Tudo operando";
  const globalDetail = !data
    ? "aguardando dados"
    : error || stale
      ? `última leitura às ${hhmm(data.generatedAt)}`
      : zabbixDown
        ? "estado da rede desconhecido"
        : attention.length
          ? attention.join(" · ")
          : "nenhum alerta ativo";
  // Fontes fora do ar, uma linha cada, na faixa de aviso.
  const downSources = (data?.sources || []).filter((source) => !source.ok);

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
          {/* Uma pilula por pagina, na cor do estado dela: mostra onde ha problema sem esperar o carrossel. */}
          <nav className="noc-chips" aria-label="Páginas do painel">
            {pageStates.map(({ entry, tone }) => {
              const position = pages.indexOf(entry);
              const active = entry.id === current.id || (current.id === "overview-2" && entry.id === "overview");
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  title={`${position + 1}. ${entry.title} · ${toneLabel(tone)}`}
                  className={`tone-${tone}${active ? " active" : ""}`}
                  onClick={() => {
                    setElapsed(0);
                    setPage(position);
                  }}
                >
                  <i aria-hidden="true" /> {entry.short}
                </button>
              );
            })}
          </nav>
        </div>
        <div className={`noc-global tone-${globalTone}`}>
          {toneIcon(globalTone, 22)}
          <div>
            <strong>{globalTitle}</strong>
            <small>{globalDetail}</small>
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
          <select
            value={intervalSec}
            onChange={(event) => setIntervalSec(Number(event.target.value))}
            aria-label="Ritmo do carrossel"
            title="Ritmo do carrossel: 20 s é o normal (cada página tem seu tempo; verde passa mais rápido, crítico fica mais)"
          >
            {[10, 15, 20, 30, 45, 60].map((value) => <option key={value} value={value}>{value}s</option>)}
          </select>
          {!kiosk && isAdmin ? (
            <button type="button" aria-label="Dispositivos monitorados" title="Dispositivos monitorados (cadastrar, editar, remover)" onClick={() => setShowDevices(true)}>
              <Server size={18} />
            </button>
          ) : null}
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
      <div className="noc-progress" aria-hidden="true"><i style={{ width: `${paused ? 100 : Math.min(100, (elapsed / pageSeconds) * 100)}%` }} className={paused ? "paused" : ""} /></div>

      <div className="noc-stale-slot">
        {data && (error || stale) ? (
          <p className="noc-stale is-blind">
            <AlertTriangle size={22} /> <strong>SEM DADOS ATUALIZADOS desde {hhmm(data.generatedAt)}</strong>
            <span>{error ? `o painel não consegue falar com o servidor (${error})` : "o servidor parou de atualizar"} · exibindo a última leitura</span>
          </p>
        ) : !data && error ? (
          <p className="noc-stale is-blind"><AlertTriangle size={22} /> <strong>SEM CONEXÃO COM O SERVIDOR</strong> <span>{error}</span></p>
        ) : null}
        {downSources.map((source) => (
          <p key={source.id} className="noc-stale">
            <AlertTriangle size={18} /> <strong>{source.label.toUpperCase()} SEM RESPOSTA</strong>
            <span>
              {source.id === "zabbix"
                ? "hosts, links e problemas podem estar desatualizados"
                : source.at
                  ? `exibindo a leitura das ${hhmm(source.at)}`
                  : "dados desta fonte indisponíveis"}
              {" · "}
              {source.error}
            </span>
          </p>
        ))}
      </div>

      <main className="noc-stage">
        {!data ? (
          <p className="noc-empty">Carregando dados do Zabbix...</p>
        ) : current.id === "overview" || current.id === "overview-2" ? (
          <OverviewPage data={data} />
        ) : current.id === "internet" ? (
          <InternetPage data={data} />
        ) : current.controllerId ? (
          (() => {
            const controller = data.unifi?.controllers.find((entry) => entry.id === current.controllerId);
            return controller ? <ControllerPage controller={controller} /> : <p className="noc-empty">Controladora indisponível.</p>;
          })()
        ) : current.id === "unifi-down" ? (
          <div className="noc-page noc-unifi">
            <section className="noc-card noc-ctrl-down">
              <XCircle size={48} />
              <h3>Controladoras UniFi sem resposta</h3>
              <p>{sourceDown(data, "unifi")?.error || "Nenhuma controladora respondeu."}</p>
              <small>Antenas e switches UniFi com estado desconhecido.</small>
            </section>
          </div>
        ) : current.id === "antenas" ? (
          <GroupPage data={data} keys={["antenas"]} />
        ) : current.id === "seguranca" ? (
          <SecurityPage data={data} />
        ) : current.id === "servidores" ? (
          <ServersPage data={data} />
        ) : current.id === "acesso" ? (
          <AccessPage data={data} />
        ) : current.id === "trafego" && data.analyzer ? (
          <TrafficPage analyzer={data.analyzer} />
        ) : (
          <p className="noc-empty">Página indisponível.</p>
        )}
      </main>

      <footer className="noc-ticker noc-foot" aria-label="Alertas ativos e fontes de dados">
        <span className={`noc-ticker-label tone-${globalTone}`}><AlertOctagon size={16} /> Alertas</span>
        <div className="noc-ticker-track">
          {tickerProblems.length ? (
            (() => {
              // Um alerta por vez, parado, trocando a cada 6 s (texto rolando e ruim de ler de longe).
              const position = Math.floor(now.getTime() / 6000) % tickerProblems.length;
              const problem = tickerProblems[position];
              return (
                <span key={problem.id} className={`noc-ticker-item ${SEVERITY[problem.severity]?.tone}`}>
                  <b>{SEVERITY[problem.severity]?.label}</b> {problem.host} · {translateProblem(problem.name)} · há {duration(problem.since)}
                  {tickerProblems.length > 1 ? <small> {position + 1}/{tickerProblems.length}</small> : null}
                </span>
              );
            })()
          ) : (
            <span className="noc-ticker-ok">
              {zabbixDown ? <><AlertTriangle size={16} /> Zabbix sem resposta: alertas indisponíveis</> : <><ShieldCheck size={16} /> Nenhum alerta grave ou dos últimos 7 dias</>}
            </span>
          )}
        </div>
        <span className="noc-sources" aria-label="Fontes de dados">
          {(data?.sources || []).map((source) => (
            <span key={source.id} className={source.ok ? "tone-good" : "tone-critical"} title={source.ok ? `${source.label}: ok` : `${source.label}: ${source.error}`}>
              <i aria-hidden="true" /> {source.label}
            </span>
          ))}
        </span>
        <span className="noc-updated">{data ? `atualizado ${new Date(data.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span>
      </footer>
      {showUnifi ? <UnifiSettings onClose={() => setShowUnifi(false)} onSaved={() => window.setTimeout(load, 1500)} /> : null}
      {showDevices ? <DevicesManager onClose={() => setShowDevices(false)} onChanged={() => window.setTimeout(load, 1500)} /> : null}
    </div>
  );
}
