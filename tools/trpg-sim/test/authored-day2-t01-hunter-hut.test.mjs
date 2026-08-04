import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY2_T01_HUNTER_HUT_INTERNALS as hunterHut,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 920,
      player: { location: "森", facilityId: "LOC_FOREST_HUNTER_HUT", hunger: 29, fatigue: 31, gold: 2 },
      history: [{
        type: "DAY2_HUNTER_PARCEL_DELIVERED",
        minute: 918,
        actionId: "MISSION_FLOW:T01:DAY2_MERCHANT_FOLLOWUP:t01-day2-hunter-parcel:leave_for_hut",
      }],
      worldFlags: {},
      evidence: {},
      rumorSeeds: {},
    },
  };
}

function choose(state, label) {
  const action = authoredMissionFlowExclusiveActions(state).find((entry) => entry.label === label);
  assert.ok(action);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

test("delivering the parcel opens three short and materially different hunter-hut choices", () => {
  const state = runtime();
  assert.equal(authoredMissionFlowGuidance(state).title, "狩人小屋の昼前");
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.deepEqual(actions.map((action) => action.label), ["罠を直す", "狼笛を吹く", "村へ戻る"]);
  assert.equal(actions.length, 3);
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
  assert.equal(new Set(actions.map((action) => action.family)).size, 3);
  assert.ok(actions.every((action) => action.label.length >= 4 && action.label.length <= 20));
  assert.ok(actions.every((action) => action.targetNpcId === "NPC060"));
});

test("repairing the warning snare saves sourced T03 evidence and closes the other branches", () => {
  const state = runtime();
  const result = choose(state, "罠を直す");
  assert.equal(result.evidenceId, "T03-EVIDENCE-WARNING-SNARE-LINE");
  assert.deepEqual(state.playerState.evidence["T03-EVIDENCE-WARNING-SNARE-LINE"], {
    id: "T03-EVIDENCE-WARNING-SNARE-LINE",
    source: "LOC_FOREST_HUNTER_HUT:WARNING_SNARE",
    acquiredAtMinute: 920,
  });
  assert.equal(state.playerState.day2T01HunterHut.closedActionIds.length, 2);
  assert.equal(hunterHut.eligible(state), false);
});

test("trying the wolf whistle saves a rumor seed without inventing proof", () => {
  const state = runtime();
  const result = choose(state, "狼笛を吹く");
  assert.equal(result.evidenceId, null);
  assert.equal(result.rumorSeed, "RUMOR-DAY2-NORTH-BRUSH-SILENCE");
  assert.equal(state.playerState.rumorSeeds["RUMOR-DAY2-NORTH-BRUSH-SILENCE"].status, "seeded");
  assert.deepEqual(state.playerState.evidence, {});
});

test("returning to the village performs authoritative movement and prevents scene repetition", () => {
  const state = runtime();
  choose(state, "村へ戻る");
  assert.equal(state.playerState.player.location, "田園の村");
  assert.equal(state.playerState.player.facilityId, "LOC_FARM_SQUARE");
  assert.equal(state.playerState.worldFlags["day2Hunter:returnToVillageChosen"], true);
  assert.equal(hunterHut.eligible(state), false);
});

test("the hunter-hut scene requires the delivered-parcel history and co-located hunter facility", () => {
  const state = runtime();
  state.playerState.history = [];
  assert.equal(hunterHut.eligible(state), false);
  state.playerState.history.push({ type: "DAY2_HUNTER_PARCEL_DELIVERED" });
  state.playerState.player.facilityId = "LOC_FOREST_EDGE";
  assert.equal(hunterHut.eligible(state), false);
});
