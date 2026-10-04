import assert from "node:assert/strict";
import test from "node:test";

import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import {
  availableGameRuntimeActions,
  createGameRuntime,
  executeGameRuntimeCommand,
} from "../../../src/server/trpg/game/service.js";
import {
  AUTHORED_MISSION_FLOW_PACKS,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const data = loadTrpgGameData();

function prepare(runtime, pack) {
  const state = runtime.playerState;
  runtime.tutorial = null;
  runtime.dialogueSession = null;
  runtime.lastWorldTickMinute = state.absoluteMinute;
  state.tuning.disableTravelEncounters = true;
  state.player.location = pack.hearing.targetLocation;
  state.player.facilityId = pack.hearing.targetFacilityId;
  for (const definition of state.catalog.special) {
    state.missions[definition.id].status = definition.id === pack.missionId ? "active" : "locked";
  }
  state.troubles[pack.troubleId].status = "active";
  const mission = state.missions[pack.missionId];
  const definition = state.catalog.byId.get(pack.missionId);
  for (const step of definition.steps) mission.progress[step.id] = 0;

  const rumor = {
    id: `CERT-${pack.troubleId}-KNOWN`,
    troubleId: pack.troubleId,
    text: `${pack.title}の異変を聞いた`,
    origin: pack.hearing.targetLocation,
    originMinute: 0,
    importance: 1,
    recipients: {},
  };
  state.rumors.push(rumor);
  state.rumorById[rumor.id] = rumor;
  state.player.knownRumorIds.add(rumor.id);
  runtime.playerKnowledge.knownHubIds.add(pack.hearing.targetLocation);
  runtime.playerKnowledge.knownFacilityIds.add(pack.hearing.targetFacilityId);

  const speaker = runtime.livingWorld.npcStates[pack.hearing.npcId];
  speaker.lifeStatus = "alive";
  speaker.presence = "present";
  speaker.location = pack.hearing.targetLocation;
  speaker.position = { hubId: pack.hearing.targetLocation, facilityId: pack.hearing.targetFacilityId };
  speaker.travel = null;
  speaker.localTravel = null;
  return { state, mission, definition };
}

function choose(runtime, action) {
  assert.ok(action?.choiceId, "certificate action must be visible through production choice slots");
  const result = executeGameRuntimeCommand(runtime, data, {
    type: "CHOOSE",
    payload: { choiceId: action.choiceId },
  });
  assert.notEqual(result.outcome?.ok, false, `action ${action.id} failed: ${result.outcome?.reason ?? "unknown"}`);
  return result;
}

function navigatorGroups(pack) {
  return (pack.investigation.focuses ?? []).flatMap((focus) =>
    (focus.groups ?? []).map((group) => ({
      ...group,
      focusId: focus.id,
      evidenceIds: [...(group.evidenceIds
        ?? pack.investigation.requiredEvidenceGroups?.[Number(group.evidenceGroupIndex)]
        ?? [])],
    })));
}

function verifyLead(runtime, pack, leadId) {
  for (let guard = 0; guard < 5; guard += 1) {
    const choices = availableGameRuntimeActions(runtime, data).choices;
    const action = choices.find((entry) =>
      entry.authoredMissionFlowLeadId === leadId
      && ["lead", "evidence"].includes(entry.authoredMissionFlowKind));
    assert.ok(action,
      `${pack.id}:${leadId} disappeared before evidence; choices=${choices.map((entry) => entry.id).join(",")}`);
    const kind = action.authoredMissionFlowKind;
    choose(runtime, action);
    if (kind === "evidence") return;
  }
  assert.fail(`${pack.id}:${leadId} did not reach evidence in bounded production actions`);
}

function chooseNavigatorLead(runtime, pack, group, leadId) {
  let choices = availableGameRuntimeActions(runtime, data).choices;
  const focus = choices.find((action) =>
    action.authoredMissionFlowKind === "navigator_focus"
    && action.authoredMissionFlowNavigatorFocusId === group.focusId);
  assert.ok(focus, `${pack.id}: missing navigator focus ${group.focusId}`);
  choose(runtime, focus);

  choices = availableGameRuntimeActions(runtime, data).choices;
  const groupAction = choices.find((action) =>
    action.authoredMissionFlowKind === "navigator_group"
    && action.authoredMissionFlowNavigatorGroupId === group.id);
  assert.ok(groupAction, `${pack.id}: missing navigator group ${group.id}`);
  choose(runtime, groupAction);

  choices = availableGameRuntimeActions(runtime, data).choices;
  const route = choices.find((action) =>
    action.authoredMissionFlowKind === "navigator_route"
    && action.authoredMissionFlowLeadId === leadId);
  assert.ok(route,
    `${pack.id}: missing navigator route ${leadId}; choices=${choices.map((entry) => entry.id).join(",")}`);
  choose(runtime, route);
  verifyLead(runtime, pack, leadId);
}

function nextIncompleteStep(runtime, pack) {
  const definition = runtime.playerState.catalog.byId.get(pack.missionId);
  const mission = runtime.playerState.missions[pack.missionId];
  return definition.steps.find((step) =>
    Number(mission.progress[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function collectInvestigation(runtime, pack) {
  for (let guard = 0; guard < Math.max(12, pack.investigation.leads.length * 2); guard += 1) {
    const step = nextIncompleteStep(runtime, pack);
    if (!step || step.id !== pack.investigation.stepId) return;
    const flow = runtime.authoredMissionFlows?.[pack.id];
    const evidence = new Set(flow?.evidenceIds ?? []);
    const groups = navigatorGroups(pack);
    if (groups.length) {
      const group = groups.find((entry) => !entry.evidenceIds.some((id) => evidence.has(id)));
      assert.ok(group,
        `${pack.id}: investigation incomplete but every navigator class appears satisfied; evidence=${[...evidence].join(",")}`);
      const evidenceId = group.evidenceIds.find((id) => !evidence.has(id));
      const lead = pack.investigation.leads.find((entry) => entry.discoveryId === evidenceId);
      assert.ok(lead, `${pack.id}: no lead for ${evidenceId}`);
      chooseNavigatorLead(runtime, pack, group, lead.id);
      continue;
    }

    const choices = availableGameRuntimeActions(runtime, data).choices;
    const required = new Set(pack.investigation.requiredEvidenceIds ?? []);
    for (const group of pack.investigation.requiredEvidenceGroups ?? []) {
      if (!group.some((id) => evidence.has(id))) group.forEach((id) => required.add(id));
    }
    const lead = choices.find((action) => {
      if (action.authoredMissionFlowKind !== "lead") return false;
      const definition = pack.investigation.leads.find((entry) => entry.id === action.authoredMissionFlowLeadId);
      return definition && required.has(definition.discoveryId) && !evidence.has(definition.discoveryId);
    }) ?? choices.find((action) => action.authoredMissionFlowKind === "lead");
    assert.ok(lead,
      `${pack.id}: no lead while investigation incomplete; evidence=${[...evidence].join(",")}; choices=${choices.map((entry) => entry.id).join(",")}`);
    verifyLead(runtime, pack, lead.authoredMissionFlowLeadId);
  }
  assert.fail(`${pack.id}: investigation did not complete inside certificate guard`);
}

test("every authored pack reaches its three resolution routes after real opening and evidence progression", () => {
  for (const pack of AUTHORED_MISSION_FLOW_PACKS) {
    if (!pack.resolution?.choices?.length) continue;
    const runtime = createGameRuntime(data, {
      seed: `resolution-progression-cert:${pack.id}`,
      profileId: "balanced",
      playerName: "解決導線監査役",
      tutorial: false,
    });
    const { mission, definition } = prepare(runtime, pack);

    const opening = availableGameRuntimeActions(runtime, data).choices
      .find((action) => action.authoredMissionFlowKind === "opening");
    assert.ok(opening, `${pack.id}: opening missing`);
    choose(runtime, opening);
    collectInvestigation(runtime, pack);

    const battleStep = definition.steps.find((step) => step.type === "battle");
    if (battleStep) mission.progress[battleStep.id] = Number(battleStep.required ?? 1);
    runtime.playerState.troubles[pack.troubleId].status = "active";
    const resolveStep = definition.steps.find((step) => step.id === pack.resolution.stepId);
    assert.ok(resolveStep, `${pack.id}: resolve step missing`);
    runtime.playerState.player.location = resolveStep.targetLocation;
    runtime.playerState.player.facilityId = resolveStep.targetFacilityId;

    const choices = availableGameRuntimeActions(runtime, data).choices;
    const resolutions = choices.filter((action) =>
      ["resolution", "resolution_preparation"].includes(action.authoredMissionFlowKind));
    assert.equal(
      resolutions.length,
      3,
      `${pack.id}: expected 3 resolution surfaces after progressed investigation; `
        + `step=${nextIncompleteStep(runtime, pack)?.id ?? "none"}; `
        + `evidence=${runtime.authoredMissionFlows?.[pack.id]?.evidenceIds?.join(",") ?? ""}; `
        + `choices=${choices.map((entry) => `${entry.id}[${entry.authoredMissionFlowKind ?? entry.type}]`).join(",")}`,
    );
    assert.ok(
      resolutions.some((action) => action.authoredMissionFlowKind === "resolution"),
      `${pack.id}: all three plans remain unsupported after a complete investigation`,
    );
  }
});
