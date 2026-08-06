import * as base from "./authored-mission-flow-day8-t03-community-followthrough.js";

export * from "./authored-mission-flow-day8-t03-community-followthrough.js";

export const AUTHORED_HUMAN_COMPANION_CAUSALITY_VERSION = "authored-human-companion-causality-v3";

const SOURCE_HISTORY = "DAY2_HUNTER_LIVESTOCK_MOVED";
const APPLIED_HISTORY = "T03_EARLY_LIVESTOCK_EVACUATION_INHERITED";
const FINN_MAP_HISTORY = "DAY8_T03_FINN_EDGE_MAP_BORROWED";
const RELAY_SCENE_ID = "t03-day8-finn-map-npc-relay";
const MISSION_ID = "MSN-T03";
const TROUBLE_ID = "T03";
const LOCATION = "田園の村";
const SQUARE_FACILITY_ID = "LOC_FARM_SQUARE";
const NORTH_FENCE_FACILITY_ID = "LOC_FARM_NORTH_FENCE";
const HUNTER_HUT_FACILITY_ID = "LOC_FOREST_HUNTER_HUT";
const FINN_ID = "NPC001";
const EDA_ID = "NPC004";
const GARO_ID = "NPC003";
const JILL_ID = "NPC060";

const RELAY_ACTIONS = Object.freeze({
  hear_eda: Object.freeze({
    id: "MISSION_FLOW:T03:DAY8_NPC_RELAY:hear_eda",
    label: "エダの伝言を聞く",
    minutes: 10,
    type: "conversation",
    targetFacilityId: SQUARE_FACILITY_ID,
    targetNpcId: EDA_ID,
  }),
  go_north: Object.freeze({
    id: "MISSION_FLOW:T03:DAY8_NPC_RELAY:go_north",
    label: "北柵へ向かう",
    minutes: 24,
    type: "move",
    targetFacilityId: NORTH_FENCE_FACILITY_ID,
    targetNpcId: GARO_ID,
  }),
  move_livestock: Object.freeze({
    id: "MISSION_FLOW:T03:DAY8_NPC_RELAY:move_livestock",
    label: "家畜を石囲いへ移す",
    minutes: 34,
    type: "plan",
    targetFacilityId: NORTH_FENCE_FACILITY_ID,
    targetNpcId: EDA_ID,
    authoredT03WolfChoice: true,
    t03SideChoice: "evacuate_livestock",
    t03WorldFlags: ["t03LivestockEvacuated", "t03StableTracksTrampled"],
    t03Consequence: "フィンの地図から始まった伝言で村人と狩人が先回りし、家畜を共同穀倉の石囲いへ移した。馬房裏の足跡は蹄で潰れたため、ジルは負傷した牝馬の傷と北柵の新しい足跡を次の調査へ残した。",
  }),
});

const ABSENT = new Set(["dead", "missing", "departed", "sealed", "not-yet-present"]);

function array(value) { return Array.isArray(value) ? value : []; }
function minute(runtime) { return Number(runtime?.playerState?.absoluteMinute ?? 0); }
function dayIndex(runtime) { return Math.floor(minute(runtime) / 1440); }
function player(runtime) { return runtime?.playerState?.player ?? {}; }

function hasHistory(runtime, type) {
  return array(runtime?.playerState?.history).some((entry) => entry?.type === type);
}

function mission(runtime, id = MISSION_ID) {
  const missions = runtime?.playerState?.missions;
  if (Array.isArray(missions)) return missions.find((entry) => entry?.id === id) ?? null;
  if (missions instanceof Map) return missions.get(id) ?? null;
  return missions?.[id] ?? null;
}

function terminalT03(runtime) {
  return ["completed", "failed", "resolved", "terminal"].includes(
    String(mission(runtime)?.status ?? ""),
  );
}

