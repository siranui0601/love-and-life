import crypto from "node:crypto";
import * as journey from "../../../../tools/trpg-sim/lib/player-journey.mjs";
import {
  availableStockAt,
  buyEquipment,
  quoteEquipmentSale,
  sellEquipment,
} from "../../../../tools/trpg-sim/lib/shop-runtime.mjs";
import { experienceToNextLevel } from "../../../../tools/trpg-sim/lib/mission-model.mjs";
import {
  completeNpcLifeTick,
  createNpcLifeEngine,
  prepareNpcLifeTick,
} from "../../../../tools/trpg-sim/lib/npc-life-engine.mjs";
import { loadTrpgGameData } from "./game-data.js";
import { deserializeRuntime, serializeRuntime } from "./serializer.js";
import { FileTrpgSaveStore } from "./save-store.js";
import { presentNpcsAt, syncAuthoritativePresentNpcIds } from "./presence.js";

export const TRPG_GAME_SCHEMA_VERSION = "1.1.0-alpha";
export const TRPG_GAME_RESOLVER_VERSION = "trpg-player-world-v4";

const PLAYABLE_PROFILE_ID = "balanced";
const TUTORIAL_VERSION = "trpg-progressive-onboarding-v2";

const OPENING_CLUES = Object.freeze({
  "inquiry:garo": {
    id: "T01_SEARCH_BOUNDARY",
    text: "村外れから古い見張り小屋へ続く道は、まだ十分に捜索されていない。",
    evidence: 1,
  },
  "inquiry:mira": {
    id: "T01_FINN_MAP",
    text: "フィンは姿を消す前、村外れが描かれた古い地図を持ち出していた。",
    evidence: 1,
  },
  "inquiry:coby": {
    id: "T01_LOOKOUT_CLUE",
    text: "フィンは古い見張り小屋へ向かうつもりで、村外れの細い道を知っていた。",
    evidence: 2,
  },
});

const OPENING_AFTERMATH_FACT = Object.freeze({
  id: "T01_FAILED_BEFORE_PLAYER_INTERVENTION",
  text: "捜索が間に合わず、フィンは帰らなかった。世界の危機は、旅人を待たずに結末へ進む。",
});

const PROFILE_BY_ID = new Map(journey.PLAYER_PROFILES.map((profile) => [profile.id, profile]));
const COMMAND_TYPES = new Set(["CHOOSE", "MOVE", "SHOP_BUY", "SHOP_SELL", "EQUIP", "UNEQUIP", "LEARN_SKILL", "TUTORIAL_ACK"]);
const COMMAND_PAYLOAD_KEY = Object.freeze({
  CHOOSE: "choiceId",
  MOVE: "moveId",
  SHOP_BUY: "stockId",
  SHOP_SELL: "equipmentId",
  EQUIP: "equipmentId",
  UNEQUIP: "slot",
  LEARN_SKILL: "skillId",
  TUTORIAL_ACK: "tutorialId",
});
const PHASE_MINUTES = [0, 240, 480, 720];
const PHASE_NAMES = ["morning", "afternoon", "evening", "night"];
const MAX_COMMANDS = 5000;
const DEFAULT_MAX_SAVES_PER_OWNER = 3;
const DEFAULT_MAX_TOTAL_SAVES = 100;
const DEFAULT_SAVE_RETENTION_DAYS = 30;
const PLAYABLE_LOG_LIMITS = Object.freeze({
  decisionEvents: 128,
  knowledgeEvents: 256,
  localMovementEvents: 256,
  populationByTick: 8,
  npcTracePerActor: 4,
  playerHistory: 256,
  replayResults: 128,
});

