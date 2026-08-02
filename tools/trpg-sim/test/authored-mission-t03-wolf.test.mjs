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
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
} from "../../../src/server/trpg/content/authored-mission-t03-wolf-continuity.js";
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
  applyAuthoredMissionFlowAction(runtimeState, action, result);
  return result;
}

test("T03 hearing is a finite three-way authored scene even when no NPC is present", () => {
  assert.equal(AUTHORED_MISSION_T03_WOLF_VERSION, "authored-mission-t03-wolf-v1");
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state, {});
  assert.equal(actions.length, 3);
  assert.ok(actions.every((action) => action.authoredT03WolfChoice));
  assert.ok(actions.every((action) => action.type === "conversation"));
  assert.ok(actions.every((action) => action.missionId === MISSION_ID));
  assert.ok(actions.every((action) => action.id.length <= 120));
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);

  const result = choose(state, actions[1]);
  assert.equal(result.ok, true);
  assert.match(result.summary, /南柵/u);
  assert.equal(state.playerState.missions[MISSION_ID].progress.hear, 1);
  assert.equal(state.t03WolfContinuity.openingChoiceId, "stable_bells");
  assert.equal(state.playerState.worldFlags["t03Opening:stable_bells"], true);
});

test("two distinct T03 evidence scenes advance the canonical investigation from zero to two", () => {
  const state = runtime();
  choose(state, authoredMissionFlowExclusiveActions(state, {})[0]);
  const definition = state.playerState.catalog.byId.get(MISSION_ID);
  const investigation = definition.steps.find((step) => step.id === "investigate" || step.type === "investigate");
  assert.ok(investigation);
  state.playerState.player.location = investigation.targetLocation;
  state.playerState.player.facilityId = investigation.targetFacilityId;

  const firstSet = authoredMissionFlowExclusiveActions(state, {});
  assert.equal(firstSet.length, 3);
  assert.equal(firstSet.filter((action) => action.t03EvidenceClass).length, 2);
  assert.equal(firstSet.filter((action) => action.t03SideChoice).length, 1);
  const firstEvidence = firstSet.find((action) => action.t03EvidenceClass);
  assert.ok(firstEvidence);
  assert.equal(choose(state, firstEvidence).ok, true);
  assert.equal(state.playerState.missions[MISSION_ID].progress[investigation.id], 1);

  const secondSet = authoredMissionFlowExclusiveActions(state, {});
  assert.equal(secondSet.some((action) => action.id === firstEvidence.id), false);
  const secondEvidence = secondSet.find((action) => action.t03EvidenceClass);
  assert.ok(secondEvidence);
  assert.notEqual(secondEvidence.t03EvidenceClass, firstEvidence.t03EvidenceClass);
  assert.equal(choose(state, secondEvidence).ok, true);
  assert.equal(state.playerState.missions[MISSION_ID].progress[investigation.id], 2);
  assert.equal(authoredMissionFlowExclusiveActions(state, {}), null);
});

test("moving livestock changes the next pack evidence instead of renaming the old scene", () => {
  const state = runtime();
  choose(state, authoredMissionFlowExclusiveActions(state, {})[2]);
  const definition = state.playerState.catalog.byId.get(MISSION_ID);
  const investigation = definition.steps.find((step) => step.id === "investigate" || step.type === "investigate");
  state.playerState.player.location = investigation.targetLocation;
  state.playerState.player.facilityId = investigation.targetFacilityId;

  const firstSet = authoredMissionFlowExclusiveActions(state, {});
  const evacuation = firstSet.find((action) => action.t03SideChoice === "evacuate_livestock");
  assert.ok(evacuation);
  assert.equal(choose(state, evacuation).ok, true);
  assert.equal(state.playerState.worldFlags.t03LivestockEvacuated, true);
  assert.equal(state.playerState.worldFlags.t03StableTracksTrampled, true);

  const secondSet = authoredMissionFlowExclusiveActions(state, {});
  const pack = secondSet.find((action) => action.t03EvidenceClass === "pack_displacement");
  assert.ok(pack);
  assert.match(pack.id, /WOUND_MEASURE/u);
  assert.match(pack.label, /負傷した牝馬/u);
  assert.equal(secondSet.some((action) => action.id === evacuation.id), false);
});

test("T03 causal state survives serialization and does not restore consumed scenes", () => {
  const state = runtime();
  const opening = authoredMissionFlowExclusiveActions(state, {})[0];
  choose(state, opening);
  const definition = state.playerState.catalog.byId.get(MISSION_ID);
  const investigation = definition.steps.find((step) => step.id === "investigate" || step.type === "investigate");
  state.playerState.player.location = investigation.targetLocation;
  state.playerState.player.facilityId = investigation.targetFacilityId;
  const side = authoredMissionFlowExclusiveActions(state, {}).find((action) => action.t03SideChoice);
  choose(state, side);

  const restored = runtime();
  restored.playerState.missions[MISSION_ID].progress.hear = 1;
  restored.playerState.player.location = investigation.targetLocation;
  restored.playerState.player.facilityId = investigation.targetFacilityId;
  restored.t03WolfContinuity = cloneSerializable(state.t03WolfContinuity);
  restored.playerState.worldFlags = cloneSerializable(state.playerState.worldFlags);

  const next = authoredMissionFlowExclusiveActions(restored, {});
  assert.equal(next.some((action) => action.id === opening.id), false);
  assert.equal(next.some((action) => action.id === side.id), false);
});

test("T03 irreversible exit closes only the player mission", () => {
  const state = runtime();
  choose(state, authoredMissionFlowExclusiveActions(state, {})[0]);
  const definition = state.playerState.catalog.byId.get(MISSION_ID);
  const investigation = definition.steps.find((step) => step.id === "investigate" || step.type === "investigate");
  state.playerState.player.location = investigation.targetLocation;
  state.playerState.player.facilityId = investigation.targetFacilityId;
  state.t03WolfContinuity = {
    version: "t03-wolf-continuity-v1",
    openingChoiceId: "loss_ledger",
    evidenceClasses: ["pack_displacement"],
    sideChoices: [...AUTHORED_MISSION_T03_WOLF_INTERNALS.SIDE_ORDER],
    terminalChoiceId: null,
    selectedActionIds: [],
    sceneRevision: 4,
  };
  state.playerState.missions[MISSION_ID].progress[investigation.id] = 1;

  const terminal = authoredMissionFlowExclusiveActions(state, {}).find((action) => action.t03TerminalChoice);
  assert.ok(terminal);
  choose(state, terminal);
  assert.equal(state.playerState.missions[MISSION_ID].status, "failed");
  assert.match(state.playerState.missions[MISSION_ID].failureReason, /^player_closed_t03_/u);
  assert.equal(state.playerState.worldFlags.t03PlayerMissionClosed, true);
  assert.equal(state.playerState.troubles.T03.status, "active");
  assert.equal(authoredMissionFlowExclusiveActions(state, {}), null);
});
