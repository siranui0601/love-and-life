import * as base from "./authored-mission-flow-human-route-t04-falco-progress-sync.js";

export * from "./authored-mission-flow-human-route-t04-falco-progress-sync.js";

export const AUTHORED_T02_GRANARY_DAWN_VERSION = "authored-t02-granary-dawn-v2";

const MISSION_ID = "MSN-T02";
const TROUBLE_ID = "T02";
const LOCATION = "田園の村";
const STATE_KEY = "t02GranaryDawn";

const FAC = Object.freeze({
  square: "LOC_FARM_SQUARE",
  granary: "LOC_FARM_GRANARY",
  bakery: "LOC_FARM_BAKERY",
  inn: "LOC_FARM_INN",
  well: "LOC_FARM_WELL",
  chief: "LOC_FARM_CHIEF",
});

const NPC = Object.freeze({
  garo: "NPC003",
  eda: "NPC004",
  thoma: "NPC005",
  rona: "NPC058",
  paolo: "NPC059",
});

const TERMINAL = new Set(["completed", "resolved", "terminal", "failed", "abandoned"]);

const DAWN_SCENE = "t02-granary-dawn";
const HEADCOUNT_SCENE = "t02-dawn-thoma-search";
const RECORD_SCENE = "t02-dawn-scene-record";
const STOCK_SCENE = "t02-dawn-stock-count";

// 正本の放火はDay5「夜」。焼け跡はそれより前に存在しないので、
// 窓はDay5 22:00に開き、Day7 00:00に閉じる。production absoluteMinuteは
// Day1 10:00を0とするため、壁時計の通算分からその600分を差し引く。
const DAWN_OPEN_MINUTE = 4 * 1440 + 22 * 60 - 10 * 60;
const DAWN_CLOSE_MINUTE = 6 * 1440 - 10 * 60;

// Day6 夜明け。共同穀倉はまだ煙を上げている。
// ここで最初に何を守るかが、この事件の証拠経路と、村がプレイヤーをどう見るかを決める。
const DAWN_CHOICES = Object.freeze([
  Object.freeze({
    id: "count_people",
    label: "人を先に数える",
    family: "help",
    minutes: 34,
    facility: FAC.square,
    summary:
      "燃え残りへ走る村人を広場へ呼び戻し、名前を一人ずつ読み上げた。焼けたのは穀物だけで、死人は出ていない。ただし共同穀倉の管理人トーマだけが、どの列にもいない。",
    speech: Object.freeze({
      actorId: NPC.eda,
      text: "あんた、麦のほうへ行かなかったね。……そうだ、先に人だ。トーマがいない。あの人は昨日の晩、戸締まりに行くと言って出たきりだよ。",
      emotion: "煤にまみれた安堵と、遅れて来る不安",
    }),
    worldFlags: ["t02DawnHeadcountFirst", "t02ThomaMissingAtDawn"],
    historyType: "T02_DAWN_HEADCOUNT_FIRST",
    evidenceId: "T02-EVIDENCE-DAWN-KEEPER-ABSENT",
    evidenceSourceId: "LOC_FARM_SQUARE:DAWN_HEADCOUNT",
    nextSceneId: HEADCOUNT_SCENE,
  }),
  Object.freeze({
    id: "rope_the_scene",
    label: "焼け跡に縄を張る",
    family: "investigate",
    minutes: 28,
    facility: FAC.granary,
    summary:
      "消し止めた直後の床へ人を入れないよう、焼け残った柱と柵へ縄を回した。踏み荒らされる前の土間には、扉から穀袋へ真っ直ぐ伸びる油の筋が残っている。",
    speech: Object.freeze({
      actorId: NPC.garo,
      text: "……縄か。悔しいが、そのほうがいい。村の者は片づけたがる。片づけてしまえば、誰が火を点けたかは永久に分からんままだ。",
      emotion: "焦りを飲み込んだ判断",
    }),
    worldFlags: ["t02DawnSceneRoped", "t02FloorEvidenceProtected"],
    historyType: "T02_DAWN_SCENE_ROPED",
    evidenceId: "T02-EVIDENCE-DAWN-UNTRAMPLED-FLOOR",
    evidenceSourceId: "LOC_FARM_GRANARY:DAWN_CORDON",
    nextSceneId: RECORD_SCENE,
  }),
  Object.freeze({
    id: "count_stock",
    label: "残った食料を数える",
    family: "prepare",
    minutes: 41,
    facility: FAC.bakery,
    summary:
      "穀倉が消えた村に、今日から何日分の食料が残っているのかを確かめて回った。パン屋の粉樽と麦穂亭の貯えを合わせても、村が持ちこたえられるのは十日ほどしかない。",
    speech: Object.freeze({
      actorId: NPC.rona,
      text: "うちの貯えは十日。パオロの粉樽を足しても、そう変わらないよ。……十日で足りなけりゃ、村は買うしかない。買う相手は、決まってるだろう。",
      emotion: "先を読んだ苦い顔",
    }),
    worldFlags: ["t02DawnStockCounted", "t02VillageFoodWindowKnown"],
    historyType: "T02_DAWN_STOCK_COUNTED",
    evidenceId: "T02-EVIDENCE-DAWN-TEN-DAY-MARGIN",
    evidenceSourceId: "LOC_FARM_BAKERY:DAWN_STOCK_TALLY",
    nextSceneId: STOCK_SCENE,
  }),
]);

