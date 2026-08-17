import assert from 'node:assert/strict';
import test from 'node:test';

import { loadTrpgGameData, resetTrpgGameDataForTests } from '../../../src/server/trpg/game/game-data.js';
import { loadBattleData } from '../lib/battle-model.mjs';

function ids(rows) {
  return rows.map((row) => row.id).sort();
}

const collections = [
  ['monsters', 'monsters'],
  ['monsterSkills', 'monsterSkills'],
  ['monsterActions', 'monsterActions'],
  ['encounters', 'encounters'],
  ['equipment', 'equipment'],
  ['inventory', 'inventory'],
  ['materialBuyback', 'materialBuyback'],
];

const expectedCounts = {
  monsters: 77,
  monsterSkills: 96,
  monsterActions: 286,
  encounters: 76,
  equipment: 142,
  inventory: 149,
  materialBuyback: 61,
};

const samples = {
  'MON-0001': { maxHp: 15, physicalPower: 16.8, magicPower: 9.8 },
  'MON-0017': { maxHp: 2200, physicalPower: 89.6, magicPower: 63 },
  'MON-0018': { maxHp: 2850, physicalPower: 100, magicPower: 72 },
  'MON-0028': { maxHp: 2250, physicalPower: 92, magicPower: 82 },
  'MON-0063': { maxHp: 2400, physicalPower: 88, magicPower: 62 },
  'MON-0064': { maxHp: 2850, physicalPower: 100, magicPower: 72 },
  'MON-0077': { maxHp: 2550, physicalPower: 108, magicPower: 96 },
};

test('production and validator build battle content from the same canonical artifact', async () => {
  resetTrpgGameDataForTests();
  const production = loadTrpgGameData().battleData;
  const validator = await loadBattleData();

  for (const [productionKey, validatorKey] of collections) {
    assert.equal(production[productionKey].length, expectedCounts[productionKey]);
    assert.equal(validator[validatorKey].length, expectedCounts[productionKey]);
    assert.deepEqual(ids(production[productionKey]), ids(validator[validatorKey]), `${productionKey} ID set mismatch`);
    assert.deepEqual(production[productionKey], validator[validatorKey], `${productionKey} canonical field mismatch`);
  }

  assert.equal(production.source.artifactPath, 'docs/trpg/combat-sheet-revision20-snapshot.json');
  assert.equal(validator.source.artifactPath, production.source.artifactPath);
  assert.equal(production.source.aggregateSha256, validator.source.aggregateSha256);

  for (const [monsterId, expected] of Object.entries(samples)) {
    const prod = production.monsterById.get(monsterId);
    const val = validator.monsterById.get(monsterId);
    assert.ok(prod, `production missing ${monsterId}`);
    assert.ok(val, `validator missing ${monsterId}`);
    for (const [field, value] of Object.entries(expected)) {
      assert.equal(prod[field], value, `${monsterId}.${field} production`);
      assert.equal(val[field], value, `${monsterId}.${field} validator`);
    }
  }
});