function ensureT03State(runtime) {
  runtime.t03WolfContinuity ??= {
    version: "t03-wolf-continuity-v1",
    openingChoiceId: null,
    evidenceClasses: [],
    sideChoices: [],
    terminalChoiceId: null,
    selectedActionIds: [],
    sceneRevision: 0,
    startedAtMinute: minute(runtime),
    lastChangedAtMinute: null,
  };
  const state = runtime.t03WolfContinuity;
  state.evidenceClasses = [...new Set(array(state.evidenceClasses).map(String))];
  state.sideChoices = [...new Set(array(state.sideChoices).map(String))];
  state.selectedActionIds = [...new Set(array(state.selectedActionIds).map(String))];
  return state;
}

function livestockAlreadyMoved(runtime) {
  return runtime?.playerState?.worldFlags?.t03LivestockEvacuated === true
    || array(runtime?.t03WolfContinuity?.sideChoices).includes("evacuate_livestock");
}

function synchronizeEarlyCausality(runtime) {
  if (!hasHistory(runtime, SOURCE_HISTORY)) return false;
  const state = ensureT03State(runtime);
  if (state.sideChoices.includes("evacuate_livestock")) return false;

  state.sideChoices.push("evacuate_livestock");
  state.sceneRevision = Math.max(0, Number(state.sceneRevision ?? 0)) + 1;
  state.lastChangedAtMinute = minute(runtime);

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.worldFlags.t03LivestockEvacuated = true;
  runtime.playerState.worldFlags.t03StableTracksTrampled = true;
  runtime.playerState.worldFlags.t03EarlyAidInherited = true;

  if (!hasHistory(runtime, APPLIED_HISTORY)) {
    runtime.playerState.history.push({
      type: APPLIED_HISTORY,
      minute: state.lastChangedAtMinute,
      missionId: MISSION_ID,
      troubleId: TROUBLE_ID,
      sourceHistoryType: SOURCE_HISTORY,
      inheritedSideChoice: "evacuate_livestock",
    });
  }
  return true;
}

function readRelayState(runtime) {
  return runtime?.playerState?.day8T03FinnNpcRelay ?? null;
}

function relayPhase(runtime) {
  const state = readRelayState(runtime);
  if (state?.completedAtMinute != null || state?.phase === "completed") return null;
  if (state?.phase && RELAY_ACTIONS[state.phase]) return state.phase;
  return hasHistory(runtime, FINN_MAP_HISTORY) ? "hear_eda" : null;
}

function ensureRelayState(runtime) {
  runtime.playerState.day8T03FinnNpcRelay ??= {
    version: AUTHORED_HUMAN_COMPANION_CAUSALITY_VERSION,
    phase: "hear_eda",
    selectedActionIds: [],
    startedAtMinute: minute(runtime),
    messageArrivesAtMinute: null,
    jillArrivesAtMinute: null,
    completedAtMinute: null,
  };
  const state = runtime.playerState.day8T03FinnNpcRelay;
  state.version = AUTHORED_HUMAN_COMPANION_CAUSALITY_VERSION;
  state.selectedActionIds = [...new Set(array(state.selectedActionIds).map(String))];
  return state;
}

function npcUnavailable(runtime, npcId) {
  const state = runtime?.livingWorld?.npcStates?.[npcId];
  if (!state) return false;
  return state.lifeStatus === "dead" || ABSENT.has(String(state.presence ?? "present"));
}

function expectedFacility(phase) {
  return phase === "hear_eda" || phase === "go_north"
    ? SQUARE_FACILITY_ID
    : NORTH_FENCE_FACILITY_ID;
}

function relayEligible(runtime, phase = relayPhase(runtime)) {
  if (!phase || dayIndex(runtime) !== 7 || terminalT03(runtime)) return false;
  if (phase !== "move_livestock" && livestockAlreadyMoved(runtime)) return false;
  const current = player(runtime);
  if (current.location !== LOCATION || current.facilityId !== expectedFacility(phase)) return false;
  return ![FINN_ID, EDA_ID, GARO_ID, JILL_ID].some((npcId) => npcUnavailable(runtime, npcId));
}

function actionForPhase(phase) {
  const action = RELAY_ACTIONS[phase];
  if (!action) return null;
  return {
    ...action,
    actionId: action.id,
    family: phase,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    stepId: phase === "move_livestock" ? "investigate" : "hear",
    targetLocation: LOCATION,
    authoredHumanCompanionOffscreenRelayChoice: phase,
  };
}

