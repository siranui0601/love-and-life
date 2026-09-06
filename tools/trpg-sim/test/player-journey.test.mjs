import test from "node:test";
import assert from "node:assert/strict";
import { loadBattleData } from "../lib/battle-model.mjs";
import { loadSkills } from "../lib/fixtures.mjs";
import { experienceToNextLevel } from "../lib/mission-model.mjs";
import {
  availableTravelActions,
  createInitialJourneyState,
  encounterConditionMatches,
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

function prepareT01Search(state) {
  const definition = state.catalog.byId.get("MSN-T01");
  const runtime = state.missions[definition.id];
  const searchStep = definition.steps.find((step) => step.id === "search");
  state.player.location = "田園の村";
  state.player.facilityId = searchStep.targetFacilityId;
  state.troubles.T01.status = "active";
  runtime.status = "active";
  runtime.progress.hear = 1;
  runtime.progress.search = 0;
  state.progress.missions.attemptedTroubleIds.add("T01");
  state.authoritativePresentNpcIds = new Set();
  return { definition, runtime };
}

function t01SearchChoices(state) {
  return generateChoiceActions(state, model, battleData, state.catalog, undefined, {
    candidateFilter: (action) => action.missionId === "MSN-T01" && action.stepId === "search",
  });
}

function searchChoiceShape(choice) {
  return {
    id: choice.id,
    label: choice.label,
    minutes: choice.minutes,
    investigationStage: choice.investigationStage,
    approachId: choice.approachId,
    discoveryId: choice.discoveryId,
    discoveryText: choice.discoveryText,
  };
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

test("post-collapse encounter conditions include T13 critical and preserve boolean precedence", () => {
  const state = fresh();
  const condition = "(T13.status=critical OR T13.status=failed) AND Day>=60";
  for (const encounterId of ["ENC-0019", "ENC-0020", "ENC-0068"]) {
    assert.equal(battleData.encounterById.get(encounterId)?.condition, condition, encounterId);
  }

  state.day = 60;
  state.troubles.T13.status = "critical";
  assert.equal(encounterConditionMatches(condition, state), true);

  state.day = 59;
  assert.equal(encounterConditionMatches(condition, state), false);

  state.day = 60;
  state.troubles.T13.status = "resolved";
  assert.equal(encounterConditionMatches(condition, state), false);

  state.troubles.T13.status = "failed";
  assert.equal(encounterConditionMatches(condition, state), true);
  assert.equal(
    encounterConditionMatches("T13.status=critical OR T13.status=failed AND Day>=90", state),
    false,
  );
});

test("ambiguous encounter stages fail closed and authored trouble states gate their intended encounters", () => {
  const state = fresh();
  const riverCondition = "(T13.status=scheduled OR T13.status=active) AND Day<45";
  const apexCondition = "T03.status=active AND T03.investigation=engaged";
  const deserterCondition = "T11.status=failed OR T19.status=active OR T19.status=critical OR T19.status=failed";
  assert.equal(battleData.encounterById.get("ENC-0013")?.condition, riverCondition);
  assert.equal(battleData.encounterById.get("ENC-0014")?.condition, apexCondition);
  assert.equal(battleData.encounterById.get("ENC-0024")?.condition, deserterCondition);

  state.day = 44;
  state.troubles.T13.status = "active";
  assert.equal(encounterConditionMatches(riverCondition, state), true);
  state.day = 45;
  assert.equal(encounterConditionMatches(riverCondition, state), false);
  state.day = 30;
  state.troubles.T13.status = "resolved";
  assert.equal(encounterConditionMatches(riverCondition, state), false);

  state.troubles.T03.status = "active";
  assert.equal(encounterConditionMatches(apexCondition, state), false);
  state.progress.missions.attemptedTroubleIds.add("T03");
  assert.equal(encounterConditionMatches(apexCondition, state), true);
  state.troubles.T03.status = "resolved";
  assert.equal(encounterConditionMatches(apexCondition, state), false);

  state.troubles.T11.status = "active";
  state.troubles.T19.status = "scheduled";
  assert.equal(encounterConditionMatches(deserterCondition, state), false);
  state.troubles.T11.status = "failed";
  assert.equal(encounterConditionMatches(deserterCondition, state), true);
  state.troubles.T11.status = "resolved";
  state.troubles.T19.status = "active";
  assert.equal(encounterConditionMatches(deserterCondition, state), true);
  assert.equal(encounterConditionMatches("T19.stage>=approach", state), false);
  assert.equal(encounterConditionMatches("未知の秘密条件", state), false);
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

test("an unaffordable meal is not offered while work remains executable", () => {
  const state = fresh("balanced");
  state.player.needs.hunger = 100;
  state.player.gold = 0;
  state.player.freeMeals = 0;

  const unaffordable = generateChoiceActions(
    state,
    model,
    battleData,
    state.catalog,
    undefined,
    { limit: 12 },
  );
  assert.equal(unaffordable.some((choice) => choice.type === "eat"), false);
  assert.equal(unaffordable.some((choice) => choice.type === "work"), true);

  state.player.freeMeals = 1;
  const freeMeal = generateChoiceActions(
    state,
    model,
    battleData,
    state.catalog,
    undefined,
    { limit: 12 },
  );
  assert.equal(freeMeal.some((choice) => choice.type === "eat"), true);

  state.player.freeMeals = 0;
  state.player.gold = Number(state.tuning.mealPrice ?? 4);
  const affordable = generateChoiceActions(
    state,
    model,
    battleData,
    state.catalog,
    undefined,
    { limit: 12 },
  );
  assert.equal(affordable.some((choice) => choice.type === "eat"), true);
});

test("NPC rumor travel honors the NPC's own regional access", () => {
  const state = fresh("story");
  const serie = model.npcs.find((npc) => npc.id === "NPC029");
  assert.ok(serie);
  assert.equal(serie.home, "エルフの隠れ里");
  assert.equal(shortestTravelPlan(model, state, "森", "エルフの隠れ里"), null);

  const npcPlan = shortestTravelPlan(model, state, "森", "エルフの隠れ里", serie);
  assert.ok(npcPlan);
  assert.ok(Number.isFinite(npcPlan.hours));
});

test("an active mission route permit opens only its named gate and expires with the mission", () => {
  const state = fresh("story");
  state.player.location = "森";
  state.player.facilityId = "LOC_FOREST_EDGE";
  assert.equal(shortestTravelPlan(model, state, "森", "エルフの隠れ里"), null);
  const blackridgePlanBeforePermit = shortestTravelPlan(model, state, "森", "黒嶺連合領");
  assert.ok(blackridgePlanBeforePermit);
  assert.equal(state.worldFlags.elfApproval, false);

  state.worldFlags.missionRouteAccess = { "MSN-T13": ["elf-access"] };
  state.missions["MSN-T13"].status = "active";
  const emergencyPlan = shortestTravelPlan(model, state, "森", "エルフの隠れ里");
  assert.ok(emergencyPlan);
  assert.ok(Number.isFinite(emergencyPlan.hours));
  assert.deepEqual(
    shortestTravelPlan(model, state, "森", "黒嶺連合領").routeIds,
    blackridgePlanBeforePermit.routeIds,
  );
  assert.equal(state.worldFlags.elfApproval, false);
  const outsider = model.npcs.find((npc) => npc.home !== "エルフの隠れ里");
  assert.ok(outsider);
  assert.equal(
    shortestTravelPlan(model, state, "森", "エルフの隠れ里", outsider),
    null,
  );

  state.missions["MSN-T13"].status = "completed";
  assert.equal(shortestTravelPlan(model, state, "森", "エルフの隠れ里"), null);
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

test("mission resolution records the post-advance trouble status when its duration crosses a deadline", () => {
  const state = fresh("story");
  const definition = state.catalog.byId.get("MSN-T13");
  const runtime = state.missions[definition.id];
  state.troubles.T13.status = "active";
  runtime.status = "active";
  for (const step of definition.steps) {
    runtime.progress[step.id] = step.id === "resolve" ? 0 : Number(step.required ?? 1);
  }
  state.absoluteMinute = (60 - 1) * 1440 + (21 * 60 + 50 - 10 * 60);

  const result = resolvePlayerAction(state, model, battleData, skills, state.catalog, "story", {
    id: "ACTION:MSN-T13:resolve:deadline-crossing",
    type: "resolveMission",
    missionId: "MSN-T13",
    stepId: "resolve",
    minutes: 30,
  });

  assert.equal(result.ok, true);
  assert.equal(result.troubleStatusAtResolution, "critical");
  assert.equal(state.worldFlags.worldTreeFallen, true);
  assert.equal(state.troubles.T13.status, "resolved");
  assert.equal(runtime.progress.resolve, 1);
});

test("T01 search offers three concrete, non-repeating approaches at each investigation stage", () => {
  const state = fresh("story");
  prepareT01Search(state);

  const firstStage = t01SearchChoices(state);
  assert.equal(firstStage.length, 3);
  for (const key of ["id", "label", "minutes", "discoveryId", "discoveryText"]) {
    assert.equal(new Set(firstStage.map((choice) => choice[key])).size, 3, `stage 0 ${key}`);
  }
  assert.ok(firstStage.every((choice) => choice.investigationStage === 0));

  const firstSelection = firstStage.find((choice) => choice.approachId === "claw-marks");
  const firstResult = resolvePlayerAction(
    state,
    model,
    battleData,
    skills,
    state.catalog,
    "story",
    firstSelection,
  );
  assert.equal(firstResult.ok, true);
  assert.equal(firstResult.discovery.id, firstSelection.discoveryId);
  assert.equal(firstResult.summary, firstSelection.discoveryText);
  assert.deepEqual(state.missions["MSN-T01"].discoveries.map((entry) => entry.id), [firstSelection.discoveryId]);
  assert.ok(state.history.some((entry) => entry.type === "MISSION_DISCOVERY"
    && entry.discoveryId === firstSelection.discoveryId
    && entry.discoveryText === firstSelection.discoveryText));

  const secondStage = t01SearchChoices(state);
  assert.equal(secondStage.length, 3);
  for (const key of ["id", "label", "minutes", "discoveryId", "discoveryText"]) {
    assert.equal(new Set(secondStage.map((choice) => choice[key])).size, 3, `stage 1 ${key}`);
  }
  assert.ok(secondStage.every((choice) => choice.investigationStage === 1));
  const allApproaches = [...firstStage, ...secondStage];
  for (const key of ["id", "label", "minutes", "discoveryId", "discoveryText"]) {
    assert.equal(new Set(allApproaches.map((choice) => choice[key])).size, 6, `all stages ${key}`);
  }
});

test("T01 search discoveries are deterministic and two selected approaches advance to rescue", () => {
  const left = fresh("story");
  const right = fresh("story");
  const leftPrepared = prepareT01Search(left);
  const rightPrepared = prepareT01Search(right);

  const chooseApproach = (state, approachId) => {
    const offered = t01SearchChoices(state);
    const action = offered.find((choice) => choice.approachId === approachId);
    assert.ok(action, `${approachId} must be offered`);
    return {
      action,
      result: resolvePlayerAction(state, model, battleData, skills, state.catalog, "story", action),
    };
  };

  assert.deepEqual(t01SearchChoices(left).map(searchChoiceShape), t01SearchChoices(right).map(searchChoiceShape));
  const leftFirst = chooseApproach(left, "tracks");
  const rightFirst = chooseApproach(right, "tracks");
  assert.deepEqual(leftFirst.result.discovery, rightFirst.result.discovery);
  assert.deepEqual(t01SearchChoices(left).map(searchChoiceShape), t01SearchChoices(right).map(searchChoiceShape));

  const leftSecond = chooseApproach(left, "faint-voice");
  const rightSecond = chooseApproach(right, "faint-voice");
  assert.deepEqual(leftSecond.result.discovery, rightSecond.result.discovery);
  assert.deepEqual(leftPrepared.runtime.discoveries, rightPrepared.runtime.discoveries);
  assert.equal(leftPrepared.runtime.progress.search, 2);
  assert.equal(rightPrepared.runtime.progress.search, 2);
  assert.equal(leftPrepared.definition.steps.find((step) => step.id === "search").required, 2);

  const leftAfterSearch = generateChoiceActions(left, model, battleData, left.catalog);
  const rightAfterSearch = generateChoiceActions(right, model, battleData, right.catalog);
  assert.deepEqual(leftAfterSearch.map((choice) => choice.id), rightAfterSearch.map((choice) => choice.id));
  assert.ok(leftAfterSearch.some((choice) => choice.id === "ACTION:MSN-T01:rescue" && choice.type === "missionBattle"));
  assert.equal(leftAfterSearch.some((choice) => choice.stepId === "search"), false);
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
