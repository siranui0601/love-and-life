import * as base from "./canonical-material-economy.js";

export * from "./canonical-material-economy.js";

export const CANONICAL_SOCIAL_OBLIGATIONS_VERSION = "canonical-social-obligations-v1";

function playerState(runtime) {
  return runtime?.playerState ?? {};
}

function player(runtime) {
  return playerState(runtime).player ?? playerState(runtime);
}

function obligationState(runtime) {
  const state = playerState(runtime);
  state.canonicalSocialObligations ??= { debts: {}, paidTotalG: 0 };
  return state.canonicalSocialObligations;
}

function presentNpcIds(runtime) {
  const raw = playerState(runtime).authoritativePresentNpcIds;
  return raw instanceof Set ? raw : new Set(raw ?? []);
}

function creditorReachable(runtime, debt) {
  const npcId = String(debt?.creditorNpcId ?? "");
  if (!npcId) return false;
  if (presentNpcIds(runtime).has(npcId)) return true;
  const npc = runtime?.livingWorld?.npcStates?.[npcId];
  if (!npc || npc.travel || npc.localTravel) return false;
  if (["dead", "missing", "departed"].includes(String(npc.lifeStatus ?? "").toLowerCase())) return false;
  const npcLocation = npc.position?.hubId ?? npc.location ?? null;
  const npcFacility = npc.position?.facilityId ?? null;
  return npcLocation === player(runtime).location
    && (!npcFacility || npcFacility === player(runtime).facilityId);
}

function registerDebt(runtime, input = {}) {
  const id = String(input.id ?? "").trim();
  const amountG = Math.max(1, Math.floor(Number(input.amountG ?? 0)));
  const creditorNpcId = String(input.creditorNpcId ?? "").trim();
  if (!id || !creditorNpcId || !amountG) return null;
  const debts = obligationState(runtime).debts;
  if (debts[id]?.status === "paid") return debts[id];
  debts[id] = {
    id,
    creditorNpcId,
    creditorName: String(input.creditorName ?? creditorNpcId),
    reason: String(input.reason ?? "立替費用"),
    originalAmountG: Number(debts[id]?.originalAmountG ?? amountG),
    remainingG: Number(debts[id]?.remainingG ?? amountG),
    createdAtMinute: Number(debts[id]?.createdAtMinute ?? playerState(runtime).absoluteMinute ?? 0),
    sourceActionId: input.sourceActionId ?? debts[id]?.sourceActionId ?? null,
    status: "open",
  };
  playerState(runtime).history ??= [];
  if (!playerState(runtime).history.some((entry) => entry.type === "CANONICAL_SOCIAL_DEBT_OPENED" && entry.debtId === id)) {
    playerState(runtime).history.push({
      type: "CANONICAL_SOCIAL_DEBT_OPENED",
      minute: Number(playerState(runtime).absoluteMinute ?? 0),
      debtId: id,
      creditorNpcId,
      amountG,
      reason: debts[id].reason,
    });
  }
  return debts[id];
}

function debtAction(debt, amountG, mode) {
  const amount = Math.max(1, Math.floor(Number(amountG) || 1));
  const suffix = mode === "full" ? "FULL" : "Q1";
  return {
    id: `OBLIGATION:PAY:${debt.id}:${suffix}`,
    actionId: `OBLIGATION:PAY:${debt.id}:${suffix}`,
    family: "social_obligation",
    type: "plan",
    label: mode === "full"
      ? `${debt.creditorName}へ「${debt.reason}」${amount}Gを全額返す`
      : `${debt.creditorName}へ「${debt.reason}」を1G返す`,
    minutes: 10,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    canonicalSocialDebtChoice: true,
    canonicalDebtId: debt.id,
    canonicalDebtPaymentG: amount,
    creditorNpcId: debt.creditorNpcId,
  };
}

function ownActions(runtime) {
  const gold = Math.max(0, Math.floor(Number(player(runtime).gold ?? 0)));
  if (gold <= 0) return null;
  const actions = [];
  for (const debt of Object.values(obligationState(runtime).debts)) {
    const remaining = Math.max(0, Math.floor(Number(debt?.remainingG ?? 0)));
    if (debt?.status !== "open" || remaining <= 0 || !creditorReachable(runtime, debt)) continue;
    actions.push(debtAction(debt, 1, "one"));
    if (gold >= remaining) actions.push(debtAction(debt, remaining, "full"));
  }
  return actions.length ? actions : null;
}

