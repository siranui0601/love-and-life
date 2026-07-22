import assert from "node:assert/strict";
import test from "node:test";
import { createDay100SampledNarrator } from "../lib/day100-player-runner.mjs";

function scenario() {
  return {
    locale: "ja-JP",
    playerName: "百日の旅人",
    sceneMode: "free_roam",
    action: { id: "WAIT", type: "wait", label: "少し待つ" },
    authoritativeState: {
      day: 3,
      hour: 10,
      minute: 0,
      daypart: "day",
      locationId: "田園の村",
      facilityId: "LOC_FARM_SQUARE",
      facilityName: "村の広場",
      presentNpcIds: [],
      npcs: [],
      availableActionCandidates: [
        { id: "WAIT", label: "少し待つ", intentType: "wait", actionType: "wait" },
        { id: "INSPECT", label: "掲示板を調べる", intentType: "investigate", actionType: "localInvestigate" },
        { id: "MOVE", label: "宿へ向かう", intentType: "leave", actionType: "move" },
      ],
      player: { displayName: "百日の旅人" },
      authoritativeOutcome: { ok: true, summary: "人の流れが変わった。" },
    },
  };
}

test("Day100 sampled narrator can run a routine scene without a Gemini provider call", async () => {
  const narrator = createDay100SampledNarrator({ liveSampleLimit: 0 });
  const response = await narrator.generate(scenario());
  assert.equal(response.meta.source, "day100_policy_fallback");
  assert.equal(response.meta.providerCalls, 0);
  assert.equal(response.choices.length, 3);
  assert.deepEqual(new Set(response.choices.map((choice) => choice.id)), new Set(["WAIT", "INSPECT", "MOVE"]));
  assert.equal(narrator.stats.liveCalls, 0);
  assert.equal(narrator.stats.policyFallbacks, 1);
});