export class TrpgGameError extends Error {
  constructor(status, code, message = code, details = undefined) {
    super(message);
    this.name = "TrpgGameError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function cleanText(value, maximum = 80) {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/gu, "").slice(0, maximum);
}

function boundedPositiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function commandPayload(type, input) {
  const key = COMMAND_PAYLOAD_KEY[type];
  if (!key) return {};
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return { [key]: cleanText(source[key], 120) };
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function canonicalJson(value) {
  const normalize = (entry) => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (entry && typeof entry === "object") {
      return Object.fromEntries(Object.keys(entry).sort().map((key) => [key, normalize(entry[key])]));
    }
    return entry;
  };
  return JSON.stringify(normalize(value));
}

function trimOldest(array, limit) {
  if (!Array.isArray(array) || array.length <= limit) return 0;
  const removed = array.length - limit;
  array.splice(0, removed);
  return removed;
}

export function compactPlayableRuntime(runtime) {
  const world = runtime?.livingWorld;
  const state = runtime?.playerState;
  if (!world || !state) return runtime;
  const totals = world.playableCompaction ??= {
    decisionEventsRemoved: 0,
    knowledgeEventsRemoved: 0,
    localMovementEventsRemoved: 0,
    populationTicksRemoved: 0,
    npcTraceEntriesRemoved: 0,
    playerHistoryEntriesRemoved: 0,
    replayResultsRemoved: 0,
  };
  totals.decisionEventsRemoved += trimOldest(world.decisionEvents, PLAYABLE_LOG_LIMITS.decisionEvents);
  totals.knowledgeEventsRemoved += trimOldest(world.knowledgeEvents, PLAYABLE_LOG_LIMITS.knowledgeEvents);
  totals.localMovementEventsRemoved += trimOldest(world.localMovementEvents, PLAYABLE_LOG_LIMITS.localMovementEvents);
  totals.populationTicksRemoved += trimOldest(world.populationByTick, PLAYABLE_LOG_LIMITS.populationByTick);
  for (const traces of Object.values(world.npcTraces ?? {})) {
    totals.npcTraceEntriesRemoved += trimOldest(traces, PLAYABLE_LOG_LIMITS.npcTracePerActor);
  }
  totals.playerHistoryEntriesRemoved += trimOldest(state.history, PLAYABLE_LOG_LIMITS.playerHistory);
  const replayEntries = Object.entries(state.replayResults ?? {});
  if (replayEntries.length > PLAYABLE_LOG_LIMITS.replayResults) {
    const removed = replayEntries.length - PLAYABLE_LOG_LIMITS.replayResults;
    state.replayResults = Object.fromEntries(replayEntries.slice(removed));
    totals.replayResultsRemoved += removed;
  }
  return runtime;
}

function saveId() {
  return `trpg-${crypto.randomUUID()}`;
}

function profileFor(id) {
  return PROFILE_BY_ID.get(id) ?? PROFILE_BY_ID.get("balanced");
}

function gameplayTuning() {
  return {
    manualSkillSelection: true,
    playerOwnedRumorMissionProgress: true,
    requireKnownSpecialMissions: true,
    startingGold: 0,
    freeStarterMeals: 1,
    freeStarterLodging: 1,
    soloCombatPowerMultiplier: 1.65,
    missionPreparationBonusPerEvidence: 0.18,
    missionPreparationBonusMax: 0.75,
    maxConversationsPerDay: 5,
    conversationCooldownMinutes: 360,
    maxWildBattlesPerDay: 2,
    wildEncounterCooldownMinutes: 480,
    workGoldThreshold: 24,
    restPrice: 4,
  };
}

export function applyGameplayCatalogOverrides(catalog) {
  const t01 = catalog.special.find((mission) => mission.id === "MSN-T01");
  if (!t01) return catalog;
  for (const step of t01.steps) {
    if (step.id === "hear") step.targetFacilityId = "LOC_FARM_SQUARE";
    if (["search", "rescue"].includes(step.id)) step.targetFacilityId = "LOC_FARM_EDGE";
    if (step.id === "decide") step.targetFacilityId = "LOC_FARM_SQUARE";
  }
  return catalog;
}

function initialNpcState(npc) {
  return {
    id: npc.id,
    name: npc.name,
    behaviorType: npc.behaviorType,
    disposition: npc.disposition,
    home: npc.home,
    location: npc.initialLocation,
    status: npc.initialStatus,
    travel: null,
    contributions: [],
    plansCreated: 0,
    routineTicks: 0,
    lastRoutine: null,
  };
}

function initializeFinnAsMissing(livingWorld) {
  const finn = livingWorld.npcStates.NPC001;
  if (!finn) return;
  finn.presence = "missing";
  finn.lifeStatus = "missing";
  finn.travel = null;
  finn.localTravel = null;
  finn.currentGoal = "inactive:missing";
  finn.position = { hubId: "田園の村", facilityId: "LOC_FARM_EDGE" };
  finn.status = "失踪中";
}

function recordScriptedNpcRelocation(livingWorld, state, facilityId, absoluteMinute, cause) {
  const fromFacilityId = state.position?.facilityId ?? null;
  if (fromFacilityId === facilityId || !Number.isFinite(absoluteMinute)) return;
  const absoluteHour = absoluteMinute / 60;
  livingWorld.localMovementEvents.push({
    npcId: state.id,
    scope: "facility",
    routeId: `SCRIPTED:${state.position?.hubId ?? "田園の村"}:${fromFacilityId ?? "@hub"}->${facilityId}`,
    hubId: "田園の村",
    fromFacilityId,
    toFacilityId: facilityId,
    departedAt: absoluteHour,
    arrivedAt: absoluteHour,
    durationHours: 0,
    scripted: true,
    cause,
    interruptedRouteId: state.localTravel?.routeId ?? state.travel?.routeId ?? null,
  });
  state.localMovementCount = Number(state.localMovementCount ?? 0) + 1;
}

function placeOpeningGuide(livingWorld, absoluteMinute = null) {
  const eda = livingWorld.npcStates.NPC004;
  if (!eda || ["dead", "missing", "departed"].includes(eda.lifeStatus)) return;
  recordScriptedNpcRelocation(livingWorld, eda, "LOC_FARM_FIELD", absoluteMinute, "tutorial-first-contact");
  eda.presence = "present";
  eda.lifeStatus = eda.lifeStatus === "injured" ? "injured" : "alive";
  eda.travel = null;
  eda.localTravel = null;
  eda.position = { hubId: "田園の村", facilityId: "LOC_FARM_FIELD" };
  eda.currentGoal = "protect-summoned-player";
  eda.status = "旅人を保護中";
}

function createTutorialState() {
  return {
    version: TUTORIAL_VERSION,
    stage: "awakening",
    firstInstinct: null,
    firstReply: null,
    orientationChoice: null,
    inquirySource: null,
    openingFacts: new Set(),
    openingCrisisOutcome: null,
    acknowledged: new Set(),
    lastBeat: null,
  };
}

function prepareOpeningTutorial(livingWorld, absoluteMinute = null) {
  const eda = livingWorld.npcStates.NPC004;
  if (!eda || ["dead", "missing", "departed"].includes(eda.lifeStatus)) return;
  recordScriptedNpcRelocation(livingWorld, eda, "LOC_FARM_WELL", absoluteMinute, "tutorial-opening-staging");
  eda.presence = "present";
  eda.lifeStatus = eda.lifeStatus === "injured" ? "injured" : "alive";
  eda.travel = null;
  eda.localTravel = null;
  eda.position = { hubId: "田園の村", facilityId: "LOC_FARM_WELL" };
  eda.currentGoal = "finish-morning-field-work";
  eda.status = "畑仕事中";
}

function placeNpcForOpening(livingWorld, npcId, facilityId, currentGoal, status, absoluteMinute, cause) {
  const state = livingWorld.npcStates[npcId];
  if (!state || ["dead", "missing", "departed"].includes(state.lifeStatus)) return;
  recordScriptedNpcRelocation(livingWorld, state, facilityId, absoluteMinute, cause);
  state.presence = "present";
  state.lifeStatus = state.lifeStatus === "injured" ? "injured" : "alive";
  state.travel = null;
  state.localTravel = null;
  state.position = { hubId: "田園の村", facilityId };
  state.location = "田園の村";
  state.currentGoal = currentGoal;
  state.status = status;
}

function placeOpeningCrisisCast(livingWorld, absoluteMinute) {
  placeNpcForOpening(livingWorld, "NPC004", "LOC_FARM_SQUARE", "help-summoned-traveler", "旅人に同行中", absoluteMinute, "tutorial-crisis-gathering");
  placeNpcForOpening(livingWorld, "NPC002", "LOC_FARM_SQUARE", "find-finn", "フィンを捜索中", absoluteMinute, "tutorial-crisis-gathering");
  placeNpcForOpening(livingWorld, "NPC003", "LOC_FARM_SQUARE", "organize-search", "捜索を指揮中", absoluteMinute, "tutorial-crisis-gathering");
  placeNpcForOpening(livingWorld, "NPC062", "LOC_FARM_SQUARE", "decide-whether-to-speak", "落ち着かない様子", absoluteMinute, "tutorial-crisis-gathering");
}

function placeOpeningAftermathCast(livingWorld, absoluteMinute) {
  placeNpcForOpening(livingWorld, "NPC004", "LOC_FARM_SQUARE", "support-village-after-search", "捜索の後片づけ中", absoluteMinute, "tutorial-crisis-aftermath");
  placeNpcForOpening(livingWorld, "NPC002", "LOC_FARM_SQUARE", "grieve-finn", "憔悴している", absoluteMinute, "tutorial-crisis-aftermath");
  placeNpcForOpening(livingWorld, "NPC003", "LOC_FARM_SQUARE", "record-search-failure", "捜索の報告をまとめている", absoluteMinute, "tutorial-crisis-aftermath");
  placeNpcForOpening(livingWorld, "NPC062", "LOC_FARM_SQUARE", "process-finn-loss", "広場の端で俯いている", absoluteMinute, "tutorial-crisis-aftermath");
}

function hideUnheardOpeningTrouble(state) {
  for (const rumor of state.rumors) {
    if (rumor.troubleId === "T01") state.player.knownRumorIds.delete(rumor.id);
  }
}

function withChoiceIds(actions) {
  return actions.map((action, index) => ({ ...action, choiceId: `CHOICE-${index + 1}` }));
}

function openingChoiceActions(runtime) {
  const tutorial = runtime.tutorial;
  if (!tutorial) return null;
  if (tutorial.stage === "awakening") {
    return withChoiceIds([
      { id: "TUTORIAL:AWAKEN:BODY", type: "observe", tutorialBeat: "awake:body", minutes: 3, label: "ゆっくり体を起こし、痛む場所がないか確かめる" },
      { id: "TUTORIAL:AWAKEN:LISTEN", type: "observe", tutorialBeat: "awake:listen", minutes: 4, label: "目を閉じたまま、風と遠くの音に耳を澄ます" },
      { id: "TUTORIAL:AWAKEN:GROUND", type: "observe", tutorialBeat: "awake:ground", minutes: 6, label: "麦の倒れ方と、自分の周囲に残った跡を調べる" },
    ]);
  }
  if (tutorial.stage === "first_contact") {
    return withChoiceIds([
      { id: "TUTORIAL:CONTACT:WHERE", type: "conversation", tutorialBeat: "contact:where", targetNpcId: "NPC004", targetNpcName: "エダ", minutes: 5, label: "「ここは、どこですか」と尋ねる" },
      { id: "TUTORIAL:CONTACT:MEMORY", type: "conversation", tutorialBeat: "contact:memory", targetNpcId: "NPC004", targetNpcName: "エダ", minutes: 7, label: "見覚えのない世界だと、正直に話す" },
      { id: "TUTORIAL:CONTACT:WHO", type: "conversation", tutorialBeat: "contact:who", targetNpcId: "NPC004", targetNpcName: "エダ", minutes: 6, label: "警戒を解かず、まず相手の名前を聞く" },
    ]);
  }
  if (tutorial.stage === "orientation") {
    return withChoiceIds([
      { id: "TUTORIAL:ORIENT:VOICES", type: "conversation", tutorialBeat: "orient:voices", targetNpcId: "NPC004", targetNpcName: "エダ", minutes: 6, label: "遠くから聞こえる呼び声について尋ねる" },
      { id: "TUTORIAL:ORIENT:FOUND", type: "conversation", tutorialBeat: "orient:found", targetNpcId: "NPC004", targetNpcName: "エダ", minutes: 8, label: "自分がどんな状態で見つかったのか聞く" },
      { id: "TUTORIAL:ORIENT:HELP", type: "conversation", tutorialBeat: "orient:help", targetNpcId: "NPC004", targetNpcName: "エダ", minutes: 10, label: "水と、落ち着ける場所を頼む" },
    ]);
  }
  const t01Status = runtime.playerState.troubles.T01?.status;
  if (tutorial.stage === "mission_intro"
    && runtime.playerState.player.facilityId === "LOC_FARM_SQUARE"
    && ["active", "critical"].includes(t01Status)) {
    return withChoiceIds([
      { id: "TUTORIAL:INQUIRY:GARO", type: "conversation", tutorialBeat: "inquiry:garo", targetNpcId: "NPC003", targetNpcName: "ガロ村長", missionId: "MSN-T01", stepId: "hear", minutes: 10, label: "捜索を指揮する村長に、状況を整理してもらう" },
      { id: "TUTORIAL:INQUIRY:MIRA", type: "conversation", tutorialBeat: "inquiry:mira", targetNpcId: "NPC002", targetNpcName: "ミラ", missionId: "MSN-T01", stepId: "hear", minutes: 12, label: "震える女性へ近づき、誰を捜しているのか聞く" },
      { id: "TUTORIAL:INQUIRY:COBY", type: "conversation", tutorialBeat: "inquiry:coby", targetNpcId: "NPC062", targetNpcName: "コビー", missionId: "MSN-T01", stepId: "hear", minutes: 14, label: "何かを言いたそうな少年と、目線を合わせて話す" },
    ]);
  }
  if (tutorial.stage === "aftermath_intro" && runtime.playerState.player.facilityId === "LOC_FARM_SQUARE") {
    const present = runtime.playerState.authoritativePresentNpcIds instanceof Set
      ? runtime.playerState.authoritativePresentNpcIds
      : new Set(runtime.playerState.authoritativePresentNpcIds ?? []);
    const aftermathAction = (id, beat, npcId, npcName, minutes, conversationLabel, observationLabel) => present.has(npcId)
      ? { id, type: "conversation", tutorialBeat: beat, targetNpcId: npcId, targetNpcName: npcName, minutes, label: conversationLabel }
      : { id, type: "observe", tutorialBeat: beat, minutes, label: observationLabel };
    return withChoiceIds([
      aftermathAction(
        "TUTORIAL:AFTERMATH:T01",
        "aftermath:garo",
        "NPC003",
        "ガロ村長",
        8,
        "ガロ村長に、捜索がどう終わったのか聞く",
        "掲示板に残された捜索記録を読む",
      ),
      aftermathAction(
        "TUTORIAL:AFTERMATH:MIRA",
        "aftermath:mira",
        "NPC002",
        "ミラ",
        10,
        "ミラのそばに座り、語り始めるまで待つ",
        "広場に残る捜索隊の荷物を確かめる",
      ),
      aftermathAction(
        "TUTORIAL:AFTERMATH:COBY",
        "aftermath:coby",
        "NPC062",
        "コビー",
        9,
        "俯くコビーに、何があったのか静かに尋ねる",
        "村外れから戻った足跡と傷ついた装備を見る",
      ),
    ]);
  }
  return null;
}

function dialogueFollowupActions(runtime) {
  const session = runtime.dialogueSession;
  if (!session || runtime.tutorial?.stage && runtime.tutorial.stage !== "free") return null;
  if (runtime.playerState.absoluteMinute - Number(session.openedAtMinute ?? -Infinity) > 30) return null;
  if (session.facilityId !== runtime.playerState.player.facilityId || session.location !== runtime.playerState.player.location) return null;
  const presentIds = runtime.playerState.authoritativePresentNpcIds;
  if (!(presentIds instanceof Set) || !presentIds.has(session.npcId)) return null;
  return withChoiceIds([
    {
      id: `DIALOGUE:${session.npcId}:CONCERN`,
      type: "conversation",
      dialogueFollowup: true,
      dialogueTopic: "local_concern",
      targetNpcId: session.npcId,
      targetNpcName: session.npcName,
      minutes: 7,
      label: `${session.npcName}に、この辺りで困っていることを尋ねる`,
    },
    {
      id: `DIALOGUE:${session.npcId}:RUMOR`,
      type: "conversation",
      dialogueFollowup: true,
      dialogueTopic: "local_rumor",
      targetNpcId: session.npcId,
      targetNpcName: session.npcName,
      minutes: 8,
      label: `${session.npcName}に、最近耳にした噂がないか尋ねる`,
    },
    {
      id: `DIALOGUE:${session.npcId}:END`,
      type: "conversation",
      dialogueFollowup: true,
      dialogueTopic: "end_conversation",
      targetNpcId: session.npcId,
      targetNpcName: session.npcName,
      minutes: 2,
      label: `${session.npcName}に礼を言い、会話を終える`,
    },
  ]);
}

function worldTicksThrough(targetMinute) {
  const ticks = [];
  const capped = Math.min(journey.GAME_END_MINUTE, Math.max(0, targetMinute));
  for (let day = 1; day <= 100; day += 1) {
    for (let phaseIndex = 0; phaseIndex < PHASE_MINUTES.length; phaseIndex += 1) {
      const minute = (day - 1) * 1440 + PHASE_MINUTES[phaseIndex];
      if (minute > capped) return ticks;
      ticks.push({
        minute,
        day,
        phaseIndex,
        phase: PHASE_NAMES[phaseIndex],
        hour: [10, 14, 18, 22][phaseIndex],
        absoluteHour: (day - 1) * 24 + phaseIndex * 4,
      });
    }
  }
  return ticks;
}

function settleLivingWorldMovement(runtime, absoluteMinute) {
  const absoluteHour = Math.max(0, Number(absoluteMinute)) / 60;
  for (const state of Object.values(runtime.livingWorld.npcStates)) {
    const local = state.localTravel;
    if (local && local.arriveAt <= absoluteHour + 1e-9) {
      state.position = { hubId: local.hubId, facilityId: local.toFacilityId };
      state.location = local.hubId;
      state.localTravel = null;
      state.presence = "present";
      state.localMovementCount = Number(state.localMovementCount ?? 0) + 1;
      runtime.livingWorld.localMovementEvents.push({
        npcId: state.id,
        scope: "facility",
        routeId: local.routeId,
        hubId: local.hubId,
        fromFacilityId: local.fromFacilityId,
        toFacilityId: local.toFacilityId,
        departedAt: local.departedAt,
        arrivedAt: local.arriveAt,
        durationHours: local.arriveAt - local.departedAt,
        settledBy: "player-world-clock",
      });
    }
    const travel = state.travel;
    if (travel && travel.arriveAt <= absoluteHour + 1e-9) {
      state.location = travel.to;
      state.position = { hubId: travel.to, facilityId: null };
      state.travel = null;
      state.presence = "present";
    }
  }
}

function advanceLivingWorld(runtime, targetMinute) {
  const pending = worldTicksThrough(targetMinute).filter((tick) => tick.minute > runtime.lastWorldTickMinute);
  for (const time of pending) {
    settleLivingWorldMovement(runtime, time.minute);
    prepareNpcLifeTick(runtime.livingWorld, {
      time,
      troubleStates: runtime.playerState.troubles,
      worldFlags: runtime.playerState.worldFlags,
    });
    // Crisis intents deliberately do not resolve authored trouble. They still
    // change NPC plans, travel, knowledge and exposure in the life engine.
    completeNpcLifeTick(runtime.livingWorld, {
      time,
      troubleStates: runtime.playerState.troubles,
      worldFlags: runtime.playerState.worldFlags,
    });
    runtime.lastWorldTickMinute = time.minute;
  }
  settleLivingWorldMovement(runtime, targetMinute);
}

function addRescueRumor(runtime) {
  const world = runtime.livingWorld;
  const factId = "player:T01:rescued";
  if (world.seededTroubleFacts.has(factId)) return;
  world.seededTroubleFacts.add(factId);
  const learnedAt = runtime.playerState.absoluteMinute / 60;
  world.knowledgeEventSequence = Number(world.knowledgeEventSequence ?? world.knowledgeEvents.length) + 1;
  const eventId = `K${String(world.knowledgeEventSequence).padStart(7, "0")}`;
  const belief = {
    factId,
    kind: "trouble",
    text: "失踪していたフィンが救出された",
    troubleId: "T01",
    troubleIds: ["T01"],
    troubleStatus: "resolved",
    confidence: 1,
    importance: 0.95,
    secret: false,
    learnedAt,
    propagationAt: learnedAt + 4,
    sourceType: "player-intervention",
    sourceNpcId: null,
    provenanceEventId: eventId,
    hopCount: 0,
    path: ["facility:LOC_FARM_EDGE"],
  };
  world.knowledgeEvents.push({
    id: eventId,
    type: "rumor-source",
    npcId: null,
    factId,
    troubleId: "T01",
    troubleStatus: "resolved",
    learnedAt,
    propagationAt: learnedAt + 4,
    sourceType: "player-intervention",
    importance: belief.importance,
    confidence: 1,
    hopCount: 0,
    path: [...belief.path],
    location: { hubId: "田園の村", facilityId: "LOC_FARM_EDGE" },
  });
  world.facilityRumors.LOC_FARM_EDGE?.set(factId, {
    factId,
    belief,
    propagationAt: learnedAt + 4,
    sourceNpcId: null,
    sourceEventId: eventId,
    carrierType: "player-intervention",
  });
}

function applyPlayerWorldInterventions(runtime, previousTroubleStates) {
  const before = previousTroubleStates?.T01;
  const after = runtime.playerState.troubles.T01?.status;
  const key = "PLAYER:T01:RESCUE";
  const finn = runtime.livingWorld.npcStates.NPC001;
  if (after !== "resolved"
    || before === "resolved"
    || runtime.playerInterventions.has(key)
    || finn?.lifeStatus === "dead") return;
  runtime.playerInterventions.add(key);
  if (finn) {
    const fromPresence = finn.presence;
    const fromLifeStatus = finn.lifeStatus;
    finn.presence = "present";
    finn.lifeStatus = "injured";
    finn.health = Math.max(42, Number(finn.health ?? 42));
    finn.status = "救出・療養中";
    finn.position = { hubId: "田園の村", facilityId: "LOC_FARM_SQUARE" };
    finn.currentGoal = "recover-after-rescue";
    finn.travel = null;
    finn.localTravel = null;
    runtime.livingWorld.appliedFates.add("NPC001:source-fate");
    runtime.livingWorld.lifeEvents.push({
      id: `L${String(runtime.livingWorld.lifeEvents.length + 1).padStart(7, "0")}`,
      npcId: "NPC001",
      type: "player-rescue",
      fromPresence,
      toPresence: "present",
      fromLifeStatus,
      toLifeStatus: "injured",
      from: fromPresence,
      to: "injured",
      vitalState: "injured",
      presence: "present",
      day: runtime.playerState.day,
      phaseIndex: runtime.playerState.phaseIndex,
      absoluteHour: runtime.playerState.absoluteMinute / 60,
      location: { ...finn.position },
      locationId: finn.position.facilityId,
      cause: "player-resolved-t01",
      relatedTroubleIds: ["T01"],
    });
  }
  addRescueRumor(runtime);
}

export function createGameRuntime(data, { seed, profileId, playerName, tutorial = false }) {
  const playerState = journey.createInitialJourneyState({
    model: data.model,
    battleData: data.battleData,
    skills: data.skills,
    profile: profileFor(profileId),
    tuning: gameplayTuning(),
    seed,
  });
  playerState.player.displayName = playerName;
  playerState.player.name = playerName;
  Object.assign(playerState.worldFlags, {
    knightOrderCooperation: false,
    mageTowerPermit: false,
    farmFestivalHeld: false,
    executionGroundDeal: false,
    royalProof: false,
  });
  applyGameplayCatalogOverrides(playerState.catalog);
  const npcStates = Object.fromEntries(data.model.npcs.map((npc) => [npc.id, initialNpcState(npc)]));
  const livingWorld = createNpcLifeEngine({ model: data.model, seed: `${seed}:living-world`, npcStates });
  initializeFinnAsMissing(livingWorld);
  const runtime = {
    playerState,
    livingWorld,
    lastWorldTickMinute: -1,
    playerInterventions: new Set(),
    tutorial: tutorial ? createTutorialState() : null,
    dialogueSession: null,
  };
  advanceLivingWorld(runtime, playerState.absoluteMinute);
  if (tutorial) {
    prepareOpeningTutorial(livingWorld, playerState.absoluteMinute);
    hideUnheardOpeningTrouble(playerState);
  } else {
    placeOpeningGuide(livingWorld);
  }
  syncAuthoritativePresentNpcIds(runtime, data);
  return runtime;
}

function hydrateRuntime(record, data) {
  const runtime = deserializeRuntime(record.runtimeSnapshot, data);
  applyGameplayCatalogOverrides(runtime.playerState.catalog);
  runtime.playerInterventions ??= new Set();
  syncAuthoritativePresentNpcIds(runtime, data);
  return runtime;
}

export function gameStateHash(runtime, data) {
  return sha256(`${data.contentRevision}\n${TRPG_GAME_RESOLVER_VERSION}\n${serializeRuntime(runtime)}`);
}

function choiceIntent(action) {
  if (action.type === "conversation") return action.targetNpcId ? "talk" : "investigate";
  if (action.type === "investigate") return "investigate";
  if (["missionBattle", "seekBattle"].includes(action.type)) return "prepare";
  if (action.type === "resolveMission") return "help";
  if (action.type === "rest") return "wait";
  if (action.type === "work") return "help";
  return "observe";
}

function choiceActions(runtime, data) {
  if (runtime.playerState.absoluteMinute >= journey.GAME_END_MINUTE) return [];
  syncAuthoritativePresentNpcIds(runtime, data);
  const authored = openingChoiceActions(runtime);
  if (authored) return authored;
  const followup = dialogueFollowupActions(runtime);
  if (followup) return followup;
  const generated = journey.generateChoiceActions(
    runtime.playerState,
    data.model,
    data.battleData,
    runtime.playerState.catalog,
    profileFor(runtime.playerState.profileId),
  );
  const fillers = [
    { id: "TUTORIAL:PAUSE:OBSERVE", type: "observe", minutes: 20, label: "今いる場所の様子を、もう少し確かめる" },
    { id: "TUTORIAL:PAUSE:BREATHE", type: "observe", minutes: 12, label: "深呼吸して、分かったことを整理する" },
    { id: "TUTORIAL:PAUSE:WAIT", type: "observe", minutes: 15, label: "人の流れを眺めながら少し待つ" },
  ];
  if (!runtime.tutorial) return generated;
  if (runtime.tutorial.stage === "free") {
    const needsSkillPrimer = runtime.playerState.player.skills.size === 0;
    if (!needsSkillPrimer) return generated;
    const withoutDeliberateBattle = generated.filter((action) => !["seekBattle", "missionBattle"].includes(action.type));
    return withChoiceIds([...new Map([...withoutDeliberateBattle, ...fillers].map((action) => [action.id, action])).values()].slice(0, 3));
  }
  const safe = generated.filter((action) => !["seekBattle", "missionBattle", "investigate"].includes(action.type));
  const result = [...new Map([...safe, ...fillers].map((action) => [action.id, action])).values()].slice(0, 3);
  return withChoiceIds(result);
}

function movementActions(runtime, data) {
  if (runtime.playerState.absoluteMinute >= journey.GAME_END_MINUTE) return [];
  const actions = journey.availableMovementActions(runtime.playerState, data.model);
  if (!runtime.tutorial || runtime.tutorial.stage === "free") return actions;
  if (!["movement", "mission_intro", "movement_aftermath", "aftermath_intro"].includes(runtime.tutorial.stage)) return [];
  return actions.filter((action) => action.movementScope === "local");
}

function learnLocalLivingRumors(runtime, data, action, limit) {
  const state = runtime.playerState;
  const facilityId = state.player.facilityId;
  const pool = runtime.livingWorld.facilityRumors?.[facilityId];
  if (limit <= 0) return [];
  const sourceNpcState = action?.type === "conversation" && action.targetNpcId
    ? runtime.livingWorld.npcStates[action.targetNpcId]
    : null;
  const sourceNpc = sourceNpcState ? data.model.npcById?.[action.targetNpcId] ?? data.model.npcs.find((npc) => npc.id === action.targetNpcId) : null;
  const currentHour = state.absoluteMinute / 60;
  const sourceBeliefs = sourceNpcState
    ? Object.values(sourceNpcState.beliefs ?? {})
    : pool instanceof Map
      ? [...pool.values()]
        .filter((entry) => Number(entry?.propagationAt ?? entry?.belief?.propagationAt ?? 0) <= currentHour)
        .map((entry) => entry?.belief ?? entry)
      : [];
  const candidates = sourceBeliefs
    .filter((belief) => belief?.factId && belief.secret !== true && Number(belief.importance ?? 0) >= 0.55)
    .filter((belief) => !state.player.knownRumorIds.has(`RUM-LIVING-${belief.factId}`))
    .sort((left, right) => Number(right.importance ?? 0) - Number(left.importance ?? 0)
      || String(left.factId).localeCompare(String(right.factId)))
    .slice(0, limit);
  const learned = [];
  for (const belief of candidates) {
    const id = `RUM-LIVING-${belief.factId}`;
    const trouble = belief.troubleId ? data.model.troubleById[belief.troubleId] : null;
    const statusText = belief.troubleStatus === "critical" ? "危機が差し迫っている"
      : belief.troubleStatus === "failed" ? "被害が発生した"
        : belief.troubleStatus === "resolved" ? "状況が変わった"
          : "異変が起きている";
    const rumor = {
      id,
      troubleId: belief.troubleId ?? null,
      text: trouble ? `${trouble.name}について、${statusText}という噂を聞いた。` : String(belief.text ?? "現地で気になる噂を聞いた。"),
      origin: state.player.location,
      originMinute: Math.max(0, Math.round(Number(belief.learnedAt ?? state.absoluteMinute / 60) * 60)),
      importance: Number(belief.importance ?? 0.6),
      playerOriginated: false,
      sourceNpcId: sourceNpcState?.id ?? null,
      sourceNpcName: sourceNpc?.name ?? null,
      sourceType: sourceNpcState ? "npc-conversation" : "local-observation",
      recipients: {},
    };
    state.rumors.push(rumor);
    state.rumorById[id] = rumor;
    state.player.knownRumorIds.add(id);
    state.history.push({
      type: "RUMOR_LEARNED_LOCAL",
      minute: state.absoluteMinute,
      rumorId: id,
      factId: belief.factId,
      troubleId: rumor.troubleId,
      facilityId,
      sourceNpcId: rumor.sourceNpcId,
      sourceType: rumor.sourceType,
    });
    learned.push(id);
  }
  return learned;
}

function tutorialBeatSummary(beat) {
  const summaries = {
    "awake:body": "体に大きな怪我はない。だが、服にも記憶にも、この麦畑へ来た手掛かりはなかった。",
    "awake:listen": "風に鳴る麦の向こうから、鐘と人の暮らしの音が聞こえた。",
    "awake:ground": "倒れた麦は自分を中心に広がっている。ここまで歩いて来た足跡は見つからなかった。",
    "contact:where": "ここが田園の村の麦畑で、目の前の女性がエダだと分かった。",
    "contact:memory": "見知らぬ世界から来たという話を、エダは笑わずに受け止めた。",
    "contact:who": "女性はエダと名乗り、こちらを警戒するより先に体調を気遣った。",
    "orient:voices": "村の広場で誰かを捜しているらしい。詳しい事情は、まだ分からない。",
    "orient:found": "麦畑の中に倒れていて、周囲には歩いて来た跡がなかったと聞いた。",
    "orient:help": "エダが一食と今夜の寝床を世話してくれることになった。",
    "movement:square": "移動を使って村の広場へ着いた。人だかりの中心で、切迫した呼び声が聞こえる。",
    "movement:aftermath": "村の広場へ着いた時には捜索が終わっていた。選ばなかった時間にも、世界は先へ進んでいた。",
    "inquiry:garo": "ガロ村長から、フィンの捜索範囲と期限を聞いた。",
    "inquiry:mira": "ミラから、息子フィンが地図を持って姿を消したと聞いた。",
    "inquiry:coby": "コビーから、フィンが古い見張り小屋へ行きたがっていたと聞いた。",
    "aftermath:garo": "ガロ村長から、捜索が間に合わずフィンを救えなかった経緯を聞いた。",
    "aftermath:mira": "ミラの沈黙と広場の空気から、取り返せない結末が訪れたことを知った。",
    "aftermath:coby": "コビーから、フィンを止められなかった後悔と捜索の結末を聞いた。",
  };
  return summaries[beat] ?? "選んだ行動から、新しいことが分かった。";
}

function progressTutorial(runtime, action, result) {
  const tutorial = runtime.tutorial;
  if (!tutorial) return;
  tutorial.lastBeat = null;
  const beat = action?.tutorialBeat;
  if (tutorial.stage === "awakening" && beat?.startsWith("awake:")) {
    tutorial.firstInstinct = action.id;
    tutorial.stage = "first_contact";
    tutorial.lastBeat = beat;
    placeOpeningGuide(runtime.livingWorld, runtime.playerState.absoluteMinute);
  } else if (tutorial.stage === "first_contact" && beat?.startsWith("contact:")) {
    tutorial.firstReply = action.id;
    tutorial.stage = "orientation";
    tutorial.lastBeat = beat;
  } else if (tutorial.stage === "orientation" && beat?.startsWith("orient:")) {
    tutorial.orientationChoice = action.id;
    tutorial.stage = "movement";
    tutorial.lastBeat = beat;
  } else if (tutorial.stage === "movement" && action?.destinationFacilityId === "LOC_FARM_SQUARE") {
    tutorial.stage = "mission_intro";
    tutorial.lastBeat = "movement:square";
    placeOpeningCrisisCast(runtime.livingWorld, runtime.playerState.absoluteMinute);
  } else if (tutorial.stage === "movement_aftermath" && action?.destinationFacilityId === "LOC_FARM_SQUARE") {
    tutorial.stage = "aftermath_intro";
    tutorial.lastBeat = "movement:aftermath";
    placeOpeningAftermathCast(runtime.livingWorld, runtime.playerState.absoluteMinute);
  } else if (tutorial.stage === "mission_intro" && beat?.startsWith("inquiry:")) {
    tutorial.inquirySource = action.id;
    const clue = OPENING_CLUES[beat];
    if (clue) {
      tutorial.openingFacts.add(clue.id);
      runtime.playerState.player.evidenceByTrouble.T01 = Number(runtime.playerState.player.evidenceByTrouble.T01 ?? 0) + clue.evidence;
      runtime.playerState.history.push({
        type: "PLAYER_FACT_LEARNED",
        minute: runtime.playerState.absoluteMinute,
        factId: clue.id,
        troubleId: "T01",
        text: clue.text,
      });
    }
    tutorial.stage = "free";
    tutorial.lastBeat = beat;
  } else if (tutorial.stage === "aftermath_intro" && beat?.startsWith("aftermath:")) {
    tutorial.openingFacts.add(OPENING_AFTERMATH_FACT.id);
    runtime.playerState.history.push({
      type: "PLAYER_FACT_LEARNED",
      minute: runtime.playerState.absoluteMinute,
      factId: OPENING_AFTERMATH_FACT.id,
      troubleId: "T01",
      text: OPENING_AFTERMATH_FACT.text,
    });
    tutorial.stage = "free";
    tutorial.lastBeat = beat;
  }
  if (!tutorial.lastBeat) return;
  result.summary = tutorialBeatSummary(tutorial.lastBeat);
  runtime.playerState.history.push({
    type: "TUTORIAL_DECISION",
    minute: runtime.playerState.absoluteMinute,
    actionId: action.id,
    text: result.summary,
  });
}

function reconcileOpeningCrisis(runtime) {
  const tutorial = runtime.tutorial;
  if (!tutorial || tutorial.inquirySource) return;
  const status = runtime.playerState.troubles.T01?.status;
  if (!["failed", "suppressed"].includes(status)) return;
  tutorial.openingCrisisOutcome = status;
  if (!["movement", "mission_intro", "movement_aftermath"].includes(tutorial.stage)) return;
  const atSquare = runtime.playerState.player.facilityId === "LOC_FARM_SQUARE";
  tutorial.stage = atSquare ? "aftermath_intro" : "movement_aftermath";
  if (atSquare) {
    tutorial.lastBeat = "deadline:aftermath";
    placeOpeningAftermathCast(runtime.livingWorld, runtime.playerState.absoluteMinute);
  }
}

function stabilizeOpeningTutorialCast(runtime) {
  const tutorial = runtime.tutorial;
  if (!tutorial || runtime.playerState.player.facilityId !== "LOC_FARM_SQUARE") return;
  const absoluteMinute = runtime.playerState.absoluteMinute;
  if (tutorial.stage === "mission_intro"
    && ["active", "critical"].includes(runtime.playerState.troubles.T01?.status)) {
    placeOpeningCrisisCast(runtime.livingWorld, absoluteMinute);
  } else if (tutorial.stage === "aftermath_intro") {
    placeOpeningAftermathCast(runtime.livingWorld, absoluteMinute);
  }
}

function updateDialogueSession(runtime, action) {
  if (!action) return;
  if (action.dialogueFollowup) {
    runtime.dialogueSession = null;
    return;
  }
  if (action.type === "conversation" && action.targetNpcId && !action.missionId && !action.tutorialBeat) {
    runtime.dialogueSession = {
      npcId: action.targetNpcId,
      npcName: action.targetNpcName ?? action.targetNpcId,
      openedAtMinute: runtime.playerState.absoluteMinute,
      location: runtime.playerState.player.location,
      facilityId: runtime.playerState.player.facilityId,
    };
    return;
  }
  if (action.type === "move") runtime.dialogueSession = null;
}

function expireDialogueSession(runtime) {
  const session = runtime.dialogueSession;
  if (!session) return;
  const presentIds = runtime.playerState.authoritativePresentNpcIds;
  const expired = runtime.playerState.absoluteMinute - Number(session.openedAtMinute ?? -Infinity) > 30;
  const leftScene = session.location !== runtime.playerState.player.location
    || session.facilityId !== runtime.playerState.player.facilityId;
  const targetAbsent = !(presentIds instanceof Set) || !presentIds.has(session.npcId);
  if (expired || leftScene || targetAbsent) runtime.dialogueSession = null;
}

function resolvedActionForPresentation(action) {
  if (!action) return null;
  return {
    id: action.id,
    type: action.type,
    label: action.label,
    targetNpcId: action.targetNpcId ?? null,
    targetNpcName: action.targetNpcName ?? null,
    missionId: action.missionId ?? null,
    stepId: action.stepId ?? null,
    dialogueTopic: action.dialogueTopic ?? null,
    destinationFacilityId: action.destinationFacilityId ?? null,
    destinationHub: action.destinationHub ?? null,
    movementScope: action.movementScope ?? null,
  };
}

const MAX_BATTLE_PLAYBACK_FRAMES = 96;
const MAX_BATTLE_PLAYBACK_BYTES = 60 * 1024;

function battleNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(4)) : fallback;
}

