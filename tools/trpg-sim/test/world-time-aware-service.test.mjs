import assert from "node:assert/strict";
import test from "node:test";
import { deserializeRuntime, serializeRuntime } from "../../../src/server/trpg/game/serializer.js";
import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";
import {
  WorldTimeAwareTrpgGameService,
  synchronizeLifeActionWeatherRecord,
} from "../../../src/server/trpg/game/world-time-aware-service.js";
import { resolveCanonicalWeather } from "../../../src/server/trpg/resolvers/weather-resolver.js";

test("生活actionで日付・時間帯が変わった保存状態の天候を正本スケジュールへ同期する", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new WorldTimeAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create("world-time-weather-owner", {
    playerName: "天候同期テスト",
    seed: "world-time-weather-test",
  });
  const record = await store.get(created.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);

  runtime.playerState.absoluteMinute = 2 * 1440 + 17 * 60;
  runtime.playerState.day = 3;
  runtime.playerState.hour = 23;
  runtime.playerState.minute = 0;
  runtime.playerState.minuteOfDay = 1380;
  runtime.playerState.phaseIndex = 3;
  runtime.playerState.daypart = "night";
  runtime.playerState.player.location = "森";
  runtime.playerState.weather = resolveCanonicalWeather({
    day: 1,
    regionId: "田園の村",
    daypart: "morning",
  });

  record.revision = 1;
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = "stale-weather-state-hash";
  record.commandLog.push({
    seq: 1,
    commandId: "life-action-crossed-weather-boundary",
    revisionBefore: 0,
    revisionAfter: 1,
    stateBeforeHash: "before",
    stateAfterHash: "stale-weather-state-hash",
    type: "CHOOSE",
    payload: { choiceId: "LODGE:LOC_FOREST_CAMP:0", actionId: "" },
    resolvedActionId: "LODGE:LOC_FOREST_CAMP:0",
    outcome: { ok: true, type: "rest", minutes: 480 },
  });

  assert.equal(synchronizeLifeActionWeatherRecord(record, game.data), true);
  const normalized = deserializeRuntime(record.runtimeSnapshot, game.data);
  const expected = resolveCanonicalWeather({
    day: 3,
    regionId: "森",
    daypart: "night",
  });
  assert.equal(normalized.playerState.weather.scheduleKey, expected.scheduleKey);
  assert.equal(normalized.playerState.weather.id, expected.id);
  assert.notEqual(record.stateHash, "stale-weather-state-hash");
  assert.equal(record.commandLog.at(-1).stateAfterHash, record.stateHash);
  assert.equal(record.replayBase.revision, 1);
  assert.equal(record.replayBase.stateHash, record.stateHash);
  assert.deepEqual(record.replayBase.runtimeSnapshot, record.runtimeSnapshot);
  assert.equal(synchronizeLifeActionWeatherRecord(record, game.data), false);
});

test("生活action以外のcommandでは天候同期層を追加実行しない", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new WorldTimeAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create("world-time-non-life-owner", {
    playerName: "非生活actionテスト",
    seed: "world-time-non-life-test",
  });
  const original = game.recordForOwner.bind(game);
  let recordReads = 0;
  game.recordForOwner = async (...args) => {
    recordReads += 1;
    return original(...args);
  };

  const result = await game.command("world-time-non-life-owner", created.id, {
    commandId: "ack-tutorial-without-weather-reconcile",
    expectedRevision: created.revision,
    type: "TUTORIAL_ACK",
    payload: { tutorialId: created.tutorial?.id ?? "" },
  });
  assert.equal(result.duplicate, false);
  assert.equal(recordReads, 0);
});
