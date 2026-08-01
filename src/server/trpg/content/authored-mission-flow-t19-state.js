import * as base from "./authored-mission-flow-registry-t18-presented.js";
import {
  T19_BLACKRIDGE_INVASION_PACK as P,
  T19_CONTINUITY_CONTRACT as CONTRACT,
} from "./authored/missions/t19-blackridge-invasion.js";

export * from "./authored-mission-flow-registry-t18-presented.js";

const F = Object.freeze;
const ACTIVE = new Set(["active", "critical"]);
const MISSION_ACTIVE = new Set(["active", "available", "in_progress"]);
const ABSENT = new Set(["dead", "missing", "departed", "sealed", "not-yet-present"]);
const SELECTS_LEAD = new Set([
  "navigator_route",
  "lead",
  "resolution_preparation",
  "resolution_preparation_lead",
]);
const VERSION = "authored-mission-flow-t19-v1";

export const AUTHORED_MISSION_CONTINUITY_VERSION = "authored-mission-continuity-v6";
export const AUTHORED_MISSION_FLOW_PACKS = F([
  ...base.AUTHORED_MISSION_FLOW_PACKS.filter((pack) =>
    pack.id !== P.id && pack.missionId !== P.missionId),
  P,
]);
export const AUTHORED_MISSION_CONTINUITY_CONTRACTS = F({
  ...base.AUTHORED_MISSION_CONTINUITY_CONTRACTS,
  [P.id]: CONTRACT,
});

const missionDef = (runtime) =>
  runtime?.playerState?.catalog?.byId?.get?.(P.missionId)
  ?? runtime?.playerState?.catalog?.special?.find?.((entry) => entry.id === P.missionId);
const mission = (runtime) => runtime?.playerState?.missions?.[P.missionId];
const step = (runtime) => {
  const definition = missionDef(runtime);
  const state = mission(runtime);
  return definition?.steps?.find((entry) =>
    Number(state?.progress?.[entry.id] ?? 0) < Number(entry.required ?? 1)) ?? null;
};
const knows = (runtime) =>
  runtime?.playerState?.progress?.missions?.attemptedTroubleIds?.has?.(P.troubleId)
  || (runtime?.playerState?.rumors ?? []).some((rumor) =>
    rumor.troubleId === P.troubleId
      && runtime.playerState.player?.knownRumorIds?.has?.(rumor.id));
const available = (runtime) =>
  ACTIVE.has(runtime?.playerState?.troubles?.[P.troubleId]?.status
    ?? runtime?.playerState?.troubles?.[P.troubleId])
  && MISSION_ACTIVE.has(mission(runtime)?.status)
  && knows(runtime);
const evidenceGroups = () => [
  ...(P.investigation.requiredEvidenceIds ?? []).map((id) => [id]),
  ...(P.investigation.requiredEvidenceGroups ?? []).map((group) => [...group]),
];
const actionId = (kind, id) => `MISSION_FLOW:${P.id}:${kind}:${id}`;
const freshFlow = () => ({
  version: VERSION,
  flowId: P.id,
  openingChoiceId: null,
  openingSourceId: null,
 navigatorFocusId: null,
  navigatorGroupId: null,
  selectedLeadId: null,
  evidenceIds: [],
  evidenceSourceIds: {},
  unlockedLeadIds: [],
  knownFactIds: [],
  deferredUntilMinute: null,
  interventionChoiceId: null,
  resolutionPreparationRouteId: null,
  selectedResolutionRouteId: null,
  selectedResolutionContextId: null,
  resolutionBranchId: null,
  battleObjectiveResults: {},
});

function syncInvestigationProgress(runtime, flow) {
  const state = mission(runtime);
  const target = missionDef(runtime)?.steps?.find((entry) =>
    entry.id === P.investigation.stepId);
  if (!state?.progress || !target) return;
  const acquired = new Set(flow.evidenceIds);
  state.progress[target.id] = Math.min(
    Number(target.required ?? evidenceGroups().length),
    evidenceGroups().filter((group) => group.some((id) => acquired.has(id))).length,
  );
}

