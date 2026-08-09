import * as base from "./authored-mission-flow-village-first-wages.js";

export * from "./authored-mission-flow-village-first-wages.js";

export const AUTHORED_FACILITY_LABOUR_VERSION = "authored-facility-labour-v1";

// 施設に常設の働き口。docs/trpg/labour-catalogue.md の実装。
//
// 通し再生の実測で、4200行動のうち仕事は24回しかなかった。優先順位を上げても
// 増えなかったので、順番ではなく存在しない問題だった。リストに無い選択肢は昇格できない。
//
// 実装済みの初任給三択は一度きり設計なのでこの穴を埋めない。ここは反復可能な側である。
// ただし反復であって繰り返しではない。同じ働き口でも、扱う荷・組む相手・起きたこと・
// 聞いたことが毎回変わる。そして「何も起きず何も聞かない」回を必ずプールに残す。
// 毎回何かが起きる仕事は、仕事ではなく事件になる。
//
// 変奏の選び方は乱数ではなく、その働き口を何度こなしたかで決まる。
// 同じ種を与えれば同じ通し再生が再現できる、という既存の約束を壊さないため。

const STATE_KEY = "facilityLabour";
const LABOUR_SCENE = "facility-labour";

// 働く理由。金があって腹も減っていない人間は、日雇いの列に並ばない。
// 閾値というより、この道の主人公が四十八日間ずっと下回っていた線である
// （所持金の最高額はDay31の28G、それも契約書で即日3Gへ落ちている）。
const COMFORTABLE_GOLD = 30;
const PECKISH = 45;

function v(handled, mate, incident, overheard) {
  return Object.freeze({ handled, mate, incident, overheard });
}

