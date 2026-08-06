import * as base from "./authored-mission-flow-t03-pasture-night.js";

export * from "./authored-mission-flow-t03-pasture-night.js";

export const AUTHORED_VILLAGE_DAILY_LIFE_VERSION = "authored-village-daily-life-v1";

// 事件の話だけを選び続けないと全解決できない、という作りにしない。
// この層は、手書きの事件場面が一つも出ていない時にだけ現れる日常の寄り道である。
// 見返りの薄い枝もあるが、いくつかは正史の手掛かりへ確かに繋がる。
// 特に井戸の水位は、正本で「T13で水量低下の最初の兆候」とされている地点。

const LOCATION = "田園の村";
const STATE_KEY = "villageDailyLife";

const FAC = Object.freeze({
  well: "LOC_FARM_WELL",
  field: "LOC_FARM_FIELD",
  inn: "LOC_FARM_INN",
});

const NPC = Object.freeze({
  eda: "NPC004",
  rona: "NPC058",
  jill: "NPC060",
  nene: "NPC061",
  coby: "NPC062",
});

const WELL_SCENE = "daily-wellside";
const FIELD_SCENE = "daily-wheatfield";
const INN_SCENE = "daily-inn-evening";

// 生活は事件より早く始まり、事件より長く続く。Day1からDay40まで開いている。
const DAILY_OPEN_MINUTE = 0;
const DAILY_CLOSE_MINUTE = 40 * 1440;

const WELL_CHOICES = Object.freeze([
  Object.freeze({
    id: "gulp_water",
    label: "水をがぶ飲みする",
    family: "eat",
    minutes: 8,
    hunger: -6,
    fatigue: -9,
    summary:
      "釣瓶を引き上げ、桶へ直接口をつけて飲んだ。冷たいが、舌の奥に土の味が残る。この村へ来てから何度か飲んでいるが、前より水が重い気がした。",
    speech: Object.freeze({
      actorId: NPC.eda,
      text: "行儀が悪いねえ。……でも、そうだろ。味が変わったって、うちの人も言ってる。井戸が深くなると土の味がするんだよ。前はこんなじゃなかった。",
      emotion: "笑いながら、少し引っかかっている",
    }),
    worldFlags: ["dailyWellWaterTasted", "t13WaterTasteChanged"],
    historyType: "DAILY_WELL_WATER_GULPED",
  }),
  Object.freeze({
    id: "read_the_waterline",
    label: "桶の縁の跡を見る",
    family: "investigate",
    minutes: 14,
    summary:
      "井戸の内壁に、水が長く触れていた場所の色の変わり目が残っている。今の水面は、その線より手のひら一つ分低い。誰も騒いでいないが、この井戸は静かに痩せている。",
    speech: Object.freeze({
      actorId: NPC.nene,
      text: "よく見つけたね。……線より下がるのは、日照りの年だけさ。今年は雨も降ってる。降ってるのに下がるってのはね、雨のせいじゃないってことだよ。川を見ておいで。",
      emotion: "何かを思い出しかけている",
    }),
    worldFlags: ["t13EarlyWaterSignNoticed", "t13RiverWatchAdvised"],
    historyType: "DAILY_WELL_WATERLINE_READ",
    evidenceId: "T13-EVIDENCE-DAILY-WELL-WATERLINE",
    evidenceSourceId: "LOC_FARM_WELL:OLD_WATERLINE_STAIN",
  }),
  Object.freeze({
    id: "splash_the_kids",
    label: "子どもと水を掛け合う",
    family: "talk",
    minutes: 21,
    fatigue: 5,
    summary:
      "桶の水を掛け合って騒いだ。びしょ濡れで笑い転げた後、コビーが「水車小屋の裏の小川、音がしなくなった」と、遊びの続きのように言った。",
    speech: Object.freeze({
      actorId: NPC.coby,
      text: "ずるい、そっち多い! ……あ、そうだ。裏の小川さ、前はザーザーいってたのに、今チョロチョロなんだ。魚とりに行っても、もういないよ。",
      emotion: "遊びの合間の何気なさ",
    }),
    worldFlags: ["dailyChildrenPlayed", "t13StreamWentQuiet", "villageChildrenTrustPlayer"],
    historyType: "DAILY_WELL_SPLASH_PLAY",
    evidenceId: "T13-EVIDENCE-DAILY-STREAM-GONE-QUIET",
    evidenceSourceId: "NPC062:CHILDRENS_FISHING_SPOT",
  }),
]);

