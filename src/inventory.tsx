import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Download,
  Eraser,
  ExternalLink,
  EyeOff,
  FileText,
  List,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Tags,
  Undo2,
  X,
} from "lucide-react";

// Menu "Inventario de maquinas": uma linha por maquina cruzando AD, Entra, Intune, Defender e Milvus.
// O cruzamento e as regras ficam no servidor (server/inventory.ts); aqui so filtra, mostra e exporta.

type SourceId = "ad" | "entra" | "intune" | "defender" | "milvus";
type Source = { id: SourceId; label: string; state: "ok" | "down" | "off"; count: number; error: string; partial: boolean };
type Kind = "estacao" | "servidor" | "mac" | "movel" | "outro";
type WorkTab = "seguranca" | "limpeza" | "cadastro";
type Tab = WorkTab | "todas" | "ignoradas" | "relatorio";
type Tone = "bad" | "warn" | "info" | "neutral";
type CatalogItem = { code: string; tab: WorkTab; tone: Tone; label: string; needs: SourceId[]; action: string; suspended: boolean };
type Exception = { key: string; code: string; reason: string; note: string; by: string; at: string; until: string | null };
type Issue = { code: string; detail: string; ignored?: Exception };
type Machine = {
  key: string;
  name: string;
  kind: Kind;
  os: string;
  family: string;
  user: string;
  serial: string;
  model: string;
  asset: string;
  lastSeen: string;
  active: boolean;
  ad: { name: string; os: string; enabled: boolean; lastLogon: string; pwdLastSet: string; created: string; ou: string } | null;
  entra: { trust: string; enabled: boolean; lastSignIn: string } | null;
  intune: { id: string; name: string; os: string; osVersion: string; user: string; userName: string; lastSync: string; enrolled: string; encrypted: boolean; compliance: string; owner: string; serial: string; model: string; duplicates: number } | null;
  defender: { id: string; name: string; os: string; health: string; risk: string; lastSeen: string; ip: string; user: string } | null;
  milvus: { name: string; kind: string; os: string; user: string; ip: string; serial: string; model: string; lastSeen: string } | null;
  issues: Issue[];
};
type Coverage = { stations: number; intune: number; defender: number; bitlocker: number; win11: number; milvus: number };
type Snapshot = { date: string; machines: number; active: number; counts: Record<string, number>; coverage: Coverage };
type Inventory = {
  checkedAt: string;
  sources: Source[];
  limits: { ad: number; intune: number; defender: number; milvus: number; active: number };
  catalog: CatalogItem[];
  summary: { machines: number; active: number; counts: Record<string, number>; coverage: Coverage };
  history: Snapshot[];
  machines: Machine[];
};

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

const SOURCE_ORDER: SourceId[] = ["ad", "entra", "intune", "defender", "milvus"];
const SOURCE_SHORT: Record<SourceId, string> = { ad: "AD", entra: "Entra", intune: "Intune", defender: "Defender", milvus: "Milvus" };
const KIND_LABEL: Record<Kind, string> = { estacao: "Estação", servidor: "Servidor", mac: "Mac", movel: "Celular", outro: "Outro" };
const TONE_RANK: Record<Tone, number> = { bad: 0, warn: 1, info: 2, neutral: 3 };
const TRUST: Record<string, string> = { ServerAd: "híbrida", AzureAd: "só Entra", Workplace: "registrada" };
// Ausencia que e a propria divergencia: a celula daquela fonte fica destacada.
const MISSING_BY_ISSUE: Record<string, SourceId> = { "fora-intune": "intune", "so-intune": "ad", "sem-defender": "defender", "fora-milvus": "milvus" };
const EXCEPTION_REASONS = ["Servidor ou equipamento fora do padrão", "Equipamento de terceiro", "Estoque ou manutenção", "Descartada, aguardando limpeza", "Só na nuvem (Entra)", "Outro"];
const PAGE_SIZE = 50;

