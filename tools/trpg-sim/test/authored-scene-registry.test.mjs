import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAuthoredScene,
  validateAuthoredScene,
} from "../../../src/server/trpg/content/authored-scene-registry.js";

test("the reviewed T01 rescue aftermath resolves from authoritative state", () => {
  const context = {
    mission: { id: "MSN-T01", stepId: "rescue" },
    outcome: { battle: { won: true } },
    location: { facilityId: "LOC_FARM_EDGE" },
  };
  const scene = resolveAuthoredScene(context);
  assert.equal(scene?.sceneId, "t01.rescue.after_battle");
  const validation = validateAuthoredScene(scene, {
    presentNpcIds: new Set(["NPC001"]),
    visibleFacilityIds: new Set(["LOC_FARM_EDGE", "LOC_FARM_SQUARE"]),
    requireExitRoute: true,
  });
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.deepEqual(scene.choices.map((choice) => choice.family), ["talk", "move", "prepare"]);
});

test("the authored rescue scene does not resolve before the battle is won", () => {
  const scene = resolveAuthoredScene({
    mission: { id: "MSN-T01", stepId: "rescue" },
    outcome: { battle: { won: false } },
    location: { facilityId: "LOC_FARM_EDGE" },
  });
  assert.equal(scene, null);
});
