import { loadBattleSnapshot, loadWorldSnapshot } from "./fixtures.mjs";
import { mean, quantile, summarize } from "./statistics.mjs";

export const DEFAULT_LEVEL_BANDS = [
  { id: "L01-04", minimum: 1, maximum: 4 },
  { id: "L05-08", minimum: 5, maximum: 8 },
  { id: "L09-12", minimum: 9, maximum: 12 },
  { id: "L13-16", minimum: 13, maximum: 16 },
  { id: "L17-20", minimum: 17, maximum: 20 },
  { id: "L21-24", minimum: 21, maximum: 24 },
];

function numberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[G,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseGold(value) {
  return numberOrNull(value);
}

export function parseWorldProducts(world) {
  return (world.tabs?.["商品・価格表"]?.slice(4) ?? [])
    .filter((row) => row?.[0])
    .map((row) => ({
      id: row[0],
      site: row[1],
      facilityId: row[2],
      facilityName: row[3],
      category: row[4],
      name: row[5],
      basePrice: parseGold(row[6]),
      unit: row[7],
      stockLabel: row[8],
      regionalFeature: row[9],
      priceRuleText: row[10] ?? null,
      notes: row[11] ?? null,
    }));
}

export function parseEquipmentPerformance(battle) {
  return (battle.tabs?.["装備性能マスター"]?.slice(4) ?? [])
    .filter((row) => row?.[0])
    .map((row) => ({
      id: row[0],
      name: row[1],
      slot: row[2],
      weaponType: row[3],
      handling: row[4],
      armorType: row[5],
      tier: numberOrNull(row[6]),
      recommendedLevelMin: numberOrNull(row[7]),
      recommendedLevelMax: numberOrNull(row[8]),
      region: row[9],
      physicalPower: numberOrNull(row[10]) ?? 0,
      magicalPower: numberOrNull(row[11]) ?? 0,
      defense: numberOrNull(row[12]) ?? 0,
      magicResistance: numberOrNull(row[13]) ?? 0,
      speed: numberOrNull(row[14]) ?? 0,
      luck: numberOrNull(row[15]) ?? 0,
      accuracy: numberOrNull(row[16]) ?? 0,
      evasion: numberOrNull(row[17]) ?? 0,
      critical: numberOrNull(row[18]) ?? 0,
      grantedSkillId: row[23] ?? null,
      passive: row[24] ?? null,
      drawback: row[25] ?? null,
      performanceIndex: numberOrNull(row[27]),
      state: row[29],
    }));
}

export function parseEquipmentStock(battle) {
  return (battle.tabs?.["店舗装備在庫"]?.slice(4) ?? [])
    .filter((row) => row?.[0])
    .map((row) => ({
      id: row[0],
      equipmentId: row[1],
      equipmentName: row[2],
      legacyItemId: row[3] ?? null,
      site: row[4],
      facilityId: row[5],
      seller: row[6],
      basePrice: numberOrNull(row[7]),
      stockLabel: row[8],
      initiallyForSale: row[9] === true,
      unlockRuleText: row[10] ?? null,
      priceRuleText: row[11] ?? null,
      legality: row[12],
      regionalCoefficient: numberOrNull(row[13]),
      notes: row[14] ?? null,
    }));
}

function parseMonsters(battle) {
  return (battle.tabs?.["モンスター一覧"]?.slice(4) ?? [])
    .filter((row) => row?.[0])
    .map((row) => ({
      id: row[0],
      name: row[1],
      recommendedLevelMin: numberOrNull(row[5]),
      recommendedLevelMax: numberOrNull(row[6]),
      exp: numberOrNull(row[24]),
      goldMin: numberOrNull(row[25]) ?? 0,
      goldMax: numberOrNull(row[26]) ?? 0,
    }));
}

function pearson(left, right) {
  if (!left.length || left.length !== right.length) return 0;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta ** 2;
    rightVariance += rightDelta ** 2;
  }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator ? numerator / denominator : 0;
}

function ranks(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const output = Array(values.length);
  let cursor = 0;
  while (cursor < sorted.length) {
    let end = cursor + 1;
    while (end < sorted.length && sorted[end].value === sorted[cursor].value) end += 1;
    const averageRank = (cursor + 1 + end) / 2;
    for (let index = cursor; index < end; index += 1) output[sorted[index].index] = averageRank;
    cursor = end;
  }
  return output;
}

