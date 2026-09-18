import crypto from "node:crypto";
import express from "express";
import { sessionSecret } from "./config";

export type AuthUser = {
  login: string;
  name: string;
  domain: string;
  department: string;
};

type TokenPayload = {
  user: AuthUser;
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

export function createSessionToken(user: AuthUser) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      user,
      exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
    } satisfies TokenPayload),
  );
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifySessionToken(token: string) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;

  const unsigned = `${header}.${payload}`;
  const expected = sign(unsigned);
  const received = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (received.length !== expectedBuffer.length || !crypto.timingSafeEqual(received, expectedBuffer)) {
    return null;
  }

  const parsed = JSON.parse(base64UrlDecode(payload)) as TokenPayload;
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return parsed.user;
}

export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const user = token ? verifySessionToken(token) : null;

  if (!user) {
    res.status(401).json({ ok: false, message: "Sessao expirada ou nao autenticada." });
    return;
  }

  res.locals.user = user;
  next();
}
