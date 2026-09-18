import { isMilvusConfigured, milvusConfig } from "./config";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export type MilvusTicket = {
  id: string;
  code: string;
  title: string;
  description: string;
  requester: string;
  contact: string;
  requesterEmail: string;
  team: string;
  assignee: string;
  category: string;
  subcategory: string;
  priority: string;
  status: string;
  sla: string;
  solution: string;
  tasksTotal: number;
  tasksDone: number;
  createdAt: string;
  updatedAt: string;
};

const responseCache = new Map<string, CacheEntry<unknown>>();

const mockTickets: MilvusTicket[] = [
  {
    id: "42822",
    code: "#42822",
    title: "Usuario central bloqueado por tentativas invalidas",
    description: "Conta bloqueada no dominio. Origem provavel cpm41.paineiras.com.br.",
    requester: "Central de Atendimento",
    contact: "N1",
    requesterEmail: "central@clubepaineiras.com.br",
    team: "Service Desk",
    assignee: "N1",
    category: "Active Directory",
    subcategory: "Bloqueio",
    priority: "Alta",
    status: "Novo",
    sla: "11 min",
    solution: "",
    tasksTotal: 0,
    tasksDone: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "42819",
    code: "#42819",
    title: "Cadastro AD divergente do RH",
    description: "Usuario ativo sem campos obrigatorios preenchidos no padrao definido.",
    requester: "RH",
    contact: "RH",
    requesterEmail: "rh@clubepaineiras.com.br",
    team: "Service Desk",
    assignee: "Fabiano",
    category: "Cadastro",
    subcategory: "Active Directory",
    priority: "Media",
    status: "Em andamento",
    sla: "23 min",
    solution: "",
    tasksTotal: 1,
    tasksDone: 0,
    createdAt: "2026-09-17T11:20:00-03:00",
    updatedAt: "2026-09-17T12:02:00-03:00",
  },
  {
    id: "42813",
    code: "#42813",
    title: "VPN usuario financeiro sem MFA",
    description: "Validar grupo de VPN e politica de MFA antes de liberar acesso.",
    requester: "Financeiro",
    contact: "Financeiro",
    requesterEmail: "financeiro@clubepaineiras.com.br",
    team: "Seguranca",
    assignee: "Givaldo",
    category: "VPN",
    subcategory: "MFA",
    priority: "Alta",
    status: "Aguardando",
    sla: "41 min",
    solution: "",
    tasksTotal: 1,
    tasksDone: 0,
    createdAt: "2026-09-17T10:40:00-03:00",
    updatedAt: "2026-09-17T11:12:00-03:00",
  },
  {
    id: "42802",
    code: "#42802",
    title: "AP Filial Sul oscilando",
    description: "Verificar UniFi e uplink do switch do corredor principal.",
    requester: "Operacoes",
    contact: "Operacoes",
    requesterEmail: "operacoes@clubepaineiras.com.br",
    team: "Redes",
    assignee: "Infra",
    category: "Wi-Fi",
    subcategory: "Access Point",
    priority: "Baixa",
    status: "Pendente",
    sla: "1h 12m",
    solution: "",
    tasksTotal: 0,
    tasksDone: 0,
    createdAt: "2026-09-17T09:30:00-03:00",
    updatedAt: "2026-09-17T09:55:00-03:00",
  },
];

function isMockMode() {
  return milvusConfig.useMock || !isMilvusConfigured();
}

function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>) {
  const cachedValue = responseCache.get(key) as CacheEntry<T> | undefined;
  if (cachedValue && cachedValue.expiresAt > Date.now()) {
    return Promise.resolve(cachedValue.value);
  }

  return loader().then((value) => {
    responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  });
}

function pick(raw: Record<string, unknown>, names: string[]) {
  const lowerMap = new Map(Object.keys(raw).map((key) => [key.toLowerCase(), key]));
  for (const name of names) {
    const key = lowerMap.get(name.toLowerCase());
    if (key && raw[key] !== undefined && raw[key] !== null) return String(raw[key]);
  }
  return "";
}

