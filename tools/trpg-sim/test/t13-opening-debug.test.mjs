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
  const selected = availableGameRuntimeActions(runtime, game.data).choices
    .filter((action) => action.authoredMissionFlowKind === "opening")
    .find((action) => action.id.endsWith(`:${branch.id}`));
  console.log("T13_DEBUG_BRANCH", JSON.stringify(branch.unlockedLeadIds));
  console.log("T13_DEBUG_ACTION", JSON.stringify({
    id: selected?.id,
    flowId: selected?.authoredMissionFlowId,
    choiceId: selected?.authoredMissionFlowChoiceId,
    leadIds: selected?.authoredMissionFlowUnlockedLeadIds,
  }));
  executeGameRuntimeCommand(runtime, game.data, {
    type: "CHOOSE",
    payload: { choiceId: selected.choiceId },
  });
  console.log("T13_DEBUG_FLOW", JSON.stringify(runtime.authoredMissionFlows[pack.id]));
});
