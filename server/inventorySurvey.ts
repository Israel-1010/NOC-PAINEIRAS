// Levantamento de patrimonio: a planilha feita em campo (maquina a maquina) cruzada com o AD e o Intune,
// uma linha por TAG (numero do patrimonio no nome: N = notebook, D = desktop; N5307N conta como 5307).
// A planilha e lida no navegador do gestor; aqui chegam so as linhas ja organizadas, validadas de novo.

import path from "node:path";
import type { AuthUser } from "./auth";
import { isPortalAdmin } from "./accessStore";
import { dataDir, getInventory, readJson, writeJson, type InventoryMachine } from "./inventory";
import { writeAudit } from "./security";

type SheetRow = { line: number; name: string; model: string; user: string; date: string; status: string; adCheck: string; intuneCheck: string; note: string };
type SheetFile = { fileName: string; sheet: string; importedAt: string; by: string; rows: SheetRow[]; previous: { fileName: string; importedAt: string; by: string; rows: number } | null };

class SurveyError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const sheetPath = path.join(dataDir, "inventory-sheet.json");
const MAX_ROWS = 5000;
const ACTIVE_DAYS = 30;

const readSheet = () => readJson<SheetFile | null>(sheetPath, null);
const clip = (value: unknown, size = 200) => String(value ?? "").trim().slice(0, size);

// "N5307", "n5307n", "D 3759", "N5575/5576" -> tags (numero sem zeros a esquerda) com o prefixo.
export function tagsOf(name: string) {
  const clean = String(name || "").toUpperCase().replace(/\s+/g, "");
  const match = /^([ND])-?0*(\d{3,6})[A-Z]?((?:\/\d{3,6})*)$/.exec(clean);
  if (!match) return [];
  const extra = match[3] ? match[3].split("/").filter(Boolean).map((tag) => tag.replace(/^0+/, "")) : [];
  return [match[2], ...extra].map((tag) => ({ prefix: match[1] as "N" | "D", tag }));
}

export async function importSurveySheet(body: Record<string, unknown>, user?: AuthUser) {
  if (!user || !isPortalAdmin(user.login)) throw new SurveyError("Somente o gestor do portal importa a planilha de levantamento.", 403);
  const rawRows = Array.isArray(body.rows) ? body.rows : [];
  if (!rawRows.length) throw new SurveyError("A planilha não tem linhas com nome de máquina.");
  if (rawRows.length > MAX_ROWS) throw new SurveyError(`A planilha tem ${rawRows.length} linhas; o limite é ${MAX_ROWS}.`);
  const rows: SheetRow[] = rawRows
    .map((raw) => {
      const item = (raw || {}) as Record<string, unknown>;
      return {
        line: Math.max(0, Math.floor(Number(item.line) || 0)),
        name: clip(item.name, 60),
        model: clip(item.model),
        user: clip(item.user),
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || "")) ? String(item.date) : clip(item.date, 20),
        status: clip(item.status, 60),
        adCheck: clip(item.adCheck, 40),
        intuneCheck: clip(item.intuneCheck, 40),
        note: clip(item.note, 300),
      };
    })
    .filter((row) => row.name);
  if (!rows.length) throw new SurveyError("Nenhuma linha com nome de máquina.");
  const current = readSheet();
  const file: SheetFile = {
    fileName: clip(body.fileName, 120) || "planilha.xlsx",
    sheet: clip(body.sheet, 60),
    importedAt: new Date().toISOString(),
    by: user.login,
    rows,
    previous: current ? { fileName: current.fileName, importedAt: current.importedAt, by: current.by, rows: current.rows.length } : null,
  };
  await writeJson(sheetPath, file);
  writeAudit({ event: "levantamento-importado", user: user.login, fileName: file.fileName, sheet: file.sheet, rows: rows.length });
  return { ok: true, rows: rows.length };
}

