import express from "express";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { portalAdmins } from "./config";
import type { AuthUser } from "./auth";

// Itens do menu que podem ser liberados por usuario.
export const portalViews = [
  { id: "tv", label: "Visão geral (TV)", sensitive: false },
  { id: "topology", label: "Topologia", sensitive: true },
  { id: "snmp", label: "SNMP", sensitive: true },
  { id: "projects", label: "Projetos", sensitive: false },
  { id: "ad", label: "Active Directory", sensitive: true },
  { id: "intune", label: "Intune", sensitive: true },
  { id: "office365", label: "Office 365", sensitive: true },
  { id: "ips", label: "IPs e VLANs", sensitive: true },
  { id: "wifi", label: "WiFi", sensitive: true },
  { id: "milvusPortal", label: "Chamados Milvus", sensitive: false },
  { id: "pop", label: "Procedimentos (POP)", sensitive: false },
] as const;

export type PortalView = (typeof portalViews)[number]["id"];
const allViewIds = portalViews.map((view) => view.id) as PortalView[];
const initialDefaults: PortalView[] = ["tv", "projects", "milvusPortal", "pop"];

class AccessDenied extends Error {
  status = 403;
}
type UserAccess = { views: PortalView[]; name: string; updatedAt: string; updatedBy: string };
type AccessStore = { defaults: PortalView[]; users: Record<string, UserAccess>; admins: string[] };

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "access.json");
let writeQueue: Promise<unknown> = Promise.resolve();

function cleanViews(input: unknown): PortalView[] {
  if (!Array.isArray(input)) return [];
  return allViewIds.filter((id) => input.includes(id));
}

function parseStore(raw: Partial<AccessStore>): AccessStore {
  const users: Record<string, UserAccess> = {};
  for (const [login, entry] of Object.entries(raw.users || {})) {
    users[login.toLowerCase()] = {
      views: cleanViews(entry?.views),
      name: String(entry?.name || ""),
      updatedAt: String(entry?.updatedAt || ""),
      updatedBy: String(entry?.updatedBy || ""),
    };
  }
  const admins = Array.isArray(raw.admins) ? Array.from(new Set(raw.admins.map((login) => String(login).trim().toLowerCase()).filter(Boolean))) : [];
  return { defaults: Array.isArray(raw.defaults) ? cleanViews(raw.defaults) : initialDefaults, users, admins };
}

// Carregado de forma sincrona na inicializacao: o servidor nunca sobe sem saber quem e gestor.
function loadSync(): AccessStore {
  try {
    return parseStore(JSON.parse(fsSync.readFileSync(storePath, "utf8")) as Partial<AccessStore>);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (code !== "ENOENT") throw error;
    return { defaults: initialDefaults, users: {}, admins: [] };
  }
}

let cache: AccessStore = loadSync();

async function readStore(): Promise<AccessStore> {
  return cache;
}

