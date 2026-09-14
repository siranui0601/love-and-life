import test from 'node:test';
import assert from 'node:assert/strict';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const data = await loadBattleData();

function session() {
  const build = createPlayerBuild(data, {
    id: 'checkpoint-d-encore-rotation',
    level: 20,
    equipmentIds: [],
    skillIds: ['SKL-1140', 'SKL-1139'],
    baseStats: {
      attack: 1,
      defense: 500,
      agility: 80,
      luck: 20,
      physicalPower: 1,
      magicPower: 1,
      maxHp: 10000,
      maxMp: 300,
    },
  });
  return beginInteractiveBattle({
    data,
    monsterIds: ['MON-0077'],
    playerBuild: build,
    seed: 'checkpoint-d:encore-rotation',
  });
}

function skill(commands, id) {
  return commands.find((command) => command.skillId === id);
}

test('Encore is unavailable before a repeatable action and becomes a deliberate payoff after one', () => {
  const initial = session();
  const before = listInteractiveBattleCommands({ data, session: initial });
  const encoreBefore = skill(before, 'SKL-1139');
  const chain = skill(before, 'SKL-1140');

  assert.ok(encoreBefore);
  assert.equal(encoreBefore.available, false);
  assert.equal(encoreBefore.disabledReason, 'missing_history');
  assert.match(encoreBefore.disabledDetail, /直前のスキル履歴/u);
  assert.ok(chain?.available !== false, '連鎖命中 must be a legal repeatable setup action for this witness');

  const target = chain.targets?.find((entry) => entry.side === 'enemy') ?? chain.targets?.[0];
  const first = resolveInteractiveBattleRound({
    data,
    session: initial,
    command: {
      actionId: chain.actionId,
      ...(target ? { targetInstanceId: target.instanceId } : {}),
    },
  });
  assert.equal(first.ok, true);
  assert.equal(first.session.playerRuntimeMechanics.history.lastRepeatable?.skillId, 'SKL-1140');
  assert.equal(first.session.status, 'active', 'the boss witness must survive the setup so Encore remains a real next-turn decision');

  const after = listInteractiveBattleCommands({ data, session: first.session });
  const encoreAfter = skill(after, 'SKL-1139');
  assert.ok(encoreAfter);
  assert.equal(encoreAfter.available, true);

  const encoreTarget = encoreAfter.targets?.find((entry) => entry.side === 'enemy') ?? encoreAfter.targets?.[0];
  const repeated = resolveInteractiveBattleRound({
    data,
    session: first.session,
    command: {
      actionId: encoreAfter.actionId,
      ...(encoreTarget ? { targetInstanceId: encoreTarget.instanceId } : {}),
    },
  });
  assert.equal(repeated.ok, true);
  const encoreFrame = (repeated.round?.frames ?? []).find((frame) =>
    frame?.phase === 'action'
      && frame?.actorSide === 'player'
      && frame?.action?.skillId === 'SKL-1139');
  assert.ok(encoreFrame, 'Encore must execute as the selected production battle action');
  assert.ok((encoreFrame.events ?? []).some((event) =>
    event?.family === 'REPEAT_LAST_SKILL'
      || event?.sourceSkillId === 'SKL-1140'
      || event?.repeatSourceSkillId === 'SKL-1140'),
  'the Encore frame must carry evidence that the prior chain skill was the repeated source');
});
