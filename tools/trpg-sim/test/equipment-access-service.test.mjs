import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGameView,
  createGameRuntime,
  executeGameRuntimeCommand,
  gameStateHash,
  TRPG_GAME_RESOLVER_VERSION,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";

function record(runtime, data) {
  return {
    id: "equipment-access-service-test",
    schemaVersion: "test",
    contentRevision: data.contentRevision,
    revision: 0,
    stateHash: gameStateHash(runtime, data),
    playerName: runtime.playerState.player.displayName ?? "装備導線テスト",
    presentation: null,
    lastOutcome: null,
  };
}

function setup() {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, {
    seed: "equipment-access-service",
    profileId: "balanced",
    playerName: "装備導線テスト",
    tutorial: false,
  });
  const state = runtime.playerState;
  const stockFacilityId = [...state.shop.byFacility.entries()]
    .find(([, stockIds]) => stockIds.length)?.[0];
  assert.ok(stockFacilityId);
  const facility = game.data.model.facilityById[stockFacilityId];
  state.player.location = facility.location;
  state.player.facilityId = stockFacilityId;
  state.player.gold = 10_000;
  const mission = {
    id: "MSN-EQUIPMENT-ACCESS-TEST",
    kind: "permanent",
    title: "装備貸出試験",
    startDay: state.day,
    deadlineDay: state.day + 2,
    finalDay: state.day + 3,
    targetLocations: [state.player.location],
    steps: [{ id: "battle", type: "battle", encounterId: "ENC-TEST", targetLocation: state.player.location, required: 1 }],
  };
  state.catalog.byId.set(mission.id, mission);
  state.catalog.permanent.push(mission);
  state.missions[mission.id] = { status: "active", progress: { battle: 0 } };
  return { game, runtime, state, mission };
}

test("resolver v14 initializes equipment access and exposes stock pathways", () => {
  const { game, runtime } = setup();
  const view = buildGameView(record(runtime, game.data), runtime, game.data);
  assert.equal(TRPG_GAME_RESOLVER_VERSION, "trpg-player-world-v14");
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
});

test("used purchase, borrowing, equipping and return use the shared shop state", () => {
  const { game, runtime, state } = setup();
  let view = buildGameView(record(runtime, game.data), runtime, game.data);
  const used = view.shop.stock.find((entry) => entry.access?.used?.available)?.access.used;
  assert.ok(used);
  const usedResult = executeGameRuntimeCommand(runtime, game.data, {
    type: "SHOP_BUY_USED",
    payload: { offerId: used.offerId },
  });
  assert.equal(usedResult.outcome.ok, true);
  assert.ok(Number(state.player.inventory.equipment[used.equipmentId] ?? 0) > 0);

  view = buildGameView(record(runtime, game.data), runtime, game.data);
  const loan = view.shop.stock.find((entry) => entry.access?.loan?.available)?.access.loan;
  assert.ok(loan);
  const borrowed = executeGameRuntimeCommand(runtime, game.data, {
    type: "SHOP_BORROW",
    payload: { loanId: loan.loanId },
  });
  assert.equal(borrowed.outcome.ok, true);
  const equipped = executeGameRuntimeCommand(runtime, game.data, {
    type: "EQUIP",
    payload: { equipmentId: loan.equipmentId },
  });
  assert.equal(equipped.outcome.ok, true);
  assert.ok(Object.values(state.player.equipment).includes(loan.equipmentId));
  const returned = executeGameRuntimeCommand(runtime, game.data, {
    type: "SHOP_RETURN_LOAN",
    payload: { loanId: loan.loanId },
  });
  assert.equal(returned.outcome.ok, true);
  assert.equal(Object.values(state.player.equipment).includes(loan.equipmentId), false);
});

test("newly completed missions create one claimable equipment reward", () => {
  const { game, runtime, state, mission } = setup();
  state.missions[mission.id].status = "completed";
  state.progress.missions.completedIds.add(mission.id);
  const view = buildGameView(record(runtime, game.data), runtime, game.data);
  const reward = view.shop.rewards.find((entry) => entry.missionId === mission.id);
  assert.ok(reward);
  const before = Number(state.player.inventory.equipment[reward.equipmentId] ?? 0);
  const claimed = executeGameRuntimeCommand(runtime, game.data, {
    type: "CLAIM_EQUIPMENT_REWARD",
    payload: { rewardId: reward.rewardId },
  });
  assert.equal(claimed.outcome.ok, true);
  assert.equal(Number(state.player.inventory.equipment[reward.equipmentId] ?? 0), before + 1);
});
