import * as journey from "../../../../tools/trpg-sim/lib/player-journey.mjs";
import {
  recordPlayerNpcConversation,
  recordPlayerTravelInteractions,
} from "../../../../tools/trpg-sim/lib/player-common-interaction.mjs";
import {
  advancePlayerNeeds,
  ensurePlayerNeeds,
} from "../../../../tools/trpg-sim/lib/player-needs.mjs";
import { ensureWorkMarket } from "../resolvers/work-market-resolver.js";
import {
  discoverCapitalPublicRoutes,
  recordCapitalArrivalGuidance,
} from "../resolvers/capital-arrival-guidance.js";
import { deserializeRuntime, serializeRuntime } from "./serializer.js";
import { syncAuthoritativePresentNpcIds } from "./presence.js";
import {
  TrpgGameError,
  applyGameplayCatalogOverrides,
  gameStateHash,
} from "./service.js";
import {
  SurvivalAwareTrpgGameService,
} from "./survival-aware-service.js";
import { resolveCanonicalWeather } from "../resolvers/weather-resolver.js";

export const WORLD_TIME_AWARE_SERVICE_VERSION = "world-time-aware-service-v11";

const LIFE_ACTION_PATTERN = /^(?:EAT|LODGE|REST_OUTDOOR|WORK_MEAL):/u;
const WORK_MEAL_PATTERN = /^WORK_MEAL:([^:]+)$/u;
const MEAL_FACILITY_PATTERN = /(?:INN|BAKERY|MARKET|TAVERN|食堂|宿|パン|市場|酒場)/iu;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requestedChoiceActionId(input) {
  if (String(input?.type ?? "").trim().toUpperCase() !== "CHOOSE") return "";
  const actionId = String(input?.payload?.actionId ?? "").trim();
  if (actionId) return actionId;
  return String(input?.payload?.choiceId ?? "").trim();
}

function requestedWorkMealAction(input) {
  const actionId = requestedChoiceActionId(input);
  const match = WORK_MEAL_PATTERN.exec(actionId);
  if (!match) return null;
  return { actionId, facilityId: match[1] };
}

function isLifeAction(input) {
  return LIFE_ACTION_PATTERN.test(requestedChoiceActionId(input));
}

function lifeNeedState(view) {
  const hunger = number(view?.player?.needs?.hunger);
  const fatigue = number(view?.player?.needs?.fatigue);
  const hour = number(
    view?.clock?.hour,
    Number(String(view?.clock?.time ?? "0").split(":")[0]),
  );
  return {
    hunger,
    fatigue,
    hour,
    hungerEmergency: hunger >= 72,
    restEmergency: fatigue >= 72 || hour >= 21,
  };
}

function workMealChoice(view, data) {
  const needs = lifeNeedState(view);
  if (!needs.hungerEmergency || number(view?.player?.freeMeals) > 0) return null;
  const facilityId = String(view?.scene?.facilityId ?? "").trim();
  if (!facilityId) return null;
  const facility = data?.model?.facilityById?.[facilityId] ?? null;
  const facilityText = `${facilityId} ${facility?.name ?? ""}`;
  if (!MEAL_FACILITY_PATTERN.test(facilityText)) return null;
  const actionId = `WORK_MEAL:${facilityId}`;
  if ((view?.choices ?? []).some((choice) => choice.actionId === actionId)) return null;
  return {
    choiceId: actionId,
    id: actionId,
    actionId,
    label: `${facility?.name ?? "この場所"}の手伝いをして、まかないを受け取る`,
    type: "work",
    intentType: "life",
    minutes: 120,
    price: 0,
    nutrition: 48,
    fatigueCost: 10,
    danger: false,
  };
}

export function applySustenanceChoices(view, data) {
  if (!view) return view;
  const needs = lifeNeedState(view);
  let choices = view.choices ?? [];
  let changed = false;

  if (needs.hungerEmergency && !needs.restEmergency) {
    const filtered = choices.filter((choice) => !String(choice?.actionId ?? "").startsWith("REST_OUTDOOR:"));
    if (filtered.length !== choices.length) {
      choices = filtered;
      changed = true;
    }
  }

  const workMeal = workMealChoice({ ...view, choices }, data);
  if (workMeal) {
    choices = [workMeal, ...choices];
    changed = true;
  }

  return changed ? { ...view, choices } : view;
}

