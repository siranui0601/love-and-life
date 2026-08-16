import * as base from "./canonical-public-action-policy.js";

export * from "./canonical-public-action-policy.js";

export const CANONICAL_MATERIAL_ECONOMY_VERSION = "canonical-material-economy-v1";

const BUYER_FACILITIES = Object.freeze({
  LOC_FARM_REPAIR: null,
  LOC_TRADE_GUILD: null,
  LOC_CAP_MARKET: null,
  LOC_CRIME_WEAPON_MARKET: null,
  LOC_DWARF_MARKET: null,
  LOC_BORDER_SOUVENIR: null,
  LOC_FORT_SUPPLY: "fortEntryPermit",
  LOC_FOREST_HUNTER_HUT: "hunterApproval",
  LOC_BLACKRIDGE_MARKET: "blackridgeEntryPermit",
});

const MATERIAL_BUYBACK_G = Object.freeze({
  "MAT_ANCIENT_GEAR": 5,
  "MAT_ANCIENT_REACTOR": 14,
  "MAT_ASH_BRANCH": 11,
  "MAT_ASH_HORN": 7,
  "MAT_ASH_HOUND_HIDE": 6,
  "MAT_ASH_SPIRIT_CORE": 11,
  "MAT_ASSASSIN_TOKEN": 6,
  "MAT_BARRIER_SHARD": 12,
  "MAT_BAT_WING": 2,
  "MAT_BEETLE_SHELL": 4,
  "MAT_BLACKRIDGE_COMMAND_SEAL": 13,
  "MAT_BLACK_FEATHER_MARK": 9,
  "MAT_BOAR_MEAT": 1,
  "MAT_CHIMERA_GLAND": 7,
  "MAT_CLEAR_GEL": 2,
  "MAT_CLIFF_FEATHER": 7,
  "MAT_COLD_HIDE": 4,
  "MAT_COLOSSUS_CORE": 12,
  "MAT_CORRUPTED_WOOD": 10,
  "MAT_CRAB_SHELL": 3,
  "MAT_DIRTY_GEL": 1,
  "MAT_FANG": 1,
  "MAT_FIELD_FUR": 1,
  "MAT_FROST_PELT": 4,
  "MAT_GOLEM_CORE": 8,
  "MAT_GULL_FEATHER": 3,
  "MAT_HOLLOW_CORE": 11,
  "MAT_HORN_SMALL": 1,
  "MAT_ICE_WING": 4,
  "MAT_KING_GEL_CORE": 3,
  "MAT_LARGE_BEAST_HIDE": 4,
  "MAT_LARGE_CLAW": 4,
  "MAT_MANA_GEL": 7,
  "MAT_MIMIC_HINGE": 5,
  "MAT_MOSS_PELT": 2,
  "MAT_MOTH_DUST": 2,
  "MAT_NORTH_HORN": 6,
  "MAT_ORE_GEL": 2,
  "MAT_POISON_FANG": 3,
  "MAT_POISON_SAC": 2,
  "MAT_RAT_TAIL": 1,
  "MAT_RED_FANG": 1,
  "MAT_RED_FANG_LARGE": 3,
  "MAT_RIFT_FRAGMENT": 9,
  "MAT_ROCK_SCALE": 3,
  "MAT_RUIN_LIGHT": 4,
  "MAT_SALT_GEL": 2,
  "MAT_SAND_CARAPACE": 2,
  "MAT_SIEGE_PART": 11,
  "MAT_SLIME_GEL": 1,
  "MAT_SPIDER_SILK": 2,
  "MAT_STONE_BEETLE_SHELL": 3,
  "MAT_TRANSFER_SHARD": 6,
  "MAT_TREANT_BRANCH": 3,
  "MAT_TUNNEL_WORM_HIDE": 5,
  "MAT_WAR_BEAST_PLATE": 11,
  "MAT_WAR_HOUND_FANG": 8,
  "MAT_WATER_LEECH_GLAND": 5,
  "MAT_WOLF_PELT": 2,
  "MAT_WORLD_TREE_FRAGMENT": 13,
  "MAT_WORLD_TREE_MANA": 11,
});

