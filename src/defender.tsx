import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Laptop,
  Lock,
  Mail,
  RefreshCw,
  ScanSearch,
  Search,
  ShieldAlert,
  Trash2,
  Unlock,
  UserCheck,
  X,
} from "lucide-react";
import { defenderName } from "./defenderNames";

// Menu "Microsoft Defender": incidentes (atribuir, status, classificar, comentar), maquinas
// (isolar, antivirus, restringir apps, coletar pacote) e quarentena de e-mail (liberar/excluir).

type Capabilities = {
  incidents: boolean;
  alerts: boolean;
  machines: boolean;
  machineActions: { isolate: boolean; scan: boolean; restrict: boolean; collect: boolean };
  quarantine: boolean;
};
type Comment = { comment: string; createdByDisplayName?: string; createdDateTime?: string };
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
  comments?: Comment[];
};
type Evidence = { type: string; verdict?: string; remediation?: string; device?: string; user?: string; file?: string; ip?: string; url?: string; subject?: string; sender?: string; recipient?: string };
type IncidentAlert = { id: string; title: string; severity: string; status: string; serviceSource: string; description?: string; recommendedActions?: string; createdDateTime: string; alertWebUrl?: string; evidence: Evidence[] };
type Machine = { id: string; name: string; os: string; health: string; risk: string; exposure: string; av: string; onboarding: string; lastSeen: string; ip: string; user: string };
type MachineAction = { id: string; machineId: string; machine: string; type: string; status: string; requestor: string; comment: string; created: string };
type QuarantineMessage = { identity: string; received: string; sender: string; recipients: string[]; subject: string; type: string; policy: string; released: string; size: number; expires: string; direction: string };

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

const SEVERITY: Record<string, { label: string; tone: string; rank: number }> = {
  high: { label: "Alto", tone: "critical", rank: 0 },
  medium: { label: "Médio", tone: "warning", rank: 1 },
  low: { label: "Baixo", tone: "muted", rank: 2 },
  informational: { label: "Info", tone: "muted", rank: 3 },
};
const STATUS: Record<string, string> = { active: "Novo", new: "Novo", inProgress: "Em andamento", resolved: "Resolvido", redirected: "Redirecionado" };
const CLASSIFICATION: Record<string, string> = {
  unknown: "Não classificado",
  truePositive: "Ameaça real (verdadeiro positivo)",
  informationalExpectedActivity: "Atividade esperada / informativo",
  falsePositive: "Falso positivo",
};
const DETERMINATION: Record<string, string> = {
  unknown: "—",
  malware: "Malware",
  phishing: "Phishing",
  compromisedAccount: "Conta comprometida",
  maliciousUserActivity: "Atividade maliciosa de usuário",
  unwantedSoftware: "Software indesejado",
  multiStagedAttack: "Ataque em várias etapas",
  apt: "Ataque direcionado (APT)",
  securityTesting: "Teste de segurança",
  securityPersonnel: "Equipe de segurança",
  confirmedActivity: "Atividade confirmada pelo usuário",
  lineOfBusinessApplication: "Aplicativo da empresa",
  notMalicious: "Não malicioso",
  notEnoughDataToValidate: "Dados insuficientes",
  other: "Outro",
};
const QUARANTINE_TYPES: Record<string, string> = {
  Spam: "Spam",
  HighConfSpam: "Spam (alta confiança)",
  Phish: "Phishing",
  HighConfPhish: "Phishing (alta confiança)",
  Malware: "Malware",
  Bulk: "E-mail em massa",
  SPOOF: "Remetente falsificado",
  TransportRule: "Regra de transporte",
  FileTypeBlock: "Tipo de arquivo bloqueado",
};
const DANGEROUS_QUARANTINE = /malware|highconfphish/i;
const MACHINE_ACTION_NAMES: Record<string, string> = {
  Isolate: "Isolar",
  Unisolate: "Liberar isolamento",
  RunAntiVirusScan: "Antivírus",
  RestrictCodeExecution: "Restringir apps",
  UnrestrictCodeExecution: "Liberar apps",
  CollectInvestigationPackage: "Coletar pacote",
};
const ACTION_STATUS: Record<string, string> = { Pending: "Pendente", InProgress: "Em execução", Succeeded: "Concluída", Failed: "Falhou", TimeOut: "Expirou", Cancelled: "Cancelada" };

const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const daysOpen = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));

type Tab = "incidents" | "machines" | "quarantine";

