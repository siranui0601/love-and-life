import * as base from "./authored-mission-flow-day2-t01-village-warning-result.js";

export * from "./authored-mission-flow-day2-t01-village-warning-result.js";

export const AUTHORED_DAY2_DAY8_VILLAGE_WATCH_VERSION = "authored-day2-day8-village-watch-v1";

const T01_MISSION_ID = "MSN-T01";
const T03_MISSION_ID = "MSN-T03";
const ROSTER_SCENE_ID = "t01-day2-village-watch-roster";
const HOWL_SCENE_ID = "t03-day8-first-howl-watch";
const WATCH_REQUEST_ID = "GOAP-DAY8-FARM-WOLF-WATCH";
const VILLAGE_LOCATION = "田園の村";
const VILLAGE_SQUARE_ID = "LOC_FARM_SQUARE";
const NORTH_FENCE_ID = "LOC_FARM_NORTH_FENCE";
const JILL_ID = "NPC060";
const RIONA_ID = "NPC008";
const DAY8_DAWN_MINUTE = 7 * 1440 + 5 * 60;

const ROSTER_CHOICES = Object.freeze([
  Object.freeze({
    id: "circulate_watch_tags",
    label: "当番札を回す",
    family: "coordination",
    minutes: 35,
    actorId: JILL_ID,
    summary: "北柵、馬小屋、共同穀倉の三か所へ木札を回し、誰がどの刻に見張るかを村人同士で決めた。",
    speech: "名前を書くだけじゃ足りん。来られない時に誰へ渡すかまで決めろ。見張りは一人の根性じゃ続かない。",
    worldFlag: "day2VillageWatch:rosterCirculated",
    historyType: "DAY2_VILLAGE_WATCH_ROSTER_CIRCULATED",
    requestActorId: JILL_ID,
    requestGoal: "coordinate_shared_watch",
  }),
  Object.freeze({
    id: "send_notice_with_merchant",
    label: "行商便に載せる",
    family: "logistics",
    minutes: 22,
    actorId: JILL_ID,
    summary: "リオナの荷札へ短い警戒文を添え、近隣農家にも家畜を早めに囲うよう知らせる便を組んだ。",
    speech: "リオナなら余計な噂は足さない。見たことと、頼みたいことだけ書け。",
    worldFlag: "day2VillageWatch:merchantNoticeSent",
    historyType: "DAY2_VILLAGE_WATCH_MERCHANT_NOTICE_SENT",
    requestActorId: RIONA_ID,
    requestGoal: "carry_farm_warning",
    contractId: "CONTRACT-DAY2-RIONA-FARM-WATCH-NOTICE",
  }),
  Object.freeze({
    id: "keep_watch_quiet",
    label: "静かに見守る",
    family: "non_intervention",
    minutes: 12,
    actorId: JILL_ID,
    summary: "村を騒がせず、ジルと見張り役だけで北柵の変化を記録する方針にした。",
    speech: "騒がせないのも仕事だ。何も起きなかった時に、誰も英雄扱いされない仕事だがな。",
    worldFlag: "day2VillageWatch:quietObservationChosen",
    historyType: "DAY2_VILLAGE_WATCH_QUIET_OBSERVATION",
    requestActorId: JILL_ID,
    requestGoal: "observe_without_alarm",
  }),
]);

const HOWL_CHOICES = Object.freeze([
  Object.freeze({
    id: "send_children_home",
    label: "子どもを家へ返す",
    family: "rescue",
    minutes: 25,
    actorId: JILL_ID,
    summary: "見張りを真似して集まった子どもたちを一軒ずつ家へ返し、北柵の周囲から人影を減らした。",
    speech: "狼を怖がらせるために子どもを残す馬鹿はいない。まず人を退ける。それから獣を見る。",
    worldFlag: "day8WolfWatch:childrenSheltered",
    historyType: "DAY8_WOLF_WATCH_CHILDREN_SHELTERED",
    evidenceId: "T03-EVIDENCE-DAY8-COMMUNITY-WATCH-ROSTER",
    evidenceSource: "LOC_FARM_NORTH_FENCE:WATCH_TAG_BOARD",
  }),
  Object.freeze({
    id: "call_jill_to_fence",
    label: "ジルを呼ぶ",
    family: "coordination",
    minutes: 40,
    actorId: JILL_ID,
    summary: "三方向から聞こえた遠吠えの間隔をジルと照合し、群れが森奥から南へ押されている向きを絞った。",
    speech: "声の大きさじゃない。返事までの間だ。三つ目だけが近づいている。群れは狩りに来たんじゃない。",
    worldFlag: "day8WolfWatch:jillTriangulatedHowls",
    historyType: "DAY8_WOLF_WATCH_JILL_TRIANGULATED_HOWLS",
    evidenceId: "T03-EVIDENCE-DAY8-HOWL-TRIANGULATION",
    evidenceSource: "LOC_FARM_NORTH_FENCE:SHARED_WATCH_LOG",
  }),
  Object.freeze({
    id: "extinguish_torches",
    label: "松明を消して待つ",
    family: "observation",
    minutes: 30,
    actorId: JILL_ID,
    summary: "松明を消して柵の陰に伏せ、赤牙狼の親個体が家畜へ向かわず幼獣を南へ誘導する姿を見届けた。",
    speech: "見えたな。あれは襲う足取りじゃない。後ろを気にしながら逃がしている。",
    worldFlag: "day8WolfWatch:southwardPassageObserved",
    historyType: "DAY8_WOLF_WATCH_SOUTHWARD_PASSAGE_OBSERVED",
    evidenceId: "T03-EVIDENCE-DAY8-SOUTHWARD-PACK-PASSAGE",
    evidenceSource: "LOC_FARM_NORTH_FENCE:UNLIT_OBSERVATION",
  }),
]);