function relayActions(runtime) {
  const phase = relayPhase(runtime);
  return relayEligible(runtime, phase) ? [actionForPhase(phase)] : null;
}

function ensureCollections(runtime) {
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  runtime.playerState.goapRequests ??= {};
  runtime.livingWorld ??= {};
  runtime.livingWorld.npcStates ??= {};
}

function ensureNpcState(runtime, npcId, facilityId) {
  ensureCollections(runtime);
  runtime.livingWorld.npcStates[npcId] ??= {
    location: LOCATION,
    lifeStatus: "alive",
    presence: "present",
    position: { hubId: LOCATION, facilityId },
    beliefs: {},
    knowledgeRevision: 0,
    currentGoal: "follow-routine",
    goalSince: minute(runtime) / 60,
    localTravel: null,
  };
  const state = runtime.livingWorld.npcStates[npcId];
  state.beliefs ??= {};
  state.knowledgeRevision = Number(state.knowledgeRevision ?? 0);
  return state;
}

function setBelief(runtime, npcId, factId, text, sourceNpcId, path, importance = 0.8) {
  const state = ensureNpcState(runtime, npcId, SQUARE_FACILITY_ID);
  const learnedAt = minute(runtime) / 60;
  const previous = state.beliefs[factId];
  state.beliefs[factId] = {
    factId,
    kind: "fact",
    text,
    troubleId: TROUBLE_ID,
    troubleIds: [TROUBLE_ID],
    confidence: 1,
    importance,
    secret: false,
    learnedAt,
    propagationAt: learnedAt,
    sourceType: sourceNpcId ? "npc" : "observation",
    sourceNpcId: sourceNpcId ?? null,
    hopCount: Math.max(0, path.length - 1),
    path: [...path],
  };
  if (JSON.stringify(previous) !== JSON.stringify(state.beliefs[factId])) state.knowledgeRevision += 1;
  return state;
}

function setGoal(runtime, npcId, goal) {
  const state = ensureNpcState(runtime, npcId, SQUARE_FACILITY_ID);
  state.currentGoal = goal;
  state.goalSince = minute(runtime) / 60;
  return state;
}

function setPosition(runtime, npcId, facilityId) {
  const state = ensureNpcState(runtime, npcId, facilityId);
  state.location = LOCATION;
  state.facilityId = facilityId;
  state.position = { hubId: LOCATION, facilityId };
  state.localTravel = null;
  return state;
}

function startTravel(runtime, npcId, fromFacilityId, toFacilityId, arrivesAtMinute) {
  const state = ensureNpcState(runtime, npcId, fromFacilityId);
  state.location = LOCATION;
  state.facilityId = fromFacilityId;
  state.position = { hubId: LOCATION, facilityId: fromFacilityId };
  state.localTravel = {
    fromHubId: LOCATION,
    fromFacilityId,
    toHubId: LOCATION,
    toFacilityId,
    startedAtMinute: minute(runtime),
    arrivesAtMinute,
  };
  return state;
}

function completeGoal(state, goal, completedAtMinute) {
  state.completedGoals = array(state.completedGoals);
  if (!state.completedGoals.some((entry) => entry?.goal === goal)) {
    state.completedGoals.push({ goal, completedAtMinute });
  }
}

function setGoap(runtime, id, actorNpcId, goal, destination, status, extra = {}) {
  ensureCollections(runtime);
  runtime.playerState.goapRequests[id] = {
    id,
    actorNpcId,
    goal,
    destination,
    status,
    createdAtMinute: runtime.playerState.goapRequests[id]?.createdAtMinute ?? minute(runtime),
    updatedAtMinute: minute(runtime),
    ...extra,
  };
  return runtime.playerState.goapRequests[id];
}

function addHistory(runtime, type, extra = {}) {
  ensureCollections(runtime);
  if (hasHistory(runtime, type)) return;
  runtime.playerState.history.push({
    type,
    minute: minute(runtime),
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    sceneId: RELAY_SCENE_ID,
    ...extra,
  });
}