function reconcileLatestCommand(record) {
  const latest = [...(record.commandLog ?? [])]
    .reverse()
    .find((entry) => entry.revisionAfter === record.revision);
  if (latest) latest.stateAfterHash = record.stateHash;
  record.replayBase = {
    resolverVersion: record.resolverVersion,
    revision: record.revision,
    stateHash: record.stateHash,
    runtimeSnapshot: record.runtimeSnapshot,
  };
  record.updatedAt = new Date().toISOString();
}

function refreshCapitalPublicRoutesForView(runtime, data) {
  const visitedHubs = runtime.playerState.progress?.travel?.visitedHubs instanceof Set
    ? runtime.playerState.progress.travel.visitedHubs
    : new Set(runtime.playerState.progress?.travel?.visitedHubs ?? []);
  if (runtime.playerState.player.location !== "王都" && !visitedHubs.has("王都")) return;
  const reachableHubIds = journey.availableTravelActions(runtime.playerState, data.model)
    .map((action) => action.destinationHub)
    .filter(Boolean);
  discoverCapitalPublicRoutes(runtime, {
    reachableHubIds,
    absoluteMinute: runtime.playerState.absoluteMinute,
  });
}

function normalizeRuntimeForView(runtime, data) {
  applyGameplayCatalogOverrides(runtime.playerState.catalog);
  ensureWorkMarket(runtime);
  recordCapitalArrivalGuidance(runtime);
  refreshCapitalPublicRoutesForView(runtime, data);
  syncAuthoritativePresentNpcIds(runtime, data);
  const runtimeSnapshot = serializeRuntime(runtime);
  return {
    runtimeSnapshot,
    runtime: deserializeRuntime(runtimeSnapshot, data),
  };
}

function persistRuntime(record, runtime, data) {
  const normalized = normalizeRuntimeForView(runtime, data);
  record.runtimeSnapshot = normalized.runtimeSnapshot;
  record.stateHash = gameStateHash(normalized.runtime, data);
  record.summary = {
    clock: {
      day: normalized.runtime.playerState.day,
      time: `${String(normalized.runtime.playerState.hour).padStart(2, "0")}:${String(normalized.runtime.playerState.minute).padStart(2, "0")}`,
    },
    location: normalized.runtime.playerState.player.location,
    facilityId: normalized.runtime.playerState.player.facilityId,
    level: normalized.runtime.playerState.player.level,
  };
}

function updateClock(state, absoluteMinute) {
  const clock = journey.clockFromMinute(absoluteMinute);
  state.absoluteMinute = absoluteMinute;
  state.day = clock.day;
  state.hour = clock.hour;
  state.minute = clock.minute;
  state.minuteOfDay = clock.minuteOfDay;
  state.phaseIndex = clock.minuteOfDay >= 1320 || clock.minuteOfDay < 600
    ? 3
    : clock.minuteOfDay >= 1080
      ? 2
      : clock.minuteOfDay >= 840
        ? 1
        : 0;
  state.daypart = clock.minuteOfDay < 480
    ? "dawn"
    : clock.minuteOfDay < 1080
      ? "day"
      : clock.minuteOfDay < 1320
        ? "dusk"
        : "night";
}

function commandPayload(input) {
  return {
    choiceId: String(input?.payload?.choiceId ?? "").trim(),
    actionId: String(input?.payload?.actionId ?? "").trim(),
  };
}

function visibleRequestedAction(view, input) {
  const type = String(input?.type ?? "").trim().toUpperCase();
  if (type === "MOVE") {
    const moveId = String(input?.payload?.moveId ?? "").trim();
    const move = (view?.movement ?? []).find((entry) => String(entry?.moveId ?? "") === moveId);
    return move ? { ...move, id: move.moveId, actionId: move.moveId, type: "move" } : null;
  }
  if (type === "TALK") {
    const npcId = String(input?.payload?.npcId ?? "").trim();
    return (view?.choices ?? []).find((entry) => entry?.type === "conversation" && entry?.targetNpcId === npcId) ?? null;
  }
  if (type !== "CHOOSE") return null;
  const actionId = String(input?.payload?.actionId ?? "").trim();
  const choiceId = String(input?.payload?.choiceId ?? "").trim();
  return (view?.choices ?? []).find((entry) =>
    (actionId && entry?.actionId === actionId)
    || (choiceId && entry?.choiceId === choiceId)) ?? null;
}

