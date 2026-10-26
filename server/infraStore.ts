import fs from "node:fs/promises";
import path from "node:path";

// Backbones de fibra desenhados no Digital Twin (cena Backbones). Antes ficavam num arquivo do
// projeto InfraVision; aqui ficam em data/infra-backbones.json (volume do container).
// Sem arquivo, o navegador usa o desenho padrao que vem junto com a pagina.

const storePath = path.resolve(process.cwd(), "data", "infra-backbones.json");
let writeQueue: Promise<unknown> = Promise.resolve();

class InfraError extends Error {
  status = 400;
}

type Vec = [number, number, number];
const isVec = (value: unknown): value is Vec => Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 100);
const text = (value: unknown, max: number) => String(value ?? "").slice(0, max);

function validate(input: unknown) {
  const raw = (input && typeof input === "object" ? input : {}) as { nodes?: unknown; links?: unknown };
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.links)) throw new InfraError("Formato invalido: esperado { nodes, links }.");
  if (raw.nodes.length > 300 || raw.links.length > 1000) throw new InfraError("Backbones demais.");
  const nodes = raw.nodes.map((node) => {
    const entry = (node || {}) as Record<string, unknown>;
    if (!isVec(entry.position)) throw new InfraError("Posicao invalida.");
    return {
      id: text(entry.id, 80),
      label: text(entry.label, 80),
      position: entry.position,
      color: /^#[0-9a-f]{3,8}$/i.test(String(entry.color)) ? String(entry.color) : "#22d3ee",
      height: Math.min(Math.max(Number(entry.height) || 0.44, 0.05), 5),
      // Switches do Zabbix da area deste backbone (ids numericos dos hosts).
      hostIds: (Array.isArray(entry.hostIds) ? entry.hostIds : entry.hostId ? [entry.hostId] : [])
        .map(String)
        .filter((id) => /^\d{1,12}$/.test(id))
        .slice(0, 200),
    };
  });
  const links = raw.links.map((link) => {
    const entry = (link || {}) as Record<string, unknown>;
    return entry.type === "rack"
      ? { type: "rack", nodeId: text(entry.nodeId, 80), enabled: Boolean(entry.enabled) }
      : { type: "peer", fromId: text(entry.fromId, 80), toId: text(entry.toId, 80), enabled: Boolean(entry.enabled) };
  });
  return { nodes, links };
}

export async function getBackbones() {
  try {
    return JSON.parse(await fs.readFile(storePath, "utf8")) as unknown;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") return { nodes: [], links: [] };
    throw error;
  }
}

export function saveBackbones(input: unknown) {
  const config = validate(input);
  const task = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, storePath);
    return { ok: true, nodes: config.nodes.length, links: config.links.length };
  });
  writeQueue = task.catch(() => undefined);
  return task;
}
