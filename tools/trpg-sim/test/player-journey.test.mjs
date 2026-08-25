import assert from "node:assert/strict";
import test from "node:test";

import { loadAllFixtures } from "../lib/fixtures.mjs";
import { buildWorldModel } from "../lib/world-model.mjs";
import { createBattleData } from "../lib/battle-model.mjs";
import { buildMissionCatalog } from "../lib/mission-model.mjs";
import {
  PLAYER_PROFILES,
  availableTravelActions,
  createInitialJourneyState,
  generateChoiceActions,
  learnPlayerSkill,
  listLearnablePlayerSkills,
  resolvePlayerAction,
} from "../lib/player-journey.mjs";
import {
  availableStockAt,
  buyEquipment,
  quoteEquipmentSale,
  sellEquipment,
} from "../lib/shop-runtime.mjs";

const fixtures = loadAllFixtures();
const model = buildWorldModel(fixtures.world);
const battleData = createBattleData(fixtures.battle);
const catalog = buildMissionCatalog(model);
const profile = PLAYER_PROFILES.find((entry) => entry.id === "balanced");

function fresh() {
  return createInitialJourneyState({
    model,
    battleData,
    skills: fixtures.skills,
    catalog,
    profile,
    tuning: {
      manualSkillSelection: true,
      playerOwnedRumorMissionProgress: true,
      requireKnownSpecialMissions: true,
      startingGold: 0,
      freeStarterMeals: 1,
      freeStarterLodging: 1,
      soloCombatPowerMultiplier: 1.65,
      missionPreparationBonusPerEvidence: 0.18,
      missionPreparationBonusMax: 0.75,
      maxConversationsPerDay: 5,
      conversationCooldownMinutes: 360,
      maxWildBattlesPerDay: 2,
      wildEncounterCooldownMinutes: 480,
      workGoldThreshold: 24,
      mealPrice: 4,
      restPrice: 4,
    },
    seed: "player-journey-test",
  });
}

test("initial player has no forced starter weapon in the canonical journey state", () => {
  const state = fresh();
  assert.equal(state.player.inventory.equipment["EQP-W-0005"] ?? 0, 0);
  assert.equal(state.player.equipment.mainHand, undefined);
});

test("normal choices expose movement as ordinary actions without a separate movement commitment", () => {
  const state = fresh();
  state.player.facilityId = "LOC_FARM_SQUARE";
  state.progress.travel.visitedHubs.add("田園の村");
  const actions = generateChoiceActions(state, model, battleData, catalog, profile, { limit: 12, fillTo: 12 });
  assert.ok(actions.some((action) => action.type === "move" && action.movementScope === "local"));
});

test("regional travel actions preserve the canonical destination and duration", () => {
  const state = fresh();
  state.player.facilityId = "LOC_FARM_SQUARE";
  const action = availableTravelActions(state, model).find((entry) => entry.destinationHub === "王都");
  assert.ok(action);
  assert.equal(action.destinationHub, "王都");
  assert.ok(action.minutes > 0);
});

test("manual skill mode lists learnability and only learns after explicit selection", () => {
  const state = fresh();
  state.player.sp = 100;
  const candidates = listLearnablePlayerSkills(state, battleData, fixtures.skills);
  const learnable = candidates.find((candidate) => candidate.learnable);
  assert.ok(learnable);
  assert.equal(state.player.skills.has(learnable.id), false);
  const learned = learnPlayerSkill(state, battleData, fixtures.skills, learnable.id);
  assert.equal(learned.ok, true);
  assert.equal(state.player.skills.has(learnable.id), true);
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
  state.player.facilityId = "LOC_FARM_REPAIR";
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
  const state = fresh();
  state.player.sp = 100;
  const before = new Set(state.player.skills);
  const candidates = listLearnablePlayerSkills(state, battleData, fixtures.skills);
  assert.ok(candidates.some((candidate) => candidate.reasons.length > 0));
  const action = generateChoiceActions(state, model, battleData, catalog, profile, { limit: 3, fillTo: 3 })[0];
  if (action) resolvePlayerAction(state, model, battleData, fixtures.skills, catalog, profile, action);
  assert.deepEqual([...state.player.skills], [...before]);
});
