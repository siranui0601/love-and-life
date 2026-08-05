import * as previous from "./authored-mission-flow-human-route-t04-pilgrim-relay.js";
export * from "./authored-mission-flow-human-route-t04-pilgrim-relay.js";

export const AUTHORED_HUMAN_ROUTE_T04_T17_AFTERMATH_VERSION = "authored-human-route-t04-t17-aftermath-v1";

const T04_MISSION = "MSN-T04";
const T17_MISSION = "MSN-T17";
const T17_FLOW = "capital-second-summoning";
const STATE_KEY = "humanT04T17Aftermath";
const SUCCESS = new Set(["completed", "resolved", "terminal"]);
const TERMINAL = new Set(["completed", "resolved", "terminal", "failed", "abandoned"]);

const NPC = Object.freeze({ falco: "NPC053", luca: "NPC056", jill: "NPC060" });
const FAC = Object.freeze({
  sealed: "LOC_TEMPLE_SEALED",
  admin: "LOC_TEMPLE_ADMIN",
  corridor: "LOC_TEMPLE_CORRIDOR",
  entrance: "LOC_TEMPLE_ENTRANCE",
});

const RECOVERY = Object.freeze([
  Object.freeze({
    id: "escort_survivors",
    label: "巡礼者を地上へ送る",
    family: "rescue",
    minutes: 42,
    facility: FAC.entrance,
    actor: NPC.jill,
    flag: "t04Aftermath:survivorsEscorted",
    history: "T04_AFTERMATH_SURVIVORS_ESCORTED",
    summary: "封印区画から救い出した巡礼者を一人ずつ地上へ送り、名簿と本人を照合した。歩けない者は担架へ乗せ、家族へ生存の知らせが走った。",
    speech: "人数を数えるのは最後までだ。助け出しただけで安心するな。名前と顔が揃って、初めて帰還になる。",
  }),
  Object.freeze({
    id: "copy_resonance_plate",
    label: "共鳴板を写す",
    family: "observation",
    minutes: 57,
    facility: FAC.sealed,
    actor: NPC.falco,
    flag: "t04Aftermath:resonancePlateCopied",
    history: "T04_AFTERMATH_RESONANCE_PLATE_COPIED",
    evidence: "T17-EVIDENCE-SEALED-QUARTER-RESONANCE-PLATE",
    source: "LOC_TEMPLE_SEALED:RESONANCE_PLATE_BURN_LAYERS",
    summary: "共鳴板の焼痕を薄紙へ写すと、王都側の試験が行われるたび新しい層が増えていた。転移装置は単独で暴走したのではなく、遠くの召喚波を受けている。",
    speech: "この焼痕は神殿の巡回時刻と合わない。王都の試験記録と重ねれば、誰も偶然とは言えなくなる。",
  }),
  Object.freeze({
    id: "double_seal_device",
    label: "装置を二重に封じる",
    family: "coordination",
    minutes: 66,
    facility: FAC.sealed,
    actor: NPC.falco,
    flag: "t04Aftermath:deviceDoubleSealed",
    history: "T04_AFTERMATH_DEVICE_DOUBLE_SEALED",
    summary: "転移装置の主輪を止め、管理棟と封印区画で別々の鍵を保管した。ファルコ一人の判断でも、王都の命令だけでも再起動できない。",
    speech: "隠した結果がこれだ。次は私一人で開けられないようにする。鍵を分け、記録も分ける。",
  }),
]);

