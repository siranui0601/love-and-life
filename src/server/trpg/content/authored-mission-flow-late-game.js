import * as core from "./authored-mission-flow-t16-runtime.js";
import { T16_CAPITAL_PERSECUTION_RIOT_PACK as P } from "./authored/missions/t16-capital-persecution-riot.js";
import { T16_CONTINUITY_CONTRACT as CONTRACT } from "./authored-mission-flow-t16-contract.js";

export * from "./authored-mission-flow-t16-runtime.js";

const F = Object.freeze;
const SELECTS_LEAD = new Set(["navigator_route", "lead", "resolution_preparation", "resolution_preparation_lead"]);
const { available, step, sourceAt, leadById, resolvedLead, navFocuses, readiness, mission, missionDef } = core.T16_RUNTIME_INTERNALS;
const ensure16 = (runtime) => core.ensureAuthoredMissionFlowState(runtime, P);
function reveal(r, action) { if (action?.authoredMissionFlowId !== P.id || !SELECTS_LEAD.has(action.authoredMissionFlowKind)) return false; const lead = leadById(action.authoredMissionFlowLeadId); if (!lead) return false; r.playerKnowledge ??= {}; r.playerKnowledge.knownHubIds ??= new Set(); r.playerKnowledge.knownFacilityIds ??= new Set(); const changed = !r.playerKnowledge.knownHubIds.has(lead.targetLocation) || !r.playerKnowledge.knownFacilityIds.has(lead.facilityId); r.playerKnowledge.knownHubIds.add(lead.targetLocation); r.playerKnowledge.knownFacilityIds.add(lead.facilityId); if (changed) r.playerState.routeCache = {}; return changed; }
function complete(r, id) { const s = mission(r), x = missionDef(r)?.steps?.find((e) => e.id === id); if (!s?.progress || !x) return false; const req = Number(x.required ?? 1); if (Number(s.progress[id] ?? 0) >= req) return false; s.progress[id] = req; return true; }
function discovery(r, lead) { const s = mission(r); s.discoveries ??= []; if (!s.discoveries.some((x) => x.id === lead.discoveryId)) s.discoveries.push({ id: lead.discoveryId, text: lead.discoveryText, approachId: lead.approachId, discoveredAtMinute: r.playerState.absoluteMinute }); }
function battleObjectives(r, action, result) {
  if (action?.missionId !== P.missionId) return false; const battle = result?.battle ?? result, f = ensure16(r); r.playerState.worldFlags ??= {}; r.playerState.worldFlags.missionBattleObjectives ??= {}; r.playerState.worldFlags.missionBattleObjectives[P.missionId] ??= {}; r.narrativeMemory ??= {}; r.narrativeMemory.semanticFlags ??= {};
  for (const o of CONTRACT.battleObjectives) { const got = new Set(f.evidenceIds), rounds = Number(battle?.rounds ?? battle?.turns ?? 0), status = battle?.won && (!o.requiredAnyEvidenceIds?.length || o.requiredAnyEvidenceIds.some((id) => got.has(id))) && (o.maxRounds == null || rounds <= o.maxRounds) ? "success" : "failed"; f.battleObjectiveResults[o.id] = { status, encounterId: battle?.encounterId ?? null, rounds, evaluatedAtMinute: r.playerState.absoluteMinute }; r.playerState.worldFlags.missionBattleObjectives[P.missionId][o.id] = status; r.narrativeMemory.semanticFlags[`trouble.T16.battleObjective.${o.id}`] = status; }
  r.playerState.history ??= []; r.playerState.history.push({ type: "AUTHORED_MISSION_BATTLE_OBJECTIVES_EVALUATED", minute: r.playerState.absoluteMinute, missionId: P.missionId, results: { ...f.battleObjectiveResults } }); result.summary = `${result.summary ?? "戦闘を終えた。"} 副目標：${CONTRACT.battleObjectives.map((o) => `${o.label}=${f.battleObjectiveResults[o.id].status === "success" ? "達成" : "未達"}`).join("／")}`; return true;
}
function rumor(r, route, flow) {
  const w = r.livingWorld;
  const effect = route.worldEffect;
  if (!w || !effect?.factId || !effect?.facilityId) return false;
  const minute = Number(r.playerState.absoluteMinute ?? 0);
  const learnedAt = minute / 60;
  const propagationAt = learnedAt + Number(effect.propagationDelayHours ?? 2);
  w.facilityRumors ??= {};
  const map = w.facilityRumors[effect.facilityId] instanceof Map
    ? w.facilityRumors[effect.facilityId]
    : new Map(Object.entries(w.facilityRumors[effect.facilityId] ?? {}));
  w.facilityRumors[effect.facilityId] = map;
  let changed = false;
  if (!map.has(effect.factId)) {
    w.seededTroubleFacts ??= new Set();
    w.seededTroubleFacts.add(effect.factId);
    w.knowledgeEvents ??= [];
    w.knowledgeEventSequence = Number(w.knowledgeEventSequence ?? w.knowledgeEvents.length) + 1;
    const eventId = `K${String(w.knowledgeEventSequence).padStart(7, "0")}`;
    const belief = {
      factId: effect.factId,
      kind: "trouble",
      text: effect.text,
      troubleId: P.troubleId,
      troubleIds: [P.troubleId],
      troubleStatus: "resolved",
      confidence: 1,
      importance: .95,
      secret: false,
      learnedAt,
      propagationAt,
      sourceType: "player-intervention",
      sourceNpcId: null,
      provenanceEventId: eventId,
      hopCount: 0,
      path: [`facility:${effect.facilityId}`],
      aftermathPlans: (effect.aftermathPlans ?? []).map((plan) => ({ ...plan, npcIds: [...(plan.npcIds ?? [])] })),
    };
    w.knowledgeEvents.push({
      id: eventId,
      type: "rumor-source",
      npcId: null,
      factId: effect.factId,
      troubleId: P.troubleId,
      troubleStatus: "resolved",
      learnedAt,
      propagationAt,
      sourceType: "player-intervention",
      importance: belief.importance,
      confidence: belief.confidence,
      hopCount: 0,
      path: [...belief.path],
      location: { hubId: r.playerState.player.location, facilityId: effect.facilityId },
    });
    map.set(effect.factId, {
      factId: effect.factId,
      belief,
      propagationAt,
      sourceNpcId: null,
      sourceEventId: eventId,
      carrierType: "player-intervention",
    });
    changed = true;
  }
  r.playerState.history ??= [];
  if (!r.playerState.history.some((entry) =>
    entry.type === "AUTHORED_MISSION_FLOW_RESOLUTION_SELECTED"
      && entry.missionId === P.missionId
      && entry.routeId === route.id
      && entry.worldEffectFactId === effect.factId)) {
    r.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_RESOLUTION_SELECTED",
      minute,
      flowId: P.id,
      missionId: P.missionId,
      troubleId: P.troubleId,
      routeId: route.id,
      contextVariantId: flow.selectedResolutionContextId,
      resolutionBranchId: flow.resolutionBranchId,
      evidenceOrder: [...flow.evidenceIds],
      openingChoiceId: flow.openingChoiceId,
      troubleStatus: "resolved",
      worldEffectFactId: effect.factId,
    });
    changed = true;
  }
  return changed;
}
function resolutionEffect(r, route, f, result) {
  const resolved = core.resolveAuthoredMissionFlowExtensionChoice(
    r,
    route,
    result?.authoredMissionFlowResolutionContextVariantId,
  );
  const signature = `${f.openingChoiceId}|${f.evidenceIds.join(">")}|${route.id}|${resolved.contextId ?? "base"}|${Object.entries(f.battleObjectiveResults).map(([k, v]) => `${k}:${v.status}`).join(",")}`;
  f.selectedResolutionRouteId = route.id;
  f.selectedResolutionContextId = resolved.contextId ?? null;
  f.resolutionBranchId = `T16:${signature}`;
  r.playerState.worldFlags ??= {};
  r.playerState.worldFlags[route.worldEffect.flagKey] = route.id;
  r.playerState.worldFlags.t16ResolutionRoute = route.id;
  r.playerState.worldFlags.t16ResolutionContext = f.selectedResolutionContextId;
  r.playerState.worldFlags.t16ResolutionBranch = f.resolutionBranchId;
  r.narrativeMemory ??= {};
  r.narrativeMemory.semanticFlags ??= {};
  r.narrativeMemory.semanticFlags[`trouble.${P.troubleId}.resolutionRoute`] = route.id;
  r.narrativeMemory.semanticFlags[`trouble.${P.troubleId}.resolutionContext`] = f.selectedResolutionContextId;
  r.narrativeMemory.semanticFlags[`trouble.${P.troubleId}.resolutionBranch`] = f.resolutionBranchId;
  r.narrativeMemory.localFacts ??= [];
  if (!r.narrativeMemory.localFacts.some((entry) => entry.factId === route.worldEffect.factId)) {
    r.narrativeMemory.localFacts.push({
      type: "authored_resolution",
      factId: route.worldEffect.factId,
      subjectId: P.troubleId,
      predicate: "resolution_route",
      value: route.id,
      summary: route.worldEffect.text,
      troubleId: P.troubleId,
      locationId: r.playerState.player.location,
      facilityId: route.worldEffect.facilityId,
      recordedAtMinute: Number(r.playerState.absoluteMinute ?? 0),
    });
  }
  complete(r, P.resolution.stepId);
  result.summary = resolved.summary ?? route.summary;
  result.sceneTransition = resolved.sceneTransition ?? route.sceneTransition;
  rumor(r, resolved, f);
  return true;
}

