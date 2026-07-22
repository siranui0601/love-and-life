import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGameView,
  createGameRuntime,
  executeGameRuntimeCommand,
  gameStateHash,
  reconcileEquipmentAccessAfterCommand,
  TRPG_GAME_RESOLVER_VERSION,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";

function record(runtime, data) {
  return {
    id: "equipment-access-service",
    schemaVersion: "test",
    contentRevision: data.contentRevision,
    revision: 0,
    stateHash: gameStateHash(runtime, data),
    playerName: "装備係",
    presentation: null,
    lastOutcome: null,
  };
}

function setup() {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, {
    seed: "equipment-access-service",
    profileId: "balanced",
    playerName: "装備係",
    tutorial: false,
  });
  const state = runtime.playerState;
  const inventoryEntry = game.data.battleData.inventory.find((entry) => game.data.battleData.equipmentById.has(entry.equipmentId));
  assert.ok(inventoryEntry, "an equipment stock entry is required");
  state.player.location = inventoryEntry.location;
  state.player.facilityId = inventoryEntry.sellerId;
  state.player.gold = 9999;
  const mission = {
    id: "MSN-EQUIPMENT-ACCESS-TEST",
    kind: "permanent",
    title: "街道の魔物退治",
    difficulty: 1,
    finalDay: state.day + 3,
    targetLocations: [state.player.location],
    steps: [{ id: "battle", type: "battle", encounterId: "ENC-TEST", targetLocation: state.player.location, required: 1 }],
  };
  state.catalog.byId.set(mission.id, mission);
  state.catalog.permanent.push(mission);
  state.missions[mission.id] = { status: "active", progress: { battle: 0 } };
  return { game, runtime, state, mission };
}

test("resolver v15 initializes equipment access and exposes stock pathways", () => {
  const { game, runtime } = setup();
  const view = buildGameView(record(runtime, game.data), runtime, game.data);
  assert.equal(TRPG_GAME_RESOLVER_VERSION, "trpg-player-world-v15");
  assert.equal(view.world.equipmentAccessVersion, "equipment-access-v1");
  assert.ok(view.shop.stock.length > 0);
  assert.equal(view.shop.stock[0].access.trial.available, true);
  assert.ok(view.shop.stock[0].access.used);
  assert.ok(view.shop.stock[0].access.loan);
});

test("SHOP_TRY compares equipment without granting ownership", () => {
  const { game, runtime, state } = setup();
  const view = buildGameView(record(runtime, game.data), runtime, game.data);
  const item = view.shop.stock[0];
  const before = Number(state.player.inventory.equipment[item.equipmentId] ?? 0);
  const result = executeGameRuntimeCommand(runtime, game.data, {
    type: "SHOP_TRY",
    payload: { stockId: item.stockId },
  });
  assert.equal(result.outcome.ok, true);
  assert.ok(result.outcome.comparison);
  assert.equal(Number(state.player.inventory.equipment[item.equipmentId] ?? 0), before);
  assert.match(result.outcome.summary, /試/u);
});

test("used purchase, borrowing, equipping and return use the shared shop state", () => {
  const usedSetup = setup();
  let view = buildGameView(record(usedSetup.runtime, usedSetup.game.data), usedSetup.runtime, usedSetup.game.data);
  const used = view.shop.stock.find((item) => item.access?.used)?.access.used;
  assert.ok(used);
  const usedResult = executeGameRuntimeCommand(usedSetup.runtime, usedSetup.game.data, {
    type: "SHOP_BUY_USED",
    payload: { offerId: used.offerId },
  });
  assert.equal(usedResult.outcome.ok, true);
  assert.equal(usedSetup.state.player.inventory.equipment[used.equipmentId], 1);

  const loanSetup = setup();
  view = buildGameView(record(loanSetup.runtime, loanSetup.game.data), loanSetup.runtime, loanSetup.game.data);
  const loan = view.shop.stock.find((item) => item.access?.loan)?.access.loan;
  assert.ok(loan);
  const goldBefore = loanSetup.state.player.gold;
  const borrowed = executeGameRuntimeCommand(loanSetup.runtime, loanSetup.game.data, {
    type: "SHOP_BORROW",
    payload: { loanId: loan.loanId },
  });
  assert.equal(borrowed.outcome.ok, true);
  const equipped = executeGameRuntimeCommand(loanSetup.runtime, loanSetup.game.data, {
    type: "EQUIP",
    payload: { equipmentId: loan.equipmentId },
  });
  assert.equal(equipped.outcome.ok, true);
  assert.ok(Object.values(loanSetup.state.player.equipment).includes(loan.equipmentId));
  view = buildGameView(record(loanSetup.runtime, loanSetup.game.data), loanSetup.runtime, loanSetup.game.data);
  assert.ok(view.player.inventory.equipment.some((item) => item.borrowed && item.id === loan.equipmentId));
  const returned = executeGameRuntimeCommand(loanSetup.runtime, loanSetup.game.data, {
    type: "SHOP_RETURN_LOAN",
    payload: { loanId: loan.loanId },
  });
  assert.equal(returned.outcome.ok, true);
  assert.equal(loanSetup.state.player.gold, goldBefore);
  assert.equal(Object.values(loanSetup.state.player.equipment).includes(loan.equipmentId), false);
});

test("newly completed missions create one claimable equipment reward", () => {
  const { game, runtime, state, mission } = setup();
  const before = new Set(state.progress.missions.completedIds);
  state.missions[mission.id].status = "completed";
  state.progress.missions.completedIds.add(mission.id);
  const changes = reconcileEquipmentAccessAfterCommand(runtime, game.data, before);
  assert.equal(changes.rewards.length, 1);
  let view = buildGameView(record(runtime, game.data), runtime, game.data);
  assert.equal(view.shop.rewards.length, 1);
  const reward = view.shop.rewards[0];
  const result = executeGameRuntimeCommand(runtime, game.data, {
    type: "CLAIM_EQUIPMENT_REWARD",
    payload: { rewardId: reward.rewardId },
  });
  assert.equal(result.outcome.ok, true);
  assert.equal(state.player.inventory.equipment[reward.equipmentId], 1);
  view = buildGameView(record(runtime, game.data), runtime, game.data);
  assert.equal(view.shop.rewards.length, 0);
});
