import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, RefreshCw, Search, Upload, X } from "lucide-react";

// Aba "Levantamento" do Inventario: a planilha feita em campo cruzada com o AD e o Intune, uma linha por tag.
// A planilha e lida aqui no navegador (a biblioteca xlsx so carrega nesta aba) e vai ao servidor ja organizada.

type Situation = { code: string; label: string; tone: string };
type SheetRow = { line: number; name: string; model: string; user: string; date: string; status: string; adCheck: string; intuneCheck: string; note: string };
type NetMachine = {
  key: string;
  name: string;
  active: boolean;
  lastSeen: string;
  serial: string;
  model: string;
  user: string;
  os: string;
  ad: { enabled: boolean; lastLogon: string; ou: string } | null;
  intune: { lastSync: string; user: string } | null;
  defender: boolean;
  milvus: boolean;
};
type Item = { tag: string; type: "N" | "D" | "N/D"; situation: string; sheet: SheetRow[]; machines: NetMachine[]; warnings: string[] };
type NoTag = { name: string; where: string; virtual: boolean; row: SheetRow | null; machine: NetMachine | null };
type Survey = {
  checkedAt: string;
  sources: { id: string; label: string; state: string; error: string }[];
  sheet: { fileName: string; sheet: string; importedAt: string; by: string; rows: number; previous: { fileName: string; importedAt: string; rows: number } | null } | null;
  situations: Situation[];
  counts: Record<string, number>;
  items: Item[];
  noTag: NoTag[];
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let token = "";
  try {
    token = (JSON.parse(window.localStorage.getItem("rede-clube-session") || "{}") as { token?: string }).token || "";
  } catch {
    /* sem sessao: o servidor responde 401 */
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 401) window.dispatchEvent(new Event("rede-clube-auth-expired"));
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { message?: string }).message || "Não foi possível falar com o servidor.");
  return payload as T;
}

