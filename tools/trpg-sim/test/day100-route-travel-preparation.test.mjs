import test from "node:test";
import assert from "node:assert/strict";
import { DAY100_ROUTE_STRATEGY_INTERNALS } from "../lib/day100-route-strategy.mjs";

const {
  shouldPrepareBeforeRegionalMove,
} = DAY100_ROUTE_STRATEGY_INTERNALS;

function saveWithNeeds({ hunger, fatigue, movementScope = "regional" }) {
  return {
    player: {
      needs: { hunger, fatigue },
    },
    movement: [
      {
        moveId: "MOVE_REGION:森",
        scope: movementScope,
        destination: "森",
      },
    ],
  };
}

const mealDecision = {
  type: "CHOOSE",
  category: "meal_consumed",
  actionId: "EAT:BREAD:8",
  reason: "空腹を満たすため食事をする",
};

const routeMove = {
  type: "MOVE",
  moveId: "MOVE_REGION:森",
};

test("regional travel keeps a public meal action before needs reach collapse range", () => {
  const save = saveWithNeeds({ hunger: 71.1, fatigue: 70.9 });
  assert.equal(shouldPrepareBeforeRegionalMove(save, mealDecision, routeMove), true);
});

test("local movement and sufficiently recovered travel do not force preparation", () => {
  assert.equal(shouldPrepareBeforeRegionalMove(
    saveWithNeeds({ hunger: 71.1, fatigue: 70.9, movementScope: "local" }),
    mealDecision,
    routeMove,
  ), false);
  assert.equal(shouldPrepareBeforeRegionalMove(
    saveWithNeeds({ hunger: 30, fatigue: 40 }),
    mealDecision,
    routeMove,
  ), false);
});
