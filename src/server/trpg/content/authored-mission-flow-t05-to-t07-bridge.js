import * as base from "./authored-mission-flow-village-water-trail.js";
import { ensureAuthoredMissionFlowState } from "./authored-mission-flow-core.js";

export * from "./authored-mission-flow-village-water-trail.js";

export const AUTHORED_T05_TO_T07_BRIDGE_VERSION = "authored-t05-to-t07-bridge-v1";

// 毒殺事件を片づけた後、同じ港と同じ運び手のところに別のものが流れている。
//
// 正本ではリュシアはDay18に自分の意思で里を出て、Day25に捕縛され、Day31に王都下層、
// Day39に犯罪都市へ移される。正史の聞き取り相手は森の斥候セリエだが、
// 交易都市で毒の経路を追った者には、搬送側から先に見えるものがある。
//
// この層はT07を解決しない。セリエにも会っていないので聞き取りも済ませない。
// 搬送線を実際に覗いた分だけを、正史の手掛かり名で登録して渡す。

const FLOW_ID = "runaway-elf-trafficking";
const MISSION_ID = "MSN-T07";
const TROUBLE_ID = "T07";
const LOCATION = "交易都市";
const STATE_KEY = "t05ToT07Bridge";
const BRIDGE_SCENE = "t07-cargo-with-people-in-it";

const FAC = Object.freeze({
  port: "LOC_TRADE_PORT",
  customs: "LOC_TRADE_CUSTOMS",
  stable: "LOC_TRADE_STABLE",
  manor: "LOC_TRADE_LORD_MANOR",
  guild: "LOC_TRADE_GUILD",
});

const NPC = Object.freeze({
  ceres: "NPC052",
  ernesto: "NPC075",
  gaspar: "NPC078",
  lucia: "NPC027",
});

const TERMINAL = new Set(["completed", "resolved", "terminal", "failed", "abandoned"]);
const SETTLED = new Set(["completed", "resolved", "terminal"]);

// Day20〜Day38。捕縛（Day25）から王都下層（Day31）へ移される時期を跨ぐ。
// この橋はT05が片づいていることを条件にする。正本のT05の生死判定はDay38なので、
// Day39 00:00 で閉じると、判定当日に解決した回には数時間しか残らない。
// 渡す先はT07で、その救出期限がDay48である。リュシアが手の届く間は開けておく。
const BRIDGE_OPEN_MINUTE = 19 * 1440;
const BRIDGE_CLOSE_MINUTE = 48 * 1440;

// 毒殺事件をどう終わらせたかで、搬送線に気づく角度が変わる。
const T05_CONTEXTS = Object.freeze({
  protect_nicolas_and_treat: Object.freeze({
    id: "protection_network",
    kicker: "ニコラスと妹を匿う段取りを組んだせいで、人を隠して運ぶ相場が耳に入る",
    detail:
      "使用人とその妹を安全に逃がすため、宿と船と口の堅い者を手配した。同じ手配を、同じ値で、もっと若い娘のために買っている者がいると港で聞いた。",
  }),
  buy_crime_ledger_antidote: Object.freeze({
    id: "crime_ledger",
    kicker: "買い取った原本台帳には、毒とは別の品目が同じ運び手の名で並んでいた",
    detail:
      "モズから買った台帳は毒の経路を証明したが、同じ頁の下段には荷の中身が書かれていない行が続く。数と日付だけがあり、重さの単位が人のそれに近い。",
  }),
  royal_physician_public_indictment: Object.freeze({
    id: "public_channel",
    kicker: "王都へ証拠を送る便を組んだ帰り、同じ便に妙な後見状が積まれていた",
    detail:
      "公開審問へ回す書類を託した使者の荷に、見慣れない後見状の写しが混じっていた。保護者の署名だけが新しく、被保護者の名は種族欄ごと空白になっている。",
  }),
});

