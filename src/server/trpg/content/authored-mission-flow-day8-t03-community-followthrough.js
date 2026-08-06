import * as base from "./authored-mission-flow-day2-day8-village-watch.js";

export * from "./authored-mission-flow-day2-day8-village-watch.js";

export const AUTHORED_DAY8_T03_COMMUNITY_FOLLOWTHROUGH_VERSION = "authored-day8-t03-community-followthrough-v1";

const MISSION_ID = "MSN-T03";
const TROUBLE_ID = "T03";
const SCENE_ID = "t03-day8-community-followthrough";
const LOCATION = "田園の村";
const START_FACILITY_ID = "LOC_FARM_NORTH_FENCE";
const STABLE_FACILITY_ID = "LOC_FARM_STABLE";
const SQUARE_FACILITY_ID = "LOC_FARM_SQUARE";
const JILL_ID = "NPC060";
const FINN_ID = "NPC001";
const GARO_ID = "NPC003";

const CHOICES = Object.freeze([
  Object.freeze({
    id: "triage_mare",
    label: "牝馬を診る",
    minutes: 36,
    targetFacilityId: STABLE_FACILITY_ID,
    targetNpcId: JILL_ID,
    openingChoice: "stable_bells",
    evidenceClass: "pack_movement",
    evidenceId: "T03-EVIDENCE-DAY8-MARE-WOUND-TRIAGE",
    evidenceSource: "LOC_FARM_STABLE:MARE_REAR_HOOF_WOUND",
    worldFlag: "day8WolfFollowthrough:mareTreated",
    historyType: "DAY8_T03_MARE_WOUND_TRIAGED",
    summary: "北柵から馬房へ急ぎ、怯えた牝馬の後脚を洗った。牙傷は浅く、泥の擦れ方は狼が家畜へ食らいついたのではなく、森側から押し出されて接触したことを示していた。",
    speech: "傷は浅い。噛み止めた跡じゃない。群れもこの馬も、同じ方向から逃げてきたらしい。鈴の順番を確かめよう。",
    emotion: "牝馬をなだめながら",
    hungerDelta: 3,
    fatigueDelta: 5,
  }),
  Object.freeze({
    id: "serve_watch_breakfast",
    label: "見張りへ朝食を配る",
    minutes: 28,
    targetFacilityId: START_FACILITY_ID,
    targetNpcId: GARO_ID,
    openingChoice: "loss_ledger",
    evidenceClass: "attack_timing",
    evidenceId: "T03-EVIDENCE-DAY8-WATCH-MEAL-LEDGER",
    evidenceSource: "LOC_FARM_NORTH_FENCE:BREAKFAST_DUTY_LEDGER",
    worldFlag: "day8WolfFollowthrough:watchFed",
    historyType: "DAY8_T03_WATCH_BREAKFAST_SERVED",
    summary: "粥鍋と黒パンを北柵へ運び、夜番の交代時刻と家畜被害の朝を一枚の当番帳へ書き合わせた。遠吠えの翌朝だけ、南側の見張りが早く交代していた。",
    speech: "腹が減ったままの話は抜けが出る。食ってから順に言え。……ほら、被害の朝だけ交代が早いだろう。",
    emotion: "湯気越しに帳面を指して",
    hungerDelta: -10,
    fatigueDelta: 2,
  }),
  Object.freeze({
    id: "borrow_finn_map",
    label: "フィンの地図を見る",
    minutes: 24,
    targetFacilityId: SQUARE_FACILITY_ID,
    targetNpcId: FINN_ID,
    openingChoice: "finn_edge_map",
    evidenceClass: "edge_route",
    evidenceId: "T03-EVIDENCE-DAY8-FINN-EDGE-MAP-COPY",
    evidenceSource: "LOC_FARM_SQUARE:FINN_CHARCOAL_EDGE_MAP",
    worldFlag: "day8WolfFollowthrough:finnMapCopied",
    historyType: "DAY8_T03_FINN_EDGE_MAP_BORROWED",
    summary: "広場へ戻り、フィンが炭で描いた畦道の地図を借りた。子どもの目印は粗いが、狼が避けた水溜まりと南柵への抜け道だけは驚くほど正確だった。",
    speech: "ここ、昨日は泥が深かったよ。狼は踏まないで、石のところを跳んだ。ぼく、そこなら案内できる。",
    emotion: "地図を両手で広げて",
    hungerDelta: 2,
    fatigueDelta: 2,
  }),
]);

