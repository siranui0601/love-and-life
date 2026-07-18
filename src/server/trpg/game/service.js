import crypto from "node:crypto";
import * as journey from "../../../../tools/trpg-sim/lib/player-journey.mjs";
import { buyEquipment, availableStockAt, sellEquipment } from "../../../../tools/trpg-sim/lib/shop-runtime.mjs";
import { experienceToNextLevel } from "../../../../tools/trpg-sim/lib/mission-model.mjs";
import {
  completeNpcLifeTick,
  createNpcLifeEngine,
  prepareNpcLifeTick,
} from "../../../../tools/trpg-sim/lib/npc-life-engine.mjs";
import { loadTrpgGameData } from "./game-data.js";
import { deserializeRuntime, serializeRuntime } from "./serializer.js";
import { FileTrpgSaveStore } from "./save-store.js";
import { npcPopulationSummary, presentNpcsAt, syncAuthoritativePresentNpcIds } from "./presence.js";

export const TRPG_GAME_SCHEMA_VERSION = "1.0.0-alpha";
export const TRPG_GAME_RESOLVER_VERSION = "trpg-player-world-v2";

const PROFILE_BY_ID = new Map(journey.PLAYER_PROFILES.map((profile) => [profile.id, profile]));
const COMMAND_TYPES = new Set(["CHOOSE", "MOVE", "SHOP_BUY", "SHOP_SELL", "EQUIP", "UNEQUIP", "LEARN_SKILL"]);
const COMMAND_PAYLOAD_KEY = Object.freeze({
  CHOOSE: "choiceId",
  MOVE: "moveId",
  SHOP_BUY: "stockId",
  SHOP_SELL: "equipmentId",
  EQUIP: "equipmentId",
  UNEQUIP: "slot",
  LEARN_SKILL: "skillId",
});
const PHASE_MINUTES = [0, 240, 480, 720];
const PHASE_NAMES = ["morning", "afternoon", "evening", "night"];
const MAX_COMMANDS = 5000;
const DEFAULT_MAX_SAVES_PER_OWNER = 3;
const DEFAULT_MAX_TOTAL_SAVES = 100;
const DEFAULT_SAVE_RETENTION_DAYS = 30;

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

function placeOpeningGuide(livingWorld) {
  const eda = livingWorld.npcStates.NPC004;
  if (!eda || ["dead", "missing", "departed"].includes(eda.lifeStatus)) return;
  eda.presence = "present";
  eda.lifeStatus = eda.lifeStatus === "injured" ? "injured" : "alive";
  eda.travel = null;
  eda.localTravel = null;
  eda.position = { hubId: "田園の村", facilityId: "LOC_FARM_FIELD" };
  eda.currentGoal = "protect-summoned-player";
  eda.status = "旅人を保護中";
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
  const eventId = `K${String(world.knowledgeEvents.length + 1).padStart(7, "0")}`;
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
  if (after !== "resolved" || before === "resolved" || runtime.playerInterventions.has(key)) return;
  runtime.playerInterventions.add(key);
  const finn = runtime.livingWorld.npcStates.NPC001;
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

export function createGameRuntime(data, { seed, profileId, playerName }) {
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
  };
  advanceLivingWorld(runtime, playerState.absoluteMinute);
  placeOpeningGuide(livingWorld);
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
  syncAuthoritativePresentNpcIds(runtime, data);
  return journey.generateChoiceActions(
    runtime.playerState,
    data.model,
    data.battleData,
    runtime.playerState.catalog,
    profileFor(runtime.playerState.profileId),
  );
}

function movementActions(runtime, data) {
  return journey.availableMovementActions(runtime.playerState, data.model);
}

function learnLocalLivingRumors(runtime, data, limit) {
  const state = runtime.playerState;
  const facilityId = state.player.facilityId;
  const pool = runtime.livingWorld.facilityRumors?.[facilityId];
  if (!(pool instanceof Map) || limit <= 0) return [];
  const candidates = [...pool.values()]
    .map((entry) => entry?.belief ?? entry)
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
    });
    learned.push(id);
  }
  return learned;
}

