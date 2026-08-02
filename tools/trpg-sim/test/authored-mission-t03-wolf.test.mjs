import test from "node:test";
import assert from "node:assert/strict";
import { loadBattleData } from "../lib/battle-model.mjs";
import { loadSkills } from "../lib/fixtures.mjs";
import { loadPlayerSimulationConfig } from "../lib/player-suite.mjs";
import {
  createInitialJourneyState,
  resolvePlayerAction,
} from "../lib/player-journey.mjs";
import { loadWorldModel } from "../lib/world-model.mjs";
import {
  AUTHORED_MISSION_T03_WOLF_INTERNALS,
  AUTHORED_MISSION_T03_WOLF_VERSION,
} from "../../../src/server/trpg/content/authored-mission-t03-wolf-continuity.js";
import {
  applyAuthoredMissionFlowAction as applyRegistryFlowAction,
  applyAuthoredMissionFlowCatalogOverrides as applyRegistryCatalogOverrides,
  authoredMissionFlowExclusiveActions as registryExclusiveActions,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";
import { cloneSerializable } from "../../../src/server/trpg/game/serializer.js";

const model = loadWorldModel();
const battleData = await loadBattleData();
const skills = loadSkills();
const config = loadPlayerSimulationConfig();
const MISSION_ID = "MSN-T03";

function runtime() {
  const state = createInitialJourneyState({
    model,
    battleData,
    skills,
    profile: "balanced",
    tuning: config.tuned,
    seed: "test:t03-wolf-continuity",
  });
  applyRegistryCatalogOverrides(state.catalog);
  const definition = state.catalog.byId.get(MISSION_ID);
  const mission = state.missions[MISSION_ID];
  const hear = definition.steps.find((step) => step.id === "hear" || step.type === "conversation");
  assert.ok(hear);

  state.absoluteMinute = 7 * 1440 + 10 * 60;
  state.day = 8;
  state.hour = 10;
  state.minute = 0;
  state.player.location = hear.targetLocation;
  state.player.facilityId = hear.targetFacilityId;
  state.troubles.T03.status = "active";
  mission.status = "active";
  for (const step of definition.steps) mission.progress[step.id] = 0;
  state.progress.missions.attemptedTroubleIds.add("T03");
  state.authoritativePresentNpcIds = new Set();

  return {
    playerState: state,
    authoredMissionFlows: {},
  };
}

function actions(runtimeState) {
  return registryExclusiveActions(runtimeState, {});
}

function choose(runtimeState, action) {
  const result = resolvePlayerAction(
    runtimeState.playerState,
    model,
    battleData,
    skills,
    runtimeState.playerState.catalog,
    "balanced",
    action,
  );
  applyRegistryFlowAction(runtimeState, action, result);
  return result;
}

function investigationSteps(state) {
  return state.playerState.catalog.byId.get(MISSION_ID).steps
    .filter((step) => step.id === "investigate" || step.type === "investigate");
}

function investigationProgress(state) {
  return investigationSteps(state)
    .reduce((sum, step) => sum + Number(state.playerState.missions[MISSION_ID].progress[step.id] ?? 0), 0);
}

function moveToCurrentInvestigation(state) {
  const mission = state.playerState.missions[MISSION_ID];
  const step = investigationSteps(state)
    .find((entry) => Number(mission.progress[entry.id] ?? 0) < Number(entry.required ?? 1));
  assert.ok(step);
  state.playerState.player.location = step.targetLocation;
  state.playerState.player.facilityId = step.targetFacilityId;
  return step;
}

test("T03 keeps a finite handwritten hearing fallback while the registry preserves the canonical pack opening", () => {
  assert.equal(AUTHORED_MISSION_T03_WOLF_VERSION, "authored-mission-t03-wolf-v1");
  const state = runtime();
  const canonicalOpening = actions(state);
  assert.equal(canonicalOpening.length, 3);
  assert.ok(canonicalOpening.every((action) => action.authoredMissionFlowKind === "opening"));

  const fallback = AUTHORED_MISSION_T03_WOLF_INTERNALS.openingActions(state);
  assert.equal(fallback.length, 3);
  assert.ok(fallback.every((action) => action.authoredT03WolfChoice));
  assert.ok(fallback.every((action) => action.type === "conversation"));
  assert.ok(fallback.every((action) => action.missionId === MISSION_ID));
  assert.ok(fallback.every((action) => action.id.length <= 120));
  assert.equal(new Set(fallback.map((action) => action.id)).size, 3);

  const result = choose(state, fallback[1]);
  assert.equal(result.ok, true);
  assert.match(result.summary, /南柵/u);
  assert.equal(state.playerState.missions[MISSION_ID].progress.hear, 1);
  assert.equal(state.t03WolfContinuity.openingChoiceId, "stable_bells");
  assert.equal(state.playerState.worldFlags["t03Opening:stable_bells"], true);
});

test("two distinct T03 evidence scenes advance the canonical required-count investigation", () => {
  const state = runtime();
  choose(state, actions(state)[0]);
  const canonicalInvestigations = investigationSteps(state);
  assert.equal(canonicalInvestigations.length, 1);
  assert.equal(Number(canonicalInvestigations[0].required ?? 1), 2);
  moveToCurrentInvestigation(state);

  const firstSet = actions(state);
  assert.equal(firstSet.length, 3);
  assert.equal(firstSet.filter((action) => action.t03EvidenceClass).length, 2);
  assert.equal(firstSet.filter((action) => action.t03SideChoice).length, 1);
  const firstEvidence = firstSet.find((action) => action.t03EvidenceClass);
  assert.ok(firstEvidence);
  assert.equal(choose(state, firstEvidence).ok, true);
  assert.equal(investigationProgress(state), 1);

  moveToCurrentInvestigation(state);
  const secondSet = actions(state);
  assert.equal(secondSet.some((action) => action.id === firstEvidence.id), false);
  const secondEvidence = secondSet.find((action) => action.t03EvidenceClass);
  assert.ok(secondEvidence);
  assert.notEqual(secondEvidence.t03EvidenceClass, firstEvidence.t03EvidenceClass);
  assert.equal(choose(state, secondEvidence).ok, true);
  assert.equal(investigationProgress(state), 2);
  assert.equal(new Set(state.t03WolfContinuity.evidenceClasses).size, 2);
  assert.equal(actions(state), null);
});

test("moving livestock changes the next pack evidence instead of renaming the old scene", () => {
  const state = runtime();
  choose(state, actions(state)[2]);
  moveToCurrentInvestigation(state);

  const firstSet = actions(state);
  const evacuation = firstSet.find((action) => action.t03SideChoice === "evacuate_livestock");
  assert.ok(evacuation);
  assert.equal(choose(state, evacuation).ok, true);
  assert.equal(state.playerState.worldFlags.t03LivestockEvacuated, true);
  assert.equal(state.playerState.worldFlags.t03StableTracksTrampled, true);

  const secondSet = actions(state);
  const pack = secondSet.find((action) => action.t03EvidenceClass === "pack_displacement");
  assert.ok(pack);
  assert.match(pack.id, /WOUND_MEASURE/u);
  assert.match(pack.label, /負傷した牝馬/u);
  assert.equal(secondSet.some((action) => action.id === evacuation.id), false);
});

test("T03 causal state survives serialization and does not restore consumed scenes", () => {
  const state = runtime();
  const opening = actions(state)[0];
  choose(state, opening);
  const investigation = moveToCurrentInvestigation(state);
  const side = actions(state).find((action) => action.t03SideChoice);
  choose(state, side);

  const restored = runtime();
  restored.playerState.missions[MISSION_ID].progress.hear = 1;
  restored.playerState.player.location = investigation.targetLocation;
  restored.playerState.player.facilityId = investigation.targetFacilityId;
  restored.t03WolfContinuity = cloneSerializable(state.t03WolfContinuity);
  restored.playerState.worldFlags = cloneSerializable(state.playerState.worldFlags);

  const next = actions(restored);
  assert.equal(next.some((action) => action.id === opening.id), false);
  assert.equal(next.some((action) => action.id === side.id), false);
});

test("T03 irreversible exit closes only the player mission", () => {
  const state = runtime();
  choose(state, actions(state)[0]);
  moveToCurrentInvestigation(state);
  state.t03WolfContinuity = {
    version: "t03-wolf-continuity-v1",
    openingChoiceId: "loss_ledger",
    evidenceClasses: ["pack_displacement"],
    sideChoices: [...AUTHORED_MISSION_T03_WOLF_INTERNALS.SIDE_ORDER],
    terminalChoiceId: null,
    selectedActionIds: [],
    sceneRevision: 4,
  };

  const terminal = actions(state).find((action) => action.t03TerminalChoice);
  assert.ok(terminal);
  choose(state, terminal);
  assert.equal(state.playerState.missions[MISSION_ID].status, "failed");
  assert.match(state.playerState.missions[MISSION_ID].failureReason, /^player_closed_t03_/u);
  assert.equal(state.playerState.worldFlags.t03PlayerMissionClosed, true);
  assert.equal(state.playerState.troubles.T03.status, "active");
  assert.equal(actions(state), null);
});
