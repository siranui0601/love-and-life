import * as base from "./authored-mission-flow-registry-t15-final.js";
import { T16_CAPITAL_PERSECUTION_RIOT_PACK as P } from "./authored/missions/t16-capital-persecution-riot.js";
import { T16_CONTINUITY_CONTRACT as CONTRACT } from "./authored-mission-flow-t16-contract.js";

export * from "./authored-mission-flow-registry-t15-final.js";

const F = Object.freeze;
const ACTIVE = new Set(["active", "critical"]);
const MISSION_ACTIVE = new Set(["active", "available", "in_progress"]);
const ABSENT = new Set(["dead", "missing", "departed", "sealed", "not-yet-present"]);
const SELECTS_LEAD = new Set(["navigator_route", "lead", "resolution_preparation", "resolution_preparation_lead"]);
const VERSION = "authored-mission-flow-t16-v1";
export const AUTHORED_MISSION_CONTINUITY_VERSION = "authored-mission-continuity-v3";
export const AUTHORED_MISSION_FLOW_PACKS = F([...base.AUTHORED_MISSION_FLOW_PACKS, P]);
export const AUTHORED_MISSION_CONTINUITY_CONTRACTS = F({ ...base.AUTHORED_MISSION_CONTINUITY_CONTRACTS, [P.id]: CONTRACT });

const missionDef = (r) => r?.playerState?.catalog?.byId?.get?.(P.missionId) ?? r?.playerState?.catalog?.special?.find?.((m) => m.id === P.missionId);
const mission = (r) => r?.playerState?.missions?.[P.missionId];
const step = (r) => { const d = missionDef(r), s = mission(r); return d?.steps?.find((x) => Number(s?.progress?.[x.id] ?? 0) < Number(x.required ?? 1)) ?? null; };
const knows = (r) => r?.playerState?.progress?.missions?.attemptedTroubleIds?.has?.(P.troubleId) || (r?.playerState?.rumors ?? []).some((x) => x.troubleId === P.troubleId && r.playerState.player?.knownRumorIds?.has?.(x.id));
const available = (r) => ACTIVE.has(r?.playerState?.troubles?.[P.troubleId]?.status ?? r?.playerState?.troubles?.[P.troubleId]) && MISSION_ACTIVE.has(mission(r)?.status) && knows(r);
const groups = () => [...(P.investigation.requiredEvidenceIds ?? []).map((id) => [id]), ...(P.investigation.requiredEvidenceGroups ?? []).map((g) => [...g])];
const aid = (kind, id) => `MISSION_FLOW:${P.id}:${kind}:${id}`;
const fresh = () => ({ version: VERSION, flowId: P.id, openingChoiceId: null, openingSourceId: null, navigatorFocusId: null, navigatorGroupId: null, selectedLeadId: null, evidenceIds: [], evidenceSourceIds: {}, unlockedLeadIds: [], knownFactIds: [], deferredUntilMinute: null, resolutionPreparationRouteId: null, selectedResolutionRouteId: null, selectedResolutionContextId: null, resolutionBranchId: null, battleObjectiveResults: {} });

