import { readFileSync } from "node:fs";

export const DEFAULT_WORLD_SNAPSHOT_URL = new URL("../fixtures/world.snapshot.json", import.meta.url);

export const TIME_SLOTS = Object.freeze([
  Object.freeze({ index: 0, id: "morning", label: "朝", hour: 10, offsetHours: 0 }),
  Object.freeze({ index: 1, id: "afternoon", label: "昼", hour: 14, offsetHours: 4 }),
  Object.freeze({ index: 2, id: "evening", label: "夕", hour: 18, offsetHours: 8 }),
  Object.freeze({ index: 3, id: "night", label: "夜", hour: 22, offsetHours: 12 }),
]);

export const TERMINAL_TROUBLE_STATES = Object.freeze(["failed", "resolved", "suppressed"]);
export const TROUBLE_STATES = Object.freeze([
  "scheduled",
  "active",
  "critical",
  ...TERMINAL_TROUBLE_STATES,
]);

export const SAFE_ASSUMPTIONS = Object.freeze({
  day1Start: "Day1 10:00 を絶対時刻0とし、朝/昼/夕/夜の4スロットで進める。",
  locationAliases: "魔王領は王国側呼称、黒嶺連合領は自称として同一拠点に正規化する。",
  npcFacilityLocations: "NPCの施設・区画レベルの初期位置は、居住拠点のハブ位置へ安全に丸める。",
  sameDayOrder: "時刻が明記されない同日イベントは、原シートの行順を決定的な順序として使う。",
  timelineDates: "シリアル日付は表示情報とし、ゲーム進行は明記されたDay値を正とする。",
  routeDirection: "距離一覧の『基本は双方向』を採用し、全15ルートを双方向辺として扱う。",
  conditionalTravel: "迷いの森と黒嶺入国は、出身・承認・世界樹倒壊フラグで通行可否を判定する。",
});

const CANONICAL_HUBS = Object.freeze([
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
  "黒嶺連合領",
]);

const FACILITY_HUB_TABS = Object.freeze([
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
]);

const FACILITY_REFERENCE_FALLBACKS = Object.freeze({
  "NPC003:LOC_FARM_BOARD": "LOC_FARM_SQUARE",
  "NPC015:LOC_TRADE_DOCK": "LOC_TRADE_PORT",
});

const FATE_OUTCOME_KEYWORDS = Object.freeze([
  "死亡",
  "戦死",
  "行方不明",
  "消息不明",
  "消息不安定",
  "未救出",
  "負傷",
  "衰弱",
  "病状悪化",
  "体調悪化",
  "逃亡",
  "避難",
  "退去",
  "追放",
  "失職",
  "信用失墜",
  "閉鎖",
  "停止",
  "消滅",
  "精霊化",
  "力を失う",
  "治療力喪失",
  "口封じ",
]);

const IMPORTANCE_WEIGHT = Object.freeze({ S: 1.6, A: 1.25, B: 0.85, C: 0.5 });

const SUPPORTIVE_GOAL = /阻止|救|守|見つけ|特定|維持|止め|改善|生き延び|真相|平和|安全|保護|避難|警告|治療|和解|調べ|突き止め|届ける|見極め|避ける|鎮める|明らか/u;
const HARMFUL_GOAL = /証拠を消|掌握|上陸|成功させる|先制制圧|武器.*流|暗殺|追い出|放火|軍事衝突|毒殺|密輸|侵攻|偽装襲撃|収穫権を取得|吸収|進軍|捕ら|売る|封印を解|破壊|退去させ|商品化|魔力源へ向かう|危険な.*続ける/u;

function diagnostic(code, severity, message, details = {}) {
  return { code, severity, message, details };
}

function readSnapshot(input) {
  if (input && typeof input === "object" && !(input instanceof URL)) {
    if (input.tabs) return input;
  }
  const source = input ?? DEFAULT_WORLD_SNAPSHOT_URL;
  return JSON.parse(readFileSync(source, "utf8"));
}

function asText(value) {
  return value == null ? "" : String(value).trim();
}

function extractTroubleIds(value) {
  return [...new Set((asText(value).match(/T\d{2}/gu) ?? []))];
}

