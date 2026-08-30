const STOCK_QUANTITY = Object.freeze({
  "多": 8,
  "普通": 5,
  "少": 2,
  "希少": 1,
  "条件付": 1,
  "イベント": 1,
  "無限": Infinity,
});

function troubleStatus(state, id) {
  return state.troubles?.[id]?.status ?? "scheduled";
}

function splitLogical(text, token) {
  return String(text).split(new RegExp(`\\s+${token}\\s+`, "iu")).map((value) => value.trim()).filter(Boolean);
}

function compareNumber(actual, operator, expected) {
  if (operator === ">=") return actual >= expected;
  if (operator === "<=") return actual <= expected;
  if (operator === ">") return actual > expected;
  if (operator === "<") return actual < expected;
  return actual === expected;
}

export function evaluateJapaneseRule(text, state, diagnostics = null) {
  if (text === null || text === undefined || String(text).trim() === "") return true;
  const normalized = String(text).trim()
    .replaceAll("かつ", " AND ")
    .replaceAll("または", " OR ")
    .replaceAll("又は", " OR ");
  const orParts = splitLogical(normalized, "OR");
  if (orParts.length > 1) return orParts.some((part) => evaluateJapaneseRule(part, state, diagnostics));
  const andParts = splitLogical(normalized, "AND");
  if (andParts.length > 1) return andParts.every((part) => evaluateJapaneseRule(part, state, diagnostics));

  let match = normalized.match(/Day\s*(>=|<=|>|<|=)?\s*(\d+)/iu);
  if (match) return compareNumber(state.day, match[1] || "=", Number(match[2]));

  match = normalized.match(/(T\d{2})\.(?:status)?\s*(!=|=)\s*(resolved|failed|active|critical|suppressed|scheduled)/iu);
  if (match) return match[2] === "!=" ? troubleStatus(state, match[1]) !== match[3] : troubleStatus(state, match[1]) === match[3];

  match = normalized.match(/(T\d{2})(?:が)?(成功|失敗|進行中|発生中|解決)/u);
  if (match) {
    const status = troubleStatus(state, match[1]);
    if (match[2] === "成功" || match[2] === "解決") return status === "resolved";
    if (match[2] === "失敗") return status === "failed" || status === "critical";
    return status === "active" || status === "critical";
  }

  match = normalized.match(/(T\d{2})関連証拠/u);
  if (match) return Number(state.player.evidenceByTrouble?.[match[1]] ?? 0) > 0;

  match = normalized.match(/(.+?)(?:信頼|評判|信用)\s*(?:>=|≧)?\s*(\d+)(?:以上)?/u);
  if (match) return Number(state.player.reputation?.[match[1]] ?? 0) >= Number(match[2]);

  match = normalized.match(/(.+?)を(\d+)体以上撃破/u);
  if (match) return Number(state.progress.combat.killsByName?.[match[1]] ?? 0) >= Number(match[2]);

  match = normalized.match(/魔法スキルを(\d+)種以上取得/u);
  if (match) return Number(state.player.magicSkillCount ?? 0) >= Number(match[1]);

  match = normalized.match(/鑑定対象を(\d+)回調査/u);
  if (match) return Number(state.progress.investigation.appraisals ?? 0) >= Number(match[1]);

  match = normalized.match(/一度に(\d+)G以上消費/u);
  if (match) return Number(state.progress.economy.maxSinglePurchase ?? 0) >= Number(match[1]);

  match = normalized.match(/孤児院寄付累計(\d+)G/u);
  if (match) return Number(state.progress.economy.orphanageDonations ?? 0) >= Number(match[1]);

  if (/騎士団協力/u.test(normalized)) return Boolean(state.worldFlags.knightOrderCooperation);
  if (/宮廷魔術塔入場許可/u.test(normalized)) return Boolean(state.worldFlags.mageTowerPermit);
  if (/村祭り開催/u.test(normalized)) return Boolean(state.worldFlags.farmFestivalHeld);
  if (/処刑場の裏取引/u.test(normalized)) return Boolean(state.worldFlags.executionGroundDeal);
  if (/王権の証/u.test(normalized)) return Boolean(state.worldFlags.royalProof);

  diagnostics?.push({ code: "unparsedShopRule", text: normalized });
  return false;
}

