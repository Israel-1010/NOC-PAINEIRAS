import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AuthUser } from "./auth";

export const taskStatuses = ["a_fazer", "em_andamento", "revisao", "bloqueado", "concluido"] as const;
export const taskPriorities = ["urgente", "alta", "normal", "baixa"] as const;

export type TaskStatus = (typeof taskStatuses)[number];
export type TaskPriority = (typeof taskPriorities)[number];

export type SpaceMember = { login: string; name: string };

export type ProjectSpace = {
  id: string;
  name: string;
  description: string;
  color: string;
  archived: boolean;
  members: SpaceMember[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export const checklistStates = ["pendente", "em_andamento", "pausado", "concluido"] as const;
export type ChecklistState = (typeof checklistStates)[number];

// Cada intervalo trabalhado (Iniciar -> Pausar/Finalizar), com quem trabalhou.
export type WorkSession = { login: string; name: string; start: string; end: string; ms: number };

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  state: ChecklistState;
  // Horas ja fechadas; o intervalo em curso fica em runningSince/runningBy.
  elapsedMs: number;
  runningSince: string;
  runningBy: string;
  runningByName: string;
  sessions: WorkSession[];
  completedAt: string;
  completedBy: string;
};

export type TaskComment = { id: string; author: string; authorName: string; text: string; at: string };

export type ProjectTask = {
  id: string;
  spaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  assigneeName: string;
  startDate: string;
  dueDate: string;
  tags: string[];
  checklist: ChecklistItem[];
  comments: TaskComment[];
  order: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  // Datas reais (automaticas): primeiro "Iniciar" e conclusao da tarefa.
  startedAt: string;
  completedAt: string;
};

type ProjectStore = { spaces: ProjectSpace[]; tasks: ProjectTask[] };

// Primeiro registro de trabalho no checklist (para tarefas criadas antes do campo startedAt).
function firstWorkAt(checklist: ChecklistItem[]) {
  let first = "";
  for (const item of checklist) {
    const candidates = [item.runningSince, ...item.sessions.map((session) => session.start)].filter(Boolean);
    for (const value of candidates) if (!first || value < first) first = value;
  }
  return first;
}

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "projects.json");
const spaceColors = ["#e01783", "#021d49", "#2e63d6", "#12936a", "#e0931f", "#7c3aed", "#d02b3f", "#0891b2"];
let writeQueue: Promise<unknown> = Promise.resolve();

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isoDate(value: unknown) {
  const raw = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function color(value: unknown, fallback: string) {
  const raw = text(value, 7).toLowerCase();
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : fallback;
}

function oneOf<T extends string>(value: unknown, list: readonly T[], fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

function normalizeMembers(input: unknown): SpaceMember[] {
  if (!Array.isArray(input)) return [];
  const byLogin = new Map<string, SpaceMember>();
  for (const item of input.slice(0, 200)) {
    const source = (item && typeof item === "object" ? item : {}) as Partial<SpaceMember>;
    const login = text(source.login, 120);
    if (login) byLogin.set(login.toLowerCase(), { login, name: text(source.name, 160) || login });
  }
  return Array.from(byLogin.values());
}

function normalizeSpace(input: unknown, index = 0): ProjectSpace {
  const source = (input && typeof input === "object" ? input : {}) as Partial<ProjectSpace>;
  const now = new Date().toISOString();
  return {
    id: text(source.id, 40) || makeId("esp"),
    name: text(source.name, 80) || "Novo espaço",
    description: text(source.description, 500),
    color: color(source.color, spaceColors[index % spaceColors.length]),
    archived: source.archived === true,
    members: normalizeMembers(source.members),
    createdBy: text(source.createdBy, 120),
    createdAt: text(source.createdAt, 30) || now,
    updatedAt: text(source.updatedAt, 30) || now,
  };
}

function normalizeSessions(input: unknown): WorkSession[] {
  if (!Array.isArray(input)) return [];
  return input.slice(-1000).map((item) => {
    const source = (item && typeof item === "object" ? item : {}) as Partial<WorkSession>;
    return {
      login: text(source.login, 120),
      name: text(source.name, 160),
      start: text(source.start, 30),
      end: text(source.end, 30),
      ms: Math.max(0, Number(source.ms) || 0),
    };
  }).filter((session) => session.start && session.end);
}

function normalizeChecklistItem(input: unknown): ChecklistItem {
  const source = (input && typeof input === "object" ? input : {}) as Partial<ChecklistItem>;
  // Itens antigos so tinham "done".
  const state = checklistStates.includes(source.state as ChecklistState)
    ? (source.state as ChecklistState)
    : source.done === true ? "concluido" : "pendente";
  const running = state === "em_andamento" ? text(source.runningSince, 30) : "";
  return {
    id: text(source.id, 40) || makeId("chk"),
    text: text(source.text, 300),
    done: state === "concluido",
    state: state === "em_andamento" && !running ? "pausado" : state,
    elapsedMs: Math.max(0, Number(source.elapsedMs) || 0),
    runningSince: running,
    runningBy: running ? text(source.runningBy, 120) : "",
    runningByName: running ? text(source.runningByName, 160) : "",
    sessions: normalizeSessions(source.sessions),
    completedAt: state === "concluido" ? text(source.completedAt, 30) : "",
    completedBy: state === "concluido" ? text(source.completedBy, 120) : "",
  };
}

function normalizeChecklist(input: unknown): ChecklistItem[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 100).map(normalizeChecklistItem).filter((item) => item.text);
}

// Do cliente so aceitamos texto, ordem, inclusao e remocao de itens.
// Estado e horas so mudam pelas acoes Iniciar/Pausar/Finalizar (horario do servidor).
function mergeClientChecklist(current: ChecklistItem[], incoming: unknown): ChecklistItem[] {
  if (!Array.isArray(incoming)) return current;
  const byId = new Map(current.map((item) => [item.id, item]));
  return incoming.slice(0, 100).map((raw) => {
    const source = (raw && typeof raw === "object" ? raw : {}) as Partial<ChecklistItem>;
    const existing = source.id ? byId.get(String(source.id)) : undefined;
    const label = text(source.text, 300);
    if (existing) return { ...existing, text: label || existing.text };
    return normalizeChecklistItem({ id: source.id, text: label });
  }).filter((item) => item.text);
}

function normalizeComments(input: unknown): TaskComment[] {
  if (!Array.isArray(input)) return [];
  return input.slice(-500).map((item) => {
    const source = (item && typeof item === "object" ? item : {}) as Partial<TaskComment>;
    return {
      id: text(source.id, 40) || makeId("com"),
      author: text(source.author, 120),
      authorName: text(source.authorName, 160),
      text: text(source.text, 4000),
      at: text(source.at, 30) || new Date().toISOString(),
    };
  }).filter((item) => item.text);
}

function normalizeTags(input: unknown) {
  if (!Array.isArray(input)) return [];
  const tags = input.map((tag) => text(tag, 30).toLowerCase()).filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 12);
}

