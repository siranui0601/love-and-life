import assert from "node:assert/strict";
import test from "node:test";

import {
  availableGameRuntimeActions,
  createGameRuntime,
  executeGameRuntimeCommand,
} from "../../../src/server/trpg/game/service.js";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import { clockFromMinute } from "../lib/player-journey.mjs";

const DAY5_START = 4 * 1440;
const DAY5_NIGHT = DAY5_START + 22 * 60;

function daypartAtHour(hour) {
  if (hour < 6 || hour >= 22) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function setClock(runtime, absoluteMinute) {
  const clock = clockFromMinute(absoluteMinute);
  runtime.playerState.absoluteMinute = absoluteMinute;
  runtime.playerState.day = clock.day;
  runtime.playerState.hour = clock.hour;
  runtime.playerState.minute = clock.minute;
  runtime.playerState.minuteOfDay = clock.minuteOfDay;
  if (clock.phaseIndex != null) runtime.playerState.phaseIndex = clock.phaseIndex;
  runtime.playerState.daypart = clock.daypart ?? daypartAtHour(clock.hour);
}

test("live canonical T02 starts on Day5 night, not during Day5 daytime", () => {
  const data = loadTrpgGameData();
  const trouble = data.model.troubleById.T02;
  assert.ok(trouble);
  assert.equal(trouble.startDay, 5);
  assert.equal(trouble.startPhase, 3, "Day5 夜 maps to the common world's 22:00 phase");
});

test("ordinary production movement crossing Day5 22:00 activates T02 only after the night boundary", () => {
  const data = loadTrpgGameData();
  const runtime = createGameRuntime(data, {
    seed: "canonical-t02-night-boundary",
    profileId: "balanced",
    playerName: "夜境界テスト旅人",
    tutorial: false,
  });

  setClock(runtime, DAY5_NIGHT - 1);
  runtime.playerState.troubles.T02.status = "scheduled";
  runtime.playerState.troubles.T02.activatedAt = null;
  runtime.playerState.missions["MSN-T02"].status = "locked";

  assert.equal(runtime.playerState.troubles.T02.status, "scheduled");
  assert.equal(runtime.playerState.daypart, "evening");
  const movement = availableGameRuntimeActions(runtime, data).movement
    .find((entry) => Number(entry.minutes ?? 0) > 0);
  assert.ok(movement, "a normal production movement must be available at the Day5 night boundary");

  const result = executeGameRuntimeCommand(runtime, data, {
    type: "MOVE",
    payload: { moveId: movement.id },
  });
  assert.equal(result.outcome?.ok, true);
  assert.ok(runtime.playerState.absoluteMinute >= DAY5_NIGHT);
  assert.equal(runtime.playerState.troubles.T02.status, "active");
  assert.equal(runtime.playerState.troubles.T02.activatedAt, DAY5_NIGHT);
});