function priceForStock(stock, state, diagnostics) {
  let price = Number(stock.basePrice || 0) * Number(stock.regionCoefficient || 1);
  const text = String(stock.priceCondition ?? "").trim();
  let available = true;
  let quantityMultiplier = 1;
  if (text) {
    const clauses = text.split(/[、。;]/u).map((value) => value.trim()).filter(Boolean);
    for (const clause of clauses) {
      const statusMatch = clause.match(/(T\d{2})(失敗|成功|発生中|暴動時|で)(?:は)?(?:.*?)(\d+)G/u);
      if (statusMatch) {
        const condition = statusMatch[2] === "失敗"
          ? ["failed", "critical"].includes(troubleStatus(state, statusMatch[1]))
          : statusMatch[2] === "成功"
            ? troubleStatus(state, statusMatch[1]) === "resolved"
            : ["active", "critical", "failed"].includes(troubleStatus(state, statusMatch[1]));
        if (condition) price = Number(statusMatch[3]);
        continue;
      }
      const direct = clause.match(/(T\d{2}).*?(\d+)G/u);
      if (direct && ["active", "critical", "failed"].includes(troubleStatus(state, direct[1]))) {
        price = Number(direct[2]);
        continue;
      }
      const stop = clause.match(/(T\d{2}).*(販売停止|在庫なし)/u);
      if (stop && ["active", "critical", "failed"].includes(troubleStatus(state, stop[1]))) {
        available = false;
        continue;
      }
      const scarce = clause.match(/(T\d{2}).*(品薄|在庫なしになりやすい)/u);
      if (scarce && ["active", "critical", "failed"].includes(troubleStatus(state, scarce[1]))) {
        quantityMultiplier *= 0.35;
        continue;
      }
      if (/非売品/u.test(clause)) continue;
      diagnostics.push({ code: "unparsedPriceRule", stockId: stock.id, text: clause });
    }
  }
  return { price: Math.max(0, Math.round(price)), available, quantityMultiplier };
}

export function createShopRuntime(battleData) {
  const quantities = {};
  for (const stock of battleData.inventory) {
    quantities[stock.id] = STOCK_QUANTITY[stock.stock] ?? 1;
  }
  return { quantities, purchaseCounts: {}, salesCounts: {}, diagnostics: [] };
}

function shopScope(state, scope = {}) {
  if (typeof scope === "string") {
    return { location: scope, facilityId: null, allFacilities: true };
  }
  return {
    location: scope.location ?? state.player.location,
    facilityId: scope.facilityId ?? state.player.facilityId ?? null,
    allFacilities: scope.allFacilities === true,
  };
}

function stockMatchesScope(stock, scope) {
  return stock.location === scope.location
    && (scope.allFacilities || (scope.facilityId !== null && stock.sellerId === scope.facilityId));
}

function sameEquipmentKind(left, right) {
  if (!left || !right || left.slot !== right.slot) return false;
  if (left.slot === "mainHand") return left.weaponType === right.weaponType;
  if (left.slot === "body") return left.armorClass === right.armorClass;
  return true;
}

export function availableStockAt(state, battleData, shopRuntime, locationOptions = {}) {
  const resolvedScope = shopScope(state, locationOptions);
  return battleData.inventory
    .filter((stock) => stockMatchesScope(stock, resolvedScope))
    .flatMap((stock) => {
      const unlocked = stock.unlockCondition
        ? evaluateJapaneseRule(stock.unlockCondition, state, shopRuntime.diagnostics)
        : stock.initiallySold;
      if (!unlocked) return [];
      const priceState = priceForStock(stock, state, shopRuntime.diagnostics);
      const baseQuantity = shopRuntime.quantities[stock.id];
      const effectiveQuantity = baseQuantity === Infinity ? Infinity : Math.floor(baseQuantity * priceState.quantityMultiplier);
      if (!priceState.available || effectiveQuantity <= 0) return [];
      return [{ ...stock, price: priceState.price, quantity: effectiveQuantity }];
    })
    .sort((left, right) => left.price - right.price || left.id.localeCompare(right.id));
}

export function buyEquipment(state, battleData, shopRuntime, stockId, locationOptions = {}) {
  const stock = availableStockAt(state, battleData, shopRuntime, locationOptions).find((entry) => entry.id === stockId);
  if (!stock) return { ok: false, reason: "not_available" };
  if (state.player.gold < stock.price) return { ok: false, reason: "insufficient_gold", price: stock.price };
  const equipment = battleData.equipmentById.get(stock.equipmentId);
  if (!equipment) return { ok: false, reason: "missing_equipment" };
  state.player.gold -= stock.price;
  state.player.inventory.equipment[stock.equipmentId] = (state.player.inventory.equipment[stock.equipmentId] ?? 0) + 1;
  if (shopRuntime.quantities[stock.id] !== Infinity) shopRuntime.quantities[stock.id] -= 1;
  shopRuntime.purchaseCounts[stock.id] = (shopRuntime.purchaseCounts[stock.id] ?? 0) + 1;
  state.progress.economy.goldSpent += stock.price;
  state.progress.economy.maxSinglePurchase = Math.max(state.progress.economy.maxSinglePurchase, stock.price);
  state.history.push({ type: "SHOP_BUY", minute: state.absoluteMinute, stockId, equipmentId: equipment.id, price: stock.price });
  return { ok: true, equipment, price: stock.price };
}

