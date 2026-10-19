import crypto from "node:crypto";
import express from "express";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { AuthUser } from "./auth";

// Chaves de TV: acesso somente leitura ao Painel NOC, sem login pessoal e sem expirar em 8h.
// Guardamos so o hash da chave; ela e mostrada uma unica vez na criacao.

type TvKey = { id: string; name: string; hash: string; createdAt: string; createdBy: string; lastUsedAt: string };

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "tv-keys.json");

function load(): TvKey[] {
  try {
    const raw = JSON.parse(fsSync.readFileSync(storePath, "utf8")) as { keys?: TvKey[] };
    return Array.isArray(raw.keys) ? raw.keys : [];
  } catch {
    return [];
  }
}

let keys = load();

async function persist() {
  await fs.mkdir(dataDir, { recursive: true });
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify({ keys }, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, storePath);
}

const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export function listTvKeys() {
  return keys.map(({ hash: _hash, ...rest }) => rest);
}

export async function createTvKey(name: string, by: AuthUser) {
  const secret = crypto.randomBytes(24).toString("base64url");
  const key: TvKey = {
    id: crypto.randomUUID().slice(0, 12),
    name: String(name || "TV").trim().slice(0, 60) || "TV",
    hash: hash(secret),
    createdAt: new Date().toISOString(),
    createdBy: by.login,
    lastUsedAt: "",
  };
  keys = [...keys, key];
  await persist();
  return { id: key.id, name: key.name, key: secret };
}

export async function revokeTvKey(id: string) {
  keys = keys.filter((key) => key.id !== id);
  await persist();
  return { ok: true };
}

let lastPersist = 0;

// Aceita sessao normal OU cabecalho X-TV-Key (somente leitura, so nas rotas do painel).
export function allowTvKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  const provided = req.header("x-tv-key") || "";
  if (!provided || res.locals.user) {
    next();
    return;
  }
  if (req.method !== "GET") {
    res.status(403).json({ ok: false, message: "Chave de TV e somente leitura." });
    return;
  }
  const digest = hash(provided);
  const match = keys.find((key) => crypto.timingSafeEqual(Buffer.from(key.hash), Buffer.from(digest)));
  if (!match) {
    res.status(401).json({ ok: false, message: "Chave de TV invalida ou revogada." });
    return;
  }
  match.lastUsedAt = new Date().toISOString();
  if (Date.now() - lastPersist > 10 * 60 * 1000) {
    lastPersist = Date.now();
    persist().catch(() => undefined);
  }
  res.locals.user = { login: `tv:${match.name}`, name: `TV ${match.name}`, domain: "", department: "" } satisfies AuthUser;
  res.locals.tvKey = match.id;
  next();
}