function extractFacilityIds(value) {
  return [...new Set((asText(value).match(/LOC_[A-Z0-9_]+/gu) ?? []))];
}

function splitTags(value) {
  return asText(value).split(/[,、，]/u).map(asText).filter(Boolean);
}

function parseDay(value, label) {
  const match = asText(value).match(/Day\s*(\d+)/iu);
  if (!match) throw new Error(`Dayを解析できません (${label}): ${asText(value)}`);
  return Number(match[1]);
}

function phaseFromText(value, fallbackIndex) {
  const text = asText(value);
  if (/夜|深夜|24:00/u.test(text)) return 3;
  if (/夕/u.test(text)) return 2;
  if (/昼|午後/u.test(text)) return 1;
  if (/朝|午前|10:00/u.test(text)) return 0;
  return fallbackIndex;
}

function timelinePhase(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0.999) return { phaseIndex: 3, assumed: false };
    const hour = value * 24;
    const phase = TIME_SLOTS.reduce((best, slot) =>
      Math.abs(slot.hour - hour) < Math.abs(TIME_SLOTS[best].hour - hour) ? slot.index : best,
    0);
    return { phaseIndex: phase, assumed: false };
  }
  const text = asText(value);
  if (/夜|深夜/u.test(text)) return { phaseIndex: 3, assumed: false };
  if (/夕/u.test(text)) return { phaseIndex: 2, assumed: false };
  if (/朝|午前/u.test(text)) return { phaseIndex: 0, assumed: false };
  if (/昼|午後/u.test(text)) return { phaseIndex: 1, assumed: false };
  return { phaseIndex: 1, assumed: true };
}

export function canonicalizeLocation(value) {
  const text = asText(value);
  if (!text) return "";
  if (/魔王領|黒嶺/u.test(text)) return "黒嶺連合領";
  if (/外国船|海上|交易都市港|港湾区|潮風宿|魚市場|税関|倉庫街|港薬草|荷馬車組合|船大工/u.test(text)) return "交易都市";
  if (/王都|王城|白鈴孤児院|下層の安宿|中央市場|瓦版屋|駅馬車/u.test(text)) return "王都";
  if (/田園の村|麦穂亭|村のパン屋|村の広場|村馬小屋|穀倉|畑|見張り小屋/u.test(text)) return "田園の村";
  if (/北陵/u.test(text)) return "北陵要塞";
  if (/ドワーフ|鉄樽亭|採掘坑道|鉱石市場|技師区画/u.test(text)) return "ドワーフ洞窟";
  if (/交易都市/u.test(text)) return "交易都市";
  if (/犯罪都市|黒灯亭|闇港|密輸倉庫|人買い市場|裏厩舎/u.test(text)) return "犯罪都市";
  if (/辺境の村|参道口|巡礼馬屋|小祠/u.test(text)) return "辺境の村";
  if (/古代神殿|神殿/u.test(text)) return "古代神殿";
  if (/エルフの隠れ里|若枝の住居|結界石|精霊薬草園|弓兵の木立|世界樹周辺/u.test(text)) return "エルフの隠れ里";
  if (/森|狩人小屋|大河中流/u.test(text)) return "森";
  return text;
}

function normalizeNpcLocation(initialLocation, home) {
  const canonicalInitial = canonicalizeLocation(initialLocation);
  const canonicalHome = canonicalizeLocation(home);
  if (CANONICAL_HUBS.includes(canonicalInitial)) return canonicalInitial;
  return CANONICAL_HUBS.includes(canonicalHome) ? canonicalHome : canonicalInitial;
}

function behaviorType(value) {
  const text = asText(value);
  if (text === "生活リズム型") return "routine";
  if (text === "自律GOAP型") return "autonomous-goap";
  if (text === "イベントGOAP型" || text === "イベント駆動型") return "event-goap";
  return "routine";
}

function parseRoutine(value) {
  const result = { morning: "", afternoon: "", evening: "", night: "" };
  for (const part of asText(value).split("/")) {
    const [rawKey, ...rest] = part.split(":");
    const key = asText(rawKey);
    const activity = rest.join(":").trim();
    if (/朝|常時/u.test(key) && !result.morning) result.morning = activity;
    if (/昼/u.test(key)) result.afternoon = activity;
    if (/夕/u.test(key)) result.evening = activity;
    if (/夜/u.test(key)) result.night = activity;
  }
  const fallback = result.morning || result.afternoon || result.evening || result.night || asText(value);
  for (const key of Object.keys(result)) if (!result[key]) result[key] = fallback;
  return result;
}

