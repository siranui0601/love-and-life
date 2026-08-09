import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_FACILITY_LABOUR_INTERNALS as labour,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const DAY20_MORNING = 19 * 1440 + 8 * 60;

function runtime({
  facilityId = "LOC_TRADE_PORT",
  location = "交易都市",
  gold = 2,
  hunger = 60,
  minute = DAY20_MORNING,
} = {}) {
  return {
    playerState: {
      absoluteMinute: minute,
      player: { location, facilityId, gold, freeMeals: 0, hunger, fatigue: 20 },
      hunger,
      fatigue: 20,
      missions: [],
      troubles: {},
      worldFlags: {},
      history: [],
      evidence: {},
    },
  };
}

function work(state, jobId) {
  const action = authoredMissionFlowExclusiveActions(state)
    .find((entry) => entry.authoredFacilityLabourJobId === jobId);
  assert.ok(action, `job not offered: ${jobId}`);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

test("a facility with work offers it, and the choices are jobs", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.deepEqual(actions.map((action) => action.label), [
    "朝の荷役に入る",
    "綱を取る",
  ]);
  for (const action of actions) {
    assert.equal(action.actionId, action.id);
    assert.ok(action.authoredFacilityLabourGold >= 1, "work pays");
  }
  assert.equal(authoredMissionFlowGuidance(state).title, "今日の働き口");
});

test("the same job can be worked again on another day", () => {
  const state = runtime();
  work(state, "port_morning");
  assert.equal(labour.ownEligible(state), false, "not twice in one day");

  state.playerState.absoluteMinute += 1440;
  assert.equal(labour.ownEligible(state), true, "tomorrow the quay is open again");
});

test("repetition is not repetition: the detail changes every shift", () => {
  const state = runtime();
  const seen = [];
  for (let day = 0; day < 6; day += 1) {
    state.playerState.absoluteMinute = DAY20_MORNING + day * 1440;
    state.playerState.player.gold = 2;
    const result = work(state, "port_morning");
    seen.push(result.summary);
  }
  assert.equal(new Set(seen).size, 6, "six shifts, six different shifts");
});

test("the variant pool cycles rather than repeating early, and is not random", () => {
  const entry = labour.jobsAt("LOC_TRADE_PORT")[0];
  const pool = labour.VARIANTS[entry.variantKey];
  const first = Array.from({ length: pool.length }, (_, i) => labour.variantFor(entry, i));
  assert.equal(new Set(first).size, pool.length, "every variant appears before any repeats");
  assert.equal(labour.variantFor(entry, pool.length), first[0], "then it comes round");
  assert.equal(labour.variantFor(entry, 3), labour.variantFor(entry, 3), "same input, same variant");
});

test("some shifts are simply work: nothing happens and nobody says anything", () => {
  const quiet = Object.values(labour.VARIANTS)
    .flat()
    .filter((variant) => variant.incident == null && variant.overheard == null);
  assert.ok(quiet.length >= 4, "a job where every shift matters is not a job");
});

test("working pays, feeds or tires according to the job", () => {
  // 一度きりの初任給三択が先に立つ場面（無一文かつ空腹）は避ける。
  // 常設の働き口はその下の床なので、初任給が引っ込んだ後の状態で確かめる。
  const dishes = runtime({ facilityId: "LOC_FARM_INN", location: "田園の村", gold: 12, hunger: 60 });
  work(dishes, "inn_dishes");
  assert.equal(dishes.playerState.player.gold, 14);
  assert.equal(dishes.playerState.player.freeMeals, 1, "the standing meal is part of the wage");
  assert.equal(dishes.playerState.player.hunger, 42);

  const haul = runtime();
  work(haul, "port_morning");
  assert.equal(haul.playerState.player.gold, 10);
  assert.equal(haul.playerState.player.hunger, 82, "hauling makes you hungrier");
  assert.equal(haul.playerState.player.fatigue, 58);
});

test("the pitch where an investigation is waiting is a scene, not a job", () => {
  const idle = runtime({ facilityId: "LOC_FARM_STABLE", location: "田園の村" });
  assert.equal(labour.ownEligible(idle), true);

  const onSite = runtime({ facilityId: "LOC_FARM_STABLE", location: "田園の村" });
  onSite.playerState.missions = [{
    id: "MSN-T03",
    status: "active",
    progress: { look_stable: 0 },
    steps: [{ id: "look_stable", targetFacilityId: "LOC_FARM_STABLE", required: 2 }],
  }];
  assert.equal(labour.missionWaitsHere(onSite, "LOC_FARM_STABLE"), true);
  assert.equal(labour.ownEligible(onSite), false, "muck-shovelling does not outrank the wolves");

  const done = runtime({ facilityId: "LOC_FARM_STABLE", location: "田園の村" });
  done.playerState.missions = [{
    id: "MSN-T03",
    status: "completed",
    progress: { look_stable: 0 },
    steps: [{ id: "look_stable", targetFacilityId: "LOC_FARM_STABLE", required: 2 }],
  }];
  assert.equal(labour.ownEligible(done), true, "once it is over, the stalls still need doing");
});

