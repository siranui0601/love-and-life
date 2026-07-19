import assert from "node:assert/strict";
import test from "node:test";
import { runPlayableWorldScenario } from "../lib/playable-world-audit.mjs";

test("playable audit crosses guided movement and an interactive battle without weakening free-choice checks", () => {
  const options = {
    policyId: "story",
    seed: "playable-audit:test:tutorial-battle",
    endMinute: 360,
    maxCommands: 300,
  };
  const first = runPlayableWorldScenario(options);
  const replay = runPlayableWorldScenario(options);

  assert.equal(first.rejectedCommands, 0);
  assert.ok(Number(first.commandsByType.MOVE ?? 0) > 0, "the guided tutorial movement must be executed");
  assert.ok(Number(first.commandsByType.BATTLE_ACT ?? 0) > 0, "the interactive battle must be played to completion");
  assert.deepEqual(first.invariantViolations, []);
  assert.equal(first.stateHash, replay.stateHash);
  assert.deepEqual(first.commandsByType, replay.commandsByType);
});