function centeredFrameSample(frames, limit) {
  if (frames.length <= limit) return frames;
  const head = Math.ceil(limit / 2);
  return [...frames.slice(0, head), ...frames.slice(-(limit - head))];
}

export function safeBattlePlayback(battle, data) {
  const timeline = battle?.timeline;
  if (!timeline || !Array.isArray(timeline.combatants) || !Array.isArray(timeline.frames)) return null;
  const battleData = data?.battleData;
  const combatantSource = timeline.combatants.slice(0, 24);
  const knownInstanceIds = new Set(combatantSource.map((actor) => cleanText(actor?.instanceId, 100)));
  const combatants = combatantSource.map((actor) => {
    const monster = actor?.side === "enemy" ? battleData?.monsterById?.get(actor.id) : null;
    return {
      instanceId: cleanText(actor?.instanceId, 100),
      actorId: cleanText(actor?.id, 100),
      side: actor?.side === "enemy" ? "enemy" : "player",
      name: cleanText(monster?.name ?? actor?.name ?? (actor?.side === "enemy" ? "敵" : "冒険者"), 48),
      hp: battleNumber(actor?.hp),
      maxHp: Math.max(1, battleNumber(actor?.maxHp, 1)),
      mp: battleNumber(actor?.mp),
      maxMp: Math.max(0, battleNumber(actor?.maxMp)),
      alive: actor?.alive !== false,
    };
  });
  const sourceFrames = timeline.frames;
  const sourceEntries = sourceFrames.map((frame, sourceIndex) => ({ frame, sourceIndex }));
  let selectedEntries = centeredFrameSample(sourceEntries, MAX_BATTLE_PLAYBACK_FRAMES);
  const checkpointAt = (sourceIndex) => {
    const actors = new Map(combatants.map((actor) => [actor.instanceId, {
      instanceId: actor.instanceId,
      hp: actor.hp,
      mp: actor.mp,
      alive: actor.alive,
    }]));
    sourceFrames.slice(0, sourceIndex).forEach((sourceFrame) => {
      (Array.isArray(sourceFrame?.effects) ? sourceFrame.effects : []).forEach((effect) => {
        const actor = actors.get(cleanText(effect?.targetInstanceId, 100));
        if (!actor) return;
        actor.hp = Math.max(0, battleNumber(effect?.hpAfter, actor.hp));
        actor.mp = Math.max(0, battleNumber(effect?.mpAfter, actor.mp));
        actor.alive = effect?.aliveAfter !== false;
      });
    });
    return [...actors.values()];
  };
  const sanitizeFrame = ({ frame, sourceIndex }, previousSourceIndex = -1) => {
    const skillId = cleanText(frame?.action?.skillId, 100) || null;
    const knownSkill = battleData?.playerSkillById?.get(skillId) ?? battleData?.monsterSkillById?.get(skillId);
    const actionKind = ["attack", "skill", "status_failure"].includes(frame?.action?.kind)
      ? frame.action.kind
      : null;
    const actionName = frame?.phase === "round_start"
      ? "ラウンド開始時の効果"
      : frame?.phase === "round_end"
        ? "ラウンド終了時の効果"
        : cleanText(knownSkill?.name ?? frame?.action?.name ?? "行動", 64);
    const omittedBefore = previousSourceIndex >= 0 ? Math.max(0, sourceIndex - previousSourceIndex - 1) : sourceIndex;
    return {
      seq: Math.max(0, Math.trunc(battleNumber(frame?.seq))),
      round: Math.max(0, Math.trunc(battleNumber(frame?.round))),
      phase: ["action", "round_start", "round_end"].includes(frame?.phase) ? frame.phase : "action",
      actorInstanceId: knownInstanceIds.has(cleanText(frame?.actorInstanceId, 100))
        ? cleanText(frame.actorInstanceId, 100)
        : null,
      actorSide: ["player", "enemy"].includes(frame?.actorSide) ? frame.actorSide : null,
      action: actionKind ? {
        kind: actionKind,
        actionId: cleanText(frame?.action?.actionId, 100) || null,
        skillId,
        name: actionName,
      } : null,
      primaryTargetInstanceId: knownInstanceIds.has(cleanText(frame?.primaryTargetInstanceId, 100))
        ? cleanText(frame.primaryTargetInstanceId, 100)
        : null,
      hits: Math.max(0, Math.trunc(battleNumber(frame?.hits))),
      criticals: Math.max(0, Math.trunc(battleNumber(frame?.criticals))),
      damage: Math.max(0, battleNumber(frame?.damage)),
      healing: Math.max(0, battleNumber(frame?.healing)),
      effects: (Array.isArray(frame?.effects) ? frame.effects : []).slice(0, 24).flatMap((effect) => {
        const targetInstanceId = cleanText(effect?.targetInstanceId, 100);
        if (!knownInstanceIds.has(targetInstanceId)) return [];
        return [{
          targetInstanceId,
          hpBefore: Math.max(0, battleNumber(effect?.hpBefore)),
          hpAfter: Math.max(0, battleNumber(effect?.hpAfter)),
          mpBefore: Math.max(0, battleNumber(effect?.mpBefore)),
          mpAfter: Math.max(0, battleNumber(effect?.mpAfter)),
          aliveBefore: effect?.aliveBefore !== false,
          aliveAfter: effect?.aliveAfter !== false,
          ...(Array.isArray(effect?.statusesBefore) || Array.isArray(effect?.statusesAfter) ? {
            statusesBefore: (Array.isArray(effect?.statusesBefore) ? effect.statusesBefore : [])
              .slice(0, 12)
              .map((status) => cleanText(status, 48)),
            statusesAfter: (Array.isArray(effect?.statusesAfter) ? effect.statusesAfter : [])
              .slice(0, 12)
              .map((status) => cleanText(status, 48)),
          } : {}),
        }];
      }),
      ...(omittedBefore > 0 ? {
        omittedBefore,
        checkpoint: checkpointAt(sourceIndex),
      } : {}),
    };
  };
  const sanitizeSelection = (entries) => entries.map((entry, index) => sanitizeFrame(entry, entries[index - 1]?.sourceIndex ?? -1));
  let frames = sanitizeSelection(selectedEntries);
  const encounterId = battle.encounterId ?? battle.encounter?.id ?? null;
  const encounter = battleData?.encounterById?.get(encounterId);
  const build = () => ({
    version: 1,
    encounter: {
      id: cleanText(encounterId, 100) || null,
      name: cleanText(encounter?.name ?? "戦闘", 64),
    },
    combatants,
    frames,
    truncatedFrames: Math.max(0, sourceFrames.length - frames.length),
  });
  let playback = build();
  while (Buffer.byteLength(JSON.stringify(playback), "utf8") > MAX_BATTLE_PLAYBACK_BYTES && frames.length > 8) {
    selectedEntries = centeredFrameSample(selectedEntries, Math.max(8, Math.floor(frames.length * 0.8)));
    frames = sanitizeSelection(selectedEntries);
    playback = build();
  }
  return playback;
}