const TYPE_LABEL: Record<Item["type"], string> = { N: "Notebook", D: "Desktop", "N/D": "Notebook e desktop" };
const daysSince = (value: string) => (value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 864e5)) : null);
const ago = (value: string) => {
  const days = daysSince(value);
  return days === null ? "nunca" : days === 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} d`;
};
const fmtDate = (value: string) => (/^\d{4}-\d{2}-\d{2}/.test(value) ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : value);
const fmtIso = (value: string) => (value ? new Date(value).toLocaleDateString("pt-BR") : "");

/* ---------- Leitura da planilha (navegador) ---------- */
type FieldKey = "name" | "maker" | "model" | "user" | "date" | "status" | "adCheck" | "intuneCheck" | "note";
const FIELDS: { key: FieldKey; label: string; match: RegExp }[] = [
  { key: "name", label: "Nome da máquina (tag) *", match: /device ?name|^nome|hostname|maquina|patrimonio|^tag$|plaqueta|^dispositivo/ },
  { key: "maker", label: "Fabricante", match: /manufacturer|fabricante|^marca/ },
  { key: "model", label: "Modelo", match: /^model|^modelo/ },
  { key: "user", label: "Usuário / setor", match: /display name|usuario|setor|responsavel|departamento/ },
  { key: "date", label: "Data da conferência", match: /^data/ },
  { key: "status", label: "Situação no levantamento", match: /^inventario|situacao|^status/ },
  { key: "adCheck", label: "AD (marcado em campo)", match: /^ad$/ },
  { key: "intuneCheck", label: "Intune (marcado em campo)", match: /^intune$/ },
  { key: "note", label: "Observação", match: /atencao|^obs/ },
];
const plain = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const TAG_LIKE = /^[ND]-?\d{3,6}[A-Z]?(\/\d{3,6})*$/i;

type Parsed = { fileName: string; sheets: { name: string; rows: unknown[][] }[] };
type Mapping = Partial<Record<FieldKey, number>>;

function guessHeader(rows: unknown[][]) {
  let best = { row: 0, score: -1 };
  rows.slice(0, 20).forEach((row, index) => {
    const score = FIELDS.filter((field) => row.some((cell) => field.match.test(plain(cell)))).length;
    if (score > best.score) best = { row: index, score };
  });
  return best;
}

function guessMapping(header: unknown[]): Mapping {
  const mapping: Mapping = {};
  for (const field of FIELDS) {
    const index = header.findIndex((cell, position) => field.match.test(plain(cell)) && !Object.values(mapping).includes(position));
    if (index >= 0) mapping[field.key] = index;
  }
  return mapping;
}

function cellText(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value ?? "").trim();
}

function toRows(rows: unknown[][], headerRow: number, mapping: Mapping): SheetRow[] {
  const get = (row: unknown[], key: FieldKey) => (mapping[key] === undefined ? "" : cellText(row[mapping[key]!]));
  return rows
    .slice(headerRow + 1)
    .map((row, index) => {
      const maker = get(row, "maker");
      const model = get(row, "model");
      return {
        line: headerRow + index + 2,
        name: get(row, "name"),
        model: maker && !plain(model).startsWith(plain(maker)) ? `${maker} ${model}`.trim() : model || maker,
        user: get(row, "user"),
        date: get(row, "date"),
        status: get(row, "status"),
        adCheck: get(row, "adCheck"),
        intuneCheck: get(row, "intuneCheck"),
        note: get(row, "note"),
      };
    })
    .filter((row) => row.name);
}

function SurveyImport({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping>({});
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sheet = parsed?.sheets.find((item) => item.name === sheetName) || null;
  const header = sheet?.rows[headerRow] || [];

  function chooseSheet(next: Parsed, name: string) {
    const rows = next.sheets.find((item) => item.name === name)?.rows || [];
    const guess = guessHeader(rows);
    setSheetName(name);
    setHeaderRow(guess.row);
    setMapping(guessMapping(rows[guess.row] || []));
  }

  async function readFile(file: File) {
    setError("");
    if (file.size > 15 * 1024 * 1024) {
      setError(`A planilha tem ${(file.size / 1024 / 1024).toFixed(1)} MB; o limite é 15 MB. Salve uma cópia sem imagens.`);
      return;
    }
    setReading(true);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, cellFormula: false });
      const next: Parsed = {
        fileName: file.name,
        sheets: book.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, raw: true, defval: "" }) })),
      };
      // Aba sugerida: a de cabecalho mais reconhecivel e com mais nomes no padrao N/D.
      const score = (rows: unknown[][]) => {
        const guess = guessHeader(rows);
        const nameCol = guessMapping(rows[guess.row] || []).name;
        const tagged = nameCol === undefined ? 0 : rows.filter((row) => TAG_LIKE.test(String(row[nameCol] ?? "").trim())).length;
        return guess.score * 1000 + tagged;
      };
      const best = [...next.sheets].sort((a, b) => score(b.rows) - score(a.rows))[0];
      setParsed(next);
      chooseSheet(next, best?.name || next.sheets[0]?.name || "");
    } catch {
      setError("Não foi possível abrir a planilha (protegida por senha ou danificada). Abra no Excel, salve de novo e tente outra vez.");
    } finally {
      setReading(false);
    }
  }

  const rows = useMemo(() => (sheet && mapping.name !== undefined ? toRows(sheet.rows, headerRow, mapping) : []), [sheet, headerRow, mapping]);
  const preview = useMemo(() => {
    const tagged = rows.filter((row) => TAG_LIKE.test(row.name.replace(/\s+/g, "")));
    const seen = new Map<string, number>();
    for (const row of tagged) {
      const number = /\d{3,6}/.exec(row.name)?.[0].replace(/^0+/, "") || "";
      seen.set(number, (seen.get(number) || 0) + 1);
    }
    return { total: rows.length, tagged: tagged.length, untagged: rows.length - tagged.length, repeated: [...seen.entries()].filter(([, count]) => count > 1).map(([tag]) => tag) };
  }, [rows]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api("/api/inventory/survey/sheet", "POST", { fileName: parsed?.fileName, sheet: sheetName, rows });
      onDone();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ct-card inv-import" aria-label="Importar planilha de levantamento">
      <header className="inv-import-head">
        <h3><FileSpreadsheet size={18} /> Importar planilha de levantamento</h3>
        <button type="button" className="pm-icon-btn" aria-label="Fechar" onClick={onCancel}><X size={16} /></button>
      </header>
      <label className="inv-file">
        <span>Arquivo (.xlsx, .xls ou .csv)</span>
        <input type="file" accept=".xlsx,.xls,.csv" disabled={reading || saving} onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} />
      </label>
      {reading ? <p className="inv-note">Lendo a planilha...</p> : null}
      {parsed && sheet ? (
        <>
          <div className="inv-import-row">
            <label>
              <span>Aba</span>
              <select value={sheetName} onChange={(event) => chooseSheet(parsed, event.target.value)}>
                {parsed.sheets.map((item) => <option key={item.name} value={item.name}>{item.name} ({Math.max(0, item.rows.length - 1)} linhas)</option>)}
              </select>
            </label>
            <label>
              <span>Cabeçalho na linha</span>
              <select value={headerRow} onChange={(event) => { const row = Number(event.target.value); setHeaderRow(row); setMapping(guessMapping(sheet.rows[row] || [])); }}>
                {sheet.rows.slice(0, 20).map((_, index) => <option key={index} value={index}>{index + 1}</option>)}
              </select>
            </label>
          </div>
          <table className="inv-map">
            <thead>
              <tr><th>Informação</th><th>Coluna da planilha</th><th>Exemplos lidos</th></tr>
            </thead>
            <tbody>
              {FIELDS.map((field) => {
                const column = mapping[field.key];
                const samples = column === undefined ? [] : sheet.rows.slice(headerRow + 1).map((row) => cellText(row[column])).filter(Boolean).slice(0, 3);
                return (
                  <tr key={field.key}>
                    <th scope="row">{field.label}</th>
                    <td>
                      <select
                        value={column === undefined ? "" : String(column)}
                        onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value === "" ? undefined : Number(event.target.value) }))}
                      >
                        <option value="">(não tem)</option>
                        {header.map((cell, index) => <option key={index} value={index}>{String(cell || `Coluna ${index + 1}`)}</option>)}
                      </select>
                    </td>
                    <td className="ct-muted">{samples.map((sample) => (field.key === "date" ? fmtDate(sample) : sample)).join(" · ") || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {mapping.name === undefined ? (
            <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>Escolha a coluna com o nome da máquina (ex.: N5307). Ela é obrigatória.</span></div>
          ) : (
            <ul className="inv-preview">
              <li><b>{preview.total}</b> linhas com nome de máquina</li>
              <li><b>{preview.tagged}</b> com tag (N ou D + número)</li>
              {preview.untagged ? <li><b>{preview.untagged}</b> sem tag no nome (máquinas virtuais ou nomes fora do padrão): ficam numa lista à parte</li> : null}
              {preview.repeated.length ? <li><b>{preview.repeated.length}</b> tag(s) repetida(s): {preview.repeated.slice(0, 8).join(", ")}{preview.repeated.length > 8 ? "…" : ""}</li> : null}
              <li className="ct-muted">Nada é gravado até você clicar em Importar. A planilha anterior é substituída.</li>
            </ul>
          )}
          {error ? <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>{error}</span></div> : null}
          <div className="inv-ignore-actions">
            <button type="button" className="ct-secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
            <button type="button" className="ct-primary" onClick={save} disabled={saving || mapping.name === undefined || !rows.length}>
              <Upload size={15} /> {saving ? "Importando..." : `Importar ${rows.length} linhas`}
            </button>
          </div>
        </>
      ) : error ? (
        <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>
      ) : null}
    </section>
  );
}

/* ---------- Aba ---------- */
// Situacoes que pedem acao (contam no numero da aba e vem primeiro na lista; depois, ordem de tag).
const PENDING = new Set(["fora-intune", "fora-ad", "so-planilha", "fora-planilha"]);
const ORDER = ["fora-intune", "fora-ad", "so-planilha", "fora-planilha", "sem-leitura", "confere", "fora-planilha-parada"];

export function SurveyTab({ isAdmin, onOpenMachine, onCount }: { isAdmin: boolean; onOpenMachine: (key: string) => void; onCount: (value: number) => void }) {
  const [data, setData] = useState<Survey | null>(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState("all");
  const [term, setTerm] = useState("");
  const [showNoTag, setShowNoTag] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await api<Survey>("/api/inventory/survey");
      setData(next);
      if (next.sheet) onCount(next.items.filter((item) => PENDING.has(item.situation)).length);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }, [onCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const situations = useMemo(() => new Map((data?.situations || []).map((item) => [item.code, item])), [data]);
  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const digits = /^[nd]?\s*0*(\d+)$/i.exec(needle)?.[1];
    return (data?.items || [])
      .filter((item) => filter === "all" || (filter === "avisos" ? item.warnings.length > 0 : item.situation === filter))
      .filter((item) => {
        if (!needle) return true;
        if (digits) return item.tag.startsWith(digits);
        return [item.sheet.map((row) => `${row.name} ${row.user} ${row.model}`).join(" "), item.machines.map((machine) => `${machine.name} ${machine.user} ${machine.serial}`).join(" ")].join(" ").toLowerCase().includes(needle);
      })
      .sort((a, b) => ORDER.indexOf(a.situation) - ORDER.indexOf(b.situation) || Number(a.tag) - Number(b.tag));
  }, [data, filter, term]);

  async function exportExcel() {
    if (!data) return;
    const XLSX = await import("xlsx");
    const book = XLSX.utils.book_new();
    const label = (code: string) => situations.get(code)?.label || code;
    const summary = [
      ["Levantamento de patrimônio: planilha × AD × Intune"],
      [],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      ["Planilha", data.sheet ? `${data.sheet.fileName} · aba ${data.sheet.sheet} · ${data.sheet.rows} linhas · importada em ${fmtIso(data.sheet.importedAt)} por ${data.sheet.by}` : "não importada"],
      ["AD e Intune", data.sources.map((source) => `${source.label}: ${source.state === "ok" ? "lido" : "SEM LEITURA"}`).join(" · ") + ` · ${new Date(data.checkedAt).toLocaleString("pt-BR")}`],
      [],
      ["Situação", "Tags"],
      ...data.situations.filter((item) => data.counts[item.code]).map((item) => [item.label, data.counts[item.code]]),
      ["TOTAL de tags", data.items.length],
      ["Sem tag no nome", data.noTag.length],
      [],
      ["Critério", "Tag = número no nome da máquina (N = notebook, D = desktop); N5307N conta como 5307. \"Em uso\" = visto em até 30 dias em alguma fonte da TI."],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summary);
    wsSummary["!cols"] = [{ wch: 40 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(book, wsSummary, "Resumo");

    const head = ["Tag", "Tipo", "Situação", "Nome na planilha", "Usuário / setor (planilha)", "Modelo (planilha)", "Conferida em campo", "AD (marcado em campo)", "Intune (marcado em campo)", "Nome(s) na rede", "AD hoje", "Último logon AD", "Intune hoje", "Último sync Intune", "Serial", "Modelo (rede)", "Usuário (rede)", "Último contato", "Avisos"];
    const body = data.items.map((item) => {
      const row = item.sheet[0];
      const main = item.machines[0];
      const ad = item.machines.find((machine) => machine.ad);
      const intune = item.machines.find((machine) => machine.intune);
      return [
        item.tag,
        TYPE_LABEL[item.type],
        label(item.situation),
        item.sheet.map((entry) => entry.name).join(" / "),
        row?.user || "",
        row?.model || "",
        row ? fmtDate(row.date) : "",
        row?.adCheck || "",
        row?.intuneCheck || "",
        item.machines.map((machine) => machine.name).join(" / "),
        ad ? (ad.ad!.enabled ? "sim" : "desativada") : "não",
        ad ? fmtIso(ad.ad!.lastLogon) : "",
        intune ? "sim" : "não",
        intune ? fmtIso(intune.intune!.lastSync) : "",
        main?.serial || "",
        main?.model || "",
        main?.user || "",
        main ? fmtIso(main.lastSeen) : "",
        item.warnings.join("; "),
      ];
    });
    const wsMain = XLSX.utils.aoa_to_sheet([head, ...body]);
    wsMain["!cols"] = [8, 12, 34, 16, 28, 30, 12, 10, 10, 22, 10, 12, 10, 12, 14, 28, 26, 12, 60].map((wch) => ({ wch }));
    wsMain["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length, c: head.length - 1 } }) };
    XLSX.utils.book_append_sheet(book, wsMain, "Levantamento");

    const noTagHead = ["Nome", "Onde aparece", "Máquina virtual?", "Usuário / setor", "Modelo", "Conferida em campo", "Último contato", "Serial"];
    const noTagBody = data.noTag.map((item) => [item.name, item.where, item.virtual ? "sim" : "", item.row?.user || item.machine?.user || "", item.row?.model || item.machine?.model || "", item.row ? fmtDate(item.row.date) : "", item.machine ? fmtIso(item.machine.lastSeen) : "", item.machine?.serial || ""]);
    const wsNoTag = XLSX.utils.aoa_to_sheet([noTagHead, ...noTagBody]);
    wsNoTag["!cols"] = [20, 16, 10, 28, 30, 12, 12, 14].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(book, wsNoTag, "Sem tag");
    XLSX.writeFile(book, `levantamento-${new Date().toLocaleDateString("sv-SE")}.xlsx`);
  }

  if (error && !data) {
    return <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>Não foi possível montar o levantamento: {error}</span><button type="button" className="ct-secondary" onClick={load}>Tentar novamente</button></div>;
  }
  if (!data) return <div className="view-loading">Cruzando a planilha com o AD e o Intune...</div>;

  const unreadable = data.sources.filter((source) => source.state !== "ok");

  return (
    <>
      <section className="ct-card inv-survey-head">
        <div>
          <h3><FileSpreadsheet size={18} /> Planilha de levantamento</h3>
          {data.sheet ? (
            <p>
              <b>{data.sheet.fileName}</b> · aba {data.sheet.sheet} · {data.sheet.rows} linhas · importada em {fmtIso(data.sheet.importedAt)} por {data.sheet.by}
              {data.sheet.previous ? <span className="ct-muted"> · anterior: {data.sheet.previous.rows} linhas em {fmtIso(data.sheet.previous.importedAt)}</span> : null}
            </p>
          ) : (
            <p className="ct-muted">Nenhuma planilha importada ainda. {isAdmin ? "Importe a planilha feita em campo para cruzar com o AD e o Intune." : "Peça ao gestor do portal para importar."}</p>
          )}
        </div>
        <div className="inv-sources-actions">
          {isAdmin ? (
            <button type="button" className="ct-secondary" onClick={() => setImporting(true)}>
              <Upload size={15} /> {data.sheet ? "Importar nova versão" : "Importar planilha"}
            </button>
          ) : null}
          <button type="button" className="ct-secondary" onClick={exportExcel} disabled={!data.items.length}>
            <Download size={15} /> Exportar Excel
          </button>
          <button className="pm-icon-btn" type="button" title="Atualizar" aria-label="Atualizar" onClick={load}><RefreshCw size={16} /></button>
        </div>
      </section>

      {importing ? <SurveyImport onCancel={() => setImporting(false)} onDone={() => { setImporting(false); void load(); }} /> : null}
      {unreadable.length ? (
        <div className="pm-error" role="alert">
          <AlertTriangle size={16} />
          <span>Sem leitura de {unreadable.map((source) => source.label).join(" e ")}: as situações ficam suspensas até a leitura voltar.</span>
        </div>
      ) : null}
      {error ? <div className="pm-error" role="alert"><AlertTriangle size={16} /><span>{error}</span></div> : null}

      <section className="ct-table-card">
        <div className="ct-toolbar">
          <div className="ct-filters" role="group" aria-label="Filtrar por situação">
            <button type="button" aria-pressed={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas <small>{data.items.length}</small></button>
            {data.situations.filter((item) => data.counts[item.code]).map((item) => (
              <button key={item.code} type="button" aria-pressed={filter === item.code} className={filter === item.code ? "active" : ""} onClick={() => setFilter(item.code)}>
                {item.label} <small>{data.counts[item.code]}</small>
              </button>
            ))}
            <button type="button" aria-pressed={filter === "avisos"} className={filter === "avisos" ? "active" : ""} onClick={() => setFilter("avisos")}>
              Com aviso <small>{data.items.filter((item) => item.warnings.length).length}</small>
            </button>
          </div>
          <label className="pm-search">
            <Search size={16} />
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Tag (ex.: 5307 ou N5307), nome, usuário ou serial" />
          </label>
        </div>
        <div className="ct-table-wrap">
          <table className="ct-table inv-table">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Planilha</th>
                <th>AD</th>
                <th>Intune</th>
                <th>Situação</th>
                <th>Avisos</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 600).map((item) => {
                const row = item.sheet[0];
                const ad = item.machines.find((machine) => machine.ad);
                const intune = item.machines.find((machine) => machine.intune);
                const situation = situations.get(item.situation);
                const open = item.machines[0] ? () => onOpenMachine(item.machines[0].key) : undefined;
                return (
                  <tr
                    key={item.tag}
                    className={open ? "" : "inv-row-static"}
                    tabIndex={open ? 0 : undefined}
                    onClick={open}
                    onKeyDown={(event) => {
                      if (open && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        open();
                      }
                    }}
                  >
                    <td>
                      <strong className="ct-title">{item.tag}</strong>
                      <small className="ct-cat">{TYPE_LABEL[item.type]}</small>
                    </td>
                    <td>
                      {row ? (
                        <>
                          <span className="ct-title">{item.sheet.map((entry) => entry.name).join(" / ")}</span>
                          <small className="ct-cat">{[row.user, row.date ? `conferida ${fmtDate(row.date)}` : ""].filter(Boolean).join(" · ")}</small>
                        </>
                      ) : (
                        <span className={`inv-cell missing${item.situation === "fora-planilha" ? " issue" : ""}`}>—</span>
                      )}
                    </td>
                    <td>
                      {ad ? (
                        <span className={`inv-cell${ad.ad!.enabled ? "" : " off"}`} title={ad.ad!.ou}>{ad.ad!.enabled ? `logon ${ago(ad.ad!.lastLogon)}` : "desativada"}</span>
                      ) : (
                        <span className={`inv-cell missing${item.situation === "fora-ad" ? " issue" : ""}`}>—</span>
                      )}
                    </td>
                    <td>
                      {intune ? (
                        <span className={`inv-cell${(daysSince(intune.intune!.lastSync) ?? 0) > 30 ? " stale" : ""}`}>sync {ago(intune.intune!.lastSync)}</span>
                      ) : (
                        <span className={`inv-cell missing${item.situation === "fora-intune" ? " issue" : ""}`}>—</span>
                      )}
                    </td>
                    <td><span className={`status-pill tone-${situation?.tone === "good" ? "good" : situation?.tone || "neutral"}`}>{situation?.label || item.situation}</span></td>
                    <td className="inv-warnings">{item.warnings.length ? item.warnings.map((warning) => <small key={warning}>{warning}</small>) : <span className="ct-muted">—</span>}</td>
                  </tr>
                );
              })}
              {!rows.length ? <tr><td colSpan={6} className="ct-empty-row">{data.items.length ? "Nada encontrado com estes filtros." : "Importe a planilha para começar o levantamento."}</td></tr> : null}
            </tbody>
          </table>
        </div>
        {rows.length > 600 ? <p className="inv-note">Mostrando 600 de {rows.length}; use a busca ou exporte o Excel.</p> : null}
      </section>

      {data.noTag.length ? (
        <section className="ct-card">
          <button type="button" className="inv-collapse" aria-expanded={showNoTag} onClick={() => setShowNoTag((value) => !value)}>
            {showNoTag ? "▾" : "▸"} Sem tag no nome ({data.noTag.length}) · {data.noTag.filter((item) => item.virtual).length} máquinas virtuais
          </button>
          {showNoTag ? (
            <div className="ct-table-wrap">
              <table className="ct-table">
                <thead>
                  <tr><th>Nome</th><th>Onde aparece</th><th>Usuário / setor</th><th>Modelo</th><th>Último contato</th></tr>
                </thead>
                <tbody>
                  {data.noTag.map((item) => (
                    <tr key={`${item.where}-${item.name}`} className="inv-row-static">
                      <td><strong className="ct-title">{item.name}</strong>{item.virtual ? <small className="ct-cat">máquina virtual: não é patrimônio físico</small> : null}</td>
                      <td>{item.where}</td>
                      <td>{item.row?.user || item.machine?.user || "—"}</td>
                      <td>{item.row?.model || item.machine?.model || "—"}</td>
                      <td>{item.machine ? ago(item.machine.lastSeen) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
