import assert from "node:assert/strict";
import test from "node:test";

import { autoShop, createShopRuntime } from "../lib/shop-runtime.mjs";

function equipment(id, slot, options = {}) {
  return {
    id,
    slot,
    weaponType: options.weaponType ?? null,
    grip: options.grip ?? null,
    armorClass: options.armorClass ?? null,
    performanceIndex: options.performanceIndex ?? 10,
  };
}

function stock(id, equipmentId, price = 10) {
  return {
    id,
    equipmentId,
    location: "TEST_REGION",
    sellerId: "TEST_SHOP",
    stock: "多",
    basePrice: price,
    regionCoefficient: 1,
    initiallySold: true,
    unlockCondition: "",
    priceCondition: "",
  };
}

function state({ gold = 100, equipment: equipped = {}, owned = {} } = {}) {
  return {
    seed: "shop-hand-legality",
    day: 1,
    absoluteMinute: 0,
    troubles: {},
    worldFlags: {},
    player: {
      location: "TEST_REGION",
      facilityId: "TEST_SHOP",
      gold,
      equipment: { ...equipped },
      inventory: { equipment: { ...owned } },
      evidenceByTrouble: {},
      reputation: {},
      magicSkillCount: 0,
    },
    progress: {
      combat: { killsByName: {} },
      investigation: { appraisals: 0 },
      economy: { goldSpent: 0, maxSinglePurchase: 0, orphanageDonations: 0 },
    },
    history: [],
  };
}

function battleData(equipmentList, inventory) {
  return {
    equipmentById: new Map(equipmentList.map((entry) => [entry.id, entry])),
    inventory,
  };
}

function runTransition({ current = [], equipped = {}, offered = [], weaponTypes = [] }) {
  const allEquipment = [...current, ...offered.map((entry) => entry.equipment)];
  const inventory = offered.map((entry, index) => stock(`STOCK-${index}`, entry.equipment.id, entry.price ?? 10));
  const owned = Object.fromEntries(current.map((entry) => [entry.id, 1]));
  const data = battleData(allEquipment, inventory);
  const playerState = state({ equipment: equipped, owned });
  const runtime = createShopRuntime(data);
  const purchases = autoShop(playerState, data, runtime, { weaponTypes });
  return { playerState, purchases };
}

test("autoShop supports empty -> oneHand", () => {
  const sword = equipment("W-SWORD", "mainHand", { weaponType: "sword", grip: "oneHand", performanceIndex: 20 });
  const { playerState } = runTransition({ offered: [{ equipment: sword }], weaponTypes: ["sword"] });
  assert.equal(playerState.player.equipment.mainHand, sword.id);
  assert.equal(playerState.player.equipment.offHand ?? null, null);
});

test("autoShop supports empty -> twoHand", () => {
  const bow = equipment("W-BOW", "mainHand", { weaponType: "bow", grip: "twoHand", performanceIndex: 20 });
  const { playerState } = runTransition({ offered: [{ equipment: bow }], weaponTypes: ["bow"] });
  assert.equal(playerState.player.equipment.mainHand, bow.id);
  assert.equal(playerState.player.equipment.offHand ?? null, null);
});

test("autoShop supports empty -> shield-only", () => {
  const shield = equipment("S-SHIELD", "offHand", { armorClass: "shield", grip: "oneHand", performanceIndex: 10 });
  const { playerState } = runTransition({ offered: [{ equipment: shield }] });
  assert.equal(playerState.player.equipment.mainHand ?? null, null);
  assert.equal(playerState.player.equipment.offHand, shield.id);
});

test("autoShop supports oneHand -> stronger oneHand", () => {
  const oldSword = equipment("W-SWORD-OLD", "mainHand", { weaponType: "sword", grip: "oneHand", performanceIndex: 10 });
  const newSword = equipment("W-SWORD-NEW", "mainHand", { weaponType: "sword", grip: "oneHand", performanceIndex: 20 });
  const { playerState } = runTransition({
    current: [oldSword],
    equipped: { mainHand: oldSword.id },
    offered: [{ equipment: newSword }],
    weaponTypes: ["sword"],
  });
  assert.equal(playerState.player.equipment.mainHand, newSword.id);
});