function sync(r, f) {
  const s = mission(r), target = missionDef(r)?.steps?.find((x) => x.id === P.investigation.stepId);
  if (!s?.progress || !target) return;
  const got = new Set(f.evidenceIds);
  s.progress[target.id] = Math.min(Number(target.required ?? groups().length), groups().filter((g) => g.some((id) => got.has(id))).length);
}
function ensure16(r) {
  r.authoredMissionFlows ??= {}; r.authoredMissionFlows[P.id] ??= fresh();
  const f = r.authoredMissionFlows[P.id]; Object.assign(f, { version: VERSION, flowId: P.id });
  f.evidenceIds = [...new Set(Array.isArray(f.evidenceIds) ? f.evidenceIds : [])];
  f.evidenceSourceIds = { ...(f.evidenceSourceIds ?? {}) }; f.unlockedLeadIds = [...new Set(f.unlockedLeadIds ?? [])];
  f.knownFactIds = [...new Set(f.knownFactIds ?? [])]; f.battleObjectiveResults = { ...(f.battleObjectiveResults ?? {}) };
  const valid = new Set(P.investigation.leads.map((x) => x.discoveryId));
  for (const d of mission(r)?.discoveries ?? []) if (valid.has(d?.id) && !f.evidenceIds.includes(d.id)) f.evidenceIds.push(d.id);
  f.evidenceIds = f.evidenceIds.filter((id) => valid.has(id));
  if (f.openingChoiceId && !f.unlockedLeadIds.length) f.unlockedLeadIds = P.investigation.leads.map((x) => x.id);
  const selected = P.investigation.leads.find((x) => x.id === f.selectedLeadId);
  if (!selected || f.evidenceIds.includes(selected.discoveryId)) f.selectedLeadId = null;
  sync(r, f); return f;
}
export function ensureAuthoredMissionFlowState(r, pack) { const id = typeof pack === "string" ? pack : pack?.id; return id === P.id || pack?.missionId === P.missionId ? ensure16(r) : base.ensureAuthoredMissionFlowState(r, pack); }
export function initializeAuthoredMissionFlowForMission(r, id) { return id === P.missionId ? ensure16(r) : base.initializeAuthoredMissionFlowForMission(r, id); }

