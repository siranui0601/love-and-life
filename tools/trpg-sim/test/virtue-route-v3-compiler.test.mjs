import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { csvCell, parseCsv, sha256, verifyLocalSource } from "../export-virtue-route-v2-source.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const COMPILER = path.join(ROOT, "tools/trpg-sim/compile-virtue-route-v3.mjs");
const SOURCE = path.join(ROOT, "docs/trpg/virtue-route-v2-source.csv");

test("source exporter uses stable RFC4180 cells and SHA-256", () => {
  const line = [csvCell("plain"), csvCell("a,b"), csvCell('a"b'), csvCell("改行\nあり")].join(",");
  assert.equal(line, 'plain,"a,b","a""b","改行\nあり"');
  assert.deepEqual(parseCsv(`${line}\n`), [["plain", "a,b", 'a"b', "改行\nあり"]]);
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

async function compile(outDir) {
  execFileSync(process.execPath, [COMPILER, SOURCE, outDir], {
    cwd: ROOT,
    env: { ...process.env, GITHUB_SHA: "32dcdbd5121b235e80c186e81426302c602473fe" },
    stdio: "pipe",
  });
  return Promise.all([
    readFile(path.join(outDir, "virtue-route-v3-mapping.csv"), "utf8"),
    readFile(path.join(outDir, "virtue-route-v3-unresolved.json"), "utf8"),
    readFile(path.join(outDir, "virtue-route-v3-static-summary.json"), "utf8"),
    readFile(path.join(outDir, "virtue-route-v3-proposed-local-moves.json"), "utf8"),
  ]);
}

test("exported v2 source is bound to the canonical Sheet and hash", { skip: !existsSync(SOURCE) }, async () => {
  assert.deepEqual(await verifyLocalSource(), {
    rows: 831,
    columns: 32,
    sourceHash: "eb26d459851f7bcc8d9d159e6f86f5da016ce70cccbdbac329e9e684b4d14120",
    spreadsheetId: "1aSLu_pSLNsFsUm42juEyOrLDmTkJd7NPOOrQNnvnMwA",
    sheetName: "正規台帳",
  });
});

test("checkpoint compile is deterministic and does not execute replay", { skip: !existsSync(SOURCE) }, async (t) => {
  const firstDir = await mkdtemp(path.join(os.tmpdir(), "virtue-v3-first-"));
  const secondDir = await mkdtemp(path.join(os.tmpdir(), "virtue-v3-second-"));
  t.after(async () => Promise.all([
    rm(firstDir, { recursive: true, force: true }),
    rm(secondDir, { recursive: true, force: true }),
  ]));

  const [first, second] = await Promise.all([compile(firstDir), compile(secondDir)]);
  assert.deepEqual(first, second);

  const summary = JSON.parse(first[2]);
  assert.equal(summary.legacyRows, 831);
  assert.equal(summary.mappedRows, 831);
  assert.equal(summary.autoResolvedRows, 594);
  assert.equal(summary.unresolvedRows, 237);
  assert.equal(summary.provisionalCoveragePercent, 71.48);
  assert.equal(summary.exactAuthoredOverrideRows, 7);
  assert.equal(summary.canonicalJobsInCatalog, 28);
  assert.equal(summary.canonicalProductsInCatalog, 44);
  assert.equal(summary.unresolvedByReason.MISSING_MATERIAL_LINEAGE, 3);
  assert.equal(summary.unresolvedByReason.MISSING_LODGING_PRODUCT, 1);
  assert.equal(summary.unresolvedByReason.MISSING_CANONICAL_FOOD, undefined);
  assert.equal(summary.unresolvedByReason.MISSION_BATTLE_OR_AUTHORED_SPLIT, undefined);
  assert.equal(summary.unresolvedByReason.MISSING_DEBT_RUNTIME_ID, undefined);
  assert.equal(summary.sourceRowCount, 831);
  assert.equal(summary.sourceColumnCount, 32);
  assert.equal(summary.sourceHash, "eb26d459851f7bcc8d9d159e6f86f5da016ce70cccbdbac329e9e684b4d14120");
  assert.equal(summary.forbiddenReplayExecuted, false);

  const matrix = parseCsv(first[0]);
  const headers = matrix[0];
  const rows = matrix.slice(1).map((cells) => Object.fromEntries(
    headers.map((header, index) => [header, cells[index] ?? ""]),
  ));
  const byId = Object.fromEntries(rows.map((row) => [row.legacyRowId, row]));

  assert.deepEqual(
    JSON.parse(byId["VR2-D01-05"].replacementSteps).map((step) => step.actionId),
    [
      "ACTION:MSN-T01:search:tracks",
      "ACTION:MSN-T01:search:wolf-blockade",
      "ACTION:MSN-T01:rescue",
      "ACTION:MSN-T01:escort",
      "MISSION_FLOW:T01:HUMAN_ENTRY:RETURN_FINN_TO_SQUARE",
      "ACTION:MSN-T01:decide",
    ],
  );
  assert.equal(byId["VR2-D20-02"].actionId, "ACTION:MSN-T03:battle");
  assert.match(byId["VR2-D20-02"].resultingState, /ENC-0006/u);
  assert.ok(JSON.parse(byId["VR2-D20-04"].replacementSteps)
    .some((step) => step.actionId === "MISSION_FLOW:red-fang-migration:RESOLUTION:relocate_den:active"));
  assert.ok(JSON.parse(byId["VR2-D32-05"].replacementSteps)
    .some((step) => step.actionId === "MISSION_FLOW:pilgrim-transfer-disappearance:RESOLUTION:recover_then_pause:active"));
  for (const id of ["VR2-D52-04", "VR2-D52-09", "VR2-D53-01"]) {
    assert.equal(byId[id].actionId, "LIFE:EAT:ITM023");
  }
  assert.equal(byId["VR2-D52-11"].actionId, "LIFE:SLEEP:ITM195");
  assert.equal(byId["VR2-D20-08"].actionId, "MATERIAL_SELL:MAT_RED_FANG_LARGE:Q1");
  assert.match(byId["VR2-D20-08"].notes, /3G.*legacy \+9G/u);
  assert.equal(byId["VR2-D58-08"].actionId, "MATERIAL_SELL:MAT_KING_GEL_CORE:Q1");
  assert.equal(byId["VR2-D81-06"].actionId, "OBLIGATION:PAY:DEBT:EDA:ITM014:FULL");
});