const FIELD_CHOICES = Object.freeze([
  Object.freeze({
    id: "lie_in_the_furrow",
    label: "畝に寝転ぶ",
    family: "rest",
    minutes: 45,
    fatigue: -22,
    summary:
      "刈り入れ前の麦の間に寝転んだ。空だけが見える。召喚されてから初めて、何かを追いかけていない時間を過ごした。起き上がると、頭の中が少し整理されている。",
    speech: Object.freeze({
      actorId: NPC.eda,
      text: "麦の中で寝るのかい。……いいよ、踏まなきゃ。あんた、来てからずっと走ってるからね。この村じゃ、何もしない日ってのも仕事のうちだよ。",
      emotion: "見守る側の優しさ",
    }),
    worldFlags: ["dailyRestedInField", "playerKnownAsVillageRegular"],
    historyType: "DAILY_FIELD_LAY_IN_FURROW",
  }),
  Object.freeze({
    id: "chew_a_grain",
    label: "穂を一粒噛む",
    family: "eat",
    minutes: 6,
    hunger: -2,
    summary:
      "熟れかけの粒を一つ取って噛んだ。硬い。エダによれば、例年ならこの時期にはもう柔らかいという。水が足りていない麦の粒である。",
    speech: Object.freeze({
      actorId: NPC.eda,
      text: "硬いだろ。今年はどこもそうさ。雨は降ってるのに、根が吸えてない。……用水の水位が下がってるからだって、うちの人は言うけどね。",
      emotion: "農婦としての小さな不安",
    }),
    worldFlags: ["dailyGrainTasted", "t13IrrigationLevelLow"],
    historyType: "DAILY_FIELD_GRAIN_CHEWED",
    evidenceId: "T13-EVIDENCE-DAILY-HARD-GRAIN",
    evidenceSourceId: "LOC_FARM_FIELD:UNRIPE_EAR",
  }),
  Object.freeze({
    id: "fix_the_scarecrow",
    label: "案山子を直す",
    family: "work",
    minutes: 38,
    fatigue: 8,
    summary:
      "傾いた案山子の柱を立て直し、外れていた腕木を縛った。何の報酬もない作業だったが、畑を通る村人が一人ずつ声をかけていく。",
    speech: Object.freeze({
      actorId: NPC.eda,
      text: "誰も頼んでないのにねえ。……この村じゃ、そういうのを見てる人がいるんだよ。あんたが困った時、名前を出せる相手が増えたと思いな。",
      emotion: "からかいと本気の半々",
    }),
    worldFlags: ["dailyScarecrowFixed", "villageOwesPlayerSmallFavors"],
    historyType: "DAILY_FIELD_SCARECROW_FIXED",
  }),
]);

const INN_CHOICES = Object.freeze([
  Object.freeze({
    id: "share_a_table",
    label: "相席する",
    family: "talk",
    minutes: 52,
    hunger: -14,
    summary:
      "麦穂亭の長卓で、名前も知らない村人たちと同じ皿をつついた。話題は天気と値段と誰かの噂で、事件の話は一度も出なかった。それでも、街道の様子が一通り耳に入る。",
    speech: Object.freeze({
      actorId: NPC.rona,
      text: "座んなよ、詰めてもらうから。……この卓はね、うちで一番よく喋る卓なんだ。何も訊かずに座ってるだけで、そのうち勝手に全部聞こえてくるよ。",
      emotion: "宿の女将らしい世話焼き",
    }),
    worldFlags: ["dailySharedTable", "villageGossipAccess"],
    historyType: "DAILY_INN_SHARED_TABLE",
  }),
  Object.freeze({
    id: "hear_the_landlady_complain",
    label: "女将の愚痴を聞く",
    family: "talk",
    minutes: 33,
    summary:
      "客が引けた後のローナの愚痴に付き合った。仕入れの値、酔客、亭主の話。その流れで、最近は森へ入る猟師が獲物を持ち帰らなくなったという話が出た。",
    speech: Object.freeze({
      actorId: NPC.rona,
      text: "肉が入らないんだよ。ジルがね、獲れないんじゃなくて、獲りに行かないんだと。森の奥が嫌な感じだって。……あの人がそう言うのは、初めてだよ。",
      emotion: "愚痴の底に混じる不安",
    }),
    worldFlags: ["dailyLandladyConfided", "t03HuntersAvoidDeepForest"],
    historyType: "DAILY_INN_LANDLADY_CONFIDED",
    evidenceId: "T03-EVIDENCE-DAILY-HUNTERS-STAY-OUT",
    evidenceSourceId: "NPC058:AFTER_HOURS_COMPLAINT",
  }),
  Object.freeze({
    id: "turn_in_early",
    label: "早めに寝る",
    family: "sleep",
    minutes: 420,
    fatigue: -55,
    hunger: 12,
    summary:
      "まだ話し声が残るうちに部屋へ上がり、深く眠った。翌朝は身体が軽い。その代わり、夜のうちに村を通った者のことは何も知らない。",
    speech: Object.freeze({
      actorId: NPC.rona,
      text: "もう寝るのかい。……賢いよ。倒れてから休むより、倒れる前に休むほうがずっと安い。朝飯は残しといてやる。",
      emotion: "宿屋としての実感",
    }),
    worldFlags: ["dailySleptEarly"],
    historyType: "DAILY_INN_SLEPT_EARLY",
  }),
]);

