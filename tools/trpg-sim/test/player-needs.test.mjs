import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAYER_COLLAPSE_BLOCKED_COMMAND_TYPES,
  PLAYER_COLLAPSE_THRESHOLD,
  PLAYER_NEEDS_VERSION,
  advancePlayerNeeds,
  completePlayerCollapseRescue,
  completePlayerRest,
  consumeMeal,
  createPlayerNeeds,
  ensurePlayerNeeds,
  openPlayerCollapseIncident,
  playerCanTakeNormalAction,
  playerCollapseCommandBlock,
  playerCollapseState,
  publicPlayerNeeds,
} from "../lib/player-needs.mjs";

test("legacy hunger and fatigue state migrates without changing its visible values", () => {
  const player = {
    needs: { hunger: 82, fatigue: 88, lastMealMinute: 12, lastSleepMinute: 24 },
  };
  const needs = ensurePlayerNeeds(player);
  assert.equal(needs.version, PLAYER_NEEDS_VERSION);
  assert.equal(needs.hunger, 82);
  assert.equal(needs.fatigue, 88);
  assert.equal(player.needs, needs);
  assert.equal(needs.lastSleepQuality, "none");
  assert.equal(needs.activeCollapse, null);
  assert.equal(needs.lastCollapse, null);
});

test("the same elapsed action produces the same deterministic needs result", () => {
  const first = createPlayerNeeds();
  const second = createPlayerNeeds();
  const input = {
    minutes: 180,
    reason: "regional-move:田園の村->王都",
    daypart: "day",
    weatherTags: ["rain", "wet", "outdoor"],
    outdoors: true,
  };
  assert.deepEqual(advancePlayerNeeds(first, input), advancePlayerNeeds(second, input));
  assert.ok(first.hunger > 15);
  assert.ok(first.fatigue > 8);
});

test("work and bad-weather travel are more tiring than quiet indoor time", () => {
  const indoor = createPlayerNeeds({ hunger: 10, fatigue: 10 });
  const work = createPlayerNeeds({ hunger: 10, fatigue: 10 });
  const travel = createPlayerNeeds({ hunger: 10, fatigue: 10 });
  advancePlayerNeeds(indoor, { minutes: 120, reason: "observe", daypart: "day", outdoors: false });
  advancePlayerNeeds(work, { minutes: 120, reason: "odd-job", daypart: "day", outdoors: false });
  advancePlayerNeeds(travel, {
    minutes: 120,
    reason: "regional-move:田園の村->王都",
    daypart: "day",
    outdoors: true,
    weatherTags: ["storm", "rain", "wet"],
  });
  assert.ok(work.fatigue > indoor.fatigue);
  assert.ok(travel.fatigue > indoor.fatigue);
  assert.ok(travel.hunger > indoor.hunger);
});

test("a meal records its time and cannot reduce hunger below zero", () => {
  const needs = createPlayerNeeds({ hunger: 35 });
  const result = consumeMeal(needs, { minute: 720, nutrition: 58, quality: "hearty" });
  assert.equal(needs.hunger, 0);
  assert.equal(needs.lastMealMinute, 720);
  assert.equal(result.hungerReduced, 35);
});

test("lodging fully restores fatigue while unsafe wet camping does not", () => {
  const lodging = createPlayerNeeds({ fatigue: 88 });
  const camping = createPlayerNeeds({ fatigue: 88 });
  completePlayerRest(lodging, { minute: 960, durationMinutes: 480, lodging: true });
  const campResult = completePlayerRest(camping, {
    minute: 960,
    durationMinutes: 480,
    lodging: false,
    safety: "poor",
    weatherTags: ["rain", "wet", "cold"],
  });
  assert.equal(lodging.fatigue, 0);
  assert.ok(camping.fatigue > 30);
  assert.equal(camping.outdoorSleepCount, 1);
  assert.equal(campResult.fullyRested, false);
});

test("public need state exposes stable labels and urgency thresholds", () => {
  const normal = publicPlayerNeeds(createPlayerNeeds({ hunger: 20, fatigue: 25 }));
  const urgent = publicPlayerNeeds(createPlayerNeeds({ hunger: 85, fatigue: 20 }));
  const critical = publicPlayerNeeds(createPlayerNeeds({ hunger: 95, fatigue: 94 }));
  assert.equal(normal.urgent, false);
  assert.equal(urgent.urgent, true);
  assert.equal(critical.critical, true);
  assert.match(critical.hungerLabel, /危険/u);
  assert.match(critical.fatigueLabel, /危険/u);
});

test("collapse is deterministic and starts only at the hard limit", () => {
  assert.equal(PLAYER_COLLAPSE_THRESHOLD, 100);
  const justBelow = playerCollapseState(createPlayerNeeds({ hunger: 99.999, fatigue: 99.999 }));
  assert.equal(justBelow.collapsed, false);
  assert.deepEqual(justBelow.causes, []);
  assert.equal(justBelow.primaryCause, null);
  assert.deepEqual(playerCollapseState(createPlayerNeeds({ hunger: 100, fatigue: 40 })), {
    collapsed: true,
    causes: ["hunger"],
    primaryCause: "hunger",
    hunger: 100,
    fatigue: 40,
  });
  assert.deepEqual(playerCollapseState(createPlayerNeeds({ hunger: 100, fatigue: 100 })), {
    collapsed: true,
    causes: ["hunger", "fatigue"],
    primaryCause: "hunger",
    hunger: 100,
    fatigue: 100,
  });
});