// 人を数えた枝。トーマは生きているが、自分の失火だと思い込んで姿を隠している。
const HEADCOUNT_CHOICES = Object.freeze([
  Object.freeze({
    id: "search_watermill",
    label: "川べりの水車小屋を見る",
    family: "investigate",
    minutes: 46,
    facility: FAC.well,
    summary:
      "村の者が最後にトーマを見た方角へ下ると、使われていない水車小屋に灯りがあった。トーマは鍵束を握ったまま座り込み、自分が灯りを消し忘れたのだと繰り返している。",
    speech: Object.freeze({
      actorId: NPC.thoma,
      text: "俺が消し忘れたんだ。俺が。……いや、待ってくれ。俺は灯皿を戸口へ置かない。あそこへ置くのは、油を足しに来た者だけだ。",
      emotion: "自責から記憶が裏返る瞬間",
    }),
    worldFlags: ["t02ThomaFound", "t02ThomaSelfBlameBroken"],
    historyType: "T02_DAWN_THOMA_FOUND_AT_WATERMILL",
    evidenceId: "T02-EVIDENCE-DAWN-KEEPER-LAMP-HABIT",
    evidenceSourceId: "NPC005:WATERMILL_TESTIMONY",
  }),
  Object.freeze({
    id: "ask_around",
    label: "エダに聞いて回る",
    family: "talk",
    minutes: 32,
    facility: FAC.square,
    summary:
      "エダと二人で、井戸端から麦畑まで昨夜の人の動きを聞き集めた。村の誰もが眠っていた刻限に、村外れの空き家の方から荷車の音を聞いた者が三人いる。",
    speech: Object.freeze({
      actorId: NPC.eda,
      text: "うちの人も聞いてる。荷車だよ。あんな刻限に荷車を出す用なんて、この村にはないよ。空き家のほうから、村の外へ向かってね。",
      emotion: "確信を持った証言",
    }),
    worldFlags: ["t02DawnCartWitnessed", "t02VillageTestimonyNetwork"],
    historyType: "T02_DAWN_CART_WITNESSES_GATHERED",
    evidenceId: "T02-EVIDENCE-DAWN-NIGHT-CART",
    evidenceSourceId: "LOC_FARM_WELL:THREE_WITNESSES",
  }),
  Object.freeze({
    id: "start_soup",
    label: "炊き出しを始める",
    family: "work",
    minutes: 74,
    facility: FAC.inn,
    summary:
      "麦穂亭の釜を借り、焼け出された家から順に粥を配った。並んだ列の中で村人が勝手に話し始め、聞いて回るより多くのことが集まってくる。",
    speech: Object.freeze({
      actorId: NPC.rona,
      text: "釜は好きに使いな。……不思議なもんだね。訊いて回ると誰も言わないのに、椀を持たせると勝手に喋る。あんた、村の者に借りを作らせたよ。",
      emotion: "呆れ半分の信頼",
    }),
    worldFlags: ["t02DawnSoupKitchen", "t02VillageTestimonyNetwork", "t02VillageTrustsPlayer"],
    historyType: "T02_DAWN_SOUP_KITCHEN_OPENED",
    evidenceId: "T02-EVIDENCE-DAWN-QUEUE-TALK",
    evidenceSourceId: "LOC_FARM_INN:SOUP_LINE",
  }),
]);

