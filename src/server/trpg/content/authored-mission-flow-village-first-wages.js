import * as base from "./authored-mission-flow-t05-to-t07-bridge.js";

export * from "./authored-mission-flow-t05-to-t07-bridge.js";

export const AUTHORED_VILLAGE_FIRST_WAGES_VERSION = "authored-village-first-wages-v1";

// プレイヤーは正本どおり金を持たずにこの世界へ落ちてくる。
// 田園の村の食事は麦粥1G、黒パン1G、定食5G。つまり一枚も持たないうちは
// どの店へ行っても買えず、通し再生では全行動の45%が食事処を巡る移動に消えていた。
//
// ここで渡すのは施しではなく仕事である。三つとも一度きりで、選べば残り二つは閉じる。
// 同じ日雇いが繰り返し画面へ出ることはない。以後は通常の仕事・買物の仕組みが引き継ぐ。

const LOCATION = "田園の村";
const STATE_KEY = "villageFirstWages";
const WAGE_SCENE = "village-first-wages";

const FAC = Object.freeze({
  field: "LOC_FARM_FIELD",
  inn: "LOC_FARM_INN",
  bakery: "LOC_FARM_BAKERY",
});

const NPC = Object.freeze({
  eda: "NPC004",
  rona: "NPC058",
  paolo: "NPC059",
});

// 所持金がこれ未満なら、村で最も安い一食すら買えない側にいる。
const BROKE_THRESHOLD = 5;
// 小腹が空いた程度では働きに出ない。井戸端や畑の寄り道はまだその人のものである。
// 生存側が食事・宿泊を最優先にする70の手前、はっきり空いた55を境にする。
const HUNGRY_ENOUGH = 55;

const WAGE_OPEN_MINUTE = 0;
const WAGE_CLOSE_MINUTE = 30 * 1440;
const WORK_HOURS_START = 6 * 60;
const WORK_HOURS_END = 20 * 60;

const WAGE_CHOICES = Object.freeze([
  Object.freeze({
    id: "haul_sheaves",
    label: "麦束を運ぶ",
    family: "work",
    minutes: 195,
    facility: FAC.field,
    gold: 5,
    hunger: 14,
    fatigue: 26,
    freeMeals: 0,
    summary:
      "刈った麦束を荷車まで運ぶ半日仕事を引き受けた。腰が痛み、腹も余計に減ったが、日暮れにエダから硬貨を五枚受け取った。この世界で初めて自分の名で稼いだ金である。",
    speech: Object.freeze({
      actorId: NPC.eda,
      text: "はい、五枚。……身分証がなくたって、麦は運べるんだよ。腹が減ったら麦穂亭へお行き。粥なら一枚で食える。稼いだ金で食う飯は、拾った飯より旨いからね。",
      emotion: "働いた者への当たり前の敬意",
    }),
    worldFlags: ["villageFirstWageEarned", "villageFieldWorkKnown"],
    historyType: "VILLAGE_FIRST_WAGE_FIELD_HAUL",
  }),
  Object.freeze({
    id: "wash_dishes",
    label: "麦穂亭の皿を洗う",
    family: "work",
    minutes: 140,
    facility: FAC.inn,
    gold: 2,
    hunger: -30,
    fatigue: 16,
    freeMeals: 1,
    summary:
      "夕餉の山のような皿を洗った。ローナは硬貨を二枚しか出さなかったが、代わりに賄いの粥を出し、これからも手が足りない晩は食わせると言った。金より確かな取り決めである。",
    speech: Object.freeze({
      actorId: NPC.rona,
      text: "二枚しか出せないよ。うちは大きい宿じゃない。……その代わり、洗い場に立った晩は食わせる。金は消えるが、食わせる約束は残る。どっちが得か、あんたなら分かるだろ。",
      emotion: "値切りながらの面倒見",
    }),
    worldFlags: ["villageFirstWageEarned", "villageInnMealArrangement"],
    historyType: "VILLAGE_FIRST_WAGE_INN_DISHES",
  }),
  Object.freeze({
    id: "feed_the_oven",
    label: "パン屋の窯に薪をくべる",
    family: "work",
    minutes: 95,
    facility: FAC.bakery,
    gold: 1,
    hunger: -18,
    fatigue: 11,
    freeMeals: 0,
    summary:
      "夜明け前の窯に薪をくべ続けた。短い仕事で硬貨は一枚きりだが、パオロは形の崩れた黒パンを二つ持たせた。売り物にならないだけで、味は同じものである。",
    speech: Object.freeze({
      actorId: NPC.paolo,
      text: "一枚だ。それ以上は出せん。……これは持っていけ。焦げて売れんやつだ。売れんが、腹には同じだ。朝の窯は毎日焚く。手が空いてる朝は来い。",
      emotion: "ぶっきらぼうな親切",
    }),
    worldFlags: ["villageFirstWageEarned", "villageBakeryMorningWork"],
    historyType: "VILLAGE_FIRST_WAGE_BAKERY_OVEN",
  }),
]);