function array(value) { return Array.isArray(value) ? value : []; }
function player(runtime) { return runtime?.playerState?.player ?? runtime?.playerState ?? {}; }
function minute(runtime) { return Number(runtime?.playerState?.absoluteMinute ?? 0); }

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.day2Day8VillageWatch ??= {
    version: AUTHORED_DAY2_DAY8_VILLAGE_WATCH_VERSION,
    rosterSelectedActionId: null,
    rosterClosedActionIds: [],
    rosterCompletedAtMinute: null,
    day8DueAtMinute: DAY8_DAWN_MINUTE,
    howlSelectedActionId: null,
    howlClosedActionIds: [],
    howlCompletedAtMinute: null,
  };
  const state = runtime.playerState.day2Day8VillageWatch;
  state.version = AUTHORED_DAY2_DAY8_VILLAGE_WATCH_VERSION;
  state.rosterClosedActionIds = array(state.rosterClosedActionIds).map(String);
  state.howlClosedActionIds = array(state.howlClosedActionIds).map(String);
  state.day8DueAtMinute = Number(state.day8DueAtMinute ?? DAY8_DAWN_MINUTE);
  return state;
}

function warningCompleted(runtime) {
  return runtime?.playerState?.day2T01VillageWarning?.completedAtMinute != null;
}

function rosterEligible(runtime) {
  const state = ensureState(runtime);
  return warningCompleted(runtime) && state.rosterCompletedAtMinute == null;
}

function day8Pending(runtime) {
  const state = ensureState(runtime);
  return state.rosterCompletedAtMinute != null
    && state.howlCompletedAtMinute == null
    && minute(runtime) >= state.day8DueAtMinute;
}

function howlEligible(runtime) {
  const current = player(runtime);
  return day8Pending(runtime)
    && current.location === VILLAGE_LOCATION
    && current.facilityId === NORTH_FENCE_ID;
}

function actionFor(scene, choice) {
  const prefix = scene === "roster" ? "DAY2_VILLAGE_WATCH" : "DAY8_FIRST_HOWL";
  return {
    id: `MISSION_FLOW:${scene === "roster" ? "T01" : "T03"}:${prefix}:${choice.id}`,
    type: "plan",
    family: choice.family,
    minutes: choice.minutes,
    label: choice.label,
    missionId: scene === "roster" ? T01_MISSION_ID : T03_MISSION_ID,
    targetNpcId: choice.actorId,
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredDay2Day8VillageWatchChoice: true,
    authoredDay2Day8VillageWatchScene: scene,
    authoredDay2Day8VillageWatchData: choice,
  };
}

function actions(runtime) {
  if (rosterEligible(runtime)) return ROSTER_CHOICES.map((choice) => actionFor("roster", choice));
  if (howlEligible(runtime)) return HOWL_CHOICES.map((choice) => actionFor("howl", choice));
  return null;
}

function closeIds(scene, selectedId) {
  const choices = scene === "roster" ? ROSTER_CHOICES : HOWL_CHOICES;
  return choices.map((choice) => actionFor(scene, choice).id).filter((id) => id !== selectedId);
}

function ensureCollections(runtime) {
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  runtime.playerState.contracts ??= {};
  runtime.playerState.goapRequests ??= {};
}