// 変奏。何を扱い、誰と組み、何が起き、何を聞いたか。
// incident と overheard の null は「何も起きなかった」「何も聞かなかった」を意味する。
const VARIANTS = Object.freeze({
  port_haul: [
    v("塩樽", "名も名乗らない年寄り", null, null),
    v("麻袋", "口の減らない若手三人", null, "割当の不公平"),
    v("材木", "今日は代表のグレン本人", "昼前に雨で中断した", "北の要塞で小競り合いが増えている"),
    v("魚箱", "久しぶりの顔ぶれ", "縄が切れて箱の角が脛に落ちた", "詰所に割当が貼り出された"),
    v("陶器", "今日が初日の男", "一つ割った。弁償の話は出ない", "その男の身の上"),
    v("中身を知らされていない木箱", "若手だけ", null, null),
  ],
  inn_dishes: [
    v("鍋底の焦げ", "女将と二人", null, "客の噂話"),
    v("宴の後の皿の山", "手伝いの娘", "皿を一枚欠いた", null),
    v("いつもの半分の量", "誰もいない", null, "客が減っている"),
    v("井戸から運んだ水", "女将と二人", "水が濁っていた", "川の水量の話"),
  ],
  granary_count: [
    v("麻袋の数", "管理人のトーマ", null, "去年の収穫との比較"),
    v("焼け残りの梁", "村人総出", "指を挟んだ", null),
    v("灰の掻き出し", "年寄りばかり", null, "誰が火を点けたかの憶測"),
    v("種麦の選り分け", "トーマと二人", null, "来年の畑の話"),
  ],
  bakery_oven: [
    v("薪をくべる", "パン屋の親父", null, null),
    v("粉を篩う", "親父の女房", "篩を破いた", "粉の値上がり"),
    v("焼き上がりを並べる", "親父と二人", null, "客が黒パンしか買わなくなった"),
  ],
  market_porter: [
    v("野菜籠", "常連の運び屋", null, null),
    v("酒樽", "力自慢の男", "腰を痛めかけた", "下層の物騒な話"),
    v("反物", "口を利かない女", null, null),
    v("穀物袋", "田園から来た荷", null, "村の名が出た"),
    v("屋台の骨組み", "早朝の組み立て", "指を挟んだ", "市場の場所代の話"),
  ],
  fish_market: [
    v("鰯の山", "女衆に混ざって", null, "誰の舟が沈んだか"),
    v("氷", "無口な若い衆", "手がかじかんで一箱落とした", null),
    v("干物を返す", "老人ばかり", null, "昔の港の話"),
    v("高級魚", "女将の使い", null, "領主館へ納める先の話"),
  ],
  stable_muck: [
    v("馬房の敷き藁", "牧場主", null, null),
    v("飼葉", "馬番の子ども", null, "馬の名前を全部覚えさせられる"),
    v("荷車の車軸に油", "牧場主と二人", "油を被った", "荷車を借りたい者が増えている"),
  ],
  hunter_traps: [
    v("罠の見回り", "猟師のジル", null, "獣道が変わってきている"),
    v("獲物の解体", "ジルと二人", "手を切った", null),
    v("矢羽根の付け替え", "一人で小屋番", null, "森の奥を鳥が避けている"),
  ],
  newspaper_press: [
    v("刷り", "刷り師", null, "明日の紙面を先に読む"),
    v("配り", "一人で王都中", "犬に追われた", "下層の噂"),
    v("紙を裁つ", "見習いの少年", null, null),
  ],
  chief_paperwork: [
    v("村会の議事", "村長のガロ", null, null),
    v("去年の作付け表", "一人で土間", "墨をこぼした", "同じ名前が二度書かれている"),
    v("使いの口上", "村長の女房", null, "隣村も同じ話を抱えている"),
    v("嘆願の下書き", "ガロと二人", null, "村長が言い淀んだ箇所"),
  ],
  village_edge: [
    v("折れた柵板", "村の若い衆", null, null),
    v("見張り小屋道の草", "一人で半日", "鎌で指を切った", null),
    v("罠の掛け直し", "ジルと二人", null, "南から降りてきた足跡"),
  ],
  village_square: [
    v("行商の荷", "荷を引いてきた男", null, "街道の通行料が上がった"),
    v("掲示板の古い紙", "一人で広場", null, null),
    v("朝市の敷物", "顔だけ知っている女", "風で飛ばされた", "麦の値の話"),
  ],
  shipyard: [
    v("麻縄", "耳の遠い船大工", null, null),
    v("裂けた帆布", "女の帆縫い職人", "針で指を刺した", "沖の風向きが変わった"),
    v("船底の貝", "潜り慣れた若い衆", null, "沈んだ舟の話"),
  ],
  trade_stable: [
    v("王都行きの積荷", "組合の差配", null, "便が減っている"),
    v("汗をかいた馬", "年嵩の馬方", null, null),
    v("荷札", "帳場の女", "字を間違えて書き直した", "同じ宛先が続いている"),
  ],
  customs: [
    v("通関の控え", "税吏の下役", null, "検めを飛ばされた荷がある"),
    v("開けられた木箱", "税吏と二人", null, null),
    v("印紙", "一人で窓口", "貼り間違えた", "手数料の話"),
  ],
  ajin_quarter: [
    v("露店の品", "サミラ", null, "客足が減った理由"),
    v("破れた日除け幕", "店主たち総出", "風で骨が折れた", null),
    v("路地の荷", "名を名乗らない獣人", null, null),
  ],
  orphanage: [
    v("子どもの相手", "院長のシスター", null, "立ち退きの日取り"),
    v("薪割り", "年長の子ども二人", null, null),
    v("繕い物", "一人で縫い場", "指ぬきを無くした", "どの子の服かの話"),
  ],
  forest_camp: [
    v("焚き木", "野営の狩人たち", null, null),
    v("張った皮", "無口な女猟師", null, "獣が里へ降りている"),
    v("煮炊き", "野営の全員", "鍋を焦がした", "森の奥の水の話"),
  ],
});

function job(id, label, family, variantKey, minutes, gold, hunger, fatigue, hours, extra = {}) {
  return Object.freeze({
    id, label, family, variantKey, minutes, gold, hunger, fatigue,
    openHour: hours[0], closeHour: hours[1], ...extra,
  });
}