const PROOF = Object.freeze([
  Object.freeze({
    id: "compare_device_log",
    label: "運転簿を照合する",
    family: "observation",
    minutes: 49,
    facility: FAC.admin,
    actor: NPC.luca,
    flag: "t17TempleProof:deviceLogCompared",
    history: "T17_TEMPLE_DEVICE_LOG_COMPARED",
    evidence: "T17-EVIDENCE-T04-TRANSFER-DEVICE-LOG",
    source: "LOC_TEMPLE_ADMIN:T04_TRANSFER_DEVICE_OPERATION_LOG",
    summary: "失踪時刻、回廊の発光、王都の小規模試験を同じ表へ並べた。第二召喚を強行すれば、人と魔力が封印区画へ同時に引かれる危険が数字で残った。",
    speech: "王都の術式と神殿の装置は、別の機械なのに同じ拍で動いている。ここを切らなければ、次は巡礼者だけでは済まない。",
  }),
  Object.freeze({
    id: "trace_corridor_light",
    label: "回廊の光を追う",
    family: "fieldwork",
    minutes: 48,
    facility: FAC.corridor,
    actor: NPC.falco,
    flag: "t17TempleProof:corridorSequenceRecorded",
    history: "T17_TEMPLE_CORRIDOR_LIGHT_RECORDED",
    evidence: "T17-EVIDENCE-WHITE-CORRIDOR-GLOW-SEQUENCE",
    source: "LOC_TEMPLE_CORRIDOR:THREE_CYCLE_GLOW_SEQUENCE",
    summary: "白石回廊を三回歩き、発光の順序と遅延を記録した。光は王都の方角から逆流し、失踪地点を通って地下へ落ちている。",
    speech: "以前は光る文字を神託と呼んだ。今は番号を振る。同じ順に三度光ったなら、これは祈りではなく経路だ。",
  }),
  Object.freeze({
    id: "ask_luca_to_map",
    label: "ルカに逆算を頼む",
    family: "coordination",
    minutes: 53,
    facility: FAC.admin,
    actor: NPC.luca,
    flag: "t17TempleProof:arrivalCoordinatesMapped",
    history: "T17_TEMPLE_ARRIVAL_COORDINATES_MAPPED",
    evidence: "T17-EVIDENCE-LUCA-ARRIVAL-COORDINATES",
    source: "LOC_TEMPLE_ADMIN:DAY1_REVERSE_COORDINATE_MAP",
    summary: "ルカは王都の召喚線、神殿の転移座標、田園の麦畑を一枚へ戻した。Day1の対象は消えたのではなく、神殿装置に屈折して村へ落ちている。",
    speech: "君は王都へ届かなかった失敗作じゃない。ここで線が曲がり、麦畑へ届いた。第二儀式は同じ対象を、今度こそ王都へ引こうとしている。",
  }),
]);

const array = (value) => Array.isArray(value) ? value : [];
const player = (runtime) => (runtime.playerState ??= {}, runtime.playerState.player ??= {}, runtime.playerState.player);
const minute = (runtime) => Number(runtime?.playerState?.absoluteMinute ?? 0);
const mission = (runtime, id) => Array.isArray(runtime?.playerState?.missions)
  ? runtime.playerState.missions.find((entry) => entry?.id === id)
  : runtime?.playerState?.missions?.[id];
const status = (entry) => String(entry?.status ?? entry ?? "");

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_HUMAN_ROUTE_T04_T17_AFTERMATH_VERSION,
    stage: 0,
    selectedActionIds: [],
    closedActionIdsByScene: {},
    completedAtMinute: null,
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_HUMAN_ROUTE_T04_T17_AFTERMATH_VERSION;
  state.selectedActionIds = array(state.selectedActionIds).map(String);
  state.closedActionIdsByScene = state.closedActionIdsByScene && typeof state.closedActionIdsByScene === "object"
    ? state.closedActionIdsByScene
    : {};
  return state;
}

function relayCompleted(runtime) {
  return Number(runtime?.playerState?.humanT04PilgrimRelay?.stage ?? 0) >= 3;
}

function t04Resolved(runtime) {
  return SUCCESS.has(status(mission(runtime, T04_MISSION)))
    || SUCCESS.has(status(runtime?.playerState?.troubles?.T04));
}

function t17Available(runtime) {
  const m = mission(runtime, T17_MISSION);
  const t = runtime?.playerState?.troubles?.T17;
  if (!m && t == null) return false;
  return !TERMINAL.has(status(m)) && !TERMINAL.has(status(t));
}

function atTemple(runtime) {
  return player(runtime).location === "古代神殿"
    && Object.values(FAC).includes(player(runtime).facilityId);
}

function eligibleRecovery(runtime) {
  const state = ensureState(runtime);
  return state.stage === 0 && relayCompleted(runtime) && t04Resolved(runtime)
    && t17Available(runtime) && atTemple(runtime);
}

function eligibleProof(runtime) {
  const state = ensureState(runtime);
  return state.stage === 1 && t17Available(runtime) && atTemple(runtime);
}