const sourceAt = (r) => CONTRACT.introductionSources.find((x) => x.targetFacilityId === r?.playerState?.player?.facilityId);
const leadById = (id) => P.investigation.leads.find((x) => x.id === id);
const npcUnavailable = (r, id, facilityId) => {
  const s = r?.livingWorld?.npcStates?.[id];
  if (!s) return false;
  if (s.lifeStatus === "dead" || ABSENT.has(s.presence)) return true;
  const position = s.position?.facilityId ?? s.facilityId;
  if (position) return position !== facilityId;
  const present = r?.playerState?.authoritativePresentNpcIds;
  return present instanceof Set
    && r?.playerState?.player?.facilityId === facilityId
    && !present.has(id);
};
function resolvedLead(r, lead) { const fb = CONTRACT.leadFallbacks?.[lead.id]?.[0]; return fb && npcUnavailable(r, fb.primaryNpcId, lead.facilityId) ? { ...lead, ...fb, id: lead.id, discoveryId: lead.discoveryId, sourceId: fb.id, sourceKind: "fallback" } : { ...lead, sourceId: "primary", sourceKind: "primary" }; }
const defer = () => ({ id: aid("DEFER", "t16"), family: "leave", type: "plan", minutes: 5, label: P.investigation.defer.label, authoredMissionFlowExclusiveChoice: true, authoredMissionFlowId: P.id, authoredMissionFlowKind: "defer", authoredMissionFlowDeferMinutes: 120 });
function openingActions(r) {
  const f = ensure16(r), s = sourceAt(r), cur = step(r); if (f.openingChoiceId || !s || ![P.hearing.stepId, P.investigation.stepId].includes(cur?.id)) return null;
  const out = s.choices.map((c) => { const o = P.hearing.choices.find((x) => x.id === c.choiceId); return { id: `${P.id}:OPENING_SOURCE:${s.id}:${o.id}`, family: "investigate", type: "plan", effectKind: "inspect_authored_mission_introduction_source", missionId: P.missionId, stepId: P.hearing.stepId, missionTitle: P.title, missionTroubleId: P.troubleId, targetNpcId: null, label: c.label, playerUtterance: o.playerUtterance, requiredDisclosure: c.requiredDisclosure, minutes: c.minutes, authoredMissionFlowExclusiveChoice: true, authoredMissionFlowId: P.id, authoredMissionFlowKind: "opening", authoredMissionFlowChoiceId: o.id, authoredMissionFlowFactId: o.factId, authoredMissionFlowUnlockedLeadIds: [...o.unlockedLeadIds], authoredMissionFlowOpeningSourceId: s.id, authoredMissionFlowSceneTransition: c.sceneTransition }; });
  return out.length === 3 ? out : null;
}
function navFocuses() { return P.investigation.focuses.map((f) => ({ ...f, groups: f.groups.map((g) => ({ ...g, evidenceIds: [...P.investigation.requiredEvidenceGroups[g.evidenceGroupIndex]] })) })); }
function focusActions(f) {
  const got = new Set(f.evidenceIds), preferred = P.hearing.choices.find((x) => x.id === f.openingChoiceId)?.preferredFocusId;
  const out = navFocuses().filter((x) => x.groups.some((g) => g.evidenceIds.some((id) => !got.has(id)))).map((x) => ({ id: aid("NAVIGATOR_FOCUS", x.id), family: "prepare", type: "plan", minutes: x.minutes ?? 3, label: x.label, authoredMissionFlowExclusiveChoice: true, authoredMissionFlowId: P.id, authoredMissionFlowKind: "navigator_focus", authoredMissionFlowNavigatorFocusId: x.id, authoredMissionFlowSceneTransition: x.sceneTransition })).sort((a, b) => Number(b.authoredMissionFlowNavigatorFocusId === preferred) - Number(a.authoredMissionFlowNavigatorFocusId === preferred));
  if (out.length < 3) out.push(defer()); return out.slice(0, 3).length === 3 ? out.slice(0, 3) : null;
}
function groupActions(f) {
  const focus = navFocuses().find((x) => x.id === f.navigatorFocusId), got = new Set(f.evidenceIds); if (!focus) return null;
  const out = focus.groups.filter((g) => g.evidenceIds.some((id) => !got.has(id))).map((g) => ({ id: aid("NAVIGATOR_GROUP", g.id), family: "prepare", type: "plan", minutes: 2, label: g.label, authoredMissionFlowExclusiveChoice: true, authoredMissionFlowId: P.id, authoredMissionFlowKind: "navigator_group", authoredMissionFlowNavigatorFocusId: focus.id, authoredMissionFlowNavigatorGroupId: g.id }));
  out.push({ id: aid("NAVIGATOR_BACK", focus.id), family: "prepare", type: "plan", minutes: 1, label: "三つの調査方針へ戻る", authoredMissionFlowExclusiveChoice: true, authoredMissionFlowId: P.id, authoredMissionFlowKind: "navigator_back" }); if (out.length < 3) out.push(defer()); return out.slice(0, 3);
}
function routeActions(f) {
  const focus = navFocuses().find((x) => x.id === f.navigatorFocusId), group = focus?.groups.find((x) => x.id === f.navigatorGroupId), got = new Set(f.evidenceIds); if (!group) return null;
  const out = group.evidenceIds.filter((id) => !got.has(id)).map((id) => P.investigation.leads.find((x) => x.discoveryId === id)).filter(Boolean).map((l) => ({ id: aid("NAVIGATOR_ROUTE", l.id), family: "prepare", type: "plan", minutes: 3, label: l.label, authoredMissionFlowExclusiveChoice: true, authoredMissionFlowId: P.id, authoredMissionFlowKind: "navigator_route", authoredMissionFlowNavigatorFocusId: focus.id, authoredMissionFlowNavigatorGroupId: group.id, authoredMissionFlowLeadId: l.id, authoredMissionFlowTargetFacilityId: l.facilityId, authoredMissionFlowSceneTransition: `調査の視点が${l.destinationName}へ移る` }));
  if (out.length < 3) out.push({ id: aid("NAVIGATOR_ROUTE_BACK", group.id), family: "prepare", type: "plan", minutes: 1, label: "同じ方針の別分類へ戻る", authoredMissionFlowExclusiveChoice: true, authoredMissionFlowId: P.id, authoredMissionFlowKind: "navigator_route_back" }); if (out.length < 3) out.push(defer()); return out.slice(0, 3);
}
function evidenceAction(r, lead) { const v = resolvedLead(r, lead), f = ensure16(r); if (r?.playerState?.player?.facilityId !== v.facilityId || f.evidenceIds.includes(lead.discoveryId)) return null; return { id: aid(v.sourceKind === "fallback" ? "FALLBACK_EVIDENCE" : "EVIDENCE", lead.id), family: "investigate", type: "investigate", missionId: P.missionId, stepId: P.investigation.stepId, missionTitle: P.title, missionTroubleId: P.troubleId, minutes: v.minutes, label: v.label, approachId: v.approachId, discoveryId: lead.discoveryId, discoveryText: v.discoveryText, authoredMissionFlowExclusiveChoice: true, authoredMissionFlowId: P.id, authoredMissionFlowKind: "evidence", authoredMissionFlowLeadId: lead.id, authoredMissionFlowEvidenceId: lead.discoveryId, authoredMissionFlowEvidenceSourceId: v.sourceId }; }
function selectedActions(r, f, moves = []) {
  const lead = leadById(f.selectedLeadId); if (!lead) return null; const v = resolvedLead(r, lead), ev = evidenceAction(r, lead), move = ev ? null : moves.find((x) => x.destinationFacilityId === v.facilityId || x.destinationHub === v.targetLocation);
  const primary = ev ?? (move ? { ...move, id: aid("LEAD", lead.id), label: `${v.targetLocation !== r.playerState.player.location ? `${v.targetLocation}へ向かい、` : `${v.destinationName}へ向かい、`}${v.label}`, authoredMissionFlowExclusiveChoice: true, authoredMissionFlowId: P.id, authoredMissionFlowKind: "lead", authoredMissionFlowLeadId: lead.id, authoredMissionFlowTargetFacilityId: v.facilityId, authoredMissionFlowEvidenceSourceId: v.sourceId } : null);
  const out = [primary, { id: aid("RECONSIDER", lead.id), family: "prepare", type: "plan", minutes: 4, label: "この経路を戻し、別の証拠分類を選ぶ", authoredMissionFlowExclusiveChoice: true, authoredMissionFlowId: P.id, authoredMissionFlowKind: "reconsider_lead" }, defer()].filter(Boolean); return out.length === 3 ? out : null;
}