const SCENES = Object.freeze({
  [WELL_SCENE]: Object.freeze({ facility: FAC.well, choices: WELL_CHOICES }),
  [FIELD_SCENE]: Object.freeze({ facility: FAC.field, choices: FIELD_CHOICES }),
  [INN_SCENE]: Object.freeze({ facility: FAC.inn, choices: INN_CHOICES }),
});

const SCENE_GUIDANCE = Object.freeze({
  [WELL_SCENE]: Object.freeze({
    kicker: "釣瓶の縄が濡れている。誰かが先に汲んでいったばかりらしい",
    title: "井戸端で一息つく",
    detail: "急ぐ用がないなら、水を飲んでも、井戸を覗き込んでも、子どもの相手をしてもよい。村の井戸は、村で一番よく人が通る場所である。",
  }),
  [FIELD_SCENE]: Object.freeze({
    kicker: "麦の穂が風で一斉に傾き、また戻る",
    title: "麦畑で時間を使う",
    detail: "あなたがこの世界で最初に目を覚ました場所である。寝転んでも、穂を齧っても、誰にも頼まれていない修繕をしてもよい。",
  }),
  [INN_SCENE]: Object.freeze({
    kicker: "麦穂亭の窓に灯りが入り、長卓のほうから笑い声がしている",
    title: "麦穂亭の夜",
    detail: "同じ卓に混ざるか、女将の愚痴に付き合うか、先に休むか。事件の話をしなくても、この村のことは向こうから聞こえてくる。",
  }),
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

function readState(runtime) {
  const state = runtime?.playerState?.[STATE_KEY];
  return state && typeof state === "object" ? state : null;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_VILLAGE_DAILY_LIFE_VERSION,
    completedScenes: {},
    selectedActionIds: [],
    closedActionIds: {},
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_VILLAGE_DAILY_LIFE_VERSION;
  state.completedScenes = state.completedScenes && typeof state.completedScenes === "object"
    ? state.completedScenes
    : {};
  state.selectedActionIds = arr(state.selectedActionIds).map(String);
  state.closedActionIds = state.closedActionIds && typeof state.closedActionIds === "object"
    ? state.closedActionIds
    : {};
  return state;
}

function sceneForFacility(runtime) {
  const facilityId = String(player(runtime).facilityId ?? "");
  for (const [sceneId, scene] of Object.entries(SCENES)) {
    if (scene.facility === facilityId) return sceneId;
  }
  return null;
}

// 夜の宿は日が落ちてから。井戸と畑は明るいうちだけ。
function withinSceneHours(runtime, sceneId) {
  const minute = minuteOfDay(runtime);
  if (sceneId === INN_SCENE) return minute >= 17 * 60 || minute < 2 * 60;
  return minute >= 6 * 60 && minute < 19 * 60;
}

// 寄り道は身体に余裕がある時のものである。空腹や疲労が切迫していれば、
// 食事・宿泊・休息を出す生存側の持ち場を邪魔しない。
const NEEDS_CALM_THRESHOLD = 70;

function needValue(runtime, key) {
  const current = player(runtime);
  const candidates = [current?.needs?.[key], current?.[key], runtime?.playerState?.[key]];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function needsAreCalm(runtime) {
  return needValue(runtime, "hunger") < NEEDS_CALM_THRESHOLD
    && needValue(runtime, "fatigue") < NEEDS_CALM_THRESHOLD;
}

function ownSceneId(runtime) {
  if (player(runtime).location !== LOCATION) return null;
  const minute = absoluteMinute(runtime);
  if (minute < DAILY_OPEN_MINUTE || minute >= DAILY_CLOSE_MINUTE) return null;
  if (!needsAreCalm(runtime)) return null;

  const sceneId = sceneForFacility(runtime);
  if (!sceneId || !withinSceneHours(runtime, sceneId)) return null;
  if (readState(runtime)?.completedScenes?.[sceneId] != null) return null;
  return sceneId;
}

// この層は最下位。手書きの事件場面が一つでも出ている間は決して割り込まない。
function baseIsSpeaking(runtime) {
  return base.authoredMissionFlowGuidance(runtime) != null;
}

function activeSceneId(runtime) {
  if (baseIsSpeaking(runtime)) return null;
  return ownSceneId(runtime);
}

function actionIdFor(sceneId, choice) {
  return `DAILY_LIFE:${sceneId.replace(/-/g, "_").toUpperCase()}:${choice.id}`;
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
    targetLocation: LOCATION,
    targetFacilityId: SCENES[sceneId].facility,
    targetNpcId: choice.speech.actorId,
    dialogueTopic: `daily_${choice.id}`,
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredDailyLifeChoice: true,
    authoredDailyLifeSceneId: sceneId,
    authoredDailyLifeSummary: choice.summary,
    authoredDailyLifeSpeech: choice.speech,
    authoredDailyLifeWorldFlags: choice.worldFlags,
    authoredDailyLifeHistoryType: choice.historyType,
    authoredDailyLifeEvidenceId: choice.evidenceId ?? null,
    authoredDailyLifeEvidenceSourceId: choice.evidenceSourceId ?? null,
    authoredDailyLifeHunger: choice.hunger ?? 0,
    authoredDailyLifeFatigue: choice.fatigue ?? 0,
  };
}

function actions(runtime) {
  const sceneId = activeSceneId(runtime);
  if (!sceneId) return null;
  return SCENES[sceneId].choices.map((choice) => actionFor(sceneId, choice));
}

function applyNeed(target, key, delta) {
  if (!target || !delta) return;
  const current = Number(target[key]);
  if (!Number.isFinite(current)) return;
  target[key] = Math.max(0, Math.min(100, current + delta));
}

function consume(runtime, action, result) {
  if (!action?.authoredDailyLifeChoice || result?.ok === false) return false;
  const sceneId = action.authoredDailyLifeSceneId;
  if (!SCENES[sceneId]) return false;

  const state = ensureState(runtime);
  if (state.completedScenes[sceneId] != null) return false;

  const minute = absoluteMinute(runtime);
  const allIds = SCENES[sceneId].choices.map((choice) => actionIdFor(sceneId, choice));
  const closed = allIds.filter((id) => id !== action.id);

  state.completedScenes[sceneId] = minute;
  state.selectedActionIds = [...new Set([...state.selectedActionIds, action.id])];
  state.closedActionIds[sceneId] = closed;

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  for (const flag of arr(action.authoredDailyLifeWorldFlags)) {
    runtime.playerState.worldFlags[flag] = true;
  }
  if (action.authoredDailyLifeEvidenceId) {
    runtime.playerState.evidence[action.authoredDailyLifeEvidenceId] = {
      id: action.authoredDailyLifeEvidenceId,
      sourceId: action.authoredDailyLifeEvidenceSourceId,
      acquiredAtMinute: minute,
    };
  }

  for (const target of [runtime.playerState, player(runtime)]) {
    applyNeed(target, "hunger", action.authoredDailyLifeHunger);
    applyNeed(target, "fatigue", action.authoredDailyLifeFatigue);
  }

  runtime.playerState.history.push({
    type: action.authoredDailyLifeHistoryType,
    minute,
    sceneId,
    actionId: action.id,
    closedActionIds: [...closed],
    evidenceId: action.authoredDailyLifeEvidenceId,
    evidenceSourceId: action.authoredDailyLifeEvidenceSourceId,
    location: LOCATION,
    facilityId: action.targetFacilityId,
  });

  result.summary = action.authoredDailyLifeSummary;
  result.speeches = [action.authoredDailyLifeSpeech];
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const fromBase = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (Array.isArray(fromBase) && fromBase.length > 0) return fromBase;
  return actions(runtime) ?? fromBase;
}

export function authoredMissionFlowGuidance(runtime) {
  const fromBase = base.authoredMissionFlowGuidance(runtime);
  if (fromBase) return fromBase;
  const sceneId = ownSceneId(runtime);
  if (!sceneId) return null;
  const guidance = SCENE_GUIDANCE[sceneId];
  return {
    missionId: null,
    kicker: guidance.kicker,
    title: guidance.title,
    detail: guidance.detail,
    targetLocation: LOCATION,
    targetFacilityId: SCENES[sceneId].facility,
    actionPanel: null,
  };
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_VILLAGE_DAILY_LIFE_INTERNALS = Object.freeze({
  LOCATION,
  STATE_KEY,
  FAC,
  NPC,
  WELL_SCENE,
  FIELD_SCENE,
  INN_SCENE,
  DAILY_OPEN_MINUTE,
  DAILY_CLOSE_MINUTE,
  WELL_CHOICES,
  FIELD_CHOICES,
  INN_CHOICES,
  SCENES,
  SCENE_GUIDANCE,
  minuteOfDay,
  readState,
  ensureState,
  sceneForFacility,
  withinSceneHours,
  needsAreCalm,
  needValue,
  NEEDS_CALM_THRESHOLD,
  ownSceneId,
  baseIsSpeaking,
  activeSceneId,
  actionIdFor,
  actionFor,
  actions,
  consume,
});
