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
import { CollapseAwareTrpgGameService } from "./collapse-aware-service.js";

export const SURVIVAL_AWARE_SERVICE_VERSION = "survival-aware-service-v3";

const MEAL_FACILITY_PATTERN = /(?:INN|BAKERY|MARKET|TAVERN|食堂|宿|パン|市場|酒場)/iu;
const LODGING_FACILITY_PATTERN = /(?:INN|LODGE|宿|旅籠)/iu;
const LIFE_ACTION_PATTERN = /^(?:EAT|LODGE|REST_OUTDOOR):([^:]+)(?::(\d+))?$/u;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function authoredMissionScene(view) {
  return (view?.choices ?? []).some((choice) =>
    String(choice?.actionId ?? "").startsWith("MISSION_FLOW:"));
}

function urgentLifeState(view) {
  const hunger = number(view?.player?.needs?.hunger);
  const fatigue = number(view?.player?.needs?.fatigue);
  const hour = number(
    view?.clock?.hour,
    Number(String(view?.clock?.time ?? "0").split(":")[0]),
  );
  return hunger >= 72 || fatigue >= 72 || hour >= 21;
}

function choiceExists(view, actionId) {
  return (view?.choices ?? []).some((choice) => choice.actionId === actionId);
}

function requestedLifeAction(input) {
  if (String(input?.type ?? "").trim().toUpperCase() !== "CHOOSE") return null;
  const actionId = String(input?.payload?.actionId ?? input?.payload?.choiceId ?? "").trim();
  const match = LIFE_ACTION_PATTERN.exec(actionId);
  if (!match) return null;
  return {
    actionId,
    kind: actionId.startsWith("EAT:")
      ? "eat"
      : actionId.startsWith("LODGE:")
        ? "lodge"
        : "rest",
    facilityId: match[1],
    price: number(match[2]),
  };
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

function commandPayload(input) {
  return {
    choiceId: String(input?.payload?.choiceId ?? "").trim(),
    actionId: String(input?.payload?.actionId ?? "").trim(),
  };
}

export function urgentLifeChoices(view, data) {
  if (!authoredMissionScene(view) || !urgentLifeState(view)) return [];
  const facilityId = String(view?.scene?.facilityId ?? "").trim();
  if (!facilityId) return [];
  const facility = data?.model?.facilityById?.[facilityId] ?? null;
  const facilityText = `${facilityId} ${facility?.name ?? ""}`;
  const choices = [];

  if (number(view?.player?.freeMeals) > 0 && MEAL_FACILITY_PATTERN.test(facilityText)) {
    const actionId = `EAT:${facilityId}:0`;
    if (!choiceExists(view, actionId)) {
      choices.push({
        choiceId: actionId,
        id: actionId,
        actionId,
        label: `${facility?.name ?? "この場所"}で用意された食事を取る`,
        type: "eat",
        intentType: "life",
        minutes: 30,
        price: 0,
        nutrition: 58,
        danger: false,
      });
    }
  }

  if (number(view?.player?.freeLodging) > 0 && LODGING_FACILITY_PATTERN.test(facilityText)) {
    const actionId = `LODGE:${facilityId}:0`;
    if (!choiceExists(view, actionId)) {
      choices.push({
        choiceId: actionId,
        id: actionId,
        actionId,
        label: `${facility?.name ?? "宿"}で今夜は休む`,
        type: "rest",
        intentType: "life",
        minutes: 480,
        price: 0,
        lodging: true,
        danger: false,
      });
    }
  }

  const restActionId = `REST_OUTDOOR:${facilityId}`;
  if (!choiceExists(view, restActionId) && !choices.some((choice) => choice.type === "rest")) {
    choices.push({
      choiceId: restActionId,
      id: restActionId,
      actionId: restActionId,
      label: "現在地で安全を確かめ、短く休息する",
      type: "rest",
      intentType: "life",
      minutes: 120,
      price: 0,
      lodging: false,
      danger: false,
    });
  }
  return choices;
}

export function applyUrgentLifeChoices(view, data) {
  const lifeChoices = urgentLifeChoices(view, data);
  if (!lifeChoices.length) return view;
  return {
    ...view,
    choices: [...lifeChoices, ...(view.choices ?? [])],
  };
}

function decorateCommandResult(result, data) {
  if (!result?.save) return result;
  return {
    ...result,
    save: applyUrgentLifeChoices(result.save, data),
  };
}

export class SurvivalAwareTrpgGameService extends CollapseAwareTrpgGameService {
  gameViewForRecord(record) {
    return applyUrgentLifeChoices(super.gameViewForRecord(record), this.data);
  }

  async create(...args) {
    return applyUrgentLifeChoices(await super.create(...args), this.data);
  }

  async get(...args) {
    return applyUrgentLifeChoices(await super.get(...args), this.data);
  }

  async resolveUrgentLifeAction(ownerHash, id, input, request) {
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
    ensurePlayerNeeds(runtime.playerState.player);
    const beforeHash = gameStateHash(runtime, this.data);
    if (beforeHash !== record.stateHash) throw new TrpgGameError(409, "save_state_hash_mismatch");
    const visible = urgentLifeChoices(super.gameViewForRecord(record), this.data)
      .find((choice) => choice.actionId === request.actionId);
    if (!visible || request.facilityId !== runtime.playerState.player.facilityId) {
      throw new TrpgGameError(409, "choice_not_available");
    }

    const player = runtime.playerState.player;
    const minuteBefore = runtime.playerState.absoluteMinute;
    let minutes;
    let summary;
    if (request.kind === "eat") {
      if (player.freeMeals <= 0) throw new TrpgGameError(409, "choice_not_available");
      player.freeMeals -= 1;
      minutes = 30;
      advancePlayerNeeds(player, {
        minutes,
        reason: "meal",
        daypart: runtime.playerState.daypart,
        weatherTags: runtime.playerState.weather?.tags ?? [],
        outdoors: false,
      });
      player.needs.hunger = Math.max(0, number(player.needs.hunger) - 58);
      summary = `${visible.label}。空腹が和らいだ。`;
    } else {
      const lodging = request.kind === "lodge";
      if (lodging) {
        if (player.freeLodging <= 0) throw new TrpgGameError(409, "choice_not_available");
        player.freeLodging -= 1;
      }
      minutes = lodging ? 480 : 120;
      advancePlayerNeeds(player, {
        minutes,
        reason: lodging ? "lodging" : "rest",
        daypart: runtime.playerState.daypart,
        weatherTags: runtime.playerState.weather?.tags ?? [],
        outdoors: !lodging,
      });
      player.needs.fatigue = Math.max(0, number(player.needs.fatigue) - (lodging ? 85 : 35));
      summary = lodging
        ? `${visible.label}。十分な睡眠を取った。`
        : `${visible.label}。疲労が少し和らいだ。`;
    }
    updateClock(runtime.playerState, minuteBefore + minutes);
    runtime.playerState.history.push({
      type: "PLAYER_ACTION_RESOLVED",
      minute: runtime.playerState.absoluteMinute,
      actionId: request.actionId,
      actionType: request.kind === "eat" ? "eat" : "rest",
      facilityId: player.facilityId,
      location: player.location,
      minutes,
    });

    const outcome = {
      ok: true,
      type: request.kind === "eat" ? "eat" : "rest",
      summary,
      minutes,
      facilityId: player.facilityId,
    };
    const revisionBefore = record.revision;
    record.revision += 1;
    record.updatedAt = new Date().toISOString();
    record.lastOutcome = outcome;
    record.presentation = {
      revision: record.revision,
      source: "deterministic_urgent_life_action",
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
    const life = requestedLifeAction(input);
    if (life) {
      return this.runLocked(id, () => this.resolveUrgentLifeAction(ownerHash, id, input, life));
    }
    return decorateCommandResult(await super.command(ownerHash, id, input), this.data);
  }

  health() {
    return {
      ...super.health(),
      survivalAwareServiceVersion: SURVIVAL_AWARE_SERVICE_VERSION,
    };
  }
}

export function createSurvivalAwareTrpgGameService(options = {}) {
  return new SurvivalAwareTrpgGameService(options);
}
