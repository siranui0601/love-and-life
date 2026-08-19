import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBattleData } from '../lib/battle-model.mjs';
import { loadSkills } from '../lib/fixtures.mjs';
import { createInitialJourneyState, listPlayerSkillStates, PLAYER_SKILL_UI_STATES } from '../lib/player-journey.mjs';
import { loadPlayerSimulationConfig } from '../lib/player-suite.mjs';
import { loadWorldModel } from '../lib/world-model.mjs';
import { auditSkillAcquisitionCheckpointC, CHECKPOINT_C_ACQUISITION_COUNTS } from '../lib/player-skill-acquisition-checkpoint-c.mjs';

const model = loadWorldModel();
const battleData = await loadBattleData();
const skills = loadSkills();
const config = loadPlayerSimulationConfig();

function fresh() {
  return createInitialJourneyState({ model, battleData, skills, profile: 'balanced', tuning: { ...config.tuned, manualSkillSelection: true }, seed: 'checkpoint-c-acquisition' });
}

test('Checkpoint C acquisition counts, prerequisites and producer traces are closed', () => {
  const audit = auditSkillAcquisitionCheckpointC(skills, battleData);
  assert.equal(audit.total, 1141);
  assert.deepEqual(audit.counts, CHECKPOINT_C_ACQUISITION_COUNTS);
  assert.equal(audit.spCandidates, 499);
  assert.deepEqual(audit.prerequisites.missing, []);
  assert.deepEqual(audit.prerequisites.cycles, []);
  assert.equal(audit.eventProducerTrace.length, 325);
  assert.deepEqual(audit.eventWithoutProducer, []);
  assert.equal(audit.eventProducerTrace.every((entry) => entry.producers.every((producer) => producer.resolver === 'player-journey-base.grantEventSkills')), true);
  assert.equal(audit.equipmentProducerTrace.length, 162);
  assert.deepEqual(audit.equipmentWithoutProducer, []);
  assert.equal(audit.equipmentProducerTrace.every((entry) => entry.producers.some((producer) => producer.source === 'equipment' && producer.path === 'grantedSkillIds')), true);
  assert.ok(audit.currentEquipmentReferenceCount > 0, 'current canonical equipment must exercise the generic equipment-grant producer');
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
  assert.equal(equipmentRow.active, false, 'equipment-granted skill must not be active while its granting equipment is not equipped');
});

test('Checkpoint C equipment-granted skills are active only while the granting equipment is equipped', () => {
  const audit = auditSkillAcquisitionCheckpointC(skills, battleData);
  const [skillId, equipmentIds] = [...audit.equipmentReferences.entries()][0] ?? [];
  assert.ok(skillId && equipmentIds?.length, 'a canonical equipment-grant witness must exist');
  const equipment = battleData.equipmentById.get(equipmentIds[0]);
  assert.ok(equipment);
  const state = fresh();
  let row = listPlayerSkillStates(state, battleData, skills).find((entry) => entry.id === skillId);
  assert.equal(row.state, 'EQUIPMENT_ONLY');
  assert.equal(row.active, false);
  state.player.equipment[equipment.slot] = equipment.id;
  row = listPlayerSkillStates(state, battleData, skills).find((entry) => entry.id === skillId);
  assert.equal(row.state, 'EQUIPMENT_ONLY');
  assert.equal(row.active, true);
  delete state.player.equipment[equipment.slot];
  row = listPlayerSkillStates(state, battleData, skills).find((entry) => entry.id === skillId);
  assert.equal(row.active, false);
  assert.equal(state.player.skills.has(skillId), false, 'equipment grant must never leak into persistent learned skills');
});
