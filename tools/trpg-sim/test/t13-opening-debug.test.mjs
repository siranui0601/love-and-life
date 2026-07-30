import test from "node:test";
import {
  availableGameRuntimeActions,
  createGameRuntime,
  executeGameRuntimeCommand,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";
import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";
import { AUTHORED_MISSION_FLOW_PACKS } from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

test("diagnose T13 opening lead metadata", () => {
  const game = new TrpgGameService({ store: new MemoryTrpgSaveStore(), allowCustomSeed: true });
  const pack = AUTHORED_MISSION_FLOW_PACKS.find((entry) => entry.troubleId === "T13");
  const runtime = createGameRuntime(game.data, {
    seed: "t13-opening-diagnostic",
    profileId: "balanced",
    playerName: "診断役",
    tutorial: false,
  });
  const state = runtime.playerState;
  runtime.tutorial = null;
  runtime.dialogueSession = null;
  runtime.lastWorldTickMinute = state.absoluteMinute;
  state.player.location = pack.hearing.targetLocation;
  state.player.facilityId = pack.hearing.targetFacilityId;
  for (const definition of state.catalog.special) {
    state.missions[definition.id].status = definition.id === pack.missionId ? "active" : "locked";
  }
  state.troubles[pack.troubleId].status = "active";
  const mission = state.missions[pack.missionId];
  for (const step of state.catalog.byId.get(pack.missionId).steps) mission.progress[step.id] = 0;
  const knownRumor = {
    id: "TEST-T13-AUTHORED-KNOWN",
    troubleId: "T13",
    text: `${pack.title}について現地で異変が起きているという噂`,
    origin: pack.hearing.targetLocation,
    originMinute: 0,
    importance: 1,
    recipients: {},
  };
  state.rumors.push(knownRumor);
  state.rumorById[knownRumor.id] = knownRumor;
  state.player.knownRumorIds.add(knownRumor.id);
  runtime.playerKnowledge.knownHubIds.add(pack.hearing.targetLocation);
  runtime.playerKnowledge.knownFacilityIds.add(pack.hearing.targetFacilityId);
  const speaker = runtime.livingWorld.npcStates[pack.hearing.npcId];
  speaker.lifeStatus = "alive";
  speaker.presence = "present";
  speaker.location = pack.hearing.targetLocation;
  speaker.position = { hubId: pack.hearing.targetLocation, facilityId: pack.hearing.targetFacilityId };
  speaker.travel = null;
  speaker.localTravel = null;

  const branch = pack.hearing.choices.find((entry) => entry.id === "world_tree_spirits_and_seal");
  const allChoices = availableGameRuntimeActions(runtime, game.data).choices;
  const opening = allChoices.filter((action) => action.authoredMissionFlowKind === "opening");
  const selected = opening.find((action) => action.id.endsWith(`:${branch.id}`));
  console.log("T13_DEBUG_OPENINGS", JSON.stringify(opening.map((action) => ({
    id: action.id,
    actionId: action.actionId,
    flowId: action.authoredMissionFlowId,
    choiceId: action.authoredMissionFlowChoiceId,
    leadIds: action.authoredMissionFlowUnlockedLeadIds,
  }))));
  console.log("T13_DEBUG_BRANCH", JSON.stringify(branch.unlockedLeadIds));
  console.log("T13_DEBUG_SELECTED", JSON.stringify(selected));
  executeGameRuntimeCommand(runtime, game.data, {
    type: "CHOOSE",
    payload: { choiceId: selected.choiceId },
  });
  console.log("T13_DEBUG_FLOW", JSON.stringify(runtime.authoredMissionFlows[pack.id]));
});