function playerIdentity(record, runtime) {
  const player = runtime?.playerState?.player ?? {};
  return {
    id: String(player.id ?? `PLAYER:${record.id}`),
    name: String(player.displayName ?? player.name ?? record.playerName ?? "旅人"),
  };
}

function playerLocation(runtime) {
  return {
    hubId: runtime?.playerState?.player?.location ?? null,
    facilityId: runtime?.playerState?.player?.facilityId ?? null,
  };
}

export function synchronizePersistedRecordHash(record, data) {
  if (!record?.runtimeSnapshot || !data) return false;
  const hydratedRuntime = deserializeRuntime(record.runtimeSnapshot, data);
  const normalized = normalizeRuntimeForView(hydratedRuntime, data);
  const normalizedHash = gameStateHash(normalized.runtime, data);
  const snapshotChanged = JSON.stringify(normalized.runtimeSnapshot) !== JSON.stringify(record.runtimeSnapshot);
  if (!snapshotChanged && normalizedHash === record.stateHash) return false;
  record.runtimeSnapshot = normalized.runtimeSnapshot;
  record.stateHash = normalizedHash;
  reconcileLatestCommand(record);
  return true;
}

export function synchronizeLifeActionWeatherRecord(record, data) {
  if (!record?.runtimeSnapshot || !data) return false;
  const runtime = deserializeRuntime(record.runtimeSnapshot, data);
  const state = runtime.playerState;
  const expectedWeather = resolveCanonicalWeather({
    day: state.day,
    regionId: state.player.location,
    daypart: state.daypart,
  });
  if (state.weather?.scheduleKey === expectedWeather.scheduleKey) return false;

  state.weather = expectedWeather;
  const normalized = normalizeRuntimeForView(runtime, data);
  record.runtimeSnapshot = normalized.runtimeSnapshot;
  record.stateHash = gameStateHash(normalized.runtime, data);
  reconcileLatestCommand(record);
  return true;
}

export class WorldTimeAwareTrpgGameService extends SurvivalAwareTrpgGameService {
  gameViewForRecord(record) {
    synchronizePersistedRecordHash(record, this.data);
    return applySustenanceChoices(super.gameViewForRecord(record), this.data);
  }

  async create(...args) {
    return applySustenanceChoices(await super.create(...args), this.data);
  }

  async get(ownerHash, id, ...args) {
    const record = await this.recordForOwner(ownerHash, id);
    if (synchronizePersistedRecordHash(record, this.data)) await this.store.put(record);
    return applySustenanceChoices(await super.get(ownerHash, id, ...args), this.data);
  }

  async resolveWorkMealAction(ownerHash, id, input, request) {
    const commandId = String(input?.commandId ?? "").trim().slice(0, 100);
    if (!commandId) throw new TrpgGameError(400, "command_id_required");
    const record = await this.recordForOwner(ownerHash, id);
    if (synchronizePersistedRecordHash(record, this.data)) await this.store.put(record);
    const duplicate = record.commandLog.find((entry) => entry.commandId === commandId);
    if (duplicate) {
      if (duplicate.resolvedActionId !== request.actionId) {
        throw new TrpgGameError(409, "command_id_conflict", "The command id was already used for a different command");
      }
      return { duplicate: true, originalRevision: duplicate.revisionAfter, save: this.gameViewForRecord(record) };
    }
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== record.revision) {
      throw new TrpgGameError(409, "revision_conflict", "The save changed before this command was applied", {
        currentRevision: record.revision,
      });
    }

    const runtime = deserializeRuntime(record.runtimeSnapshot, this.data);
    const player = runtime.playerState.player;
    ensurePlayerNeeds(player);
    const beforeHash = gameStateHash(runtime, this.data);
    if (beforeHash !== record.stateHash) throw new TrpgGameError(409, "save_state_hash_mismatch");
    const visibleView = this.gameViewForRecord(record);
    const visible = (visibleView.choices ?? []).find((choice) => choice.actionId === request.actionId);
    if (!visible || String(player.facilityId ?? "") !== request.facilityId) {
      throw new TrpgGameError(409, "choice_not_available");
    }

