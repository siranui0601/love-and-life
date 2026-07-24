import assert from "node:assert/strict";
import test from "node:test";
import {
  availableGameRuntimeChoiceCandidates,
  createGameRuntime,
  TRPG_GAME_RESOLVER_VERSION,
} from "../../../src/server/trpg/game/service.js";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";

function setup(seed) {
  const data = loadTrpgGameData();
  const runtime = createGameRuntime(data, {
    seed,
    profileId: "balanced",
    playerName: "旅人",
    tutorial: false,
  });
  runtime.playerState.player.location = "田園の村";
  runtime.playerState.player.facilityId = "LOC_FARM_SQUARE";
  runtime.playerKnowledge.knownHubIds.add("田園の村");
  runtime.playerKnowledge.knownFacilityIds.add("LOC_FARM_SQUARE");
  runtime.playerKnowledge.knownFacilityIds.add("LOC_FARM_EDGE");
  return { data, runtime };
}

function hideAllNpcs(runtime) {
  for (const state of Object.values(runtime.livingWorld.npcStates)) {
    state.presence = "absent";
    state.travel = null;
    state.localTravel = null;
    state.position = { hubId: state.location ?? "田園の村", facilityId: null };
  }
}

function placeNpc(runtime, npcId, facilityId, { lifeStatus = "alive" } = {}) {
  const state = runtime.livingWorld.npcStates[npcId];
  assert.ok(state, `${npcId} must exist in the world model`);
  state.location = "田園の村";
  state.position = { hubId: "田園の村", facilityId };
  state.presence = "present";
  state.lifeStatus = lifeStatus;
  state.travel = null;
  state.localTravel = null;
  return state;
}

function makeT01SearchActive(runtime) {
  const definition = runtime.playerState.catalog.special.find((entry) => entry.id === "MSN-T01");
  assert.ok(definition);
  const mission = runtime.playerState.missions[definition.id];
  mission.status = "active";
  for (const step of definition.steps) mission.progress[step.id] = 0;
  const hear = definition.steps.find((step) => step.id === "hear");
  mission.progress.hear = Number(hear?.required ?? 1);
  runtime.playerState.troubles.T01.status = "active";
  const rumor = runtime.playerState.rumors.find((entry) => entry.troubleId === "T01");
  if (rumor) runtime.playerState.player.knownRumorIds.add(rumor.id);
  return mission;
}

test("resolver v16 keeps the player-view and work-market fixes migratable", () => {
  assert.equal(TRPG_GAME_RESOLVER_VERSION, "trpg-player-world-v16");
});

test("an injured Finn and a child bystander cannot become work employers", () => {
  const { data, runtime } = setup("t01-work-giver-focus");
  hideAllNpcs(runtime);
  placeNpc(runtime, "NPC001", "LOC_FARM_SQUARE", { lifeStatus: "injured" });
  placeNpc(runtime, "NPC062", "LOC_FARM_SQUARE");
  placeNpc(runtime, "NPC003", "LOC_FARM_SQUARE");
  runtime.playerState.troubles.T01.status = "resolved";
  runtime.playerState.missions["MSN-T01"].status = "completed";

  const candidates = availableGameRuntimeChoiceCandidates(runtime, data, { limit: 12 });
  const workOffers = candidates.filter((entry) => entry.workOffer === true || entry.dialogueTopic === "work_offer");
  assert.ok(workOffers.length > 0, candidates.map((entry) => `${entry.type}:${entry.label}`).join(" / "));
  assert.ok(workOffers.every((entry) => entry.targetNpcId === "NPC003"), JSON.stringify(workOffers, null, 2));
  assert.ok(workOffers.every((entry) => !["NPC001", "NPC062"].includes(entry.targetNpcId)));
});

test("the ordinary three-choice pool stays on T01 at the village edge", () => {
  const { data, runtime } = setup("t01-edge-choice-focus");
  runtime.playerState.player.facilityId = "LOC_FARM_EDGE";
  hideAllNpcs(runtime);
  placeNpc(runtime, "NPC006", "LOC_FARM_EDGE");
  makeT01SearchActive(runtime);

  const candidates = availableGameRuntimeChoiceCandidates(runtime, data, { limit: 12 });
  assert.ok(candidates.some((entry) => entry.missionId === "MSN-T01"), candidates.map((entry) => `${entry.id}:${entry.label}`).join(" / "));
  assert.equal(candidates.some((entry) => entry.type === "conversation"
    && entry.targetNpcId === "NPC006"
    && entry.missionId !== "MSN-T01"), false, JSON.stringify(candidates, null, 2));
});
