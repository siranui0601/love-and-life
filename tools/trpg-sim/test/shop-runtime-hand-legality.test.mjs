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

test("autoShop never equips an off-hand after buying a two-handed main-hand", () => {
  const bow = equipment("EQP-TEST-BOW", "mainHand", { weaponType: "bow", grip: "twoHand", performanceIndex: 20 });
  const shield = equipment("EQP-TEST-SHIELD", "offHand", { armorClass: "shield", grip: "oneHand", performanceIndex: 10 });
  const data = battleData([bow, shield], [
    stock("STOCK-BOW", bow.id, 10),
    stock("STOCK-SHIELD", shield.id, 10),
  ]);
  const playerState = state();
  const runtime = createShopRuntime(data);

  const purchases = autoShop(playerState, data, runtime, { weaponTypes: ["bow"] });

  assert.equal(playerState.player.equipment.mainHand, bow.id);
  assert.equal(playerState.player.equipment.offHand ?? null, null);
  assert.deepEqual(purchases.map((entry) => entry.equipmentId), [bow.id]);
  assert.equal(playerState.player.inventory.equipment[shield.id] ?? 0, 0);
});

test("autoShop still allows an off-hand beside a one-handed main-hand", () => {
  const sword = equipment("EQP-TEST-SWORD", "mainHand", { weaponType: "oneHandedSword", grip: "oneHand", performanceIndex: 20 });
  const shield = equipment("EQP-TEST-SHIELD", "offHand", { armorClass: "shield", grip: "oneHand", performanceIndex: 10 });
  const data = battleData([sword, shield], [stock("STOCK-SHIELD", shield.id, 10)]);
  const playerState = state({ equipment: { mainHand: sword.id }, owned: { [sword.id]: 1 } });
  const runtime = createShopRuntime(data);

  const purchases = autoShop(playerState, data, runtime, { weaponTypes: ["oneHandedSword"] });

  assert.equal(playerState.player.equipment.mainHand, sword.id);
  assert.equal(playerState.player.equipment.offHand, shield.id);
  assert.deepEqual(purchases.map((entry) => entry.equipmentId), [shield.id]);
});
