import assert from "node:assert/strict";
import test from "node:test";

import { DAY100_POLICY_INTERNALS as policy } from "../lib/day100-player-policy.mjs";

// Day72まで走らせた通し再生で、4200行動のうち1883回が食事処探索移動、
// 食事は11回しか成立していなかった。原因は「ここでは買えなかった」記録が
// 空腹度で無効化され、同じ食事処を往復し続けたこと。

function save({ gold = 0, freeMeals = 0, hunger = 40 } = {}) {
  return { player: { gold, freeMeals, needs: { hunger } } };
}

test("getting hungrier does not make a place affordable again", () => {
  const before = policy.resourceContextSignature(save({ gold: 2, hunger: 40 }));
  for (const hunger of [50, 60, 70, 80, 90, 100]) {
    assert.equal(
      policy.resourceContextSignature(save({ gold: 2, hunger })),
      before,
      `hunger ${hunger} must not reopen a place the player still cannot afford`);
  }
});

test("earning money or a free meal does reopen the search", () => {
  const broke = policy.resourceContextSignature(save({ gold: 2 }));
  assert.notEqual(policy.resourceContextSignature(save({ gold: 9 })), broke);
  assert.notEqual(policy.resourceContextSignature(save({ gold: 2, freeMeals: 1 })), broke);
});

test("a failed eatery stays blocked while the player wanders and starves", () => {
  const state = { failedMealSourceContexts: {} };
  const atArrival = save({ gold: 1, hunger: 45 });
  state.failedMealSourceContexts.LOC_FARM_INN = policy.resourceContextSignature(atArrival);

  for (const hunger of [55, 65, 75, 85, 95]) {
    assert.equal(
      policy.mealSourceBlocked(state, "LOC_FARM_INN", save({ gold: 1, hunger })),
      true,
      `the inn must stay blocked at hunger ${hunger}`);
  }

  assert.equal(
    policy.mealSourceBlocked(state, "LOC_FARM_INN", save({ gold: 12, hunger: 95 })),
    false,
    "coming back with money must reopen it");
});

test("blocking one eatery never blocks another", () => {
  const state = { failedMealSourceContexts: {} };
  const context = save({ gold: 1 });
  state.failedMealSourceContexts.LOC_FARM_INN = policy.resourceContextSignature(context);
  assert.equal(policy.mealSourceBlocked(state, "LOC_FARM_BAKERY", context), false);
});