export function applyAuthoredMissionFlowAction(r, action, result) {
  let changed = core.applyAuthoredMissionFlowAction(r, action, result); if (result?.ok === false) return changed; if (action?.missionId === P.missionId && action?.type === "missionBattle") return battleObjectives(r, action, result) || changed; if (action?.authoredMissionFlowId !== P.id) return changed;
  const f = ensure16(r), kind = action.authoredMissionFlowKind, minute = Number(r.playerState.absoluteMinute ?? 0);
  if (kind === "opening") { f.openingChoiceId = action.authoredMissionFlowChoiceId; f.openingSourceId = action.authoredMissionFlowOpeningSourceId; f.unlockedLeadIds = [...new Set(action.authoredMissionFlowUnlockedLeadIds ?? P.investigation.leads.map((x) => x.id))]; if (action.authoredMissionFlowFactId) f.knownFactIds.push(action.authoredMissionFlowFactId); complete(r, P.hearing.stepId); result.summary ??= "亜人排斥暴動の最初の因果線を確定した。"; result.sceneTransition = action.authoredMissionFlowSceneTransition; changed = true; }
  if (kind === "navigator_focus") { f.navigatorFocusId = action.authoredMissionFlowNavigatorFocusId; f.navigatorGroupId = null; changed = true; }
  if (kind === "navigator_group") { f.navigatorGroupId = action.authoredMissionFlowNavigatorGroupId; changed = true; }
  if (kind === "navigator_back") { f.navigatorFocusId = null; f.navigatorGroupId = null; changed = true; }
  if (kind === "navigator_route_back") { f.navigatorGroupId = null; changed = true; }
  if (["navigator_route", "lead", "resolution_preparation_lead"].includes(kind)) { f.selectedLeadId = action.authoredMissionFlowLeadId; changed = true; }
  if (kind === "evidence") { const lead = leadById(action.authoredMissionFlowLeadId); if (lead && !f.evidenceIds.includes(lead.discoveryId)) f.evidenceIds.push(lead.discoveryId); if (lead) discovery(r, lead); if (lead) f.evidenceSourceIds[lead.discoveryId] = action.authoredMissionFlowEvidenceSourceId; f.selectedLeadId = null; f.navigatorFocusId = null; f.navigatorGroupId = null; core.ensureAuthoredMissionFlowState(r, P); changed = true; }
  if (kind === "reconsider_lead") { f.selectedLeadId = null; f.navigatorGroupId = null; changed = true; }
  if (kind === "resolution_preparation") { f.resolutionPreparationRouteId = action.authoredMissionFlowResolutionRouteId; f.selectedLeadId = action.authoredMissionFlowLeadId; changed = true; }
  if (kind === "resolution") { const route = P.resolution.choices.find((x) => x.id === action.authoredMissionFlowResolutionRouteId), ready = route && readiness(r, route.id); if (ready?.ready) changed = resolutionEffect(r, route, f, result) || changed; else { result.ok = false; result.reason = "authored_resolution_evidence_missing"; result.summary = "欠けている核心証拠を補う必要がある。"; changed = true; } }
  if (kind === "defer") { f.deferredUntilMinute = minute + Number(action.authoredMissionFlowDeferMinutes ?? 120); result.summary ??= P.investigation.defer.summary; changed = true; }
  reveal(r, action); if (changed) { r.playerState.history ??= []; r.playerState.history.push({ type: "AUTHORED_MISSION_FLOW_T16_UPDATED", minute, missionId: P.missionId, flowKind: kind, openingChoiceId: f.openingChoiceId, evidenceCount: f.evidenceIds.length, selectedLeadId: f.selectedLeadId, resolutionRouteId: f.selectedResolutionRouteId }); } return changed;
}
export function suppressGenericAuthoredMissionAction(r, action) { if (action?.missionId !== P.missionId) return core.suppressGenericAuthoredMissionAction(r, action); if (!available(r) || action.authoredMissionFlowId === P.id) return false; const f = ensure16(r), cur = step(r); return [P.hearing.stepId, P.investigation.stepId].includes(cur?.id) && (!f.openingChoiceId || f.selectedLeadId || sourceAt(r)); }
export function applyAuthoredMissionFlowCatalogOverrides(catalog) { const out = core.applyAuthoredMissionFlowCatalogOverrides(catalog), m = out?.special?.find((x) => x.id === P.missionId); if (!m) return out; for (const [section, patch] of Object.entries(P.catalogOverride)) { const id = P[section]?.stepId; const s = m.steps.find((x) => x.id === id); if (s) Object.assign(s, patch); } const battle = m.steps.find((x) => x.id === P.battle.stepId || x.type === "battle"); if (battle) battle.sideObjectives = CONTRACT.battleObjectives.map((x) => ({ id: x.id, label: x.label, independentOfVictory: true })); return out; }
export function authoredMissionFlowGuidance(r) { const existing = core.authoredMissionFlowGuidance(r); if (existing) return existing; if (!available(r)) return null; const f = ensure16(r), cur = step(r); if (!f.openingChoiceId) { const s = sourceAt(r) ?? CONTRACT.introductionSources[0]; return { missionId: P.missionId, ...s.guidance, targetLocation: s.targetLocation, targetFacilityId: s.targetFacilityId, sourceId: s.id, actionPanel: r.playerState.player.facilityId === s.targetFacilityId ? null : "movement" }; } if (cur?.id === P.investigation.stepId && f.selectedLeadId) { const v = resolvedLead(r, leadById(f.selectedLeadId)); return { missionId: P.missionId, kicker: v.sourceKind === "fallback" ? "人物不在でも独立記録は残る" : P.investigation.selectedLeadGuidance.kicker, title: v.label, detail: v.leadNarrative, targetLocation: v.targetLocation, targetFacilityId: v.facilityId, actionPanel: r.playerState.player.facilityId === v.facilityId ? null : "movement" }; } const g = cur?.id === P.investigation.stepId ? (f.evidenceIds.length ? P.investigation.continuedGuidance : P.investigation.initialGuidance) : cur?.id === P.battle.stepId ? P.stepGuidance.battle : P.stepGuidance.resolve; return g ? { missionId: P.missionId, ...g, targetLocation: cur?.targetLocation ?? P.hearing.targetLocation, targetFacilityId: cur?.targetFacilityId ?? null, actionPanel: cur?.targetFacilityId && r.playerState.player.facilityId !== cur.targetFacilityId ? "movement" : null } : null; }

