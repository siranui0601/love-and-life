import assert from "node:assert/strict";
import test from "node:test";
import {
  SurvivalAwareTrpgGameService,
  applyUrgentLifeChoices,
  canonicalizePersistedRuntimeRecord,
  urgentLifeChoices,
} from "../../../src/server/trpg/game/survival-aware-service.js";
import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";

const data = Object.freeze({
  model: {
    facilityById: {
      LOC_FARM_INN: { id: "LOC_FARM_INN", name: "麦穂亭" },
      LOC_FARM_FIELD: { id: "LOC_FARM_FIELD", name: "共同畑" },
    },
  },
});

function authoredView(overrides = {}) {
  return {
    clock: { day: 5, hour: 23, time: "23:10" },
    scene: { location: "田園の村", facilityId: "LOC_FARM_INN" },
    player: {
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

test("宿泊施設でない手書き場面では公開の短時間休息だけを併記する", () => {
  const view = authoredView({
    scene: { location: "田園の村", facilityId: "LOC_FARM_FIELD" },
    player: {
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

test("健康時または手書きミッション外では既存三択を変更しない", () => {
  const healthy = authoredView({
    clock: { day: 5, hour: 14, time: "14:00" },
    player: {
      freeMeals: 1,
      freeLodging: 1,
      needs: { hunger: 30, fatigue: 35 },
    },
  });
  assert.strictEqual(applyUrgentLifeChoices(healthy, data), healthy);

  const ordinary = authoredView({
    choices: [{ choiceId: "INSPECT:1", actionId: "INSPECT:1", type: "investigate", label: "調べる" }],
  });
  assert.strictEqual(applyUrgentLifeChoices(ordinary, data), ordinary);
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
    target.runtimeSnapshot = {
      ...target.runtimeSnapshot,
      playerState: {
        ...target.runtimeSnapshot.playerState,
        player: {
          ...target.runtimeSnapshot.playerState.player,
          collapseIncident: { id: "COLLAPSE:test", status: "pending_rescue" },
        },
      },
    };
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