// 縄を張った枝。現場は守られたが、村人は「よそ者が焼け跡を仕切っている」と見ている。
const RECORD_CHOICES = Object.freeze([
  Object.freeze({
    id: "trace_oil",
    label: "油筋を布へ写し取る",
    family: "investigate",
    minutes: 38,
    facility: FAC.granary,
    summary:
      "土間の油筋へ薄布を伏せ、形と幅をそのまま写し取った。筋は戸口の外から始まり、穀袋の前で一度途切れて、また続いている。運びながら足した者の歩幅である。",
    speech: Object.freeze({
      actorId: NPC.garo,
      text: "途切れているのは、担ぎ直したからか。……つまり一人だ。一人で、外から油を持ち込んだ。村の誰かが手伝ったわけではない。それだけでも救いだ。",
      emotion: "村を疑わずに済んだ安堵",
    }),
    worldFlags: ["t02OilTraceCopied", "t02SingleArsonistIndicated"],
    historyType: "T02_DAWN_OIL_TRACE_COPIED",
    evidenceId: "T02-EVIDENCE-DAWN-OIL-STRIDE",
    evidenceSourceId: "LOC_FARM_GRANARY:OIL_TRACE_CLOTH",
  }),
  Object.freeze({
    id: "file_time_record",
    label: "村務帳へ時刻を残す",
    family: "work",
    minutes: 26,
    facility: FAC.chief,
    summary:
      "火に気づいた者の名と刻限、風向き、消し止めた時刻をガロの村務帳へ記録した。後から誰が何を言い換えても、この頁が最初の事実として残る。",
    speech: Object.freeze({
      actorId: NPC.garo,
      text: "村務帳は、税と証文のためのものだと思っていた。……こういう使い方があるのだな。書いておけば、交易都市の連中も『聞いていない』とは言えん。",
      emotion: "制度を武器にする発想を得た顔",
    }),
    worldFlags: ["t02DawnTimeRecordFiled", "t02OfficialRecordStarted"],
    historyType: "T02_DAWN_TIME_RECORD_FILED",
    evidenceId: "T02-EVIDENCE-DAWN-VILLAGE-LEDGER-ENTRY",
    evidenceSourceId: "LOC_FARM_CHIEF:VILLAGE_DUTY_LEDGER",
  }),
  Object.freeze({
    id: "clear_onlookers",
    label: "野次馬を下がらせる",
    family: "talk",
    minutes: 22,
    facility: FAC.granary,
    summary:
      "縄の内側へ入ろうとする村人へ、何を守っているのかを一人ずつ説明した。納得しない者もいたが、パオロが先に下がったことで人垣が引いた。",
    speech: Object.freeze({
      actorId: NPC.paolo,
      text: "分かった、下がる。……うちの粉も焼けたんだ。片づけたいのは山々だが、焼いた奴が捕まらんほうが困る。みんな、離れろ。",
      emotion: "損を飲み込んだ協力",
    }),
    worldFlags: ["t02OnlookersCleared", "t02PaoloCooperating"],
    historyType: "T02_DAWN_ONLOOKERS_CLEARED",
    evidenceId: "T02-EVIDENCE-DAWN-INTACT-CORDON",
    evidenceSourceId: "LOC_FARM_GRANARY:CORDON_HELD",
  }),
]);

