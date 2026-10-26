import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { AuthUser } from "./auth";

// Contratos de fornecedores da TI. Guardados em data/contracts.json (volume do container);
// anexos (PDF do contrato, aditivos) em data/contract-files/<contrato>/.
// Na primeira vez o arquivo nasce com os contratos da lista do SharePoint "Contratos de Fornecedores".

export type ContractAttachment = { id: string; name: string; mimeType: string; size: number; at: string; by: string };
export type Contract = {
  id: string;
  title: string;
  supplier: string;
  category: string;
  monthlyValue: number | null;
  dueDay: number | null;
  startDate: string; // AAAA-MM-DD ou ""
  endDate: string;
  active: boolean;
  totalValue: number | null;
  notes: string;
  attachments: ContractAttachment[];
  updatedAt: string;
  updatedBy: string;
};

export const CONTRACT_CATEGORIES = ["Link de internet", "Consultoria", "Software / SaaS", "Nuvem", "Telefonia", "Outro"];

class ContractError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "contracts.json");
const filesDir = path.join(dataDir, "contract-files");
let writeQueue: Promise<unknown> = Promise.resolve();

const allowedFiles: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/msword": ".doc",
};
const maxFileBytes = 8 * 1024 * 1024;

type Seed = [title: string, supplier: string, category: string, monthly: number | null, dueDay: number | null, start: string, end: string, total: number | null];
const seed: Seed[] = [
  ["PASQUALI - CONSULTORIA PROGRAMADORES", "PASQUALI", "Consultoria", 12000, 10, "2025-12-01", "2026-08-01", 96000],
  ["PRIME DB SOLUTIONS - CONSULTORIA ORACLE", "PRIME DB SOLUTIONS", "Consultoria", 4947.24, 15, "2025-08-01", "2026-08-01", 57868.92],
  ["SISTEMA DE CONTROLE DE VISITANTES", "GOVISIT", "Software / SaaS", 3800, 15, "2025-12-01", "2026-12-01", 45000],
  ["SISTEMA DE BACKUP 365 (PWS CLOUD)", "INOVTI SOLUÇÕES", "Software / SaaS", 4247.71, 10, "2025-07-17", "2026-07-17", 50972.52],
  ["LINK DE INTERNET WCS 1GB", "WCS", "Link de internet", 2499.91, 10, "2023-10-25", "2026-10-28", 89996.76],
  ["CONSULTORIA SUSTENTAÇÃO FORTINET", "DUAL TI", "Consultoria", 1600, 15, "2025-12-01", "2026-11-30", 19200],
  ["LINK INTERNET 2GB", "TELIUM", "Link de internet", 3800, 15, "2024-08-20", "2027-08-20", 136800],
  ["TELEFONIA VOIP", "UC TECNOLOGY (CX TEC)", "Telefonia", 9900, 15, "2026-01-01", "2026-12-01", 118800],
  ["LINK INTERNET 2GB", "HOSTFIBER", "Link de internet", 2926, 28, "2024-08-01", "2027-07-31", 105336],
  ["CHATGPT", "OPENAI", "Software / SaaS", 114.6, 1, "2025-07-01", "", null],
  ["ENVIO SMS", "ZENVIA", "Software / SaaS", 219.8, 20, "", "", null],
  ["PASQUALI - CONSULTORIA ANALISTA DE SISTEMAS", "PASQUALI", "Consultoria", 20800, 10, "2026-07-01", "2027-02-01", 166400],
  ["ORACLE CLOUD", "ORACLE CLOUD", "Nuvem", 37806.49, null, "2026-05-01", "2027-05-01", 151225.95],
];

function seedContracts(): Contract[] {
  const at = new Date().toISOString();
  return seed.map(([title, supplier, category, monthlyValue, dueDay, startDate, endDate, totalValue]) => ({
    id: crypto.randomUUID().slice(0, 12),
    title, supplier, category, monthlyValue, dueDay, startDate, endDate, active: true, totalValue,
    notes: "", attachments: [], updatedAt: at, updatedBy: "importado da lista do SharePoint",
  }));
}

function loadSync(): Contract[] {
  try {
    const raw = JSON.parse(fsSync.readFileSync(storePath, "utf8")) as { contracts?: Contract[] };
    return Array.isArray(raw.contracts) ? raw.contracts : [];
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code !== "ENOENT") throw error;
    // Grava a carga inicial na hora: os ids ficam fixos desde o primeiro acesso.
    const contracts = seedContracts();
    fsSync.mkdirSync(dataDir, { recursive: true });
    fsSync.writeFileSync(storePath, `${JSON.stringify({ contracts }, null, 2)}\n`, "utf8");
    return contracts;
  }
}

let cache: Contract[] = loadSync();

