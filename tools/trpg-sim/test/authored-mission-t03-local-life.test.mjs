import test from "node:test";
import assert from "node:assert/strict";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import { createGameRuntime } from "../../../src/server/trpg/game/service.js";
import { AUTHORED_MISSION_T03_LOCAL_LIFE_INTERNALS } from "../../../src/server/trpg/content/authored-mission-t03-local-life.js";

const data = loadTrpgGameData();
const { localCanonicalProductsBesideT03 } = AUTHORED_MISSION_T03_LOCAL_LIFE_INTERNALS;

function runtimeAt(facilityId) {
  const runtime = createGameRuntime(data, {
    seed: `test:t03-local-life:${facilityId}`,
    profileId: "balanced",
    playerName: "試験旅人",
    tutorial: false,
  });
  runtime.playerState.absoluteMinute = 7 * 1440 + 19 * 60 + 7 * 60 + 7;
  runtime.playerState.player.location = "田園の村";
  runtime.playerState.player.facilityId = facilityId;
  runtime.playerState.player.gold = 32;
  runtime.playerState.troubles.T03.status = "active";
  runtime.playerState.missions["MSN-T03"].status = "active";
  return runtime;
}

const t03Panel = [
  {
    id: "MISSION_FLOW:red-fang-migration:LEAD:wound_pattern@LOC_FARM_STABLE",
    actionId: "MISSION_FLOW:red-fang-migration:LEAD:wound_pattern@LOC_FARM_STABLE",
  },
  {
    id: "MISSION_FLOW:red-fang-migration:LEAD:forest_displacement@LOC_FARM_NORTH_FENCE",
    actionId: "MISSION_FLOW:red-fang-migration:LEAD:forest_displacement@LOC_FARM_NORTH_FENCE",
  },
  {
    id: "MISSION_FLOW:red-fang-migration:PREMATURE:act_too_soon",
    actionId: "MISSION_FLOW:red-fang-migration:PREMATURE:act_too_soon",
  },
];

test("active T03 investigation yields to a real bakery provision without mixing panels", () => {
  const runtime = runtimeAt("LOC_FARM_BAKERY");
  const actions = localCanonicalProductsBesideT03(runtime, t03Panel);
  assert.ok(actions.some((action) => action?.id === "LIFE:BUY:ITM008"));
  assert.equal(actions.some((action) => String(action?.id ?? "").startsWith("MISSION_FLOW:red-fang-migration:")), false);
});

test("T03 investigation remains authoritative when the current facility has no canonical product", () => {
  const runtime = runtimeAt("LOC_FARM_CHIEF");
  const actions = localCanonicalProductsBesideT03(runtime, t03Panel);
  assert.deepEqual(actions, t03Panel);
});

test("terminal or inactive T03 never invokes the local-life override", () => {
  const runtime = runtimeAt("LOC_FARM_BAKERY");
  runtime.playerState.missions["MSN-T03"].status = "completed";
  const actions = localCanonicalProductsBesideT03(runtime, t03Panel);
  assert.deepEqual(actions, t03Panel);
});
