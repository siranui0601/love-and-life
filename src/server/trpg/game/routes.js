import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import { TrpgRuntimeAssetManager } from "../assets/runtime.js";
import { TrpgGameError, hashResumeToken } from "./service.js";
import { createSurvivalAwareTrpgGameService } from "./survival-aware-service.js";

const COOKIE_NAME = "trpg_resume";

class FixedWindowLimiter {
  constructor(limit, windowMs, maximumKeys = 5_000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maximumKeys = maximumKeys;
    this.entries = new Map();
  }

  consume(key) {
    const now = Date.now();
    let entry = this.entries.get(key);
    if (!entry || now - entry.startedAt >= this.windowMs) entry = { startedAt: now, count: 0 };
    entry.count += 1;
    this.entries.set(key, entry);
    if (this.entries.size > this.maximumKeys) this.entries.delete(this.entries.keys().next().value);
    return {
      allowed: entry.count <= this.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.startedAt + this.windowMs - now) / 1_000)),
    };
  }
}

function enforceRateLimit(res, limiter, key) {
  const result = limiter.consume(key);
  if (result.allowed) return true;
  res.set("Retry-After", String(result.retryAfterSeconds));
  res.status(429).json({ ok: false, error: "rate_limit_exceeded" });
  return false;
}

export function trpgRequestAddress(req) {
  const direct = String(req.socket?.remoteAddress ?? "unknown");
  const loopback = direct === "127.0.0.1" || direct === "::1" || direct === "::ffff:127.0.0.1";
  if (loopback) {
    const chain = String(req.get("x-forwarded-for") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    const forwarded = chain.at(-1);
    if (net.isIP(forwarded)) return forwarded;
  }
  return direct;
}

function cookies(header) {
  return Object.fromEntries(String(header ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      if (index < 0) return [part, ""];
      const raw = part.slice(index + 1, index + 257);
      try { return [part.slice(0, index), decodeURIComponent(raw)]; } catch { return [part.slice(0, index), raw]; }
    }));
}

function owner(req, res, { create = false } = {}) {
  let token = cookies(req.headers.cookie)[COOKIE_NAME];
  if (!token && create) {
    token = crypto.randomBytes(32).toString("base64url");
    const forwarded = String(req.get("x-forwarded-proto") ?? "").split(",")[0].trim();
    const secure = req.secure || forwarded === "https";
    res.append("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/TRPG; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? "; Secure" : ""}`);
  }
  return token ? hashResumeToken(token) : null;
}

function sameOrigin(req) {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.host.toLowerCase() === String(req.get("host") ?? "").trim().toLowerCase();
  } catch {
    return false;
  }
}

function sendError(res, error) {
  if (error instanceof TrpgGameError) {
    return res.status(error.status).json({ ok: false, error: error.code, message: error.message, details: error.details });
  }
  console.error("TRPG game route failed", error);
  return res.status(500).json({ ok: false, error: "internal_error" });
}

