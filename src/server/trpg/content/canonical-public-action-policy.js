import * as base from "./canonical-world-life-actions.js";

export * from "./canonical-world-life-actions.js";

export const CANONICAL_PUBLIC_ACTION_POLICY_VERSION = "canonical-public-action-policy-v4";

const PROVISION_PORTIONS = Object.freeze({
  ITM008: 1,
  ITM010: 9,
  ITM023: 3,
  ITM036: 1,
  ITM038: 1,
  ITM072: 3,
  ITM082: 3,
  ITM163: 3,
  ITM179: 1,
  ITM192: 1,
  ITM205: 3,
});

function playerState(runtime) {
  return runtime?.playerState ?? {};
}

function player(runtime) {
  return playerState(runtime).player ?? playerState(runtime);
}

function progress(runtime) {
  return playerState(runtime).progress ?? player(runtime)?.progress ?? {};
}

function currentDay(runtime) {
  return Number(playerState(runtime).day ?? 1);
}

function truthyProgress(runtime, ...keys) {
  const p = progress(runtime);
  return keys.some((key) => Boolean(p?.[key]));
}

function lifeState(runtime) {
  const state = playerState(runtime);
  state.canonicalWorldLife ??= {
    provisions: {},
    purchases: {},
    meals: {},
    sleeps: {},
    services: {},
    lastPortWorkDay: 0,
  };
  return state.canonicalWorldLife;
}

function permittedRegionalJob(runtime, action) {
  const jobId = String(action?.canonicalRegionalJobId ?? "");
  if (!jobId) return true;

  if (jobId.startsWith("JOB-FORT-")) {
    return truthyProgress(runtime, "fortEntryPermit", "fort_entry_permit");
  }
  if (jobId === "JOB-BLACK-01" || jobId === "JOB-BLACK-03") {
    return truthyProgress(runtime, "blackridgeEntryPermit", "blackridge_entry_permit");
  }
  if (jobId === "JOB-FOREST-01") {
    return truthyProgress(runtime, "hunterApproval", "hunter_approval");
  }
  return true;
}

function sameDayPortWork(runtime) {
  const day = currentDay(runtime);
  const lifeDay = Number(playerState(runtime).canonicalWorldLife?.lastPortWorkDay ?? 0);
  const labourDay = Number(playerState(runtime).canonicalRegionalLabour?.lastDayByFacility?.LOC_TRADE_PORT ?? 0);
  return lifeDay === day || labourDay === day;
}

function actionRootId(action) {
  return String(action?.id ?? action?.actionId ?? "").replace(/:Q[23]$/u, "");
}

function permittedLifeAction(runtime, action) {
  const id = actionRootId(action);
  if (id === "LIFE:SLEEP:ITM222") return sameDayPortWork(runtime);
  if (["LIFE:SLEEP:ITM159", "LIFE:EAT:ITM160", "LIFE:EAT:ITM161", "LIFE:BUY:ITM163", "SERVICE_BUY:ITM175"].includes(id)) {
    return truthyProgress(runtime, "fortEntryPermit", "fort_entry_permit");
  }
  return true;
}

function affordableLifeAction(runtime, action) {
  if (!action?.canonicalWorldLifeChoice) return true;
  if (action.canonicalWorldLifeKind !== "buy_provision") return true;
  return Number(player(runtime)?.gold ?? 0) >= Math.max(0, Number(action.price ?? 0));
}

function canonicalAllowed(runtime, action) {
  return permittedRegionalJob(runtime, action)
    && permittedLifeAction(runtime, action)
    && affordableLifeAction(runtime, action);
}

function normalizeProvisionAction(action) {
  if (!action?.canonicalWorldLifeChoice || action?.canonicalWorldLifeKind !== "buy_provision") return action;
  const portions = Number(PROVISION_PORTIONS[action.productId] ?? action.portions ?? 1);
  return { ...action, portions };
}

