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

  const monsterParity = production.monsters.map((prod) => {
    const val = validator.monsterById.get(prod.id);
    assert.ok(val, `validator missing ${prod.id}`);
    const fields = {
      id: prod.id,
      maxHp: prod.maxHp,
      physicalPower: prod.physicalPower,
      magicPower: prod.magicPower,
    };
    assert.deepEqual(fields, {
      id: val.id,
      maxHp: val.maxHp,
      physicalPower: val.physicalPower,
      magicPower: val.magicPower,
    }, `${prod.id}: canonical runtime stat mismatch`);
    return fields;
  });
  assert.equal(monsterParity.length, 77);
  console.log(`PRODUCTION_MONSTER_PARITY ${JSON.stringify({ count: monsterParity.length, mismatch: 0 })}`);
});