test("autoShop supports oneHand -> twoHand", () => {
  const sword = equipment("W-SWORD", "mainHand", { weaponType: "sword", grip: "oneHand", performanceIndex: 10 });
  const bow = equipment("W-BOW", "mainHand", { weaponType: "bow", grip: "twoHand", performanceIndex: 20 });
  const { playerState } = runTransition({
    current: [sword],
    equipped: { mainHand: sword.id },
    offered: [{ equipment: bow }],
    weaponTypes: ["sword", "bow"],
  });
  assert.equal(playerState.player.equipment.mainHand, bow.id);
  assert.equal(playerState.player.equipment.offHand ?? null, null);
});

test("autoShop supports oneHand -> oneHand+shield", () => {
  const sword = equipment("W-SWORD", "mainHand", { weaponType: "sword", grip: "oneHand", performanceIndex: 20 });
  const shield = equipment("S-SHIELD", "offHand", { armorClass: "shield", grip: "oneHand", performanceIndex: 10 });
  const { playerState } = runTransition({
    current: [sword],
    equipped: { mainHand: sword.id },
    offered: [{ equipment: shield }],
    weaponTypes: ["sword"],
  });
  assert.equal(playerState.player.equipment.mainHand, sword.id);
  assert.equal(playerState.player.equipment.offHand, shield.id);
});

test("autoShop supports oneHand+shield -> stronger oneHand+shield", () => {
  const oldSword = equipment("W-SWORD-OLD", "mainHand", { weaponType: "sword", grip: "oneHand", performanceIndex: 10 });
  const newSword = equipment("W-SWORD-NEW", "mainHand", { weaponType: "sword", grip: "oneHand", performanceIndex: 20 });
  const shield = equipment("S-SHIELD", "offHand", { armorClass: "shield", grip: "oneHand", performanceIndex: 10 });
  const { playerState } = runTransition({
    current: [oldSword, shield],
    equipped: { mainHand: oldSword.id, offHand: shield.id },
    offered: [{ equipment: newSword }],
    weaponTypes: ["sword"],
  });
  assert.equal(playerState.player.equipment.mainHand, newSword.id);
  assert.equal(playerState.player.equipment.offHand, shield.id);
});

test("autoShop supports oneHand+shield -> twoHand by unequipping the shield", () => {
  const sword = equipment("W-SWORD", "mainHand", { weaponType: "sword", grip: "oneHand", performanceIndex: 10 });
  const shield = equipment("S-SHIELD", "offHand", { armorClass: "shield", grip: "oneHand", performanceIndex: 10 });
  const bow = equipment("W-BOW", "mainHand", { weaponType: "bow", grip: "twoHand", performanceIndex: 20 });
  const { playerState, purchases } = runTransition({
    current: [sword, shield],
    equipped: { mainHand: sword.id, offHand: shield.id },
    offered: [{ equipment: bow }],
    weaponTypes: ["sword", "bow"],
  });
  assert.equal(playerState.player.equipment.mainHand, bow.id);
  assert.equal(playerState.player.equipment.offHand ?? null, null);
  assert.equal(playerState.player.inventory.equipment[shield.id], 1);
  assert.deepEqual(purchases.map((entry) => entry.equipmentId), [bow.id]);
});

test("autoShop supports twoHand -> stronger twoHand", () => {
  const oldBow = equipment("W-BOW-OLD", "mainHand", { weaponType: "bow", grip: "twoHand", performanceIndex: 10 });
  const newBow = equipment("W-BOW-NEW", "mainHand", { weaponType: "bow", grip: "twoHand", performanceIndex: 20 });
  const { playerState } = runTransition({
    current: [oldBow],
    equipped: { mainHand: oldBow.id },
    offered: [{ equipment: newBow }],
    weaponTypes: ["bow"],
  });
  assert.equal(playerState.player.equipment.mainHand, newBow.id);
  assert.equal(playerState.player.equipment.offHand ?? null, null);
});

