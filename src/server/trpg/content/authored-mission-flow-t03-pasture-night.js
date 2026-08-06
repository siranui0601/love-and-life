import * as base from "./authored-mission-flow-t02-to-t05-bridge.js";

export * from "./authored-mission-flow-t02-to-t05-bridge.js";

export const AUTHORED_T03_PASTURE_NIGHT_VERSION = "authored-t03-pasture-night-v1";

const MISSION_ID = "MSN-T03";
const TROUBLE_ID = "T03";
const LOCATION = "田園の村";
const STATE_KEY = "t03PastureNight";

const PASTURE_SCENE = "t03-pasture-night";
const STAND_SCENE = "t03-pasture-after-stand";
const MOVE_SCENE = "t03-pasture-after-move";
const TRACK_SCENE = "t03-pasture-after-track";

const FAC = Object.freeze({
  stable: "LOC_FARM_STABLE",
  edge: "LOC_FARM_EDGE",
  chief: "LOC_FARM_CHIEF",
  well: "LOC_FARM_WELL",
  field: "LOC_FARM_FIELD",
});

const NPC = Object.freeze({
  finn: "NPC001",
  garo: "NPC003",
  jill: "NPC060",
  nene: "NPC061",
  hakuto: "NPC063",
});

const TERMINAL = new Set(["completed", "resolved", "terminal", "failed", "abandoned"]);

// T03は正本でDay8発生・Day20期限。群れが実際に家畜へ迫る最初の夜をDay8〜Day14へ置く。
const NIGHT_OPEN_MINUTE = 7 * 1440;
const NIGHT_CLOSE_MINUTE = 14 * 1440;

// 赤牙狼は「倒すべき敵」ではなく、森の奥から押し出されてきた側である。
// 力で押し返す、餌を動かす、退路を辿る。どれも正本の三解決へ別々に繋がる。
const PASTURE_CHOICES = Object.freeze([
  Object.freeze({
    id: "stand_in_the_gap",
    label: "先頭の一頭を叩く",
    family: "battle",
    minutes: 55,
    facility: FAC.stable,
    encounterId: "ENC-0005",
    summary:
      "柵の崩れ目へ入り、先頭の牡狼と正面から向き合った。数合で牡が退くと群れ全体が下がったが、去り際に何度も森ではなく村の側を振り返っている。追われて来た者の目つきだった。",
    speech: Object.freeze({
      actorId: NPC.jill,
      text: "……見たか。あいつら、こっちを恐れて退いたんじゃない。後ろを気にして退いたんだ。森に、狼が怖がる何かがいる。お前、腕は立つな。だが相手を間違えるなよ。",
      emotion: "実力を認めた上での警告",
    }),
    worldFlags: ["t03LeadWolfRepelled", "t03PackYieldsToPlayer", "t03PredatorBehindIndicated"],
    historyType: "T03_PASTURE_LEAD_WOLF_REPELLED",
    evidenceId: "T03-EVIDENCE-PASTURE-PACK-LOOKS-BACK",
    evidenceSourceId: "LOC_FARM_STABLE:GAP_STANDOFF",
    nextSceneId: STAND_SCENE,
  }),
  Object.freeze({
    id: "move_the_herd",
    label: "羊を先に動かす",
    family: "prepare",
    minutes: 78,
    facility: FAC.field,
    summary:
      "狼と向き合う代わりに、ハクトと二人がかりで羊を麦畑側の囲いへ移した。群れは柵へ来ず、餌の移った方向へそのまま流れていく。狼は村を狙っていたのではなく、食べられる物を追っていただけだった。",
    speech: Object.freeze({
      actorId: NPC.hakuto,
      text: "……追い払うより早いとはな。あいつらは羊を追ってるだけだ。羊が動けば、あいつらも動く。だったら、村から離れた場所へ餌場を作れば、群れごと移せるんじゃないか。",
      emotion: "牧場主として腑に落ちた顔",
    }),
    worldFlags: ["t03HerdRelocated", "t03PackFollowsFood", "t03RelocationPlanSeeded"],
    historyType: "T03_PASTURE_HERD_RELOCATED",
    evidenceId: "T03-EVIDENCE-PASTURE-PACK-FOLLOWS-FOOD",
    evidenceSourceId: "LOC_FARM_FIELD:HERD_MOVE",
    nextSceneId: MOVE_SCENE,
  }),
  Object.freeze({
    id: "track_the_retreat",
    label: "追わずに退路を辿る",
    family: "investigate",
    minutes: 92,
    facility: FAC.edge,
    summary:
      "騒ぎに加わらず、群れが引いた後の足跡だけを追った。狼たちは森の奥へは戻らず、外縁の岩場に固まって夜を明かしている。奥へ帰れない理由が、その先にある。",
    speech: Object.freeze({
      actorId: NPC.nene,
      text: "帰らんのかい。……そりゃ帰れんのだよ。狼が巣を捨てるのは、もっと大きいのが来た時だけさ。婆の若い頃にも一度あった。あん時は、森が静かになりすぎてね。",
      emotion: "古い記憶を掘り起こす声",
    }),
    worldFlags: ["t03RetreatTracked", "t03WolvesCannotReturnDeep", "t03PredatorBehindIndicated"],
    historyType: "T03_PASTURE_RETREAT_TRACKED",
    evidenceId: "T03-EVIDENCE-PASTURE-BLOCKED-DEN-RETURN",
    evidenceSourceId: "LOC_FARM_EDGE:NIGHT_TRACKING",
    nextSceneId: TRACK_SCENE,
  }),
]);