export function DefenderDashboard() {
  const [tab, setTab] = useState<Tab>("incidents");
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [capsError, setCapsError] = useState("");

  useEffect(() => {
    api<Capabilities>("/api/defender/capabilities").then(setCaps).catch((error) => setCapsError(error instanceof Error ? error.message : String(error)));
  }, []);

  return (
    <div className="ct-page df-page">
      <div className="ct-filters df-tabs" role="tablist" aria-label="Áreas do Defender">
        {([
          ["incidents", "Incidentes", ShieldAlert],
          ["machines", "Máquinas", Laptop],
          ["quarantine", "Quarentena de e-mail", Mail],
        ] as [Tab, string, typeof ShieldAlert][]).map(([key, label, Icon]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {capsError ? <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>{capsError}</span></div> : null}
      {tab === "incidents" ? <IncidentsTab canEdit={Boolean(caps?.incidents)} /> : null}
      {tab === "machines" ? <MachinesTab caps={caps} /> : null}
      {tab === "quarantine" ? <QuarantineTab enabled={caps ? caps.quarantine : null} /> : null}
    </div>
  );
}

function Missing({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ct-card df-missing">
      <h3><Lock size={18} /> {title}</h3>
      <div>{children}</div>
    </section>
  );
}

/* ---------- Incidentes ---------- */
type IncidentFilter = "open" | "active" | "inProgress" | "resolved" | "all";

function IncidentsTab({ canEdit }: { canEdit: boolean }) {
  const [filter, setFilter] = useState<IncidentFilter>("open");
  const [term, setTerm] = useState("");
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setIncidents((await api<{ incidents: Incident[] }>(`/api/defender/incidents?status=${filter}`)).incidents);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [filter]);

  useEffect(() => {
    setIncidents(null);
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return (incidents || [])
      .filter((incident) => !needle || `${incident.displayName} ${defenderName(incident.displayName)} ${incident.assignedTo || ""} ${incident.id}`.toLowerCase().includes(needle))
      .sort((a, b) => (SEVERITY[a.severity]?.rank ?? 4) - (SEVERITY[b.severity]?.rank ?? 4) || b.createdDateTime.localeCompare(a.createdDateTime));
  }, [incidents, term]);

  const open = (incidents || []).filter((incident) => incident.status !== "resolved");
  const serious = open.filter((incident) => incident.severity === "high" || incident.severity === "medium");
  const unassigned = open.filter((incident) => !incident.assignedTo);

  return (
    <>
      {error ? <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>{error}</span></div> : null}
      {filter === "open" && incidents ? (
        <section className="ct-kpis">
          <div className={`ct-kpi${serious.length ? " tone-warning" : ""}`}><span>Incidentes abertos</span><strong>{open.length}</strong><small>{serious.length} médios ou altos</small></div>
          <div className={`ct-kpi${unassigned.length ? " tone-warning" : ""}`}><span>Sem responsável</span><strong>{unassigned.length}</strong><small>ninguém analisando</small></div>
          <div className="ct-kpi"><span>Em andamento</span><strong>{open.filter((incident) => incident.status === "inProgress").length}</strong><small>com alguém tratando</small></div>
          <div className="ct-kpi"><span>Mais antigo aberto</span><strong>{open.length ? `${Math.max(...open.map((incident) => daysOpen(incident.createdDateTime)))} dias` : "—"}</strong><small>desde a criação</small></div>
        </section>
      ) : null}
      <section className="ct-table-card">
        <div className="ct-toolbar">
          <div className="ct-filters" role="tablist" aria-label="Filtrar incidentes">
            {([
              ["open", "Abertos"],
              ["active", "Novos"],
              ["inProgress", "Em andamento"],
              ["resolved", "Resolvidos"],
              ["all", "Todos"],
            ] as [IncidentFilter, string][]).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
          <label className="pm-search">
            <Search size={16} />
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar incidente, responsável ou número" />
          </label>
          <button className="pm-icon-btn" type="button" title="Atualizar" aria-label="Atualizar" onClick={load}><RefreshCw size={16} /></button>
        </div>
        <div className="ct-table-wrap">
          <table className="ct-table">
            <thead>
              <tr>
                <th>Severidade</th>
                <th>Incidente</th>
                <th>Status</th>
                <th>Responsável</th>
                <th>Classificação</th>
                <th className="num">Aberto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((incident) => (
                <tr key={incident.id} onClick={() => setOpenId(incident.id)}>
                  <td><span className={`ct-pill tone-${SEVERITY[incident.severity]?.tone || "muted"}`}>{SEVERITY[incident.severity]?.label || incident.severity}</span></td>
                  <td>
                    <strong className="ct-title">{defenderName(incident.displayName)}</strong>
                    <small className="ct-cat">#{incident.id} · {incident.displayName}</small>
                  </td>
                  <td>{STATUS[incident.status] || incident.status}</td>
                  <td>{incident.assignedTo || <span className="ct-muted">ninguém</span>}</td>
                  <td>{incident.classification && incident.classification !== "unknown" ? CLASSIFICATION[incident.classification] || incident.classification : <span className="ct-muted">—</span>}</td>
                  <td className="num" title={fmtDateTime(incident.createdDateTime)}>{daysOpen(incident.createdDateTime) ? `${daysOpen(incident.createdDateTime)} d` : "hoje"}</td>
                </tr>
              ))}
              {incidents && !rows.length ? <tr><td colSpan={6} className="ct-empty-row">Nenhum incidente neste filtro.</td></tr> : null}
              {!incidents && !error ? <tr><td colSpan={6} className="ct-empty-row">Carregando incidentes do Defender...</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {openId ? <IncidentModal id={openId} canEdit={canEdit} onClose={() => setOpenId(null)} onChanged={load} /> : null}
    </>
  );
}

function IncidentModal({ id, canEdit, onClose, onChanged }: { id: string; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const [incident, setIncident] = useState<(Incident & { alerts: IncidentAlert[] }) | null>(null);
  const [form, setForm] = useState({ status: "", classification: "", determination: "", comment: "" });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const apply = (data: Incident & { alerts: IncidentAlert[] }) => {
    setIncident(data);
    setForm({ status: data.status, classification: data.classification || "unknown", determination: data.determination || "unknown", comment: "" });
  };

  useEffect(() => {
    api<{ incident: Incident & { alerts: IncidentAlert[] } }>(`/api/defender/incidents/${id}`)
      .then((result) => apply(result.incident))
      .catch((error) => setMessage(error instanceof Error ? error.message : String(error)));
  }, [id]);

  async function save(extra: Record<string, unknown> = {}, label = "save") {
    if (!incident) return;
    const body: Record<string, unknown> = { ...extra };
    if (!("assignTo" in extra)) {
      if (form.status !== incident.status) body.status = form.status;
      if (form.classification !== (incident.classification || "unknown")) body.classification = form.classification;
      if (form.determination !== (incident.determination || "unknown")) body.determination = form.determination;
      if (form.comment.trim()) body.comment = form.comment.trim();
    }
    if (!Object.keys(body).length) {
      setMessage("Nada para salvar.");
      return;
    }
    setBusy(label);
    setMessage("");
    try {
      apply((await api<{ incident: Incident & { alerts: IncidentAlert[] } }>(`/api/defender/incidents/${id}`, "PATCH", body)).incident);
      setMessage("Salvo no Defender.");
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className="ct-backdrop" onClick={onClose} />
      <div className="ct-modal df-modal" role="dialog" aria-modal="true" aria-label="Incidente do Defender">
        <header>
          <h3>{incident ? defenderName(incident.displayName) : "Incidente"} <small className="ct-muted">#{id}</small></h3>
          <button type="button" className="pm-icon-btn" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </header>
        {!incident ? (
          <p className="df-pad">{message || "Carregando..."}</p>
        ) : (
          <div className="df-body">
            <div className="df-meta">
              <span className={`ct-pill tone-${SEVERITY[incident.severity]?.tone || "muted"}`}>{SEVERITY[incident.severity]?.label || incident.severity}</span>
              <span>{STATUS[incident.status] || incident.status}</span>
              <span>Aberto em {fmtDateTime(incident.createdDateTime)}</span>
              <span>Responsável: <b>{incident.assignedTo || "ninguém"}</b></span>
              {incident.incidentWebUrl ? <a className="ct-link" href={incident.incidentWebUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir no Defender</a> : null}
            </div>
            <p className="ct-muted df-original">{incident.displayName}</p>

            <h4>Alertas e evidências ({incident.alerts.length})</h4>
            <ul className="df-alerts">
              {incident.alerts.map((alert) => (
                <li key={alert.id}>
                  <div className="df-alert-head">
                    <span className={`ct-pill tone-${SEVERITY[alert.severity]?.tone || "muted"}`}>{SEVERITY[alert.severity]?.label || alert.severity}</span>
                    <strong>{defenderName(alert.title)}</strong>
                    <small className="ct-muted">{fmtDateTime(alert.createdDateTime)} · {STATUS[alert.status] || alert.status}</small>
                    {alert.alertWebUrl ? <a className="ct-link" href={alert.alertWebUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /></a> : null}
                  </div>
                  {alert.description ? <p className="df-desc">{alert.description.replace(/-V\d+(\.\d+)*$/, "").trim()}</p> : null}
                  {alert.evidence.length ? (
                    <div className="df-evidence">
                      {alert.evidence
                        .filter((evidence) => evidence.device || evidence.user || evidence.file || evidence.ip || evidence.url || evidence.subject || evidence.sender)
                        .slice(0, 12)
                        .map((evidence, index) => (
                          <span key={index} className={`df-ev${evidence.verdict === "malicious" ? " bad" : evidence.verdict === "suspicious" ? " warn" : ""}`} title={`${evidence.type} · ${evidence.verdict || ""}${evidence.remediation ? ` · ${evidence.remediation}` : ""}`}>
                            {[evidence.device && `💻 ${evidence.device}`, evidence.user && `👤 ${evidence.user}`, evidence.file && `📄 ${evidence.file}`, evidence.ip && `🌐 ${evidence.ip}`, evidence.url && `🔗 ${evidence.url}`, evidence.subject && `✉️ ${evidence.subject}`, evidence.sender && `de ${evidence.sender}`, evidence.recipient && `para ${evidence.recipient}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>

            {incident.comments?.length ? (
              <>
                <h4>Comentários</h4>
                <ul className="df-comments">
                  {incident.comments.map((comment, index) => (
                    <li key={index}><small className="ct-muted">{fmtDateTime(comment.createdDateTime)} · {comment.createdByDisplayName || "—"}</small><p>{comment.comment}</p></li>
                  ))}
                </ul>
              </>
            ) : null}

            {canEdit ? (
              <form className="ct-form df-actions" onSubmit={(event) => { event.preventDefault(); void save(); }}>
                <div className="wide df-quick">
                  <button type="button" className="ct-secondary" disabled={Boolean(busy)} onClick={() => save({ assignTo: "me", status: incident.status === "active" ? "inProgress" : undefined }, "me")}>
                    <UserCheck size={15} /> {busy === "me" ? "Atribuindo..." : "Assumir (atribuir a mim)"}
                  </button>
                  {incident.assignedTo ? (
                    <button type="button" className="ct-secondary" disabled={Boolean(busy)} onClick={() => save({ assignTo: "" }, "unassign")}>Remover responsável</button>
                  ) : null}
                </div>
                <label>
                  <span>Status</span>
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    <option value="active">Novo</option>
                    <option value="inProgress">Em andamento</option>
                    <option value="resolved">Resolvido</option>
                  </select>
                </label>
                <label>
                  <span>Classificação</span>
                  <select value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value, determination: "unknown" })}>
                    {Object.entries(CLASSIFICATION).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="wide">
                  <span>Determinação</span>
                  <select value={form.determination} onChange={(event) => setForm({ ...form, determination: event.target.value })}>
                    {Object.entries(DETERMINATION).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="wide">
                  <span>Comentário (fica no histórico do incidente no Defender)</span>
                  <textarea rows={3} maxLength={1000} value={form.comment} placeholder="O que foi verificado, o que foi feito..." onChange={(event) => setForm({ ...form, comment: event.target.value })} />
                </label>
                {message ? <p className={`wide ct-message${message.startsWith("Salvo") ? " ok" : ""}`}>{message}</p> : null}
                <footer className="wide">
                  <small className="ct-muted">Fica registrado com o seu nome no Defender e na auditoria do portal.</small>
                  <span />
                  <button type="submit" className="ct-primary" disabled={Boolean(busy)}>{busy === "save" ? "Salvando..." : "Salvar no Defender"}</button>
                </footer>
              </form>
            ) : (
              <p className="ct-muted df-pad">Somente leitura: o app ainda não tem SecurityIncident.ReadWrite.All.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- Maquinas ---------- */
function MachinesTab({ caps }: { caps: Capabilities | null }) {
  const [data, setData] = useState<{ machines: Machine[]; actions: MachineAction[] } | null>(null);
  const [error, setError] = useState("");
  const [term, setTerm] = useState("");
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [selected, setSelected] = useState<Machine | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api<{ machines: Machine[]; actions: MachineAction[] }>("/api/defender/machines"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, []);

  useEffect(() => {
    if (caps?.machines) void load();
  }, [caps?.machines, load]);

  if (caps && !caps.machines) {
    return (
      <Missing title="Máquinas ainda não liberadas">
        <p>Para ver e agir nas máquinas (isolar, rodar antivírus, restringir apps, coletar pacote), o app do portal precisa da API do <b>Defender for Endpoint</b>:</p>
        <ol>
          <li>Entra ID → Registros de aplicativo → app do portal → <b>Permissões de API</b> → Adicionar → <b>APIs que minha organização usa</b> → <b>WindowsDefenderATP</b>.</li>
          <li>Permissões de <b>aplicativo</b>: Machine.Read.All, Machine.Isolate, Machine.Scan, Machine.RestrictExecution, Machine.CollectForensics.</li>
          <li>Clique em <b>Conceder consentimento do administrador</b>.</li>
        </ol>
      </Missing>
    );
  }

  const riskRank: Record<string, number> = { High: 0, Medium: 1, Low: 2, Informational: 3, None: 4 };
  const rows = (data?.machines || [])
    .filter((machine) => !onlyRisk || ["High", "Medium"].includes(machine.risk))
    .filter((machine) => !term.trim() || `${machine.name} ${machine.user} ${machine.ip}`.toLowerCase().includes(term.trim().toLowerCase()))
    .sort((a, b) => (riskRank[a.risk] ?? 5) - (riskRank[b.risk] ?? 5) || a.name.localeCompare(b.name));
  const lastAction = (machineId: string) => data?.actions.find((action) => action.machineId === machineId);

  return (
    <>
      {error ? <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>{error}</span></div> : null}
      {data ? (
        <section className="ct-kpis">
          <div className="ct-kpi"><span>Máquinas no Defender</span><strong>{data.machines.length}</strong><small>{data.machines.filter((machine) => machine.health === "Active").length} ativas</small></div>
          <div className={`ct-kpi${data.machines.some((machine) => machine.risk === "High") ? " tone-critical" : ""}`}><span>Risco alto</span><strong>{data.machines.filter((machine) => machine.risk === "High").length}</strong><small>{data.machines.filter((machine) => machine.risk === "Medium").length} com risco médio</small></div>
          <div className={`ct-kpi${data.machines.some((machine) => machine.health !== "Active") ? " tone-warning" : ""}`}><span>Sem comunicar</span><strong>{data.machines.filter((machine) => machine.health !== "Active").length}</strong><small>inativas ou com sensor com problema</small></div>
          <div className="ct-kpi"><span>Ações recentes</span><strong>{data.actions.filter((action) => ["Pending", "InProgress"].includes(action.status)).length}</strong><small>pendentes ou em execução</small></div>
        </section>
      ) : null}
      <section className="ct-table-card">
        <div className="ct-toolbar">
          <label className="ct-check"><input type="checkbox" checked={onlyRisk} onChange={(event) => setOnlyRisk(event.target.checked)} /> <span>Só risco alto/médio</span></label>
          <label className="pm-search">
            <Search size={16} />
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar máquina, usuário ou IP" />
          </label>
          <button className="pm-icon-btn" type="button" title="Atualizar" aria-label="Atualizar" onClick={load}><RefreshCw size={16} /></button>
        </div>
        <div className="ct-table-wrap">
          <table className="ct-table">
            <thead>
              <tr>
                <th>Máquina</th>
                <th>Risco</th>
                <th>Exposição</th>
                <th>Sensor</th>
                <th>Antivírus</th>
                <th>Última ação</th>
                <th className="num">Visto</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 400).map((machine) => {
                const action = lastAction(machine.id);
                return (
                  <tr key={machine.id} onClick={() => setSelected(machine)}>
                    <td><strong className="ct-title">{machine.name}</strong><small className="ct-cat">{[machine.user, machine.os, machine.ip].filter(Boolean).join(" · ")}</small></td>
                    <td><span className={`ct-pill tone-${machine.risk === "High" ? "critical" : machine.risk === "Medium" ? "warning" : "muted"}`}>{machine.risk || "—"}</span></td>
                    <td>{machine.exposure || "—"}</td>
                    <td>{machine.health === "Active" ? "Ativo" : machine.health || "—"}</td>
                    <td>{machine.av || "—"}</td>
                    <td>{action ? `${MACHINE_ACTION_NAMES[action.type] || action.type} · ${ACTION_STATUS[action.status] || action.status}` : <span className="ct-muted">—</span>}</td>
                    <td className="num">{fmtDateTime(machine.lastSeen)}</td>
                  </tr>
                );
              })}
              {data && !rows.length ? <tr><td colSpan={7} className="ct-empty-row">Nenhuma máquina neste filtro.</td></tr> : null}
              {!data && !error ? <tr><td colSpan={7} className="ct-empty-row">Carregando máquinas do Defender...</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {selected && caps ? <MachineModal machine={selected} caps={caps} actions={(data?.actions || []).filter((action) => action.machineId === selected.id)} onClose={() => setSelected(null)} onDone={load} /> : null}
    </>
  );
}

const MACHINE_BUTTONS: { action: string; option?: string; label: string; cap: keyof Capabilities["machineActions"]; danger?: boolean; icon: typeof Lock; help: string }[] = [
  { action: "scan", option: "Quick", label: "Antivírus rápido", cap: "scan", icon: ScanSearch, help: "Verificação rápida do Defender Antivírus." },
  { action: "scan", option: "Full", label: "Antivírus completo", cap: "scan", icon: ScanSearch, help: "Verificação completa (demora e pesa na máquina)." },
  { action: "isolate", option: "Full", label: "Isolar da rede", cap: "isolate", danger: true, icon: Lock, help: "Corta toda a rede da máquina, exceto o Defender. O usuário fica sem internet e sem rede." },
  { action: "isolate", option: "Selective", label: "Isolar (manter Teams/Outlook)", cap: "isolate", danger: true, icon: Lock, help: "Isola, mas mantém Outlook, Teams e Skype funcionando." },
  { action: "unisolate", label: "Liberar isolamento", cap: "isolate", icon: Unlock, help: "Devolve a rede para a máquina." },
  { action: "restrict", label: "Restringir apps", cap: "restrict", danger: true, icon: Lock, help: "Só roda programas assinados pela Microsoft." },
  { action: "unrestrict", label: "Liberar apps", cap: "restrict", icon: Unlock, help: "Remove a restrição de programas." },
  { action: "collect", label: "Coletar pacote de investigação", cap: "collect", icon: Laptop, help: "Junta logs e artefatos da máquina para análise." },
];

function MachineModal({ machine, caps, actions, onClose, onDone }: { machine: Machine; caps: Capabilities; actions: MachineAction[]; onClose: () => void; onDone: () => void }) {
  const [choice, setChoice] = useState<(typeof MACHINE_BUTTONS)[number] | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    if (!choice) return;
    if (choice.danger && !window.confirm(`${choice.label} em ${machine.name}?\n\n${choice.help}`)) return;
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/defender/machines/${machine.id}/action`, "POST", { action: choice.action, option: choice.option, comment });
      setMessage(`Pedido enviado: ${choice.label}. Acompanhe o status na lista.`);
      setChoice(null);
      setComment("");
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="ct-backdrop" onClick={onClose} />
      <div className="ct-modal df-modal" role="dialog" aria-modal="true" aria-label={`Máquina ${machine.name}`}>
        <header>
          <h3><Laptop size={18} /> {machine.name}</h3>
          <button type="button" className="pm-icon-btn" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="df-body">
          <div className="df-meta">
            <span className={`ct-pill tone-${machine.risk === "High" ? "critical" : machine.risk === "Medium" ? "warning" : "muted"}`}>Risco {machine.risk || "—"}</span>
            <span>{machine.os}</span>
            <span>{machine.user || "sem usuário"}</span>
            <span>IP {machine.ip || "—"}</span>
            <span>visto {fmtDateTime(machine.lastSeen)}</span>
          </div>
          <h4>Ações</h4>
          <div className="df-machine-actions">
            {MACHINE_BUTTONS.map((button) => {
              const allowed = caps.machineActions[button.cap];
              const Icon = button.icon;
              return (
                <button
                  key={`${button.action}-${button.option || ""}`}
                  type="button"
                  className={`df-action${button.danger ? " danger" : ""}${choice === button ? " active" : ""}`}
                  disabled={!allowed || busy}
                  title={allowed ? button.help : `Falta a permissão do app para esta ação.`}
                  onClick={() => setChoice(button)}
                >
                  <Icon size={16} /> {button.label}
                </button>
              );
            })}
          </div>
          {choice ? (
            <div className="ct-form df-actions">
              <p className="wide ct-muted">{choice.help}</p>
              <label className="wide">
                <span>Motivo (obrigatório, fica registrado no Defender)</span>
                <textarea rows={2} maxLength={500} value={comment} autoFocus onChange={(event) => setComment(event.target.value)} placeholder="Ex.: incidente #2761, comunicação com C&C" />
              </label>
              <footer className="wide">
                <button type="button" className="ct-secondary" onClick={() => setChoice(null)}>Cancelar</button>
                <span />
                <button type="button" className={choice.danger ? "ct-danger" : "ct-primary"} disabled={busy || comment.trim().length < 5} onClick={run}>{busy ? "Enviando..." : choice.label}</button>
              </footer>
            </div>
          ) : null}
          {message ? <p className={`ct-message${message.startsWith("Pedido") ? " ok" : ""}`}>{message}</p> : null}
          <h4>Histórico de ações</h4>
          {actions.length ? (
            <ul className="df-comments">
              {actions.slice(0, 10).map((action) => (
                <li key={action.id}>
                  <small className="ct-muted">{fmtDateTime(action.created)} · {action.requestor}</small>
                  <p><b>{MACHINE_ACTION_NAMES[action.type] || action.type}</b> · {ACTION_STATUS[action.status] || action.status}{action.comment ? ` — ${action.comment}` : ""}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ct-muted">Nenhuma ação recente nesta máquina.</p>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- Quarentena de e-mail ---------- */
function QuarantineTab({ enabled }: { enabled: boolean | null }) {
  const [days, setDays] = useState(7);
  const [type, setType] = useState("");
  const [pendingOnly, setPendingOnly] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [term, setTerm] = useState("");
  const [messages, setMessages] = useState<QuarantineMessage[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [header, setHeader] = useState<{ message: QuarantineMessage; text: string } | null>(null);

  const load = useCallback(async () => {
    setError("");
    setMessages(null);
    setSelected(new Set());
    try {
      const params = new URLSearchParams({ days: String(days), released: pendingOnly ? "false" : "" });
      if (type) params.set("type", type);
      if (recipient.trim()) params.set("recipient", recipient.trim());
      setMessages((await api<{ messages: QuarantineMessage[] }>(`/api/defender/quarantine?${params}`)).messages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [days, type, pendingOnly, recipient]);

  useEffect(() => {
    if (enabled) void load();
    // recipient so recarrega no Enter/botao
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, days, type, pendingOnly]);

  if (enabled === false) {
    return (
      <Missing title="Quarentena ainda não liberada">
        <p>A quarentena do Exchange Online não existe no Microsoft Graph; o portal usa a mesma interface do Exchange Online PowerShell. Para liberar:</p>
        <ol>
          <li>Entra ID → Registros de aplicativo → app do portal → <b>Permissões de API</b> → Adicionar → <b>APIs que minha organização usa</b> → <b>Office 365 Exchange Online</b> → permissão de <b>aplicativo</b> <b>Exchange.ManageAsApp</b> → <b>Conceder consentimento do administrador</b>.</li>
          <li>Entra ID → <b>Funções e administradores</b> → <b>Administrador de Segurança</b> → Adicionar atribuição → escolha o <b>app do portal</b>.</li>
        </ol>
      </Missing>
    );
  }

  const rows = (messages || []).filter((message) => !term.trim() || `${message.subject} ${message.sender} ${message.recipients.join(" ")}`.toLowerCase().includes(term.trim().toLowerCase()));
  const chosen = rows.filter((message) => selected.has(message.identity));
  const toggle = (identity: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(identity)) next.delete(identity);
    else next.add(identity);
    return next;
  });

  async function act(action: "release" | "delete", reportFalsePositive = false) {
    if (!chosen.length) return;
    const dangerous = chosen.filter((message) => DANGEROUS_QUARANTINE.test(message.type));
    const question = action === "release"
      ? `Liberar ${chosen.length} e-mail(s) para a caixa de entrada dos destinatários?${dangerous.length ? `\n\nATENÇÃO: ${dangerous.length} foram classificados como MALWARE ou PHISHING DE ALTA CONFIANÇA. Só libere se tiver certeza de que é legítimo.` : ""}`
      : `Excluir definitivamente ${chosen.length} e-mail(s) da quarentena?`;
    if (!window.confirm(question)) return;
    setBusy(action);
    setNotice("");
    try {
      const result = await api<{ ok: boolean; results: { identity: string; ok: boolean; error?: string }[] }>("/api/defender/quarantine/action", "POST", {
        action,
        identities: chosen.map((message) => message.identity),
        reportFalsePositive,
      });
      const failed = result.results.filter((entry) => !entry.ok);
      setNotice(failed.length ? `${result.results.length - failed.length} ok, ${failed.length} falharam: ${failed[0].error}` : `${result.results.length} e-mail(s) ${action === "release" ? "liberado(s)" : "excluído(s)"}.`);
      await load();
    } catch (actError) {
      setNotice(actError instanceof Error ? actError.message : String(actError));
    } finally {
      setBusy("");
    }
  }

  async function showHeader(message: QuarantineMessage) {
    try {
      const result = await api<{ header: string }>(`/api/defender/quarantine/header?identity=${encodeURIComponent(message.identity)}`);
      setHeader({ message, text: result.header });
    } catch (headerError) {
      setNotice(headerError instanceof Error ? headerError.message : String(headerError));
    }
  }

  return (
    <>
      {error ? <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>{error}</span></div> : null}
      <section className="ct-table-card">
        <div className="ct-toolbar df-qtoolbar">
          <div className="ct-filters" role="tablist" aria-label="Período">
            {[1, 7, 30].map((value) => (
              <button key={value} type="button" role="tab" aria-selected={days === value} className={days === value ? "active" : ""} onClick={() => setDays(value)}>{value === 1 ? "24 h" : `${value} dias`}</button>
            ))}
          </div>
          <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Tipo">
            <option value="">Todos os tipos</option>
            {Object.entries(QUARANTINE_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label className="ct-check"><input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} /> <span>Só não liberados</span></label>
          <form className="pm-search" onSubmit={(event) => { event.preventDefault(); void load(); }}>
            <Mail size={16} />
            <input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Destinatário (e-mail) + Enter" />
          </form>
          <label className="pm-search">
            <Search size={16} />
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Filtrar assunto ou remetente" />
          </label>
          <button className="pm-icon-btn" type="button" title="Atualizar" aria-label="Atualizar" onClick={load}><RefreshCw size={16} /></button>
        </div>
        <div className="df-qactions">
          <span>{chosen.length ? `${chosen.length} selecionado(s)` : "Selecione e-mails para agir"}</span>
          <button type="button" className="ct-primary" disabled={!chosen.length || Boolean(busy)} onClick={() => act("release")}><CheckCircle2 size={15} /> {busy === "release" ? "Liberando..." : "Liberar"}</button>
          <button type="button" className="ct-secondary" disabled={!chosen.length || Boolean(busy)} onClick={() => act("release", true)} title="Libera e avisa a Microsoft que o filtro errou">Liberar e reportar falso positivo</button>
          <button type="button" className="ct-danger" disabled={!chosen.length || Boolean(busy)} onClick={() => act("delete")}><Trash2 size={15} /> Excluir</button>
          {notice ? <span className="df-notice">{notice}</span> : null}
        </div>
        <div className="ct-table-wrap">
          <table className="ct-table df-qtable">
            <thead>
              <tr>
                <th aria-label="Selecionar">
                  <input type="checkbox" checked={Boolean(rows.length) && rows.every((message) => selected.has(message.identity))} onChange={(event) => setSelected(event.target.checked ? new Set(rows.map((message) => message.identity)) : new Set())} />
                </th>
                <th>Recebido</th>
                <th>Assunto</th>
                <th>Remetente</th>
                <th>Destinatário</th>
                <th>Motivo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((message) => (
                <tr key={message.identity} className={selected.has(message.identity) ? "selected" : ""} onClick={() => toggle(message.identity)}>
                  <td onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.has(message.identity)} onChange={() => toggle(message.identity)} /></td>
                  <td>{fmtDateTime(message.received)}</td>
                  <td>
                    <strong className="ct-title">{message.subject || "(sem assunto)"}</strong>
                    <button type="button" className="ct-link" onClick={(event) => { event.stopPropagation(); void showHeader(message); }}>ver cabeçalho</button>
                  </td>
                  <td>{message.sender}</td>
                  <td>{message.recipients.join(", ")}</td>
                  <td><span className={`ct-pill tone-${DANGEROUS_QUARANTINE.test(message.type) ? "critical" : /phish|spoof/i.test(message.type) ? "warning" : "muted"}`}>{QUARANTINE_TYPES[message.type] || message.type}</span></td>
                  <td>{message.released === "RELEASED" ? "Liberado" : message.released === "REQUESTED" ? "Pedido do usuário" : message.released === "DENIED" ? "Negado" : "Em quarentena"}</td>
                </tr>
              ))}
              {messages && !rows.length ? <tr><td colSpan={7} className="ct-empty-row">Nenhum e-mail na quarentena com esses filtros.</td></tr> : null}
              {!messages && !error ? <tr><td colSpan={7} className="ct-empty-row">Consultando a quarentena do Exchange Online...</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {header ? (
        <>
          <div className="ct-backdrop" onClick={() => setHeader(null)} />
          <div className="ct-modal df-modal" role="dialog" aria-modal="true" aria-label="Cabeçalho do e-mail">
            <header>
              <h3>{header.message.subject || "(sem assunto)"}</h3>
              <button type="button" className="pm-icon-btn" aria-label="Fechar" onClick={() => setHeader(null)}><X size={18} /></button>
            </header>
            <pre className="df-header">{header.text || "Sem cabeçalho."}</pre>
          </div>
        </>
      ) : null}
    </>
  );
}
