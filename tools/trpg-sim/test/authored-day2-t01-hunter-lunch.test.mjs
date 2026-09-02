import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY2_T01_HUNTER_LUNCH_INTERNALS as lunch,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const HUNTER_LUNCH_MINUTE = 1391; // Day2 09:11 after the real snare-repair action.

function runtime({ repaired = true } = {}) {
  return {
    playerState: {
      absoluteMinute: HUNTER_LUNCH_MINUTE,
      player: { location: "森", facilityId: "LOC_FOREST_HUNTER_HUT", hunger: 34, fatigue: 32, gold: 42 },
      gold: 42,
      inventory: {},
      missions: [{ id: "MSN-T01", troubleId: "T01", status: "completed", completedAt: 292 }],
      worldFlags: { t01Resolved: true, t01FinnReturned: true },
      history: repaired ? [{ type: "DAY2_HUNTER_WARNING_SNARE_REPAIRED" }] : [],
      evidence: {},
      contracts: {},
      goapRequests: {},
    },
  };
}

function choose(state, action) {
  assert.ok(action);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

function chooseLabel(state, label) {
  return choose(state, authoredMissionFlowExclusiveActions(state).find((entry) => entry.label === label));
}

test("saved snare-repair history at the hunter hut opens a distinct three-choice lunch scene", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.equal(authoredMissionFlowGuidance(state).title, "狩人小屋の昼支度");
  assert.deepEqual(actions.map((action) => action.label), ["鍋をかき混ぜる", "鈴の位置を写す", "村へ知らせる"]);
  assert.equal(actions.length, 3);
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
  assert.equal(new Set(actions.map((action) => action.family)).size, 3);
  assert.ok(actions.every((action) => action.label.length >= 4 && action.label.length <= 20));
  assert.ok(actions.every((action) => action.targetNpcId === "NPC060"));
});

test("stirring the stew changes living state and closes the other branches", () => {
  const state = runtime();
  const hungerBefore = state.playerState.player.hunger;
  const fatigueBefore = state.playerState.player.fatigue;
  chooseLabel(state, "鍋をかき混ぜる");
  assert.equal(state.playerState.player.hunger, Math.max(0, hungerBefore - 14));
  assert.equal(state.playerState.player.fatigue, Math.max(0, fatigueBefore - 2));
  assert.equal(state.playerState.worldFlags["day2Hunter:stewShared"], true);
  assert.equal(state.playerState.day2T01HunterLunch.closedActionIds.length, 2);
  assert.equal(lunch.eligible(state), false);
});

test("copying the bell map preserves evidence and its source", () => {
  const state = runtime();
  chooseLabel(state, "鈴の位置を写す");
  assert.deepEqual(state.playerState.evidence["T03-EVIDENCE-DAY2-WARNING-BELL-MAP"], {
    id: "T03-EVIDENCE-DAY2-WARNING-BELL-MAP",
    source: "LOC_FOREST_HUNTER_HUT:HUNTER_FIELD_MAP",
    acquiredAtMinute: HUNTER_LUNCH_MINUTE,
  });
});

test("warning the village queues one deterministic GOAP request", () => {
  const state = runtime();
  chooseLabel(state, "村へ知らせる");
  assert.deepEqual(state.playerState.goapRequests["GOAP-DAY2-JILL-NORTH-FENCE-WARNING"], {
    id: "GOAP-DAY2-JILL-NORTH-FENCE-WARNING",
    actorNpcId: "NPC060",
    goal: "warn_village_north_fence",
    destination: "LOC_FARM_NORTH_FENCE",
    status: "queued",
    createdAtMinute: HUNTER_LUNCH_MINUTE,
    dueAtMinute: HUNTER_LUNCH_MINUTE + 180,
  });
  assert.equal(state.playerState.history.at(-1).goapRequestId, "GOAP-DAY2-JILL-NORTH-FENCE-WARNING");
  assert.equal(lunch.eligible(state), false);
});

test("hunter lunch requires the saved snare-repair history and correct facility", () => {
  const state = runtime({ repaired: false });
  assert.equal(lunch.eligible(state), false);
  state.playerState.history.push({ type: "DAY2_HUNTER_WARNING_SNARE_REPAIRED" });
  assert.equal(lunch.eligible(state), true);
  state.playerState.player.facilityId = "LOC_FARM_SQUARE";
  assert.equal(lunch.eligible(state), false);
});