// 在庫を数えた枝。村の十日という猶予が、そのまま交渉の持ち時間になる。
const STOCK_CHOICES = Object.freeze([
  Object.freeze({
    id: "count_flour_barrels",
    label: "パオロの粉樽を数える",
    family: "investigate",
    minutes: 36,
    facility: FAC.bakery,
    summary:
      "パン屋の粉樽を実際に開けて量を確かめた。パオロが帳面へ書いていた納品量と、樽の中身が合わない。足りない分は、去年から穀倉の帳簿上でだけ消えている。",
    speech: Object.freeze({
      actorId: NPC.paolo,
      text: "俺は受け取った分しか書いてない。だが穀倉の帳簿では、もっと多く出したことになってるって? ……去年からだ。去年から、俺の控えと合わん。",
      emotion: "気づかされた驚愕",
    }),
    worldFlags: ["t02FlourTallyMismatch", "t02PhantomShortageIndicated"],
    historyType: "T02_DAWN_FLOUR_TALLY_MISMATCH",
    evidenceId: "T02-EVIDENCE-DAWN-BAKER-COUNTERCOPY",
    evidenceSourceId: "LOC_FARM_BAKERY:DELIVERY_COUNTERCOPY",
  }),
  Object.freeze({
    id: "ask_prices",
    label: "ローナに値を聞く",
    family: "talk",
    minutes: 24,
    facility: FAC.inn,
    summary:
      "麦穂亭で、村が外から穀物を買う場合の相場を聞いた。ローナは去年の飢饉の時の値を覚えており、今の言い値がその倍近いことを指摘した。",
    speech: Object.freeze({
      actorId: NPC.rona,
      text: "去年の凶作でもこの値だったよ。今年は豊作だ。それでこの言い値なら、足元を見られてる。……見てるのは、交易都市の穀物商さ。",
      emotion: "商売人としての怒り",
    }),
    worldFlags: ["t02PriceGougingKnown", "t02BaselMerchantSuspected"],
    historyType: "T02_DAWN_PRICE_GOUGING_KNOWN",
    evidenceId: "T02-EVIDENCE-DAWN-DOUBLED-QUOTE",
    evidenceSourceId: "LOC_FARM_INN:RONA_PRICE_MEMORY",
  }),
  Object.freeze({
    id: "send_for_riona",
    label: "行商人へ使いを出す",
    family: "prepare",
    minutes: 30,
    facility: FAC.square,
    summary:
      "村の子どもに駄賃を渡し、街道筋の行商人リオナへ言伝を頼んだ。交易都市の穀物商を通さずに小口で買える相手を、先に一人確保しておく。",
    speech: Object.freeze({
      actorId: NPC.garo,
      text: "行商人か。……穀物商から買うしかないと思い込んでいた。買う先が二つあるだけで、こちらの立場はまるで違う。よく気づいた。",
      emotion: "選択肢を得た村長の落ち着き",
    }),
    worldFlags: ["t02AlternateSupplierSought", "t02VillageNotCorneredYet"],
    historyType: "T02_DAWN_ALTERNATE_SUPPLIER_SOUGHT",
    evidenceId: "T02-EVIDENCE-DAWN-SECOND-SUPPLIER",
    evidenceSourceId: "LOC_FARM_SQUARE:MESSENGER_TO_RIONA",
  }),
]);

const SCENES = Object.freeze({
  [DAWN_SCENE]: DAWN_CHOICES,
  [HEADCOUNT_SCENE]: HEADCOUNT_CHOICES,
  [RECORD_SCENE]: RECORD_CHOICES,
  [STOCK_SCENE]: STOCK_CHOICES,
});

const SCENE_GUIDANCE = Object.freeze({
  [DAWN_SCENE]: Object.freeze({
    kicker: "共同穀倉はまだ煙を上げ、村人は焼け残りへ走り出している",
    title: "焼け跡で最初に守るもの",
    detail:
      "人を数えるか、踏み荒らされる前の床を守るか、村に残った食料を把握するか。どれも正しいが、同時にはできない。ここで選ばなかったものは、後から取り返せない。",
  }),
  [HEADCOUNT_SCENE]: Object.freeze({
    kicker: "名前を読み上げ終えても、トーマだけが返事をしない",
    title: "いない管理人を追う",
    detail:
      "本人を探すか、村人の記憶を集めるか、まず腹を満たすか。トーマは自分の失火だと思い込んでいる。誰が先に彼へ届くかで、証言の中身が変わる。",
  }),
  [RECORD_SCENE]: Object.freeze({
    kicker: "縄の内側は守られたが、村人はよそ者の手際を遠巻きに見ている",
    title: "守った現場から何を取り出すか",
    detail:
      "痕跡を写すか、時刻を公式記録へ残すか、人垣を解くか。証拠は残っているうちしか価値がない。ただし村の感情も、放っておけば固まる。",
  }),
  [STOCK_SCENE]: Object.freeze({
    kicker: "十日。村が自力で食べられる日数が、そのまま交渉の持ち時間になる",
    title: "十日をどう使うか",
    detail:
      "帳面の食い違いを追うか、相場を確かめるか、別の買い先を押さえるか。穀物商は村が追い詰められるのを待っている。待たせないための十日である。",
  }),
});

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

