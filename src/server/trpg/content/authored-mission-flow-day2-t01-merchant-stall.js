import * as base from "./authored-mission-flow-day2-t01-merchant-payment.js";

export * from "./authored-mission-flow-day2-t01-merchant-payment.js";

export const AUTHORED_DAY2_T01_MERCHANT_STALL_VERSION = "authored-day2-t01-merchant-stall-v1";

const MISSION_ID = "MSN-T01";
const LOCATION = "田園の村";
const FACILITY_ID = "LOC_FARM_INN";
const MERCHANT_ID = "NPC008";
const HUNTER_ID = "NPC060";
const STALL_SCENE_ID = "t01-day2-merchant-stall";
const PAYMENT_SOURCE = "DAY2_MERCHANT_CASH_WAGE_TAKEN";

const STALL_CHOICES = Object.freeze([
  Object.freeze({
    id: "buy_black_bread",
    label: "黒パンを買う",
    family: "buy",
    minutes: 5,
    price: 1,
    itemId: "ITM008",
    itemCount: 1,
    nextSceneId: "t01-day2-bread-use",
    summary: "受け取ったばかりの賃金から一Gを払い、黒パンを一つ買った。働いた対価を、その日の食事へ変えた。",
    speech: "一G、確かに。今朝焼いた分だから固くなる前に食べてもいいし、街道へ持っていってもいい。",
    worldFlag: "day2Merchant:blackBreadPurchased",
    historyType: "DAY2_MERCHANT_BLACK_BREAD_PURCHASED",
  }),
  Object.freeze({
    id: "copy_prices",
    label: "値段を書き留める",
    family: "information",
    minutes: 10,
    nextSceneId: "t01-day2-price-notes",
    summary: "リオナの許可を得て、黒パン、保存パン、薬草、荷車の値段を紙片へ書き留めた。今の値段は、事件が起きた後に初めて比較材料になる。",
    speech: "値段は今日のものだよ。火事も雨も狼も、明日の値札を変える。日付まで書くなら好きに写しな。",
    worldFlag: "day2Merchant:baselinePricesCopied",
    historyType: "DAY2_MERCHANT_BASELINE_PRICES_COPIED",
  }),
  Object.freeze({
    id: "take_hunter_parcel",
    label: "猟師の荷を預かる",
    family: "delivery",
    minutes: 8,
    nextSceneId: "t01-day2-hunter-parcel",
    summary: "リオナから、猟師ジルへ届ける塩と罠紐の小包を預かった。報酬より先に、村外れへ向かう理由が一つ増えた。",
    speech: "ジルに渡す荷だ。開けなければ軽い仕事、なくせば高い仕事になる。今日中なら助かるよ。",
    worldFlag: "day2Merchant:hunterParcelAccepted",
    historyType: "DAY2_MERCHANT_HUNTER_PARCEL_ACCEPTED",
    contractId: "CONTRACT-DAY2-RIONA-HUNTER-PARCEL",
  }),
]);