const WAGE_GUIDANCE = Object.freeze({
  kicker: "腹の音が自分でも聞こえた。財布には一枚も入っていない",
  title: "一枚も持たずに腹が減った",
  detail:
    "この村の一番安い粥でも硬貨が一枚いる。誰も恵んではくれないが、手が足りない場所は三つある。麦畑、麦穂亭の洗い場、パン屋の窯。稼ぎ方によって、残るものが変わる。",
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

function minuteOfDay(runtime) {
  return ((absoluteMinute(runtime) % 1440) + 1440) % 1440;
}

function needValue(runtime, key) {
  const current = player(runtime);
  for (const candidate of [current?.needs?.[key], current?.[key], runtime?.playerState?.[key]]) {
    const value = Number(candidate);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

export function isBroke(runtime) {
  return Number(player(runtime).gold ?? 0) < BROKE_THRESHOLD;
}

function readState(runtime) {
  const state = runtime?.playerState?.[STATE_KEY];
  return state && typeof state === "object" ? state : null;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_VILLAGE_FIRST_WAGES_VERSION,
    completedAtMinute: null,
    selectedActionId: null,
    closedActionIds: [],
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_VILLAGE_FIRST_WAGES_VERSION;
  state.closedActionIds = arr(state.closedActionIds).map(String);
  return state;
}

// 事件の手書き場面が出ている間は割り込まない。稼ぎは事件より優先されない。
// 一方で、腹を空かせて一文無しの人間が井戸端で油を売るのは順序が逆なので、
// missionId を持たない日常の寄り道より上に立つ。事件だけに道を譲る。
function baseIsSpeaking(runtime) {
  const guidance = base.authoredMissionFlowGuidance(runtime);
  return guidance != null && guidance.missionId != null;
}

export function ownEligible(runtime) {
  if (player(runtime).location !== LOCATION) return false;
  const minute = absoluteMinute(runtime);
  if (minute < WAGE_OPEN_MINUTE || minute >= WAGE_CLOSE_MINUTE) return false;
  const ofDay = minuteOfDay(runtime);
  if (ofDay < WORK_HOURS_START || ofDay >= WORK_HOURS_END) return false;
  if (!isBroke(runtime)) return false;
  if (needValue(runtime, "hunger") < HUNGRY_ENOUGH) return false;
  return readState(runtime)?.completedAtMinute == null;
}

function eligible(runtime) {
  return ownEligible(runtime) && !baseIsSpeaking(runtime);
}

function actionIdFor(choice) {
  return `DAILY_LIFE:FIRST_WAGES:${choice.id}`;
}

function actionFor(choice) {
  const id = actionIdFor(choice);
  return {
    id,
    actionId: id,
    family: choice.family,
    type: "plan",
    minutes: choice.minutes,
    label: choice.label,
    targetLocation: LOCATION,
    targetFacilityId: choice.facility,
    targetNpcId: choice.speech.actorId,
    dialogueTopic: `first_wages_${choice.id}`,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredFirstWagesChoice: true,
    authoredFirstWagesSummary: choice.summary,
    authoredFirstWagesSpeech: choice.speech,
    authoredFirstWagesWorldFlags: choice.worldFlags,
    authoredFirstWagesHistoryType: choice.historyType,
    authoredFirstWagesGold: choice.gold,
    authoredFirstWagesFreeMeals: choice.freeMeals,
    authoredFirstWagesHunger: choice.hunger,
    authoredFirstWagesFatigue: choice.fatigue,
  };
}

function actions(runtime) {
  if (!eligible(runtime)) return null;
  return WAGE_CHOICES.map(actionFor);
}

function applyNeed(target, key, delta) {
  if (!target || !delta) return;
  const current = Number(target[key]);
  if (!Number.isFinite(current)) return;
  target[key] = Math.max(0, Math.min(100, current + delta));
}

function consume(runtime, action, result) {
  if (!action?.authoredFirstWagesChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (state.completedAtMinute != null) return false;

  const minute = absoluteMinute(runtime);
  const closed = WAGE_CHOICES.map(actionIdFor).filter((id) => id !== action.id);
  state.completedAtMinute = minute;
  state.selectedActionId = action.id;
  state.closedActionIds = closed;

  const current = player(runtime);
  current.gold = Number(current.gold ?? 0) + Number(action.authoredFirstWagesGold ?? 0);
  if (action.authoredFirstWagesFreeMeals) {
    current.freeMeals = Number(current.freeMeals ?? 0) + action.authoredFirstWagesFreeMeals;
  }
  for (const target of [runtime.playerState, current, current.needs]) {
    applyNeed(target, "hunger", action.authoredFirstWagesHunger);
    applyNeed(target, "fatigue", action.authoredFirstWagesFatigue);
  }

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  for (const flag of arr(action.authoredFirstWagesWorldFlags)) {
    runtime.playerState.worldFlags[flag] = true;
  }
  runtime.playerState.history.push({
    type: action.authoredFirstWagesHistoryType,
    minute,
    sceneId: WAGE_SCENE,
    actionId: action.id,
    closedActionIds: [...closed],
    goldEarned: action.authoredFirstWagesGold,
    freeMealsEarned: action.authoredFirstWagesFreeMeals,
    location: LOCATION,
    facilityId: action.targetFacilityId,
  });

  if (action.targetFacilityId) current.facilityId = action.targetFacilityId;
  result.summary = action.authoredFirstWagesSummary;
  result.speeches = [action.authoredFirstWagesSpeech];
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  // eligible() が事件場面へ道を譲るので、ここで own を先に見てよい。
  // 日常の寄り道より上、事件より下、という順序はその判定に集約してある。
  const own = actions(runtime);
  if (own) return own;
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (eligible(runtime)) {
    return {
      missionId: null,
      kicker: WAGE_GUIDANCE.kicker,
      title: WAGE_GUIDANCE.title,
      detail: WAGE_GUIDANCE.detail,
      targetLocation: LOCATION,
      targetFacilityId: player(runtime).facilityId ?? FAC.field,
      actionPanel: null,
    };
  }
  const fromBase = base.authoredMissionFlowGuidance(runtime);
  if (fromBase) return fromBase;
  if (!ownEligible(runtime)) return null;
  return {
    missionId: null,
    kicker: WAGE_GUIDANCE.kicker,
    title: WAGE_GUIDANCE.title,
    detail: WAGE_GUIDANCE.detail,
    targetLocation: LOCATION,
    targetFacilityId: player(runtime).facilityId ?? FAC.field,
    actionPanel: null,
  };
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_VILLAGE_FIRST_WAGES_INTERNALS = Object.freeze({
  LOCATION,
  STATE_KEY,
  WAGE_SCENE,
  FAC,
  NPC,
  BROKE_THRESHOLD,
  HUNGRY_ENOUGH,
  WAGE_CHOICES,
  WAGE_GUIDANCE,
  isBroke,
  readState,
  ensureState,
  ownEligible,
  eligible,
  actionIdFor,
  actionFor,
  actions,
  consume,
});
