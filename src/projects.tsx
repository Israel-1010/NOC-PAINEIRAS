import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  Clock,
  Pause,
  Play,
  RotateCcw,
  Check,
  Flag,
  FolderKanban,
  Kanban,
  LayoutList,
  ListChecks,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";

/* ---------- Tipos (espelham server/projectStore.ts) ---------- */

type TaskStatus = "a_fazer" | "em_andamento" | "revisao" | "bloqueado" | "concluido";
type TaskPriority = "urgente" | "alta" | "normal" | "baixa";

type SpaceMember = { login: string; name: string };

type ProjectSpace = {
  id: string;
  name: string;
  description: string;
  color: string;
  archived: boolean;
  members: SpaceMember[];
  canManage: boolean;
};

type TeamMember = { login: string; name: string; mail: string; title: string; department: string };

type ChecklistState = "pendente" | "em_andamento" | "pausado" | "concluido";
type WorkSession = { login: string; name: string; start: string; end: string; ms: number };
type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  state: ChecklistState;
  elapsedMs: number;
  runningSince: string;
  runningBy: string;
  runningByName: string;
  sessions: WorkSession[];
  completedAt: string;
  completedBy: string;
};
type ChecklistAction = "start" | "pause" | "finish" | "reopen";
type TaskComment = { id: string; author: string; authorName: string; text: string; at: string };

type ProjectTask = {
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
  completedAt: string;
};

type ProjectsData = { spaces: ProjectSpace[]; tasks: ProjectTask[]; me?: { login: string; name: string; isAdmin: boolean } };
type CurrentUser = { login: string; name: string };
type SpaceFilter = "all" | "mine" | string;
type ViewMode = "list" | "board";

const STATUSES: { id: TaskStatus; label: string; tone: string }[] = [
  { id: "a_fazer", label: "A fazer", tone: "todo" },
  { id: "em_andamento", label: "Em andamento", tone: "doing" },
  { id: "revisao", label: "Em revisão", tone: "review" },
  { id: "bloqueado", label: "Bloqueado", tone: "blocked" },
  { id: "concluido", label: "Concluído", tone: "done" },
];

const PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: "urgente", label: "Urgente" },
  { id: "alta", label: "Alta" },
  { id: "normal", label: "Normal" },
  { id: "baixa", label: "Baixa" },
];

const CHECKLIST_LABEL: Record<ChecklistState, string> = {
  pendente: "Não iniciado",
  em_andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Finalizado",
};

const SPACE_COLORS = ["#e01783", "#021d49", "#2e63d6", "#12936a", "#e0931f", "#7c3aed", "#d02b3f", "#0891b2"];
const VIEW_STORAGE_KEY = "rede-clube-projects-view";
const SPACE_STORAGE_KEY = "rede-clube-projects-space";

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

/* ---------- Utilitarios ---------- */

