import assert from "node:assert/strict";
import test from "node:test";
import { resolveCanonicalWeather } from "../../../src/server/trpg/resolvers/weather-resolver.js";
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
  assert.match(presentation.narrative, /王都武器屋/u);
  assert.match(presentation.narrative, /剣.*槍.*弓.*杖/u);
  assert.match(presentation.narrative, /路線図/u);
  const capitalActions = availableGameRuntimeActions(runtime, game.data);
  const publicRegionalDestinations = new Set(capitalActions.movement
    .filter((entry) => entry.movementScope === "regional")
    .map((entry) => entry.destinationHub));
  assert.equal(publicRegionalDestinations.has("交易都市"), true);
  assert.equal(publicRegionalDestinations.has("北陵要塞"), true);
  assert.equal(publicRegionalDestinations.has("エルフの隠れ里"), false);
  assert.equal(publicRegionalDestinations.has("黒嶺連合領"), false);
  assert.ok(capitalActions.choices.some((entry) => entry.movementScope === "regional"),
    "first capital arrival must keep a visible choice to leave for another town");
  const weaponShopChoice = capitalActions.choices.find((entry) => entry.destinationFacilityId === "LOC_CAP_WEAPON_SHOP");
  assert.ok(weaponShopChoice, "first capital arrival must expose the weapon shop in the visible choices");
  assert.equal(weaponShopChoice.capitalArrivalGuidance, true);
  const weaponShopMove = capitalActions.movement.find((entry) => entry.destinationFacilityId === "LOC_CAP_WEAPON_SHOP");
  assert.ok(weaponShopMove, "weapon shop must remain an authoritative MOVE action");
  executeGameRuntimeCommand(runtime, game.data, {
    type: "MOVE",
    payload: { moveId: weaponShopMove.id },
  });
  assert.equal(runtime.playerState.player.facilityId, "LOC_CAP_WEAPON_SHOP");
  assert.equal(availableGameRuntimeActions(runtime, game.data).choices.some((entry) => entry.capitalArrivalGuidance === true), false);
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
  // The prose picker reads the canonical almanac, not playerState.weather, so the
  // scene has to be placed on a day the almanac actually writes rain into.
  // 王都 Day26 is rain from morning through night.
  runtime.playerState.day = 26;
  runtime.playerState.daypart = "afternoon";
  assert.ok(
    resolveCanonicalWeather({ day: 26, regionId: "王都", daypart: "afternoon" }).tags.includes("rain"),
    "王都 Day26 afternoon must be rain in the almanac for this test to mean anything",
  );
  runtime.playerState.history.push({ type: "REGIONAL_MOVE_COMPLETED", from: "田園の村", to: "王都", facilityId: "LOC_CAP_LOWER_INN" });
  const presentation = resolveReviewedAuthoredPresentation(runtime, game.data, {
    resolvedAction: { id: "MOVE_REGION:王都", type: "move", movementScope: "regional" },
  }, { ok: true });
  assert.equal(presentation?.sceneId, "journey.farm_to_capital.first_arrival");
  assert.match(presentation.narrative, /雨|濡/u);
});