const daysSince = (value: string) => (value ? Math.floor((Date.now() - new Date(value).getTime()) / 864e5) : Infinity);
function relative(value: string) {
  const days = daysSince(value);
  if (days === Infinity) return "nunca";
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} d`;
}
const fmtDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("pt-BR") : "—");
const fmtTime = (value: string) => new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

// Linha de tabela que abre com clique e tambem com Enter/Espaco (teclado).
const rowOpen = (open: () => void) => ({
  tabIndex: 0,
  onClick: open,
  onKeyDown: (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  },
});

const activeIssues = (machine: Machine) => machine.issues.filter((issue) => !issue.ignored);

export function InventoryDashboard({ onOpen }: { onOpen: (view: "ad" | "intune", term: string, tab?: string) => void }) {
  const [data, setData] = useState<Inventory | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("seguranca");
  const [issueFilter, setIssueFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<Kind | "all">("all");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [byName, setByName] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError("");
    setRefreshing(true);
    try {
      setData(await api<Inventory>(`/api/inventory${refresh ? "?refresh=1" : ""}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab, issueFilter, kindFilter, term]);

  const catalog = useMemo(() => new Map((data?.catalog || []).map((item) => [item.code, item])), [data]);
  const toneOf = useCallback((code: string) => catalog.get(code)?.tone || "neutral", [catalog]);
  const tabOf = useCallback((code: string) => catalog.get(code)?.tab, [catalog]);
  // Sem nenhuma estacao criptografada o problema e a politica, nao cada maquina: "Sem BitLocker" sai da
  // contagem e da lista padrao da aba (continua no filtro proprio e no relatorio).
  const bitlockerPolicyMissing = Boolean(data && data.summary.coverage.intune > 0 && data.summary.coverage.bitlocker === 0 && data.sources.find((source) => source.id === "intune")?.state === "ok");
  const counts = useCallback((code: string) => !(bitlockerPolicyMissing && code === "sem-bitlocker"), [bitlockerPolicyMissing]);
  const hasIssue = (machine: Machine, code: string, ignored: boolean) => machine.issues.some((issue) => issue.code === code && Boolean(issue.ignored) === ignored);

  // Maquinas com divergencia ativa em cada aba (uma maquina conta uma vez por aba).
  const tabCounts = useMemo(() => {
    const result: Record<string, number> = { seguranca: 0, limpeza: 0, cadastro: 0, ignoradas: 0 };
    for (const machine of data?.machines || []) {
      const tabs = new Set(activeIssues(machine).filter((issue) => counts(issue.code)).map((issue) => tabOf(issue.code)));
      for (const key of tabs) if (key) result[key] += 1;
      if (machine.issues.some((issue) => issue.ignored)) result.ignoradas += 1;
    }
    return result;
  }, [data, tabOf, counts]);

  // Base da aba (filtro "Todas"); um filtro de divergencia pega direto as maquinas com ela.
  const tabMachines = useMemo(() => {
    const machines = data?.machines || [];
    if (tab === "todas" || tab === "relatorio") return machines;
    if (tab === "ignoradas") return machines.filter((machine) => machine.issues.some((issue) => issue.ignored));
    return machines.filter((machine) => activeIssues(machine).some((issue) => tabOf(issue.code) === tab && counts(issue.code)));
  }, [data, tab, tabOf, counts]);

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const worst = (machine: Machine) => Math.min(4, ...activeIssues(machine).filter((issue) => counts(issue.code)).map((issue) => TONE_RANK[toneOf(issue.code)]));
    const base = issueFilter === "all" ? tabMachines : (data?.machines || []).filter((machine) => hasIssue(machine, issueFilter, tab === "ignoradas"));
    return base
      .filter((machine) => kindFilter === "all" || machine.kind === kindFilter)
      .filter((machine) => !needle || [machine.name, machine.user, machine.serial, machine.os, machine.asset, machine.ad?.ou, machine.defender?.ip, machine.milvus?.ip, machine.intune?.user].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => (byName ? 0 : worst(a) - worst(b) || Number(b.active) - Number(a.active)) || a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  }, [data, tabMachines, kindFilter, issueFilter, term, byName, tab, toneOf, counts]);

  const issueOptions = useMemo(() => {
    if (tab === "todas" || tab === "relatorio") return [];
    const codes = (data?.catalog || []).filter((item) => tab === "ignoradas" || item.tab === tab).map((item) => item.code);
    return codes
      .map((code) => ({ code, count: (data?.machines || []).filter((machine) => hasIssue(machine, code, tab === "ignoradas")).length }))
      .filter((option) => option.count || catalog.get(option.code)?.suspended);
  }, [data, tab, catalog]);

  const kindOptions = useMemo(() => (["estacao", "servidor", "mac", "movel", "outro"] as Kind[]).filter((kind) => tabMachines.some((machine) => machine.kind === kind)), [tabMachines]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const openIndex = openKey ? rows.findIndex((machine) => machine.key === openKey) : -1;
  const openMachine = openKey ? data?.machines.find((machine) => machine.key === openKey) || null : null;
  const sourceState = (id: SourceId) => data?.sources.find((source) => source.id === id);
  const shownSources = SOURCE_ORDER.filter((id) => sourceState(id)?.state !== "off");

  function exportCsv() {
    if (!data) return;
    const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const down = data.sources.filter((source) => source.state !== "ok");
    const lines = [
      ...(down.length ? [cell(`ATENÇÃO: sem leitura de ${down.map((source) => source.label).join(", ")}; divergências dessas fontes não foram calculadas.`)] : []),
      ["Nome", "Tipo", "Sistema", "Usuário", "Serial", "Patrimônio", "AD", "Último logon AD", "OU", "Entra", "Intune", "Último sync Intune", "BitLocker", "Defender", "Defender visto", "Milvus", "Milvus visto", "Divergências", "Exceções"].map(cell).join(";"),
      ...rows.map((machine) =>
        [
          machine.name,
          KIND_LABEL[machine.kind],
          machine.os,
          machine.user,
          machine.serial,
          machine.asset,
          machine.ad ? (machine.ad.enabled ? "sim" : "desativada") : "não",
          fmtDate(machine.ad?.lastLogon),
          machine.ad?.ou || "",
          machine.entra ? TRUST[machine.entra.trust] || machine.entra.trust || "sim" : "não",
          machine.intune ? "sim" : "não",
          fmtDate(machine.intune?.lastSync),
          machine.intune ? (machine.intune.encrypted ? "sim" : "não") : "",
          machine.defender ? "sim" : "não",
          fmtDate(machine.defender?.lastSeen),
          machine.milvus ? "sim" : "não",
          fmtDate(machine.milvus?.lastSeen),
          activeIssues(machine).map((issue) => catalog.get(issue.code)?.label || issue.code).join(", "),
          machine.issues.filter((issue) => issue.ignored).map((issue) => `${catalog.get(issue.code)?.label || issue.code}: ${issue.ignored!.reason}`).join(", "),
        ].map(cell).join(";"),
      ),
    ];
    const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inventario-${new Date().toLocaleDateString("sv-SE")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!data) {
    return (
      <div className="ct-page inv-page">
        {error ? (
          <div className="pm-error" role="alert">
            <AlertTriangle size={16} />
            <span>Não foi possível montar o inventário: {error}</span>
            <button type="button" className="ct-secondary" onClick={() => load()}>Tentar novamente</button>
          </div>
        ) : (
          <div className="view-loading">Cruzando AD, Intune, Defender, Milvus e Entra...</div>
        )}
      </div>
    );
  }

  return (
    <div className="ct-page inv-page">
      <section className="inv-sources" aria-label="Fontes do inventário">
        <div className="inv-source-list">
          {SOURCE_ORDER.map((id) => {
            const source = sourceState(id);
            if (!source) return null;
            const text = source.state === "ok" ? `${source.count}${source.partial ? " (parcial)" : ""}` : source.state === "off" ? "não configurado" : "sem resposta";
            return (
              <span key={id} className={`inv-source ${source.state}${source.partial ? " partial" : ""}`} title={source.error || (source.partial ? "A fonte tem mais registros do que foi possível ler." : `Lido às ${fmtTime(data.checkedAt)}`)}>
                <i aria-hidden="true" />
                {SOURCE_SHORT[id]} <b>{text}</b>
              </span>
            );
          })}
        </div>
        <span className="inv-sources-meta">
          {data.summary.machines} máquinas · {data.summary.active} em uso · lido às {fmtTime(data.checkedAt)}
        </span>
        <div className="inv-sources-actions">
          <button type="button" className="ct-secondary" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "dg-spin" : ""} /> {refreshing ? "Lendo..." : "Atualizar"}
          </button>
          {tab !== "relatorio" ? (
            <button type="button" className="ct-secondary" onClick={exportCsv} disabled={!rows.length}>
              <Download size={15} /> Exportar CSV
            </button>
          ) : null}
        </div>
      </section>

      {error ? <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>{error}</span></div> : null}
      {data.sources.some((source) => source.state === "down") ? (
        <div className="pm-error" role="alert">
          <AlertTriangle size={16} />
          <span>
            Sem resposta de {data.sources.filter((source) => source.state === "down").map((source) => source.label).join(", ")}. As divergências que dependem dessas fontes estão suspensas (não aparecem como zero).
          </span>
        </div>
      ) : null}

      <div className="ui-tabs" role="tablist" aria-label="Áreas do inventário">
        {([
          ["seguranca", "Segurança", ShieldAlert],
          ["limpeza", "Limpeza", Eraser],
          ["cadastro", "Cadastro", Tags],
          ["todas", "Todas", List],
          ["ignoradas", "Ignoradas", EyeOff],
          ["relatorio", "Relatório", FileText],
        ] as [Tab, string, typeof ShieldAlert][]).map(([key, label, Icon]) => {
          const count = key === "todas" ? data.machines.length : tabCounts[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key);
                setIssueFilter("all");
              }}
            >
              <Icon size={16} /> {label}
              {count !== undefined ? <b className={count && key === "seguranca" ? "ui-tab-count" : "ui-tab-count zero"}>{count}</b> : null}
            </button>
          );
        })}
      </div>

      {tab === "relatorio" ? (
        <InventoryReport data={data} catalog={catalog} counts={counts} />
      ) : (
        <>
          {tab === "seguranca" && bitlockerPolicyMissing ? (
            <div className="inv-policy" role="note">
              <AlertTriangle size={16} />
              <span>
                <b>Nenhuma estação tem BitLocker.</b> Não há política de criptografia atribuída no Intune; resolva pela política (Intune → Segurança do ponto de extremidade → Criptografia de disco), não máquina a máquina. Por isso as {data.summary.counts["sem-bitlocker"] || 0} máquinas sem BitLocker ficam fora da contagem desta aba; veja pelo filtro "Sem BitLocker".
              </span>
            </div>
          ) : null}
          <section className="ct-table-card">
            <div className="ct-toolbar">
              {issueOptions.length ? (
                <div className="ct-filters" role="group" aria-label="Filtrar por divergência">
                  <button type="button" aria-pressed={issueFilter === "all"} className={issueFilter === "all" ? "active" : ""} onClick={() => setIssueFilter("all")}>
                    Todas <small>{tabMachines.length}</small>
                  </button>
                  {issueOptions.map((option) => {
                    const item = catalog.get(option.code)!;
                    return (
                      <button
                        key={option.code}
                        type="button"
                        aria-pressed={issueFilter === option.code}
                        className={issueFilter === option.code ? "active" : ""}
                        onClick={() => setIssueFilter(option.code)}
                        title={item.suspended ? "Suspensa: falta a leitura de uma fonte" : item.action}
                      >
                        {item.label} <small>{item.suspended ? "—" : option.count}</small>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {kindOptions.length > 1 ? (
                <div className="ct-filters" role="group" aria-label="Filtrar por tipo">
                  <button type="button" aria-pressed={kindFilter === "all"} className={kindFilter === "all" ? "active" : ""} onClick={() => setKindFilter("all")}>Todos os tipos</button>
                  {kindOptions.map((kind) => (
                    <button key={kind} type="button" aria-pressed={kindFilter === kind} className={kindFilter === kind ? "active" : ""} onClick={() => setKindFilter(kind)}>
                      {KIND_LABEL[kind]}
                    </button>
                  ))}
                </div>
              ) : null}
              <label className="pm-search">
                <Search size={16} />
                <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar máquina, usuário, serial, OU ou IP" />
              </label>
            </div>
            <div className="ct-table-wrap">
              <table className="ct-table inv-table">
                <thead>
                  <tr>
                    <th aria-sort={byName ? "ascending" : "none"}>
                      <button type="button" onClick={() => setByName((value) => !value)} title={byName ? "Ordenar pela divergência mais grave" : "Ordenar por nome"}>
                        Máquina {byName ? "↑" : ""}
                      </button>
                    </th>
                    {shownSources.map((id) => <th key={id}>{SOURCE_SHORT[id]}</th>)}
                    <th>{tab === "ignoradas" ? "Ignoradas" : "Divergências"}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((machine) => (
                    <tr key={machine.key} className={machine.active ? "" : "inactive"} {...rowOpen(() => setOpenKey(machine.key))} aria-label={`Abrir ${machine.name}`}>
                      <td>
                        <strong className="ct-title">{machine.name}</strong>
                        <small className="ct-cat">{[KIND_LABEL[machine.kind], machine.os, machine.user].filter(Boolean).join(" · ")}</small>
                      </td>
                      {shownSources.map((id) => <td key={id}><PresenceCell machine={machine} source={id} state={sourceState(id)!} limits={data.limits} /></td>)}
                      <td>
                        <div className="inv-pills">
                          {(tab === "ignoradas" ? machine.issues.filter((issue) => issue.ignored) : activeIssues(machine))
                            .sort((a, b) => TONE_RANK[toneOf(a.code)] - TONE_RANK[toneOf(b.code)])
                            .map((issue) => (
                              <span key={issue.code} className={`status-pill tone-${toneOf(issue.code)}`} title={issue.ignored ? `${issue.ignored.reason}: ${issue.ignored.note}` : issue.detail}>
                                {catalog.get(issue.code)?.label || issue.code}
                              </span>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!rows.length ? (
                    <tr>
                      <td colSpan={shownSources.length + 2} className="ct-empty-row">
                        {term || issueFilter !== "all" || kindFilter !== "all" ? "Nada encontrado com estes filtros." : tab === "ignoradas" ? "Nenhuma divergência ignorada." : "Nenhuma máquina com divergência nesta área."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {rows.length > PAGE_SIZE ? (
              <div className="inv-pager">
                <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} de {rows.length}</span>
                <button type="button" className="pm-icon-btn" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
                <button type="button" className="pm-icon-btn" aria-label="Próxima página" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
              </div>
            ) : null}
          </section>
        </>
      )}

      {openMachine ? (
        <MachineDrawer
          machine={openMachine}
          position={openIndex >= 0 ? `${openIndex + 1} de ${rows.length}` : ""}
          catalog={catalog}
          sources={data.sources}
          onPrev={openIndex > 0 ? () => setOpenKey(rows[openIndex - 1].key) : undefined}
          onNext={openIndex >= 0 && openIndex < rows.length - 1 ? () => setOpenKey(rows[openIndex + 1].key) : undefined}
          onClose={() => setOpenKey(null)}
          onChanged={() => load()}
          onOpen={onOpen}
        />
      ) : null}
    </div>
  );
}

/* ---------- Celula de presenca (texto + cor; a cor nunca e o unico sinal) ---------- */
function PresenceCell({ machine, source, state, limits }: { machine: Machine; source: SourceId; state: Source; limits: Inventory["limits"] }) {
  if (state.state !== "ok") return <span className="inv-cell unknown" title={`${state.label}: ${state.error || "sem leitura"}`}>?</span>;
  const notApplicable = machine.kind === "movel" && source !== "intune" && source !== "entra";
  if (notApplicable) return <span className="inv-cell na" title="não se aplica">·</span>;
  const missingIsIssue = machine.issues.some((issue) => !issue.ignored && MISSING_BY_ISSUE[issue.code] === source);
  const stale = (value: string, limit: number) => (daysSince(value) > limit ? " stale" : "");

  if (source === "ad") {
    if (!machine.ad) return <span className={`inv-cell missing${missingIsIssue ? " issue" : ""}`}>—</span>;
    if (!machine.ad.enabled) return <span className="inv-cell off">desativada</span>;
    const seen = [machine.ad.lastLogon, machine.ad.pwdLastSet].filter(Boolean).sort().pop() || "";
    return <span className={`inv-cell${stale(seen, limits.ad)}`} title={`Último logon ${fmtDate(machine.ad.lastLogon)}`}>{relative(seen)}</span>;
  }
  if (source === "entra") {
    if (!machine.entra) return <span className="inv-cell missing">—</span>;
    return <span className="inv-cell">{TRUST[machine.entra.trust] || machine.entra.trust || "sim"}</span>;
  }
  if (source === "intune") {
    if (!machine.intune) return <span className={`inv-cell missing${missingIsIssue ? " issue" : ""}`}>—</span>;
    return (
      <span className={`inv-cell${stale(machine.intune.lastSync, limits.intune)}`} title={`Sincronizou ${fmtDate(machine.intune.lastSync)}`}>
        {relative(machine.intune.lastSync)}
        {machine.intune.duplicates ? ` · ${machine.intune.duplicates + 1}×` : ""}
      </span>
    );
  }
  const info = source === "defender" ? machine.defender : machine.milvus;
  if (!info) return <span className={`inv-cell missing${missingIsIssue ? " issue" : ""}`}>—</span>;
  return <span className={`inv-cell${stale(info.lastSeen, source === "defender" ? limits.defender : limits.milvus)}`} title={`Visto ${fmtDate(info.lastSeen)}`}>{relative(info.lastSeen)}</span>;
}

/* ---------- Gaveta: o que cada fonte diz, o que fazer e excecoes ---------- */
function osFamily(text: string) {
  if (/windows ?11/i.test(text)) return "11";
  if (/windows ?10/i.test(text) && !/server/i.test(text)) return "10";
  return "";
}

function MachineDrawer({
  machine,
  position,
  catalog,
  sources,
  onPrev,
  onNext,
  onClose,
  onChanged,
  onOpen,
}: {
  machine: Machine;
  position: string;
  catalog: Map<string, CatalogItem>;
  sources: Source[];
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onChanged: () => void;
  onOpen: (view: "ad" | "intune", term: string, tab?: string) => void;
}) {
  // Mais grave primeiro.
  const active = activeIssues(machine).sort((a, b) => TONE_RANK[catalog.get(a.code)?.tone || "neutral"] - TONE_RANK[catalog.get(b.code)?.tone || "neutral"]);
  const ignored = machine.issues.filter((issue) => issue.ignored);
  const [ignoreCode, setIgnoreCode] = useState("");
  const [reason, setReason] = useState(EXCEPTION_REASONS[0]);
  const [note, setNote] = useState("");
  const [days, setDays] = useState(90);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setIgnoreCode("");
    setNote("");
    setMessage("");
  }, [machine.key]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shown = SOURCE_ORDER.filter((id) => sources.find((source) => source.id === id)?.state !== "off");
  const { ad, entra, intune, defender, milvus } = machine;
  // Atributos nas linhas, fontes nas colunas; "≠" quando as fontes discordam.
  const lines: { label: string; values: Partial<Record<SourceId, string>>; diff?: (value: string) => string }[] = [
    { label: "Nome", values: { ad: ad?.name, intune: intune?.name, defender: defender?.name, milvus: milvus?.name } },
    { label: "Sistema", values: { ad: ad?.os, intune: intune ? [intune.os, intune.osVersion].join(" ") : undefined, defender: defender?.os, milvus: milvus?.os }, diff: osFamily },
    { label: "Usuário", values: { intune: intune?.userName || intune?.user, defender: defender?.user, milvus: milvus?.user } },
    { label: "Último contato", values: { ad: ad ? `logon ${fmtDate(ad.lastLogon)}` : undefined, entra: entra ? `login ${fmtDate(entra.lastSignIn)}` : undefined, intune: intune ? `sync ${fmtDate(intune.lastSync)}` : undefined, defender: defender ? fmtDate(defender.lastSeen) : undefined, milvus: milvus ? fmtDate(milvus.lastSeen) : undefined } },
    { label: "Criada / inscrita", values: { ad: ad ? fmtDate(ad.created) : undefined, intune: intune ? fmtDate(intune.enrolled) : undefined } },
    { label: "Local / ingresso", values: { ad: ad?.ou, entra: entra ? `${TRUST[entra.trust] || entra.trust || "—"}${entra.enabled ? "" : " · desativada"}` : undefined, intune: intune?.owner === "personal" ? "pessoal" : intune ? "corporativo" : undefined } },
    { label: "Serial", values: { intune: intune?.serial, milvus: milvus?.serial }, diff: (value) => value.trim().toUpperCase() },
    { label: "Modelo", values: { intune: intune?.model, milvus: milvus?.model } },
    { label: "Criptografia", values: { intune: intune ? (intune.encrypted ? "BitLocker ligado" : "desligada") : undefined } },
    { label: "Conformidade", values: { intune: intune?.compliance } },
    { label: "Risco / IP", values: { defender: defender ? [defender.risk, defender.ip].filter(Boolean).join(" · ") : undefined, milvus: milvus?.ip } },
  ];
  const diffCount = lines.filter((line) => line.diff && new Set(Object.values(line.values).filter(Boolean).map((value) => line.diff!(value!)).filter(Boolean)).size > 1).length;

  async function ignore() {
    setBusy(true);
    setMessage("");
    try {
      await api("/api/inventory/exceptions", "POST", { machine: machine.key, code: ignoreCode, reason, note, days });
      setIgnoreCode("");
      setNote("");
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function restore(code: string) {
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/inventory/exceptions?machine=${encodeURIComponent(machine.key)}&code=${encodeURIComponent(code)}`, "DELETE");
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const adCode = active.some((issue) => ["fora-intune", "parada-ad", "desativada-ad", "so-antigo", "nome-fora-padrao"].includes(issue.code));
  const intuneCode = active.some((issue) => ["sem-bitlocker", "windows-10", "intune-parado", "intune-duplicado", "so-intune"].includes(issue.code));

  return (
    <>
      <div className="side-drawer-backdrop" onClick={onClose} />
      <aside className="side-drawer wide inv-drawer" role="dialog" aria-modal="true" aria-label={`Máquina ${machine.name}`}>
        <header className="side-drawer-head">
          <div>
            <p className="eyebrow">{["Máquina", position].filter(Boolean).join(" · ")}</p>
            <h2>{machine.name}</h2>
            <p className="inv-drawer-sub">{[KIND_LABEL[machine.kind], machine.os, machine.asset ? `patrimônio ${machine.asset}` : "", machine.active ? "em uso" : `visto ${relative(machine.lastSeen)}`].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="inv-drawer-nav">
            <button className="pm-icon-btn" type="button" onClick={onPrev} disabled={!onPrev} aria-label="Máquina anterior"><ChevronLeft size={16} /></button>
            <button className="pm-icon-btn" type="button" onClick={onNext} disabled={!onNext} aria-label="Próxima máquina"><ChevronRight size={16} /></button>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
          </div>
        </header>

        <section className="inv-block">
          <h3>O que fazer</h3>
          {active.length ? (
            <ul className="inv-todo">
              {active.map((issue) => {
                const item = catalog.get(issue.code);
                return (
                  <li key={issue.code}>
                    <span className={`status-pill tone-${item?.tone || "neutral"}`}>{item?.label || issue.code}</span>
                    {issue.detail ? <small>{issue.detail}</small> : null}
                    <p>{item?.action}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="ct-muted">Nenhuma divergência{ignored.length ? " (há divergências ignoradas abaixo)" : ""}.</p>
          )}
          <div className="inv-links">
            {ad && adCode ? <button type="button" className="ct-secondary" onClick={() => onOpen("ad", ad.name, "computers")}>Ficha no AD</button> : null}
            {intune && intuneCode ? <button type="button" className="ct-secondary" onClick={() => onOpen("intune", intune.name)}>Abrir no Intune</button> : null}
            {intune ? (
              <a className="ct-secondary" href={`https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/overview/mdmDeviceId/${intune.id}`} target="_blank" rel="noreferrer">
                Portal do Intune <ExternalLink size={13} aria-hidden="true" />
              </a>
            ) : null}
            {defender ? (
              <a className="ct-secondary" href={`https://security.microsoft.com/machines/v2/${defender.id}/overview`} target="_blank" rel="noreferrer">
                Portal do Defender <ExternalLink size={13} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </section>

        <section className="inv-block">
          <h3>O que cada fonte diz</h3>
          <div className="ct-table-wrap">
            <table className="inv-compare">
              <thead>
                <tr>
                  <th />
                  {shown.map((id) => <th key={id}>{SOURCE_SHORT[id]}</th>)}
                </tr>
              </thead>
              <tbody>
                {lines
                  .filter((line) => shown.some((id) => line.values[id]))
                  .map((line) => {
                    const families = line.diff ? new Set(Object.values(line.values).filter(Boolean).map((value) => line.diff!(value!)).filter(Boolean)) : new Set<string>();
                    const differs = families.size > 1;
                    return (
                      <tr key={line.label}>
                        <th scope="row">{line.label}</th>
                        {shown.map((id) => {
                          const value = line.values[id];
                          return (
                            <td key={id} className={differs && value ? "inv-diff" : ""}>
                              {value ? <>{differs ? <b aria-label="diferente">≠ </b> : null}{value}</> : <span className="ct-muted">{machine.kind === "movel" && id !== "intune" && id !== "entra" ? "·" : "—"}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {diffCount ? <p className="inv-diff-note">{diffCount === 1 ? "1 dado diferente entre as fontes." : `${diffCount} dados diferentes entre as fontes.`} O AD só atualiza o sistema no logon; pode ser um registro antigo com o mesmo nome.</p> : null}
        </section>

        <section className="inv-block">
          <h3>Exceções</h3>
          {ignored.length ? (
            <ul className="inv-ignored">
              {ignored.map((issue) => (
                <li key={issue.code}>
                  <span className="status-pill tone-neutral">{catalog.get(issue.code)?.label || issue.code}</span>
                  <span>
                    {issue.ignored!.reason} · {issue.ignored!.note}
                    <small>por {issue.ignored!.by || "—"} em {fmtDate(issue.ignored!.at)} · {issue.ignored!.until ? `vale até ${fmtDate(issue.ignored!.until)}` : "permanente"}</small>
                  </span>
                  <button type="button" className="ct-secondary" disabled={busy} onClick={() => restore(issue.code)}><Undo2 size={14} /> Voltar a mostrar</button>
                </li>
              ))}
            </ul>
          ) : null}
          {active.length ? (
            ignoreCode ? (
              <div className="inv-ignore-form">
                <label>
                  <span>Divergência</span>
                  <select value={ignoreCode} onChange={(event) => setIgnoreCode(event.target.value)}>
                    {active.map((issue) => <option key={issue.code} value={issue.code}>{catalog.get(issue.code)?.label || issue.code}</option>)}
                  </select>
                </label>
                <label>
                  <span>Motivo</span>
                  <select value={reason} onChange={(event) => setReason(event.target.value)}>
                    {EXCEPTION_REASONS.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  <span>Vale por</span>
                  <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
                    <option value={30}>30 dias</option>
                    <option value={90}>90 dias</option>
                    <option value={0}>Permanente</option>
                  </select>
                </label>
                <label className="wide">
                  <span>Observação</span>
                  <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: catraca do portão 2, sem usuário" maxLength={300} />
                </label>
                <div className="inv-ignore-actions">
                  <button type="button" className="ct-secondary" onClick={() => setIgnoreCode("")} disabled={busy}>Cancelar</button>
                  <button type="button" className="ct-primary" onClick={ignore} disabled={busy || note.trim().length < 5}>Registrar exceção</button>
                </div>
              </div>
            ) : (
              <button type="button" className="ct-secondary" onClick={() => setIgnoreCode(active[0].code)}><EyeOff size={14} /> Ignorar uma divergência...</button>
            )
          ) : null}
          {message ? <div className="form-error" role="alert">{message}</div> : null}
        </section>
      </aside>
    </>
  );
}

/* ---------- Relatorio para o gestor ---------- */
function InventoryReport({ data, catalog, counts: countsCode }: { data: Inventory; catalog: Map<string, CatalogItem>; counts: (code: string) => boolean }) {
  const [copied, setCopied] = useState(false);
  const { coverage, counts } = data.summary;
  // Retrato de ~1 semana atras (o mais recente com 7 dias ou mais).
  const weekAgo = new Date(Date.now() - 7 * 864e5).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const previous = [...data.history].reverse().find((day) => day.date <= weekAgo) || null;
  const first = data.history[0];
  const machinesWith = (tab: WorkTab) => data.machines.filter((machine) => activeIssues(machine).some((issue) => catalog.get(issue.code)?.tab === tab && countsCode(issue.code))).length;
  const security = machinesWith("seguranca");
  const cleanup = machinesWith("limpeza");
  const down = data.sources.filter((source) => source.state !== "ok");
  // Fonte sem leitura nao vira 0%: a barra mostra "sem leitura".
  const bars: [string, number, SourceId | null][] = [
    ["No Intune", coverage.intune, "intune"],
    ["Com Defender", coverage.defender, "defender"],
    ["No Milvus", coverage.milvus, "milvus"],
    ["Já no Windows 11", coverage.win11, null],
    ["Com BitLocker", coverage.bitlocker, "intune"],
  ];
  const delta = (code: string) => {
    if (!previous) return null;
    const value = (counts[code] || 0) - (previous.counts[code] || 0);
    return value;
  };

  function summaryText() {
    const top = data.catalog.filter((item) => counts[item.code] && !item.suspended);
    const part = (tab: WorkTab) => top.filter((item) => item.tab === tab).map((item) => `${counts[item.code]} ${item.label.toLowerCase()}`).join(", ");
    return [
      `Inventário de máquinas ${new Date().toLocaleDateString("pt-BR")}: ${data.summary.machines} máquinas, ${coverage.stations} estações em uso.`,
      `Cobertura das estações: ${bars.filter(([, , source]) => !source || !down.some((item) => item.id === source)).map(([label, value]) => `${label.toLowerCase()} ${pct(value, coverage.stations)}%`).join(", ")}.`,
      part("seguranca") ? `Segurança: ${part("seguranca")}.` : "",
      part("limpeza") ? `Limpeza: ${part("limpeza")}.` : "",
      part("cadastro") ? `Cadastro: ${part("cadastro")}.` : "",
      down.length ? `Atenção: sem leitura de ${down.map((source) => source.label).join(", ")}.` : "",
    ].filter(Boolean).join("\n");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(summaryText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie o resumo:", summaryText());
    }
  }

  return (
    <div className="inv-report">
      <header className="inv-report-head">
        <div>
          <h2>Inventário de máquinas · {new Date().toLocaleDateString("pt-BR")}</h2>
          <p>
            Fontes lidas às {fmtTime(data.checkedAt)}: {data.sources.filter((source) => source.state === "ok").map((source) => source.label).join(", ")}
            {down.length ? ` · sem leitura: ${down.map((source) => source.label).join(", ")}` : ""}
          </p>
        </div>
        <div className="inv-report-actions">
          <button type="button" className="ct-secondary" onClick={copy}><ClipboardCopy size={15} /> {copied ? "Copiado" : "Copiar resumo"}</button>
          <button type="button" className="ct-secondary" onClick={() => window.print()}><Printer size={15} /> Imprimir / PDF</button>
        </div>
      </header>

      <section className="ct-kpis">
        <div className="ct-kpi"><span>Máquinas conhecidas</span><strong>{data.summary.machines}</strong><small>{data.summary.active} vistas nos últimos {data.limits.active} dias</small></div>
        <div className="ct-kpi"><span>Estações em uso</span><strong>{coverage.stations}</strong><small>{down.some((item) => item.id === "intune") ? "Intune sem leitura" : `${pct(coverage.intune, coverage.stations)}% gerenciadas pelo Intune`}</small></div>
        <div className={`ct-kpi${security ? " tone-critical" : ""}`}><span>Segurança</span><strong>{security}</strong><small>máquinas com pendência de segurança{countsCode("sem-bitlocker") ? "" : " (fora o BitLocker, que é de política)"}</small></div>
        <div className={`ct-kpi${cleanup ? " tone-warning" : ""}`}><span>Limpeza</span><strong>{cleanup}</strong><small>registros parados ou duplicados</small></div>
      </section>

      <section className="ct-card">
        <h3>Cobertura das estações em uso</h3>
        <ul className="ct-bars inv-bars">
          {bars.map(([label, value, source]) => {
            const missing = source && down.some((item) => item.id === source);
            return (
              <li key={label}>
                <span className="ct-bar-label">{label}</span>
                <span className="ct-bar-track"><span className="ct-bar-fill" style={{ width: `${missing ? 0 : pct(value, coverage.stations)}%` }} /></span>
                <span className="ct-bar-value">{missing ? "sem leitura" : `${value} de ${coverage.stations} · ${pct(value, coverage.stations)}%`}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="ct-card">
        <h3>Divergências</h3>
        <div className="ct-table-wrap">
          <table className="ct-table inv-report-table">
            <thead>
              <tr>
                <th>Área</th>
                <th>Divergência</th>
                <th className="num">Hoje</th>
                <th className="num">Há 1 semana</th>
                <th className="num">Variação</th>
              </tr>
            </thead>
            <tbody>
              {data.catalog.map((item) => {
                const change = delta(item.code);
                return (
                  <tr key={item.code}>
                    <td className="ct-muted">{item.tab === "seguranca" ? "Segurança" : item.tab === "limpeza" ? "Limpeza" : "Cadastro"}</td>
                    <td>{item.label}</td>
                    <td className="num">{item.suspended ? "—" : counts[item.code] || 0}</td>
                    <td className="num">{previous ? previous.counts[item.code] || 0 : "—"}</td>
                    <td className={`num${change && change > 0 ? " inv-up" : change && change < 0 ? " inv-down" : ""}`}>{change === null || item.suspended ? "—" : change > 0 ? `+${change}` : change}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!previous ? (
          <p className="inv-note">A comparação com a semana anterior aparece quando houver 7 dias de histórico{first ? ` (primeiro retrato em ${new Date(`${first.date}T12:00:00`).toLocaleDateString("pt-BR")})` : ""}.</p>
        ) : null}
      </section>

      <p className="inv-note">
        Regras: em uso = visto em até {data.limits.active} dias em alguma fonte · AD parado = sem logon há {data.limits.ad} dias · Intune sem sincronizar = {data.limits.intune} dias · Defender sem contato = {data.limits.defender} dias · Milvus sem contato = {data.limits.milvus} dias · nome padrão = N ou D + patrimônio. Divergências ignoradas não entram nas contagens.
      </p>
    </div>
  );
}