    const minutes = 120;
    advancePlayerNeeds(player, {
      minutes,
      reason: "work_for_meal",
      daypart: runtime.playerState.daypart,
      weatherTags: runtime.playerState.weather?.tags ?? [],
      outdoors: false,
    });
    player.needs.hunger = Math.max(0, number(player.needs.hunger) - 48);
    player.needs.fatigue = Math.min(99, number(player.needs.fatigue) + 10);
    updateClock(runtime.playerState, runtime.playerState.absoluteMinute + minutes);

    const summary = `${visible.label}。二時間働き、温かいまかないで空腹をしのいだ。`;
    runtime.playerState.history.push({
      type: "PLAYER_ACTION_RESOLVED",
      minute: runtime.playerState.absoluteMinute,
      actionId: request.actionId,
      actionType: "work_meal",
      facilityId: request.facilityId,
      location: player.location,
      minutes,
    });
    const outcome = {
      ok: true,
      type: "work_meal",
      summary,
      minutes,
      facilityId: request.facilityId,
    };
    const revisionBefore = record.revision;
    record.revision += 1;
    record.lastOutcome = outcome;
    record.presentation = {
      revision: record.revision,
      source: "deterministic_work_meal_action",
      narrative: summary,
      speeches: [],
      beats: [{ kind: "narration", actorId: null, speakerLabel: null, text: summary }],
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
      type: "CHOOSE",
      payload: commandPayload(input),
      resolvedActionId: request.actionId,
      outcome,
    });
    reconcileLatestCommand(record);
    await this.store.put(record);
    await this.persistCollapseAfterLifeAction(record);
    if (synchronizeLifeActionWeatherRecord(record, this.data)) await this.store.put(record);
    return { duplicate: false, save: this.gameViewForRecord(record) };
  }

  async command(ownerHash, id, input = {}) {
    const recordBefore = await this.recordForOwner(ownerHash, id);
    if (synchronizePersistedRecordHash(recordBefore, this.data)) await this.store.put(recordBefore);

    const workMeal = requestedWorkMealAction(input);
    if (workMeal) {
      return this.runLocked(id, () => this.resolveWorkMealAction(ownerHash, id, input, workMeal));
    }

    const runtimeBefore = deserializeRuntime(recordBefore.runtimeSnapshot, this.data);
    const visibleBefore = this.gameViewForRecord(recordBefore);
    const selectedBefore = visibleRequestedAction(visibleBefore, input);
    const locationBefore = playerLocation(runtimeBefore);

    const result = await super.command(ownerHash, id, input);
    if (result?.duplicate) return result;

    const record = await this.recordForOwner(ownerHash, id);
    let changed = synchronizePersistedRecordHash(record, this.data);
    if (isLifeAction(input)) {
      changed = synchronizeLifeActionWeatherRecord(record, this.data) || changed;
    }

    if (selectedBefore) {
      const runtime = deserializeRuntime(record.runtimeSnapshot, this.data);
      const identity = playerIdentity(record, runtime);
      const absoluteHour = Number(runtime.playerState.absoluteMinute ?? 0) / 60;
      let commonChanged = false;
      if (selectedBefore.type === "conversation" && selectedBefore.targetNpcId) {
        const conversation = recordPlayerNpcConversation(runtime.livingWorld, {
          playerId: identity.id,
          playerName: identity.name,
          npcId: selectedBefore.targetNpcId,
          absoluteHour,
          location: playerLocation(runtime),
          actionId: selectedBefore.actionId ?? selectedBefore.id ?? null,
        });
        commonChanged = conversation.learned || commonChanged;
      }
      if (selectedBefore.type === "move") {
        const contacts = recordPlayerTravelInteractions(runtime.livingWorld, {
          playerId: identity.id,
          playerName: identity.name,
          before: locationBefore,
          after: playerLocation(runtime),
          absoluteHour,
          actionId: selectedBefore.actionId ?? selectedBefore.moveId ?? null,
        });
        commonChanged = contacts.length > 0 || commonChanged;
      }
      if (commonChanged) {
        persistRuntime(record, runtime, this.data);
        reconcileLatestCommand(record);
        changed = true;
      }
    }

    if (!changed) return result;
    await this.store.put(record);
    return {
      ...result,
      save: this.gameViewForRecord(record),
    };
  }

  health() {
    return {
      ...super.health(),
      worldTimeAwareServiceVersion: WORLD_TIME_AWARE_SERVICE_VERSION,
    };
  }
}

export function createWorldTimeAwareTrpgGameService(options = {}) {
  return new WorldTimeAwareTrpgGameService(options);
}