test("public need state exposes collapse without treating critical as collapse", () => {
  const critical = publicPlayerNeeds(createPlayerNeeds({ hunger: 99, fatigue: 99 }));
  const collapsed = publicPlayerNeeds(createPlayerNeeds({ hunger: 100, fatigue: 100 }));
  assert.equal(critical.critical, true);
  assert.equal(critical.collapsed, false);
  assert.deepEqual(critical.collapseCauses, []);
  assert.equal(collapsed.collapsed, true);
  assert.deepEqual(collapsed.collapseCauses, ["hunger", "fatigue"]);
});

test("collapse incident opens once and blocks normal actions until rescue", () => {
  const needs = createPlayerNeeds({ hunger: 100, fatigue: 100 });
  const first = openPlayerCollapseIncident(needs, {
    minute: 57600,
    location: "王都",
    facilityId: "LOC_CAPITAL_LOWER_INN",
  });
  const second = openPlayerCollapseIncident(needs, {
    minute: 57613,
    location: "王都",
    facilityId: "LOC_CAPITAL_ORPHANAGE",
  });
  assert.equal(first.opened, true);
  assert.equal(second.opened, false);
  assert.equal(second.incident.id, first.incident.id);
  assert.equal(second.incident.atMinute, 57600);
  assert.equal(second.incident.facilityId, "LOC_CAPITAL_LOWER_INN");
  assert.deepEqual(second.incident.causes, ["hunger", "fatigue"]);
  assert.equal(playerCanTakeNormalAction(needs), false);
  const publicNeeds = publicPlayerNeeds(needs);
  assert.equal(publicNeeds.collapsePending, true);
  assert.equal(publicNeeds.collapseIncidentId, first.incident.id);
});

test("collapse command contract blocks gameplay commands but not acknowledgements", () => {
  const needs = createPlayerNeeds({ hunger: 100, fatigue: 100 });
  const gameplayCommands = [
    "CHOOSE",
    "TALK",
    "MOVE",
    "SHOP_BUY",
    "SHOP_SELL",
    "SHOP_TRY",
    "SHOP_BUY_USED",
    "SHOP_BORROW",
    "SHOP_RETURN_LOAN",
    "CLAIM_EQUIPMENT_REWARD",
    "EQUIP",
    "UNEQUIP",
    "LEARN_SKILL",
    "BATTLE_ACT",
  ];
  assert.deepEqual(PLAYER_COLLAPSE_BLOCKED_COMMAND_TYPES, gameplayCommands);
  for (const commandType of gameplayCommands) {
    const result = playerCollapseCommandBlock(needs, commandType);
    assert.equal(result.blocked, true, commandType);
    assert.equal(result.code, "player_collapse_pending_rescue", commandType);
    assert.deepEqual(result.causes, ["hunger", "fatigue"], commandType);
  }
  assert.deepEqual(playerCollapseCommandBlock(needs, "TUTORIAL_ACK"), {
    blocked: false,
    code: null,
    commandType: "TUTORIAL_ACK",
    incident: null,
  });
  assert.deepEqual(playerCollapseCommandBlock(needs, "ACK_NPC_INTRODUCTION"), {
    blocked: false,
    code: null,
    commandType: "ACK_NPC_INTRODUCTION",
    incident: null,
  });
});

test("pending rescue keeps gameplay commands blocked after raw needs are reduced", () => {
  const needs = createPlayerNeeds({ hunger: 100, fatigue: 100 });
  const opened = openPlayerCollapseIncident(needs, {
    minute: 500,
    location: "王都",
    facilityId: "LOC_CAPITAL_LOWER_INN",
  });
  needs.hunger = 20;
  needs.fatigue = 20;
  const blocked = playerCollapseCommandBlock(needs, "MOVE");
  assert.equal(opened.opened, true);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.incident.id, opened.incident.id);
  assert.deepEqual(blocked.causes, ["hunger", "fatigue"]);
});

test("rescue completes the pending incident once and restores action eligibility", () => {
  const needs = createPlayerNeeds({ hunger: 100, fatigue: 100 });
  const opened = openPlayerCollapseIncident(needs, {
    minute: 6000,
    location: "田園の村",
    facilityId: "LOC_FARM_EDGE",
  });
  const rescue = completePlayerCollapseRescue(needs, {
    minute: 6360,
    rescuerId: "NPC-MIRA",
    wakeLocation: "田園の村",
    wakeFacilityId: "LOC_FARM_INN",
    hungerAfter: 64,
    fatigueAfter: 52,
  });
  const duplicate = completePlayerCollapseRescue(needs, {
    minute: 6420,
    rescuerId: "NPC-GARO",
  });
  assert.equal(opened.opened, true);
  assert.equal(rescue.completed, true);
  assert.equal(duplicate.completed, false);
  assert.equal(rescue.incident.status, "rescued");
  assert.equal(rescue.incident.rescuerId, "NPC-MIRA");
  assert.equal(rescue.incident.wakeFacilityId, "LOC_FARM_INN");
  assert.equal(needs.activeCollapse, null);
  assert.equal(needs.lastCollapse.id, opened.incident.id);
  assert.equal(needs.hunger, 64);
  assert.equal(needs.fatigue, 52);
  assert.equal(playerCanTakeNormalAction(needs), true);
  assert.equal(playerCollapseCommandBlock(needs, "MOVE").blocked, false);
});

test("rescue clamps recovery below the collapse threshold", () => {
  const needs = createPlayerNeeds({ hunger: 100, fatigue: 100 });
  openPlayerCollapseIncident(needs, { minute: 10 });
  completePlayerCollapseRescue(needs, { minute: 20, hungerAfter: 1000, fatigueAfter: 1000 });
  assert.equal(needs.hunger, 99);
  assert.equal(needs.fatigue, 99);
  assert.equal(playerCanTakeNormalAction(needs), true);
});