function updateNeeds(runtime, hungerDelta, fatigueDelta) {
  const current = player(runtime);
  current.needs ??= {};
  const hungerBefore = Number(current.needs.hunger ?? current.hunger ?? runtime.playerState.hunger ?? 0);
  const fatigueBefore = Number(current.needs.fatigue ?? current.fatigue ?? runtime.playerState.fatigue ?? 0);
  const hungerAfter = Math.max(0, Math.min(100, hungerBefore + hungerDelta));
  const fatigueAfter = Math.max(0, Math.min(100, fatigueBefore + fatigueDelta));
  current.needs.hunger = hungerAfter;
  current.needs.fatigue = fatigueAfter;
  current.hunger = hungerAfter;
  current.fatigue = fatigueAfter;
  runtime.playerState.hunger = hungerAfter;
  runtime.playerState.fatigue = fatigueAfter;
  return { hungerBefore, hungerAfter, fatigueBefore, fatigueAfter };
}

function consumeHearEda(runtime, state, action, result) {
  const now = minute(runtime);
  state.phase = "go_north";
  state.messageArrivesAtMinute = now + 20;

  setBelief(runtime, FINN_ID, "T03-FACT-FINN-MAP-SHARED", "自分の地図に描いた石印が、エダの知る古い用水路と重なった", null, [FINN_ID]);
  setGoal(runtime, FINN_ID, "wait-for-eda-route-report");

  setBelief(runtime, EDA_ID, "T03-FACT-EDA-OLD-IRRIGATION-ROUTE", "フィンの石印は古い用水路の飛び石と一致し、北柵まで家畜を安全に通せる", FINN_ID, [FINN_ID, EDA_ID]);
  const eda = setGoal(runtime, EDA_ID, "move-livestock-before-next-wolf-pass");
  startTravel(runtime, EDA_ID, SQUARE_FACILITY_ID, NORTH_FENCE_FACILITY_ID, now + 14);
  completeGoal(eda, "tell-garo-about-finn-map", now);

  setBelief(runtime, GARO_ID, "T03-FACT-GARO-EDGE-ROUTE-WARNING", "エダの記憶とフィンの地図が一致し、北柵への家畜移送路を確保できる", EDA_ID, [FINN_ID, EDA_ID, GARO_ID]);
  setGoal(runtime, GARO_ID, "open-north-fence-and-dispatch-jill-runner");
  startTravel(runtime, GARO_ID, SQUARE_FACILITY_ID, NORTH_FENCE_FACILITY_ID, now + 12);

  setGoap(runtime, "GOAP-DAY8-T03-FINN-TO-EDA", FINN_ID, "share-edge-map-with-eda", SQUARE_FACILITY_ID, "completed", { completedAtMinute: now });
  setGoap(runtime, "GOAP-DAY8-T03-EDA-TO-GARO", EDA_ID, "tell-garo-about-old-irrigation-route", SQUARE_FACILITY_ID, "completed", { completedAtMinute: now });
  setGoap(runtime, "GOAP-DAY8-T03-GARO-RUNNER-TO-JILL", GARO_ID, "send-edge-route-warning-to-jill", HUNTER_HUT_FACILITY_ID, "active", { arrivesAtMinute: state.messageArrivesAtMinute });
  setGoap(runtime, "GOAP-DAY8-T03-EDA-EVACUATE-LIVESTOCK", EDA_ID, "move-livestock-to-stone-pen", NORTH_FENCE_FACILITY_ID, "active");

  runtime.playerState.worldFlags.t03FinnMapRelayStarted = true;
  runtime.playerState.evidence["T03-EVIDENCE-DAY8-OLD-IRRIGATION-RELAY"] = {
    id: "T03-EVIDENCE-DAY8-OLD-IRRIGATION-RELAY",
    source: "NPC001:FINN_EDGE_MAP>NPC004:EDA_MEMORY>NPC003:GARO_WATCH_ORDER",
    acquiredAtMinute: now,
  };

  addHistory(runtime, "DAY8_T03_FINN_MAP_SHARED_WITH_EDA", { sourceNpcId: FINN_ID, targetNpcId: EDA_ID, actionId: action.id });
  addHistory(runtime, "DAY8_T03_EDA_WARNED_GARO_OFFSCREEN", { sourceNpcId: EDA_ID, targetNpcId: GARO_ID, actionId: action.id });
  addHistory(runtime, "DAY8_T03_GARO_SENT_RUNNER_TO_JILL", { sourceNpcId: GARO_ID, targetNpcId: JILL_ID, actionId: action.id, expectedArrivalMinute: state.messageArrivesAtMinute });

  result.summary = "フィンの地図を見たエダは、石印が古い用水路の飛び石と同じだと気づいていた。彼女はプレイヤーを待たずガロへ伝え、ガロも北柵を開ける手配とジルへの使いを先に走らせていた。";
  result.speeches = [...array(result.speeches), {
    actorId: EDA_ID,
    text: "フィンの石印、古い用水の飛び石と同じだよ。ガロにはもう言った。あんたも北柵へ来な。家畜を先に動かす。",
    emotion: "泥の付いた指で地図を叩いて",
  }];
  result.sceneTransition = "t03-day8-north-fence-departure";
  result.evidenceId = "T03-EVIDENCE-DAY8-OLD-IRRIGATION-RELAY";
  result.livingState = updateNeeds(runtime, 1, 1);
}

