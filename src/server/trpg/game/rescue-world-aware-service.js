import * as journey from "../../../../tools/trpg-sim/lib/player-journey.mjs";
import { completeNpcLifeTick, prepareNpcLifeTick } from "../../../../tools/trpg-sim/lib/npc-life-engine.mjs";
import {
  buildCollapseRescueCandidates,
  planIncapacitationRescue,
  prepareCollapseCommand,
  resolveCollapseRescue,
} from "../resolvers/player-collapse-resolver.js";
import { resolveCanonicalWeather } from "../resolvers/weather-resolver.js";
import { syncAuthoritativePresentNpcIds } from "./presence.js";
import { deserializeRuntime, serializeRuntime } from "./serializer.js";
import { TrpgGameError, gameStateHash } from "./service.js";
import { WorldTimeAwareTrpgGameService } from "./world-time-aware-service.js";

export const RESCUE_WORLD_AWARE_SERVICE_VERSION = "rescue-world-aware-service-v1";
export const RESOLVE_COLLAPSE_COMMAND = "RESOLVE_COLLAPSE_RESCUE";

const PHASE_MINUTES = [0, 240, 480, 720];
const PHASE_NAMES = ["morning", "afternoon", "evening", "night"];
const SAFE_TYPE_PRIORITY = new Map([
  ["医療", 0], ["治療", 0], ["診療所", 0], ["病院", 0], ["療養所", 0],
  ["宿", 1], ["宿屋", 1], ["旅籠", 1], ["宿泊", 1],
  ["詰所", 2], ["衛兵詰所", 2], ["駐屯地", 2], ["教会", 2], ["神殿", 2],
]);
const SAFE_FUNCTION_TERMS = ["治療", "療養", "医療", "宿泊", "休息", "保護", "救護", "警備"];

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function profileFor(id) {
  return journey.PLAYER_PROFILES.find((profile) => profile.id === id) ?? journey.PLAYER_PROFILES[0];
}

function safeFacilityPriority(facility) {
  if (!facility) return null;
  const type = String(facility.type ?? "").trim();
  if (SAFE_TYPE_PRIORITY.has(type)) return SAFE_TYPE_PRIORITY.get(type);
  const semanticFunction = String(facility.function ?? "");
  if (SAFE_FUNCTION_TERMS.some((term) => semanticFunction.includes(term))) return 3;
  return null;
}

function localMinutesToFacility(state, model, facilityId) {
  if (state.player.facilityId === facilityId) return 0;
  return journey.availableLocalMovementActions(state, model)
    .find((action) => action.destinationFacilityId === facilityId)?.minutes ?? null;
}

function travelMinutesBetweenHubs(state, model, fromHub, toHub, traveler = null) {
  if (!fromHub || !toHub) return null;
  if (fromHub === toHub) return 0;
  const plan = journey.shortestTravelPlan(model, state, fromHub, toHub, traveler);
  return plan ? Math.max(10, Math.round(number(plan.hours) * 60)) : null;
}