const actionId = (sceneId, choiceId) => `MISSION_FLOW:T17:HUMAN_SPINE:${sceneId}:${choiceId}`;
const closedIds = (sceneId, choices, selected) => choices
  .map((choice) => actionId(sceneId, choice.id)).filter((id) => id !== selected);

function action(sceneId, choice) {
  return {
    id: actionId(sceneId, choice.id),
    actionId: actionId(sceneId, choice.id),
    label: choice.label,
    type: "conversation",
    family: choice.family,
    missionId: T17_MISSION,
    troubleId: "T17",
    stepId: "hear",
    targetLocation: "古代神殿",
    targetFacilityId: choice.facility,
    targetNpcId: choice.actor,
    minutes: choice.minutes,
    authoredHumanT04T17AftermathChoice: true,
    aftermathSceneId: sceneId,
    aftermathChoiceId: choice.id,
  };
}

function ownActions(runtime) {
  if (eligibleRecovery(runtime)) return RECOVERY.map((choice) => action("t04-rescue-aftermath", choice));
  if (eligibleProof(runtime)) return PROOF.map((choice) => action("t04-t17-temple-proof", choice));
  return null;
}

function ensureCollections(runtime) {
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  runtime.playerState.goapRequests ??= {};
  runtime.authoredMissionFlows ??= {};
}

function saveEvidence(runtime, choice) {
  if (!choice.evidence) return;
  ensureCollections(runtime);
  const record = {
    id: choice.evidence,
    source: choice.source,
    acquiredAtMinute: minute(runtime),
    missionId: T17_MISSION,
  };
  runtime.playerState.evidence[choice.evidence] = record;
  const t17 = mission(runtime, T17_MISSION);
  if (t17) {
    t17.discoveries = array(t17.discoveries);
    if (!t17.discoveries.some((entry) => entry?.id === choice.evidence)) t17.discoveries.push(record);
  }
  runtime.authoredMissionFlows[T17_FLOW] ??= { evidenceIds: [], evidenceSourceIds: {} };
  const flow = runtime.authoredMissionFlows[T17_FLOW];
  flow.evidenceIds = [...new Set([...array(flow.evidenceIds), choice.evidence])];
  flow.evidenceSourceIds = { ...(flow.evidenceSourceIds ?? {}), [choice.evidence]: choice.source };
}

function setT17TempleOpening(runtime) {
  ensureCollections(runtime);
  runtime.authoredMissionFlows[T17_FLOW] ??= { evidenceIds: [], evidenceSourceIds: {} };
  const flow = runtime.authoredMissionFlows[T17_FLOW];
  flow.openingChoiceId = "separate_temple_causes";
  flow.knownFactIds = [...new Set([...array(flow.knownFactIds), "T17-OPENING-TEMPLE-SEPARATION"] )];
  flow.unlockedLeadIds = array(flow.unlockedLeadIds);
  const t17 = mission(runtime, T17_MISSION);
  if (t17?.progress) t17.progress.hear = Math.max(1, Number(t17.progress.hear ?? 0));
  runtime.playerState.worldFlags.t17TempleSeparationOpening = true;
}

function saveGoap(runtime, id, actorNpcId, goal, facility, state = "active") {
  ensureCollections(runtime);
  runtime.playerState.goapRequests[id] = {
    id,
    actorNpcId,
    goal,
    destination: "古代神殿",
    targetFacilityId: facility,
    status: state,
    createdAtMinute: minute(runtime),
  };
}