const MONSTER_MATERIAL_DROPS = Object.freeze({
  "MON-0001": Object.freeze([{"itemId":"MAT_FIELD_FUR","chance":0.35,"quantity":"1-2"}]),
  "MON-0002": Object.freeze([{"itemId":"MAT_HORN_SMALL","chance":0.25,"quantity":"1"}]),
  "MON-0003": Object.freeze([{"itemId":"MAT_BOAR_MEAT","chance":0.55,"quantity":"1"}]),
  "MON-0004": Object.freeze([{"itemId":"MAT_FANG","chance":0.25,"quantity":"1"}]),
  "MON-0005": Object.freeze([{"itemId":"MAT_RED_FANG","chance":0.18,"quantity":"1"}]),
  "MON-0006": Object.freeze([{"itemId":"MAT_RED_FANG","chance":0.45,"quantity":"1"},{"itemId":"MAT_WOLF_PELT","chance":0.35,"quantity":"1"}]),
  "MON-0007": Object.freeze([{"itemId":"MAT_RED_FANG_LARGE","chance":1,"quantity":"1"},{"itemId":"MAT_WOLF_PELT","chance":0.9,"quantity":"2-3"}]),
  "MON-0008": Object.freeze([{"itemId":"MAT_SLIME_GEL","chance":0.65,"quantity":"1"}]),
  "MON-0009": Object.freeze([{"itemId":"MAT_MOSS_PELT","chance":0.4,"quantity":"1"}]),
  "MON-0010": Object.freeze([{"itemId":"MAT_SPIDER_SILK","chance":0.55,"quantity":"1"},{"itemId":"MAT_POISON_SAC","chance":0.2,"quantity":"1"}]),
  "MON-0011": Object.freeze([{"itemId":"MAT_MOTH_DUST","chance":0.5,"quantity":"1"}]),
  "MON-0012": Object.freeze([{"itemId":"MAT_TREANT_BRANCH","chance":0.5,"quantity":"1"}]),
  "MON-0013": Object.freeze([{"itemId":"MAT_CLEAR_GEL","chance":0.5,"quantity":"1"}]),
  "MON-0014": Object.freeze([{"itemId":"MAT_LARGE_BEAST_HIDE","chance":0.75,"quantity":"1"},{"itemId":"MAT_LARGE_CLAW","chance":0.55,"quantity":"1"}]),
  "MON-0015": Object.freeze([{"itemId":"MAT_KING_GEL_CORE","chance":1,"quantity":"1"}]),
  "MON-0016": Object.freeze([{"itemId":"MAT_KING_GEL_CORE","chance":1,"quantity":"1"},{"itemId":"MAT_MANA_GEL","chance":1,"quantity":"2-4"}]),
  "MON-0017": Object.freeze([{"itemId":"MAT_KING_GEL_CORE","chance":1,"quantity":"1"},{"itemId":"MAT_WORLD_TREE_MANA","chance":0.5,"quantity":"1"}]),
  "MON-0018": Object.freeze([{"itemId":"MAT_KING_GEL_CORE","chance":1,"quantity":"1"},{"itemId":"MAT_WORLD_TREE_FRAGMENT","chance":1,"quantity":"1"}]),
  "MON-0019": Object.freeze([{"itemId":"MAT_ASH_BRANCH","chance":0.5,"quantity":"1"}]),
  "MON-0020": Object.freeze([{"itemId":"MAT_BARRIER_SHARD","chance":0.45,"quantity":"1"}]),
  "MON-0021": Object.freeze([{"itemId":"MAT_DIRTY_GEL","chance":0.6,"quantity":"1"}]),
  "MON-0022": Object.freeze([{"itemId":"MAT_RAT_TAIL","chance":0.35,"quantity":"1"}]),
  "MON-0025": Object.freeze([{"itemId":"MAT_ASSASSIN_TOKEN","chance":0.65,"quantity":"1"}]),
  "MON-0027": Object.freeze([{"itemId":"MAT_RIFT_FRAGMENT","chance":0.6,"quantity":"1"}]),
  "MON-0028": Object.freeze([{"itemId":"MAT_HOLLOW_CORE","chance":1,"quantity":"1"}]),
  "MON-0029": Object.freeze([{"itemId":"MAT_RAT_TAIL","chance":0.35,"quantity":"1-2"}]),
  "MON-0030": Object.freeze([{"itemId":"MAT_SALT_GEL","chance":0.55,"quantity":"1"}]),
  "MON-0031": Object.freeze([{"itemId":"MAT_GULL_FEATHER","chance":0.45,"quantity":"1"}]),
  "MON-0032": Object.freeze([{"itemId":"MAT_CRAB_SHELL","chance":0.6,"quantity":"1"}]),
  "MON-0036": Object.freeze([{"itemId":"MAT_SIEGE_PART","chance":0.75,"quantity":"1"}]),
  "MON-0038": Object.freeze([{"itemId":"MAT_POISON_FANG","chance":0.4,"quantity":"1"}]),
  "MON-0040": Object.freeze([{"itemId":"MAT_MIMIC_HINGE","chance":0.55,"quantity":"1"}]),
  "MON-0041": Object.freeze([{"itemId":"MAT_CHIMERA_GLAND","chance":0.8,"quantity":"1"}]),
  "MON-0043": Object.freeze([{"itemId":"MAT_BLACK_FEATHER_MARK","chance":0.8,"quantity":"1"}]),
  "MON-0044": Object.freeze([{"itemId":"MAT_BAT_WING","chance":0.45,"quantity":"1"}]),
  "MON-0045": Object.freeze([{"itemId":"MAT_ORE_GEL","chance":0.45,"quantity":"1"}]),
  "MON-0046": Object.freeze([{"itemId":"MAT_ROCK_SCALE","chance":0.6,"quantity":"1"}]),
  "MON-0047": Object.freeze([{"itemId":"MAT_BEETLE_SHELL","chance":0.55,"quantity":"1"}]),
  "MON-0048": Object.freeze([{"itemId":"MAT_TUNNEL_WORM_HIDE","chance":0.5,"quantity":"1"}]),
  "MON-0050": Object.freeze([{"itemId":"MAT_GOLEM_CORE","chance":0.6,"quantity":"1"}]),
  "MON-0051": Object.freeze([{"itemId":"MAT_FROST_PELT","chance":0.55,"quantity":"1"}]),
  "MON-0052": Object.freeze([{"itemId":"MAT_COLD_HIDE","chance":0.55,"quantity":"1"}]),
  "MON-0053": Object.freeze([{"itemId":"MAT_ICE_WING","chance":0.45,"quantity":"1"}]),
  "MON-0054": Object.freeze([{"itemId":"MAT_NORTH_HORN","chance":0.6,"quantity":"1"}]),
  "MON-0056": Object.freeze([{"itemId":"MAT_WAR_HOUND_FANG","chance":0.45,"quantity":"1"}]),
  "MON-0057": Object.freeze([{"itemId":"MAT_SAND_CARAPACE","chance":0.4,"quantity":"1"}]),
  "MON-0058": Object.freeze([{"itemId":"MAT_STONE_BEETLE_SHELL","chance":0.55,"quantity":"1"}]),
  "MON-0059": Object.freeze([{"itemId":"MAT_RUIN_LIGHT","chance":0.5,"quantity":"1"}]),
  "MON-0060": Object.freeze([{"itemId":"MAT_ANCIENT_GEAR","chance":0.45,"quantity":"1"}]),
  "MON-0061": Object.freeze([{"itemId":"MAT_TRANSFER_SHARD","chance":0.55,"quantity":"1"}]),
  "MON-0062": Object.freeze([{"itemId":"MAT_ANCIENT_GEAR","chance":0.65,"quantity":"1-2"}]),
  "MON-0063": Object.freeze([{"itemId":"MAT_COLOSSUS_CORE","chance":1,"quantity":"1"}]),
  "MON-0064": Object.freeze([{"itemId":"MAT_COLOSSUS_CORE","chance":1,"quantity":"1"},{"itemId":"MAT_ANCIENT_REACTOR","chance":1,"quantity":"1"}]),
  "MON-0067": Object.freeze([{"itemId":"MAT_CORRUPTED_WOOD","chance":0.65,"quantity":"1"}]),
  "MON-0068": Object.freeze([{"itemId":"MAT_ASH_SPIRIT_CORE","chance":0.55,"quantity":"1"}]),
  "MON-0069": Object.freeze([{"itemId":"MAT_ASH_HOUND_HIDE","chance":0.55,"quantity":"1"}]),
  "MON-0070": Object.freeze([{"itemId":"MAT_WATER_LEECH_GLAND","chance":0.45,"quantity":"1"}]),
  "MON-0071": Object.freeze([{"itemId":"MAT_ASH_HORN","chance":0.6,"quantity":"1"}]),
  "MON-0072": Object.freeze([{"itemId":"MAT_CLIFF_FEATHER","chance":0.55,"quantity":"1"}]),
  "MON-0074": Object.freeze([{"itemId":"MAT_WAR_BEAST_PLATE","chance":0.7,"quantity":"1"}]),
  "MON-0077": Object.freeze([{"itemId":"MAT_BLACKRIDGE_COMMAND_SEAL","chance":1,"quantity":"1"}]),
});

