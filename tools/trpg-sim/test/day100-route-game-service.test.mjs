import test from "node:test";
import assert from "node:assert/strict";
import {
  DAY100_ROUTE_GAME_SERVICE_VERSION,
  createDay100RouteGameService,
} from "../lib/day100-route-game-service.mjs";
import {
  WorldTimeAwareTrpgGameService,
  WORLD_TIME_AWARE_SERVICE_VERSION,
} from "../../../src/server/trpg/game/world-time-aware-service.js";

test("Day100 route trial uses the same world-time-aware service as the public game routes", () => {
  const service = createDay100RouteGameService({ allowCustomSeed: true });

  assert.ok(service instanceof WorldTimeAwareTrpgGameService);
  assert.equal(DAY100_ROUTE_GAME_SERVICE_VERSION, "day100-route-game-service-v1");
  assert.equal(
    service.health().worldTimeAwareServiceVersion,
    WORLD_TIME_AWARE_SERVICE_VERSION,
  );
});