function normalizeTicket(raw: Record<string, unknown>): MilvusTicket {
  const id = pick(raw, ["id", "codigo", "cod_chamado", "ticket_id", "chamado_id", "protocolo"]);
  const code = pick(raw, ["code", "codigo", "numero", "protocolo", "cod_chamado"]) || (id ? `#${id}` : "");

  return {
    id: id || code.replace(/^#/, ""),
    code,
    title: pick(raw, ["title", "titulo", "assunto", "subject", "descricao_resumida", "servico_realizado"]) || "Chamado sem titulo",
    description: pick(raw, ["description", "descricao", "mensagem", "body", "observacao", "servico_realizado"]),
    requester: pick(raw, ["requester", "solicitante", "cliente", "nome_solicitante", "user_name"]),
    contact: pick(raw, ["contact", "contato", "nome_contato", "solicitante", "responsavel_cliente"]),
    requesterEmail: pick(raw, ["requesterEmail", "email", "email_solicitante", "user_email"]),
    team: pick(raw, ["team", "equipe", "grupo", "setor", "departamento", "categoria_primaria"]),
    assignee: pick(raw, ["assignee", "responsavel", "tecnico", "operador", "atendente"]),
    category: pick(raw, ["category", "categoria", "tipo", "servico", "categoria_primaria", "categoria_secundaria"]),
    subcategory: pick(raw, ["subcategory", "subcategoria", "categoria_secundaria", "subcategoria_primaria"]),
    priority: pick(raw, ["priority", "prioridade", "urgencia"]) || "Media",
    status: pick(raw, ["status", "situacao", "estado", "status_chamado"]) || "Novo",
    sla: pick(raw, ["sla", "tempo_sla", "prazo", "vencimento_sla"]),
    solution: pick(raw, ["solution", "solucao", "resposta_solucao", "servico_realizado", "resposta"]),
    tasksTotal: Number(pick(raw, ["tasksTotal", "tarefas", "total_tarefas", "qtd_tarefas"]) || 0),
    tasksDone: Number(pick(raw, ["tasksDone", "tarefas_concluidas", "total_tarefas_concluidas", "qtd_tarefas_concluidas"]) || 0),
    createdAt: pick(raw, ["createdAt", "created_at", "data_criacao", "aberto_em", "dt_abertura"]),
    updatedAt: pick(raw, ["updatedAt", "updated_at", "data_atualizacao", "alterado_em", "dt_alteracao", "data_solucao"]),
  };
}

function extractItems(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  for (const key of ["items", "data", "result", "results", "lista", "chamados", "tickets"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function buildPath(template: string, params: Record<string, string>) {
  return Object.entries(params).reduce((path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)), template);
}

function normalizeStatus(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function ticketBucket(ticket: MilvusTicket) {
  const status = normalizeStatus(ticket.status);
  if (["fechado", "resolvido", "finalizado", "cancelado", "solucionado"].some((item) => status.includes(item))) return "closed";
  if (["a fazer", "afazer", "novo", "aberto", "em andamento", "andamento", "pendente", "aguardando"].some((item) => status.includes(item))) return "open";
  return "other";
}

async function milvusFetch<T>(path: string, init: RequestInit = {}) {
  if (!isMilvusConfigured()) {
    throw new Error("Milvus nao configurado. Preencha MILVUS_BASE_URL e MILVUS_API_TOKEN.");
  }

  const baseUrl = milvusConfig.baseUrl!.replace(/\/$/, "");
  const nextPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const tokenValue = milvusConfig.authScheme
    ? `${milvusConfig.authScheme} ${milvusConfig.apiToken}`
    : milvusConfig.apiToken!;
  headers.set(milvusConfig.authHeader, tokenValue);

  const response = await fetch(`${baseUrl}${nextPath}`, {
    ...init,
    headers,
  });
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string };

  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Milvus retornou erro ${response.status}.`);
  }

  return payload;
}

function summarizeTickets(tickets: MilvusTicket[], source: string) {
  const highPriorities = ["alta", "critica", "critico", "urgente"];

  return {
    source,
    total: tickets.length,
    open: tickets.filter((ticket) => ticketBucket(ticket) === "open").length,
    pending: tickets.filter((ticket) => normalizeStatus(ticket.status).includes("aguard") || normalizeStatus(ticket.status).includes("pend")).length,
    closed: tickets.filter((ticket) => ticketBucket(ticket) === "closed").length,
    highPriority: tickets.filter((ticket) => highPriorities.includes(normalizeStatus(ticket.priority))).length,
  };
}

async function listRemoteTickets() {
  const payload = await milvusFetch<unknown>(milvusConfig.ticketsPath, {
    method: "POST",
    body: JSON.stringify({ filtro_body: {} }),
  });
  return extractItems(payload)
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map(normalizeTicket);
}

export async function getMilvusStatus() {
  if (isMockMode()) {
    return {
      ok: true,
      source: "mock",
      configured: isMilvusConfigured(),
      message: "Milvus em modo mock. Configure a API para dados reais.",
    };
  }

  await listMilvusTickets("", 1);
  return {
    ok: true,
    source: "milvus",
    configured: true,
    message: "Conectado a API Milvus.",
  };
}

export async function getMilvusSummary() {
  if (isMockMode()) {
    return summarizeTickets(mockTickets, "mock");
  }

  return cached("milvus-summary", 30000, async () => summarizeTickets(await listRemoteTickets(), "milvus"));
}

export async function listMilvusTickets(query = "", limit?: string | number) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const search = query.trim().toLowerCase();
  const tickets = isMockMode()
    ? mockTickets
    : await cached("milvus-tickets", 30000, listRemoteTickets);
  const filtered = search
    ? tickets.filter((ticket) =>
        [
          ticket.code,
          ticket.title,
          ticket.description,
          ticket.requester,
          ticket.requesterEmail,
          ticket.team,
          ticket.assignee,
          ticket.category,
          ticket.priority,
          ticket.status,
        ].join(" ").toLowerCase().includes(search),
      )
    : tickets;

  return { source: isMockMode() ? "mock" : "milvus", items: filtered.slice(0, safeLimit) };
}

export async function getMilvusTicketDetails(id: string) {
  if (isMockMode()) {
    const ticket = mockTickets.find((item) => item.id === id || item.code.replace(/^#/, "") === id || item.code === id);
    if (!ticket) {
      throw new Error("Chamado nao encontrado.");
    }
    return { source: "mock", ticket };
  }

  if (milvusConfig.ticketDetailsPath === milvusConfig.ticketsPath || milvusConfig.ticketDetailsPath.includes("listagem")) {
    const tickets = await listRemoteTickets();
    const normalizedId = id.replace(/^#/, "");
    const ticket = tickets.find((item) => item.id === normalizedId || item.code.replace(/^#/, "") === normalizedId || item.code === id);
    if (!ticket) {
      throw new Error("Chamado nao encontrado na listagem da API Milvus.");
    }

    return { source: "milvus", ticket };
  }

  const path = buildPath(milvusConfig.ticketDetailsPath, { id });
  const payload = await milvusFetch<unknown>(path);
  const raw = Array.isArray(payload) ? payload[0] : payload;
  if (!raw || typeof raw !== "object") {
    throw new Error("Chamado nao encontrado na API Milvus.");
  }

  return { source: "milvus", ticket: normalizeTicket(raw as Record<string, unknown>) };
}

export async function createMilvusTicket(payload: Record<string, unknown>) {
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const requester = String(payload.requester || "").trim();

  if (!title) throw new Error("Informe o titulo do chamado.");
  if (!description) throw new Error("Informe a descricao do chamado.");
  if (!requester) throw new Error("Informe o solicitante do chamado.");

  if (isMockMode()) {
    const ticket: MilvusTicket = {
      id: String(Date.now()),
      code: `#${Math.floor(43000 + Math.random() * 1000)}`,
      title,
      description,
      requester,
      contact: requester,
      requesterEmail: String(payload.requesterEmail || ""),
      team: String(payload.team || "Service Desk"),
      assignee: "",
      category: String(payload.category || "Geral"),
      subcategory: "",
      priority: String(payload.priority || "Media"),
      status: "Novo",
      sla: "Novo",
      solution: "",
      tasksTotal: 0,
      tasksDone: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockTickets.unshift(ticket);
    return { source: "mock", message: "Chamado criado no modo mock.", ticket };
  }

  const remotePayload = {
    title,
    description,
    requester,
    requesterEmail: payload.requesterEmail,
    team: payload.team,
    category: payload.category,
    priority: payload.priority,
  };
  const response = await milvusFetch<unknown>(milvusConfig.createTicketPath, {
    method: "POST",
    body: JSON.stringify(remotePayload),
  });
  const raw = response && typeof response === "object" ? response as Record<string, unknown> : remotePayload;

  responseCache.clear();
  return {
    source: "milvus",
    message: "Chamado enviado para o Milvus.",
    ticket: normalizeTicket(raw),
  };
}

export async function closeMilvusTicket(id: string, payload: Record<string, unknown> = {}) {
  const normalizedId = id.replace(/^#/, "").trim();
  if (!normalizedId) {
    throw new Error("Informe o codigo do chamado.");
  }

  if (isMockMode()) {
    const ticket = mockTickets.find((item) => item.id === normalizedId || item.code.replace(/^#/, "") === normalizedId || item.code === id);
    if (!ticket) {
      throw new Error("Chamado nao encontrado.");
    }
    ticket.status = "Fechado";
    ticket.updatedAt = new Date().toISOString();
    ticket.solution = String(payload.resolution || payload.solution || ticket.solution || "Fechado pelo portal Rede Clube.");
    return { source: "mock", message: "Chamado fechado no modo mock.", ticket };
  }

  if (!milvusConfig.closeTicketPath) {
    throw new Error("Fechamento de chamado Milvus ainda nao configurado. Informe MILVUS_CLOSE_TICKET_PATH conforme a documentacao da API.");
  }

  const body = {
    codigo: normalizedId,
    id: normalizedId,
    status: payload.status || "Fechado",
    solucao: payload.resolution || payload.solution || "Fechado pelo portal Rede Clube.",
    observacao: payload.note || "Fechado pelo portal Rede Clube.",
  };
  const response = await milvusFetch<unknown>(buildPath(milvusConfig.closeTicketPath, { id: normalizedId }), {
    method: "POST",
    body: JSON.stringify(body),
  });
  const raw = response && typeof response === "object" ? response as Record<string, unknown> : body;

  responseCache.clear();
  return {
    source: "milvus",
    message: "Chamado enviado para fechamento no Milvus.",
    ticket: normalizeTicket({ ...body, ...raw }),
  };
}
