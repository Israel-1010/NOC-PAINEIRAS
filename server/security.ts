import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { isProduction } from "./config";
import type { AuthUser } from "./auth";

const dataDir = path.resolve(process.cwd(), "data");
const auditPath = path.join(dataDir, "audit.log");

export function securityHeaders(_req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (isProduction) {
    // frame-src e necessario para o portal Milvus embutido.
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https: http:",
        // CSP_CONNECT_SRC: origens extras caso o frontend use VITE_API_BASE_URL em outro host.
        `connect-src 'self' ${process.env.CSP_CONNECT_SRC || ""}`.trim(),
        "frame-src https:",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    );
  }
  next();
}

type Attempt = { failures: number; firstFailureAt: number; blockedUntil: number };

// Bloqueio por tentativas erradas: desligado por enquanto (fase de testes).
// Para religar, defina LOGIN_THROTTLE=true no ambiente do container.
const throttleEnabled = process.env.LOGIN_THROTTLE === "true";
const loginWindowMs = 15 * 60 * 1000;
const maxFailures = 5;
const blockMs = 15 * 60 * 1000;
const attempts = new Map<string, Attempt>();

function attemptKeys(req: express.Request) {
  const ip = req.ip || req.socket.remoteAddress || "desconhecido";
  const login = String(req.body?.login || "").trim().toLowerCase();
  return [`ip:${ip}`, `login:${login}`];
}

export function checkLoginThrottle(req: express.Request) {
  if (!throttleEnabled) return "";
  const now = Date.now();
  for (const key of attemptKeys(req)) {
    const entry = attempts.get(key);
    if (entry && entry.blockedUntil > now) {
      const minutes = Math.ceil((entry.blockedUntil - now) / 60000);
      return `Muitas tentativas de login. Tente novamente em ${minutes} min.`;
    }
  }
  return "";
}

export function registerLoginFailure(req: express.Request) {
  if (!throttleEnabled) return;
  const now = Date.now();
  for (const key of attemptKeys(req)) {
    const entry = attempts.get(key);
    const fresh = !entry || now - entry.firstFailureAt > loginWindowMs;
    const next: Attempt = fresh
      ? { failures: 1, firstFailureAt: now, blockedUntil: 0 }
      : { ...entry, failures: entry.failures + 1 };
    if (next.failures >= maxFailures) next.blockedUntil = now + blockMs;
    attempts.set(key, next);
  }
}

export function clearLoginFailures(req: express.Request) {
  for (const key of attemptKeys(req)) attempts.delete(key);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.blockedUntil < now && now - entry.firstFailureAt > loginWindowMs) attempts.delete(key);
  }
}, 5 * 60 * 1000).unref();

const sensitiveKeys = /password|senha|secret|token|key|community|value/i;

function redact(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  if (Array.isArray(body)) return body.length > 20 ? `[${body.length} itens]` : body.map(redact);
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([key, value]) => [
      key,
      sensitiveKeys.test(key) ? "***" : redact(value),
    ]),
  );
}

let auditQueue = Promise.resolve();

export function writeAudit(entry: Record<string, unknown>) {
  const line = `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`;
  auditQueue = auditQueue
    .then(async () => {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.appendFile(auditPath, line, "utf8");
    })
    .catch((error) => console.error("[auditoria] falha ao gravar:", error));
}

// Registra toda requisicao que altera dados, com o usuario autenticado e o resultado.
export function auditMutations(req: express.Request, res: express.Response, next: express.NextFunction) {
  const readOnlyPost = req.originalUrl.startsWith("/api/topology/ping") || req.originalUrl.startsWith("/api/snmp/test");
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS" || readOnlyPost) {
    next();
    return;
  }

  res.on("finish", () => {
    const user = res.locals.user as AuthUser | undefined;
    if (!user) return;
    writeAudit({
      user: user.login,
      ip: req.ip,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      body: req.originalUrl.startsWith("/api/topology")
        ? "[topologia]"
        : /\/images(\/|$|\?)/.test(req.originalUrl)
          ? { imagem: String((req.body as { name?: unknown })?.name || "[imagem]"), tipo: String((req.body as { mimeType?: unknown })?.mimeType || "") }
          : redact(req.body),
    });
  });
  next();
}
