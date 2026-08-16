import * as base from "./canonical-regional-labour.js";
import { consumeMeal, completePlayerRest, ensurePlayerNeeds } from "../../../../tools/trpg-sim/lib/player-needs.mjs";

export * from "./canonical-regional-labour.js";

export const CANONICAL_WORLD_LIFE_VERSION = "canonical-world-life-v1";

// Canonical TRPG/商品・価格表 subset used by ordinary daily life. These are
// public world products, not route rewards. The route may use them, but any
// player standing at the same facility under the same conditions may do so.
const PRODUCTS = Object.freeze({
  ITM001: ["田園の村", "LOC_FARM_INN", "宿泊", "素泊まり", 4, "lodging"],
  ITM002: ["田園の村", "LOC_FARM_INN", "宿泊", "個室", 9, "lodging"],
  ITM003: ["田園の村", "LOC_FARM_INN", "食事", "麦粥", 1, "meal"],
  ITM004: ["田園の村", "LOC_FARM_INN", "食事", "田舎パンと豆スープ", 3, "meal"],
  ITM005: ["田園の村", "LOC_FARM_INN", "食事", "村の夕食定食", 5, "meal"],
  ITM008: ["田園の村", "LOC_FARM_BAKERY", "食料", "黒パン", 1, "provision", 1],
  ITM010: ["田園の村", "LOC_FARM_BAKERY", "食料", "保存パン", 4, "provision", 3],
  ITM022: ["森", "LOC_FOREST_HUNTER_HUT", "宿泊", "野営地利用", 0, "camp"],
  ITM023: ["森", "LOC_FOREST_HUNTER_HUT", "食料", "干し肉", 5, "provision", 3],
  ITM030: ["王都", "LOC_CAP_LOWER_INN", "宿泊", "雑魚寝", 3, "lodging"],
  ITM031: ["王都", "LOC_CAP_LOWER_INN", "宿泊", "鍵付き個室", 12, "lodging"],
  ITM032: ["王都", "LOC_CAP_LOWER_INN", "食事", "下層定食", 6, "meal"],
  ITM036: ["王都", "LOC_CAP_MARKET", "食料", "パン", 2, "provision", 1],
  ITM038: ["王都", "LOC_CAP_MARKET", "食料", "肉串", 3, "provision", 1],
  ITM072: ["王都", "LOC_CAP_AJIN_QUARTER", "食料", "黒嶺干し肉", 5, "provision", 3],
  ITM076: ["交易都市", "LOC_TRADE_INN", "宿泊", "船員相部屋", 6, "lodging"],
  ITM077: ["交易都市", "LOC_TRADE_INN", "宿泊", "商人向け個室", 15, "lodging"],
  ITM078: ["交易都市", "LOC_TRADE_INN", "食事", "魚定食", 7, "meal"],
  ITM082: ["交易都市", "LOC_TRADE_FISH_MARKET", "食料", "干物", 4, "provision", 3],
  ITM109: ["犯罪都市", "LOC_CRIME_BACK_INN", "宿泊", "格安連れ込み宿", 2, "lodging"],
  ITM110: ["犯罪都市", "LOC_CRIME_BACK_INN", "宿泊", "鍵付き裏部屋", 8, "lodging"],
  ITM111: ["犯罪都市", "LOC_CRIME_BACK_INN", "宿泊", "裏口付き部屋", 15, "lodging"],
  ITM113: ["犯罪都市", "LOC_CRIME_BACK_INN", "食事", "黒灯亭の煮込み", 3, "meal"],
  ITM136: ["ドワーフ洞窟", "LOC_DWARF_INN", "宿泊", "石寝台", 8, "lodging"],
  ITM137: ["ドワーフ洞窟", "LOC_DWARF_INN", "食事", "坑夫定食", 6, "meal"],
  ITM140: ["ドワーフ洞窟", "LOC_DWARF_FORGE", "サービス", "武器修理", 15, "repair"],
  ITM159: ["北陵要塞", "LOC_FORT_INN", "宿泊", "軍用宿泊", 10, "lodging", 1, "fortEntryPermit"],
  ITM160: ["北陵要塞", "LOC_FORT_INN", "食事", "兵站食", 4, "meal", 1, "fortEntryPermit"],
  ITM161: ["北陵要塞", "LOC_FORT_INN", "食事", "温かいスープ", 2, "meal", 1, "fortEntryPermit"],
  ITM163: ["北陵要塞", "LOC_FORT_SUPPLY", "食料", "携行糧", 5, "provision", 3, "fortEntryPermit"],
  ITM175: ["北陵要塞", "LOC_FORT_CLINIC", "サービス", "応急処置", 5, "treatment", 1, "fortEntryPermit"],
  ITM176: ["辺境の村", "LOC_BORDER_INN", "宿泊", "巡礼相部屋", 3, "lodging"],
  ITM177: ["辺境の村", "LOC_BORDER_INN", "宿泊", "個室", 8, "lodging"],
  ITM178: ["辺境の村", "LOC_BORDER_INN", "食事", "巡礼膳", 4, "meal"],
  ITM179: ["辺境の村", "LOC_BORDER_INN", "食料", "神殿弁当", 3, "provision", 1],
  ITM192: ["古代神殿", "LOC_TEMPLE_GUIDE", "食料", "休憩所の保存食", 4, "provision", 1],
  ITM200: ["黒嶺連合領", "LOC_BLACKRIDGE_COMMON_INN", "宿泊", "共同宿の寝台", 6, "lodging"],
  ITM201: ["黒嶺連合領", "LOC_BLACKRIDGE_COMMON_INN", "宿泊", "亡命者相部屋", 3, "lodging"],
  ITM202: ["黒嶺連合領", "LOC_BLACKRIDGE_COMMON_INN", "食事", "異種族膳", 5, "meal"],
  ITM205: ["黒嶺連合領", "LOC_BLACKRIDGE_MARKET", "食料", "黒嶺干し肉", 4, "provision", 3],
  ITM219: ["黒嶺連合領", "LOC_BLACKRIDGE_FORGE", "サービス", "武具修理", 12, "repair"],
  ITM220: ["田園の村", "LOC_FARM_REPAIR", "サービス", "簡易研ぎ・軽修理", 3, "repair"],
  ITM222: ["交易都市", "LOC_TRADE_PORT", "宿泊", "港湾労働者簡易寝床", 2, "worker_lodging", 1, "sameDayPortWork"],
});

