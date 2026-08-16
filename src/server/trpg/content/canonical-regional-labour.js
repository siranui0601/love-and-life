import * as base from "./authored-facility-labour.js";

export * from "./authored-facility-labour.js";

export const CANONICAL_REGIONAL_LABOUR_VERSION = "canonical-regional-labour-v5";

// Live TRPG/仕事マスター is authoritative. These are normal public jobs for
// every route. All time/gold/needs effects are resolved by the native work
// engine; this layer only supplies canonical offers, gates and durable shift
// bookkeeping.
const JOBS = Object.freeze({
  LOC_FARM_FIELD: [["JOB-FARM-01", "麦畑の草取り・収穫補助", 240, 4, 0, "low"]],
  LOC_FARM_GRANARY: [["JOB-FARM-02", "穀倉の袋運び・棚卸し", 180, 3, 0, "low"]],
  LOC_FARM_INN: [["JOB-FARM-03", "麦穂亭の皿洗い", 120, 2, 0, "low"]],
  LOC_FARM_NORTH_FENCE: [["JOB-FARM-04", "北柵の夜番補助", 240, 3, 0, "medium", "villageTrust>=2"]],

  LOC_TRADE_PORT: [
    ["JOB-TRADE-01", "港朝荷役", 300, 8, 0, "medium"],
    ["JOB-TRADE-02", "港夕荷役", 180, 5, 0, "medium"],
  ],
  LOC_TRADE_CUSTOMS: [["JOB-TRADE-03", "税関荷札整理", 180, 6, 0, "low", "reputation>=1"]],
  LOC_TRADE_SHIPYARD: [["JOB-TRADE-04", "帆布・船具補修補助", 180, 4, 0, "low"]],

  LOC_CAP_MARKET: [["JOB-CAP-01", "中央市場の荷運び", 240, 6, 0, "low"]],
  LOC_CAP_STABLE: [["JOB-CAP-02", "厩舎清掃・荷車整備", 180, 5, 0, "low"]],
  LOC_CAP_NEWSPAPER: [["JOB-CAP-03", "瓦版印刷・配布", 180, 3, 0, "low", "petraTrust>=1"]],
  LOC_CAP_ORPHANAGE: [["JOB-CAP-04", "孤児院手伝い", 180, 1, 1, "low"]],

  LOC_CRIME_BACK_INN: [["JOB-CRIME-01", "黒灯亭厨房手伝い", 180, 4, 0, "medium"]],
  LOC_CRIME_INFO_STREET: [["JOB-CRIME-02", "裏路地荷運び", 180, 4, 0, "high"]],

  LOC_DWARF_MARKET: [
    ["JOB-DWARF-01", "鉱石運び", 300, 6, 0, "medium"],
    ["JOB-DWARF-02", "鉱石選別・秤見", 120, 3, 0, "low"],
  ],
  LOC_DWARF_ENGINEER: [
    ["JOB-DWARF-03", "排水部品整理", 180, 3, 0, "low", "minaTrust>=1"],
    ["JOB-DWARF-04", "図面清書", 240, 5, 0, "low", "technicalKnowledge||minaTrust>=2"],
  ],

  LOC_BORDER_INN: [["JOB-BORDER-01", "白砂亭の水汲み・掃除", 180, 3, 0, "low"]],
  LOC_BORDER_PILGRIM_SQUARE: [
    ["JOB-BORDER-02", "隊商荷ほどき", 180, 3, 0, "medium"],
    ["JOB-BORDER-03", "巡礼荷の仕分け", 120, 2, 0, "low"],
  ],

  LOC_FORT_SUPPLY: [
    ["JOB-FORT-01", "補給倉庫荷下ろし", 240, 5, 0, "medium", "fortEntryPermit"],
    ["JOB-FORT-03", "防寒布・縄の棚卸し", 120, 3, 0, "low", "fortEntryPermit"],
  ],
  LOC_FORT_INN: [["JOB-FORT-02", "炊事・薪運び補助", 180, 4, 1, "low", "fortEntryPermit"]],

  LOC_BLACKRIDGE_MARKET: [
    ["JOB-BLACK-01", "水路荷運び", 240, 5, 0, "medium", "blackridgeEntryPermit"],
    ["JOB-BLACK-03", "多種族市場の荷札仕分け", 120, 3, 0, "low", "blackridgeEntryPermit"],
  ],
  LOC_BLACKRIDGE_EXILE: [["JOB-BLACK-02", "共同炊事補助", 180, 3, 1, "low"]],
  LOC_FOREST_HUNTER_HUT: [["JOB-FOREST-01", "罠見回り補助", 240, 6, 0, "medium", "hunterApproval"]],
});

