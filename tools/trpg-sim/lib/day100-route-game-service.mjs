import {
  WorldTimeAwareTrpgGameService,
} from "../../../src/server/trpg/game/world-time-aware-service.js";

export const DAY100_ROUTE_GAME_SERVICE_VERSION = "day100-route-game-service-v1";

export function createDay100RouteGameService(options = {}) {
  return new WorldTimeAwareTrpgGameService(options);
}