function consumeRoster(runtime, action, result) {
  const state = ensureState(runtime);
  if (state.rosterCompletedAtMinute != null) return false;
  const choice = action.authoredDay2Day8VillageWatchData;
  const now = minute(runtime);
  const current = player(runtime);

  state.rosterSelectedActionId = action.id;
  state.rosterClosedActionIds = closeIds("roster", action.id);
  state.rosterCompletedAtMinute = now;
  state.day8DueAtMinute = Math.max(DAY8_DAWN_MINUTE, now + 60);

  ensureCollections(runtime);
  runtime.playerState.worldFlags[choice.worldFlag] = true;
  current.location = VILLAGE_LOCATION;
  current.facilityId = VILLAGE_SQUARE_ID;

  runtime.playerState.goapRequests[WATCH_REQUEST_ID] = {
    id: WATCH_REQUEST_ID,
    actorId: choice.requestActorId,
    goal: choice.requestGoal,
    destinationLocation: VILLAGE_LOCATION,
    destinationFacilityId: NORTH_FENCE_ID,
    status: "scheduled",
    createdAtMinute: now,
    dueAtMinute: state.day8DueAtMinute,
    sourceActionId: action.id,
  };

  if (choice.contractId) {
    runtime.playerState.contracts[choice.contractId] = {
      id: choice.contractId,
      providerNpcId: RIONA_ID,
      status: "accepted",
      createdAtMinute: now,
      dueAtMinute: state.day8DueAtMinute,
      destinationLocation: VILLAGE_LOCATION,
    };
  }

  runtime.playerState.history.push({
    type: choice.historyType,
    minute: now,
    missionId: T01_MISSION_ID,
    sceneId: ROSTER_SCENE_ID,
    actionId: action.id,
    closedActionIds: [...state.rosterClosedActionIds],
    goapRequestId: WATCH_REQUEST_ID,
    contractId: choice.contractId ?? null,
    location: current.location,
    facilityId: current.facilityId,
  });

  result.summary = choice.summary;
  result.speeches = [{ actorId: choice.actorId, text: choice.speech, emotion: "抑えた実務口調" }];
  result.nextSceneId = HOWL_SCENE_ID;
  return true;
}

function consumeHowl(runtime, action, result) {
  const state = ensureState(runtime);
  if (state.howlCompletedAtMinute != null) return false;
  const choice = action.authoredDay2Day8VillageWatchData;
  const now = minute(runtime);

  state.howlSelectedActionId = action.id;
  state.howlClosedActionIds = closeIds("howl", action.id);
  state.howlCompletedAtMinute = now;

  ensureCollections(runtime);
  runtime.playerState.worldFlags[choice.worldFlag] = true;
  runtime.playerState.worldFlags["t03EarlyCommunityResponse"] = true;

  const request = runtime.playerState.goapRequests[WATCH_REQUEST_ID];
  if (request) {
    request.status = "completed";
    request.completedAtMinute = now;
    request.resultActionId = action.id;
  }

  runtime.playerState.evidence[choice.evidenceId] = {
    id: choice.evidenceId,
    source: choice.evidenceSource,
    acquiredAtMinute: now,
  };

  runtime.playerState.history.push({
    type: choice.historyType,
    minute: now,
    missionId: T03_MISSION_ID,
    sceneId: HOWL_SCENE_ID,
    actionId: action.id,
    closedActionIds: [...state.howlClosedActionIds],
    goapRequestId: WATCH_REQUEST_ID,
    evidenceId: choice.evidenceId,
    evidenceSource: choice.evidenceSource,
    location: player(runtime).location,
    facilityId: player(runtime).facilityId,
  });

  result.summary = choice.summary;
  result.speeches = [{ actorId: choice.actorId, text: choice.speech, emotion: "低い声で観察を共有" }];
  result.evidenceId = choice.evidenceId;
  result.goapRequestId = WATCH_REQUEST_ID;
  return true;
}

function consume(runtime, action, result) {
  if (!action?.authoredDay2Day8VillageWatchChoice || result?.ok === false) return false;
  return action.authoredDay2Day8VillageWatchScene === "roster"
    ? consumeRoster(runtime, action, result)
    : consumeHowl(runtime, action, result);
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return actions(runtime) ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (rosterEligible(runtime)) {
    const current = player(runtime);
    return {
      missionId: T01_MISSION_ID,
      kicker: "北柵への警告は届いたが、見張りを一晩で終わらせれば次の兆候を拾えない",
      title: "村の見張りをどう繋ぐか",
      detail: "当番を村人へ回す、行商便へ載せる、騒がせず観察する。続け方を決める。",
      targetLocation: current.location,
      targetFacilityId: current.facilityId,
      actionPanel: null,
    };
  }
  if (day8Pending(runtime)) {
    return {
      missionId: T03_MISSION_ID,
      kicker: "Day8の夜明け前、北柵の向こうで遠吠えが三度ずれて重なった",
      title: "夜明け前の遠吠え",
      detail: "人を退ける、ジルと声を測る、灯りを消して群れを見る。兆候への最初の対応を選ぶ。",
      targetLocation: VILLAGE_LOCATION,
      targetFacilityId: NORTH_FENCE_ID,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_DAY2_DAY8_VILLAGE_WATCH_INTERNALS = Object.freeze({
  ensureState,
  rosterEligible,
  day8Pending,
  howlEligible,
  actionFor,
  actions,
  consume,
  ROSTER_CHOICES,
  HOWL_CHOICES,
  ROSTER_SCENE_ID,
  HOWL_SCENE_ID,
  WATCH_REQUEST_ID,
  DAY8_DAWN_MINUTE,
});
