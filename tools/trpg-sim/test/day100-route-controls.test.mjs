import test from "node:test";
import assert from "node:assert/strict";
import { DAY100_ROUTE_STRATEGY_INTERNALS } from "../lib/day100-route-strategy.mjs";

const { authoredFlowChoice } = DAY100_ROUTE_STRATEGY_INTERNALS;

test("route controls are not treated as forward authored choices", () => {
  assert.equal(authoredFlowChoice({ actionId: "MISSION_FLOW:t13:LEAD_HUB:spirit_pool" }), true);
  assert.equal(authoredFlowChoice({ actionId: "MISSION_FLOW:t13:NAVIGATOR_ROUTE:spirit_pool" }), true);
  assert.equal(authoredFlowChoice({ actionId: "MISSION_FLOW:t13:RECONSIDER:spirit_pool" }), false);
  assert.equal(authoredFlowChoice({ actionId: "MISSION_FLOW:t13:DEFER:defer" }), false);
  assert.equal(authoredFlowChoice({ actionId: "MISSION_FLOW:t13:NAVIGATOR_BACK:origin" }), false);
});
