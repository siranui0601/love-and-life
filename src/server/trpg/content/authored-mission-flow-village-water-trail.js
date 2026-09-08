import * as base from "./authored-mission-flow-village-daily-life.js";

export * from "./authored-mission-flow-village-daily-life.js";

export const AUTHORED_VILLAGE_WATER_TRAIL_VERSION = "authored-village-water-trail-v1";

// 日常の寄り道で拾える水の異変を、行き止まりにしない。
//
// 正本ではT13はDay1発生で、勝ち筋は「早期発見して小さいうちに倒す」。
// 井戸の水位跡、止まった小川、硬い麦粒は、いずれも公開された噂より早く
// 手に入る兆候である。二つ以上を抱えた者だけが、噂を待たずに水を追える。
//
// この層はT13を解決しない。正史の調査導線へ渡すところまでを受け持つ。

const FLOW_ID = "forest-king-slime-world-tree-collapse";
const MISSION_ID = "MSN-T13";
const TROUBLE_ID = "T13";
const LOCATION = "田園の村";
const STATE_KEY = "villageWaterTrail";
const TRAIL_SCENE = "village-water-trail";

const FAC = Object.freeze({
  well: "LOC_FARM_WELL",
  field: "LOC_FARM_FIELD",
  edge: "LOC_FARM_EDGE",
  chief: "LOC_FARM_CHIEF",
});

const NPC = Object.freeze({
  garo: "NPC003",
  eda: "NPC004",
  jill: "NPC060",
  nene: "NPC061",
});

const TERMINAL = new Set(["completed", "resolved", "terminal", "failed", "abandoned"]);

// 日常層で拾える三つの兆候。二つ揃うと、偶然では片づけられなくなる。
const WATER_SIGN_FLAGS = Object.freeze([
  "t13EarlyWaterSignNoticed", // 井戸の内壁の水位跡
  "t13StreamWentQuiet",       // 水車小屋裏の小川が止まった
  "t13IrrigationLevelLow",    // 用水が足りず麦粒が硬い
]);

const REQUIRED_SIGN_COUNT = 2;

// 正本の期限より前。Day60の倒壊を待たずに動ける者のための窓。
const TRAIL_OPEN_MINUTE = 0;
const TRAIL_CLOSE_MINUTE = 45 * 1440;

