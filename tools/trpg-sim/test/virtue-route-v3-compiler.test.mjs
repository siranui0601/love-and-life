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
  assert.equal(summary.autoResolvedRows, 583);
  assert.equal(summary.unresolvedRows, 248);
  assert.equal(summary.sourceRowCount, 831);
  assert.equal(summary.sourceColumnCount, 32);
  assert.equal(summary.sourceHash, "eb26d459851f7bcc8d9d159e6f86f5da016ce70cccbdbac329e9e684b4d14120");
  assert.equal(summary.forbiddenReplayExecuted, false);
});
