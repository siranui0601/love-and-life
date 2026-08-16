import * as base from "./authored-facility-labour.js";

export * from "./authored-facility-labour.js";

export const CANONICAL_REGIONAL_LABOUR_VERSION = "canonical-regional-labour-v2";

// Live TRPG/仕事マスター rows required by the Day1-Day85 authored route.
// These are ordinary jobs available to every player; none checks a virtue flag.
const JOBS = Object.freeze({
  LOC_DWARF_MARKET: [
    ["JOB-DWARF-01", "鉱石を運ぶ", 300, 6, 24, 34],
    ["JOB-DWARF-02", "鉱石を選別して秤を見る", 120, 3, 8, 11],
    ["JOB-DWARF-03", "排水部品を整理する", 180, 3, 10, 12],
  ],
  LOC_DWARF_ENGINEER: [
    ["JOB-DWARF-03", "排水部品を整理する", 180, 3, 10, 12],
    ["JOB-DWARF-04", "図面を清書する", 240, 5, 9, 12],
    ["JOB-DWARF-02", "鉱石見本を選別する", 120, 3, 8, 11],
  ],
  LOC_BORDER_INN: [
    ["JOB-BORDER-01", "白砂亭の水汲みと掃除", 180, 3, 13, 18],
    ["JOB-BORDER-02", "隊商の荷ほどきを手伝う", 180, 3, 14, 20],
    ["JOB-BORDER-03", "巡礼荷を仕分ける", 120, 2, 8, 10],
  ],
  LOC_BORDER_CARAVAN: [
    ["JOB-BORDER-02", "隊商の荷ほどきを手伝う", 180, 3, 14, 20],
    ["JOB-BORDER-03", "巡礼荷を仕分ける", 120, 2, 8, 10],
    ["JOB-BORDER-01", "水樽を宿へ運ぶ", 180, 3, 13, 18],
  ],
  LOC_FORT_SUPPLY: [
    ["JOB-FORT-01", "補給倉庫の荷を下ろす", 240, 5, 16, 24],
    ["JOB-FORT-03", "防寒布と縄を棚卸しする", 120, 3, 7, 10],
    ["JOB-FORT-02", "炊事場へ薪を運ぶ", 180, 4, 12, 17, 1],
  ],
  LOC_FORT_KITCHEN: [
    ["JOB-FORT-02", "炊事と薪運びを手伝う", 180, 4, 8, 17, 1],
    ["JOB-FORT-03", "防寒布を畳んで補給棚へ戻す", 120, 3, 7, 10],
    ["JOB-FORT-01", "食料樽を補給庫へ運ぶ", 240, 5, 16, 24],
  ],
  LOC_BLACKRIDGE_MARKET: [
    ["JOB-BLACK-01", "水路荷を運ぶ", 240, 5, 17, 24],
    ["JOB-BLACK-03", "多種族市場の荷札を仕分ける", 120, 3, 7, 9],
    ["JOB-BLACK-02", "共同炊事の荷を運ぶ", 180, 3, 9, 14, 1],
  ],
  LOC_BLACKRIDGE_EXILE: [
    ["JOB-BLACK-02", "共同炊事を手伝う", 180, 3, 5, 14, 1],
    ["JOB-BLACK-03", "避難物資の荷札を仕分ける", 120, 3, 7, 9],
    ["JOB-BLACK-01", "水路から飲料水を運ぶ", 240, 5, 17, 24],
  ],
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

function jobs(runtime) {
  const facilityId = String(current(runtime).facilityId ?? "");
  if (!JOBS[facilityId]) return null;
  if (Number(state(runtime).lastDayByFacility[facilityId] ?? 0) === day(runtime)) return null;
  const gold = Number(current(runtime).gold ?? 0);
  const hunger = Number(current(runtime)?.needs?.hunger ?? current(runtime).hunger ?? 0);
  if (gold >= 30 && hunger < 45) return null;
  return JOBS[facilityId];
}

function action(tuple, runtime) {
  const [jobId, label, minutes, gold, hunger, fatigue, freeMeals = 0] = tuple;
  const facilityId = String(current(runtime).facilityId ?? "");
  return {
    id: `WORK:FACILITY:${jobId}`,
    actionId: `WORK:FACILITY:${jobId}`,
    family: "work",
    type: "plan",
    label,
    minutes,
    targetLocation: current(runtime).location ?? null,
    targetFacilityId: facilityId,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    canonicalRegionalLabourChoice: true,
    canonicalRegionalJobId: jobId,
    canonicalRegionalGold: gold,
    canonicalRegionalHunger: hunger,
    canonicalRegionalFatigue: fatigue,
    canonicalRegionalFreeMeals: freeMeals,
  };
}

function ownActions(runtime) {
  const available = jobs(runtime);
  return available?.map((entry) => action(entry, runtime)) ?? null;
}

function applyNeed(target, key, delta) {
  if (!target || !delta) return;
  const before = Number(target[key]);
  if (!Number.isFinite(before)) return;
  target[key] = Math.max(0, Math.min(100, before + delta));
}

function consume(runtime, actionValue, result) {
  if (!actionValue?.canonicalRegionalLabourChoice || result?.ok === false) return false;
  const player = current(runtime);
  const facilityId = String(player.facilityId ?? "");
  const labour = state(runtime);
  const jobId = String(actionValue.canonicalRegionalJobId ?? "");
  player.gold = Number(player.gold ?? 0) + Number(actionValue.canonicalRegionalGold ?? 0);
  player.freeMeals = Number(player.freeMeals ?? 0) + Number(actionValue.canonicalRegionalFreeMeals ?? 0);
  for (const target of [runtime.playerState, player, player.needs]) {
    applyNeed(target, "hunger", actionValue.canonicalRegionalHunger);
    applyNeed(target, "fatigue", actionValue.canonicalRegionalFatigue);
  }
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

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (authored != null) return authored;
  return ownActions(runtime);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  const authored = base.authoredMissionFlowGuidance(runtime, context);
  if (authored != null) return authored;
  if (!jobs(runtime)) return null;
  return {
    kicker: "土地の暮らしを支える、いつもの働き口がある",
    title: "今日の仕事を選ぶ",
    detail: "事件がなくても人は働く。賃金は地域相場のままである。",
    targetLocation: current(runtime).location ?? null,
    targetFacilityId: current(runtime).facilityId ?? null,
  };
}

export function applyAuthoredMissionFlowAction(runtime, actionValue, result) {
  if (consume(runtime, actionValue, result)) return true;
  return base.applyAuthoredMissionFlowAction(runtime, actionValue, result);
}

export const CANONICAL_REGIONAL_LABOUR_INTERNALS = Object.freeze({ JOBS, jobs, ownActions });
