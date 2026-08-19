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
      maxHp: 100_000, maxMp: 500, attack: 0, defense: 1_000, agility: 5_000, luck: 50,
      physicalPower: 20, magicPower: 20, magicResistance: 1_000, accuracy: 1_000, evasion: 0,
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

test('Checkpoint C ALLOW_HP_FOR_MP pays missing MP with real HP and leaves a post-battle effect', () => {
  const skill = data.playerSkills.find((entry) => (entry.specialStates ?? []).some((state) => state?.type === 'allowHpForMissingMp'));
  assert.ok(skill, 'canonical ALLOW_HP_FOR_MP witness must exist');
  let session = beginInteractiveBattle({ data, seed: 'checkpoint-c-hp-for-mp', monsterIds: ['MON-0077'], playerBuild: buildFor([skill.id]), maxTurns: 2 });
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

  let mpSession = beginInteractiveBattle({ data, seed: 'checkpoint-c-all-mp', monsterIds: ['MON-0077'], playerBuild: buildFor([mpSkill.id]), maxTurns: 2 });
  mpSession.state.players[0].mp = 77;
  const mpResult = execute(mpSession, mpSkill.id);
  assert.equal(mpResult.session.state.players[0].mp, 0, `${mpSkill.id}: all current MP must actually be spent`);

  let hpSession = beginInteractiveBattle({ data, seed: 'checkpoint-c-hp-sacrifice', monsterIds: ['MON-0077'], playerBuild: buildFor([hpSkill.id]), maxTurns: 2 });
  hpSession.state.players[0].hp = 80_000;
  const hpBefore = hpSession.state.players[0].hp;
  const hpResult = execute(hpSession, hpSkill.id);
  assert.ok(hpResult.session.state.players[0].hp < hpBefore, `${hpSkill.id}: authored HP cost mode must change real HP`);
});

test('Checkpoint C SKL-0516 substitute nullifies the next enemy hit in authoritative state', () => {
  let session = beginInteractiveBattle({ data, seed: 'checkpoint-c-substitute', monsterIds: ['MON-0077'], playerBuild: buildFor(['SKL-0516']), maxTurns: 3 });
  const hpBefore = session.state.players[0].hp;
  const result = execute(session, 'SKL-0516');
  session = result.session;
  const enemyFrame = result.round.frames.find((frame) => frame.actorSide === 'enemy' && (frame.events ?? []).some((event) => event.family === 'SUBSTITUTE'));
  assert.ok(enemyFrame, 'the next enemy hit must be intercepted by the created substitute');
  const event = enemyFrame.events.find((entry) => entry.family === 'SUBSTITUTE');
  assert.ok(event.interceptedDamage > 0);
  assert.equal(session.state.players[0].hp, hpBefore, 'substitute interception restores the exact damage before the round returns');
  assert.equal(session.playerRuntimeMechanics.substitutes.length, 0, 'one-hit substitute must be consumed');
});

test('Checkpoint C SKL-0517 summon owns HP and diverts subsequent enemy damage', () => {
  let session = beginInteractiveBattle({ data, seed: 'checkpoint-c-summon', monsterIds: ['MON-0077'], playerBuild: buildFor(['SKL-0517']), maxTurns: 3 });
  const result = execute(session, 'SKL-0517');
  session = result.session;
  const summonEvent = result.round.frames.flatMap((frame) => frame.events ?? []).find((entry) => entry.family === 'SUMMON' && entry.summon);
  assert.ok(summonEvent?.summon?.maxHp > 0, 'summon must have authoritative battle-local HP');
  const intercept = result.round.frames.flatMap((frame) => frame.events ?? []).find((entry) => entry.family === 'SUMMON' && entry.absorbedDamage > 0);
  assert.ok(intercept, 'summon must absorb a real enemy hit rather than being decorative state');
  assert.ok(intercept.summonHpAfter < summonEvent.summon.maxHp);
});

test('Checkpoint C SKL-0797 changes only battle-local weather and exposes explicit weather commands', () => {
  let session = beginInteractiveBattle({ data, seed: 'checkpoint-c-weather', monsterIds: ['MON-0077'], playerBuild: buildFor(['SKL-0797']), maxTurns: 2 });
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

test('Checkpoint C active counter/reflect states remain real reaction damage, not registry-only flags', () => {
  for (const type of ['counter', 'reflect']) {
    const skill = data.playerSkills.find((entry) => entry.kind === 'active' && (entry.specialStates ?? []).some((state) => state?.type === type));
    assert.ok(skill, `${type}: active canonical witness must exist`);
    let session = beginInteractiveBattle({ data, seed: `checkpoint-c-${type}`, monsterIds: ['MON-0077'], playerBuild: buildFor([skill.id]), maxTurns: 3 });
    const enemyHpBefore = session.state.enemies[0].hp;
    const result = execute(session, skill.id);
    session = result.session;
    assert.ok(session.state.enemies[0].hp < enemyHpBefore, `${skill.id}: ${type} must cause real reaction damage when attacked`);
  }
});