function variantMatch(r, v) { if (v.flagKey && !(r?.playerState?.worldFlags ?? {})[v.flagKey]) return false; return !(v.troubleConditions ?? []).some((c) => !(c.troubleStatuses ?? []).includes(r?.playerState?.troubles?.[c.troubleId]?.status)); }
export function resolveAuthoredMissionFlowExtensionChoice(r, c, requested = null) { if (!P.resolution.choices.some((x) => x.id === c?.id)) return base.resolveAuthoredMissionFlowExtensionChoice(r, c, requested); const v = requested ? c.contextVariants?.find((x) => x.contextId === requested) : c.contextVariants?.find((x) => variantMatch(r, x)); return v ? { ...c, ...v, id: c.id, worldEffect: { ...c.worldEffect, ...v.worldEffect } } : c; }
function rawReady(r, route) {
  const f = ensure16(r), got = new Set(f.evidenceIds), q = route.readiness, supporting = q.supportingEvidenceIds ?? [], openingMatches = (q.openingChoiceIds ?? []).includes(f.openingChoiceId), core = q.requiredEvidenceGroups ?? groups(), missingCoreGroups = core.filter((g) => !g.some((id) => got.has(id))), supportCount = supporting.filter((id) => got.has(id)).length + (openingMatches ? q.openingSupport ?? 1 : 0), openingOverrideEvidenceCount = groups().length + 1;
  const missingIds = [...missingCoreGroups.flat(), ...supporting.filter((id) => !got.has(id))], missingLeads = [...new Set(missingIds)].map((id) => P.investigation.leads.find((x) => x.discoveryId === id)).filter(Boolean);
  return { routeId: route.id, coreReady: !missingCoreGroups.length, openingReady: openingMatches || got.size >= openingOverrideEvidenceCount, openingMatches, openingOverrideEvidenceCount, supportCount, minimumSupport: q.minimumSupport, requiredCoreCount: core.length, satisfiedCoreCount: core.length - missingCoreGroups.length, missingCoreGroups, missingLeads, evidenceCount: got.size };
}
function dominant(r) { const f = ensure16(r); return P.resolution.choices.map((route, index) => { const x = rawReady(r, route); return { route, x, score: x.supportCount + (x.openingMatches ? 2 : 0) + (route.readiness.supportingEvidenceIds.indexOf(f.evidenceIds[0]) >= 0 ? .25 : 0), index }; }).sort((a, b) => b.score - a.score || a.index - b.index)[0]; }
function readiness(r, id) { const route = P.resolution.choices.find((x) => x.id === id); if (!route) return { ready: false, missingLeads: [] }; const x = rawReady(r, route), d = dominant(r); return { ...x, dominantRouteId: d.route.id, ready: x.coreReady && x.openingReady && x.supportCount >= x.minimumSupport && d.route.id === id }; }
export function authoredMissionFlowExtensionResolutionReadiness(r, id) { return P.resolution.choices.some((x) => x.id === id) ? readiness(r, id) : base.authoredMissionFlowExtensionResolutionReadiness(r, id); }
const corroborationLead = (r, x) => x.missingLeads[0]
  ?? P.investigation.leads.find((lead) => !new Set(ensure16(r).evidenceIds).has(lead.discoveryId))
  ?? null;
