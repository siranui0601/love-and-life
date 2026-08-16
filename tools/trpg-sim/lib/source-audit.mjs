import {
  loadAllFixtures,
  tableFromTab,
} from "./fixtures.mjs";

const LOCATION_TABS = [
  "北陵要塞",
  "ドワーフ洞窟",
  "交易都市",
  "犯罪都市",
  "辺境の村",
  "古代神殿",
  "田園の村",
  "王都",
  "森",
  "エルフの隠れ里",
  "魔王領",
];

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

function idTokens(value, pattern) {
  return typeof value === "string" ? value.match(pattern) ?? [] : [];
}

function collectConditionPredicates(node, output = []) {
  if (Array.isArray(node)) {
    for (const child of node) collectConditionPredicates(child, output);
  } else if (node && typeof node === "object") {
    if (node.scope && node.path && node.op) output.push(node);
    for (const value of Object.values(node)) collectConditionPredicates(value, output);
  }
  return output;
}

function parseJson(value, fallback = []) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function findCycles(graph) {
  const cycles = new Set();
  const visited = new Set();
  const active = new Set();
  const stack = [];

  function canonicalize(nodes) {
    const body = nodes.slice(0, -1);
    if (!body.length) return "";
    const rotations = body.map((_, index) => [
      ...body.slice(index),
      ...body.slice(0, index),
    ]);
    const smallest = rotations
      .map((rotation) => rotation.join("->"))
      .sort()[0];
    return smallest;
  }

  function visit(node) {
    if (active.has(node)) {
      const index = stack.indexOf(node);
      cycles.add(canonicalize([...stack.slice(index), node]));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    active.add(node);
    stack.push(node);
    for (const next of graph.get(node) ?? []) visit(next);
    stack.pop();
    active.delete(node);
  }

  for (const node of graph.keys()) visit(node);
  return [...cycles].filter(Boolean).sort();
}

function numericSummary(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return { count: 0, minimum: 0, median: 0, maximum: 0 };
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    count: sorted.length,
    minimum: sorted[0],
    median,
    maximum: sorted.at(-1),
  };
}

