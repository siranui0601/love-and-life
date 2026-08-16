import * as base from "./authored-public-life-network.js";

export * from "./authored-public-life-network.js";

export const CANONICAL_REGIONAL_ACCESS_VERSION = "canonical-regional-access-v1";

// These are ordinary public procedures which write the same progress paths
// consumed by jobs, shops and lodging.  They are finite local permissions or
// knowledge records, never a route score and never a mission resolution.
const ACCESS = Object.freeze([
  Object.freeze({
    id: "REGIONAL_ACCESS:DWARF:copy_rescue_drawing",
    region: "ドワーフ洞窟",
    facilityId: "LOC_DWARF_ENGINEER",
    label: "ミーナの荷重計算を救助図面へ写す",
    progressKey: "technicalKnowledge",
    requiresEvidence: Object.freeze({
      flowId: "dwarf-mine-collapse",
      evidenceId: "T09-EVIDENCE-MINA-SUPPORT-STRESS-CALCULATION",
    }),
    summary: "ミーナの荷重計算を自分で再計算し、図面清書へ使える技術知識として記録した。",
  }),
  Object.freeze({
    id: "REGIONAL_ACCESS:FORT:register_supply_pass",
    region: "北陵要塞",
    facilityId: "LOC_FORT_GATE",
    label: "門衛へ滞在目的を申告し補給通行証を受け取る",
    progressKey: "fortEntryPermit",
    summary: "入城簿へ氏名、滞在先、補給作業の目的を記し、要塞内の通常施設で使う通行証を受け取った。",
  }),
  Object.freeze({
    id: "REGIONAL_ACCESS:FOREST:accept_hunter_rules",
    region: "森",
    facilityId: "LOC_FOREST_HUNTER_HUT",
    label: "猟師の目印と罠見回りの規則を確認する",
    progressKey: "hunterApproval",
    summary: "水場、罠札、退路の目印を猟師と照合し、小屋の仕事と買取を使える承認を得た。",
  }),
  Object.freeze({
    id: "REGIONAL_ACCESS:ELF:accept_guest_bough_invitation",
    region: "エルフの隠れ里",
    facilityId: "LOC_ELF_GUEST_BOUGH",
    label: "リュシアの説明を聞き客枝の決まりを受け入れる",
    worldFlagKey: "elfApproval",
    requiresResolution: Object.freeze({
      flowId: "runaway-elf-trafficking",
      routeId: "voluntary_return_with_youth_charter",
    }),
    summary: "リュシア本人の帰還説明を聞き、客枝、水場、立入禁止区画の決まりを受け入れた。",
  }),
  Object.freeze({
    id: "REGIONAL_ACCESS:BLACKRIDGE:register_waterway_stay",
    region: "黒嶺連合領",
    facilityId: "LOC_BLACKRIDGE_GATE",
    label: "門で滞在先と水路調査の目的を登録する",
    progressKey: "blackridgeEntryPermit",
    summary: "門の記録へ滞在先と水路調査の目的を記し、市場と水路施設の通常通行証を受け取った。",
  }),
]);

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function progress(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.progress ??= {};
  return runtime.playerState.progress;
}

function worldFlags(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.worldFlags ??= {};
  return runtime.playerState.worldFlags;
}

function evidenceMet(runtime, requirement) {
  if (!requirement) return true;
  return (runtime?.authoredMissionFlows?.[requirement.flowId]?.evidenceIds ?? [])
    .includes(requirement.evidenceId);
}

function resolutionMet(runtime, requirement) {
  if (!requirement) return true;
  return runtime?.authoredMissionFlows?.[requirement.flowId]?.selectedResolutionRouteId
    === requirement.routeId;
}

function alreadyGranted(runtime, spec) {
  if (spec.progressKey && Boolean(progress(runtime)[spec.progressKey])) return true;
  if (spec.worldFlagKey && Boolean(worldFlags(runtime)[spec.worldFlagKey])) return true;
  return false;
}

function eligible(runtime, spec) {
  const current = player(runtime);
  return current.location === spec.region
    && current.facilityId === spec.facilityId
    && !alreadyGranted(runtime, spec)
    && evidenceMet(runtime, spec.requiresEvidence)
    && resolutionMet(runtime, spec.requiresResolution);
}

function actionFor(spec) {
  return {
    id: spec.id,
    actionId: spec.id,
    choiceId: spec.id,
    type: "conversation",
    family: "regional-access",
    minutes: 20,
    label: spec.label,
    targetLocation: spec.region,
    targetFacilityId: spec.facilityId,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    canonicalRegionalAccessChoice: true,
    canonicalRegionalAccessId: spec.id,
  };
}

function ownActions(runtime) {
  const spec = ACCESS.find((entry) => eligible(runtime, entry));
  return spec ? [actionFor(spec)] : null;
}

function activeAuthoredScene(actions) {
  return Array.isArray(actions)
    && actions.some((entry) => entry?.authoredMissionFlowExclusiveChoice
      && !entry?.authoredPublicLifeNetworkChoice);
}

function consume(runtime, action, result) {
  if (result?.ok === false || !action?.canonicalRegionalAccessChoice) return false;
  const spec = ACCESS.find((entry) => entry.id === action.canonicalRegionalAccessId);
  if (!spec || action.id !== spec.id || !eligible(runtime, spec)) return false;
  if (spec.progressKey) progress(runtime)[spec.progressKey] = true;
  if (spec.worldFlagKey) worldFlags(runtime)[spec.worldFlagKey] = true;
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "CANONICAL_REGIONAL_ACCESS_GRANTED",
    minute: Number(runtime.playerState.absoluteMinute ?? 0),
    actionId: spec.id,
    location: spec.region,
    facilityId: spec.facilityId,
    progressKey: spec.progressKey ?? null,
    worldFlagKey: spec.worldFlagKey ?? null,
  });
  result.summary = spec.summary;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (activeAuthoredScene(authored)) return authored;
  return ownActions(runtime) ?? authored;
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (activeAuthoredScene(authored)) return base.authoredMissionFlowGuidance(runtime, context);
  const action = ownActions(runtime)?.[0];
  if (!action) return base.authoredMissionFlowGuidance(runtime, context);
  return {
    kicker: "土地の施設を使うための普通の手続きがある",
    title: action.label,
    detail: "通行、仕事、宿泊の条件は公開された同じ進行状態を参照する。",
    targetLocation: action.targetLocation,
    targetFacilityId: action.targetFacilityId,
  };
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  if (consume(runtime, action, result)) return true;
  return base.applyAuthoredMissionFlowAction(runtime, action, result);
}

export const CANONICAL_REGIONAL_ACCESS_INTERNALS = Object.freeze({
  ACCESS,
  progress,
  worldFlags,
  evidenceMet,
  resolutionMet,
  eligible,
  actionFor,
  ownActions,
  activeAuthoredScene,
  consume,
});
