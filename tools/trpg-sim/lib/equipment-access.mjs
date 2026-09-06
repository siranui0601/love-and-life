import { availableStockAt } from "./shop-runtime.mjs";

export const EQUIPMENT_ACCESS_VERSION = "equipment-access-v1";

const COMPARISON_STATS = Object.freeze([
  "physicalPower",
  "magicPower",
  "defense",
  "magicResistance",
  "agility",
  "luck",
  "accuracy",
  "evasion",
  "critical",
  "maxHp",
  "maxMp",
  "performanceIndex",
]);

function boundedInteger(value, minimum = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.round(number)) : minimum;
}

function stableHash(text) {
  let hash = 0x811c9dc5;
  for (const character of String(text ?? "")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function ownedCount(state, equipmentId) {
  return boundedInteger(state?.player?.inventory?.equipment?.[equipmentId]);
}

function equippedIds(state) {
  return new Set(Object.values(state?.player?.equipment ?? {}).filter(Boolean));
}

function currentMissionStep(state, definition, runtime) {
  return definition?.steps?.find((step) => Number(runtime?.progress?.[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function activeBattleMission(state) {
  const definitions = state?.catalog?.byId instanceof Map
    ? [...state.catalog.byId.values()]
    : [...(state?.catalog?.special ?? []), ...(state?.catalog?.permanent ?? [])];
  return definitions
    .flatMap((definition) => {
      const runtime = state?.missions?.[definition.id];
      if (!runtime || !["active", "available", "in_progress"].includes(runtime.status)) return [];
      const step = currentMissionStep(state, definition, runtime);
      if (!step || (step.type !== "battle" && !step.encounterId)) return [];
      const targetLocation = step.targetLocation ?? definition.targetLocations?.[0] ?? null;
      if (targetLocation && targetLocation !== state.player.location) return [];
      return [{ definition, runtime, step }];
    })
    .sort((left, right) => Number(left.definition.finalDay ?? 999) - Number(right.definition.finalDay ?? 999)
      || left.definition.id.localeCompare(right.definition.id))[0] ?? null;
}

export function ensureEquipmentAccessState(state) {
  const current = state.player.equipmentAccess && typeof state.player.equipmentAccess === "object"
    ? state.player.equipmentAccess
    : {};
  state.player.equipmentAccess = {
    version: EQUIPMENT_ACCESS_VERSION,
    usedClaims: current.usedClaims && typeof current.usedClaims === "object" ? current.usedClaims : {},
    loans: current.loans && typeof current.loans === "object" ? current.loans : {},
    pendingRewards: Array.isArray(current.pendingRewards) ? current.pendingRewards : [],
    claimedRewardIds: current.claimedRewardIds instanceof Set
      ? current.claimedRewardIds
      : new Set(current.claimedRewardIds ?? []),
  };
  return state.player.equipmentAccess;
}

export function activeEquipmentLoans(state) {
  const access = ensureEquipmentAccessState(state);
  return Object.values(access.loans).filter((loan) => loan?.status === "active");
}

export function equipmentAvailableToPlayer(state, equipmentId) {
  if (ownedCount(state, equipmentId) > 0) return true;
  return activeEquipmentLoans(state).some((loan) => loan.equipmentId === equipmentId);
}

function comparisonFor(state, battleData, equipment) {
  const currentId = state.player.equipment?.[equipment.slot] ?? null;
  const current = currentId ? battleData.equipmentById.get(currentId) : null;
  const delta = Object.fromEntries(COMPARISON_STATS.map((stat) => [
    stat,
    Number(equipment?.[stat] ?? 0) - Number(current?.[stat] ?? 0),
  ]));
  return {
    slot: equipment.slot,
    currentEquipmentId: current?.id ?? null,
    currentEquipmentName: current?.name ?? "装備なし",
    candidateEquipmentId: equipment.id,
    candidateEquipmentName: equipment.name,
    delta,
  };
}

function usedOfferFor(state, stock, equipment, access) {
  const day = boundedInteger(state.day, 1);
  const offerId = `USED:${stock.id}:D${day}`;
  if (access.usedClaims[offerId]) return null;
  const roll = stableHash(`${state.seed}:${offerId}:${stock.sellerId}`) % 18;
  const discountPct = 25 + roll;
  const price = Math.max(1, Math.floor(Number(stock.price ?? stock.basePrice ?? 0) * (100 - discountPct) / 100));
  return {
    offerId,
    stockId: stock.id,
    equipmentId: equipment.id,
    price,
    originalPrice: Number(stock.price ?? stock.basePrice ?? 0),
    discountPct,
    condition: discountPct >= 36 ? "worn" : "good",
    conditionLabel: discountPct >= 36 ? "使い込まれている" : "手入れ済み",
  };
}

function loanOfferFor(state, stock, equipment, access) {
  if (activeEquipmentLoans(state).length) return null;
  const mission = activeBattleMission(state);
  if (!mission) return null;
  const price = Number(stock.price ?? stock.basePrice ?? 0);
  const normalDeposit = Math.max(0, Math.ceil(price * 0.15));
  const deposit = Math.min(boundedInteger(state.player.gold), normalDeposit);
  return {
    loanId: `LOAN:${mission.definition.id}:${stock.id}`,
    missionId: mission.definition.id,
    missionTitle: mission.definition.title,
    stockId: stock.id,
    equipmentId: equipment.id,
    deposit,
    sellerFacilityId: stock.sellerId,
    reason: `「${mission.definition.title}」の間だけ借りられる`,
  };
}

export function listEquipmentAccessOffers(state, battleData, shopRuntime, scope = {}) {
  const access = ensureEquipmentAccessState(state);
  return availableStockAt(state, battleData, shopRuntime, scope).flatMap((stock) => {
    const equipment = battleData.equipmentById.get(stock.equipmentId);
    if (!equipment) return [];
    return [{
      stockId: stock.id,
      equipmentId: equipment.id,
      trial: {
        available: true,
        comparison: comparisonFor(state, battleData, equipment),
      },
      used: usedOfferFor(state, stock, equipment, access),
      loan: loanOfferFor(state, stock, equipment, access),
    }];
  });
}

function stockAndEquipment(state, battleData, shopRuntime, stockId, scope = {}) {
  const stock = availableStockAt(state, battleData, shopRuntime, scope).find((entry) => entry.id === stockId);
  if (!stock) return { error: { ok: false, reason: "not_available" } };
  const equipment = battleData.equipmentById.get(stock.equipmentId);
  if (!equipment) return { error: { ok: false, reason: "unknown_equipment" } };
  return { stock, equipment };
}

export function previewEquipmentTrial(state, battleData, shopRuntime, stockId, scope = {}) {
  const resolved = stockAndEquipment(state, battleData, shopRuntime, stockId, scope);
  if (resolved.error) return resolved.error;
  const comparison = comparisonFor(state, battleData, resolved.equipment);
  state.history.push({
    type: "SHOP_TRIAL",
    minute: state.absoluteMinute,
    stockId,
    equipmentId: resolved.equipment.id,
    sellerFacilityId: resolved.stock.sellerId,
  });
  return {
    ok: true,
    type: "shop_trial",
    stockId,
    equipment: resolved.equipment,
    comparison,
  };
}

export function buyUsedEquipment(state, battleData, shopRuntime, offerId, scope = {}) {
  const offers = listEquipmentAccessOffers(state, battleData, shopRuntime, scope)
    .map((entry) => entry.used)
    .filter(Boolean);
  const offer = offers.find((entry) => entry.offerId === offerId);
  if (!offer) return { ok: false, reason: "used_offer_unavailable" };
  if (state.player.gold < offer.price) return { ok: false, reason: "insufficient_gold", price: offer.price };
  const access = ensureEquipmentAccessState(state);
  if (access.usedClaims[offer.offerId]) return { ok: false, reason: "used_offer_claimed" };
  state.player.gold -= offer.price;
  state.player.inventory.equipment[offer.equipmentId] = ownedCount(state, offer.equipmentId) + 1;
  access.usedClaims[offer.offerId] = {
    claimedAtMinute: state.absoluteMinute,
    price: offer.price,
    equipmentId: offer.equipmentId,
  };
  state.progress.economy.goldSpent += offer.price;
  state.history.push({
    type: "SHOP_BUY_USED",
    minute: state.absoluteMinute,
    offerId: offer.offerId,
    equipmentId: offer.equipmentId,
    price: offer.price,
    condition: offer.condition,
  });
  return { ok: true, type: "shop_buy_used", ...offer, remainingGold: state.player.gold };
}

export function borrowMissionEquipment(state, battleData, shopRuntime, loanId, scope = {}) {
  const offer = listEquipmentAccessOffers(state, battleData, shopRuntime, scope)
    .map((entry) => entry.loan)
    .filter(Boolean)
    .find((entry) => entry.loanId === loanId);
  if (!offer) return { ok: false, reason: "loan_unavailable" };
  if (state.player.gold < offer.deposit) return { ok: false, reason: "insufficient_gold", price: offer.deposit };
  const access = ensureEquipmentAccessState(state);
  if (activeEquipmentLoans(state).length) return { ok: false, reason: "loan_already_active" };
  state.player.gold -= offer.deposit;
  access.loans[offer.loanId] = {
    ...offer,
    status: "active",
    borrowedAtMinute: state.absoluteMinute,
  };
  state.history.push({
    type: "EQUIPMENT_LOAN_BORROWED",
    minute: state.absoluteMinute,
    ...offer,
  });
  return { ok: true, type: "equipment_loan_borrowed", ...offer, remainingGold: state.player.gold };
}

function unequipIfLoaned(state, equipmentId) {
  for (const [slot, currentId] of Object.entries(state.player.equipment ?? {})) {
    if (currentId === equipmentId) state.player.equipment[slot] = null;
  }
}

export function returnEquipmentLoan(state, loanId, { facilityId = null, automatic = false, reason = "returned" } = {}) {
  const access = ensureEquipmentAccessState(state);
  const loan = access.loans[loanId];
  if (!loan || loan.status !== "active") return { ok: false, reason: "loan_not_active" };
  if (!automatic && facilityId !== loan.sellerFacilityId) {
    return { ok: false, reason: "loan_return_wrong_facility", sellerFacilityId: loan.sellerFacilityId };
  }
  unequipIfLoaned(state, loan.equipmentId);
  state.player.gold += boundedInteger(loan.deposit);
  loan.status = "returned";
  loan.returnedAtMinute = state.absoluteMinute;
  loan.returnReason = reason;
  state.history.push({
    type: "EQUIPMENT_LOAN_RETURNED",
    minute: state.absoluteMinute,
    loanId,
    equipmentId: loan.equipmentId,
    missionId: loan.missionId,
    depositRefunded: boundedInteger(loan.deposit),
    automatic,
    reason,
  });
  return {
    ok: true,
    type: "equipment_loan_returned",
    loanId,
    equipmentId: loan.equipmentId,
    depositRefunded: boundedInteger(loan.deposit),
    remainingGold: state.player.gold,
  };
}

export function reconcileEquipmentLoans(state) {
  const returned = [];
  for (const loan of activeEquipmentLoans(state)) {
    // Mission reconciliation owns only mission-scoped loans. Tutorial/player-choice
    // loans deliberately remain active until the player uses their explicit return
    // path; treating missionId=null as "mission closed" would silently confiscate
    // them on the next ordinary production command.
    if (loan?.returnPolicy === "player_choice" || !loan?.missionId) continue;
    const missionStatus = state.missions?.[loan.missionId]?.status;
    if (["active", "available", "in_progress"].includes(missionStatus)) continue;
    const result = returnEquipmentLoan(state, loan.loanId, {
      automatic: true,
      reason: missionStatus === "completed" ? "mission_completed" : "mission_closed",
    });
    if (result.ok) returned.push(result);
  }
  return returned;
}

function rewardCandidates(state, battleData, missionDefinition) {
  const owned = new Set(Object.keys(state.player.inventory.equipment ?? {}).filter((id) => ownedCount(state, id) > 0));
  const equipped = equippedIds(state);
  const loaned = new Set(activeEquipmentLoans(state).map((loan) => loan.equipmentId));
  const level = boundedInteger(state.player.level, 1);
  const difficulty = boundedInteger(missionDefinition?.difficulty, 1);
  return battleData.equipment
    .filter((equipment) => equipment?.id && equipment.status !== "disabled")
    .filter((equipment) => ["mainHand", "offHand", "body", "accessory"].includes(equipment.slot))
    .filter((equipment) => !owned.has(equipment.id) && !equipped.has(equipment.id) && !loaned.has(equipment.id))
    .filter((equipment) => Number(equipment.recommendedLevelMin ?? 1) <= level + Math.max(1, difficulty))
    .sort((left, right) => {
      const leftLevelDistance = Math.abs(Number(left.recommendedLevelMin ?? 1) - level);
      const rightLevelDistance = Math.abs(Number(right.recommendedLevelMin ?? 1) - level);
      return leftLevelDistance - rightLevelDistance
        || Number(left.tier ?? 1) - Number(right.tier ?? 1)
        || Number(right.performanceIndex ?? 0) - Number(left.performanceIndex ?? 0)
        || left.id.localeCompare(right.id);
    });
}

export function createMissionEquipmentRewardOffer(state, battleData, missionDefinition, { facilityId = null } = {}) {
  const access = ensureEquipmentAccessState(state);
  const rewardId = `REWARD:${missionDefinition.id}:EQUIPMENT`;
  if (access.claimedRewardIds.has(rewardId)) return null;
  const existing = access.pendingRewards.find((reward) => reward.rewardId === rewardId);
  if (existing) return existing;
  const candidates = rewardCandidates(state, battleData, missionDefinition).slice(0, 8);
  if (!candidates.length) return null;
  const selected = candidates[stableHash(`${state.seed}:${missionDefinition.id}:${state.day}`) % candidates.length];
  const reward = {
    rewardId,
    missionId: missionDefinition.id,
    missionTitle: missionDefinition.title,
    equipmentId: selected.id,
    equipmentName: selected.name,
    sourceFacilityId: facilityId,
    createdAtMinute: state.absoluteMinute,
  };
  access.pendingRewards.push(reward);
  state.history.push({ type: "EQUIPMENT_REWARD_OFFERED", minute: state.absoluteMinute, ...reward });
  return reward;
}

export function pendingEquipmentRewards(state) {
  const access = ensureEquipmentAccessState(state);
  return access.pendingRewards.filter((reward) => !access.claimedRewardIds.has(reward.rewardId));
}

export function claimEquipmentReward(state, battleData, rewardId) {
  const access = ensureEquipmentAccessState(state);
  const reward = access.pendingRewards.find((entry) => entry.rewardId === rewardId);
  if (!reward || access.claimedRewardIds.has(rewardId)) return { ok: false, reason: "reward_unavailable" };
  const equipment = battleData.equipmentById.get(reward.equipmentId);
  if (!equipment) return { ok: false, reason: "unknown_equipment" };
  state.player.inventory.equipment[equipment.id] = ownedCount(state, equipment.id) + 1;
  access.claimedRewardIds.add(rewardId);
  access.pendingRewards = access.pendingRewards.filter((entry) => entry.rewardId !== rewardId);
  state.history.push({
    type: "EQUIPMENT_REWARD_CLAIMED",
    minute: state.absoluteMinute,
    rewardId,
    missionId: reward.missionId,
    equipmentId: equipment.id,
  });
  return {
    ok: true,
    type: "equipment_reward_claimed",
    rewardId,
    missionId: reward.missionId,
    equipment,
  };
}