function normalizeTask(input: unknown): ProjectTask {
  const source = (input && typeof input === "object" ? input : {}) as Partial<ProjectTask>;
  const now = new Date().toISOString();
  const status = oneOf(source.status, taskStatuses, "a_fazer");
  const checklist = normalizeChecklist(source.checklist);
  const completedAt = status === "concluido" ? text(source.completedAt, 30) || now : "";
  const startedAt = text(source.startedAt, 30) || firstWorkAt(checklist) || (status !== "a_fazer" ? completedAt : "");
  return {
    id: text(source.id, 40) || makeId("tar"),
    spaceId: text(source.spaceId, 40),
    title: text(source.title, 200) || "Nova tarefa",
    description: text(source.description, 10000),
    status,
    priority: oneOf(source.priority, taskPriorities, "normal"),
    assignee: text(source.assignee, 120),
    assigneeName: text(source.assigneeName, 160),
    startDate: isoDate(source.startDate),
    dueDate: isoDate(source.dueDate),
    tags: normalizeTags(source.tags),
    checklist,
    comments: normalizeComments(source.comments),
    order: Number.isFinite(Number(source.order)) ? Number(source.order) : Date.now(),
    createdBy: text(source.createdBy, 120),
    createdByName: text(source.createdByName, 160),
    createdAt: text(source.createdAt, 30) || now,
    updatedAt: text(source.updatedAt, 30) || now,
    startedAt,
    completedAt,
  };
}

