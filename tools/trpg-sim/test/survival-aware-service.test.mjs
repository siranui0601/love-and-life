import assert from "node:assert/strict";
import test from "node:test";
import {
  SurvivalAwareTrpgGameService,
  applyUrgentLifeChoices,
  canonicalizePersistedRuntimeRecord,
  urgentLifeChoices,
} from "../../../src/server/trpg/game/survival-aware-service.js";
import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";
import {
  deserializeRuntime,
  serializeRuntime,
} from "../../../src/server/trpg/game/serializer.js";

const data = Object.freeze({
  model: {
    facilityById: {
      LOC_FARM_INN: { id: "LOC_FARM_INN", name: "麦穂亭" },
      LOC_FARM_FIELD: { id: "LOC_FARM_FIELD", name: "共同畑" },
      LOC_CAP_LOWER_INN: { id: "LOC_CAP_LOWER_INN", name: "下層の安宿" },
    },
  },
});

function authoredView(overrides = {}) {
  return {
    clock: { day: 5, hour: 23, time: "23:10" },
    scene: { location: "田園の村", facilityId: "LOC_FARM_INN" },
    player: {
      gold: 0,
      freeMeals: 1,
      freeLodging: 1,
      needs: { hunger: 82, fatigue: 78 },
    },
    choices: [
      {
        choiceId: "MISSION_FLOW:MSN-T02:OPENING:CHECK_GRANARY",
        actionId: "MISSION_FLOW:MSN-T02:OPENING:CHECK_GRANARY",
        type: "investigate",
        label: "共同穀倉へ向かう",
      },
      {
        choiceId: "MISSION_FLOW:MSN-T02:OPENING:ASK_WATCH",
        actionId: "MISSION_FLOW:MSN-T02:OPENING:ASK_WATCH",
        type: "conversation",
        label: "夜警へ聞く",
      },
      {
        choiceId: "MISSION_FLOW:MSN-T02:OPENING:TRACE_OIL",
        actionId: "MISSION_FLOW:MSN-T02:OPENING:TRACE_OIL",
        type: "investigate",
        label: "油の仕入れを追う",
      },
    ],
    ...overrides,
  };
}

test("手書きミッション画面でも緊急時は食事と宿泊を通常UIへ併記する", () => {
  const view = authoredView();
  const life = urgentLifeChoices(view, data);
  assert.deepEqual(life.map((choice) => choice.actionId), [
    "EAT:LOC_FARM_INN:0",
    "LODGE:LOC_FARM_INN:0",
  ]);

  const combined = applyUrgentLifeChoices(view, data);
  assert.equal(combined.choices.length, 5);
  assert.equal(combined.choices[0].actionId, "EAT:LOC_FARM_INN:0");
  assert.equal(combined.choices[1].actionId, "LODGE:LOC_FARM_INN:0");
  assert.equal(combined.choices[2].actionId, view.choices[0].actionId);
});

test("無料食がなくても4G以上あれば食事施設で有料食を公開する", () => {
  const view = authoredView({
    player: {
      gold: 74,
      freeMeals: 0,
      freeLodging: 0,
      needs: { hunger: 82, fatigue: 40 },
    },
  });
  const life = urgentLifeChoices(view, data);
  assert.equal(life[0].actionId, "EAT:LOC_FARM_INN:4");
  assert.equal(life[0].price, 4);
  assert.equal(life[0].nutrition, 58);
  assert.match(life[0].label, /4G/u);
});

test("所持金が4G未満なら実行不能な有料食を表示しない", () => {
  const view = authoredView({
    player: {
      gold: 3,
      freeMeals: 0,
      freeLodging: 0,
      needs: { hunger: 82, fatigue: 40 },
    },
  });
  assert.equal(
    urgentLifeChoices(view, data).some((choice) => choice.type === "eat"),
    false,
  );
});

test("宿泊施設でない手書き場面では公開の短時間休息だけを併記する", () => {
  const view = authoredView({
    scene: { location: "田園の村", facilityId: "LOC_FARM_FIELD" },
    player: {
      gold: 0,
      freeMeals: 0,
      freeLodging: 0,
      needs: { hunger: 40, fatigue: 76 },
    },
  });
  const life = urgentLifeChoices(view, data);
  assert.equal(life.length, 1);
  assert.equal(life[0].actionId, "REST_OUTDOOR:LOC_FARM_FIELD");
  assert.equal(life[0].type, "rest");
});

test("通常三択や三択空状態でも緊急時は現在地の休息actionを公開する", () => {
  const ordinary = authoredView({
    scene: { location: "王都", facilityId: "LOC_CAP_LOWER_INN" },
    player: {
      gold: 0,
      freeMeals: 0,
      freeLodging: 0,
      needs: { hunger: 82, fatigue: 78 },
    },
    choices: [{ choiceId: "INSPECT:1", actionId: "INSPECT:1", type: "investigate", label: "調べる" }],
  });
  const ordinaryLife = urgentLifeChoices(ordinary, data);
  assert.deepEqual(ordinaryLife.map((choice) => choice.actionId), ["REST_OUTDOOR:LOC_CAP_LOWER_INN"]);
  const ordinaryCombined = applyUrgentLifeChoices(ordinary, data);
  assert.equal(ordinaryCombined.choices[0].actionId, "REST_OUTDOOR:LOC_CAP_LOWER_INN");
  assert.equal(ordinaryCombined.choices[1].actionId, "INSPECT:1");

  const empty = { ...ordinary, choices: [] };
  const emptyCombined = applyUrgentLifeChoices(empty, data);
  assert.deepEqual(emptyCombined.choices.map((choice) => choice.actionId), [
    "REST_OUTDOOR:LOC_CAP_LOWER_INN",
  ]);
});

