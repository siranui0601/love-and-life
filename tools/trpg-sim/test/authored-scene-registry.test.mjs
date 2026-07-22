import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAuthoredScene,
  validateAuthoredScene,
} from "../../../src/server/trpg/content/authored-scene-registry.js";

function resolveT01({ stepId, outcome = {}, action = {}, facilityId = "LOC_FARM_EDGE", story = {} }) {
  return resolveAuthoredScene({
    action,
    mission: { id: "MSN-T01", stepId },
    outcome,
    location: { facilityId },
    story,
  });
}

test("reviewed T01 search tracks remain focused on Finn's physical trail", () => {
  const scene = resolveT01({
    stepId: "search",
    outcome: { discovery: { id: "T01-CLUE-BOOT-TRACKS" } },
  });
  assert.equal(scene?.sceneId, "t01.search.boot_tracks");
  assert.equal(scene.presentationOnly, true);
  assert.match(scene.narrative, /小さな靴跡/u);
  assert.doesNotMatch(scene.narrative, /見知らぬ|青年/u);
  assert.equal(validateAuthoredScene(scene).valid, true);
});

test("the second reviewed search beat makes the child's voice explicit before battle", () => {
  const scene = resolveT01({
    stepId: "search",
    outcome: { discovery: { id: "T01-CLUE-DROPPED-MAP" } },
  });
  assert.equal(scene?.sceneId, "t01.search.dropped_map_and_voice");
  assert.match(scene.narrative, /子どもの弱い声/u);
  assert.match(scene.narrative, /フィンは、まだ生きている/u);
  assert.doesNotMatch(scene.narrative, /見知らぬ人物/u);
});

test("the reviewed T01 rescue aftermath keeps Finn age- and voice-consistent", () => {
  const scene = resolveT01({
    stepId: "rescue",
    outcome: { battle: { won: true } },
  });
  assert.equal(scene?.sceneId, "t01.rescue.after_battle");
  const validation = validateAuthoredScene(scene, {
    presentNpcIds: new Set(["NPC001"]),
    visibleFacilityIds: new Set(["LOC_FARM_EDGE", "LOC_FARM_SQUARE"]),
    requireExitRoute: true,
  });
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.deepEqual(scene.choices.map((choice) => choice.family), ["talk", "move", "prepare"]);
  assert.match(scene.narrative, /少年/u);
  assert.doesNotMatch(scene.narrative, /青年/u);
  assert.match(scene.beats[0].text, /僕、フィン/u);
  assert.doesNotMatch(scene.beats[0].text, /俺はフィン/u);
});

test("the reviewed escort request is direct, human, and focused on returning home", () => {
  const scene = resolveT01({
    stepId: "escort",
    action: { id: "ACTION:MSN-T01:escort" },
  });
  assert.equal(scene?.sceneId, "t01.escort.request");
  assert.match(scene.beats[0].text, /母さん/u);
  assert.match(scene.beats[0].text, /肩を貸して/u);
  assert.match(scene.beats[0].text, /置いていかないで/u);
});

test("the reviewed reunion happens on the authoritative escort arrival minute", () => {
  const scene = resolveT01({
    stepId: "decide",
    action: { type: "move" },
    facilityId: "LOC_FARM_SQUARE",
    story: { t01ReunionNow: true },
  });
  assert.equal(scene?.sceneId, "t01.escort.reunion_arrival");
  assert.deepEqual(scene.beats.map((beat) => beat.actorId), ["NPC001", "NPC002", "NPC003"]);
  assert.match(scene.beats[0].text, /母さん……ただいま/u);
  assert.match(scene.beats[1].text, /ありがとうございます/u);
  assert.match(scene.beats[2].text, /村を預かる者として礼を言う/u);
  assert.equal(resolveT01({
    stepId: "decide",
    action: { type: "move" },
    facilityId: "LOC_FARM_SQUARE",
    story: { t01ReunionNow: false },
  }), null);
});

test("the authored rescue scene does not resolve before the battle is won", () => {
  const scene = resolveT01({
    stepId: "rescue",
    outcome: { battle: { won: false } },
  });
  assert.equal(scene, null);
});