test("nobody queues for day labour with money in hand and a full stomach", () => {
  assert.equal(labour.needsTheWork(runtime({ gold: 40, hunger: 20 })), false);
  assert.equal(labour.needsTheWork(runtime({ gold: 40, hunger: 60 })), true, "hungry is a reason");
  assert.equal(labour.needsTheWork(runtime({ gold: 2, hunger: 10 })), true, "broke is a reason");
});

test("work keeps its hours, and places without work offer none", () => {
  assert.equal(labour.ownEligible(runtime({ minute: 19 * 1440 + 3 * 60 })), false, "not at 3am");
  assert.equal(labour.ownEligible(runtime({ facilityId: "LOC_TRADE_LORD_MANOR" })), false);
  assert.equal(labour.ownEligible(runtime({ facilityId: "LOC_CAP_CASTLE" })), false);

  const evening = runtime({ minute: 19 * 1440 + 18 * 60 });
  assert.deepEqual(
    authoredMissionFlowExclusiveActions(evening).map((action) => action.label),
    ["夕の荷役に入る", "綱を取る"],
    "the morning shift is over; the evening one is not",
  );
});

test("every job the road relies on exists in the world", () => {
  for (const [facilityId, jobId] of [
    ["LOC_FARM_INN", "inn_dishes"],
    ["LOC_FARM_GRANARY", "granary_count"],
    ["LOC_FARM_BAKERY", "bakery_oven"],
    ["LOC_TRADE_PORT", "port_morning"],
    ["LOC_TRADE_FISH_MARKET", "fish_gut"],
    ["LOC_TRADE_WAREHOUSE", "warehouse_tally"],
    ["LOC_CAP_MARKET", "market_porter"],
    ["LOC_FOREST_HUNTER_HUT", "hunter_traps"],
  ]) {
    const entries = labour.jobsAt(facilityId) ?? [];
    assert.ok(entries.some((entry) => entry.id === jobId), `${facilityId} must offer ${jobId}`);
  }
});

test("every job sits at a facility the canonical sheet knows", () => {
  // 施設を増やす時は正本へ先に追記する。ここは実装が正本を追い越さないための錠である。
  const canonical = new Set([
    "LOC_FARM_INN", "LOC_FARM_GRANARY", "LOC_FARM_BAKERY", "LOC_FARM_FIELD",
    "LOC_FARM_WELL", "LOC_FARM_STABLE",
    "LOC_TRADE_PORT", "LOC_TRADE_FISH_MARKET", "LOC_TRADE_INN", "LOC_TRADE_WAREHOUSE",
    "LOC_CAP_MARKET", "LOC_CAP_LOWER_INN", "LOC_CAP_STABLE", "LOC_CAP_NEWSPAPER",
    "LOC_FOREST_HUNTER_HUT",
  ]);
  for (const facilityId of Object.keys(labour.FACILITY_JOBS)) {
    assert.ok(canonical.has(facilityId), `${facilityId} is not in the canonical facility list`);
  }
});

test("no job asks for a skill, because skills belong to combat", () => {
  for (const entries of Object.values(labour.FACILITY_JOBS)) {
    for (const entry of entries) {
      assert.equal(entry.requiredSkill, undefined);
      assert.equal(entry.skillId, undefined);
      assert.equal(entry.requiredLevel, undefined);
    }
  }
});

test("saved progress survives a restore and keeps counting shifts", () => {
  const state = runtime();
  work(state, "port_morning");
  const saved = JSON.parse(JSON.stringify(state.playerState.facilityLabour));

  const restored = runtime({ minute: DAY20_MORNING + 1440 });
  restored.playerState.facilityLabour = saved;
  assert.equal(labour.ownEligible(restored), true);

  const entry = labour.jobsAt("LOC_TRADE_PORT")[0];
  const next = authoredMissionFlowExclusiveActions(restored)
    .find((action) => action.authoredFacilityLabourJobId === "port_morning");
  assert.equal(next.authoredFacilityLabourVariant, labour.variantFor(entry, 1),
    "the second shift is the second variant, not the first again");
});
