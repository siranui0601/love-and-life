import assert from "node:assert/strict";
import test from "node:test";
import { ensurePlayerNeeds } from "../lib/player-needs.mjs";
import { deserializeRuntime, serializeRuntime } from "../../../src/server/trpg/game/serializer.js";
import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";
import {
  compactPlayableRuntime,
  gameStateHash,
  TRPG_GAME_RESOLVER_VERSION,
} from "../../../src/server/trpg/game/service.js";
import {
  WORLD_TIME_AWARE_SERVICE_VERSION,
  WorldTimeAwareTrpgGameService,
  applySustenanceChoices,
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

test("空腹だけが危険域なら効果のない屋外休息を外し、食事代を働いて払う通常actionを公開する", () => {
  const data = {
    model: {
      facilityById: {
        LOC_CAP_MARKET: { id: "LOC_CAP_MARKET", name: "中央市場" },
      },
    },
  };
  const view = {
    clock: { day: 37, hour: 13, time: "13:20" },
    scene: { location: "王都", facilityId: "LOC_CAP_MARKET" },
    player: {
      freeMeals: 0,
      freeLodging: 0,
      needs: { hunger: 90, fatigue: 40 },
    },
    choices: [
      {
        choiceId: "REST_OUTDOOR:LOC_CAP_MARKET",
        actionId: "REST_OUTDOOR:LOC_CAP_MARKET",
        type: "rest",
        label: "現在地で短く休息する",
      },
      {
        choiceId: "INSPECT:LOC_CAP_MARKET:1",
        actionId: "INSPECT:LOC_CAP_MARKET:1",
        type: "investigate",
        label: "市場を調べる",
      },
    ],
  };

  const decorated = applySustenanceChoices(view, data);
  assert.deepEqual(decorated.choices.map((choice) => choice.actionId), [
    "WORK_MEAL:LOC_CAP_MARKET",
    "INSPECT:LOC_CAP_MARKET:1",
  ]);
  assert.strictEqual(view.choices.length, 2);
});

test("疲労または夜間の休息は維持し、健康時にはまかない労働を追加しない", () => {
  const data = {
    model: {
      facilityById: {
        LOC_CAP_MARKET: { id: "LOC_CAP_MARKET", name: "中央市場" },
      },
    },
  };
  const tired = {
    clock: { day: 37, hour: 13, time: "13:20" },
    scene: { location: "王都", facilityId: "LOC_CAP_MARKET" },
    player: { freeMeals: 0, needs: { hunger: 40, fatigue: 82 } },
    choices: [{ choiceId: "REST_OUTDOOR:LOC_CAP_MARKET", actionId: "REST_OUTDOOR:LOC_CAP_MARKET" }],
  };
  assert.deepEqual(applySustenanceChoices(tired, data).choices.map((choice) => choice.actionId), [
    "REST_OUTDOOR:LOC_CAP_MARKET",
  ]);

  const healthy = {
    ...tired,
    clock: { day: 37, hour: 14, time: "14:00" },
    player: { freeMeals: 0, needs: { hunger: 40, fatigue: 35 } },
    choices: [],
  };
  assert.strictEqual(applySustenanceChoices(healthy, data), healthy);
});

test("まかない労働を通常commandで実行し、時刻・空腹・疲労・保存hash・replay基点を更新する", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new WorldTimeAwareTrpgGameService({ store, allowCustomSeed: true });
  const owner = "world-time-work-meal-owner";
  const created = await game.create(owner, {
    playerName: "まかない労働テスト",
    seed: "world-time-work-meal-test",
  });
  const record = await store.get(created.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  const player = runtime.playerState.player;
  ensurePlayerNeeds(player);
  player.facilityId = "LOC_FARM_INN";
  player.freeMeals = 0;
  player.needs.hunger = 90;
  player.needs.fatigue = 40;
  const beforeAbsoluteMinute = runtime.playerState.absoluteMinute;
  record.resolverVersion = TRPG_GAME_RESOLVER_VERSION;
  compactPlayableRuntime(runtime);
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = gameStateHash(runtime, game.data);
  record.replayBase = {
    resolverVersion: record.resolverVersion,
    revision: record.revision,
    stateHash: record.stateHash,
    runtimeSnapshot: record.runtimeSnapshot,
  };
  await store.put(record);

  const before = await game.get(owner, created.id);
  assert.ok(before.choices.some((choice) => choice.actionId === "WORK_MEAL:LOC_FARM_INN"));
  assert.ok(!before.choices.some((choice) => choice.actionId === "REST_OUTDOOR:LOC_FARM_INN"));

  const result = await game.command(owner, created.id, {
    commandId: "work-meal-command-1",
    expectedRevision: before.revision,
    type: "CHOOSE",
    payload: { choiceId: "WORK_MEAL:LOC_FARM_INN", actionId: "" },
  });
  assert.equal(result.duplicate, false);
  assert.equal(result.save.revision, before.revision + 1);
  assert.ok(result.save.player.needs.hunger < 72);
  assert.ok(result.save.player.needs.fatigue > 40);

  const stored = await store.get(created.id);
  const afterRuntime = deserializeRuntime(stored.runtimeSnapshot, game.data);
  assert.equal(afterRuntime.playerState.absoluteMinute, beforeAbsoluteMinute + 120);
  assert.equal(stored.commandLog.at(-1).resolvedActionId, "WORK_MEAL:LOC_FARM_INN");
  assert.equal(stored.commandLog.at(-1).outcome.type, "work_meal");
  assert.equal(stored.commandLog.at(-1).stateAfterHash, stored.stateHash);
  assert.equal(stored.replayBase.revision, stored.revision);
  assert.equal(stored.replayBase.stateHash, stored.stateHash);
  assert.deepEqual(stored.replayBase.runtimeSnapshot, stored.runtimeSnapshot);
  const verification = await game.verifyReplay(owner, created.id);
  assert.equal(verification.ok, true);
});

test("本番サービスのhealthへ生活後天候同期versionを公開する", () => {
  const game = new WorldTimeAwareTrpgGameService({
    store: new MemoryTrpgSaveStore(),
    allowCustomSeed: true,
  });
  assert.equal(
    game.health().worldTimeAwareServiceVersion,
    WORLD_TIME_AWARE_SERVICE_VERSION,
  );
});