function state(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.canonicalMaterialEconomy ??= {
    inventory: {},
    sold: {},
    processedBattleKeys: {},
  };
  return runtime.playerState.canonicalMaterialEconomy;
}

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function progress(runtime) {
  return runtime?.playerState?.progress ?? player(runtime)?.progress ?? {};
}

function gate(runtime, condition) {
  if (!condition) return true;
  const p = progress(runtime);
  if (condition === "fortEntryPermit") return Boolean(p.fortEntryPermit ?? p.fort_entry_permit ?? false);
  if (condition === "hunterApproval") return Boolean(p.hunterApproval ?? p.hunter_approval ?? false);
  if (condition === "blackridgeEntryPermit") return Boolean(p.blackridgeEntryPermit ?? p.blackridge_entry_permit ?? false);
  return false;
}

function activeBuyer(runtime) {
  const facilityId = String(player(runtime)?.facilityId ?? "");
  if (!Object.hasOwn(BUYER_FACILITIES, facilityId)) return null;
  return gate(runtime, BUYER_FACILITIES[facilityId]) ? facilityId : null;
}

function saleAction(materialId, quantity, mode, facilityId) {
  const unit = Number(MATERIAL_BUYBACK_G[materialId] ?? 0);
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const suffix = mode === "all" ? "ALL" : "Q1";
  return {
    id: `MATERIAL_SELL:${materialId}:${suffix}`,
    actionId: `MATERIAL_SELL:${materialId}:${suffix}`,
    family: "material_economy",
    type: "plan",
    label: mode === "all" ? `${materialId}を全${qty}個売る（${unit * qty}G）` : `${materialId}を1個売る（${unit}G）`,
    minutes: 10,
    targetLocation: null,
    targetFacilityId: facilityId,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    canonicalMaterialSaleChoice: true,
    canonicalMaterialId: materialId,
    canonicalMaterialQuantity: qty,
    canonicalMaterialUnitPrice: unit,
  };
}