const DAY = [6, 20];
const EARLY = [5, 12];
const EVENING = [15, 23];

// 施設ごとの働き口。正本の施設一覧に載っている施設だけを使う。
const FACILITY_JOBS = Object.freeze({
  LOC_FARM_INN: [
    job("inn_dishes", "皿を洗う", "work", "inn_dishes", 200, 2, -18, 16, DAY, { freeMeals: 1 }),
    job("inn_firewood", "薪を割る", "work", "inn_dishes", 180, 3, 12, 24, DAY),
    job("inn_floor", "客席を回る", "talk", "inn_dishes", 120, 2, 6, 10, EVENING),
  ],
  LOC_FARM_GRANARY: [
    job("granary_count", "麻袋を数える", "work", "granary_count", 150, 3, 14, 18, DAY),
    job("granary_haul", "袋を積み替える", "work", "granary_count", 210, 4, 18, 28, DAY),
    job("granary_rats", "鼠の罠を見る", "investigate", "granary_count", 60, 1, 5, 6, DAY),
  ],
  LOC_FARM_BAKERY: [
    job("bakery_oven", "窯に薪をくべる", "work", "bakery_oven", 120, 1, -18, 11, EARLY),
    job("bakery_sift", "粉を篩う", "work", "bakery_oven", 150, 2, 8, 14, DAY),
    job("bakery_round", "焼き上がりを家々へ配る", "move", "bakery_oven", 90, 2, 10, 12, DAY),
  ],
  LOC_FARM_FIELD: [
    job("field_reap", "麦を刈る", "work", "granary_count", 400, 6, 26, 40, DAY),
    job("field_glean", "落穂を拾う", "work", "granary_count", 60, 1, 5, 5, DAY),
    job("field_birds", "鳥を追う", "wait", "granary_count", 180, 2, 10, 6, DAY),
  ],
  LOC_FARM_WELL: [
    job("well_water", "水を汲む", "work", "inn_dishes", 60, 1, 5, 7, DAY),
    job("well_herbs", "薬草を干す", "help", "inn_dishes", 150, 2, 8, 9, DAY),
    job("well_rope", "擦り切れた井戸縄を綯い直す", "work", "inn_dishes", 120, 2, 7, 12, DAY),
  ],
  LOC_FARM_STABLE: [
    job("stable_muck", "馬房を掃除する", "work", "stable_muck", 180, 3, 12, 22, DAY),
    job("stable_feed", "飼葉をやる", "help", "stable_muck", 60, 1, 5, 6, DAY),
    job("stable_harness", "馬具の革を繕う", "work", "stable_muck", 120, 2, 8, 10, DAY),
  ],
  LOC_TRADE_PORT: [
    job("port_morning", "朝の荷役に入る", "work", "port_haul", 210, 8, 22, 38, EARLY),
    job("port_evening", "夕の荷役に入る", "work", "port_haul", 180, 5, 18, 30, EVENING),
    job("port_rope", "綱を取る", "help", "port_haul", 45, 2, 4, 6, DAY),
  ],
  LOC_TRADE_FISH_MARKET: [
    job("fish_gut", "魚を締める", "work", "fish_market", 240, 6, 16, 26, EARLY),
    job("fish_ice", "氷を運ぶ", "work", "fish_market", 200, 5, 14, 28, DAY),
    job("fish_dry", "干物を返す", "help", "fish_market", 60, 1, 4, 5, DAY),
  ],
  LOC_TRADE_INN: [
    job("trade_inn_prep", "厨房の下ごしらえ", "work", "inn_dishes", 200, 4, -16, 18, DAY, { freeMeals: 1 }),
    job("trade_inn_casks", "酒樽を運ぶ", "work", "inn_dishes", 180, 4, 14, 24, EVENING),
    job("trade_inn_floor", "客席を回る", "talk", "inn_dishes", 120, 3, 8, 12, EVENING),
  ],
  LOC_TRADE_WAREHOUSE: [
    job("warehouse_tally", "積荷の数を取る", "investigate", "port_haul", 200, 5, 12, 16, DAY),
    job("warehouse_restack", "崩れた山を積み直す", "work", "port_haul", 210, 5, 16, 30, DAY),
    job("warehouse_rats", "鼠の食害を見て回る", "investigate", "port_haul", 90, 2, 6, 8, DAY),
  ],
  LOC_CAP_MARKET: [
    job("market_porter", "荷を運ぶ", "work", "market_porter", 240, 6, 20, 34, DAY),
    job("market_stall", "屋台を組む", "work", "market_porter", 90, 2, 8, 12, EARLY),
    job("market_night", "夜の荷運びを探す", "work", "market_porter", 240, 8, 24, 42, EVENING),
  ],
  LOC_CAP_LOWER_INN: [
    job("cap_inn_dishes", "皿を洗う", "work", "inn_dishes", 180, 2, 10, 16, DAY),
    job("cap_inn_floor", "床を磨く", "work", "inn_dishes", 90, 1, 6, 9, DAY),
    job("cap_inn_water", "水を汲んで運ぶ", "work", "inn_dishes", 120, 2, 9, 14, EARLY),
  ],
  LOC_CAP_STABLE: [
    job("cap_stable_muck", "馬房を掃除する", "work", "stable_muck", 200, 4, 14, 26, DAY),
    job("cap_stable_load", "荷を積む", "work", "market_porter", 180, 5, 14, 24, DAY),
    job("cap_stable_water", "馬に水をやる", "help", "stable_muck", 60, 1, 5, 7, DAY),
  ],
  LOC_CAP_NEWSPAPER: [
    job("press_print", "刷りを手伝う", "work", "newspaper_press", 180, 3, 12, 16, DAY),
    job("press_deliver", "瓦版を配る", "move", "newspaper_press", 200, 3, 14, 22, DAY),
    job("press_cut", "紙を裁つ", "work", "newspaper_press", 120, 2, 8, 10, DAY),
  ],
  LOC_FOREST_HUNTER_HUT: [
    job("hunter_traps", "罠を見回る", "work", "hunter_traps", 360, 6, 24, 36, DAY),
    job("hunter_butcher", "獲物を解体する", "work", "hunter_traps", 180, 4, -10, 20, DAY),
    job("hunter_fletch", "矢羽根を付け替える", "work", "hunter_traps", 120, 2, 8, 8, DAY),
  ],
  LOC_FOREST_CAMP: [
    job("camp_firewood", "薪を集める", "work", "forest_camp", 90, 1, 8, 12, DAY),
    job("camp_hides", "皮を張る", "work", "forest_camp", 150, 2, 8, 14, DAY),
    job("camp_cook", "煮炊きを手伝う", "help", "forest_camp", 120, 1, -20, 8, EVENING, { freeMeals: 1 }),
  ],
  LOC_FARM_CHIEF: [
    job("chief_copy", "書き付けを清書する", "work", "chief_paperwork", 200, 3, 10, 12, DAY, { literacy: true }),
    job("chief_bind", "帳面を綴じ直す", "work", "chief_paperwork", 120, 2, 6, 8, DAY),
    job("chief_errand", "村長の使いに出る", "move", "chief_paperwork", 150, 2, 12, 16, DAY),
  ],
  LOC_FARM_EDGE: [
    job("edge_fence", "柵を直す", "work", "village_edge", 180, 3, 12, 22, DAY),
    job("edge_traps", "罠を見回る", "work", "village_edge", 240, 4, 16, 26, DAY),
    job("edge_mow", "見張り小屋道の草を刈る", "work", "village_edge", 120, 1, 8, 14, DAY),
  ],
  LOC_FARM_SQUARE: [
    job("square_unload", "荷降ろしを手伝う", "work", "village_square", 90, 2, 8, 12, DAY),
    job("square_board", "掲示板の紙を貼り替える", "work", "village_square", 60, 1, 4, 5, DAY),
    job("square_mats", "朝市の敷物を広げる", "work", "village_square", 90, 1, 6, 9, EARLY),
  ],
  LOC_TRADE_SHIPYARD: [
    job("shipyard_rope", "綱をなう", "work", "shipyard", 180, 3, 10, 12, DAY),
    job("shipyard_sail", "帆布を繕う", "work", "shipyard", 200, 4, 10, 14, DAY),
    job("shipyard_hull", "船底の貝を落とす", "work", "shipyard", 240, 4, 18, 32, DAY),
  ],
  LOC_TRADE_STABLE: [
    job("trade_stable_load", "荷を積む", "work", "trade_stable", 180, 5, 16, 26, DAY),
    job("trade_stable_wash", "馬を洗う", "help", "trade_stable", 120, 2, 10, 16, DAY),
    job("trade_stable_tags", "荷札を書き写す", "work", "trade_stable", 120, 3, 6, 8, DAY, { literacy: true }),
  ],
  LOC_TRADE_CUSTOMS: [
    job("customs_copy", "書類を写す", "work", "customs", 200, 6, 10, 12, DAY, { literacy: true }),
    job("customs_inspect", "荷検めに立ち会う", "investigate", "customs", 150, 4, 8, 12, DAY),
    job("customs_stamps", "印紙を貼る", "work", "customs", 90, 2, 5, 6, DAY),
  ],
  LOC_CAP_AJIN_QUARTER: [
    job("ajin_stall", "露店の店番をする", "talk", "ajin_quarter", 200, 3, 10, 12, DAY),
    job("ajin_awning", "日除け幕を張り直す", "work", "ajin_quarter", 120, 2, 8, 14, DAY),
    job("ajin_carry", "路地の荷を運ぶ", "work", "ajin_quarter", 150, 3, 12, 20, DAY),
  ],
  LOC_CAP_ORPHANAGE: [
    job("orphanage_children", "子どもの世話をする", "help", "orphanage", 240, 0, -22, 18, DAY, { freeMeals: 1 }),
    job("orphanage_firewood", "薪を割る", "work", "orphanage", 120, 1, 10, 18, DAY),
    job("orphanage_mend", "繕い物をする", "help", "orphanage", 150, 1, 6, 8, DAY),
  ],
});

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function absoluteMinute(runtime) {
  return Number(runtime?.playerState?.absoluteMinute ?? 0);
}