const REST_DURATIONS = Object.freeze([30, 60, 90, 120, 180, 240, 270, 300, 330, 360, 390]);

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function progress(runtime) {
  return runtime?.playerState?.progress ?? player(runtime)?.progress ?? {};
}

function day(runtime) {
  return Number(runtime?.playerState?.day ?? 1);
}

function economy(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.canonicalWorldLife ??= {
    provisions: {},
    purchases: {},
    meals: {},
    sleeps: {},
    services: {},
    lastPortWorkDay: 0,
  };
  return runtime.playerState.canonicalWorldLife;
}

function gold(runtime) {
  return Number(player(runtime)?.gold ?? 0);
}

function setGold(runtime, value) {
  player(runtime).gold = Math.max(0, Number(value) || 0);
}

function permit(runtime, condition) {
  if (!condition) return true;
  const p = progress(runtime);
  if (condition === "fortEntryPermit") return Boolean(p.fortEntryPermit ?? p.fort_entry_permit ?? false);
  if (condition === "sameDayPortWork") {
    const worked = Number(economy(runtime).lastPortWorkDay ?? 0) === day(runtime);
    const shifts = runtime?.playerState?.canonicalRegionalLabour?.shifts ?? {};
    const lastFacility = runtime?.playerState?.canonicalRegionalLabour?.lastDayByFacility ?? {};
    return worked || Number(lastFacility.LOC_TRADE_PORT ?? 0) === day(runtime)
      || Number(shifts["JOB-TRADE-01"] ?? 0) > 0 || Number(shifts["JOB-TRADE-02"] ?? 0) > 0;
  }
  return false;
}

function availableAt(runtime, tuple) {
  const [location, facilityId, , , price, , , condition] = tuple;
  const p = player(runtime);
  return String(p.location ?? "") === location
    && String(p.facilityId ?? "") === facilityId
    && permit(runtime, condition)
    && gold(runtime) >= Number(price ?? 0);
}

function actionBase(id, label, minutes, extra = {}) {
  return {
    id,
    actionId: id,
    family: "life",
    type: "plan",
    label,
    minutes,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    canonicalWorldLifeChoice: true,
    ...extra,
  };
}

