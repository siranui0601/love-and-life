import test from 'node:test';
import assert from 'node:assert/strict';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from '../lib/battle-simulator.mjs';

const data = await loadBattleData();

function goldBurnSession(gold = 1000) {
  const build = createPlayerBuild(data, {
    id: 'checkpoint-d-gold-burn',
    level: 20,
    equipmentIds: [],
    skillIds: ['SKL-1141'],
    baseStats: {
      attack: 80,
      defense: 500,
      agility: 80,
      luck: 20,
      physicalPower: 80,
      magicPower: 80,
      maxHp: 10000,
      maxMp: 200,
    },
  });
  build.gold = gold;
  return beginInteractiveBattle({
    data,
    monsterIds: ['MON-0077'],
    playerBuild: build,
    seed: 'checkpoint-d:gold-burn',
  });
}

function burnCommands(session) {
  return listInteractiveBattleCommands({ data, session })
    .filter((command) => command.skillId === 'SKL-1141' && command.available !== false)
    .sort((left, right) => Number(left.goldCost ?? 0) - Number(right.goldCost ?? 0));
}

test('Gold burn exposes a real player choice between preserving money and buying combat power', () => {
  const session = goldBurnSession(1000);
  const commands = burnCommands(session);
  const byCost = new Map(commands.map((command) => [Number(command.goldCost), command]));

  for (const cost of [1, 25, 100, 250, 500, 1000]) {
    assert.ok(byCost.has(cost), `${cost}G spend must be offered as a production command choice`);
  }

  const one = byCost.get(1);
  const twentyFive = byCost.get(25);
  const twoFifty = byCost.get(250);
  const thousand = byCost.get(1000);
  assert.ok(one.damageMultiplier < twentyFive.damageMultiplier);
  assert.ok(twentyFive.damageMultiplier < twoFifty.damageMultiplier);
  assert.ok(twoFifty.damageMultiplier < thousand.damageMultiplier);
  assert.ok(thousand.damageMultiplier <= 2.8, 'canonical diminishing-return cap must remain intact');

  // The choice is not a hidden simulator parameter: amount and cost are part
  // of the same command list that the production Game View receives.
  assert.match(one.name, /1G/u);
  assert.match(twoFifty.name, /250G/u);
  assert.equal(twoFifty.goldBefore, 1000);
});

test('executing Gold burn pays the selected world-relevant resource rather than granting free damage', () => {
  const session = goldBurnSession(1000);
  const command = burnCommands(session).find((entry) => Number(entry.goldCost) === 250);
  assert.ok(command);

  const output = resolveInteractiveBattleRound({ data, session, command });
  assert.equal(output.ok, true);
  assert.equal(output.session.playerRuntimeMechanics.gold, 750);
  assert.ok(output.session.playerRuntimeMechanics.events.some((entry) =>
    entry?.type === 'gold_spent' || entry?.skillId === 'SKL-1141'));

  const playerFrame = (output.round?.frames ?? []).find((frame) =>
    frame?.phase === 'action'
      && frame?.actorSide === 'player'
      && frame?.action?.skillId === 'SKL-1141');
  assert.ok(playerFrame, 'the selected Gold burn must execute in the production battle timeline');
});

test('Gold burn becomes unavailable with an actionable reason when there is no Gold to trade', () => {
  const session = goldBurnSession(0);
  const command = listInteractiveBattleCommands({ data, session })
    .find((entry) => entry.skillId === 'SKL-1141');
  assert.ok(command);
  assert.equal(command.available, false);
  assert.equal(command.disabledReason, 'insufficient_gold');
  assert.match(command.disabledDetail, /Goldが足りない/u);
});