function consumePayment(runtime, actionValue, result) {
  if (!actionValue?.canonicalSocialDebtChoice || result?.ok === false) return false;
  const debt = obligationState(runtime).debts[String(actionValue.canonicalDebtId ?? "")];
  if (!debt || debt.status !== "open") {
    result.ok = false;
    result.code = "social_debt_not_open";
    result.summary = "その返済義務は現在残っていない。";
    return true;
  }
  if (!creditorReachable(runtime, debt)) {
    result.ok = false;
    result.code = "social_debt_creditor_not_present";
    result.summary = "返済相手がここにいない。";
    return true;
  }
  const requested = Math.max(1, Math.floor(Number(actionValue.canonicalDebtPaymentG ?? 1)));
  const payment = Math.min(requested, Math.floor(Number(debt.remainingG ?? 0)));
  if (payment <= 0 || Number(player(runtime).gold ?? 0) < payment) {
    result.ok = false;
    result.code = "social_debt_payment_unavailable";
    result.summary = "返済できる所持金または残債がない。";
    return true;
  }
  player(runtime).gold = Number(player(runtime).gold ?? 0) - payment;
  debt.remainingG = Number(debt.remainingG ?? 0) - payment;
  debt.status = debt.remainingG <= 0 ? "paid" : "open";
  if (debt.status === "paid") debt.paidAtMinute = Number(playerState(runtime).absoluteMinute ?? 0);
  obligationState(runtime).paidTotalG += payment;
  playerState(runtime).history ??= [];
  playerState(runtime).history.push({
    type: "CANONICAL_SOCIAL_DEBT_PAYMENT",
    minute: Number(playerState(runtime).absoluteMinute ?? 0),
    actionId: actionValue.id,
    debtId: debt.id,
    creditorNpcId: debt.creditorNpcId,
    paymentG: payment,
    remainingG: Math.max(0, Number(debt.remainingG ?? 0)),
  });
  result.socialDebtPayment = {
    debtId: debt.id,
    creditorNpcId: debt.creditorNpcId,
    paymentG: payment,
    remainingG: Math.max(0, Number(debt.remainingG ?? 0)),
    status: debt.status,
  };
  result.summary = debt.status === "paid"
    ? `${debt.creditorName}へ${payment}Gを返し、「${debt.reason}」の借りを清算した。`
    : `${debt.creditorName}へ${payment}Gを返した。残り${debt.remainingG}G。`;
  return true;
}

function publicOnly(actions) {
  return Array.isArray(actions) && actions.length > 0
    && actions.every((entry) => entry?.canonicalWorldLifeChoice
      || entry?.canonicalRegionalLabourChoice
      || entry?.canonicalMaterialSaleChoice
      || entry?.canonicalSocialDebtChoice);
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const existing = base.authoredMissionFlowExclusiveActions(runtime, context);
  const debts = ownActions(runtime);
  if (!debts?.length) return existing;
  if (!existing?.length) return debts;
  if (!publicOnly(existing)) return existing;
  return [...existing, ...debts];
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  const existing = base.authoredMissionFlowGuidance(runtime, context);
  if (existing) return existing;
  const debts = ownActions(runtime);
  if (!debts?.length) return null;
  return {
    kicker: "受けた助けを、忘れず返すことも関係の一部だ",
    title: "残っている立替費用を返す",
    detail: "債権者NPCが実際に同じ場所へいる時だけ、通常公開UIから一部または全額を返済できる。",
    targetLocation: player(runtime).location ?? null,
    targetFacilityId: player(runtime).facilityId ?? null,
  };
}

export function applyAuthoredMissionFlowAction(runtime, actionValue, result) {
  if (consumePayment(runtime, actionValue, result)) return true;
  return base.applyAuthoredMissionFlowAction(runtime, actionValue, result);
}

export const CANONICAL_SOCIAL_OBLIGATIONS_INTERNALS = Object.freeze({
  obligationState,
  creditorReachable,
  registerDebt,
  ownActions,
  consumePayment,
  publicOnly,
});
