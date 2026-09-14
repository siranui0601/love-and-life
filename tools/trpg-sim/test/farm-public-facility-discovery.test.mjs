import assert from "node:assert/strict";
import test from "node:test";

import { AUTHORED_MISSION_FLOW_REGISTRY_INTERNALS as registry } from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime() {
  return {
    playerKnowledge: {
      knownFacilityIds: new Set(["LOC_FARM_FIELD", "LOC_FARM_SQUARE", "LOC_FARM_WELL"]),
    },
    livingWorld: {
      model: {
        facilitiesByHub: {
          "田園の村": [
            { id: "LOC_FARM_FIELD", name: "麦畑", type: "農地" },
            { id: "LOC_FARM_SQUARE", name: "村の広場", type: "広場" },
            { id: "LOC_FARM_WELL", name: "共同井戸", type: "水場" },
            { id: "LOC_FARM_GRANARY", name: "共同穀倉", type: "保管庫/事件現場" },
            { id: "LOC_FARM_INN", name: "麦穂亭", type: "宿" },
            { id: "LOC_FARM_LOOKOUT", name: "古い見張り小屋", type: "事件地点" },
          ],
        },
      },
    },
  };
}

test("knowing the village square persists every signed ordinary farm facility from the canonical world model", () => {
  const state = runtime();
  assert.equal(registry.reconcileSignedFarmFacilities(state), true);
  assert.equal(state.playerKnowledge.knownFacilityIds.has("LOC_FARM_GRANARY"), true);
  assert.equal(state.playerKnowledge.knownFacilityIds.has("LOC_FARM_INN"), true);
  assert.equal(state.playerKnowledge.knownFacilityIds.has("LOC_FARM_LOOKOUT"), false,
    "secret/event-only lookout remains behind its existing discovery gate");

  assert.equal(registry.reconcileSignedFarmFacilities(state), false,
    "the reconciliation is idempotent once persisted knowledge is complete");
});

test("farm facilities are not leaked before the public square itself is known", () => {
  const state = runtime();
  state.playerKnowledge.knownFacilityIds.delete("LOC_FARM_SQUARE");
  assert.equal(registry.reconcileSignedFarmFacilities(state), false);
  assert.equal(state.playerKnowledge.knownFacilityIds.has("LOC_FARM_GRANARY"), false);
});
