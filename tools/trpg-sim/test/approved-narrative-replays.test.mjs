import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApprovedNarrativeReplayCache } from "../../../src/server/trpg/approved-narrative-replays.js";
import {
  promoteApprovedNarrativeResults,
  resultApprovalEligibility,
} from "../lib/approved-narrative-promotion.mjs";

function response(label = "進む") {
  return {
    narrative: "街道の先に王都の門が見える。",
    choices: [
      { id: "A", label, intentType: "move", targetNpcId: null },
      { id: "B", label: "旅人に話を聞く", intentType: "talk", targetNpcId: "NPC1" },
      { id: "C", label: "道標を調べる", intentType: "investigate", targetNpcId: null },
    ],
    speeches: [],
    proposals: [],
  };
}

test("approved replay cache is read-only, rejects malformed entries, and returns clones", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "trpg-approved-replays-"));
  const filePath = path.join(directory, "approved.json");
  fs.writeFileSync(filePath, JSON.stringify({
    schemaVersion: "approved-narrative-replays-v1",
    entries: [
      { key: "valid", response: response(), metadata: { scenarioId: "S1" }, approvedAt: "2026-07-22T00:00:00.000Z" },
      { key: "invalid", response: { narrative: "不足", choices: [] } },
      { key: "valid", response: response("重複") },
    ],
  }), "utf8");
  const cache = createApprovedNarrativeReplayCache({ filePath });
  assert.equal(cache.snapshot().loaded, 1);
  assert.equal(cache.snapshot().rejected, 1);
  assert.equal(cache.snapshot().duplicates, 1);
  const first = cache.get("valid");
  first.response.narrative = "変更";
  assert.equal(cache.get("valid").response.narrative, "街道の先に王都の門が見える。");
  assert.equal(cache.get("missing"), null);
  assert.equal(cache.snapshot().readOnly, true);
});

test("only fully validated model output is eligible for explicit approval", () => {
  const valid = {
    scenarioId: "LIVE-01",
    cacheKey: "key-1",
    source: "gemini_repaired",
    cachePersisted: true,
    usedFallback: false,
    partialOutputUsed: false,
    ...response(),
  };
  assert.equal(resultApprovalEligibility(valid).eligible, true);
  assert.equal(resultApprovalEligibility({ ...valid, source: "replay_cache" }).eligible, false);
  assert.equal(resultApprovalEligibility({ ...valid, usedFallback: true }).eligible, false);
  assert.equal(resultApprovalEligibility({ ...valid, choices: valid.choices.slice(0, 2) }).eligible, false);
});

test("promotion requires explicit scenario ids and preserves an existing approved key", () => {
  const report = {
    runId: "run-1",
    model: "gemini-2.5-flash",
    promptVersion: "v5",
    results: [{
      scenarioId: "LIVE-01",
      cacheKey: "key-1",
      source: "gemini",
      cachePersisted: true,
      usedFallback: false,
      partialOutputUsed: false,
      ...response(),
    }],
  };
  const initial = { schemaVersion: "approved-narrative-replays-v1", entries: [] };
  const first = promoteApprovedNarrativeResults({ manifest: initial, report, scenarioIds: ["LIVE-01"], approvedAt: "2026-07-22T00:00:00.000Z" });
  assert.equal(first.added.length, 1);
  assert.equal(first.manifest.entries[0].key, "key-1");
  assert.equal(first.manifest.entries[0].metadata.scenarioId, "LIVE-01");
  assert.equal(first.manifest.entries[0].response.meta, undefined);
  const second = promoteApprovedNarrativeResults({ manifest: first.manifest, report, scenarioIds: ["LIVE-01"] });
  assert.equal(second.added.length, 0);
  assert.equal(second.skipped[0].reason, "already_approved");
  assert.throws(() => promoteApprovedNarrativeResults({ manifest: initial, report, scenarioIds: [] }), /scenario_ids_required/u);
});
