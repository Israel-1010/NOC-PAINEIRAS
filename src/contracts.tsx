import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  FileText,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

type Attachment = { id: string; name: string; mimeType: string; size: number; at: string; by: string };
type Contract = {
  id: string;
  title: string;
  supplier: string;
  category: string;
  monthlyValue: number | null;
  dueDay: number | null;
  startDate: string;
  endDate: string;
  active: boolean;
  totalValue: number | null;
  notes: string;
  attachments: Attachment[];
  updatedAt: string;
  updatedBy: string;
};
type Payload = { contracts: Contract[]; categories: string[] };

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

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlShort = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const money = (value: number | null) => (value === null ? "—" : brl.format(value));
const fmtDate = (value: string) => (value ? value.split("-").reverse().join("/") : "—");

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
const parseDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const daysUntil = (value: string) => Math.round((parseDate(value).getTime() - today().getTime()) / 86400000);

type Tone = "good" | "warning" | "critical" | "neutral" | "muted";
type Status = { key: "inactive" | "expired" | "ending" | "open" | "ok"; label: string; tone: Tone; days: number | null };

// Situacao do contrato pela data de termino.
function statusOf(contract: Contract): Status {
  if (!contract.active) return { key: "inactive", label: "Inativo", tone: "muted", days: null };
  if (!contract.endDate) return { key: "open", label: "Sem término", tone: "neutral", days: null };
  const days = daysUntil(contract.endDate);
  if (days < 0) return { key: "expired", label: `Venceu há ${-days} ${-days === 1 ? "dia" : "dias"}`, tone: "critical", days };
  if (days === 0) return { key: "ending", label: "Vence hoje", tone: "critical", days };
  if (days <= 30) return { key: "ending", label: `Vence em ${days} ${days === 1 ? "dia" : "dias"}`, tone: "critical", days };
  if (days <= 90) return { key: "ending", label: `Vence em ${days} dias`, tone: "warning", days };
  return { key: "ok", label: "Em vigor", tone: "good", days };
}

// Conta em vigor: ativo e nao vencido (entra no gasto mensal e nos pagamentos).
const isRunning = (contract: Contract) => contract.active && (!contract.endDate || daysUntil(contract.endDate) >= 0);

// Proximo vencimento da fatura (dia do mes; meses curtos usam o ultimo dia).
function nextPayment(dueDay: number) {
  const base = today();
  const at = (year: number, month: number) => new Date(year, month, Math.min(dueDay, new Date(year, month + 1, 0).getDate()));
  const thisMonth = at(base.getFullYear(), base.getMonth());
  return thisMonth >= base ? thisMonth : at(base.getFullYear(), base.getMonth() + 1);
}

// Meses entre inicio e termino (para sugerir o valor total).
function monthsBetween(start: string, end: string) {
  const a = parseDate(start);
  const b = parseDate(end);
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 0 : -1);
  return Math.max(0, months);
}

type Filter = "all" | "running" | "ending" | "expired" | "inactive";
type SortKey = "title" | "supplier" | "monthlyValue" | "dueDay" | "endDate" | "totalValue";