function array(value) {
  return Array.isArray(value) ? value : [];
}

function minute(runtime) {
  return Number(runtime?.playerState?.absoluteMinute ?? 0);
}

function player(runtime) {
  return runtime?.playerState?.player ?? {};
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.day8T03CommunityFollowthrough ??= {
    version: AUTHORED_DAY8_T03_COMMUNITY_FOLLOWTHROUGH_VERSION,
    selectedActionId: null,
    closedActionIds: [],
    completedAtMinute: null,
  };
  const state = runtime.playerState.day8T03CommunityFollowthrough;
  state.version = AUTHORED_DAY8_T03_COMMUNITY_FOLLOWTHROUGH_VERSION;
  state.closedActionIds = array(state.closedActionIds).map(String);
  return state;
}

function watchCompleted(runtime) {
  return runtime?.playerState?.day2Day8VillageWatch?.howlCompletedAtMinute != null;
}

function atStart(runtime) {
  const current = player(runtime);
  return current.location === LOCATION && current.facilityId === START_FACILITY_ID;
}

function terminalT03(runtime) {
  const missionCollection = runtime?.playerState?.missions;
  const mission = Array.isArray(missionCollection)
    ? missionCollection.find((entry) => entry?.id === MISSION_ID)
    : missionCollection?.[MISSION_ID];
  return ["completed", "failed", "resolved", "terminal"].includes(String(mission?.status ?? ""));
}

function eligible(runtime) {
  const state = ensureState(runtime);
  return watchCompleted(runtime)
    && state.completedAtMinute == null
    && atStart(runtime)
    && !terminalT03(runtime);
}

function actionId(choiceId) {
  return `MISSION_FLOW:T03:DAY8_COMMUNITY:${choiceId}`;
}

function actionFor(choice) {
  return {
    id: actionId(choice.id),
    actionId: actionId(choice.id),
    label: choice.label,
    type: "conversation",
    family: choice.id,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    stepId: "hear",
    minutes: choice.minutes,
    targetLocation: LOCATION,
    targetFacilityId: choice.targetFacilityId,
    targetNpcId: choice.targetNpcId,
    authoredT03WolfChoice: true,
    t03OpeningChoice: choice.openingChoice,
    t03EvidenceClass: choice.evidenceClass,
    t03WorldFlags: [choice.worldFlag],
    t03Consequence: choice.summary,
    authoredDay8T03CommunityFollowthroughChoice: choice.id,
  };
}

function actions(runtime) {
  if (!eligible(runtime)) return null;
  return CHOICES.map(actionFor);
}

function closeIds(selectedId) {
  return CHOICES.map((choice) => actionId(choice.id)).filter((id) => id !== selectedId);
}

function updateNeeds(runtime, choice) {
  const current = player(runtime);
  current.needs ??= {};
  const hungerBefore = Number(current.needs.hunger ?? current.hunger ?? runtime.playerState.hunger ?? 0);
  const fatigueBefore = Number(current.needs.fatigue ?? current.fatigue ?? runtime.playerState.fatigue ?? 0);
  const hungerAfter = Math.max(0, Math.min(100, hungerBefore + choice.hungerDelta));
  const fatigueAfter = Math.max(0, Math.min(100, fatigueBefore + choice.fatigueDelta));
  current.needs.hunger = hungerAfter;
  current.needs.fatigue = fatigueAfter;
  current.hunger = hungerAfter;
  current.fatigue = fatigueAfter;
  runtime.playerState.hunger = hungerAfter;
  runtime.playerState.fatigue = fatigueAfter;
  return { hungerBefore, hungerAfter, fatigueBefore, fatigueAfter };
}

