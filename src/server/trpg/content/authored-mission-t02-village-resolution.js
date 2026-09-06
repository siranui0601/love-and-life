import * as base from "./authored-village-day5-before-fire.js";

export * from "./authored-village-day5-before-fire.js";

export const AUTHORED_T02_VILLAGE_RESOLUTION_VERSION = "authored-t02-village-resolution-v1";

const MISSION_ID = "MSN-T02";
const TROUBLE_ID = "T02";
const LOCATION = "田園の村";
const FACILITY_ID = "LOC_FARM_GRANARY";
const STATE_KEY = "t02VillageResolution";
const ROUTE_ID = "public_prosecution_and_contract_void";
const ROUTE_ACTION_PREFIX = `MISSION_FLOW:granary-arson:RESOLUTION:${ROUTE_ID}:`;
const PREP_ACTION_ID = "T02_GRANARY:RESOLUTION:REVIEW_CONTRACT_AND_TESTIMONY";
const RECORD_ACTION_ID = "T02_GRANARY:RESOLUTION:RECORD_DALK_PROTECTION_AND_REBUILD";
const PREP_MINUTES = 42;
const RECORD_MINUTES = 13;
const FACT_IDS = new Set([
  "player:T02:public-prosecution-contract-void",
  "player:T02:critical-public-stay-contract-void",
]);

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function missionDefinition(runtime) {
  return runtime?.playerState?.catalog?.special?.find?.((entry) => entry?.id === MISSION_ID) ?? null;
}

function missionRuntime(runtime) {
  const missions = runtime?.playerState?.missions;
  if (missions instanceof Map) return missions.get(MISSION_ID) ?? null;
  if (Array.isArray(missions)) return missions.find((entry) => entry?.id === MISSION_ID) ?? null;
  return missions?.[MISSION_ID] ?? null;
}

