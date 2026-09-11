import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import { createServer } from "node:http";
import { PersistentWorldService, hashWorldToken } from "../../src/server/trpg/world/service.js";
import { FileWorldStore, MemoryWorldStore } from "../../src/server/trpg/world/store.js";
import { mountPersistentWorldRoutes } from "../../src/server/trpg/world/routes.js";

const content = {
  revision: "test-v1", time: { scale: 60 },
  regions: [{ id: "farm", name: "田園の村", worldPosition: [0, 0], secret: "hidden-region-cause" }],
  routes: [], npcs: [{ id: "npc", knowledge: ["private-belief"] }],
  skills: [{ id: "skill", name: "乗馬", privateUnlockFlag: "hidden-condition" }], items: [],
  events: [{ id: "secret-crisis", cause: "private-conspiracy" }],
};

const simulation = {
  createWorld() {
    return { schemaVersion: 1, time: 21600, input: { x: 0, z: 0 }, player: { name: "旅人", position: [0, 0, 0], gold: 100 }, privateBeliefs: ["do-not-send"] };
  },
  advanceWorld(state, data, realSeconds) {
    state.time += realSeconds * data.time.scale;
    state.player.position[0] += state.input.x * realSeconds * 4;
    return state;
  },
  applyCommand(state, data, command) {
    if (command.type === "input") {
      if (!Number.isFinite(command.x) || !Number.isFinite(command.z) || Math.abs(command.x) > 1 || Math.abs(command.z) > 1) {
        throw Object.assign(new Error("Invalid input axis"), { code: "invalid_input", status: 400 });
      }
      state.input = { x: command.x, z: command.z };
      return { message: "移動" };
    }
    if (command.type === "buy") { state.player.gold -= 5; return { message: "購入しました" }; }
    if (command.type === "bad") {
      state.player.gold = 0;
      throw Object.assign(new Error("拒否"), { code: "blocked", status: 400 });
    }
    throw Object.assign(new Error("Unknown command"), { code: "unknown_command", status: 400 });
  },
  projectWorld(state) { return { time: state.time, player: structuredClone(state.player), knownEvents: [], npcs: [] }; },
};

const ownerA = hashWorldToken("owner-a");
const ownerB = hashWorldToken("owner-b");

function setup(options = {}) {
  let time = 1_000;
  const service = new PersistentWorldService({ content, simulation, store: new MemoryWorldStore(), now: () => time, autoStart: false, ...options });
  return { service, setTime: (value) => { time = value; } };
}

test("sessions project only approved public data and remain owner isolated", async () => {
  const { service } = setup();
  assert.deepEqual(await service.session(ownerA), { ok: true, session: null });
  const first = await service.session(ownerA, { create: true, name: "アオ" });
  assert.equal(first.view.player.name, "アオ");
  assert.equal(first.session.lastSeq, 0);
  assert.equal(JSON.stringify(first).includes("private"), false);
  assert.equal(JSON.stringify(first).includes("hidden"), false);
  assert.equal(JSON.stringify(first).includes("do-not-send"), false);
  assert.deepEqual(await service.session(ownerB), { ok: true, session: null });
  await assert.rejects(() => service.state(ownerB), { code: "session_not_found" });
  const resumed = await service.session(ownerA, { create: true, name: "書換不可" });
  assert.equal(resumed.session.id, first.session.id);
  assert.equal(resumed.view.player.name, "アオ");
});

test("command retry is idempotent, strict sequences serialize, failed mutation rolls back", async () => {
  const { service } = setup();
  await service.session(ownerA, { create: true });
  const request = { seq: 1, command: { type: "buy", targetId: "shop", itemId: "bread" } };
  const results = await Promise.all([service.command(ownerA, request), service.command(ownerA, request)]);
  assert.equal(results[0].view.player.gold, 95);
  assert.equal(results[1].duplicate, true);
  assert.equal(results[1].view.player.gold, 95);
  await assert.rejects(() => service.command(ownerA, { seq: 1, command: { type: "buy", itemId: "other" } }), { code: "sequence_reused" });
  await assert.rejects(() => service.command(ownerA, { seq: 3, command: { type: "buy" } }), { code: "sequence_conflict" });
  await assert.rejects(() => service.command(ownerA, { seq: 2, command: { type: "bad" } }), { code: "blocked" });
  const view = (await service.state(ownerA)).view;
  assert.equal(view.player.gold, 95);
  assert.equal(view.lastSeq, 1);
});

