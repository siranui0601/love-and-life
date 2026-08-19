import assert from 'node:assert/strict';
import test from 'node:test';

import { createPlayerBuild, loadBattleData } from '../lib/battle-model.mjs';
import { auditEquipmentCheckpointC, CHECKPOINT_C_EQUIPMENT_COUNT, CHECKPOINT_C_STOCK_COUNT } from '../lib/player-equipment-checkpoint-c.mjs';

const data = await loadBattleData();

test('Checkpoint C equipment 142 / stock 149 have legal shape and world acquisition', () => {
  const audit = auditEquipmentCheckpointC(data);
  assert.equal(audit.equipmentCount, CHECKPOINT_C_EQUIPMENT_COUNT);
  assert.equal(audit.stockCount, CHECKPOINT_C_STOCK_COUNT);
  assert.deepEqual(audit.invalidEquipment, []);
  assert.deepEqual(audit.inventoryInvalidEquipmentIds, []);
  assert.equal(audit.worldReachableCount, CHECKPOINT_C_EQUIPMENT_COUNT);
  console.log(`PLAYER_EQUIPMENT_C_TEXT_GAPS ${JSON.stringify(audit.unmodeledText)}`);
  assert.deepEqual(audit.unmodeledText, [], 'passive/drawback text without an authoritative runtime representation must be implemented');
});

test('Checkpoint C rejects a two-handed main hand plus any off-hand', () => {
  const twoHand = data.equipment.find((equipment) => equipment.slot === 'mainHand' && equipment.grip === 'twoHand');
  const offHand = data.equipment.find((equipment) => equipment.slot === 'offHand');
  assert.ok(twoHand && offHand);
  assert.throws(() => createPlayerBuild(data, { level: 20, equipmentIds: [twoHand.id, offHand.id], skillIds: [] }), (error) => error?.code === 'TWO_HAND_WITH_OFF_HAND');
});
