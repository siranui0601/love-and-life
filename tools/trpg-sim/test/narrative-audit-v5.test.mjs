import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createNarrativeAuditLog,
  narrativeAuditRecordToSheetRow,
  syncNarrativeAuditToSheet,
} from "../../../src/server/trpg/narrative-audit.js";

function record(id, source = "gemini") {
  return {
    recordId: id,
    recordedAt: "2026-07-18T10:00:00.000Z",
    runId: "RUN-1",
    scenarioId: `SCN-${id}`,
    cacheKey: `CACHE-${id}`,
    source,
    model: "gemini-2.5-flash-lite",
    promptVersion: "trpg-narrative-v4.2",
    time: { day: 1, hour: 10, minute: 5 },
    place: { locationId: "田園の村", facilityName: "村の広場" },
    action: { id: "ACT-1", type: "talk" },
    presentNpcIds: ["NPC-1"],
    authoritativeOutcome: { kind: "conversation_started", summary: "会話開始" },
    rawFinal: "{\"narrative\":\"話した\"}",
    response: {
      narrative: "村人は静かに話し始めた。",
      choices: [
        { id: "C1", label: "聞く" },
        { id: "C2", label: "見る" },
        { id: "C3", label: "終える" },
      ],
      speeches: [{ actorId: "NPC-1", text: "知っていることを話そう。" }],
      proposals: [],
      proposalResolution: { accepted: [], rejected: [] },
    },
    validationErrors: [],
    repairCalls: 0,
    usedFallback: false,
    cacheHit: source === "replay_cache",
    latencyMs: 123,
    usage: { inputTokens: 100, outputTokens: 80, totalTokens: 180 },
    evaluation: { passed: true },
  };
}

test("narrative audit rows match the 36-column TRPG sheet contract", () => {
  const row = narrativeAuditRecordToSheetRow(record("R1"));
  assert.equal(row.length, 36);
  assert.equal(row[0], "R1");
  assert.equal(row[5], "gemini");
  assert.equal(row[18], "聞く");
  assert.equal(row[32], 180);
});

test("sheet sync appends only unsynced JSONL records", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "trpg-narrative-audit-"));
  const filePath = path.join(directory, "audit.jsonl");
  const cursorFilePath = path.join(directory, "cursor.json");
  const log = createNarrativeAuditLog({ filePath });
  await log.record(record("R1"));
  await log.record(record("R2", "replay_cache"));

  const appends = [];
  const sheets = {
    spreadsheets: {
      values: {
        async append(request) {
          appends.push(request.requestBody.values);
          return { data: { updates: { updatedRows: request.requestBody.values.length } } };
        },
      },
    },
  };

  const first = await syncNarrativeAuditToSheet({
    filePath,
    cursorFilePath,
    spreadsheetId: "SHEET",
    sheetName: "Gemini応答ログ",
    sheets,
  });
  assert.equal(first.synced, 2);
  assert.equal(appends.length, 1);
  assert.equal(appends[0].length, 2);

  const second = await syncNarrativeAuditToSheet({
    filePath,
    cursorFilePath,
    spreadsheetId: "SHEET",
    sheetName: "Gemini応答ログ",
    sheets,
  });
  assert.equal(second.synced, 0);
  assert.equal(appends.length, 1);
});
