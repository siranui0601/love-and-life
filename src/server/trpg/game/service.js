import crypto from "node:crypto";
import * as journey from "../../../../tools/trpg-sim/lib/player-journey.mjs";
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from "../../../../tools/trpg-sim/lib/battle-simulator.mjs";
import {
  availableStockAt,
  buyEquipment,
  quoteEquipmentSale,
  sellEquipment,
} from "../../../../tools/trpg-sim/lib/shop-runtime.mjs";
import { experienceToNextLevel } from "../../../../tools/trpg-sim/lib/mission-model.mjs";
import { ensurePlayerNeeds, publicPlayerNeeds } from "../../../../tools/trpg-sim/lib/player-needs.mjs";
import {
  EQUIPMENT_ACCESS_VERSION,
  activeEquipmentLoans,
  borrowMissionEquipment,
  buyUsedEquipment,
  claimEquipmentReward,
  createMissionEquipmentRewardOffer,
  ensureEquipmentAccessState,
  equipmentAvailableToPlayer,
  listEquipmentAccessOffers,
  pendingEquipmentRewards,
  previewEquipmentTrial,
  reconcileEquipmentLoans,
  returnEquipmentLoan,
} from "../../../../tools/trpg-sim/lib/equipment-access.mjs";
import {
  completeNpcLifeTick,
  createNpcLifeEngine,
  prepareNpcLifeTick,
} from "../../../../tools/trpg-sim/lib/npc-life-engine.mjs";
import { loadTrpgGameData } from "./game-data.js";
import { deserializeRuntime, serializeRuntime } from "./serializer.js";
import { FileTrpgSaveStore } from "./save-store.js";
import { presentNpcsAt, syncAuthoritativePresentNpcIds } from "./presence.js";
import { facilityVisibility } from "../resolvers/facility-visibility-resolver.js";
import { resolveCanonicalWeather, WEATHER_RULESET_VERSION } from "../resolvers/weather-resolver.js";
import { selectDiverseChoices } from "../content/choice-contract.js";
import { resolveAuthoredScene } from "../content/authored-scene-registry.js";
import {
  WORK_MARKET_VERSION,
  deterministicWorkWage,
  ensureWorkMarket,
  pendingWorkOfferAvailability,
  publicWorkMarket,
  recordCompletedWork,
  workAvailability,
  workOfferId,
} from "../resolvers/work-market-resolver.js";

export const TRPG_GAME_SCHEMA_VERSION = "1.3.0-alpha";
export const TRPG_GAME_RESOLVER_VERSION = "trpg-player-world-v15";
const MIGRATABLE_RESOLVER_VERSIONS = new Set(["trpg-player-world-v8", "trpg-player-world-v9", "trpg-player-world-v10", "trpg-player-world-v11", "trpg-player-world-v12", "trpg-player-world-v13", "trpg-player-world-v14"]);

const PLAYABLE_PROFILE_ID = "balanced";
const TUTORIAL_VERSION = "trpg-progressive-onboarding-v6";

const PUBLIC_FACILITY_COPY = Object.freeze({
  LOC_FARM_FIELD: { type: "農地", description: "風に揺れる麦畑。畑仕事の様子と、村へ続く道を確かめられる。" },
  LOC_FARM_SQUARE: { type: "広場", description: "村人が行き交い、掲示や日々の知らせが集まる田園の村の広場。" },
  LOC_FARM_WELL: { type: "水場", description: "村人が水を汲みに訪れ、暮らしの変化が表れやすい共同井戸。" },
  LOC_FARM_EDGE: { type: "村外れ", description: "家並みが途切れ、草に埋もれた道が村の外へ続いている。" },
});

const PUBLIC_TROUBLE_RUMOR_COPY = Object.freeze({
  T01: "村の少年が戻らず、捜索が続いている",
  T02: "共同穀倉の火の気と食料の扱いに不安が出ている",
  T03: "村と森の境で狼による被害が増えている",
  T04: "古代神殿へ向かった巡礼者と連絡が取れない",
  T05: "交易都市の領主の周辺で不穏な動きがある",
  T06: "交易都市の港で働く人々の不満が高まっている",
  T07: "故郷を離れたエルフを狙う危険な人の動きがある",
  T08: "森へ入る道の通行が厳しく制限されている",
  T09: "ドワーフ洞窟で崩落が起きている",
  T10: "王都の孤児院が立ち退きを迫られている",
  T11: "王都の要人を狙う不穏な動きがある",
  T12: "北陵要塞の周辺で正体の分からない襲撃が起きている",
  T13: "森を流れる川の水量と魔力に異変がある",
  T14: "犯罪都市から武器が不正に運ばれている",
  T15: "交易都市へ外国の船団が近づいている",
  T16: "王都で亜人への敵意と衝突が広がっている",
  T17: "王都と古代神殿で大きな召喚儀式の準備が進んでいる",
  T18: "古代神殿の地下で大型機械の封印が揺らいでいる",
  T19: "黒嶺連合領と森の境で軍の動きが強まっている",
});

const PUBLIC_BELIEF_DETAIL_COPY = Object.freeze({
  捜索: "村の少年を捜す動きが続いている",
  食料: "食料の減り方に気になる動きがある",
  川水量: "川の水量が普段と違う",
  穀倉放火: "共同穀倉で火の気を疑う話がある",
  狼被害: "村と森の境で狼による被害が出ている",
});

const HIDDEN_NPC_ROLE_PATTERN = /犯人|黒幕|放火犯|暗殺|密偵|間者|内通|裏切|偽装|首謀|共犯|工作員/u;

const FARM_SQUARE_DISCOVERIES = Object.freeze([
  "LOC_FARM_FIELD",
  "LOC_FARM_SQUARE",
  "LOC_FARM_INN",
  "LOC_FARM_BAKERY",
  "LOC_FARM_WELL",
]);

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
  text: "捜索は間に合わず、フィンは帰らなかった。村外れへ向かった者にも重傷者が出た。",
});

const PROFILE_BY_ID = new Map(journey.PLAYER_PROFILES.map((profile) => [profile.id, profile]));
const COMMAND_TYPES = new Set(["CHOOSE", "TALK", "MOVE", "SHOP_BUY", "SHOP_SELL", "SHOP_TRY", "SHOP_BUY_USED", "SHOP_BORROW", "SHOP_RETURN_LOAN", "CLAIM_EQUIPMENT_REWARD", "EQUIP", "UNEQUIP", "LEARN_SKILL", "TUTORIAL_ACK", "ACK_NPC_INTRODUCTION", "BATTLE_ACT"]);
const COMMAND_PAYLOAD_KEY = Object.freeze({
  CHOOSE: "choiceId",
  TALK: "npcId",
  MOVE: "moveId",
  SHOP_BUY: "stockId",
  SHOP_SELL: "equipmentId",
  SHOP_TRY: "stockId",
  SHOP_BUY_USED: "offerId",
  SHOP_BORROW: "loanId",
  SHOP_RETURN_LOAN: "loanId",
  CLAIM_EQUIPMENT_REWARD: "rewardId",
  EQUIP: "equipmentId",
  UNEQUIP: "slot",
  LEARN_SKILL: "skillId",
  TUTORIAL_ACK: "tutorialId",
  ACK_NPC_INTRODUCTION: "token",
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
  if (type === "CHOOSE") {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    return {
      choiceId: cleanText(source.choiceId, 120),
      actionId: cleanText(source.actionId, 120),
    };
  }
  if (type === "BATTLE_ACT") {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    return {
      battleId: cleanText(source.battleId, 120),
      actionId: cleanText(source.actionId, 120),
      targetInstanceId: cleanText(source.targetInstanceId, 120),
    };
  }
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
    mealPrice: 4,
    restPrice: 4,
  };
}

export function applyGameplayCatalogOverrides(catalog) {
  const t01 = catalog.special.find((mission) => mission.id === "MSN-T01");
  if (!t01) return catalog;
  if (!t01.steps.some((step) => step.id === "escort")) {
    const decideIndex = t01.steps.findIndex((step) => step.id === "decide");
    const escortStep = {
      id: "escort",
      type: "conversation",
      targetLocation: "田園の村",
      targetFacilityId: "LOC_FARM_EDGE",
      required: 1,
      label: "負傷したフィンに声をかけ、村の広場まで同行する",
    };
    if (decideIndex >= 0) t01.steps.splice(decideIndex, 0, escortStep);
    else t01.steps.push(escortStep);
  }
  for (const step of t01.steps) {
    if (step.id === "hear") step.targetFacilityId = "LOC_FARM_SQUARE";
    if (["search", "rescue", "escort"].includes(step.id)) step.targetFacilityId = "LOC_FARM_EDGE";
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

function createPlayerKnowledge() {
  return {
    knownNpcIds: new Set(),
    knownFacilityIds: new Set(["LOC_FARM_FIELD"]),
    knownHubIds: new Set(["田園の村"]),
  };
}

function createNarrativeMemory() {
  return {
    localFacts: [],
    npcMemories: [],
    missionLeads: [],
    recentWorkTitles: [],
    activityFocus: null,
    semanticFlags: {},
  };
}

function ensureNarrativeMemory(runtime) {
  runtime.narrativeMemory ??= createNarrativeMemory();
  runtime.narrativeMemory.localFacts ??= [];
  runtime.narrativeMemory.npcMemories ??= [];
  runtime.narrativeMemory.missionLeads ??= [];
  runtime.narrativeMemory.recentWorkTitles ??= [];
  runtime.narrativeMemory.activityFocus ??= null;
  runtime.narrativeMemory.semanticFlags ??= {};
  return runtime.narrativeMemory;
}

function cloneNarrativeMemory(runtime) {
  return JSON.parse(JSON.stringify(ensureNarrativeMemory(runtime)));
}

function ensurePlayerKnowledge(runtime) {
  runtime.playerKnowledge ??= createPlayerKnowledge();
  runtime.playerKnowledge.knownNpcIds ??= new Set();
  runtime.playerKnowledge.knownFacilityIds ??= new Set([runtime.playerState.player.facilityId].filter(Boolean));
  runtime.playerKnowledge.knownHubIds ??= new Set([runtime.playerState.player.location].filter(Boolean));
  return runtime.playerKnowledge;
}

function discoverNpc(runtime, npcId) {
  if (npcId) ensurePlayerKnowledge(runtime).knownNpcIds.add(npcId);
}

function discoverFacility(runtime, facilityId) {
  if (facilityId) ensurePlayerKnowledge(runtime).knownFacilityIds.add(facilityId);
}

function discoverArrival(runtime, data) {
  const knowledge = ensurePlayerKnowledge(runtime);
  const hubId = runtime.playerState.player.location;
  const facilityId = runtime.playerState.player.facilityId;
  if (hubId) knowledge.knownHubIds.add(hubId);
  if (facilityId) knowledge.knownFacilityIds.add(facilityId);
  if (facilityId === "LOC_FARM_SQUARE") {
    FARM_SQUARE_DISCOVERIES.forEach((id) => knowledge.knownFacilityIds.add(id));
    return;
  }
  // Entering a new town through its public arrival point exposes its signed,
  // ordinary facilities. Secret/event-only locations remain mission-gated.
  if (runtime.playerState.progress.travel.visitedHubs.has(hubId) && hubId !== "田園の村") {
    for (const facility of data.model.facilitiesByHub[hubId] ?? []) {
      if (!/隠|秘密|地下|処刑|牢|祭壇|封印|見張り小屋|裏路地/u.test(`${facility.name} ${facility.type}`)) {
        knowledge.knownFacilityIds.add(facility.id);
      }
    }
  }
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
      { id: "TUTORIAL:INQUIRY:MIRA", type: "conversation", tutorialBeat: "inquiry:mira", targetNpcId: "NPC002", targetNpcName: "ミラ", missionId: "MSN-T01", stepId: "hear", minutes: 12, label: "泣きそうな女性に、捜している子のことを聞く" },
      { id: "TUTORIAL:DEFER:WORK", type: "conversation", tutorialBeat: "defer:work", workOffer: true, targetNpcId: "NPC004", targetNpcName: "エダ", minutes: 6, label: "今は捜索を保留し、エダに仕事と賃金を尋ねる" },
      { id: "TUTORIAL:DEFER:LEAVE", type: "plan", tutorialBeat: "defer:leave", minutes: 2, label: "捜索には関わらず、王都へ続く道を確かめる" },
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
        "捜索記録を持つ年配の村人に、何が起きたのか聞く",
        "掲示板に残された捜索記録を読む",
      ),
      aftermathAction(
        "TUTORIAL:AFTERMATH:MIRA",
        "aftermath:mira",
        "NPC002",
        "ミラ",
        10,
        "古い地図を握る女性のそばに座り、語り始めるまで待つ",
        "広場に残る捜索隊の荷物を確かめる",
      ),
      aftermathAction(
        "TUTORIAL:AFTERMATH:COBY",
        "aftermath:coby",
        "NPC062",
        "コビー",
        9,
        "広場の端で俯く少年に、何があったのか静かに尋ねる",
        "村外れから戻った足跡と傷ついた装備を見る",
      ),
    ]);
  }
  return null;
}

function dialogueFollowupActions(runtime) {
  const session = runtime.dialogueSession;
  if (!session || runtime.tutorial?.stage && runtime.tutorial.stage !== "free") return null;
  if (runtime.playerState.absoluteMinute
    - Number(session.lastInteractionAtMinute ?? session.openedAtMinute ?? -Infinity) > 30) return null;
  if (session.facilityId !== runtime.playerState.player.facilityId || session.location !== runtime.playerState.player.location) return null;
  const presentIds = runtime.playerState.authoritativePresentNpcIds;
  if (!(presentIds instanceof Set) || !presentIds.has(session.npcId)) return null;
  const state = runtime.playerState;
  const definitions = [...state.catalog.special, ...state.catalog.permanent];
  const activeMission = definitions.find((definition) => ["active", "available", "in_progress"].includes(state.missions[definition.id]?.status)
    && (definition.kind !== "special" || state.rumors.some((rumor) => rumor.troubleId === definition.troubleId && state.player.knownRumorIds.has(rumor.id))));
  const activeRuntime = activeMission ? state.missions[activeMission.id] : null;
  const activeStep = activeMission?.steps?.find((step) => Number(activeRuntime?.progress?.[step.id] ?? 0) < Number(step.required ?? 1));
  const facility = runtime.livingWorld.model?.facilityById?.[state.player.facilityId];
  const asked = session.askedTopics instanceof Set ? session.askedTopics : new Set(session.askedTopics ?? []);
  const topics = [
    activeMission ? {
      id: "active_mission",
      label: `「${activeMission.title}」について、${activeStep?.label ?? "次にすべきこと"}を詳しく聞く`,
      minutes: 9,
    } : null,
    activeStep?.targetFacilityId ? {
      id: "route_to_lead",
      label: `${activeStep.targetFacilityId === state.player.facilityId ? "この場所" : "手掛かりのある場所"}へ向かう道と危険を聞く`,
      minutes: 7,
    } : null,
    {
      id: "local_concern",
      label: `${facility?.name ?? "この辺り"}で、今いちばん困っていることを聞く`,
      minutes: 8,
    },
    {
      id: "local_change",
      label: `${facility?.name ?? "この場所"}で、普段と違う人や物を見なかったか尋ねる`,
      minutes: 8,
    },
    {
      id: "personal_stake",
      label: `${session.npcName}がこの問題を気にかける理由を尋ねる`,
      minutes: 7,
    },
    session.lastDisclosedRumorId && state.player.knownRumorIds.has(session.lastDisclosedRumorId) ? {
      id: "local_rumor",
      label: "今聞いた話を、いつ、どこで知ったのか確かめる",
      minutes: 8,
    } : null,
    state.player.gold < 20 ? {
      id: "work_offer",
      label: `自分に手伝える仕事がないか、具体的に相談する`,
      minutes: 6,
    } : null,
  ].filter(Boolean).filter((topic) => !asked.has(topic.id));
  const offset = Number(session.turnCount ?? 0) % Math.max(1, topics.length);
  const rotated = topics.length ? [...topics.slice(offset), ...topics.slice(0, offset)] : [];
  const questions = rotated.slice(0, 2).map((topic) => ({
    id: `DIALOGUE:${session.npcId}:${Number(session.turnCount ?? 0) + 1}:${topic.id}`,
    type: "conversation",
    dialogueFollowup: true,
    dialogueTopic: topic.id,
    targetNpcId: session.npcId,
    targetNpcName: session.npcName,
    minutes: topic.minutes,
    label: topic.label,
  }));
  while (questions.length < 2) {
    const id = `clarify_${questions.length + 1}`;
    questions.push({
      id: `DIALOGUE:${session.npcId}:${Number(session.turnCount ?? 0) + 1}:${id}`,
      type: "conversation",
      dialogueFollowup: true,
      dialogueTopic: id,
      targetNpcId: session.npcId,
      targetNpcName: session.npcName,
      minutes: 6,
      label: questions.length ? "今の話で、まだ曖昧な点を一つ確かめる" : "その話を、最初から順に説明してもらう",
    });
  }
  return withChoiceIds([...questions, {
    id: `DIALOGUE:${session.npcId}:${Number(session.turnCount ?? 0) + 1}:END`,
    type: "conversation",
    dialogueFollowup: true,
    dialogueTopic: "end_conversation",
    targetNpcId: session.npcId,
    targetNpcName: session.npcName,
    minutes: 2,
    label: `${session.npcName}に礼を言い、次の行動へ移る`,
  }]);
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

function ensureT01EscortState(runtime) {
  return runtime.t01Escort ??= {
    found: false,
    active: false,
    arrivedSquare: false,
    reunited: false,
    foundAtMinute: null,
    acceptedAtMinute: null,
    reunionBeatAtMinute: null,
    abandonedAtMinute: null,
  };
}

function playerCompanionIds(runtime) {
  const player = runtime.playerState.player;
  if (!(player.companionNpcIds instanceof Set)) {
    player.companionNpcIds = new Set(player.companionNpcIds ?? []);
  }
  return player.companionNpcIds;
}

function revealFinnAfterRescueBattle(runtime, action, result) {
  if (action?.missionId !== "MSN-T01" || action?.stepId !== "rescue" || result?.battle?.won !== true) return false;
  const escort = ensureT01EscortState(runtime);
  if (escort.found) return false;
  const finn = runtime.livingWorld.npcStates.NPC001;
  if (!finn || finn.lifeStatus === "dead") return false;
  escort.found = true;
  escort.foundAtMinute = runtime.playerState.absoluteMinute;
  finn.presence = "present";
  finn.lifeStatus = "injured";
  finn.health = Math.max(38, Number(finn.health ?? 38));
  finn.status = "負傷・救助待ち";
  finn.location = "田園の村";
  finn.position = { hubId: "田園の村", facilityId: "LOC_FARM_EDGE" };
  finn.currentGoal = "ask-player-for-escort";
  finn.travel = null;
  finn.localTravel = null;
  discoverNpc(runtime, "NPC001");
  runtime.playerState.history.push({
    type: "T01_FINN_FOUND_ALIVE",
    minute: runtime.playerState.absoluteMinute,
    npcId: "NPC001",
    facilityId: "LOC_FARM_EDGE",
  });
  return true;
}

function activateFinnEscort(runtime, action, result) {
  if (action?.missionId !== "MSN-T01" || action?.stepId !== "escort" || result?.ok !== true) return false;
  const escort = ensureT01EscortState(runtime);
  if (!escort.found) return false;
  escort.active = true;
  escort.acceptedAtMinute = runtime.playerState.absoluteMinute;
  playerCompanionIds(runtime).add("NPC001");
  const finn = runtime.livingWorld.npcStates.NPC001;
  if (finn) {
    finn.currentGoal = "return-to-village-with-player";
    finn.status = "負傷・同行中";
  }
  result.summary = "フィンに肩を貸し、村の広場まで一緒に戻ることになった。";
  return true;
}

function followFinnDuringMovement(runtime, action, result) {
  const escort = ensureT01EscortState(runtime);
  if (!escort.active || result?.ok !== true || action?.type !== "move") return false;
  const finn = runtime.livingWorld.npcStates.NPC001;
  if (!finn) return false;
  if (action.movementScope === "regional") {
    escort.active = false;
    escort.abandonedAtMinute = runtime.playerState.absoluteMinute;
    playerCompanionIds(runtime).delete("NPC001");
    finn.status = "負傷・村外れで待機";
    finn.currentGoal = "wait-for-help-at-outskirts";
    runtime.playerState.history.push({
      type: "T01_ESCORT_ABANDONED",
      minute: runtime.playerState.absoluteMinute,
      destinationHub: action.destinationHub ?? null,
    });
    return false;
  }
  const facilityId = action.destinationFacilityId ?? runtime.playerState.player.facilityId;
  finn.location = runtime.playerState.player.location;
  finn.position = { hubId: runtime.playerState.player.location, facilityId };
  finn.presence = "present";
  finn.travel = null;
  finn.localTravel = null;
  escort.arrivedSquare = facilityId === "LOC_FARM_SQUARE";
  if (escort.arrivedSquare) {
    placeOpeningCrisisCast(runtime.livingWorld, runtime.playerState.absoluteMinute);
    finn.location = "田園の村";
    finn.position = { hubId: "田園の村", facilityId: "LOC_FARM_SQUARE" };
    finn.presence = "present";
    finn.status = "負傷・広場へ帰還";
    finn.currentGoal = "reunite-with-family";
    escort.reunited = true;
    escort.reunionBeatAtMinute = runtime.playerState.absoluteMinute;
    runtime.playerState.history.push({
      type: "T01_FINN_ESCORTED_TO_SQUARE",
      minute: runtime.playerState.absoluteMinute,
      npcId: "NPC001",
    });
  }
  return escort.arrivedSquare;
}

function clearFinnEscortOnFailure(runtime) {
  const status = runtime.playerState.troubles.T01?.status;
  if (!["failed", "suppressed"].includes(status)) return;
  const escort = ensureT01EscortState(runtime);
  escort.active = false;
  playerCompanionIds(runtime).delete("NPC001");
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
    finn.status = "救出・家族と再会";
    finn.location = "田園の村";
    finn.position = { hubId: "田園の村", facilityId: "LOC_FARM_SQUARE" };
    finn.currentGoal = "recover-after-rescue";
    const escort = ensureT01EscortState(runtime);
    escort.found = true;
    escort.active = false;
    escort.arrivedSquare = true;
    escort.reunited = true;
    playerCompanionIds(runtime).delete("NPC001");
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
  ensurePlayerNeeds(playerState.player);
  ensureEquipmentAccessState(playerState);
  playerState.weather = canonicalWeatherForState(playerState);
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
    playerKnowledge: createPlayerKnowledge(),
    pendingBattle: null,
    pendingNpcIntroduction: null,
    pendingWorkOffer: null,
    workMarket: null,
    tutorial: tutorial ? createTutorialState() : null,
    dialogueSession: null,
    narrativeChoiceSelection: null,
    narrativeMemory: createNarrativeMemory(),
  };
  ensureWorkMarket(runtime);
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
  ensurePlayerKnowledge(runtime);
  runtime.pendingBattle ??= null;
  runtime.pendingNpcIntroduction ??= null;
  runtime.narrativeChoiceSelection ??= null;
  ensureNarrativeMemory(runtime);
  ensureWorkMarket(runtime);
  syncAuthoritativePresentNpcIds(runtime, data);
  return runtime;
}