function safeOutcome(result) {
  const output = { ok: result?.ok !== false, type: result?.type ?? null, reason: result?.reason ?? null };
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
  }
  if (output.battle) output.summary = output.battle.won ? "戦闘に勝利した。" : "戦闘から撤退した。";
  else if (output.item && output.price !== undefined) output.summary = `${output.item.name}を${output.price}Gで取引した。`;
  else if (output.skillId) output.summary = `新しいスキルを取得した。`;
  else if (output.learnedRumorCount) output.summary = `${output.learnedRumorCount}件の噂を新しく知った。`;
  else output.summary = output.ok ? "行動の結果が世界へ反映された。" : `行動できなかった（${output.reason ?? "不明"}）。`;
  return output;
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
  state.player.equipment[equipment.slot] = equipmentId;
  if (equipment.slot === "mainHand" && equipment.grip === "twoHanded") delete state.player.equipment.offHand;
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

export function executeGameRuntimeCommand(runtime, data, command) {
  if (!COMMAND_TYPES.has(command.type)) throw new TrpgGameError(400, "unknown_command_type");
  const payload = command.payload && typeof command.payload === "object" ? command.payload : {};
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
    result = journey.resolvePlayerAction(
      runtime.playerState,
      data.model,
      data.battleData,
      data.skills,
      runtime.playerState.catalog,
      profileFor(runtime.playerState.profileId),
      action,
    );
    runtime.playerState.metrics.actions += 1;
  } else if (command.type === "MOVE") {
    const action = movementActions(runtime, data).find((entry) => entry.id === payload.moveId);
    if (!action) throw new TrpgGameError(400, "movement_not_available");
    resolvedActionId = action.id;
    result = journey.resolveMovementAction(
      runtime.playerState,
      data.model,
      data.battleData,
      data.skills,
      profileFor(runtime.playerState.profileId),
      action,
    );
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
  }
  if (!result?.ok) throw errorFromResult(result);
  applyPlayerWorldInterventions(runtime, previousTroubleStates);
  advanceLivingWorld(runtime, runtime.playerState.absoluteMinute);
  syncAuthoritativePresentNpcIds(runtime, data);
  if (["conversation", "observe"].includes(resolvedPlayerAction?.type)) {
    result.learnedRumorIds = learnLocalLivingRumors(runtime, data, resolvedPlayerAction.type === "observe" ? 3 : 1);
  }
  return { resolvedActionId, outcome: safeOutcome(result) };
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

function missionView(runtime) {
  const state = runtime.playerState;
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
      return [{
        id: definition.id,
        kind: definition.kind,
        troubleId: definition.troubleId ?? null,
        title: definition.title,
        status: current.status,
        deadlineDay: definition.deadlineDay ?? definition.finalDay ?? null,
        currentStep: step ? {
          id: step.id,
          label: step.label,
          targetLocation: step.targetLocation ?? definition.targetLocations?.[0] ?? null,
          targetFacilityId: step.targetFacilityId ?? null,
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
    }));
}