const STAND_CHOICES = Object.freeze([
  Object.freeze({
    id: "mend_the_fence",
    label: "崩れ目を塞ぐ",
    family: "work",
    minutes: 64,
    facility: FAC.stable,
    summary:
      "退けた夜のうちに、柵の崩れ目へ杭を打ち直した。押し返す腕があっても、毎晩ここに立つことはできない。手が空いている今だけが、村が自力で保つ形を作れる時間である。",
    speech: Object.freeze({
      actorId: NPC.hakuto,
      text: "あんた一人が強くても、あんたが村を出た夜に来られたら終わりだ。……杭を打つのを手伝ってくれるなら、こっちも夜番の頭数を出す。それなら村が保つ。",
      emotion: "現実的な取引",
    }),
    worldFlags: ["t03FenceRebuilt", "t03VillageHoldsWithoutPlayer"],
    historyType: "T03_STAND_FENCE_REBUILT",
    evidenceId: "T03-EVIDENCE-STAND-FENCE-LINE",
    evidenceSourceId: "LOC_FARM_STABLE:REBUILT_GAP",
  }),
  Object.freeze({
    id: "learn_the_read",
    label: "ジルに狼の読み方を習う",
    family: "talk",
    minutes: 47,
    facility: FAC.edge,
    summary:
      "退いた群れの足跡を前に、ジルから狼の間合いと退き際の読み方を教わった。次に森で群れと出会った時、どこで踏み止まればよいかが分かる。",
    speech: Object.freeze({
      actorId: NPC.jill,
      text: "牙より先に耳を見ろ。伏せた耳は威嚇だが、横へ倒れた耳は逃げ支度だ。……そこで追うな。追えば群れは散って、散った狼は村の外れの一軒家を襲う。",
      emotion: "猟師の実務",
    }),
    worldFlags: ["t03WolfReadingLearned", "t03JillTrustsPlayer"],
    historyType: "T03_STAND_WOLF_READING_LEARNED",
    evidenceId: "T03-EVIDENCE-STAND-PACK-BEHAVIOR-LESSON",
    evidenceSourceId: "NPC060:TRACKSIDE_LESSON",
  }),
  Object.freeze({
    id: "report_the_standoff",
    label: "村長へ夜の報告を上げる",
    family: "work",
    minutes: 29,
    facility: FAC.chief,
    summary:
      "退けた時刻、頭数、群れが振り返った方角を村務帳へ記録した。ガロはこれを王都近郊道の通行注意として、行商や旅人へ回すと決めた。",
    speech: Object.freeze({
      actorId: NPC.garo,
      text: "退けた、だけでは村の外に伝わらん。頭数と方角を書け。……近郊道を使う者に知らせておけば、余所で人が食われずに済む。それも村の仕事だ。",
      emotion: "村を越えた責任感",
    }),
    worldFlags: ["t03StandoffReported", "t03RoadWarningIssued"],
    historyType: "T03_STAND_STANDOFF_REPORTED",
    evidenceId: "T03-EVIDENCE-STAND-VILLAGE-NIGHT-REPORT",
    evidenceSourceId: "LOC_FARM_CHIEF:VILLAGE_DUTY_LEDGER",
  }),
]);