function mutate<T>(change: (store: AccessStore) => T) {
  const task = writeQueue.then(async () => {
    const draft: AccessStore = JSON.parse(JSON.stringify(cache));
    const result = change(draft);
    await fs.mkdir(dataDir, { recursive: true });
    const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
    await fs.rename(tempPath, storePath);
    cache = draft;
    return result;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

function allAdmins() {
  return new Set([...portalAdmins, ...cache.admins]);
}

// Modo aberto: nenhum gestor (nem por variavel, nem pelo painel) -> todos sao gestores.
export function isOpenMode() {
  return allAdmins().size === 0;
}

export function isPortalAdmin(login: string) {
  return isOpenMode() || allAdmins().has(String(login || "").toLowerCase());
}

function adminSource(login: string): "servidor" | "painel" | "" {
  const key = login.toLowerCase();
  if (portalAdmins.includes(key)) return "servidor";
  if (cache.admins.includes(key)) return "painel";
  return "";
}

// Em modo aberto, quem estiver logado assume como gestor (fecha o modo aberto).
export function claimAdmin(user: AuthUser) {
  if (!isOpenMode()) throw new AccessDenied("Ja existe gestor configurado.");
  return mutate((store) => {
    store.admins = [user.login.toLowerCase()];
    return { ok: true };
  });
}

export function setPanelAdmin(login: string, admin: boolean, by: AuthUser) {
  const key = String(login || "").trim().toLowerCase();
  if (!key) throw new Error("Usuario invalido.");
  if (portalAdmins.includes(key)) throw new Error("Este gestor e definido no servidor (variavel de ambiente).");
  return mutate((store) => {
    const next = new Set(store.admins);
    if (admin) next.add(key);
    else next.delete(key);
    if (!admin && next.size === 0 && portalAdmins.length === 0) {
      throw new Error("Precisa existir pelo menos um gestor.");
    }
    if (!admin && key === by.login.toLowerCase() && next.size === 0) {
      throw new Error("Voce e o unico gestor.");
    }
    store.admins = Array.from(next);
    return { ok: true };
  });
}
export async function getUserViews(login: string): Promise<PortalView[]> {
  if (isPortalAdmin(login)) return allViewIds;
  const store = await readStore();
  return store.users[login.toLowerCase()]?.views ?? store.defaults;
}

export async function getMyAccess(user: AuthUser) {
  // openMode: nenhum gestor configurado -> todos enxergam tudo (aviso no painel).
  return { isAdmin: isPortalAdmin(user.login), views: await getUserViews(user.login), openMode: isOpenMode() };
}

export async function listAccess(people: { login: string; name: string; title?: string }[]) {
  const store = await readStore();
  const byLogin = new Map<string, { login: string; name: string; title: string }>();
  for (const person of people) byLogin.set(person.login.toLowerCase(), { login: person.login, name: person.name, title: person.title || "" });
  for (const [login, entry] of Object.entries(store.users)) {
    if (!byLogin.has(login)) byLogin.set(login, { login, name: entry.name || login, title: "Fora da OU" });
  }
  return {
    views: portalViews,
    defaults: store.defaults,
    users: Array.from(byLogin.values())
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((person) => {
        const key = person.login.toLowerCase();
        const admin = isPortalAdmin(person.login);
        const custom = store.users[key];
        return {
          ...person,
          isAdmin: admin,
          adminSource: isOpenMode() ? "" : adminSource(person.login),
          custom: Boolean(custom) && !admin,
          views: admin ? allViewIds : custom?.views ?? store.defaults,
          updatedAt: custom?.updatedAt || "",
          updatedBy: custom?.updatedBy || "",
        };
      }),
  };
}

export function setUserViews(login: string, name: string, views: unknown, by: AuthUser) {
  const key = String(login || "").trim().toLowerCase();
  if (!key) throw new Error("Usuario invalido.");
  if (isPortalAdmin(key)) throw new Error("Gestores sempre tem acesso a tudo.");
  return mutate((store) => {
    store.users[key] = { views: cleanViews(views), name: String(name || store.users[key]?.name || ""), updatedAt: new Date().toISOString(), updatedBy: by.login };
    return store.users[key];
  });
}

export function resetUserViews(login: string) {
  return mutate((store) => {
    delete store.users[String(login || "").trim().toLowerCase()];
    return { ok: true };
  });
}

export function setDefaultViews(views: unknown) {
  return mutate((store) => {
    store.defaults = cleanViews(views);
    return { defaults: store.defaults };
  });
}


// Bloqueio no servidor: leitura liberada para qualquer uma das telas que usa o dado;
// alteracoes so para quem tem a tela "dona" do dado.
export function requireViews(read: PortalView[], write: PortalView[] = read.slice(0, 1)) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const user = res.locals.user as AuthUser | undefined;
      if (!user) throw new AccessDenied("Nao autenticado.");
      const views = await getUserViews(user.login);
      const isRead = req.method === "GET" || req.method === "HEAD";
      const needed = isRead ? read : write;
      if (!needed.some((view) => views.includes(view))) {
        throw new AccessDenied("Voce nao tem permissao para acessar esta area. Fale com o gestor.");
      }
      next();
    } catch (error) {
      const status = error instanceof AccessDenied ? 403 : 500;
      res.status(status).json({ ok: false, message: error instanceof Error ? error.message : "Acesso negado." });
    }
  };
}

export function requireAdmin(_req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.user as AuthUser | undefined;
  if (!user || !isPortalAdmin(user.login)) {
    res.status(403).json({ ok: false, message: "Somente gestores podem gerenciar acessos." });
    return;
  }
  next();
}
