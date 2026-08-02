import test from "node:test";
import assert from "node:assert/strict";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import {
  availableGameRuntimeActions,
  createGameRuntime,
  executeGameRuntimeCommand,
} from "../../../src/server/trpg/game/service.js";
import { clockFromMinute } from "../lib/player-journey.mjs";

const data = loadTrpgGameData();
const MISSION_ID = "MSN-T03";

function prepareRuntime() {
  const runtime = createGameRuntime(data, {
    seed: "test:t03-service-progress",
    profileId: "balanced",
    playerName: "試験旅人",
    tutorial: false,
  });
  const state = runtime.playerState;
  const absoluteMinute = 7 * 1440 + 10 * 60;
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

function investigationContract(runtime) {
  const definition = runtime.playerState.catalog.byId.get(MISSION_ID);
  const mission = runtime.playerState.missions[MISSION_ID];
  const step = definition.steps.find((entry) =>
    entry.id === "investigate" || entry.type === "investigate");
  assert.ok(step);
  return { mission, step };
}

test("T03 keeps two independent evidence classes after the full service world update", () => {
  const runtime = prepareRuntime();
  const { mission, step } = investigationContract(runtime);
  assert.equal(step.required, 2);

  const first = choices(runtime).find((action) => action.t03EvidenceClass);
  assert.ok(first);
  assert.equal(choose(runtime, first).outcome.ok, true);
  assert.equal(mission.progress[step.id], 1);

  const second = choices(runtime).find((action) =>
    action.t03EvidenceClass && action.t03EvidenceClass !== first.t03EvidenceClass);
  assert.ok(second);
  assert.equal(choose(runtime, second).outcome.ok, true);
  assert.equal(mission.progress[step.id], 2);
  assert.ok(runtime.playerState.history.some((entry) =>
    entry.type === "T03_INVESTIGATION_PROGRESS_RESTORED"
      && entry.value === 2));

  const after = choices(runtime);
  assert.equal(after.some((action) => action.authoredT03WolfChoice === true), false);
  assert.equal(after.some((action) => action.id === first.id || action.id === second.id), false);
});
