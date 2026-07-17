import test from "node:test";
import assert from "node:assert/strict";
import { loadBattleData } from "../lib/battle-model.mjs";
import { loadSkills } from "../lib/fixtures.mjs";
import { loadWorldModel } from "../lib/world-model.mjs";
import { loadPlayerSimulationConfigV2 } from "../lib/player-suite-v2.mjs";
import {
  PLAYER_PROFILES_V2, availableLocalMovementActionsV2,
  availableRegionalMovementActionsV2, createInitialJourneyStateV2,
  generateChoiceActionsV2, simulatePlayerJourneyV2,
} from "../lib/player-journey-v2.mjs";
import { issueEventSkillRewardV2, refreshSkillStateV2 } from "../lib/journey-v2-skills.mjs";
import { refreshMissionsV2 } from "../lib/journey-v2-missions.mjs";
import { resolveMovementActionV2 } from "../lib/journey-v2-resolver.mjs";

const model = loadWorldModel();
const battleData = await loadBattleData();
const skills = loadSkills();
const config = loadPlayerSimulationConfigV2();
const balanced = PLAYER_PROFILES_V2.find((profile) => profile.id === "balanced");

function fresh(profile = balanced, overrides = {}) {
  return createInitialJourneyStateV2({ model, battleData, skills, profile, tuning: { ...config.tuned, ...overrides }, seed: `v2-test:${profile.id}` });
}

test("v2 mission catalog has 40 sequential permanent and 19 special missions", () => {
  const state = fresh();
  assert.equal(state.catalog.permanent.length, 40);
  assert.equal(state.catalog.special.length, 19);
  assert.equal(state.catalog.permanent.filter((mission) => state.missions[mission.id].status === "active").length, 8);
});

test("special mission journal caps active missions and queues excess discoveries", () => {
  const state = fresh();
  for (const mission of state.catalog.special) {
    state.troubles[mission.troubleId].status = "active";
    const rumorId = `TEST-RUMOR-${mission.troubleId}`;
    state.rumorById[rumorId] = { id: rumorId, troubleId: mission.troubleId };
    state.player.knownRumorIds.add(rumorId);
  }
  refreshMissionsV2(state, battleData, skills, balanced);
  const active = state.catalog.special.filter((mission) => state.missions[mission.id].status === "active");
  const available = state.catalog.special.filter((mission) => state.missions[mission.id].status === "available");
  assert.equal(active.length, config.tuned.maxActiveSpecialMissions);
  assert.equal(active.length + available.length, state.catalog.special.length);
  assert.equal(state.metrics.maxActiveSpecialMissions <= config.tuned.maxActiveSpecialMissions, true);
});

test("three choices remain separate from complete local and regional movement menus", () => {
  const state = fresh();
  const choices = generateChoiceActionsV2(state, model, battleData, balanced, () => true);
  assert.equal(choices.length, 3);
  assert.equal(choices.some((choice) => ["localTravel", "regionalTravel"].includes(choice.type)), false);
  assert.equal(availableLocalMovementActionsV2(state, model).length, model.facilitiesByHub[state.player.location].length - 1);
  assert.ok(availableRegionalMovementActionsV2(state, model).length > 0);
});

test("local and regional movement both mutate location state and consume time", () => {
  const state = fresh(balanced, { travelEncounterBaseChance: 0 });
  const local = availableLocalMovementActionsV2(state, model)[0];
  const beforeLocal = state.absoluteMinute;
  assert.equal(resolveMovementActionV2(state, model, battleData, skills, balanced, local), true);
  assert.equal(state.player.facilityId, local.destinationFacilityId);
  assert.ok(state.absoluteMinute > beforeLocal);
  const regional = availableRegionalMovementActionsV2(state, model)[0];
  const beforeRegional = state.absoluteMinute;
  assert.equal(resolveMovementActionV2(state, model, battleData, skills, balanced, regional), true);
  assert.equal(state.player.location, regional.destination);
  assert.ok(state.absoluteMinute > beforeRegional);
});