function seedStore(): ProjectStore {
  const now = new Date().toISOString();
  const space = normalizeSpace({ id: "esp-infra", name: "Infraestrutura", description: "Projetos de rede, servidores e datacenter.", color: "#021d49", createdAt: now });
  return {
    spaces: [
      space,
      normalizeSpace({ id: "esp-suporte", name: "Suporte e Sistemas", description: "Melhorias de atendimento e sistemas internos.", color: "#e01783", createdAt: now }, 1),
    ],
    tasks: [
      normalizeTask({
        spaceId: space.id,
        title: "Exemplo: mapear switches do prédio social",
        description: "Tarefa de exemplo. Pode editar ou excluir.",
        status: "em_andamento",
        priority: "alta",
        tags: ["rede"],
        checklist: [{ text: "Levantar modelos e IPs", done: true }, { text: "Cadastrar no SNMP", done: false }],
        createdBy: "sistema",
        createdByName: "Sistema",
      }),
    ],
  };
}

async function readStore(): Promise<ProjectStore> {
  try {
    const raw = JSON.parse(await fs.readFile(storePath, "utf8")) as Partial<ProjectStore>;
    return {
      spaces: Array.isArray(raw.spaces) ? raw.spaces.map(normalizeSpace) : [],
      tasks: Array.isArray(raw.tasks) ? raw.tasks.map(normalizeTask) : [],
    };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code !== "ENOENT") throw error;
    const seed = seedStore();
    await writeStore(seed);
    return seed;
  }
}

async function writeStore(store: ProjectStore) {
  await fs.mkdir(dataDir, { recursive: true });
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, storePath);
}