function currentStep(runtime) {
  const definition = missionDefinition(runtime);
  const state = missionRuntime(runtime);
  if (!definition || !state) return null;
  return definition.steps?.find((step) =>
    Number(state.progress?.[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function atGranary(runtime) {
  const current = player(runtime);
  return current.location === LOCATION && current.facilityId === FACILITY_ID;
}

function t02Open(runtime) {
  const mission = missionRuntime(runtime);
  const trouble = runtime?.playerState?.troubles?.[TROUBLE_ID];
  return ["active", "available", "in_progress"].includes(String(mission?.status ?? ""))
    && ["active", "critical"].includes(String(trouble?.status ?? trouble ?? ""));
}

function resolveStepActive(runtime) {
  return t02Open(runtime) && currentStep(runtime)?.id === "resolve";
}

function readState(runtime) {
  const value = runtime?.playerState?.[STATE_KEY];
  return value && typeof value === "object" ? value : null;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_T02_VILLAGE_RESOLUTION_VERSION,
    reviewedAtMinute: null,
    resolvedAtMinute: null,
    recordedAtMinute: null,
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_T02_VILLAGE_RESOLUTION_VERSION;
  return state;
}

function action(id, phase, minutes, family, label) {
  return {
    id,
    actionId: id,
    family,
    type: "plan",
    minutes,
    label,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredT02VillageResolutionChoice: true,
    authoredT02VillageResolutionPhase: phase,
  };
}

function reviewAction() {
  return action(
    PREP_ACTION_ID,
    "review",
    PREP_MINUTES,
    "investigate",
    "ガロとトーマと、契約書・前金記録・ダルクの証言を突き合わせる",
  );
}

function recordAction() {
  return action(
    RECORD_ACTION_ID,
    "record",
    RECORD_MINUTES,
    "help",
    "ダルクの保護と生活再建、村の収穫権保全を村務記録へ残す",
  );
}

function reviewEligible(runtime) {
  return resolveStepActive(runtime)
    && atGranary(runtime)
    && readState(runtime)?.reviewedAtMinute == null;
}

function recordEligible(runtime) {
  const state = readState(runtime);
  const trouble = runtime?.playerState?.troubles?.[TROUBLE_ID];
  return atGranary(runtime)
    && state?.resolvedAtMinute != null
    && state?.recordedAtMinute == null
    && String(trouble?.status ?? trouble ?? "") === "resolved";
}

function canonicalResolutionAction(selected) {
  const id = String(selected?.actionId ?? selected?.id ?? "");
  return id.startsWith(ROUTE_ACTION_PREFIX);
}

function consumeOwn(runtime, selected, result) {
  if (!selected?.authoredT02VillageResolutionChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  if (selected.authoredT02VillageResolutionPhase === "review") {
    if (state.reviewedAtMinute != null) return false;
    state.reviewedAtMinute = minute;
    runtime.playerState.history ??= [];
    runtime.playerState.history.push({
      type: "T02_VILLAGE_RESOLUTION_EVIDENCE_REVIEWED",
      minute,
      missionId: MISSION_ID,
      troubleId: TROUBLE_ID,
      actionId: selected.id,
      facilityId: FACILITY_ID,
      participants: ["NPC003", "NPC005"],
    });
    result.summary = "焼け跡の油跡、前金の記録、先に日付だけ入った契約書、ダルクから得た証言をガロとトーマの前で照合した。村の収穫権を奪う契約と放火が同じ筋でつながっていることを、村内で再確認した。";
    return true;
  }
  if (selected.authoredT02VillageResolutionPhase === "record") {
    if (state.recordedAtMinute != null || state.resolvedAtMinute == null) return false;
    state.recordedAtMinute = minute;
    runtime.playerState.history ??= [];
    runtime.playerState.history.push({
      type: "T02_VILLAGE_RESOLUTION_PROTECTION_RECORDED",
      minute,
      missionId: MISSION_ID,
      troubleId: TROUBLE_ID,
      actionId: selected.id,
      facilityId: FACILITY_ID,
      protectedWitness: "ダルク",
      terms: ["身柄保護", "生活再建", "収穫権保全"],
    });
    runtime.playerState.worldFlags ??= {};
    runtime.playerState.worldFlags.t02DalkProtected = true;
    runtime.playerState.worldFlags.t02DalkLivelihoodRebuildRecorded = true;
    result.summary = "ダルクを単なる実行犯として切り捨てず、証言者としての身柄保護と生活再建の条件を村務記録へ残した。収穫権を村に残すこと、契約無効の証拠写しを交易都市側へ送ることも同じ記録へまとめた。";
    return true;
  }
  return false;
}

function correctedFactText(troubleStatus = "resolved") {
  return troubleStatus === "critical"
    ? "収穫権移転直前、田園の村で三証拠と契約書・証言を照合し、ダルクを保護した上で収穫権移転を差し止めた"
    : "田園の村で三証拠と契約書・証言を照合し、ダルクを保護した上で穀物商の収穫権契約を無効化する根拠を確定した";
}

function reconcileResolutionProvenance(runtime, result) {
  const state = ensureState(runtime);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  state.resolvedAtMinute ??= minute;
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "T02_VILLAGE_RESOLUTION_CANONICALIZED",
    minute,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    routeId: ROUTE_ID,
    facilityId: FACILITY_ID,
    reason: "live-canonical-day7-village-resolution",
  });

  const troubleStatus = result?.troubleStatusAtResolution ?? "resolved";
  const text = correctedFactText(troubleStatus);
  result.summary = "ガロとトーマの前で三証拠と契約書・証言を突き合わせ、ダルクを証言者として保護した。村の収穫権を奪う契約は無効とする根拠を確定し、証拠写しと無効通知を交易都市側へ送ることにした。";

  for (const fact of runtime?.narrativeMemory?.localFacts ?? []) {
    if (!FACT_IDS.has(fact?.factId)) continue;
    fact.locationId = LOCATION;
    fact.facilityId = FACILITY_ID;
    fact.summary = text;
  }

  const world = runtime?.livingWorld;
  if (!world) return true;
  for (const event of world.knowledgeEvents ?? []) {
    if (!FACT_IDS.has(event?.factId)) continue;
    event.location = { hubId: LOCATION, facilityId: FACILITY_ID };
    if (Array.isArray(event.path) && event.path[0]?.startsWith?.("facility:")) {
      event.path[0] = `facility:${FACILITY_ID}`;
    }
  }
  for (const npc of Object.values(world.npcStates ?? {})) {
    for (const [factId, belief] of Object.entries(npc?.beliefs ?? {})) {
      if (!FACT_IDS.has(factId)) continue;
      belief.text = text;
      if (Array.isArray(belief.path) && belief.path[0]?.startsWith?.("facility:")) {
        belief.path[0] = `facility:${FACILITY_ID}`;
      }
    }
  }

  world.facilityRumors ??= {};
  const old = world.facilityRumors.LOC_TRADE_GUILD;
  const target = world.facilityRumors[FACILITY_ID] ??= new Map();
  if (old instanceof Map) {
    for (const factId of FACT_IDS) {
      const entry = old.get(factId);
      if (!entry) continue;
      if (entry.belief) {
        entry.belief.text = text;
        entry.belief.path = [`facility:${FACILITY_ID}`];
      }
      target.set(factId, entry);
      old.delete(factId);
    }
  }
  return true;
}

export function applyAuthoredMissionFlowCatalogOverrides(catalog) {
  const updated = base.applyAuthoredMissionFlowCatalogOverrides(catalog);
  const mission = updated?.special?.find?.((entry) => entry?.id === MISSION_ID) ?? null;
  const step = mission?.steps?.find?.((entry) => entry?.id === "resolve") ?? null;
  if (step) Object.assign(step, {
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    label: "共同穀倉で、放火の責任、収穫権契約、ダルクの保護と生活再建をどう処理するか決める",
  });
  return updated;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  if (recordEligible(runtime)) return [recordAction()];
  if (reviewEligible(runtime)) return [reviewAction()];
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  if (recordEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "契約の処理だけで終わらせず、巻き込まれた人のその後まで記録に残す",
      title: "ダルクの保護と生活再建条件を記録する",
      detail: "収穫権を村へ残すことと、証言者を使い捨てにしないことを同じ解決条件として残す。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  if (reviewEligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "放火、前金、収穫権契約を村の記録上でも一本につなげる",
      title: "ガロとトーマの前で契約書と証言を突き合わせる",
      detail: "交易都市へ移動して出来事を起こすのではなく、田園の村で証拠と契約の関係を確定し、必要な通知だけを外へ送る。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  if (resolveStepActive(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "三つの証拠は揃った。最後に、村の畑と巻き込まれた人の暮らしをどう守るか決める",
      title: "共同穀倉でT02の解決方針を決める",
      detail: "ガロとトーマがいる村内で証拠を確定し、収穫権契約の無効通知とダルクの保護条件を外へ送る。プレイヤー自身が交易都市へ往復する必要はない。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, selected, result) {
  if (consumeOwn(runtime, selected, result)) return true;
  const changed = base.applyAuthoredMissionFlowAction(runtime, selected, result);
  if (result?.ok !== false && canonicalResolutionAction(selected)) {
    return reconcileResolutionProvenance(runtime, result) || changed;
  }
  return changed;
}

export const AUTHORED_T02_VILLAGE_RESOLUTION_INTERNALS = Object.freeze({
  MISSION_ID,
  TROUBLE_ID,
  LOCATION,
  FACILITY_ID,
  STATE_KEY,
  ROUTE_ID,
  ROUTE_ACTION_PREFIX,
  PREP_ACTION_ID,
  RECORD_ACTION_ID,
  PREP_MINUTES,
  RECORD_MINUTES,
  FACT_IDS,
  missionDefinition,
  missionRuntime,
  currentStep,
  atGranary,
  t02Open,
  resolveStepActive,
  readState,
  ensureState,
  reviewEligible,
  recordEligible,
  reviewAction,
  recordAction,
  canonicalResolutionAction,
  consumeOwn,
  reconcileResolutionProvenance,
});