export function quoteEquipmentSale(state, battleData, equipmentId, locationOptions = {}) {
  const owned = Number(state.player.inventory.equipment[equipmentId] ?? 0);
  if (owned <= 0) return { ok: false, reason: "not_owned" };
  const equipped = Object.values(state.player.equipment).includes(equipmentId);
  const equipment = battleData.equipmentById.get(equipmentId);
  if (!equipment) return { ok: false, reason: "missing_equipment" };
  const resolvedScope = shopScope(state, locationOptions);
  const compatibleSeller = battleData.inventory.some((stock) => {
    if (!stockMatchesScope(stock, resolvedScope)) return false;
    return sameEquipmentKind(equipment, battleData.equipmentById.get(stock.equipmentId));
  });
  if (!compatibleSeller) return { ok: false, reason: "no_compatible_seller" };
  const sourcePrices = battleData.inventory.filter((stock) => stock.equipmentId === equipmentId && stock.basePrice > 0).map((stock) => stock.basePrice);
  const referencePrice = sourcePrices.length ? Math.min(...sourcePrices) : Math.max(1, equipment.performanceIndex * 5);
  const price = Math.max(1, Math.floor(referencePrice * Number(equipment.sellRatio || 0.4)));
  return equipped
    ? { ok: false, reason: "equipped", equipment, price }
    : { ok: true, equipment, price };
}

export function sellEquipment(state, battleData, shopRuntime, equipmentId, locationOptions = {}) {
  const quote = quoteEquipmentSale(state, battleData, equipmentId, locationOptions);
  if (!quote.ok) return quote;
  const { equipment, price } = quote;
  state.player.inventory.equipment[equipmentId] -= 1;
  state.player.gold += price;
  shopRuntime.salesCounts[equipmentId] = (shopRuntime.salesCounts[equipmentId] ?? 0) + 1;
  state.progress.economy.goldEarnedFromSales += price;
  state.history.push({ type: "SHOP_SELL", minute: state.absoluteMinute, equipmentId, price });
  return { ok: true, equipment, price };
}

function profileAccepts(profile, equipment) {
  if (equipment.slot !== "mainHand") return true;
  if (!profile.weaponTypes?.length) return true;
  return profile.weaponTypes.includes(equipment.weaponType);
}

function handLoadoutForCandidate(state, battleData, candidate) {
  let mainHandId = state.player.equipment?.mainHand ?? null;
  let offHandId = state.player.equipment?.offHand ?? null;

  if (candidate.slot === "mainHand") {
    mainHandId = candidate.id;
    if (candidate.grip === "twoHand") offHandId = null;
  } else if (candidate.slot === "offHand") {
    const currentMainHand = mainHandId ? battleData.equipmentById.get(mainHandId) : null;
    if (currentMainHand?.grip === "twoHand") return null;
    offHandId = candidate.id;
  } else {
    return { mainHandId, offHandId };
  }

  const mainHand = mainHandId ? battleData.equipmentById.get(mainHandId) : null;
  if (mainHand?.grip === "twoHand" && offHandId) return null;
  return { mainHandId, offHandId };
}

function applyHandLoadout(state, loadout) {
  if (!loadout) return;
  state.player.equipment ??= {};
  if (loadout.mainHandId) state.player.equipment.mainHand = loadout.mainHandId;
  else delete state.player.equipment.mainHand;
  if (loadout.offHandId) state.player.equipment.offHand = loadout.offHandId;
  else delete state.player.equipment.offHand;
}

export function autoShop(state, battleData, shopRuntime, profile, tuning = {}) {
  const purchases = [];
  const stock = availableStockAt(state, battleData, shopRuntime, tuning.scope ?? {});
  for (const slot of ["mainHand", "offHand", "body", "accessory"]) {
    const currentId = state.player.equipment[slot];
    const current = currentId ? battleData.equipmentById.get(currentId) : null;
    const currentPerformance = Number(current?.performanceIndex ?? 0);
    const candidates = stock
      .map((entry) => ({
        entry,
        equipment: battleData.equipmentById.get(entry.equipmentId),
      }))
      .filter(({ equipment, entry }) => equipment?.slot === slot && profileAccepts(profile, equipment) && entry.price <= state.player.gold)
      .map(({ entry, equipment }) => ({
        entry,
        equipment,
        handLoadout: equipment.slot === "mainHand" || equipment.slot === "offHand"
          ? handLoadoutForCandidate(state, battleData, equipment)
          : null,
      }))
      .filter(({ equipment, handLoadout }) => !["mainHand", "offHand"].includes(equipment.slot) || handLoadout !== null)
      .filter(({ equipment }) => Number(equipment.performanceIndex ?? 0) >= currentPerformance + Number(tuning.minimumUpgradeGain ?? 2))
      .sort((left, right) => {
        const leftValue = (left.equipment.performanceIndex - currentPerformance) / Math.max(1, left.entry.price);
        const rightValue = (right.equipment.performanceIndex - currentPerformance) / Math.max(1, right.entry.price);
        return rightValue - leftValue || left.entry.price - right.entry.price;
      });
    const selected = candidates[0];
    if (!selected) continue;
    const result = buyEquipment(state, battleData, shopRuntime, selected.entry.id, tuning.scope ?? {});
    if (!result.ok) continue;
    if (selected.handLoadout) applyHandLoadout(state, selected.handLoadout);
    else state.player.equipment[slot] = selected.equipment.id;
    purchases.push({ stockId: selected.entry.id, equipmentId: selected.equipment.id, price: result.price, slot });
  }
  return purchases;
}
