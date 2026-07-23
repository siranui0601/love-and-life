import assert from "node:assert/strict";
import test from "node:test";
import { createDay100ExperienceAudit } from "../lib/day100-experience-audit.mjs";
import { createDay100Narrator } from "../lib/day100-narrator.mjs";

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

test("Day100 narrator limits server templates to routine life processing", async () => {
  const experienceAudit = createDay100ExperienceAudit();
  const narrator = createDay100Narrator({ maxNarrativeCalls: 1, experienceAudit });
  const response = await narrator.generate(scenario());
  assert.equal(response.meta.source, "routine_server_template");
  assert.equal(response.meta.providerCalls, 0);
  assert.equal(response.choices.length, 3);
  assert.deepEqual(new Set(response.choices.map((choice) => choice.id)), new Set(["WAIT", "INSPECT", "MOVE"]));
  assert.equal(narrator.stats.liveCalls, 0);
  assert.equal(narrator.stats.routineTemplates, 1);
  assert.equal(experienceAudit.narrative.meaningfulScenes, 0);
});
