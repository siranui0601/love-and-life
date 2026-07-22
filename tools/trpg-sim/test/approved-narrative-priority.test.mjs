import assert from "node:assert/strict";
import test from "node:test";
import { createTrpgNarrator } from "../../../src/server/trpg/gemini-narrator.js";
import { createNarrativeReplayCache } from "../../../src/server/trpg/narrative-cache.js";

function scenario() {
  return {
    action: { id: "ACT-1", type: "observe", label: "門前を見渡す", targetNpcId: null },
    authoritativeState: {
      day: 2,
      hour: 12,
      minute: 15,
      daypart: "day",
      locationId: "王都",
      facilityId: "LOC_CAP_GATE",
      facilityName: "王都の門",
      presentNpcIds: [],
      npcs: [],
      missions: [],
      localRumors: [],
      player: { displayName: "旅人" },
      authoritativeOutcome: { kind: "observation", summary: "王都の門前にいる。" },
      availableActionCandidates: [
        { id: "ACT-A", label: "下層へ進む", intentType: "move", actionType: "move" },
        { id: "ACT-B", label: "門の掲示を読む", intentType: "investigate", actionType: "investigate" },
        { id: "ACT-C", label: "往来を眺める", intentType: "observe", actionType: "observe" },
      ],
    },
  };
}

test("approved replay is resolved before runtime cache and provider", async () => {
  let providerCalls = 0;
  const approvedResponse = {
    narrative: "石壁の向こうから王都のざわめきが届く。",
    choices: [
      { id: "ACT-A", label: "下層へ進む", intentType: "move", targetNpcId: null },
      { id: "ACT-B", label: "門の掲示を読む", intentType: "investigate", targetNpcId: null },
      { id: "ACT-C", label: "往来を眺める", intentType: "observe", targetNpcId: null },
    ],
    speeches: [],
    proposals: [],
  };
  const approvedCache = {
    get(key) {
      return { key, response: approvedResponse, metadata: { scenarioId: "APPROVED-1" }, approvedAt: "2026-07-22T00:00:00.000Z" };
    },
    snapshot() { return { entries: 1, readOnly: true }; },
  };
  const narrator = createTrpgNarrator({
    approvedCache,
    cache: createNarrativeReplayCache({ memoryOnly: true }),
    memoryOnlyAudit: true,
    provider: { async generate() { providerCalls += 1; throw new Error("provider_must_not_run"); } },
  });
  const result = await narrator.generate(scenario());
  assert.equal(result.meta.source, "approved_replay");
  assert.equal(result.meta.providerCalls, 0);
  assert.equal(result.meta.approvedMetadata.scenarioId, "APPROVED-1");
  assert.equal(result.narrative, approvedResponse.narrative);
  assert.equal(providerCalls, 0);
  assert.equal(narrator.cache.snapshot().hits, 0);
});