function productActions(runtime) {
  const out = [];
  const p = player(runtime);
  const inv = economy(runtime).provisions;
  for (const [productId, tuple] of Object.entries(PRODUCTS)) {
    const [location, facilityId, category, label, price, kind, portions = 1] = tuple;
    if (String(p.location ?? "") === location && String(p.facilityId ?? "") === facilityId && permit(runtime, tuple[7])) {
      if (kind === "provision" && gold(runtime) >= Number(price)) {
        out.push(actionBase(`LIFE:BUY:${productId}`, `${label}を買う（${price}G）`, 10, {
          canonicalWorldLifeKind: "buy_provision", productId, price, portions,
        }));
      }
      if (kind === "meal" && gold(runtime) >= Number(price)) {
        out.push(actionBase(`LIFE:EAT:${productId}`, `${label}を食べる（${price}G）`, 30, {
          canonicalWorldLifeKind: "eat_meal", productId, price,
        }));
      }
      if (["lodging", "camp", "worker_lodging"].includes(kind) && availableAt(runtime, tuple)) {
        out.push(actionBase(`LIFE:SLEEP:${productId}`, `${label}で8時間休む（${price}G）`, 480, {
          canonicalWorldLifeKind: "sleep", productId, price, lodging: kind !== "camp",
        }));
      }
      if (["repair", "treatment"].includes(kind) && availableAt(runtime, tuple)) {
        out.push(actionBase(`SERVICE_BUY:${productId}`, `${label}を頼む（${price}G）`, 30, {
          canonicalWorldLifeKind: kind, productId, price,
        }));
      }
    }
    if (kind === "provision" && Number(inv[productId] ?? 0) > 0) {
      out.push(actionBase(`LIFE:EAT:${productId}`, `手持ちの${label}を食べる`, 30, {
        canonicalWorldLifeKind: "eat_provision", productId, price: 0,
      }));
    }
  }
  return out;
}

function restActions(runtime) {
  const p = player(runtime);
  const needs = ensurePlayerNeeds(p);
  if (Number(needs.fatigue ?? 0) < 1) return [];
  return REST_DURATIONS.map((minutes) => actionBase(`LIFE:REST:${minutes}`, `${minutes}分休息する`, minutes, {
    canonicalWorldLifeKind: "rest",
    durationMinutes: minutes,
  }));
}

function ownActions(runtime) {
  const actions = [...productActions(runtime), ...restActions(runtime)];
  return actions.length ? actions : null;
}

function spend(runtime, amount) {
  const price = Math.max(0, Number(amount) || 0);
  if (gold(runtime) < price) return false;
  setGold(runtime, gold(runtime) - price);
  return true;
}

function history(runtime, entry) {
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "CANONICAL_WORLD_LIFE",
    minute: Number(runtime.playerState.absoluteMinute ?? 0),
    ...entry,
  });
}

