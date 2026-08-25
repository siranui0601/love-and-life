import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHECKPOINT_E_PROLOGUE_VERSION,
  buildCheckpointELoanCatalog,
  createCheckpointEPrologueTrpgGameService,
} from '../../../src/server/trpg/game/checkpoint-e-prologue-service.js';
import { loadTrpgGameData } from '../../../src/server/trpg/game/game-data.js';
import { MemoryTrpgSaveStore } from '../../../src/server/trpg/game/save-store.js';
import { deserializeRuntime, serializeRuntime } from '../../../src/server/trpg/game/serializer.js';
import { gameStateHash } from '../../../src/server/trpg/game/service.js';
import { WEATHER_RULESET_VERSION } from '../../../src/server/trpg/resolvers/weather-resolver.js';
import { createPlayerBuild } from '../lib/battle-model.mjs';

const data = loadTrpgGameData();

function service(store = new MemoryTrpgSaveStore()) {
  return createCheckpointEPrologueTrpgGameService({
    data,
    store,
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

function introductionBeat(save) {
  return save.scene.beats.find((beat) => beat.actorId === 'NPC004' && beat.introductionToken);
}

async function acknowledgeEdaIntroduction(svc, owner, save) {
  const beat = introductionBeat(save);
  assert.ok(beat?.introductionToken, 'Eda self-introduction must expose an acknowledgement token');
  return command(svc, owner, save, 'ACK_NPC_INTRODUCTION', { token: beat.introductionToken });
}

async function advanceToLoanCatalog(svc, owner, save) {
  save = await choose(svc, owner, save, 0);
  save = await acknowledgeEdaIntroduction(svc, owner, save);
  save = await choose(svc, owner, save, 0);
  save = await choose(svc, owner, save, 0);
  save = await choose(svc, owner, save, 0);
  save = await choose(svc, owner, save, 0);
  save = await acknowledge(svc, owner, save, 'checkpoint-e-inventory');
  save = await choose(svc, owner, save, 0);
  assert.equal(save.checkpointEPrologue.stage, 'loan_catalog');
  return save;
}

function runtimeFromRecord(record) {
  return deserializeRuntime(record.runtimeSnapshot, data);
}

test('[CHECKPOINT_E_COMMON_PROLOGUE] canonical catalog exposes eight categories, ten legal loadouts and canonical representatives', () => {
  const catalog = buildCheckpointELoanCatalog(data);
  assert.equal(catalog.version, CHECKPOINT_E_PROLOGUE_VERSION);
  assert.equal(catalog.categories.length, 8);
  assert.deepEqual(catalog.categories.map((entry) => entry.key), [
    'oneHandedSword', 'book', 'twoHandedSword', 'axe', 'spear', 'bow', 'staff', 'shield',
  ]);
  assert.equal(catalog.categories.every((entry) => entry.equipmentId && data.battleData.equipmentById.has(entry.equipmentId)), true);
  assert.deepEqual(Object.fromEntries(catalog.categories.map((entry) => [entry.key, entry.equipmentId])), {
    oneHandedSword: 'EQP-W-0001',
    book: 'EQP-W-0010',
    twoHandedSword: 'EQP-W-0013',
    axe: 'EQP-W-0006',
    spear: 'EQP-W-0007',
    bow: 'EQP-W-0008',
    staff: 'EQP-W-0009',
    shield: 'EQP-S-0001',
  });
  assert.deepEqual(catalog.categories.filter((entry) => entry.group === 'rightHand').map((entry) => entry.key), ['oneHandedSword', 'book']);
  assert.deepEqual(catalog.categories.filter((entry) => entry.group === 'twoHand').map((entry) => entry.key), ['twoHandedSword', 'axe', 'spear', 'bow', 'staff']);
  assert.deepEqual(catalog.categories.filter((entry) => entry.group === 'leftHand').map((entry) => entry.key), ['shield']);
  assert.equal(catalog.options.length, 10);
  assert.deepEqual(catalog.options.map((entry) => entry.id), [
    'sword', 'sword-shield', 'book', 'book-shield', 'two-handed-sword', 'axe', 'spear', 'bow', 'staff', 'shield',
  ]);
  assert.equal(catalog.rules.oneLoadoutOnly, true);
  assert.equal(catalog.rules.rightPlusLeftAllowed, true);
  assert.equal(catalog.rules.twoHandPlusLeftAllowed, false);
  assert.equal(catalog.rules.shieldOnlyOffered, true);
  assert.ok(catalog.options.some((entry) => entry.categoryKeys.join('+') === 'oneHandedSword+shield'));
  assert.ok(catalog.options.some((entry) => entry.categoryKeys.join('+') === 'book+shield'));
  assert.ok(catalog.options.some((entry) => entry.categoryKeys.join('+') === 'shield'));
  assert.equal(catalog.options.some((entry) => entry.group === 'twoHand' && entry.categoryKeys.includes('shield')), false);

  const axe = catalog.categories.find((entry) => entry.key === 'axe');
  const shield = catalog.categories.find((entry) => entry.key === 'shield');
  assert.throws(
    () => createPlayerBuild(data.battleData, { level: 1, equipmentIds: [axe.equipmentId, shield.equipmentId] }),
    (error) => error?.code === 'TWO_HAND_WITH_OFF_HAND',
  );
  const shieldOnly = createPlayerBuild(data.battleData, { level: 1, equipmentIds: [shield.equipmentId] });
  assert.equal(shieldOnly.equipmentIds.length, 1);
  assert.equal(shieldOnly.activeWeaponTypes.has('shield'), true);
  assert.ok(Number.isFinite(shieldOnly.physicalPower), 'existing battle model supplies its weaponless baseline; E does not invent a hidden main-hand weapon');
});

test('[CHECKPOINT_E_COMMON_PROLOGUE] NPC004 is unknown until visible self-introduction acknowledgement and remains known after restore', async () => {
  const store = new MemoryTrpgSaveStore();
  const svc = service(store);
  const owner = 'checkpoint-e-identity-owner';
  let save = await svc.create(owner, { playerName: 'E-identity', seed: 'checkpoint-e-identity' });

  const unknown = save.scene.presentNpcs.find((npc) => npc.id === 'NPC004');
  assert.equal(unknown?.name, '見知らぬ女性');
  assert.equal(unknown?.identified, false);
  assert.doesNotMatch(save.scene.narrative, /エダ/u);
  assert.doesNotMatch(save.scene.speeches.map((speech) => `${speech.actorName}:${speech.text}`).join('\n'), /エダ/u);

  save = await choose(svc, owner, save, 0);
  assert.equal(save.checkpointEPrologue.stage, 'village_entry');
  const introduction = introductionBeat(save);
  assert.equal(introduction?.speakerLabel, '見知らぬ女性');
  assert.match(introduction?.text ?? '', /エダ/u);
  assert.equal(save.scene.presentNpcs.find((npc) => npc.id === 'NPC004')?.identified, false);
  assert.deepEqual(save.choices, [], 'choices that use the canonical name wait until the visible introduction is acknowledged');

  save = await acknowledgeEdaIntroduction(svc, owner, save);
  assert.equal(save.scene.presentNpcs.find((npc) => npc.id === 'NPC004')?.name, 'エダ');
  assert.equal(save.scene.presentNpcs.find((npc) => npc.id === 'NPC004')?.identified, true);
  assert.equal(save.choices.length, 3);

  const restarted = service(store);
  const restored = await restarted.get(owner, save.id);
  assert.equal(restored.scene.presentNpcs.find((npc) => npc.id === 'NPC004')?.name, 'エダ');
  assert.equal(restored.scene.presentNpcs.find((npc) => npc.id === 'NPC004')?.identified, true);
  const runtime = runtimeFromRecord(await store.get(save.id));
  assert.equal(runtime.playerKnowledge.knownNpcIds.has('NPC004'), true);
});

test('[CHECKPOINT_E_COMMON_PROLOGUE] new game runs LOC_FARM_EDGE → bread → inventory → loan → equipment/skills → lodging without free movement', async () => {
  const store = new MemoryTrpgSaveStore();
  const svc = service(store);
  const owner = 'checkpoint-e-owner';
  let save = await svc.create(owner, { playerName: 'E-player', seed: 'checkpoint-e-common-prologue' });

  assert.equal(save.scene.location, '田園の村');
  assert.equal(save.scene.facilityId, 'LOC_FARM_EDGE');
  assert.equal(save.checkpointEPrologue.stage, 'edge_contact');
  assert.equal(save.movement.length, 0, 'free destination list is not used during the common prologue');
  assert.equal(save.weather.rulesetVersion, WEATHER_RULESET_VERSION);
  assert.equal(save.checkpointEPrologue.weatherRulesetVersion, 'canonical-weather-almanac-v2');
  assert.ok(save.scene.presentNpcs.some((npc) => npc.id === 'NPC004' && npc.name === '見知らぬ女性'));
  assert.equal(save.choices.length, 3);
  const startingHunger = save.player.needs.hunger;
  assert.ok(startingHunger >= 46);
  assert.equal(save.player.equipment.mainHand, undefined);
  assert.equal(save.player.equipment.offHand, undefined);

  save = await choose(svc, owner, save, 0);
  assert.equal(save.checkpointEPrologue.stage, 'village_entry');
  assert.ok(save.checkpointEPrologue.traces.gratitude > 0);
  save = await acknowledgeEdaIntroduction(svc, owner, save);

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
  assert.equal(save.shop.stock.length, 10);

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

  let rawRuntime = runtimeFromRecord(await store.get(save.id));
  assert.deepEqual(save.checkpointEPrologue.loan.loanIds.map((loanId) => rawRuntime.playerState.player.equipmentAccess.loans[loanId].status), ['active', 'active']);

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

  const restarted = service(store);
  const restored = await restarted.get(owner, save.id);
  assert.equal(restored.checkpointEPrologue.complete, true);
  assert.equal(restored.checkpointEPrologue.loan.loadoutId, 'sword-shield');
  assert.deepEqual(restored.checkpointEPrologue.loan.equipmentIds, [mainEquipmentId, shieldEquipmentId]);
  assert.equal(restored.player.equipment.mainHand.id, mainEquipmentId);
  assert.equal(restored.player.equipment.offHand.id, shieldEquipmentId);
  assert.equal(restored.scene.presentNpcs.find((npc) => npc.id === 'NPC004')?.name, 'エダ');

  rawRuntime = runtimeFromRecord(await store.get(save.id));
  assert.equal(rawRuntime.playerKnowledge.knownNpcIds.has('NPC004'), true);
  assert.deepEqual(restored.checkpointEPrologue.loan.loanIds.map((loanId) => rawRuntime.playerState.player.equipmentAccess.loans[loanId].status), ['active', 'active']);

  const record = await store.get(save.id);
  assert.equal(record.replayBase.revision, save.revision, 'prologue completion becomes an authoritative replay base');
  assert.equal(typeof record.replayBase.runtimeSnapshot, 'string');

  const firstLoanId = restored.checkpointEPrologue.loan.loanIds[0];
  const returned = await command(restarted, owner, restored, 'SHOP_RETURN_LOAN', { loanId: firstLoanId });
  assert.equal(returned.checkpointEPrologue.loan.disposition, 'returned');
  rawRuntime = runtimeFromRecord(await store.get(save.id));
  assert.deepEqual(restored.checkpointEPrologue.loan.loanIds.map((loanId) => rawRuntime.playerState.player.equipmentAccess.loans[loanId].status), ['returned', 'returned']);
  assert.equal(Object.values(rawRuntime.playerState.player.equipment).some((equipmentId) => [mainEquipmentId, shieldEquipmentId].includes(equipmentId)), false);
});

test('[CHECKPOINT_E_COMMON_PROLOGUE] all ten loadouts are actually borrowable, including shield-only, while second/forged loans are rejected', async () => {
  const catalog = buildCheckpointELoanCatalog(data);
  for (const option of catalog.options) {
    const store = new MemoryTrpgSaveStore();
    const svc = service(store);
    const owner = `checkpoint-e-loadout-${option.id}`;
    let save = await svc.create(owner, { playerName: option.label, seed: `checkpoint-e-loadout-${option.id}` });
    save = await advanceToLoanCatalog(svc, owner, save);
    const stock = save.shop.stock.find((entry) => entry.access?.loan?.loanId?.endsWith(option.id));
    assert.ok(stock, `${option.id} must be shown in the production loan UI`);
    save = await command(svc, owner, save, 'SHOP_BORROW', { loanId: stock.access.loan.loanId });
    assert.equal(save.checkpointEPrologue.loan.loadoutId, option.id);
    assert.deepEqual(save.checkpointEPrologue.loan.equipmentIds, option.equipmentIds);
    const runtime = runtimeFromRecord(await store.get(save.id));
    assert.deepEqual(save.checkpointEPrologue.loan.loanIds.map((loanId) => runtime.playerState.player.equipmentAccess.loans[loanId].status), option.equipmentIds.map(() => 'active'));

    if (option.id === 'shield') {
      save = await command(svc, owner, save, 'EQUIP', { equipmentId: option.equipmentIds[0] });
      assert.equal(save.checkpointEPrologue.equipmentReady, true);
      assert.equal(save.player.equipment.mainHand, undefined);
      assert.equal(save.player.equipment.offHand.id, option.equipmentIds[0]);
    }

    await assert.rejects(() => svc.command(owner, save.id, {
      commandId: `checkpoint-e:${save.revision}:second-loan`,
      expectedRevision: save.revision,
      type: 'SHOP_BORROW',
      payload: { loanId: 'EINTRO:LOADOUT:sword' },
    }), (error) => ['tutorial_feature_locked', 'checkpoint_e_loadout_already_borrowed'].includes(error?.code));
  }

  const svc = service();
  const owner = 'checkpoint-e-forged-loan';
  let save = await svc.create(owner, { playerName: 'forged', seed: 'checkpoint-e-forged-loan' });
  save = await advanceToLoanCatalog(svc, owner, save);
  await assert.rejects(() => svc.command(owner, save.id, {
    commandId: 'checkpoint-e-forged-loadout-id',
    expectedRevision: save.revision,
    type: 'SHOP_BORROW',
    payload: { loanId: 'EINTRO:LOADOUT:two-handed-sword-shield' },
  }), (error) => error?.code === 'checkpoint_e_loadout_not_found');
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

test('[CHECKPOINT_E_COMMON_PROLOGUE] loading an existing pre-E save never reinitializes or strips its equipment, inventory or loan state', async () => {
  const store = new MemoryTrpgSaveStore();
  const svc = service(store);
  const owner = 'checkpoint-e-old-save-owner';
  const created = await svc.create(owner, { playerName: 'old-save', seed: 'checkpoint-e-old-save' });
  const record = await store.get(created.id);
  const runtime = runtimeFromRecord(record);

  delete runtime.checkpointEPrologue;
  runtime.playerState.player.location = '王都';
  runtime.playerState.player.facilityId = 'LOC_CAP_WEAPON_SHOP';
  runtime.playerState.player.inventory.equipment['EQP-W-0006'] = 1;
  runtime.playerState.player.equipment.mainHand = 'EQP-W-0006';
  runtime.playerState.player.equipmentAccess.loans['OLD-SAVE-LOAN'] = {
    loanId: 'OLD-SAVE-LOAN',
    equipmentId: 'EQP-S-0001',
    equipmentName: '木蓋の盾',
    sellerFacilityId: 'LOC_FARM_INN',
    deposit: 0,
    status: 'active',
    returnPolicy: 'player_choice',
  };
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = gameStateHash(deserializeRuntime(record.runtimeSnapshot, data), data);
  await store.put(record);

  const restored = await svc.get(owner, created.id);
  assert.equal(restored.checkpointEPrologue, undefined);
  const afterRuntime = runtimeFromRecord(await store.get(created.id));
  assert.equal(afterRuntime.checkpointEPrologue, undefined);
  assert.equal(afterRuntime.playerState.player.location, '王都');
  assert.equal(afterRuntime.playerState.player.facilityId, 'LOC_CAP_WEAPON_SHOP');
  assert.equal(afterRuntime.playerState.player.inventory.equipment['EQP-W-0006'], 1);
  assert.equal(afterRuntime.playerState.player.equipment.mainHand, 'EQP-W-0006');
  assert.equal(afterRuntime.playerState.player.equipmentAccess.loans['OLD-SAVE-LOAN'].status, 'active');
});