const FOLLOWUPS = Object.freeze({
  "t01-day2-bread-use": Object.freeze({
    title: "買った黒パン",
    kicker: "紙袋から、まだ温かい麦の匂いがした",
    detail: "一つだけ買った黒パンを、今どう使うか決める。",
    choices: Object.freeze([
      Object.freeze({ id: "eat_now", label: "今ここで食べる", family: "life", minutes: 8, hungerDelta: -16, summary: "荷車の脇で黒パンを食べた。焼きたての一つは、保存食よりも今朝の空腹を確かに軽くした。", speech: "食べ方としては正解。腹が空いたまま値段を見ても、全部安く見えるからね。", worldFlag: "day2Merchant:purchasedBreadEaten", historyType: "DAY2_PURCHASED_BREAD_EATEN" }),
      Object.freeze({ id: "wrap_for_road", label: "街道用に包む", family: "preparation", minutes: 4, summary: "黒パンを布で包み直し、街道へ出る時の食料として残した。", speech: "それなら水気のある物と一緒にするな。夕方には匂いが移る。", worldFlag: "day2Merchant:purchasedBreadPacked", historyType: "DAY2_PURCHASED_BREAD_PACKED" }),
      Object.freeze({ id: "give_to_finn", label: "フィンに渡す", family: "relationship", minutes: 7, targetNpcId: "NPC001", summary: "療養中のフィンへ黒パンを届けた。大げさな見舞いではないが、昨日助けた後も気にかけていることは伝わった。", speech: "ぼく、もう大丈夫だよ。……でも半分こなら食べる。今度は勝手に森へ行かないから。", worldFlag: "day2Merchant:breadSharedWithFinn", historyType: "DAY2_BREAD_SHARED_WITH_FINN" }),
    ]),
  }),
  "t01-day2-price-notes": Object.freeze({
    title: "今朝の値段",
    kicker: "紙片には、事件が起きる前の値札が並んだ",
    detail: "書き写した相場を、誰に見せるか、どこへ残すかを決める。",
    choices: Object.freeze([
      Object.freeze({ id: "show_chief", label: "村長に見せる", family: "record", minutes: 12, targetNpcId: "NPC003", summary: "今朝の相場表をガロ村長へ見せ、村務帳へ写しを残した。後日の価格変動を、公的な記録と比較できるようになった。", speech: "値段は記憶だけでは争いになる。日付と売り手が分かるなら、村務帳へ写しておこう。", worldFlag: "day2Merchant:pricesEnteredVillageLedger", historyType: "DAY2_PRICES_ENTERED_VILLAGE_LEDGER", evidenceId: "T02-EVIDENCE-DAY2-BASELINE-PRICES", evidenceSource: "LOC_FARM_SQUARE:VILLAGE_DUTY_LEDGER" }),
      Object.freeze({ id: "ask_baker", label: "パン屋に聞く", family: "conversation", minutes: 10, targetNpcId: "NPC059", summary: "パン屋のパオロに仕入れ値との違いを聞いた。黒パンの値段は小麦だけでなく、薪と街道の安全にも左右されると知った。", speech: "小麦だけ見ても値段は読めないよ。薪が濡れても、荷車が遅れても、焼ける数は減るんだ。", worldFlag: "day2Merchant:bakerPriceContextKnown", historyType: "DAY2_BAKER_PRICE_CONTEXT_LEARNED" }),
      Object.freeze({ id: "keep_notes", label: "紙片をしまう", family: "information", minutes: 2, summary: "相場を書いた紙片を折り、手元へしまった。誰にも見せない記録は、後で自分だけが知る比較材料になる。", speech: "なくすなよ。値札は嘘をつかないけど、紙片は風に負ける。", worldFlag: "day2Merchant:privatePriceNotesKept", historyType: "DAY2_PRIVATE_PRICE_NOTES_KEPT" }),
    ]),
  }),
  "t01-day2-hunter-parcel": Object.freeze({
    title: "猟師への小包",
    kicker: "塩と罠紐の包みには、ジルの名札が結ばれていた",
    detail: "今日中に届ける小包を、どう扱うか決める。",
    choices: Object.freeze([
      Object.freeze({ id: "leave_for_hut", label: "狩人小屋へ向かう", family: "move", minutes: 42, targetNpcId: HUNTER_ID, summary: "村外れの道を歩き、猟師ジルの小屋へ小包を届けた。小屋の軒には、昨日より新しい狼の毛が引っかかっていた。", speech: "リオナの荷か。助かる。……帰り道、北の柵へ寄るな。狼が人里を測り始めている。", worldFlag: "day2Merchant:hunterParcelDelivered", historyType: "DAY2_HUNTER_PARCEL_DELIVERED", destination: "森", facilityId: "LOC_FOREST_HUNTER_HUT", evidenceId: "T03-EVIDENCE-HUNTER-FRESH-WOLF-TRACE", evidenceSource: "LOC_FOREST_HUNTER_HUT:EAVES" }),
      Object.freeze({ id: "leave_with_chief", label: "村長に預ける", family: "delegation", minutes: 9, targetNpcId: "NPC003", summary: "小包をガロ村長へ預け、村の次の使いへ託した。自分は村を離れず、配送だけをGOAPへ引き渡した。", speech: "預かろう。昼の見回りが小屋へ寄る。届けた者の名も、リオナには伝えておく。", worldFlag: "day2Merchant:hunterParcelDelegated", historyType: "DAY2_HUNTER_PARCEL_DELEGATED" }),
      Object.freeze({ id: "carry_later", label: "あとで届ける", family: "delay", minutes: 1, summary: "小包を荷物へ入れ、今日中に届ける約束だけを残した。時間を自由に使える代わりに、未完了の配送を抱えた。", speech: "日暮れまでだよ。遅れるなら先に言う。それも荷運びのうちだからね。", worldFlag: "day2Merchant:hunterParcelCarried", historyType: "DAY2_HUNTER_PARCEL_CARRIED" }),
    ]),
  }),
});

