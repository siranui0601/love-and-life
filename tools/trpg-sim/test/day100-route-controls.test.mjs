import test from "node:test";
import assert from "node:assert/strict";
import { DAY100_ROUTE_STRATEGY_INTERNALS } from "../lib/day100-route-strategy.mjs";

const {
  authoredFlowChoice,
  capitalWeaponShopFirstDecision,
  guidanceMissionId,
  missionChoiceAllowed,
} = DAY100_ROUTE_STRATEGY_INTERNALS;

test("legacy route controls are excluded even when they carry the selected mission id", () => {
  assert.equal(missionChoiceAllowed(
    { missionId: "MSN-T13", actionId: "MISSION_FLOW:t13:RECONSIDER:lead" },
    "MSN-T13",
    "MSN-T13",
    true,
  ), false);
  assert.equal(missionChoiceAllowed(
    { missionId: "MSN-T13", actionId: "MISSION_FLOW:t13:DEFER:defer" },
    "MSN-T13",
    "MSN-T13",
    true,
  ), false);
});

test("authored choices follow the mission named by public guidance", () => {
  assert.equal(guidanceMissionId({ guidance: { missionId: "MSN-T13" } }), "MSN-T13");
  assert.equal(missionChoiceAllowed(
    { actionId: "MISSION_FLOW:t13:LEAD_HUB:lead" },
    "MSN-T13",
    "MSN-T13",
    true,
  ), true);
  assert.equal(missionChoiceAllowed(
    { actionId: "MISSION_FLOW:t13:LEAD_HUB:lead" },
    "MSN-T07",
    "MSN-T13",
    true,
  ), false);
  assert.equal(authoredFlowChoice({
    actionId: "MISSION_FLOW:t13:ONE_SHOT:ABANDON_LEAD",
  }), true);
});

test("weapon shop onboarding choice is completed before leaving the shop", () => {
  const decision = capitalWeaponShopFirstDecision({
    choices: [
      {
        choiceId: "SHOP-FIRST-ASK",
        actionId: "CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE",
        label: "店主へ相談する",
      },
      {
        choiceId: "SHOP-FIRST-COMPARE",
        actionId: "CAPITAL_WEAPON_SHOP:FIRST:COMPARE_HANDLING",
        label: "武器の扱いを比べる",
      },
      {
        choiceId: "UNRELATED",
        actionId: "MOVE_LOCAL:LOC_CAP_APOTHECARY",
        label: "薬屋へ移動する",
      },
    ],
  }, { blockedDecisionKeys: {} }, "deadline");
  assert.equal(decision.type, "CHOOSE");
  assert.equal(decision.actionId, "CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE");
  assert.equal(decision.category, "shop_onboarding");
});