function findMission(runtime) {
  const collections = [
    runtime?.playerState?.missions,
    runtime?.missions,
    runtime?.playerState?.missionById,
    runtime?.missionById,
  ];
  for (const collection of collections) {
    if (collection instanceof Map && collection.has(MISSION_ID)) return collection.get(MISSION_ID);
    const direct = collection?.[MISSION_ID];
    if (direct) return direct;
    const found = values(collection).find((entry) => entry?.id === MISSION_ID);
    if (found) return found;
  }
  return null;
}

function markT02MissionAttempt(runtime, minute) {
  const mission = findMission(runtime);
  if (mission && mission.attemptedAt == null) mission.attemptedAt = minute;

  const missionProgress = runtime?.playerState?.progress?.missions;
  if (!missionProgress) return;
  const attempted = missionProgress.attemptedTroubleIds;
  if (attempted instanceof Set) {
    attempted.add(TROUBLE_ID);
    return;
  }
  missionProgress.attemptedTroubleIds = new Set(Array.isArray(attempted) ? attempted : []);
  missionProgress.attemptedTroubleIds.add(TROUBLE_ID);
}

function statusOf(value) {
  return String(value?.status ?? value ?? "");
}

function t02Open(runtime) {
  const mission = findMission(runtime);
  const trouble = runtime?.playerState?.troubles?.[TROUBLE_ID];
  if (!mission && trouble == null) return false;
  if (mission && TERMINAL.has(statusOf(mission))) return false;
  if (trouble != null && TERMINAL.has(statusOf(trouble))) return false;
  return true;
}

function inVillage(runtime) {
  return player(runtime).location === LOCATION;
}

function withinDawnWindow(runtime) {
  const minute = absoluteMinute(runtime);
  return minute >= DAWN_OPEN_MINUTE && minute < DAWN_CLOSE_MINUTE;
}

function readState(runtime) {
  const state = runtime?.playerState?.[STATE_KEY];
  return state && typeof state === "object" ? state : null;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_T02_GRANARY_DAWN_VERSION,
    completedScenes: {},
    selectedActionIds: [],
    closedActionIds: {},
    currentSceneId: DAWN_SCENE,
    lastChoiceAtMinute: null,
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_T02_GRANARY_DAWN_VERSION;
  state.completedScenes = state.completedScenes && typeof state.completedScenes === "object"
    ? state.completedScenes
    : {};
  state.selectedActionIds = arr(state.selectedActionIds).map(String);
  state.closedActionIds = state.closedActionIds && typeof state.closedActionIds === "object"
    ? state.closedActionIds
    : {};
  if (typeof state.currentSceneId !== "string") state.currentSceneId = DAWN_SCENE;
  return state;
}

// 火が出た現場とその正面。宿や畑まで焼け跡の場面が追いかけては来ない。
const DAWN_FACILITY_IDS = new Set([FAC.granary, FAC.square]);

// 続きの場面は「その足で」しか起きない。半日離れれば村は勝手に片づけを進め、
// 機会は閉じる。別のトラブルへ出かける自由を、場面が奪わないための時限。
const FOLLOW_UP_WINDOW_MINUTES = 720;

function followUpStillOpen(runtime, state) {
  const since = Number(state?.lastChoiceAtMinute ?? NaN);
  if (!Number.isFinite(since)) return true;
  return absoluteMinute(runtime) - since <= FOLLOW_UP_WINDOW_MINUTES;
}

function activeSceneId(runtime) {
  if (!t02Open(runtime) || !inVillage(runtime) || !withinDawnWindow(runtime)) return null;
  const state = readState(runtime);
  if (!state) {
    return DAWN_FACILITY_IDS.has(String(player(runtime).facilityId ?? "")) ? DAWN_SCENE : null;
  }
  const sceneId = typeof state.currentSceneId === "string" ? state.currentSceneId : DAWN_SCENE;
  if (!SCENES[sceneId]) return null;
  if (state.completedScenes?.[sceneId] != null) return null;
  if (sceneId === DAWN_SCENE) {
    return DAWN_FACILITY_IDS.has(String(player(runtime).facilityId ?? "")) ? DAWN_SCENE : null;
  }
  return followUpStillOpen(runtime, state) ? sceneId : null;
}

function actionIdFor(sceneId, choice) {
  return `MISSION_FLOW:T02:${sceneId.replace(/-/g, "_").toUpperCase()}:${choice.id}`;
}

