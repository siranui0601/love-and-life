import * as core from "./authored-mission-flow-t17-runtime-service.js";
import { T17_CAPITAL_SECOND_SUMMONING_PACK as P } from "./authored/missions/t17-capital-second-summoning.js";
import { T17_CONTINUITY_CONTRACT as CONTRACT } from "./authored-mission-flow-t17-contract.js";

export * from "./authored-mission-flow-t17-runtime-service.js";

const F = Object.freeze;
const { navigatorFocuses, interventions: INTERVENTIONS } = core.T17_RUNTIME_INTERNALS;

const presentationScene = (sceneId, priority, conditions, narrative) => F({
  sceneId,
  priority,
  presentationOnly: true,
  when: F({ all: F(conditions.map(F)) }),
  narrative,
  beats: F([]),
  choices: F([]),
});

function t17Scenes() {
  const scenes = [];
  for (const source of CONTRACT.introductionSources) {
    for (const entry of source.choices) {
      scenes.push(presentationScene(
        `mission-flow.${P.id}.opening-source.${source.id}.${entry.choiceId}`,
        992,
        [
          { path: "outcome.ok", op: "isTrue", value: true },
          { path: "action.id", op: "eq", value: `${P.id}:OPENING_SOURCE:${source.id}:${entry.choiceId}` },
        ],
        `${entry.sceneTransition}。${entry.requiredDisclosure}。残る五分類は別の人物・公文書・現場から確かめなければならない。`,
      ));
    }
  }
  for (const focus of navigatorFocuses()) {
    scenes.push(presentationScene(
      `mission-flow.${P.id}.focus.${focus.id}`,
      987,
      [
        { path: "outcome.ok", op: "isTrue", value: true },
        { path: "action.authoredMissionFlowId", op: "eq", value: P.id },
        { path: "action.authoredMissionFlowKind", op: "eq", value: "navigator_focus" },
        { path: "action.authoredMissionFlowNavigatorFocusId", op: "eq", value: focus.id },
      ],
      focus.narrative,
    ));
    for (const group of focus.groups) {
      scenes.push(presentationScene(
        `mission-flow.${P.id}.group.${group.id}`,
        986,
        [
          { path: "outcome.ok", op: "isTrue", value: true },
          { path: "action.authoredMissionFlowId", op: "eq", value: P.id },
          { path: "action.authoredMissionFlowKind", op: "eq", value: "navigator_group" },
          { path: "action.authoredMissionFlowNavigatorGroupId", op: "eq", value: group.id },
        ],
        `${group.label}ため、人物・公文書・現場記録の三経路を比較する。`,
      ));
      for (const evidenceId of group.evidenceIds) {
        const lead = P.investigation.leads.find((entry) =>
          entry.discoveryId === evidenceId);
        if (!lead) continue;
        scenes.push(presentationScene(
          `mission-flow.${P.id}.route.${group.id}.${lead.id}`,
          985,
          [
            { path: "outcome.ok", op: "isTrue", value: true },
            { path: "action.authoredMissionFlowId", op: "eq", value: P.id },
            { path: "action.authoredMissionFlowKind", op: "eq", value: "navigator_route" },
            { path: "action.authoredMissionFlowLeadId", op: "eq", value: lead.id },
          ],
          `場面は${lead.destinationName}へ移る。${lead.leadNarrative} 証拠を得るには現地で記録・人物・現物を照合する必要がある。`,
        ));
        scenes.push(presentationScene(
          `mission-flow.${P.id}.evidence.${lead.id}`,
          988,
          [
            { path: "outcome.ok", op: "isTrue", value: true },
            { path: "action.authoredMissionFlowId", op: "eq", value: P.id },
            { path: "action.authoredMissionFlowKind", op: "eq", value: "evidence" },
            { path: "action.authoredMissionFlowLeadId", op: "eq", value: lead.id },
          ],
          `${lead.leadNarrative} ${lead.discoveryText}`,
        ));
        if (lead.targetLocation && lead.targetLocation !== P.hearing.targetLocation) {
          scenes.push(presentationScene(
            `mission-flow.${P.id}.lead-hub.${lead.id}`,
            984,
            [
              { path: "outcome.ok", op: "isTrue", value: true },
              { path: "action.authoredMissionFlowLeadId", op: "eq", value: lead.id },
              { path: "location.hub", op: "eq", value: lead.targetLocation },
            ],
            lead.regionalNarrative
              ?? `街道を進み、${lead.targetLocation}へ着いた。${lead.destinationName}はここからさらに先にある。`,
          ));
        }
      }
    }
  }
  for (const intervention of INTERVENTIONS) {
    scenes.push(presentationScene(
      `mission-flow.${P.id}.intervention.${intervention.id}`,
      990,
      [
        { path: "outcome.ok", op: "isTrue", value: true },
        { path: "action.authoredMissionFlowId", op: "eq", value: P.id },
        { path: "action.authoredMissionFlowKind", op: "eq", value: "intervention" },
        { path: "action.authoredMissionFlowInterventionChoiceId", op: "eq", value: intervention.id },
      ],
      `${intervention.sceneTransition}。${intervention.summary}`,
    ));
  }
  for (const route of P.resolution.choices) {
    for (const status of ["active", "critical"]) {
      scenes.push(presentationScene(
        `mission-flow.${P.id}.resolution.${route.id}.${status}`,
        991,
        [
          { path: "action.authoredMissionFlowResolutionRouteId", op: "eq", value: route.id },
          { path: "mission.id", op: "eq", value: P.missionId },
          { path: "outcome.ok", op: "isTrue", value: true },
          { path: "outcome.troubleStatusAtResolution", op: "eq", value: status },
        ],
        route.narrativeByTroubleStatus?.[status] ?? route.narrative,
      ));
    }
  }
  return scenes;
}

export const AUTHORED_MISSION_FLOW_SCENES = F([
  ...core.AUTHORED_MISSION_FLOW_SCENES,
  ...t17Scenes(),
].sort((left, right) =>
  Number(right.priority ?? 0) - Number(left.priority ?? 0)
    || left.sceneId.localeCompare(right.sceneId)));
