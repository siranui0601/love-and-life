import test from "node:test";
import assert from "node:assert/strict";
import { DAY100_ROUTE_STRATEGY_INTERNALS } from "../lib/day100-route-strategy.mjs";

const {
  authoredFlowChoice,
  guidanceMissionId,
  missionChoiceAllowed,
  missionChoiceContext,
  choiceWouldStall,
} = DAY100_ROUTE_STRATEGY_INTERNALS;

test("route controls are excluded even when they carry the selected mission id", () => {
  assert.equal(missionChoiceAllowed(
    { missionId: "MSN-T13", actionId: "MISSION_FLOW:t13:RECONSIDER:lead" },
    "MSN-T13",
    "MSN-T13",
    true,
  ), false);
  assert.equal(missionChoiceAllowed(
    { missionId: "MSN-T13", actionId: "MISSION_FLOW:t13:DEFER:defer" },
    "MSN-T13",
    "MSN-T13",
    true,
  ), false);
});

test("authored choices follow the mission named by public guidance", () => {
  assert.equal(guidanceMissionId({ guidance: { missionId: "MSN-T13" } }), "MSN-T13");
  assert.equal(missionChoiceAllowed(
    { actionId: "MISSION_FLOW:t13:LEAD_HUB:lead" },
    "MSN-T13",
    "MSN-T13",
    true,
  ), true);
  assert.equal(missionChoiceAllowed(
    { actionId: "MISSION_FLOW:t13:LEAD_HUB:lead" },
    "MSN-T07",
    "MSN-T13",
    true,
  ), false);
});

test("an unchanged route action is bounded after two accepted attempts", () => {
  const save = {
    scene: { location: "森", facilityId: "LOC_FOREST_CAMP" },
    guidance: { missionId: "MSN-T07", targetFacilityId: "LOC_FOREST_EDGE" },
  };
  const mission = {
    id: "MSN-T07",
    status: "active",
    currentStep: { id: "investigate", progress: 0, required: 3 },
  };
  const choice = { actionId: "ACTION:MSN-T07:investigate" };
  const context = missionChoiceContext(save, mission, choice);
  assert.equal(choiceWouldStall({ routeStrategyChoiceMemory: { context, count: 1 } }, context), false);
  assert.equal(choiceWouldStall({ routeStrategyChoiceMemory: { context, count: 2 } }, context), true);
  assert.equal(authoredFlowChoice({ actionId: "MISSION_FLOW:t13:LEAD_HUB:lead" }), true);
});