const TRAIL_CHOICES = Object.freeze([
  Object.freeze({
    id: "walk_the_stream_up",
    label: "小川を遡る",
    family: "investigate",
    minutes: 115,
    facility: FAC.edge,
    summary:
      "水車小屋の裏から細くなった流れを上流へ辿った。村の外れで水は完全に途切れ、川床だけが森の方へ続いている。涸れたのではない。どこか上で、水が持っていかれている。",
    speech: Object.freeze({
      actorId: NPC.jill,
      text: "川床は湿ってる。涸れた川はこうならん。……上で誰かが堰き止めてるか、何かが飲んでるかだ。森の中でな。俺は奥へは入らんぞ。あそこは今、嫌な感じがする。",
      emotion: "職業的な観察と、正直な怯え",
    }),
    worldFlags: ["t13WaterTrailFollowed", "t13UpstreamDrawSuspected"],
    historyType: "T13_WATER_TRAIL_STREAM_FOLLOWED",
    evidenceId: "T13-EVIDENCE-EARLY-UPSTREAM-DRAW",
    evidenceSourceId: "LOC_FARM_EDGE:DRY_STREAMBED",
  }),
  Object.freeze({
    id: "propose_deeper_well",
    label: "井戸を掘り下げる相談をする",
    family: "work",
    minutes: 68,
    facility: FAC.chief,
    summary:
      "井戸を掘り下げる話を村長宅へ持ち込んだ。ガロは費用を渋ったが、ネネ婆が同じ順番で起きた昔の年のことを話し始め、話は井戸の深さから森の水へ移っていった。",
    speech: Object.freeze({
      actorId: NPC.nene,
      text: "掘っても追いつかんよ。あん時もそうだった。井戸が痩せて、獣が降りて、それから森の奥から出てきた。……掘る金があるなら、森の水がどこへ行ってるのか見ておいで。",
      emotion: "止めるための昔語り",
    }),
    worldFlags: ["t13WellDeepeningDiscussed", "t13OldPrecedentLinked"],
    historyType: "T13_WATER_TRAIL_WELL_COUNCIL",
    evidenceId: "T13-EVIDENCE-EARLY-PRECEDENT-SEQUENCE",
    evidenceSourceId: "LOC_FARM_CHIEF:ELDER_TESTIMONY",
  }),
  Object.freeze({
    id: "ask_jill_forest_water",
    label: "ジルに森の水場を聞く",
    family: "talk",
    minutes: 54,
    facility: FAC.edge,
    summary:
      "猟師のジルへ、森のどこに水場があるのかを聞いた。ジルは獣道と一緒に水場の位置を諳んじたが、この一月で三つの水場が消え、獣がそこへ寄りつかなくなったと付け加えた。",
    speech: Object.freeze({
      actorId: NPC.jill,
      text: "水場は七つあった。今は四つだ。……消えた三つは、どれも大河の中流寄りでな。獣は水がなくても寄る。だが今は、水があった場所そのものを避けてる。",
      emotion: "地図が書き換わっていく戸惑い",
    }),
    worldFlags: ["t13ForestWaterMapKnown", "t13MidRiverAnomalyIndicated"],
    historyType: "T13_WATER_TRAIL_FOREST_WATER_MAP",
    evidenceId: "T13-EVIDENCE-EARLY-VANISHED-WATERING-HOLES",
    evidenceSourceId: "NPC060:HUNTER_WATER_MAP",
  }),
]);