test("foreground heartbeats advance time without movement; request spam cannot accelerate it", async () => {
  const { service, setTime } = setup();
  await service.session(ownerA, { create: true });
  await service.command(ownerA, { seq: 1, command: { type: "input", x: 1, z: 0 } });
  setTime(1_200);
  for (let index = 0; index < 20; index += 1) await service.state(ownerA);
  assert.equal((await service.state(ownerA)).view.player.position[0], 0.8);
  for(const at of [1_500,2_000,2_500,3_000]){setTime(at);await service.state(ownerA);}
  await service.tick();
  const view = (await service.state(ownerA)).view;
  assert.equal(view.time, 21600 + 120);
  assert.equal(view.player.position[0], 2, "movement stops after 500 ms input timeout");
  await assert.rejects(() => service.command(ownerA, { seq: 2, command: { type: "input", x: 1, z: 0, position: [999, 0, 999] } }), { code: "authoritative_state_rejected" });
  await assert.rejects(() => service.command(ownerA, { seq: 2, command: { type: "input", x: 999, z: 0 } }), { code: "invalid_input" });
});

test("restart preserves saved world time and clears stale movement input", async () => {
  const store = new MemoryWorldStore();
  const first = setup({ store });
  await first.service.session(ownerA, { create: true });
  await first.service.command(ownerA, { seq: 1, command: { type: "input", x: 1, z: 0 } });
  const second = setup({ store });
  second.setTime(3_601_000);
  const resumed = await second.service.session(ownerA);
  assert.equal(resumed.view.time, 21600);
  assert.equal(resumed.view.player.position[0], 0);
  assert.equal(resumed.view.lastSeq, 1);
  const duplicate = await second.service.command(ownerA, { seq: 1, command: { type: "input", x: 1, z: 0 } });
  assert.equal(duplicate.duplicate, true);
});

test("durable write failure cannot commit a purchase to live authority", async () => {
  const store = new MemoryWorldStore();
  const { service } = setup({ store });
  await service.session(ownerA, { create: true });
  store.put = async () => { throw new Error("disk unavailable"); };
  await assert.rejects(() => service.command(ownerA, { seq: 1, command: { type: "buy" } }), /disk unavailable/u);
  assert.equal((await service.state(ownerA)).view.player.gold, 100);
  assert.equal((await service.state(ownerA)).view.lastSeq, 0);
});

test("content revisions never silently reinterpret a save and a new life is explicit", async () => {
  const store = new MemoryWorldStore();
  const first = setup({ store });
  const created = await first.service.session(ownerA, { create: true });
  const next = setup({ store, content: { ...content, revision: "test-v2" } });
  await assert.rejects(() => next.service.session(ownerA, { create: true }), { code: "content_version_mismatch" });
  assert.equal((await store.get(ownerA)).contentRevision, "test-v1");
  const restarted = await next.service.session(ownerA, { create: true, newGame: true, name: "次の旅人" });
  assert.notEqual(restarted.session.id, created.session.id);
  assert.equal(restarted.view.player.name, "次の旅人");
  assert.equal(restarted.view.lastSeq, 0);
});

test("changing content under the same revision cannot reinterpret existing saves", async () => {
  const store = new MemoryWorldStore();
  const original = setup({ store });
  await original.service.session(ownerA, { create: true });
  const changed = setup({ store, content: { ...content, time: { scale: 3600 } } });
  await assert.rejects(() => changed.service.session(ownerA), { code: "content_version_mismatch" });
  assert.equal((await store.get(ownerA)).state.time, 21600);
});