function ensure19(runtime) {
  runtime.authoredMissionFlows ??= {};
  runtime.authoredMissionFlows[P.id] ??= freshFlow();
  const flow = runtime.authoredMissionFlows[P.id];
  Object.assign(flow, { version: VERSION, flowId: P.id });
  flow.evidenceIds = [...new Set(Array.isArray(flow.evidenceIds) ? flow.evidenceIds : [])];
  flow.evidenceSourceIds = { ...(flow.evidenceSourceIds ?? {}) };
  flow.unlockedLeadIds = [...new Set(flow.unlockedLeadIds ?? [])];
  flow.knownFactIds = [...new Set(flow.knownFactIds ?? [])];
  flow.battleObjectiveResults = { ...(flow.battleObjectiveResults ?? {}) };
  const validEvidence = new Set(P.investigation.leads.map((lead) => lead.discoveryId));
  for (const discovery of mission(runtime)?.discoveries ?? []) {
    if (validEvidence.has(discovery?.id) && !flow.evidenceIds.includes(discovery.id)) {
      flow.evidenceIds.push(discovery.id);
    }
  }
  flow.evidenceIds = flow.evidenceIds.filter((id) => validEvidence.has(id));
  if (flow.openingChoiceId && !flow.unlockedLeadIds.length) {
    flow.unlockedLeadIds = P.investigation.leads.map((lead) => lead.id);
  }
  const selected = P.investigation.leads.find((lead) => lead.id === flow.selectedLeadId);
  if (!selected || flow.evidenceIds.includes(selected.discoveryId)) flow.selectedLeadId = null;
  syncInvestigationProgress(runtime, flow);
  return flow;
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const id = typeof pack === "string" ? pack : pack?.id;
  if (id === P.id || pack?.missionId === P.missionId) return ensure19(runtime);
  return base.ensureAuthoredMissionFlowState(runtime, pack);
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  return missionId === P.missionId
    ? ensure19(runtime)
    : base.initializeAuthoredMissionFlowForMission(runtime, missionId);
}

const sourceAt = (runtime) => CONTRACT.introductionSources.find((source) =>
  source.targetFacilityId === runtime?.playerState?.player?.facilityId);
const leadById = (id) => P.investigation.leads.find((lead) => lead.id === id);

function npcUnavailable(runtime, npcId, facilityId) {
  const state = runtime?.livingWorld?.npcStates?.[npcId];
  if (!state) return false;
  if (state.lifeStatus === "dead" || ABSENT.has(state.presence)) return true;
  const position = state.position?.facilityId ?? state.facilityId;
  if (position) return position !== facilityId;
  const present = runtime?.playerState?.authoritativePresentNpcIds;
  return present instanceof Set
    && runtime?.playerState?.player?.facilityId === facilityId
    && !present.has(npcId);
}

function resolvedLead(runtime, lead) {
  const fallback = CONTRACT.leadFallbacks?.[lead.id]?.[0];
  if (fallback && npcUnavailable(runtime, fallback.primaryNpcId, lead.facilityId)) {
    return {
      ...lead,
      ...fallback,
      id: lead.id,
      discoveryId: lead.discoveryId,
      sourceId: fallback.id,
      sourceKind: "fallback",
    };
  }
  return { ...lead, sourceId: "primary", sourceKind: "primary" };
}

function revealLeadDestination(runtime, action) {
  if (action?.authoredMissionFlowId !== P.id
    || !SELECTS_LEAD.has(action.authoredMissionFlowKind)) return false;
  const lead = leadById(action.authoredMissionFlowLeadId);
  if (!lead) return false;
  const resolved = resolvedLead(runtime, lead);
  runtime.playerKnowledge ??= {};
  runtime.playerKnowledge.knownHubIds ??= new Set();
  runtime.playerKnowledge.knownFacilityIds ??= new Set();
  const changed = !runtime.playerKnowledge.knownHubIds.has(resolved.targetLocation)
    || !runtime.playerKnowledge.knownFacilityIds.has(resolved.facilityId);
  runtime.playerKnowledge.knownHubIds.add(resolved.targetLocation);
  runtime.playerKnowledge.knownFacilityIds.add(resolved.facilityId);
  if (changed) runtime.playerState.routeCache = {};
  return changed;
}

