import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_WORLD_LIFE_INTERNALS as life,
} from "../../../src/server/trpg/content/canonical-world-life-actions.js";

test("carried provisions remain inventory and never create generic LIFE:EAT actions", () => {
  const runtime = {
    playerState: {
      day: 9,
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_BAKERY",
        gold: 12,
        needs: { hunger: 64, fatigue: 22 },
      },
      canonicalWorldLife: {
        provisions: { ITM008: 2, ITM010: 3 },
        purchases: {},
        meals: {},
        sleeps: {},
        services: {},
      },
      progress: {},
      worldFlags: {},
    },
  };

  const actions = life.productActions(runtime);
  const ids = actions.map((action) => action.id);
  assert.ok(ids.includes("LIFE:BUY:ITM008"), "the bakery may still sell black bread");
  assert.ok(ids.includes("LIFE:BUY:ITM010"), "the bakery may still sell preserved bread");
  assert.equal(ids.some((id) => id === "LIFE:EAT:ITM008" || id === "LIFE:EAT:ITM010"), false,
    "inventory contents must not expose arbitrary consume actions");
  assert.equal(actions.some((action) => action.canonicalWorldLifeKind === "eat_provision"), false);
});
