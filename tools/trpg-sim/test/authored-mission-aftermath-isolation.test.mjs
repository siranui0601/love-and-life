import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORED_MISSION_FLOW_PACKS,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";
import { resolveAuthoredScene } from "../../../src/server/trpg/content/authored-scene-registry.js";

function pack(troubleId) {
  return AUTHORED_MISSION_FLOW_PACKS.find((entry) => entry.troubleId === troubleId);
}

test("every authored aftermath dialogue stays isolated to the selected resolution route", () => {
  for (const troubleId of ["T03", "T04", "T05", "T06", "T07"]) {
    const missionPack = pack(troubleId);
    assert.ok(missionPack);
    const routes = missionPack.resolution.choices;
    for (const route of routes) {
      for (const followup of route.worldEffect.followups) {
        const expectedSceneId = `mission-flow.${missionPack.id}.followup.${route.id}.${followup.id}`;
        for (const otherRoute of routes.filter((candidate) => candidate.id !== route.id)) {
          const scene = resolveAuthoredScene({
            action: {
              type: "conversation",
              targetNpcId: followup.npcId,
              dialogueTopic: "direct_contact",
            },
            world: {
              flags: {
                [route.worldEffect.flagKey]: otherRoute.id,
              },
            },
            mission: {},
            location: {},
            outcome: {},
          });
          assert.notEqual(scene?.sceneId, expectedSceneId,
            `${troubleId}:${route.id}:${followup.id} dialogue leaked into ${otherRoute.id}`);
        }
      }
    }
  }
});