/* ---------- Cruzamento por tag ---------- */
const SITUATIONS = [
  { code: "confere", label: "Planilha, AD e Intune", tone: "good" },
  { code: "fora-intune", label: "Na planilha e no AD, fora do Intune", tone: "bad" },
  { code: "fora-ad", label: "Na planilha e no Intune, fora do AD", tone: "warn" },
  { code: "so-planilha", label: "Só na planilha", tone: "warn" },
  { code: "fora-planilha", label: "Em uso, fora da planilha", tone: "warn" },
  { code: "fora-planilha-parada", label: "Fora da planilha, sem contato", tone: "neutral" },
  { code: "sem-leitura", label: "Sem leitura do AD ou do Intune", tone: "neutral" },
] as const;
type SituationCode = (typeof SITUATIONS)[number]["code"];

const days = (iso: string) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)) : null);
const says = (value: string, word: RegExp) => word.test(value.toLowerCase());
const isPhysical = (machine: InventoryMachine) => machine.kind === "estacao" || machine.kind === "mac";
const isVirtual = (text: string) => /vmware|virtual|i440fx|qemu|hyper-v/i.test(text);

function machineView(machine: InventoryMachine) {
  return {
    key: machine.key,
    name: machine.name,
    active: machine.active,
    lastSeen: machine.lastSeen,
    serial: machine.serial,
    model: machine.model,
    user: machine.user,
    os: machine.os,
    ad: machine.ad ? { enabled: machine.ad.enabled, lastLogon: machine.ad.lastLogon, ou: machine.ad.ou } : null,
    intune: machine.intune ? { lastSync: machine.intune.lastSync, user: machine.intune.userName || machine.intune.user } : null,
    defender: Boolean(machine.defender),
    milvus: Boolean(machine.milvus),
  };
}

