import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_MISSION_FLOW_REGISTRY_INTERNALS as registry,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime({ roped = true, presence = "present", lifeStatus = "alive" } = {}) {
  return {
    playerState: {
      absoluteMinute: 5 * 1440 + 145,
      player: { location: "田園の村", facilityId: "LOC_FARM_GRANARY" },
      missions: {
        "MSN-T02": { id: "MSN-T02", troubleId: "T02", status: "active" },
      },
      troubles: { T02: { status: "active" } },
      worldFlags: roped ? { t02DawnSceneRoped: true } : {},
      history: [],
    },
    livingWorld: {
      npcStates: {
        NPC005: {
          id: "NPC005",
          presence,
          lifeStatus,
          location: "田園の村",
          position: { hubId: "田園の村", facilityId: "LOC_FARM_CHIEF" },
          localTravel: null,
        },
      },
      localMovementEvents: [],
    },
  };
}

const followup = {
  authoredT02DawnChoice: true,
  authoredT02DawnSceneId: "t02-dawn-scene-record",
};

test("Toma returns to his canonical granary duty after the cordoned dawn follow-up", () => {
  const state = runtime();
  assert.equal(registry.reconcileCanonicalT02GranaryKeeper(state, followup, { ok: true }), true);
  assert.equal(state.livingWorld.npcStates.NPC005.position.facilityId, "LOC_FARM_GRANARY");
  assert.equal(state.livingWorld.localMovementEvents.at(-1).settledBy, "canonical-t02-granary-duty");
  assert.equal(state.playerState.history.at(-1).type, "NPC_CANONICAL_ROUTINE_RECONCILED");
});

test("the opening action itself does not relocate Toma before the selected branch is known", () => {
  const state = runtime();
  const opening = { ...followup, authoredT02DawnSceneId: "t02-granary-dawn" };
  assert.equal(registry.reconcileCanonicalT02GranaryKeeper(state, opening, { ok: true }), false);
  assert.equal(state.livingWorld.npcStates.NPC005.position.facilityId, "LOC_FARM_CHIEF");
});

test("the headcount branch and inactive Toma are never overridden", () => {
  const headcount = runtime({ roped: false });
  assert.equal(registry.reconcileCanonicalT02GranaryKeeper(headcount, followup, { ok: true }), false);
  assert.equal(headcount.livingWorld.npcStates.NPC005.position.facilityId, "LOC_FARM_CHIEF");

  for (const presence of ["missing", "departed", "traveling"]) {
    const inactive = runtime({ presence, lifeStatus: presence === "missing" ? "missing" : "alive" });
    assert.equal(registry.reconcileCanonicalT02GranaryKeeper(inactive, followup, { ok: true }), false);
    assert.equal(inactive.livingWorld.npcStates.NPC005.position.facilityId, "LOC_FARM_CHIEF");
  }
});