const MOVE_CHOICES = Object.freeze([
  Object.freeze({
    id: "scout_new_feeding_ground",
    label: "新しい餌場を下見する",
    family: "prepare",
    minutes: 96,
    facility: FAC.edge,
    summary:
      "村から十分離れ、しかし森の奥ほど危険でない中間の谷筋を下見した。ここへ餌を置けば、群れは村へも奥へも行かずに済む。巣ごと移す案の土台になる。",
    speech: Object.freeze({
      actorId: NPC.hakuto,
      text: "谷筋なら水もある。……羊を何頭か損する覚悟はいるが、毎晩柵を壊されるよりましだ。村の会合で通してくれるなら、俺が餌を出す。",
      emotion: "損得を計算した上での決断",
    }),
    worldFlags: ["t03FeedingGroundScouted", "t03RelocationSiteFound"],
    historyType: "T03_MOVE_FEEDING_GROUND_SCOUTED",
    evidenceId: "T03-EVIDENCE-MOVE-VALLEY-SITE",
    evidenceSourceId: "LOC_FARM_EDGE:VALLEY_SURVEY",
  }),
  Object.freeze({
    id: "count_the_loss",
    label: "食われた頭数を数える",
    family: "investigate",
    minutes: 41,
    facility: FAC.stable,
    summary:
      "この十日で失われた家畜を数え直した。被害は増え続けているが、狼が食べた量より減り方が大きい。余った肉を運び去る何かが、群れの後ろにいる。",
    speech: Object.freeze({
      actorId: NPC.hakuto,
      text: "十一頭。だが狼が食ったのはせいぜい四頭分だ。残りは、持っていかれてる。……狼が獲って、別の何かが横取りしてる。そういうことだろう。",
      emotion: "背筋の冷える計算",
    }),
    worldFlags: ["t03LivestockLossCounted", "t03PredatorBehindIndicated"],
    historyType: "T03_MOVE_LIVESTOCK_LOSS_COUNTED",
    evidenceId: "T03-EVIDENCE-MOVE-SURPLUS-KILLS",
    evidenceSourceId: "LOC_FARM_STABLE:LOSS_TALLY",
  }),
  Object.freeze({
    id: "share_the_burden",
    label: "村会合で負担を分ける",
    family: "talk",
    minutes: 58,
    facility: FAC.chief,
    summary:
      "餌に出す家畜の損を一軒に負わせないよう、村会合で分担を決めた。ハクト一人の犠牲ではなくなったことで、餌場計画は村の決定として動き出す。",
    speech: Object.freeze({
      actorId: NPC.garo,
      text: "牧場主一人に払わせて、村が助かる。それでは村ではない。……一軒あたり半頭ずつだ。反対する者は、今夜代わりに柵へ立て。誰も立たんだろう。",
      emotion: "共同体を守る強さ",
    }),
    worldFlags: ["t03BurdenShared", "t03VillageActsTogether", "t03VillageTrustsPlayer"],
    historyType: "T03_MOVE_BURDEN_SHARED",
    evidenceId: "T03-EVIDENCE-MOVE-VILLAGE-COMPACT",
    evidenceSourceId: "LOC_FARM_CHIEF:VILLAGE_ASSEMBLY",
  }),
]);