function round(value, digits = 4) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(digits));
}

function equipmentGroup(equipment) {
  const subtype = equipment.weaponType && equipment.weaponType !== "none"
    ? equipment.weaponType
    : equipment.armorType && equipment.armorType !== "none"
      ? equipment.armorType
      : "generic";
  return `${equipment.slot}:${subtype}`;
}

function buildEquipmentEconomics(equipment, stock) {
  const stockByEquipment = new Map();
  for (const entry of stock) {
    const values = stockByEquipment.get(entry.equipmentId) ?? [];
    values.push(entry);
    stockByEquipment.set(entry.equipmentId, values);
  }
  return equipment.map((entry) => {
    const stocks = stockByEquipment.get(entry.id) ?? [];
    const positivePrices = stocks.map((value) => value.basePrice).filter((value) => value > 0);
    const zeroPriceSources = stocks.filter((value) => value.basePrice === 0).map((value) => value.id);
    return {
      ...entry,
      group: equipmentGroup(entry),
      stockCount: stocks.length,
      minimumPositivePrice: positivePrices.length ? Math.min(...positivePrices) : null,
      maximumPrice: positivePrices.length ? Math.max(...positivePrices) : null,
      zeroPriceSources,
      stockIds: stocks.map((value) => value.id),
    };
  });
}

function findParetoDominance(entries) {
  const dominated = [];
  for (const candidate of entries) {
    if (!(candidate.minimumPositivePrice > 0) || !Number.isFinite(candidate.performanceIndex)) continue;
    const dominators = entries.filter((other) =>
      other.id !== candidate.id
      && other.group === candidate.group
      && other.minimumPositivePrice > 0
      && Number.isFinite(other.performanceIndex)
      && other.minimumPositivePrice <= candidate.minimumPositivePrice
      && other.performanceIndex >= candidate.performanceIndex
      && (other.recommendedLevelMin ?? 0) <= (candidate.recommendedLevelMin ?? 0)
      && (
        other.minimumPositivePrice < candidate.minimumPositivePrice
        || other.performanceIndex > candidate.performanceIndex
        || (other.recommendedLevelMin ?? 0) < (candidate.recommendedLevelMin ?? 0)
      )
    );
    if (!dominators.length) continue;
    dominators.sort((left, right) =>
      left.minimumPositivePrice - right.minimumPositivePrice
      || right.performanceIndex - left.performanceIndex
      || left.id.localeCompare(right.id)
    );
    const best = dominators[0];
    dominated.push({
      equipmentId: candidate.id,
      name: candidate.name,
      group: candidate.group,
      price: candidate.minimumPositivePrice,
      performance: candidate.performanceIndex,
      recommendedLevelMin: candidate.recommendedLevelMin,
      dominatedBy: {
        equipmentId: best.id,
        name: best.name,
        price: best.minimumPositivePrice,
        performance: best.performanceIndex,
        recommendedLevelMin: best.recommendedLevelMin,
      },
    });
  }
  return dominated.sort((left, right) => left.equipmentId.localeCompare(right.equipmentId));
}

function overlapsBand(entry, band) {
  const minimum = entry.recommendedLevelMin ?? 1;
  const maximum = entry.recommendedLevelMax ?? minimum;
  return minimum <= band.maximum && maximum >= band.minimum;
}

function buildAffordability(levelBands, equipmentEconomics, monsters, assumedWins) {
  return levelBands.map((band) => {
    const availableEquipment = equipmentEconomics.filter((entry) =>
      entry.minimumPositivePrice > 0 && overlapsBand(entry, band)
    );
    const appropriateMonsters = monsters.filter((entry) => overlapsBand(entry, band));
    const goldPerWin = appropriateMonsters.map((entry) => (entry.goldMin + entry.goldMax) / 2);
    const medianGoldPerWin = quantile(goldPerWin, 0.5);
    const prices = availableEquipment.map((entry) => entry.minimumPositivePrice);
    const winsNeeded = medianGoldPerWin > 0 ? prices.map((price) => price / medianGoldPerWin) : [];
    const assumedBudget = medianGoldPerWin * assumedWins;
    const affordable = prices.filter((price) => price <= assumedBudget).length;
    return {
      ...band,
      equipmentCount: availableEquipment.length,
      monsterCount: appropriateMonsters.length,
      equipmentPrice: summarize(prices, 2),
      expectedGoldPerWin: summarize(goldPerWin, 2),
      medianWinsNeeded: medianGoldPerWin > 0 ? round(quantile(winsNeeded, 0.5), 2) : null,
      assumedWins,
      assumedBudget: round(assumedBudget, 2),
      affordableCount: affordable,
      affordableShare: availableEquipment.length ? round(affordable / availableEquipment.length, 3) : 0,
    };
  });
}

