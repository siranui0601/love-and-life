import test from "node:test";
import assert from "node:assert/strict";
import { loadBattleData } from "../lib/battle-model.mjs";
import { loadSkills } from "../lib/fixtures.mjs";
import { auditMissionCatalog } from "../lib/mission-model.mjs";
import {
  availableMovementActions,
  createInitialJourneyState,
  generateChoiceActions,
  probeTroubleResolution,
  resolveMovementAction,
  simulatePlayerJourney,
} from "../lib/player-journey.mjs";
import { loadPlayerSimulationConfig } from "../lib/player-suite.mjs";
import { loadWorldModel } from "../lib/world-model.mjs";

const model = loadWorldModel();
const battleData = await loadBattleData();
const skills = loadSkills();
const config = loadPlayerSimulationConfig();

function fresh(profile = "balanced") {
  return createInitialJourneyState({ model, battleData, skills, profile, tuning: config.tuned, seed: `v2-test:${profile}` });
}

test("movement menu includes local facilities and reachable regions while choices remain separate", () => {
  const state = fresh("explorer");
  const movements = availableMovementActions(state, model);
  assert.ok(movements.some((action) => action.movementScope === "local"));
  assert.ok(movements.some((action) => action.movementScope === "regional"));
  assert.ok(movements.every((action) => action.type === "move"));
  const choices = generateChoiceActions(state, model, battleData, state.catalog);
  assert.equal(choices.length, 3);
  assert.equal(choices.some((action) => action.type === "move"), false);
});

test("local movement advances time and records the visited facility", () => {
  const state = fresh("explorer");
  const action = availableMovementActions(state, model).find((entry) => entry.movementScope === "local");
  assert.ok(action);
  const before = state.absoluteMinute;
  const result = resolveMovementAction(state, model, battleData, skills, "explorer", action);
  assert.equal(result.ok, true);
  assert.equal(state.player.facilityId, action.destinationFacilityId);
  assert.ok(state.absoluteMinute > before);
  assert.ok(state.progress.travel.visitedFacilities.has(action.destinationFacilityId));
});

test("mission catalog has staged permanent chains and one special mission per trouble", () => {
  const state = fresh();
  const audit = auditMissionCatalog(state.catalog, model, battleData);
  assert.equal(audit.ok, true);
  assert.equal(audit.counts.permanentDefinitions, 24);
  assert.equal(audit.counts.permanentChains, 8);
  assert.equal(audit.counts.initialActivePermanent, 8);
  assert.equal(audit.counts.special, model.troubles.length);
  const activePermanent = state.catalog.permanent.filter((mission) => state.missions[mission.id].status === "active");
  assert.equal(activePermanent.length, 8);
});

test("early and late trouble action paths can resolve through player actions", () => {
  for (const troubleId of ["T01", "T18"]) {
    const result = probeTroubleResolution({ model, battleData, skills, troubleId, tuning: config.tuned, seed: `probe-test:${troubleId}` });
    assert.equal(result.ok, true, `${troubleId}: ${result.reason ?? result.finalStatus}`);
    assert.equal(result.finalStatus, "resolved");
  }
});

test("journey never learns a skill while its acquisition conditions are false", () => {
  const run = simulatePlayerJourney({
    model,
    battleData,
    skills,
    profile: "story",
    tuning: config.tuned,
    seed: "skill-condition-v2",
    endMinute: 12 * 1440,
    maxActions: 1000,
  });
  assert.equal(run.summary.skillConditionViolations, 0);
  assert.ok(run.summary.visibleSkillCount > 0);
  assert.ok(run.summary.learnedSkills >= 2);
});
