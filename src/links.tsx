import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Gauge,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  Table as TableIcon,
  Timer,
  Wifi,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";

/* ---------- Tipos (espelham server/zabbixClient.ts) ---------- */

type LiveLink = {
  id: string;
  name: string;
  contractedMbps: number;
  inBps: number;
  outBps: number;
  usagePercent: number | null;
  online: boolean;
  interfaceUp: boolean | null;
  latencyMs: number | null;
  lossPercent: number | null;
  stale: boolean;
  configured: boolean;
};
type LinkProblem = { id: string; name: string; severity: number; at: string };
type LiveData = { checkedAt: string; links: LiveLink[]; problems: LinkProblem[] };
type SeriesPoint = { t: number; in: number | null; out: number | null; latency: number | null };
type HistoryLink = {
  id: string;
  name: string;
  contractedMbps: number;
  stats: { inPeakMbps: number; outPeakMbps: number; inAvgMbps: number; outAvgMbps: number; inP95Mbps: number; outP95Mbps: number };
  series: SeriesPoint[];
};
type HistoryData = { range: string; from: string; to: string; bucketSeconds: number; links: HistoryLink[] };
type LinkConfig = { id: string; name: string; contractedMbps: number; color: string; inItemId: string; outItemId: string; statusItemId: string; pingHostId: string; enabled: boolean };
type Candidates = {
  interfaces: { hostId: string; host: string; name: string; inItemId: string; outItemId: string; statusItemId: string; inBps: number; outBps: number }[];
  pingHosts: { hostId: string; name: string }[];
};

const RANGES = [
  { id: "1h", label: "1 hora" },
  { id: "6h", label: "6 horas" },
  { id: "24h", label: "24 horas" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
];
const RANGE_STORAGE_KEY = "rede-clube-links-range";

/* ---------- API ---------- */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function authToken() {
  try {
    const raw = window.localStorage.getItem("rede-clube-session");
    return raw ? (JSON.parse(raw) as { token?: string }).token || "" : "";
  } catch {
    return "";
  }
}

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${authToken()}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 401) window.dispatchEvent(new Event("rede-clube-auth-expired"));
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { message?: string }).message || "Falha ao falar com o servidor.");
  return payload as T;
}

/* ---------- Formatacao ---------- */