function countLabels(values) {
  const counts = {};
  for (const value of values) counts[value ?? "(blank)"] = (counts[value ?? "(blank)"] ?? 0) + 1;
  return counts;
}

function legacyPriceDiagnostics(products, stock) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const linked = stock.filter((entry) => entry.legacyItemId);
  const missing = linked.filter((entry) => !productsById.has(entry.legacyItemId));
  const mismatches = linked.flatMap((entry) => {
    const product = productsById.get(entry.legacyItemId);
    if (!product || product.basePrice === entry.basePrice) return [];
    return [{
      stockId: entry.id,
      equipmentId: entry.equipmentId,
      itemId: entry.legacyItemId,
      itemName: product.name,
      productPrice: product.basePrice,
      equipmentStockPrice: entry.basePrice,
      difference: entry.basePrice - product.basePrice,
    }];
  });
  return { linkedCount: linked.length, missing, priceMismatches: mismatches };
}

function startingSurvivalDiagnostic(world, products) {
  const playerText = JSON.stringify(world.tabs?.["プレイヤー設定"] ?? []);
  const startingGold = playerText.includes("金なし") ? 0 : null;
  const startingSite = "田園の村";
  const startingProducts = products.filter((product) => product.site === startingSite);
  const paidMeals = startingProducts
    .filter((product) => ["食事", "食料"].includes(product.category) && product.basePrice > 0)
    .sort((left, right) => left.basePrice - right.basePrice);
  const paidLodging = startingProducts
    .filter((product) => product.category === "宿泊" && product.basePrice > 0)
    .sort((left, right) => left.basePrice - right.basePrice);
  const freeMeals = startingProducts.filter((product) => ["食事", "食料"].includes(product.category) && product.basePrice === 0);
  const freeLodging = startingProducts.filter((product) => product.category === "宿泊" && product.basePrice === 0);
  const minimumMeal = paidMeals[0]?.basePrice ?? null;
  const minimumLodging = paidLodging[0]?.basePrice ?? null;
  const minimumFirstDayCost = (minimumMeal ?? 0) + (minimumLodging ?? 0);
  const structuredInitialGrant = false;
  return {
    startingSite,
    startingGold,
    minimumMeal,
    minimumLodging,
    minimumFirstDayCost,
    deficit: startingGold === null ? null : Math.max(0, minimumFirstDayCost - startingGold),
    freeMealIds: freeMeals.map((product) => product.id),
    freeLodgingIds: freeLodging.map((product) => product.id),
    structuredInitialGrant,
    softLockRisk: startingGold === 0 && minimumFirstDayCost > 0 && !freeMeals.length && !freeLodging.length && !structuredInitialGrant,
    note: "NPC004エダの保護は物語文にあるが、無料食事・初夜宿泊・初期収入として構造化されていない",
  };
}