function safeOutcome(result, data = null) {
  const output = { ok: result?.ok !== false, type: result?.type ?? null, reason: result?.reason ?? null };
  if (result?.committed === true) output.committed = true;
  if (result?.price !== undefined) output.price = result.price;
  if (result?.equipment) output.item = { id: result.equipment.id, name: result.equipment.name };
  if (result?.skillId) output.skillId = result.skillId;
  if (result?.spCost) output.spCost = result.spCost;
  if (result?.learnedRumorIds?.length) output.learnedRumorCount = result.learnedRumorIds.length;
  if (result?.battle) {
    output.battle = {
      encounterId: result.battle.encounterId ?? result.battle.encounter?.id ?? null,
      won: Boolean(result.battle.won),
      rounds: result.battle.rounds ?? result.battle.turns ?? null,
      exp: result.battle.exp ?? result.battle.rewards?.exp ?? null,
      gold: result.battle.gold ?? result.battle.rewards?.gold ?? null,
    };
    const playback = safeBattlePlayback(result.battle, data);
    if (playback) output.battle.playback = playback;
  }
  if (result?.summary) output.summary = cleanText(result.summary, 360);
  else if (!output.ok) output.summary = {
    mission_expired: "行動の途中で期限を迎え、危機は失敗に終わった。",
    mission_unavailable: "状況が変わり、この任務は続けられなくなった。",
    travel_defeat: "道中の戦闘に敗れ、出発地へ撤退した。",
    no_encounter: "手掛かりを追ったが、対象を見つけられなかった。",
    incomplete: "必要な準備が揃わないまま時間が過ぎた。",
  }[output.reason] ?? "行動を完了できなかった。";
  else if (output.battle) output.summary = output.battle.won ? "戦闘に勝利した。" : "戦闘から撤退した。";
  else if (output.item && output.price !== undefined) output.summary = `${output.item.name}を${output.price}Gで取引した。`;
  else if (output.skillId) output.summary = `新しいスキルを取得した。`;
  else if (output.learnedRumorCount) output.summary = `${output.learnedRumorCount}件の噂を新しく知った。`;
  else output.summary = "行動の結果が世界へ反映された。";
  return output;
}

function replayOutcome(outcome) {
  if (!outcome?.battle?.playback) return outcome;
  const { playback: _presentationOnly, ...battle } = outcome.battle;
  return { ...outcome, battle };
}

function errorFromResult(result) {
  const code = result?.reason ?? "command_rejected";
  const status = ["insufficient_gold", "insufficient_sp"].includes(code) ? 409 : 400;
  return new TrpgGameError(status, code, code, safeOutcome(result));
}

function equip(runtime, data, equipmentId) {
  const state = runtime.playerState;
  const equipment = data.battleData.equipmentById.get(equipmentId);
  if (!equipment) return { ok: false, reason: "unknown_equipment" };
  if (Number(state.player.inventory.equipment[equipmentId] ?? 0) <= 0) return { ok: false, reason: "not_owned" };
  if (equipment.slot === "mainHand" && ["twoHand", "twoHanded"].includes(equipment.grip) && state.player.equipment.offHand) {
    const removedEquipmentId = state.player.equipment.offHand;
    delete state.player.equipment.offHand;
    state.history.push({
      type: "EQUIPMENT_UNEQUIPPED",
      minute: state.absoluteMinute,
      equipmentId: removedEquipmentId,
      slot: "offHand",
      cause: "two-handed-main-equipped",
    });
  }
  if (equipment.slot === "offHand" && state.player.equipment.mainHand) {
    const mainHand = data.battleData.equipmentById.get(state.player.equipment.mainHand);
    if (["twoHand", "twoHanded"].includes(mainHand?.grip)) {
      const removedEquipmentId = state.player.equipment.mainHand;
      delete state.player.equipment.mainHand;
      state.history.push({
        type: "EQUIPMENT_UNEQUIPPED",
        minute: state.absoluteMinute,
        equipmentId: removedEquipmentId,
        slot: "mainHand",
        cause: "off-hand-equipped",
      });
    }
  }
  state.player.equipment[equipment.slot] = equipmentId;
  state.history.push({ type: "EQUIPMENT_EQUIPPED", minute: state.absoluteMinute, equipmentId, slot: equipment.slot });
  return { ok: true, type: "equip", equipment };
}

function unequip(runtime, slot) {
  const allowed = new Set(["mainHand", "offHand", "body", "accessory"]);
  if (!allowed.has(slot)) return { ok: false, reason: "unknown_equipment_slot" };
  const equipmentId = runtime.playerState.player.equipment[slot];
  if (!equipmentId) return { ok: false, reason: "slot_empty" };
  delete runtime.playerState.player.equipment[slot];
  runtime.playerState.history.push({ type: "EQUIPMENT_UNEQUIPPED", minute: runtime.playerState.absoluteMinute, equipmentId, slot });
  return { ok: true, type: "unequip", equipmentId, slot };
}

function withTemporaryTuning(state, key, value, operation) {
  const existed = Object.hasOwn(state.tuning, key);
  const previous = state.tuning[key];
  state.tuning[key] = value;
  try {
    return operation();
  } finally {
    if (existed) state.tuning[key] = previous;
    else delete state.tuning[key];
  }
}

export function executeGameRuntimeCommand(runtime, data, command) {
  if (!COMMAND_TYPES.has(command.type)) throw new TrpgGameError(400, "unknown_command_type");
  if (runtime.playerState.absoluteMinute >= journey.GAME_END_MINUTE) {
    throw new TrpgGameError(409, "game_ended", "The Day 1-100 journey has already ended");
  }
  const tutorialFeature = {
    MOVE: "movement",
    SHOP_BUY: "shop",
    SHOP_SELL: "shop",
    LEARN_SKILL: "skills",
  }[command.type];
  if (runtime.tutorial && tutorialFeature && tutorialView(runtime, data)?.unlocked?.[tutorialFeature] !== true) {
    throw new TrpgGameError(409, "tutorial_feature_locked", "Continue the introduction before using this feature", {
      feature: tutorialFeature,
    });
  }
  const payload = command.payload && typeof command.payload === "object" ? command.payload : {};
  if (runtime.tutorial) runtime.tutorial.lastBeat = null;
  const previousTroubleStates = Object.fromEntries(Object.entries(runtime.playerState.troubles).map(([id, value]) => [id, value.status]));
  let result;
  let resolvedActionId = null;
  let resolvedPlayerAction = null;
  if (command.type === "CHOOSE") {
    const choices = choiceActions(runtime, data);
    const action = choices.find((entry) => entry.choiceId === payload.choiceId);
    if (!action) throw new TrpgGameError(400, "choice_not_available");
    resolvedPlayerAction = action;
    resolvedActionId = action.id;
    const resolve = () => journey.resolvePlayerAction(
      runtime.playerState,
      data.model,
      data.battleData,
      data.skills,
      runtime.playerState.catalog,
      profileFor(runtime.playerState.profileId),
      action,
    );
    const resolveWithPlayback = () => withTemporaryTuning(runtime.playerState, "captureBattleTimeline", true, resolve);
    const suppressUnpreparedInvestigationEncounter = Boolean(runtime.tutorial
      && runtime.playerState.player.skills.size === 0
      && action.type === "investigate");
    result = suppressUnpreparedInvestigationEncounter
      ? withTemporaryTuning(runtime.playerState, "probeMode", true, resolveWithPlayback)
      : resolveWithPlayback();
    runtime.playerState.metrics.actions += 1;
  } else if (command.type === "MOVE") {
    const action = movementActions(runtime, data).find((entry) => entry.id === payload.moveId);
    if (!action) throw new TrpgGameError(400, "movement_not_available");
    resolvedPlayerAction = action;
    resolvedActionId = action.id;
    const resolve = () => journey.resolveMovementAction(
      runtime.playerState,
      data.model,
      data.battleData,
      data.skills,
      profileFor(runtime.playerState.profileId),
      action,
    );
    const resolveWithPlayback = () => withTemporaryTuning(runtime.playerState, "captureBattleTimeline", true, resolve);
    const suppressUnpreparedTravelEncounter = Boolean(runtime.tutorial
      && runtime.playerState.player.skills.size === 0
      && action.movementScope === "regional");
    result = suppressUnpreparedTravelEncounter
      ? withTemporaryTuning(runtime.playerState, "disableTravelEncounters", true, resolveWithPlayback)
      : resolveWithPlayback();
    runtime.playerState.metrics.actions += 1;
  } else if (command.type === "SHOP_BUY") {
    resolvedActionId = payload.stockId;
    result = buyEquipment(runtime.playerState, data.battleData, runtime.playerState.shop, payload.stockId);
    if (result.ok) {
      runtime.playerState.metrics.purchases += 1;
      runtime.playerState.metrics.zeroTimePurchases += 1;
    }
  } else if (command.type === "SHOP_SELL") {
    resolvedActionId = payload.equipmentId;
    result = sellEquipment(runtime.playerState, data.battleData, runtime.playerState.shop, payload.equipmentId);
  } else if (command.type === "EQUIP") {
    resolvedActionId = payload.equipmentId;
    result = equip(runtime, data, payload.equipmentId);
  } else if (command.type === "UNEQUIP") {
    resolvedActionId = payload.slot;
    result = unequip(runtime, payload.slot);
  } else if (command.type === "LEARN_SKILL") {
    resolvedActionId = payload.skillId;
    result = journey.learnPlayerSkill(runtime.playerState, data.battleData, data.skills, payload.skillId);
  } else if (command.type === "TUTORIAL_ACK") {
    const current = tutorialView(runtime, data);
    if (!current?.acknowledgeable || current.id !== payload.tutorialId) {
      throw new TrpgGameError(400, "tutorial_ack_not_available");
    }
    runtime.tutorial.acknowledged.add(current.id);
    resolvedActionId = `TUTORIAL_ACK:${current.id}`;
    result = { ok: true, type: "tutorial", summary: `「${current.title}」の案内を確認した。` };
    runtime.playerState.history.push({ type: "TUTORIAL_ACKNOWLEDGED", minute: runtime.playerState.absoluteMinute, tutorialId: current.id, text: result.summary });
  }
  if (!result?.ok && result?.committed !== true) throw errorFromResult(result);
  if (command.type === "MOVE" && result.ok && !result.summary) {
    const destinationName = data.model.facilityById[resolvedPlayerAction?.destinationFacilityId]?.name
      ?? resolvedPlayerAction?.destinationHub
      ?? "目的地";
    result.summary = `${destinationName}へ移動した。`;
  }
  if (result.ok && ["CHOOSE", "MOVE"].includes(command.type)) progressTutorial(runtime, resolvedPlayerAction, result);
  applyPlayerWorldInterventions(runtime, previousTroubleStates);
  advanceLivingWorld(runtime, runtime.playerState.absoluteMinute);
  reconcileOpeningCrisis(runtime);
  stabilizeOpeningTutorialCast(runtime);
  syncAuthoritativePresentNpcIds(runtime, data);
  if (["conversation", "observe"].includes(resolvedPlayerAction?.type)
    && !resolvedPlayerAction?.tutorialBeat
    && (!runtime.tutorial || runtime.tutorial.stage === "free")) {
    result.learnedRumorIds = learnLocalLivingRumors(runtime, data, resolvedPlayerAction, resolvedPlayerAction.type === "observe" ? 3 : 1);
  }
  updateDialogueSession(runtime, resolvedPlayerAction);
  expireDialogueSession(runtime);
  return {
    resolvedActionId,
    resolvedAction: resolvedActionForPresentation(resolvedPlayerAction),
    outcome: safeOutcome(result, data),
  };
}