test("autoShop supports twoHand -> oneHand", () => {
  const bow = equipment("W-BOW", "mainHand", { weaponType: "bow", grip: "twoHand", performanceIndex: 10 });
  const sword = equipment("W-SWORD", "mainHand", { weaponType: "sword", grip: "oneHand", performanceIndex: 20 });
  const { playerState } = runTransition({
    current: [bow],
    equipped: { mainHand: bow.id },
    offered: [{ equipment: sword }],
    weaponTypes: ["bow", "sword"],
  });
  assert.equal(playerState.player.equipment.mainHand, sword.id);
  assert.equal(playerState.player.equipment.offHand ?? null, null);
});

test("autoShop supports twoHand -> oneHand+shield", () => {
  const bow = equipment("W-BOW", "mainHand", { weaponType: "bow", grip: "twoHand", performanceIndex: 10 });
  const sword = equipment("W-SWORD", "mainHand", { weaponType: "sword", grip: "oneHand", performanceIndex: 20 });
  const shield = equipment("S-SHIELD", "offHand", { armorClass: "shield", grip: "oneHand", performanceIndex: 10 });
  const { playerState, purchases } = runTransition({
    current: [bow],
    equipped: { mainHand: bow.id },
    offered: [{ equipment: sword }, { equipment: shield }],
    weaponTypes: ["bow", "sword"],
  });
  assert.equal(playerState.player.equipment.mainHand, sword.id);
  assert.equal(playerState.player.equipment.offHand, shield.id);
  assert.deepEqual(purchases.map((entry) => entry.equipmentId), [sword.id, shield.id]);
});

test("autoShop supports shield-only -> oneHand+shield", () => {
  const shield = equipment("S-SHIELD", "offHand", { armorClass: "shield", grip: "oneHand", performanceIndex: 10 });
  const sword = equipment("W-SWORD", "mainHand", { weaponType: "sword", grip: "oneHand", performanceIndex: 20 });
  const { playerState } = runTransition({
    current: [shield],
    equipped: { offHand: shield.id },
    offered: [{ equipment: sword }],
    weaponTypes: ["sword"],
  });
  assert.equal(playerState.player.equipment.mainHand, sword.id);
  assert.equal(playerState.player.equipment.offHand, shield.id);
});

test("autoShop supports shield-only -> twoHand by unequipping the shield", () => {
  const shield = equipment("S-SHIELD", "offHand", { armorClass: "shield", grip: "oneHand", performanceIndex: 10 });
  const bow = equipment("W-BOW", "mainHand", { weaponType: "bow", grip: "twoHand", performanceIndex: 20 });
  const { playerState } = runTransition({
    current: [shield],
    equipped: { offHand: shield.id },
    offered: [{ equipment: bow }],
    weaponTypes: ["bow"],
  });
  assert.equal(playerState.player.equipment.mainHand, bow.id);
  assert.equal(playerState.player.equipment.offHand ?? null, null);
  assert.equal(playerState.player.inventory.equipment[shield.id], 1);
});

test("autoShop never creates the forbidden twoHand+offHand state", () => {
  const bow = equipment("W-BOW", "mainHand", { weaponType: "bow", grip: "twoHand", performanceIndex: 20 });
  const shield = equipment("S-SHIELD", "offHand", { armorClass: "shield", grip: "oneHand", performanceIndex: 20 });
  const { playerState, purchases } = runTransition({
    current: [bow],
    equipped: { mainHand: bow.id },
    offered: [{ equipment: shield }],
    weaponTypes: ["bow"],
  });
  assert.equal(playerState.player.equipment.mainHand, bow.id);
  assert.equal(playerState.player.equipment.offHand ?? null, null);
  assert.deepEqual(purchases, []);
});
