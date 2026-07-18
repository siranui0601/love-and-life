import test from "node:test";
import assert from "node:assert/strict";
import { loadBattleData } from "../lib/battle-model.mjs";
import { loadSkills } from "../lib/fixtures.mjs";
import { experienceToNextLevel } from "../lib/mission-model.mjs";
import {
  availableTravelActions,
  createInitialJourneyState,
  generateChoiceActions,
  learnPlayerSkill,
  listLearnablePlayerSkills,
  resolvePlayerAction,
  shortestTravelPlan,
  simulatePlayerJourney,
} from "../lib/player-journey.mjs";
import {
  availableStockAt,
  buyEquipment,
  quoteEquipmentSale,
  sellEquipment,
} from "../lib/shop-runtime.mjs";
import { loadPlayerSimulationConfig } from "../lib/player-suite.mjs";
import { loadWorldModel } from "../lib/world-model.mjs";

const model = loadWorldModel();
const battleData = await loadBattleData();
const skills = loadSkills();
const config = loadPlayerSimulationConfig();

function fresh(profile = "balanced") {
  return createInitialJourneyState({ model, battleData, skills, profile, tuning: config.tuned, seed: `test:${profile}` });
}

test("experience curve matches the design formula", () => {
  assert.equal(experienceToNextLevel(1), 100);
  assert.equal(experienceToNextLevel(2), 122);
  assert.ok(experienceToNextLevel(10) > experienceToNextLevel(9));
});

test("player starts at the wheat field on Day1 at 10:00", () => {
  const state = fresh();
  assert.equal(state.day, 1);
  assert.equal(state.hour, 10);
  assert.equal(state.minute, 0);
  assert.equal(state.player.location, "田園の村");
  assert.equal(state.player.facilityId, "LOC_FARM_FIELD");
});

test("three choices are separate from a complete reachable travel menu", () => {
  const state = fresh();
  const choices = generateChoiceActions(state, model, battleData, state.catalog);
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map((choice) => choice.id)).size, 3);
  assert.equal(choices.some((choice) => choice.type === "travel"), false);

  const travel = availableTravelActions(state, model);
  const listed = new Set(travel.map((entry) => entry.destination));
  for (const destination of model.locations) {
    if (destination === state.player.location) continue;
    const route = shortestTravelPlan(model, state, state.player.location, destination);
    assert.equal(listed.has(destination), Boolean(route), destination);
  }
});

test("ordinary shop purchase advances no time", () => {
  const state = fresh();
  state.player.facilityId = "LOC_FARM_SQUARE";
  state.player.gold = 1000;
  const available = availableStockAt(state, battleData, state.shop);
  assert.ok(available.length > 0);
  const before = state.absoluteMinute;
  const result = buyEquipment(state, battleData, state.shop, available[0].id);
  assert.equal(result.ok, true);
  assert.equal(state.absoluteMinute, before);
});

test("shop inventory and transactions are restricted to the current seller facility", () => {
  const state = fresh();
  state.player.gold = 1000;
  state.player.facilityId = "LOC_FARM_SQUARE";
  const local = availableStockAt(state, battleData, state.shop);
  assert.ok(local.length > 0);
  assert.ok(local.every((entry) => entry.sellerId === "LOC_FARM_SQUARE"));
  const hubWide = availableStockAt(state, battleData, state.shop, { allFacilities: true });
  assert.ok(hubWide.length > local.length);
  assert.ok(hubWide.some((entry) => entry.sellerId !== "LOC_FARM_SQUARE"));
  assert.deepEqual(
    availableStockAt(state, battleData, state.shop, state.player.location).map((entry) => entry.id),
    hubWide.map((entry) => entry.id),
  );

  const remoteBuy = buyEquipment(state, battleData, state.shop, "STK-0004");
  assert.deepEqual(remoteBuy, { ok: false, reason: "not_available" });

  state.player.inventory.equipment["EQP-W-0006"] = 1;
  state.player.facilityId = "LOC_FARM_INN";
  assert.equal(sellEquipment(state, battleData, state.shop, "EQP-W-0006").reason, "no_compatible_seller");
  state.player.facilityId = "LOC_FARM_SQUARE";
  const quote = quoteEquipmentSale(state, battleData, "EQP-W-0006");
  assert.equal(quote.ok, true);
  const sale = sellEquipment(state, battleData, state.shop, "EQP-W-0006");
  assert.equal(sale.ok, true);
  assert.equal(sale.price, quote.price);
});

test("an initially listed item still requires its unlock condition", () => {
  const state = fresh();
  state.player.facilityId = "LOC_FARM_CHIEF";
  const locked = availableStockAt(state, battleData, state.shop);
  assert.equal(locked.some((entry) => entry.id === "STK-0119"), false);
  assert.equal(locked.some((entry) => entry.id === "STK-0003"), false);
  state.player.reputation["田園の村"] = 20;
  const unlocked = availableStockAt(state, battleData, state.shop);
  assert.equal(unlocked.some((entry) => entry.id === "STK-0003"), true);
});