export function runSourceAudit(fixtures = loadAllFixtures()) {
  const worldTabs = fixtures.world.tabs;
  const battleTabs = fixtures.battle.tabs;
  const troubles = tableFromTab(worldTabs["トラブル一覧"], 3);
  const chains = tableFromTab(worldTabs["トラブル連鎖"], 3);
  const npcs = tableFromTab(worldTabs["NPC一覧"], 3);
  const products = tableFromTab(worldTabs["商品・価格表"], 3);
  const equipment = tableFromTab(battleTabs["装備性能マスター"], 3);
  const stock = tableFromTab(battleTabs["店舗装備在庫"], 3);
  const monsters = tableFromTab(battleTabs["モンスター一覧"], 3);
  const monsterSkills = tableFromTab(battleTabs["モンスタースキル"], 3);
  const monsterActions = tableFromTab(battleTabs["モンスター行動"], 3);
  const encounters = tableFromTab(battleTabs["地域別エンカウント"], 3);
  const flagDictionary = tableFromTab(
    fixtures.skillSupport.tabs["イベントフラグ辞書"],
    0
  );

  const facilities = [];
  for (const location of LOCATION_TABS) {
    const tab = worldTabs[location];
    const headerIndex = tab.findIndex((row) => row?.[0] === "施設ID");
    if (headerIndex < 0) continue;
    const headers = tab[headerIndex];
    for (const row of tab.slice(headerIndex + 1)) {
      if (!String(row?.[0] ?? "").startsWith("LOC_")) continue;
      facilities.push({
        location,
        ...Object.fromEntries(headers.map((header, index) => [header, row?.[index] ?? null])),
      });
    }
  }

  const troubleIds = new Set(troubles.map((trouble) => trouble.ID));
  const facilityIds = new Set(facilities.map((facility) => facility["施設ID"]));
  const equipmentIds = new Set(equipment.map((item) => item["装備ID"]));
  const monsterIds = new Set(monsters.map((monster) => monster["モンスターID"]));
  const monsterSkillIds = new Set(
    monsterSkills.map((skill) => skill["モンスタースキルID"])
  );
  const skillById = new Map(fixtures.skills.map((skill) => [skill.id, skill]));

  const missingTroubleReferences = [];
  for (const npc of npcs) {
    for (const id of idTokens(npc["関連T"], /T\d{2}/g)) {
      if (!troubleIds.has(id)) missingTroubleReferences.push({ owner: npc["NPC ID"], id });
    }
  }

  const referencedFacilityIds = new Map();
  const addFacilityReference = (owner, value) => {
    for (const id of idTokens(value, /LOC_[A-Z0-9_]+/g)) {
      if (!referencedFacilityIds.has(id)) referencedFacilityIds.set(id, []);
      referencedFacilityIds.get(id).push(owner);
    }
  };
  for (const npc of npcs) {
    addFacilityReference(npc["NPC ID"], npc["主施設ID"]);
    addFacilityReference(npc["NPC ID"], npc["関連施設ID/出現条件"]);
  }
  for (const product of products) {
    addFacilityReference(product["商品ID"], product["施設ID"]);
  }
  for (const item of stock) {
    addFacilityReference(item["在庫ID"], item["施設ID"]);
  }
  const missingFacilityReferences = [...referencedFacilityIds.entries()]
    .filter(([id]) => !facilityIds.has(id))
    .map(([id, owners]) => ({ id, owners: [...new Set(owners)].sort() }));

  const invalidStockEquipment = stock
    .filter((item) => !equipmentIds.has(item["装備ID"]))
    .map((item) => ({ stockId: item["在庫ID"], equipmentId: item["装備ID"] }));
  const invalidActionMonsters = monsterActions
    .filter((action) => !monsterIds.has(action["モンスターID"]))
    .map((action) => ({ actionId: action["行動ID"], monsterId: action["モンスターID"] }));
  const invalidActionSkills = monsterActions
    .filter((action) => !monsterSkillIds.has(action["スキルID"]))
    .map((action) => ({ actionId: action["行動ID"], skillId: action["スキルID"] }));

  const invalidEncounterMonsters = [];
  for (const encounter of encounters) {
    for (const member of parseJson(encounter["編成"])) {
      if (!monsterIds.has(member.monsterId)) {
        invalidEncounterMonsters.push({
          encounterId: encounter["エンカウントID"],
          monsterId: member.monsterId,
        });
      }
    }
  }

  const grantedSkillIds = new Set();
  for (const item of equipment) {
    for (const id of idTokens(item["付与スキルID"], /SKL-\d{4}/g)) grantedSkillIds.add(id);
  }
  const equipmentGranted = fixtures.skills.filter(
    (skill) => skill.acquisitionCode === "equipment_granted"
  );
  const unreferencedEquipmentSkills = equipmentGranted
    .filter((skill) => !grantedSkillIds.has(skill.id))
    .map((skill) => skill.id);
  const grantedSkillClassificationMismatches = [...grantedSkillIds]
    .filter((id) => skillById.has(id))
    .filter((id) => skillById.get(id).acquisitionCode !== "equipment_granted")
    .map((id) => ({
      id,
      acquisitionCode: skillById.get(id).acquisitionCode,
    }));
  const invalidGrantedSkills = [...grantedSkillIds].filter((id) => !skillById.has(id));

  const dictionaryKeys = new Set(
    flagDictionary.map((entry) => `${entry.Scope}:${entry.Path}`)
  );
  const usedPredicateKeys = new Map();
  for (const skill of fixtures.skills) {
    const nodes = [
      skill.revealConditions,
      skill.eventUnlockConditions,
      skill.learnConditions,
      skill.grantConditions,
      skill.activationConditions,
      skill.additionalEffectConditions,
    ];
    for (const predicate of nodes.flatMap((node) => collectConditionPredicates(node))) {
      const key = `${predicate.scope}:${predicate.path}`;
      if (!usedPredicateKeys.has(key)) usedPredicateKeys.set(key, []);
      usedPredicateKeys.get(key).push(skill.id);
    }
  }
  const conditionPathsMissingFromDictionary = [...usedPredicateKeys.entries()]
    .filter(([key]) => !dictionaryKeys.has(key))
    .map(([key, owners]) => ({ key, owners: [...new Set(owners)].slice(0, 12) }));
  const persistedProgressPathsMissingFromDictionary =
    conditionPathsMissingFromDictionary.filter(({ key }) => key.startsWith("progress:"));
  const runtimePredicatePathsOutsideDictionary =
    conditionPathsMissingFromDictionary.filter(({ key }) => !key.startsWith("progress:"));
  const dictionaryPathsUnused = [...dictionaryKeys].filter((key) => !usedPredicateKeys.has(key));

  const unconditionalByMonster = new Map(monsters.map((monster) => [monster["モンスターID"], 0]));
  for (const action of monsterActions) {
    if (!action["使用条件"]) {
      unconditionalByMonster.set(
        action["モンスターID"],
        (unconditionalByMonster.get(action["モンスターID"]) ?? 0) + 1
      );
    }
  }
  const monstersWithoutUnconditionalAction = [...unconditionalByMonster.entries()]
    .filter(([, count]) => count === 0)
    .map(([id]) => id);

  const producedSpecialStates = new Set();
  for (const skill of monsterSkills) {
    for (const effect of parseJson(skill["効果命令"])) {
      if (effect.command === "APPLY_SPECIAL_STATE" && (effect.stateId || effect.stateType)) {
        producedSpecialStates.add(effect.stateId || effect.stateType);
      }
    }
  }
  const requiredSpecialStates = new Set();
  for (const action of monsterActions) {
    for (const match of String(action["使用条件"] ?? "").matchAll(
      /specialStates\.(?:contains|notContains)\('([^']+)'\)/g
    )) {
      requiredSpecialStates.add(match[1]);
    }
  }
  const specialStateContractMismatches = [...requiredSpecialStates]
    .filter((state) => !producedSpecialStates.has(state))
    .sort();

  const chainGraph = new Map([...troubleIds].map((id) => [id, new Set()]));
  for (const chain of chains) {
    const sources = idTokens(chain["発生条件 / 失敗"], /T\d{2}/g);
    const targets = idTokens(chain["影響先T"], /T\d{2}/g);
    for (const source of sources) {
      for (const target of targets) chainGraph.get(source)?.add(target);
    }
  }
  const chainCycles = findCycles(chainGraph);

  const timelineRows = worldTabs["トラブルタイムライン"].slice(4);
  const timelineTroubleIds = new Set(
    timelineRows.flatMap((row) => idTokens(row?.[3], /T\d{2}/g))
  );
  const troublesMissingTimelineRows = [...troubleIds].filter(
    (id) => !timelineTroubleIds.has(id)
  );
  const timelineRowsWithoutNumericDay = timelineRows
    .filter((row) => row.some((value) => value !== null && value !== ""))
    .filter((row) => !Number.isFinite(row[0]))
    .map((row) => row.slice(0, 5));

  const provisionalSkillIds = fixtures.skills
    .filter((skill) => JSON.stringify(skill).includes("provisionalRule"))
    .map((skill) => skill.id);

  const priceSummary = numericSummary(products.map((product) => Number(product["価格G"])));
  const zeroPriceCount = products.filter((product) => Number(product["価格G"]) === 0).length;
  const unstructuredProductPricing = products.filter(
    (product) => product["価格変動/条件"] && typeof product["価格変動/条件"] === "string"
  ).length;
  const unstructuredStockPricing = stock.filter(
    (item) => item["価格変動/条件"] && typeof item["価格変動/条件"] === "string"
  ).length;
  const unstructuredStockUnlocks = stock.filter(
    (item) => item["解禁条件"] && typeof item["解禁条件"] === "string"
  ).length;

  const counts = {
    troubles: troubles.length,
    chains: chains.length,
    npcs: npcs.length,
    facilities: facilities.length,
    products: products.length,
    skills: fixtures.skills.length,
    equipment: equipment.length,
    stock: stock.length,
    monsters: monsters.length,
    monsterSkills: monsterSkills.length,
    monsterActions: monsterActions.length,
    encounters: encounters.length,
  };
  const expectedCounts = {
    troubles: 19,
    chains: 23,
    npcs: 110,
    facilities: 103,
    products: 219,
    skills: 1141,
    equipment: 116,
    stock: 123,
    monsters: 77,
    monsterSkills: 96,
    monsterActions: 286,
    encounters: 76,
  };
  const countMismatches = Object.entries(expectedCounts)
    .filter(([key, expected]) => counts[key] !== expected)
    .map(([key, expected]) => ({ key, expected, actual: counts[key] }));

  return {
    counts,
    countMismatches,
    duplicateIds: {
      troubles: duplicates(troubles.map((item) => item.ID)),
      npcs: duplicates(npcs.map((item) => item["NPC ID"])),
      facilities: duplicates(facilities.map((item) => item["施設ID"])),
      products: duplicates(products.map((item) => item["商品ID"])),
      skills: duplicates(fixtures.skills.map((item) => item.id)),
      equipment: duplicates(equipment.map((item) => item["装備ID"])),
      stock: duplicates(stock.map((item) => item["在庫ID"])),
      monsters: duplicates(monsters.map((item) => item["モンスターID"])),
      monsterSkills: duplicates(monsterSkills.map((item) => item["モンスタースキルID"])),
      monsterActions: duplicates(monsterActions.map((item) => item["行動ID"])),
      encounters: duplicates(encounters.map((item) => item["エンカウントID"])),
    },
    references: {
      missingTroubleReferences,
      missingFacilityReferences,
      invalidStockEquipment,
      invalidActionMonsters,
      invalidActionSkills,
      invalidEncounterMonsters,
      invalidGrantedSkills,
    },
    skills: {
      grantedSkillCount: grantedSkillIds.size,
      equipmentGrantedCount: equipmentGranted.length,
      unreferencedEquipmentSkills,
      grantedSkillClassificationMismatches,
      conditionPathCount: usedPredicateKeys.size,
      dictionaryPathCount: dictionaryKeys.size,
      conditionPathsMissingFromDictionary,
      persistedProgressPathsMissingFromDictionary,
      runtimePredicatePathsOutsideDictionary,
      dictionaryPathsUnused,
      provisionalSkillIds,
    },
    world: {
      chainCycles,
      troublesMissingTimelineRows,
      timelineRowsWithoutNumericDay,
      documentedStartConflict: {
        selected: "Day1 10:00",
        alternatives: ["Day0", "Day1 10:00"],
      },
    },
    battle: {
      monstersWithoutUnconditionalAction,
      // Compatibility alias for older report consumers.  These are authored
      // actions, not runtime fallback attacks.
      monstersWithoutFallbackAction: monstersWithoutUnconditionalAction,
      specialStateContractMismatches,
    },
    economy: {
      priceSummary,
      zeroPriceCount,
      unstructuredProductPricing,
      unstructuredStockPricing,
      unstructuredStockUnlocks,
      startingGold: 0,
      minimumPaidFood: Math.min(
        ...products
          .filter((product) => ["食事", "食料"].includes(product["区分"]))
          .map((product) => Number(product["価格G"]))
          .filter((price) => price > 0)
      ),
      minimumPaidLodging: Math.min(
        ...products
          .filter((product) => product["区分"] === "宿泊")
          .map((product) => Number(product["価格G"]))
          .filter((price) => price > 0)
      ),
    },
  };
}