function array(value) { return Array.isArray(value) ? value : []; }
function player(runtime) { return runtime?.playerState?.player ?? runtime?.playerState ?? {}; }
function hasHistory(runtime, type) { return array(runtime?.playerState?.history).some((entry) => entry?.type === type); }

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.day2T01MerchantStall ??= { version: AUTHORED_DAY2_T01_MERCHANT_STALL_VERSION, stall: null, followup: null };
  runtime.playerState.day2T01MerchantStall.version = AUTHORED_DAY2_T01_MERCHANT_STALL_VERSION;
  return runtime.playerState.day2T01MerchantStall;
}

function stallEligible(runtime) {
  const current = player(runtime);
  const state = ensureState(runtime);
  return current.location === LOCATION && hasHistory(runtime, PAYMENT_SOURCE) && state.stall == null;
}

function followupScene(runtime) {
  const state = ensureState(runtime);
  if (!state.stall || state.followup) return null;
  return FOLLOWUPS[state.stall.nextSceneId] ?? null;
}

function stallAction(choice) {
  return {
    id: `MISSION_FLOW:T01:DAY2_MERCHANT_STALL:${choice.id}`,
    type: "plan", family: choice.family, minutes: choice.minutes, label: choice.label,
    targetNpcId: MERCHANT_ID, dialogueExit: true, authoredMissionFlowExclusiveChoice: true,
    authoredDay2T01MerchantStallChoice: true, authoredDay2T01MerchantStallSceneId: STALL_SCENE_ID,
    authoredDay2T01MerchantStallData: choice,
  };
}

function followupAction(sceneId, choice) {
  return {
    id: `MISSION_FLOW:T01:DAY2_MERCHANT_FOLLOWUP:${sceneId}:${choice.id}`,
    type: "plan", family: choice.family, minutes: choice.minutes, label: choice.label,
    targetNpcId: choice.targetNpcId ?? MERCHANT_ID, dialogueExit: true, authoredMissionFlowExclusiveChoice: true,
    authoredDay2T01MerchantFollowupChoice: true, authoredDay2T01MerchantFollowupSceneId: sceneId,
    authoredDay2T01MerchantFollowupData: choice,
  };
}

function actions(runtime) {
  if (stallEligible(runtime)) return STALL_CHOICES.map(stallAction);
  const scene = followupScene(runtime);
  const sceneId = ensureState(runtime).stall?.nextSceneId;
  return scene ? scene.choices.map((choice) => followupAction(sceneId, choice)) : null;
}

function addInventory(runtime, itemId, count) {
  runtime.playerState.inventory ??= {};
  runtime.playerState.inventory[itemId] = Number(runtime.playerState.inventory[itemId] ?? 0) + count;
}

function removeInventory(runtime, itemId, count) {
  runtime.playerState.inventory ??= {};
  runtime.playerState.inventory[itemId] = Math.max(0, Number(runtime.playerState.inventory[itemId] ?? 0) - count);
}

function appendHistory(runtime, entry) {
  runtime.playerState.history ??= [];
  runtime.playerState.history.push(entry);
}

function saveEvidence(runtime, choice, minute) {
  if (!choice.evidenceId) return;
  runtime.playerState.evidence ??= {};
  runtime.playerState.evidence[choice.evidenceId] = { id: choice.evidenceId, source: choice.evidenceSource, acquiredAtMinute: minute };
}