function actionFor(sceneId, choice) {
  const id = actionIdFor(sceneId, choice);
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
    targetNpcId: choice.speech.actorId,
    dialogueTopic: `t02_dawn_${choice.id}`,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredT02DawnChoice: true,
    authoredT02DawnSceneId: sceneId,
    authoredT02DawnSummary: choice.summary,
    authoredT02DawnSpeech: choice.speech,
    authoredT02DawnWorldFlags: choice.worldFlags,
    authoredT02DawnHistoryType: choice.historyType,
    authoredT02DawnEvidenceId: choice.evidenceId,
    authoredT02DawnEvidenceSourceId: choice.evidenceSourceId,
    authoredT02DawnNextSceneId: choice.nextSceneId ?? null,
  };
}

function actions(runtime) {
  const sceneId = activeSceneId(runtime);
  if (!sceneId) return null;
  return SCENES[sceneId].map((choice) => actionFor(sceneId, choice));
}

function consume(runtime, action, result) {
  if (!action?.authoredT02DawnChoice || result?.ok === false) return false;
  const sceneId = action.authoredT02DawnSceneId;
  if (!SCENES[sceneId]) return false;

  const state = ensureState(runtime);
  if (state.completedScenes[sceneId] != null) return false;

  const minute = absoluteMinute(runtime);
  const allIds = SCENES[sceneId].map((choice) => actionIdFor(sceneId, choice));
  const closed = allIds.filter((id) => id !== action.id);

  state.completedScenes[sceneId] = minute;
  state.selectedActionIds = [...new Set([...state.selectedActionIds, action.id])];
  state.closedActionIds[sceneId] = closed;
  state.currentSceneId = action.authoredT02DawnNextSceneId ?? null;
  state.lastChoiceAtMinute = minute;
  markT02MissionAttempt(runtime, minute);

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  for (const flag of arr(action.authoredT02DawnWorldFlags)) {
    runtime.playerState.worldFlags[flag] = true;
  }
  runtime.playerState.evidence[action.authoredT02DawnEvidenceId] = {
    id: action.authoredT02DawnEvidenceId,
    sourceId: action.authoredT02DawnEvidenceSourceId,
    acquiredAtMinute: minute,
  };
  runtime.playerState.history.push({
    type: action.authoredT02DawnHistoryType,
    minute,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    sceneId,
    actionId: action.id,
    closedActionIds: [...closed],
    evidenceId: action.authoredT02DawnEvidenceId,
    evidenceSourceId: action.authoredT02DawnEvidenceSourceId,
    nextSceneId: state.currentSceneId,
    location: player(runtime).location ?? null,
    facilityId: action.targetFacilityId ?? null,
  });

  const current = player(runtime);
  if (action.targetFacilityId) current.facilityId = action.targetFacilityId;

  result.summary = action.authoredT02DawnSummary;
  result.speeches = [action.authoredT02DawnSpeech];
  result.sceneTransition = state.currentSceneId;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = actions(runtime);
  return own ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  const sceneId = activeSceneId(runtime);
  if (sceneId) {
    const guidance = SCENE_GUIDANCE[sceneId];
    return {
      missionId: MISSION_ID,
      kicker: guidance.kicker,
      title: guidance.title,
      detail: guidance.detail,
      targetLocation: LOCATION,
      targetFacilityId: SCENES[sceneId][0].facility,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_T02_GRANARY_DAWN_INTERNALS = Object.freeze({
  MISSION_ID,
  TROUBLE_ID,
  LOCATION,
  STATE_KEY,
  FAC,
  NPC,
  DAWN_SCENE,
  HEADCOUNT_SCENE,
  RECORD_SCENE,
  STOCK_SCENE,
  DAWN_OPEN_MINUTE,
  DAWN_CLOSE_MINUTE,
  DAWN_CHOICES,
  HEADCOUNT_CHOICES,
  RECORD_CHOICES,
  STOCK_CHOICES,
  SCENES,
  SCENE_GUIDANCE,
  t02Open,
  inVillage,
  withinDawnWindow,
  readState,
  ensureState,
  activeSceneId,
  followUpStillOpen,
  DAWN_FACILITY_IDS,
  FOLLOW_UP_WINDOW_MINUTES,
  actionIdFor,
  actionFor,
  actions,
  consume,
});