const TRACK_CHOICES = Object.freeze([
  Object.freeze({
    id: "read_the_deep_marks",
    label: "岩場の奥の爪痕を見る",
    family: "investigate",
    minutes: 88,
    facility: FAC.edge,
    summary:
      "狼が固まっていた岩場のさらに奥で、赤牙狼のものではない爪痕を見つけた。高さも幅も違い、樹皮ごと削り取られている。森の奥に、狼を押し出した上位の捕食者がいる。",
    speech: Object.freeze({
      actorId: NPC.jill,
      text: "……こいつは赤牙じゃない。俺の背より高いところに爪が入ってる。三十年この森にいるが、こんな痕は初めてだ。狼が逃げてくるわけだ。",
      emotion: "経験が通じない恐れ",
    }),
    worldFlags: ["t03ApexPredatorTraceFound", "t03ForestDeepDangerKnown"],
    historyType: "T03_TRACK_APEX_TRACE_FOUND",
    evidenceId: "T03-EVIDENCE-TRACK-APEX-CLAW-MARKS",
    evidenceSourceId: "LOC_FARM_EDGE:DEEP_ROCK_CLAWS",
  }),
  Object.freeze({
    id: "map_with_finn",
    label: "フィンの地図に描き足す",
    family: "work",
    minutes: 43,
    facility: FAC.well,
    summary:
      "フィンが持ち歩いている手書きの地図へ、狼の退路と岩場の位置を描き足した。子どもの落書きだった紙が、村で唯一の森外縁の実地図になっていく。",
    speech: Object.freeze({
      actorId: NPC.finn,
      text: "ぼくの地図に、本当のことが増えてく。……この岩場、行っちゃだめなんだよね。分かった。でも描いておく。描いておけば、次に誰かが行く前に止められるから。",
      emotion: "憧れが役目に変わる瞬間",
    }),
    worldFlags: ["t03ForestEdgeMapped", "t03FinnBecomesMapKeeper"],
    historyType: "T03_TRACK_FOREST_EDGE_MAPPED",
    evidenceId: "T03-EVIDENCE-TRACK-EDGE-MAP",
    evidenceSourceId: "NPC001:HAND_DRAWN_EDGE_MAP",
  }),
  Object.freeze({
    id: "ask_nene_the_old_case",
    label: "ネネ婆に昔の話を聞く",
    family: "talk",
    minutes: 36,
    facility: FAC.well,
    summary:
      "ネネ婆が言った『森が静かになりすぎた年』の話を最後まで聞いた。その年は川の水が減り、獣が里へ降り、やがて森の奥から何かが出てきたという。今と同じ順番である。",
    speech: Object.freeze({
      actorId: NPC.nene,
      text: "水が減ってね。井戸が細くなって、それから獣が降りてきた。……順番が同じだよ、あんた。狼の心配だけしてると、本当のは後から来る。川を見ておいで。",
      emotion: "警告としての昔話",
    }),
    worldFlags: ["t03OldPrecedentHeard", "t03RiverWatchAdvised"],
    historyType: "T03_TRACK_OLD_PRECEDENT_HEARD",
    evidenceId: "T03-EVIDENCE-TRACK-ELDER-PRECEDENT",
    evidenceSourceId: "NPC061:WELLSIDE_RECOLLECTION",
  }),
]);

const SCENES = Object.freeze({
  [PASTURE_SCENE]: PASTURE_CHOICES,
  [STAND_SCENE]: STAND_CHOICES,
  [MOVE_SCENE]: MOVE_CHOICES,
  [TRACK_SCENE]: TRACK_CHOICES,
});