const TRAIL_GUIDANCE = Object.freeze({
  kicker: "井戸も、小川も、麦の粒も、同じことを別々の言い方で告げている",
  title: "水がどこへ行ったのかを追う",
  detail:
    "誰にも頼まれていないし、村はまだ騒いでいない。それでも、流れを遡るか、井戸の相談から糸口を探すか、森を知る者に聞くかはできる。噂が立つ頃には、もう手遅れかもしれない。",
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

export function waterSignCount(runtime) {
  const flags = runtime?.playerState?.worldFlags ?? {};
  return WATER_SIGN_FLAGS.filter((flag) => flags[flag] === true).length;
}

function t13Untouched(runtime) {
  const mission = findMission(runtime);
  const trouble = runtime?.playerState?.troubles?.[TROUBLE_ID];
  if (mission && TERMINAL.has(statusOf(mission))) return false;
  if (trouble != null && TERMINAL.has(statusOf(trouble))) return false;
  // 正史の手書きフローが既に始まっていれば、そちらが導線を持っている。
  const flow = runtime?.authoredMissionFlows?.[FLOW_ID];
  if (flow && (flow.openingChoiceId || arr(flow.evidenceIds).length > 0)) return false;
  return true;
}

function inVillage(runtime) {
  return player(runtime).location === LOCATION;
}

function atTrailhead(runtime) {
  const facilityId = String(player(runtime).facilityId ?? "");
  return facilityId === FAC.well || facilityId === FAC.field;
}

function withinTrailWindow(runtime) {
  const minute = absoluteMinute(runtime);
  return minute >= TRAIL_OPEN_MINUTE && minute < TRAIL_CLOSE_MINUTE;
}

function readState(runtime) {
  const state = runtime?.playerState?.[STATE_KEY];
  return state && typeof state === "object" ? state : null;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_VILLAGE_WATER_TRAIL_VERSION,
    completedAtMinute: null,
    selectedActionId: null,
    closedActionIds: [],
    signCountAtChoice: 0,
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_VILLAGE_WATER_TRAIL_VERSION;
  state.closedActionIds = arr(state.closedActionIds).map(String);
  return state;
}

export function eligible(runtime) {
  if (!inVillage(runtime) || !atTrailhead(runtime) || !withinTrailWindow(runtime)) return false;
  if (waterSignCount(runtime) < REQUIRED_SIGN_COUNT) return false;
  if (!t13Untouched(runtime)) return false;
  return readState(runtime)?.completedAtMinute == null;
}

function actionIdFor(choice) {
  return `MISSION_FLOW:T13:WATER_TRAIL:${choice.id}`;
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
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    targetLocation: LOCATION,
    targetFacilityId: choice.facility,
    targetNpcId: choice.speech.actorId,
    dialogueTopic: `t13_water_trail_${choice.id}`,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredWaterTrailChoice: true,
    authoredWaterTrailSummary: choice.summary,
    authoredWaterTrailSpeech: choice.speech,
    authoredWaterTrailWorldFlags: choice.worldFlags,
    authoredWaterTrailHistoryType: choice.historyType,
    authoredWaterTrailEvidenceId: choice.evidenceId,
    authoredWaterTrailEvidenceSourceId: choice.evidenceSourceId,
  };
}

function actions(runtime) {
  if (!eligible(runtime)) return null;
  return TRAIL_CHOICES.map(actionFor);
}

function consume(runtime, action, result) {
  if (!action?.authoredWaterTrailChoice || result?.ok === false) return false;
  const state = ensureState(runtime);
  if (state.completedAtMinute != null) return false;

  const minute = absoluteMinute(runtime);
  const closed = TRAIL_CHOICES.map(actionIdFor).filter((id) => id !== action.id);

  state.completedAtMinute = minute;
  state.selectedActionId = action.id;
  state.closedActionIds = closed;
  state.signCountAtChoice = waterSignCount(runtime);

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  for (const flag of arr(action.authoredWaterTrailWorldFlags)) {
    runtime.playerState.worldFlags[flag] = true;
  }
  // 噂を待たずに水の異変へ辿り着いた、という事実そのものを残す。
  runtime.playerState.worldFlags.t13FoundBeforeRumor = true;
  runtime.playerState.evidence[action.authoredWaterTrailEvidenceId] = {
    id: action.authoredWaterTrailEvidenceId,
    sourceId: action.authoredWaterTrailEvidenceSourceId,
    acquiredAtMinute: minute,
  };
  runtime.playerState.history.push({
    type: action.authoredWaterTrailHistoryType,
    minute,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    sceneId: TRAIL_SCENE,
    actionId: action.id,
    closedActionIds: [...closed],
    signCountAtChoice: state.signCountAtChoice,
    evidenceId: action.authoredWaterTrailEvidenceId,
    evidenceSourceId: action.authoredWaterTrailEvidenceSourceId,
    location: LOCATION,
    facilityId: action.targetFacilityId,
  });

  const current = player(runtime);
  if (action.targetFacilityId) current.facilityId = action.targetFacilityId;

  result.summary = action.authoredWaterTrailSummary;
  result.speeches = [action.authoredWaterTrailSpeech];
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = actions(runtime);
  if (own) return own;
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (eligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: TRAIL_GUIDANCE.kicker,
      title: TRAIL_GUIDANCE.title,
      detail: TRAIL_GUIDANCE.detail,
      targetLocation: LOCATION,
      targetFacilityId: player(runtime).facilityId ?? FAC.well,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_VILLAGE_WATER_TRAIL_INTERNALS = Object.freeze({
  FLOW_ID,
  MISSION_ID,
  TROUBLE_ID,
  LOCATION,
  STATE_KEY,
  TRAIL_SCENE,
  FAC,
  NPC,
  WATER_SIGN_FLAGS,
  REQUIRED_SIGN_COUNT,
  TRAIL_OPEN_MINUTE,
  TRAIL_CLOSE_MINUTE,
  TRAIL_CHOICES,
  TRAIL_GUIDANCE,
  waterSignCount,
  t13Untouched,
  inVillage,
  atTrailhead,
  withinTrailWindow,
  readState,
  ensureState,
  eligible,
  actionIdFor,
  actionFor,
  actions,
  consume,
});
