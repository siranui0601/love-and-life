import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBattleData } from '../lib/battle-model.mjs';
import { loadSkills } from '../lib/fixtures.mjs';
import { createInitialJourneyState, grantEventSkillFromProducer, listPlayerSkillStates, PLAYER_SKILL_UI_STATES } from '../lib/player-journey.mjs';
import { loadPlayerSimulationConfig } from '../lib/player-suite.mjs';
import { skillRuntimeCoverage } from '../lib/player-skill-compiler.mjs';
import { auditPlayerRuntimeFamilies } from '../lib/player-runtime-family-status.mjs';
import { loadWorldModel } from '../lib/world-model.mjs';
import { auditSkillAcquisitionCheckpointC, CHECKPOINT_C_ACQUISITION_COUNTS, classifyAllPlayerSkillsCheckpointC } from '../lib/player-skill-acquisition-checkpoint-c.mjs';

const model = loadWorldModel();
const battleData = await loadBattleData();
const skills = loadSkills();
const config = loadPlayerSimulationConfig();

function fresh() {
  return createInitialJourneyState({ model, battleData, skills, profile: 'balanced', tuning: { ...config.tuned, manualSkillSelection: true }, seed: 'checkpoint-c-acquisition' });
}

function minimalGrantState() {
  return {
    absoluteMinute: 0,
    player: { skills: new Set(), visibleSkillIds: new Set() },
    progress: { events: { grantedSkillIds: new Set() } },
    worldFlags: {},
    history: [],
  };
}

test('Checkpoint C acquisition counts, prerequisites and producer manifests are closed', () => {
  const audit = auditSkillAcquisitionCheckpointC(skills, battleData);
  assert.equal(audit.total, 1141);
  assert.deepEqual(audit.counts, CHECKPOINT_C_ACQUISITION_COUNTS);
  assert.equal(audit.spCandidates, 499);
  assert.deepEqual(audit.prerequisites.missing, []);
  assert.deepEqual(audit.prerequisites.cycles, []);
  assert.equal(audit.spManifest.length, 499);
  assert.equal(audit.spManifest.every((entry) => entry.autoLearnAllowed === false), true);
  assert.deepEqual(audit.spManifest.filter((entry) => entry.classification !== 'VALID'), []);
  assert.equal(audit.eventManifest.length, 325);
  assert.deepEqual(audit.eventWithoutProducer, []);
  assert.deepEqual(audit.eventUnreachable, []);
  assert.equal(audit.equipmentManifest.length, 162);
  assert.deepEqual(audit.equipmentWithoutProducer, []);
  assert.equal(audit.equipmentManifest.every((entry) => entry.persistentLearned === false), true);
});

test('Checkpoint C all 325 event grants have an executable producer → flag/state → grant path', () => {
  const audit = auditSkillAcquisitionCheckpointC(skills, battleData);
  for (const entry of audit.eventManifest) {
    const state = minimalGrantState();
    const producerId = entry.producerIds[0];
    assert.ok(producerId, `${entry.skillId}: producer required`);
    const result = grantEventSkillFromProducer(state, battleData, skills, entry.skillId, producerId);
    assert.equal(result.ok, true, `${entry.skillId}: ${result.reason ?? 'grant failed'}`);
    assert.equal(state.player.skills.has(entry.skillId), true, `${entry.skillId}: persistent grant missing`);
    assert.equal(state.progress.events.grantedSkillIds.has(entry.skillId), true, `${entry.skillId}: event counter/flag missing`);
    assert.ok(state.history.some((history) => history.type === 'SKILL_GRANTED_STRUCTURED' && history.skillId === entry.skillId));
  }
});