function chronicleView(runtime) {
  const data = runtime.playerState.history.slice(-30).reverse();
  const label = (entry) => {
    if (entry.type === "PLAYER_ACTION_RESOLVED") return `行動「${entry.actionId}」を終えた。`;
    if (entry.type === "LOCAL_MOVE_COMPLETED") return `施設 ${entry.fromFacilityId} から ${entry.toFacilityId} へ移動した。`;
    if (entry.type === "REGIONAL_MOVE_COMPLETED") return `${entry.from} から ${entry.to} へ移動した。`;
    if (entry.type === "SHOP_BUY") return `装備 ${entry.equipmentId} を ${entry.price}Gで購入した。`;
    if (entry.type === "SHOP_SELL") return `装備 ${entry.equipmentId} を ${entry.price}Gで売却した。`;
    if (entry.type === "SKILL_LEARNED") return `スキル ${entry.skillId} を取得した。`;
    if (["RUMOR_PUBLISHED", "RUMOR_LEARNED_LOCAL"].includes(entry.type)) return `新しい噂 ${entry.rumorId} を知った。`;
    if (entry.type === "MISSION_COMPLETED") return `ミッション ${entry.missionId} を完了した。`;
    return "世界に変化があった。";
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
  const learned = [...state.player.skills].sort().map((id) => {
    const skill = data.skillById.get(id);
    return { id, name: skill?.name ?? id, category: skill?.category ?? null };
  });
  const mapCandidate = (candidate) => {
    const skill = data.skillById.get(candidate.id);
    return {
      ...candidate,
      category: skill?.category ?? null,
      description: skill?.description ?? skill?.effectSummary ?? "",
      reasonLabel: lockedSkillReason(candidate.reason),
      lockReason: lockedSkillReason(candidate.reason),
    };
  };
  return {
    learned,
    learnable: candidates.filter((candidate) => candidate.learnable).slice(0, 40).map(mapCandidate),
    locked: candidates.filter((candidate) => !candidate.learnable && candidate.reason !== "already_learned").slice(0, 80).map(mapCandidate),
  };
}

function fallbackNarrative(runtime, action = null, outcome = null) {
  const facility = runtime.playerState.player.facilityId;
  if (!action) {
    if (facility === "LOC_FARM_FIELD") return "見知らぬ麦畑で目を覚ました。遠くで鐘が鳴り、村では一人の少年を捜す声が上がっている。";
    return `${runtime.playerState.player.location}で、新しい一日が動き始めている。`;
  }
  if (outcome?.battle) return outcome.battle.won
    ? "息を整えると、戦いの跡に静けさが戻った。得た傷と手掛かりは、次の判断へ引き継がれる。"
    : "戦いから辛うじて退いた。世界の時間は止まらず、立て直す猶予も失われていく。";
  if (action.type === "MOVE") return "移動を終えると、そこにいる人々と店の様子が入れ替わった。";
  if (action.type === "SHOP_BUY") return "品物を受け取り、代金と在庫が帳面に記された。";
  if (action.type === "SHOP_SELL") return "店主は品を確かめ、相応の代金を差し出した。";
  if (action.type === "LEARN_SKILL") return "積み重ねた経験が、使える技として形になった。";
  return "選んだ行動の結果が世界へ刻まれ、時計の針が先へ進んだ。";
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
  }));
}