function consume(runtime, actionValue, result) {
  if (!actionValue?.canonicalWorldLifeChoice || result?.ok === false) return false;
  const kind = actionValue.canonicalWorldLifeKind;
  const productId = String(actionValue.productId ?? "");
  const state = economy(runtime);
  const p = player(runtime);

  if (kind === "buy_provision") {
    if (!spend(runtime, actionValue.price)) {
      result.ok = false;
      result.code = "not_enough_gold";
      result.summary = "所持金が足りない。";
      return true;
    }
    const portions = Math.max(1, Number(actionValue.portions ?? 1));
    state.provisions[productId] = Number(state.provisions[productId] ?? 0) + portions;
    state.purchases[productId] = Number(state.purchases[productId] ?? 0) + 1;
    result.summary = `${PRODUCTS[productId]?.[3] ?? productId}を買い、${portions}食分を荷物へ入れた。`;
    history(runtime, { actionId: actionValue.id, kind, productId, portions, goldDelta: -Number(actionValue.price ?? 0) });
    return true;
  }

  if (kind === "eat_provision") {
    if (Number(state.provisions[productId] ?? 0) <= 0) {
      result.ok = false;
      result.code = "provision_missing";
      result.summary = "その保存食はもう持っていない。";
      return true;
    }
    state.provisions[productId] -= 1;
    consumeMeal(p, { minute: runtime.playerState.absoluteMinute, nutrition: 58, quality: "standard" });
    state.meals[productId] = Number(state.meals[productId] ?? 0) + 1;
    result.summary = `手持ちの${PRODUCTS[productId]?.[3] ?? productId}を食べた。`;
    history(runtime, { actionId: actionValue.id, kind, productId, portions: -1 });
    return true;
  }

  if (kind === "eat_meal") {
    if (!spend(runtime, actionValue.price)) {
      result.ok = false;
      result.code = "not_enough_gold";
      result.summary = "所持金が足りない。";
      return true;
    }
    const hearty = Number(actionValue.price ?? 0) >= 5;
    consumeMeal(p, { minute: runtime.playerState.absoluteMinute, nutrition: hearty ? 66 : 58, quality: hearty ? "hearty" : "standard" });
    state.meals[productId] = Number(state.meals[productId] ?? 0) + 1;
    result.summary = `${PRODUCTS[productId]?.[3] ?? productId}を食べた。`;
    history(runtime, { actionId: actionValue.id, kind, productId, goldDelta: -Number(actionValue.price ?? 0) });
    return true;
  }

  if (kind === "sleep") {
    if (!spend(runtime, actionValue.price)) {
      result.ok = false;
      result.code = "not_enough_gold";
      result.summary = "宿代が足りない。";
      return true;
    }
    completePlayerRest(p, {
      minute: runtime.playerState.absoluteMinute,
      durationMinutes: Number(actionValue.minutes ?? 480),
      lodging: Boolean(actionValue.lodging),
      safety: actionValue.lodging ? "normal" : "poor",
    });
    state.sleeps[productId] = Number(state.sleeps[productId] ?? 0) + 1;
    result.summary = `${PRODUCTS[productId]?.[3] ?? productId}で休んだ。`;
    history(runtime, { actionId: actionValue.id, kind, productId, goldDelta: -Number(actionValue.price ?? 0) });
    return true;
  }

  if (kind === "rest") {
    completePlayerRest(p, {
      minute: runtime.playerState.absoluteMinute,
      durationMinutes: Number(actionValue.durationMinutes ?? actionValue.minutes ?? 120),
      lodging: false,
      safety: "normal",
    });
    result.summary = `${actionValue.durationMinutes ?? actionValue.minutes}分、食事や装備の手入れをしながら休息した。`;
    history(runtime, { actionId: actionValue.id, kind, durationMinutes: Number(actionValue.durationMinutes ?? actionValue.minutes ?? 0) });
    return true;
  }

  if (kind === "repair" || kind === "treatment") {
    if (!spend(runtime, actionValue.price)) {
      result.ok = false;
      result.code = "not_enough_gold";
      result.summary = "代金が足りない。";
      return true;
    }
    state.services[productId] = Number(state.services[productId] ?? 0) + 1;
    if (kind === "repair") {
      runtime.playerState.progress ??= {};
      runtime.playerState.progress.equipmentMaintenanceCount = Number(runtime.playerState.progress.equipmentMaintenanceCount ?? 0) + 1;
      runtime.playerState.progress.lastEquipmentMaintenanceProductId = productId;
    }
    result.summary = `${PRODUCTS[productId]?.[3] ?? productId}を利用した。`;
    history(runtime, { actionId: actionValue.id, kind, productId, goldDelta: -Number(actionValue.price ?? 0) });
    return true;
  }

  return false;
}

function meaningfulBase(actions) {
  return Array.isArray(actions) && actions.length > 0;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (meaningfulBase(authored)) return authored;
  return ownActions(runtime);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  const authored = base.authoredMissionFlowGuidance(runtime, context);
  if (authored) return authored;
  if (ownActions(runtime)?.length) {
    return {
      kicker: "食べる・休む・泊まる・買うことも、この世界で生きる行動だ",
      title: "その土地の生活を選ぶ",
      detail: "商品・価格表の正式な食事、保存食、宿泊、修理を通常の公開行動として利用できる。",
      targetLocation: player(runtime).location ?? null,
      targetFacilityId: player(runtime).facilityId ?? null,
    };
  }
  return null;
}

export function applyAuthoredMissionFlowAction(runtime, actionValue, result) {
  if (consume(runtime, actionValue, result)) return true;
  const handled = base.applyAuthoredMissionFlowAction(runtime, actionValue, result);
  if (handled && actionValue?.canonicalRegionalLabourChoice) {
    const jobId = String(actionValue.canonicalRegionalJobId ?? "");
    if (jobId === "JOB-TRADE-01" || jobId === "JOB-TRADE-02") {
      economy(runtime).lastPortWorkDay = day(runtime);
    }
  }
  return handled;
}

export const CANONICAL_WORLD_LIFE_INTERNALS = Object.freeze({ PRODUCTS, REST_DURATIONS, productActions, restActions, ownActions, permit });