test("flag unlocked skill requires event unlock and learn conditions", () => {
  const skill = skills.find((entry) => entry.id === "SKL-0002");
  assert.ok(skill);
  const state = createInitialJourneyStateV2({ model, battleData, skills: [skill], profile: balanced, tuning: config.tuned, seed: "flag-gate-v2" });
  state.player.level = 3;
  state.player.sp = 1;
  state.progress.combat.physicalKills = 2;
  refreshSkillStateV2(state, battleData, [skill], balanced);
  assert.equal(state.player.skills.has(skill.id), false);
  state.progress.combat.physicalKills = 3;
  refreshSkillStateV2(state, battleData, [skill], balanced);
  assert.equal(state.player.skills.has(skill.id), true);
  assert.equal(state.metrics.skillAcquisitionViolations, 0);
});

test("reserved skill point remains available for a later flag unlock", () => {
  const basics = skills.filter((entry) => entry.acquisitionCode === "basic_level_up" && Number(entry.requiredLevel ?? 1) <= 1 && !entry.prerequisites).slice(0, 3);
  const flag = skills.find((entry) => entry.id === "SKL-0002");
  assert.equal(basics.length, 3);
  assert.ok(flag);
  const sample = [...basics, flag];
  const state = createInitialJourneyStateV2({ model, battleData, skills: sample, profile: balanced, tuning: config.tuned, seed: "flag-reserve-v2" });
  assert.equal(state.player.skills.size, 2);
  state.player.level = 2; state.player.sp += 1; refreshSkillStateV2(state, battleData, sample, balanced);
  assert.equal(state.player.skills.size, 3);
  state.player.level = 3; state.player.sp += 1; state.progress.combat.physicalKills = 2; refreshSkillStateV2(state, battleData, sample, balanced);
  assert.equal(state.player.sp, 1);
  state.progress.combat.physicalKills = 3; refreshSkillStateV2(state, battleData, sample, balanced);
  assert.equal(state.player.skills.has(flag.id), true);
  assert.equal(state.player.sp, 0);
});

test("special mission reward emits a structured event skill grant signal", () => {
  const state = fresh();
  state.player.level = 12;
  const skillId = issueEventSkillRewardV2(state, battleData, skills, balanced, { missionId: "MSN2-TEST", troubleId: "T01", difficulty: 4 });
  assert.ok(skillId);
  assert.equal(state.player.skills.has(skillId), true);
  assert.equal(state.metrics.eventGrantSignals, 1);
  assert.equal(state.metrics.eventSkillGrants, 1);
  assert.equal(state.metrics.skillAcquisitionViolations, 0);
});

test("equipment granted skill is effective only while its equipment is active", () => {
  const equipment = battleData.equipment.find((item) => item.grantedSkillId && battleData.playerSkillById.has(item.grantedSkillId));
  assert.ok(equipment);
  const state = fresh();
  state.player.equipment[equipment.slot] = equipment.id;
  refreshSkillStateV2(state, battleData, skills, balanced);
  assert.equal(state.skillState.effective.has(equipment.grantedSkillId), true);
  delete state.player.equipment[equipment.slot];
  refreshSkillStateV2(state, battleData, skills, balanced);
  assert.equal(state.skillState.effective.has(equipment.grantedSkillId), false);
});

test("same seed reproduces v2 journey and trouble resolutions are player-authoritative", () => {
  const options = { model, battleData, skills, profile: "story", tuning: config.tuned, seed: "v2-determinism", endMinute: 8 * 1440, maxActions: 1200 };
  const left = simulatePlayerJourneyV2(options);
  const right = simulatePlayerJourneyV2(options);
  assert.equal(left.summary.fingerprint, right.summary.fingerprint);
  assert.equal(left.summary.replayMismatches, 0);
  assert.equal(left.summary.invalidTroubleResolutions, 0);
  assert.equal(left.summary.movementBlocked, 0);
  assert.ok(left.summary.localMovementActions > 0);
  assert.ok(left.summary.specialMissionsDiscovered > 0);
});
