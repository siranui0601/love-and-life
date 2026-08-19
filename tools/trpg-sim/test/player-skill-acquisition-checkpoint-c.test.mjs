import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBattleData } from '../lib/battle-model.mjs';
import { loadSkills } from '../lib/fixtures.mjs';
import {
  createInitialJourneyState,
  listPlayerSkillStates,
  PLAYER_SKILL_UI_STATES,
} from '../lib/player-journey.mjs';
import { loadPlayerSimulationConfig } from '../lib/player-suite.mjs';
import { loadWorldModel } from '../lib/world-model.mjs';
import {
  auditSkillAcquisitionCheckpointC,
  CHECKPOINT_C_ACQUISITION_COUNTS,
} from '../lib/player-skill-acquisition-checkpoint-c.mjs';

const model = loadWorldModel();
const battleData = await loadBattleData();
const skills = loadSkills();
const config = loadPlayerSimulationConfig();

function fresh() {
  return createInitialJourneyState({
    model,
    battleData,
    skills,
    profile: 'balanced',
    tuning: { ...config.tuned, manualSkillSelection: true },
    seed: 'checkpoint-c-acquisition',
  });
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
  assert.deepEqual(audit.unreferencedEquipmentGrants, []);
});

test('Checkpoint C exposes all six skill UI states without auto-learning normal SP skills', () => {
  const state = fresh();
  const spCandidateIds = new Set(skills.filter((skill) => ['basic_level_up', 'flag_unlocked'].includes(skill.acquisitionCode)).map((skill) => skill.id));
  assert.equal([...state.player.skills].some((id) => spCandidateIds.has(id)), false, 'manual production mode must not auto-learn normal SP skills');

  const highLevelBasic = skills.find((skill) => skill.acquisitionCode === 'basic_level_up' && Number(skill.requiredLevel ?? 0) > state.player.level);
  const eventSkill = skills.find((skill) => skill.acquisitionCode === 'event_granted');
  const equipmentSkill = skills.find((skill) => skill.acquisitionCode === 'equipment_granted');
  const visibleFlag = skills.find((skill) => skill.acquisitionCode === 'flag_unlocked');
  assert.ok(highLevelBasic && eventSkill && equipmentSkill && visibleFlag);

  state.player.visibleSkillIds.add(visibleFlag.id);
  const initiallyLearnable = listPlayerSkillStates(state, battleData, skills).find((entry) => entry.state === 'LEARNABLE');
  assert.ok(initiallyLearnable, 'at least one level-1 SP skill must be learnable with starting SP');
  state.player.skills.add(initiallyLearnable.id);

  const rows = listPlayerSkillStates(state, battleData, skills);
  const observed = new Set(rows.map((entry) => entry.state));
  assert.ok(observed.has('HIDDEN'));
  assert.ok(observed.has('REVEALED_LOCKED'));
  assert.ok(observed.has('LEARNABLE'));
  assert.ok(observed.has('LEARNED'));
  assert.ok(observed.has('EQUIPMENT_ONLY'));
  assert.ok(observed.has('EVENT_ONLY'));
  assert.deepEqual([...PLAYER_SKILL_UI_STATES], ['HIDDEN', 'REVEALED_LOCKED', 'LEARNABLE', 'LEARNED', 'EQUIPMENT_ONLY', 'EVENT_ONLY']);

  const eventRow = rows.find((entry) => entry.id === eventSkill.id);
  const equipmentRow = rows.find((entry) => entry.id === equipmentSkill.id);
  assert.equal(eventRow.state, 'EVENT_ONLY');
  assert.equal(eventRow.learnable, false);
  assert.equal(equipmentRow.state, 'EQUIPMENT_ONLY');
  assert.equal(equipmentRow.learnable, false);
  assert.equal(equipmentRow.active, false, 'equipment-granted skill must not be active while its granting equipment is not equipped');
});