function consumeGoNorth(runtime, state, action, result) {
  const now = minute(runtime);
  state.phase = "move_livestock";
  const current = player(runtime);
  current.location = LOCATION;
  current.facilityId = NORTH_FENCE_FACILITY_ID;

  const eda = setPosition(runtime, EDA_ID, NORTH_FENCE_FACILITY_ID);
  setGoal(runtime, EDA_ID, "move-livestock-to-stone-pen");
  const garo = setPosition(runtime, GARO_ID, NORTH_FENCE_FACILITY_ID);
  completeGoal(garo, "open-north-fence-and-dispatch-jill-runner", now);
  setGoal(runtime, GARO_ID, "coordinate-north-watch-and-livestock-route");

  setBelief(runtime, JILL_ID, "T03-FACT-JILL-FINN-EDGE-ROUTE", "ガロの使いが持参したフィンの地図は、赤牙狼が避ける泥地と北柵への石道を示している", GARO_ID, [FINN_ID, EDA_ID, GARO_ID, JILL_ID], 0.9);
  setGoal(runtime, JILL_ID, "travel-to-north-fence-and-verify-wolf-tracks");
  state.jillArrivesAtMinute = now + 28;
  startTravel(runtime, JILL_ID, HUNTER_HUT_FACILITY_ID, NORTH_FENCE_FACILITY_ID, state.jillArrivesAtMinute);

  setGoap(runtime, "GOAP-DAY8-T03-GARO-RUNNER-TO-JILL", GARO_ID, "send-edge-route-warning-to-jill", HUNTER_HUT_FACILITY_ID, "completed", { completedAtMinute: now });
  setGoap(runtime, "GOAP-DAY8-T03-JILL-VERIFY-NORTH-FENCE", JILL_ID, "travel-to-north-fence-and-verify-wolf-tracks", NORTH_FENCE_FACILITY_ID, "active", { arrivesAtMinute: state.jillArrivesAtMinute });

  runtime.playerState.worldFlags.t03JillWarnedByVillageRunner = true;
  addHistory(runtime, "DAY8_T03_JILL_RECEIVED_GARO_MESSAGE_OFFSCREEN", {
    sourceNpcId: GARO_ID,
    targetNpcId: JILL_ID,
    actionId: action.id,
    knowledgePath: [FINN_ID, EDA_ID, GARO_ID, JILL_ID],
  });

  result.summary = "北柵へ着く頃には、エダとガロが家畜の綱を並べ、見張りが石道の泥を払っていた。歩いている間に使いは狩人小屋へ届き、ジルはフィンの地図を持って北柵へ向かい始めていた。";
  result.speeches = [...array(result.speeches), {
    actorId: GARO_ID,
    text: "返しの笛だ。ジルに届いた。北柵を開ける。家畜から動かすぞ。足跡を潰す分は、傷と柵際の跡で補う。",
    emotion: "見張りの配置を変えながら",
  }];
  result.sceneTransition = "t03-day8-livestock-relay";
  result.livingState = updateNeeds(runtime, 2, 3);
}

