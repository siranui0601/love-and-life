import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPITAL_PUBLIC_ROUTE_DESTINATIONS,
  CAPITAL_WEAPON_SHOP_ID,
  capitalWeaponShopFirstChoices,
  capitalWeaponShopFirstInteractionActive,
  capitalWeaponShopGuidanceActive,
  completeCapitalWeaponShopFirstInteraction,
  discoverCapitalPublicRoutes,
  ensureCapitalWeaponShopChoice,
  prioritizeCapitalWeaponShopMovement,
  recordCapitalArrivalGuidance,
} from "../../../src/server/trpg/resolvers/capital-arrival-guidance.js";

function runtimeAt(facilityId, minute = 1000) {
  return {
    playerState: {
      absoluteMinute: minute,
      player: { location: "王都", facilityId },
    },
  };
}

test("first lower-inn arrival activates a temporary weapon-shop guide", () => {
  const runtime = runtimeAt("LOC_CAP_LOWER_INN");
  recordCapitalArrivalGuidance(runtime);
  assert.equal(capitalWeaponShopGuidanceActive(runtime), true);
  runtime.playerState.absoluteMinute += 721;
  assert.equal(capitalWeaponShopGuidanceActive(runtime), false);
});

test("weapon-shop movement is prioritized and guaranteed inside the visible three choices", () => {
  const runtime = runtimeAt("LOC_CAP_LOWER_INN");
  recordCapitalArrivalGuidance(runtime);
  const actions = [
    { id: "MOVE:A", type: "move", destinationFacilityId: "LOC_CAP_MARKET", label: "市場へ行く" },
    { id: "MOVE:B", type: "move", destinationFacilityId: CAPITAL_WEAPON_SHOP_ID, label: "武器屋へ行く" },
    { id: "OBSERVE", type: "observe", label: "周囲を見る" },
    { id: "WAIT", type: "wait", label: "待つ" },
  ];
  const prioritized = prioritizeCapitalWeaponShopMovement(actions, runtime);
  assert.equal(prioritized[0].destinationFacilityId, CAPITAL_WEAPON_SHOP_ID);
  assert.equal(prioritized[0].capitalArrivalGuidance, true);
  const selected = ensureCapitalWeaponShopChoice(actions.slice(2, 4), prioritized, runtime);
  assert.equal(selected.some((action) => action.destinationFacilityId === CAPITAL_WEAPON_SHOP_ID), true);
});

test("visiting the weapon shop permanently completes the first-arrival guide", () => {
  const runtime = runtimeAt("LOC_CAP_LOWER_INN");
  recordCapitalArrivalGuidance(runtime);
  runtime.playerState.player.facilityId = CAPITAL_WEAPON_SHOP_ID;
  runtime.playerState.absoluteMinute += 20;
  recordCapitalArrivalGuidance(runtime);
  assert.equal(capitalWeaponShopGuidanceActive(runtime), false);
  runtime.playerState.player.facilityId = "LOC_CAP_LOWER_INN";
  runtime.playerState.absoluteMinute += 20;
  recordCapitalArrivalGuidance(runtime);
  assert.equal(capitalWeaponShopGuidanceActive(runtime), false);
});


test("the first weapon-shop visit offers one reviewed first-interaction set", () => {
  const runtime = runtimeAt("LOC_CAP_LOWER_INN");
  recordCapitalArrivalGuidance(runtime);
  runtime.playerState.player.facilityId = CAPITAL_WEAPON_SHOP_ID;
  runtime.playerState.absoluteMinute += 20;
  recordCapitalArrivalGuidance(runtime);

  assert.equal(capitalWeaponShopFirstInteractionActive(runtime), true);
  const choices = capitalWeaponShopFirstChoices(runtime, {
    shopkeeper: { id: "NPC065", name: "武器屋の店主" },
  });
  assert.deepEqual(choices.map((choice) => choice.id), [
    "CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE",
    "CAPITAL_WEAPON_SHOP:FIRST:COMPARE_HANDLING",
    "CAPITAL_WEAPON_SHOP:FIRST:SET_BUDGET",
  ]);
  assert.deepEqual(choices.map((choice) => choice.family), ["talk", "investigate", "prepare"]);

  completeCapitalWeaponShopFirstInteraction(runtime, { choiceId: choices[1].id });
  assert.equal(capitalWeaponShopFirstInteractionActive(runtime), false);
  assert.equal(capitalWeaponShopFirstChoices(runtime, { shopkeeper: { id: "NPC065" } }), null);
  assert.equal(runtime.capitalArrivalGuidance.firstInteractionChoiceId, choices[1].id);
});


test("capital route board reveals public reachable towns but keeps restricted lands hidden", () => {
  const runtime = runtimeAt("LOC_CAP_LOWER_INN");
  runtime.playerKnowledge = { knownHubIds: new Set(["王都"]) };
  runtime.playerState.history = [];
  const reachable = new Set([
    ...CAPITAL_PUBLIC_ROUTE_DESTINATIONS,
    "エルフの隠れ里",
    "黒嶺連合領",
  ]);
  const discovered = discoverCapitalPublicRoutes(runtime, { reachableHubIds: reachable });
  assert.deepEqual(discovered, CAPITAL_PUBLIC_ROUTE_DESTINATIONS);
  for (const hubId of CAPITAL_PUBLIC_ROUTE_DESTINATIONS) assert.equal(runtime.playerKnowledge.knownHubIds.has(hubId), true, hubId);
  assert.equal(runtime.playerKnowledge.knownHubIds.has("エルフの隠れ里"), false);
  assert.equal(runtime.playerKnowledge.knownHubIds.has("黒嶺連合領"), false);
  assert.equal(runtime.playerState.history.filter((entry) => entry.type === "CAPITAL_ROUTE_BOARD_DISCOVERED").length, 1);
  discoverCapitalPublicRoutes(runtime, { reachableHubIds: reachable });
  assert.equal(runtime.playerState.history.filter((entry) => entry.type === "CAPITAL_ROUTE_BOARD_DISCOVERED").length, 1);
});
