import {canMigrateContent} from "./content-migration.js";
import crypto from "node:crypto";
import fs from "node:fs";
import * as simulationRuntime from "../../../shared/trpg-world/simulation.js";
import { FileWorldStore } from "./store.js";
import { migrateWorld } from "../../../shared/trpg-world/activity.js";
import {CachedNarrativeProvider,DeterministicTemplateProvider,narrativeEnvelope} from './narrative.js';

const CONTENT_URL = new URL("./content/world-content.json", import.meta.url);
const INPUT_TIMEOUT_MS = 500;
const MAX_RECEIPTS = 64;
const IDLE_UNLOAD_MS = 60_000;
const PRESENCE_GAP_MS = 1_000;

export class WorldServiceError extends Error {
  constructor(status, code, message = code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function hashWorldToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function pick(source, fields) {
  return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

function publicContent(content) {
  return {
    regions: content.regions.map((region) => pick(region, ["id", "name", "biome", "color", "worldPosition", "description"])),
    routes: content.routes.map((route) => pick(route, ["id", "from", "to", "minutes", "modes"])),
    skills: content.skills.map((skill) => pick(skill, ["id", "name", "description", "kind", "type", "cost", "price", "spCost", "level", "requiredLevel", "mpCost", "cooldown", "prerequisites"])),
    items: content.items.map((item) => pick(item, ["id", "name", "description", "kind", "type", "price", "value", "stats"])),
  };
}

/** Owns elapsed wall time; clients can submit only bounded intent, never a clock/position. */
export class PersistentWorldService {
  constructor({
    content = JSON.parse(fs.readFileSync(CONTENT_URL, "utf8")),
    store = new FileWorldStore(),
    now = Date.now,
    simulation = simulationRuntime,
    tickMs = 100,
    saveIntervalMs = 5_000,
    autoStart = true,
    narrativeProvider = new DeterministicTemplateProvider(),
  } = {}) {
    this.content = content;
    this.contentHash = hashWorldToken(JSON.stringify(content));
    this.catalog = publicContent(content);
    this.store = store;
    this.now = now;
    this.sim = simulation;
    this.narrative = new CachedNarrativeProvider(narrativeProvider);
    this.saveIntervalMs = saveIntervalMs;
    this.sessions = new Map();
    this.locks = new Map();
    this.timer = autoStart ? setInterval(() => { void this.tick(); }, tickMs) : null;
    this.timer?.unref();
    this.ticking = false;
    this.closing = null;
  }

  assertOpen() {
    if (this.closing) throw new WorldServiceError(503, "world_service_stopping", "世界を保存しています。少し待って再接続してください。");
  }

  async locked(key, operation) {
    const previous = this.locks.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    this.locks.set(key, current);
    try { return await current; }
    finally { if (this.locks.get(key) === current) this.locks.delete(key); }
  }

  neutralInput(record) {
    this.sim.applyCommand(record.state, this.content, { type: "input", x: 0, z: 0, ascend: 0, sprint: false });
    record.lastInputAtMs = null;
  }

  advance(record, nowMs) {
    const elapsedMs = Math.max(0, nowMs - record.advancedAtMs);
    if (!elapsedMs) return;
    // Only contiguous, confirmed foreground requests count as play time.
    // No timer extrapolates presence; a missing heartbeat discards the gap.
    if (record.suspended || elapsedMs > PRESENCE_GAP_MS) {
      this.neutralInput(record);
      record.advancedAtMs = nowMs;
      return;
    }
    const activeUntil = record.lastInputAtMs == null ? record.advancedAtMs : record.lastInputAtMs + INPUT_TIMEOUT_MS;
    const movingMs = Math.max(0, Math.min(nowMs, activeUntil) - record.advancedAtMs);
    if (movingMs > 0) this.sim.advanceWorld(record.state, this.content, movingMs / 1_000);
    if (elapsedMs > movingMs) {
      this.neutralInput(record);
      this.sim.advanceWorld(record.state, this.content, (elapsedMs - movingMs) / 1_000);
    }
    record.advancedAtMs = nowMs;
    record.revision += 1;
  }

  async load(ownerKey, { required = true } = {}) {
    let cached = this.sessions.get(ownerKey);
    if (!cached) {
      const record = await this.store.get(ownerKey);
      if (!record) {
        if (required) throw new WorldServiceError(404, "session_not_found", "新しい旅を始めてください。");
        return null;
      }
      if (![1,2].includes(record.schemaVersion) || record.ownerKey !== ownerKey || !record.state || !Number.isFinite(record.advancedAtMs)) {
        throw new WorldServiceError(409, "save_version_mismatch", "この保存データの形式を読み込めません。");
      }
      if ((record.contentRevision !== this.content.revision || record.contentHash !== this.contentHash) && !canMigrateContent(record,this.content)) {
        throw new WorldServiceError(409, "content_version_mismatch", "保存データと世界データの版が異なります。対応する世界データが必要です。");
      }
      if (this.sim === simulationRuntime) migrateWorld(record.state, this.content);
      if(record.contentRevision!==this.content.revision){
        record.contentMigration={from:record.contentRevision,to:this.content.revision,previousHash:record.contentHash??null};
        record.contentRevision=this.content.revision;record.contentHash=this.contentHash;record.state.contentRevision=this.content.revision;
      }
      record.schemaVersion = 2;
      // Restore saved simulation exactly; wall time is telemetry only.
      this.neutralInput(record);
      record.advancedAtMs = this.now();
      cached = { record, persistedAtMs: record.advancedAtMs, lastAccessAtMs: this.now() };
      this.sessions.set(ownerKey, cached);
    }
    return cached;
  }

  view(record) {
    return { ...this.sim.projectWorld(record.state, this.content), revision: record.revision, lastSeq: record.lastSeq };
  }

  envelope(record) {
    const view=this.view(record),known=new Set(view.player?.discoveredRegions||[view.player?.region]);
    return {
      ok: true,
      session: { id: record.id, revision: record.revision, lastSeq: record.lastSeq },
      view,
      content: {...this.catalog,regions:this.catalog.regions.filter(r=>known.has(r.id)),routes:this.catalog.routes.filter(r=>known.has(r.from)&&known.has(r.to))},
    };
  }

  async session(ownerKey, { create = false, name, newGame = false } = {}) {
    this.assertOpen();
    return this.locked(ownerKey, async () => {
      let cached = newGame && create ? null : await this.load(ownerKey, { required: false });
      const nowMs = this.now();
      if (!cached && !create) return { ok: true, session: null };
      if (!cached) {
        const state = this.sim.createWorld(this.content, { seed: crypto.randomBytes(4).readUInt32LE() || 1 });
        const playerName = typeof name === "string" ? name.replace(/[\u0000-\u001f\u007f]/gu, "").trim().slice(0, 32) : "";
        if (playerName) state.player.name = playerName;
        const record = {
          schemaVersion: 2, id: crypto.randomUUID(), ownerKey, contentRevision: this.content.revision, contentHash: this.contentHash,
          createdAtMs: nowMs, advancedAtMs: nowMs, revision: 0, lastSeq: 0, lastInputAtMs: null,
          receipts: [], state,
        };
        await this.store.put(ownerKey, record);
        cached = { record, persistedAtMs: nowMs, lastAccessAtMs: nowMs };
        this.sessions.set(ownerKey, cached);
      } else {
        this.neutralInput(cached.record);
        cached.record.advancedAtMs = nowMs;
        await this.persist(ownerKey, cached);
      }
      cached.lastAccessAtMs = nowMs;
      return this.envelope(cached.record);
    });
  }

  async state(ownerKey) {
    this.assertOpen();
    return this.locked(ownerKey, async () => {
      const cached = await this.load(ownerKey);
      this.advance(cached.record, this.now());
      cached.lastAccessAtMs = this.now();
      if (this.now() - cached.persistedAtMs >= this.saveIntervalMs) await this.persist(ownerKey, cached);
      return { ok: true, view: this.view(cached.record) };
    });
  }

  async presence(ownerKey, active) {
    this.assertOpen();
    return this.locked(ownerKey, async () => {
      const cached=await this.load(ownerKey);
      this.neutralInput(cached.record);
      cached.record.suspended=active!==true;
      cached.record.advancedAtMs=this.now();
      cached.lastAccessAtMs=this.now();
      await this.persist(ownerKey,cached);
      return {ok:true};
    });
  }

  async command(ownerKey, { seq, command } = {}) {
    this.assertOpen();
    if (!Number.isSafeInteger(seq) || seq < 1) throw new WorldServiceError(400, "invalid_sequence", "操作番号が正しくありません。");
    if (!command || typeof command !== "object" || Array.isArray(command) || typeof command.type !== "string") {
      throw new WorldServiceError(400, "invalid_command", "操作の形式が正しくありません。");
    }
    if (Object.hasOwn(command, "position") || Object.hasOwn(command, "time") || Object.hasOwn(command, "state")) {
      throw new WorldServiceError(400, "authoritative_state_rejected", "座標や世界時刻を直接変更できません。");
    }
    const fingerprint = crypto.createHash("sha256").update(JSON.stringify(command)).digest("hex");
    return this.locked(ownerKey, async () => {
      const cached = await this.load(ownerKey);
      const receipt = cached.record.receipts.find((entry) => entry.seq === seq);
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) throw new WorldServiceError(409, "sequence_reused", "同じ操作番号で異なる操作は送れません。");
        this.advance(cached.record, this.now());
        return { ok: true, duplicate: true, view: this.view(cached.record), result: receipt.result };
      }
      if (seq !== cached.record.lastSeq + 1) throw new WorldServiceError(409, "sequence_conflict", `操作を同期してください。次の番号: ${cached.record.lastSeq + 1}`);
      // Resolve on a candidate: rejected validation never mutates live authority.
      const candidate = structuredClone(cached.record);
      this.advance(candidate, this.now());
      let result;
      try { result = this.sim.applyCommand(candidate.state, this.content, command) ?? {}; }
      catch (error) {
        if (error.code) throw error;
        throw new WorldServiceError(400, "command_rejected", error.message);
      }
      if (command.type === "input") candidate.lastInputAtMs = this.now();
      if(result.conversation) {
        // Resolve semantics first. The provider sees a copy of an allowlisted envelope.
        result.narrative=await this.narrative.generate(narrativeEnvelope(candidate.state,result));
      }
      candidate.lastSeq = seq;
      candidate.revision += 1;
      candidate.receipts.push({ seq, fingerprint, result });
      candidate.receipts = candidate.receipts.slice(-MAX_RECEIPTS);
      try { await this.store.put(ownerKey, candidate); }
      catch (error) {
        // A filesystem error after rename has an uncertain commit outcome. Reload the
        // durable receipt on retry so an applied purchase is never applied twice.
        this.sessions.delete(ownerKey);
        throw error;
      }
      cached.record = candidate;
      cached.persistedAtMs = this.now();
      cached.lastAccessAtMs = this.now();
      return { ok: true, view: this.view(candidate), result };
    });
  }

  async persist(ownerKey, cached) {
    await this.store.put(ownerKey, cached.record);
    cached.persistedAtMs = this.now();
  }

  async tick() {
    if (this.ticking || this.closing) return;
    this.ticking = true;
    try {
      await Promise.all([...this.sessions.keys()].map((key) => this.locked(key, async () => {
        const cached = this.sessions.get(key);
        if (!cached) return;
        const unload = this.now() - cached.lastAccessAtMs > IDLE_UNLOAD_MS;
        if (unload || this.now() - cached.persistedAtMs >= this.saveIntervalMs) await this.persist(key, cached);
        // Unloading and reloading never change the world clock.
        if (unload) this.sessions.delete(key);
      })));
    } catch (error) {
      console.error("Persistent world tick failed:", error.message);
    } finally { this.ticking = false; }
  }

  close() {
    if (this.closing) return this.closing;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.closing = (async () => {
      // Include creates/commands admitted before shutdown, even if no session was cached yet.
      await Promise.allSettled([...this.locks.values()]);
      const results = await Promise.allSettled([...this.sessions.keys()].map((key) => this.locked(key, async () => {
        const cached = this.sessions.get(key);
        if (!cached) return;
        this.neutralInput(cached.record);
        await this.persist(key, cached);
      })));
      await this.store.close?.();
      const failures = results.filter(result => result.status === "rejected");
      if (failures.length) throw new AggregateError(failures.map(result => result.reason), "Some persistent worlds could not be saved during shutdown");
    })();
    return this.closing;
  }
}