function consumeMoveLivestock(runtime, state, action, result) {
  const now = minute(runtime);
  state.phase = "completed";
  state.completedAtMinute = now;

  const t03 = ensureT03State(runtime);
  if (!t03.sideChoices.includes("evacuate_livestock")) {
    t03.sideChoices.push("evacuate_livestock");
    t03.sceneRevision = Math.max(0, Number(t03.sceneRevision ?? 0)) + 1;
  }
  if (!t03.selectedActionIds.includes(action.id)) t03.selectedActionIds.push(action.id);
  t03.lastChangedAtMinute = now;

  runtime.playerState.worldFlags.t03LivestockEvacuated = true;
  runtime.playerState.worldFlags.t03StableTracksTrampled = true;
  runtime.playerState.worldFlags.t03NpcRelayLivestockEvacuated = true;
  runtime.playerState.evidence["T03-EVIDENCE-DAY8-JILL-NORTH-FENCE-TRACKS"] = {
    id: "T03-EVIDENCE-DAY8-JILL-NORTH-FENCE-TRACKS",
    source: "LOC_FARM_NORTH_FENCE:JILL_FRESH_TRACK_COMPARISON",
    acquiredAtMinute: now,
  };

  const jill = setPosition(runtime, JILL_ID, NORTH_FENCE_FACILITY_ID);
  completeGoal(jill, "travel-to-north-fence-and-verify-wolf-tracks", now);
  setGoal(runtime, JILL_ID, "mark-safe-wolf-return-corridor");
  setBelief(runtime, JILL_ID, "T03-FACT-JILL-PACK-DISPLACED", "北柵の新しい足跡は家畜へ向かわず森から逃げる向きで、赤牙狼の群れは奥から押し出されている", null, [JILL_ID], 0.95);

  const eda = setPosition(runtime, EDA_ID, NORTH_FENCE_FACILITY_ID);
  completeGoal(eda, "move-livestock-to-stone-pen", now);
  setGoal(runtime, EDA_ID, "check-animals-after-evacuation");
  setGoal(runtime, GARO_ID, "preserve-injury-records-and-maintain-north-watch");
  setGoal(runtime, FINN_ID, "warn-village-children-away-from-south-path");

  setGoap(runtime, "GOAP-DAY8-T03-JILL-VERIFY-NORTH-FENCE", JILL_ID, "travel-to-north-fence-and-verify-wolf-tracks", NORTH_FENCE_FACILITY_ID, "completed", { completedAtMinute: now });
  setGoap(runtime, "GOAP-DAY8-T03-EDA-EVACUATE-LIVESTOCK", EDA_ID, "move-livestock-to-stone-pen", NORTH_FENCE_FACILITY_ID, "completed", { completedAtMinute: now });
  setGoap(runtime, "GOAP-DAY8-T03-JILL-RETURN-CORRIDOR", JILL_ID, "mark-safe-wolf-return-corridor", NORTH_FENCE_FACILITY_ID, "active");

  addHistory(runtime, "DAY8_T03_NPC_RELAY_LIVESTOCK_EVACUATED", {
    actionId: action.id,
    knowledgePath: [FINN_ID, EDA_ID, GARO_ID, JILL_ID],
    evidenceId: "T03-EVIDENCE-DAY8-JILL-NORTH-FENCE-TRACKS",
    evidenceSource: "LOC_FARM_NORTH_FENCE:JILL_FRESH_TRACK_COMPARISON",
  });

  result.summary = "エダと村人が家畜を石囲いへ移し終える頃、ジルが北柵へ着いた。フィンの地図、エダの記憶、ガロの伝令がつながったことで、家畜被害を先に止めながら、赤牙狼が森奥から逃げている新しい足跡も残せた。";
  result.speeches = [...array(result.speeches),
    {
      actorId: JILL_ID,
      text: "フィンの石印は合ってる。この足跡は獲物へ向かってない。森から逃げてる。家畜は石囲いへ通せ。私は群れの戻り道を残す。",
      emotion: "柵際の泥へ膝をついて",
    },
    {
      actorId: EDA_ID,
      text: "聞いたね。綱を持ちな。考えるのは歩きながらでいい。",
      emotion: "先頭の牝馬をなだめながら",
    },
  ];
  result.sceneTransition = "t03-investigation-after-livestock-evacuation";
  result.evidenceId = "T03-EVIDENCE-DAY8-JILL-NORTH-FENCE-TRACKS";
  result.evidenceSource = "LOC_FARM_NORTH_FENCE:JILL_FRESH_TRACK_COMPARISON";
  result.livingState = updateNeeds(runtime, 4, 6);
}