const DEFAULT_CONTEXT = Object.freeze({
  id: "port_rumor",
  kicker: "領主館の一件が落ち着いた頃、港の荷役だけが妙に静かになっている",
  detail:
    "毒の経路を追ったせいで、この街の荷の流れを普通より細かく見るようになった。積み替えの手順が一つだけ、人を扱う時のそれになっている便がある。",
});

const BRIDGE_CHOICES = Object.freeze([
  Object.freeze({
    id: "ask_ceres_about_cargo",
    label: "セレス船長に積荷を聞く",
    family: "talk",
    minutes: 58,
    facility: FAC.port,
    actorId: NPC.ceres,
    canonicalLeadIds: ["crime_dock_manifest"],
    summary:
      "荷運び船長のセレスへ、犯罪都市行きの便で中身の書かれていない荷について聞いた。セレスは自分の船では請けないと前置きしたうえで、断った仕事の日付と積み替え場所を教えた。",
    speech: Object.freeze({
      actorId: NPC.ceres,
      text: "うちは請けない。息をする荷は運ばん。……だが断れば別の船が請けるだけだ。積み替えは夜の外れ桟橋。呼吸の分だけ、藁を厚く敷く。それで見分けがつく。",
      emotion: "断った側の後ろめたさ",
    }),
    worldFlags: ["t07CargoManifestGapSeen", "t07CeresRefusedTheJob"],
    historyType: "T07_BRIDGE_CARGO_MANIFEST_GAP",
    evidenceId: "T07-EVIDENCE-BRIDGE-BREATHING-CARGO",
    evidenceSourceId: "NPC052:REFUSED_CHARTER_LOG",
  }),
  Object.freeze({
    id: "check_customs_papers",
    label: "税関の通行記録を当たる",
    family: "investigate",
    minutes: 64,
    facility: FAC.customs,
    actorId: NPC.ernesto,
    canonicalLeadIds: ["damian_false_contract"],
    summary:
      "税関詰所で、この一月に通した後見状の控えを繰った。同じ筆跡の後見状が三通あり、いずれも被保護者の年齢欄だけが後から書き足されている。保護者の名は全て同じ人間のものだった。",
    speech: Object.freeze({
      actorId: NPC.ernesto,
      text: "書式は正しい。だから通した。……だが同じ手が三通は多い。しかも年齢欄の墨だけ新しい。書式が正しいことと、中身が正しいことは違う。それは私の仕事の外だ。",
      emotion: "職務の線引きと、割り切れなさ",
    }),
    worldFlags: ["t07ForgedGuardianshipFound", "t07SameHandThreePapers"],
    historyType: "T07_BRIDGE_FORGED_GUARDIANSHIP",
    evidenceId: "T07-EVIDENCE-BRIDGE-TRIPLE-GUARDIANSHIP",
    evidenceSourceId: "LOC_TRADE_CUSTOMS:GUARDIANSHIP_COUNTERFOILS",
  }),
  Object.freeze({
    id: "secure_fast_horse",
    label: "王都行きの早馬を押さえる",
    family: "prepare",
    minutes: 46,
    facility: FAC.stable,
    actorId: NPC.gaspar,
    canonicalLeadIds: ["capital_inn_order"],
    summary:
      "馬市で王都まで最短で走れる馬を押さえた。手配の途中で、同じ週に王都下層の安宿へ『連れを人目に触れさせずに泊める』注文を回した者がいると分かった。",
    speech: Object.freeze({
      actorId: NPC.gaspar,
      text: "急ぎならこの馬だ。……ああ、先週も急ぎがいたよ。王都の下のほうの宿へ、部屋を裏から入れるようにしろって注文をな。荷が人なら、そういう頼み方になる。",
      emotion: "商売として覚えているだけ",
    }),
    worldFlags: ["t07CapitalInnOrderHeard", "t07FastHorseSecured"],
    historyType: "T07_BRIDGE_CAPITAL_INN_ORDER",
    evidenceId: "T07-EVIDENCE-BRIDGE-BACKDOOR-LODGING-ORDER",
    evidenceSourceId: "NPC078:HORSE_MARKET_ERRAND_MEMORY",
  }),
]);

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function values(value) {
  if (Array.isArray(value)) return value;
  if (value instanceof Map) return [...value.values()];
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function absoluteMinute(runtime) {
  return Number(runtime?.playerState?.absoluteMinute ?? 0);
}

function findMission(runtime, missionId) {
  const collections = [
    runtime?.playerState?.missions,
    runtime?.missions,
    runtime?.playerState?.missionById,
    runtime?.missionById,
  ];
  for (const collection of collections) {
    if (collection instanceof Map && collection.has(missionId)) return collection.get(missionId);
    const direct = collection?.[missionId];
    if (direct) return direct;
    const found = values(collection).find((entry) => entry?.id === missionId);
    if (found) return found;
  }
  return null;
}

function statusOf(value) {
  return String(value?.status ?? value ?? "");
}

function t05Settled(runtime) {
  return SETTLED.has(statusOf(findMission(runtime, "MSN-T05")))
    || SETTLED.has(statusOf(runtime?.playerState?.troubles?.T05));
}

function t07Open(runtime) {
  const mission = findMission(runtime, MISSION_ID);
  const trouble = runtime?.playerState?.troubles?.[TROUBLE_ID];
  if (mission && TERMINAL.has(statusOf(mission))) return false;
  if (trouble != null && TERMINAL.has(statusOf(trouble))) return false;
  // 森でセリエから正史の聞き取りに入っていれば、導線はそちらが持っている。
  const flow = runtime?.authoredMissionFlows?.[FLOW_ID];
  if (flow && (flow.openingChoiceId || arr(flow.evidenceIds).length > 0)) return false;
  return true;
}

function luciaStillRecoverable(runtime) {
  const state = runtime?.livingWorld?.npcStates?.[NPC.lucia];
  if (!state) return true;
  const lost = new Set(["dead", "deceased", "killed", "sold"]);
  return !lost.has(String(state.status ?? state.lifeStatus ?? ""));
}

export function t05ContextFor(runtime) {
  const route = runtime?.playerState?.worldFlags?.t05ResolutionRoute;
  return T05_CONTEXTS[String(route ?? "")] ?? DEFAULT_CONTEXT;
}

function inTradeCity(runtime) {
  return player(runtime).location === LOCATION;
}

function withinBridgeWindow(runtime) {
  const minute = absoluteMinute(runtime);
  return minute >= BRIDGE_OPEN_MINUTE && minute < BRIDGE_CLOSE_MINUTE;
}

function readState(runtime) {
  const state = runtime?.playerState?.[STATE_KEY];
  return state && typeof state === "object" ? state : null;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_T05_TO_T07_BRIDGE_VERSION,
    completedAtMinute: null,
    selectedActionId: null,
    closedActionIds: [],
    t05ContextId: null,
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_T05_TO_T07_BRIDGE_VERSION;
  state.closedActionIds = arr(state.closedActionIds).map(String);
  return state;
}

export function eligible(runtime) {
  if (!t05Settled(runtime)) return false;
  if (!t07Open(runtime)) return false;
  if (!luciaStillRecoverable(runtime)) return false;
  if (!inTradeCity(runtime) || !withinBridgeWindow(runtime)) return false;
  return readState(runtime)?.completedAtMinute == null;
}

function actionIdFor(choice) {
  return `MISSION_FLOW:T07:CARGO_BRIDGE:${choice.id}`;
}

function actionFor(runtime, choice) {
  const id = actionIdFor(choice);
  return {
    id,
    actionId: id,
    family: choice.family,
    type: "plan",
    minutes: choice.minutes,
    label: choice.label,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    targetLocation: LOCATION,
    targetFacilityId: choice.facility,
    targetNpcId: choice.actorId,
    dialogueTopic: `t07_cargo_${choice.id}`,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredT07BridgeChoice: true,
    authoredT07BridgeContextId: t05ContextFor(runtime).id,
    authoredT07BridgeSummary: choice.summary,
    authoredT07BridgeSpeech: choice.speech,
    authoredT07BridgeWorldFlags: choice.worldFlags,
    authoredT07BridgeHistoryType: choice.historyType,
    authoredT07BridgeEvidenceId: choice.evidenceId,
    authoredT07BridgeEvidenceSourceId: choice.evidenceSourceId,
    authoredT07BridgeCanonicalLeadIds: choice.canonicalLeadIds,
  };
}

function actions(runtime) {
  if (!eligible(runtime)) return null;
  return BRIDGE_CHOICES.map((choice) => actionFor(runtime, choice));
}

// 搬送側から覗いた分だけを正史の名前で渡す。
// セリエには会っていないので、聞き取り工程は決して済ませない。
function handOffToCanonicalFlow(runtime, action) {
  const flow = ensureAuthoredMissionFlowState(runtime, FLOW_ID);
  if (!flow) return false;
  flow.unlockedLeadIds = [...new Set([
    ...arr(flow.unlockedLeadIds).map(String),
    ...arr(action.authoredT07BridgeCanonicalLeadIds).map(String),
  ])];
  return true;
}

function consume(runtime, action, result) {
  if (!action?.authoredT07BridgeChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (state.completedAtMinute != null) return false;

  const minute = absoluteMinute(runtime);
  const context = t05ContextFor(runtime);
  const closed = BRIDGE_CHOICES.map(actionIdFor).filter((id) => id !== action.id);

  state.completedAtMinute = minute;
  state.selectedActionId = action.id;
  state.closedActionIds = closed;
  state.t05ContextId = context.id;

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  for (const flag of arr(action.authoredT07BridgeWorldFlags)) {
    runtime.playerState.worldFlags[flag] = true;
  }
  runtime.playerState.worldFlags.t07SeenFromTheShippingSide = true;
  runtime.playerState.evidence[action.authoredT07BridgeEvidenceId] = {
    id: action.authoredT07BridgeEvidenceId,
    sourceId: action.authoredT07BridgeEvidenceSourceId,
    acquiredAtMinute: minute,
  };
  runtime.playerState.history.push({
    type: action.authoredT07BridgeHistoryType,
    minute,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    sceneId: BRIDGE_SCENE,
    actionId: action.id,
    closedActionIds: [...closed],
    t05ContextId: context.id,
    t05ResolutionRoute: runtime?.playerState?.worldFlags?.t05ResolutionRoute ?? null,
    evidenceId: action.authoredT07BridgeEvidenceId,
    evidenceSourceId: action.authoredT07BridgeEvidenceSourceId,
    location: LOCATION,
    facilityId: action.targetFacilityId,
  });

  handOffToCanonicalFlow(runtime, action);

  const current = player(runtime);
  if (action.targetFacilityId) current.facilityId = action.targetFacilityId;

  result.summary = action.authoredT07BridgeSummary;
  result.speeches = [action.authoredT07BridgeSpeech];
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = actions(runtime);
  if (own) return own;
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (eligible(runtime)) {
    const context = t05ContextFor(runtime);
    return {
      missionId: MISSION_ID,
      kicker: context.kicker,
      title: "息をする荷",
      detail: context.detail,
      targetLocation: LOCATION,
      targetFacilityId: FAC.port,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_T05_TO_T07_BRIDGE_INTERNALS = Object.freeze({
  FLOW_ID,
  MISSION_ID,
  TROUBLE_ID,
  LOCATION,
  STATE_KEY,
  BRIDGE_SCENE,
  FAC,
  NPC,
  BRIDGE_OPEN_MINUTE,
  BRIDGE_CLOSE_MINUTE,
  BRIDGE_CHOICES,
  T05_CONTEXTS,
  DEFAULT_CONTEXT,
  t05Settled,
  t07Open,
  luciaStillRecoverable,
  t05ContextFor,
  inTradeCity,
  withinBridgeWindow,
  readState,
  ensureState,
  eligible,
  actionIdFor,
  actionFor,
  actions,
  handOffToCanonicalFlow,
  consume,
});