function consumeStall(runtime, action, result) {
  if (!action?.authoredDay2T01MerchantStallChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (state.stall) return false;
  const choice = action.authoredDay2T01MerchantStallData;
  const current = player(runtime);
  const goldBefore = Number(current.gold ?? runtime.playerState.gold ?? 0);
  if (choice.price && goldBefore < choice.price) {
    result.ok = false;
    result.summary = "手持ちが足りず、買うことはできなかった。";
    return true;
  }
  const minute = Number(runtime.playerState.absoluteMinute ?? 0);
  const goldAfter = goldBefore - Number(choice.price ?? 0);
  current.gold = goldAfter;
  runtime.playerState.gold = goldAfter;
  if (choice.itemId) addInventory(runtime, choice.itemId, choice.itemCount);
  if (choice.contractId) {
    runtime.playerState.contracts ??= {};
    runtime.playerState.contracts[choice.contractId] = { id: choice.contractId, providerNpcId: MERCHANT_ID, recipientNpcId: HUNTER_ID, status: "accepted", createdAtMinute: minute, dueAtMinute: minute + 600 };
  }
  const ids = STALL_CHOICES.map((entry) => stallAction(entry).id);
  state.stall = { sceneId: STALL_SCENE_ID, selectedActionId: action.id, closedActionIds: ids.filter((id) => id !== action.id), completedAtMinute: minute, nextSceneId: choice.nextSceneId };
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags[choice.worldFlag] = true;
  appendHistory(runtime, { type: choice.historyType, minute, missionId: MISSION_ID, sceneId: STALL_SCENE_ID, actionId: action.id, closedActionIds: [...state.stall.closedActionIds], nextSceneId: choice.nextSceneId, goldBefore, goldAfter, itemId: choice.itemId ?? null, itemCount: choice.itemCount ?? 0, contractId: choice.contractId ?? null });
  result.summary = choice.summary;
  result.speeches = [{ actorId: MERCHANT_ID, text: choice.speech, emotion: "明るく実務的" }];
  result.gold = { before: goldBefore, after: goldAfter };
  result.itemDelta = choice.itemId ? { itemId: choice.itemId, count: choice.itemCount } : null;
  result.nextSceneId = choice.nextSceneId;
  return true;
}

function consumeFollowup(runtime, action, result) {
  if (!action?.authoredDay2T01MerchantFollowupChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (!state.stall || state.followup) return false;
  const choice = action.authoredDay2T01MerchantFollowupData;
  const sceneId = action.authoredDay2T01MerchantFollowupSceneId;
  const scene = FOLLOWUPS[sceneId];
  if (!scene) return false;
  const minute = Number(runtime.playerState.absoluteMinute ?? 0);
  const ids = scene.choices.map((entry) => followupAction(sceneId, entry).id);
  const current = player(runtime);
  if (sceneId === "t01-day2-bread-use" && choice.id !== "wrap_for_road") removeInventory(runtime, "ITM008", 1);
  if (choice.hungerDelta) current.hunger = Math.max(0, Number(current.hunger ?? 0) + choice.hungerDelta);
  if (choice.destination) current.location = choice.destination;
  if (choice.facilityId) current.facilityId = choice.facilityId;
  if (state.stall?.selectedActionId?.endsWith(":take_hunter_parcel")) {
    const contract = runtime.playerState.contracts?.["CONTRACT-DAY2-RIONA-HUNTER-PARCEL"];
    if (contract) contract.status = choice.id === "carry_later" ? "accepted" : choice.id === "leave_with_chief" ? "delegated" : "completed";
  }
  state.followup = { sceneId, selectedActionId: action.id, closedActionIds: ids.filter((id) => id !== action.id), completedAtMinute: minute };
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags[choice.worldFlag] = true;
  saveEvidence(runtime, choice, minute);
  appendHistory(runtime, { type: choice.historyType, minute, missionId: MISSION_ID, sceneId, actionId: action.id, sourceActionId: state.stall.selectedActionId, closedActionIds: [...state.followup.closedActionIds], evidenceId: choice.evidenceId ?? null, evidenceSource: choice.evidenceSource ?? null, location: current.location, facilityId: current.facilityId });
  result.summary = choice.summary;
  result.speeches = [{ actorId: choice.targetNpcId ?? MERCHANT_ID, text: choice.speech, emotion: choice.targetNpcId === "NPC001" ? "照れながら" : "実務的" }];
  result.evidenceId = choice.evidenceId ?? null;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return actions(runtime) ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (stallEligible(runtime)) return { missionId: MISSION_ID, kicker: "賃金を受け取ると、荷車の片側が小さな店になった", title: "行商人の朝市", detail: "買う、相場を残す、配送を引き受ける。三Gの先にある行動を選ぶ。", targetLocation: LOCATION, targetFacilityId: FACILITY_ID, actionPanel: null };
  const scene = followupScene(runtime);
  if (scene) return { missionId: MISSION_ID, kicker: scene.kicker, title: scene.title, detail: scene.detail, targetLocation: player(runtime).location ?? LOCATION, targetFacilityId: player(runtime).facilityId ?? FACILITY_ID, actionPanel: null };
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consumeStall(runtime, action, result) || consumeFollowup(runtime, action, result) || changed;
}

export const AUTHORED_DAY2_T01_MERCHANT_STALL_INTERNALS = Object.freeze({ ensureState, stallEligible, followupScene, stallAction, followupAction, actions, consumeStall, consumeFollowup, STALL_CHOICES, FOLLOWUPS, STALL_SCENE_ID });
