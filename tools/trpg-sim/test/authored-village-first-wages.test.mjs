import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_VILLAGE_FIRST_WAGES_INTERNALS as wages,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const DAY2_MORNING = 1 * 1440 + 8 * 60;

function runtime({ gold = 0, hunger = 62, facilityId = "LOC_FARM_FIELD", minute = DAY2_MORNING } = {}) {
  return {
    playerState: {
      absoluteMinute: minute,
      player: { location: "田園の村", facilityId, gold, freeMeals: 0, hunger, fatigue: 30 },
      hunger,
      fatigue: 30,
      missions: [],
      troubles: {},
      worldFlags: {},
      history: [],
      evidence: {},
    },
  };
}

function choose(state, actionId) {
  const action = authoredMissionFlowExclusiveActions(state)
    .find((entry) => entry.id === actionId);
  assert.ok(action, `action not offered: ${actionId}`);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

test("a penniless, hungry player is offered three day jobs", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.deepEqual(actions.map((action) => action.label), [
    "麦束を運ぶ",
    "麦穂亭の皿を洗う",
    "パン屋の窯に薪をくべる",
  ]);
  assert.equal(authoredMissionFlowGuidance(state).title, "一枚も持たずに腹が減った");
  for (const action of actions) {
    assert.equal(action.actionId, action.id);
    assert.ok(action.authoredFirstWagesGold >= 1, "every job must actually pay");
  }
});

test("the three jobs pay differently and leave different things behind", () => {
  const field = runtime();
  choose(field, wages.actionIdFor(wages.WAGE_CHOICES[0]));
  assert.equal(field.playerState.player.gold, 5);
  assert.equal(field.playerState.player.freeMeals, 0);
  assert.equal(field.playerState.player.hunger, 76, "hauling sheaves makes you hungrier");

  const dishes = runtime();
  choose(dishes, wages.actionIdFor(wages.WAGE_CHOICES[1]));
  assert.equal(dishes.playerState.player.gold, 2);
  assert.equal(dishes.playerState.player.freeMeals, 1, "the standing meal is the real wage");
  assert.equal(dishes.playerState.player.hunger, 32);
  assert.equal(dishes.playerState.worldFlags.villageInnMealArrangement, true);
});

test("the bakery pays least in coin but feeds you on the spot", () => {
  const oven = runtime();
  choose(oven, wages.actionIdFor(wages.WAGE_CHOICES[2]));
  assert.equal(oven.playerState.player.gold, 1);
  assert.equal(oven.playerState.player.hunger, 44);
  assert.equal(oven.playerState.worldFlags.villageBakeryMorningWork, true);
});

test("one coin from any job puts the cheapest meal in reach", () => {
  for (const choice of wages.WAGE_CHOICES) {
    const state = runtime();
    choose(state, wages.actionIdFor(choice));
    assert.ok(state.playerState.player.gold >= 1,
      "the village porridge costs one coin, so every job must clear it");
  }
});

test("the scene never repeats, and the two jobs not taken are closed", () => {
  const state = runtime();
  const chosen = wages.actionIdFor(wages.WAGE_CHOICES[0]);
  choose(state, chosen);

  assert.equal(wages.ownEligible(state), false, "a day job does not come round again");
  const saved = state.playerState.villageFirstWages;
  assert.deepEqual(saved.closedActionIds, [
    wages.actionIdFor(wages.WAGE_CHOICES[1]),
    wages.actionIdFor(wages.WAGE_CHOICES[2]),
  ]);
});

test("the scene stays away from anyone who is not actually broke and hungry", () => {
  assert.equal(wages.ownEligible(runtime({ gold: 12 })), false, "with coins there is no need");
  assert.equal(wages.ownEligible(runtime({ hunger: 40 })), false, "peckish is not desperate");
  assert.equal(wages.ownEligible(runtime({ gold: 0, hunger: 62 })), true);
});

test("nobody hires at midnight, or outside the village", () => {
  assert.equal(wages.ownEligible(runtime({ minute: 1 * 1440 + 3 * 60 })), false);
  assert.equal(wages.ownEligible(runtime({ minute: 1 * 1440 + 22 * 60 })), false);

  const away = runtime();
  away.playerState.player.location = "王都";
  assert.equal(wages.ownEligible(away), false);
});

test("saved progress survives a restore without reopening the jobs", () => {
  const state = runtime();
  choose(state, wages.actionIdFor(wages.WAGE_CHOICES[1]));

  const restored = runtime();
  restored.playerState.villageFirstWages =
    JSON.parse(JSON.stringify(state.playerState.villageFirstWages));
  assert.equal(wages.ownEligible(restored), false);
});
