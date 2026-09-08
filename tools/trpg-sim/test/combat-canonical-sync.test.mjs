import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BATTLE_ASSUMPTIONS,
  createMonsterActor,
  loadBattleData,
} from '../lib/battle-model.mjs';

const data = await loadBattleData();

test('revision20 canonical combat catalog is the public runtime source without hidden scaling', () => {
  assert.equal(data.source.revisionId, '20');
  assert.deepEqual({
    equipment: data.equipment.length,
    inventory: data.inventory.length,
    materialBuyback: data.materialBuyback.length,
    monsters: data.monsters.length,
    monsterSkills: data.monsterSkills.length,
    monsterActions: data.monsterActions.length,
    encounters: data.encounters.length,
    playerSkills: data.playerSkills.length,
  }, {
    equipment: 142,
    inventory: 149,
    materialBuyback: 61,
    monsters: 77,
    monsterSkills: 96,
    monsterActions: 286,
    encounters: 76,
    playerSkills: 1141,
  });
  assert.equal(BATTLE_ASSUMPTIONS.monsterHpScale, 1);
  assert.equal(BATTLE_ASSUMPTIONS.monsterOffenceScale, 1);

  for (const monster of data.monsters) {
    const actor = createMonsterActor(monster);
    assert.equal(actor.maxHp, Math.max(1, Math.round(monster.maxHp)), monster.id);
    assert.equal(actor.physicalPower, monster.physicalPower, monster.id);
    assert.equal(actor.magicPower, monster.magicPower, monster.id);
  }
});

test('equipment, shop and material economy catalogs have no duplicate or orphan IDs', () => {
  const unique = (values) => new Set(values).size === values.length;
  assert.equal(unique(data.equipment.map((entry) => entry.id)), true);
  assert.equal(unique(data.inventory.map((entry) => entry.id)), true);
  assert.equal(unique(data.materialBuyback.map((entry) => entry.id)), true);

  const equipmentIds = new Set(data.equipment.map((entry) => entry.id));
  assert.deepEqual(
    data.inventory.filter((entry) => !equipmentIds.has(entry.equipmentId)),
    [],
  );

  const materialIds = new Set(data.materialBuyback.map((entry) => entry.id));
  const dropIds = new Set(data.monsters.flatMap((monster) => (
    monster.drops.map((drop) => drop.itemId).filter((id) => String(id ?? '').startsWith('MAT_'))
  )));
  assert.deepEqual([...dropIds].filter((id) => !materialIds.has(id)).sort(), []);
  assert.deepEqual([...materialIds].filter((id) => !dropIds.has(id)).sort(), []);
});
