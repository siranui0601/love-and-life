import * as base from "./authored-mission-flow-t02-granary-dawn.js";
import { ensureAuthoredMissionFlowState } from "./authored-mission-flow-core.js";

export * from "./authored-mission-flow-t02-granary-dawn.js";

export const AUTHORED_T02_TO_T05_BRIDGE_VERSION = "authored-t02-to-t05-bridge-v2";

const FLOW_ID = "trade-lord-poisoning";
const MISSION_ID = "MSN-T05";
const TROUBLE_ID = "T05";
const LOCATION = "交易都市";
const STATE_KEY = "t02ToT05Bridge";
const BRIDGE_SCENE = "t05-arrival-from-granary";

const FAC = Object.freeze({
  guild: "LOC_TRADE_GUILD",
  manor: "LOC_TRADE_LORD_MANOR",
  warehouse: "LOC_TRADE_WAREHOUSE",
  apothecary: "LOC_TRADE_APOTHECARY",
});

const NPC = Object.freeze({
  orvain: "NPC009",
  mariel: "NPC011",
  beryl: "NPC014",
  simon: "NPC076",
  lucy: "NPC077",
});

const TERMINAL = new Set(["completed", "resolved", "terminal", "failed", "abandoned"]);

// T05は正本でDay16発生。穀倉事件の後始末で交易都市にいるプレイヤーが、
// 領主の異変に最初に触れる窓をDay14〜Day24に置く。
const BRIDGE_OPEN_MINUTE = 13 * 1440;
const BRIDGE_CLOSE_MINUTE = 24 * 1440;

// 直前の穀倉事件をどう決着させたかで、交易都市がプレイヤーへ開ける扉が変わる。
const T02_CONTEXTS = Object.freeze({
  public_prosecution_and_contract_void: Object.freeze({
    id: "public_record",
    kicker: "公開審理の記録に名前が残ったせいで、館の使いが宿まで訪ねてきた",
    detail:
      "村の放火を公の場で立証した相手として、この街はあなたを『記録を残す人間』として扱い始めた。領主館の医師が、内輪では扱えない話を外の証人へ持ち込もうとしている。",
    speech:
      "商人ギルドで貴方の名を聞きました。身内でない、記録を残せる方を探していたのです。……領主様のことで。",
  }),
  restitution_grain_and_debt_compact: Object.freeze({
    id: "grain_account",
    kicker: "村へ送る代替穀物の受け渡しで、館の勝手口へ出入りする用ができた",
    detail:
      "賠償として取り付けた穀物と再建費の受け渡しが続いている。館の台所方と何度も顔を合わせるうちに、領主本人の膳だけが別に作られていることに気づいた。",
    speech:
      "村への積み出しの件で来られたのでしょう。……ついでに一つ。領主様の膳が、この十日ほど台所を通っていないのです。",
  }),
  village_grain_cooperative_and_open_ledger: Object.freeze({
    id: "open_ledger",
    kicker: "村の協同組合が直に売り始めたので、館の仕入れ帳とこちらの帳面が突き合わせられる",
    detail:
      "公開帳簿を持つ売り手として市場に立った結果、買い手側の記録も見えるようになった。領主館の仕入れは先月から品目が入れ替わり、薬種だけが増えている。",
    speech:
      "そちらの帳面は公開でしたね。……ならこちらも申します。館の仕入れは、この一月で食い物より薬のほうが多い。",
  }),
});

const DEFAULT_CONTEXT = Object.freeze({
  id: "outsider",
  kicker: "港の風向きが変わる頃、領主館の周りだけ人の出入りが不自然に減っている",
  detail:
    "この街に貸しも記録も持たないまま来たため、扉はどれも半分しか開かない。それでも、館の静けさは外からでも分かるほど不自然である。",
  speech:
    "見ない顔ですね。……いえ、かえって好都合かもしれません。この街の者には、話しにくいことなので。",
});