test("shutdown drains admitted creation, rejects new commands and flushes once", async () => {
  const store = new MemoryWorldStore();
  const originalPut = store.put.bind(store);
  let release, puts = 0;
  const blocked = new Promise(resolve => { release = resolve; });
  store.put = async (...args) => { puts += 1; if (puts === 1) await blocked; return originalPut(...args); };
  const { service } = setup({ store });
  const creating = service.session(ownerA, { create: true });
  await new Promise(resolve => setImmediate(resolve));
  const closing = service.close();
  assert.equal(service.close(), closing);
  await assert.rejects(() => service.command(ownerA, { seq: 1, command: { type: "buy" } }), { status: 503 });
  release();
  await creating;
  await closing;
  assert.equal(puts, 2);
  assert.equal((await store.get(ownerA)).state.player.gold, 100);
});

test("an uncertain write outcome reloads durable receipts before command retry", async () => {
  const store = new MemoryWorldStore();
  const originalPut = store.put.bind(store);
  const { service } = setup({ store });
  await service.session(ownerA, { create: true });
  store.put = async (...args) => { await originalPut(...args); throw new Error("directory sync failed after rename"); };
  const request = { seq: 1, command: { type: "buy" } };
  await assert.rejects(() => service.command(ownerA, request), /directory sync/u);
  store.put = originalPut;
  const retry = await service.command(ownerA, request);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.view.player.gold, 95);
});

test("shutdown save failure is reported while every world gets a flush attempt", async () => {
  const store = new MemoryWorldStore();
  const { service } = setup({ store });
  await service.session(ownerA, { create: true });
  await service.session(ownerB, { create: true });
  const attempted = [];
  store.put = async owner => { attempted.push(owner); if (owner === ownerA) throw new Error("disk full"); };
  await assert.rejects(() => service.close(), AggregateError);
  assert.deepEqual(attempted.sort(), [ownerA, ownerB].sort());
});

test("file saves atomically replace and reject traversal keys", async (t) => {
  const temporaryRoot = path.resolve("work");
  await fs.mkdir(temporaryRoot, { recursive: true });
  const directory = await fs.mkdtemp(path.join(temporaryRoot, "world-store-test-"));
  t.after(async () => {
    assert.ok(path.resolve(directory).startsWith(`${temporaryRoot}${path.sep}`));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const store = new FileWorldStore({ directory });
  await store.put(ownerA, { revision: 1, state: { gold: 50 } });
  await store.put(ownerA, { revision: 2, state: { gold: 45 } });
  assert.deepEqual(await store.get(ownerA), { revision: 2, state: { gold: 45 } });
  assert.deepEqual(await fs.readdir(directory), [`${ownerA}.json`]);
  await assert.rejects(() => store.get("../../escape"), /Invalid world save owner key/u);
});

test("HTTP ownership, secure cookies, same-origin guard and bounded parser", async (t) => {
  const { service } = setup();
  const app = express();
  mountPersistentWorldRoutes(app, { service });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await service.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (url, body, headers = {}) => fetch(`${base}/TRPG/api/world${url}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  let response = await fetch(`${base}/TRPG/api/world/session`);
  assert.deepEqual(await response.json(), { ok: true, session: null });
  response = await post("/session", { name: "ユーザーA" }, { origin: base });
  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly; SameSite=Lax/u);
  assert.match(setCookie, /Path=\/TRPG/u);
  const cookie = setCookie.split(";")[0];
  assert.equal((await response.json()).view.player.name, "ユーザーA");
  response = await post("/command", { seq: 1, command: { type: "buy" } }, { cookie, origin: "https://unrelated.example" });
  assert.equal(response.status, 403);
  response = await post("/command", { seq: 1, command: { type: "buy" } }, { cookie, origin: base });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).view.player.gold, 95);
  response = await fetch(`${base}/TRPG/api/world/state`);
  assert.equal(response.status, 404);
  response = await post("/command", { seq: 2, command: { type: "buy", padding: "a".repeat(17_000) } }, { cookie, origin: base });
  assert.equal(response.status, 413);
  response = await fetch(`${base}/TRPG/api/world/command`, { method: "POST", headers: { "content-type": "application/json", cookie, origin: base }, body: "{" });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "invalid_json");
});