function dayOf(runtime) {
  return Math.floor(absoluteMinute(runtime) / 1440) + 1;
}

function hourOf(runtime) {
  return Math.floor((((absoluteMinute(runtime) % 1440) + 1440) % 1440) / 60);
}

function needValue(runtime, key) {
  const current = player(runtime);
  for (const candidate of [current?.needs?.[key], current?.[key], runtime?.playerState?.[key]]) {
    const value = Number(candidate);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

export function readState(runtime) {
  const state = runtime?.playerState?.[STATE_KEY];
  return state && typeof state === "object" ? state : null;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_FACILITY_LABOUR_VERSION,
    shiftsByJob: {},
    lastDayByFacility: {},
    totalShifts: 0,
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_FACILITY_LABOUR_VERSION;
  state.shiftsByJob ??= {};
  state.lastDayByFacility ??= {};
  return state;
}

export function jobsAt(facilityId) {
  return FACILITY_JOBS[String(facilityId ?? "")] ?? null;
}

export function jobIsOpen(entry, hour) {
  return hour >= entry.openHour && hour < entry.closeHour;
}

// 変奏は乱数で選ばない。その働き口を何度こなしたかで決まるので、
// 同じ種の通し再生は同じ順序で同じ変奏を踏む。そして一巡するまで同じ回は出ない。
export function variantFor(entry, shiftCount) {
  const pool = VARIANTS[entry.variantKey] ?? [];
  if (pool.length === 0) return null;
  return pool[Math.abs(Number(shiftCount) || 0) % pool.length];
}

function shiftCountOf(state, entry) {
  return Number(state?.shiftsByJob?.[entry.id] ?? 0);
}

// 働く理由。金があって腹も減っていない者は日雇いの列に並ばない。
export function needsTheWork(runtime) {
  return Number(player(runtime).gold ?? 0) < COMFORTABLE_GOLD
    || needValue(runtime, "hunger") >= PECKISH;
}

// 同じ施設で一日に二度は雇われない。日が変われば、また立てる。
function alreadyWorkedHereToday(runtime, facilityId) {
  return Number(readState(runtime)?.lastDayByFacility?.[facilityId] ?? 0) === dayOf(runtime);
}

const TERMINAL = new Set(["completed", "resolved", "terminal", "failed", "abandoned", "expired"]);

function missionEntries(runtime) {
  const missions = runtime?.playerState?.missions;
  if (Array.isArray(missions)) return missions.map((mission) => [mission?.id, mission]);
  if (missions && typeof missions === "object") return Object.entries(missions);
  return [];
}

// 手順は依頼そのものではなく目録側に載っていることがある。両方見る。
function stepsOf(runtime, missionId, mission) {
  const fromCatalog = runtime?.playerState?.catalog?.byId?.get?.(missionId)?.steps;
  return arr(mission?.steps)
    .concat(arr(fromCatalog))
    .concat(mission?.currentStep ? [mission.currentStep] : []);
}

// 事件が待っている土地で、馬房を掃除する三択は出さない。
// 引き受けた依頼がこの土地にまだ用を残しているなら、そこは仕事場ではなく現場である。
//
// 「引き受けた」が効いている。噂を聞いただけの事件は仕事を止めない。
// 道の主人公がDay16からDay33まで港で荷を担げるのは、その間まだ交易都市の依頼を
// 一つも引き受けていないからで、Day36にT05へ踏み込んだ後は港が仕事場でなくなる。
export function missionWaitsHere(runtime, facilityId, location) {
  for (const [missionId, mission] of missionEntries(runtime)) {
    if (TERMINAL.has(String(mission?.status ?? ""))) continue;
    if (String(mission?.status ?? "") !== "active") continue;
    for (const step of stepsOf(runtime, missionId, mission)) {
      const sameFacility = String(step?.targetFacilityId ?? "") === facilityId;
      const sameLocation = location != null && String(step?.targetLocation ?? "") === location;
      if (!sameFacility && !sameLocation) continue;
      const done = Number(mission?.progress?.[step?.id] ?? step?.progress ?? 0);
      if (done < Number(step?.required ?? 1)) return true;
    }
  }
  return false;
}

// 名指しの雇い主が立っている場所では、日雇いの列は黙る。
// 麦畑にはエダが、村の広場にはガロがいて、仕事はその人から受けるものである。
// 正本側の労働市場（service.js の PREFERRED_WORK_GIVER_BY_FACILITY）は
// 雇用関係・提示賃金・所要時間の取り決めを持っており、こちらが上書きしてはいけない。
// その人がその場にいない日は、ここの列が代わりに立つ。
const NAMED_EMPLOYER_BY_FACILITY = Object.freeze({
  LOC_FARM_FIELD: "NPC004",
  LOC_FARM_SQUARE: "NPC003",
});

export function namedEmployerStandsHere(runtime, facilityId, context) {
  const employerId = NAMED_EMPLOYER_BY_FACILITY[String(facilityId ?? "")];
  if (!employerId) return false;
  const present = arr(context?.presentNpcs).map((npc) => String(npc?.id ?? npc ?? ""));
  if (present.includes(employerId)) return true;
  const authoritative = runtime?.playerState?.authoritativePresentNpcIds;
  return authoritative instanceof Set ? authoritative.has(employerId) : false;
}

export function openJobsFor(runtime) {
  const facilityId = String(player(runtime).facilityId ?? "");
  const entries = jobsAt(facilityId);
  if (!entries) return null;
  if (alreadyWorkedHereToday(runtime, facilityId)) return null;
  if (missionWaitsHere(runtime, facilityId, player(runtime).location ?? null)) return null;
  if (!needsTheWork(runtime)) return null;
  const hour = hourOf(runtime);
  const open = entries.filter((entry) => jobIsOpen(entry, hour));
  return open.length > 0 ? open : null;
}

// 今すぐ入れる口が三つに満たない場所がある。安宿の皿洗いは一口しかない。
// そこで一択の画面を出すのは、選ばせていないのと同じである。
// 空いていない口は「次の刻を待って入る」形で並べ、待ち時間を作業時間に足す。
// 待つのも選択なので、賃金も消耗もその口のまま変わらない。
export function waitMinutesUntilOpen(entry, hour, minuteOfHour) {
  if (jobIsOpen(entry, hour)) return 0;
  const hoursAhead = ((Number(entry.openHour) - hour) + 24) % 24;
  return hoursAhead * 60 - minuteOfHour;
}

export function offeredJobsFor(runtime) {
  const open = openJobsFor(runtime);
  if (!open) return null;
  if (open.length >= 3) return open.slice(0, 3).map((entry) => ({ entry, waitMinutes: 0 }));

  const hour = hourOf(runtime);
  const minuteOfHour = (((absoluteMinute(runtime) % 1440) + 1440) % 1440) % 60;
  const offered = open.map((entry) => ({ entry, waitMinutes: 0 }));
  const waiting = arr(jobsAt(String(player(runtime).facilityId ?? "")))
    .filter((entry) => !open.includes(entry))
    .map((entry) => ({ entry, waitMinutes: waitMinutesUntilOpen(entry, hour, minuteOfHour) }))
    .sort((left, right) => left.waitMinutes - right.waitMinutes
      || String(left.entry.id).localeCompare(String(right.entry.id), "en"));
  for (const candidate of waiting) {
    if (offered.length >= 3) break;
    offered.push(candidate);
  }
  return offered.length >= 3 ? offered : null;
}

// 常設の働き口は、この鎖のいちばん下に敷く床である。
// 事件にも、一度きりの手書き場面にも割り込まない。井戸端の日常三択も、
// 初任給の三択も、その場所その日にしか無いものなので先に立つ。
// 手書きの場面が何も言わない時にだけ、仕事の列がそこにある。
function baseOffers(runtime, context) {
  return base.authoredMissionFlowExclusiveActions(runtime, context) != null;
}

export function ownEligible(runtime) {
  return openJobsFor(runtime) != null;
}

export function actionIdFor(entry) {
  return `WORK:FACILITY:${entry.id}`;
}

function summaryFor(entry, variant) {
  const parts = [`${variant.handled}。${variant.mate}と組む。`];
  if (variant.incident) parts.push(`${variant.incident}。`);
  if (variant.overheard) parts.push(`聞こえたのは${variant.overheard}。`);
  else parts.push("誰も何も言わない。");
  parts.push(`${entry.gold}G。`);
  return parts.join("");
}

function waitLabel(entry, waitMinutes) {
  if (waitMinutes <= 0) return entry.label;
  const hours = Math.round(waitMinutes / 60);
  if (hours >= 6) return `${entry.label}——明朝の口に、今から名前を入れておく`;
  return `${entry.label}——${hours}時間ほど待って、次の刻の口に入る`;
}

function actionFor(runtime, entry, waitMinutes = 0) {
  const id = actionIdFor(entry);
  const variant = variantFor(entry, shiftCountOf(readState(runtime), entry));
  return {
    id,
    actionId: id,
    family: entry.family,
    type: "plan",
    minutes: entry.minutes + Math.max(0, waitMinutes),
    authoredFacilityLabourWaitMinutes: Math.max(0, waitMinutes),
    label: waitLabel(entry, waitMinutes),
    targetLocation: player(runtime).location ?? null,
    targetFacilityId: player(runtime).facilityId ?? null,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredFacilityLabourChoice: true,
    authoredFacilityLabourJobId: entry.id,
    authoredFacilityLabourGold: entry.gold,
    authoredFacilityLabourFreeMeals: entry.freeMeals ?? 0,
    authoredFacilityLabourHunger: entry.hunger,
    authoredFacilityLabourFatigue: entry.fatigue,
    authoredFacilityLabourVariant: variant,
    authoredFacilityLabourSummary: summaryFor(entry, variant),
  };
}

function standsDown(runtime, context) {
  if (namedEmployerStandsHere(runtime, player(runtime).facilityId, context)) return true;
  return baseOffers(runtime, context);
}

function actions(runtime, context) {
  const offered = offeredJobsFor(runtime);
  if (!offered || standsDown(runtime, context)) return null;
  return offered.map(({ entry, waitMinutes }) => actionFor(runtime, entry, waitMinutes));
}

function guidance(runtime, context) {
  const open = offeredJobsFor(runtime);
  if (!open || standsDown(runtime, context)) return null;
  return {
    kicker: "手が足りていない。名前も身分も聞かれない類の仕事である",
    title: "今日の働き口",
    detail: "身分証の代わりになるのは、ここへ何度来たかだけである。",
    targetLocation: player(runtime).location ?? null,
    targetFacilityId: player(runtime).facilityId ?? null,
  };
}

function applyNeed(target, key, delta) {
  if (!target || !delta) return;
  const current = Number(target[key]);
  if (!Number.isFinite(current)) return;
  target[key] = Math.max(0, Math.min(100, current + delta));
}

function consume(runtime, action, result) {
  if (!action?.authoredFacilityLabourChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  const minute = absoluteMinute(runtime);
  const current = player(runtime);
  const facilityId = String(current.facilityId ?? "");
  const jobId = String(action.authoredFacilityLabourJobId);

  state.shiftsByJob[jobId] = Number(state.shiftsByJob[jobId] ?? 0) + 1;
  state.lastDayByFacility[facilityId] = dayOf(runtime);
  state.totalShifts = Number(state.totalShifts ?? 0) + 1;

  current.gold = Number(current.gold ?? 0) + Number(action.authoredFacilityLabourGold ?? 0);
  if (action.authoredFacilityLabourFreeMeals) {
    current.freeMeals = Number(current.freeMeals ?? 0) + action.authoredFacilityLabourFreeMeals;
  }
  for (const target of [runtime.playerState, current, current.needs]) {
    applyNeed(target, "hunger", action.authoredFacilityLabourHunger);
    applyNeed(target, "fatigue", action.authoredFacilityLabourFatigue);
  }

  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "FACILITY_LABOUR_SHIFT",
    minute,
    sceneId: LABOUR_SCENE,
    actionId: action.id,
    jobId,
    shiftNumber: state.shiftsByJob[jobId],
    goldEarned: action.authoredFacilityLabourGold,
    variant: action.authoredFacilityLabourVariant,
    location: current.location ?? null,
    facilityId,
  });

  result.summary = action.authoredFacilityLabourSummary;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const fromBase = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (fromBase) return fromBase;
  return actions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  return base.authoredMissionFlowGuidance(runtime, context) ?? guidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  if (consume(runtime, action, result)) return true;
  return base.applyAuthoredMissionFlowAction(runtime, action, result);
}

export const AUTHORED_FACILITY_LABOUR_INTERNALS = Object.freeze({
  FACILITY_JOBS,
  VARIANTS,
  COMFORTABLE_GOLD,
  PECKISH,
  actionIdFor,
  jobsAt,
  missionWaitsHere,
  namedEmployerStandsHere,
  NAMED_EMPLOYER_BY_FACILITY,
  jobIsOpen,
  variantFor,
  needsTheWork,
  offeredJobsFor,
  openJobsFor,
  ownEligible,
  readState,
  waitMinutesUntilOpen,
});
