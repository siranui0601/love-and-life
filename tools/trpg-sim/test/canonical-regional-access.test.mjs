import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  CANONICAL_REGIONAL_ACCESS_INTERNALS as access,
  CANONICAL_REGIONAL_LABOUR_INTERNALS as labour,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime(location, facilityId) {
  return {
    playerState: {
      day: 30,
      absoluteMinute: 30 * 1440,
      player: { location, facilityId, gold: 20, freeMeals: 0, freeLodging: 0 },
      progress: {},
      worldFlags: {},
      history: [],
    },
    authoredMissionFlows: {},
  };
}

function choose(state, id) {
  const action = authoredMissionFlowExclusiveActions(state)?.find((entry) => entry.id === id);
  assert.ok(action, `${id} must be publicly available`);
  assert.equal(action.id, action.actionId);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

test("fort and Blackridge registration write the exact public service gates", () => {
  const fort = runtime("北陵要塞", "LOC_FORT_GATE");
  choose(fort, "REGIONAL_ACCESS:FORT:register_supply_pass");
  assert.equal(fort.playerState.progress.fortEntryPermit, true);
  assert.equal(access.ownActions(fort), null);

  const blackridge = runtime("黒嶺連合領", "LOC_BLACKRIDGE_GATE");
  choose(blackridge, "REGIONAL_ACCESS:BLACKRIDGE:register_waterway_stay");
  assert.equal(blackridge.playerState.progress.blackridgeEntryPermit, true);
});

test("Mina evidence unlocks technical work without a route-only flag", () => {
  const state = runtime("ドワーフ洞窟", "LOC_DWARF_ENGINEER");
  assert.equal(access.ownActions(state), null);
  state.authoredMissionFlows["dwarf-mine-collapse"] = {
    evidenceIds: ["T09-EVIDENCE-MINA-SUPPORT-STRESS-CALCULATION"],
  };

  choose(state, "REGIONAL_ACCESS:DWARF:copy_rescue_drawing");
  assert.equal(state.playerState.progress.technicalKnowledge, true);
  assert.equal(labour.conditionMet(state, "technicalKnowledge||minaTrust>=2"), true);
});

test("forest rules and Lysia's return grant their ordinary approval paths", () => {
  const forest = runtime("森", "LOC_FOREST_HUNTER_HUT");
  choose(forest, "REGIONAL_ACCESS:FOREST:accept_hunter_rules");
  assert.equal(forest.playerState.progress.hunterApproval, true);
  assert.equal(labour.conditionMet(forest, "hunterApproval"), true);

  const elf = runtime("エルフの隠れ里", "LOC_ELF_GUEST_BOUGH");
  assert.equal(access.ownActions(elf), null);
  elf.authoredMissionFlows["runaway-elf-trafficking"] = {
    selectedResolutionRouteId: "voluntary_return_with_youth_charter",
  };
  choose(elf, "REGIONAL_ACCESS:ELF:accept_guest_bough_invitation");
  assert.equal(elf.playerState.worldFlags.elfApproval, true);
});

test("regional access history is finite and contains no virtue-route score", () => {
  const state = runtime("北陵要塞", "LOC_FORT_GATE");
  choose(state, "REGIONAL_ACCESS:FORT:register_supply_pass");
  assert.equal(state.playerState.history.at(-1).type, "CANONICAL_REGIONAL_ACCESS_GRANTED");
  assert.doesNotMatch(JSON.stringify(access.ACCESS), /VIRTUE_ROUTE|virtueRoute|routeScore/u);
});

test("canonical regional jobs stay ordinary public candidates, not mission-exclusive branches", () => {
  const state = runtime("田園の村", "LOC_FARM_FIELD");
  const actions = labour.ownActions(state);
  assert.equal(actions?.length, 1);
  assert.equal(actions[0].id, "WORK:FACILITY:JOB-FARM-01");
  assert.equal(actions[0].canonicalRegionalLabourChoice, true);
  assert.notEqual(actions[0].authoredMissionFlowExclusiveChoice, true);
  assert.equal(actions[0].type, "plan");
});