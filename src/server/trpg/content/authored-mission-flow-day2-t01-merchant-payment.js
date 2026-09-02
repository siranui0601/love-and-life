import * as base from "./authored-mission-flow-day1-t01-village-night-canonical.js";

export * from "./authored-mission-flow-day1-t01-village-night-canonical.js";

export const AUTHORED_DAY2_T01_MERCHANT_PAYMENT_VERSION = "authored-day2-t01-merchant-payment-v2";

const MISSION_ID = "MSN-T01";
const LOCATION = "田園の村";
const FACILITY_ID = "LOC_FARM_BAKERY";
const SCENE_ID = "t01-day2-merchant-payment";
const SOURCE_ACTION_ID = "MISSION_FLOW:T01:DAY2_MERCHANT:help_unload";
const MERCHANT_ID = "NPC008";

const CHOICES = Object.freeze([
  Object.freeze({
    id: "take_three_gold",
    label: "三Gを受け取る",
    family: "work",
    minutes: 4,
    goldDelta: 3,
    summary: "荷運びの賃金として小銭三枚を受け取った。わずかな額でも、身分も所持金もない朝には自分で使い道を決められる最初の稼ぎになった。",
    speech: "はい、きっちり三G。少ないと思うなら次は荷札まで読める仕事を頼むよ。働いた分を受け取るのは、遠慮するところじゃない。",
    worldFlag: "day2Merchant:cashWageTaken",
    historyType: "DAY2_MERCHANT_CASH_WAGE_TAKEN",
  }),
  Object.freeze({
    id: "take_two_black_breads",
    label: "黒パンを二つ貰う",
    family: "life",
    minutes: 6,
    itemId: "ITM008",
    itemCount: 2,
    summary: "現金の代わりに黒パンを二つ受け取った。一つは今日の食事に、もう一つは街道へ出る時のために布で包んだ。",
    speech: "村のパン屋から今朝仕入れた分だ。派手じゃないけど腹持ちはいい。旅に出るなら、銅貨より先に食べ物が役立つ日もある。",
    worldFlag: "day2Merchant:blackBreadPaymentTaken",
    historyType: "DAY2_MERCHANT_BLACK_BREAD_PAYMENT_TAKEN",
  }),
  Object.freeze({
    id: "ask_capital_delivery",
    label: "王都便を頼む",
    family: "contract",
    minutes: 12,
    summary: "報酬の代わりに、次の王都便へ小さな荷物か伝言を一つ載せてもらう約束を取り付けた。今は送る物がなくても、街道を自分だけで歩かない手段が残った。",
    speech: "大箱は無理だけど、封書か手提げ一つなら次の王都便に載せる。使う時は昼までに持ってきな。名前を出したくない荷は断るよ。",
    worldFlag: "day2Merchant:capitalDeliveryCredit",
    historyType: "DAY2_MERCHANT_CAPITAL_DELIVERY_CREDIT",
    contractId: "CONTRACT-DAY2-RIONA-CAPITAL-SMALL-DELIVERY",
  }),
]);

function array(value) { return Array.isArray(value) ? value : []; }
function player(runtime) { return runtime?.playerState?.player ?? runtime?.playerState ?? {}; }
function hasHistory(runtime, type) { return array(runtime?.playerState?.history).some((entry) => entry?.type === type); }

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.day2T01MerchantPayment ??= {
    version: AUTHORED_DAY2_T01_MERCHANT_PAYMENT_VERSION,
    completedAtMinute: null,
    selectedActionId: null,
    closedActionIds: [],
    contractId: null,
  };
  const state = runtime.playerState.day2T01MerchantPayment;
  state.version = AUTHORED_DAY2_T01_MERCHANT_PAYMENT_VERSION;
  state.closedActionIds = array(state.closedActionIds).map(String);
  return state;
}

function eligible(runtime) {
  const current = player(runtime);
  return current.location === LOCATION
    && current.facilityId === FACILITY_ID
    && hasHistory(runtime, "DAY2_MERCHANT_UNLOADING_HELPED")
    && ensureState(runtime).completedAtMinute == null;
}