export function ContractsDashboard() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("running");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "endDate", dir: 1 });
  const [editing, setEditing] = useState<Contract | "new" | null>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      setData(await api<Payload>("/api/contracts"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os contratos.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const contracts = data?.contracts || [];
  const running = contracts.filter(isRunning);
  const monthly = running.reduce((sum, contract) => sum + (contract.monthlyValue || 0), 0);
  const contracted = running.reduce((sum, contract) => sum + (contract.totalValue || 0), 0);

  // Atencao: vencidos (ainda marcados como ativos) e os que vencem em ate 90 dias.
  const attention = contracts
    .map((contract) => ({ contract, status: statusOf(contract) }))
    .filter(({ status }) => status.key === "expired" || status.key === "ending")
    .sort((a, b) => (a.status.days ?? 0) - (b.status.days ?? 0));

  const payments = running
    .filter((contract) => contract.dueDay)
    .map((contract) => ({ contract, date: nextPayment(contract.dueDay as number) }))
    .filter(({ date }) => (date.getTime() - today().getTime()) / 86400000 <= 30)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || (b.contract.monthlyValue || 0) - (a.contract.monthlyValue || 0));

  const bySupplier = useMemo(() => {
    const map = new Map<string, number>();
    for (const contract of running) map.set(contract.supplier || contract.title, (map.get(contract.supplier || contract.title) || 0) + (contract.monthlyValue || 0));
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [running]);

  const counts = {
    all: contracts.length,
    running: running.length,
    ending: contracts.filter((contract) => statusOf(contract).key === "ending").length,
    expired: contracts.filter((contract) => statusOf(contract).key === "expired").length,
    inactive: contracts.filter((contract) => !contract.active).length,
  };

  const rows = useMemo(() => {
    const search = term.trim().toLowerCase();
    const list = contracts.filter((contract) => {
      const key = statusOf(contract).key;
      if (filter === "running" && !isRunning(contract)) return false;
      if (filter === "ending" && key !== "ending") return false;
      if (filter === "expired" && key !== "expired") return false;
      if (filter === "inactive" && contract.active) return false;
      return !search || `${contract.title} ${contract.supplier} ${contract.category} ${contract.notes}`.toLowerCase().includes(search);
    });
    const value = (contract: Contract) => {
      const raw = contract[sort.key];
      if (sort.key === "endDate" || sort.key === "title" || sort.key === "supplier") return String(raw || (sort.key === "endDate" ? "9999" : ""));
      return raw === null ? -1 : Number(raw);
    };
    return list.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      return (typeof va === "string" ? va.localeCompare(String(vb), "pt-BR", { numeric: true }) : va - Number(vb)) * sort.dir;
    });
  }, [contracts, filter, term, sort]);

  const sortBy = (key: SortKey) => setSort((current) => ({ key, dir: current.key === key ? (current.dir === 1 ? -1 : 1) : 1 }));
  const SortHead = ({ k, children, align }: { k: SortKey; children: React.ReactNode; align?: "right" }) => (
    <th className={align === "right" ? "num" : undefined} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => sortBy(k)}>
        {children}
        {sort.key === k ? (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null}
      </button>
    </th>
  );

  if (!data) {
    return error ? (
      <div className="view-error" role="alert"><AlertTriangle size={24} /><div><strong>{error}</strong></div></div>
    ) : (
      <div className="view-loading">Carregando contratos...</div>
    );
  }

  const maxSupplier = bySupplier[0]?.value || 1;

  return (
    <div className="ct-page">
      {error ? (
        <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>
      ) : null}

      <section className="ct-kpis">
        <div className="ct-kpi">
          <span>Gasto mensal</span>
          <strong>{brl.format(monthly)}</strong>
          <small>{running.length} contratos em vigor</small>
        </div>
        <div className="ct-kpi">
          <span>Projeção 12 meses</span>
          <strong>{brlShort.format(monthly * 12)}</strong>
          <small>gasto mensal × 12</small>
        </div>
        <div className="ct-kpi">
          <span>Valor contratado</span>
          <strong>{brlShort.format(contracted)}</strong>
          <small>soma do valor total dos contratos em vigor</small>
        </div>
        <div className={`ct-kpi${counts.expired ? " tone-critical" : counts.ending ? " tone-warning" : ""}`}>
          <span>Vencimentos</span>
          <strong>{counts.expired + counts.ending}</strong>
          <small>{counts.expired} vencidos · {counts.ending} vencem em até 90 dias</small>
        </div>
      </section>

      <section className="ct-grid">
        <div className="ct-card">
          <h3><CalendarClock size={18} /> Vencimentos de contrato</h3>
          {attention.length ? (
            <ul className="ct-list">
              {attention.map(({ contract, status }) => (
                <li key={contract.id}>
                  <button type="button" onClick={() => setEditing(contract)}>
                    <span className={`ct-day tone-${status.tone}`}>
                      <b>{Math.abs(status.days ?? 0)}</b>
                      <small>{(status.days ?? 0) < 0 ? "atraso" : "dias"}</small>
                    </span>
                    <span className="ct-list-main">
                      <strong title={contract.title}>{contract.title}</strong>
                      <small title={status.label}>{contract.supplier} · término {fmtDate(contract.endDate)}</small>
                    </span>
                    <b>{money(contract.monthlyValue)}<small>/mês</small></b>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ct-empty"><CheckCircle2 size={16} /> Nenhum contrato vencido ou vencendo nos próximos 90 dias.</p>
          )}
        </div>

        <div className="ct-card">
          <h3><Wallet size={18} /> Pagamentos nos próximos 30 dias</h3>
          {payments.length ? (
            <ul className="ct-list">
              {payments.map(({ contract, date }) => {
                const days = Math.round((date.getTime() - today().getTime()) / 86400000);
                return (
                  <li key={contract.id}>
                    <button type="button" onClick={() => setEditing(contract)}>
                      <span className={`ct-day${days <= 3 ? " soon" : ""}`}>
                        <b>{String(date.getDate()).padStart(2, "0")}</b>
                        <small>{date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</small>
                      </span>
                      <span className="ct-list-main">
                        <strong title={contract.title}>{contract.title}</strong>
                        <small>{contract.supplier} · {days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`}</small>
                      </span>
                      <b>{money(contract.monthlyValue)}</b>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="ct-empty">Nenhum pagamento com dia de vencimento nos próximos 30 dias.</p>
          )}
        </div>

        <div className="ct-card">
          <h3><FileText size={18} /> Gasto mensal por fornecedor</h3>
          <ul className="ct-bars">
            {bySupplier.map((entry) => (
              <li key={entry.name} title={`${entry.name}: ${brl.format(entry.value)} por mês (${Math.round((entry.value / (monthly || 1)) * 100)}% do total)`}>
                <span className="ct-bar-label">{entry.name}</span>
                <span className="ct-bar-track"><span className="ct-bar-fill" style={{ width: `${Math.max(1.5, (entry.value / maxSupplier) * 100)}%` }} /></span>
                <span className="ct-bar-value">{brlShort.format(entry.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ct-table-card">
        <div className="ct-toolbar">
          <div className="ct-filters" role="tablist" aria-label="Filtrar contratos">
            {([
              ["running", "Em vigor"],
              ["ending", "Vencendo"],
              ["expired", "Vencidos"],
              ["inactive", "Inativos"],
              ["all", "Todos"],
            ] as [Filter, string][]).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>
                {label} <small>{counts[key]}</small>
              </button>
            ))}
          </div>
          <label className="pm-search">
            <Search size={16} />
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar contrato, fornecedor ou categoria" />
          </label>
          <button className="pm-icon-btn" type="button" title="Atualizar" aria-label="Atualizar" onClick={load}><RefreshCw size={16} /></button>
          <button className="ct-primary" type="button" onClick={() => setEditing("new")}><Plus size={16} /> Novo contrato</button>
        </div>

        <div className="ct-table-wrap">
          <table className="ct-table">
            <thead>
              <tr>
                <SortHead k="title">Contrato</SortHead>
                <SortHead k="supplier">Fornecedor</SortHead>
                <SortHead k="monthlyValue" align="right">Valor mensal</SortHead>
                <SortHead k="dueDay" align="right">Venc.</SortHead>
                <th>Vigência</th>
                <SortHead k="endDate">Situação</SortHead>
                <SortHead k="totalValue" align="right">Valor total</SortHead>
                <th aria-label="Anexos" />
              </tr>
            </thead>
            <tbody>
              {rows.map((contract) => {
                const status = statusOf(contract);
                return (
                  <tr key={contract.id} onClick={() => setEditing(contract)} className={contract.active ? "" : "inactive"}>
                    <td>
                      <strong className="ct-title">{contract.title}</strong>
                      <small className="ct-cat">{contract.category}</small>
                    </td>
                    <td>{contract.supplier || "—"}</td>
                    <td className="num">{money(contract.monthlyValue)}</td>
                    <td className="num">{contract.dueDay ? `dia ${contract.dueDay}` : "—"}</td>
                    <td className="ct-dates">{fmtDate(contract.startDate)} <span>→</span> {fmtDate(contract.endDate)}</td>
                    <td><span className={`ct-pill tone-${status.tone}`}>{status.label}</span></td>
                    <td className="num">{money(contract.totalValue)}</td>
                    <td className="ct-clip">{contract.attachments.length ? <span title={`${contract.attachments.length} anexo(s)`}><Paperclip size={15} /> {contract.attachments.length}</span> : null}</td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr><td colSpan={8} className="ct-empty-row">Nenhum contrato neste filtro.</td></tr>
              ) : null}
            </tbody>
            {rows.length ? (
              <tfoot>
                <tr>
                  <td colSpan={2}>{rows.length} {rows.length === 1 ? "contrato" : "contratos"}</td>
                  <td className="num">{brl.format(rows.reduce((sum, contract) => sum + (contract.monthlyValue || 0), 0))}</td>
                  <td colSpan={3} />
                  <td className="num">{brl.format(rows.reduce((sum, contract) => sum + (contract.totalValue || 0), 0))}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      {editing ? (
        <ContractModal
          contract={editing === "new" ? null : editing}
          categories={data.categories}
          suppliers={Array.from(new Set(contracts.map((contract) => contract.supplier).filter(Boolean))).sort()}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setData((current) => current && {
              ...current,
              contracts: current.contracts.some((entry) => entry.id === saved.id)
                ? current.contracts.map((entry) => (entry.id === saved.id ? saved : entry))
                : [...current.contracts, saved],
            });
            setEditing((current) => (current && current !== "new" ? saved : current));
          }}
          onDeleted={(id) => {
            setData((current) => current && { ...current, contracts: current.contracts.filter((entry) => entry.id !== id) });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

type Form = {
  title: string;
  supplier: string;
  category: string;
  monthlyValue: string;
  dueDay: string;
  startDate: string;
  endDate: string;
  totalValue: string;
  active: boolean;
  notes: string;
};

const toInput = (value: number | null) => (value === null ? "" : value.toFixed(2).replace(".", ","));
const fromInput = (value: string) => {
  const clean = value.trim().replace(/[^\d,.-]/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : NaN;
};

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function ContractModal({
  contract,
  categories,
  suppliers,
  onClose,
  onSaved,
  onDeleted,
}: {
  contract: Contract | null;
  categories: string[];
  suppliers: string[];
  onClose: () => void;
  onSaved: (contract: Contract) => void;
  onDeleted: (id: string) => void;
}) {
  const [form, setForm] = useState<Form>(() => ({
    title: contract?.title || "",
    supplier: contract?.supplier || "",
    category: contract?.category || "Outro",
    monthlyValue: toInput(contract?.monthlyValue ?? null),
    dueDay: contract?.dueDay ? String(contract.dueDay) : "",
    startDate: contract?.startDate || "",
    endDate: contract?.endDate || "",
    totalValue: toInput(contract?.totalValue ?? null),
    active: contract?.active ?? true,
    notes: contract?.notes || "",
  }));
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const months = form.startDate && form.endDate ? monthsBetween(form.startDate, form.endDate) : 0;
  const monthlyNumber = fromInput(form.monthlyValue);
  const suggestedTotal = months && monthlyNumber && !Number.isNaN(monthlyNumber) ? monthlyNumber * months : null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const monthlyValue = fromInput(form.monthlyValue);
    const totalValue = fromInput(form.totalValue);
    if (Number.isNaN(monthlyValue) || Number.isNaN(totalValue)) {
      setMessage("Valor inválido. Use o formato 12.000,00.");
      return;
    }
    const body = { ...form, monthlyValue, totalValue, dueDay: form.dueDay ? Number(form.dueDay) : null };
    setBusy("save");
    setMessage("");
    try {
      const saved = contract
        ? await api<Contract>(`/api/contracts/${contract.id}`, "PATCH", body)
        : await api<Contract>("/api/contracts", "POST", body);
      onSaved(saved);
      if (!contract) onClose();
      else setMessage("Salvo.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Não foi possível salvar.");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!contract || !window.confirm(`Excluir o contrato "${contract.title}" e os anexos dele? Para guardar o histórico, prefira desmarcar "Ativo".`)) return;
    setBusy("delete");
    try {
      await api(`/api/contracts/${contract.id}`, "DELETE");
      onDeleted(contract.id);
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir.");
      setBusy("");
    }
  }

  async function upload(files: FileList | null) {
    if (!contract || !files?.length) return;
    setBusy("upload");
    setMessage("");
    try {
      let latest: Contract | null = null;
      for (const file of Array.from(files)) {
        if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name}: máximo 8 MB.`);
        latest = await api<Contract>(`/api/contracts/${contract.id}/files`, "POST", { name: file.name, mimeType: file.type, data: await readFile(file) });
      }
      if (latest) onSaved(latest);
    } catch (uploadError) {
      setMessage(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar o arquivo.");
    } finally {
      setBusy("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function openFile(file: Attachment) {
    if (!contract) return;
    // O download precisa do token: busca o arquivo e abre numa aba nova.
    const tab = window.open("", "_blank");
    try {
      const response = await fetch(`${API_BASE}/api/contracts/${contract.id}/files/${file.id}`, { headers: { Authorization: `Bearer ${authToken()}` } });
      if (!response.ok) throw new Error("Não foi possível abrir o anexo.");
      const url = URL.createObjectURL(await response.blob());
      if (tab) tab.location.href = url;
      else window.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (openError) {
      tab?.close();
      setMessage(openError instanceof Error ? openError.message : "Não foi possível abrir o anexo.");
    }
  }

  async function removeFile(file: Attachment) {
    if (!contract || !window.confirm(`Remover o anexo "${file.name}"?`)) return;
    try {
      onSaved(await api<Contract>(`/api/contracts/${contract.id}/files/${file.id}`, "DELETE"));
    } catch (removeError) {
      setMessage(removeError instanceof Error ? removeError.message : "Não foi possível remover o anexo.");
    }
  }

  return (
    <>
      <div className="ct-backdrop" onClick={onClose} />
      <div className="ct-modal" role="dialog" aria-modal="true" aria-label={contract ? "Editar contrato" : "Novo contrato"}>
        <header>
          <h3>{contract ? "Editar contrato" : "Novo contrato"}</h3>
          <button type="button" className="pm-icon-btn" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </header>
        <form onSubmit={save} className="ct-form">
          <label className="wide"><span>Título</span><input value={form.title} maxLength={120} required autoFocus={!contract} onChange={(event) => set({ title: event.target.value })} /></label>
          <label><span>Fornecedor</span><input value={form.supplier} maxLength={80} list="ct-suppliers" onChange={(event) => set({ supplier: event.target.value })} /></label>
          <label>
            <span>Categoria</span>
            <select value={form.category} onChange={(event) => set({ category: event.target.value })}>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label><span>Valor mensal (R$)</span><input value={form.monthlyValue} inputMode="decimal" placeholder="12.000,00" onChange={(event) => set({ monthlyValue: event.target.value })} /></label>
          <label><span>Dia do vencimento</span><input value={form.dueDay} type="number" min={1} max={31} placeholder="10" onChange={(event) => set({ dueDay: event.target.value })} /></label>
          <label><span>Data de início</span><input value={form.startDate} type="date" onChange={(event) => set({ startDate: event.target.value })} /></label>
          <label><span>Data de término</span><input value={form.endDate} type="date" onChange={(event) => set({ endDate: event.target.value })} /></label>
          <label>
            <span>Valor total (R$)</span>
            <input value={form.totalValue} inputMode="decimal" placeholder="96.000,00" onChange={(event) => set({ totalValue: event.target.value })} />
            {suggestedTotal !== null && Math.abs(suggestedTotal - (fromInput(form.totalValue) || 0)) >= 0.01 ? (
              <button type="button" className="ct-link" onClick={() => set({ totalValue: toInput(suggestedTotal) })}>
                Usar {brl.format(suggestedTotal)} ({months} meses × mensal)
              </button>
            ) : null}
          </label>
          <label className="ct-check"><input type="checkbox" checked={form.active} onChange={(event) => set({ active: event.target.checked })} /> <span>Ativo</span></label>
          <label className="wide"><span>Observações</span><textarea value={form.notes} rows={3} maxLength={2000} placeholder="Reajuste, contato do fornecedor, nº do contrato..." onChange={(event) => set({ notes: event.target.value })} /></label>
          <datalist id="ct-suppliers">{suppliers.map((supplier) => <option key={supplier} value={supplier} />)}</datalist>

          <div className="wide ct-files">
            <span className="ct-files-head"><Paperclip size={15} /> Anexos</span>
            {contract ? (
              <>
                {contract.attachments.length ? (
                  <ul>
                    {contract.attachments.map((file) => (
                      <li key={file.id}>
                        <button type="button" className="ct-link" onClick={() => openFile(file)}><FileText size={14} /> {file.name}</button>
                        <small>{Math.max(1, Math.round(file.size / 1024))} KB · {new Date(file.at).toLocaleDateString("pt-BR")} · {file.by}</small>
                        <button type="button" className="pm-icon-btn" aria-label={`Remover ${file.name}`} onClick={() => removeFile(file)}><Trash2 size={14} /></button>
                      </li>
                    ))}
                  </ul>
                ) : <small className="ct-muted">Nenhum anexo. Envie o PDF do contrato e os aditivos.</small>}
                <input ref={fileInput} type="file" multiple accept=".pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png" hidden onChange={(event) => upload(event.target.files)} />
                <button type="button" className="ct-secondary" disabled={busy === "upload"} onClick={() => fileInput.current?.click()}>
                  <Paperclip size={14} /> {busy === "upload" ? "Enviando..." : "Anexar arquivo"}
                </button>
              </>
            ) : <small className="ct-muted">Salve o contrato para anexar arquivos.</small>}
          </div>

          {message ? <p className={`wide ct-message${message === "Salvo." ? " ok" : ""}`}>{message}</p> : null}
          <footer className="wide">
            {contract ? <button type="button" className="ct-danger" disabled={Boolean(busy)} onClick={remove}><Trash2 size={14} /> Excluir</button> : <span />}
            {contract ? <small className="ct-muted">Alterado em {new Date(contract.updatedAt).toLocaleString("pt-BR")} por {contract.updatedBy}</small> : null}
            <button type="submit" className="ct-primary" disabled={Boolean(busy)}>{busy === "save" ? "Salvando..." : "Salvar"}</button>
          </footer>
        </form>
      </div>
    </>
  );
}