function ensureCollections(runtime) {
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  runtime.playerState.goapRequests ??= {};
}

function consume(runtime, action, result) {
  if (result?.ok === false || !action?.authoredDay8T03CommunityFollowthroughChoice) return false;
  const state = ensureState(runtime);
  if (state.completedAtMinute != null) return false;
  const choice = CHOICES.find((entry) => entry.id === action.authoredDay8T03CommunityFollowthroughChoice);
  if (!choice || action.id !== actionId(choice.id)) return false;

  ensureCollections(runtime);
  const now = minute(runtime);
  const current = player(runtime);
  const livingState = updateNeeds(runtime, choice);
  current.location = LOCATION;
  current.facilityId = choice.targetFacilityId;

  state.selectedActionId = action.id;
  state.closedActionIds = closeIds(action.id);
  state.completedAtMinute = now;

  runtime.playerState.worldFlags[choice.worldFlag] = true;
  runtime.playerState.worldFlags.t03CommunityInquiryStarted = true;
  runtime.playerState.evidence[choice.evidenceId] = {
    id: choice.evidenceId,
    source: choice.evidenceSource,
    acquiredAtMinute: now,
  };

  const requestId = `GOAP-DAY8-T03-FOLLOWUP-${choice.id.toUpperCase()}`;
  runtime.playerState.goapRequests[requestId] = {
    id: requestId,
    actorNpcId: choice.targetNpcId,
    goal: choice.id === "triage_mare"
      ? "compare_wolf_tracks_and_stable_bells"
      : choice.id === "serve_watch_breakfast"
        ? "crosscheck_watch_and_damage_times"
        : "copy_edge_route_and_mark_safe_steps",
    destination: choice.targetFacilityId,
    status: "active",
    createdAtMinute: now,
    sourceActionId: action.id,
  };

  runtime.playerState.history.push({
    type: choice.historyType,
    minute: now,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    sceneId: SCENE_ID,
    actionId: action.id,
    closedActionIds: [...state.closedActionIds],
    evidenceId: choice.evidenceId,
    evidenceSource: choice.evidenceSource,
    targetNpcId: choice.targetNpcId,
    goapRequestId: requestId,
    location: current.location,
    facilityId: current.facilityId,
  });

  result.summary = choice.summary;
  result.speeches = [{ actorId: choice.targetNpcId, text: choice.speech, emotion: choice.emotion }];
  result.sceneTransition = `t03-opening-${choice.openingChoice}`;
  result.evidenceId = choice.evidenceId;
  result.evidenceSource = choice.evidenceSource;
  result.goapRequestId = requestId;
  result.livingState = livingState;
  result.closedActionIds = [...state.closedActionIds];
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = actions(runtime);
  return own ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (eligible(runtime)) {
    return {
      missionId: MISSION_ID,
      kicker: "遠吠えが途切れると、夜番たちは互いの顔を見た。見張っただけでは、次の夜を守れない。",
      title: "夜明けの引継ぎ",
      detail: "傷を診る、働いた者へ食事を配る、子どもの地図を借りる。今ある手掛かりを誰かの次の行動へ渡す。",
      targetLocation: LOCATION,
      targetFacilityId: START_FACILITY_ID,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_DAY8_T03_COMMUNITY_FOLLOWTHROUGH_INTERNALS = Object.freeze({
  MISSION_ID,
  TROUBLE_ID,
  SCENE_ID,
  START_FACILITY_ID,
  CHOICES,
  minute,
  player,
  ensureState,
  watchCompleted,
  atStart,
  terminalT03,
  eligible,
  actionId,
  actionFor,
  actions,
  consume,
});
