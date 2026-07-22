import assert from "node:assert/strict";
import test from "node:test";
import {
  availableGameRuntimeActions,
  createGameRuntime,
  executeGameRuntimeCommand,
  resolveReviewedAuthoredPresentation,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";
import {
  resolveAuthoredScene,
  validateAuthoredScene,
} from "../../../src/server/trpg/content/authored-scene-registry.js";

test("the first farm-to-capital arrival resolves as a presentation-only reviewed scene", () => {
  const scene = resolveAuthoredScene({
    action: { type: "move", movementScope: "regional" },
    outcome: { ok: true },
    journey: { fromHub: "田園の村", toHub: "王都", arrivalVisitCount: 1 },
    location: { facilityId: "LOC_CAP_LOWER_INN" },
  });
  assert.equal(scene?.sceneId, "journey.farm_to_capital.first_arrival");
  const validation = validateAuthoredScene(scene);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(scene.presentationOnly, true);
  assert.deepEqual(scene.choices, []);
});

test("authoritative regional travel to the capital selects the reviewed lower-inn arrival", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, {
    seed: "authored-farm-capital-arrival",
    profileId: "balanced",
    playerName: "旅人",
    tutorial: false,
  });
  runtime.playerState.tuning.disableTravelEncounters = true;
  runtime.playerKnowledge.knownHubIds.add("王都");
  const movement = availableGameRuntimeActions(runtime, game.data).movement
    .find((entry) => entry.destinationHub === "王都");
  assert.ok(movement);
  const result = executeGameRuntimeCommand(runtime, game.data, {
    type: "MOVE",
    payload: { moveId: movement.id },
  });
  assert.equal(result.outcome.ok, true);
  assert.equal(runtime.playerState.player.location, "王都");
  assert.equal(runtime.playerState.player.facilityId, "LOC_CAP_LOWER_INN");
  const presentation = resolveReviewedAuthoredPresentation(runtime, game.data, result, result.outcome);
  assert.equal(presentation?.sceneId, "journey.farm_to_capital.first_arrival");
  assert.match(presentation.narrative, /王都/u);
  assert.match(presentation.narrative, /安宿/u);
});

test("weather-tagged reviewed prose takes precedence over the generic arrival prose", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, {
    seed: "authored-weather-prose",
    profileId: "balanced",
    playerName: "旅人",
    tutorial: false,
  });
  runtime.playerState.player.location = "王都";
  runtime.playerState.player.facilityId = "LOC_CAP_LOWER_INN";
  runtime.playerState.weather = { id: "rain", label: "雨", tags: ["rain", "wet", "outdoor"] };
  runtime.playerState.history.push({ type: "REGIONAL_MOVE_COMPLETED", from: "田園の村", to: "王都", facilityId: "LOC_CAP_LOWER_INN" });
  const presentation = resolveReviewedAuthoredPresentation(runtime, game.data, {
    resolvedAction: { id: "MOVE_REGION:王都", type: "move", movementScope: "regional" },
  }, { ok: true });
  assert.equal(presentation?.sceneId, "journey.farm_to_capital.first_arrival");
  assert.match(presentation.narrative, /雨|濡/u);
});