const SCENE_GUIDANCE = Object.freeze({
  [PASTURE_SCENE]: Object.freeze({
    kicker: "柵の崩れ目の向こうで、赤牙狼の群れが羊の囲いを見ている",
    title: "群れと向き合う夜",
    detail:
      "正面から押し返すか、餌のほうを動かすか、退く先を追うか。どれも群れを止めうるが、後で分かることが違う。狼は村を憎んでいるわけではない。",
  }),
  [STAND_SCENE]: Object.freeze({
    kicker: "群れは退いたが、去り際に何度も森の奥を振り返っていた",
    title: "押し返した後に残るもの",
    detail:
      "柵を直すか、狼の読み方を習うか、記録を村の外へ回すか。腕で勝てることと、村が自力で保つことは別である。",
  }),
  [MOVE_SCENE]: Object.freeze({
    kicker: "羊を動かすと群れも動いた。狼は村ではなく餌を追っている",
    title: "餌が動けば群れも動く",
    detail:
      "新しい餌場を探すか、失った頭数を数え直すか、損を村で分けるか。巣ごと移す案は、誰かが一人で損を被る限り通らない。",
  }),
  [TRACK_SCENE]: Object.freeze({
    kicker: "狼たちは森の奥へ帰らず、外縁の岩場で固まって夜を明かしている",
    title: "帰れない理由を追う",
    detail:
      "岩場の奥を確かめるか、地図へ残すか、昔の同じ出来事を聞くか。狼を追い払っても、狼を押し出したものは森に残る。",
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

function statusOf(value) {
  return String(value?.status ?? value ?? "");
}

function t03Open(runtime) {
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

function withinNightWindow(runtime) {
  const minute = absoluteMinute(runtime);
  return minute >= NIGHT_OPEN_MINUTE && minute < NIGHT_CLOSE_MINUTE;
}

function readState(runtime) {
  const state = runtime?.playerState?.[STATE_KEY];
  return state && typeof state === "object" ? state : null;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_T03_PASTURE_NIGHT_VERSION,
    completedScenes: {},
    selectedActionIds: [],
    closedActionIds: {},
    currentSceneId: PASTURE_SCENE,
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_T03_PASTURE_NIGHT_VERSION;
  state.completedScenes = state.completedScenes && typeof state.completedScenes === "object"
    ? state.completedScenes
    : {};
  state.selectedActionIds = arr(state.selectedActionIds).map(String);
  state.closedActionIds = state.closedActionIds && typeof state.closedActionIds === "object"
    ? state.closedActionIds
    : {};
  if (typeof state.currentSceneId !== "string") state.currentSceneId = PASTURE_SCENE;
  return state;
}

// 既存のT03手書きモジュールが持ち場とする施設。ここでは割り込まない。
const RESERVED_FACILITY_IDS = new Set(["LOC_FARM_NORTH_FENCE"]);

function missionDefinition(runtime) {
  const byId = runtime?.playerState?.catalog?.byId;
  if (typeof byId?.get === "function") return byId.get(MISSION_ID) ?? null;
  return byId?.[MISSION_ID] ?? null;
}

// 正史カタログ上で次に残っている工程。手書きの初夜は、村長からの聞き取りより前だけに置く。
// 調査工程に入った後は wolf-continuity が持ち場なので割り込まない。
function beforeCanonicalHearing(runtime) {
  const mission = findMission(runtime);
  const definition = missionDefinition(runtime);
  if (!definition) return Number(mission?.progress?.investigate ?? 0) === 0;
  const step = (definition.steps ?? []).find((entry) =>
    Number(mission?.progress?.[entry.id] ?? 0) < Number(entry.required ?? 1));
  if (!step) return false;
  return step.id === "hear" || step.type === "conversation";
}

function activeSceneId(runtime) {
  if (!t03Open(runtime) || !inVillage(runtime) || !withinNightWindow(runtime)) return null;
  if (RESERVED_FACILITY_IDS.has(String(player(runtime).facilityId ?? ""))) return null;

  const state = readState(runtime);
  if (!state) {
    // 開幕は家畜が実際に狙われている牧場でしか始まらない。
    // 正史の調査が既に進んでいる場合も、初夜の場面はもう過ぎている。
    if (player(runtime).facilityId !== FAC.stable) return null;
    if (!beforeCanonicalHearing(runtime)) return null;
    return PASTURE_SCENE;
  }
  const sceneId = typeof state.currentSceneId === "string" ? state.currentSceneId : PASTURE_SCENE;
  if (!SCENES[sceneId]) return null;
  if (state.completedScenes?.[sceneId] != null) return null;
  if (sceneId === PASTURE_SCENE) {
    if (player(runtime).facilityId !== FAC.stable) return null;
    if (!beforeCanonicalHearing(runtime)) return null;
  }
  return sceneId;
}

function actionIdFor(sceneId, choice) {
  return `MISSION_FLOW:T03:${sceneId.replace(/-/g, "_").toUpperCase()}:${choice.id}`;
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
    dialogueTopic: `t03_pasture_${choice.id}`,
    dialogueExit: true,
    suppressRandomEncounter: true,
    encounterId: choice.encounterId ?? null,
    authoredMissionFlowExclusiveChoice: true,
    authoredT03PastureChoice: true,
    authoredT03PastureSceneId: sceneId,
    authoredT03PastureSummary: choice.summary,
    authoredT03PastureSpeech: choice.speech,
    authoredT03PastureWorldFlags: choice.worldFlags,
    authoredT03PastureHistoryType: choice.historyType,
    authoredT03PastureEvidenceId: choice.evidenceId,
    authoredT03PastureEvidenceSourceId: choice.evidenceSourceId,
    authoredT03PastureNextSceneId: choice.nextSceneId ?? null,
  };
}

function actions(runtime) {
  const sceneId = activeSceneId(runtime);
  if (!sceneId) return null;
  return SCENES[sceneId].map((choice) => actionFor(sceneId, choice));
}

function consume(runtime, action, result) {
  if (!action?.authoredT03PastureChoice || result?.ok === false) return false;
  const sceneId = action.authoredT03PastureSceneId;
  if (!SCENES[sceneId]) return false;

  const state = ensureState(runtime);
  if (state.completedScenes[sceneId] != null) return false;

  const minute = absoluteMinute(runtime);
  const allIds = SCENES[sceneId].map((choice) => actionIdFor(sceneId, choice));
  const closed = allIds.filter((id) => id !== action.id);

  state.completedScenes[sceneId] = minute;
  state.selectedActionIds = [...new Set([...state.selectedActionIds, action.id])];
  state.closedActionIds[sceneId] = closed;
  state.currentSceneId = action.authoredT03PastureNextSceneId ?? null;

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  for (const flag of arr(action.authoredT03PastureWorldFlags)) {
    runtime.playerState.worldFlags[flag] = true;
  }
  runtime.playerState.evidence[action.authoredT03PastureEvidenceId] = {
    id: action.authoredT03PastureEvidenceId,
    sourceId: action.authoredT03PastureEvidenceSourceId,
    acquiredAtMinute: minute,
  };
  runtime.playerState.history.push({
    type: action.authoredT03PastureHistoryType,
    minute,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    sceneId,
    actionId: action.id,
    closedActionIds: [...closed],
    encounterId: action.encounterId ?? null,
    evidenceId: action.authoredT03PastureEvidenceId,
    evidenceSourceId: action.authoredT03PastureEvidenceSourceId,
    nextSceneId: state.currentSceneId,
    location: LOCATION,
    facilityId: action.targetFacilityId,
  });

  const current = player(runtime);
  if (action.targetFacilityId) current.facilityId = action.targetFacilityId;

  result.summary = action.authoredT03PastureSummary;
  result.speeches = [action.authoredT03PastureSpeech];
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

export const AUTHORED_T03_PASTURE_NIGHT_INTERNALS = Object.freeze({
  MISSION_ID,
  TROUBLE_ID,
  LOCATION,
  STATE_KEY,
  FAC,
  NPC,
  PASTURE_SCENE,
  STAND_SCENE,
  MOVE_SCENE,
  TRACK_SCENE,
  NIGHT_OPEN_MINUTE,
  NIGHT_CLOSE_MINUTE,
  PASTURE_CHOICES,
  STAND_CHOICES,
  MOVE_CHOICES,
  TRACK_CHOICES,
  SCENES,
  SCENE_GUIDANCE,
  t03Open,
  inVillage,
  withinNightWindow,
  readState,
  ensureState,
  activeSceneId,
  beforeCanonicalHearing,
  missionDefinition,
  RESERVED_FACILITY_IDS,
  actionIdFor,
  actionFor,
  actions,
  consume,
});