const presentationScene = (sceneId, priority, conditions, narrative) => F({
  sceneId,
  priority,
  presentationOnly: true,
  when: F({ all: F(conditions.map(F)) }),
  narrative,
  beats: F([]),
  choices: F([]),
});

function t16Scenes() {
  const scenes = [];
  for (const source of CONTRACT.introductionSources) {
    for (const entry of source.choices) {
      scenes.push(presentationScene(
        `mission-flow.${P.id}.opening-source.${source.id}.${entry.choiceId}`,
        982,
        [
          { path: "outcome.ok", op: "isTrue", value: true },
          { path: "action.id", op: "eq", value: `${P.id}:OPENING_SOURCE:${source.id}:${entry.choiceId}` },
        ],
        `${entry.sceneTransition}。${entry.requiredDisclosure}。残る五分類は別の場所と記録から確かめなければならない。`,
      ));
    }
  }
  for (const focus of navFocuses()) {
    scenes.push(presentationScene(
      `mission-flow.${P.id}.focus.${focus.id}`,
      977,
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
        976,
        [
          { path: "outcome.ok", op: "isTrue", value: true },
          { path: "action.authoredMissionFlowId", op: "eq", value: P.id },
          { path: "action.authoredMissionFlowKind", op: "eq", value: "navigator_group" },
          { path: "action.authoredMissionFlowNavigatorGroupId", op: "eq", value: group.id },
        ],
        `${group.label}ため、三つの独立経路を比較する。`,
      ));
      for (const evidenceId of group.evidenceIds) {
        const lead = P.investigation.leads.find((entry) => entry.discoveryId === evidenceId);
        if (!lead) continue;
        scenes.push(presentationScene(
          `mission-flow.${P.id}.route.${group.id}.${lead.id}`,
          975,
          [
            { path: "outcome.ok", op: "isTrue", value: true },
            { path: "action.authoredMissionFlowId", op: "eq", value: P.id },
            { path: "action.authoredMissionFlowKind", op: "eq", value: "navigator_route" },
            { path: "action.authoredMissionFlowLeadId", op: "eq", value: lead.id },
          ],
          `場面は${lead.destinationName}へ移る。${lead.leadNarrative} 証拠を得るには、現地の記録・人物・現物を照合する必要がある。`,
        ));
        scenes.push(presentationScene(
          `mission-flow.${P.id}.evidence.${lead.id}`,
          978,
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
            974,
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
  for (const route of P.resolution.choices) {
    for (const status of ["active", "critical"]) {
      scenes.push(presentationScene(
        `mission-flow.${P.id}.resolution.${route.id}.${status}`,
        980,
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
  ...t16Scenes(),
].sort((left, right) => Number(right.priority ?? 0) - Number(left.priority ?? 0)
  || left.sceneId.localeCompare(right.sceneId)));
