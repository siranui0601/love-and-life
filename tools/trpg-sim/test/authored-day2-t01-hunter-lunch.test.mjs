import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY1_T01_SQUARE_AFTERCARE_INTERNALS as aftercare,
  AUTHORED_DAY1_T01_VILLAGE_NIGHT_INTERNALS as night,
  AUTHORED_DAY2_T01_MERCHANT_PAYMENT_INTERNALS as payment,
  AUTHORED_DAY2_T01_HUNTER_LUNCH_INTERNALS as lunch,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 780,
      player: { location: "田園の村", facilityId: "LOC_FARM_SQUARE", hunger: 34, fatigue: 58, gold: 0 },
      gold: 0,
      inventory: {},
      missions: [{ id: "MSN-T01", troubleId: "T01", status: "completed", completedAt: 780 }],
      worldFlags: { t01Resolved: true, t01FinnReturned: true },
      history: [],
      evidence: {},
      contracts: {},
    },
  };
}

function choose(state, action) {
  assert.ok(action);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

function chooseId(state, id) {
  return choose(state, authoredMissionFlowExclusiveActions(state).find((action) => action.id === id));
}

function chooseLabel(state, label) {
  return choose(state, authoredMissionFlowExclusiveActions(state).find((action) => action.label === label));
}

function reachLunch(state) {
  chooseId(state, aftercare.HELP_ACTION_ID);
  chooseId(state, "MISSION_FLOW:T01:SQUARE_SUPPER:share_bread");
  chooseId(state, night.SLEEP_ACTION_ID);
  chooseId(state, payment.SOURCE_ACTION_ID);
  chooseLabel(state, "三Gを受け取る");
  chooseLabel(state, "猟師の荷を預かる");
  chooseLabel(state, "狩人小屋へ向かう");
  chooseLabel(state, "罠を直す");
}

test("Day1 route reaches a distinct three-choice hunter lunch scene", () => {
  const state = runtime();
  reachLunch(state);
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
  reachLunch(state);
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
  reachLunch(state);
  chooseLabel(state, "鈴の位置を写す");
  assert.deepEqual(state.playerState.evidence["T03-EVIDENCE-DAY2-WARNING-BELL-MAP"], {
    id: "T03-EVIDENCE-DAY2-WARNING-BELL-MAP",
    source: "LOC_FOREST_HUNTER_HUT:HUNTER_FIELD_MAP",
    acquiredAtMinute: 780,
  });
});

test("warning the village queues one deterministic GOAP request", () => {
  const state = runtime();
  reachLunch(state);
  chooseLabel(state, "村へ知らせる");
  assert.deepEqual(state.playerState.goapRequests["GOAP-DAY2-JILL-NORTH-FENCE-WARNING"], {
    id: "GOAP-DAY2-JILL-NORTH-FENCE-WARNING",
    actorNpcId: "NPC060",
    goal: "warn_village_north_fence",
    destination: "LOC_FARM_NORTH_FENCE",
    status: "queued",
    createdAtMinute: 780,
    dueAtMinute: 960,
  });
  assert.equal(state.playerState.history.at(-1).goapRequestId, "GOAP-DAY2-JILL-NORTH-FENCE-WARNING");
  assert.equal(lunch.eligible(state), false);
});

test("hunter lunch requires the saved snare-repair history and correct facility", () => {
  const state = runtime();
  state.playerState.player.location = "森";
  state.playerState.player.facilityId = "LOC_FOREST_HUNTER_HUT";
  assert.equal(lunch.eligible(state), false);
  state.playerState.history.push({ type: "DAY2_HUNTER_WARNING_SNARE_REPAIRED" });
  assert.equal(lunch.eligible(state), true);
  state.playerState.player.facilityId = "LOC_FARM_SQUARE";
  assert.equal(lunch.eligible(state), false);
});