const deferAction = () => ({
  id: actionId("DEFER", "t19"),
  family: "leave",
  type: "plan",
  minutes: 5,
  label: P.investigation.defer.label,
  authoredMissionFlowExclusiveChoice: true,
  authoredMissionFlowId: P.id,
  authoredMissionFlowKind: "defer",
  authoredMissionFlowDeferMinutes: P.investigation.defer.deferMinutes,
});

function openingActions(runtime) {
  const flow = ensure19(runtime);
  const source = sourceAt(runtime);
  const current = step(runtime);
  if (flow.openingChoiceId || !source
    || ![P.hearing.stepId, P.investigation.stepId].includes(current?.id)) return null;
  const actions = source.choices.map((entry) => {
    const opening = P.hearing.choices.find((choiceEntry) => choiceEntry.id === entry.choiceId);
    return {
      id: `${P.id}:OPENING_SOURCE:${source.id}:${opening.id}`,
      family: "investigate",
      type: "plan",
      effectKind: "inspect_authored_mission_introduction_source",
      missionId: P.missionId,
      stepId: P.hearing.stepId,
      missionTitle: P.title,
      missionTroubleId: P.troubleId,
      targetNpcId: null,
      label: entry.label,
      playerUtterance: opening.playerUtterance,
      requiredDisclosure: entry.requiredDisclosure,
      minutes: entry.minutes,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "opening",
      authoredMissionFlowChoiceId: opening.id,
      authoredMissionFlowFactId: opening.factId,
      authoredMissionFlowUnlockedLeadIds: [...opening.unlockedLeadIds],
      authoredMissionFlowOpeningSourceId: source.id,
      authoredMissionFlowSceneTransition: entry.sceneTransition,
    };
  });
  return actions.length === 3 ? actions : null;
}

function navigatorFocuses() {
  return P.investigation.focuses.map((focus) => ({
    ...focus,
    groups: focus.groups.map((group) => ({
      ...group,
      evidenceIds: [...P.investigation.requiredEvidenceGroups[group.evidenceGroupIndex]],
    })),
  }));
}

function focusActions(flow) {
  const acquired = new Set(flow.evidenceIds);
  const preferred = P.hearing.choices.find((opening) =>
    opening.id === flow.openingChoiceId)?.preferredFocusId;
  const actions = navigatorFocuses()
    .filter((focus) => focus.groups.some((group) =>
      group.evidenceIds.some((id) => !acquired.has(id))))
    .map((focus) => ({
      id: actionId("NAVIGATOR_FOCUS", focus.id),
      family: "prepare",
      type: "plan",
      minutes: focus.minutes ?? 3,
      label: focus.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "navigator_focus",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowSceneTransition: focus.sceneTransition,
    }))
    .sort((left, right) =>
      Number(right.authoredMissionFlowNavigatorFocusId === preferred)
      - Number(left.authoredMissionFlowNavigatorFocusId === preferred));
  if (actions.length < 3) actions.push(deferAction());
  return actions.slice(0, 3).length === 3 ? actions.slice(0, 3) : null;
}