function inferDisposition(goal, occupation, fate) {
  const goalText = asText(goal);
  if (SUPPORTIVE_GOAL.test(goalText)) return "mitigate";
  if (HARMFUL_GOAL.test(goalText)) return "escalate";
  const roleText = `${asText(occupation)} ${asText(fate)}`;
  if (/暗殺者|人身売買|武器商人|古代兵器|巨大魔物|強硬派|放火犯/u.test(roleText)) return "escalate";
  if (/医師|阻止派|巫女|穏健派|救助|調査役/u.test(roleText)) return "mitigate";
  return "neutral";
}

function parseRoutes(rows) {
  const routes = [];
  const headerIndex = rows.findIndex((row) => asText(row?.[0]) === "ID" && asText(row?.[1]) === "出発地");
  if (headerIndex < 0) throw new Error("距離一覧の直通ルート表ヘッダーが見つかりません");
  for (const row of rows.slice(headerIndex + 1)) {
    const id = asText(row?.[0]);
    if (!/^R\d{2}$/u.test(id)) break;
    const from = canonicalizeLocation(row[1]);
    const to = canonicalizeLocation(row[2]);
    const hours = Number(row[3]);
    if (!from || !to || !Number.isFinite(hours) || hours <= 0) {
      throw new Error(`不正なルート ${id}`);
    }
    let gate = null;
    if ([from, to].includes("エルフの隠れ里")) gate = "elf-access";
    if ([from, to].includes("森") && [from, to].includes("黒嶺連合領")) gate = "blackridge-forest-access";
    routes.push({
      id,
      from,
      to,
      hours,
      display: asText(row[4]),
      mode: asText(row[5]),
      nature: asText(row[6]),
      notes: asText(row[7]),
      bidirectional: /双方向/u.test(asText(row[8])),
      gate,
    });
  }
  return routes;
}

function parseTroubles(rows) {
  const headerIndex = rows.findIndex((row) => asText(row?.[0]) === "ID" && asText(row?.[1]) === "トラブル名");
  if (headerIndex < 0) throw new Error("トラブル一覧ヘッダーが見つかりません");
  return rows.slice(headerIndex + 1)
    .filter((row) => /^T\d{2}$/u.test(asText(row?.[0])))
    .map((row, index) => {
      const id = asText(row[0]);
      const startDay = parseDay(row[4], `${id} start`);
      const deadlineDay = parseDay(row[5], `${id} deadline`);
      const finalDay = parseDay(row[6], `${id} final`);
      return {
        id,
        sourceOrder: index,
        name: asText(row[1]),
        primaryLocations: asText(row[2]).split(/\s*\/\s*/u).map(canonicalizeLocation),
        category: asText(row[3]),
        startDay,
        startPhase: phaseFromText(row[4], 0),
        deadlineDay,
        deadlinePhase: phaseFromText(row[5], 3),
        finalDay,
        finalPhase: phaseFromText(row[6], 3),
        trueCause: asText(row[7]),
        resolutionMethods: asText(row[8]),
        successEffects: asText(row[9]),
        failureEffects: asText(row[10]),
        relationText: asText(row[11]),
        sourceStatus: asText(row[12]),
      };
    });
}

function parseTimeline(rows) {
  const headerIndex = rows.findIndex((row) => asText(row?.[0]) === "Day" && asText(row?.[3]) === "関連T");
  if (headerIndex < 0) throw new Error("トラブルタイムラインヘッダーが見つかりません");
  return rows.slice(headerIndex + 1)
    .filter((row) => Number.isFinite(Number(row?.[0])))
    .map((row, index) => {
      const parsedPhase = timelinePhase(row[2]);
      return {
        id: `TL${String(index + 1).padStart(3, "0")}`,
        sourceOrder: index,
        day: Number(row[0]),
        dateSerial: Number(row[1]),
        phaseIndex: parsedPhase.phaseIndex,
        phaseAssumed: parsedPhase.assumed,
        stage: asText(row[2]),
        troubleIds: extractTroubleIds(row[3]),
        event: asText(row[4]),
        worldChange: asText(row[5]),
        conditionText: asText(row[6]),
      };
    });
}

