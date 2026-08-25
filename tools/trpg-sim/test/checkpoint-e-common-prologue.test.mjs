import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHECKPOINT_E_PROLOGUE_VERSION,
  buildCheckpointELoanCatalog,
  createCheckpointEPrologueTrpgGameService,
} from '../../../src/server/trpg/game/checkpoint-e-prologue-service.js';
import { loadTrpgGameData } from '../../../src/server/trpg/game/game-data.js';
import { MemoryTrpgSaveStore } from '../../../src/server/trpg/game/save-store.js';
import { WEATHER_RULESET_VERSION } from '../../../src/server/trpg/resolvers/weather-resolver.js';

const data = loadTrpgGameData();

function service() {
  return createCheckpointEPrologueTrpgGameService({
    data,
    store: new MemoryTrpgSaveStore(),
    allowCustomSeed: true,
  });
}

async function choose(svc, owner, save, index = 0) {
  const choice = save.choices[index];
  assert.ok(choice, `choice ${index} at stage ${save.checkpointEPrologue?.stage}`);
  const output = await svc.command(owner, save.id, {
    commandId: `checkpoint-e:${save.revision}:choice:${index}`,
    expectedRevision: save.revision,
    type: 'CHOOSE',
    payload: { choiceId: choice.choiceId, actionId: choice.actionId },
  });
  return output.save;
}

async function acknowledge(svc, owner, save, tutorialId) {
  const output = await svc.command(owner, save.id, {
    commandId: `checkpoint-e:${save.revision}:ack:${tutorialId}`,
    expectedRevision: save.revision,
    type: 'TUTORIAL_ACK',
    payload: { tutorialId },
  });
  return output.save;
}

async function command(svc, owner, save, type, payload) {
  const output = await svc.command(owner, save.id, {
    commandId: `checkpoint-e:${save.revision}:${type}:${JSON.stringify(payload)}`,
    expectedRevision: save.revision,
    type,
    payload,
  });
  return output.save;
}

test('[CHECKPOINT_E_COMMON_PROLOGUE] canonical catalog exposes all eight weapon/equipment systems and only legal loadouts', () => {
  const catalog = buildCheckpointELoanCatalog(data);
  assert.equal(catalog.version, CHECKPOINT_E_PROLOGUE_VERSION);
  assert.equal(catalog.categories.length, 8);
  assert.deepEqual(catalog.categories.map((entry) => entry.key), [
    'oneHandedSword', 'book', 'twoHandedSword', 'axe', 'spear', 'bow', 'staff', 'shield',
  ]);
  assert.equal(catalog.categories.every((entry) => entry.equipmentId && data.battleData.equipmentById.has(entry.equipmentId)), true);
  assert.deepEqual(catalog.categories.filter((entry) => entry.group === 'rightHand').map((entry) => entry.key), ['oneHandedSword', 'book']);
  assert.deepEqual(catalog.categories.filter((entry) => entry.group === 'twoHand').map((entry) => entry.key), ['twoHandedSword', 'axe', 'spear', 'bow', 'staff']);
  assert.deepEqual(catalog.categories.filter((entry) => entry.group === 'leftHand').map((entry) => entry.key), ['shield']);
  assert.equal(catalog.rules.oneLoadoutOnly, true);
  assert.equal(catalog.rules.rightPlusLeftAllowed, true);
  assert.equal(catalog.rules.twoHandPlusLeftAllowed, false);
  assert.equal(catalog.rules.shieldOnlyOffered, false);
  assert.ok(catalog.options.some((entry) => entry.categoryKeys.join('+') === 'oneHandedSword+shield'));
  assert.ok(catalog.options.some((entry) => entry.categoryKeys.join('+') === 'book+shield'));
  assert.equal(catalog.options.some((entry) => entry.group === 'twoHand' && entry.categoryKeys.includes('shield')), false);
});

