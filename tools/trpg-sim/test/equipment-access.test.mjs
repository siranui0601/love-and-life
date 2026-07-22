import assert from "node:assert/strict";
import test from "node:test";
import {
  borrowMissionEquipment,
  buyUsedEquipment,
  claimEquipmentReward,
  createMissionEquipmentRewardOffer,
  ensureEquipmentAccessState,
  equipmentAvailableToPlayer,
  listEquipmentAccessOffers,
  pendingEquipmentRewards,
  previewEquipmentTrial,
  reconcileEquipmentLoans,
  returnEquipmentLoan,
} from "../lib/equipment-access.mjs";
import { createShopRuntime } from "../lib/shop-runtime.mjs";

function fixture() {
  const equipment = [
    { id: "EQ-A", name: "旅人の剣", slot: "mainHand", tier: 1, recommendedLevelMin: 1, physicalPower: 4, performanceIndex: 4, status: "active", sellRatio: 0.5 },
    { id: "EQ-B", name: "鉄の剣", slot: "mainHand", tier: 1, recommendedLevelMin: 1, physicalPower: 8, accuracy: 2, performanceIndex: 8, status: "active", sellRatio: 0.5 },
    { id: "EQ-C", name: "革鎧", slot: "body", tier: 1, recommendedLevelMin: 1, defense: 6, performanceIndex: 6, status: "active", sellRatio: 0.5 },
    { id: "EQ-D", name: "旅のお守り", slot: "accessory", tier: 1, recommendedLevelMin: 1, luck: 3, performanceIndex: 3, status: "active", sellRatio: 0.5 },
  ];
  const inventory = [
    { id: "ST-B", equipmentId: "EQ-B", name: "鉄の剣", location: "王都", sellerId: "LOC_SHOP", seller: "鍛冶屋", basePrice: 100, stock: 3, initiallySold: true, unlockCondition: "", priceCondition: "", regionCoefficient: 1 },
    { id: "ST-C", equipmentId: "EQ-C", name: "革鎧", location: "王都", sellerId: "LOC_SHOP", seller: "鍛冶屋", basePrice: 80, stock: 2, initiallySold: true, unlockCondition: "", priceCondition: "", regionCoefficient: 1 },
  ];
  const battleData = {
    equipment,
    inventory,
    equipmentById: new Map(equipment.map((item) => [item.id, item])),
  };
  const mission = {
    id: "MSN-TEST",
    title: "街道の魔物退治",
    difficulty: 1,
    finalDay: 5,
    targetLocations: ["王都"],
    steps: [{ id: "battle", type: "battle", encounterId: "ENC-1", targetLocation: "王都", required: 1 }],
  };
  const state = {
    seed: "equipment-access-test",
    day: 2,
    absoluteMinute: 900,
    player: {
      level: 1,
      location: "王都",
      facilityId: "LOC_SHOP",
      gold: 100,
      equipment: { mainHand: "EQ-A", offHand: null, body: null, accessory: null },
      inventory: { equipment: { "EQ-A": 1 }, items: {} },
    },
    catalog: {
      byId: new Map([[mission.id, mission]]),
      special: [mission],
      permanent: [],
    },
    missions: {
      [mission.id]: { status: "active", progress: { battle: 0 } },
    },
    progress: { economy: { goldSpent: 0, goldEarnedFromSales: 0, equipmentBought: 0, equipmentSold: 0 } },
    history: [],
  };
  const shopRuntime = createShopRuntime(battleData);
  const scope = { location: "王都", facilityId: "LOC_SHOP" };
  return { state, battleData, shopRuntime, scope, mission };
}

test("trial previews stat differences without granting or equipping the item", () => {
  const { state, battleData, shopRuntime, scope } = fixture();
  const before = JSON.stringify(state.player);
  const result = previewEquipmentTrial(state, battleData, shopRuntime, "ST-B", scope);
  assert.equal(result.ok, true);
  assert.equal(result.comparison.currentEquipmentId, "EQ-A");
  assert.equal(result.comparison.candidateEquipmentId, "EQ-B");
  assert.equal(result.comparison.delta.physicalPower, 4);
  assert.equal(state.player.equipment.mainHand, "EQ-A");
  assert.equal(state.player.inventory.equipment["EQ-B"], undefined);
  assert.equal(JSON.parse(before).gold, state.player.gold);
  assert.equal(state.history.at(-1).type, "SHOP_TRIAL");
});

