import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGameView,
  createGameRuntime,
  gameStateHash,
} from "../../../src/server/trpg/game/service.js";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import { resolveCanonicalWeather } from "../../../src/server/trpg/resolvers/weather-resolver.js";

function viewFor(seed) {
  const data = loadTrpgGameData();
  const runtime = createGameRuntime(data, {
    seed,
    profileId: "balanced",
    playerName: `旅人-${seed}`,
    tutorial: false,
  });
  const record = {
    id: `weather-${seed}`,
    schemaVersion: "test",
    contentRevision: data.contentRevision,
    revision: 0,
    stateHash: gameStateHash(runtime, data),
    playerName: runtime.playerState.player.displayName,
    presentation: null,
    lastOutcome: null,
  };
  return { runtime, view: buildGameView(record, runtime, data) };
}

test("game views expose the same canonical weather across different save seeds", () => {
  const left = viewFor("world-a");
  const right = viewFor("world-b");
  assert.notEqual(left.runtime.playerState.seed, right.runtime.playerState.seed);
  assert.deepEqual(left.view.weather, right.view.weather);
  assert.equal(left.view.clock.weatherId, left.view.weather.id);
  assert.equal(left.view.clock.weatherLabel, left.view.weather.label);
  assert.deepEqual(left.view.weather, resolveCanonicalWeather({
    day: left.view.clock.day,
    regionId: left.view.scene.location,
    daypart: left.view.clock.daypart,
  }));
  assert.equal(left.view.world.weatherRulesetVersion, left.view.weather.rulesetVersion);
});
