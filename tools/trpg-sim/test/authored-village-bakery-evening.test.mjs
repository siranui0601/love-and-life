import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_VILLAGE_BAKERY_EVENING_INTERNALS as bakery,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const absoluteMinuteFor = (day, wallMinute) => (day - 1) * 1440 + wallMinute - 600;

function runtime({ wallMinute = 15 * 60 + 6, facilityId = "LOC_FARM_BAKERY", hunger = 0, fatigue = 34 } = {}) {
  return {
    playerState: {
      absoluteMinute: absoluteMinuteFor(2, wallMinute),
      day: 2,
      player: {
        location: "田園の村",
        facilityId,
        hunger,
        fatigue,
        gold: 41,
      },
      worldFlags: {},
      history: [],
      evidence: {},
      missions: [],
    },
  };
}

test("Day2 15:06 bakery keeps public products beside all three common-world evening choices through 22:15", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.equal(authoredMissionFlowGuidance(state).title, "パン屋で夕暮れを過ごす");
  assert.deepEqual(actions.map((action) => action.id), [
    "LIFE:BUY:ITM008",
    "LIFE:BUY:ITM010",
    "DAILY_LIFE:DAILY_BAKERY_EVENING:mend_gear_by_oven",
    "DAILY_LIFE:DAILY_BAKERY_EVENING:help_close_the_bakery",
    "DAILY_LIFE:DAILY_BAKERY_EVENING:walk_and_talk_with_coby",
  ]);
  assert.deepEqual(actions.map((action) => action.minutes), [10, 10, 429, 429, 429]);
  const daily = actions.filter((action) => action.authoredVillageBakeryEveningChoice === true);
  assert.equal(daily.length, 3);
  assert.equal(new Set(daily.map((action) => action.family)).size, 3);
  assert.ok(actions.every((action) => action.targetFacilityId === "LOC_FARM_BAKERY"));
  assert.ok(daily.every((action) => action.authoredMissionFlowExclusiveChoice === true));
  assert.ok(actions.filter((action) => action.canonicalWorldLifeChoice === true)
    .every((action) => action.canonicalWorldLifeKind === "buy_provision"));
});

test("gear-maintenance branch records ordinary life only and does not invent money or route state", () => {
  const state = runtime();
  const action = authoredMissionFlowExclusiveActions(state)
    .find((entry) => entry.id === "DAILY_LIFE:DAILY_BAKERY_EVENING:mend_gear_by_oven");
  const goldBefore = state.playerState.player.gold;
  const result = { ok: true };

  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  assert.equal(state.playerState.player.gold, goldBefore);
  assert.equal(state.playerState.worldFlags["day2BakeryEvening:gearMaintained"], true);
  assert.equal(state.playerState.player.facilityId, "LOC_FARM_BAKERY");
  assert.equal(state.playerState.villageBakeryEvening.closedActionIds.length, 2);
  assert.equal(state.playerState.history.at(-1).type, "DAY2_BAKERY_EVENING_GEAR_MAINTAINED");
  assert.equal(state.playerState.history.at(-1).facilityId, "LOC_FARM_BAKERY");
  assert.equal(result.speeches[0].actorId, "NPC059");
  assert.equal(Object.keys(state.playerState.worldFlags).some((key) => /virtue/i.test(key)), false);
});

test("bakery bridge is common-state gated: wrong day, place, late time, or urgent needs do not expose it", () => {
  const day1 = runtime();
  day1.playerState.absoluteMinute = absoluteMinuteFor(1, 16 * 60);
  assert.equal(bakery.ownEligible(day1), false);

  const wrongPlace = runtime({ facilityId: "LOC_FARM_INN" });
  assert.equal(bakery.ownEligible(wrongPlace), false);

  const late = runtime({ wallMinute: 22 * 60 + 15 });
  assert.equal(bakery.ownEligible(late), false);

  const hungry = runtime({ hunger: 75 });
  assert.equal(bakery.ownEligible(hungry), false);

  const tired = runtime({ fatigue: 75 });
  assert.equal(bakery.ownEligible(tired), false);
});

test("Day2 merchant-owned three-choice panel is not polluted by public bakery products", () => {
  const state = runtime({ wallMinute: 7 * 60 + 47, facilityId: "LOC_FARM_BAKERY", hunger: 8, fatigue: 8 });
  state.playerState.history.push({ type: "DAY2_MERCHANT_CASH_WAGE_TAKEN", minute: state.playerState.absoluteMinute - 1 });
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.deepEqual(actions.map((action) => action.id), [
    "MISSION_FLOW:T01:DAY2_MERCHANT_STALL:buy_black_bread",
    "MISSION_FLOW:T01:DAY2_MERCHANT_STALL:copy_prices",
    "MISSION_FLOW:T01:DAY2_MERCHANT_STALL:take_hunter_parcel",
  ]);
  assert.ok(actions.every((action) => action.authoredDay2T01MerchantStallChoice === true));
  assert.ok(actions.every((action) => action.canonicalWorldLifeChoice !== true));
});


test("Day3 16:00 inn keeps the legal Sheet-backed dishwashing shift ahead of public meals", () => {
  const state = runtime({ wallMinute: 16 * 60, facilityId: "LOC_FARM_INN", hunger: 43, fatigue: 32 });
  state.playerState.absoluteMinute = absoluteMinuteFor(3, 16 * 60);
  state.playerState.day = 3;
  const actions = authoredMissionFlowExclusiveActions(state, { movementActions: [], presentNpcs: [] });
  assert.equal(actions[0]?.id, "WORK:FACILITY:JOB-FARM-03");
  assert.ok(actions.some((action) => action.id === "LIFE:EAT:ITM003"));
  assert.ok(actions.some((action) => action.id === "LIFE:EAT:ITM004"));
});
