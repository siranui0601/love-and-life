import * as journey from "../../../../tools/trpg-sim/lib/player-journey.mjs";
import { ensurePlayerNeeds } from "../../../../tools/trpg-sim/lib/player-needs.mjs";
import {
  applyCollapseRescueView,
  buildCollapseRescueCandidates,
  prepareCollapseCommand,
  resolveCollapseRescue,
} from "../resolvers/player-collapse-resolver.js";
import { syncAuthoritativePresentNpcIds } from "./presence.js";
import { deserializeRuntime, serializeRuntime } from "./serializer.js";
import {
  TrpgGameError,
  TrpgGameService,
  gameStateHash,
} from "./service.js";

export const COLLAPSE_AWARE_SERVICE_VERSION = "collapse-aware-service-v2";
export const RESOLVE_COLLAPSE_COMMAND = "RESOLVE_COLLAPSE_RESCUE";
export const RESOLVE_COLLAPSE_CHOICE_ID = "COLLAPSE_RESCUE:ACCEPT";

function commandPayload(type, input) {
  if (type === RESOLVE_COLLAPSE_COMMAND) return {};
  return input && typeof input === "object" && !Array.isArray(input) ? input : {};
}

function collapseContext(runtime) {
  return {
    minute: runtime.playerState.absoluteMinute,
    location: runtime.playerState.player.location,
    facilityId: runtime.playerState.player.facilityId,
  };
}

function hydrateRecord(record, data) {
  const runtime = deserializeRuntime(record.runtimeSnapshot, data);
  ensurePlayerNeeds(runtime.playerState.player);
  syncAuthoritativePresentNpcIds(runtime, data);
  return runtime;
}

function updateClock(state, absoluteMinute) {
  const clock = journey.clockFromMinute(absoluteMinute);
  state.absoluteMinute = absoluteMinute;
  state.day = clock.day;
  state.hour = clock.hour;
  state.minute = clock.minute;
  if (clock.phaseIndex != null) state.phaseIndex = clock.phaseIndex;
  if (clock.daypart != null) state.daypart = clock.daypart;
}

function persistRuntime(record, runtime, data) {
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = gameStateHash(runtime, data);
  record.summary = {
    clock: {
      day: runtime.playerState.day,
      time: `${String(runtime.playerState.hour).padStart(2, "0")}:${String(runtime.playerState.minute).padStart(2, "0")}`,
    },
    location: runtime.playerState.player.location,
    facilityId: runtime.playerState.player.facilityId,
    level: runtime.playerState.player.level,
  };
}

function reachableRescueNpcIds(runtime) {
  const playerLocation = runtime.playerState.player.location;
  return Object.values(runtime.livingWorld?.npcStates ?? {})
    .filter((state) => {
      const location = state.position?.hubId ?? state.location ?? null;
      if (location !== playerLocation) return false;
      if (state.travel || state.localTravel) return false;
      return !["dead", "missing", "departed"].includes(String(state.lifeStatus ?? "").toLowerCase());
    })
    .map((state) => state.id)
    .filter(Boolean);
}

function rescueCandidates(runtime, data) {
  const presentNpcIds = runtime.playerState.authoritativePresentNpcIds instanceof Set
    ? runtime.playerState.authoritativePresentNpcIds
    : new Set(runtime.playerState.authoritativePresentNpcIds ?? []);
  return buildCollapseRescueCandidates({
    presentNpcIds,
    reachableNpcIds: reachableRescueNpcIds(runtime),
    npcStates: runtime.livingWorld?.npcStates ?? {},
    npcDefinitions: data.model?.npcById ?? Object.fromEntries((data.model?.npcs ?? []).map((npc) => [npc.id, npc])),
    location: runtime.playerState.player.location,
    facilityId: runtime.playerState.player.facilityId,
    fallbackWakeFacilityId: runtime.playerState.player.facilityId,
  });
}

function openCollapse(runtime, commandType = "CHOOSE") {
  return prepareCollapseCommand(runtime.playerState.player, commandType, collapseContext(runtime));
}

function rescueOutcome(rescue) {
  const rescuerName = rescue.rescuer?.name ?? (rescue.usedFallback ? "近隣の救護者" : "救助者");
  return {
    ok: true,
    type: "collapseRescue",
    summary: `${rescuerName}に救助され、${Math.max(0, rescue.rescueMinute - Number(rescue.incident?.atMinute ?? rescue.rescueMinute))}分後に目を覚ました。`,
    collapseRescue: {
      incidentId: rescue.incident?.id ?? null,
      rescuerId: rescue.incident?.rescuerId ?? null,
      rescuedAtMinute: rescue.incident?.rescuedAtMinute ?? rescue.rescueMinute,
      wakeLocation: rescue.wakeLocation,
      wakeFacilityId: rescue.wakeFacilityId,
      usedFallback: rescue.usedFallback,
    },
  };
}

function rescueChoice(rescueView) {
  return {
    choiceId: RESOLVE_COLLAPSE_CHOICE_ID,
    id: RESOLVE_COLLAPSE_CHOICE_ID,
    actionId: RESOLVE_COLLAPSE_COMMAND,
    label: rescueView?.command?.label ?? "救助を受け、目を覚ます",
    type: "rest",
    intentType: "rescue",
    minutes: 180,
    danger: false,
  };
}

function isRescueRequest(input = {}) {
  const type = String(input.type ?? "").trim().toUpperCase();
  if (type === RESOLVE_COLLAPSE_COMMAND) return true;
  if (type !== "CHOOSE") return false;
  return String(input.payload?.actionId ?? "").trim().toUpperCase() === RESOLVE_COLLAPSE_COMMAND
    && String(input.payload?.choiceId ?? "").trim() === RESOLVE_COLLAPSE_CHOICE_ID;
}