const BRIDGE_CHOICES = Object.freeze([
  Object.freeze({
    id: "call_at_manor",
    label: "領主館へ足を運ぶ",
    family: "talk",
    minutes: 52,
    facility: FAC.manor,
    actorId: NPC.mariel,
    summary:
      "領主館の医師マリエルは、オルヴェン領主の症状を『流行り病ではない』と言い切った。手足の痺れが食後にだけ強くなり、同じ膳を下げた者にまで軽い症状が出ている。",
    speech: Object.freeze({
      actorId: NPC.mariel,
      text: "熱がないのに手足が痺れる。食後半刻で強くなり、翌朝には引く。……病ではありません。少しずつ、続けて盛られています。誰が、とは私からは言えません。",
      emotion: "職業上の確信と、口にできない恐れ",
    }),
    worldFlags: ["t05PoisoningSuspectedByPhysician", "t05MarielContacted"],
    historyType: "T05_BRIDGE_PHYSICIAN_CONSULTED",
    // 正史の聞き取り相手であるマリエルから、正史と同じ食後半刻の所見を直接得ている。
    // この扉だけは聞き取り工程そのものが済んだものとして扱う。
    completesHearing: true,
    canonicalFactIds: ["T05-FACT-NONNATURAL-POISON"],
    canonicalLeadIds: ["bedside_symptoms", "antidote_formula"],
    evidenceId: "T05-EVIDENCE-BRIDGE-POSTPRANDIAL-PATTERN",
    evidenceSourceId: "NPC011:MANOR_BEDSIDE_ACCOUNT",
  }),
  Object.freeze({
    id: "read_kitchen_ledger",
    label: "厨房の仕入れ帳を見る",
    family: "investigate",
    minutes: 44,
    facility: FAC.warehouse,
    actorId: NPC.simon,
    summary:
      "館へ納める食材を扱う倉庫街で、この一月の仕入れ帳を繰った。領主の膳に使う品だけが特定の使用人の名で別に受け取られ、通常の台所方を通っていない。",
    speech: Object.freeze({
      actorId: NPC.simon,
      text: "台所方の判ならここに並ぶ。だがこの十七件だけ、使用人が一人で受け取ってる。……名前は書いてあるが、俺の口からは言わんぞ。帳面を見たのはあんただ。",
      emotion: "巻き込まれたくない用心",
    }),
    worldFlags: ["t05SeparateProcurementFound", "t05ServantChannelIndicated"],
    historyType: "T05_BRIDGE_SEPARATE_PROCUREMENT_FOUND",
    // 倉庫街で見たのは納品側の記録そのもの。マリエルには会っていないので聞き取りは残る。
    canonicalLeadIds: ["warehouse_manifest"],
    evidenceId: "T05-EVIDENCE-BRIDGE-SERVANT-ONLY-RECEIPTS",
    evidenceSourceId: "LOC_TRADE_WAREHOUSE:MANOR_INTAKE_LEDGER",
  }),
  Object.freeze({
    id: "buy_from_apothecary",
    label: "薬草商へ買い出しに行く",
    family: "shop",
    minutes: 38,
    facility: FAC.apothecary,
    actorId: NPC.lucy,
    summary:
      "港の薬草商で常備薬を買いながら、最近よく出る品を尋ねた。ルーシーは解毒に使う品がこの半月で不自然に売れていること、しかも買い手が館の者ではないことを話した。",
    speech: Object.freeze({
      actorId: NPC.lucy,
      text: "痺れ止めの根がよく出るんですよ、この半月。買っていくのは館の方じゃない。……犯罪都市の訛りの方。解毒を買う人と、盛る人は、案外近いところにいます。",
      emotion: "商売人の観察眼",
    }),
    worldFlags: ["t05AntidoteDemandSpike", "t05CrimeCityLinkIndicated"],
    historyType: "T05_BRIDGE_ANTIDOTE_DEMAND_FOUND",
    // 解毒素材の売れ行きと犯罪都市訛りの買い手。処方と裏帳簿の二方向へ繋がる。
    canonicalLeadIds: ["antidote_formula", "crime_ledger"],
    evidenceId: "T05-EVIDENCE-BRIDGE-ANTIDOTE-BUYERS",
    evidenceSourceId: "NPC077:APOTHECARY_SALES_MEMORY",
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

function t02Settled(runtime) {
  const mission = findMission(runtime, "MSN-T02");
  const trouble = runtime?.playerState?.troubles?.T02;
  const settled = new Set(["completed", "resolved", "terminal"]);
  return settled.has(statusOf(mission)) || settled.has(statusOf(trouble));
}

function t05Open(runtime) {
  const mission = findMission(runtime, MISSION_ID);
  const trouble = runtime?.playerState?.troubles?.[TROUBLE_ID];
  if (mission && TERMINAL.has(statusOf(mission))) return false;
  if (trouble != null && TERMINAL.has(statusOf(trouble))) return false;
  return true;
}

function orvainAlive(runtime) {
  const state = runtime?.livingWorld?.npcStates?.[NPC.orvain];
  if (!state) return true;
  const dead = new Set(["dead", "deceased", "killed"]);
  return !dead.has(String(state.status ?? state.lifeStatus ?? ""));
}

export function t02ContextFor(runtime) {
  const route = runtime?.playerState?.worldFlags?.t02ResolutionRoute;
  return T02_CONTEXTS[String(route ?? "")] ?? DEFAULT_CONTEXT;
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
    version: AUTHORED_T02_TO_T05_BRIDGE_VERSION,
    completedAtMinute: null,
    selectedActionId: null,
    closedActionIds: [],
    t02ContextId: null,
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_T02_TO_T05_BRIDGE_VERSION;
  state.closedActionIds = arr(state.closedActionIds).map(String);
  return state;
}

function eligible(runtime) {
  if (!t02Settled(runtime)) return false;
  if (!t05Open(runtime)) return false;
  if (!orvainAlive(runtime)) return false;
  if (!inTradeCity(runtime)) return false;
  if (!withinBridgeWindow(runtime)) return false;
  return readState(runtime)?.completedAtMinute == null;
}

function actionIdFor(choice) {
  return `MISSION_FLOW:T05:GRANARY_BRIDGE:${choice.id}`;
}

function actionFor(runtime, choice) {
  const id = actionIdFor(choice);
  const context = t02ContextFor(runtime);
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
    dialogueTopic: `t05_bridge_${choice.id}`,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredT05BridgeChoice: true,
    authoredT05BridgeContextId: context.id,
    authoredT05BridgeSummary: choice.summary,
    authoredT05BridgeSpeech: choice.speech,
    authoredT05BridgeWorldFlags: choice.worldFlags,
    authoredT05BridgeHistoryType: choice.historyType,
    authoredT05BridgeEvidenceId: choice.evidenceId,
    authoredT05BridgeEvidenceSourceId: choice.evidenceSourceId,
    authoredT05BridgeCompletesHearing: choice.completesHearing === true,
    authoredT05BridgeCanonicalFactIds: choice.canonicalFactIds ?? [],
    authoredT05BridgeCanonicalLeadIds: choice.canonicalLeadIds ?? [],
  };
}

function actions(runtime) {
  if (!eligible(runtime)) return null;
  return BRIDGE_CHOICES.map((choice) => actionFor(runtime, choice));
}

// 扉で実際に分かったことだけを、正史のT05調査へ渡す。
// 手掛かりを増やすのではなく、既に見たものを正史側の名前で登録し直すだけ。
function handOffToCanonicalFlow(runtime, action) {
  const flow = ensureAuthoredMissionFlowState(runtime, FLOW_ID);
  if (!flow) return false;

  flow.unlockedLeadIds = [...new Set([
    ...arr(flow.unlockedLeadIds).map(String),
    ...arr(action.authoredT05BridgeCanonicalLeadIds).map(String),
  ])];
  flow.knownFactIds = [...new Set([
    ...arr(flow.knownFactIds).map(String),
    ...arr(action.authoredT05BridgeCanonicalFactIds).map(String),
  ])];

  // マリエル本人から正史と同じ所見を聞いた扉だけ、聞き取り工程を済ませる。
  if (action.authoredT05BridgeCompletesHearing) {
    const mission = findMission(runtime, MISSION_ID);
    if (mission) {
      mission.progress ??= {};
      mission.progress.hear = Math.max(1, Number(mission.progress.hear ?? 0));
    }
  }
  return true;
}

function consume(runtime, action, result) {
  if (!action?.authoredT05BridgeChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (state.completedAtMinute != null) return false;

  const minute = absoluteMinute(runtime);
  const context = t02ContextFor(runtime);
  const closed = BRIDGE_CHOICES.map(actionIdFor).filter((id) => id !== action.id);

  state.completedAtMinute = minute;
  state.selectedActionId = action.id;
  state.closedActionIds = closed;
  state.t02ContextId = context.id;

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  for (const flag of arr(action.authoredT05BridgeWorldFlags)) {
    runtime.playerState.worldFlags[flag] = true;
  }
  runtime.playerState.worldFlags.t05DiscoveredViaGranaryBridge = true;
  runtime.playerState.evidence[action.authoredT05BridgeEvidenceId] = {
    id: action.authoredT05BridgeEvidenceId,
    sourceId: action.authoredT05BridgeEvidenceSourceId,
    acquiredAtMinute: minute,
  };
  runtime.playerState.history.push({
    type: action.authoredT05BridgeHistoryType,
    minute,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    sceneId: BRIDGE_SCENE,
    actionId: action.id,
    closedActionIds: [...closed],
    t02ContextId: context.id,
    t02ResolutionRoute: runtime?.playerState?.worldFlags?.t02ResolutionRoute ?? null,
    evidenceId: action.authoredT05BridgeEvidenceId,
    evidenceSourceId: action.authoredT05BridgeEvidenceSourceId,
    location: LOCATION,
    facilityId: action.targetFacilityId,
  });

  handOffToCanonicalFlow(runtime, action);

  const current = player(runtime);
  if (action.targetFacilityId) current.facilityId = action.targetFacilityId;

  result.summary = action.authoredT05BridgeSummary;
  result.speeches = [
    { actorId: action.targetNpcId, text: context.speech, emotion: "警戒しながらの打ち明け" },
    action.authoredT05BridgeSpeech,
  ];
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = actions(runtime);
  return own ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (eligible(runtime)) {
    const context = t02ContextFor(runtime);
    return {
      missionId: MISSION_ID,
      kicker: context.kicker,
      title: "領主館の静けさ",
      detail: context.detail,
      targetLocation: LOCATION,
      targetFacilityId: FAC.manor,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_T02_TO_T05_BRIDGE_INTERNALS = Object.freeze({
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
  T02_CONTEXTS,
  DEFAULT_CONTEXT,
  t02Settled,
  t05Open,
  orvainAlive,
  t02ContextFor,
  inTradeCity,
  withinBridgeWindow,
  readState,
  ensureState,
  eligible,
  actionIdFor,
  actionFor,
  actions,
  consume,
  handOffToCanonicalFlow,
  FLOW_ID,
});