function current(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function day(runtime) {
  return Number(runtime?.playerState?.day ?? 1);
}

function state(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.canonicalRegionalLabour ??= { lastDayByFacility: {}, shifts: {} };
  return runtime.playerState.canonicalRegionalLabour;
}

function progress(runtime) {
  return runtime?.playerState?.progress ?? runtime?.playerState?.player?.progress ?? {};
}

function trust(runtime, key) {
  return Number(progress(runtime)?.[key] ?? runtime?.playerState?.[key] ?? 0);
}

function conditionMet(runtime, condition) {
  if (!condition) return true;
  if (condition === "villageTrust>=2") return trust(runtime, "villageTrust") >= 2;
  if (condition === "reputation>=1") return trust(runtime, "reputation") >= 1;
  if (condition === "petraTrust>=1") return trust(runtime, "petraTrust") >= 1;
  if (condition === "minaTrust>=1") return trust(runtime, "minaTrust") >= 1;
  if (condition === "technicalKnowledge||minaTrust>=2") return Boolean(progress(runtime)?.technicalKnowledge) || trust(runtime, "minaTrust") >= 2;
  if (condition === "fortEntryPermit") return Boolean(progress(runtime)?.fortEntryPermit ?? progress(runtime)?.fort_entry_permit ?? false);
  if (condition === "blackridgeEntryPermit") return Boolean(progress(runtime)?.blackridgeEntryPermit ?? progress(runtime)?.blackridge_entry_permit ?? false);
  if (condition === "hunterApproval") return Boolean(progress(runtime)?.hunterApproval ?? progress(runtime)?.hunter_approval ?? false);
  return false;
}

function jobs(runtime) {
  const facilityId = String(current(runtime).facilityId ?? "");
  const rows = JOBS[facilityId];
  if (!rows) return null;
  if (Number(state(runtime).lastDayByFacility[facilityId] ?? 0) === day(runtime)) return null;
  return rows.filter((entry) => conditionMet(runtime, entry[6]));
}

function action(tuple, runtime) {
  const [jobId, label, minutes, gold, freeMeals = 0, danger = "low"] = tuple;
  const facilityId = String(current(runtime).facilityId ?? "");
  return {
    id: `WORK:FACILITY:${jobId}`,
    actionId: `WORK:FACILITY:${jobId}`,
    family: "work",
    type: "work",
    label,
    minutes,
    wage: gold,
    targetLocation: current(runtime).location ?? null,
    targetFacilityId: facilityId,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    canonicalRegionalLabourChoice: true,
    canonicalRegionalJobId: jobId,
    canonicalRegionalGold: gold,
    canonicalRegionalFreeMeals: freeMeals,
    workDescription: label,
    workFacilityId: facilityId,
    workRiskClass: danger,
  };
}

function ownActions(runtime) {
  const available = jobs(runtime);
  return available?.map((entry) => action(entry, runtime)) ?? null;
}

function consume(runtime, actionValue, result) {
  if (!actionValue?.canonicalRegionalLabourChoice || result?.ok === false) return false;
  const player = current(runtime);
  const facilityId = String(player.facilityId ?? "");
  const labour = state(runtime);
  const jobId = String(actionValue.canonicalRegionalJobId ?? "");
  player.freeMeals = Number(player.freeMeals ?? 0) + Number(actionValue.canonicalRegionalFreeMeals ?? 0);
  labour.lastDayByFacility[facilityId] = day(runtime);
  labour.shifts[jobId] = Number(labour.shifts[jobId] ?? 0) + 1;
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "CANONICAL_REGIONAL_LABOUR_SHIFT",
    minute: Number(runtime.playerState.absoluteMinute ?? 0),
    actionId: actionValue.id,
    jobId,
    goldEarned: Number(actionValue.canonicalRegionalGold ?? 0),
    location: player.location ?? null,
    facilityId,
  });
  result.summary = `${actionValue.label}。${actionValue.canonicalRegionalGold}Gを受け取った。`;
  return true;
}

function staleBaseLabour(actions) {
  return Array.isArray(actions) && actions.length > 0 && actions.every((entry) => entry?.authoredFacilityLabourChoice);
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (authored != null && !staleBaseLabour(authored)) return authored;
  const live = ownActions(runtime);
  if (live?.length) return live;
  return authored;
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  const live = jobs(runtime);
  if (live?.length) {
    return {
      kicker: "土地の暮らしを支える、いつもの働き口がある",
      title: "正本の勤務条件から仕事を選ぶ",
      detail: "勤務時間と賃金はTRPG/仕事マスターの現在値を使う。所持金が増えても仕事そのものは消えない。",
      targetLocation: current(runtime).location ?? null,
      targetFacilityId: current(runtime).facilityId ?? null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, actionValue, result) {
  if (consume(runtime, actionValue, result)) return true;
  return base.applyAuthoredMissionFlowAction(runtime, actionValue, result);
}

export const CANONICAL_REGIONAL_LABOUR_INTERNALS = Object.freeze({ JOBS, jobs, ownActions, conditionMet, staleBaseLabour });