// Leitura-alteracao-escrita serializada: duas pessoas editando ao mesmo tempo nao perdem alteracoes.
function mutate<T>(change: (store: ProjectStore) => T) {
  const task = writeQueue.then(async () => {
    const store = await readStore();
    const result = change(store);
    await writeStore(store);
    return result;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

export class ProjectAccessError extends Error {
  status = 403;
}

class NotFoundError extends Error {
  status = 404;
}

// Quem esta pedindo e se e gestor (enxerga e administra todos os projetos).
export type ProjectAccess = { user: AuthUser; isAdmin: boolean };

function sameLogin(a: string, b: string) {
  return Boolean(a) && a.toLowerCase() === b.toLowerCase();
}

function isMember(space: ProjectSpace, login: string) {
  return space.members.some((member) => sameLogin(member.login, login));
}

function canManageSpace(space: ProjectSpace, access: ProjectAccess) {
  return access.isAdmin || sameLogin(space.createdBy, access.user.login);
}

function canSeeSpace(space: ProjectSpace, access: ProjectAccess) {
  return canManageSpace(space, access) || isMember(space, access.user.login);
}

function canSeeTask(store: ProjectStore, task: ProjectTask, access: ProjectAccess) {
  if (sameLogin(task.assignee, access.user.login)) return true;
  const space = store.spaces.find((item) => item.id === task.spaceId);
  return Boolean(space && canSeeSpace(space, access));
}

function findSpace(store: ProjectStore, id: string) {
  const space = store.spaces.find((item) => item.id === id);
  if (!space) throw new NotFoundError("Projeto nao encontrado.");
  return space;
}

function findTask(store: ProjectStore, id: string, access: ProjectAccess) {
  const task = store.tasks.find((item) => item.id === id);
  // Tarefa de projeto alheio responde como inexistente (nao revela que existe).
  if (!task || !canSeeTask(store, task, access)) throw new NotFoundError("Tarefa nao encontrada.");
  return task;
}

// Responsavel vira membro do projeto, para enxergar o projeto quando logar.
function ensureMember(store: ProjectStore, spaceId: string, login: string, name: string) {
  if (!login) return;
  const space = store.spaces.find((item) => item.id === spaceId);
  if (space && !isMember(space, login)) space.members.push({ login, name: name || login });
}

export function getProjects(access: ProjectAccess) {
  const task = writeQueue.then(async () => {
    const store = await readStore();
    const tasks = store.tasks.filter((item) => canSeeTask(store, item, access));
    const spaceIds = new Set(tasks.map((item) => item.spaceId));
    const spaces = store.spaces.filter((space) => canSeeSpace(space, access) || spaceIds.has(space.id));
    return {
      spaces: spaces.map((space) => ({ ...space, canManage: canManageSpace(space, access) })),
      tasks,
      me: { login: access.user.login, name: access.user.name, isAdmin: access.isAdmin },
    };
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

export function createSpace(input: unknown, access: ProjectAccess) {
  if (!access.isAdmin) throw new ProjectAccessError("Somente gestores podem criar projetos.");
  return mutate((store) => {
    const source = (input && typeof input === "object" ? input : {}) as Partial<ProjectSpace>;
    const space = normalizeSpace({ ...source, id: undefined, createdBy: access.user.login }, store.spaces.length);
    store.spaces.push(space);
    return space;
  });
}

export function updateSpace(id: string, input: unknown, access: ProjectAccess) {
  return mutate((store) => {
    const current = findSpace(store, id);
    if (!canManageSpace(current, access)) throw new ProjectAccessError("Voce nao gerencia este projeto.");
    const source = (input && typeof input === "object" ? input : {}) as Partial<ProjectSpace>;
    const next = normalizeSpace({
      ...current,
      name: source.name ?? current.name,
      description: source.description ?? current.description,
      color: source.color ?? current.color,
      archived: source.archived ?? current.archived,
      members: source.members ?? current.members,
      updatedAt: new Date().toISOString(),
    });
    store.spaces = store.spaces.map((space) => (space.id === id ? next : space));
    return next;
  });
}

export function deleteSpace(id: string, access: ProjectAccess) {
  return mutate((store) => {
    const space = findSpace(store, id);
    if (!canManageSpace(space, access)) throw new ProjectAccessError("Voce nao gerencia este projeto.");
    const removedTasks = store.tasks.filter((task) => task.spaceId === id).length;
    store.spaces = store.spaces.filter((item) => item.id !== id);
    store.tasks = store.tasks.filter((task) => task.spaceId !== id);
    return { ok: true, removedTasks };
  });
}

export function createTask(input: unknown, access: ProjectAccess) {
  return mutate((store) => {
    const source = (input && typeof input === "object" ? input : {}) as Partial<ProjectTask>;
    const space = store.spaces.find((item) => item.id === source.spaceId);
    if (!space || !canSeeSpace(space, access)) {
      throw new ProjectAccessError("Escolha um projeto do qual voce participa.");
    }
    const task = normalizeTask({
      ...source,
      id: undefined,
      comments: [],
      checklist: mergeClientChecklist([], source.checklist),
      // Datas reais sao sempre do servidor.
      startedAt: source.status && source.status !== "a_fazer" ? new Date().toISOString() : "",
      completedAt: undefined,
      createdBy: access.user.login,
      createdByName: access.user.name,
      createdAt: undefined,
      updatedAt: undefined,
      order: Date.now(),
    });
    ensureMember(store, task.spaceId, task.assignee, task.assigneeName);
    store.tasks.push(task);
    return task;
  });
}

const editableTaskFields = [
  "spaceId", "title", "description", "status", "priority", "assignee", "assigneeName",
  "startDate", "dueDate", "tags", "checklist", "order",
] as const;

export function updateTask(id: string, input: unknown, access: ProjectAccess) {
  return mutate((store) => {
    const current = findTask(store, id, access);
    const source = (input && typeof input === "object" ? input : {}) as Partial<ProjectTask>;
    const patch: Partial<ProjectTask> = {};
    for (const field of editableTaskFields) {
      if (field in source) (patch as Record<string, unknown>)[field] = source[field];
    }
    // Valor invalido em campo de lista fechada e ignorado (mantem o atual).
    if ("status" in patch && !taskStatuses.includes(patch.status as TaskStatus)) delete patch.status;
    if ("priority" in patch && !taskPriorities.includes(patch.priority as TaskPriority)) delete patch.priority;
    if ("checklist" in patch) patch.checklist = mergeClientChecklist(current.checklist, patch.checklist);
    if (patch.spaceId && patch.spaceId !== current.spaceId) {
      const target = store.spaces.find((space) => space.id === patch.spaceId);
      if (!target || !canSeeSpace(target, access)) throw new ProjectAccessError("Voce nao participa do projeto de destino.");
    }
    const nextStatus = patch.status ?? current.status;
    const stamp = new Date().toISOString();
    const next = normalizeTask({
      ...current,
      ...patch,
      updatedAt: stamp,
      // Saiu de "A fazer" pela primeira vez: registra o inicio real.
      startedAt: current.startedAt || (nextStatus !== "a_fazer" ? stamp : ""),
      completedAt: nextStatus === "concluido" ? current.completedAt || stamp : "",
    });
    ensureMember(store, next.spaceId, next.assignee, next.assigneeName);
    store.tasks = store.tasks.map((task) => (task.id === id ? next : task));
    return next;
  });
}

export function deleteTask(id: string, access: ProjectAccess) {
  return mutate((store) => {
    const task = findTask(store, id, access);
    const space = store.spaces.find((item) => item.id === task.spaceId);
    const allowed = sameLogin(task.createdBy, access.user.login) || Boolean(space && canManageSpace(space, access));
    if (!allowed) throw new ProjectAccessError("Somente quem criou a tarefa ou o gestor do projeto pode exclui-la.");
    store.tasks = store.tasks.filter((item) => item.id !== id);
    return { ok: true };
  });
}

export function addTaskComment(id: string, input: unknown, access: ProjectAccess) {
  return mutate((store) => {
    const task = findTask(store, id, access);
    const body = text((input as { text?: unknown } | null)?.text, 4000);
    if (!body) throw new Error("Escreva o comentario.");
    const comment: TaskComment = { id: makeId("com"), author: access.user.login, authorName: access.user.name, text: body, at: new Date().toISOString() };
    task.comments.push(comment);
    task.updatedAt = comment.at;
    return task;
  });
}

/* ---------- Cronometro dos itens do checklist ---------- */

export const checklistActions = ["start", "pause", "finish", "reopen"] as const;
export type ChecklistAction = (typeof checklistActions)[number];

// Fecha o intervalo em curso e soma as horas no item.
function closeRunning(item: ChecklistItem, now: Date) {
  if (item.state !== "em_andamento" || !item.runningSince) return;
  const started = new Date(item.runningSince);
  const ms = Math.max(0, now.getTime() - started.getTime());
  item.elapsedMs += ms;
  item.sessions.push({ login: item.runningBy, name: item.runningByName, start: item.runningSince, end: now.toISOString(), ms });
  item.runningSince = "";
  item.runningBy = "";
  item.runningByName = "";
}

function touchTask(task: ProjectTask, now: Date) {
  task.updatedAt = now.toISOString();
}

export function checklistAction(taskId: string, itemId: string, action: string, access: ProjectAccess) {
  if (!checklistActions.includes(action as ChecklistAction)) throw new Error("Acao invalida.");
  return mutate((store) => {
    const task = findTask(store, taskId, access);
    const item = task.checklist.find((entry) => entry.id === itemId);
    if (!item) throw new NotFoundError("Item do checklist nao encontrado.");
    const now = new Date();
    const pausedElsewhere: string[] = [];

    if (action === "start") {
      if (item.state === "concluido") throw new Error("Item ja finalizado. Reabra antes de iniciar.");
      if (item.state === "em_andamento") return { task, pausedElsewhere };

      // Um cronometro por pessoa: pausa o que esta rodando em outro item.
      for (const other of store.tasks) {
        for (const entry of other.checklist) {
          if (entry !== item && entry.state === "em_andamento" && sameLogin(entry.runningBy, access.user.login)) {
            closeRunning(entry, now);
            entry.state = "pausado";
            touchTask(other, now);
            pausedElsewhere.push(other.id);
          }
        }
      }

      item.state = "em_andamento";
      item.done = false;
      item.runningSince = now.toISOString();
      item.runningBy = access.user.login;
      item.runningByName = access.user.name || access.user.login;
      // Primeiro item iniciado coloca a tarefa (e portanto o projeto) em andamento.
      if (task.status === "a_fazer") task.status = "em_andamento";
      if (!task.startedAt) task.startedAt = now.toISOString();
    }

    if (action === "pause") {
      if (item.state !== "em_andamento") return { task, pausedElsewhere };
      closeRunning(item, now);
      item.state = "pausado";
    }

    if (action === "finish") {
      closeRunning(item, now);
      item.state = "concluido";
      item.done = true;
      item.completedAt = now.toISOString();
      item.completedBy = access.user.login;
      if (task.status === "a_fazer") task.status = "em_andamento";
      if (!task.startedAt) task.startedAt = now.toISOString();
      // Todos os itens finalizados: tarefa concluida.
      if (task.checklist.every((entry) => entry.state === "concluido")) {
        task.status = "concluido";
        task.completedAt = now.toISOString();
      }
    }

    if (action === "reopen") {
      if (item.state !== "concluido") return { task, pausedElsewhere };
      item.state = item.elapsedMs > 0 ? "pausado" : "pendente";
      item.done = false;
      item.completedAt = "";
      item.completedBy = "";
      if (task.status === "concluido") {
        task.status = "em_andamento";
        task.completedAt = "";
      }
    }

    touchTask(task, now);
    return { task, pausedElsewhere };
  });
}