export function gameStateHash(runtime, data, resolverVersion = TRPG_GAME_RESOLVER_VERSION) {
  return sha256(`${data.contentRevision}\n${resolverVersion}\n${serializeRuntime(runtime)}`);
}

function choiceIntent(action) {
  if (action.type === "conversation") return action.targetNpcId ? "talk" : "investigate";
  if (action.type === "eat") return "prepare";
  if (action.type === "investigate") return "investigate";
  if (["missionBattle", "seekBattle"].includes(action.type)) return "prepare";
  if (action.type === "resolveMission") return "help";
  if (action.type === "rest") return "wait";
  if (action.type === "wait") return "wait";
  if (action.type === "localInvestigate") return "investigate";
  if (action.type === "plan") return "prepare";
  if (action.type === "work") return "help";
  return "observe";
}

const REGION_MEAL_PRICE = Object.freeze({
  "田園の村": 4,
  "王都": 8,
  "交易都市": 7,
  "犯罪都市": 9,
  "辺境の村": 6,
  "北陵要塞": 7,
  "ドワーフ洞窟": 8,
  "エルフの隠れ里": 6,
  "古代神殿": 8,
  "魔王領": 12,
});

const REGION_LODGING_PRICE = Object.freeze({
  "田園の村": 12,
  "王都": 28,
  "交易都市": 24,
  "犯罪都市": 22,
  "辺境の村": 16,
  "北陵要塞": 18,
  "ドワーフ洞窟": 20,
  "エルフの隠れ里": 18,
  "古代神殿": 20,
  "魔王領": 35,
});

function facilityOffersMeals(facility) {
  return /宿|飯|食堂|酒場|茶屋|パン|市場|料理|厨房/u.test(String(facility?.name ?? "") + " " + String(facility?.type ?? ""));
}

function facilityOffersLodging(facility) {
  return /宿|旅籠|宿泊/u.test(String(facility?.name ?? "") + " " + String(facility?.type ?? ""));
}

function canonicalWeatherForState(state) {
  return resolveCanonicalWeather({ day: state.day, regionId: state.player.location, daypart: state.daypart });
}

function workDescription(facilityId) {
  return {
    LOC_FARM_FIELD: "刈った麦を束ねて荷車まで運ぶ",
    LOC_FARM_SQUARE: "届いた穀袋を共同倉庫の軒下まで運ぶ",
    LOC_FARM_INN: "麦穂亭で皿洗いと薪運びを手伝う",
    LOC_FARM_BAKERY: "粉袋と窯の薪を運ぶ",
    LOC_FARM_WELL: "井戸から必要な家へ水桶を届ける",
  }[facilityId] ?? "荷運びと片づけを手伝う";
}

const BLOCKED_WORK_GIVER_NPC_IDS = new Set(["NPC001", "NPC062"]);
const PREFERRED_WORK_GIVER_BY_FACILITY = Object.freeze({
  LOC_FARM_FIELD: "NPC004",
  LOC_FARM_SQUARE: "NPC003",
});

function eligibleWorkGiver(runtime, npc) {
  if (!npc || BLOCKED_WORK_GIVER_NPC_IDS.has(npc.id)) return false;
  const state = runtime.livingWorld.npcStates?.[npc.id];
  if (!state || state.presence !== "present") return false;
  if (["injured", "missing", "dead"].includes(String(state.lifeStatus ?? ""))) return false;
  return true;
}

function workGiverAt(runtime, data, facilityId, preferredNpcId = null, options = {}) {
  const facility = data.model.facilityById[facilityId] ?? {};
  const present = presentNpcsAt(runtime, data).filter((npc) => eligibleWorkGiver(runtime, npc));
  const preferredIds = [preferredNpcId, PREFERRED_WORK_GIVER_BY_FACILITY[facilityId]].filter(Boolean);
  const ordered = [
    ...preferredIds.map((npcId) => present.find((npc) => npc.id === npcId)).filter(Boolean),
    ...present.filter((npc) => !preferredIds.includes(npc.id)),
  ];
  return ordered.find((npc) => workAvailability(runtime, {
    facility,
    facilityId,
    employerId: npc.id,
    durationMinutes: Number(options.durationMinutes ?? 120),
    startOffsetMinutes: Number(options.startOffsetMinutes ?? 0),
  }).available) ?? null;
}

function decorateWorkOfferAction(action, runtime, data, preferredNpcId = null) {
  if (!action?.workOffer && action?.type !== "work") return action;
  const facilityId = runtime.playerState.player.facilityId;
  const facility = data.model.facilityById[facilityId] ?? {};
  const durationMinutes = Math.max(30, Math.min(480, Number(action.workDurationMinutes ?? 120) || 120));
  const riskClass = ["low", "medium", "high"].includes(action.workRiskClass) ? action.workRiskClass : "low";
  const offerConversationMinutes = Math.min(10, Number(action.minutes ?? 6));
  const actor = workGiverAt(runtime, data, facilityId, preferredNpcId ?? action.targetNpcId, {
    durationMinutes,
    startOffsetMinutes: offerConversationMinutes,
  });
  if (!actor) return null;
  const job = cleanText(action.workDescription ?? workDescription(facilityId), 120);
  const availability = workAvailability(runtime, {
    facility,
    facilityId,
    employerId: actor.id,
    durationMinutes,
    startOffsetMinutes: offerConversationMinutes,
  });
  if (!availability.available) return null;
  const specification = { facilityId, employerId: actor.id, title: job, durationMinutes, riskClass };
  const wage = deterministicWorkWage(runtime, specification);
  return {
    ...action,
    id: action.id === "WORK" ? `WORK_OFFER:${facilityId}:${actor.id}` : action.id,
    type: "conversation",
    workOffer: true,
    workOfferId: workOfferId(runtime, specification),
    quotedWage: wage,
    workDescription: job,
    workDurationMinutes: durationMinutes,
    workRiskClass: riskClass,
    targetNpcId: actor.id,
    targetNpcName: actor.name,
    dialogueTopic: "work_offer",
    requiredDisclosure: `仕事は「${job}」、所要時間は${durationMinutes}分、報酬は${wage}G`,
    minutes: offerConversationMinutes,
  };
}

function pendingWorkOfferActions(runtime, data) {
  const offer = runtime.pendingWorkOffer;
  if (!offer) return null;
  if (offer.facilityId !== runtime.playerState.player.facilityId) {
    runtime.pendingWorkOffer = null;
    return null;
  }
  const presentIds = runtime.playerState.authoritativePresentNpcIds;
  if (!(presentIds instanceof Set) || !presentIds.has(offer.actorNpcId)) {
    runtime.pendingWorkOffer = null;
    return null;
  }
  const facility = data.model.facilityById[offer.facilityId] ?? {};
  offer.day ??= runtime.playerState.day;
  offer.riskClass ??= "low";
  offer.offerId ??= workOfferId(runtime, {
    facilityId: offer.facilityId,
    employerId: offer.actorNpcId,
    title: offer.description,
    durationMinutes: offer.minutes,
    riskClass: offer.riskClass,
  });
  const availability = pendingWorkOfferAvailability(runtime, facility);
  if (!availability.available) {
    runtime.pendingWorkOffer = null;
    return null;
  }
  return withChoiceIds([
    {
      id: `WORK_CONFIRM:${offer.offerId}`,
      type: "work",
      wage: offer.wage,
      minutes: offer.minutes,
      sceneActorNpcId: offer.actorNpcId,
      workOfferId: offer.offerId,
      workFacilityId: offer.facilityId,
      workEmployerId: offer.actorNpcId,
      workDescription: offer.description,
      workRiskClass: offer.riskClass,
      workStartedAtMinute: runtime.playerState.absoluteMinute,
      label: `引き受ける：${offer.description}（${offer.minutes}分・${offer.wage}G）`,
    },
    {
      id: `WORK_CLARIFY:${offer.offerId}`,
      type: "conversation",
      dialogueFollowup: true,
      dialogueTopic: "work_offer",
      targetNpcId: offer.actorNpcId,
      targetNpcName: offer.actorName,
      requiredDisclosure: `仕事は「${offer.description}」、所要時間は${offer.minutes}分、報酬は${offer.wage}G`,
      minutes: 3,
      label: "作業の手順と、終わりの目安をもう一度確かめる",
    },
    {
      id: `WORK_DECLINE:${offer.offerId}`,
      type: "plan",
      workDecline: true,
      minutes: 1,
      label: "今回は断り、別の行動を選ぶ",
    },
  ]);
}

function contextualLocalAction(action, runtime, data) {
  const facility = data.model.facilityById[runtime.playerState.player.facilityId];
  const facilityId = facility?.id ?? "UNKNOWN";
  const publicNpc = presentNpcsAt(runtime, data)[0] ?? null;
  const workGiver = workGiverAt(runtime, data, facilityId, null, { durationMinutes: 120, startOffsetMinutes: 6 });
  if (action.type === "conversation" && action.targetNpcId) {
    const target = presentNpcsAt(runtime, data).find((npc) => npc.id === action.targetNpcId);
    return target ? {
      ...action,
      targetNpcName: target.name,
      label: action.missionId ? action.label : `${target.name}に話しかける`,
    } : action;
  }
  if (action.type === "work") {
    if (facilityId === "LOC_FARM_EDGE" || !workGiver) return null;
    const label = {
      LOC_FARM_FIELD: "エダに、畑仕事を手伝えるか尋ねる",
      LOC_FARM_SQUARE: "荷運びを頼める人に、仕事内容と賃金を聞く",
      LOC_FARM_INN: "麦穂亭で、皿洗いの仕事内容と賃金を聞く",
      LOC_FARM_BAKERY: "パン屋で、薪運びの仕事内容と賃金を聞く",
      LOC_FARM_WELL: "水桶運びの仕事内容と賃金を聞く",
    }[facilityId] ?? `${facility?.name ?? runtime.playerState.player.location}で、仕事の内容と賃金を尋ねる`;
    return decorateWorkOfferAction({ ...action, id: `WORK:${facilityId}`, label, workOffer: true }, runtime, data, workGiver.id);
  }
  if (action.type === "eat") {
    if (!facilityOffersMeals(facility)) return null;
    const price = runtime.playerState.player.freeMeals > 0
      ? 0
      : Number(REGION_MEAL_PRICE[runtime.playerState.player.location] ?? 6);
    if (price > runtime.playerState.player.gold) return null;
    return {
      ...action,
      id: "EAT:" + facilityId + ":" + price,
      type: "eat",
      minutes: Math.max(20, Number(action.minutes ?? 30)),
      price,
      nutrition: 58,
      mealQuality: facilityId === "LOC_FARM_INN" ? "hearty" : "standard",
      label: price > 0
        ? String(facility?.name ?? "この場所") + "で食事を取る（" + price + "G）"
        : String(facility?.name ?? "この場所") + "で用意された食事を取る",
    };
  }
  if (action.type === "rest") {
    const lodgingAvailable = facilityOffersLodging(facility);
    const lodgingPrice = runtime.playerState.player.freeLodging > 0
      ? 0
      : Number(REGION_LODGING_PRICE[runtime.playerState.player.location] ?? 20);
    const canAffordLodging = lodgingAvailable
      && (runtime.playerState.player.freeLodging > 0 || lodgingPrice <= runtime.playerState.player.gold);
    const needs = publicPlayerNeeds(runtime.playerState.player);
    const lodging = canAffordLodging && (runtime.playerState.hour >= 18 || needs.fatigue >= 70 || Number(action.minutes ?? 0) >= 420);
    const price = lodging ? lodgingPrice : 0;
    const tags = new Set(runtime.playerState.weather?.tags ?? []);
    const severeWeather = tags.has("storm") || tags.has("snow");
    return {
      ...action,
      id: lodging ? "LODGE:" + facilityId + ":" + price : "REST_OUTDOOR:" + facilityId,
      type: "rest",
      lodging,
      price,
      safety: lodging ? "good" : severeWeather ? "poor" : "normal",
      minutes: lodging ? Math.max(420, Number(action.minutes ?? 480)) : Math.min(180, Number(action.minutes ?? 120)),
      label: lodging
        ? price > 0
          ? String(facility?.name ?? "宿") + "に泊まる（" + price + "G）"
          : String(facility?.name ?? "宿") + "で今夜は休む"
        : severeWeather
          ? "風雨を避けられる場所を探し、短く休息する"
          : "安全そうな場所を探し、短く休息する",
    };
  }
  if (action.type === "wait" || (action.type === "observe" && String(action.id).startsWith("WAIT-"))) {
    const escort = facilityId === "LOC_FARM_EDGE" ? ensureT01EscortState(runtime) : null;
    const label = facilityId === "LOC_FARM_EDGE"
      ? escort?.found
        ? "フィンの呼吸と狼の動きを確かめながら、動く機会を待つ"
        : "風が止むのを待ち、斜面の下の物音に耳を澄ます"
      : publicNpc
        ? `${publicNpc.name}の様子を見ながら、話せる機会を待つ`
        : `${facility?.name ?? "この場所"}で、人の出入りが変わるまで待つ`;
    return { ...action, id: `WAIT:${facilityId}:${action.id}`, type: "wait", label, sceneActorNpcId: publicNpc?.id ?? null };
  }
  if (action.type === "observe" && facilityId === "LOC_FARM_EDGE") {
    const escort = ensureT01EscortState(runtime);
    return {
      ...action,
      id: escort.found ? "PLAN:LEAVE_FINN" : "PLAN:LEAVE_T01_SEARCH",
      type: "plan",
      minutes: 10,
      leaveSearch: true,
      label: escort.found
        ? "負傷したフィンをここに残し、別の目的地へ向かう"
        : "捜索をいったん打ち切り、村へ戻るか別の土地へ向かう",
    };
  }
  if (action.type === "observe") {
    const localVariant = runtime.playerState.history.filter((entry) => entry.type === "PLAYER_ACTION_RESOLVED"
      && String(entry.actionId ?? "").startsWith(`INSPECT:${facilityId}:`)).length % 3;
    const labels = {
      LOC_FARM_FIELD: [
        "倒れた麦と、土に残る不自然な跡を調べる",
        "畑の縁を歩き、出入りした足跡を見分ける",
        "麦の傷み方から、何が上を通ったのか考える",
      ],
      LOC_FARM_SQUARE: [
        "掲示板の新しい紙と、剥がされた跡を調べる",
        "荷車の行き先を見比べ、品物の流れを追う",
        "立ち話に耳を澄まし、同じ話の食い違いを探す",
      ],
      LOC_FARM_INN: [
        "客席の泥と置き忘れから、旅人の動きを探る",
        "宿帳の公開欄を見て、昨夜の出入りを確かめる",
        "食堂で繰り返される噂の、最初の話し手を探す",
      ],
      LOC_FARM_BAKERY: [
        "棚の品数と値札から、食料事情を確かめる",
        "粉袋の減り方と納品札を見比べる",
        "保存パンを買った人と、その行き先を尋ねる",
      ],
      LOC_FARM_WELL: [
        "井戸縄の擦れと水位を、手で確かめる",
        "汲み上げた水の色と、桶に残る沈殿を比べる",
        "水汲みの列を見て、普段より増えた家を探す",
      ],
      LOC_FARM_GRANARY: [
        "穀袋の積み方と床の痕跡を調べる",
        "帳簿の入庫数と、実際の袋の数を照合する",
        "扉と灯りの油に、誰かが触れた跡を探す",
      ],
      LOC_FARM_EDGE: [
        "道に残る足跡と、折れた草の向きを追う",
        "獣の爪痕と小さな靴跡が重なる地点を探す",
        "見張り小屋へ続く道で、落とし物を探す",
      ],
    }[facilityId] ?? [
      `${facility?.name ?? "現在地"}で、目につく変化を一つずつ調べる`,
      `${facility?.name ?? "現在地"}を使う人と物の流れを追う`,
      `${facility?.name ?? "現在地"}で、普段と違う痕跡を探す`,
    ];
    return {
      ...action,
      id: `INSPECT:${facilityId}:${localVariant + 1}`,
      type: "localInvestigate",
      label: labels[localVariant],
      localVariant,
      sceneActorNpcId: publicNpc?.id ?? null,
    };
  }
  return action;
}

function authoritativeMissionConversationAction(action, runtime, data) {
  if (action.type !== "conversation" || !action.missionId) return action;
  const definition = [...runtime.playerState.catalog.special, ...runtime.playerState.catalog.permanent]
    .find((entry) => entry.id === action.missionId);
  if (!definition?.troubleId) return null;
  if (definition.id === "MSN-T01" && action.stepId === "escort") {
    const escort = ensureT01EscortState(runtime);
    const finn = runtime.livingWorld.npcStates.NPC001;
    if (!escort.found || !finn || finn.presence !== "present" || finn.position?.facilityId !== runtime.playerState.player.facilityId) return null;
    return {
      ...action,
      targetNpcId: "NPC001",
      targetNpcName: "フィン",
      dialogueTopic: "t01_escort",
      requiredDisclosure: null,
      label: "斜面の下へ降り、負傷したフィンに声をかける",
    };
  }
  const candidates = [];
  for (const publicView of presentNpcsAt(runtime, data).sort((left, right) => left.id.localeCompare(right.id))) {
    const npc = data.model.npcById?.[publicView.id]
      ?? data.model.npcs.find((entry) => entry.id === publicView.id);
    const npcState = runtime.livingWorld.npcStates[publicView.id];
    if (!npcState || !npcCanDiscloseBeliefs(npc)) continue;
    for (const belief of Object.values(npcState.beliefs ?? {})) {
      if (!belief?.factId
        || belief.secret === true
        || !["fact", "trouble"].includes(belief.kind ?? "fact")
        || Number(belief.importance ?? 0) < 0.2
        || beliefTroubleId(belief) !== definition.troubleId
        || !beliefSpokenFact(belief)) continue;
      candidates.push({ publicView, belief });
    }
  }
  candidates.sort((left, right) => Number(right.belief.importance ?? 0) - Number(left.belief.importance ?? 0)
    || Number(right.belief.learnedAt ?? -1) - Number(left.belief.learnedAt ?? -1)
    || left.publicView.id.localeCompare(right.publicView.id)
    || String(left.belief.factId).localeCompare(String(right.belief.factId)));
  const selected = candidates[0];
  if (!selected) return null;
  return {
    ...action,
    targetNpcId: selected.publicView.id,
    targetNpcName: selected.publicView.name,
    dialogueTopic: "mission_clue",
    missionTroubleId: definition.troubleId,
    missionBeliefFactId: selected.belief.factId,
    missionTitle: definition.title,
    deferMissionConversationCompletion: true,
    label: `${selected.publicView.name}に「${definition.title}」の手掛かりを聞く`,
  };
}

function directNpcConversationActions(runtime, data) {
  if (runtime.pendingBattle?.session?.status === "active") return [];
  if (runtime.playerState.absoluteMinute >= journey.GAME_END_MINUTE) return [];
  if (runtime.tutorial && runtime.tutorial.stage !== "free") return [];
  syncAuthoritativePresentNpcIds(runtime, data);
  return presentNpcsAt(runtime, data)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((npc) => ({
      id: `DIRECT_TALK:${npc.id}`,
      type: "conversation",
      directTalk: true,
      targetNpcId: npc.id,
      targetNpcName: npc.name,
      dialogueTopic: "direct_contact",
      minutes: 5,
      label: `${npc.name}に話しかける`,
    }));
}

function t01FocusedChoiceAllowed(action, runtime) {
  const mission = runtime.playerState.missions?.["MSN-T01"];
  const focused = runtime.playerState.player.facilityId === "LOC_FARM_EDGE"
    && ["active", "available", "in_progress"].includes(String(mission?.status ?? ""));
  if (!focused || action.type !== "conversation") return true;
  return action.missionId === "MSN-T01" || action.targetNpcId === "NPC001";
}

function choiceActionPool(runtime, data, { limit = 9 } = {}) {
  if (runtime.pendingBattle?.session?.status === "active") return [];
  if (runtime.playerState.absoluteMinute >= journey.GAME_END_MINUTE) return [];
  syncAuthoritativePresentNpcIds(runtime, data);
  const authored = openingChoiceActions(runtime);
  if (authored) return authored.map((action) => decorateWorkOfferAction(action, runtime, data, action.targetNpcId)).filter(Boolean);
  const workOfferChoices = pendingWorkOfferActions(runtime, data);
  if (workOfferChoices) return workOfferChoices;
  if (runtime.tutorial && ["movement", "movement_aftermath"].includes(runtime.tutorial.stage)) return [];
  const followup = dialogueFollowupActions(runtime);
  if (followup) return followup;
  const authorizedMissionActions = new Map();
  const generated = journey.generateChoiceActions(
    runtime.playerState,
    data.model,
    data.battleData,
    runtime.playerState.catalog,
    profileFor(runtime.playerState.profileId),
    {
      limit: Math.max(3, Math.min(12, Number(limit) || 9)),
      fillTo: 0,
      candidateFilter(action) {
        if (action.type !== "conversation" || !action.missionId) return true;
        const authorized = authoritativeMissionConversationAction(action, runtime, data);
        if (!authorized) return false;
        authorizedMissionActions.set(action.id, authorized);
        return true;
      },
    },
  ).map((action) => contextualLocalAction(
    authorizedMissionActions.has(action.id)
      ? { ...authorizedMissionActions.get(action.id), choiceId: action.choiceId }
      : action,
    runtime,
    data,
  )).filter(Boolean).filter((action) => !(action.missionId === "MSN-T01"
    && action.stepId === "decide"
    && !ensureT01EscortState(runtime).arrivedSquare))
    .filter((action) => t01FocusedChoiceAllowed(action, runtime));
  const missionConversationTargets = new Set(generated
    .filter((action) => action.missionId && action.type === "conversation" && action.targetNpcId)
    .map((action) => action.targetNpcId));
  const deduplicated = generated.filter((action) => !(action.type === "conversation"
    && !action.missionId
    && action.targetNpcId
    && missionConversationTargets.has(action.targetNpcId)));
  const actionPriority = (action) => {
    if (action.missionId) return 0;
    if (action.type === "localInvestigate") return 1;
    if (action.type === "conversation" && !action.workOffer) return 2;
    const hasLearnedSkill = runtime.playerState.player.skills.size > 0;
    if (action.workOffer) return hasLearnedSkill ? 4 : 3;
    if (action.type === "seekBattle") return hasLearnedSkill ? 3 : 4;
    return 5;
  };
  const prioritized = deduplicated
    .map((action, index) => ({ action, index }))
    .sort((left, right) => actionPriority(left.action) - actionPriority(right.action) || left.index - right.index)
    .map((entry) => entry.action);
  const movementCandidates = (!runtime.tutorial || runtime.tutorial.stage === "free")
    ? movementActions(runtime, data).slice(0, 6).map((action) => ({
      ...action,
      label: action.movementScope === "regional"
        ? `${action.destinationHub}へ向かう`
        : `${data.model.facilityById[action.destinationFacilityId]?.name ?? action.destinationFacilityId}へ向かう`,
    }))
    : [];
  const hasWorkCandidate = prioritized.some((action) => action.workOffer === true || action.type === "work");
  const localWorkCandidate = hasWorkCandidate
    ? null
    : contextualLocalAction({ id: "WORK", type: "work", workOffer: true, minutes: 6, label: "この場所で受けられる仕事を尋ねる" }, runtime, data);
  const fillers = [
    ...(localWorkCandidate ? [localWorkCandidate] : []),
    { id: "TUTORIAL:PAUSE:OBSERVE", type: "observe", minutes: 45, label: "今いる場所の様子を、もう少し確かめる" },
    { id: "TUTORIAL:PAUSE:WAIT", type: "wait", minutes: 30, label: "物音と人の動きが変わるまで、少し待つ" },
    { id: "TUTORIAL:PAUSE:PLAN", type: "plan", minutes: 30, label: "知っている噂と目的を照らし合わせ、次の一手を決める" },
  ].map((action) => contextualLocalAction(action, runtime, data)).filter(Boolean);
  const combined = [...prioritized, ...fillers]
    .map((action, index) => ({ action, index }))
    .sort((left, right) => actionPriority(left.action) - actionPriority(right.action) || left.index - right.index)
    .map((entry) => entry.action);
  const unique = [...new Map(combined.map((action) => [action.id, action])).values()];
  const eligible = !runtime.tutorial || runtime.tutorial.stage === "free"
    ? unique
    : unique.filter((action) => !["seekBattle", "missionBattle", "investigate"].includes(action.type));
  const cap = Math.max(3, Math.min(12, Number(limit) || 9));
  const selected = eligible.slice(0, cap);
  if (cap > 3 && movementCandidates.length && !selected.some((action) => action.type === "move")) {
    const movement = movementCandidates.find((action) => !selected.some((entry) => entry.id === action.id));
    if (movement) {
      if (selected.length >= cap) selected[selected.length - 1] = movement;
      else selected.push(movement);
    }
  }
  return selected;
}