export function auditEconomy({
  world = loadWorldSnapshot(),
  battle = loadBattleSnapshot(),
  levelBands = DEFAULT_LEVEL_BANDS,
  assumedWinsPerBand = 10,
} = {}) {
  const products = parseWorldProducts(world);
  const equipment = parseEquipmentPerformance(battle);
  const stock = parseEquipmentStock(battle);
  const monsters = parseMonsters(battle);
  const equipmentEconomics = buildEquipmentEconomics(equipment, stock);
  const equipmentMap = new Map(equipment.map((entry) => [entry.id, entry]));
  const joinedStock = stock
    .map((entry) => ({ ...entry, equipment: equipmentMap.get(entry.equipmentId) }))
    .filter((entry) => entry.equipment);
  const pricedJoinedStock = joinedStock.filter((entry) => entry.basePrice > 0 && Number.isFinite(entry.equipment.performanceIndex));
  const prices = pricedJoinedStock.map((entry) => entry.basePrice);
  const performances = pricedJoinedStock.map((entry) => entry.equipment.performanceIndex);
  const uniquePricedEquipment = equipmentEconomics.filter((entry) => entry.minimumPositivePrice > 0 && Number.isFinite(entry.performanceIndex));
  const uniquePrices = uniquePricedEquipment.map((entry) => entry.minimumPositivePrice);
  const uniquePerformances = uniquePricedEquipment.map((entry) => entry.performanceIndex);
  const valueRanking = uniquePricedEquipment
    .map((entry) => ({
      equipmentId: entry.id,
      name: entry.name,
      group: entry.group,
      price: entry.minimumPositivePrice,
      performance: entry.performanceIndex,
      performancePer100G: round((entry.performanceIndex / entry.minimumPositivePrice) * 100, 3),
    }))
    .sort((left, right) => right.performancePer100G - left.performancePer100G || left.equipmentId.localeCompare(right.equipmentId));
  const worldPriceRules = products.filter((entry) => entry.priceRuleText);
  const stockPriceRules = stock.filter((entry) => entry.priceRuleText);
  const unlockRules = stock.filter((entry) => entry.unlockRuleText);
  const legacy = legacyPriceDiagnostics(products, stock);

  return {
    totals: {
      products: products.length,
      equipment: equipment.length,
      equipmentStockRows: stock.length,
      stockedEquipment: new Set(stock.map((entry) => entry.equipmentId)).size,
      monsters: monsters.length,
    },
    pricePerformance: {
      stockObservationCount: pricedJoinedStock.length,
      uniqueEquipmentCount: uniquePricedEquipment.length,
      stockPearson: round(pearson(prices, performances)),
      stockSpearman: round(pearson(ranks(prices), ranks(performances))),
      uniqueEquipmentPearson: round(pearson(uniquePrices, uniquePerformances)),
      uniqueEquipmentSpearman: round(pearson(ranks(uniquePrices), ranks(uniquePerformances))),
      priceSummary: summarize(uniquePrices, 2),
      performanceSummary: summarize(uniquePerformances, 2),
      bestValue: valueRanking.slice(0, 10),
      worstValue: valueRanking.slice(-10).reverse(),
    },
    pareto: {
      dominated: findParetoDominance(equipmentEconomics),
      comparisonRule: "same slot/subtype; dominator price<=, performance>=, required level<=, at least one strict",
    },
    affordability: buildAffordability(levelBands, equipmentEconomics, monsters, assumedWinsPerBand),
    startingSurvival: startingSurvivalDiagnostic(world, products),
    diagnostics: {
      missingEquipmentForStock: stock
        .filter((entry) => !equipmentMap.has(entry.equipmentId))
        .map((entry) => ({ stockId: entry.id, equipmentId: entry.equipmentId })),
      unstockedEquipment: equipmentEconomics
        .filter((entry) => entry.stockCount === 0)
        .map((entry) => ({ equipmentId: entry.id, name: entry.name })),
      zeroPriceEquipmentSources: equipmentEconomics
        .filter((entry) => entry.zeroPriceSources.length)
        .map((entry) => ({ equipmentId: entry.id, name: entry.name, stockIds: entry.zeroPriceSources })),
      legacy,
      nonStructuredRules: {
        worldProductPriceRuleCount: worldPriceRules.length,
        equipmentStockPriceRuleCount: stockPriceRules.length,
        equipmentUnlockRuleCount: unlockRules.length,
        worldProductStockLabels: countLabels(products.map((entry) => entry.stockLabel)),
        equipmentStockLabels: countLabels(stock.map((entry) => entry.stockLabel)),
        productPriceRuleSamples: worldPriceRules.slice(0, 10).map((entry) => ({ id: entry.id, text: entry.priceRuleText })),
        equipmentPriceRuleSamples: stockPriceRules.slice(0, 10).map((entry) => ({ id: entry.id, text: entry.priceRuleText })),
        note: "価格条件・解禁条件・在庫は自由文/定性値で、係数順序、丸め、数量、補充周期を直接評価できない",
      },
    },
  };
}

export const analyzeEconomy = auditEconomy;
