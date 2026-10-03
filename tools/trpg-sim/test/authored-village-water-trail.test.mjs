import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_VILLAGE_WATER_TRAIL_INTERNALS as trail,
  AUTHORED_VILLAGE_DAILY_LIFE_INTERNALS as daily,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const absoluteMinuteFor = (day, wallMinute) => (day - 1) * 1440 + wallMinute - 600;
const DAY6_MIDDAY = absoluteMinuteFor(6, 12 * 60);

function runtime(worldFlags = {}, facilityId = "LOC_FARM_WELL") {
  return {
    playerState: {
      absoluteMinute: DAY6_MIDDAY,
      player: { location: "田園の村", facilityId, hunger: 40, fatigue: 45 },
      hunger: 40,
      fatigue: 45,
      missions: [{ id: "MSN-T13", troubleId: "T13", status: "active" }],
      troubles: { T13: { status: "active" } },
      worldFlags: { ...worldFlags },
      history: [],
      evidence: {},
    },
    authoredMissionFlows: {},
  };
}

function twoSigns() {
  return { t13EarlyWaterSignNoticed: true, t13StreamWentQuiet: true };
}

function choose(state, actionId) {
  const action = authoredMissionFlowExclusiveActions(state)
    .find((entry) => entry.id === actionId);
  assert.ok(action, `action not offered: ${actionId}`);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

test("one stray water sign is not enough to start following the water", () => {
  const single = runtime({ t13EarlyWaterSignNoticed: true });
  assert.equal(trail.waterSignCount(single), 1);
  assert.equal(trail.eligible(single), false);

  const none = runtime();
  assert.equal(trail.eligible(none), false);
});

test("two independent signs open the trail without any trouble conversation", () => {
  const state = runtime(twoSigns());
  assert.equal(trail.waterSignCount(state), 2);

  const actions = authoredMissionFlowExclusiveActions(state);
  assert.deepEqual(actions.map((action) => action.label), [
    "小川を遡る",
    "井戸を掘り下げる相談をする",
    "ジルに森の水場を聞く",
  ]);
  assert.equal(new Set(actions.map((action) => action.family)).size, 3);
  for (const action of actions) {
    assert.equal(action.actionId, action.id);
    assert.equal(action.missionId, "MSN-T13");
  }
  assert.equal(authoredMissionFlowGuidance(state).title, "水がどこへ行ったのかを追う");
});

test("any two of the three signs work, in any combination", () => {
  const pairs = [
    ["t13EarlyWaterSignNoticed", "t13StreamWentQuiet"],
    ["t13EarlyWaterSignNoticed", "t13IrrigationLevelLow"],
    ["t13StreamWentQuiet", "t13IrrigationLevelLow"],
  ];
  for (const [a, b] of pairs) {
    const state = runtime({ [a]: true, [b]: true });
    assert.equal(trail.eligible(state), true, `${a} + ${b} should open the trail`);
  }
});

test("the daily wellside scene really does hand two of those signs over", () => {
  const state = {
    playerState: {
      absoluteMinute: absoluteMinuteFor(2, 12 * 60),
      player: { location: "田園の村", facilityId: "LOC_FARM_WELL", hunger: 40, fatigue: 45 },
      hunger: 40,
      fatigue: 45,
      missions: [],
      troubles: {},
      worldFlags: {},
      history: [],
      evidence: {},
    },
  };
  choose(state, daily.actionIdFor(daily.WELL_SCENE, daily.WELL_CHOICES[1]));
  assert.equal(state.playerState.worldFlags.t13EarlyWaterSignNoticed, true);

  state.playerState.player.facilityId = "LOC_FARM_FIELD";
  choose(state, daily.actionIdFor(daily.FIELD_SCENE, daily.FIELD_CHOICES[1]));
  assert.equal(state.playerState.worldFlags.t13IrrigationLevelLow, true);

  assert.equal(trail.waterSignCount(state), 2);
  assert.equal(trail.eligible(state), true,
    "a player who only ever lived in the village can still reach the water");
});

test("each answer records a different early lead and marks the find as pre-rumor", () => {
  const evidenceIds = [];
  for (const choice of trail.TRAIL_CHOICES) {
    const state = runtime(twoSigns());
    choose(state, trail.actionIdFor(choice));
    assert.equal(state.playerState.worldFlags.t13FoundBeforeRumor, true);
    evidenceIds.push(Object.keys(state.playerState.evidence));
  }
  assert.equal(new Set(evidenceIds.flat()).size, 3);
});

test("following the stream reaches the upstream draw and moves the player to the edge", () => {
  const state = runtime(twoSigns());
  const result = choose(state, trail.actionIdFor(trail.TRAIL_CHOICES[0]));

  assert.equal(state.playerState.worldFlags.t13UpstreamDrawSuspected, true);
  assert.ok(state.playerState.evidence["T13-EVIDENCE-EARLY-UPSTREAM-DRAW"]);
  assert.equal(state.playerState.player.facilityId, "LOC_FARM_EDGE");
  assert.equal(result.speeches[0].actorId, "NPC060");
});

test("the trail never opens once the canonical T13 flow has begun", () => {
  const opened = runtime(twoSigns());
  opened.authoredMissionFlows["forest-king-slime-world-tree-collapse"] = {
    openingChoiceId: "some-opening",
  };
  assert.equal(trail.eligible(opened), false);

  const withEvidence = runtime(twoSigns());
  withEvidence.authoredMissionFlows["forest-king-slime-world-tree-collapse"] = {
    evidenceIds: ["T13-SOMETHING"],
  };
  assert.equal(trail.eligible(withEvidence), false);

  const untouched = runtime(twoSigns());
  untouched.authoredMissionFlows["forest-king-slime-world-tree-collapse"] = { evidenceIds: [] };
  assert.equal(trail.eligible(untouched), true);
});

test("the trail is absent away from the village, away from the trailheads, and after T13 closes", () => {
  const away = runtime(twoSigns());
  away.playerState.player.location = "王都";
  assert.equal(trail.eligible(away), false);

  const wrongPlace = runtime(twoSigns(), "LOC_FARM_GRANARY");
  assert.equal(trail.eligible(wrongPlace), false);

  const late = runtime(twoSigns());
  late.playerState.absoluteMinute = 45 * 1440;
  assert.equal(trail.eligible(late), false);

  const done = runtime(twoSigns());
  done.playerState.missions[0].status = "completed";
  done.playerState.troubles.T13.status = "resolved";
  assert.equal(trail.eligible(done), false);
});

test("the trail is spent once, and the two roads not taken are closed", () => {
  const state = runtime(twoSigns());
  const chosen = trail.actionIdFor(trail.TRAIL_CHOICES[2]);
  choose(state, chosen);

  assert.equal(trail.eligible(state), false);
  const saved = state.playerState.villageWaterTrail;
  assert.equal(saved.selectedActionId, chosen);
  assert.equal(saved.signCountAtChoice, 2);
  assert.deepEqual(saved.closedActionIds, [
    trail.actionIdFor(trail.TRAIL_CHOICES[0]),
    trail.actionIdFor(trail.TRAIL_CHOICES[1]),
  ]);
});

test("the trail outranks the ordinary wellside scene once the signs add up", () => {
  const state = runtime(twoSigns());
  const labels = authoredMissionFlowExclusiveActions(state).map((action) => action.label);
  assert.equal(labels.includes("水をがぶ飲みする"), false);
  assert.equal(labels[0], "小川を遡る");
});