test('Checkpoint C exposes all six skill UI states without auto-learning normal SP skills', () => {
  const state = fresh();
  const spCandidateIds = new Set(skills.filter((skill) => ['basic_level_up', 'flag_unlocked'].includes(skill.acquisitionCode)).map((skill) => skill.id));
  assert.equal([...state.player.skills].some((id) => spCandidateIds.has(id)), false, 'manual production mode must not auto-learn normal SP skills');
  const eventSkill = skills.find((skill) => skill.acquisitionCode === 'event_granted');
  const equipmentSkill = skills.find((skill) => skill.acquisitionCode === 'equipment_granted');
  const visibleFlag = skills.find((skill) => skill.acquisitionCode === 'flag_unlocked');
  assert.ok(eventSkill && equipmentSkill && visibleFlag);
  state.player.visibleSkillIds.add(visibleFlag.id);
  const initiallyLearnable = listPlayerSkillStates(state, battleData, skills).find((entry) => entry.state === 'LEARNABLE');
  assert.ok(initiallyLearnable, 'at least one level-1 SP skill must be learnable with starting SP');
  state.player.skills.add(initiallyLearnable.id);
  const rows = listPlayerSkillStates(state, battleData, skills);
  const observed = new Set(rows.map((entry) => entry.state));
  for (const expected of PLAYER_SKILL_UI_STATES) assert.ok(observed.has(expected), `${expected} must be represented by the production state model`);
  const eventRow = rows.find((entry) => entry.id === eventSkill.id);
  const equipmentRow = rows.find((entry) => entry.id === equipmentSkill.id);
  assert.equal(eventRow.state, 'EVENT_ONLY');
  assert.equal(eventRow.learnable, false);
  assert.equal(equipmentRow.state, 'EQUIPMENT_ONLY');
  assert.equal(equipmentRow.learnable, false);
  assert.equal(equipmentRow.active, false);
});

test('Checkpoint C equipment-granted skills are active only while their granting equipment is equipped', () => {
  const audit = auditSkillAcquisitionCheckpointC(skills, battleData);
  for (const entry of audit.equipmentManifest.filter((row) => row.classification === 'VALID')) {
    const equipment = battleData.equipmentById.get(entry.equipmentIds[0]);
    assert.ok(equipment, entry.skillId);
    const state = fresh();
    let row = listPlayerSkillStates(state, battleData, skills).find((candidate) => candidate.id === entry.skillId);
    assert.equal(row.state, 'EQUIPMENT_ONLY');
    assert.equal(row.active, false);
    state.player.equipment[equipment.slot] = equipment.id;
    row = listPlayerSkillStates(state, battleData, skills).find((candidate) => candidate.id === entry.skillId);
    assert.equal(row.active, true, `${entry.skillId}: equip must activate`);
    delete state.player.equipment[equipment.slot];
    row = listPlayerSkillStates(state, battleData, skills).find((candidate) => candidate.id === entry.skillId);
    assert.equal(row.active, false, `${entry.skillId}: unequip must deactivate`);
    assert.equal(state.player.skills.has(entry.skillId), false, `${entry.skillId}: equipment grant leaked into permanent learned skills`);
  }
});

test('Checkpoint C assigns a terminal deterministic classification to all 1,141 skills', () => {
  const coverage = skillRuntimeCoverage(skills);
  const familyAudit = auditPlayerRuntimeFamilies(coverage.mechanicCounts);
  const familyStatus = new Map(familyAudit.rows.map((entry) => [entry.family, entry.status]));
  const rows = classifyAllPlayerSkillsCheckpointC(skills, battleData, familyStatus);
  assert.equal(rows.length, 1141);
  assert.equal(rows.some((entry) => ['UNKNOWN', 'TODO', 'PARTIAL', 'MISSING_HANDLER', 'INVALID_PREREQUISITE', 'INVALID_WEAPON_GATE', 'DEAD_SKILL'].includes(entry.classification)), false);
  const counts = Object.fromEntries([...new Set(rows.map((entry) => entry.classification))].sort().map((classification) => [classification, rows.filter((entry) => entry.classification === classification).length]));
  assert.equal((counts.VALID ?? 0) + (counts.UNREACHABLE ?? 0) + (counts.DELETED ?? 0) + (counts.NON_SKILL ?? 0), 1141);
  console.log(`PLAYER_SKILL_C_FINAL_CLASSIFICATION ${JSON.stringify(counts)}`);
});
