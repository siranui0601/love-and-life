import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_MATERIAL_ECONOMY_INTERNALS,
} from "../../../src/server/trpg/content/canonical-material-economy.js";

function runtime({ facilityId = "LOC_FARM_REPAIR", progress = {}, seed = "material-test" } = {}) {
  return {
    playerState: {
      seed,
      absoluteMinute: 120,
      metrics: { battles: 1 },
      progress,
      player: { location: "田園の村", facilityId, gold: 0 },
      history: [],
    },
  };
}

test("guaranteed canonical drops are added once per settled battle", () => {
  const r = runtime();
  const result = { battle: { won: true, encounterId: "ENC-0015", monsterIds: ["MON-0015"] } };
  const first = CANONICAL_MATERIAL_ECONOMY_INTERNALS.processBattleDrops(r, result);
  const second = CANONICAL_MATERIAL_ECONOMY_INTERNALS.processBattleDrops(r, result);
  assert.deepEqual(first, [{ materialId: "MAT_KING_GEL_CORE", quantity: 1 }]);
  assert.deepEqual(second, []);
  assert.equal(r.playerState.canonicalMaterialEconomy.inventory.MAT_KING_GEL_CORE, 1);
});

test("guaranteed multi-item final boss drops are both recorded", () => {
  const r = runtime({ seed: "t13-final" });
  r.playerState.metrics.battles = 8;
  const result = { battle: { won: true, encounterId: "ENC-0018", monsterIds: ["MON-0018"] } };
  const gained = CANONICAL_MATERIAL_ECONOMY_INTERNALS.processBattleDrops(r, result);
  assert.deepEqual(gained, [
    { materialId: "MAT_KING_GEL_CORE", quantity: 1 },
    { materialId: "MAT_WORLD_TREE_FRAGMENT", quantity: 1 },
  ]);
});

test("material sale pays only canonical buyback price times owned quantity", () => {
  const r = runtime();
  r.playerState.canonicalMaterialEconomy = {
    inventory: { MAT_RED_FANG_LARGE: 1 },
    sold: {},
    processedBattleKeys: {},
  };
  const action = CANONICAL_MATERIAL_ECONOMY_INTERNALS.ownActions(r).find((entry) => entry.id === "MATERIAL_SELL:MAT_RED_FANG_LARGE:Q1");
  assert.ok(action);
  const result = { ok: true };
  const handled = CANONICAL_MATERIAL_ECONOMY_INTERNALS.consumeSale(r, action, result);
  assert.equal(handled, true);
  assert.equal(r.playerState.player.gold, 3);
  assert.equal(r.playerState.canonicalMaterialEconomy.inventory.MAT_RED_FANG_LARGE, 0);
  assert.deepEqual(result.materialSale, {
    materialId: "MAT_RED_FANG_LARGE",
    quantity: 1,
    unitPrice: 3,
    gold: 3,
    facilityId: "LOC_FARM_REPAIR",
  });
});

test("restricted material buyers require the same public world permits as their facilities", () => {
  const r = runtime({ facilityId: "LOC_FORT_SUPPLY" });
  r.playerState.player.location = "北陵要塞";
  r.playerState.canonicalMaterialEconomy = {
    inventory: { MAT_FROST_PELT: 1 },
    sold: {},
    processedBattleKeys: {},
  };
  assert.equal(CANONICAL_MATERIAL_ECONOMY_INTERNALS.activeBuyer(r), null);
  r.playerState.progress.fortEntryPermit = true;
  assert.equal(CANONICAL_MATERIAL_ECONOMY_INTERNALS.activeBuyer(r), "LOC_FORT_SUPPLY");
});

test("non-material monster drops are intentionally excluded from the material ledger", () => {
  assert.equal(CANONICAL_MATERIAL_ECONOMY_INTERNALS.MONSTER_MATERIAL_DROPS["MON-0049"], undefined);
  assert.equal(CANONICAL_MATERIAL_ECONOMY_INTERNALS.MATERIAL_BUYBACK_G.MAT_GOLEM_CORE, 8);
});
