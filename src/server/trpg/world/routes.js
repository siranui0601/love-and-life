import crypto from "node:crypto";
import express from "express";
import { PersistentWorldService, WorldServiceError, hashWorldToken } from "./service.js";

const COOKIE_NAME = "trpg_world_resume";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

function readToken(req) {
  for (const item of String(req.headers.cookie ?? "").split(";")) {
    const [name, ...value] = item.trim().split("=");
    if (name !== COOKIE_NAME) continue;
    const token = value.join("=");
    if (TOKEN_PATTERN.test(token)) return token;
  }
  return null;
}

function sameOrigin(req) {
  if (req.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ["https:", "http:"].includes(url.protocol) && url.host.toLowerCase() === String(req.get("host") ?? "").toLowerCase();
  } catch { return false; }
}

class WindowLimiter {
  constructor() { this.windows = new Map(); }
  consume(key, limit, intervalMs) {
    const now = Date.now();
    let entry = this.windows.get(key);
    if (!entry || now >= entry.until) entry = { count: 0, until: now + intervalMs };
    entry.count += 1;
    this.windows.set(key, entry);
    if (this.windows.size > 10_000) {
      for (const [item, value] of this.windows) if (now >= value.until) this.windows.delete(item);
      if (this.windows.size > 10_000) this.windows.delete(this.windows.keys().next().value);
    }
    return entry.count <= limit;
  }
}

function sendError(res, error) {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
  if (status >= 500) console.error("Persistent world request failed:", error.message);
  return res.status(status).json({
    ok: false,
    error: status >= 500 ? (status === 503 ? "world_service_stopping" : "world_service_unavailable") : (error.code ?? "command_rejected"),
    message: status >= 500 ? "世界の保存・読込に失敗しました。しばらくしてから再接続してください。" : error.message,
  });
}

export function mountPersistentWorldRoutes(app, options = {}) {
  const service = options.service ?? new PersistentWorldService(options);
  const router = express.Router();
  const limiter = new WindowLimiter();
  router.use((req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    const token = readToken(req);
    const address = req.socket?.remoteAddress ?? "unknown";
    const key = token ? hashWorldToken(token) : address;
    if (!limiter.consume(`network:${address}`, 3_000, 60_000) || !limiter.consume(`owner:${key}`, 1_800, 60_000)) {
      res.set("Retry-After", "60");
      return res.status(429).json({ ok: false, error: "rate_limit_exceeded", message: "通信が集中しています。少し待って再接続してください。" });
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !sameOrigin(req)) {
      return res.status(403).json({ ok: false, error: "cross_origin_command_rejected", message: "別のサイトから操作できません。" });
    }
    req.worldOwnerKey = token ? hashWorldToken(token) : null;
    next();
  });
  router.use(express.json({ limit: "16kb", strict: true }));

  router.get("/session", async (req, res) => {
    try {
      return res.json(req.worldOwnerKey ? await service.session(req.worldOwnerKey) : { ok: true, session: null });
    } catch (error) { return sendError(res, error); }
  });

  router.post("/session", async (req, res) => {
    try {
      const address = req.socket?.remoteAddress ?? "unknown";
      if ((!req.worldOwnerKey || req.body?.newGame === true) && !limiter.consume(`create:${address}`, 12, 3_600_000)) {
        throw new WorldServiceError(429, "session_create_limit", "新しい旅の作成回数が上限に達しました。時間をおいてください。");
      }
      let token;
      if (!req.worldOwnerKey) {
        token = crypto.randomBytes(32).toString("base64url");
        req.worldOwnerKey = hashWorldToken(token);
      }
      const response = await service.session(req.worldOwnerKey, { create: true, name: req.body?.name, newGame: req.body?.newGame === true });
      // Do not set an orphan resume cookie when creation/storage failed.
      if (token) {
        const secure = req.secure || String(req.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
        res.append("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/TRPG; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? "; Secure" : ""}`);
      }
      return res.json(response);
    } catch (error) { return sendError(res, error); }
  });

  router.get("/state", async (req, res) => {
    try {
      if (!req.worldOwnerKey) throw new WorldServiceError(404, "session_not_found", "新しい旅を始めてください。");
      return res.json(await service.state(req.worldOwnerKey));
    } catch (error) { return sendError(res, error); }
  });

  router.post("/presence", async (req,res) => {
    try {
      if(!req.worldOwnerKey) throw new WorldServiceError(404,"session_not_found","新しい旅を始めてください。");
      return res.json(await service.presence(req.worldOwnerKey,req.body?.active));
    } catch(error) { return sendError(res,error); }
  });

  router.post("/command", async (req, res) => {
    try {
      if (!req.worldOwnerKey) throw new WorldServiceError(404, "session_not_found", "新しい旅を始めてください。");
      return res.json(await service.command(req.worldOwnerKey, req.body));
    } catch (error) { return sendError(res, error); }
  });

  router.use((error, req, res, next) => {
    if (error?.type === "entity.too.large") return res.status(413).json({ ok: false, error: "world_command_body_too_large", message: "操作データが大きすぎます。" });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ ok: false, error: "invalid_json", message: "操作データを読めません。" });
    return sendError(res, error);
  });

  app.use("/TRPG/api/world", router);
  app.locals.worldService = service;
  return service;
}