function parseChains(rows) {
  const headerIndex = rows.findIndex((row) => asText(row?.[0]) === "連鎖ID");
  if (headerIndex < 0) throw new Error("トラブル連鎖ヘッダーが見つかりません");
  return rows.slice(headerIndex + 1)
    .filter((row) => /^C\d{2}$/u.test(asText(row?.[0])))
    .map((row, index) => {
      const triggerText = asText(row[1]);
      const triggerId = extractTroubleIds(triggerText)[0] ?? null;
      const triggerState = /失敗/u.test(triggerText)
        ? "failed"
        : /成功/u.test(triggerText)
          ? "resolved"
          : "active";
      return {
        id: asText(row[0]),
        sourceOrder: index,
        trigger: { troubleId: triggerId, state: triggerState, text: triggerText },
        nextChange: asText(row[2]),
        affectedTroubleIds: extractTroubleIds(`${asText(row[2])} ${asText(row[3])}`).filter((id) => id !== triggerId),
        impactText: asText(row[3]),
        worldChange: asText(row[4]),
        mitigation: asText(row[5]),
      };
    });
}

function parseFacilities(snapshot) {
  const facilities = [];
  for (const sourceHub of FACILITY_HUB_TABS) {
    const rows = snapshot.tabs[sourceHub];
    if (!Array.isArray(rows)) throw new Error(`施設タブがありません: ${sourceHub}`);
    const headerIndex = rows.findIndex((row) => asText(row?.[0]) === "施設ID");
    if (headerIndex < 0) throw new Error(`施設ヘッダーが見つかりません: ${sourceHub}`);
    const hub = canonicalizeLocation(sourceHub);
    for (const [rowOffset, row] of rows.slice(headerIndex + 1).entries()) {
      const id = asText(row?.[0]);
      if (!/^LOC_[A-Z0-9_]+$/u.test(id)) continue;
      facilities.push({
        id,
        sourceOrder: facilities.length,
        sourceRow: headerIndex + rowOffset + 2,
        sourceHub,
        hub,
        name: asText(row[1]),
        type: asText(row[2]),
        function: asText(row[3]),
        relatedNpcText: asText(row[4]),
        relatedNpcIds: [],
        productPriceText: asText(row[5]),
        relatedTroubleText: asText(row[6]),
        relatedTroubleIds: extractTroubleIds(row[6]),
        notes: asText(row[7]),
      });
    }
  }
  return facilities;
}

function resolveFacilityNpcIds(facilities, npcs) {
  const namedNpcs = npcs.filter((npc) => npc.name.length >= 2);
  return facilities.map((facility) => ({
    ...facility,
    relatedNpcIds: namedNpcs
      .filter((npc) => facility.relatedNpcText.includes(npc.name))
      .map((npc) => npc.id),
  }));
}

function resolveRelatedFacilityIds(npcId, rawIds, facilityById) {
  const resolved = [];
  const fallbacks = [];
  const unknown = [];
  for (const sourceId of rawIds) {
    if (facilityById[sourceId]) {
      resolved.push(sourceId);
      continue;
    }
    const fallbackId = FACILITY_REFERENCE_FALLBACKS[`${npcId}:${sourceId}`];
    if (fallbackId && facilityById[fallbackId]) {
      resolved.push(fallbackId);
      fallbacks.push({ field: "relatedFacilities", sourceId, fallbackId });
    } else {
      unknown.push(sourceId);
    }
  }
  return {
    ids: [...new Set(resolved)],
    fallbacks,
    unknown,
  };
}

function chooseMainFacilityId(sourceMainFacilityId, home, initialLocation, relatedFacilityIds, facilityById, facilitiesByHub) {
  if (facilityById[sourceMainFacilityId]) return sourceMainFacilityId;
  const relatedAtHome = relatedFacilityIds.find((id) => facilityById[id]?.hub === home);
  if (relatedAtHome) return relatedAtHome;
  const relatedAtInitial = relatedFacilityIds.find((id) => facilityById[id]?.hub === initialLocation);
  if (relatedAtInitial) return relatedAtInitial;
  if (relatedFacilityIds[0]) return relatedFacilityIds[0];
  return facilitiesByHub[home]?.[0]?.id ?? facilitiesByHub[initialLocation]?.[0]?.id ?? null;
}