function groupActions(flow) {
  const focus = navigatorFocuses().find((entry) => entry.id === flow.navigatorFocusId);
  const acquired = new Set(flow.evidenceIds);
  if (!focus) return null;
  const actions = focus.groups
    .filter((group) => group.evidenceIds.some((id) => !acquired.has(id)))
    .map((group) => ({
      id: actionId("NAVIGATOR_GROUP", group.id),
      family: "prepare",
      type: "plan",
      minutes: 2,
      label: group.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: P.id,
      authoredMissionFlowKind: "navigator_group",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowNavigatorGroupId: group.id,
    }));
  actions.push({
    id: actionId("NAVIGATOR_BACK", focus.id),
    family: "prepare",
    type: "plan",
    minutes: 1,
    label: "дё‰гЃ¤гЃ®иЄїеџєж–№й‡ќгЃёж€»г‚‹‹€]]Ь™YZ\ЬЪ[Ы‘›ЭС^Ы\Ъ]™PЪЪXЩN€ќYK€]]Ь™YZ\ЬЪ[Ы‘›ЭТY€љY€]]Ь™YZ\ЬЪ[Ы‘›ЭТЪ[™€›]љYШ]Ь—ШXЪИ‹€JNВ€Y€
XЭ[ЫњЛ›[™ЭКHXЭ[ЫњЛњ\Ъ
Y™\ђXЭ[ЫЉ
JNВ€™]\›€XЭ[ЫњЛњЫXЩJКNВџB‚™ќ[Э[Ы€›Э]PXЭ[ЫњК›ЭКHВ€ЫЫњЭ›ШЭ\ИH]љYШ]Ь‘›ШЭ\Щ\К
K™љ[™

[ќћJHO€[ќћKљYOOH›ЭЛ›]љYШ]Ь‘›ШЭ\ТY
NВ€ЫЫњЭЬ›Э\H›ШЭ\ПЛ™Ь›Э\Л™љ[™

[ќћJHO€[ќћKљYOOH›ЭЛ›]љYШ]Ь‘Ь›Э\Y
NВ€ЫЫњЭXЬ]Z\™YH™]ИЩ]
›ЭЛ™]љY[ЩRYКNВ€Y€
YЬ›Э\
H™]\›€ќ[В€ЫЫњЭXЭ[ЫњИHЬ›Э\™]љY[ЩRYВ€™љ[\Љ
Y
HO€XXЬ]Z\™Yљ\КY
JB€›X\

Y
HO€љ[ќ™\ЭYШ][Ы‹›XYЛ™љ[™

XY
HO€XY™\ШЫЭ™\ћRYOOHY
JB€™љ[\Љ›ЫЫX[ЉB€›X\

XY
HO€
В€Y€XЭ[Ы’Y
“ђU’QРUФ—Ф“ХUH‹XYљY
K€[Z[N€њ™\\™H‹€\N€њ[€‹€Z[ќ]\О€Л€X™[€XY›X™[€]]Ь™YZ\ЬЪ[Ы‘›ЭС^Ы\Ъ]™PЪЪXЩN€ќYK€]]Ь™YZ\ЬЪ[Ы‘›ЭТY€љY€]]Ь™YZ\ЬЪ[Ы‘›ЭТЪ[™€›]љYШ]Ь—Ь›Э]H‹€]]Ь™YZ\ЬЪ[Ы‘›ЭУ]љYШ]Ь‘›ШЭ\ТY€›ШЭ\ЛљY€]]Ь™YZ\ЬЪ[Ы‘›ЭУ]љYШ]Ь‘Ь›Э\Y€Ь›Э\љY€]]Ь™YZ\ЬЪ[Ы‘›ЭУXYY€XYљY€]]Ь™YZ\ЬЪ[Ы‘›ЭХ\™Щ]XЪ[]RY€XY™XЪ[]RY€]]Ь™YZ\ЬЪ[Ы‘›ЭФШЩ[™U[њЪ][ЫЋ€:*Їщ§ошаkє)Ґ№а®xаc	ЫXY™\Э[][Ы“[Y_xаn9йошаўШ€JJNВ€Y€
XЭ[ЫњЛ›[™ЭКHВ€XЭ[ЫњЛњ\Ъ
В€Y€XЭ[Ы’Y
“ђU’QРUФ—Ф“ХUWРђPТИ‹Ь›Э\љY
K€[Z[N€њ™\\™H‹€\N€њ[€‹€Z[ќ]\О€K€X™[€№d#8аf9Ґ®zaзxаk№b)yb!єhgёаn9ў.шаўИ‹€]]Ь™YZ\ЬЪ[Ы‘›ЭС^Ы\Ъ]™PЪЪXЩN€ќYK€]]Ь™YZ\ЬЪ[Ы‘›ЭТY€љY€]]Ь™YZ\ЬЪ[Ы‘›ЭТЪ[™€›]љYШ]Ь—Ь›Э]WШXЪИ‹€JNВ€B€Y€
XЭ[ЫњЛ›[™ЭКHXЭ[ЫњЛњ\Ъ
Y™\ђXЭ[ЫЉ
JNВ€™]\›€XЭ[ЫњЛњЫXЩJКNВџB‚™ќ[Э[Ы€]љY[ЩPXЭ[ЫЉќ[ќ[YKXY
HВ€ЫЫњЭ™\ЫЫ™YH™\ЫЫ™YXY
ќ[ќ[YKXY
NВ€ЫЫњЭ›ЭИH[њЭ\™LNJќ[ќ[YJNВ€Y€
ќ[ќ[YOЛњ^Y\”Э]OЛњ^Y\ЏЛ™XЪ[]RYOOH™\ЫЫ™Y™XЪ[]RY€›ЭЛ™]љY[ЩRYЛљ[ЫY\КXY™\ШЫЭ™\ћRY
JH™]\›€ќ[В€™]\›€В€Y€XЭ[Ы’Y
™\ЫЫ™YњЫЭ\ЩRЪ[™OOH™[XЪИ€И‘ђSђPТЧСU’QSђСH€€‘U’QSђСH‹XYљY
K€[Z[N€љ[ќ™\ЭYШ]H‹€\N€љ[ќ™\ЭYШ]H‹€Z\ЬЪ[Ы’Y€›Z\ЬЪ[Ы’Y€Э\Y€љ[ќ™\ЭYШ][Ы‹њЭ\Y€Z\ЬЪ[Ы•]N€ќ]K€Z\ЬЪ[Ы•›ЭX›RY€ќ›ЭX›RY€Z[ќ]\О€™\ЫЫ™Y›Z[ќ]\Л€X™[€™\ЫЫ™Y›X™[€\›ШXЪY€™\ЫЫ™Y\›ШXЪY€\ШЫЭ™\ћRY€XY™\ШЫЭ™\ћRY€\ШЫЭ™\ћU^€™\ЫЫ™Y™\ШЫЭ™\ћU^€]]Ь™YZ\ЬЪ[Ы‘›ЭС^Ы\Ъ]™PЪЪXЩN€ќYK€]]Ь™YZ\ЬЪ[Ы‘›ЭТY€љY€]]Ь™YZ\ЬЪ[Ы‘›ЭТЪ[™€™]љY[ЩH‹€]]Ь™YZ\ЬЪ[Ы‘›ЭУXYY€XYљY€]]Ь™YZ\ЬЪ[Ы‘›ЭС]љY[ЩRY€XY™\ШЫЭ™\ћRY€]]Ь™YZ\ЬЪ[Ы‘›ЭС]љY[ЩTЫЭ\ЩRY€™\ЫЫ™YњЫЭ\ЩRY€NВџB‚™ќ[Э[Ы€Щ[XЭYXYXЭ[ЫњКќ[ќ[YK›ЭЛ[Э™[Y[ќXЭ[ЫњИHЧJHВ€ЫЫњЭXYHXYћRY
›ЭЛњЩ[XЭYXYY
NВ€Y€
[XY
H™]\›€ќ[В€ЫЫњЭ™\ЫЫ™YH™\ЫЫ™YXY
ќ[ќ[YKXY
NВ€ЫЫњЭ]љY[ЩHH]љY[ЩPXЭ[ЫЉќ[ќ[YKXY
NВ€ЫЫњЭЭ\њ™[ќX€Hќ[ќ[YKњ^Y\”Э]Kњ^Y\‹›ШШ][ЫЋВ€ЫЫњЭ^XЭШШ[H[Э™[Y[ќXЭ[ЫњЛ™љ[™

XЭ[ЫЉHO‚€XЭ[ЫЏЛ›[Э™[Y[ќШЫЬHOOH›ШШ[‚€	‰€XЭ[Ы‹™\Э[][Ы‘XЪ[]RYOOH™\ЫЫ™Y™XЪ[]RY
NВ€ЫЫњЭ™YЪ[Ы[H™\ЫЫ™Yќ\™Щ]ШШ][Ы€OOHЭ\њ™[ќX‚€И[Э™[Y[ќXЭ[ЫњЛ™љ[™

XЭ[ЫЉHO‚€XЭ[ЫЏЛ›[Э™[Y[ќШЫЬHOOHњ™YЪ[Ы[‚€	‰€XЭ[Ы‹™\Э[][Ы’X€OOH™\ЫЫ™Yќ\™Щ]ШШ][ЫЉB€€ќ[В€ЫЫњЭ[Э™[Y[ќH^XЭШШ[ПИ™YЪ[Ы[В€ЫЫњЭљ[X\ћHH]љY[ЩHПИ
[Э™[Y[ќИВ€‹‹›[Э™[Y[ќ€Y€XЭ[Ы’Y
™YЪ[Ы[OOH[Э™[Y[ќИ“PQТP€€€“PQ‹XYљY
K€X™[€	Ь™\ЫЫ™Yќ\™Щ]ШШ][Ы€OOHЭ\њ™[ќX‚€И	Ь™\ЫЫ™Yќ\™Щ]ШШ][Ыџxаn9d$xаbшаa8а X€€	Ь™\ЫЫ™Y™\Э[][Ы“[Y_xаn9d$xаbшаa8а XIЬ™\ЫЫ™Y›X™[X€]]Ь™YZ\ЬЪ[Ы‘›ЭС^Ы\Ъ]™PЪЪXЩN€ќYK€]]Ь™YZ\ЬЪ[Ы‘›ЭТY€љY€]]Ь™YZ\ЬЪ[Ы‘›ЭТЪ[™€›XY‹€]]Ь™YZ\ЬЪ[Ы‘›ЭУXYY€XYљY€]]Ь™YZ\ЬЪ[Ы‘›ЭХ\™Щ]XЪ[]RY€™\ЫЫ™Y™XЪ[]RY€]]Ь™YZ\ЬЪ[Ы‘›ЭС]љY[ЩTЫЭ\ЩRY€™\ЫЫ™YњЫЭ\ЩRY€H€ќ[
NВ€ЫЫњЭXЭ[ЫњИHВ€љ[X\ћK€В€Y€XЭ[Ы’Y
”‘PУУ”ТQT€‹XYљY
K€[Z[N€њ™\\™H‹€\N€њ[€‹€Z[ќ]\О€€X™[€ёаdшаk№нc:-лша¤№ў.шаeша yb)xаkє*/9ўи9b!єhgёа¤є`n8аm€‹€]]Ь™YZ\ЬЪ[Ы‘›ЭС^Ы\Ъ]™PЪЪXЩN€ќYK€]]Ь™YZ\ЬЪ[Ы‘›ЭТY€љY€]]Ь™YZ\ЬЪ[Ы‘›ЭТЪ[™€њ™XЫЫњЪY\—ЫXY‹€K€Y™\ђXЭ[ЫЉ
K€K™љ[\Љ›ЫЫX[ЉNВ€™]\›€XЭ[ЫњЛ›[™ЭOOHИИXЭ[ЫњИ€ќ[ВџB‚‚™^ЬќЫЫњЭNWФХUWТS•T“ђSИHЉВ€]Z[X›K€Э\€ЫЭ\ЩP]€XYћRY€™\ЫЫ™YXY€™]™X[XY\Э[][Ы‹€Z\ЬЪ[Ы‹€Z\ЬЪ[Ы‘Y‹€[њЭ\™LNK€]љY[ЩQЬ›Э\Л€XЭ[Ы’Y€Ь[љ[™РXЭ[ЫњЛ€]љYШ]Ь‘›ШЭ\Щ\Л€›ШЭ\РXЭ[ЫњЛ€Ь›Э\XЭ[ЫњЛ€›Э]PXЭ[ЫњЛ€]љY[ЩPXЭ[Ы‹€Щ[XЭYXYXЭ[ЫњЛ€Y™\ђXЭ[Ы‹џJNВ