export function mountTrpgGameRoutes(app, options = {}) {
  const service = options.service ?? createSurvivalAwareTrpgGameService(options);
  const assetManager = options.assetManager ?? new TrpgRuntimeAssetManager({
    data: service.data,
    ...(options.assetOptions ?? {}),
  });
  const readLimiter = new FixedWindowLimiter(120, 60_000);
  const commandLimiter = new FixedWindowLimiter(60, 60_000);
  const replayLimiter = new FixedWindowLimiter(3, 60_000);
  const networkReadLimiter = new FixedWindowLimiter(240, 60_000);
  const networkCommandLimiter = new FixedWindowLimiter(180, 60_000);
  const networkReplayLimiter = new FixedWindowLimiter(10, 60_000);
  const createLimiter = new FixedWindowLimiter(6, 60 * 60_000);

  const enqueueVisibleAssets = (save) => {
    try {
      assetManager.enqueueForSave(save);
    } catch (error) {
      console.warn("TRPG asset queue rejected a game view", String(error?.message ?? error).slice(0, 240));
    }
  };

  app.get("/TRPG/assets/manifest.json", async (req, res) => {
    try {
      res.set("Cache-Control", "no-cache, max-age=0, must-revalidate");
      return res.json(await assetManager.combinedManifest());
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/TRPG/assets/generated/:kind/:file", async (req, res) => {
    try {
      const filePath = assetManager.generatedFilePath(req.params.kind, req.params.file);
      if (!filePath) return res.status(404).send("not found");
      await fs.access(filePath);
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      res.set("X-Content-Type-Options", "nosniff");
      return res.sendFile(filePath);
    } catch {
      return res.status(404).send("not found");
    }
  });

  app.get("/TRPG/api/game/health", (req, res) => {
    res.json({
      ...service.health(),
      assetGeneration: typeof assetManager.health === "function" ? assetManager.health() : { enabled: false },
    });
  });

  app.get("/TRPG/api/game/saves", async (req, res) => {
    try {
      if (!enforceRateLimit(res, networkReadLimiter, trpgRequestAddress(req))) return;
      const ownerHash = owner(req, res);
      if (ownerHash && !enforceRateLimit(res, readLimiter, ownerHash)) return;
      return res.json({ ok: true, saves: ownerHash ? await service.list(ownerHash) : [] });
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/TRPG/api/game/saves", async (req, res) => {
    if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: "cross_origin_command_rejected" });
    try {
      if (!enforceRateLimit(res, createLimiter, trpgRequestAddress(req))) return;
      const ownerHash = owner(req, res, { create: true });
      if (!enforceRateLimit(res, commandLimiter, ownerHash)) return;
      const save = await service.create(ownerHash, req.body ?? {});
      enqueueVisibleAssets(save);
      return res.status(201).json({ ok: true, save });
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/TRPG/api/game/saves/:saveId", async (req, res) => {
    try {
      if (!enforceRateLimit(res, networkReadLimiter, trpgRequestAddress(req))) return;
      const ownerHash = owner(req, res);
      if (!ownerHash) throw new TrpgGameError(404, "save_not_found");
      if (!enforceRateLimit(res, readLimiter, ownerHash)) return;
      const save = await service.get(ownerHash, req.params.saveId);
      enqueueVisibleAssets(save);
      return res.json({ ok: true, save });
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.post("/TRPG/api/game/saves/:saveId/commands", async (req, res) => {
    if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: "cross_origin_command_rejected" });
    try {
      if (!enforceRateLimit(res, networkCommandLimiter, trpgRequestAddress(req))) return;
      const ownerHash = owner(req, res);
      if (!ownerHash) throw new TrpgGameError(404, "save_not_found");
      if (!enforceRateLimit(res, commandLimiter, ownerHash)) return;
      const result = await service.command(ownerHash, req.params.saveId, req.body ?? {});
      enqueueVisibleAssets(result.save);
      return res.json({ ok: true, ...result });
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.delete("/TRPG/api/game/saves/:saveId", async (req, res) => {
    if (!sameOrigin(req)) return res.status(403).json({ ok: false, error: "cross_origin_command_rejected" });
    try {
      if (!enforceRateLimit(res, networkCommandLimiter, trpgRequestAddress(req))) return;
      const ownerHash = owner(req, res);
      if (!ownerHash) throw new TrpgGameError(404, "save_not_found");
      if (!enforceRateLimit(res, commandLimiter, ownerHash)) return;
      const deleted = await service.delete(ownerHash, req.params.saveId);
      return res.json({ ok: true, deleted });
    } catch (error) {
      return sendError(res, error);
    }
  });

  app.get("/TRPG/api/game/saves/:saveId/replay-verification", async (req, res) => {
    try {
      if (!enforceRateLimit(res, networkReplayLimiter, trpgRequestAddress(req))) return;
      const ownerHash = owner(req, res);
      if (!ownerHash) throw new TrpgGameError(404, "save_not_found");
      if (!enforceRateLimit(res, replayLimiter, ownerHash)) return;
      const verification = await service.verifyReplay(ownerHash, req.params.saveId);
      return res.status(verification.ok ? 200 : 409).json(verification);
    } catch (error) {
      return sendError(res, error);
    }
  });

  return service;
}