function equipmentView(data, id, quantity, equippedSlots) {
  const equipment = data.battleData.equipmentById.get(id);
  return {
    id,
    name: equipment?.name ?? id,
    slot: equipment?.slot ?? null,
    weaponType: equipment?.weaponType ?? null,
    quantity,
    equipped: equippedSlots.filter((entry) => entry.id === id).map((entry) => entry.slot),
    performanceIndex: Number(equipment?.performanceIndex ?? 0),
  };
}

function deadlineLabel(definition) {
  const day = definition.deadlineDay ?? definition.finalDay;
  if (!day) return null;
  const phase = Number(definition.deadlinePhase ?? definition.finalPhase ?? 3);
  return `Day ${day} ${["朝", "昼", "夕方", "夜"][phase] ?? "夜"}まで`;
}

function openingKnownClues(runtime, troubleId) {
  if (troubleId !== "T01" || !(runtime.tutorial?.openingFacts instanceof Set)) return [];
  const byId = new Map(Object.values(OPENING_CLUES).map((clue) => [clue.id, clue]));
  return [...runtime.tutorial.openingFacts]
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map(({ id, text }) => ({ id, text }));
}

function openingKnownFactTexts(runtime) {
  if (!(runtime.tutorial?.openingFacts instanceof Set)) return [];
  const facts = new Map([
    ...Object.values(OPENING_CLUES).map((clue) => [clue.id, clue.text]),
    [OPENING_AFTERMATH_FACT.id, OPENING_AFTERMATH_FACT.text],
  ]);
  return [...runtime.tutorial.openingFacts].map((id) => facts.get(id)).filter(Boolean);
}

function missionView(runtime, data) {
  const state = runtime.playerState;
  if (runtime.tutorial && runtime.tutorial.stage !== "free") return [];
  const definitions = [...state.catalog.special, ...state.catalog.permanent];
  return definitions
    .flatMap((definition) => {
      const current = state.missions[definition.id];
      if (!current || current.status === "locked") return [];
      if (definition.kind === "permanent"
        && current.status === "active"
        && Number(current.progress?.value ?? 0) <= 0) return [];
      if (definition.kind === "special") {
        const playerKnows = state.rumors.some((rumor) => rumor.troubleId === definition.troubleId
          && state.player.knownRumorIds.has(rumor.id));
        const playerEngaged = state.progress.missions.attemptedTroubleIds.has(definition.troubleId)
          || state.progress.missions.resolvedTroubleIds.has(definition.troubleId)
          || state.progress.missions.completedIds.has(definition.id);
        if (!playerKnows && !playerEngaged) return [];
      }
      const step = Array.isArray(definition.steps)
        ? definition.steps.find((entry) => Number(current.progress[entry.id] ?? 0) < Number(entry.required ?? 1))
        : null;
      const targetFacilityId = step?.targetFacilityId ?? null;
      return [{
        id: definition.id,
        kind: definition.kind,
        troubleId: definition.troubleId ?? null,
        title: definition.title,
        status: current.status,
        deadlineDay: definition.deadlineDay ?? definition.finalDay ?? null,
        deadlineLabel: deadlineLabel(definition),
        currentStep: step ? {
          id: step.id,
          label: step.label,
          targetLocation: step.targetLocation ?? definition.targetLocations?.[0] ?? null,
          targetFacilityId: step.targetFacilityId ?? null,
          targetFacilityName: data.model.facilityById[step.targetFacilityId]?.name ?? null,
          progress: Number(current.progress[step.id] ?? 0),
          required: Number(step.required ?? 1),
        } : definition.metric ? {
          id: definition.metric,
          label: definition.title,
          targetLocation: null,
          targetFacilityId: null,
          progress: Number(current.progress?.value ?? 0),
          required: Number(definition.target ?? 1),
        } : null,
        targetLocation: step?.targetLocation ?? definition.targetLocations?.[0] ?? null,
        targetFacilityId,
        targetFacilityName: data.model.facilityById[targetFacilityId]?.name ?? null,
        knownClues: openingKnownClues(runtime, definition.troubleId),
        progressRatio: step
          ? Math.min(1, Number(current.progress[step.id] ?? 0) / Math.max(1, Number(step.required ?? 1)))
          : definition.metric
            ? Math.min(1, Number(current.progress?.value ?? 0) / Math.max(1, Number(definition.target ?? 1)))
            : current.status === "completed" ? 1 : 0,
      }];
    })
    .sort((left, right) => {
      const rank = { active: 0, available: 1, completed: 2, failed: 3 };
      return (rank[left.status] ?? 9) - (rank[right.status] ?? 9)
        || Number(left.deadlineDay ?? 999) - Number(right.deadlineDay ?? 999)
        || left.id.localeCompare(right.id);
    })
    .slice(0, 36);
}

function rumorView(runtime) {
  const state = runtime.playerState;
  return state.rumors
    .filter((rumor) => state.player.knownRumorIds.has(rumor.id))
    .slice(-30)
    .reverse()
    .map((rumor) => ({
      id: rumor.id,
      troubleId: rumor.troubleId,
      text: rumor.text,
      origin: rumor.origin,
      originMinute: rumor.originMinute,
      importance: rumor.importance,
      source: rumor.sourceNpcName ? `${rumor.sourceNpcName}から聞いた` : rumor.sourceType === "local-observation" ? "現地で確かめた" : null,
      sourceNpcId: rumor.sourceNpcId ?? null,
    }));
}