function nativeLifeAction(action) {
  if (!action?.canonicalWorldLifeChoice) return action;
  const kind = action.canonicalWorldLifeKind;
  if (kind === "eat_meal") {
    const hearty = Number(action.price ?? 0) >= 5;
    return {
      ...action,
      type: "eat",
      nutrition: hearty ? 66 : 58,
      mealQuality: hearty ? "hearty" : "standard",
      canonicalWorldLifeNativeHandled: true,
    };
  }
  if (kind === "eat_provision") {
    return {
      ...action,
      type: "eat",
      price: 0,
      nutrition: 58,
      mealQuality: "standard",
      canonicalWorldLifeNativeHandled: true,
    };
  }
  if (kind === "sleep" && action.lodging === true) {
    return {
      ...action,
      type: "rest",
      lodging: true,
      safety: "normal",
      canonicalWorldLifeNativeHandled: true,
    };
  }
  return action;
}

function bulkProvisionActions(action) {
  const normalized = nativeLifeAction(normalizeProvisionAction(action));
  if (!normalized?.canonicalWorldLifeChoice || normalized?.canonicalWorldLifeKind !== "buy_provision") return [normalized];
  const baseId = String(normalized.id ?? normalized.actionId ?? "");
  const price = Number(normalized.price ?? 0);
  const portions = Number(normalized.portions ?? 1);
  return [
    normalized,
    {
      ...normalized,
      id: `${baseId}:Q2`,
      actionId: `${baseId}:Q2`,
      label: `${normalized.label} ×2`,
      price: price * 2,
      portions: portions * 2,
      canonicalWorldLifeBulkQuantity: 2,
    },
    {
      ...normalized,
      id: `${baseId}:Q3`,
      actionId: `${baseId}:Q3`,
      label: `${normalized.label} ×3`,
      price: price * 3,
      portions: portions * 3,
      canonicalWorldLifeBulkQuantity: 3,
    },
  ];
}

function filtered(actions, runtime) {
  if (!Array.isArray(actions)) return actions;
  const expanded = actions.flatMap((action) => bulkProvisionActions(action));
  const kept = expanded.filter((action) => canonicalAllowed(runtime, action));
  return kept.length ? kept : null;
}

function recordNativeLifeOutcome(runtime, actionValue) {
  if (!actionValue?.canonicalWorldLifeNativeHandled) return false;
  const state = lifeState(runtime);
  const kind = actionValue.canonicalWorldLifeKind;
  const productId = String(actionValue.productId ?? "");
  if (kind === "eat_provision") {
    if (Number(state.provisions[productId] ?? 0) <= 0) return true;
    state.provisions[productId] = Number(state.provisions[productId] ?? 0) - 1;
    state.meals[productId] = Number(state.meals[productId] ?? 0) + 1;
  } else if (kind === "eat_meal") {
    state.meals[productId] = Number(state.meals[productId] ?? 0) + 1;
  } else if (kind === "sleep") {
    state.sleeps[productId] = Number(state.sleeps[productId] ?? 0) + 1;
  }
  playerState(runtime).history ??= [];
  playerState(runtime).history.push({
    type: "CANONICAL_WORLD_LIFE_NATIVE",
    minute: Number(playerState(runtime).absoluteMinute ?? 0),
    actionId: actionValue.id,
    kind,
    productId,
  });
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return filtered(base.authoredMissionFlowExclusiveActions(runtime, context), runtime);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  const actions = authoredMissionFlowExclusiveActions(runtime, context);
  if (!actions?.length) return null;
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, actionValue, result) {
  if (!canonicalAllowed(runtime, actionValue)) {
    result.ok = false;
    result.code = "canonical_prerequisite_not_met";
    result.summary = "この行動に必要な許可・当日勤務・所持金条件を満たしていない。";
    return true;
  }
  if (recordNativeLifeOutcome(runtime, actionValue)) return true;
  return base.applyAuthoredMissionFlowAction(runtime, normalizeProvisionAction(actionValue), result);
}

export const CANONICAL_PUBLIC_ACTION_POLICY_INTERNALS = Object.freeze({
  PROVISION_PORTIONS,
  permittedRegionalJob,
  sameDayPortWork,
  permittedLifeAction,
  affordableLifeAction,
  canonicalAllowed,
  normalizeProvisionAction,
  nativeLifeAction,
  bulkProvisionActions,
  filtered,
  recordNativeLifeOutcome,
});
