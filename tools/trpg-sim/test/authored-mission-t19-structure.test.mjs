import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORED_MISSION_CONTINUITY_CONTRACTS,
  AUTHORED_MISSION_FLOW_SCENES,
  applyAuthoredMissionFlowCatalogOverrides,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowExtensionResolutionReadiness,
  ensureAuthoredMissionFlowState,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";
import {
  FLOW_ID, MISSION_ID, auditT19EvidenceProfiles, pack, runtimeAt,
} from "./authored-mission-t19-fixture.mjs";

test("T19 registers three openings, eighteen routes, three resolutions, and presentation scenes", () => {
  const missionPack = pack();
  assert.ok(missionPack);
  assert.equal(missionPack.troubleId, "T19");
  assert.equal(missionPack.hearing.choices.length, 3);
  assert.equal(missionPack.investigation.requiredEvidenceCount, 6);
  assert.equal(missionPack.investigation.requiredEvidenceGroups.length, 6);
  assert.deepEqual(missionPack.investigation.requiredEvidenceGroups.map((group) => group.length), [3, 3, 3, 3, 3, 3]);
  assert.equal(missionPack.investigation.leads.length, 18);
  assert.equal(new Set(missionPack.investigation.leads.map((lead) => lead.id)).size, 18);
  assert.equal(new Set(missionPack.investigation.leads.map((lead) => lead.discoveryId)).size, 18);
  assert.equal(missionPack.resolution.choices.length, 3);
  assert.equal(missionPack.battle.fullActivationDay, 76);
  assert.equal(missionPack.battle.capitalOutskirtsDay, 82);
  assert.equal(missionPack.battle.irreversibleFailureDay, 90);
  assert.ok(AUTHORED_MISSION_FLOW_SCENES.some((scene) =>
    scene.sceneId.startsWith(`mission-flow.${FLOW_ID}.resolution.`)));
});

test("T19 begins from three independent public records with three scene-changing decisions each", () => {
  const contract = AUTHORED_MISSION_CONTINUITY_CONTRACTS[FLOW_ID];
  assert.equal(contract.introductionSources.length, 3);
  for (const source of contract.introductionSources) {
    const runtime = runtimeAt(source.targetFacilityId, { location: source.targetLocation });
    const actions = authoredMissionFlowExclusiveActions(runtime, {
      movementActions: [],
      presentNpcs: [],
    });
    assert.equal(actions.length, 3);
    assert.equal(new Set(actions.map((action) => action.authoredMissionFlowChoiceId)).size, 3);
    assert.equal(new Set(actions.map((action) => action.authoredMissionFlowSceneTransition)).size, 3);
    assert.ok(actions.every((action) => action.authoredMissionFlowOpeningSourceId === source.id));
    assert.ok(actions.every((action) => action.targetNpcId === null));
  }
});

test("T19 investigation progress counts six independent war-prevention classes", () => {
  const runtime = runtimeAt();
  applyAuthoredMissionFlowCatalogOverrides(runtime.playerState.catalog);
  runtime.playerState.missions[MISSION_ID].progress.hear = 1;
  const missionPack = pack();
  const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
  flow.openingChoiceId = missionPack.hearing.choices[0].id;
  flow.unlockedLeadIds = missionPack.investigation.leads.map((lead) => lead.id);

  runtime.playerState.missions[MISSION_ID].discoveries =
    missionPack.investigation.requiredEvidenceGroups[0].map((id) => ({ id }));
  ensureAuthoredMissionFlowState(runtime, missionPack);
  assert.equal(runtime.playerState.missions[MISSION_ID].progress.investigate, 1);

  runtime.playerState.missions[MISSION_ID].discoveries =
    missionPack.investigation.requiredEvidenceGroups.map((group) => ({ id: group[0] }));
  ensureAuthoredMissionFlowState(runtime, missionPack);
  assert.equal(runtime.playerState.missions[MISSION_ID].progress.investigate, 6);
});

test("all 2,187 T19 opening and evidence profiles expose at most one immediate resolution", () => {
  assert.deepEqual(auditT19EvidenceProfiles(), {
    profiles: 2187,
    none: 1968,
    one: 219,
    multiple: 0,
    routes: {
      reciprocal_verified_ceasefire: 73,
      joint_defense_and_open_corridor: 73,
      layered_defense_and_civilian_armistice: 73,
    },
  });

  const missionPack = pack();
  const groups = missionPack.investigation.requiredEvidenceGroups;
  let profiles = 0;
  let multiple = 0;
  for (const opening of missionPack.hearing.choices) {
    for (const a of groups[0]) for (const b of groups[1]) for (const c of groups[2]) {
      for (const d of groups[3]) for (const e of groups[4]) for (const f of groups[5]) {
        const runtime = runtimeAt();
        const flow = ensureAuthoredMissionFlowState(runtime, missionPack);
        flow.openingChoiceId = opening.id;
        flow.evidenceIds = [a, b, c, d, e, f];
        const ready = missionPack.resolution.choices.filter((route) =>
          authoredMissionFlowExtensionResolutionReadiness(runtime, route.id).ready);
        profiles += 1;
        if (ready.length > 1) multiple += 1;
      }
    }
  }
  assert.equal(profiles, 2187);
  assert.equal(multiple, 0);
});