export function selectCanonicalRescueDestination(state, model) {
  const originHub = state.player.location;
  const candidates = (model.facilities ?? [])
    .map((facility) => ({ facility, priority: safeFacilityPriority(facility) }))
    .filter((entry) => entry.priority != null)
    .map((entry) => {
      const routeMinutes = travelMinutesBetweenHubs(state, model, originHub, entry.facility.hub);
      if (routeMinutes == null) return null;
      const localMinutes = entry.facility.hub === originHub
        ? localMinutesToFacility(state, model, entry.facility.id)
        : 0;
      if (localMinutes == null) return null;
      return {
        location: entry.facility.hub,
        facilityId: entry.facility.id,
        facilityName: entry.facility.name,
        facilityType: entry.facility.type,
        facilityFunction: entry.facility.function,
        priority: entry.priority,
        evacuationMinutes: routeMinutes + localMinutes,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.evacuationMinutes - right.evacuationMinutes
      || left.priority - right.priority
      || left.facilityId.localeCompare(right.facilityId, "en"));
  if (candidates.length) return { ...candidates[0], emergencyFallback: false };
  // True emergency fallback only when canonical world data offers no reachable
  // safe/treatment/lodging/protection facility. It does not use name regexes.
  return {
    location: originHub,
    facilityId: state.player.facilityId ?? null,
    facilityName: model.facilityById?.[state.player.facilityId]?.name ?? originHub,
    facilityType: null,
    facilityFunction: null,
    priority: 99,
    evacuationMinutes: 0,
    emergencyFallback: true,
  };
}

function npcHub(state) {
  return state?.position?.hubId ?? state?.location ?? null;
}

function companionIds(runtime) {
  const value = runtime.playerState.player.companionNpcIds;
  return value instanceof Set ? value : new Set(value ?? []);
}

export function productionRescueCandidates(runtime, data) {
  const incidentHub = runtime.playerState.player.location;
  const model = data.model;
  const npcStates = runtime.livingWorld?.npcStates ?? {};
  const companion = companionIds(runtime);
  const presentNpcIds = runtime.playerState.authoritativePresentNpcIds instanceof Set
    ? runtime.playerState.authoritativePresentNpcIds
    : new Set(runtime.playerState.authoritativePresentNpcIds ?? []);
  const reachableNpcIds = [];
  const arrivalMinutes = new Map();
  for (const npc of model.npcs ?? []) {
    const state = npcStates[npc.id];
    if (!state) continue;
    const from = npcHub(state);
    const minutes = travelMinutesBetweenHubs(runtime.playerState, model, from, incidentHub, npc);
    if (minutes == null) continue;
    reachableNpcIds.push(npc.id);
    const sameFacility = from === incidentHub
      && (state.position?.facilityId ?? state.facilityId ?? null) === runtime.playerState.player.facilityId;
    arrivalMinutes.set(npc.id, sameFacility || companion.has(npc.id) ? 0 : minutes);
  }
  return buildCollapseRescueCandidates({
    presentNpcIds,
    companionNpcIds: companion,
    reachableNpcIds,
    npcStates,
    npcDefinitions: model.npcById ?? Object.fromEntries((model.npcs ?? []).map((npc) => [npc.id, npc])),
    location: incidentHub,
    facilityId: runtime.playerState.player.facilityId,
  }).map((candidate) => ({
    ...candidate,
    travelMinutes: arrivalMinutes.get(candidate.id) ?? candidate.travelMinutes,
  }));
}

function worldTicksThrough(targetMinute) {
  const ticks = [];
  const capped = Math.min(journey.GAME_END_MINUTE, Math.max(0, targetMinute));
  for (let day = 1; day <= 100; day += 1) {
    for (let phaseIndex = 0; phaseIndex < PHASE_MINUTES.length; phaseIndex += 1) {
      const minute = (day - 1) * 1440 + PHASE_MINUTES[phaseIndex];
      if (minute > capped) return ticks;
      ticks.push({
        minute, day, phaseIndex, phase: PHASE_NAMES[phaseIndex],
        hour: [10, 14, 18, 22][phaseIndex],
        absoluteHour: (day - 1) * 24 + phaseIndex * 4,
      });
    }
  }
  return ticks;
}

function settleLivingWorldMovement(runtime, absoluteMinute, excludedNpcId = null) {
  const absoluteHour = Math.max(0, number(absoluteMinute)) / 60;
  for (const state of Object.values(runtime.livingWorld?.npcStates ?? {})) {
    if (state.id === excludedNpcId) continue;
    const local = state.localTravel;
    if (local && local.arriveAt <= absoluteHour + 1e-9) {
      state.position = { hubId: local.hubId, facilityId: local.toFacilityId };
      state.location = local.hubId;
      state.localTravel = null;
      state.presence = "present";
      state.localMovementCount = number(state.localMovementCount) + 1;
      runtime.livingWorld.localMovementEvents?.push({
        type: "local-arrival", npcId: state.id, hubId: local.hubId,
        facilityId: local.toFacilityId, absoluteHour, settledBy: "rescue-world-clock",
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

export function advanceLivingWorldDuringRescue(runtime, targetMinute, rescuerId = null) {
  const engine = runtime.livingWorld;
  if (!engine) return;
  const pending = worldTicksThrough(targetMinute).filter((tick) => tick.minute > number(runtime.lastWorldTickMinute, -1));
  const originalModel = engine.model;
  const filteredModel = rescuerId && originalModel
    ? { ...originalModel, npcs: (originalModel.npcs ?? []).filter((npc) => npc.id !== rescuerId) }
    : originalModel;
  for (const time of pending) {
    settleLivingWorldMovement(runtime, time.minute, rescuerId);
    if (filteredModel) engine.model = filteredModel;
    prepareNpcLifeTick(engine, { time, troubleStates: runtime.playerState.troubles, worldFlags: runtime.playerState.worldFlags });
    completeNpcLifeTick(engine, { time, troubleStates: runtime.playerState.troubles, worldFlags: runtime.playerState.worldFlags });
    runtime.lastWorldTickMinute = time.minute;
  }
  if (originalModel) engine.model = originalModel;
  settleLivingWorldMovement(runtime, targetMinute, rescuerId);
}

function advancePlayerWorldDuringRescue(runtime, data, elapsedMinutes) {
  const start = runtime.playerState.absoluteMinute;
  const action = {
    id: `SYSTEM_RESCUE_TIME:${start}:${elapsedMinutes}`,
    type: "collapseRecoveryTime",
    minutes: elapsedMinutes,
    label: "救助・搬送・治療の間、時間が経過する",
    danger: false,
  };
  journey.resolvePlayerAction(
    runtime.playerState,
    data.model,
    data.battleData,
    data.skills,
    runtime.playerState.catalog,
    profileFor(runtime.playerState.profileId),
    action,
  );
  return runtime.playerState.absoluteMinute;
}

function startRescuerDuty(runtime, rescuer, destination, incident, plan) {
  if (!rescuer?.id || rescuer.id === "SYSTEM_LOCAL_AID") return null;
  const state = runtime.livingWorld?.npcStates?.[rescuer.id];
  if (!state) return null;
  const startMinute = runtime.playerState.absoluteMinute;
  state.rescueDuty = {
    incidentId: incident.id,
    startedAtMinute: startMinute,
    foundAtMinute: startMinute + plan.discoveryDelayMinutes,
    destinationLocation: destination.location,
    destinationFacilityId: destination.facilityId,
    occupiedUntilMinute: startMinute + plan.elapsedMinutes,
  };
  state.rescueHistory ??= [];
  state.rescueHistory.push({ ...state.rescueDuty, type: "PLAYER_RESCUE_STARTED" });
  state.currentGoal = "rescue-player";
  state.travel = null;
  state.localTravel = null;
  return state;
}

function finishRescuerDuty(runtime, rescuer, destination, rescueMinute) {
  if (!rescuer?.id || rescuer.id === "SYSTEM_LOCAL_AID") return;
  const state = runtime.livingWorld?.npcStates?.[rescuer.id];
  if (!state) return;
  state.location = destination.location;
  state.position = { hubId: destination.location, facilityId: destination.facilityId };
  state.presence = "present";
  state.currentGoal = "recover-after-rescue";
  state.rescueHistory ??= [];
  state.rescueHistory.push({
    type: "PLAYER_RESCUE_COMPLETED",
    incidentId: state.rescueDuty?.incidentId ?? null,
    completedAtMinute: rescueMinute,
    location: destination.location,
    facilityId: destination.facilityId,
  });
  state.lastRescue = state.rescueHistory.at(-1);
  state.rescueDuty = null;
}

function applyPendingBattleDefeatSettlement(player) {
  const pending = player.pendingDefeatSettlement;
  if (!pending) return null;
  const goldBefore = Math.max(0, number(player.gold));
  const goldLoss = Math.min(goldBefore, Math.max(0, Math.floor(number(pending.goldLoss, Math.floor(goldBefore * 0.1)))));
  player.gold = goldBefore - goldLoss;
  player.hpRatio = number(pending.recoveryHpRatio, 0.35);
  player.mpRatio = number(pending.recoveryMpRatio, 0.2);
  delete player.pendingDefeatSettlement;
  return { goldBefore, goldLoss, goldAfter: player.gold, hpRatio: player.hpRatio, mpRatio: player.mpRatio };
}

function persistRuntime(record, runtime, data) {
  syncAuthoritativePresentNpcIds(runtime, data);
  const snapshot = serializeRuntime(runtime);
  const normalized = deserializeRuntime(snapshot, data);
  record.runtimeSnapshot = snapshot;
  record.stateHash = gameStateHash(normalized, data);
  record.summary = {
    clock: { day: normalized.playerState.day, time: `${String(normalized.playerState.hour).padStart(2, "0")}:${String(normalized.playerState.minute).padStart(2, "0")}` },
    location: normalized.playerState.player.location,
    facilityId: normalized.playerState.player.facilityId,
    level: normalized.playerState.player.level,
  };
}

function rescueOutcome(rescue, destination, settlement, incident) {
  const rescuerName = rescue.rescuer?.name ?? "近隣の救護者";
  const total = rescue.elapsedMinutes;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const lossText = settlement ? ` 所持金を${settlement.goldLoss}G失い、HP35%・MP20%まで治療された。` : "";
  const summary = `${rescuerName}に発見され、${destination.facilityName ?? destination.location}へ運ばれた。発見${rescue.discoveryDelayMinutes}分・搬送${rescue.evacuationMinutes}分・治療${rescue.treatmentRecoveryMinutes}分、合計${hours}時間${minutes}分。${lossText}`;
  return {
    ok: true, type: "collapseRescue", summary,
    collapseRescue: {
      incidentId: incident.id,
      rescuerId: rescue.rescuerId,
      rescuerName,
      usedFallback: rescue.usedFallback,
      foundLocation: incident.location,
      foundFacilityId: incident.facilityId,
      wakeLocation: destination.location,
      wakeFacilityId: destination.facilityId,
      wakeFacilityName: destination.facilityName,
      discoveryDelayMinutes: rescue.discoveryDelayMinutes,
      evacuationMinutes: rescue.evacuationMinutes,
      treatmentRecoveryMinutes: rescue.treatmentRecoveryMinutes,
      elapsedMinutes: total,
      rescuedAtMinute: rescue.rescueMinute,
      goldLoss: settlement?.goldLoss ?? 0,
      hpRatio: settlement?.hpRatio ?? null,
      mpRatio: settlement?.mpRatio ?? null,
      emergencyDestinationFallback: destination.emergencyFallback,
    },
  };
}

export class RescueWorldAwareTrpgGameService extends WorldTimeAwareTrpgGameService {
  async resolveCollapse(ownerHash, id, input) {
    const commandId = String(input.commandId ?? "").trim().slice(0, 100);
    if (!commandId) throw new TrpgGameError(400, "command_id_required");
    const record = await this.recordForOwner(ownerHash, id);
    const duplicate = record.commandLog.find((entry) => entry.commandId === commandId);
    if (duplicate) {
      if (duplicate.type !== RESOLVE_COLLAPSE_COMMAND) throw new TrpgGameError(409, "command_id_conflict");
      return { duplicate: true, originalRevision: duplicate.revisionAfter, save: this.gameViewForRecord(record) };
    }
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== record.revision) {
      throw new TrpgGameError(409, "revision_conflict", "The save changed before this command was applied", { currentRevision: record.revision });
    }

    const runtime = deserializeRuntime(record.runtimeSnapshot, this.data);
    const beforeHash = gameStateHash(runtime, this.data);
    if (beforeHash !== record.stateHash) throw new TrpgGameError(409, "save_state_hash_mismatch");
    const context = { minute: runtime.playerState.absoluteMinute, location: runtime.playerState.player.location, facilityId: runtime.playerState.player.facilityId };
    const opened = prepareCollapseCommand(runtime.playerState.player, RESOLVE_COLLAPSE_COMMAND, context);
    if (!opened.incident) throw new TrpgGameError(409, "player_collapse_rescue_not_available");
    syncAuthoritativePresentNpcIds(runtime, this.data);

    const candidates = productionRescueCandidates(runtime, this.data);
    const destination = selectCanonicalRescueDestination(runtime.playerState, this.data.model);
    const preview = planIncapacitationRescue(opened.incident, {
      candidates,
      destination,
      rescueArrivalMinutes: null,
      evacuationMinutes: destination.evacuationMinutes,
      fallbackDiscoveryMinutes: 60,
      fallbackEvacuationMinutes: destination.evacuationMinutes,
      treatmentRecoveryMinutes: runtime.playerState.player.pendingDefeatSettlement
        ? number(runtime.playerState.tuning?.defeatRecoveryMinutes, 360)
        : 180,
    });
    if (!preview) throw new TrpgGameError(409, "player_collapse_rescue_not_available");
    const selectedArrival = preview.rescuer ? number(preview.rescuer.travelMinutes) : 60;
    const plan = planIncapacitationRescue(opened.incident, {
      candidates,
      destination,
      rescueArrivalMinutes: selectedArrival,
      evacuationMinutes: destination.evacuationMinutes,
      fallbackDiscoveryMinutes: 60,
      treatmentRecoveryMinutes: runtime.playerState.player.pendingDefeatSettlement
        ? number(runtime.playerState.tuning?.defeatRecoveryMinutes, 360)
        : 180,
    });

    const rescuerState = startRescuerDuty(runtime, plan.rescuer, destination, opened.incident, plan);
    const expectedMinute = runtime.playerState.absoluteMinute + plan.elapsedMinutes;
    advancePlayerWorldDuringRescue(runtime, this.data, plan.elapsedMinutes);
    runtime.playerState.player.hpRatio = 0;
    advanceLivingWorldDuringRescue(runtime, expectedMinute, plan.rescuerId);
    runtime.playerState.weather = resolveCanonicalWeather({ day: runtime.playerState.day, regionId: destination.location, daypart: runtime.playerState.daypart });

    const rescue = resolveCollapseRescue(runtime.playerState.player, {
      minute: opened.incident.atMinute,
      location: opened.incident.location,
      facilityId: opened.incident.facilityId,
      candidates,
      destination,
      rescueArrivalMinutes: selectedArrival,
      evacuationMinutes: destination.evacuationMinutes,
      wakeDelayMinutes: runtime.playerState.player.pendingDefeatSettlement
        ? number(runtime.playerState.tuning?.defeatRecoveryMinutes, 360)
        : 180,
      fallbackDiscoveryMinutes: 60,
    });
    if (!rescue.completed) throw new TrpgGameError(409, "player_collapse_rescue_not_available");
    runtime.playerState.absoluteMinute = expectedMinute;
    const clock = journey.clockFromMinute(expectedMinute);
    runtime.playerState.day = clock.day;
    runtime.playerState.hour = clock.hour;
    runtime.playerState.minute = clock.minute;
    runtime.playerState.minuteOfDay = clock.minuteOfDay;
    runtime.playerState.player.location = destination.location;
    runtime.playerState.player.facilityId = destination.facilityId;
    finishRescuerDuty(runtime, plan.rescuer, destination, expectedMinute);
    const settlement = applyPendingBattleDefeatSettlement(runtime.playerState.player);
    syncAuthoritativePresentNpcIds(runtime, this.data);

    runtime.playerState.history.push({
      type: plan.rescuer ? "PLAYER_RESCUED_BY_NPC" : "PLAYER_RESCUED_BY_LOCAL_AID",
      minute: expectedMinute,
      incidentId: opened.incident.id,
      rescuerId: plan.rescuerId,
      fromLocation: opened.incident.location,
      fromFacilityId: opened.incident.facilityId,
      wakeLocation: destination.location,
      wakeFacilityId: destination.facilityId,
      discoveryDelayMinutes: plan.discoveryDelayMinutes,
      evacuationMinutes: plan.evacuationMinutes,
      treatmentRecoveryMinutes: plan.treatmentRecoveryMinutes,
      elapsedMinutes: plan.elapsedMinutes,
      goldLoss: settlement?.goldLoss ?? 0,
    });
    if (rescuerState) {
      rescuerState.playerKnowledge ??= [];
      rescuerState.playerKnowledge.push({ type: "PLAYER_RESCUED", incidentId: opened.incident.id, minute: expectedMinute });
    }

    const outcome = rescueOutcome({ ...rescue, ...plan, rescueMinute: expectedMinute }, destination, settlement, opened.incident);
    const revisionBefore = record.revision;
    record.revision += 1;
    record.updatedAt = new Date().toISOString();
    record.lastOutcome = outcome;
    record.presentation = {
      revision: record.revision,
      source: "authoritative_living_world_rescue",
      narrative: outcome.summary,
      speeches: [],
      beats: [
        { kind: "narration", actorId: null, speakerLabel: null, text: outcome.summary },
        { kind: "rescue", actorId: plan.rescuerId, speakerLabel: outcome.collapseRescue.rescuerName, text: `${outcome.collapseRescue.foundLocation}で発見 → ${outcome.collapseRescue.wakeFacilityName ?? outcome.collapseRescue.wakeLocation}へ搬送` },
      ],
      choiceLabels: {},
    };
    persistRuntime(record, runtime, this.data);
    record.commandLog.push({
      seq: record.commandLog.length + 1,
      commandId,
      revisionBefore,
      revisionAfter: record.revision,
      stateBeforeHash: beforeHash,
      stateAfterHash: record.stateHash,
      type: RESOLVE_COLLAPSE_COMMAND,
      payload: {},
      outcome,
    });
    record.replayBase = { resolverVersion: record.resolverVersion, revision: record.revision, stateHash: record.stateHash, runtimeSnapshot: record.runtimeSnapshot };
    await this.store.put(record);
    return { duplicate: false, save: this.gameViewForRecord(record) };
  }

  health() {
    return { ...super.health(), rescueWorldAwareServiceVersion: RESCUE_WORLD_AWARE_SERVICE_VERSION };
  }
}

export function createRescueWorldAwareTrpgGameService(options = {}) {
  return new RescueWorldAwareTrpgGameService(options);
}
