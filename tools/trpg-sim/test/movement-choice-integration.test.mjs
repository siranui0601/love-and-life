import assert from "node:assert/strict";
import test from "node:test";
import {
  availableGameRuntimeActions,
  createGameRuntime,
  executeGameRuntimeCommand,
} from "../../../src/server/trpg/game/service.js";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import { choiceSemanticFingerprint } from "../../../src/server/trpg/content/choice-contract.js";

function setup() {
  const data = loadTrpgGameData();
  const runtime = createGameRuntime(data, {
    seed: "movement-choice-test",
    profileId: "balanced",
    playerName: "移動テスト旅人",
    tutorial: false,
  });
  return { data, runtime };
}

test("normal three-choice actions include a directly executable movement route", () => {
  const { data, runtime } = setup();
  const actions = availableGameRuntimeActions(runtime, data).choices;
  assert.equal(actions.length, 3);
  const movement = actions.find((action) => action.type === "move");
  assert.ok(movement, `expected a movement choice, received: ${actions.map((action) => `${action.type}:${action.label}`).join(" / ")}`);
  assert.ok(movement.movementScope);
  assert.ok(movement.destinationFacilityId || movement.destinationHub);
});

test("a movement option selected from the three choices uses the movement resolver", () => {
  const { data, runtime } = setup();
  const movement = availableGameRuntimeActions(runtime, data).choices
    .find((action) => action.type === "move" && action.movementScope === "local")
    ?? availableGameRuntimeActions(runtime, data).choices.find((action) => action.type === "move");
  assert.ok(movement);
  const before = {
    location: runtime.playerState.player.location,
    facilityId: runtime.playerState.player.facilityId,
    minute: runtime.playerState.absoluteMinute,
  };
  const result = executeGameRuntimeCommand(runtime, data, {
    type: "CHOOSE",
    payload: { choiceId: movement.choiceId, actionId: movement.id },
  });
  assert.equal(result.resolvedAction.type, "move");
  assert.equal(result.outcome.ok, true);
  assert.ok(runtime.playerState.absoluteMinute > before.minute);
  assert.ok(runtime.playerState.player.location !== before.location
    || runtime.playerState.player.facilityId !== before.facilityId);
});

test("selected choices have distinct semantic decisions", () => {
  const { data, runtime } = setup();
  const actions = availableGameRuntimeActions(runtime, data).choices;
  const fingerprints = actions.map(choiceSemanticFingerprint);
  assert.equal(new Set(fingerprints).size, actions.length, fingerprints.join("\n"));
  assert.ok(new Set(actions.map((action) => action.type)).size >= 2);
});