function actionFor(choice) {
  return {
    id: `MISSION_FLOW:T01:DAY2_MERCHANT_PAYMENT:${choice.id}`,
    family: choice.family,
    type: "plan",
    minutes: choice.minutes,
    label: choice.label,
    targetNpcId: MERCHANT_ID,
    targetLocation: LOCATION,
    targetFacilityId: FACILITY_ID,
    dialogueTopic: `t01_day2_payment_${choice.id}`,
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredDay2T01MerchantPaymentChoice: true,
    authoredDay2T01MerchantPaymentSceneId: SCENE_ID,
    authoredDay2T01MerchantPaymentSummary: choice.summary,
    authoredDay2T01MerchantPaymentSpeech: { actorId: MERCHANT_ID, text: choice.speech, emotion: "明るく実務的" },
    authoredDay2T01MerchantPaymentWorldFlag: choice.worldFlag,
    authoredDay2T01MerchantPaymentHistoryType: choice.historyType,
    authoredDay2T01MerchantPaymentGoldDelta: choice.goldDelta ?? 0,
    authoredDay2T01MerchantPaymentItemId: choice.itemId ?? null,
    authoredDay2T01MerchantPaymentItemCount: choice.itemCount ?? 0,
    authoredDay2T01MerchantPaymentContractId: choice.contractId ?? null,
  };
}

function actions(runtime) { return eligible(runtime) ? CHOICES.map(actionFor) : null; }

function addInventory(runtime, itemId, count) {
  if (!itemId || count <= 0) return;
  runtime.playerState.inventory ??= {};
  if (Array.isArray(runtime.playerState.inventory)) {
    const found = runtime.playerState.inventory.find((entry) => entry?.itemId === itemId || entry?.id === itemId);
    if (found) found.count = Number(found.count ?? 0) + count;
    else runtime.playerState.inventory.push({ itemId, count });
  } else {
    runtime.playerState.inventory[itemId] = Number(runtime.playerState.inventory[itemId] ?? 0) + count;
  }
}

function consume(runtime, action, result) {
  if (!action?.authoredDay2T01MerchantPaymentChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (state.completedAtMinute != null) return false;
  const minute = Number(runtime.playerState.absoluteMinute ?? 0);
  const ids = CHOICES.map((choice) => actionFor(choice).id);
  const current = player(runtime);
  const goldBefore = Number(current.gold ?? runtime.playerState.gold ?? 0);
  const goldAfter = goldBefore + Number(action.authoredDay2T01MerchantPaymentGoldDelta ?? 0);
  current.gold = goldAfter;
  runtime.playerState.gold = goldAfter;
  addInventory(runtime, action.authoredDay2T01MerchantPaymentItemId, action.authoredDay2T01MerchantPaymentItemCount);

  state.completedAtMinute = minute;
  state.selectedActionId = action.id;
  state.closedActionIds = ids.filter((id) => id !== action.id);
  state.contractId = action.authoredDay2T01MerchantPaymentContractId;

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.contracts ??= {};
  runtime.playerState.worldFlags[action.authoredDay2T01MerchantPaymentWorldFlag] = true;
  if (state.contractId) {
    runtime.playerState.contracts[state.contractId] = {
      id: state.contractId,
      providerNpcId: MERCHANT_ID,
      status: "available",
      createdAtMinute: minute,
      origin: LOCATION,
      destination: "王都",
      cargoLimit: "small",
    };
  }
  runtime.playerState.history.push({
    type: action.authoredDay2T01MerchantPaymentHistoryType,
    minute,
    missionId: MISSION_ID,
    sceneId: SCENE_ID,
    actionId: action.id,
    sourceActionId: SOURCE_ACTION_ID,
    closedActionIds: [...state.closedActionIds],
    goldBefore,
    goldAfter,
    itemId: action.authoredDay2T01MerchantPaymentItemId,
    itemCount: action.authoredDay2T01MerchantPaymentItemCount,
    contractId: state.contractId,
    location: current.location ?? null,
    facilityId: current.facilityId ?? FACILITY_ID,
  });

  result.summary = action.authoredDay2T01MerchantPaymentSummary;
  result.speeches = [action.authoredDay2T01MerchantPaymentSpeech];
  result.gold = { before: goldBefore, after: goldAfter };
  result.itemDelta = action.authoredDay2T01MerchantPaymentItemId
    ? { itemId: action.authoredDay2T01MerchantPaymentItemId, count: action.authoredDay2T01MerchantPaymentItemCount }
    : null;
  result.contractId = state.contractId;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return actions(runtime) ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (eligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "荷台が空になると、リオナが腰の小銭袋を鳴らした",
      title: "荷ほどきの報酬",
      detail: "現金、食料、街道の便。働いた対価を何で受け取るかは、今日の暮らし方を変える。",
      targetLocation: LOCATION,
      targetFacilityId: FACILITY_ID,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_DAY2_T01_MERCHANT_PAYMENT_INTERNALS = Object.freeze({
  ensureState, hasHistory, eligible, actionFor, actions, consume, CHOICES, SCENE_ID, SOURCE_ACTION_ID, MERCHANT_ID, FACILITY_ID,
});