function formatRate(mbps: number | null | undefined) {
  if (mbps === null || mbps === undefined || Number.isNaN(mbps)) return "—";
  if (mbps >= 1000) {
    const gbps = mbps / 1000;
    return `${Number.isInteger(gbps) ? gbps : gbps.toFixed(2)} Gbps`;
  }
  if (mbps >= 100) return `${Math.round(mbps)} Mbps`;
  return `${mbps.toFixed(1)} Mbps`;
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}%`;
}

function axisRate(mbps: number) {
  if (!mbps) return "0";
  if (mbps >= 1000) return `${Number((mbps / 1000).toFixed(1))}G`;
  return `${Number(mbps.toFixed(mbps < 10 ? 1 : 0))}M`;
}

function formatBps(bps: number) {
  return formatRate(bps / 1e6);
}

function formatTick(t: number, range: string) {
  const date = new Date(t);
  if (range === "7d" || range === "30d") return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatWhen(t: number) {
  return new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function usageTone(percent: number | null) {
  if (percent === null) return { tone: "none", label: "Sem contratado" };
  if (percent >= 90) return { tone: "critical", label: "Saturado" };
  if (percent >= 70) return { tone: "warning", label: "Uso alto" };
  return { tone: "good", label: "Normal" };
}

function severityLabel(severity: number) {
  return ["Não classificado", "Informação", "Atenção", "Média", "Alta", "Desastre"][severity] || "Alerta";
}

/* ---------- Componentes ---------- */

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { dataKey: string; value: number | null; color: string }[]; label?: number; unit: "rate" | "ms" }) {
  if (!active || !payload?.length || label === undefined) return null;
  const names: Record<string, string> = { in: "Download", out: "Upload", latency: "Latência" };
  return (
    <div className="lk-tooltip">
      <strong>{formatWhen(label)}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey}>
          <i style={{ background: entry.color }} />
          {names[entry.dataKey] || entry.dataKey}
          <b>{entry.value === null ? "—" : unit === "rate" ? formatRate(entry.value) : `${entry.value} ms`}</b>
        </span>
      ))}
    </div>
  );
}

// Medidor de uso do link (status: normal / alto / saturado, sempre com rotulo).
function UsageGauge({ percent }: { percent: number | null }) {
  const value = Math.max(0, Math.min(100, percent ?? 0));
  const { tone, label } = usageTone(percent);
  const radius = 52;
  const circumference = Math.PI * radius;
  return (
    <div className={`lk-gauge tone-${tone}`} role="img" aria-label={`Uso do link: ${percent === null ? "sem contratado" : `${percent}%`} (${label})`}>
      <svg viewBox="0 0 128 72" aria-hidden="true">
        <path d="M 12 64 A 52 52 0 0 1 116 64" className="lk-gauge-track" />
        <path d="M 12 64 A 52 52 0 0 1 116 64" className="lk-gauge-fill" strokeDasharray={`${(value / 100) * circumference} ${circumference}`} />
      </svg>
      <strong>{formatPercent(percent)}</strong>
      <span>{tone === "critical" ? <XCircle size={12} /> : tone === "warning" ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />} {label}</span>
    </div>
  );
}

function LinkPanel({ live, history, range, loadingHistory }: { live: LiveLink; history?: HistoryLink; range: string; loadingHistory: boolean }) {
  const [showTable, setShowTable] = useState(false);
  const series = history?.series || [];
  const hasLatency = series.some((point) => point.latency !== null);

  return (
    <section className={`lk-panel ${live.online ? "" : "down"}`} aria-label={`Link ${live.name}`}>
      <header className="lk-panel-head">
        <div>
          <h3>{live.name}</h3>
          <small>{live.contractedMbps ? `Contratado ${formatRate(live.contractedMbps)}` : "Velocidade contratada não informada"}</small>
        </div>
        <span className={`lk-status ${live.online ? "up" : "down"}`}>
          {live.online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {live.online ? "Online" : "Offline"}
        </span>
      </header>

      <div className="lk-now">
        <div className="lk-now-rates">
          <div>
            <span><ArrowDown size={14} className="lk-ico-in" /> Download</span>
            <strong>{formatBps(live.inBps)}</strong>
          </div>
          <div>
            <span><ArrowUp size={14} className="lk-ico-out" /> Upload</span>
            <strong>{formatBps(live.outBps)}</strong>
          </div>
          <div>
            <span><Timer size={14} /> Latência</span>
            <strong>{live.latencyMs === null ? "—" : `${live.latencyMs} ms`}</strong>
          </div>
          <div>
            <span><Gauge size={14} /> Perda</span>
            <strong className={live.lossPercent ? "lk-bad" : ""}>{live.lossPercent === null ? "—" : `${live.lossPercent}%`}</strong>
          </div>
        </div>
        <UsageGauge percent={live.usagePercent} />
      </div>

      {!live.configured ? (
        <p className="lk-warn"><AlertTriangle size={14} /> Interface de tráfego não definida para este link. Configure em "Configurar links".</p>
      ) : live.stale ? (
        <p className="lk-warn"><AlertTriangle size={14} /> O Zabbix não coleta o tráfego deste link há mais de 10 minutos.</p>
      ) : null}

      <div className="lk-chart-head">
        <span>Consumo · {RANGES.find((item) => item.id === range)?.label}</span>
        <span className="lk-legend"><i className="in" /> Download <i className="out" /> Upload</span>
        <button type="button" className={`lk-mini-btn ${showTable ? "active" : ""}`} onClick={() => setShowTable((value) => !value)} aria-pressed={showTable}>
          <TableIcon size={13} /> Tabela
        </button>
      </div>

      <div className={`lk-chart ${loadingHistory ? "loading" : ""}`}>
        {showTable ? (
          <div className="lk-table-wrap">
            <table className="lk-table">
              <thead><tr><th>Horário</th><th>Download</th><th>Upload</th><th>Latência</th></tr></thead>
              <tbody>
                {[...series].reverse().map((point) => (
                  <tr key={point.t}>
                    <td>{formatWhen(point.t)}</td>
                    <td>{formatRate(point.in)}</td>
                    <td>{formatRate(point.out)}</td>
                    <td>{point.latency === null ? "—" : `${point.latency} ms`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : series.length ? (
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`in-${live.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--lk-in)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--lk-in)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`out-${live.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--lk-out)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--lk-out)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--lk-grid)" />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={(t) => formatTick(t, range)} tick={{ fill: "var(--lk-muted)", fontSize: 11 }} axisLine={{ stroke: "var(--lk-axis)" }} tickLine={false} minTickGap={40} />
              <YAxis tickFormatter={(v) => axisRate(Number(v))} tick={{ fill: "var(--lk-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<ChartTooltip unit="rate" />} cursor={{ stroke: "var(--lk-axis)", strokeWidth: 1 }} />
              <Area type="monotone" dataKey="in" stroke="var(--lk-in)" strokeWidth={2} fill={`url(#in-${live.id})`} isAnimationActive={false} connectNulls activeDot={{ r: 4, stroke: "var(--lk-surface)", strokeWidth: 2 }} />
              <Area type="monotone" dataKey="out" stroke="var(--lk-out)" strokeWidth={2} fill={`url(#out-${live.id})`} isAnimationActive={false} connectNulls activeDot={{ r: 4, stroke: "var(--lk-surface)", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="lk-empty">{loadingHistory ? "Carregando histórico..." : "Sem dados de tráfego no período."}</p>
        )}
      </div>

      {history ? (
        <dl className="lk-stats">
          <div><dt>Pico down</dt><dd>{formatRate(history.stats.inPeakMbps)}</dd></div>
          <div><dt>Média down</dt><dd>{formatRate(history.stats.inAvgMbps)}</dd></div>
          <div><dt>95% down</dt><dd title="95% do tempo o consumo ficou abaixo deste valor">{formatRate(history.stats.inP95Mbps)}</dd></div>
          <div><dt>Pico up</dt><dd>{formatRate(history.stats.outPeakMbps)}</dd></div>
          <div><dt>Média up</dt><dd>{formatRate(history.stats.outAvgMbps)}</dd></div>
          <div><dt>95% up</dt><dd>{formatRate(history.stats.outP95Mbps)}</dd></div>
        </dl>
      ) : null}

      {hasLatency && !showTable ? (
        <div className="lk-latency">
          <span>Latência (ms)</span>
          <ResponsiveContainer width="100%" height={70}>
            <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" hide />
              <YAxis tick={{ fill: "var(--lk-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<ChartTooltip unit="ms" />} cursor={{ stroke: "var(--lk-axis)", strokeWidth: 1 }} />
              <Line type="monotone" dataKey="latency" stroke="var(--lk-latency)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </section>
  );
}

/* ---------- Configuracao (gestor) ---------- */

function LinkSettings({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [links, setLinks] = useState<LinkConfig[]>([]);
  const [candidates, setCandidates] = useState<Candidates | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api<{ links: LinkConfig[] }>("/api/links/config"), api<Candidates>("/api/links/candidates")])
      .then(([config, options]) => {
        setLinks(config.links);
        setCandidates(options);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Falha ao carregar."));
  }, []);

  const update = (index: number, patch: Partial<LinkConfig>) => setLinks((current) => current.map((link, i) => (i === index ? { ...link, ...patch } : link)));

  async function save(next: LinkConfig[]) {
    setSaving(true);
    try {
      await api("/api/links/config", "PUT", { links: next });
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="lk-modal-backdrop" onClick={onClose} />
      <div className="lk-modal" role="dialog" aria-modal="true" aria-label="Configurar links">
        <header>
          <h3>Configurar links</h3>
          <button type="button" className="lk-icon-btn" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </header>
        <p className="lk-modal-hint">Para cada link, escolha a interface do firewall que mede o tráfego, o host de ping e a velocidade contratada.</p>
        {error ? <p className="lk-warn"><AlertTriangle size={14} /> {error}</p> : null}
        {!candidates ? <p className="lk-empty">Carregando interfaces do Zabbix...</p> : (
          <div className="lk-config-list">
            {links.map((link, index) => {
              const selected = candidates.interfaces.find((entry) => entry.inItemId === link.inItemId);
              return (
                <div className="lk-config-row" key={link.id}>
                  <label>
                    <span>Nome</span>
                    <input value={link.name} maxLength={40} onChange={(event) => update(index, { name: event.target.value })} />
                  </label>
                  <label>
                    <span>Contratado (Mbps)</span>
                    <input type="number" min={0} value={link.contractedMbps} onChange={(event) => update(index, { contractedMbps: Number(event.target.value) })} />
                  </label>
                  <label className="wide">
                    <span>Interface de tráfego</span>
                    <select
                      value={selected ? `${selected.hostId}:${selected.name}` : ""}
                      onChange={(event) => {
                        const entry = candidates.interfaces.find((item) => `${item.hostId}:${item.name}` === event.target.value);
                        if (entry) update(index, { inItemId: entry.inItemId, outItemId: entry.outItemId, statusItemId: entry.statusItemId });
                      }}
                    >
                      <option value="">— escolha —</option>
                      {candidates.interfaces.map((entry) => (
                        <option key={`${entry.hostId}:${entry.name}`} value={`${entry.hostId}:${entry.name}`}>
                          {entry.host} · {entry.name} ({formatBps(entry.inBps)} / {formatBps(entry.outBps)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Host de ping</span>
                    <select value={link.pingHostId} onChange={(event) => update(index, { pingHostId: event.target.value })}>
                      <option value="">— nenhum —</option>
                      {candidates.pingHosts.map((host) => <option key={host.hostId} value={host.hostId}>{host.name}</option>)}
                    </select>
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={link.enabled} onChange={(event) => update(index, { enabled: event.target.checked })} />
                    <span>Exibir</span>
                  </label>
                </div>
              );
            })}
          </div>
        )}
        <footer>
          <button type="button" className="lk-btn ghost" disabled={saving} onClick={() => window.confirm("Voltar para a descoberta automática dos links?") && save([])}>
            Descoberta automática
          </button>
          <button
            type="button"
            className="lk-btn ghost"
            disabled={!candidates}
            onClick={() => setLinks((current) => [...current, { id: `link-${Date.now()}`, name: "Novo link", contractedMbps: 0, color: "#3987e5", inItemId: "", outItemId: "", statusItemId: "", pingHostId: "", enabled: true }])}
          >
            + Link
          </button>
          <button type="button" className="lk-btn primary" disabled={saving || !candidates} onClick={() => save(links)}>{saving ? "Salvando..." : "Salvar"}</button>
        </footer>
      </div>
    </>
  );
}

/* ---------- Tela ---------- */

export function LinksDashboard({ isAdmin }: { isAdmin: boolean }) {
  const [range, setRange] = useState(() => {
    try {
      return window.localStorage.getItem(RANGE_STORAGE_KEY) || "24h";
    } catch {
      return "24h";
    }
  });
  const [live, setLive] = useState<LiveData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [error, setError] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadLive = useCallback(async () => {
    try {
      setLive(await api<LiveData>("/api/links"));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao consultar o Zabbix.");
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      setHistory(await api<HistoryData>(`/api/links/history?range=${encodeURIComponent(range)}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar o histórico.");
    } finally {
      setLoadingHistory(false);
    }
  }, [range]);

  useEffect(() => {
    loadLive();
    const timer = window.setInterval(loadLive, 10000);
    return () => window.clearInterval(timer);
  }, [loadLive]);

  useEffect(() => {
    try {
      window.localStorage.setItem(RANGE_STORAGE_KEY, range);
    } catch {
      /* preferencia local */
    }
    loadHistory();
    const timer = window.setInterval(loadHistory, range === "7d" || range === "30d" ? 300000 : 60000);
    return () => window.clearInterval(timer);
  }, [loadHistory, range]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const totals = useMemo(() => {
    const links = live?.links || [];
    const busiest = [...links].filter((link) => link.usagePercent !== null).sort((a, b) => (b.usagePercent || 0) - (a.usagePercent || 0))[0];
    return {
      inBps: links.reduce((sum, link) => sum + link.inBps, 0),
      outBps: links.reduce((sum, link) => sum + link.outBps, 0),
      online: links.filter((link) => link.online).length,
      total: links.length,
      busiest,
    };
  }, [live]);

  const historyById = new Map((history?.links || []).map((link) => [link.id, link]));

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }

  return (
    <div className={`lk-root ${fullscreen ? "fullscreen" : ""}`} ref={rootRef}>
      <div className="lk-toolbar">
        <div className="lk-title">
          <h2>Links de internet</h2>
          <small>
            Fonte: Zabbix · atualiza a cada 30s
            {live ? ` · última leitura ${new Date(live.checkedAt).toLocaleTimeString("pt-BR")}` : ""}
          </small>
        </div>
        <div className="lk-ranges" role="radiogroup" aria-label="Período">
          {RANGES.map((item) => (
            <button key={item.id} type="button" role="radio" aria-checked={range === item.id} className={range === item.id ? "active" : ""} onClick={() => setRange(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="lk-icon-btn" title="Atualizar" aria-label="Atualizar" onClick={() => { loadLive(); loadHistory(); }}>
          <RefreshCw size={16} />
        </button>
        <button type="button" className="lk-icon-btn" title={fullscreen ? "Sair do modo TV" : "Modo TV (tela cheia)"} aria-label="Modo TV" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        {isAdmin ? (
          <button type="button" className="lk-btn ghost" onClick={() => setSettingsOpen(true)}>
            <Settings size={15} /> Configurar links
          </button>
        ) : null}
      </div>

      {error ? <p className="lk-warn" role="alert"><AlertTriangle size={14} /> {error}</p> : null}

      <div className="lk-tiles">
        <div className="lk-tile">
          <span><ArrowDown size={14} className="lk-ico-in" /> Download total agora</span>
          <strong>{live ? formatBps(totals.inBps) : "—"}</strong>
        </div>
        <div className="lk-tile">
          <span><ArrowUp size={14} className="lk-ico-out" /> Upload total agora</span>
          <strong>{live ? formatBps(totals.outBps) : "—"}</strong>
        </div>
        <div className={`lk-tile ${live && totals.online < totals.total ? "bad" : ""}`}>
          <span>{live && totals.online < totals.total ? <WifiOff size={14} /> : <Wifi size={14} />} Links online</span>
          <strong>{live ? `${totals.online} de ${totals.total}` : "—"}</strong>
        </div>
        <div className="lk-tile">
          <span><Gauge size={14} /> Maior uso agora</span>
          <strong>{totals.busiest ? formatPercent(totals.busiest.usagePercent) : "—"}</strong>
          <small>{totals.busiest ? totals.busiest.name : ""}</small>
        </div>
        <div className={`lk-tile ${live?.problems.length ? "warn" : ""}`}>
          <span><AlertTriangle size={14} /> Alertas no Zabbix</span>
          <strong>{live ? live.problems.length : "—"}</strong>
        </div>
      </div>

      <div className="lk-panels">
        {(live?.links || []).map((link) => (
          <LinkPanel key={link.id} live={link} history={historyById.get(link.id)} range={range} loadingHistory={loadingHistory && !historyById.has(link.id)} />
        ))}
        {live && !live.links.length ? <p className="lk-empty">Nenhum link encontrado no Zabbix. {isAdmin ? "Use \"Configurar links\"." : ""}</p> : null}
      </div>

      <section className="lk-problems" aria-label="Alertas do Zabbix">
        <h3><AlertTriangle size={16} /> Alertas ativos dos links e do firewall</h3>
        {live?.problems.length ? (
          <ul>
            {live.problems.map((problem) => (
              <li key={problem.id} className={`sev-${problem.severity}`}>
                <span className="lk-sev">{severityLabel(problem.severity)}</span>
                <strong>{problem.name}</strong>
                <time>desde {formatWhen(new Date(problem.at).getTime())}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lk-ok"><CheckCircle2 size={15} /> Nenhum alerta ativo.</p>
        )}
      </section>

      {settingsOpen ? <LinkSettings onClose={() => setSettingsOpen(false)} onSaved={() => { loadLive(); loadHistory(); }} /> : null}
    </div>
  );
}