test("used offers are deterministic, discounted, and claimable only once", () => {
  const first = fixture();
  const second = fixture();
  const firstOffer = listEquipmentAccessOffers(first.state, first.battleData, first.shopRuntime, first.scope)[0].used;
  const secondOffer = listEquipmentAccessOffers(second.state, second.battleData, second.shopRuntime, second.scope)[0].used;
  assert.deepEqual(firstOffer, secondOffer);
  assert.ok(firstOffer.price < firstOffer.originalPrice);
  const purchase = buyUsedEquipment(first.state, first.battleData, first.shopRuntime, firstOffer.offerId, first.scope);
  assert.equal(purchase.ok, true);
  assert.equal(first.state.player.inventory.equipment[firstOffer.equipmentId], 1);
  assert.equal(first.state.player.gold, 100 - firstOffer.price);
  assert.equal(buyUsedEquipment(first.state, first.battleData, first.shopRuntime, firstOffer.offerId, first.scope).ok, false);
});

test("a mission-bound loan can be equipped and is returned with its deposit when the mission closes", () => {
  const { state, battleData, shopRuntime, scope } = fixture();
  const loan = listEquipmentAccessOffers(state, battleData, shopRuntime, scope)[0].loan;
  assert.ok(loan);
  const borrowed = borrowMissionEquipment(state, battleData, shopRuntime, loan.loanId, scope);
  assert.equal(borrowed.ok, true);
  assert.equal(equipmentAvailableToPlayer(state, loan.equipmentId), true);
  const equipment = battleData.equipmentById.get(loan.equipmentId);
  state.player.equipment[equipment.slot] = loan.equipmentId;
  const afterDeposit = state.player.gold;
  state.missions[loan.missionId].status = "completed";
  const returned = reconcileEquipmentLoans(state);
  assert.equal(returned.length, 1);
  assert.equal(state.player.equipment[equipment.slot], null);
  assert.equal(state.player.gold, afterDeposit + loan.deposit);
  assert.equal(equipmentAvailableToPlayer(state, loan.equipmentId), false);
});

test("manual loan return is allowed only at the lending facility", () => {
  const { state, battleData, shopRuntime, scope } = fixture();
  const loan = listEquipmentAccessOffers(state, battleData, shopRuntime, scope)[0].loan;
  borrowMissionEquipment(state, battleData, shopRuntime, loan.loanId, scope);
  assert.equal(returnEquipmentLoan(state, loan.loanId, { facilityId: "LOC_OTHER" }).reason, "loan_return_wrong_facility");
  assert.equal(returnEquipmentLoan(state, loan.loanId, { facilityId: "LOC_SHOP" }).ok, true);
});

test("completed missions create one claimable equipment reward from the existing catalog", () => {
  const { state, battleData, mission } = fixture();
  state.missions[mission.id].status = "completed";
  const reward = createMissionEquipmentRewardOffer(state, battleData, mission, { facilityId: "LOC_SHOP" });
  assert.ok(reward);
  assert.equal(pendingEquipmentRewards(state).length, 1);
  const claimed = claimEquipmentReward(state, battleData, reward.rewardId);
  assert.equal(claimed.ok, true);
  assert.equal(state.player.inventory.equipment[reward.equipmentId], 1);
  assert.equal(pendingEquipmentRewards(state).length, 0);
  assert.equal(claimEquipmentReward(state, battleData, reward.rewardId).ok, false);
});

test("legacy saves receive an empty serializable equipment access state", () => {
  const { state } = fixture();
  delete state.player.equipmentAccess;
  const access = ensureEquipmentAccessState(state);
  assert.equal(access.version, "equipment-access-v1");
  assert.deepEqual(access.pendingRewards, []);
  assert.ok(access.claimedRewardIds instanceof Set);
});
