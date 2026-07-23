import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPITAL_WEAPON_SHOP_ID,
  capitalWeaponShopGuidanceActive,
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
