import test from "node:test";
import assert from "node:assert/strict";
import { synchronizeRegisterButterfly } from "../../../src/server/trpg/content/authored-register-butterfly.js";

test("REGISTER persists a butterfly record", () => {
  const runtime = {
    checkpointEPrologue: { complete: true, completedAtMinute: 700, loan: { disposition: "borrowed_registered" } },
    playerState: { absoluteMinute: 700, player: { id: "PLAYER-TEST", location: "田園の村", facilityId: "LOC_FARM_SQUARE", knownRumorIds: new Set() }, history: [], worldFlags: {}, rumors: [], rumorById: {}, goapRequests: {} },
    livingWorld: { npcStates: {} },
  };
  const output = synchronizeRegisterButterfly(runtime);
  assert.ok(output.record);
  assert.equal(output.record.facilityId, "LOC_FARM_INN");
});