function consumeRelay(runtime, action, result) {
  if (result?.ok === false || !action?.authoredHumanCompanionOffscreenRelayChoice) return false;
  const phase = action.authoredHumanCompanionOffscreenRelayChoice;
  if (!relayEligible(runtime, phase) || action.id !== RELAY_ACTIONS[phase]?.id) return false;
  const state = ensureRelayState(runtime);
  if (state.selectedActionIds.includes(action.id)) return false;
  state.selectedActionIds.push(action.id);

  ensureCollections(runtime);
  if (phase === "hear_eda") consumeHearEda(runtime, state, action, result);
  else if (phase === "go_north") consumeGoNorth(runtime, state, action, result);
  else if (phase === "move_livestock") consumeMoveLivestock(runtime, state, action, result);
  else return false;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const own = relayActions(runtime);
  return own ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  const phase = relayPhase(runtime);
  if (relayEligible(runtime, phase)) {
    const copy = {
      hear_eda: {
        kicker: "フィンが地図を畳むより先に、エダが泥の付いた指で石印を押さえた。",
        title: "地図を見た人たち",
        detail: "子どもの地図はエダの記憶を呼び、エダの伝言はすでにガロの見張りを動かしている。",
      },
      go_north: {
        kicker: "広場の外で見張りの笛が二度鳴った。北柵の開門を知らせる合図だ。",
        title: "先に動く村",
        detail: "ガロはジルへの使いを走らせ、エダは家畜の綱を集めた。北柵へ向かえば、その動きへ加われる。",
      },
      move_livestock: {
        kicker: "北柵には綱を持つ手が足りない。森側からは、狩人の返し笛が近づいてくる。",
        title: "家畜を先に守る",
        detail: "足跡の一部を失っても、今夜の被害を止める。ジルは別の物証を残すため北柵へ向かっている。",
      },
    }[phase];
    return {
      missionId: MISSION_ID,
      ...copy,
      targetLocation: LOCATION,
      targetFacilityId: expectedFacility(phase),
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  const relayChanged = consumeRelay(runtime, action, result);
  const earlyChanged = relayChanged ? false : synchronizeEarlyCausality(runtime);
  return relayChanged || earlyChanged || changed;
}

export const AUTHORED_HUMAN_COMPANION_CAUSALITY_INTERNALS = Object.freeze({
  SOURCE_HISTORY,
  APPLIED_HISTORY,
  FINN_MAP_HISTORY,
  RELAY_SCENE_ID,
  RELAY_ACTIONS,
  MISSION_ID,
  TROUBLE_ID,
  SQUARE_FACILITY_ID,
  NORTH_FENCE_FACILITY_ID,
  HUNTER_HUT_FACILITY_ID,
  FINN_ID,
  EDA_ID,
  GARO_ID,
  JILL_ID,
  hasHistory,
  mission,
  terminalT03,
  ensureT03State,
  synchronizeEarlyCausality,
  readRelayState,
  relayPhase,
  ensureRelayState,
  npcUnavailable,
  relayEligible,
  actionForPhase,
  relayActions,
  setBelief,
  setGoal,
  setPosition,
  startTravel,
  setGoap,
  consumeRelay,
});
