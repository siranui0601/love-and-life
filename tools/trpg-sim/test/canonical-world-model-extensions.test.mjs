import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCanonicalWorldModelExtensions,
  CANONICAL_WORLD_MODEL_EXTENSION_INTERNALS as internals,
} from "../../../src/server/trpg/content/canonical-world-model-extensions.js";

function model() {
  return {
    facilities: [],
    facilityById: {},
    facilitiesByHub: { "田園の村": [] },
    npcs: [],
    npcById: {},
    diagnostics: [],
  };
}

test("live farm canonical extensions include the public north fence and repair shop exactly once", () => {
  const state = model();
  applyCanonicalWorldModelExtensions(state);

  assert.deepEqual(
    internals.FACILITIES.map((facility) => facility.id),
    ["LOC_FARM_NORTH_FENCE", "LOC_FARM_REPAIR"],
  );
  assert.ok(state.facilityById.LOC_FARM_NORTH_FENCE);
  assert.equal(state.facilityById.LOC_FARM_NORTH_FENCE.name, "村の北柵");
  assert.ok(state.facilityById.LOC_FARM_REPAIR);
  assert.ok(state.npcById.NPC111);
  assert.deepEqual(
    state.facilitiesByHub["田園の村"].map((facility) => facility.id),
    ["LOC_FARM_NORTH_FENCE", "LOC_FARM_REPAIR"],
  );

  applyCanonicalWorldModelExtensions(state);
  assert.equal(state.facilities.filter((facility) => facility.id === "LOC_FARM_NORTH_FENCE").length, 1);
  assert.equal(state.facilities.filter((facility) => facility.id === "LOC_FARM_REPAIR").length, 1);
  assert.equal(state.npcs.filter((npc) => npc.id === "NPC111").length, 1);
});
