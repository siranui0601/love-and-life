import assert from "node:assert/strict";
import test from "node:test";
import { deserializeRuntime, serializeRuntime } from "../../../src/server/trpg/game/serializer.js";
import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";
import { gameStateHash } from "../../../src/server/trpg/game/service.js";
import { WorldTimeAwareTrpgGameService } from "../../../src/server/trpg/game/world-time-aware-service.js";

function injectSerializationBoundaryMismatch(record, game) {
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  runtime.playerState.authoritativePresentNpcIds = new Set(["NPC032", "NPC001"]);
  record.revision += 1;
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = "pre-serialization-runtime-hash";
  record.commandLog.push({
    seq: record.commandLog.length + 1,
    commandId: "t13-render-boundary-command",
    revisionBefore: record.revision - 1,
    revisionAfter: record.revision,
    stateBeforeHash: "before",
    stateAfterHash: "pre-serialization-runtime-hash",
    type: "CHOOSE",
    payload: {
      choiceId: "MISSION_FLOW:forest-king-slime-world-tree-collapse:NAVIGATOR_ROUTE:safe_separation:mina_anchor_pump_design",
      actionId: "",
    },
    resolvedActionId: "MISSION_FLOW:forest-king-slime-world-tree-collapse:NAVIGATOR_ROUTE:safe_separation:mina_anchor_pump_design",
    outcome: { ok: true, type: "plan" },
  });
}

test("通常command直後のレスポンス画面を作る前に保存hashを正規化する", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new WorldTimeAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create("render-boundary-owner", {
    playerName: "画面境界テスト",
    seed: "render-boundary-test",
  });
  const record = await store.get(created.id);
  injectSerializationBoundaryMismatch(record, game);

  assert.doesNotThrow(() => game.gameViewForRecord(record));
  const normalized = deserializeRuntime(record.runtimeSnapshot, game.data);
  assert.equal(record.stateHash, gameStateHash(normalized, game.data));
  assert.equal(record.commandLog.at(-1).stateAfterHash, record.stateHash);
  assert.equal(record.replayBase.revision, record.revision);
  assert.equal(record.replayBase.stateHash, record.stateHash);
});

test("不整合な既存保存をGET時に修復して永続化し、次commandの前提hashを維持する", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new WorldTimeAwareTrpgGameService({ store, allowCustomSeed: true });
  const owner = "get-boundary-owner";
  const created = await game.create(owner, {
    playerName: "GET境界テスト",
    seed: "get-boundary-test",
  });
  const record = await store.get(created.id);
  injectSerializationBoundaryMismatch(record, game);
  await store.put(record);

  const view = await game.get(owner, created.id);
  assert.equal(view.revision, record.revision);

  const stored = await store.get(created.id);
  const normalized = deserializeRuntime(stored.runtimeSnapshot, game.data);
  assert.equal(stored.stateHash, gameStateHash(normalized, game.data));
  assert.equal(stored.commandLog.at(-1).stateAfterHash, stored.stateHash);
  assert.equal(stored.replayBase.revision, stored.revision);
  assert.equal(stored.replayBase.stateHash, stored.stateHash);
  assert.deepEqual(stored.replayBase.runtimeSnapshot, stored.runtimeSnapshot);
});