export function buildGameView(record, runtime, data) {
  const state = runtime.playerState;
  const presentNpcs = presentNpcsAt(runtime, data);
  const choices = presentationChoices(record, choiceActions(runtime, data));
  const movement = movementActions(runtime, data).map((action) => ({
    moveId: action.id,
    label: action.label,
    minutes: action.minutes,
    scope: action.movementScope,
    destination: action.destinationHub,
    destinationFacilityId: action.destinationFacilityId,
  }));
  const stock = availableStockAt(state, data.battleData, state.shop).map((entry) => ({
    stockId: entry.id,
    equipmentId: entry.equipmentId,
    name: entry.name,
    price: entry.price,
    quantity: Number.isFinite(entry.quantity) ? entry.quantity : null,
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
    shop: {
      available: data.battleData.inventory.some((entry) => entry.location === state.player.location && entry.sellerId === state.player.facilityId),
      facilityName: facility?.name ?? null,
      stock,
    },
    player: {
      name: record.playerName,
      profileId: record.profileId,
      profileLabel: profileFor(record.profileId).label,
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
    missions: missionView(runtime),
    rumors: rumorView(runtime),
    chronicle: chronicleView(runtime),
    world: {
      dayLimit: 100,
      population: npcPopulationSummary(runtime),
      troubleCounts: Object.values(state.troubles).reduce((counts, trouble) => {
        counts[trouble.status] = (counts[trouble.status] ?? 0) + 1;
        return counts;
      }, {}),
      knownResolvedTroubleIds: [...state.progress.missions.resolvedTroubleIds].sort(),
    },
  };
}

export function availableGameRuntimeActions(runtime, data) {
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
  const missions = missionView(runtime).filter((mission) => mission.status === "active");
  const rumors = rumorView(runtime);
  return {
    locale: "ja-JP",
    playerName: record.playerName,
    action: {
      id: action?.resolvedActionId ?? action?.type ?? "GAME_START",
      type: action?.type ?? "start",
      label: action?.label ?? "物語を始める",
      targetNpcId: action?.targetNpcId ?? null,
    },
    authoritativeOutcome: outcome ?? { type: "start", ok: true },
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
      player: { displayName: record.playerName, visibleCondition: "行動可能", knownFacts: rumors.map((rumor) => rumor.text) },
      missions,
      visibleMissionIds: missions.map((mission) => mission.id),
      localRumors: rumors,
      visibleRumorIds: rumors.map((rumor) => rumor.id),
      authoritativeOutcome: outcome ?? { type: "start", ok: true },
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
  if (!narrator) {
    record.presentation = { revision: record.revision, source: "deterministic_fallback", narrative: fallback, speeches: [], choiceLabels: {} };
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
    const speeches = (result.speeches ?? [])
      .filter((speech) => presentIds.has(speech.actorId))
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
    record.presentation = { revision: record.revision, source: "deterministic_fallback", narrative: fallback, speeches: [], choiceLabels: {} };
  }
}

function summaryRecord(record) {
  return {
    id: record.id,
    playerName: record.playerName,
    profileId: record.profileId,
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
      const profileId = PROFILE_BY_ID.has(input.profileId) ? input.profileId : "balanced";
      const seed = this.allowCustomSeed && input.seed ? cleanText(input.seed, 120) : crypto.randomUUID();
      const runtime = createGameRuntime(this.data, { seed, profileId, playerName });
      const now = new Date().toISOString();
      const record = {
        id: saveId(),
        schemaVersion: TRPG_GAME_SCHEMA_VERSION,
        resolverVersion: TRPG_GAME_RESOLVER_VERSION,
        contentRevision: this.data.contentRevision,
        ownerHash,
        playerName,
        profileId,
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
    if (record.contentRevision !== this.data.contentRevision || record.resolverVersion !== TRPG_GAME_RESOLVER_VERSION) {
      throw new TrpgGameError(409, "save_content_version_mismatch", "This save is pinned to a different content revision", {
        saveContentRevision: record.contentRevision,
        currentContentRevision: this.data.contentRevision,
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
        outcome: result.outcome,
      };
      record.commandLog.push(journalEntry);
      await updatePresentation(record, runtime, this.data, this.narrator, { ...command, ...result }, result.outcome);
      await this.store.put(record);
      return { duplicate: false, save: buildGameView(record, runtime, this.data) };
    });
  }

  async verifyReplay(ownerHash, id) {
    const record = await this.recordForOwner(ownerHash, id);
    let runtime = createGameRuntime(this.data, { seed: record.seed, profileId: record.profileId, playerName: record.playerName });
    let revision = 0;
    const checks = [];
    for (const entry of record.commandLog) {
      const beforeHash = gameStateHash(runtime, this.data);
      const result = executeGameRuntimeCommand(runtime, this.data, entry);
      revision += 1;
      const afterHash = gameStateHash(runtime, this.data);
      checks.push({
        seq: entry.seq,
        beforeMatches: beforeHash === entry.stateBeforeHash,
        actionMatches: result.resolvedActionId === entry.resolvedActionId,
        afterMatches: afterHash === entry.stateAfterHash,
      });
      if (!checks.at(-1).beforeMatches || !checks.at(-1).actionMatches || !checks.at(-1).afterMatches) break;
      // Production commands cross a persisted snapshot boundary. Rehydrate on
      // replay too so no mutable derived catalog can affect later commands.
      runtime = deserializeRuntime(serializeRuntime(runtime), this.data);
      applyGameplayCatalogOverrides(runtime.playerState.catalog);
      syncAuthoritativePresentNpcIds(runtime, this.data);
    }
    return {
      ok: checks.every((entry) => entry.beforeMatches && entry.actionMatches && entry.afterMatches)
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