test("manual skill mode exposes reasons and never auto-learns after resolving an action", () => {
  const state = createInitialJourneyState({
    model,
    battleData,
    skills,
    profile: "balanced",
    tuning: { ...config.tuned, manualSkillSelection: true },
    seed: "manual-skill-test",
  });
  assert.equal(state.player.skills.size, 0);
  assert.ok(state.player.visibleSkillIds.size > 0);
  const candidates = listLearnablePlayerSkills(state, battleData, skills);
  assert.ok(candidates.some((entry) => entry.learnable));
  assert.ok(candidates.some((entry) => !entry.learnable && entry.reasons.length > 0));

  const observe = { id: "MANUAL-OBSERVE", type: "observe", minutes: 45, label: "observe" };
  resolvePlayerAction(state, model, battleData, skills, state.catalog, "balanced", observe);
  assert.equal(state.player.skills.size, 0);

  const selected = listLearnablePlayerSkills(state, battleData, skills).find((entry) => entry.learnable);
  const spBeforeLearning = state.player.sp;
  const result = learnPlayerSkill(state, battleData, skills, selected.id);
  assert.equal(result.ok, true);
  assert.equal(state.player.skills.has(selected.id), true);
  assert.equal(state.player.sp, spBeforeLearning - selected.spCost);
  assert.equal(learnPlayerSkill(state, battleData, skills, selected.id).reason, "already_learned");
});

test("authoritative present NPC ids prevent conversation with absent NPCs", () => {
  const state = fresh("story");
  const authoritativeNpc = model.npcs.find((npc) => npc.id === "NPC100");
  assert.ok(authoritativeNpc);
  state.authoritativePresentNpcIds = [authoritativeNpc.id];
  const choices = generateChoiceActions(state, model, battleData, state.catalog);
  const talks = choices.filter((entry) => entry.id.startsWith("TALK:"));
  assert.equal(talks.length, 1);
  assert.equal(talks[0].targetNpcId, authoritativeNpc.id);

  state.authoritativePresentNpcIds = new Set();
  const withoutNpcs = generateChoiceActions(state, model, battleData, state.catalog);
  assert.equal(withoutNpcs.some((entry) => entry.id.startsWith("TALK:")), false);
});

test("T01 actions crossing the Day2 rescue deadline persist failure without progress or resurrection", () => {
  const state = fresh("story");
  const definition = state.catalog.byId.get("MSN-T01");
  const runtime = state.missions[definition.id];
  state.troubles.T01.status = "active";
  runtime.status = "active";
  for (const step of definition.steps) runtime.progress[step.id] = step.id === "decide" ? 0 : Number(step.required ?? 1);
  state.absoluteMinute = 2150; // Day2 21:50; T01's source fate is anchored at 22:00.

  const result = resolvePlayerAction(state, model, battleData, skills, state.catalog, "story", {
    id: "ACTION:MSN-T01:decide",
    type: "resolveMission",
    missionId: "MSN-T01",
    stepId: "decide",
    minutes: 18,
  });

  assert.equal(result.ok, false);
  assert.equal(result.committed, true);
  assert.equal(result.reason, "mission_expired");
  assert.equal(state.absoluteMinute, 2168);
  assert.equal(state.troubles.T01.status, "failed");
  assert.equal(runtime.status, "failed");
  assert.equal(runtime.progress.decide, 0);
  assert.equal(runtime.rewardClaimed, false);
  assert.equal(state.progress.missions.resolvedTroubleIds.has("T01"), false);
});

test("same seed and profile replay to the same world fingerprint", () => {
  const options = {
    model,
    battleData,
    skills,
    profile: "story",
    tuning: config.tuned,
    seed: "determinism-smoke",
    endMinute: 3 * 1440,
    maxActions: 500,
  };
  const left = simulatePlayerJourney(options);
  const right = simulatePlayerJourney(options);
  assert.equal(left.summary.fingerprint, right.summary.fingerprint);
  assert.equal(left.summary.replayMismatches, 0);
  assert.equal(left.summary.terminatedByActionCap, false);
});

test("story profile can interact with early trouble, missions, combat, and levels", () => {
  const run = simulatePlayerJourney({
    model,
    battleData,
    skills,
    profile: "story",
    tuning: config.tuned,
    seed: "story-vertical-slice",
    endMinute: 5 * 1440,
    maxActions: 800,
  });
  assert.equal(run.summary.terminatedByActionCap, false);
  assert.ok(run.summary.actions > 0);
  assert.ok(run.summary.missionsCompleted > 0);
  assert.ok(run.summary.level >= 2);
  assert.ok(["active", "critical", "failed", "resolved"].includes(run.state.troubles.T01.status));
  assert.ok(run.summary.rumorCount > 0);
});