function chronicleView(runtime) {
  const state = runtime.playerState;
  const visibleTypes = new Set([
    "PLAYER_ACTION_RESOLVED", "LOCAL_MOVE_COMPLETED", "REGIONAL_MOVE_COMPLETED",
    "SHOP_BUY", "SHOP_SELL", "SKILL_LEARNED", "RUMOR_LEARNED_LOCAL",
    "MISSION_COMPLETED", "TUTORIAL_DECISION", "TUTORIAL_ACKNOWLEDGED", "PLAYER_FACT_LEARNED",
  ]);
  const data = state.history
    .filter((entry) => visibleTypes.has(entry.type)
      || (entry.type === "RUMOR_PUBLISHED" && state.player.knownRumorIds.has(entry.rumorId)))
    .slice(-30)
    .reverse();
  const label = (entry) => {
    if (entry.type === "PLAYER_ACTION_RESOLVED") return `行動「${entry.actionId}」を終えた。`;
    if (entry.type === "LOCAL_MOVE_COMPLETED") return `施設 ${entry.fromFacilityId} から ${entry.toFacilityId} へ移動した。`;
    if (entry.type === "REGIONAL_MOVE_COMPLETED") return `${entry.from} から ${entry.to} へ移動した。`;
    if (entry.type === "SHOP_BUY") return `装備 ${entry.equipmentId} を ${entry.price}Gで購入した。`;
    if (entry.type === "SHOP_SELL") return `装備 ${entry.equipmentId} を ${entry.price}Gで売却した。`;
    if (entry.type === "SKILL_LEARNED") return `スキル ${entry.skillId} を取得した。`;
    if (["RUMOR_PUBLISHED", "RUMOR_LEARNED_LOCAL"].includes(entry.type)) return `新しい噂 ${entry.rumorId} を知った。`;
    if (entry.type === "MISSION_COMPLETED") return `ミッション ${entry.missionId} を完了した。`;
    if (entry.type === "PLAYER_FACT_LEARNED") return entry.text;
    if (["TUTORIAL_DECISION", "TUTORIAL_ACKNOWLEDGED"].includes(entry.type)) return entry.text;
    return "自分が知る出来事に変化があった。";
  };
  return data.map((entry) => {
    const clock = journey.clockFromMinute(entry.minute ?? 0);
    return {
      type: entry.type,
      minute: entry.minute,
      day: clock.day,
      time: `Day ${clock.day} ${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
      text: label(entry),
    };
  });
}

function lockedSkillReason(reason) {
  const labels = {
    already_learned: "取得済み",
    insufficient_level: "レベル不足",
    insufficient_sp: "SP不足",
    missing_prerequisites: "前提スキル不足",
    event_unlock_conditions_unmet: "イベント条件未達",
    learn_conditions_unmet: "行動条件未達",
    not_visible: "未発見",
  };
  return labels[reason] ?? reason;
}

function skillView(runtime, data) {
  const state = runtime.playerState;
  const candidates = journey.listLearnablePlayerSkills(state, data.battleData, data.skills);
  const visibleCandidates = candidates.filter((candidate) => !candidate.reasons?.includes("not_visible"));
  const mainHand = data.battleData.equipmentById.get(state.player.equipment.mainHand);
  const offHand = data.battleData.equipmentById.get(state.player.equipment.offHand);
  const weaponCategory = {
    oneHandedSword: "片手剣",
    twoHandedSword: "両手剣",
    axe: "斧",
    spear: "槍",
    bow: "弓",
    staff: "杖",
    book: "本",
  }[mainHand?.weaponType] ?? null;
  const usableCategories = new Set(["汎用"]);
  if (weaponCategory) usableCategories.add(weaponCategory);
  if (offHand?.slot === "offHand" || /盾/u.test(`${offHand?.name ?? ""} ${offHand?.weaponType ?? ""}`)) usableCategories.add("盾");
  const learned = [...state.player.skills].sort().map((id) => {
    const skill = data.skillById.get(id);
    return { id, name: skill?.name ?? id, category: skill?.category ?? null };
  });
  const mapCandidate = (candidate) => {
    const skill = data.skillById.get(candidate.id);
    const category = skill?.category ?? null;
    const usableNow = [...usableCategories].some((entry) => String(category ?? "").includes(entry));
    return {
      ...candidate,
      category,
      description: skill?.description ?? skill?.effectSummary ?? "",
      reasonLabel: lockedSkillReason(candidate.reason),
      lockReason: lockedSkillReason(candidate.reason),
      usableNow,
      equipmentNote: usableNow
        ? `現在の${mainHand?.name ?? "装備"}で使える`
        : `${category ?? "別系統"}向け。対応装備へ持ち替えると使える`,
    };
  };
  const learnable = visibleCandidates.filter((candidate) => candidate.learnable).slice(0, 40).map(mapCandidate)
    .sort((left, right) => Number(right.usableNow) - Number(left.usableNow) || left.id.localeCompare(right.id));
  const recommended = learnable.find((candidate) => candidate.usableNow && candidate.category === weaponCategory)
    ?? learnable.find((candidate) => candidate.usableNow);
  if (recommended) {
    recommended.recommended = true;
    recommended.recommendationReason = `現在の武器「${mainHand?.name ?? "装備"}」ですぐ使える`;
    learnable.sort((left, right) => Number(Boolean(right.recommended)) - Number(Boolean(left.recommended))
      || Number(right.usableNow) - Number(left.usableNow)
      || left.id.localeCompare(right.id));
  }
  return {
    learned,
    learnable,
    locked: visibleCandidates
      .filter((candidate) => !candidate.learnable && !candidate.reasons?.includes("already_learned"))
      .slice(0, 80)
      .map(mapCandidate),
  };
}

function tutorialView(runtime, data) {
  if (runtime.playerState.absoluteMinute >= journey.GAME_END_MINUTE) return null;
  const tutorial = runtime.tutorial;
  if (!tutorial) return null;
  const base = {
    version: tutorial.version,
    complete: false,
    acknowledgeable: false,
    actionLabel: null,
    actionPanel: null,
    emphasisTarget: null,
    unlocked: {
      choices: true,
      movement: ["movement", "mission_intro", "movement_aftermath", "aftermath_intro", "free"].includes(tutorial.stage),
      missions: tutorial.stage === "free",
      shop: tutorial.stage === "free",
      skills: tutorial.stage === "free",
      battle: tutorial.stage === "free",
    },
  };
  if (tutorial.stage === "awakening") return {
    ...base,
    id: "first-choice",
    title: "まずは、今できることを一つ選ぶ",
    body: "中央の3つは、この場所で今すぐ行う行動です。選ぶと時間と世界が進みます。最初に正解や不正解はありません。気になるものを選んでください。",
    progressLabel: "導入 1 / 5",
    emphasisTarget: "choices",
  };
  if (tutorial.stage === "first_contact") return {
    ...base,
    id: "first-conversation",
    title: "返し方を選んで、会話を続ける",
    body: "会話も3択で進みます。誰に何を聞くかで、知る事実や相手の受け止め方が変わります。",
    progressLabel: "導入 2 / 5",
    emphasisTarget: "choices",
  };
  if (tutorial.stage === "orientation") return {
    ...base,
    id: "conversation-depth",
    title: "気になることを、もう一つだけ尋ねる",
    body: "一度話しただけで会話は終わりません。今知りたいことを選ぶと、その答えから次の行動が見えてきます。",
    progressLabel: "導入 3 / 5",
    emphasisTarget: "choices",
  };
  if (tutorial.stage === "movement") return {
    ...base,
    id: "first-movement",
    title: "3択とは別に、場所を移動できる",
    body: "3択は今いる場所での行動です。場所を変えたいときは、画面下の「移動」を使います。まずは村の広場へ向かってみましょう。",
    progressLabel: "導入 4 / 5",
    actionLabel: "移動先を見る",
    actionPanel: "movement",
    emphasisTarget: "movement",
  };
  if (tutorial.stage === "mission_intro") return {
    ...base,
    id: "discover-trouble",
    title: "会話から、起きている問題を知る",
    body: "広場にいる人は、それぞれ違う立場から同じ騒ぎを見ています。誰に聞くかを選び、何が起きているのか確かめてください。",
    progressLabel: "導入 5 / 5",
    emphasisTarget: "choices",
  };
  if (tutorial.stage === "movement_aftermath") return {
    ...base,
    id: "world-keeps-moving",
    title: "選ばなかった時間にも、世界は進む",
    body: "村の捜索は旅人を待たずに結末を迎えました。移動を開いて村の広場へ行き、起きたことを自分の目で確かめてください。",
    progressLabel: "導入 5 / 5",
    actionLabel: "移動先を見る",
    actionPanel: "movement",
    emphasisTarget: "movement",
  };
  if (tutorial.stage === "aftermath_intro") return {
    ...base,
    id: "trouble-aftermath",
    title: "間に合わなかった危機にも、結果が残る",
    body: "危機には期限があり、介入しなければ失敗や犠牲が起こります。広場で一人を選び、何が起きたのか聞いてください。",
    progressLabel: "導入 5 / 5",
    emphasisTarget: "choices",
  };

  const acknowledged = tutorial.acknowledged;
  const missions = missionView(runtime, data);
  const t01 = missions.find((mission) => mission.id === "MSN-T01" && ["active", "available", "in_progress"].includes(mission.status));
  if (t01 && !acknowledged.has("mission-log")) return {
    ...base,
    id: "mission-log",
    title: "ミッションは、自由な冒険の道しるべ",
    body: "問題を知るとミッションに記録されます。必ず従う必要はありませんが、次に調べる場所と期限をいつでも確認できます。",
    progressLabel: "旅の案内",
    actionLabel: "ミッションを確認",
    actionPanel: "missions",
    acknowledgeable: true,
    emphasisTarget: "missions",
  };
  const shopAvailable = data.battleData.inventory.some((entry) => entry.location === runtime.playerState.player.location
    && entry.sellerId === runtime.playerState.player.facilityId);
  if (shopAvailable && !acknowledged.has("shop")) return {
    ...base,
    id: "shop",
    title: "店では、3択を選ばずに売買できる",
    body: "店のある場所では、行動の3択とは別に品物を購入・売却できます。所持金が足りない品は、仕事や冒険の報酬を得てから戻れます。",
    progressLabel: "旅の案内",
    actionLabel: "店を見る",
    actionPanel: "shop",
    acknowledgeable: true,
    emphasisTarget: "shop",
  };
  const atFirstSearchArea = runtime.playerState.player.facilityId === "LOC_FARM_EDGE";
  if (atFirstSearchArea && runtime.playerState.player.skills.size === 0) return {
    ...base,
    id: "skills",
    title: acknowledged.has("skills") ? "戦う前に、使えるスキルを一つ取得する" : "危険へ進む前に、スキルを選ぶ",
    body: acknowledged.has("skills")
      ? "まだ戦闘スキルを取得していません。能力画面の「今の装備におすすめ」から一つ選ぶと、危険な選択肢が解放されます。"
      : "SPを1使うと、条件を満たしたスキルを取得できます。最初から全てを決める必要はありません。今の装備で使える技を一つ選ぶと、戦闘で詰まりにくくなります。",
    progressLabel: "戦闘準備",
    actionLabel: "取得可能スキルを見る",
    actionPanel: "skills",
    acknowledgeable: !acknowledged.has("skills"),
    emphasisTarget: "skills",
  };
  const battleAvailable = choiceActions(runtime, data).some((choice) => ["missionBattle", "seekBattle"].includes(choice.type));
  if (battleAvailable && runtime.playerState.metrics.battles === 0 && !acknowledged.has("combat")) return {
    ...base,
    id: "combat",
    title: "赤い「戦闘」表示は、危険を伴う行動",
    body: "戦闘を選ぶ前にHP・装備・スキルを確認できます。敗北しても旅は終わりませんが、回復の時間が進み、その間も世界の危機は進行します。",
    progressLabel: "戦闘準備",
    actionLabel: "能力を確認",
    actionPanel: "skills",
    acknowledgeable: true,
    emphasisTarget: "choices",
  };
  return { ...base, complete: true };
}

function guidanceView(runtime, data, missions) {
  if (runtime.playerState.absoluteMinute >= journey.GAME_END_MINUTE) return {
    kicker: "旅の終わり",
    title: "100日間の旅が完結した",
    detail: "選んだ行動、救えた人、間に合わなかった危機は、この世界の年代記に残っています。記録を振り返るか、タイトルから新しい旅を始められます。",
    targetFacilityId: null,
    targetFacilityName: null,
    deadlineLabel: null,
    actionPanel: "chronicle",
  };
  const stage = runtime.tutorial?.stage;
  const facilityName = (id) => data.model.facilityById[id]?.name ?? null;
  if (stage === "awakening") return {
    kicker: "最初の一歩",
    title: "目を覚まし、自分の状況を確かめる",
    detail: "中央の3つから、最初に気になった行動を一つ選ぶ。",
    targetFacilityId: null,
    targetFacilityName: null,
    deadlineLabel: null,
    actionPanel: null,
  };
  if (["first_contact", "orientation"].includes(stage)) return {
    kicker: "いま話していること",
    title: "麦畑で出会ったエダに応える",
    detail: "返答を選び、ここがどこなのかを少しずつ確かめる。",
    targetFacilityId: null,
    targetFacilityName: null,
    deadlineLabel: null,
    actionPanel: null,
  };
  if (stage === "movement") return {
    kicker: "次の一歩",
    title: "村の広場へ移動する",
    detail: "画面下の「移動」を開き、村の中の移動先から「村の広場」を選ぶ。",
    targetFacilityId: "LOC_FARM_SQUARE",
    targetFacilityName: facilityName("LOC_FARM_SQUARE"),
    deadlineLabel: null,
    actionPanel: "movement",
  };
  if (stage === "mission_intro") return {
    kicker: "広場で起きていること",
    title: "人だかりから事情を聞く",
    detail: "3人のうち、話を聞きたい相手を一人選ぶ。",
    targetFacilityId: "LOC_FARM_SQUARE",
    targetFacilityName: facilityName("LOC_FARM_SQUARE"),
    deadlineLabel: null,
    actionPanel: null,
  };
  if (stage === "movement_aftermath") return {
    kicker: "時間が残した結果",
    title: "村の広場で、終わった捜索を確かめる",
    detail: "移動を開き、村の広場へ向かう。世界は行動を選ばない間にも進んでいる。",
    targetFacilityId: "LOC_FARM_SQUARE",
    targetFacilityName: facilityName("LOC_FARM_SQUARE"),
    deadlineLabel: "捜索期限を超過",
    actionPanel: "movement",
  };
  if (stage === "aftermath_intro") return {
    kicker: "広場に残ったもの",
    title: "捜索がどう終わったのか聞く",
    detail: "3人のうち一人を選び、介入しなかった危機の結末を知る。",
    targetFacilityId: "LOC_FARM_SQUARE",
    targetFacilityName: facilityName("LOC_FARM_SQUARE"),
    deadlineLabel: "捜索失敗",
    actionPanel: null,
  };
  const mission = missions.find((entry) => entry.kind === "special" && ["active", "available", "in_progress"].includes(entry.status));
  if (mission) {
    const step = mission.currentStep;
    const targetFacilityId = step?.targetFacilityId ?? mission.targetFacilityId;
    return {
      kicker: "現在の目的",
      title: mission.title,
      detail: step?.label ?? "次の手掛かりを探す。",
      targetFacilityId: targetFacilityId ?? null,
      targetFacilityName: step?.targetFacilityName ?? mission.targetFacilityName ?? null,
      deadlineLabel: mission.deadlineLabel,
      actionPanel: targetFacilityId && targetFacilityId !== runtime.playerState.player.facilityId ? "movement" : "missions",
    };
  }
  return {
    kicker: "自由行動",
    title: "気になる場所と人を、自分の順番で訪ねる",
    detail: "3択で今いる場所を調べるか、移動で別の土地へ向かい、噂や困り事を見つける。",
    targetFacilityId: null,
    targetFacilityName: null,
    deadlineLabel: null,
    actionPanel: "movement",
  };
}

function fallbackNarrative(runtime, action = null, outcome = null) {
  const facility = runtime.playerState.player.facilityId;
  if (!action) {
    if (facility === "LOC_FARM_FIELD") return "頬に土の冷たさを感じて目を開く。見渡す限りの麦と、見覚えのない空。ここへ来た道筋は、記憶のどこにもない。";
    return `${runtime.playerState.player.location}で、新しい一日が動き始めている。`;
  }
  if (outcome?.battle) return outcome.battle.won
    ? "息を整えると、戦いの跡に静けさが戻った。得た傷と手掛かりは、次の判断へ引き継がれる。"
    : "戦いから辛うじて退いた。世界の時間は止まらず、立て直す猶予も失われていく。";
  const actionType = String(action.type ?? "").toUpperCase();
  if (actionType === "MOVE") return "移動を終えると、そこにいる人々と店の様子が入れ替わった。";
  if (actionType === "SHOP_BUY") return "品物を受け取り、代金と在庫が帳面に記された。";
  if (actionType === "SHOP_SELL") return "店主は品を確かめ、相応の代金を差し出した。";
  if (actionType === "LEARN_SKILL") return "積み重ねた経験が、使える技として形になった。";
  return "選んだ行動の結果が世界へ刻まれ、時計の針が先へ進んだ。";
}

function authoredOpeningPresentation(runtime) {
  const tutorial = runtime.tutorial;
  if (!tutorial) return null;
  const beat = tutorial.lastBeat;
  if (tutorial.stage === "awakening") {
    return {
      narrative: "頬に土の冷たさを感じて目を開く。頭上には見覚えのない青い空。風に揺れる麦の海の中で、自分だけが取り残されている。ここへ来た道筋は、記憶のどこにもない。",
      speeches: [],
    };
  }
  if (beat?.startsWith("awake:")) {
    const detail = {
      "awake:body": "手足は動く。大きな傷もない。それでも、身につけた物にも記憶にも、この場所へ来た理由は見つからない。",
      "awake:listen": "麦の擦れる音。その向こうに、鐘と荷車の軋みが混じる。人の暮らす場所は近いらしい。",
      "awake:ground": "倒れた麦は自分を中心に円く広がっていた。畑の土に、ここまで歩いて来た足跡はない。",
    }[beat];
    return {
      narrative: `${detail} やがて麦をかき分ける音が近づき、日に焼けた女性がこちらに気づいて息をのむ。`,
      speeches: [{ actorId: "NPC004", text: "……おや！　ちょっと、聞こえるかい？　こんな所で倒れて、どこか痛むんじゃないか？", emotion: "心配" }],
    };
  }
  if (beat?.startsWith("contact:")) {
    const response = {
      "contact:where": "ここは田園の村の麦畑だよ。王都へ続く畑道のそばさ。あたしはエダ。まず、あんたが立てるか見せておくれ。",
      "contact:memory": "見知らぬ世界から来た、か。妙な話だけど、今は笑うところじゃないね。あたしはエダ。水を飲んで、ゆっくり話せばいい。",
      "contact:who": "もっともだね。あたしはエダ、この村で畑をやってる。あんたを縛る気も、役人へ突き出す気もないよ。顔色が心配なだけさ。",
    }[beat];
    return {
      narrative: "乾いた喉から言葉を絞り出す。女性は急かさずに聞き、腰の水筒を差し出した。",
      speeches: [{ actorId: "NPC004", text: response, emotion: beat === "contact:who" ? "安心させる" : "穏やか" }],
    };
  }
  if (beat?.startsWith("orient:")) {
    const response = {
      "orient:voices": "朝から、村の方で誰かを捜す声がしてる。あたしも詳しいことは知らないんだ。広場へ行けば、何があったか聞けるはずだよ。",
      "orient:found": "麦の真ん中に、眠るみたいに倒れてた。周りに足跡はないし、荷物らしい荷物もない。あたしが見たのは、それだけさ。",
      "orient:help": "もちろん。麦穂亭に話を通して、一食と今夜の寝床はどうにかしよう。金のことは、体が落ち着いてから考えればいいさ。",
    }[beat];
    return {
      narrative: "水が喉を通り、ようやく周囲を見る余裕が戻る。麦畑の先には、小さな家並みと一本の道が見えた。",
      speeches: [
        { actorId: "NPC004", text: response, emotion: "説明" },
        { actorId: "NPC004", text: "村の広場は、この道の先だよ。行き先を変えたくなったら、自分の足でどこへ向かうか決められる。あたしも畑を片づけたら追いつくよ。", emotion: "促す" },
      ],
    };
  }
  if (beat === "movement:square") {
    return {
      narrative: "麦畑から村の道を抜け、広場へ着く。掲示板の前には人が集まり、普段の朝とは思えない張り詰めた空気が漂っていた。",
      speeches: [
        { actorId: "NPC004", text: "着いたね。……あの人だかり、どうもただ事じゃないよ。", emotion: "心配" },
        { actorId: "NPC002", text: "フィンを見た方はいませんか……！　朝から、どこにもいないんです。", emotion: "取り乱す" },
        { actorId: "NPC003", text: "街道側には捜す者を出した。だが、村外れから戻った者はまだおらん。", emotion: "緊張" },
      ],
    };
  }
  if (beat === "movement:aftermath") {
    return {
      narrative: "村の広場へ着く。人だかりはもうなく、泥のついた担架と、使われなかった松明だけが掲示板の下に残されている。捜索は、こちらが歩き出すより先に終わっていた。",
      speeches: [
        { actorId: "NPC004", text: "……遅かった。フィンは見つかったけど、助けて連れ帰ることはできなかったんだ。捜しに出た者にも、ひどい怪我人が出たよ。", emotion: "沈痛" },
        { actorId: "NPC003", text: "世界は待ってはくれん。何が起きたか知りたいなら、隠さず話そう。", emotion: "疲労" },
      ],
    };
  }
  if (beat === "deadline:aftermath") {
    return {
      narrative: "事情を聞いている間に、捜索の期限を告げる鐘が鳴った。やがて村外れから戻った担架を見て、間に合わなかったことを知る。選んだ行動の途中にも、世界の時間は進んでいた。",
      speeches: [
        { actorId: "NPC003", text: "……捜索隊が戻った。フィンは救えず、先へ出た者にも重傷者がいる。今から話すのは、もう捜索ではなく、その結末だ。", emotion: "沈痛" },
      ],
    };
  }
  if (tutorial.stage === "mission_intro") {
    return {
      narrative: "人々の言葉は断片的で、まだ全体が見えない。泣きそうな女性、捜索を指揮する村長、何かを隠すように俯く少年。それぞれが、違う手掛かりを持っていそうだ。",
      speeches: [],
    };
  }
  if (tutorial.stage === "aftermath_intro") {
    return {
      narrative: "広場に残る人々は、同じ失敗を違う痛みとして抱えている。誰の言葉を受け取るかは選べるが、起きた結末そのものは巻き戻らない。",
      speeches: [],
    };
  }
  if (beat?.startsWith("inquiry:")) {
    const presentation = {
      "inquiry:garo": {
        narrative: "ガロ村長は地面に簡単な地図を描き、捜索済みの道と、まだ誰も戻っていない村外れを指した。",
        speeches: [
          { actorId: "NPC003", text: "消えたのはフィン、十二歳の少年だ。朝から戻らん。古い見張り小屋へ続く道が手薄だが、あの辺りは獣も出る。日が二度落ちる前には見つけねばならん。", emotion: "厳しい" },
          { actorId: "NPC004", text: "あんたは来たばかりだ。無理に背負わなくていい。でも手を貸すなら、村のみんなが忘れないよ。", emotion: "気遣う" },
        ],
      },
      "inquiry:mira": {
        narrative: "女性はミラと名乗り、握りしめていた小さな布切れを見せる。声は震えているが、息子のことを一つずつ話そうとする。",
        speeches: [
          { actorId: "NPC002", text: "息子のフィンです。冒険家になりたいって、いつも村の外へ憧れていて……今朝、古い地図までなくなっていました。どうか、村外れの道を見てください。", emotion: "懇願" },
          { actorId: "NPC004", text: "ミラ、息をして。話してくれて助かったよ。見張り小屋の道なら、広場から村外れへ出られる。", emotion: "支える" },
        ],
      },
      "inquiry:coby": {
        narrative: "少年の前に屈んで待つ。責める声が来ないと分かるまで、コビーは何度も唇を噛んだ。やがて、小さな声がこぼれる。",
        speeches: [
          { actorId: "NPC062", text: "フィン、昨日……古い見張り小屋を見つけたら、本物の冒険家になれるって。ぼく、止めなかった。村外れの細い道を知ってるんだ。", emotion: "後悔" },
          { actorId: "NPC003", text: "重要な手掛かりだ。今話した勇気まで、誰も責めはせん。", emotion: "落ち着かせる" },
        ],
      },
    }[beat];
    return presentation;
  }
  if (beat?.startsWith("aftermath:")) {
    const presentation = {
      "aftermath:garo": {
        narrative: "ガロ村長は捜索記録を閉じ、見つかった時刻と、村外れで負傷した者の名を一つずつ説明した。",
        speeches: [{ actorId: "NPC003", text: "フィンを見つけた時には、もう息がなかった。助けようと先へ出た者も重傷だ。決断が遅れれば、危機はこうして人の命を奪う。", emotion: "悔恨" }],
      },
      "aftermath:mira": {
        narrative: "ミラの隣に座る。しばらく言葉はなく、握りしめた古い地図が震える音だけが聞こえた。",
        speeches: [{ actorId: "NPC002", text: "あの子は、帰ってきませんでした。……もし次に誰かの助けを求める声を聞いたら、どうか、間に合ううちに動いてください。", emotion: "悲嘆" }],
      },
      "aftermath:coby": {
        narrative: "コビーは村外れへ続く道を見つめたまま、途切れ途切れに昨日の約束を話した。",
        speeches: [{ actorId: "NPC062", text: "ぼく、見張り小屋へ行くって知ってた。もっと早く言えばよかった。時間が過ぎたら、言えなかったことまで消えないんだ。", emotion: "後悔" }],
      },
    }[beat];
    return presentation ?? { narrative: OPENING_AFTERMATH_FACT.text, speeches: [] };
  }
  if (tutorial.stage !== "free") {
    return { narrative: fallbackNarrative(runtime), speeches: [] };
  }
  return null;
}

function deterministicFallbackPresentation(runtime, data, action, outcome) {
  const resolved = action?.resolvedAction ?? action;
  const fallback = fallbackNarrative(runtime, resolved, outcome);
  if (outcome?.reason === "travel_defeat" || (resolved?.type === "move" && outcome?.battle?.won === false)) {
    const currentFacility = data.model.facilityById[runtime.playerState.player.facilityId]?.name
      ?? runtime.playerState.player.location;
    return {
      narrative: `道中で敵に行く手を阻まれ、傷を負って${currentFacility}まで退いた。目的地には着いていない。立て直す間にも、世界の時間は進んでいる。`,
      speeches: [],
    };
  }
  if (resolved?.type === "move") {
    const facilityId = resolved.destinationFacilityId ?? runtime.playerState.player.facilityId;
    const facilityName = data.model.facilityById[facilityId]?.name ?? runtime.playerState.player.location;
    const narrative = {
      LOC_FARM_FIELD: "家並みを離れると、風に鳴る麦の海が再び視界を満たす。畑の道には、さっきまでなかった足跡も刻まれている。",
      LOC_FARM_SQUARE: "村の広場へ入る。掲示板の前を人が行き交い、耳を澄ませば今この土地で起きていることが断片的に聞こえてくる。",
      LOC_FARM_EDGE: "家並みが途切れ、草に埋もれた道が古い見張り小屋の方角へ伸びている。獣の気配に備えながら進む場所だ。",
    }[facilityId] ?? `${facilityName}へ着いた。人の流れと周囲の様子を確かめ、ここで次に何をするか選べる。`;
    return { narrative, speeches: [] };
  }
  if (resolved?.type !== "conversation" || !resolved.targetNpcId) {
    return { narrative: fallback, speeches: [] };
  }
  const npc = presentNpcsAt(runtime, data).find((entry) => entry.id === resolved.targetNpcId);
  if (!npc) return { narrative: fallback, speeches: [] };
  const line = {
    local_concern: "この辺りにも、表からは見えない困り事がある。人の集まる場所で声を聞けば、今何が必要か見えてくるはずだよ。",
    local_rumor: "噂は人から人へ届くから、聞いた時には少し古いこともある。確かなことから順に話そう。",
    end_conversation: "ああ、気をつけて。また何か聞きたくなったら声をかけて。",
  }[resolved.dialogueTopic] ?? "何を知りたい？　話せる範囲なら、順に答えよう。";
  return {
    narrative: `${npc.name}はこちらへ向き直り、急かさずに言葉を待った。`,
    speeches: [{ actorId: npc.id, text: line, emotion: "応答" }],
  };
}

function timeText(state) {
  return `${String(state.hour).padStart(2, "0")}:${String(state.minute).padStart(2, "0")}`;
}

function backgroundKey(state) {
  return state.player.facilityId || `HUB:${state.player.location}`;
}

function presentationChoices(record, choices) {
  const labels = record.presentation?.revision === record.revision ? record.presentation.choiceLabels ?? {} : {};
  return choices.map((action) => ({
    choiceId: action.choiceId,
    actionId: action.id,
    label: cleanText(labels[action.choiceId] ?? action.label, 180),
    minutes: Number(action.minutes ?? 0),
    type: action.type,
    intentType: choiceIntent(action),
    targetNpcId: action.targetNpcId ?? null,
    missionId: action.missionId ?? null,
    stepId: action.stepId ?? null,
    danger: ["missionBattle", "seekBattle"].includes(action.type),
  }));
}

export function buildGameView(record, runtime, data) {
  const state = runtime.playerState;
  const presentNpcs = presentNpcsAt(runtime, data);
  const choices = presentationChoices(record, choiceActions(runtime, data));
  const missions = missionView(runtime, data);
  const tutorial = tutorialView(runtime, data);
  const guidance = guidanceView(runtime, data, missions);
  const movement = movementActions(runtime, data).map((action) => ({
    moveId: action.id,
    label: action.label,
    minutes: action.minutes,
    scope: action.movementScope,
    destination: action.destinationHub,
    destinationFacilityId: action.destinationFacilityId,
    destinationFacilityName: data.model.facilityById[action.destinationFacilityId]?.name ?? null,
    recommended: Boolean(guidance?.targetFacilityId && action.destinationFacilityId === guidance.targetFacilityId),
  }));
  const stock = availableStockAt(state, data.battleData, state.shop).map((entry) => ({
    stockId: entry.id,
    equipmentId: entry.equipmentId,
    name: entry.name,
    price: entry.price,
    quantity: Number.isFinite(entry.quantity) ? entry.quantity : null,
    unlimited: !Number.isFinite(entry.quantity),
    sellerId: entry.sellerId,
    seller: entry.seller,
    legality: entry.legality,
    equipment: (() => {
      const equipment = data.battleData.equipmentById.get(entry.equipmentId);
      return equipment ? {
        slot: equipment.slot,
        weaponType: equipment.weaponType,
        physicalPower: equipment.physicalPower,
        magicPower: equipment.magicPower,
        defense: equipment.defense,
        magicResistance: equipment.magicResistance,
        performanceIndex: equipment.performanceIndex,
      } : null;
    })(),
    slot: data.battleData.equipmentById.get(entry.equipmentId)?.slot ?? null,
  }));
  const equippedSlots = Object.entries(state.player.equipment).map(([slot, id]) => ({ slot, id }));
  const inventoryEquipment = Object.entries(state.player.inventory.equipment)
    .filter(([, quantity]) => Number(quantity) > 0)
    .map(([id, quantity]) => equipmentView(data, id, Number(quantity), equippedSlots))
    .sort((left, right) => left.name.localeCompare(right.name, "ja"));
  const saleQuotes = inventoryEquipment.map((entry) => {
    const quote = quoteEquipmentSale(state, data.battleData, entry.id);
    return {
      equipmentId: entry.id,
      price: Number.isFinite(quote.price) ? quote.price : null,
      available: quote.ok,
      reason: quote.ok ? null : quote.reason,
    };
  });
  const facility = data.model.facilityById[state.player.facilityId];
  return {
    id: record.id,
    schemaVersion: record.schemaVersion,
    contentRevision: record.contentRevision,
    revision: record.revision,
    stateHash: record.stateHash,
    saveStatus: "saved",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    clock: {
      day: state.day,
      time: timeText(state),
      hour: state.hour,
      minute: state.minute,
      daypart: state.daypart,
      absoluteMinute: state.absoluteMinute,
    },
    scene: {
      location: state.player.location,
      facilityId: state.player.facilityId,
      facilityName: facility?.name ?? state.player.facilityId,
      facilityType: facility?.type ?? null,
      backgroundKey: backgroundKey(state),
      narrative: record.presentation?.narrative ?? fallbackNarrative(runtime),
      speeches: record.presentation?.speeches ?? [],
      presentNpcs,
      lastOutcome: record.lastOutcome ?? null,
    },
    choices,
    movement,
    tutorial,
    guidance,
    shop: {
      available: data.battleData.inventory.some((entry) => entry.location === state.player.location && entry.sellerId === state.player.facilityId),
      facilityName: facility?.name ?? null,
      stock,
      saleQuotes,
    },
    player: {
      name: record.playerName,
      level: state.player.level,
      exp: state.player.exp,
      nextLevelExp: experienceToNextLevel(state.player.level),
      sp: state.player.sp,
      gold: state.player.gold,
      hpRatio: state.player.hpRatio,
      mpRatio: state.player.mpRatio,
      stats: { ...state.player.stats },
      equipment: Object.fromEntries(equippedSlots.map(({ slot, id }) => [slot, equipmentView(data, id, state.player.inventory.equipment[id] ?? 0, equippedSlots)])),
      inventory: {
        items: { ...state.player.inventory.items },
        equipment: inventoryEquipment,
      },
      reputation: { ...state.player.reputation },
    },
    skills: skillView(runtime, data),
    missions,
    rumors: rumorView(runtime),
    chronicle: chronicleView(runtime),
    world: {
      dayLimit: 100,
      ended: state.absoluteMinute >= journey.GAME_END_MINUTE,
      endedAt: state.absoluteMinute >= journey.GAME_END_MINUTE ? "Day 100 24:00" : null,
      knownResolvedTroubleIds: [...state.progress.missions.resolvedTroubleIds].sort(),
    },
  };
}

export function availableGameRuntimeActions(runtime, data) {
  if (runtime.playerState.absoluteMinute >= journey.GAME_END_MINUTE) {
    return { choices: [], movement: [], stock: [], learnableSkills: [] };
  }
  return {
    choices: choiceActions(runtime, data),
    movement: movementActions(runtime, data),
    stock: availableStockAt(runtime.playerState, data.battleData, runtime.playerState.shop),
    learnableSkills: journey.listLearnablePlayerSkills(runtime.playerState, data.battleData, data.skills)
      .filter((candidate) => candidate.learnable),
  };
}

function narrativeInput(record, runtime, data, action, outcome) {
  const presentNpcs = presentNpcsAt(runtime, data);
  const choices = choiceActions(runtime, data);
  const facility = data.model.facilityById[runtime.playerState.player.facilityId];
  const missions = missionView(runtime, data).filter((mission) => mission.status === "active");
  const rumors = rumorView(runtime);
  const resolvedAction = action?.resolvedAction ?? action;
  const authoritativeOutcome = replayOutcome(outcome) ?? { type: "start", ok: true };
  return {
    locale: "ja-JP",
    playerName: record.playerName,
    action: {
      id: resolvedAction?.id ?? action?.resolvedActionId ?? action?.type ?? "GAME_START",
      type: resolvedAction?.type ?? action?.type ?? "start",
      label: resolvedAction?.label ?? "物語を始める",
      targetNpcId: resolvedAction?.targetNpcId ?? null,
      targetNpcName: resolvedAction?.targetNpcName ?? null,
      dialogueTopic: resolvedAction?.dialogueTopic ?? null,
    },
    authoritativeOutcome,
    authoritativeState: {
      day: runtime.playerState.day,
      hour: runtime.playerState.hour,
      minute: runtime.playerState.minute,
      daypart: runtime.playerState.daypart,
      location: runtime.playerState.player.location,
      locationId: runtime.playerState.player.location,
      facilityId: runtime.playerState.player.facilityId,
      facilityName: facility?.name ?? null,
      presentNpcIds: presentNpcs.map((npc) => npc.id),
      npcs: presentNpcs,
      player: {
        displayName: record.playerName,
        visibleCondition: "行動可能",
        knownFacts: [...openingKnownFactTexts(runtime), ...rumors.map((rumor) => rumor.text)],
      },
      missions,
      visibleMissionIds: missions.map((mission) => mission.id),
      localRumors: rumors,
      visibleRumorIds: rumors.map((rumor) => rumor.id),
      authoritativeOutcome,
      allowedActionCandidates: choices.map((choice) => ({
        id: choice.choiceId,
        actionCandidateId: choice.id,
        label: choice.label,
        intentType: choiceIntent(choice),
        targetNpcId: choice.targetNpcId ?? null,
      })),
    },
  };
}

async function updatePresentation(record, runtime, data, narrator, action = null, outcome = null) {
  const fallback = fallbackNarrative(runtime, action, outcome);
  if (action?.type === "TUTORIAL_ACK" && record.presentation) {
    record.presentation = { ...record.presentation, revision: record.revision, choiceLabels: {} };
    return;
  }
  const authored = authoredOpeningPresentation(runtime);
  if (authored) {
    const presentIds = new Set(presentNpcsAt(runtime, data).map((npc) => npc.id));
    record.presentation = {
      revision: record.revision,
      source: "authored_tutorial",
      narrative: authored.narrative,
      speeches: authored.speeches.filter((speech) => presentIds.has(speech.actorId)),
      choiceLabels: {},
    };
    return;
  }
  const deterministic = deterministicFallbackPresentation(runtime, data, action, outcome);
  const resolvedAction = action?.resolvedAction ?? action;
  if (resolvedAction?.type === "move") {
    record.presentation = { revision: record.revision, source: "deterministic_movement", ...deterministic, choiceLabels: {} };
    return;
  }
  if (!narrator) {
    record.presentation = { revision: record.revision, source: "deterministic_fallback", ...deterministic, choiceLabels: {} };
    return;
  }
  try {
    const input = narrativeInput(record, runtime, data, action, outcome);
    const presentIds = new Set(input.authoritativeState.presentNpcIds);
    const result = await narrator.generate(input, {
      policyVersion: "trpg-gameplay-v1",
      allowedMissionTemplateIds: ["local-rescue", "local-investigation", "local-delivery", "local-escort", "local-negotiation"],
      allowedTroubleIds: input.authoritativeState.missions.map((mission) => mission.troubleId).filter(Boolean),
      validateNpcIntentCandidate(proposal) {
        return Boolean(proposal.targetNpcId && proposal.intent && presentIds.has(proposal.targetNpcId));
      },
    });
    const legalChoiceIds = new Set(input.authoritativeState.allowedActionCandidates.map((choice) => choice.id));
    const choiceLabels = Object.fromEntries((result.choices ?? [])
      .filter((choice) => legalChoiceIds.has(choice.id))
      .map((choice) => [choice.id, cleanText(choice.label, 180)]));
    const allowedSpeechIds = resolvedAction?.type === "conversation" && resolvedAction.targetNpcId
      ? new Set([resolvedAction.targetNpcId])
      : new Set();
    const speeches = (result.speeches ?? [])
      .filter((speech) => presentIds.has(speech.actorId) && allowedSpeechIds.has(speech.actorId))
      .map((speech) => ({ actorId: speech.actorId, text: cleanText(speech.text, 300), emotion: cleanText(speech.emotion, 40) || null }));
    record.presentation = {
      revision: record.revision,
      source: result.meta?.source ?? "unknown",
      narrative: cleanText(result.narrative, 1500) || fallback,
      speeches,
      choiceLabels,
      cacheKey: result.meta?.cacheKey ?? null,
    };
  } catch (error) {
    console.error("TRPG gameplay narrative failed; deterministic presentation retained", error);
    record.presentation = { revision: record.revision, source: "deterministic_fallback", ...deterministic, choiceLabels: {} };
  }
}

function summaryRecord(record) {
  return {
    id: record.id,
    playerName: record.playerName,
    revision: record.revision,
    stateHash: record.stateHash,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    clock: record.summary.clock,
    location: record.summary.location,
    level: record.summary.level,
  };
}

function updateRecordSnapshot(record, runtime, data) {
  compactPlayableRuntime(runtime);
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = gameStateHash(runtime, data);
  record.summary = {
    clock: { day: runtime.playerState.day, time: timeText(runtime.playerState) },
    location: runtime.playerState.player.location,
    facilityId: runtime.playerState.player.facilityId,
    level: runtime.playerState.player.level,
  };
}

export class TrpgGameService {
  constructor({
    data = loadTrpgGameData(),
    store = new FileTrpgSaveStore(),
    narrator = null,
    allowCustomSeed = false,
    maxSavesPerOwner = process.env.TRPG_GAME_MAX_SAVES_PER_OWNER,
    maxTotalSaves = process.env.TRPG_GAME_MAX_TOTAL_SAVES,
    saveRetentionDays = process.env.TRPG_GAME_SAVE_RETENTION_DAYS,
  } = {}) {
    this.data = data;
    this.store = store;
    this.narrator = narrator;
    this.allowCustomSeed = allowCustomSeed;
    this.maxSavesPerOwner = boundedPositiveInteger(maxSavesPerOwner, DEFAULT_MAX_SAVES_PER_OWNER, 20);
    this.maxTotalSaves = boundedPositiveInteger(maxTotalSaves, DEFAULT_MAX_TOTAL_SAVES, 2_000);
    this.saveRetentionMs = boundedPositiveInteger(saveRetentionDays, DEFAULT_SAVE_RETENTION_DAYS, 365) * 86_400_000;
    this.locks = new Map();
  }

  health() {
    return {
      ok: true,
      schemaVersion: TRPG_GAME_SCHEMA_VERSION,
      resolverVersion: TRPG_GAME_RESOLVER_VERSION,
      contentRevision: this.data.contentRevision,
      counts: this.data.counts,
      persistence: this.store.constructor.name,
      narrative: this.narrator ? "gemini_or_replay_cache_with_fallback" : "deterministic_fallback",
      authority: "server-command-resolver",
      tutorialVersion: TUTORIAL_VERSION,
      playableProfilePolicy: "neutral-fixed-player-directed-growth",
      savePolicy: {
        maximumPerOwner: this.maxSavesPerOwner,
        maximumTotal: this.maxTotalSaves,
        retentionDays: Math.round(this.saveRetentionMs / 86_400_000),
        fullCapacityPolicy: "reject-and-preserve-existing-saves",
      },
    };
  }

  currentRecord(record, now = Date.now()) {
    const updatedAt = Date.parse(record?.updatedAt ?? "");
    return record?.schemaVersion === TRPG_GAME_SCHEMA_VERSION
      && record?.resolverVersion === TRPG_GAME_RESOLVER_VERSION
      && record?.contentRevision === this.data.contentRevision
      && record?.tutorialVersion === TUTORIAL_VERSION
      && Number.isFinite(updatedAt)
      && now - updatedAt <= this.saveRetentionMs;
  }

  withinRetention(record, now = Date.now()) {
    const updatedAt = Date.parse(record?.updatedAt ?? "");
    return Number.isFinite(updatedAt) && now - updatedAt <= this.saveRetentionMs;
  }

  async pruneObsoleteSaves(now = Date.now()) {
    const records = await this.store.all();
    const current = [];
    for (const record of records) {
      if (this.currentRecord(record, now)) current.push(record);
      else await this.store.delete(record.id);
    }
    return current;
  }

  async create(ownerHash, input = {}) {
    return this.runLocked("global-create", async () => {
      const currentRecords = await this.pruneObsoleteSaves();
      const ownerRecords = currentRecords.filter((record) => record.ownerHash === ownerHash);
      if (ownerRecords.length >= this.maxSavesPerOwner) throw new TrpgGameError(429, "owner_save_quota_reached");
      if (currentRecords.length >= this.maxTotalSaves) {
        throw new TrpgGameError(503, "global_save_capacity_reached");
      }
      const playerName = cleanText(input.playerName || "旅人", 24) || "旅人";
      const profileId = PLAYABLE_PROFILE_ID;
      const seed = this.allowCustomSeed && input.seed ? cleanText(input.seed, 120) : crypto.randomUUID();
      const runtime = createGameRuntime(this.data, { seed, profileId, playerName, tutorial: true });
      const now = new Date().toISOString();
      const record = {
        id: saveId(),
        schemaVersion: TRPG_GAME_SCHEMA_VERSION,
        resolverVersion: TRPG_GAME_RESOLVER_VERSION,
        contentRevision: this.data.contentRevision,
        ownerHash,
        playerName,
        profileId,
        tutorialVersion: TUTORIAL_VERSION,
        seed,
        revision: 0,
        createdAt: now,
        updatedAt: now,
        commandLog: [],
        presentation: null,
        lastOutcome: null,
        runtimeSnapshot: null,
        stateHash: null,
        summary: null,
      };
      updateRecordSnapshot(record, runtime, this.data);
      await updatePresentation(record, runtime, this.data, this.narrator);
      await this.store.put(record);
      return buildGameView(record, runtime, this.data);
    });
  }

  async list(ownerHash) {
    return (await this.store.listByOwner(ownerHash)).filter((record) => this.currentRecord(record)).map(summaryRecord);
  }

  async delete(ownerHash, id) {
    return this.runLocked(id, async () => {
      const record = await this.store.get(id);
      if (!record || record.ownerHash !== ownerHash) throw new TrpgGameError(404, "save_not_found");
      await this.store.delete(id);
      return { id };
    });
  }

  async recordForOwner(ownerHash, id) {
    const record = await this.store.get(id);
    if (!record || record.ownerHash !== ownerHash) throw new TrpgGameError(404, "save_not_found");
    if (!this.withinRetention(record)) {
      await this.store.delete(id);
      throw new TrpgGameError(404, "save_expired");
    }
    if (record.schemaVersion !== TRPG_GAME_SCHEMA_VERSION
      || record.contentRevision !== this.data.contentRevision
      || record.resolverVersion !== TRPG_GAME_RESOLVER_VERSION
      || record.tutorialVersion !== TUTORIAL_VERSION) {
      throw new TrpgGameError(409, "save_content_version_mismatch", "This save is pinned to a different content revision", {
        saveSchemaVersion: record.schemaVersion,
        currentSchemaVersion: TRPG_GAME_SCHEMA_VERSION,
        saveContentRevision: record.contentRevision,
        currentContentRevision: this.data.contentRevision,
        saveResolverVersion: record.resolverVersion,
        currentResolverVersion: TRPG_GAME_RESOLVER_VERSION,
        saveTutorialVersion: record.tutorialVersion,
        currentTutorialVersion: TUTORIAL_VERSION,
      });
    }
    return record;
  }

  async get(ownerHash, id) {
    const record = await this.recordForOwner(ownerHash, id);
    const runtime = hydrateRuntime(record, this.data);
    const actualHash = gameStateHash(runtime, this.data);
    if (actualHash !== record.stateHash) throw new TrpgGameError(409, "save_state_hash_mismatch");
    return buildGameView(record, runtime, this.data);
  }

  async runLocked(key, operation) {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    this.locks.set(key, queued);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(key) === queued) this.locks.delete(key);
    }
  }

  async command(ownerHash, id, input = {}) {
    return this.runLocked(id, async () => {
      const commandId = cleanText(input.commandId, 100);
      if (!commandId) throw new TrpgGameError(400, "command_id_required");
      const record = await this.recordForOwner(ownerHash, id);
      const duplicate = record.commandLog.find((entry) => entry.commandId === commandId);
      if (duplicate) {
        const requestedType = cleanText(input.type, 40);
        const requestedPayload = commandPayload(requestedType, input.payload);
        if (duplicate.type !== requestedType || JSON.stringify(duplicate.payload) !== JSON.stringify(requestedPayload)) {
          throw new TrpgGameError(409, "command_id_conflict", "The command id was already used for a different command");
        }
        const save = await this.get(ownerHash, id);
        return { duplicate: true, originalRevision: duplicate.revisionAfter, save };
      }
      if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== record.revision) {
        throw new TrpgGameError(409, "revision_conflict", "The save changed before this command was applied", { currentRevision: record.revision });
      }
      if (record.commandLog.length >= MAX_COMMANDS) throw new TrpgGameError(409, "command_limit_reached");
      const runtime = hydrateRuntime(record, this.data);
      const beforeHash = gameStateHash(runtime, this.data);
      const command = {
        commandId,
        type: cleanText(input.type, 40),
        payload: commandPayload(cleanText(input.type, 40), input.payload),
      };
      const result = executeGameRuntimeCommand(runtime, this.data, command);
      record.revision += 1;
      record.updatedAt = new Date().toISOString();
      record.lastOutcome = result.outcome;
      updateRecordSnapshot(record, runtime, this.data);
      const journalEntry = {
        seq: record.commandLog.length + 1,
        commandId,
        revisionBefore: input.expectedRevision,
        revisionAfter: record.revision,
        stateBeforeHash: beforeHash,
        stateAfterHash: record.stateHash,
        type: command.type,
        payload: command.payload,
        resolvedActionId: result.resolvedActionId,
        outcome: replayOutcome(result.outcome),
      };
      record.commandLog.push(journalEntry);
      await updatePresentation(record, runtime, this.data, this.narrator, { ...command, ...result }, result.outcome);
      await this.store.put(record);
      return { duplicate: false, save: buildGameView(record, runtime, this.data) };
    });
  }

  async verifyReplay(ownerHash, id) {
    const record = await this.recordForOwner(ownerHash, id);
    let runtime = createGameRuntime(this.data, {
      seed: record.seed,
      profileId: record.profileId,
      playerName: record.playerName,
      tutorial: record.tutorialVersion === TUTORIAL_VERSION,
    });
    compactPlayableRuntime(runtime);
    let revision = 0;
    const checks = [];
    for (const entry of record.commandLog) {
      const expectedSeq = revision + 1;
      const beforeHash = gameStateHash(runtime, this.data);
      const result = executeGameRuntimeCommand(runtime, this.data, entry);
      revision = expectedSeq;
      compactPlayableRuntime(runtime);
      const afterHash = gameStateHash(runtime, this.data);
      checks.push({
        seq: entry.seq,
        sequenceMatches: entry.seq === expectedSeq,
        revisionMatches: entry.revisionBefore === expectedSeq - 1 && entry.revisionAfter === expectedSeq,
        beforeMatches: beforeHash === entry.stateBeforeHash,
        actionMatches: result.resolvedActionId === entry.resolvedActionId,
        outcomeMatches: canonicalJson(replayOutcome(result.outcome)) === canonicalJson(replayOutcome(entry.outcome)),
        afterMatches: afterHash === entry.stateAfterHash,
      });
      if (!checks.at(-1).sequenceMatches
        || !checks.at(-1).revisionMatches
        || !checks.at(-1).beforeMatches
        || !checks.at(-1).actionMatches
        || !checks.at(-1).outcomeMatches
        || !checks.at(-1).afterMatches) break;
      // Production commands cross a persisted snapshot boundary. Rehydrate on
      // replay too so no mutable derived catalog can affect later commands.
      runtime = deserializeRuntime(serializeRuntime(runtime), this.data);
      applyGameplayCatalogOverrides(runtime.playerState.catalog);
      syncAuthoritativePresentNpcIds(runtime, this.data);
    }
    return {
      ok: checks.every((entry) => entry.sequenceMatches
        && entry.revisionMatches
        && entry.beforeMatches
        && entry.actionMatches
        && entry.outcomeMatches
        && entry.afterMatches)
        && revision === record.revision
        && gameStateHash(runtime, this.data) === record.stateHash,
      revision,
      stateHash: gameStateHash(runtime, this.data),
      checks,
    };
  }
}

export function hashResumeToken(token) {
  return sha256(`trpg-resume-token-v1\n${token}`);
}
