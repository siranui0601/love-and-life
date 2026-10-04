import assert from "node:assert/strict";
import test from "node:test";

import {
  availableGameRuntimeActions,
  createGameRuntime,
} from "../../../src/server/trpg/game/service.js";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import {
  applyAuthoredMissionFlowCatalogOverrides,
  AUTHORED_MISSION_FLOW_PACKS,
  ensureAuthoredMissionFlowState,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const data = loadTrpgGameData();
const LATE_TROUBLES = new Set(["T15", "T16", "T17", "T18", "T19"]);

function prepareResolutionFixture(pack) {
  const runtime = createGameRuntime(data, {
    seed: `late-resolution-panel:${pack.id}`,
    profileId: "balanced",
    playerName: "最終方針検証役",
    tutorial: false,
  });
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  runtime.tutorial = null;
  runtime.dialogueSession = null;
  runtime.playerState.tuning.disableTravelEncounters = true;

  for (const definition of runtime.playerState.catalog.special) {
    runtime.playerState.missions[definition.id].status = definition.id === pack.missionId ? "active" : "locked";
  }
  runtime.playerState.troubles[pack.troubleId].status = "active";
  runtime.playerState.progress.missions.attemptedTroubleIds.add(pack.troubleId);

  const definition = runtime.playerState.catalog.byId.get(pack.missionId);
  const mission = runtime.playerState.missions[pack.missionId];
  const resolve = definition.steps.find((step) => step.id === pack.resolution.stepId);
  assert.ok(resolve, `${pack.id} must retain its authored resolution step`);
  for (const step of definition.steps) {
    mission.progress[step.id] = step.id === resolve.id ? 0 : Number(step.required ?? 1);
  }

  const flow = ensureAuthoredMissionFlowState(runtime, pack.id);
  flow.openingChoiceId ??= pack.hearing.choices[0]?.id ?? null;
  flow.evidenceIds = [...new Set(pack.investigation.leads.map((lead) => lead.discoveryId).filter(Boolean))];
  flow.unlockedLeadIds = [...new Set(pack.investigation.leads.map((lead) => lead.id).filter(Boolean))];
  flow.selectedLeadId = null;
  flow.navigatorFocusId = null;
  flow.navigatorGroupId = null;
  flow.resolutionPreparationRouteId = null;

  runtime.playerState.player.location = resolve.targetLocation;
  runtime.playerState.player.facilityId = resolve.targetFacilityId;
  runtime.playerKnowledge.knownHubIds.add(resolve.targetLocation);
  if (resolve.targetFacilityId) runtime.playerKnowledge.knownFacilityIds.add(resolve.targetFacilityId);
  return runtime;
}

test("T15-T19 each expose exactly three authored resolution or preparation choices at their resolution step", () => {
  const packs = AUTHORED_MISSION_FLOW_PACKS.filter((pack) => LATE_TROUBLES.has(pack.troubleId));
  assert.deepEqual(packs.map((pack) => pack.troubleId).sort(), [...LATE_TROUBLES].sort());

  for (const pack of packs) {
    const runtime = prepareResolutionFixture(pack);
    const visible = availableGameRuntimeActions(runtime, data).choices;
    const routeChoices = visible.filter((action) =>
      ["resolution", "resolution_preparation"].includes(action.authoredMissionFlowKind));
    assert.equal(
      routeChoices.length,
      3,
      `${pack.id}/${pack.troubleId} resolution panel missing; visible=${visible.map((action) => `${action.id}:${action.authoredMissionFlowKind ?? action.type}`).join(",")}`,
    );
    assert.equal(new Set(routeChoices.map((action) => action.label)).size, 3, `${pack.id} must keep three distinct final choices`);
  }
});