function consume(runtime, actionValue, result) {
  if (result?.ok === false || !actionValue?.authoredHumanT04T17AftermathChoice) return false;
  const state = ensureState(runtime);
  const choices = actionValue.aftermathSceneId === "t04-rescue-aftermath"
    ? RECOVERY
    : actionValue.aftermathSceneId === "t04-t17-temple-proof"
      ? PROOF
      : null;
  const choice = choices?.find((entry) => entry.id === actionValue.aftermathChoiceId);
  if (!choice) return false;

  ensureCollections(runtime);
  player(runtime).location = "古代神殿";
  player(runtime).facilityId = choice.facility;
  state.stage = actionValue.aftermathSceneId === "t04-rescue-aftermath" ? 1 : 2;
  state.selectedActionIds.push(actionValue.id);
  state.closedActionIdsByScene[actionValue.aftermathSceneId] = closedIds(
    actionValue.aftermathSceneId,
    choices,
    actionValue.id,
  );
  runtime.playerState.worldFlags[choice.flag] = true;
  saveEvidence(runtime, choice);

  if (actionValue.aftermathSceneId === "t04-rescue-aftermath") {
    saveGoap(runtime, "GOAP-T04-FALCO-ACCOUNT-SURVIVORS", NPC.falco, "account_for_all_rescued_pilgrims", FAC.admin);
    saveGoap(runtime, "GOAP-T04-JILL-ESCORT-SURVIVORS", NPC.jill, "escort_rescued_pilgrims_to_families", FAC.entrance);
    saveGoap(runtime, "GOAP-T04-LUCA-COMPARE-SUMMONING-WAVE", NPC.luca, "compare_temple_device_and_royal_summoning_wave", FAC.admin, "scheduled");
  } else {
    setT17TempleOpening(runtime);
    saveGoap(runtime, "GOAP-T17-FALCO-PRESERVE-TEMPLE-LOGS", NPC.falco, "preserve_temple_logs_for_second_summoning_inquiry", FAC.admin);
    saveGoap(runtime, "GOAP-T17-LUCA-PREPARE-REVERSE-MAP", NPC.luca, "prepare_day1_reverse_coordinate_map", FAC.admin);
    state.completedAtMinute = minute(runtime);
  }

  runtime.playerState.history.push({
    type: choice.history,
    minute: minute(runtime),
    missionId: T17_MISSION,
    relatedMissionId: T04_MISSION,
    troubleId: "T17",
    sceneId: actionValue.aftermathSceneId,
    actionId: actionValue.id,
    closedActionIds: [...state.closedActionIdsByScene[actionValue.aftermathSceneId]],
    evidenceId: choice.evidence ?? null,
    evidenceSource: choice.source ?? null,
    location: player(runtime).location,
    facilityId: player(runtime).facilityId,
  });

  result.summary = choice.summary;
  result.speeches = [{ actorId: choice.actor, text: choice.speech, emotion: "救助後の責任を引き受けて" }];
  result.evidenceId = choice.evidence ?? null;
  result.evidenceSource = choice.source ?? null;
  result.closedActionIds = [...state.closedActionIdsByScene[actionValue.aftermathSceneId]];
  result.sceneTransition = state.stage === 1 ? "t04-t17-temple-proof" : "t17-temple-separation-investigation";
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return ownActions(runtime) ?? previous.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  if (eligibleRecovery(runtime)) {
    return {
      missionId: T17_MISSION,
      kicker: "救い出した巡礼者の背後で、共鳴板がもう一度だけ低く鳴った。",
      title: "救助の後に残ったもの",
      detail: "人を地上へ送る、焼痕を写す、装置を二重に封じる。T04の成功を生活と次の予防へ渡す。",
      targetLocation: "古代神殿",
      targetFacilityId: player(runtime).facilityId,
      actionPanel: null,
    };
  }
  if (eligibleProof(runtime)) {
    return {
      missionId: T17_MISSION,
      kicker: "神殿の異常は止まったが、王都側から届く召喚波は消えていない。",
      title: "第二召喚へ渡す証明",
      detail: "運転簿、回廊の光、Day1の逆算座標から、王都に居続けず第二召喚の危険を証明する。",
      targetLocation: "古代神殿",
      targetFacilityId: player(runtime).facilityId,
      actionPanel: null,
    };
  }
  return previous.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, actionValue, result) {
  return consume(runtime, actionValue, result)
    || previous.applyAuthoredMissionFlowAction(runtime, actionValue, result);
}

export const AUTHORED_HUMAN_ROUTE_T04_T17_AFTERMATH_INTERNALS = Object.freeze({
  T17_FLOW,
  STATE_KEY,
  RECOVERY,
  PROOF,
  ensureState,
  relayCompleted,
  t04Resolved,
  t17Available,
  eligibleRecovery,
  eligibleProof,
  ownActions,
  saveEvidence,
  setT17TempleOpening,
  consume,
});