export function availableGameRuntimeChoiceCandidates(runtime, data, options = {}) {
  return choiceActionPool(runtime, data, options);
}

function narrativeChoicePoolKey(runtime, actions) {
  return sha256(JSON.stringify({
    minute: runtime.playerState.absoluteMinute,
    location: runtime.playerState.player.location,
    facilityId: runtime.playerState.player.facilityId,
    tutorialStage: runtime.tutorial?.stage ?? null,
    pendingWorkOffer: runtime.pendingWorkOffer?.openedAtMinute ?? null,
    actionIds: actions.map((action) => action.id),
  })).slice(0, 24);
}

function generatedChoiceDetail(action, runtime, selection, data) {
  const detail = selection?.detailsById?.[action.id];
  if (!detail) return action;
  let resolved = {
    ...action,
    label: cleanText(detail.label, 180) || action.label,
    generatedApproach: cleanText(detail.approach, 180) || null,
  };
  if (action.workOffer && detail.workProposal?.title) {
    const durationClass = ["short", "half_day", "full_day"].includes(detail.workProposal.durationClass)
      ? detail.workProposal.durationClass
      : "short";
    const riskClass = ["low", "medium", "high"].includes(detail.workProposal.riskClass)
      ? detail.workProposal.riskClass
      : "low";
    const minutes = { short: 120, half_day: 240, full_day: 480 }[durationClass];
    const description = cleanText(detail.workProposal.title, 120);
    const facilityId = runtime.playerState.player.facilityId;
    const facility = data.model.facilityById[facilityId] ?? {};
    const availability = workAvailability(runtime, {
      facility,
      facilityId,
      employerId: action.targetNpcId,
      durationMinutes: minutes,
      startOffsetMinutes: Number(action.minutes ?? 6),
    });
    if (availability.available) {
      const specification = { facilityId, employerId: action.targetNpcId, title: description, durationMinutes: minutes, riskClass };
      const wage = deterministicWorkWage(runtime, specification);
      resolved = {
        ...resolved,
        workOfferId: workOfferId(runtime, specification),
        quotedWage: wage,
        workDescription: description,
        workDurationMinutes: minutes,
        workRiskClass: riskClass,
        requiredDisclosure: `仕事は「${description}」、所要時間は${minutes}分、報酬は${wage}G`,
      };
    } else {
      resolved = { ...action, label: action.label, generatedApproach: null };
    }
  }
  return resolved;
}

function selectedChoiceActions(runtime, actions, data) {
  if (!actions.length) return [];
  const key = narrativeChoicePoolKey(runtime, actions);
  const selection = runtime.narrativeChoiceSelection?.poolKey === key
    ? runtime.narrativeChoiceSelection
    : null;
  const byId = new Map(actions.map((action) => [action.id, action]));
  const preferred = [];
  for (const id of selection?.actionIds ?? []) {
    const action = byId.get(id);
    if (action && !preferred.some((entry) => entry.id === id)) preferred.push(action);
    if (preferred.length >= 3) break;
  }
  const legacy = [
    ...preferred,
    ...actions.filter((action) => !preferred.some((entry) => entry.id === action.id)),
  ].slice(0, 3);
  const preserveReviewedOrder = !selection || (runtime.tutorial && runtime.tutorial.stage !== "free");
  const selected = preserveReviewedOrder
    ? legacy
    : selectDiverseChoices([
      ...preferred,
      ...actions.filter((action) => !preferred.some((entry) => entry.id === action.id)),
    ], { expectedCount: Math.min(3, actions.length) });
  return withChoiceIds(selected.map((action) => generatedChoiceDetail(action, runtime, selection, data)));
}

function choiceActions(runtime, data) {
  return selectedChoiceActions(runtime, choiceActionPool(runtime, data), data);
}

function movementActions(runtime, data) {
  if (runtime.pendingBattle?.session?.status === "active") return [];
  if (runtime.playerState.absoluteMinute >= journey.GAME_END_MINUTE) return [];
  const knowledge = ensurePlayerKnowledge(runtime);
  for (const rumor of runtime.playerState.rumors ?? []) {
    if (runtime.playerState.player.knownRumorIds.has(rumor.id) && rumor.origin) knowledge.knownHubIds.add(rumor.origin);
  }
  for (const definition of [...runtime.playerState.catalog.special, ...runtime.playerState.catalog.permanent]) {
    const missionRuntime = runtime.playerState.missions[definition.id];
    if (!missionRuntime || !["active", "available", "in_progress"].includes(missionRuntime.status)) continue;
    if (definition.kind === "special") {
      const known = runtime.playerState.rumors.some((rumor) => rumor.troubleId === definition.troubleId
        && runtime.playerState.player.knownRumorIds.has(rumor.id));
      if (!known) continue;
    }
    const step = definition.steps?.find((entry) => Number(missionRuntime.progress?.[entry.id] ?? 0) < Number(entry.required ?? 1));
    if (step?.targetLocation) knowledge.knownHubIds.add(step.targetLocation);
    if (step?.targetFacilityId) knowledge.knownFacilityIds.add(step.targetFacilityId);
  }
  const facilityWorldState = { day: runtime.playerState.day, troubles: runtime.playerState.troubles };
  const actions = journey.availableMovementActions(runtime.playerState, data.model)
    .filter((action) => action.movementScope !== "local"
      || facilityVisibility(action.destinationFacilityId, facilityWorldState).visible)
    .filter((action) => action.movementScope === "local"
      ? knowledge.knownFacilityIds.has(action.destinationFacilityId)
      : knowledge.knownHubIds.has(action.destinationHub));
  if (!runtime.tutorial || runtime.tutorial.stage === "free") return actions;
  if (!["movement", "mission_intro", "movement_aftermath", "aftermath_intro"].includes(runtime.tutorial.stage)) return [];
  if (["movement", "movement_aftermath"].includes(runtime.tutorial.stage)) {
    return actions
      .filter((action) => action.movementScope === "local" && action.destinationFacilityId === "LOC_FARM_SQUARE")
      .map((action) => ({ ...action, label: runtime.tutorial.stage === "movement" ? "エダについて村の広場へ向かう" : "村の広場へ向かう" }));
  }
  return actions;
}

function publicBeliefDetail(belief) {
  return String(belief?.text ?? "")
    .replace(/^T\d{2}[_：:\s-]*/u, "")
    .replaceAll("_", "・")
    .trim();
}

function beliefTroubleId(belief) {
  return belief?.troubleId
    ?? belief?.troubleIds?.[0]
    ?? String(belief?.text ?? "").match(/^(T\d{2})[_：:\s-]/u)?.[1]
    ?? null;
}

function npcCanDiscloseBeliefs(npc) {
  return Boolean(npc
    && npc.disposition !== "escalate"
    && !HIDDEN_NPC_ROLE_PATTERN.test(String(npc.occupation ?? "")));
}

function beliefSpokenFact(belief) {
  const troubleId = beliefTroubleId(belief);
  const publicTrouble = PUBLIC_TROUBLE_RUMOR_COPY[troubleId];
  const detail = publicBeliefDetail(belief);
  const reviewedDetail = PUBLIC_BELIEF_DETAIL_COPY[detail];
  const naturalDetail = detail.length >= 8
    && /[ぁ-んァ-ヶ一-龠々]/u.test(detail)
    && /[はがをにでとへ]/u.test(detail)
    && !/[A-Za-z][A-Za-z0-9_-]{2,}/u.test(detail)
    ? detail.replace(/[。．.!！?？]+$/gu, "")
    : null;
  if (publicTrouble) {
    const status = {
      critical: "事態が差し迫っている",
      failed: "すでに被害が出ている",
      resolved: "状況が変わり、ひとまず落ち着いている",
    }[belief?.troubleStatus];
    const base = reviewedDetail ?? naturalDetail ?? publicTrouble;
    return status ? `${base}。${status}` : base;
  }
  if (!detail || !/[ぁ-んァ-ヶ一-龠々]/u.test(detail) || /[A-Za-z][A-Za-z0-9_-]{2,}/u.test(detail)) return null;
  if (belief?.kind === "misconception") return `${detail}という見方もあるが、まだ確かめられていない`;
  return detail.replace(/[。．.!！?？]+$/gu, "");
}

function beliefPublicProvenance(belief) {
  const hopCount = Number(belief?.hopCount ?? 0);
  const pathLength = Array.isArray(belief?.path) ? belief.path.length : 0;
  if (hopCount > 0 || pathLength > 1) return "何人かの話し手を経て、ここまで届いたものだ";
  if (belief?.sourceNpcId) return "別の人から直接聞いたものだ";
  if (belief?.sourceType === "sheet") return "以前から自分で気に掛け、見聞きしてきたことだ";
  if (Number.isFinite(Number(belief?.learnedAt)) && Number(belief.learnedAt) >= 0) return "その時に自分で見聞きしたことだ";
  return "自分で確かめられた範囲の話だ";
}

function dialogueTopicBeliefScore(topic, belief) {
  const detail = publicBeliefDetail(belief);
  const status = String(belief?.troubleStatus ?? "");
  if (topic === "mission_clue") return beliefTroubleId(belief) ? 10 : 0;
  if (topic === "local_concern") {
    const concernWords = /困|不足|食料|水量|捜索|被害|失踪|危険|襲|病|負傷|死亡|争|火事|放火|盗|崩|枯|汚|異変|問題|助け|救|警戒/u;
    return (concernWords.test(detail) ? 6 : 0)
      + (belief?.kind === "trouble" ? 3 : 0)
      + (/active|critical|failed/u.test(status) ? 2 : 0);
  }
  if (topic === "local_change") {
    const changeWords = /変|水量|増|減|消|現れ|目撃|最近|昨日|今朝|崩|枯|濁|なくな|戻ら|倒|起き|発生|移った|壊/u;
    return (changeWords.test(detail) ? 6 : 0)
      + (/critical|failed|resolved/u.test(status) ? 2 : 0);
  }
  if (topic === "local_rumor") {
    const provenance = belief?.sourceNpcId || belief?.sourceType || belief?.path || Number.isFinite(Number(belief?.hopCount));
    return 3 + (provenance ? 2 : 0);
  }
  return 0;
}

