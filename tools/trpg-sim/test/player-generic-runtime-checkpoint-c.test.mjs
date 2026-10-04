import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import { beginInteractiveBattle, listInteractiveBattleCommands, resolveInteractiveBattleRound } from '../lib/battle-simulator.mjs';

const data = await loadBattleData();

function equipmentFor(skill) {
  const expected = (skill.activationConditions ?? [])
    .filter((entry) => entry?.scope === 'equipment' && entry?.path === 'activeWeaponTypes')
    .flatMap((entry) => Array.isArray(entry.value) ? entry.value : [entry.value])
    .filter(Boolean);
  for (const type of expected) {
    const row = data.equipment.find((equipment) => equipment.weaponType === type && equipment.slot === 'mainHand');
    if (row) return [row.id];
  }
  return ['EQP-W-0073'];
}

function buildFor(skillIds, overrides = {}, equipmentIds = null) {
  const first = data.playerSkillById.get(skillIds[0]);
  return createPlayerBuild(data, {
    id: `checkpoint-c-generic-${skillIds.join('-')}`,
    name: 'Checkpoint C generic',
    level: 50,
    equipmentIds: equipmentIds ?? equipmentFor(first),
    skillIds,
    baseStats: {
      maxHp: 100_000, maxMp: 500, attack: 0, defense: 100, agility: 5_000, luck: 50,
      physicalPower: 20, magicPower: 20, magicResistance: 100, accuracy: 1_000, evasion: 0,
      critical: 0, debuffSuccess: 1_000, debuffResistance: 1_000, ...overrides,
    },
  });
}

function commandFor(session, skillId) {
  return listInteractiveBattleCommands({ data, session }).find((entry) => entry.skillId === skillId);
}

function execute(session, skillId, extra = {}) {
  const command = commandFor(session, skillId);
  assert.ok(command, `${skillId}: command must exist`);
  assert.equal(command.available, true, `${skillId}: ${command.disabledReason ?? 'must be available'}`);
  const result = resolveInteractiveBattleRound({
    data,
    session,
    command: { actionId: command.actionId, targetInstanceId: command.targets?.[0]?.instanceId, ...extra },
  });
  assert.equal(result.ok, true, `${skillId}: resolution must succeed`);
  return result;
}

function deterministicProtectionWitness({ skillId, family }) {
  for (let index = 0; index < 24; index += 1) {
    const seed = `checkpoint-c-${family.toLowerCase()}-${String(index).padStart(2, '0')}`;
    const session = beginInteractiveBattle({ data, seed, monsterIds: ['MON-0001'], playerBuild: buildFor([skillId]), maxTurns: 3 });
    const hpBefore = session.state.players[0].hp;
    const result = execute(session, skillId);
    const enemyFrame = result.round.frames.find((frame) => frame.actorSide === 'enemy' && (frame.events ?? []).some((event) => event.family === family && (event.interceptedDamage > 0 || event.absorbedDamage > 0)));
    if (enemyFrame) return { result, enemyFrame, hpBefore };
  }
  return null;
}

test('Checkpoint C ALLOW_HP_FOR_MP pays missing MP with real HP and leaves a post-battle effect', () => {
  const skill = data.playerSkills.find((entry) => (entry.specialStates ?? []).some((state) => state?.type === 'allowHpForMissingMp'));
  assert.ok(skill, 'canonical ALLOW_HP_FOR_MP witness must exist');
  let session = beginInteractiveBattle({ data, seed: 'checkpoint-c-hp-for-mp', monsterIds: ['MON-0001'], playerBuild: buildFor([skill.id]), maxTurns: 2 });
  const actor = session.state.players[0];
  actor.mp = Math.max(0, Number(skill.costs?.mp ?? 0) - 5);
  const hpBefore = actor.hp;
  const mpBefore = actor.mp;
  const result = execute(session, skill.id);
  session = result.session;
  const frame = result.round.frames.find((entry) => entry.actorSide === 'player' && entry.action?.skillId === skill.id);
  const event = (frame?.events ?? []).find((entry) => entry.family === 'ALLOW_HP_FOR_MP');
  assert.ok(event, `${skill.id}: HP-for-MP bridge must be visible in timeline`);
  assert.equal(event.missingMp, 5);
  assert.equal(event.hpSubstituteCost, 10);
  assert.equal(session.state.players[0].hp <= hpBefore - 10, true);
  assert.equal(session.state.players[0].mp <= mpBefore, true);
  assert.ok(session.playerRuntimeMechanics.postBattleEffects.some((entry) => entry.sourceSkillId === skill.id && entry.type === 'max_mp_stage'));
  assert.equal(Number(session.diagnostics?.counts?.unsupportedPlayerSpecialState ?? 0), 0);
});

