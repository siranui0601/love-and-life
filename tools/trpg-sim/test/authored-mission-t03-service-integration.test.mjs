import test from "node:test";
import assert from "node:assert/strict";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import {
  availableGameRuntimeActions,
  availableGameRuntimeChoiceCandidates,
  createGameRuntime,
  executeGameRuntimeCommand,
} from "../../../src/server/trpg/game/service.js";
import {
  authoredMissionFlowExclusiveActions,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";
import {
  deserializeRuntime,
  serializeRuntime,
} from "../../../src/server/trpg/game/serializer.js";
import { clockFromMinute } from "../lib/player-journey.mjs";

const data = loadTrpgGameData();
const MISSION_ID = "MSN-T03";
const FLOW_ID = "red-fang-migration";
const REQUIRED_CANONICAL_EVIDENCE_ID = "T03-EVIDENCE-APEX-PREDATOR-TRACKS";
const GAME_START_MINUTE_OF_DAY = 10 * 60;

function prepareRuntime() {
  const runtime = createGameRuntime(data, {
    seed: "test:t03-service-progress",
    profileId: "balanced",
    playerName: "試験旅人",
    tutorial: false,
  });
  const state = runtime.playerState;
  const absoluteMinute = 7 * 1440 + 10 * 60 + 50 - GAME_START_MINUTE_OF_DAY;
  Object.assign(state, clockFromMinute(absoluteMinute));
  state.absoluteMinute = absoluteMinute;
  runtime.lastWorldTickMinute = absoluteMinute;
  runtime.tutorial = null;
  runtime.dialogueSession = null;
  state.tuning.disableTravelEncounters = true;
  state.player.location = "田園の村";
  state.player.facilityId = "LOC_FARM_STABLE";
  state.troubles.T03.status = "active";

  for (const definition of state.catalog.special) {
    const mission = state.missions[definition.id];
    mission.status = definition.id === MISSION_ID ? "active" : "locked";
    for (const step of definition.steps) mission.progress[step.id] = 0;
  }

  const definition = state.catalog.byId.get(MISSION_ID);
  const mission = state.missions[MISSION_ID];
  const hearing = definition.steps.find((step) =>
    step.id === "hear" || step.type === "conversation");
  assert.ok(hearing);
  mission.progress[hearing.id] = Number(hearing.required ?? 1);
  state.progress.missions.attemptedTroubleIds.add("T03");
  state.worldFlags["t03Opening:stable_bells"] = true;
  runtime.t03WolfContinuity = {
    version: "t03-wolf-continuity-v1",
    openingChoiceId: "stable_bells",
    evidenceClasses: [],
    sideChoices: [],
    terminalChoiceId: null,
    selectedActionIds: [],
    sceneRevision: 1,
  };

  runtime.playerKnowledge.knownHubIds.add("田園の村");
  runtime.playerKnowledge.knownFacilityIds.add("LOC_FARM_CHIEF");
  runtime.playerKnowledge.knownFacilityIds.add("LOC_FARM_STABLE");
  return runtime;
}

function choices(runtime) {
  return availableGameRuntimeActions(runtime, data).choices;
}

function choose(runtime, action) {
  assert.ok(action?.choiceId, "the service choice must expose its authoritative slot id");
  return executeGameRuntimeCommand(runtime, data, {
    type: "CHOOSE",
    payload: { choiceId: action.choiceId },
  });
}

function roundTrip(runtime) {
  return deserializeRuntime(serializeRuntime(runtime), data);
}

function investigationContract(runtime) {
  const definition = runtime.playerState.catalog.byId.get(MISSION_ID);
  const mission = runtime.playerState.missions[MISSION_ID];
  const step = definition.steps.find((entry) =>
    entry.id === "investigate" || entry.type === "investigate");
  assert.ok(step);
  return { mission, step };
}

function liveInvestigationProgress(runtime) {
  const { mission, step } = investigationContract(runtime);
  return Number(mission.progress?.[step.id] ?? 0);
}

function canonicalEvidence(runtime) {
  return [...new Set(runtime.authoredMissionFlows?.[FLOW_ID]?.evidenceIds ?? [])];
}

function ids(actions) {
  return (actions ?? []).map((action) => action.id);
}

test("T03 keeps two independent evidence classes across noon, public choices, and save round trips", () => {
  let runtime = prepareRuntime();
  assert.equal(runtime.playerState.hour, 10);
  assert.equal(runtime.playerState.minute, 50);
  assert.equal(investigationContract(runtime).step.required, 2);

  const direct = authoredMissionFlowExclusiveActions(runtime, {
    presentNpcs: [],
    movementActions: [],
  });
  assert.ok(
    direct?.some((action) => action.t03EvidenceClass),
    `registry did not expose T03 evidence: ${JSON.stringify(ids(direct))}`,
  );

  const candidates = availableGameRuntimeChoiceCandidates(runtime, data);
  assert.ok(
    candidates.some((action) => action.t03EvidenceClass),
    `service candidate pool hid T03 evidence: ${JSON.stringify(ids(candidates))}`,
  );

  const firstChoices = choices(runtime);
  const first = firstChoices.find((action) => action.t03EvidenceClass);
  assert.ok(
    first,
    `visible service choices hid T03 evidence: ${JSON.stringify(ids(firstChoices))}`,
  );
  assert.equal(choose(runtime, first).outcome.ok, true);
  assert.equal(liveInvestigationProgress(runtime), 1);

  runtime = roundTrip(runtime);
  assert.equal(liveInvestigationProgress(runtime), 1);
  assert.equal(new Set(runtime.t03WolfContinuity.evidenceClasses).size, 1);
  assert.equal(canonicalEvidence(runtime).length, 1);

  const secondChoices = choices(runtime);
  const second = secondChoices.find((action) =>
    action.t03EvidenceClass && action.t03EvidenceClass !== first.t03EvidenceClass);
  assert.ok(
    second,
    `second T03 evidence was unavailable: ${JSON.stringify(ids(secondChoices))}`,
  );
  assert.equal(choose(runtime, second).outcome.ok, true);
  assert.ok(runtime.playerState.absoluteMinute >= 7 * 1440 + 12 * 60 - GAME_START_MINUTE_OF_DAY);
  assert.equal(runtime.playerState.hour, 12);
  assert.equal(liveInvestigationProgress(runtime), 2);

  runtime = roundTrip(runtime);
  assert.equal(liveInvestigationProgress(runtime), 2);
  assert.equal(new Set(runtime.t03WolfContinuity.evidenceClasses).size, 2);
  assert.equal(canonicalEvidence(runtime).length, 2);
  assert.ok(canonicalEvidence(runtime).includes(REQUIRED_CANONICAL_EVIDENCE_ID));
  assert.equal(runtime.playerState.worldFlags[`t03Evidence:${first.t03EvidenceClass}`], true);
  assert.equal(runtime.playerState.worldFlags[`t03Evidence:${second.t03EvidenceClass}`], true);

  const after = choices(runtime);
  assert.equal(liveInvestigationProgress(runtime), 2);
  assert.equal(canonicalEvidence(runtime).length, 2);
  assert.ok(canonicalEvidence(runtime).includes(REQUIRED_CANONICAL_EVIDENCE_ID));
  assert.equal(after.some((action) => action.authoredT03WolfChoice === true), false);
  assert.equal(after.some((action) => action.id === first.id || action.id === second.id), false);

  runtime = roundTrip(runtime);
  assert.equal(liveInvestigationProgress(runtime), 2);
  assert.equal(canonicalEvidence(runtime).length, 2);
});

test("T03 dedicated investigation does not replace ordinary life choices while the player travels off-target", () => {
  let runtime = prepareRuntime();
  const first = choices(runtime).find((action) => action.t03EvidenceClass === "apex_pressure")
    ?? choices(runtime).find((action) => action.t03EvidenceClass);
  assert.ok(first, `first T03 evidence missing: ${JSON.stringify(ids(choices(runtime)))}`);
  assert.equal(choose(runtime, first).outcome.ok, true);
  assert.equal(liveInvestigationProgress(runtime), 1);

  const movement = availableGameRuntimeActions(runtime, data).movement
    .find((action) => action.id === "MOVE_LOCAL:LOC_FARM_BAKERY");
  assert.ok(movement, `bakery movement missing: ${JSON.stringify(ids(availableGameRuntimeActions(runtime, data).movement))}`);
  const moved = executeGameRuntimeCommand(runtime, data, {
    type: "MOVE",
    payload: { moveId: movement.id },
  });
  assert.equal(moved.outcome?.ok, true);
  assert.equal(runtime.playerState.player.facilityId, "LOC_FARM_BAKERY");

  runtime = roundTrip(runtime);
  const exclusive = authoredMissionFlowExclusiveActions(runtime, {
    presentNpcs: [],
    movementActions: availableGameRuntimeActions(runtime, data).movement,
  });
  assert.equal(
    exclusive?.some((action) => action?.authoredMissionFlowId === FLOW_ID) ?? false,
    false,
    `generic T03 flow stole the off-target action panel: ${JSON.stringify(ids(exclusive))}`,
  );
  assert.equal(
    exclusive?.some((action) => action?.authoredT03WolfChoice === true) ?? false,
    false,
    `dedicated T03 evidence should resume only at its target: ${JSON.stringify(ids(exclusive))}`,
  );

  const candidates = availableGameRuntimeChoiceCandidates(runtime, data);
  assert.ok(
    candidates.some((action) => action.id === "LIFE:BUY:ITM008"),
    `ordinary bakery provision is hidden during T03 travel: ${JSON.stringify(ids(candidates))}`,
  );
  assert.equal(liveInvestigationProgress(runtime), 1);
});