test('[CHECKPOINT_E_COMMON_PROLOGUE] new game runs LOC_FARM_EDGE → Eda → bread → inventory → loan → equipment/skills → lodging without free movement', async () => {
  const svc = service();
  const owner = 'checkpoint-e-owner';
  let save = await svc.create(owner, { playerName: 'E-player', seed: 'checkpoint-e-common-prologue' });

  assert.equal(save.scene.location, '田園の村');
  assert.equal(save.scene.facilityId, 'LOC_FARM_EDGE');
  assert.equal(save.checkpointEPrologue.stage, 'edge_contact');
  assert.equal(save.movement.length, 0, 'free destination list is not used during the common prologue');
  assert.equal(save.weather.rulesetVersion, WEATHER_RULESET_VERSION);
  assert.equal(save.checkpointEPrologue.weatherRulesetVersion, 'canonical-weather-almanac-v2');
  assert.ok(save.scene.presentNpcs.some((npc) => npc.id === 'NPC004' && npc.name === 'エダ'));
  assert.equal(save.choices.length, 3);
  const startingHunger = save.player.needs.hunger;
  assert.ok(startingHunger >= 46);
  assert.equal(save.player.equipment.mainHand, undefined);
  assert.equal(save.player.equipment.offHand, undefined);

  save = await choose(svc, owner, save, 0);
  assert.equal(save.checkpointEPrologue.stage, 'village_entry');
  assert.ok(save.checkpointEPrologue.traces.gratitude > 0);

  save = await choose(svc, owner, save, 1);
  assert.equal(save.checkpointEPrologue.stage, 'hunger_offer');
  assert.equal(save.scene.facilityId, 'LOC_FARM_INN');
  assert.equal(save.movement.length, 0);
  assert.ok(save.checkpointEPrologue.traces.formalRecordInterest > 0);

  save = await choose(svc, owner, save, 2);
  assert.equal(save.checkpointEPrologue.stage, 'bread_eat');
  assert.equal(save.checkpointEPrologue.bread.received, true);
  assert.ok(save.player.inventory.items.some((item) => item.id === 'ITM008' && item.name === '黒パン'));

  save = await choose(svc, owner, save, 0);
  assert.equal(save.checkpointEPrologue.stage, 'inventory_prompt');
  assert.equal(save.checkpointEPrologue.bread.eaten, true);
  assert.equal(save.player.inventory.items.some((item) => item.id === 'ITM008'), false);
  assert.ok(save.player.needs.hunger < startingHunger, 'production consumeMeal reduces hunger');

  save = await choose(svc, owner, save, 0);
  assert.equal(save.checkpointEPrologue.stage, 'inventory_ui');
  assert.equal(save.tutorial.actionPanel, 'inventory');
  assert.equal(save.tutorial.acknowledgeable, true);

  save = await acknowledge(svc, owner, save, 'checkpoint-e-inventory');
  assert.equal(save.checkpointEPrologue.inventoryInspected, true);
  assert.equal(save.checkpointEPrologue.stage, 'loan_offer');

  save = await choose(svc, owner, save, 1);
  assert.equal(save.checkpointEPrologue.stage, 'loan_catalog');
  assert.equal(save.tutorial.actionPanel, 'shop');
  assert.equal(save.shop.prologueLoanCatalog.active, true);
  assert.equal(save.shop.prologueLoanCatalog.categories.length, 8);
  assert.equal(save.shop.stock.length, 9);

  const swordShield = save.shop.stock.find((entry) => entry.access?.loan?.loanId?.endsWith('sword-shield'));
  assert.ok(swordShield);
  save = await command(svc, owner, save, 'SHOP_BORROW', { loanId: swordShield.access.loan.loanId });
  assert.equal(save.checkpointEPrologue.stage, 'equipment_ui');
  assert.equal(save.checkpointEPrologue.loan.loadoutId, 'sword-shield');
  assert.equal(save.checkpointEPrologue.loan.equipmentIds.length, 2);
  assert.equal(save.player.inventory.equipment.filter((item) => item.borrowed).length >= 2, true);

  const [mainEquipmentId, shieldEquipmentId] = save.checkpointEPrologue.loan.equipmentIds;
  save = await command(svc, owner, save, 'EQUIP', { equipmentId: mainEquipmentId });
  assert.equal(save.checkpointEPrologue.equipmentReady, false);
  save = await command(svc, owner, save, 'EQUIP', { equipmentId: shieldEquipmentId });
  assert.equal(save.checkpointEPrologue.equipmentReady, true);
  assert.equal(save.tutorial.actionPanel, 'skills');
  assert.equal(save.tutorial.acknowledgeable, true);
  assert.equal(save.player.equipment.mainHand.id, mainEquipmentId);
  assert.equal(save.player.equipment.offHand.id, shieldEquipmentId);

  save = await acknowledge(svc, owner, save, 'checkpoint-e-skills');
  assert.equal(save.checkpointEPrologue.skillPanelInspected, true);
  assert.equal(save.checkpointEPrologue.stage, 'fatigue_intro');

  save = await choose(svc, owner, save, 0);
  assert.equal(save.checkpointEPrologue.stage, 'lodging_choice');
  assert.equal(save.choices.length, 3);
  assert.match(save.choices[0].label, /麦穂亭.*休/u);

  save = await choose(svc, owner, save, 0);
  assert.equal(save.checkpointEPrologue.complete, true);
  assert.equal(save.checkpointEPrologue.stage, 'free');
  assert.equal(save.player.needs.fatigue, 0);
  assert.equal(save.checkpointEPrologue.loan.disposition, 'borrowed_after_lodging');
  assert.ok(save.choices.length >= 1, 'normal choices resume after the common prologue');

  const restored = await svc.get(owner, save.id);
  assert.equal(restored.checkpointEPrologue.complete, true);
  assert.equal(restored.checkpointEPrologue.loan.loadoutId, 'sword-shield');
  assert.deepEqual(restored.checkpointEPrologue.loan.equipmentIds, [mainEquipmentId, shieldEquipmentId]);
  assert.equal(restored.player.equipment.mainHand.id, mainEquipmentId);
  assert.equal(restored.player.equipment.offHand.id, shieldEquipmentId);

  const record = await svc.store.get(save.id);
  assert.equal(record.replayBase.revision, save.revision, 'prologue completion becomes an authoritative replay base');
  assert.equal(typeof record.replayBase.runtimeSnapshot, 'string');
});

test('[CHECKPOINT_E_COMMON_PROLOGUE] free MOVE and unrelated systems cannot bypass the common prologue', async () => {
  const svc = service();
  const owner = 'checkpoint-e-lock-owner';
  const save = await svc.create(owner, { playerName: 'E-lock', seed: 'checkpoint-e-lock' });
  await assert.rejects(() => svc.command(owner, save.id, {
    commandId: 'checkpoint-e-forged-move',
    expectedRevision: save.revision,
    type: 'MOVE',
    payload: { moveId: 'MOVE_LOCAL:LOC_FARM_SQUARE' },
  }), (error) => error?.code === 'tutorial_feature_locked');
  const after = await svc.get(owner, save.id);
  assert.equal(after.scene.facilityId, 'LOC_FARM_EDGE');
  assert.equal(after.checkpointEPrologue.stage, 'edge_contact');
});