function chooseInitialFacility(sourceInitialLocation, initialLocation, mainFacilityId, relatedFacilityIds, facilities, facilityById, facilitiesByHub) {
  const exactSourceMatch = facilities.find((facility) => facility.name === sourceInitialLocation);
  if (exactSourceMatch) return exactSourceMatch.id;
  if (facilityById[mainFacilityId]?.hub === initialLocation) return mainFacilityId;
  const relatedAtInitial = relatedFacilityIds.find((id) => facilityById[id]?.hub === initialLocation);
  if (relatedAtInitial) return relatedAtInitial;
  if (facilityById[mainFacilityId]) return mainFacilityId;
  return facilitiesByHub[initialLocation]?.[0]?.id ?? null;
}

function parseInitialKnowledge(knowledgeTags, secretText) {
  const [factsText = "", interestsText = ""] = asText(knowledgeTags).split(/\//u, 2);
  const [misconceptionText = "", ...secretParts] = asText(secretText).split(/\//u);
  return {
    facts: [...new Set(splitTags(factsText))],
    interests: [...new Set(splitTags(interestsText))],
    misconceptions: misconceptionText ? [misconceptionText] : [],
    secrets: secretParts.length ? [secretParts.join("/").trim()].filter(Boolean) : [],
  };
}

function parseFateHints(value) {
  const sourceText = asText(value);
  return {
    sourceText,
    dayAnchors: [...new Set([...sourceText.matchAll(/Day\s*(\d+)/giu)].map((match) => Number(match[1])))],
    troubleIds: extractTroubleIds(sourceText),
    outcomeKeywords: FATE_OUTCOME_KEYWORDS.filter((keyword) => sourceText.includes(keyword)),
  };
}

function parseAllowedHubs(allowedRange, home, initialLocation, facilityIds, facilityById) {
  const mentioned = new Set([home, initialLocation]);
  const text = asText(allowedRange);
  for (const sourceHub of FACILITY_HUB_TABS) {
    if (text.includes(sourceHub)) mentioned.add(canonicalizeLocation(sourceHub));
  }
  for (const hub of CANONICAL_HUBS) if (text.includes(hub)) mentioned.add(hub);
  for (const id of facilityIds) if (facilityById[id]) mentioned.add(facilityById[id].hub);
  return CANONICAL_HUBS.filter((hub) => mentioned.has(hub));
}

function parseNpcs(rows, { facilities, facilityById, facilitiesByHub }) {
  const headerIndex = rows.findIndex((row) => asText(row?.[0]) === "NPC ID");
  if (headerIndex < 0) throw new Error("NPC一覧ヘッダーが見つかりません");
  return rows.slice(headerIndex + 1)
    .filter((row) => /^NPC\d{3}$/u.test(asText(row?.[0])))
    .map((row, index) => {
      const id = asText(row[0]);
      const home = canonicalizeLocation(row[8]);
      const sourceInitialLocation = asText(row[9]);
      const normalizedInitialLocation = normalizeNpcLocation(sourceInitialLocation, home);
      const sourceMainFacilityId = asText(row[21]);
      const sourceRelatedFacilityIds = extractFacilityIds(row[22]);
      const resolvedRelated = resolveRelatedFacilityIds(id, sourceRelatedFacilityIds, facilityById);
      const mainFacilityId = chooseMainFacilityId(
        sourceMainFacilityId,
        home,
        normalizedInitialLocation,
        resolvedRelated.ids,
        facilityById,
        facilitiesByHub,
      );
      const initialFacilityId = chooseInitialFacility(
        sourceInitialLocation,
        normalizedInitialLocation,
        mainFacilityId,
        resolvedRelated.ids,
        facilities,
        facilityById,
        facilitiesByHub,
      );
      const initialLocation = facilityById[initialFacilityId]?.hub ?? normalizedInitialLocation;
      const primaryGoal = asText(row[14]);
      const knowledgeTags = asText(row[16]);
      const secrets = asText(row[17]);
      const nonInterventionFate = asText(row[18]);
      return {
        id,
        sourceOrder: index,
        name: asText(row[1]),
        importance: asText(row[2]),
        importanceWeight: IMPORTANCE_WEIGHT[asText(row[2])] ?? 0.5,
        behaviorType: behaviorType(row[3]),
        sourceBehaviorType: asText(row[3]),
        species: asText(row[4]),
        age: row[5],
        gender: asText(row[7]),
        home,
        sourceInitialLocation,
        initialLocation,
        initialFacilityId,
        allowedRange: asText(row[10]),
        occupation: asText(row[11]),
        relatedTroubleIds: extractTroubleIds(row[12]),
        mbti: asText(row[13]),
        primaryGoal,
        routine: parseRoutine(row[15]),
        knowledgeTags,
        secrets,
        initialKnowledge: parseInitialKnowledge(knowledgeTags, secrets),
        nonInterventionFate,
        fateHints: parseFateHints(nonInterventionFate),
        initialStatus: asText(row[19]) || "通常",
        speechStyle: asText(row[20]),
        sourceMainFacilityId,
        mainFacilityId,
        relatedFacilities: asText(row[22]),
        sourceRelatedFacilityIds,
        relatedFacilityIds: resolvedRelated.ids,
        facilityReferenceFallbacks: resolvedRelated.fallbacks,
        unknownFacilityIds: resolvedRelated.unknown,
        allowedHubs: parseAllowedHubs(
          row[10],
          home,
          initialLocation,
          [mainFacilityId, initialFacilityId, ...resolvedRelated.ids].filter(Boolean),
          facilityById,
        ),
        disposition: inferDisposition(primaryGoal, row[11], row[18]),
      };
    });
}

function buildAdjacency(routes) {
  const adjacency = {};
  for (const route of routes) {
    adjacency[route.from] ??= [];
    adjacency[route.to] ??= [];
    adjacency[route.from].push({ routeId: route.id, from: route.from, to: route.to, hours: route.hours });
    if (route.bidirectional) {
      adjacency[route.to].push({ routeId: route.id, from: route.to, to: route.from, hours: route.hours });
    }
  }
  for (const edges of Object.values(adjacency)) {
    edges.sort((a, b) => a.hours - b.hours || a.routeId.localeCompare(b.routeId, "en") || a.to.localeCompare(b.to, "ja"));
  }
  return adjacency;
}

function groupFacilitiesByHub(facilities) {
  return Object.fromEntries(CANONICAL_HUBS.map((hub) => [
    hub,
    facilities.filter((facility) => facility.hub === hub),
  ]));
}

function structuralDiagnostics({ routes, troubles, timeline, chains, facilities, npcs }) {
  const result = [
    diagnostic("ASSUMPTION_DAY1_START", "info", SAFE_ASSUMPTIONS.day1Start),
    diagnostic("ALIAS_NORMALIZED", "warning", SAFE_ASSUMPTIONS.locationAliases, {
      aliases: ["魔王領", "黒嶺連合領"], canonical: "黒嶺連合領",
    }),
    diagnostic("NPC_SUBLOCATION_NORMALIZED", "info", SAFE_ASSUMPTIONS.npcFacilityLocations, {
      normalizedCount: npcs.filter((npc) => canonicalizeLocation(npc.sourceInitialLocation) !== npc.initialLocation).length,
    }),
    diagnostic("SAME_DAY_SOURCE_ORDER", "info", SAFE_ASSUMPTIONS.sameDayOrder, {
      assumedTimelineRows: timeline.filter((entry) => entry.phaseAssumed).length,
    }),
    diagnostic("TIMELINE_DATE_SERIAL_IGNORED", "info", SAFE_ASSUMPTIONS.timelineDates),
    diagnostic("CONDITIONAL_DISTANCE", "warning", "R14の0.17時間は承認等がある場合のみ。表示『10分〜∞』を条件ゲートとして扱う。", {
      routeId: "R14",
    }),
    diagnostic("EVENT_DRIVEN_TYPE_ALIAS", "info", "イベント駆動型をイベントGOAP型と同じ実行系へ正規化する。", {
      count: npcs.filter((npc) => npc.sourceBehaviorType === "イベント駆動型").length,
    }),
  ];

  for (const npc of npcs) {
    for (const fallback of npc.facilityReferenceFallbacks) {
      result.push(diagnostic(
        "NPC_FACILITY_REFERENCE_FALLBACK",
        "warning",
        `${npc.id} の施設参照 ${fallback.sourceId} を ${fallback.fallbackId} に正規化する。`,
        { npcId: npc.id, ...fallback },
      ));
    }
  }

  const expected = { routes: 15, troubles: 19, timeline: 55, chains: 23, facilities: 103, npcs: 110 };
  const actual = {
    routes: routes.length,
    troubles: troubles.length,
    timeline: timeline.length,
    chains: chains.length,
    facilities: facilities.length,
    npcs: npcs.length,
  };
  for (const [key, count] of Object.entries(expected)) {
    if (actual[key] !== count) {
      result.push(diagnostic("STRUCTURAL_COUNT_MISMATCH", "error", `${key} は ${count} 件必要だが ${actual[key]} 件`, {
        entity: key, expected: count, actual: actual[key],
      }));
    }
  }

  const troubleIds = new Set(troubles.map((trouble) => trouble.id));
  const unknownReferences = [];
  for (const entry of timeline) for (const id of entry.troubleIds) if (!troubleIds.has(id)) unknownReferences.push({ source: entry.id, id });
  for (const chain of chains) {
    if (!chain.trigger.troubleId || !troubleIds.has(chain.trigger.troubleId)) unknownReferences.push({ source: chain.id, id: chain.trigger.troubleId });
    for (const id of chain.affectedTroubleIds) if (!troubleIds.has(id)) unknownReferences.push({ source: chain.id, id });
  }
  for (const npc of npcs) for (const id of npc.relatedTroubleIds) if (!troubleIds.has(id)) unknownReferences.push({ source: npc.id, id });
  for (const facility of facilities) {
    for (const id of facility.relatedTroubleIds) if (!troubleIds.has(id)) unknownReferences.push({ source: facility.id, id });
  }
  if (unknownReferences.length) {
    result.push(diagnostic("UNKNOWN_TROUBLE_REFERENCE", "error", "未知のトラブル参照がある。", { unknownReferences }));
  }

  const unknownFacilityReferences = npcs.flatMap((npc) =>
    npc.unknownFacilityIds.map((id) => ({ source: npc.id, id }))
  );
  if (unknownFacilityReferences.length) {
    result.push(diagnostic("UNKNOWN_FACILITY_REFERENCE", "error", "未知の施設参照がある。", { unknownFacilityReferences }));
  }

  const duplicateFacilityIds = [...new Set(facilities
    .filter((facility, index) => facilities.findIndex((candidate) => candidate.id === facility.id) !== index)
    .map((facility) => facility.id))];
  if (duplicateFacilityIds.length) {
    result.push(diagnostic("DUPLICATE_FACILITY_ID", "error", "施設IDが重複している。", { duplicateFacilityIds }));
  }

  return result;
}

export function buildWorldModel(snapshot) {
  if (!snapshot?.tabs || typeof snapshot.tabs !== "object") throw new TypeError("world snapshotにtabsがありません");
  const requiredTabs = ["距離一覧", "トラブル一覧", "トラブルタイムライン", "トラブル連鎖", "NPC一覧"];
  for (const tab of requiredTabs) {
    if (!Array.isArray(snapshot.tabs[tab])) throw new Error(`必須タブがありません: ${tab}`);
  }

  const routes = parseRoutes(snapshot.tabs["距離一覧"]);
  const troubles = parseTroubles(snapshot.tabs["トラブル一覧"]);
  const timeline = parseTimeline(snapshot.tabs["トラブルタイムライン"]);
  const chains = parseChains(snapshot.tabs["トラブル連鎖"]);
  const parsedFacilities = parseFacilities(snapshot);
  const parsedFacilityById = Object.fromEntries(parsedFacilities.map((facility) => [facility.id, facility]));
  const parsedFacilitiesByHub = groupFacilitiesByHub(parsedFacilities);
  const npcs = parseNpcs(snapshot.tabs["NPC一覧"], {
    facilities: parsedFacilities,
    facilityById: parsedFacilityById,
    facilitiesByHub: parsedFacilitiesByHub,
  });
  const facilities = resolveFacilityNpcIds(parsedFacilities, npcs);
  const facilityById = Object.fromEntries(facilities.map((facility) => [facility.id, facility]));
  const facilitiesByHub = groupFacilitiesByHub(facilities);
  const locations = [...new Set(routes.flatMap((route) => [route.from, route.to]))];
  const diagnostics = structuralDiagnostics({ routes, troubles, timeline, chains, facilities, npcs });

  const model = {
    schemaVersion: "1.0.0",
    snapshotSchemaVersion: snapshot.schemaVersion,
    source: snapshot.source,
    assumptions: SAFE_ASSUMPTIONS,
    timeSlots: TIME_SLOTS,
    locations,
    routes,
    routeById: Object.fromEntries(routes.map((route) => [route.id, route])),
    adjacency: buildAdjacency(routes),
    troubles,
    troubleById: Object.fromEntries(troubles.map((trouble) => [trouble.id, trouble])),
    timeline,
    chains,
    facilities,
    facilityById,
    facilitiesByHub,
    npcs,
    npcById: Object.fromEntries(npcs.map((npc) => [npc.id, npc])),
    diagnostics,
  };
  assertWorldModel(model);
  return model;
}

export function loadWorldModel(input = DEFAULT_WORLD_SNAPSHOT_URL) {
  return buildWorldModel(readSnapshot(input));
}

export function assertWorldModel(model) {
  const errors = model.diagnostics.filter((entry) => entry.severity === "error");
  if (errors.length) {
    throw new Error(`world model validation failed: ${errors.map((entry) => entry.message).join("; ")}`);
  }
  const known = new Set(model.locations);
  for (const route of model.routes) {
    if (!known.has(route.from) || !known.has(route.to)) throw new Error(`未知拠点を含むルート: ${route.id}`);
  }
  for (const npc of model.npcs) {
    if (!known.has(npc.initialLocation)) throw new Error(`NPC ${npc.id} の初期位置が未知: ${npc.initialLocation}`);
    const initialFacility = model.facilityById[npc.initialFacilityId];
    if (!initialFacility) throw new Error(`NPC ${npc.id} の初期施設が未知: ${npc.initialFacilityId}`);
    if (initialFacility.hub !== npc.initialLocation) {
      throw new Error(`NPC ${npc.id} の初期施設と拠点が不一致: ${npc.initialFacilityId}/${npc.initialLocation}`);
    }
    if (!model.facilityById[npc.mainFacilityId]) throw new Error(`NPC ${npc.id} の主施設が未知: ${npc.mainFacilityId}`);
    for (const id of npc.relatedFacilityIds) {
      if (!model.facilityById[id]) throw new Error(`NPC ${npc.id} の関連施設が未知: ${id}`);
    }
    for (const hub of npc.allowedHubs) if (!known.has(hub)) throw new Error(`NPC ${npc.id} の許可拠点が未知: ${hub}`);
  }
  const npcIds = new Set(model.npcs.map((npc) => npc.id));
  for (const facility of model.facilities) {
    if (!known.has(facility.hub)) throw new Error(`施設 ${facility.id} の所属拠点が未知: ${facility.hub}`);
    for (const id of facility.relatedNpcIds) if (!npcIds.has(id)) throw new Error(`施設 ${facility.id} の関連NPCが未知: ${id}`);
    for (const id of facility.relatedTroubleIds) {
      if (!model.troubleById[id]) throw new Error(`施設 ${facility.id} の関連トラブルが未知: ${id}`);
    }
  }
  for (const trouble of model.troubles) {
    if (trouble.deadlineDay < trouble.startDay || trouble.finalDay < trouble.deadlineDay) {
      throw new Error(`${trouble.id} の日程順が不正`);
    }
    for (const location of trouble.primaryLocations) {
      if (!known.has(location)) throw new Error(`${trouble.id} の主拠点が未知: ${location}`);
    }
  }
  return true;
}

export function createSeededRandom(seed = 1) {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  const random = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  random.int = (maxExclusive) => Math.floor(random() * maxExclusive);
  random.pick = (items) => items[random.int(items.length)];
  random.getState = () => state;
  return random;
}