function ownActions(runtime) {
  const facilityId = activeBuyer(runtime);
  if (!facilityId) return null;
  const inventory = state(runtime).inventory;
  const actions = [];
  for (const materialId of Object.keys(inventory).sort()) {
    const quantity = Math.max(0, Math.floor(Number(inventory[materialId] ?? 0)));
    if (!quantity || !MATERIAL_BUYBACK_G[materialId]) continue;
    actions.push(saleAction(materialId, 1, "one", facilityId));
    if (quantity > 1) actions.push(saleAction(materialId, quantity, "all", facilityId));
  }
  return actions.length ? actions : null;
}

function hashUnit(text) {
  let hash = 0x811c9dc5;
  for (const ch of String(text ?? "")) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 4294967296;
}

function quantityFromSpec(spec, key) {
  const text = String(spec ?? "1").trim();
  const match = text.match(/^(\d+)\s*-\s*(\d+)$/u);
  if (!match) return Math.max(1, Math.floor(Number(text) || 1));
  const minimum = Number(match[1]);
  const maximum = Math.max(minimum, Number(match[2]));
  return minimum + Math.floor(hashUnit(`${key}:quantity`) * (maximum - minimum + 1));
}

function processBattleDrops(runtime, result) {
  const battle = result?.battle;
  if (!battle?.won || !Array.isArray(battle.monsterIds) || battle.monsterIds.length === 0) return [];
  const material = state(runtime);
  const battleNumber = Number(runtime?.playerState?.metrics?.battles ?? 0);
  const battleKey = `${battleNumber}:${battle.encounterId ?? "encounter"}`;
  if (material.processedBattleKeys[battleKey]) return [];
  material.processedBattleKeys[battleKey] = true;

  const gained = [];
  const seed = String(runtime?.playerState?.seed ?? "trpg");
  battle.monsterIds.forEach((monsterId, monsterIndex) => {
    const drops = MONSTER_MATERIAL_DROPS[monsterId] ?? [];
    drops.forEach((drop, dropIndex) => {
      const chance = Math.max(0, Math.min(1, Number(drop.chance ?? 0)));
      const key = `${seed}:${battleKey}:${monsterId}:${monsterIndex}:${drop.itemId}:${dropIndex}`;
      if (chance < 1 && hashUnit(`${key}:roll`) >= chance) return;
      const quantity = quantityFromSpec(drop.quantity, key);
      material.inventory[drop.itemId] = Number(material.inventory[drop.itemId] ?? 0) + quantity;
      gained.push({ materialId: drop.itemId, quantity });
    });
  });

  if (gained.length) {
    runtime.playerState.history ??= [];
    runtime.playerState.history.push({
      type: "CANONICAL_MATERIAL_DROPS",
      minute: Number(runtime.playerState.absoluteMinute ?? 0),
      battleKey,
      encounterId: battle.encounterId ?? null,
      drops: gained.map((entry) => ({ ...entry })),
    });
    result.materialDrops = gained.map((entry) => ({ ...entry }));
  }
  return gained;
}