export class CollapseAwareTrpgGameService extends TrpgGameService {
  gameViewForRecord(record) {
    const runtime = hydrateRecord(record, this.data);
    const actualHash = gameStateHash(runtime, this.data);
    if (actualHash !== record.stateHash) throw new TrpgGameError(409, "save_state_hash_mismatch");
    const base = super.gameViewForRecord(record);
    const facility = this.data.model.facilityById[runtime.playerState.player.facilityId];
    const view = applyCollapseRescueView(base, runtime.playerState.player, {
      facilityName: facility?.name ?? runtime.playerState.player.facilityId,
    });
    if (!view?.collapseRescue?.active) return view;
    return {
      ...view,
      choices: [rescueChoice(view.collapseRescue)],
    };
  }

  async ensurePersistedCollapse(record) {
    const runtime = hydrateRecord(record, this.data);
    const opened = openCollapse(runtime);
    if (!opened.opened) return { runtime, opened, changed: false };
    persistRuntime(record, runtime, this.data);
    record.updatedAt = new Date().toISOString();
    await this.store.put(record);
    return { runtime, opened, changed: true };
  }

  async get(ownerHash, id) {
    return this.runLocked(id, async () => {
      const record = await this.recordForOwner(ownerHash, id);
      await this.ensurePersistedCollapse(record);
      return this.gameViewForRecord(record);
    });
  }

  async resolveCollapse(ownerHash, id, input) {
    const commandId = String(input.commandId ?? "").trim().slice(0, 100);
    if (!commandId) throw new TrpgGameError(400, "command_id_required");
    const record = await this.recordForOwner(ownerHash, id);
    const duplicate = record.commandLog.find((entry) => entry.commandId === commandId);
    if (duplicate) {
      if (duplicate.type !== RESOLVE_COLLAPSE_COMMAND) {
        throw new TrpgGameError(409, "command_id_conflict", "The command id was already used for a different command");
      }
      return { duplicate: true, originalRevision: duplicate.revisionAfter, save: this.gameViewForRecord(record) };
    }
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== record.revision) {
      throw new TrpgGameError(409, "revision_conflict", "The save changed before this command was applied", {
        currentRevision: record.revision,
      });
    }

    const runtime = hydrateRecord(record, this.data);
    const beforeHash = gameStateHash(runtime, this.data);
    const opened = openCollapse(runtime, RESOLVE_COLLAPSE_COMMAND);
    if (!opened.incident) throw new TrpgGameError(409, "player_collapse_rescue_not_available");
    const candidates = rescueCandidates(runtime, this.data);
    const rescue = resolveCollapseRescue(runtime.playerState.player, {
      ...collapseContext(runtime),
      candidates,
      fallbackWakeLocation: runtime.playerState.player.location,
      fallbackWakeFacilityId: runtime.playerState.player.facilityId,
    });
    if (!rescue.completed) throw new TrpgGameError(409, "player_collapse_rescue_not_available");

    updateClock(runtime.playerState, rescue.rescueMinute);
    runtime.playerState.player.location = rescue.wakeLocation;
    runtime.playerState.player.facilityId = rescue.wakeFacilityId;
    syncAuthoritativePresentNpcIds(runtime, this.data);
    runtime.playerState.history.push({
      type: "PLAYER_COLLAPSE_RESCUED",
      minute: rescue.rescueMinute,
      incidentId: rescue.incident.id,
      rescuerId: rescue.incident.rescuerId,
      wakeLocation: rescue.wakeLocation,
      wakeFacilityId: rescue.wakeFacilityId,
    });

    const outcome = rescueOutcome(rescue);
    const revisionBefore = record.revision;
    record.revision += 1;
    record.updatedAt = new Date().toISOString();
    record.lastOutcome = outcome;
    record.presentation = {
      revision: record.revision,
      source: "deterministic_collapse_rescue",
      narrative: outcome.summary,
      speeches: [],
      beats: [{ kind: "narration", actorId: null, speakerLabel: null, text: outcome.summary }],
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
      payload: commandPayload(RESOLVE_COLLAPSE_COMMAND, input.payload),
      resolvedActionId: RESOLVE_COLLAPSE_COMMAND,
      outcome,
    });
    record.replayBase = {
      resolverVersion: record.resolverVersion,
      revision: record.revision,
      stateHash: record.stateHash,
      runtimeSnapshot: record.runtimeSnapshot,
    };
    await this.store.put(record);
    return { duplicate: false, save: this.gameViewForRecord(record) };
  }

  async command(ownerHash, id, input = {}) {
    if (isRescueRequest(input)) {
      return this.runLocked(id, () => this.resolveCollapse(ownerHash, id, input));
    }

    const record = await this.recordForOwner(ownerHash, id);
    const prepared = await this.ensurePersistedCollapse(record);
    const block = openCollapse(prepared.runtime, String(input.type ?? "").trim().toUpperCase());
    if (block.blocked) {
      throw new TrpgGameError(409, block.code, block.code, {
        incidentId: block.incident?.id ?? null,
        commandType: block.commandType,
        causes: block.causes,
      });
    }

    const result = await super.command(ownerHash, id, input);
    const updatedRecord = await this.recordForOwner(ownerHash, id);
    await this.ensurePersistedCollapse(updatedRecord);
    result.save = this.gameViewForRecord(updatedRecord);
    return result;
  }
}

export function createCollapseAwareTrpgGameService(options = {}) {
  return new CollapseAwareTrpgGameService(options);
}
