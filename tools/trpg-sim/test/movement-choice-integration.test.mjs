import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  availableGameRuntimeActions,
  availableGameRuntimeChoiceCandidates,
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

function selectMovement(runtime, data) {
  const candidates = availableGameRuntimeChoiceCandidates(runtime, data, { limit: 9 });
  const movement = candidates.find((action) => action.type === "move" && action.movementScope === "local")
    ?? candidates.find((action) => action.type === "move");
  assert.ok(movement, `movement candidate missing: ${candidates.map((action) => `${action.type}:${action.label}`).join(" / ")}`);
  const actionIds = [movement.id, ...candidates.filter((action) => action.id !== movement.id).map((action) => action.id)].slice(0, 3);
  const poolKey = crypto.createHash("sha256").update(JSON.stringify({
    minute: runtime.playerState.absoluteMinute,
    location: runtime.playerState.player.location,
    facilityId: runtime.playerState.player.facilityId,
    tutorialStage: runtime.tutorial?.stage ?? null,
    pendingWorkOffer: runtime.pendingWorkOffer?.openedAtMinute ?? null,
    actionIds: candidates.map((action) => action.id),
  })).digest("hex").slice(0, 24);
  runtime.narrativeChoiceSelection = { poolKey, actionIds, detailsById: {} };
  return { candidates, movement };
}

test("the Gemini candidate pool reserves an executable movement route without changing legacy fallback order", () => {
  const { data, runtime } = setup();
  const legacy = availableGameRuntimeActions(runtime, data).choices.map((action) => action.id);
  const { candidates } = selectMovement(runtime, data);
  assert.ok(candidates.some((action) => action.type === "move"));
  runtime.narrativeChoiceSelection = null;
  assert.deepEqual(availableGameRuntimeActions(runtime, data).choices.map((action) => action.id), legacy);
});

test("a movement option selected for the three choices uses the authoritative movement resolver", () => {
  const { data, runtime } = setup();
  selectMovement(runtime, data);
  const choices = availableGameRuntimeActions(runtime, data).choices;
  const movement = choices.find((action) => action.type === "move");
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

test("a Gemini-selected set is repaired to distinct semantic decisions", () => {
  const { data, runtime } = setup();
  selectMovement(runtime, data);
  const actions = availableGameRuntimeActions(runtime, data).choices;
  const fingerprints = actions.map(choiceSemanticFingerprint);
  assert.equal(new Set(fingerprints).size, actions.length, fingerprints.join("\n"));
  assert.ok(new Set(actions.map((action) => action.type)).size >= 2);
});