function mutate<T>(change: (contracts: Contract[]) => T) {
  const task = writeQueue.then(async () => {
    const draft: Contract[] = JSON.parse(JSON.stringify(cache));
    const result = change(draft);
    await fs.mkdir(dataDir, { recursive: true });
    const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify({ contracts: draft }, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, storePath);
    cache = draft;
    return result;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

const text = (value: unknown, max: number) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);

function money(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  // Aceita 12000, "12000.5" e "12.000,50".
  const raw = typeof value === "number" ? value : Number(String(value).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (!Number.isFinite(raw) || raw < 0 || raw > 1e9) throw new ContractError("Valor inválido.");
  return Math.round(raw * 100) / 100;
}

function date(value: unknown, label: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) throw new ContractError(`${label} inválida.`);
  return raw;
}

function validate(input: Record<string, unknown>, current?: Contract) {
  const merged: Record<string, unknown> = { ...current, ...input };
  const title = text(merged.title, 120);
  if (!title) throw new ContractError("Informe o título do contrato.");
  const dueRaw = merged.dueDay === "" || merged.dueDay === null || merged.dueDay === undefined ? null : Number(merged.dueDay);
  if (dueRaw !== null && (!Number.isInteger(dueRaw) || dueRaw < 1 || dueRaw > 31)) throw new ContractError("Dia do vencimento deve ser de 1 a 31.");
  const startDate = date(merged.startDate, "Data de início");
  const endDate = date(merged.endDate, "Data de término");
  if (startDate && endDate && endDate < startDate) throw new ContractError("A data de término é anterior ao início.");
  const category = CONTRACT_CATEGORIES.includes(String(merged.category)) ? String(merged.category) : "Outro";
  return {
    title,
    supplier: text(merged.supplier, 80),
    category,
    monthlyValue: money(merged.monthlyValue),
    dueDay: dueRaw,
    startDate,
    endDate,
    active: merged.active === undefined ? true : Boolean(merged.active),
    totalValue: money(merged.totalValue),
    notes: String(merged.notes ?? "").trim().slice(0, 2000),
  };
}

export function listContracts() {
  return { contracts: cache, categories: CONTRACT_CATEGORIES };
}

export function createContract(input: Record<string, unknown>, by: AuthUser) {
  const fields = validate(input);
  return mutate((contracts) => {
    const contract: Contract = { id: crypto.randomUUID().slice(0, 12), ...fields, attachments: [], updatedAt: new Date().toISOString(), updatedBy: by.login };
    contracts.push(contract);
    return contract;
  });
}

function find(contracts: Contract[], id: string) {
  const contract = contracts.find((entry) => entry.id === id);
  if (!contract) throw new ContractError("Contrato não encontrado.", 404);
  return contract;
}

export function updateContract(id: string, input: Record<string, unknown>, by: AuthUser) {
  const fields = validate(input, find(cache, id));
  return mutate((contracts) => Object.assign(find(contracts, id), fields, { updatedAt: new Date().toISOString(), updatedBy: by.login }));
}

const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "");
const filePath = (contractId: string, file: ContractAttachment) => path.join(filesDir, safeId(contractId), `${safeId(file.id)}${allowedFiles[file.mimeType] || ".bin"}`);

export async function deleteContract(id: string) {
  const removed = await mutate((contracts) => {
    const contract = find(contracts, id);
    contracts.splice(contracts.indexOf(contract), 1);
    return contract;
  });
  await fs.rm(path.join(filesDir, safeId(id)), { recursive: true, force: true });
  return { ok: true, title: removed.title };
}

export async function addAttachment(id: string, input: unknown, by: AuthUser) {
  const source = (input && typeof input === "object" ? input : {}) as { name?: unknown; mimeType?: unknown; data?: unknown };
  const mimeType = String(source.mimeType || "");
  if (!allowedFiles[mimeType]) throw new ContractError("Envie PDF, Word, Excel, JPG ou PNG.");
  const content = Buffer.from(String(source.data || "").replace(/^data:[^,]+,/, ""), "base64");
  if (!content.length) throw new ContractError("Arquivo vazio.");
  if (content.length > maxFileBytes) throw new ContractError("Arquivo muito grande (máximo 8 MB).");
  if (find(cache, id).attachments.length >= 30) throw new ContractError("Limite de 30 anexos por contrato.");
  const file: ContractAttachment = {
    id: crypto.randomUUID().slice(0, 12),
    name: text(source.name, 140) || `anexo${allowedFiles[mimeType]}`,
    mimeType,
    size: content.length,
    at: new Date().toISOString(),
    by: by.login,
  };
  const target = filePath(id, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
  return mutate((contracts) => {
    const contract = find(contracts, id);
    contract.attachments.push(file);
    return contract;
  });
}

export async function readAttachment(id: string, fileId: string) {
  const file = find(cache, id).attachments.find((entry) => entry.id === fileId);
  if (!file) throw new ContractError("Anexo não encontrado.", 404);
  return { file, content: await fs.readFile(filePath(id, file)) };
}

export async function removeAttachment(id: string, fileId: string) {
  const { contract, file } = await mutate((contracts) => {
    const contract = find(contracts, id);
    const file = contract.attachments.find((entry) => entry.id === fileId);
    if (!file) throw new ContractError("Anexo não encontrado.", 404);
    contract.attachments = contract.attachments.filter((entry) => entry.id !== fileId);
    return { contract, file };
  });
  await fs.rm(filePath(id, file), { force: true });
  return contract;
}