function localBeliefScore(runtime, data, belief) {
  const troubleId = beliefTroubleId(belief);
  const trouble = troubleId ? data.model.troubleById[troubleId] : null;
  if (trouble?.primaryLocations?.includes(runtime.playerState.player.location)) return 2;
  const beliefLocation = belief?.location ?? belief?.origin ?? belief?.hubId ?? null;
  return beliefLocation === runtime.playerState.player.location ? 2 : beliefLocation ? 0 : 1;
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
  if (sourceNpcState) {
    const presentIds = runtime.playerState.authoritativePresentNpcIds;
    if (!(presentIds instanceof Set) || !presentIds.has(action.targetNpcId) || !npcCanDiscloseBeliefs(sourceNpc)) return [];
  }
  if (sourceNpcState && action?.dialogueTopic === "local_rumor") {
    const rumorId = runtime.dialogueSession?.lastDisclosedRumorId ?? null;
    const rumor = rumorId ? state.rumorById?.[rumorId] : null;
    if (rumor?.sourceNpcId === action.targetNpcId && rumor.spokenFact) {
      action.requiredDisclosure = `${rumor.spokenFact}という話は、${rumor.provenanceText ?? "自分で確かめられた範囲の話だ"}`;
      action.disclosedRumorId = rumor.id;
    }
    return [];
  }
  const disclosureTopics = new Set(["local_concern", "local_change", "mission_clue"]);
  if (sourceNpcState && !disclosureTopics.has(action?.dialogueTopic)) return [];
  const currentHour = state.absoluteMinute / 60;
  const sourceBeliefs = sourceNpcState
    ? Object.values(sourceNpcState.beliefs ?? {})
    : pool instanceof Map
      ? [...pool.values()]
        .filter((entry) => Number(entry?.propagationAt ?? entry?.belief?.propagationAt ?? 0) <= currentHour)
        .map((entry) => entry?.belief ?? entry)
      : [];
  const minimumImportance = sourceNpcState ? 0.2 : 0.55;
  const missionTroubleIds = new Set([...state.catalog.special, ...state.catalog.permanent]
    .filter((definition) => ["active", "available", "in_progress"].includes(state.missions[definition.id]?.status))
    .map((definition) => definition.troubleId)
    .filter(Boolean));
  const candidates = sourceBeliefs
    .filter((belief) => belief?.factId
      && belief.secret !== true
      && ["fact", "trouble", "misconception"].includes(belief.kind ?? "fact")
      && Number(belief.importance ?? 0) >= minimumImportance)
    .filter((belief) => Boolean(beliefSpokenFact(belief)))
    .filter((belief) => action?.dialogueTopic !== "mission_clue"
      || (belief.factId === action.missionBeliefFactId
        && beliefTroubleId(belief) === action.missionTroubleId))
    .filter((belief) => action?.dialogueTopic === "mission_clue"
      || !state.player.knownRumorIds.has(`RUM-LIVING-${belief.factId}`))
    .filter((belief) => !sourceNpcState || dialogueTopicBeliefScore(action.dialogueTopic, belief) > 0)
    .sort((left, right) => {
      const leftTrouble = beliefTroubleId(left);
      const rightTrouble = beliefTroubleId(right);
      const leftMissionScore = missionTroubleIds.has(leftTrouble) ? 1 : 0;
      const rightMissionScore = missionTroubleIds.has(rightTrouble) ? 1 : 0;
      const recency = action?.dialogueTopic === "local_change"
        ? Number(right.learnedAt ?? -1) - Number(left.learnedAt ?? -1)
        : 0;
      return (sourceNpcState ? dialogueTopicBeliefScore(action.dialogueTopic, right) - dialogueTopicBeliefScore(action.dialogueTopic, left) : 0)
        || localBeliefScore(runtime, data, right) - localBeliefScore(runtime, data, left)
        || rightMissionScore - leftMissionScore
        || recency
        || Number(right.importance ?? 0) - Number(left.importance ?? 0)
        || String(left.factId).localeCompare(String(right.factId));
    })
    .slice(0, limit);
  const learned = [];
  for (const belief of candidates) {
    const id = `RUM-LIVING-${belief.factId}`;
    const troubleId = beliefTroubleId(belief);
    const trouble = troubleId ? data.model.troubleById[troubleId] : null;
    const detail = publicBeliefDetail(belief);
    const spokenFact = beliefSpokenFact(belief);
    if (state.player.knownRumorIds.has(id)) {
      if (sourceNpcState && spokenFact && !action.requiredDisclosure) {
        action.requiredDisclosure = spokenFact;
        action.disclosedRumorId = id;
      }
      continue;
    }
    const statusText = belief.troubleStatus === "critical" ? "危機が差し迫っている"
      : belief.troubleStatus === "failed" ? "被害が発生した"
        : belief.troubleStatus === "resolved" ? "状況が変わった"
          : "異変が起きている";
    const rumor = {
      id,
      troubleId,
      text: (() => {
        if (belief.kind === "misconception") return `${spokenFact || detail || "確かでない話"}という、未確認の話を聞いた。`;
        if (spokenFact) return `${spokenFact}と聞いた。`;
        if (trouble) return `この土地の異変について、${statusText}という噂を聞いた。`;
        return detail || "現地で気になる噂を聞いた。";
      })(),
      origin: state.player.location,
      originMinute: Math.max(0, Math.round(Number(belief.learnedAt ?? state.absoluteMinute / 60) * 60)),
      importance: Number(belief.importance ?? 0.6),
      playerOriginated: false,
      sourceNpcId: sourceNpcState?.id ?? null,
      sourceNpcName: sourceNpc?.name ?? null,
      sourceNpcAnonymousLabel: sourceNpcState
        ? action?.speakerLabelBeforeIntroduction ?? "その人物"
        : null,
      sourceType: sourceNpcState ? "npc-conversation" : "local-observation",
      spokenFact,
      provenanceText: beliefPublicProvenance(belief),
      recipients: {},
    };
    state.rumors.push(rumor);
    state.rumorById[id] = rumor;
    state.player.knownRumorIds.add(id);
    if (sourceNpcState && spokenFact && !action.requiredDisclosure) {
      // A conversation may grant knowledge only when the exact fact is also
      // required in the on-screen reply. The Gemini contract and the service
      // presentation guard both enforce this boundary.
      action.requiredDisclosure = spokenFact;
      action.disclosedRumorId = id;
    }
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

function applyLocallyLearnedRumorsToMissionHearSteps(runtime, learnedRumorIds = []) {
  if (!learnedRumorIds.length) return [];
  const state = runtime.playerState;
  const advanced = [];
  for (const rumorId of learnedRumorIds) {
    const rumor = state.rumorById?.[rumorId] ?? state.rumors?.find((entry) => entry.id === rumorId);
    if (!rumor?.troubleId) continue;
    const definition = [...state.catalog.special, ...state.catalog.permanent]
      .find((entry) => entry.troubleId === rumor.troubleId);
    const mission = definition ? state.missions?.[definition.id] : null;
    const hear = definition?.steps?.find((step) => step.id === "hear");
    if (!mission || !hear || !["active", "available", "in_progress"].includes(mission.status)) continue;
    const required = Math.max(1, Number(hear.required ?? 1));
    if (Number(mission.progress?.hear ?? 0) >= required) continue;
    mission.progress.hear = required;
    state.history.push({
      type: "MISSION_HEAR_SATISFIED_BY_LOCAL_RUMOR",
      minute: state.absoluteMinute,
      missionId: definition.id,
      troubleId: rumor.troubleId,
      rumorId,
    });
    advanced.push(definition.id);
  }
  return advanced;
}

function learnOpeningT01Rumor(runtime) {
  const state = runtime.playerState;
  const existing = (state.rumors ?? []).find((rumor) => rumor.troubleId === "T01");
  if (!existing || state.player.knownRumorIds.has(existing.id)) return existing?.id ?? null;
  state.player.knownRumorIds.add(existing.id);
  ensurePlayerKnowledge(runtime).knownHubIds.add("田園の村");
  state.history.push({
    type: "RUMOR_LEARNED_OPENING_SCENE",
    minute: state.absoluteMinute,
    rumorId: existing.id,
    troubleId: "T01",
    sourceFacilityId: "LOC_FARM_SQUARE",
  });
  return existing.id;
}

function tutorialBeatSummary(beat) {
  const summaries = {
    "awake:body": "体に大きな怪我はない。だが、服にも記憶にも、この麦畑へ来た手掛かりはなかった。",
    "awake:listen": "風に鳴る麦の向こうから、鐘と人の暮らしの音が聞こえた。",
    "awake:ground": "倒れた麦は自分を中心に広がっている。ここまで歩いて来た足跡は見つからなかった。",
    "contact:where": "ここが田園の村の麦畑で、目の前の女性が村人だと分かった。",
    "contact:memory": "見知らぬ世界から来たという話を、女性は笑わずに受け止めた。",
    "contact:who": "女性はこちらを警戒するより先に体調を気遣い、自分のことを話し始めた。",
    "orient:voices": "村の広場で誰かを捜しているらしい。詳しい事情は、まだ分からない。",
    "orient:found": "麦畑の中に倒れていて、周囲には歩いて来た跡がなかったと聞いた。",
    "orient:help": "エダが一食と今夜の寝床を世話してくれることになった。",
    "movement:square": "移動を使って村の広場へ着いた。人だかりの中心で、切迫した呼び声が聞こえる。",
    "movement:aftermath": "村の広場へ着いた時には捜索が終わっていた。選ばなかった時間にも、世界は先へ進んでいた。",
    "inquiry:garo": "年配の村人から、フィンの捜索範囲と期限を聞いた。",
    "inquiry:mira": "取り乱した女性から、息子フィンが地図を持って姿を消したと聞いた。",
    "inquiry:coby": "落ち着かない少年から、フィンが古い見張り小屋へ行きたがっていたと聞いた。",
    "defer:work": "フィンの捜索は保留し、まず仕事の内容と賃金を確かめることにした。",
    "defer:leave": "フィンの捜索には関わらず、村の外へ向かう道を選べる状態にした。",
    "aftermath:garo": "年配の村人から、捜索が間に合わずフィンを救えなかった経緯を聞いた。",
    "aftermath:mira": "女性の沈黙と広場の空気から、取り返せない結末が訪れたことを知った。",
    "aftermath:coby": "落ち着かない少年から、フィンを止められなかった後悔と捜索の結末を聞いた。",
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
    if (beat === "contact:where") ensurePlayerKnowledge(runtime).knownHubIds.add("王都");
    tutorial.stage = "orientation";
    tutorial.lastBeat = beat;
  } else if (tutorial.stage === "orientation" && beat?.startsWith("orient:")) {
    tutorial.orientationChoice = action.id;
    ensurePlayerKnowledge(runtime).knownHubIds.add("王都");
    discoverFacility(runtime, "LOC_FARM_SQUARE");
    if (beat === "orient:help") discoverFacility(runtime, "LOC_FARM_INN");
    tutorial.stage = "movement";
    tutorial.lastBeat = beat;
  } else if (tutorial.stage === "movement" && action?.destinationFacilityId === "LOC_FARM_SQUARE") {
    tutorial.stage = "mission_intro";
    tutorial.lastBeat = "movement:square";
    learnOpeningT01Rumor(runtime);
    placeOpeningCrisisCast(runtime.livingWorld, runtime.playerState.absoluteMinute);
  } else if (tutorial.stage === "movement_aftermath" && action?.destinationFacilityId === "LOC_FARM_SQUARE") {
    tutorial.stage = "aftermath_intro";
    tutorial.lastBeat = "movement:aftermath";
    placeOpeningAftermathCast(runtime.livingWorld, runtime.playerState.absoluteMinute);
  } else if (tutorial.stage === "mission_intro" && beat?.startsWith("inquiry:")) {
    tutorial.inquirySource = action.id;
    discoverFacility(runtime, "LOC_FARM_EDGE");
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
  } else if (tutorial.stage === "mission_intro" && beat?.startsWith("defer:")) {
    learnOpeningT01Rumor(runtime);
    tutorial.stage = "free";
    tutorial.lastBeat = beat;
  } else if (tutorial.stage === "mission_intro" && action?.type === "move") {
    learnOpeningT01Rumor(runtime);
    tutorial.stage = "free";
    tutorial.lastBeat = "defer:leave";
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
    const session = runtime.dialogueSession;
    if (!session || session.npcId !== action.targetNpcId) {
      runtime.dialogueSession = null;
      return;
    }
    const askedTopics = session.askedTopics instanceof Set
      ? session.askedTopics
      : new Set(session.askedTopics ?? []);
    action.conversationTurn = Number(session.turnCount ?? 1) + 1;
    action.previouslyAskedTopics = [...askedTopics];
    if (action.dialogueTopic === "end_conversation") {
      runtime.dialogueSession = null;
      return;
    }
    if (action.dialogueTopic) askedTopics.add(action.dialogueTopic);
    session.askedTopics = askedTopics;
    if (action.disclosedRumorId) session.lastDisclosedRumorId = action.disclosedRumorId;
    session.turnCount = action.conversationTurn;
    session.lastInteractionAtMinute = runtime.playerState.absoluteMinute;
    session.lastPlayerActionLabel = action.label ?? null;
    return;
  }
  if (action.type === "conversation"
    && action.targetNpcId
    && (!action.missionId || Boolean(action.requiredDisclosure))
    && !action.tutorialBeat) {
    action.conversationTurn = 1;
    action.previouslyAskedTopics = [];
    runtime.dialogueSession = {
      npcId: action.targetNpcId,
      npcName: action.targetNpcName ?? action.targetNpcId,
      openedAtMinute: runtime.playerState.absoluteMinute,
      lastInteractionAtMinute: runtime.playerState.absoluteMinute,
      location: runtime.playerState.player.location,
      facilityId: runtime.playerState.player.facilityId,
      askedTopics: new Set(action.dialogueTopic ? [action.dialogueTopic] : []),
      lastDisclosedRumorId: action.disclosedRumorId ?? null,
      turnCount: 1,
      lastPlayerActionLabel: action.label ?? null,
    };
    return;
  }
  if (action.type === "move") runtime.dialogueSession = null;
}

function expireDialogueSession(runtime) {
  const session = runtime.dialogueSession;
  if (!session) return;
  const presentIds = runtime.playerState.authoritativePresentNpcIds;
  const expired = runtime.playerState.absoluteMinute
    - Number(session.lastInteractionAtMinute ?? session.openedAtMinute ?? -Infinity) > 30;
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
    missionTitle: action.missionTitle ?? null,
    missionTroubleId: action.missionTroubleId ?? null,
    missionBeliefFactId: action.missionBeliefFactId ?? null,
    dialogueTopic: action.dialogueTopic ?? null,
    dialogueFollowup: Boolean(action.dialogueFollowup),
    conversationTurn: Number(action.conversationTurn ?? 0),
    previouslyAskedTopics: Array.isArray(action.previouslyAskedTopics) ? [...action.previouslyAskedTopics] : [],
    requiredDisclosure: cleanText(action.requiredDisclosure, 180) || null,
    disclosedRumorId: action.disclosedRumorId ?? null,
    speakerLabelBeforeIntroduction: cleanText(action.speakerLabelBeforeIntroduction, 80) || null,
    firstIntroduction: Boolean(action.firstIntroduction),
    introductionName: cleanText(action.introductionName, 80) || null,
    introductionToken: cleanText(action.introductionToken, 120) || null,
    tutorialBeat: action.tutorialBeat ?? null,
    sceneActorNpcId: action.sceneActorNpcId ?? null,
    workOffer: Boolean(action.workOffer),
    workDecline: Boolean(action.workDecline),
    quotedWage: Number.isFinite(Number(action.quotedWage)) ? Number(action.quotedWage) : null,
    workDescription: cleanText(action.workDescription, 180) || null,
    lodging: action.lodging === true,
    price: Number.isFinite(Number(action.price)) ? Number(action.price) : null,
    nutrition: Number.isFinite(Number(action.nutrition)) ? Number(action.nutrition) : null,
    mealQuality: cleanText(action.mealQuality, 40) || null,
    safety: cleanText(action.safety, 40) || null,
    localVariant: Number(action.localVariant ?? 0),
    destinationFacilityId: action.destinationFacilityId ?? null,
    destinationHub: action.destinationHub ?? null,
    movementScope: action.movementScope ?? null,
    investigationStage: Number.isFinite(Number(action.investigationStage))
      ? Number(action.investigationStage)
      : null,
    approachId: cleanText(action.approachId, 80) || null,
    discoveryId: cleanText(action.discoveryId, 120) || null,
    discoveryText: cleanText(action.discoveryText, 500) || null,
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
    const actionKind = ["attack", "skill", "status_failure", "defend", "flee"].includes(frame?.action?.kind)
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
      ...(actionKind === "flee" ? { escapeSucceeded: frame?.escapeSucceeded === true } : {}),
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

function interactiveBattleView(runtime, data) {
  const pending = runtime.pendingBattle;
  if (!pending?.session || pending.session.status !== "active") return null;
  const session = pending.session;
  const encounter = data.battleData.encounterById.get(pending.continuation.encounterId);
  const actors = [...session.state.players, ...session.state.enemies].map((actor) => ({
    instanceId: actor.instanceId,
    actorId: actor.id,
    side: actor.side,
    name: actor.side === "enemy"
      ? data.battleData.monsterById.get(actor.id)?.name ?? actor.name ?? "敵"
      : runtime.playerState.player.displayName ?? actor.name ?? "旅人",
    hp: battleNumber(actor.hp),
    maxHp: Math.max(1, battleNumber(actor.maxHp, 1)),
    mp: battleNumber(actor.mp),
    maxMp: Math.max(0, battleNumber(actor.maxMp)),
    alive: actor.alive !== false,
  }));
  const commands = listInteractiveBattleCommands({ data: data.battleData, session }).map((command) => ({
    actionId: command.actionId,
    kind: command.kind,
    skillId: command.skillId ?? null,
    name: cleanText(command.name, 64),
    description: cleanText(command.description, 180),
    mpCost: battleNumber(command.mpCost),
    hpCost: battleNumber(command.hpCost),
    currentMp: battleNumber(command.currentMp),
    currentHp: battleNumber(command.currentHp),
    cooldownRemaining: battleNumber(command.cooldownRemaining),
    available: command.available !== false,
    disabledReason: command.disabledReason ?? null,
    disabledDetail: cleanText(command.disabledDetail, 180) || null,
    targets: (command.targets ?? []).map((target) => ({
      instanceId: target.instanceId,
      actorId: target.actorId,
      name: target.side === "enemy"
        ? data.battleData.monsterById.get(target.actorId)?.name ?? target.name ?? "敵"
        : runtime.playerState.player.displayName ?? target.name ?? "旅人",
      side: target.side,
      hp: battleNumber(target.hp),
      maxHp: Math.max(1, battleNumber(target.maxHp, 1)),
    })),
  }));
  const lastRoundPlayback = session.lastRound ? safeBattlePlayback({
    encounterId: pending.continuation.encounterId,
    timeline: {
      combatants: session.initialCombatants,
      frames: session.lastRound.frames,
    },
  }, data) : null;
  return {
    id: pending.id,
    status: "active",
    encounterId: pending.continuation.encounterId,
    encounterName: encounter?.name ?? "戦闘",
    round: Number(session.state.turn ?? 0) + 1,
    actors,
    commands,
    lastRound: session.lastRound ? {
      round: session.lastRound.round,
      frames: lastRoundPlayback?.frames ?? [],
    } : null,
    itemCommandAvailable: false,
    itemCommandMessage: "戦闘用アイテムの効果データは整備中です",
  };
}

function safeOutcome(result, data = null) {
  const output = { ok: result?.ok !== false, type: result?.type ?? null, reason: result?.reason ?? null };
  if (result?.requiredGold !== undefined) output.requiredGold = Number(result.requiredGold);
  if (result?.meal) output.meal = { ...result.meal };
  if (result?.rest) output.rest = { ...result.rest };
  if (result?.comparison) output.comparison = JSON.parse(JSON.stringify(result.comparison));
  if (result?.offerId) output.offerId = cleanText(result.offerId, 160);
  if (result?.loanId) output.loanId = cleanText(result.loanId, 160);
  if (result?.rewardId) output.rewardId = cleanText(result.rewardId, 160);
  if (result?.conditionLabel) output.conditionLabel = cleanText(result.conditionLabel, 80);
  if (result?.deposit !== undefined) output.deposit = Number(result.deposit);
  if (result?.depositRefunded !== undefined) output.depositRefunded = Number(result.depositRefunded);
  if (result?.equipmentRewardOffers?.length) output.equipmentRewardOffers = result.equipmentRewardOffers.map((entry) => ({ ...entry }));
  if (result?.equipmentLoanReturns?.length) output.equipmentLoanReturns = result.equipmentLoanReturns.map((entry) => ({ ...entry }));
  if (result?.reasonDetail) output.reasonDetail = cleanText(result.reasonDetail, 240);
  if (result?.command && typeof result.command === "object") {
    output.command = {
      actionId: cleanText(result.command.actionId, 120) || null,
      name: cleanText(result.command.name, 80) || null,
      mpCost: battleNumber(result.command.mpCost),
      hpCost: battleNumber(result.command.hpCost),
      currentMp: result.command.currentMp == null ? null : battleNumber(result.command.currentMp),
      currentHp: result.command.currentHp == null ? null : battleNumber(result.command.currentHp),
      cooldownRemaining: battleNumber(result.command.cooldownRemaining),
    };
  }
  if (result?.committed === true) output.committed = true;
  if (result?.battlePending === true) output.battlePending = true;
  if (result?.battleRound !== undefined) output.battleRound = Number(result.battleRound);
  if (result?.encounterId) output.encounterId = result.encounterId;
  if (result?.price !== undefined) output.price = result.price;
  if (result?.equipment) output.item = { id: result.equipment.id, name: result.equipment.name };
  if (result?.skillId) output.skillId = result.skillId;
  if (result?.spCost) output.spCost = result.spCost;
  if (result?.goldDelta !== undefined) output.goldDelta = Number(result.goldDelta);
  if (result?.learnedRumorIds?.length) output.learnedRumorCount = result.learnedRumorIds.length;
  if (result?.discovery?.id && result?.discovery?.text) {
    output.discovery = {
      id: cleanText(result.discovery.id, 120),
      text: cleanText(result.discovery.text, 500),
      missionId: cleanText(result.discovery.missionId, 80) || null,
      stepId: cleanText(result.discovery.stepId, 80) || null,
      stage: Number.isFinite(Number(result.discovery.stage)) ? Number(result.discovery.stage) : null,
      approachId: cleanText(result.discovery.approachId, 80) || null,
    };
  }
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
  else if (!output.ok && output.reasonDetail) output.summary = output.reasonDetail;
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
  const status = [
    "insufficient_gold",
    "insufficient_sp",
    "insufficient_gold_for_meal",
    "insufficient_gold_for_lodging",
    "used_offer_unavailable",
    "used_offer_claimed",
    "loan_unavailable",
    "loan_already_active",
    "loan_not_active",
    "loan_return_wrong_facility",
    "reward_unavailable",
  ].includes(code) ? 409 : 400;
  return new TrpgGameError(status, code, code, safeOutcome(result));
}

function equip(runtime, data, equipmentId) {
  const state = runtime.playerState;
  const equipment = data.battleData.equipmentById.get(equipmentId);
  if (!equipment) return { ok: false, reason: "unknown_equipment" };
  if (!equipmentAvailableToPlayer(state, equipmentId)) return { ok: false, reason: "not_owned_or_borrowed" };
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

function equipmentComparisonSummary(comparison) {
  const labels = {
    physicalPower: "物理",
    magicPower: "魔導",
    defense: "防御",
    magicResistance: "魔防",
    agility: "敏捷",
    luck: "幸運",
    accuracy: "命中",
    evasion: "回避",
    critical: "会心",
    maxHp: "HP",
    maxMp: "MP",
    performanceIndex: "総合",
  };
  const changes = Object.entries(comparison?.delta ?? {})
    .filter(([, value]) => Number(value) !== 0)
    .sort((left, right) => Math.abs(Number(right[1])) - Math.abs(Number(left[1])))
    .slice(0, 4)
    .map(([key, value]) => (labels[key] ?? key) + (Number(value) > 0 ? "+" : "") + Number(value));
  return changes.length ? changes.join("、") : "主要性能に差はない";
}

export function reconcileEquipmentAccessAfterCommand(runtime, data, completedMissionIdsBefore = new Set()) {
  const state = runtime.playerState;
  ensureEquipmentAccessState(state);
  const completed = state.progress?.missions?.completedIds instanceof Set
    ? state.progress.missions.completedIds
    : new Set(state.progress?.missions?.completedIds ?? []);
  const definitions = [...(state.catalog?.special ?? []), ...(state.catalog?.permanent ?? [])];
  const rewards = [];
  for (const missionId of completed) {
    if (completedMissionIdsBefore.has(missionId)) continue;
    const definition = state.catalog?.byId?.get?.(missionId)
      ?? definitions.find((entry) => entry.id === missionId);
    if (!definition) continue;
    const reward = createMissionEquipmentRewardOffer(state, data.battleData, definition, {
      facilityId: state.player.facilityId,
    });
    if (reward) rewards.push(reward);
  }
  const returns = reconcileEquipmentLoans(state);
  return { rewards, returns };
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
  ensurePlayerNeeds(runtime.playerState.player);
  ensureEquipmentAccessState(runtime.playerState);
  ensureWorkMarket(runtime);
  runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
  const activeBattle = runtime.pendingBattle?.session?.status === "active";
  if (activeBattle && command.type !== "BATTLE_ACT") {
    throw new TrpgGameError(409, "battle_command_required", "Finish or flee from the current battle first");
  }
  if (!activeBattle && command.type === "BATTLE_ACT") {
    throw new TrpgGameError(409, "battle_not_active");
  }
  if (runtime.playerState.absoluteMinute >= journey.GAME_END_MINUTE
    && !["BATTLE_ACT", "ACK_NPC_INTRODUCTION"].includes(command.type)) {
    throw new TrpgGameError(409, "game_ended", "The Day 1-100 journey has already ended");
  }
  const tutorialFeature = {
    MOVE: "movement",
    SHOP_BUY: "shop",
    SHOP_SELL: "shop",
    SHOP_TRY: "shop",
    SHOP_BUY_USED: "shop",
    SHOP_BORROW: "shop",
    SHOP_RETURN_LOAN: "shop",
    CLAIM_EQUIPMENT_REWARD: "shop",
    LEARN_SKILL: "skills",
  }[command.type];
  if (runtime.tutorial && tutorialFeature && tutorialView(runtime, data)?.unlocked?.[tutorialFeature] !== true) {
    throw new TrpgGameError(409, "tutorial_feature_locked", "Continue the introduction before using this feature", {
      feature: tutorialFeature,
    });
  }
  const payload = command.payload && typeof command.payload === "object" ? command.payload : {};
  const pendingIntroductionAtStart = runtime.pendingNpcIntroduction;
  if (runtime.tutorial && command.type !== "ACK_NPC_INTRODUCTION") runtime.tutorial.lastBeat = null;
  const goldBefore = Number(runtime.playerState.player.gold ?? 0);
  const levelBefore = Number(runtime.playerState.player.level ?? 1);
  const expBefore = Number(runtime.playerState.player.exp ?? 0);
  const previousTroubleStates = Object.fromEntries(Object.entries(runtime.playerState.troubles).map(([id, value]) => [id, value.status]));
  const completedMissionIdsBefore = runtime.playerState.progress?.missions?.completedIds instanceof Set
    ? new Set(runtime.playerState.progress.missions.completedIds)
    : new Set(runtime.playerState.progress?.missions?.completedIds ?? []);
  let result;
  let resolvedActionId = null;
  let resolvedPlayerAction = null;
  let deferredMissionConversation = null;
  if (["CHOOSE", "TALK"].includes(command.type)) {
    const choices = command.type === "TALK"
      ? directNpcConversationActions(runtime, data)
      : choiceActions(runtime, data);
    const action = command.type === "TALK"
      ? choices.find((entry) => entry.targetNpcId === payload.npcId)
      : choices.find((entry) => entry.choiceId === payload.choiceId);
    if (!action) {
      throw new TrpgGameError(400, command.type === "TALK" ? "npc_talk_not_available" : "choice_not_available");
    }
    if (command.type === "CHOOSE" && payload.actionId && payload.actionId !== action.id) {
      throw new TrpgGameError(409, "choice_action_mismatch", "The displayed choice no longer resolves to the same action", {
        choiceId: payload.choiceId,
        displayedActionId: payload.actionId,
        currentActionId: action.id,
      });
    }
    const currentFacility = data.model.facilityById[runtime.playerState.player.facilityId] ?? {};
    if (action.workOffer) {
      const availability = workAvailability(runtime, {
        facility: currentFacility,
        facilityId: runtime.playerState.player.facilityId,
        employerId: action.targetNpcId,
        durationMinutes: Number(action.workDurationMinutes ?? 120),
        startOffsetMinutes: Number(action.minutes ?? 6),
      });
      if (!availability.available) {
        throw new TrpgGameError(409, "work_offer_not_available", "The work offer is no longer available", { reason: availability.reason });
      }
    }
    if (action.type === "work") {
      const offer = runtime.pendingWorkOffer;
      const matches = Boolean(offer
        && action.workOfferId
        && offer.offerId === action.workOfferId
        && offer.facilityId === runtime.playerState.player.facilityId
        && offer.actorNpcId === action.workEmployerId);
      if (!matches) throw new TrpgGameError(409, "work_offer_stale", "The work offer no longer matches the current job");
      const availability = pendingWorkOfferAvailability(runtime, currentFacility);
      if (!availability.available) {
        runtime.pendingWorkOffer = null;
        throw new TrpgGameError(409, "work_offer_not_available", "The work offer is no longer available", { reason: availability.reason });
      }
    }
    resolvedPlayerAction = action;
    resolvedActionId = action.id;
    if (["missionBattle", "seekBattle"].includes(action.type)) {
      const opening = journey.beginInteractiveBattleAction(
        runtime.playerState,
        data.model,
        data.battleData,
        data.skills,
        runtime.playerState.catalog,
        profileFor(runtime.playerState.profileId),
        action,
      );
      if (!opening.ok) result = opening;
      else {
        const battleId = `BATTLE-${sha256(`${opening.continuation.key}:${runtime.playerState.metrics.actions}`).slice(0, 16)}`;
        const session = beginInteractiveBattle({
          data: data.battleData,
          encounterId: opening.continuation.encounterId,
          playerBuild: opening.continuation.prepared.scaledBuild,
          seed: opening.continuation.key,
          maxTurns: 100,
        });
        runtime.pendingBattle = {
          id: battleId,
          continuation: opening.continuation,
          resolvedAction: resolvedActionForPresentation(action),
          startedAtMinute: runtime.playerState.absoluteMinute,
          session,
        };
        result = {
          ok: true,
          type: "battleStart",
          battlePending: true,
          encounterId: opening.continuation.encounterId,
          summary: "敵と遭遇した。次の行動を選ぶ。",
        };
      }
    } else if (action.type === "move" && action.movementScope) {
      const resolve = () => journey.resolveMovementAction(
        runtime.playerState,
        data.model,
        data.battleData,
        data.skills,
        profileFor(runtime.playerState.profileId),
        action,
      );
      const resolveWithPlayback = () => withTemporaryTuning(runtime.playerState, "captureBattleTimeline", true, resolve);
      result = action.movementScope === "regional" && runtime.tutorial && runtime.playerState.player.skills.size === 0
        ? withTemporaryTuning(runtime.playerState, "disableTravelEncounters", true, resolveWithPlayback)
        : resolveWithPlayback();
    } else {
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
      if (result?.missionConversationPending) deferredMissionConversation = result;
    }
    if (!deferredMissionConversation) runtime.playerState.metrics.actions += 1;
  } else if (command.type === "MOVE") {
    const action = movementActions(runtime, data).find((entry) => entry.id === payload.moveId);
    if (!action) throw new TrpgGameError(400, "movement_not_available");
    resolvedPlayerAction = action;
    resolvedActionId = (action.id); // MOVE uses the same authoritative action object.
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
  } else if (command.type === "SHOP_TRY") {
    resolvedActionId = payload.stockId;
    result = previewEquipmentTrial(runtime.playerState, data.battleData, runtime.playerState.shop, payload.stockId, {
      location: runtime.playerState.player.location,
      facilityId: runtime.playerState.player.facilityId,
    });
    if (result.ok) {
      result.summary = result.comparison.candidateEquipmentName + "を試し、" + result.comparison.currentEquipmentName + "との差を確認した（" + equipmentComparisonSummary(result.comparison) + "）。";
    }
  } else if (command.type === "SHOP_BUY_USED") {
    resolvedActionId = payload.offerId;
    result = buyUsedEquipment(runtime.playerState, data.battleData, runtime.playerState.shop, payload.offerId, {
      location: runtime.playerState.player.location,
      facilityId: runtime.playerState.player.facilityId,
    });
    if (result.ok) {
      result.equipment = data.battleData.equipmentById.get(result.equipmentId);
      result.summary = result.equipment.name + "を中古品として" + result.price + "Gで購入した（" + result.conditionLabel + "）。";
      runtime.playerState.metrics.purchases += 1;
      runtime.playerState.metrics.zeroTimePurchases += 1;
    }
  } else if (command.type === "SHOP_BORROW") {
    resolvedActionId = payload.loanId;
    result = borrowMissionEquipment(runtime.playerState, data.battleData, runtime.playerState.shop, payload.loanId, {
      location: runtime.playerState.player.location,
      facilityId: runtime.playerState.player.facilityId,
    });
    if (result.ok) {
      result.equipment = data.battleData.equipmentById.get(result.equipmentId);
      result.summary = result.equipment.name + "を「" + result.missionTitle + "」の間だけ借りた。保証金は" + result.deposit + "G。";
    }
  } else if (command.type === "SHOP_RETURN_LOAN") {
    resolvedActionId = payload.loanId;
    result = returnEquipmentLoan(runtime.playerState, payload.loanId, {
      facilityId: runtime.playerState.player.facilityId,
    });
    if (result.ok) {
      result.equipment = data.battleData.equipmentById.get(result.equipmentId);
      result.summary = result.equipment.name + "を返却し、保証金" + result.depositRefunded + "Gを受け取った。";
    }
  } else if (command.type === "CLAIM_EQUIPMENT_REWARD") {
    resolvedActionId = payload.rewardId;
    result = claimEquipmentReward(runtime.playerState, data.battleData, payload.rewardId);
    if (result.ok) result.summary = "依頼報酬として" + result.equipment.name + "を受け取った。";
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
  } else if (command.type === "ACK_NPC_INTRODUCTION") {
    const pending = runtime.pendingNpcIntroduction;
    if (!pending || !payload.token || payload.token !== pending.token) {
      throw new TrpgGameError(409, "npc_introduction_not_available");
    }
    syncAuthoritativePresentNpcIds(runtime, data);
    if (!(runtime.playerState.authoritativePresentNpcIds instanceof Set)
      || !runtime.playerState.authoritativePresentNpcIds.has(pending.npcId)) {
      throw new TrpgGameError(409, "npc_introduction_not_available");
    }
    discoverNpc(runtime, pending.npcId);
    if (runtime.dialogueSession?.npcId === pending.npcId) {
      runtime.dialogueSession.npcName = pending.canonicalName;
    }
    runtime.pendingNpcIntroduction = null;
    resolvedActionId = `ACK_NPC_INTRODUCTION:${pending.npcId}`;
    result = { ok: true, type: "npcIntroduction", summary: `${pending.canonicalName}の名前を知った。` };
    runtime.playerState.history.push({
      type: "PLAYER_NPC_IDENTIFIED",
      minute: runtime.playerState.absoluteMinute,
      npcId: pending.npcId,
    });
  } else if (command.type === "BATTLE_ACT") {
    const pending = runtime.pendingBattle;
    if (!pending || pending.id !== payload.battleId) throw new TrpgGameError(409, "battle_id_mismatch");
    const turn = resolveInteractiveBattleRound({
      data: data.battleData,
      session: pending.session,
      command: { actionId: payload.actionId, targetInstanceId: payload.targetInstanceId || null },
    });
    if (!turn.ok) {
      const failure = {
        ok: false,
        reason: turn.reason ?? "battle_action_rejected",
        reasonDetail: cleanText(turn.reasonDetail, 240) || null,
        command: turn.command ?? null,
      };
      throw errorFromResult(failure);
    }
    pending.session = turn.session;
    resolvedActionId = `BATTLE_ACT:${payload.actionId}`;
    resolvedPlayerAction = pending.resolvedAction;
    if (turn.result) {
      result = journey.settleInteractiveBattleAction(
        runtime.playerState,
        data.model,
        data.battleData,
        data.skills,
        runtime.playerState.catalog,
        profileFor(runtime.playerState.profileId),
        pending.continuation,
        turn.result,
      );
      runtime.pendingBattle = null;
    } else {
      result = { ok: true, type: "battleRound", battlePending: true, battleRound: turn.round.round };
    }
  }
  if (!result?.ok && result?.committed !== true) throw errorFromResult(result);
  if ((result?.ok || result?.committed === true)
    && pendingIntroductionAtStart
    && !["ACK_NPC_INTRODUCTION", "TUTORIAL_ACK"].includes(command.type)
    && runtime.pendingNpcIntroduction?.token === pendingIntroductionAtStart.token) {
    // Leaving a visible introduction without acknowledging it must never make
    // the canonical name part of player knowledge. A later meeting can offer
    // a fresh, deterministic introduction beat.
    runtime.pendingNpcIntroduction = null;
  }
  if (result.ok && resolvedPlayerAction?.workOffer) {
    const facilityId = runtime.playerState.player.facilityId;
    const description = resolvedPlayerAction.workDescription ?? workDescription(facilityId);
    const minutes = Number(resolvedPlayerAction.workDurationMinutes ?? 120);
    const riskClass = resolvedPlayerAction.workRiskClass ?? "low";
    const specification = {
      facilityId,
      employerId: resolvedPlayerAction.targetNpcId,
      title: description,
      durationMinutes: minutes,
      riskClass,
    };
    runtime.pendingWorkOffer = {
      offerId: resolvedPlayerAction.workOfferId ?? workOfferId(runtime, specification),
      day: runtime.playerState.day,
      facilityId,
      actorNpcId: resolvedPlayerAction.targetNpcId,
      actorName: resolvedPlayerAction.targetNpcName,
      description,
      wage: Number(resolvedPlayerAction.quotedWage ?? deterministicWorkWage(runtime, specification)),
      minutes,
      riskClass,
      openedAtMinute: runtime.playerState.absoluteMinute,
    };
    result.summary = `${resolvedPlayerAction.targetNpcName ?? "相手"}から仕事内容と賃金を聞いた。引き受けるか選べる。`;
  }
  if (result.ok && resolvedPlayerAction?.workDecline) {
    runtime.pendingWorkOffer = null;
    runtime.dialogueSession = null;
    ensureNarrativeMemory(runtime).activityFocus = null;
    result.summary = "仕事は断り、別の行動を選ぶことにした。";
  }
  if (result.ok && resolvedPlayerAction?.type === "work") {
    // Ordinary employment changes time, money and the living world, but it is
    // not combat/training experience and must not become a leveling exploit.
    runtime.playerState.player.level = levelBefore;
    runtime.playerState.player.exp = expBefore;
    result.goldDelta = Number(runtime.playerState.player.gold ?? 0) - goldBefore;
    const memory = ensureNarrativeMemory(runtime);
    const completedWorkTitle = cleanText(resolvedPlayerAction.workDescription ?? "頼まれた仕事", 120);
    if (completedWorkTitle && !memory.recentWorkTitles.includes(completedWorkTitle)) {
      memory.recentWorkTitles.push(completedWorkTitle);
      if (memory.recentWorkTitles.length > 12) memory.recentWorkTitles.splice(0, memory.recentWorkTitles.length - 12);
    }
    memory.activityFocus = {
      intent: "work",
      locationId: runtime.playerState.player.location,
      recordedAtMinute: runtime.playerState.absoluteMinute,
    };
    const completedWork = recordCompletedWork(runtime, {
      offerId: resolvedPlayerAction.workOfferId,
      facilityId: resolvedPlayerAction.workFacilityId ?? runtime.playerState.player.facilityId,
      employerId: resolvedPlayerAction.workEmployerId ?? resolvedPlayerAction.sceneActorNpcId,
      title: completedWorkTitle,
      riskClass: resolvedPlayerAction.workRiskClass ?? "low",
      durationMinutes: Number(resolvedPlayerAction.minutes ?? 120),
      startedAtMinute: Number(resolvedPlayerAction.workStartedAtMinute
        ?? Math.max(0, runtime.playerState.absoluteMinute - Number(resolvedPlayerAction.minutes ?? 120))),
      completedAtMinute: runtime.playerState.absoluteMinute,
      wage: result.goldDelta,
    });
    result.workMarketEntry = completedWork;
    result.summary = `${completedWorkTitle}を終え、${result.goldDelta}Gの賃金を受け取った。`;
    runtime.pendingWorkOffer = null;
    runtime.dialogueSession = null;
  } else if (result.ok && resolvedPlayerAction
    && !resolvedPlayerAction.workOffer
    && !["WORK_CLARIFY"].some((prefix) => String(resolvedPlayerAction.id ?? "").startsWith(prefix))
    && !["TUTORIAL_ACK", "ACK_NPC_INTRODUCTION"].includes(command.type)) {
    const focus = ensureNarrativeMemory(runtime).activityFocus;
    if (focus?.intent === "work") ensureNarrativeMemory(runtime).activityFocus = null;
  }
  if (result.ok || result.committed === true) {
    revealFinnAfterRescueBattle(runtime, resolvedPlayerAction, result);
    activateFinnEscort(runtime, resolvedPlayerAction, result);
    followFinnDuringMovement(runtime, resolvedPlayerAction, result);
  }
  clearFinnEscortOnFailure(runtime);
  if (resolvedPlayerAction?.type === "move" && result.ok && !result.summary) {
    const destinationName = data.model.facilityById[resolvedPlayerAction?.destinationFacilityId]?.name
      ?? resolvedPlayerAction?.destinationHub
      ?? "目的地";
    result.summary = `${destinationName}へ移動した。`;
  }
  if (result.ok
    && resolvedPlayerAction?.type === "conversation"
    && resolvedPlayerAction.targetNpcId
    && !ensurePlayerKnowledge(runtime).knownNpcIds.has(resolvedPlayerAction.targetNpcId)) {
    const publicTarget = presentNpcsAt(runtime, data).find((npc) => npc.id === resolvedPlayerAction.targetNpcId);
    resolvedPlayerAction.firstIntroduction = true;
    resolvedPlayerAction.speakerLabelBeforeIntroduction = publicTarget?.name ?? "見知らぬ人物";
    const introducedNpc = data.model.npcById?.[resolvedPlayerAction.targetNpcId]
      ?? data.model.npcs.find((npc) => npc.id === resolvedPlayerAction.targetNpcId);
    if (introducedNpc?.name) {
      resolvedPlayerAction.introductionName = introducedNpc.name;
      resolvedPlayerAction.targetNpcName = introducedNpc.name;
    }
  }
  if (result.ok && ["CHOOSE", "MOVE"].includes(command.type)) progressTutorial(runtime, resolvedPlayerAction, result);
  if (result.ok && resolvedPlayerAction?.type === "move") discoverArrival(runtime, data);
  applyPlayerWorldInterventions(runtime, previousTroubleStates);
  advanceLivingWorld(runtime, runtime.playerState.absoluteMinute);
  reconcileOpeningCrisis(runtime);
  stabilizeOpeningTutorialCast(runtime);
  syncAuthoritativePresentNpcIds(runtime, data);
  if (["conversation", "observe", "localInvestigate", "wait"].includes(resolvedPlayerAction?.type)
    && !resolvedPlayerAction?.tutorialBeat
    && (!runtime.tutorial || runtime.tutorial.stage === "free")) {
    result.learnedRumorIds = learnLocalLivingRumors(
      runtime,
      data,
      resolvedPlayerAction,
      ["observe", "localInvestigate"].includes(resolvedPlayerAction.type) ? 3 : 1,
    );
    result.advancedMissionIds = applyLocallyLearnedRumorsToMissionHearSteps(runtime, result.learnedRumorIds);
  }
  if (deferredMissionConversation) {
    const learnedRumorIds = result.learnedRumorIds ?? [];
    result = journey.settleMissionConversationAction(
      runtime.playerState,
      data.model,
      data.battleData,
      data.skills,
      runtime.playerState.catalog,
      profileFor(runtime.playerState.profileId),
      resolvedPlayerAction,
      deferredMissionConversation,
    );
    result.learnedRumorIds = learnedRumorIds;
    runtime.playerState.metrics.actions += 1;
  }
  const equipmentAccessChanges = reconcileEquipmentAccessAfterCommand(runtime, data, completedMissionIdsBefore);
  if (equipmentAccessChanges.rewards.length) {
    result.equipmentRewardOffers = equipmentAccessChanges.rewards.map((reward) => ({
      rewardId: reward.rewardId,
      missionId: reward.missionId,
      missionTitle: reward.missionTitle,
      equipmentId: reward.equipmentId,
      equipmentName: reward.equipmentName,
    }));
    const names = equipmentAccessChanges.rewards.map((reward) => reward.equipmentName).join("、");
    result.summary = (result.summary ? result.summary + " " : "") + "依頼報酬として受け取れる装備が用意された：" + names + "。";
  }
  if (equipmentAccessChanges.returns.length) {
    result.equipmentLoanReturns = equipmentAccessChanges.returns.map((entry) => ({
      loanId: entry.loanId,
      equipmentId: entry.equipmentId,
      depositRefunded: entry.depositRefunded,
    }));
    const refund = equipmentAccessChanges.returns.reduce((sum, entry) => sum + Number(entry.depositRefunded ?? 0), 0);
    result.summary = (result.summary ? result.summary + " " : "") + "依頼用の借用品を返却し、保証金" + refund + "Gが戻った。";
  }
  if (resolvedPlayerAction?.firstIntroduction && resolvedPlayerAction.targetNpcId) {
    const targetPresent = runtime.playerState.authoritativePresentNpcIds instanceof Set
      && runtime.playerState.authoritativePresentNpcIds.has(resolvedPlayerAction.targetNpcId);
    if (targetPresent && resolvedPlayerAction.introductionName) {
      const token = sha256([
        runtime.playerState.seed,
        resolvedPlayerAction.id,
        resolvedPlayerAction.targetNpcId,
        runtime.playerState.absoluteMinute,
      ].join(":"));
      runtime.pendingNpcIntroduction = {
        token,
        npcId: resolvedPlayerAction.targetNpcId,
        canonicalName: resolvedPlayerAction.introductionName,
        anonymousLabel: resolvedPlayerAction.speakerLabelBeforeIntroduction ?? "見知らぬ人物",
        sourceActionId: resolvedPlayerAction.id,
      };
      resolvedPlayerAction.introductionToken = token;
    } else {
      resolvedPlayerAction.firstIntroduction = false;
      resolvedPlayerAction.introductionName = null;
      resolvedPlayerAction.introductionToken = null;
      resolvedPlayerAction.speakerLabelBeforeIntroduction = null;
    }
  }
  updateDialogueSession(runtime, resolvedPlayerAction);
  expireDialogueSession(runtime);
  runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
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

function t01NarrativeRelevant(runtime, resolvedAction, missions) {
  if (runtime.playerState.player.location !== "田園の村") return false;
  if (resolvedAction?.missionId === "MSN-T01" || /^t01_/u.test(String(resolvedAction?.dialogueTopic ?? ""))) return true;
  return missions.some((mission) => mission.id === "MSN-T01" && mission.status === "active");
}

function relevantMissionLeadTexts(runtime, missions) {
  const visibleTroubleIds = new Set(missions.map((mission) => mission.troubleId).filter(Boolean));
  const locationId = runtime.playerState.player.location;
  const facilityId = runtime.playerState.player.facilityId;
  return ensureNarrativeMemory(runtime).missionLeads
    .filter((lead) => (!lead.troubleId || visibleTroubleIds.has(lead.troubleId))
      && (!lead.locationId || lead.locationId === locationId || lead.facilityId === facilityId))
    .slice(-6)
    .map((lead) => lead.summary)
    .filter(Boolean);
}

function narrativeContinuityContract(runtime, actions) {
  const focus = ensureNarrativeMemory(runtime).activityFocus;
  if (focus?.intent !== "work") {
    return { mode: "free", intent: null, candidateIds: [], rationale: null };
  }
  const candidates = actions.filter((action) => action.workOffer === true || action.type === "work");
  return {
    mode: candidates.length ? "must_offer_continuation" : "free",
    intent: "仕事を続ける",
    candidateIds: candidates.map((action) => action.id),
    rationale: candidates.length
      ? "直前に仕事を続ける意思を示しているため、同じ活動を継続できる道を一つ残す"
      : "この場では依頼主または実行可能な仕事を確認できない",
  };
}

function narrativeReactionContract(resolvedAction, presentNpcIds) {
  const present = new Set(presentNpcIds);
  if (resolvedAction?.dialogueTopic === "t01_rescue_aftermath") {
    return {
      requiredActorIds: ["NPC001"].filter((id) => present.has(id)),
      goals: ["救助された本人が名乗る", "負傷して一人では歩けないことを伝える", "村へ戻るため同行を頼む"],
    };
  }
  if (resolvedAction?.dialogueTopic === "t01_escort") {
    return {
      requiredActorIds: ["NPC001"].filter((id) => present.has(id)),
      goals: ["負傷した本人が一人では歩けないことを伝える", "村へ戻りたい希望を伝える", "同行を自分の言葉で頼む"],
    };
  }
  if (resolvedAction?.dialogueTopic === "t01_reunion") {
    return {
      requiredActorIds: ["NPC001", "NPC002", "NPC003"].filter((id) => present.has(id)),
      goals: ["帰還した本人が無事を伝える", "家族が再会へ反応する", "村の責任者が救助と同行へ礼を述べる"],
    };
  }
  return { requiredActorIds: [], goals: [] };
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
      const knownRumor = state.rumors
        .filter((rumor) => rumor.troubleId === definition.troubleId && state.player.knownRumorIds.has(rumor.id))
        .sort((left, right) => Number(right.originMinute ?? 0) - Number(left.originMinute ?? 0))[0] ?? null;
      const discoveryReason = definition.id === "MSN-T01"
        ? "村の広場で、ミラがフィンを捜していることと捜索の期限を聞いたため"
        : knownRumor?.text
          ? `${knownRumor.sourceNpcName ? `${knownRumor.sourceNpcName}から` : knownRumor.origin ? `${knownRumor.origin}で` : "現地で"}「${cleanText(knownRumor.text, 180)}」と知ったため`
          : "現地で困っている人や異変の手掛かりに触れたため";
      return [{
        id: definition.id,
        kind: definition.kind,
        troubleId: definition.troubleId ?? null,
        title: definition.title,
        status: current.status,
        optional: definition.kind === "special" && !state.progress.missions.attemptedTroubleIds.has(definition.troubleId),
        discoveryReason,
        discoverySource: knownRumor?.sourceNpcName ?? knownRumor?.origin ?? null,
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
        discoveries: Array.isArray(current.discoveries)
          ? current.discoveries.map((discovery) => ({
            id: cleanText(discovery.id, 120),
            text: cleanText(discovery.text, 500),
            stepId: cleanText(discovery.stepId, 80) || null,
            stage: Number.isFinite(Number(discovery.stage)) ? Number(discovery.stage) : null,
            approachId: cleanText(discovery.approachId, 80) || null,
            discoveredAtMinute: Number(discovery.discoveredAtMinute ?? 0),
          }))
          : [],
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
  const knownNpcIds = ensurePlayerKnowledge(runtime).knownNpcIds;
  return state.rumors
    .filter((rumor) => state.player.knownRumorIds.has(rumor.id))
    .slice(-30)
    .reverse()
    .map((rumor) => {
      const sourceNpcLabel = rumor.sourceNpcId && knownNpcIds.has(rumor.sourceNpcId)
        ? rumor.sourceNpcName
        : rumor.sourceNpcAnonymousLabel ?? (rumor.sourceNpcId ? "その人物" : null);
      return {
        id: rumor.id,
        troubleId: rumor.troubleId,
        text: rumor.text,
        origin: rumor.origin,
        originMinute: rumor.originMinute,
        importance: rumor.importance,
        source: sourceNpcLabel ? `${sourceNpcLabel}から聞いた` : rumor.sourceType === "local-observation" ? "現地で確かめた" : null,
        sourceNpcId: rumor.sourceNpcId ?? null,
      };
    });
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
      choices: tutorial.stage !== "movement",
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
    title: "気になる行動を選んでみよう",
    body: "3つの中から、今したいことを一つタップ。",
    progressLabel: "導入 1 / 5",
    emphasisTarget: "choices",
  };
  if (tutorial.stage === "first_contact") return {
    ...base,
    id: "first-conversation",
    title: "返事を選んでみよう",
    body: "知りたいこと、伝えたいことを一つ選ぶ。",
    progressLabel: "導入 2 / 5",
    emphasisTarget: "choices",
  };
  if (tutorial.stage === "orientation") return {
    ...base,
    id: "conversation-depth",
    title: "もう一つ聞いてみよう",
    body: "答えの続きから、次の手掛かりを選ぶ。",
    progressLabel: "導入 3 / 5",
    emphasisTarget: "choices",
  };
  if (tutorial.stage === "movement") return {
    ...base,
    id: "first-movement",
    title: "村の広場へ向かおう",
    body: "画面上部の現在地を開き、「村の広場」を選ぶ。",
    progressLabel: "導入 4 / 5",
    actionLabel: "移動先を見る",
    actionPanel: "movement",
    emphasisTarget: "movement",
  };
  if (tutorial.stage === "mission_intro") return {
    ...base,
    id: "discover-trouble",
    title: "関わり方を選ぼう",
    body: "捜索を手伝う、仕事をする、村を離れる。どれを選んでも旅は続く。",
    progressLabel: "導入 5 / 5",
    emphasisTarget: "choices",
  };
  if (tutorial.stage === "movement_aftermath") return {
    ...base,
    id: "world-keeps-moving",
    visible: false,
    title: null,
    body: null,
    progressLabel: null,
    emphasisTarget: null,
  };
  if (tutorial.stage === "aftermath_intro") return {
    ...base,
    id: "trouble-aftermath",
    visible: false,
    title: null,
    body: null,
    progressLabel: null,
    emphasisTarget: null,
  };

  const acknowledged = tutorial.acknowledged;
  const missions = missionView(runtime, data);
  const t01 = missions.find((mission) => mission.id === "MSN-T01" && ["active", "available", "in_progress"].includes(mission.status));
  if (t01 && !acknowledged.has("mission-log")) {
    const engaged = runtime.playerState.progress.missions.attemptedTroubleIds.has("T01");
    return {
      ...base,
      id: "mission-log",
      title: engaged ? "引き受けた捜索を記録した" : "広場で知った困り事を記録した",
      body: engaged
        ? "右上の巻物を開くと、目的と期限をいつでも確認できる。"
        : "巻物には期限と状況だけが残る。助ける、仕事をする、村を離れる――関わり方は自分で選べる。",
      progressLabel: "旅の記録",
      actionLabel: "記録を確認",
      actionPanel: "missions",
      acknowledgeable: true,
      emphasisTarget: "missions",
    };
  }
  const atFirstSearchArea = runtime.playerState.player.facilityId === "LOC_FARM_EDGE";
  if (atFirstSearchArea && runtime.playerState.player.skills.size === 0) return {
    ...base,
    id: "skills",
    title: "戦う前に技を確認しよう",
    body: "右上の能力を開き、①おすすめを見る ②必要SPを確認 ③取得を押す。取得せず進むこともできる。",
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
    title: "準備ができたら、捜索を続けよう",
    body: "戦闘では、攻撃・スキル・防御・逃走を自分で選ぶ。",
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
  if (stage === "first_contact") return {
    kicker: "いま話していること",
    title: "麦畑で出会った女性に応える",
    detail: "返答を選び、相手が誰なのか、ここがどこなのかを確かめる。",
    targetFacilityId: null,
    targetFacilityName: null,
    deadlineLabel: null,
    actionPanel: null,
  };
  if (stage === "orientation") return {
    kicker: "いま話していること",
    title: "エダに、もう一つだけ尋ねる",
    detail: "今いちばん知りたいことを選び、その答えを聞く。",
    targetFacilityId: null,
    targetFacilityName: null,
    deadlineLabel: null,
    actionPanel: null,
  };
  if (stage === "movement") return {
    kicker: "次の一歩",
    title: "村の広場へ移動する",
    detail: "上の現在地を開き、エダについて「村の広場」へ向かう。",
    targetFacilityId: "LOC_FARM_SQUARE",
    targetFacilityName: facilityName("LOC_FARM_SQUARE"),
    deadlineLabel: null,
    actionPanel: "movement",
  };
  if (stage === "mission_intro") return {
    kicker: "広場で起きていること",
    title: "広場の出来事に、どう関わるか決める",
    detail: "捜索を手伝う、先に仕事を探す、王都への道を選ぶ。どれを選んでも旅は続く。",
    targetFacilityId: "LOC_FARM_SQUARE",
    targetFacilityName: facilityName("LOC_FARM_SQUARE"),
    deadlineLabel: null,
    actionPanel: null,
  };
  if (stage === "movement_aftermath") return {
    kicker: "時間が残した結果",
    title: "村の広場で、終わった捜索を確かめる",
    detail: "捜索隊が戻ったらしい。現在地から村の広場へ向かう。",
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
    const targetName = step?.targetFacilityName ?? mission.targetFacilityName ?? null;
    const stepLabel = step?.label ?? "次の手掛かりを探す";
    const mustMove = Boolean(targetFacilityId && targetFacilityId !== runtime.playerState.player.facilityId);
    return {
      kicker: "現在の目的",
      title: mustMove && targetName ? `${targetName}へ：${stepLabel}` : stepLabel,
      detail: mustMove
        ? `「${mission.title}」の手掛かりは${targetName ?? "別の場所"}にある。`
        : `「${mission.title}」を進めるため、${stepLabel}。`,
      targetFacilityId: targetFacilityId ?? null,
      targetFacilityName: targetName,
      deadlineLabel: mission.deadlineLabel,
      actionPanel: mustMove ? "movement" : null,
    };
  }
  return {
    kicker: "自由行動",
    title: "気になる場所と人を、自分の順番で訪ねる",
    detail: "今いる場所で人に話を聞くか、現在地から別の場所へ向かえる。",
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
  if (actionType === "SHOP_TRY" || actionType === "SHOP_TRIAL") return "店主の見守る前で装備を構え、今の装備との重さや扱いやすさを比べた。所有権と代金は動いていない。";
  if (actionType === "SHOP_BUY_USED") return "使い込まれた箇所と手入れの状態を確かめ、中古品として受け取った。";
  if (actionType === "SHOP_BORROW") return "依頼中だけ使う約束と返却条件を確認し、装備を借り受けた。";
  if (actionType === "SHOP_RETURN_LOAN") return "借りていた装備を返却し、預けていた保証金を受け取った。";
  if (actionType === "CLAIM_EQUIPMENT_REWARD") return "依頼への働きが認められ、報酬の装備を受け取った。";
  if (actionType === "LEARN_SKILL") return "積み重ねた経験が、使える技として形になった。";
  return "ひと通り行動を終える頃には、人の流れと空の色が少し変わっていた。";
}

function playerUtterance(action) {
  if (!action || action.type !== "conversation") return null;
  const authored = {
    "contact:where": "ここは、どこですか？",
    "contact:memory": "ここは、私の知っている世界ではありません。",
    "contact:who": "その前に、あなたの名前を教えてください。",
    "orient:voices": "さっきから聞こえる呼び声は、何ですか？",
    "orient:found": "私は、どんな状態で見つかったんですか？",
    "orient:help": "水を少し。それから、落ち着ける場所はありますか？",
    "inquiry:garo": "すみません。誰が、いつからいなくなったのか教えてください。",
    "inquiry:mira": "捜しているのは、あなたのご家族ですか？",
    "inquiry:coby": "何か知っているなら、怒らないから話してくれる？",
  }[action.tutorialBeat];
  if (authored) return authored;
  const topicLine = {
    mission_clue: `「${action.missionTitle ?? "この異変"}」について、あなたが確かに知っている手掛かりを教えてください。`,
    active_mission: "この件について、次に何を確かめるべきか教えてください。",
    route_to_lead: "手掛かりのある場所までの道と、途中の危険を教えてください。",
    local_concern: "この辺りでは、今いちばん何に困っていますか？",
    local_change: "最近ここで、普段と違う人や物を見ませんでしたか？",
    personal_stake: "あなたがこの問題を気にかけている理由を、聞いてもいいですか？",
    local_rumor: "今聞いた話は、いつ、どこで知ったものですか？",
    work_offer: "私にも手伝える仕事はありますか？　内容と賃金を先に教えてください。",
    t01_escort: "フィン、聞こえる？　歩けそう？　村まで一緒に戻ろう。",
    end_conversation: "ありがとう。教えてもらったことを確かめてきます。",
  }[action.dialogueTopic];
  if (topicLine) return topicLine;
  const quoted = String(action.label ?? "").match(/「([^」]+)」/u)?.[1];
  if (quoted) return quoted;
  if (/話しかける|話を聞く/u.test(String(action.label ?? ""))) return "少し、お話を聞かせてもらえますか？";
  return `${String(action.label ?? "この辺りのこと")
    .replace(/(?:について)?(?:詳しく)?(?:尋ねる|聞く|話す)$/u, "")
    .replace(/[。、]+$/u, "")
    .trim()}について、教えてもらえますか？`;
}

function presentationWithOrderedBeats(runtime, data, action, presentation) {
  const beats = [];
  const utterance = playerUtterance(action);
  if (utterance) beats.push({ kind: "player", actorId: null, speakerLabel: "あなた", text: utterance });
  if (presentation.narrative) beats.push({ kind: "narration", actorId: null, speakerLabel: null, text: presentation.narrative });
  let introductionLabelPending = Boolean(action?.firstIntroduction && action?.speakerLabelBeforeIntroduction);
  for (const speech of presentation.speeches ?? []) {
    const isIntroducingTarget = introductionLabelPending && speech.actorId === action?.targetNpcId;
    const introductionToken = isIntroducingTarget
      && action?.introductionToken
      && action?.introductionName
      && speech.text.includes(action.introductionName)
      && runtime.pendingNpcIntroduction?.token === action.introductionToken
      ? action.introductionToken
      : null;
    beats.push({
      kind: "npc",
      actorId: speech.actorId,
      speakerLabel: isIntroducingTarget ? action.speakerLabelBeforeIntroduction : null,
      text: speech.text,
      emotion: speech.emotion ?? null,
      introductionToken,
      introductionNpcId: introductionToken ? action.targetNpcId : null,
    });
    if (isIntroducingTarget) introductionLabelPending = false;
  }
  return { ...presentation, beats };
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
      "contact:who": "ああ、先に名乗るべきだったね。あたしはエダ、この村で畑をやってる。あんたを縛る気も、役人へ突き出す気もないよ。顔色が心配なだけさ。",
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
        { actorId: "NPC004", text: "村の広場は、この道の先だよ。あたしも戻るところだから、一緒に行こう。人が集まっているなら、事情を知ってる者もいるはずさ。", emotion: "促す" },
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
        { actorId: "NPC003", text: "……間に合わなかった。捜索の記録は残してある。聞く覚悟があるなら、私が知る限りを話そう。", emotion: "疲労" },
      ],
    };
  }
  if (beat === "deadline:aftermath") {
    return {
      narrative: "事情を聞いている間に、村外れの方角から鐘が鳴った。ほどなく泥だらけの捜索隊が戻り、その後ろに布を掛けた担架が続いた。広場のざわめきが、ひと息で消えた。",
      speeches: [
        { actorId: "NPC003", text: "……捜索隊が戻った。フィンは救えず、先へ出た者にも重傷者がいる。今から話すのは、もう捜索ではなく、その結末だ。", emotion: "沈痛" },
      ],
    };
  }
  if (tutorial.stage === "mission_intro") {
    return {
      narrative: "人々の言葉は断片的で、まだ全体が見えない。泣きそうな女性、捜索を指揮する村長、何かを隠すように俯く少年。三人は、互いに違うことを知っているようだ。",
      speeches: [],
    };
  }
  if (tutorial.stage === "aftermath_intro") {
    return {
      narrative: "ミラは古い地図を握り、コビーは村外れの道を見つめ、ガロは濡れた捜索記録を閉じている。誰も、こちらから声をかけるまでは口を開かなかった。",
      speeches: [],
    };
  }
  if (beat?.startsWith("inquiry:")) {
    const presentation = {
      "inquiry:garo": {
        narrative: "年配の男は地面に簡単な地図を描き、捜索済みの道と、まだ誰も戻っていない村外れを指した。話す前に一度息を整え、こちらへ向き直る。",
        speeches: [
          { actorId: "NPC003", text: "私はガロ、この村の村長だ。消えたのはフィン、十二歳の少年だ。朝から戻らん。古い見張り小屋へ続く道が手薄だが、あの辺りは獣も出る。日が二度落ちる前には見つけねばならん。", emotion: "厳しい" },
          { actorId: "NPC004", text: "あんたは来たばかりだ。無理に背負わなくていい。けど村外れへ出るなら、獣の足跡と藪の音には気をつけな。", emotion: "気遣う" },
        ],
      },
      "inquiry:mira": {
        narrative: "女性は握りしめていた小さな布切れを見せる。声は震えているが、息子のことを一つずつ話そうとする。",
        speeches: [
          { actorId: "NPC002", text: "私はミラです。捜しているのは息子のフィン。冒険家になりたいって、いつも村の外へ憧れていて……今朝、古い地図までなくなっていました。どうか、村外れの道を見てください。", emotion: "懇願" },
          { actorId: "NPC004", text: "ミラ、息をして。話してくれて助かったよ。見張り小屋の道なら、広場から村外れへ出られる。", emotion: "支える" },
        ],
      },
      "inquiry:coby": {
        narrative: "少年の前に屈んで待つ。責める声が来ないと分かるまで、少年は何度も唇を噛んだ。やがて小さな声で話し始める。",
        speeches: [
          { actorId: "NPC062", text: "ぼくはコビー。フィンが昨日……古い見張り小屋を見つけたら、本物の冒険家になれるって言ってたのに、止めなかった。村外れの細い道を知ってるんだ。", emotion: "後悔" },
          { actorId: "NPC003", text: "重要な手掛かりだ。今話した勇気まで、誰も責めはせん。", emotion: "落ち着かせる" },
        ],
      },
    }[beat];
    return presentation;
  }
  if (beat?.startsWith("aftermath:")) {
    const presentation = {
      "aftermath:garo": {
        narrative: "年配の男は捜索記録を閉じ、見つかった時刻と、村外れで負傷した者のことを一つずつ説明しようとする。",
        speeches: [{ actorId: "NPC003", text: "私はガロ、この村の村長だ。フィンを見つけた時には、もう息がなかった。北の道へ人を回す決断が遅れた。先へ出た者まで重傷を負わせたのは、村長である私の責任だ。", emotion: "悔恨" }],
      },
      "aftermath:mira": {
        narrative: "女性の隣に座ってもしばらく言葉はなく、握りしめた古い地図が震える音だけが聞こえた。やがて女性は顔を上げる。",
        speeches: [{ actorId: "NPC002", text: "私はミラです。あの子は、帰ってきませんでした。朝、地図がないと気づいた時に、もっと強く引き止めていれば……。ごめんなさい。今は、あの子の話をする声さえ出ないんです。", emotion: "悲嘆" }],
      },
      "aftermath:coby": {
        narrative: "少年は村外れへ続く道を見つめたまま、途切れ途切れに昨日の約束を話し始める。",
        speeches: [{ actorId: "NPC062", text: "ぼくはコビー。見張り小屋へ行くって、ぼくは知ってた。怒られるのが怖くて黙ってた。フィンが戻らないって分かってから言っても、もう遅かった。", emotion: "後悔" }],
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
  if (resolved?.type === "investigate") {
    const discovery = cleanText(outcome?.discovery?.text ?? outcome?.summary, 500);
    const t01SearchProgress = resolved?.missionId === "MSN-T01" && resolved?.stepId === "search"
      ? Number(runtime.playerState.missions?.["MSN-T01"]?.progress?.search ?? 0)
      : 0;
    if (resolved?.discoveryId === "T01-CLUE-FAINT-VOICE" || t01SearchProgress >= 2) {
      const discoveryLead = discovery || "風の切れ間に、斜面の下から子どもの弱い声が届いた。";
      return {
        narrative: `${discoveryLead}　その時、斜面の下から「だれか……いるの？　狼が……」という途切れた声が返る。フィンはまだ生きている。`,
        speeches: [],
      };
    }
    if (discovery && discovery !== "行動の結果が世界へ反映された。") {
      return { narrative: discovery, speeches: [] };
    }
    return {
      narrative: `${cleanText(resolved.label, 180) || "現場を調べた"}。しかし、確かな新情報までは得られなかった。別の方法か場所を選ぶ必要がある。`,
      speeches: [],
    };
  }
  if (outcome?.battle?.won === true) {
    if (resolved?.missionId === "MSN-T01" && resolved?.stepId === "rescue") {
      return {
        narrative: "赤牙狼が地に伏すと、斜面の下から咳き込む声が返った。泥だらけの少年は脚を押さえたまま、こちらを見上げる。",
        speeches: [{ actorId: "NPC001", text: "……聞こえた？　僕、フィン。来てくれてありがとう。足が動かないんだ。置いていかないで……村の広場まで、一緒に戻ってほしい。", emotion: "安堵と痛み" }],
      };
    }
    return {
      narrative: "最後の敵が退き、張り詰めていた気配がほどける。傷と周囲を確かめ、戦いの目的だった人や手掛かりへ向き直った。",
      speeches: [],
    };
  }
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
    const escort = ensureT01EscortState(runtime);
    if (facilityId === "LOC_FARM_SQUARE"
      && escort.reunionBeatAtMinute === runtime.playerState.absoluteMinute) {
      return {
        narrative: "フィンに肩を貸して広場へ入ると、捜索の相談をしていた人々が一斉に振り向く。ミラが名前を呼びながら駆け寄り、村長も張り詰めていた息を吐いた。次の行動を選ぶ前に、フィンは自分の足で帰れたことを家族へ伝える。",
        speeches: [
          { actorId: "NPC001", text: "母さん……ただいま。怖かったけど、この人が狼を倒して、ここまで連れてきてくれたんだ。", emotion: "涙ぐむ" },
          { actorId: "NPC002", text: "フィン……！　よかった、本当によかった……。連れ帰ってくださって、ありがとうございます。", emotion: "安堵" },
          { actorId: "NPC003", text: "無事に戻ったか。旅人殿、救出だけでなく帰路まで支えてくれたこと、村を預かる者として礼を言う。", emotion: "感謝" },
        ],
      };
    }
    const facilityName = data.model.facilityById[facilityId]?.name ?? runtime.playerState.player.location;
    const narrative = {
      LOC_FARM_FIELD: "家並みを離れると、風に鳴る麦の海が再び視界を満たす。畑の道には、さっきまでなかった足跡も刻まれている。",
      LOC_FARM_SQUARE: "村の広場へ入る。掲示板の前を人が行き交い、耳を澄ませば今この土地で起きていることが断片的に聞こえてくる。",
      LOC_FARM_EDGE: "家並みが途切れ、草に埋もれた道が古い見張り小屋の方角へ伸びている。獣の気配に備えながら進む場所だ。",
    }[facilityId] ?? `${facilityName}へ着いた。人の流れと周囲の様子を確かめ、ここで次に何をするか選べる。`;
    return { narrative, speeches: [] };
  }
  if (resolved?.type === "eat") {
    return {
      narrative: outcome?.meal?.hungerReduced
        ? "温かい食事を取り、空腹が和らいだ。次に歩けるだけの力が戻るまで腰を落ち着けた。"
        : "食事を取り、次の行動に備えた。",
      speeches: [],
    };
  }
  if (resolved?.type === "rest") {
    return {
      narrative: resolved.lodging
        ? "戸を閉められる寝床を確保し、装備を手の届く所へ置いて横になる。目を覚ます頃には、身体の重さが抜けていた。"
        : "風と人目を避けられる場所を選び、荷物を抱えたまま短く身体を休める。宿ほど深くは眠れないが、歩き続けるよりはましだ。",
      speeches: [],
    };
  }
  if (["work", "localInvestigate", "wait", "plan"].includes(resolved?.type)) {
    const facilityId = runtime.playerState.player.facilityId;
    const present = presentNpcsAt(runtime, data);
    const actor = present.find((npc) => npc.id === resolved.sceneActorNpcId) ?? present[0] ?? null;
    if (resolved.type === "work") {
      const wage = Math.max(0, Number(outcome?.goldDelta ?? 0));
      const narrative = {
        LOC_FARM_FIELD: `畝の間へ入り、刈った麦を束ねて荷車まで運ぶ。慣れない手つきを笑う者はいない。汗が乾く頃、仕事の区切りがついた。`,
        LOC_FARM_SQUARE: `広場で荷下ろしを待つ荷車を見つけ、穀袋を共同倉庫の軒下まで運ぶ。誰の荷をどこへ置くか、村の世話役が一つずつ教えた。`,
        LOC_FARM_INN: `麦穂亭の裏へ回り、山積みの皿を洗い、薪を厨房まで運ぶ。客席の会話が途切れる頃、最後の卓も片づいた。`,
        LOC_FARM_BAKERY: `粉袋を運び、窯へ入れる薪を長さごとに分ける。焼けた小麦の匂いの中で、店の忙しさが少しだけ和らいだ。`,
        LOC_FARM_WELL: `井戸と家々を何度も往復し、水桶を必要な場所へ届ける。縄の重さと、村で水がどれほど大切かを体で知った。`,
      }[facilityId] ?? `頼まれた荷運びと片づけを終える。土地のやり方を教わりながら働き、短い仕事の区切りをつけた。`;
      const speeches = actor ? [{ actorId: actor.id, text: `助かったよ。これは今日の分、${wage}Gだ。無理をせず、別の日にまた声をかけな。`, emotion: "感謝" }] : [];
      return { narrative, speeches };
    }
    if (resolved.type === "localInvestigate") {
      const variant = Number(resolved.localVariant ?? 0) % 3;
      const narratives = {
        LOC_FARM_FIELD: [
          "倒れた麦は一か所を中心に外へ向かって伏せている。歩いて入った跡ではなく、上から強い風圧を受けたような形だ。",
          "畑の縁を一周すると、大人の靴跡は農道へ戻る一方、小さな裸足の跡だけが用水路の方角で途切れている。",
          "穂の先に焼け跡はなく、茎だけが同じ高さで傷んでいる。火ではなく、大きな何かが低く通り抜けた痕に見える。",
        ],
        LOC_FARM_SQUARE: [
          "掲示板には古い売買札に混じって、捜索人員を募った紙の剥がし跡がある。広場を急ぐ者は、皆同じ村外れを気にしていた。",
          "荷車の札を見比べると、パン屋へ向かう粉だけが予定より少ない。御者は、街道の遅れではなく共同穀倉の都合だと話した。",
          "同じ噂でも『今朝見た』と言う者と『昨夜聞いた』と言う者がいる。発生源に近いのは、夜の宿にいた人物らしい。",
        ],
        LOC_FARM_INN: [
          "客席の泥は街道の赤土と、村外れの黒い土が混じっている。夜明け前に外から戻った客がいたらしい。",
          "宿帳の公開欄には夜明け前の出立が一件あるが、食事の数は宿泊者より一人分多い。記録にない客が席を使ったようだ。",
          "三つの卓で同じ話が繰り返されているが、誰も自分が見たとは言わない。話は厨房側の席から広がったらしい。",
        ],
        LOC_FARM_BAKERY: [
          "棚の端だけ値札が書き直され、保存用のパンが先に減っている。誰かが、普段より長く外へ出る支度をしている。",
          "納品札と粉袋を数えると、届かなかった一袋が帳面では受領済みになっている。配達の途中か、受け取り後に消えたことになる。",
          "保存パンをまとめて買ったのは村の者だが、受け取り先は家ではなく広場だった。捜索か長旅の準備に使われたようだ。",
        ],
        LOC_FARM_WELL: [
          "井戸縄の一部だけが新しく毛羽立ち、水面までの長さを示す結び目が昨日の印より下へ来ている。わずかだが、水位が落ちている。",
          "二つの桶から水を皿へ移すと、一方だけ細かな黒い粒が沈んだ。井戸そのものではなく、特定の桶か汲んだ時間に原因がありそうだ。",
          "列を数えると、共同穀倉から来た水桶だけが普段の倍になっている。火の用心か、別の用途で水を蓄えているらしい。",
        ],
        LOC_FARM_GRANARY: [
          "穀袋の列に、人ひとりが通れる不自然な隙間がある。床には麦粒だけでなく、油を拭ったような黒い筋が残っていた。",
          "帳簿の数より袋が一つ少ない。破れた麦粒の筋は出口ではなく、奥の壁際で急に途切れている。",
          "扉の金具には新しい油が差されているのに、灯り用の油壺は口だけ汚れている。別の容器へ移した者がいる。",
        ],
        LOC_FARM_EDGE: [
          "折れた草は見張り小屋の方へ続き、小さな靴跡に重なるように獣の爪痕が刻まれている。時間が経つほど追跡は難しくなる。",
          "爪痕は小さな靴跡を追うように現れ、途中から横へ回り込んでいる。獣は偶然通ったのではなく、獲物として追っていた。",
          "道端の枝に、子どもの上着と同じ色の糸が残っている。その先は見張り小屋ではなく、崩れた斜面へそれていた。",
        ],
      };
      const narrative = narratives[facilityId]?.[variant]
        ?? `${data.model.facilityById[facilityId]?.name ?? "この場所"}を歩き、普段の使われ方と今だけ違う痕跡を一つ見つけた。`;
      const speeches = actor && facilityId === "LOC_FARM_WELL"
        ? [{ actorId: actor.id, text: "その結び目、あたしも気になってたんだよ。昨日より桶が水へ届くまで長くかかる。気のせいで済めばいいけどね。", emotion: "懸念" }]
        : [];
      return { narrative, speeches };
    }
    if (resolved.type === "plan") {
      const mission = missionView(runtime, data).find((entry) => ["active", "available", "in_progress"].includes(entry.status));
      return {
        narrative: mission?.currentStep
          ? `知っている噂と記録を並べる。今の目的は「${mission.currentStep.label}」。期限は${mission.deadlineLabel ?? "まだ余裕がある"}。現地へ急ぐか、情報や装備を増やすかを選べる。`
          : "聞いた噂を、発生した場所・聞いた相手・時刻に分けて整理する。まだ確かな依頼はないが、人が集まる場所と未訪問の土地が次の候補として残った。",
        speeches: [],
      };
    }
    const minuteBand = Math.floor(runtime.playerState.absoluteMinute / 15) % 3;
    const narrative = facilityId === "LOC_FARM_WELL"
      ? [
        "桶が石縁へ当たる音のあと、村人たちは水の濁りを確かめてから家ごとの壺へ分け始めた。井戸端は、ただ立ち止まる場所ではなく生活の順番が見える場所だ。",
        "しばらくすると空の桶を抱えた子どもが駆け込み、大人が列を譲った。水を汲む回数と家族の人数が、会話の端から分かる。",
        "日が傾くにつれ、井戸を訪れる顔ぶれが畑仕事の者から宿の者へ変わった。交わされる話題も、収穫から今夜の旅人へ移っていく。",
      ][minuteBand]
      : `少し待つうちに、${data.model.facilityById[facilityId]?.name ?? "この場所"}を使う人と運ばれる物が入れ替わった。誰がどの道から来たかを確かめ、次に声をかける相手を見定める。`;
    const speeches = actor ? [{ actorId: actor.id, text: "待っていたのかい？　今なら少し手が空いたよ。聞きたいことがあるなら、分かる範囲で話そう。", emotion: "応対" }] : [];
    return { narrative, speeches };
  }
  if (resolved?.type !== "conversation" || !resolved.targetNpcId) {
    return { narrative: fallback, speeches: [] };
  }
  const npc = presentNpcsAt(runtime, data).find((entry) => entry.id === resolved.targetNpcId);
  if (!npc) return { narrative: fallback, speeches: [] };
  const activeMission = missionView(runtime, data).find((mission) => mission.status === "active");
  const learnedFromNpc = resolved.requiredDisclosure
    ?? rumorView(runtime).find((rumor) => rumor.sourceNpcId === npc.id)?.text;
  const facilityName = data.model.facilityById[runtime.playerState.player.facilityId]?.name ?? "この辺り";
  const subject = cleanText(resolved.label, 100) || "今の話";
  const coreLine = {
    mission_clue: learnedFromNpc
      ? `${learnedFromNpc}。これは私が確かに知っていることだ。いつ、どこで見聞きしたかも、順に説明しよう。`
      : `その件について確かな手掛かりを持っている者は、今ここにはいない。別の時間か場所で聞いてほしい。`,
    active_mission: activeMission
      ? `${activeMission.title}なら、今は「${activeMission.currentStep?.label ?? "手掛かりを集める"}」が先だ。急ぐなら、期限と行き先をもう一度確かめてから動いた方がいい。`
      : "今すぐ任務として頼める話は持っていない。ただ、掲示や人だかりが出た時は、事情を聞いてから動けば無駄足を減らせる。",
    route_to_lead: activeMission?.currentStep?.targetFacilityName
      ? `${activeMission.currentStep.targetFacilityName}へ行くなら、人通りのある道を外れない方がいい。必要な準備を済ませ、明るいうちに着ける時間を選びな。`
      : `${facilityName}から先の道は、目印を知る者に聞くのが確実だ。広場か宿なら、今日そこを通った人を見つけやすい。`,
    local_concern: learnedFromNpc
      ? `${learnedFromNpc}　まだ噂の部分もあるが、放っておけば困る人が増える。まず現場と、最初に見た人の話を照らし合わせてほしい。`
      : `${facilityName}では、普段と違う人の出入りや品物の減り方が最初の兆しになる。今は断言できないから、現場を見た人にも確かめてほしい。`,
    local_change: learnedFromNpc
      ? `${learnedFromNpc}　私が気づいた変化はそこまでだ。いつから変わったかは、ここを毎日使う人なら絞り込めるはずだ。`
      : `${facilityName}を通る顔ぶれと運ばれる物が、いつもと少し違う。私だけの見間違いかもしれないから、時間を変えてもう一度見てほしい。`,
    personal_stake: `ここは私の暮らす場所で、困っている顔を毎日見るから放っておけない。それでも私一人で決めつけるのは危険だ。確かな手掛かりを持ち帰ってほしい。`,
    local_rumor: learnedFromNpc
      ? `${learnedFromNpc}。出所まで確かめたいなら、話が届いた時刻と最初に見た人も辿ると、古い噂か今も続く異変かを分けられる。`
      : `噂はまだ私のところまで届いていない。人が集まる広場か宿で、誰が最初にその話をしたのかまで尋ねるといい。`,
    work_offer: resolved.requiredDisclosure
      ? `${resolved.requiredDisclosure}。やることと受け取る額はこれで全部だ。引き受けるかどうかは、聞いてから決めていい。`
      : `${facilityName}で今すぐ手が要るのは、運搬や片づけのような短い仕事だ。先に仕事内容と賃金を確かめ、終わったら頼んだ本人へ報告してくれ。`,
    t01_escort: "足を痛めて一人では歩けない。村の広場まで一緒に戻ってほしい。母さんが待ってる。途中で休んでもいいから、置いていかないで。",
    end_conversation: "分かった。ここで聞いた話も、現場が変われば古くなる。行き先で何を見つけたか、また会えた時に聞かせてくれ。",
  }[resolved.dialogueTopic] ?? `「${subject}」についてだね。私が確かに言えることと、まだ噂のことは分けて話す。まず現場を見て、それから関係する人の話を確かめるといい。`;
  const line = `${resolved.firstIntroduction ? `私は${resolved.introductionName ?? npc.name}。` : ""}${coreLine}`;
  return {
    narrative: resolved.dialogueTopic === "t01_escort"
      ? "斜面を降りてフィンのそばへしゃがむ。脚には体重をかけられず、狼がいなくなっても一人で村へ戻れる状態ではない。"
      : `${npc.name}は質問の内容を確かめるように一度うなずき、分かっていることと推測を分けて答えた。`,
    speeches: [{ actorId: npc.id, text: line, emotion: resolved.dialogueTopic === "t01_escort" ? "懇願" : "応答" }],
  };
}

function timeText(state) {
  return `${String(state.hour).padStart(2, "0")}:${String(state.minute).padStart(2, "0")}`;
}

function backgroundKey(state) {
  return state.player.facilityId || `HUB:${state.player.location}`;
}

function publicFacilityContext(facility) {
  if (!facility) return { type: "現在地", description: "今いる場所の様子と、人や物の動きを確かめられる。" };
  const reviewed = PUBLIC_FACILITY_COPY[facility.id];
  if (reviewed) return reviewed;
  const name = String(facility.name ?? "この場所");
  const rule = [
    [/宿|酒場|食堂|茶屋/u, "宿・交流所", `${name}には旅人や土地の人が立ち寄り、休息や会話ができる。`],
    [/店|商|市場|工房|鍛冶|薬/u, "商業施設", `${name}では、扱っている品と店先の様子を確かめられる。`],
    [/広場|掲示|集会/u, "公共の場", `${name}には人が集まり、日々の知らせや往来に触れられる。`],
    [/神殿|教会|祠|聖堂/u, "信仰の場", `${name}は人々が祈りや用事のために訪れる場所だ。`],
    [/門|街道|港|船着|駅|橋/u, "交通の要所", `${name}では、行き交う人や荷と、先へ続く道を確かめられる。`],
    [/森|林|山|谷|洞窟|遺跡|塔/u, "探索地", `${name}は周囲を警戒しながら進み、目に見える痕跡を調べる場所だ。`],
    [/城|屋敷|館|役所|詰所/u, "建物", `${name}では、訪れている人とその場の様子を確かめられる。`],
  ].find(([pattern]) => pattern.test(name));
  return rule
    ? { type: rule[1], description: rule[2] }
    : { type: "訪問先", description: `${name}の景観、人の往来、目に見える変化を確かめられる。` };
}

function presentationChoices(record, choices) {
  const labels = record.presentation?.revision === record.revision ? record.presentation.choiceLabels ?? {} : {};
  return choices.map((action) => ({
    choiceId: action.choiceId,
    actionId: action.id,
    label: cleanText(labels[action.id] ?? labels[action.choiceId] ?? action.label, 180),
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
  const weather = resolveCanonicalWeather({
    day: state.day,
    regionId: state.player.location,
    daypart: state.daypart,
  });
  const directTalkNpcIds = new Set(directNpcConversationActions(runtime, data).map((action) => action.targetNpcId));
  const presentNpcs = presentNpcsAt(runtime, data).map((npc) => ({
    ...npc,
    directTalkAvailable: directTalkNpcIds.has(npc.id),
  }));
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
  const equipmentAccessOffers = listEquipmentAccessOffers(state, data.battleData, state.shop, {
    location: state.player.location,
    facilityId: state.player.facilityId,
  });
  const accessOfferByStockId = new Map(equipmentAccessOffers.map((entry) => [entry.stockId, entry]));
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
    access: accessOfferByStockId.get(entry.id) ?? null,
  }));
  const equippedSlots = Object.entries(state.player.equipment).map(([slot, id]) => ({ slot, id }));
  const activeLoans = activeEquipmentLoans(state);
  const activeLoanByEquipmentId = new Map(activeLoans.map((loan) => [loan.equipmentId, loan]));
  const ownedInventoryEquipment = Object.entries(state.player.inventory.equipment)
    .filter(([, quantity]) => Number(quantity) > 0)
    .map(([id, quantity]) => equipmentView(data, id, Number(quantity), equippedSlots));
  const loanInventoryEquipment = activeLoans.map((loan) => ({
    ...equipmentView(data, loan.equipmentId, 0, equippedSlots),
    borrowed: true,
    loanId: loan.loanId,
    missionId: loan.missionId,
    missionTitle: loan.missionTitle,
    returnFacilityId: loan.sellerFacilityId,
  }));
  const inventoryEquipment = [...ownedInventoryEquipment, ...loanInventoryEquipment]
    .sort((left, right) => left.name.localeCompare(right.name, "ja"));
  const saleQuotes = ownedInventoryEquipment.map((entry) => {
    const quote = quoteEquipmentSale(state, data.battleData, entry.id);
    return {
      equipmentId: entry.id,
      price: Number.isFinite(quote.price) ? quote.price : null,
      available: quote.ok,
      reason: quote.ok ? null : quote.reason,
    };
  });
  const equipmentRewards = pendingEquipmentRewards(state).map((reward) => ({
    ...reward,
    equipment: (() => {
      const equipment = data.battleData.equipmentById.get(reward.equipmentId);
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
  }));
  const publicLoans = activeLoans.map((loan) => ({
    loanId: loan.loanId,
    equipmentId: loan.equipmentId,
    equipmentName: data.battleData.equipmentById.get(loan.equipmentId)?.name ?? loan.equipmentId,
    missionId: loan.missionId,
    missionTitle: loan.missionTitle,
    deposit: Number(loan.deposit ?? 0),
    sellerFacilityId: loan.sellerFacilityId,
    sellerFacilityName: data.model.facilityById[loan.sellerFacilityId]?.name ?? loan.sellerFacilityId,
    canReturnHere: loan.sellerFacilityId === state.player.facilityId,
    equipped: Object.values(state.player.equipment).includes(loan.equipmentId),
  }));
  const facility = data.model.facilityById[state.player.facilityId];
  const publicFacility = publicFacilityContext(facility);
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
      weatherId: weather.id,
      weatherLabel: weather.label,
    },
    weather,
    scene: {
      location: state.player.location,
      facilityId: state.player.facilityId,
      facilityName: facility?.name ?? state.player.facilityId,
      facilityType: publicFacility.type,
      publicDescription: publicFacility.description,
      backgroundKey: backgroundKey(state),
      narrative: record.presentation?.narrative ?? fallbackNarrative(runtime),
      speeches: record.presentation?.speeches ?? [],
      beats: record.presentation?.beats ?? [],
      presentNpcs,
      lastOutcome: record.lastOutcome ?? null,
    },
    choices,
    movement,
    tutorial,
    guidance,
    battle: interactiveBattleView(runtime, data),
    shop: {
      available: (!runtime.pendingBattle?.session || runtime.pendingBattle.session.status !== "active")
        && (stock.length > 0 || publicLoans.some((loan) => loan.canReturnHere) || equipmentRewards.length > 0),
      facilityName: facility?.name ?? null,
      stock,
      saleQuotes,
      loans: publicLoans,
      rewards: equipmentRewards,
      accessVersion: EQUIPMENT_ACCESS_VERSION,
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
      needs: publicPlayerNeeds(state.player),
      freeMeals: Number(state.player.freeMeals ?? 0),
      freeLodging: Number(state.player.freeLodging ?? 0),
      stats: { ...state.player.stats },
      equipment: Object.fromEntries(equippedSlots.map(({ slot, id }) => [slot, {
        ...equipmentView(data, id, state.player.inventory.equipment[id] ?? 0, equippedSlots),
        borrowed: activeLoanByEquipmentId.has(id),
        loanId: activeLoanByEquipmentId.get(id)?.loanId ?? null,
      }])),
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
      weatherRulesetVersion: WEATHER_RULESET_VERSION,
      equipmentAccessVersion: EQUIPMENT_ACCESS_VERSION,
      workMarketVersion: WORK_MARKET_VERSION,
      workMarket: publicWorkMarket(runtime, facility),
    },
  };
}

export function availableGameRuntimeActions(runtime, data) {
  if (runtime.pendingBattle?.session?.status === "active") {
    return { choices: [], movement: [], stock: [], learnableSkills: [] };
  }
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

function narrativePublicGoal(npc, npcState) {
  if (npcState?.lifeStatus === "injured") return "傷をかばいながら、その場ですべきことを続ける";
  if (npc?.disposition === "escalate") return "自分に不利な話題を避け、相手の出方をうかがう";
  const goal = String(npcState?.currentGoal ?? "");
  if (/respond|assist|search|warn|evacuate|treat/u.test(goal)) return "身近で起きている問題を気にかけている";
  if (/rest|recover/u.test(goal)) return "疲れを癒やし、次の行動に備える";
  if (/work|routine/u.test(goal)) return "自分の仕事と日課を進める";
  return "周囲の様子を見ながら、自分の用事を進める";
}

function narrativeNpcContexts(runtime, data, publicNpcs, { targetNpcId = null, requiredDisclosure = null } = {}) {
  const locationReputation = Number(runtime.playerState.player.reputation?.[runtime.playerState.player.location] ?? 0);
  return publicNpcs.map((publicView) => {
    const npc = data.model.npcById?.[publicView.id] ?? data.model.npcs.find((entry) => entry.id === publicView.id);
    const npcState = runtime.livingWorld.npcStates[publicView.id];
    const mustWithhold = !npcCanDiscloseBeliefs(npc);
    // Only the fact selected by the authoritative resolver may cross the
    // dialogue boundary. Sending every belief lets the model reveal facts the
    // player did not ask about and that the save did not record.
    const knownLocalFacts = !mustWithhold
      && publicView.id === targetNpcId
      && requiredDisclosure
      ? [requiredDisclosure]
      : [];
    const recentMemories = ensureNarrativeMemory(runtime).npcMemories
      .filter((memory) => memory.subjectId === publicView.id)
      .slice(-4)
      .map((memory) => memory.summary)
      .filter(Boolean);
    const stress = Number(npcState?.needs?.stress ?? 0);
    const mood = npcState?.lifeStatus === "injured" ? "負傷"
      : stress >= 70 ? "強く緊張している"
        : stress >= 45 ? "落ち着かない"
          : mustWithhold ? "警戒している"
            : publicView.mood;
    return {
      ...publicView,
      // The authoring occupation is never sent to Gemini. Even a seemingly
      // ordinary job title may later become the answer to a mystery; the
      // reviewed public persona is the only safe role boundary.
      role: publicView.role,
      mood,
      speechStyle: publicView.speechStyle ?? `${publicView.role}として、今いる相手へ自然で簡潔に話す`,
      currentGoal: narrativePublicGoal(npc, npcState),
      relationship: locationReputation,
      knownLocalFacts,
      recentMemories,
    };
  });
}

function narrativeActionContract(runtime, resolvedAction, authoritativeOutcome) {
  if (authoritativeOutcome?.battle?.won === true
    && resolvedAction?.missionId === "MSN-T01"
    && resolvedAction?.stepId === "rescue") {
    return {
      ...resolvedAction,
      type: "conversation",
      targetNpcId: "NPC001",
      targetNpcName: "フィン",
      dialogueTopic: "t01_rescue_aftermath",
      requiredDisclosure: null,
    };
  }
  const escort = ensureT01EscortState(runtime);
  if (resolvedAction?.type === "move"
    && runtime.playerState.player.facilityId === "LOC_FARM_SQUARE"
    && escort.reunionBeatAtMinute === runtime.playerState.absoluteMinute) {
    return {
      ...resolvedAction,
      dialogueTopic: "t01_reunion",
    };
  }
  return resolvedAction ?? {};
}

function narrativeSceneMode(resolvedAction, authoritativeOutcome) {
  if (resolvedAction?.dialogueTopic === "work_offer") return "work_generation";
  if (["conversation", "talk"].includes(resolvedAction?.type)) return "conversation";
  if (authoritativeOutcome?.battle || ["missionBattle", "seekBattle"].includes(resolvedAction?.type)) return "battle_aftermath";
  if (resolvedAction?.type === "move") return "arrival";
  if (["investigate", "localInvestigate", "observe"].includes(resolvedAction?.type)) return "exploration";
  return "free_roam";
}

function narrativeProgressContract(runtime, missions, actions) {
  const activeIds = new Set(missions.filter((mission) => mission.status === "active").map((mission) => mission.id));
  const anchors = actions.filter((candidate) => candidate.missionId && activeIds.has(candidate.missionId))
    .filter((candidate) => !["wait", "plan", "rest"].includes(candidate.type));
  const urgent = missions
    .filter((mission) => mission.status === "active")
    .sort((left, right) => Number(left.deadline?.remainingMinutes ?? Infinity) - Number(right.deadline?.remainingMinutes ?? Infinity))[0] ?? null;
  return {
    mode: anchors.length ? "must_offer_progress" : "free",
    anchorCandidateIds: anchors.map((candidate) => candidate.id),
    missionId: urgent?.id ?? null,
    currentStep: urgent?.currentStep?.label ?? urgent?.currentStep ?? null,
    rationale: anchors.length
      ? "少なくとも一つは、現在進行中の出来事を前へ進められる選択肢にする"
      : "この場で確実に進行できる手段をサーバーが確認できないため、無理に進展を捏造しない",
  };
}

function narrativeWorkMarket(runtime, data) {
  const location = runtime.playerState.player.location;
  const facility = data.model.facilityById[runtime.playerState.player.facilityId] ?? {};
  const market = publicWorkMarket(runtime, facility);
  return {
    region: location,
    daypart: runtime.playerState.daypart,
    schedule: market.schedule,
    completedToday: market.completedToday,
    remainingToday: market.remainingToday,
    limits: {
      daily: market.dailyLimit,
      facility: market.facilityDailyLimit,
      employer: market.employerDailyLimit,
    },
    localDemandTags: location === "田園の村"
      ? ["農作業", "収穫", "運搬", "家畜", "生活用水"]
      : location === "王都"
        ? ["配達", "商店補助", "書類整理", "護衛", "建物管理"]
        : ["運搬", "修繕", "案内", "採集", "警備"],
    durationClasses: ["short", "half_day", "full_day"],
    riskClasses: ["low", "medium", "high"],
    recentWorkTitles: market.recentWorkTitles,
    note: "仕事内容は場所・時刻・人物に合わせて生成する。営業時間、日次在庫、雇用主ごとの回数、賃金はサーバーが確定する",
  };
}

function narrativeInput(record, runtime, data, action, outcome) {
  const presentNpcs = presentNpcsAt(runtime, data);
  const choicePool = choiceActionPool(runtime, data, { limit: 9 });
  const facility = data.model.facilityById[runtime.playerState.player.facilityId];
  const publicFacility = publicFacilityContext(facility);
  const allActiveMissions = missionView(runtime, data).filter((mission) => mission.status === "active");
  const allRumors = rumorView(runtime);
  const rawResolvedAction = action?.resolvedAction ?? action;
  const authoritativeOutcome = replayOutcome(outcome) ?? { type: "start", ok: true };
  const resolvedAction = narrativeActionContract(runtime, rawResolvedAction, authoritativeOutcome);
  const currentLocation = runtime.playerState.player.location;
  const currentFacilityId = runtime.playerState.player.facilityId;
  const missions = allActiveMissions.filter((mission) => mission.id === resolvedAction?.missionId
    || mission.targetLocation === currentLocation
    || mission.currentStep?.targetLocation === currentLocation
    || mission.targetFacilityId === currentFacilityId
    || mission.currentStep?.targetFacilityId === currentFacilityId);
  const visibleTroubleIds = new Set(missions.map((mission) => mission.troubleId).filter(Boolean));
  const rumors = allRumors.filter((rumor) => rumor.origin === currentLocation
    || visibleTroubleIds.has(rumor.troubleId)
    || resolvedAction?.missionTroubleId === rumor.troubleId);
  const narrativeNpcs = narrativeNpcContexts(runtime, data, presentNpcs, {
    targetNpcId: resolvedAction?.targetNpcId ?? null,
    requiredDisclosure: resolvedAction?.requiredDisclosure ?? null,
  });
  const progressContract = narrativeProgressContract(runtime, missions, choicePool);
  const continuityContract = narrativeContinuityContract(runtime, choicePool);
  const reactionContract = narrativeReactionContract(resolvedAction, presentNpcs.map((npc) => npc.id));
  return {
    locale: "ja-JP",
    runId: process.env.TRPG_NARRATIVE_RUN_ID ?? "",
    scenarioId: `オレゴン:${resolvedAction?.id ?? action?.type ?? "GAME_START"}:${record.revision}`,
    playerName: "オレゴン",
    sceneMode: narrativeSceneMode(resolvedAction, authoritativeOutcome),
    action: {
      id: resolvedAction?.id ?? action?.resolvedActionId ?? action?.type ?? "GAME_START",
      type: resolvedAction?.type ?? action?.type ?? "start",
      label: resolvedAction?.label ?? "物語を始める",
      missionId: resolvedAction?.missionId ?? null,
      stepId: resolvedAction?.stepId ?? null,
      investigationStage: Number.isFinite(Number(resolvedAction?.investigationStage))
        ? Number(resolvedAction.investigationStage)
        : null,
      approachId: resolvedAction?.approachId ?? null,
      targetNpcId: resolvedAction?.targetNpcId ?? null,
      targetNpcName: resolvedAction?.targetNpcName ?? null,
      dialogueTopic: resolvedAction?.dialogueTopic ?? null,
      firstIntroduction: resolvedAction?.firstIntroduction === true,
      introductionName: resolvedAction?.firstIntroduction === true
        ? resolvedAction?.introductionName ?? null
        : null,
      playerUtterance: playerUtterance(resolvedAction),
      conversationTurn: Number(resolvedAction?.conversationTurn ?? runtime.dialogueSession?.turnCount ?? 0),
      previouslyAskedTopics: Array.isArray(resolvedAction?.previouslyAskedTopics)
        ? [...resolvedAction.previouslyAskedTopics]
        : [...(runtime.dialogueSession?.askedTopics ?? [])],
      requiredDisclosure: resolvedAction?.requiredDisclosure ?? null,
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
      facilityType: publicFacility.type,
      publicDescription: publicFacility.description,
      presentNpcIds: presentNpcs.map((npc) => npc.id),
      npcs: narrativeNpcs,
      player: {
        displayName: "オレゴン",
        visibleCondition: publicPlayerNeeds(runtime.playerState.player).critical
          ? "空腹か疲労が限界に近い"
          : publicPlayerNeeds(runtime.playerState.player).urgent
            ? "空腹か疲労が強い"
            : "行動可能",
        needs: publicPlayerNeeds(runtime.playerState.player),
        knownFacts: [
          ...(t01NarrativeRelevant(runtime, resolvedAction, missions) ? openingKnownFactTexts(runtime) : []),
          ...rumors.map((rumor) => rumor.text),
          ...ensureNarrativeMemory(runtime).localFacts
            .filter((fact) => !fact.locationId || fact.locationId === runtime.playerState.player.location || fact.facilityId === runtime.playerState.player.facilityId)
            .slice(-6)
            .map((fact) => fact.summary),
          ...relevantMissionLeadTexts(runtime, missions),
        ].filter(Boolean),
      },
      missions,
      visibleMissionIds: missions.map((mission) => mission.id),
      localRumors: rumors,
      visibleRumorIds: rumors.map((rumor) => rumor.id),
      authoritativeOutcome,
      progressContract,
      continuityContract,
      reactionContract,
      workMarket: narrativeWorkMarket(runtime, data),
      visibleFlags: { ...ensureNarrativeMemory(runtime).semanticFlags },
      availableActionCandidates: choicePool.map((choice) => ({
        id: choice.id,
        label: choice.label,
        intentType: choiceIntent(choice),
        actionType: choice.type,
        targetNpcId: choice.targetNpcId ?? null,
        missionId: choice.missionId ?? null,
        stepId: choice.stepId ?? null,
        minutes: Number(choice.minutes ?? 0),
        workOffer: choice.workOffer === true,
        progressRole: progressContract.anchorCandidateIds.includes(choice.id) ? "progress" : "optional",
        continuityRole: continuityContract.candidateIds.includes(choice.id) ? "continuation" : "optional",
      })),
    },
  };
}

function replacePlayerAlias(value, playerName) {
  return cleanText(value, 2000).replaceAll("オレゴン", playerName);
}

function applyNarrativeChoiceSelection(runtime, data, result) {
  const pool = choiceActionPool(runtime, data, { limit: 9 });
  if (!pool.length) {
    runtime.narrativeChoiceSelection = null;
    return null;
  }
  const poolKey = narrativeChoicePoolKey(runtime, pool);
  const poolIds = new Set(pool.map((action) => action.id));
  const actionIds = [];
  const detailsById = {};
  for (const choice of result?.choices ?? []) {
    const id = cleanText(choice?.id, 120);
    if (!id || !poolIds.has(id) || actionIds.includes(id)) continue;
    actionIds.push(id);
    detailsById[id] = {
      label: cleanText(choice.label, 180),
      approach: cleanText(choice.approach, 180) || null,
      workProposal: choice.workProposal ? {
        title: cleanText(choice.workProposal.title, 120),
        durationClass: cleanText(choice.workProposal.durationClass, 20),
        riskClass: cleanText(choice.workProposal.riskClass, 20),
      } : null,
    };
    if (actionIds.length >= 3) break;
  }
  for (const action of pool) {
    if (actionIds.length >= 3) break;
    if (!actionIds.includes(action.id)) actionIds.push(action.id);
  }
  runtime.narrativeChoiceSelection = { poolKey, actionIds, detailsById };
  return runtime.narrativeChoiceSelection;
}

function cloneNarrativeChoiceSelection(runtime) {
  return runtime.narrativeChoiceSelection
    ? JSON.parse(JSON.stringify(runtime.narrativeChoiceSelection))
    : null;
}

function appendNarrativeMemoryEntry(list, entry, limit = 80) {
  const signature = JSON.stringify([
    entry.type,
    entry.subjectId ?? null,
    entry.predicate ?? null,
    entry.value ?? null,
    entry.troubleId ?? null,
    entry.summary ?? null,
  ]);
  if (list.some((current) => current.signature === signature)) return;
  list.push({ ...entry, signature });
  if (list.length > limit) list.splice(0, list.length - limit);
}

function applyNarrativeProposalCandidates(runtime, result, playerName) {
  const memory = ensureNarrativeMemory(runtime);
  const accepted = result?.proposalResolution?.accepted ?? [];
  for (const entry of accepted) {
    const proposal = entry?.proposal ?? entry;
    if (!proposal?.type) continue;
    const base = {
      type: proposal.type,
      subjectId: cleanText(proposal.subjectId, 120) || null,
      predicate: cleanText(proposal.predicate, 120) || null,
      value: replacePlayerAlias(proposal.value, playerName) || null,
      reason: replacePlayerAlias(proposal.reason, playerName) || null,
      summary: replacePlayerAlias(proposal.summary ?? proposal.text ?? proposal.reason, playerName) || null,
      troubleId: cleanText(proposal.troubleId, 40) || null,
      locationId: cleanText(proposal.locationId, 100) || runtime.playerState.player.location,
      facilityId: runtime.playerState.player.facilityId,
      recordedAtMinute: runtime.playerState.absoluteMinute,
    };
    if (proposal.type === "local_fact_candidate" && base.summary) {
      appendNarrativeMemoryEntry(memory.localFacts, base);
    } else if (proposal.type === "npc_memory_candidate" && base.subjectId && base.summary) {
      appendNarrativeMemoryEntry(memory.npcMemories, base);
    } else if (proposal.type === "mission_lead_candidate" && base.troubleId && base.summary) {
      appendNarrativeMemoryEntry(memory.missionLeads, base);
    } else if (proposal.type === "flag_candidate" && proposal.flagPath) {
      memory.semanticFlags[cleanText(proposal.flagPath, 160)] = replacePlayerAlias(proposal.value, playerName) || true;
    }
  }
}

function authoredSceneContext(runtime, action, outcome) {
  const resolved = action?.resolvedAction ?? action ?? {};
  const state = runtime.playerState;
  const completedRegionalMoves = state.history.filter((entry) => entry.type === "REGIONAL_MOVE_COMPLETED");
  const latestRegionalMove = completedRegionalMoves.at(-1) ?? null;
  const arrivalVisitCount = completedRegionalMoves.filter((entry) => entry.to === state.player.location).length;
  const t01Escort = ensureT01EscortState(runtime);
  return {
    action: {
      id: resolved.id ?? null,
      type: resolved.type ?? null,
      movementScope: resolved.movementScope ?? null,
      destinationHub: resolved.destinationHub ?? null,
      destinationFacilityId: resolved.destinationFacilityId ?? null,
      lodging: resolved.lodging === true,
      price: Number.isFinite(Number(resolved.price)) ? Number(resolved.price) : null,
    },
    outcome: outcome ?? {},
    mission: {
      id: resolved.missionId ?? null,
      stepId: resolved.stepId ?? null,
    },
    location: {
      hub: state.player.location,
      facilityId: state.player.facilityId,
    },
    journey: {
      fromHub: latestRegionalMove?.from ?? null,
      toHub: latestRegionalMove?.to ?? null,
      arrivalVisitCount,
    },
    story: {
      t01ReunionNow: state.player.facilityId === "LOC_FARM_SQUARE"
        && t01Escort.reunionBeatAtMinute === state.absoluteMinute,
    },
    weather: canonicalWeatherForState(state),
    player: {
      needs: publicPlayerNeeds(state.player),
    },
  };
}

function authoredNarrativeForWeather(scene, weather) {
  const byId = scene?.narrativeByWeatherId?.[weather?.id];
  if (String(byId ?? "").trim()) return String(byId).trim();
  const tags = new Set(weather?.tags ?? []);
  const priority = ["storm", "snow", "rain", "fog", "wind", "dry", "clear"];
  for (const tag of priority) {
    const candidate = scene?.narrativeByWeatherTag?.[tag];
    if (tags.has(tag) && String(candidate ?? "").trim()) return String(candidate).trim();
  }
  return String(scene?.narrative ?? "").trim();
}

export function resolveReviewedAuthoredPresentation(runtime, data, action = null, outcome = null) {
  const context = authoredSceneContext(runtime, action, outcome);
  const scene = resolveAuthoredScene(context);
  if (!scene) return null;
  const presentIds = new Set(presentNpcsAt(runtime, data).map((npc) => npc.id));
  const speeches = (scene.beats ?? [])
    .filter((beat) => beat?.kind === "npc" && beat.actorId && presentIds.has(beat.actorId))
    .map((beat) => ({
      actorId: beat.actorId,
      text: cleanText(beat.text, 500),
      emotion: cleanText(beat.emotion, 40) || null,
    }));
  return {
    sceneId: scene.sceneId,
    presentationOnly: scene.presentationOnly === true,
    narrative: authoredNarrativeForWeather(scene, context.weather),
    speeches,
  };
}

async function updatePresentation(record, runtime, data, narrator, action = null, outcome = null) {
  const fallback = fallbackNarrative(runtime, action, outcome);
  if (["TUTORIAL_ACK", "ACK_NPC_INTRODUCTION"].includes(action?.type) && record.presentation) {
    record.presentation = { ...record.presentation, revision: record.revision, choiceLabels: {} };
    return;
  }
  const authored = authoredOpeningPresentation(runtime);
  if (authored) {
    const presentIds = new Set(presentNpcsAt(runtime, data).map((npc) => npc.id));
    const base = {
      revision: record.revision,
      source: "authored_tutorial",
      narrative: authored.narrative,
      speeches: authored.speeches.filter((speech) => presentIds.has(speech.actorId)),
      choiceLabels: {},
    };
    record.presentation = presentationWithOrderedBeats(runtime, data, action?.resolvedAction ?? action, base);
    return;
  }
  const reviewed = resolveReviewedAuthoredPresentation(runtime, data, action, outcome);
  if (reviewed) {
    runtime.narrativeChoiceSelection = null;
    const base = {
      revision: record.revision,
      source: "authored_scene",
      sceneId: reviewed.sceneId,
      narrative: reviewed.narrative,
      speeches: reviewed.speeches,
      choiceLabels: {},
    };
    record.presentation = presentationWithOrderedBeats(runtime, data, action?.resolvedAction ?? action, base);
    return;
  }
  const deterministic = deterministicFallbackPresentation(runtime, data, action, outcome);
  const resolvedAction = action?.resolvedAction ?? action;
  if (!narrator) {
    runtime.narrativeChoiceSelection = null;
    const base = { revision: record.revision, source: "deterministic_fallback", ...deterministic, choiceLabels: {} };
    record.presentation = presentationWithOrderedBeats(runtime, data, resolvedAction, base);
    return;
  }
  try {
    const input = narrativeInput(record, runtime, data, action, outcome);
    const presentIds = new Set(input.authoritativeState.presentNpcIds);
    const result = await narrator.generate(input, {
      policyVersion: "trpg-gameplay-v2",
      allowedMissionTemplateIds: ["local-rescue", "local-investigation", "local-delivery", "local-escort", "local-negotiation"],
      allowedTroubleIds: input.authoritativeState.missions.map((mission) => mission.troubleId).filter(Boolean),
      validateNpcIntentCandidate(proposal) {
        return Boolean(proposal.targetNpcId && proposal.intent && presentIds.has(proposal.targetNpcId));
      },
    });
    const selection = applyNarrativeChoiceSelection(runtime, data, result);
    applyNarrativeProposalCandidates(runtime, result, record.playerName);
    const legalChoiceIds = new Set(input.authoritativeState.availableActionCandidates.map((choice) => choice.id));
    const choiceLabels = Object.fromEntries((result.choices ?? [])
      .filter((choice) => legalChoiceIds.has(choice.id))
      .map((choice) => [choice.id, replacePlayerAlias(choice.label, record.playerName)]));
    const allowedSpeechIds = resolvedAction?.type === "conversation" && resolvedAction.targetNpcId
      ? new Set([resolvedAction.targetNpcId])
      : presentIds;
    const speeches = (result.speeches ?? [])
      .filter((speech) => presentIds.has(speech.actorId) && allowedSpeechIds.has(speech.actorId))
      .map((speech) => ({
        actorId: speech.actorId,
        text: replacePlayerAlias(speech.text, record.playerName).slice(0, 500),
        emotion: cleanText(speech.emotion, 40) || null,
      }));
    const narrativeAction = input.action ?? {};
    if (narrativeAction.type === "conversation" && narrativeAction.targetNpcId) {
      let directReply = speeches.find((speech) => speech.actorId === narrativeAction.targetNpcId);
      if (!directReply && narrativeAction.requiredDisclosure) {
        directReply = { actorId: narrativeAction.targetNpcId, text: "", emotion: null };
        speeches.unshift(directReply);
      }
      if (directReply && narrativeAction.firstIntroduction && narrativeAction.introductionName
        && !directReply.text.includes(narrativeAction.introductionName)) {
        directReply.text = `私は${narrativeAction.introductionName}。${directReply.text}`;
      }
      const disclosure = replacePlayerAlias(narrativeAction.requiredDisclosure, record.playerName);
      if (directReply && disclosure && !directReply.text.includes(disclosure)) {
        directReply.text = `${directReply.text}${directReply.text && !/[。！？!?]$/u.test(directReply.text) ? "。" : ""}${disclosure}`.slice(0, 500);
      }
    }
    const generatedNarrative = replacePlayerAlias(result.narrative, record.playerName).slice(0, 1500);
    const narrative = generatedNarrative || deterministic.narrative || fallback;
    const base = {
      revision: record.revision,
      source: result.meta?.source ?? "unknown",
      narrative,
      speeches,
      choiceLabels,
      selectedActionIds: selection?.actionIds ?? [],
      cacheKey: result.meta?.cacheKey ?? null,
    };
    record.presentation = presentationWithOrderedBeats(runtime, data, resolvedAction, base);
  } catch (error) {
    console.error("TRPG gameplay narrative failed; deterministic presentation retained", error);
    runtime.narrativeChoiceSelection = null;
    const base = { revision: record.revision, source: "deterministic_fallback", ...deterministic, choiceLabels: {} };
    record.presentation = presentationWithOrderedBeats(runtime, data, resolvedAction, base);
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
      && (record?.resolverVersion === TRPG_GAME_RESOLVER_VERSION
        || MIGRATABLE_RESOLVER_VERSIONS.has(record?.resolverVersion))
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
    const retained = [];
    for (const record of records) {
      if (this.withinRetention(record, now)) retained.push(record);
      else await this.store.delete(record.id);
    }
    return retained;
  }

  async create(ownerHash, input = {}) {
    return this.runLocked("global-create", async () => {
      const retainedRecords = await this.pruneObsoleteSaves();
      const ownerRecords = retainedRecords.filter((record) => record.ownerHash === ownerHash && this.currentRecord(record));
      if (ownerRecords.length >= this.maxSavesPerOwner) throw new TrpgGameError(429, "owner_save_quota_reached");
      if (retainedRecords.length >= this.maxTotalSaves) {
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
      await updatePresentation(record, runtime, this.data, this.narrator);
      updateRecordSnapshot(record, runtime, this.data);
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
    const resolverIsCurrent = record.resolverVersion === TRPG_GAME_RESOLVER_VERSION;
    const resolverIsMigratable = MIGRATABLE_RESOLVER_VERSIONS.has(record.resolverVersion);
    if (record.schemaVersion !== TRPG_GAME_SCHEMA_VERSION
      || record.contentRevision !== this.data.contentRevision
      || (!resolverIsCurrent && !resolverIsMigratable)
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
    if (resolverIsMigratable) {
      const runtime = hydrateRuntime(record, this.data);
      const legacyHash = gameStateHash(runtime, this.data, record.resolverVersion);
      if (legacyHash !== record.stateHash) throw new TrpgGameError(409, "save_state_hash_mismatch");
      ensurePlayerNeeds(runtime.playerState.player);
      ensureEquipmentAccessState(runtime.playerState);
      ensureWorkMarket(runtime);
      runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
      const normalizedSnapshot = serializeRuntime(runtime);
      record.replayBase = {
        resolverVersion: record.resolverVersion,
        revision: record.revision,
        stateHash: legacyHash,
        runtimeSnapshot: normalizedSnapshot,
      };
      record.resolverVersion = TRPG_GAME_RESOLVER_VERSION;
      record.runtimeSnapshot = normalizedSnapshot;
      record.stateHash = gameStateHash(runtime, this.data);
      if (record.presentation) {
        record.presentation = {
          ...record.presentation,
          revision: record.revision,
          choiceLabels: {},
          cacheKey: null,
        };
      }
      record.migratedAt = new Date().toISOString();
      await this.store.put(record);
    }
    return record;
  }

  gameViewForRecord(record) {
    const runtime = hydrateRuntime(record, this.data);
    const actualHash = gameStateHash(runtime, this.data);
    if (actualHash !== record.stateHash) throw new TrpgGameError(409, "save_state_hash_mismatch");
    return buildGameView(record, runtime, this.data);
  }

  async get(ownerHash, id) {
    return this.runLocked(id, async () => {
      const record = await this.recordForOwner(ownerHash, id);
      return this.gameViewForRecord(record);
    });
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
        const recordedPayload = commandPayload(duplicate.type, duplicate.payload);
        if (duplicate.type !== requestedType || JSON.stringify(recordedPayload) !== JSON.stringify(requestedPayload)) {
          throw new TrpgGameError(409, "command_id_conflict", "The command id was already used for a different command");
        }
        const save = this.gameViewForRecord(record);
        return { duplicate: true, originalRevision: duplicate.revisionAfter, save };
      }
      if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== record.revision) {
        throw new TrpgGameError(409, "revision_conflict", "The save changed before this command was applied", { currentRevision: record.revision });
      }
      if (record.commandLog.length >= MAX_COMMANDS) throw new TrpgGameError(409, "command_limit_reached");
      const runtime = hydrateRuntime(record, this.data);
      const choiceSelectionBefore = cloneNarrativeChoiceSelection(runtime);
      const narrativeMemoryBefore = cloneNarrativeMemory(runtime);
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
      if (command.type === "BATTLE_ACT" && runtime.pendingBattle?.session?.status === "active") {
        runtime.narrativeChoiceSelection = null;
        record.presentation = record.presentation
          ? { ...record.presentation, revision: record.revision, choiceLabels: {}, selectedActionIds: [] }
          : null;
      } else {
        // Once the decisive battle command has committed, the authoritative
        // result is fixed. Gemini may now direct the aftermath and next three
        // actions, but it cannot change the battle outcome.
        await updatePresentation(record, runtime, this.data, this.narrator, { ...command, ...result }, result.outcome);
      }
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
        choiceSelectionBefore,
        choiceSelectionAfter: cloneNarrativeChoiceSelection(runtime),
        narrativeMemoryBefore,
        narrativeMemoryAfter: cloneNarrativeMemory(runtime),
      };
      record.commandLog.push(journalEntry);
      await this.store.put(record);
      return { duplicate: false, save: buildGameView(record, runtime, this.data) };
    });
  }

  async verifyReplay(ownerHash, id) {
    return this.runLocked(id, async () => {
      const record = await this.recordForOwner(ownerHash, id);
      const replayBase = record.replayBase;
      let runtime;
      let revision;
      let entries;
      if (replayBase?.runtimeSnapshot && Number.isInteger(replayBase.revision)) {
        runtime = deserializeRuntime(replayBase.runtimeSnapshot, this.data);
        applyGameplayCatalogOverrides(runtime.playerState.catalog);
        syncAuthoritativePresentNpcIds(runtime, this.data);
        compactPlayableRuntime(runtime);
        const baseHash = gameStateHash(runtime, this.data, replayBase.resolverVersion);
        if (baseHash !== replayBase.stateHash) {
          return { ok: false, revision: replayBase.revision, stateHash: gameStateHash(runtime, this.data), checks: [], baseMatches: false };
        }
        ensurePlayerNeeds(runtime.playerState.player);
        ensureEquipmentAccessState(runtime.playerState);
        ensureWorkMarket(runtime);
        runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
        revision = replayBase.revision;
        entries = record.commandLog.filter((entry) => Number(entry.seq) > replayBase.revision);
      } else {
        runtime = createGameRuntime(this.data, {
          seed: record.seed,
          profileId: record.profileId,
          playerName: record.playerName,
          tutorial: record.tutorialVersion === TUTORIAL_VERSION,
        });
        compactPlayableRuntime(runtime);
        revision = 0;
        entries = record.commandLog;
      }
      const checks = [];
      for (const entry of entries) {
        const expectedSeq = revision + 1;
        if (Object.hasOwn(entry, "choiceSelectionBefore")) {
          runtime.narrativeChoiceSelection = entry.choiceSelectionBefore
            ? JSON.parse(JSON.stringify(entry.choiceSelectionBefore))
            : null;
        }
        if (Object.hasOwn(entry, "narrativeMemoryBefore")) {
          runtime.narrativeMemory = entry.narrativeMemoryBefore
            ? JSON.parse(JSON.stringify(entry.narrativeMemoryBefore))
            : createNarrativeMemory();
        }
        const beforeHash = gameStateHash(runtime, this.data);
        const result = executeGameRuntimeCommand(runtime, this.data, entry);
        revision = expectedSeq;
        if (Object.hasOwn(entry, "choiceSelectionAfter")) {
          runtime.narrativeChoiceSelection = entry.choiceSelectionAfter
            ? JSON.parse(JSON.stringify(entry.choiceSelectionAfter))
            : null;
        }
        if (Object.hasOwn(entry, "narrativeMemoryAfter")) {
          runtime.narrativeMemory = entry.narrativeMemoryAfter
            ? JSON.parse(JSON.stringify(entry.narrativeMemoryAfter))
            : createNarrativeMemory();
        }
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
        baseMatches: true,
      };
    });
  }
}

export function hashResumeToken(token) {
  return sha256(`trpg-resume-token-v1\n${token}`);
}
