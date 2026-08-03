import { deserializeRuntime, serializeRuntime } from "./serializer.js";
import { gameStateHash } from "./service.js";
import {
  SurvivalAwareTrpgGameService,
} from "./survival-aware-service.js";
import { resolveCanonicalWeather } from "../resolvers/weather-resolver.js";

export const WORLD_TIME_AWARE_SERVICE_VERSION = "world-time-aware-service-v1";

const LIFE_ACTION_PATTERN = /^(?:EAT|LODGE|REST_OUTDOOR):/u;

function requestedChoiceActionId(input) {
  if (String(input?.type ?? "").trim().toUpperCase() !== "CHOOSE") return "";
  return String(input?.payload?.actionId ?? input?.payload?.choiceId ?? "").trim();
}

function isLifeAction(input) {
  return LIFE_ACTION_PATTERN.test(requestedChoiceActionId(input));
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
  async command(ownerHash, id, input = {}) {
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