function consumeSale(runtime, actionValue, result) {
  if (!actionValue?.canonicalMaterialSaleChoice || result?.ok === false) return false;
  const facilityId = activeBuyer(runtime);
  if (!facilityId || facilityId !== String(actionValue.targetFacilityId ?? "")) {
    result.ok = false;
    result.code = "material_buyer_not_available";
    result.summary = "ここでは素材を買い取ってもらえない。";
    return true;
  }
  const material = state(runtime);
  const materialId = String(actionValue.canonicalMaterialId ?? "");
  const owned = Math.max(0, Math.floor(Number(material.inventory[materialId] ?? 0)));
  const requested = Math.max(1, Math.floor(Number(actionValue.canonicalMaterialQuantity ?? 1)));
  if (owned < requested) {
    result.ok = false;
    result.code = "material_quantity_missing";
    result.summary = "売ろうとした数量の素材を持っていない。";
    return true;
  }
  const unit = Number(MATERIAL_BUYBACK_G[materialId] ?? 0);
  if (unit <= 0) {
    result.ok = false;
    result.code = "material_buyback_price_missing";
    result.summary = "この素材には正式な買取価格がない。";
    return true;
  }
  const gold = unit * requested;
  material.inventory[materialId] = owned - requested;
  material.sold[materialId] = Number(material.sold[materialId] ?? 0) + requested;
  player(runtime).gold = Number(player(runtime).gold ?? 0) + gold;
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "CANONICAL_MATERIAL_SALE",
    minute: Number(runtime.playerState.absoluteMinute ?? 0),
    actionId: actionValue.id,
    materialId,
    quantity: requested,
    unitPrice: unit,
    gold,
    facilityId,
  });
  result.summary = `${materialId}を${requested}個売り、${gold}Gを受け取った。`;
  result.materialSale = { materialId, quantity: requested, unitPrice: unit, gold, facilityId };
  return true;
}

function publicOnly(actions) {
  return Array.isArray(actions) && actions.length > 0
    && actions.every((entry) => entry?.canonicalWorldLifeChoice || entry?.canonicalRegionalLabourChoice || entry?.canonicalMaterialSaleChoice);
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const existing = base.authoredMissionFlowExclusiveActions(runtime, context);
  const sales = ownActions(runtime);
  if (!sales?.length) return existing;
  if (!existing?.length) return sales;
  if (!publicOnly(existing)) return existing;
  return [...existing, ...sales];
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  const existing = base.authoredMissionFlowGuidance(runtime, context);
  if (existing) return existing;
  const facilityId = activeBuyer(runtime);
  if (facilityId && ownActions(runtime)?.length) {
    return {
      kicker: "持ち帰った素材にも、この土地の値段がある",
      title: "正本の買取価格で素材を売る",
      detail: "戦闘データ正本の素材ID・買取Gを使い、所持数量だけを通常公開の窓口で売却する。",
      targetLocation: player(runtime).location ?? null,
      targetFacilityId: facilityId,
    };
  }
  return null;
}

export function applyAuthoredMissionFlowAction(runtime, actionValue, result) {
  processBattleDrops(runtime, result);
  if (consumeSale(runtime, actionValue, result)) return true;
  return base.applyAuthoredMissionFlowAction(runtime, actionValue, result);
}

export const CANONICAL_MATERIAL_ECONOMY_INTERNALS = Object.freeze({
  BUYER_FACILITIES,
  MATERIAL_BUYBACK_G,
  MONSTER_MATERIAL_DROPS,
  activeBuyer,
  ownActions,
  hashUnit,
  quantityFromSpec,
  processBattleDrops,
  consumeSale,
  publicOnly,
});