const prep = (r, route, x) => { const lead = corroborationLead(r, x); return ({ id: aid("RESOLUTION_PREPARATION", route.id), family: "prepare", type: "plan", effectKind: "prepare_authored_mission_resolution", missionId: P.missionId, stepId: P.investigation.stepId, missionTitle: P.title, missionTroubleId: P.troubleId, minutes: route.readiness.preparationMinutes, label: `${route.readiness.preparationLabel}（成立根拠${x.supportCount}/${x.minimumSupport}・必須条件${x.satisfiedCoreCount}/${x.requiredCoreCount}${x.openingReady ? "" : "・方針転換には七件目"}）`, authoredMissionFlowExclusiveChoice: true, authoredMissionFlowId: P.id, authoredMissionFlowKind: "resolution_preparation", authoredMissionFlowResolutionRouteId: route.id, authoredMissionFlowLeadId: lead?.id ?? null }); };
function resolutionActions(r, cur) { if (cur.targetFacilityId && r.playerState.player.facilityId !== cur.targetFacilityId) return null; return P.resolution.choices.map((route) => { const x = readiness(r, route.id); if (!x.ready) return prep(r, route, x); const resolved = resolveAuthoredMissionFlowExtensionChoice(r, route); return { id: aid("RESOLUTION", route.id), family: "help", type: "resolveMission", missionId: P.missionId, stepId: P.resolution.stepId, missionTitle: P.title, missionTroubleId: P.troubleId, minutes: resolved.minutes, label: resolved.label, authoredMissionFlowExclusiveChoice: true, authoredMissionFlowId: P.id, authoredMissionFlowKind: "resolution", authoredMissionFlowResolutionRouteId: route.id, authoredMissionFlowResolutionContextVariantId: resolved.contextId ?? null, authoredMissionFlowSceneTransition: resolved.sceneTransition }; }); }
function exclusive16(r, ctx = {}) { if (!available(r)) return null; const f = ensure16(r), cur = step(r); if (!cur) return null; const selected = selectedActions(r, f, ctx.movementActions ?? []); if (selected) return selected; const opening = openingActions(r); if (opening) return opening; if (cur.id === P.resolution.stepId) return resolutionActions(r, cur); if (cur.id !== P.investigation.stepId || !f.openingChoiceId) return null; if (!f.navigatorFocusId) return focusActions(f); if (!f.navigatorGroupId) return groupActions(f); return routeActions(f); }
export function authoredMissionFlowExclusiveActions(r, ctx = {}) { return base.authoredMissionFlowExclusiveActions(r, ctx) ?? exclusive16(r, ctx); }
export function authoredMissionFlowEvidenceAction(r) { return base.authoredMissionFlowEvidenceAction(r) ?? (available(r) && leadById(ensure16(r).selectedLeadId) ? evidenceAction(r, leadById(ensure16(r).selectedLeadId)) : null); }

export const T16_RUNTIME_INTERNALS = F({
  available,
  step,
  sourceAt,
  leadById,
  resolvedLead,
  navFocuses,
  readiness,
  mission,
  missionDef,
});