test("the first guided weapon-shop visit uses reviewed prose and a one-use choice set", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, {
    seed: "authored-capital-weapon-shop-first-visit",
    profileId: "balanced",
    playerName: "旅人",
    tutorial: false,
  });
  runtime.playerState.tuning.disableTravelEncounters = true;
  runtime.playerKnowledge.knownHubIds.add("王都");

  const capitalMove = availableGameRuntimeActions(runtime, game.data).movement
    .find((entry) => entry.destinationHub === "王都");
  assert.ok(capitalMove);
  executeGameRuntimeCommand(runtime, game.data, {
    type: "MOVE",
    payload: { moveId: capitalMove.id },
  });

  const weaponShopMove = availableGameRuntimeActions(runtime, game.data).movement
    .find((entry) => entry.destinationFacilityId === "LOC_CAP_WEAPON_SHOP");
  assert.ok(weaponShopMove);
  const arrivalResult = executeGameRuntimeCommand(runtime, game.data, {
    type: "MOVE",
    payload: { moveId: weaponShopMove.id },
  });
  const shopkeeperState = runtime.livingWorld.npcStates.NPC065;
  assert.ok(shopkeeperState);
  shopkeeperState.presence = "present";
  shopkeeperState.lifeStatus = "alive";
  shopkeeperState.location = "王都";
  shopkeeperState.position = { hubId: "王都", facilityId: "LOC_CAP_WEAPON_SHOP" };
  shopkeeperState.travel = null;
  shopkeeperState.localTravel = null;
  runtime.playerState.authoritativePresentNpcIds.add("NPC065");

  const arrival = resolveReviewedAuthoredPresentation(runtime, game.data, arrivalResult, arrivalResult.outcome);
  assert.equal(arrival?.sceneId, "journey.capital_weapon_shop.first_guided_arrival");
  assert.match(arrival.narrative, /剣.*槍.*弓.*杖/u);
  assert.equal(arrival.speeches.some((speech) => speech.actorId === "NPC065"), true);

  const firstChoices = availableGameRuntimeActions(runtime, game.data).choices;
  assert.deepEqual(firstChoices.map((choice) => choice.id), [
    "CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE",
    "CAPITAL_WEAPON_SHOP:FIRST:COMPARE_HANDLING",
    "CAPITAL_WEAPON_SHOP:FIRST:SET_BUDGET",
  ]);
  assert.equal(new Set(firstChoices.map((choice) => choice.label)).size, 3);

  const selected = firstChoices.find((choice) => choice.id === "CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE");
  const consultationResult = executeGameRuntimeCommand(runtime, game.data, {
    type: "CHOOSE",
    payload: { choiceId: selected.choiceId, actionId: selected.id },
  });
  const consultation = resolveReviewedAuthoredPresentation(runtime, game.data, consultationResult, consultationResult.outcome);
  assert.equal(consultation?.sceneId, "journey.capital_weapon_shop.first.ask_style");
  assert.match(consultation.speeches[0]?.text ?? "", /剣か槍.*弓.*杖/u);

  const laterActions = availableGameRuntimeActions(runtime, game.data);
  const laterChoiceIds = laterActions.choices.map((choice) => choice.id);
  assert.equal(laterChoiceIds.some((id) => id.startsWith("CAPITAL_WEAPON_SHOP:FIRST:")), false);
  assert.ok(laterActions.movement.some((action) => action.movementScope === "regional"),
    "regional travel remains available after the first weapon-shop exchange");
  assert.equal(runtime.dialogueSession, null, "the authored consultation is one complete exchange, not a generic dialogue loop");
});

test("each first weapon-shop decision has a reviewed consequence scene", () => {
  const cases = [
    ["CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE", "journey.capital_weapon_shop.first.ask_style"],
    ["CAPITAL_WEAPON_SHOP:FIRST:COMPARE_HANDLING", "journey.capital_weapon_shop.first.compare_handling"],
    ["CAPITAL_WEAPON_SHOP:FIRST:SET_BUDGET", "journey.capital_weapon_shop.first.set_budget"],
  ];
  for (const [actionId, sceneId] of cases) {
    const scene = resolveAuthoredScene({
      action: { id: actionId },
      outcome: { ok: true },
      location: { facilityId: "LOC_CAP_WEAPON_SHOP" },
    });
    assert.equal(scene?.sceneId, sceneId);
    assert.equal(validateAuthoredScene(scene).valid, true);
  }
});


test("an unattended guided arrival never invents shopkeeper speech", () => {
  const scene = resolveAuthoredScene({
    action: { type: "move", destinationFacilityId: "LOC_CAP_WEAPON_SHOP" },
    outcome: { ok: true },
    location: { facilityId: "LOC_CAP_WEAPON_SHOP" },
    story: {
      capitalWeaponShopFirstVisitNow: true,
      capitalWeaponShopkeeperPresent: false,
    },
  });
  assert.equal(scene?.sceneId, "journey.capital_weapon_shop.first_guided_arrival_unattended");
  assert.equal(scene.beats.length, 0);
  assert.match(scene.narrative, /人の気配はない/u);
});