test('Checkpoint C all-MP and HP-sacrifice modes mutate authoritative resources', () => {
  const mpSkill = data.playerSkills.find((entry) => entry.kind === 'active' && entry.costs?.mpMode === 'all_current');
  const hpSkill = data.playerSkills.find((entry) => entry.kind === 'active' && entry.costs?.hpMode && entry.costs.hpMode !== 'fixed');
  assert.ok(mpSkill && hpSkill);
  let mpSession = beginInteractiveBattle({ data, seed: 'checkpoint-c-all-mp', monsterIds: ['MON-0001'], playerBuild: buildFor([mpSkill.id]), maxTurns: 2 });
  mpSession.state.players[0].mp = 77;
  const mpResult = execute(mpSession, mpSkill.id);
  assert.equal(mpResult.session.state.players[0].mp, 0, `${mpSkill.id}: all current MP must actually be spent`);
  let hpSession = beginInteractiveBattle({ data, seed: 'checkpoint-c-hp-sacrifice', monsterIds: ['MON-0001'], playerBuild: buildFor([hpSkill.id]), maxTurns: 2 });
  hpSession.state.players[0].hp = 80_000;
  const hpBefore = hpSession.state.players[0].hp;
  const hpResult = execute(hpSession, hpSkill.id);
  assert.ok(hpResult.session.state.players[0].hp < hpBefore, `${hpSkill.id}: authored HP cost mode must change real HP`);
});

test('Checkpoint C SKL-0516 substitute nullifies a deterministic next enemy hit in authoritative state', () => {
  const witness = deterministicProtectionWitness({ skillId: 'SKL-0516', family: 'SUBSTITUTE' });
  assert.ok(witness, 'fixed seed set must contain a damaging enemy action after SKL-0516');
  const event = witness.enemyFrame.events.find((entry) => entry.family === 'SUBSTITUTE');
  assert.ok(event.interceptedDamage > 0);
  assert.equal(witness.result.session.state.players[0].hp, witness.hpBefore, 'substitute interception restores the exact incoming HP loss');
  assert.equal(witness.result.session.playerRuntimeMechanics.substitutes.length, 0, 'one-hit substitute must be consumed');
});

test('Checkpoint C SKL-0517 summon owns HP and diverts deterministic subsequent enemy damage', () => {
  const witness = deterministicProtectionWitness({ skillId: 'SKL-0517', family: 'SUMMON' });
  assert.ok(witness, 'fixed seed set must contain a damaging enemy action after SKL-0517');
  const summonEvent = witness.result.round.frames.flatMap((frame) => frame.events ?? []).find((entry) => entry.family === 'SUMMON' && entry.summon);
  assert.ok(summonEvent?.summon?.maxHp > 0, 'summon must have authoritative battle-local HP');
  const intercept = witness.enemyFrame.events.find((entry) => entry.family === 'SUMMON' && entry.absorbedDamage > 0);
  assert.ok(intercept);
  assert.ok(intercept.summonHpAfter < summonEvent.summon.maxHp);
});

test('Checkpoint C SKL-0797 changes only battle-local weather and exposes explicit weather commands', () => {
  let session = beginInteractiveBattle({ data, seed: 'checkpoint-c-weather', monsterIds: ['MON-0001'], playerBuild: buildFor(['SKL-0797']), maxTurns: 2 });
  const variants = listInteractiveBattleCommands({ data, session }).filter((entry) => entry.skillId === 'SKL-0797');
  assert.ok(variants.length >= 2);
  const rain = variants.find((entry) => entry.battleWeather === 'rain') ?? variants[0];
  assert.ok(rain.actionId.includes(':WEATHER:'));
  const result = resolveInteractiveBattleRound({ data, session, command: { actionId: rain.actionId } });
  assert.equal(result.ok, true);
  session = result.session;
  assert.equal(session.playerRuntimeMechanics.weather.type, rain.battleWeather);
  assert.equal(session.playerRuntimeMechanics.weather.battleLocalOnly, true);
  assert.equal(session.playerRuntimeMechanics.weather.worldWeatherMutation, false);
  const event = result.round.frames.flatMap((frame) => frame.events ?? []).find((entry) => entry.family === 'COMBAT_LOCAL_WEATHER' && entry.weather);
  assert.ok(event);
});

test('Checkpoint C reaction/passive counter and reflect families preload real reaction states and deal damage', () => {
  for (const [family, type] of [['COUNTER', 'counter'], ['REFLECT', 'reflect']]) {
    const skill = data.playerSkills.find((entry) => ['reaction', 'passive'].includes(entry.kind) && (entry.runtimeMechanics ?? []).some((mechanic) => mechanic.family === family));
    assert.ok(skill, `${family}: canonical reaction/passive witness must exist`);
    let witness = null;
    for (let index = 0; index < 24; index += 1) {
      const session = beginInteractiveBattle({ data, seed: `checkpoint-c-${type}-${String(index).padStart(2, '0')}`, monsterIds: ['MON-0001'], playerBuild: buildFor([skill.id, 'SKL-0001']), maxTurns: 2 });
      assert.ok(session.state.players[0].specialStates.has(type), `${skill.id}: ${type} must be active at battle start`);
      const enemyHpBefore = session.state.enemies[0].hp;
      const result = resolveInteractiveBattleRound({ data, session, command: { actionId: 'DEFEND' } });
      if (result.ok && result.session.state.enemies[0].hp < enemyHpBefore) { witness = { skill, result, enemyHpBefore }; break; }
    }
    assert.ok(witness, `${skill.id}: fixed seed set must demonstrate real ${type} reaction damage`);
    assert.ok(witness.result.session.state.enemies[0].hp < witness.enemyHpBefore);
  }
});
