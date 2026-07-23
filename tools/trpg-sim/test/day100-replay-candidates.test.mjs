import assert from "node:assert/strict";
import test from "node:test";
import { buildDay100ReplayCandidateManifest } from "../lib/day100-replay-candidates.mjs";

function record(overrides = {}) {
  return {
    cacheKey: "cache-a",
    source: "gemini",
    runId: "run-a",
    scenarioId: "scene-a",
    model: "gemini-2.5-flash",
    promptVersion: "prompt-a",
    recordedAt: "2026-07-23T00:00:00.000Z",
    time: { day: 2, hour: 10, minute: 5 },
    place: { locationId: "王都", facilityId: "LOC_CAP_INN" },
    action: { id: "TALK:A", type: "conversation" },
    presentNpcIds: ["NPC-A"],
    evaluation: { passed: true, checks: { narrativePresent: true } },
    usedFallback: false,
    response: {
      narrative: "店主は棚の武器を指した。",
      choices: [
        { id: "A", label: "剣を見る", intentType: "observe" },
        { id: "B", label: "槍を試す", intentType: "investigate" },
        { id: "C", label: "値段を聞く", intentType: "ask" },
      ],
      speeches: [{ actorId: "NPC-A", text: "試してから決めるといい。" }],
      proposals: [],
      proposalResolution: { accepted: [], rejected: [] },
    },
    ...overrides,
  };
}

test("preserves only fully evaluated reusable narrative responses", () => {
  const manifest = buildDay100ReplayCandidateManifest([
    record(),
    record({ cacheKey: "fallback", source: "deterministic_fallback", usedFallback: true }),
    record({ cacheKey: "partial", evaluation: { passed: false } }),
  ], {
    runId: "day100-v7",
    seed: "seed-a",
    sourceCommit: "abc123",
    generatedAt: "2026-07-23T01:00:00.000Z",
  });
  assert.equal(manifest.schemaVersion, "day100-narrative-replay-candidates-v1");
  assert.equal(manifest.reviewStatus, "candidate_only");
  assert.equal(manifest.stats.auditRecords, 3);
  assert.equal(manifest.stats.reusableEntries, 1);
  assert.equal(manifest.stats.rejectedRecords, 2);
  assert.equal(manifest.entries[0].key, "cache-a");
  assert.equal(manifest.entries[0].response.narrative, "店主は棚の武器を指した。");
  assert.equal("rawFinal" in manifest.entries[0], false);
});

test("deduplicates cache keys and prefers a reviewed replay source", () => {
  const manifest = buildDay100ReplayCandidateManifest([
    record({ source: "replay_cache", response: { ...record().response, narrative: "キャッシュ版" } }),
    record({ source: "approved_replay", response: { ...record().response, narrative: "承認版" } }),
  ]);
  assert.equal(manifest.stats.reusableEntries, 1);
  assert.equal(manifest.stats.duplicateRecords, 1);
  assert.equal(manifest.entries[0].metadata.source, "approved_replay");
  assert.equal(manifest.entries[0].response.narrative, "承認版");
});
