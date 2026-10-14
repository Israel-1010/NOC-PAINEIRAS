import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
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

type ChecklistItem = { id: string; text: string; done: boolean };
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

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return {
      open: scopedTasks.filter((task) => task.status !== "concluido").length,
      doing: scopedTasks.filter((task) => task.status === "em_andamento").length,
      overdue: scopedTasks.filter(isOverdue).length,
      doneWeek: scopedTasks.filter((task) => task.completedAt && new Date(task.completedAt).getTime() >= weekAgo).length,
    };
  }, [scopedTasks]);

  const openTask = data.tasks.find((task) => task.id === openTaskId) || null;

  const replaceTask = (task: ProjectTask) => setData((current) => ({ ...current, tasks: current.tasks.map((item) => (item.id === task.id ? task : item)) }));

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
        </div>

        {error ? (
          <div className="pm-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
            <button className="pm-icon-btn" type="button" aria-label="Fechar aviso" onClick={() => setError("")}><X size={14} /></button>
          </div>
        ) : null}

        {!loading && spaceFilter === "all" && data.spaces.length ? (
          <ProjectCards spaces={data.spaces} tasks={data.tasks} onOpen={setSpaceFilter} />
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
          />
        ) : (
          <TaskBoard
            tasks={visibleTasks}
            spaceById={spaceById}
            showSpace={!activeSpace}
            onOpen={setOpenTaskId}
            onPatch={patchTask}
            onQuickAdd={createTask}
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

function ProjectCards({ spaces, tasks, onOpen }: { spaces: ProjectSpace[]; tasks: ProjectTask[]; onOpen: (id: string) => void }) {
  const cards = spaces
    .filter((space) => !space.archived)
    .map((space) => {
      const own = tasks.filter((task) => task.spaceId === space.id);
      const done = own.filter((task) => task.status === "concluido").length;
      const counts = STATUSES.map((status) => ({ ...status, count: own.filter((task) => task.status === status.id).length }));
      const overdue = own.filter(isOverdue).length;
      const blocked = own.filter((task) => task.status === "bloqueado").length;

      // "Trabalhando agora": quem tem tarefa em andamento ou em revisao neste projeto.
      const active = new Map<string, { login: string; name: string; tasks: number }>();
      for (const task of own) {
        if (!task.assignee || (task.status !== "em_andamento" && task.status !== "revisao")) continue;
        const key = task.assignee.toLowerCase();
        const entry = active.get(key) || { login: task.assignee, name: task.assigneeName || task.assignee, tasks: 0 };
        entry.tasks += 1;
        active.set(key, entry);
      }
      const working = Array.from(active.values()).sort((a, b) => b.tasks - a.tasks);

      const nextDue = own
        .filter((task) => task.dueDate && task.status !== "concluido")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

      return {
        space,
        total: own.length,
        done,
        percent: own.length ? Math.round((done / own.length) * 100) : 0,
        counts,
        overdue,
        blocked,
        working,
        nextDue,
      };
    })
    .sort((a, b) => b.working.length - a.working.length || a.space.name.localeCompare(b.space.name, "pt-BR"));

  return (
    <div className="pm-cards-grid">
      {cards.map((card) => (
        <button
          className="pm-project-card"
          key={card.space.id}
          type="button"
          onClick={() => onOpen(card.space.id)}
          style={{ "--project-color": card.space.color } as React.CSSProperties}
        >
          <header>
            <i className="pm-space-dot large" style={{ background: card.space.color }} />
            <strong title={card.space.name}>{card.space.name}</strong>
            <span className="pm-card-percent">{card.percent}%</span>
          </header>

          <div className="pm-card-progress" aria-label={`${card.percent}% concluído`}>
            {card.total ? (
              card.counts.filter((status) => status.count).map((status) => (
                <span
                  className={`tone-${status.tone}`}
                  key={status.id}
                  style={{ flexGrow: status.count }}
                  title={`${status.label}: ${status.count}`}
                />
              ))
            ) : (
              <span className="empty" />
            )}
          </div>
          <p className="pm-card-caption">
            {card.total ? `${card.done} de ${card.total} tarefas concluídas` : "Nenhuma tarefa ainda"}
          </p>

          <div className="pm-card-working">
            <small>Trabalhando agora</small>
            {card.working.length ? (
              <div className="pm-card-people">
                <div className="pm-avatar-stack">
                  {card.working.slice(0, 4).map((person) => (
                    <span className="pm-avatar" key={person.login} title={`${person.name} · ${person.tasks} tarefa(s) em andamento`} style={avatarStyle(person.login)}>
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
              <span className="pm-card-idle">Ninguém com tarefa em andamento</span>
            )}
          </div>

          <footer>
            <span className="pm-meta" title="Membros do projeto"><Users size={13} /> {card.space.members.length}</span>
            {card.overdue ? <span className="pm-card-flag danger">{card.overdue} atrasada(s)</span> : null}
            {card.blocked ? <span className="pm-card-flag warn">{card.blocked} bloqueada(s)</span> : null}
            {card.nextDue && !card.overdue ? (
              <span className="pm-due" title={card.nextDue.title}><CalendarDays size={13} /> Próx. prazo {formatDue(card.nextDue.dueDate)}</span>
            ) : null}
          </footer>
        </button>
      ))}
    </div>
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

function TaskMeta({ task }: { task: ProjectTask }) {
  const done = task.checklist.filter((item) => item.done).length;
  return (
    <>
      {task.checklist.length ? (
        <span className={`pm-meta ${done === task.checklist.length ? "complete" : ""}`} title="Checklist">
          <ListChecks size={13} />
          {done}/{task.checklist.length}
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
};

/* ---------- Visao em lista ---------- */

function TaskList({ tasks, spaceById, showSpace, onOpen, onPatch, onQuickAdd, filtered }: ViewProps & { filtered: boolean }) {
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
                          <TaskMeta task={task} />
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

function TaskBoard({ tasks, spaceById, showSpace, onOpen, onPatch, onQuickAdd }: ViewProps) {
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
                      <TaskMeta task={task} />
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
    if (textValue) onPatch({ checklist: [...task.checklist, { id: `novo-${Date.now()}`, text: textValue, done: false }] });
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
              {task.checklist.length ? <small>{doneItems}/{task.checklist.length}</small> : null}
            </h3>
            {task.checklist.length ? (
              <div className="pm-progress" aria-hidden="true"><span style={{ width: `${(doneItems / task.checklist.length) * 100}%` }} /></div>
            ) : null}
            <ul className="pm-checklist">
              {task.checklist.map((item) => (
                <li key={item.id} className={item.done ? "done" : ""}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => onPatch({ checklist: task.checklist.map((entry) => (entry.id === item.id ? { ...entry, done: !entry.done } : entry)) })}
                    />
                    <span>{item.text}</span>
                  </label>
                  <button type="button" className="pm-icon-btn" aria-label="Remover item" onClick={() => onPatch({ checklist: task.checklist.filter((entry) => entry.id !== item.id) })}>
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
            <input
              className="pm-inline-input"
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addChecklistItem())}
              placeholder="+ Adicionar item e Enter"
              maxLength={300}
            />
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