test("健康時は既存三択を変更しない", () => {
  const healthy = authoredView({
    clock: { day: 5, hour: 14, time: "14:00" },
    player: {
      gold: 20,
      freeMeals: 1,
      freeLodging: 1,
      needs: { hunger: 30, fatigue: 35 },
    },
  });
  assert.strictEqual(applyUrgentLifeChoices(healthy, data), healthy);
});

test("有料食を正式commandで実行し、所持金・空腹・履歴を保存する", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new SurvivalAwareTrpgGameService({ store, allowCustomSeed: true });
  const owner = "paid-meal-owner";
  const created = await game.create(owner, {
    playerName: "有料食テスト",
    seed: "paid-meal-test",
  });
  const record = await store.get(created.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  const player = runtime.playerState.player;
  player.location = "田園の村";
  player.facilityId = "LOC_FARM_INN";
  player.gold = 74;
  player.freeMeals = 0;
  player.freeLodging = 0;
  player.needs.hunger = 82;
  player.needs.fatigue = 40;
  runtime.playerState.day = 17;
  runtime.playerState.hour = 17;
  runtime.playerState.minute = 0;
  runtime.playerState.absoluteMinute = 16 * 1440 + 11 * 60;
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = "stale-paid-meal-hash";
  canonicalizePersistedRuntimeRecord(record, game.data);
  await store.put(record);

  const before = game.gameViewForRecord(record);
  const meal = before.choices.find((choice) => choice.actionId === "EAT:LOC_FARM_INN:4");
  assert.ok(meal);
  const hungerBefore = before.player.needs.hunger;

  const result = await game.command(owner, created.id, {
    commandId: "buy-paid-meal",
    expectedRevision: record.revision,
    type: "CHOOSE",
    payload: { choiceId: meal.choiceId },
  });

  assert.equal(result.save.player.gold, 70);
  assert.ok(result.save.player.needs.hunger < hungerBefore);
  assert.equal(result.save.scene.lastOutcome.goldCost, 4);
  const stored = await store.get(created.id);
  const restored = deserializeRuntime(stored.runtimeSnapshot, game.data);
  assert.equal(restored.playerState.player.gold, 70);
  assert.equal(restored.playerState.history.at(-1).actionId, "EAT:LOC_FARM_INN:4");
  assert.equal(restored.playerState.history.at(-1).goldCost, 4);
});

test("保存境界で再構成された正規runtimeのhashへ追随し、次commandとreplayの基点を一致させる", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new SurvivalAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create("survival-canonical-owner", {
    playerName: "保存境界テスト",
    seed: "survival-canonical-test",
  });
  const record = await store.get(created.id);
  record.revision = 1;
  record.stateHash = "stale-pre-serialization-hash";
  record.commandLog.push({
    seq: 1,
    commandId: "authored-action-before-canonicalization",
    revisionBefore: 0,
    revisionAfter: 1,
    stateBeforeHash: "before",
    stateAfterHash: "stale-pre-serialization-hash",
    type: "CHOOSE",
    payload: { choiceId: "MISSION_FLOW:test", actionId: "MISSION_FLOW:test" },
    resolvedActionId: "MISSION_FLOW:test",
    outcome: { ok: true },
  });

  assert.equal(canonicalizePersistedRuntimeRecord(record, game.data), true);
  assert.notEqual(record.stateHash, "stale-pre-serialization-hash");
  assert.equal(record.commandLog.at(-1).stateAfterHash, record.stateHash);
  assert.equal(record.replayBase.revision, 1);
  assert.equal(record.replayBase.stateHash, record.stateHash);
  assert.equal(record.replayBase.runtimeSnapshot, record.runtimeSnapshot);
  assert.doesNotThrow(() => game.gameViewForRecord(record));
  assert.equal(canonicalizePersistedRuntimeRecord(record, game.data), false);
});

test("生活action直後にcollapseが開いた場合は同じrevisionのcommandLogとreplayBaseを救助待ち状態へ合わせる", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new SurvivalAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create("survival-collapse-owner", {
    playerName: "生活後collapseテスト",
    seed: "survival-collapse-test",
  });
  const record = await store.get(created.id);
  record.revision = 1;
  record.commandLog.push({
    seq: 1,
    commandId: "lodging-before-collapse",
    revisionBefore: 0,
    revisionAfter: 1,
    stateBeforeHash: record.stateHash,
    stateAfterHash: record.stateHash,
    type: "CHOOSE",
    payload: { choiceId: "LODGE:LOC_FARM_INN:0", actionId: "" },
    resolvedActionId: "LODGE:LOC_FARM_INN:0",
    outcome: { ok: true, type: "rest" },
  });

  game.ensurePersistedCollapse = async (target) => {
    target.stateHash = "collapse-state-hash";
    target.runtimeSnapshot = structuredClone(target.runtimeSnapshot);
    return { changed: true };
  };

  const result = await game.persistCollapseAfterLifeAction(record);
  assert.equal(result.changed, true);
  assert.equal(record.commandLog.at(-1).stateAfterHash, "collapse-state-hash");
  assert.equal(record.replayBase.revision, 1);
  assert.equal(record.replayBase.stateHash, "collapse-state-hash");
  assert.equal(record.replayBase.runtimeSnapshot, record.runtimeSnapshot);
  const stored = await store.get(created.id);
  assert.equal(stored.stateHash, "collapse-state-hash");
  assert.equal(stored.commandLog.at(-1).stateAfterHash, "collapse-state-hash");
});