function readStored<T extends string>(key: string, fallback: T) {
  try {
    return (window.localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* preferencia local apenas */
  }
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isOverdue(task: ProjectTask) {
  return Boolean(task.dueDate) && task.status !== "concluido" && task.dueDate < todayIso();
}

function formatDue(date: string) {
  if (!date) return "";
  const today = todayIso();
  if (date === today) return "Hoje";
  const tomorrow = new Date(Date.now() + 86400000);
  const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  if (date === tomorrowIso) return "Amanhã";
  const [year, month, day] = date.split("-");
  return year === today.slice(0, 4) ? `${day}/${month}` : `${day}/${month}/${year.slice(2)}`;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return `${parts[0][0] || ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
}

/* ---------- Tempo e progresso ---------- */

// Relogio que so "anda" enquanto houver cronometro ativo na tela.
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function itemMs(item: ChecklistItem, now: number) {
  const running = item.state === "em_andamento" && item.runningSince ? Math.max(0, now - new Date(item.runningSince).getTime()) : 0;
  return (item.elapsedMs || 0) + running;
}

function taskMs(task: ProjectTask, now: number) {
  return task.checklist.reduce((sum, item) => sum + itemMs(item, now), 0);
}

function isRunning(task: ProjectTask) {
  return task.checklist.some((item) => item.state === "em_andamento");
}

// Progresso da tarefa: itens finalizados do checklist; sem checklist, vale o status.
function taskProgress(task: ProjectTask) {
  if (task.status === "concluido") return 1;
  if (!task.checklist.length) return 0;
  return task.checklist.filter((item) => item.state === "concluido").length / task.checklist.length;
}

function formatClock(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatHours(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return ms > 0 ? "< 1min" : "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${m}min` : `${h}h`;
}

// Horas por pessoa (intervalos fechados + o que esta rodando agora).
function hoursByPerson(tasks: ProjectTask[], now: number) {
  const totals = new Map<string, { login: string; name: string; ms: number }>();
  const add = (login: string, name: string, ms: number) => {
    if (!login || ms <= 0) return;
    const key = login.toLowerCase();
    const entry = totals.get(key) || { login, name: name || login, ms: 0 };
    entry.ms += ms;
    totals.set(key, entry);
  };
  for (const task of tasks) {
    for (const item of task.checklist) {
      for (const session of item.sessions || []) add(session.login, session.name, session.ms);
      if (item.state === "em_andamento" && item.runningSince) add(item.runningBy, item.runningByName, now - new Date(item.runningSince).getTime());
    }
  }
  return Array.from(totals.values()).sort((a, b) => b.ms - a.ms);
}

// Primeiro inicio e ultimo fim registrados no projeto.
function workPeriod(tasks: ProjectTask[]) {
  let first = "";
  let last = "";
  for (const task of tasks) {
    for (const item of task.checklist) {
      for (const session of item.sessions || []) {
        if (!first || session.start < first) first = session.start;
        if (!last || session.end > last) last = session.end;
      }
      if (item.runningSince && (!first || item.runningSince < first)) first = item.runningSince;
    }
  }
  return { first, last };
}

function shortDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Cor fixa por pessoa (mesmo login = mesma cor em todo o painel).
const AVATAR_COLORS = ["#021d49", "#b5106a", "#2e63d6", "#0e6b4d", "#7c3aed", "#b45309", "#0e7490", "#be123c"];

function avatarStyle(login: string): React.CSSProperties {
  let hash = 0;
  for (const char of login.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return { background: AVATAR_COLORS[hash % AVATAR_COLORS.length] };
}

function sameUser(a: string, b: string) {
  return Boolean(a) && a.toLowerCase() === b.toLowerCase();
}

/* ---------- Componente principal ---------- */

export function ProjectsDashboard({ currentUser }: { currentUser: CurrentUser }) {
  const [data, setData] = useState<ProjectsData>({ spaces: [], tasks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [spaceFilter, setSpaceFilter] = useState<SpaceFilter>(() => readStored(SPACE_STORAGE_KEY, "all"));
  const [view, setView] = useState<ViewMode>(() => (readStored<string>(VIEW_STORAGE_KEY, "list") === "board" ? "board" : "list"));
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"" | TaskPriority>("");
  const [assigneeFilter, setAssigneeFilter] = useState<"all" | "me" | "none">("all");
  const [showDone, setShowDone] = useState(true);
  const [openTaskId, setOpenTaskId] = useState("");
  const [spaceForm, setSpaceForm] = useState<{ id?: string; name: string; color: string } | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamError, setTeamError] = useState("");
  const [membersOpen, setMembersOpen] = useState(false);

  useEffect(() => {
    api<{ items: TeamMember[] }>("/api/projects/team")
      .then((payload) => setTeam(payload.items || []))
      .catch((teamLoadError) => setTeamError(teamLoadError instanceof Error ? teamLoadError.message : "Equipe indisponível."));
  }, []);

  const load = useCallback(async () => {
    try {
      setError("");
      setData(await api<ProjectsData>("/api/projects"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar os projetos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => writeStored(VIEW_STORAGE_KEY, view), [view]);
  useEffect(() => writeStored(SPACE_STORAGE_KEY, spaceFilter), [spaceFilter]);

  // Espaco salvo pode ter sido excluido por outra pessoa.
  useEffect(() => {
    if (!loading && spaceFilter !== "all" && spaceFilter !== "mine" && !data.spaces.some((space) => space.id === spaceFilter)) {
      setSpaceFilter("all");
    }
  }, [data.spaces, loading, spaceFilter]);

  const spaceById = useMemo(() => new Map(data.spaces.map((space) => [space.id, space])), [data.spaces]);
  const activeSpace = spaceById.get(spaceFilter);

  const scopedTasks = useMemo(() => {
    if (spaceFilter === "mine") return data.tasks.filter((task) => sameUser(task.assignee, currentUser.login));
    if (spaceFilter === "all") return data.tasks;
    return data.tasks.filter((task) => task.spaceId === spaceFilter);
  }, [currentUser.login, data.tasks, spaceFilter]);

  const visibleTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scopedTasks
      .filter((task) => !priorityFilter || task.priority === priorityFilter)
      .filter((task) => assigneeFilter === "all" || (assigneeFilter === "me" ? sameUser(task.assignee, currentUser.login) : !task.assignee))
      .filter((task) => showDone || task.status !== "concluido")
      .filter((task) => !term || [task.title, task.description, task.assigneeName, task.assignee, ...task.tags].join(" ").toLowerCase().includes(term))
      .sort((a, b) => a.order - b.order);
  }, [assigneeFilter, currentUser.login, priorityFilter, scopedTasks, search, showDone]);

  const anyRunning = data.tasks.some(isRunning);
  const now = useNow(anyRunning);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return {
      open: scopedTasks.filter((task) => task.status !== "concluido").length,
      doing: scopedTasks.filter((task) => task.status === "em_andamento").length,
      overdue: scopedTasks.filter(isOverdue).length,
      doneWeek: scopedTasks.filter((task) => task.completedAt && new Date(task.completedAt).getTime() >= weekAgo).length,
    };
  }, [scopedTasks]);
  const workedMs = scopedTasks.reduce((sum, task) => sum + taskMs(task, now), 0);

  const openTask = data.tasks.find((task) => task.id === openTaskId) || null;

  const replaceTask = (task: ProjectTask) => setData((current) => ({ ...current, tasks: current.tasks.map((item) => (item.id === task.id ? task : item)) }));

  async function runChecklistAction(taskId: string, itemId: string, action: ChecklistAction) {
    try {
      const result = await api<{ task: ProjectTask; pausedElsewhere: string[] }>(
        `/api/projects/tasks/${encodeURIComponent(taskId)}/checklist/${encodeURIComponent(itemId)}/${action}`,
        "POST",
      );
      replaceTask(result.task);
      // Iniciar pausa o cronometro que a pessoa tinha rodando em outra tarefa.
      if (result.pausedElsewhere?.length) load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Nao foi possivel atualizar o item.");
      load();
    }
  }

  async function patchTask(id: string, patch: Partial<ProjectTask>) {
    // Atualizacao otimista: a tela responde na hora e sincroniza em seguida.
    setData((current) => ({ ...current, tasks: current.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)) }));
    try {
      replaceTask(await api<ProjectTask>(`/api/projects/tasks/${encodeURIComponent(id)}`, "PATCH", patch));
      // Atribuir alguem o adiciona como membro do projeto no servidor.
      if (patch.assignee) load();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Nao foi possivel salvar.");
      load();
    }
  }

  async function createTask(title: string, status: TaskStatus = "a_fazer", openAfter = false) {
    const spaceId = activeSpace?.id || data.spaces.find((space) => !space.archived)?.id;
    if (!spaceId) {
      setError("Crie um projeto antes de adicionar tarefas.");
      return;
    }
    try {
      const assignToMe = spaceFilter === "mine" || assigneeFilter === "me";
      const task = await api<ProjectTask>("/api/projects/tasks", "POST", {
        spaceId,
        title,
        status,
        priority: priorityFilter || "normal",
        assignee: assignToMe ? currentUser.login : "",
        assigneeName: assignToMe ? currentUser.name : "",
      });
      setData((current) => ({ ...current, tasks: [...current.tasks, task] }));
      if (openAfter) setOpenTaskId(task.id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Nao foi possivel criar a tarefa.");
    }
  }

  async function removeTask(task: ProjectTask) {
    if (!window.confirm(`Excluir a tarefa "${task.title}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await api(`/api/projects/tasks/${encodeURIComponent(task.id)}`, "DELETE");
      setOpenTaskId("");
      setData((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== task.id) }));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Nao foi possivel excluir.");
    }
  }

  async function saveSpace() {
    if (!spaceForm?.name.trim()) return;
    try {
      const body = { name: spaceForm.name, color: spaceForm.color };
      const space = spaceForm.id
        ? await api<ProjectSpace>(`/api/projects/spaces/${encodeURIComponent(spaceForm.id)}`, "PATCH", body)
        : await api<ProjectSpace>("/api/projects/spaces", "POST", body);
      setData((current) => ({
        ...current,
        spaces: spaceForm.id ? current.spaces.map((item) => (item.id === space.id ? space : item)) : [...current.spaces, space],
      }));
      setSpaceFilter(space.id);
      setSpaceForm(null);
    } catch (spaceError) {
      setError(spaceError instanceof Error ? spaceError.message : "Nao foi possivel salvar o espaço.");
    }
  }

  async function removeSpace(space: ProjectSpace) {
    const count = data.tasks.filter((task) => task.spaceId === space.id).length;
    const warning = count ? ` As ${count} tarefa(s) dele também serão excluídas.` : "";
    if (!window.confirm(`Excluir o espaço "${space.name}"?${warning}`)) return;
    try {
      await api(`/api/projects/spaces/${encodeURIComponent(space.id)}`, "DELETE");
      setSpaceFilter("all");
      setData((current) => ({
        spaces: current.spaces.filter((item) => item.id !== space.id),
        tasks: current.tasks.filter((task) => task.spaceId !== space.id),
      }));
    } catch (spaceError) {
      setError(spaceError instanceof Error ? spaceError.message : "Nao foi possivel excluir o espaço.");
    }
  }

  async function saveMembers(members: SpaceMember[]) {
    if (!activeSpace) return;
    try {
      const space = await api<ProjectSpace>(`/api/projects/spaces/${encodeURIComponent(activeSpace.id)}`, "PATCH", { members });
      setData((current) => ({ ...current, spaces: current.spaces.map((item) => (item.id === space.id ? { ...item, ...space } : item)) }));
      setMembersOpen(false);
    } catch (membersError) {
      setError(membersError instanceof Error ? membersError.message : "Nao foi possivel salvar os membros.");
    }
  }

  const isAdmin = data.me?.isAdmin ?? false;
  const allLabel = isAdmin ? "Todos os projetos" : "Meus projetos";
  const heading = spaceFilter === "mine" ? "Minhas tarefas" : activeSpace?.name || allLabel;
  const hasFilters = Boolean(search || priorityFilter || assigneeFilter !== "all" || !showDone);

  return (
    <div className="pm-layout">
      <aside className="pm-spaces" aria-label="Projetos">
        <button className={`pm-space-item ${spaceFilter === "all" ? "active" : ""}`} type="button" onClick={() => setSpaceFilter("all")}>
          <FolderKanban size={16} />
          <span>{allLabel}</span>
          <small>{data.tasks.filter((task) => task.status !== "concluido").length}</small>
        </button>
        <button className={`pm-space-item ${spaceFilter === "mine" ? "active" : ""}`} type="button" onClick={() => setSpaceFilter("mine")}>
          <User size={16} />
          <span>Minhas tarefas</span>
          <small>{data.tasks.filter((task) => task.status !== "concluido" && sameUser(task.assignee, currentUser.login)).length}</small>
        </button>

        <p className="pm-spaces-title">Projetos</p>
        {data.spaces.map((space) => (
          <button
            className={`pm-space-item ${spaceFilter === space.id ? "active" : ""}`}
            key={space.id}
            type="button"
            onClick={() => setSpaceFilter(space.id)}
          >
            <i className="pm-space-dot" style={{ background: space.color }} />
            <span>{space.name}</span>
            <small>{data.tasks.filter((task) => task.spaceId === space.id && task.status !== "concluido").length}</small>
          </button>
        ))}

        {spaceForm ? (
          <form
            className="pm-space-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveSpace();
            }}
          >
            <input autoFocus value={spaceForm.name} onChange={(event) => setSpaceForm({ ...spaceForm, name: event.target.value })} placeholder="Nome do projeto" maxLength={80} />
            <div className="pm-color-row" role="radiogroup" aria-label="Cor do projeto">
              {SPACE_COLORS.map((swatch) => (
                <button
                  aria-checked={spaceForm.color === swatch}
                  aria-label={`Cor ${swatch}`}
                  className={`pm-color ${spaceForm.color === swatch ? "selected" : ""}`}
                  key={swatch}
                  role="radio"
                  style={{ background: swatch }}
                  type="button"
                  onClick={() => setSpaceForm({ ...spaceForm, color: swatch })}
                />
              ))}
            </div>
            <div className="pm-form-actions">
              <button className="pm-btn ghost" type="button" onClick={() => setSpaceForm(null)}>Cancelar</button>
              <button className="pm-btn primary" type="submit" disabled={!spaceForm.name.trim()}>Salvar</button>
            </div>
          </form>
        ) : isAdmin ? (
          <button className="pm-add-space" type="button" onClick={() => setSpaceForm({ name: "", color: SPACE_COLORS[data.spaces.length % SPACE_COLORS.length] })}>
            <Plus size={16} />
            Novo projeto
          </button>
        ) : null}
      </aside>

      <section className="pm-main">
        <header className="pm-toolbar">
          <div className="pm-title">
            {activeSpace ? <i className="pm-space-dot large" style={{ background: activeSpace.color }} /> : null}
            <h2>{heading}</h2>
            {activeSpace?.canManage ? (
              <div className="pm-title-actions">
                <button className="pm-icon-btn" type="button" title="Renomear projeto" aria-label="Renomear projeto" onClick={() => setSpaceForm({ id: activeSpace.id, name: activeSpace.name, color: activeSpace.color })}>
                  <Pencil size={15} />
                </button>
                <button className="pm-icon-btn danger" type="button" title="Excluir projeto" aria-label="Excluir projeto" onClick={() => removeSpace(activeSpace)}>
                  <Trash2 size={15} />
                </button>
              </div>
            ) : null}
          </div>

          {activeSpace ? (
            <div className="pm-members-bar">
              <div className="pm-avatar-stack" aria-label={`${activeSpace.members.length} membro(s)`}>
                {activeSpace.members.slice(0, 6).map((member) => (
                  <span className="pm-avatar" key={member.login} title={member.name} style={avatarStyle(member.login)}>{initials(member.name)}</span>
                ))}
                {activeSpace.members.length > 6 ? <span className="pm-avatar more">+{activeSpace.members.length - 6}</span> : null}
                {!activeSpace.members.length ? <span className="pm-members-empty">Sem membros</span> : null}
              </div>
              {activeSpace.canManage ? (
                <button className="pm-btn ghost" type="button" onClick={() => setMembersOpen(true)}>
                  <Users size={15} /> Membros
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="pm-view-tabs" role="tablist" aria-label="Modo de visualização">
            <button role="tab" aria-selected={view === "list"} className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}>
              <LayoutList size={16} /> Lista
            </button>
            <button role="tab" aria-selected={view === "board"} className={view === "board" ? "active" : ""} type="button" onClick={() => setView("board")}>
              <Kanban size={16} /> Quadro
            </button>
          </div>

          <button className="pm-btn primary" type="button" onClick={() => createTask("Nova tarefa", "a_fazer", true)}>
            <Plus size={16} /> Nova tarefa
          </button>
        </header>

        <div className="pm-filters">
          <label className="pm-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefa, responsável ou etiqueta" />
          </label>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as "" | TaskPriority)} aria-label="Filtrar por prioridade">
            <option value="">Todas as prioridades</option>
            {PRIORITIES.map((priority) => <option key={priority.id} value={priority.id}>{priority.label}</option>)}
          </select>
          <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value as "all" | "me" | "none")} aria-label="Filtrar por responsável">
            <option value="all">Qualquer responsável</option>
            <option value="me">Atribuídas a mim</option>
            <option value="none">Sem responsável</option>
          </select>
          <label className="pm-toggle">
            <input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)} />
            Mostrar concluídas
          </label>
          {hasFilters ? (
            <button className="pm-btn ghost" type="button" onClick={() => { setSearch(""); setPriorityFilter(""); setAssigneeFilter("all"); setShowDone(true); }}>
              Limpar filtros
            </button>
          ) : null}
          <button className="pm-icon-btn" type="button" title="Atualizar" aria-label="Atualizar" onClick={load}>
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="pm-stats">
          <div><span>Abertas</span><strong>{stats.open}</strong></div>
          <div><span>Em andamento</span><strong>{stats.doing}</strong></div>
          <div className={stats.overdue ? "alert" : ""}><span>Atrasadas</span><strong>{stats.overdue}</strong></div>
          <div className="good"><span>Concluídas em 7 dias</span><strong>{stats.doneWeek}</strong></div>
          <div className={`hours ${anyRunning ? "live" : ""}`}><span>Horas trabalhadas</span><strong>{formatHours(workedMs)}</strong></div>
        </div>

        {error ? (
          <div className="pm-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
            <button className="pm-icon-btn" type="button" aria-label="Fechar aviso" onClick={() => setError("")}><X size={14} /></button>
          </div>
        ) : null}

        {!loading && spaceFilter === "all" && data.spaces.length ? (
          <ProjectCards spaces={data.spaces} tasks={data.tasks} now={now} onOpen={setSpaceFilter} />
        ) : null}
        {!loading && activeSpace ? (
          <ProjectCards spaces={[activeSpace]} tasks={data.tasks} now={now} single />
        ) : null}

        {loading ? (
          <div className="pm-empty">Carregando projetos...</div>
        ) : !data.spaces.length ? (
          <div className="pm-empty">
            {isAdmin ? (
              <>
                <strong>Nenhum projeto criado</strong>
                <span>Crie um projeto (ex.: Infraestrutura, Sistemas) e adicione os analistas da equipe.</span>
              </>
            ) : (
              <>
                <strong>Você ainda não participa de nenhum projeto</strong>
                <span>Quando o gestor adicionar você a um projeto ou atribuir uma tarefa, ela aparece aqui.</span>
              </>
            )}
          </div>
        ) : view === "list" ? (
          <TaskList
            tasks={visibleTasks}
            spaceById={spaceById}
            showSpace={!activeSpace}
            onOpen={setOpenTaskId}
            onPatch={patchTask}
            onQuickAdd={createTask}
            filtered={hasFilters}
            now={now}
          />
        ) : (
          <TaskBoard
            tasks={visibleTasks}
            spaceById={spaceById}
            showSpace={!activeSpace}
            onOpen={setOpenTaskId}
            onPatch={patchTask}
            onQuickAdd={createTask}
            now={now}
          />
        )}
      </section>

      {openTask ? (
        <TaskDrawer
          key={openTask.id}
          task={openTask}
          spaces={data.spaces}
          currentUser={currentUser}
          onClose={() => setOpenTaskId("")}
          onPatch={(patch) => patchTask(openTask.id, patch)}
          onChecklistAction={(itemId, action) => runChecklistAction(openTask.id, itemId, action)}
          now={now}
          onDelete={() => removeTask(openTask)}
          onCommented={replaceTask}
          onError={setError}
          team={team}
          canDelete={sameUser(openTask.createdBy, currentUser.login) || Boolean(spaceById.get(openTask.spaceId)?.canManage)}
        />
      ) : null}

      {membersOpen && activeSpace ? (
        <MembersDialog
          space={activeSpace}
          team={team}
          teamError={teamError}
          onClose={() => setMembersOpen(false)}
          onSave={saveMembers}
        />
      ) : null}
    </div>
  );
}

/* ---------- Membros do projeto ---------- */

function MembersDialog({
  space,
  team,
  teamError,
  onClose,
  onSave,
}: {
  space: ProjectSpace;
  team: TeamMember[];
  teamError: string;
  onClose: () => void;
  onSave: (members: SpaceMember[]) => void;
}) {
  const [selected, setSelected] = useState<Map<string, SpaceMember>>(
    () => new Map(space.members.map((member) => [member.login.toLowerCase(), member])),
  );
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Membros antigos que sairam da OU continuam listados para poderem ser removidos.
  const people = useMemo(() => {
    const byLogin = new Map<string, TeamMember>(team.map((member) => [member.login.toLowerCase(), member]));
    for (const member of space.members) {
      if (!byLogin.has(member.login.toLowerCase())) {
        byLogin.set(member.login.toLowerCase(), { login: member.login, name: member.name, mail: "", title: "Fora da OU Tecnologia", department: "" });
      }
    }
    const term = filter.trim().toLowerCase();
    return Array.from(byLogin.values())
      .filter((person) => !term || `${person.name} ${person.login} ${person.title}`.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [filter, space.members, team]);

  function toggle(person: TeamMember) {
    setSelected((current) => {
      const next = new Map(current);
      const key = person.login.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.set(key, { login: person.login, name: person.name });
      return next;
    });
  }

  return (
    <>
      <div className="pm-drawer-backdrop" onClick={onClose} />
      <div className="pm-dialog" role="dialog" aria-modal="true" aria-label={`Membros de ${space.name}`}>
        <header className="pm-dialog-head">
          <div>
            <h3>Membros do projeto</h3>
            <p>{space.name} · equipe da OU Tecnologia (Active Directory)</p>
          </div>
          <button className="pm-icon-btn" type="button" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </header>

        <label className="pm-search">
          <Search size={16} />
          <input autoFocus value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar por nome, registro ou cargo" />
        </label>

        {teamError ? <div className="pm-error"><AlertTriangle size={16} /><span>{teamError}</span></div> : null}

        <ul className="pm-people">
          {people.map((person) => {
            const checked = selected.has(person.login.toLowerCase());
            return (
              <li key={person.login}>
                <label className={checked ? "checked" : ""}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(person)} />
                  <span className="pm-avatar" style={avatarStyle(person.login)}>{initials(person.name)}</span>
                  <span className="pm-person">
                    <strong>{person.name}</strong>
                    <small>{person.login}{person.title ? ` · ${person.title}` : ""}</small>
                  </span>
                </label>
              </li>
            );
          })}
          {!people.length && !teamError ? <li className="pm-people-empty">Ninguém encontrado.</li> : null}
        </ul>

        <footer className="pm-dialog-foot">
          <span>{selected.size} selecionado(s)</span>
          <button className="pm-btn ghost" type="button" onClick={onClose}>Cancelar</button>
          <button
            className="pm-btn primary"
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(Array.from(selected.values()));
              setSaving(false);
            }}
          >
            {saving ? "Salvando..." : "Salvar membros"}
          </button>
        </footer>
      </div>
    </>
  );
}

/* ---------- Pecas compartilhadas ---------- */

/* ---------- Cards de projeto ---------- */

function firstName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1).toLowerCase() : name;
}

function ProjectCards({
  spaces,
  tasks,
  now,
  onOpen,
  single = false,
}: {
  spaces: ProjectSpace[];
  tasks: ProjectTask[];
  now: number;
  onOpen?: (id: string) => void;
  single?: boolean;
}) {
  const cards = spaces
    .filter((space) => single || !space.archived)
    .map((space) => {
      const own = tasks.filter((task) => task.spaceId === space.id);
      const percent = own.length ? Math.round((own.reduce((sum, task) => sum + taskProgress(task), 0) / own.length) * 100) : 0;
      const items = own.flatMap((task) => task.checklist);
      const itemsDone = items.filter((item) => item.state === "concluido").length;
      const tasksDone = own.filter((task) => task.status === "concluido").length;
      const overdue = own.filter(isOverdue).length;
      const blocked = own.filter((task) => task.status === "bloqueado").length;
      const workedMs = own.reduce((sum, task) => sum + taskMs(task, now), 0);
      const period = workPeriod(own);

      // Status do projeto: inicia quando alguem comeca o primeiro item ou tarefa.
      const started = workedMs > 0 || own.some((task) => task.status !== "a_fazer");
      const status = own.length && tasksDone === own.length
        ? { label: "Concluído", tone: "done" }
        : started ? { label: "Em andamento", tone: "doing" } : { label: "Não iniciado", tone: "todo" };

      // Trabalhando agora: cronometro rodando primeiro, depois quem tem tarefa em andamento.
      const people = new Map<string, { login: string; name: string; live: boolean }>();
      for (const task of own) {
        for (const item of task.checklist) {
          if (item.state === "em_andamento" && item.runningBy) {
            people.set(item.runningBy.toLowerCase(), { login: item.runningBy, name: item.runningByName || item.runningBy, live: true });
          }
        }
      }
      for (const task of own) {
        if (!task.assignee || (task.status !== "em_andamento" && task.status !== "revisao")) continue;
        const key = task.assignee.toLowerCase();
        if (!people.has(key)) people.set(key, { login: task.assignee, name: task.assigneeName || task.assignee, live: false });
      }
      const working = Array.from(people.values()).sort((a, b) => Number(b.live) - Number(a.live));

      const nextDue = own
        .filter((task) => task.dueDate && task.status !== "concluido")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

      return { space, own, percent, items, itemsDone, tasksDone, overdue, blocked, workedMs, period, status, working, nextDue };
    })
    .sort((a, b) => Number(b.working.some((p) => p.live)) - Number(a.working.some((p) => p.live)) || b.working.length - a.working.length || a.space.name.localeCompare(b.space.name, "pt-BR"));

  return (
    <div className={single ? "pm-cards-grid single" : "pm-cards-grid"}>
      {cards.map((card) => {
        const Tag = single ? "div" : "button";
        const live = card.working.some((person) => person.live);
        const caption = card.items.length
          ? `${card.itemsDone} de ${card.items.length} itens finalizados · ${card.tasksDone}/${card.own.length} tarefas`
          : card.own.length ? `${card.tasksDone} de ${card.own.length} tarefas concluídas` : "Nenhuma tarefa ainda";
        return (
          <Tag
            className={`pm-project-card ${single ? "single" : ""}`}
            key={card.space.id}
            {...(single ? {} : { type: "button" as const, onClick: () => onOpen?.(card.space.id) })}
            style={{ "--project-color": card.space.color } as React.CSSProperties}
          >
            <header>
              <i className="pm-space-dot large" style={{ background: card.space.color }} />
              <strong title={card.space.name}>{card.space.name}</strong>
            </header>
            <span className={`pm-project-status tone-${card.status.tone}`}>{card.status.label}</span>

            <div className="pm-card-progress-row">
              <div className="pm-card-progress" role="progressbar" aria-valuenow={card.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do projeto">
                <span style={{ width: `${card.percent}%` }} />
              </div>
              <span className="pm-card-percent">{card.percent}%</span>
            </div>
            <p className="pm-card-caption">{caption}</p>

            <div className="pm-card-hours">
              <div>
                <small>Horas</small>
                <strong className={live ? "live" : ""}>
                  <Clock size={15} /> {formatHours(card.workedMs)}
                </strong>
              </div>
              <div>
                <small>Período</small>
                <span>
                  {card.period.first
                    ? `${shortDate(card.period.first)} → ${card.status.tone === "done" && card.period.last ? shortDate(card.period.last) : "hoje"}`
                    : "—"}
                </span>
              </div>
            </div>

            <div className="pm-card-working">
              <small>Trabalhando agora</small>
              {card.working.length ? (
                <div className="pm-card-people">
                  <div className="pm-avatar-stack">
                    {card.working.slice(0, 4).map((person) => (
                      <span
                        className={`pm-avatar ${person.live ? "live" : ""}`}
                        key={person.login}
                        title={`${person.name}${person.live ? " · cronômetro ativo" : " · tarefa em andamento"}`}
                        style={avatarStyle(person.login)}
                      >
                        {initials(person.name)}
                      </span>
                    ))}
                    {card.working.length > 4 ? <span className="pm-avatar more">+{card.working.length - 4}</span> : null}
                  </div>
                  <span className="pm-card-names">
                    {card.working.slice(0, 2).map((person) => firstName(person.name)).join(", ")}
                    {card.working.length > 2 ? ` e mais ${card.working.length - 2}` : ""}
                  </span>
                </div>
              ) : (
                <span className="pm-card-idle">Ninguém trabalhando agora</span>
              )}
            </div>

            {single ? <PeopleHours tasks={card.own} now={now} /> : null}

            <footer>
              <span className="pm-meta" title="Membros do projeto"><Users size={13} /> {card.space.members.length}</span>
              {card.overdue ? <span className="pm-card-flag danger">{card.overdue} atrasada(s)</span> : null}
              {card.blocked ? <span className="pm-card-flag warn">{card.blocked} bloqueada(s)</span> : null}
              {card.nextDue && !card.overdue ? (
                <span className="pm-due" title={card.nextDue.title}><CalendarDays size={13} /> Próx. prazo {formatDue(card.nextDue.dueDate)}</span>
              ) : null}
            </footer>
          </Tag>
        );
      })}
    </div>
  );
}

// Horas por analista (usado no resumo do projeto e no detalhe da tarefa).
function PeopleHours({ tasks, now }: { tasks: ProjectTask[]; now: number }) {
  const people = hoursByPerson(tasks, now);
  if (!people.length) return null;
  const max = people[0].ms || 1;
  return (
    <ul className="pm-people-hours">
      {people.map((person) => (
        <li key={person.login}>
          <span className="pm-avatar" style={avatarStyle(person.login)}>{initials(person.name)}</span>
          <span className="pm-people-hours-name">{person.name}</span>
          <span className="pm-people-hours-bar"><span style={{ width: `${(person.ms / max) * 100}%` }} /></span>
          <strong>{formatHours(person.ms)}</strong>
        </li>
      ))}
    </ul>
  );
}

function PriorityFlag({ priority, withLabel = false }: { priority: TaskPriority; withLabel?: boolean }) {
  const label = PRIORITIES.find((item) => item.id === priority)?.label || priority;
  return (
    <span className={`pm-priority ${priority}`} title={`Prioridade ${label.toLowerCase()}`}>
      <Flag size={14} />
      {withLabel ? label : null}
    </span>
  );
}

function Assignee({ task }: { task: ProjectTask }) {
  if (!task.assignee) return <span className="pm-avatar empty" title="Sem responsável"><User size={13} /></span>;
  const name = task.assigneeName || task.assignee;
  return <span className="pm-avatar" title={name} style={avatarStyle(task.assignee)}>{initials(name)}</span>;
}

function DueDate({ task }: { task: ProjectTask }) {
  if (!task.dueDate) return null;
  return (
    <span className={`pm-due ${isOverdue(task) ? "overdue" : ""}`} title={isOverdue(task) ? "Atrasada" : "Prazo"}>
      <CalendarDays size={13} />
      {formatDue(task.dueDate)}
    </span>
  );
}

function TaskMeta({ task, now }: { task: ProjectTask; now: number }) {
  const done = task.checklist.filter((item) => item.state === "concluido").length;
  const running = task.checklist.find((item) => item.state === "em_andamento");
  const worked = taskMs(task, now);
  return (
    <>
      {running ? (
        <span className="pm-timer-badge" title={`${running.runningByName || running.runningBy} trabalhando em: ${running.text}`}>
          <span className="pm-live-dot" />
          {formatClock(itemMs(running, now))}
        </span>
      ) : null}
      {task.checklist.length ? (
        <span className={`pm-meta ${done === task.checklist.length ? "complete" : ""}`} title="Itens do checklist finalizados">
          <ListChecks size={13} />
          {done}/{task.checklist.length} · {Math.round(taskProgress(task) * 100)}%
        </span>
      ) : null}
      {worked > 0 && !running ? (
        <span className="pm-meta" title="Horas trabalhadas na tarefa">
          <Clock size={13} />
          {formatHours(worked)}
        </span>
      ) : null}
      {task.comments.length ? (
        <span className="pm-meta" title="Comentários">
          <MessageSquare size={13} />
          {task.comments.length}
        </span>
      ) : null}
    </>
  );
}
function QuickAdd({ onAdd, label = "Adicionar tarefa" }: { onAdd: (title: string) => void; label?: string }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");

  if (!editing) {
    return (
      <button className="pm-quick-add" type="button" onClick={() => setEditing(true)}>
        <Plus size={14} /> {label}
      </button>
    );
  }

  return (
    <form
      className="pm-quick-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        onAdd(title.trim());
        setTitle("");
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => !title.trim() && setEditing(false)}
        onKeyDown={(event) => event.key === "Escape" && setEditing(false)}
        placeholder="Nome da tarefa e Enter"
        maxLength={200}
      />
    </form>
  );
}

type ViewProps = {
  tasks: ProjectTask[];
  spaceById: Map<string, ProjectSpace>;
  showSpace: boolean;
  onOpen: (id: string) => void;
  onPatch: (id: string, patch: Partial<ProjectTask>) => void;
  onQuickAdd: (title: string, status: TaskStatus) => void;
  now: number;
};

/* ---------- Visao em lista ---------- */

function TaskList({ tasks, spaceById, showSpace, onOpen, onPatch, onQuickAdd, filtered, now }: ViewProps & { filtered: boolean }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ concluido: true });

  if (!tasks.length && filtered) {
    return <div className="pm-empty"><strong>Nenhuma tarefa encontrada</strong><span>Ajuste ou limpe os filtros.</span></div>;
  }

  return (
    <div className="pm-list">
      {STATUSES.map((status) => {
        const group = tasks.filter((task) => task.status === status.id);
        if (!group.length && (status.id === "bloqueado" || status.id === "revisao")) return null;
        const isCollapsed = collapsed[status.id];
        return (
          <section className={`pm-group tone-${status.tone}`} key={status.id}>
            <button className="pm-group-head" type="button" aria-expanded={!isCollapsed} onClick={() => setCollapsed({ ...collapsed, [status.id]: !isCollapsed })}>
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              <span className="pm-status-pill">{status.label}</span>
              <small>{group.length}</small>
            </button>
            {!isCollapsed ? (
              <div className="pm-rows">
                {group.map((task) => {
                  const space = spaceById.get(task.spaceId);
                  const done = task.status === "concluido";
                  return (
                    <div className={`pm-row ${done ? "done" : ""}`} key={task.id}>
                      <button
                        className="pm-check"
                        type="button"
                        aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
                        title={done ? "Reabrir" : "Concluir"}
                        onClick={() => onPatch(task.id, { status: done ? "a_fazer" : "concluido" })}
                      >
                        {done ? <CircleCheck size={18} /> : <Circle size={18} />}
                      </button>
                      <button className="pm-row-title" type="button" onClick={() => onOpen(task.id)}>
                        <strong>{task.title}</strong>
                        <span className="pm-row-badges">
                          {showSpace && space ? <span className="pm-space-badge"><i className="pm-space-dot" style={{ background: space.color }} />{space.name}</span> : null}
                          {task.tags.map((tag) => <span className="pm-tag" key={tag}>{tag}</span>)}
                          <TaskMeta task={task} now={now} />
                        </span>
                      </button>
                      <Assignee task={task} />
                      <span className="pm-row-due"><DueDate task={task} /></span>
                      <PriorityFlag priority={task.priority} />
                    </div>
                  );
                })}
                <QuickAdd onAdd={(title) => onQuickAdd(title, status.id)} />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/* ---------- Visao em quadro (Kanban) ---------- */

function TaskBoard({ tasks, spaceById, showSpace, onOpen, onPatch, onQuickAdd, now }: ViewProps) {
  const [dragOver, setDragOver] = useState<TaskStatus | "">("");
  const draggingId = useRef("");

  return (
    <div className="pm-board">
      {STATUSES.map((status) => {
        const column = tasks.filter((task) => task.status === status.id);
        return (
          <section
            className={`pm-column tone-${status.tone} ${dragOver === status.id ? "drag-over" : ""}`}
            key={status.id}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(status.id);
            }}
            onDragLeave={() => setDragOver("")}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver("");
              const id = draggingId.current || event.dataTransfer.getData("text/plain");
              const task = tasks.find((item) => item.id === id);
              if (task && task.status !== status.id) onPatch(id, { status: status.id, order: Date.now() });
            }}
          >
            <header className="pm-column-head">
              <span className="pm-status-pill">{status.label}</span>
              <small>{column.length}</small>
            </header>
            <div className="pm-cards">
              {column.map((task) => {
                const space = spaceById.get(task.spaceId);
                return (
                  <article
                    className={`pm-card priority-${task.priority}`}
                    draggable
                    key={task.id}
                    onDragStart={(event) => {
                      draggingId.current = task.id;
                      event.dataTransfer.setData("text/plain", task.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      draggingId.current = "";
                    }}
                  >
                    <button className="pm-card-open" type="button" onClick={() => onOpen(task.id)}>
                      {showSpace && space ? <span className="pm-space-badge"><i className="pm-space-dot" style={{ background: space.color }} />{space.name}</span> : null}
                      <strong>{task.title}</strong>
                      {task.tags.length ? <span className="pm-row-badges">{task.tags.map((tag) => <span className="pm-tag" key={tag}>{tag}</span>)}</span> : null}
                    </button>
                    <footer>
                      <Assignee task={task} />
                      <DueDate task={task} />
                      <TaskMeta task={task} now={now} />
                      <PriorityFlag priority={task.priority} />
                    </footer>
                  </article>
                );
              })}
              <QuickAdd onAdd={(title) => onQuickAdd(title, status.id)} label="Adicionar" />
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------- Detalhe da tarefa ---------- */

function TaskDrawer({
  task,
  spaces,
  currentUser,
  onClose,
  onPatch,
  onDelete,
  onCommented,
  onError,
  team,
  canDelete,
  onChecklistAction,
  now,
}: {
  task: ProjectTask;
  spaces: ProjectSpace[];
  currentUser: CurrentUser;
  onClose: () => void;
  onPatch: (patch: Partial<ProjectTask>) => void;
  onDelete: () => void;
  onCommented: (task: ProjectTask) => void;
  onError: (message: string) => void;
  team: TeamMember[];
  canDelete: boolean;
  onChecklistAction: (itemId: string, action: ChecklistAction) => void;
  now: number;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);

  const [newTag, setNewTag] = useState("");
  const [newItem, setNewItem] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (task.title === "Nova tarefa") titleRef.current?.select();
  }, [task.title]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Responsavel: membros do projeto primeiro, depois o restante da equipe de Tecnologia.
  const taskSpace = spaces.find((space) => space.id === task.spaceId);
  const memberLogins = new Set((taskSpace?.members || []).map((member) => member.login.toLowerCase()));
  const projectPeople = (taskSpace?.members || []).map((member) => ({ login: member.login, name: member.name }));
  const otherPeople = team.filter((person) => !memberLogins.has(person.login.toLowerCase()));
  const knownLogins = new Set([...projectPeople, ...otherPeople].map((person) => person.login.toLowerCase()));

  function changeAssignee(login: string) {
    if (!login) {
      onPatch({ assignee: "", assigneeName: "" });
      return;
    }
    const person = [...projectPeople, ...otherPeople].find((item) => item.login === login);
    onPatch({ assignee: login, assigneeName: person?.name || login });
  }

  function addTag() {
    const tag = newTag.trim().toLowerCase();
    setNewTag("");
    if (tag && !task.tags.includes(tag)) onPatch({ tags: [...task.tags, tag] });
  }

  function addChecklistItem() {
    const textValue = newItem.trim();
    setNewItem("");
    if (!textValue) return;
    const item: ChecklistItem = {
      id: `novo-${Date.now()}`,
      text: textValue,
      done: false,
      state: "pendente",
      elapsedMs: 0,
      runningSince: "",
      runningBy: "",
      runningByName: "",
      sessions: [],
      completedAt: "",
      completedBy: "",
    };
    onPatch({ checklist: [...task.checklist, item] });
  }

  async function sendComment() {
    if (!comment.trim()) return;
    setSending(true);
    try {
      onCommented(await api<ProjectTask>(`/api/projects/tasks/${encodeURIComponent(task.id)}/comments`, "POST", { text: comment }));
      setComment("");
    } catch (commentError) {
      onError(commentError instanceof Error ? commentError.message : "Nao foi possivel comentar.");
    } finally {
      setSending(false);
    }
  }

  const doneItems = task.checklist.filter((item) => item.done).length;

  return (
    <>
      <div className="pm-drawer-backdrop" onClick={onClose} />
      <aside className="pm-drawer" role="dialog" aria-modal="true" aria-label="Detalhes da tarefa">
        <header className="pm-drawer-head">
          <select
            className={`pm-status-select tone-${STATUSES.find((status) => status.id === task.status)?.tone}`}
            value={task.status}
            onChange={(event) => onPatch({ status: event.target.value as TaskStatus })}
            aria-label="Status"
          >
            {STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
          </select>
          <div className="pm-drawer-actions">
            {canDelete ? <button className="pm-icon-btn danger" type="button" title="Excluir tarefa" aria-label="Excluir tarefa" onClick={onDelete}><Trash2 size={16} /></button> : null}
            <button className="pm-icon-btn" type="button" title="Fechar (Esc)" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        <div className="pm-drawer-body">
          <textarea
            ref={titleRef}
            className="pm-title-input"
            value={title}
            rows={2}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value.replace(/\n/g, " "))}
            onBlur={() => title.trim() && title !== task.title && onPatch({ title: title.trim() })}
            onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), event.currentTarget.blur())}
            aria-label="Título da tarefa"
          />

          <dl className="pm-fields">
            <dt>Projeto</dt>
            <dd>
              <select value={task.spaceId} onChange={(event) => onPatch({ spaceId: event.target.value })}>
                {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
              </select>
            </dd>

            <dt>Responsável</dt>
            <dd className="pm-assignee-field">
              <select value={task.assignee} onChange={(event) => changeAssignee(event.target.value)} aria-label="Responsável">
                <option value="">Sem responsável</option>
                {task.assignee && !knownLogins.has(task.assignee.toLowerCase()) ? (
                  <option value={task.assignee}>{task.assigneeName || task.assignee}</option>
                ) : null}
                {projectPeople.length ? (
                  <optgroup label="Membros do projeto">
                    {projectPeople.map((person) => <option key={person.login} value={person.login}>{person.name}</option>)}
                  </optgroup>
                ) : null}
                {otherPeople.length ? (
                  <optgroup label="Equipe de Tecnologia (entra no projeto ao atribuir)">
                    {otherPeople.map((person) => <option key={person.login} value={person.login}>{person.name}{person.title ? ` — ${person.title}` : ""}</option>)}
                  </optgroup>
                ) : null}
              </select>
              {!sameUser(task.assignee, currentUser.login) ? (
                <button
                  className="pm-link-btn"
                  type="button"
                  onClick={() => onPatch({ assignee: currentUser.login, assigneeName: currentUser.name || currentUser.login })}
                >
                  Atribuir a mim
                </button>
              ) : null}
            </dd>

            <dt>Prioridade</dt>
            <dd>
              <div className="pm-priority-picker" role="radiogroup" aria-label="Prioridade">
                {PRIORITIES.map((priority) => (
                  <button
                    key={priority.id}
                    role="radio"
                    aria-checked={task.priority === priority.id}
                    className={`pm-priority ${priority.id} ${task.priority === priority.id ? "selected" : ""}`}
                    type="button"
                    onClick={() => onPatch({ priority: priority.id })}
                  >
                    <Flag size={13} /> {priority.label}
                  </button>
                ))}
              </div>
            </dd>

            <dt>Datas</dt>
            <dd className="pm-dates">
              <label>
                <span>Início</span>
                <input type="date" value={task.startDate} onChange={(event) => onPatch({ startDate: event.target.value })} />
              </label>
              <label className={isOverdue(task) ? "overdue" : ""}>
                <span>Prazo</span>
                <input type="date" value={task.dueDate} onChange={(event) => onPatch({ dueDate: event.target.value })} />
              </label>
            </dd>

            <dt>Etiquetas</dt>
            <dd>
              <div className="pm-tags-edit">
                {task.tags.map((tag) => (
                  <span className="pm-tag" key={tag}>
                    {tag}
                    <button type="button" aria-label={`Remover etiqueta ${tag}`} onClick={() => onPatch({ tags: task.tags.filter((item) => item !== tag) })}><X size={11} /></button>
                  </span>
                ))}
                <input
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addTag())}
                  onBlur={addTag}
                  placeholder="+ etiqueta"
                  maxLength={30}
                />
              </div>
            </dd>
          </dl>

          <section className="pm-section">
            <h3>Descrição</h3>
            <textarea
              className="pm-description"
              value={description}
              rows={5}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => description !== task.description && onPatch({ description })}
              placeholder="Detalhes, contexto, links..."
            />
          </section>

          <section className="pm-section">
            <h3>
              Checklist
              {task.checklist.length ? <small>{doneItems}/{task.checklist.length} · {Math.round((doneItems / task.checklist.length) * 100)}%</small> : null}
              {taskMs(task, now) > 0 ? <small className="pm-h3-hours"><Clock size={13} /> {formatHours(taskMs(task, now))}</small> : null}
            </h3>
            {task.checklist.length ? (
              <div className="pm-progress" aria-hidden="true"><span style={{ width: `${(doneItems / task.checklist.length) * 100}%` }} /></div>
            ) : null}
            <ul className="pm-checklist timed">
              {task.checklist.map((item) => {
                const running = item.state === "em_andamento";
                const elapsed = itemMs(item, now);
                const mineRunning = running && sameUser(item.runningBy, currentUser.login);
                return (
                  <li key={item.id} className={`state-${item.state}`}>
                    <span className="pm-item-state" title={CHECKLIST_LABEL[item.state]}>
                      {item.state === "concluido" ? <CircleCheck size={18} /> : running ? <span className="pm-live-dot big" /> : <Circle size={18} />}
                    </span>
                    <div className="pm-item-body">
                      <span className="pm-item-text">{item.text}</span>
                      <small>
                        {CHECKLIST_LABEL[item.state]}
                        {running && item.runningByName ? ` por ${firstName(item.runningByName)}` : ""}
                        {item.state === "concluido" && item.completedAt ? ` em ${formatDateTime(item.completedAt)}` : ""}
                      </small>
                    </div>
                    <span className={`pm-item-clock ${running ? "running" : ""}`} title="Tempo trabalhado neste item">
                      {elapsed > 0 || running ? formatClock(elapsed) : "--:--:--"}
                    </span>
                    <div className="pm-item-actions">
                      {item.state === "concluido" ? (
                        <button type="button" className="pm-timer-btn ghost" onClick={() => onChecklistAction(item.id, "reopen")} title="Reabrir item">
                          <RotateCcw size={14} /> Reabrir
                        </button>
                      ) : (
                        <>
                          {running ? (
                            <button
                              type="button"
                              className="pm-timer-btn pause"
                              onClick={() => onChecklistAction(item.id, "pause")}
                              title={mineRunning ? "Pausar" : `Pausar o cronômetro de ${item.runningByName || item.runningBy}`}
                            >
                              <Pause size={14} /> Pausar
                            </button>
                          ) : (
                            <button type="button" className="pm-timer-btn start" onClick={() => onChecklistAction(item.id, "start")} title={item.state === "pausado" ? "Continuar" : "Iniciar"}>
                              <Play size={14} /> {item.state === "pausado" ? "Continuar" : "Iniciar"}
                            </button>
                          )}
                          <button type="button" className="pm-timer-btn finish" onClick={() => onChecklistAction(item.id, "finish")} title="Finalizar item">
                            <Check size={14} /> Finalizar
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="pm-icon-btn"
                        aria-label="Remover item"
                        title="Remover item"
                        onClick={() => {
                          if (elapsed > 0 && !window.confirm(`Remover "${item.text}"? As ${formatHours(elapsed)} registradas nele serão perdidas.`)) return;
                          onPatch({ checklist: task.checklist.filter((entry) => entry.id !== item.id) });
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <input
              className="pm-inline-input"
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addChecklistItem())}
              placeholder="+ Adicionar item e Enter"
              maxLength={300}
            />
            {hoursByPerson([task], now).length ? (
              <div className="pm-task-people-hours">
                <small>Horas por analista nesta tarefa</small>
                <PeopleHours tasks={[task]} now={now} />
              </div>
            ) : null}
          </section>
          <section className="pm-section">
            <h3>Comentários {task.comments.length ? <small>{task.comments.length}</small> : null}</h3>
            <ol className="pm-comments">
              {task.comments.map((entry) => (
                <li key={entry.id}>
                  <span className="pm-avatar" style={avatarStyle(entry.author)}>{initials(entry.authorName || entry.author)}</span>
                  <div>
                    <p><strong>{entry.authorName || entry.author}</strong> <time>{formatDateTime(entry.at)}</time></p>
                    <p className="pm-comment-text">{entry.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="pm-comment-form">
              <textarea
                value={comment}
                rows={2}
                onChange={(event) => setComment(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && (event.ctrlKey || event.metaKey) && sendComment()}
                placeholder="Escreva um comentário (Ctrl+Enter envia)"
                maxLength={4000}
              />
              <button className="pm-btn primary" type="button" disabled={sending || !comment.trim()} onClick={sendComment}>
                {sending ? "Enviando..." : "Comentar"}
              </button>
            </div>
          </section>

          <p className="pm-audit">
            Criada por {task.createdByName || task.createdBy || "—"} em {formatDateTime(task.createdAt)}
            {task.completedAt ? ` · concluída em ${formatDateTime(task.completedAt)}` : ""}
          </p>
        </div>
      </aside>
    </>
  );
}