export async function getSurvey() {
  const inventory = await getInventory();
  const sheet = readSheet();
  // Sem planilha nao ha levantamento: tudo apareceria como "fora da planilha".
  if (!sheet) return { checkedAt: inventory.checkedAt, sources: [], sheet: null, situations: SITUATIONS, counts: {}, items: [], noTag: [] };
  const state = (id: string) => inventory.sources.find((source) => source.id === id)?.state;
  const readable = state("ad") === "ok" && state("intune") === "ok";

  const sheetByTag = new Map<string, (SheetRow & { prefix: string })[]>();
  const sheetNoTag: SheetRow[] = [];
  for (const row of sheet?.rows || []) {
    const tags = tagsOf(row.name);
    if (!tags.length) sheetNoTag.push(row);
    for (const { prefix, tag } of tags) sheetByTag.set(tag, [...(sheetByTag.get(tag) || []), { ...row, prefix }]);
  }
  const tiByTag = new Map<string, (InventoryMachine & { prefix: string })[]>();
  const tiNoTag: InventoryMachine[] = [];
  for (const machine of inventory.machines.filter(isPhysical)) {
    const tags = tagsOf(machine.key);
    if (!tags.length) tiNoTag.push(machine);
    for (const { prefix, tag } of tags) tiByTag.set(tag, [...(tiByTag.get(tag) || []), { ...machine, prefix }]);
  }

  const tags = [...new Set([...sheetByTag.keys(), ...tiByTag.keys()])].sort((a, b) => Number(a) - Number(b));
  const items = tags.map((tag) => {
    const rows = sheetByTag.get(tag) || [];
    // O nome visto por ultimo e o principal; os outros sao registros antigos da mesma tag.
    const machines = (tiByTag.get(tag) || []).sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
    const inAd = machines.some((machine) => machine.ad);
    const inIntune = machines.some((machine) => machine.intune);
    const active = machines.some((machine) => machine.active);
    let situation: SituationCode;
    if (!readable) situation = "sem-leitura";
    else if (rows.length) situation = inAd && inIntune ? "confere" : inAd ? "fora-intune" : inIntune ? "fora-ad" : "so-planilha";
    else situation = active ? "fora-planilha" : "fora-planilha-parada";

    const warnings: string[] = [];
    const prefixes = new Set([...rows, ...machines].map((item) => item.prefix));
    if (prefixes.size > 1) warnings.push("Mesma tag como notebook (N) e desktop (D)");
    if (rows.length > 1) {
      const models = new Set(rows.map((row) => row.model.toLowerCase()));
      warnings.push(models.size > 1
        ? `${rows.length} equipamentos diferentes com a mesma tag na planilha (linhas ${rows.map((row) => row.line).join(", ")})`
        : `Linha repetida na planilha (linhas ${rows.map((row) => row.line).join(", ")})`);
    }
    if (rows.some((row) => row.name.includes("/"))) warnings.push(`Linha da planilha com 2 tags (${rows.find((row) => row.name.includes("/"))!.name})`);
    if (machines.length > 1) warnings.push(`${machines.length} nomes na rede: ${machines.map((machine) => machine.key).join(", ")}`);
    const main = machines[0];
    if (rows.length && main && !main.active) warnings.push(`Sem contato com a TI há ${days(main.lastSeen) ?? "?"} dias`);
    if (machines.some((machine) => machine.ad && !machine.ad.enabled)) warnings.push("Conta desativada no AD");
    if (machines.some((machine) => machine.intune && (days(machine.intune.lastSync) ?? 0) > ACTIVE_DAYS)) warnings.push("Intune sem sincronizar há mais de 30 dias");
    // O que a planilha marcou em campo x o que o AD e o Intune mostram hoje.
    const row = rows[0];
    if (row && readable) {
      if (row.adCheck && says(row.adCheck, /ok|sim/) && !inAd) warnings.push("O levantamento marcou AD ok; hoje não está no AD");
      if (row.adCheck && says(row.adCheck, /fora|n[aã]o/) && inAd) warnings.push("O levantamento marcou fora do AD; hoje está no AD");
      if (row.intuneCheck && says(row.intuneCheck, /ok|sim/) && !inIntune) warnings.push("O levantamento marcou Intune ok; hoje não está no Intune");
      if (row.intuneCheck && says(row.intuneCheck, /fora|n[aã]o/) && inIntune) warnings.push("O levantamento marcou fora do Intune; hoje está no Intune");
    }
    if (!inAd && !inIntune && machines.some((machine) => machine.defender || machine.milvus)) warnings.push(`Visto só ${[machines.some((machine) => machine.defender) && "no Defender", machines.some((machine) => machine.milvus) && "no Milvus"].filter(Boolean).join(" e ")}`);

    return {
      tag,
      type: prefixes.size > 1 ? "N/D" : prefixes.has("N") ? "N" : "D",
      situation,
      sheet: rows.map(({ prefix: _prefix, ...rest }) => rest),
      machines: machines.map(machineView),
      warnings,
    };
  });

  // Sem tag no nome: da planilha (maquinas virtuais, nomes fora do padrao) e da TI em uso.
  const byKey = new Map(inventory.machines.map((machine) => [machine.key, machine]));
  const noTag = [
    ...sheetNoTag.map((row) => {
      const machine = byKey.get(row.name.split(".")[0].trim().toUpperCase().slice(0, 15));
      return { name: row.name, where: machine ? "planilha e rede" : "só planilha", virtual: isVirtual(row.model), row, machine: machine ? machineView(machine) : null };
    }),
    ...tiNoTag
      .filter((machine) => machine.active && !sheetNoTag.some((row) => row.name.toUpperCase().slice(0, 15) === machine.key))
      .map((machine) => ({ name: machine.name, where: "só rede (em uso)", virtual: isVirtual(machine.model) || /^V-|VIRTUAL/i.test(machine.key), row: null, machine: machineView(machine) })),
  ];

  const counts: Partial<Record<SituationCode, number>> = {};
  for (const item of items) counts[item.situation] = (counts[item.situation] || 0) + 1;
  return {
    checkedAt: inventory.checkedAt,
    sources: inventory.sources.filter((source) => source.id === "ad" || source.id === "intune"),
    sheet: sheet ? { fileName: sheet.fileName, sheet: sheet.sheet, importedAt: sheet.importedAt, by: sheet.by, rows: sheet.rows.length, previous: sheet.previous } : null,
    situations: SITUATIONS,
    counts,
    items,
    noTag,
  };
}
