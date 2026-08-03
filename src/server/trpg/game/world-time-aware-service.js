import * as journey from "../../../../tools/trpg-sim/lib/player-journey.mjs";
import {
  advancePlayerNeeds,
  ensurePlayerNeeds,
} from "../../../../tools/trpg-sim/lib/player-needs.mjs";
import { deserializeRuntime, serializeRuntime } from "./serializer.js";
import {
  TrpgGameError,
  gameStateHash,
} from "./service.js";
import {
  SurvivalAwareTrpgGameService,
} from "./survival-aware-service.js";
import { resolveCanonicalWeather } from "../resolvers/weather-resolver.js";

export const WORLD_TIME_AWARE_SERVICE_VERSION = "world-time-aware-service-v3";

const LIFE_ACTION_PATTERN = /^(?:EAT|LODGE|REST_OUTDOOR|WORK_MEAL):/u;
const WORK_MEAL_PATTERN = /^WORK_MEAL:([^:]+)$/u;
const MEAL_FACILITY_PATTERN = /(?:INN|BAKERY|MARKET|TAVERN|食堂|宿|パン|市場|酒場)/iu;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requestedChoiceActionId(input) {
  if (String(input?.type ?? "").trim().toUpperCase() !== "CHOOSE") return "";
  return String(input?.payload?.actionId ?? input?.payload?.choiceId ?? "").trim();
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

function persistRuntime(record, runtime, data) {
  const runtimeSnapshot = serializeRuntime(runtime);
  const normalizedRuntime = deserializeRuntime(runtimeSnapshot, data);
  record.runtimeSnapshot = runtimeSnapshot;
  record.stateHash = gameStateHash(normalizedRuntime, data);
  record.summary = {
    clock: {
      day: normalizedRuntime.playerState.day,
      time: `${String(normalizedRuntime.playerState.hour).padStart(2, "0")}:${String(normalizedRuntime.playerState.minute).padStart(2, "0")}`,
    },
    location: normalizedRuntime.playerState.player.location,
    facilityId: normalizedRuntime.playerState.player.facilityId,
    level: normalizedRuntime.playerState.player.level,
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
  const runtimeSnapshot = serializeRuntime(runtime);
  const normalizedRuntime = deserializeRuntime(runtimeSnapshot, data);
  record.runtimeSnapshot = runtimeSnapshot;
  record.stateHash = gameStateHash(normalizedRuntime, data);
  reconcileLatestCommand(record);
  return true;
}

export class WorldTimeAwareTrpgGameService extends SurvivalAwareTrpgGameService {
  gameViewForRecord(record) {
    return applySustenanceChoices(super.gameViewForRecord(record), this.data);
  }

  async create(...args) {
    return applySustenanceChoices(await super.create(...args), this.data);
  }

  async get(...args) {
    return applySustenanceChoices(await super.get(...args), this.data);
  }

  async resolveWorkMealAction(ownerHash, id, input, request) {
    const commandId = String(input?.commandId ?? "").trim().slice(0, 100);
    if (!commandId) throw new TrpgGameError(400, "command_id_required");
    const record = await this.recordForOwner(ownerHash, id);
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
    const visible = workMealChoice(super.gameViewForRecord(record), this.data);
    if (!visible || visible.actionId !== request.actionId || request.facilityId !== player.facilityId) {
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
      facilityId: player.facilityId,
      location: player.location,
      minutes,
    });
    const outcome = {
      ok: true,
      type: "work_meal",
      summary,
      minutes,
      facilityId: player.facilityId,
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
    const workMeal = requestedWorkMealAction(input);
    if (workMeal) {
      return this.runLocked(id, () => this.resolveWorkMealAction(ownerHash, id, input, workMeal));
    }

    const result = await super.command(ownerHash, id, input);
    if (result?.duplicate || !isLifeAction(input)) return result;

    const record = await this.recordForOwner(ownerHash, id);
    if (!synchronizeLifeActionWeatherRecord(record, this.data)) return result;
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
