import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { csvCell, parseCsv, sha256, verifyLocalSource } from "../export-virtue-route-v2-source.mjs";
import { AUTHORED_MISSION_FLOW_PACKS } from "../../../src/server/trpg/content/authored-mission-flow-registry-t17-final.js";

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
  assert.equal(summary.autoResolvedRows, 831);
  assert.equal(summary.unresolvedRows, 0);
  assert.equal(summary.provisionalCoveragePercent, 100);
  assert.equal(summary.compilerVersion, "virtue-route-v3-static-compiler-v6");
  assert.equal(summary.exactAuthoredOverrideRows, 110);
  assert.equal(summary.provisionPurchaseRows, 104);
  assert.equal(summary.provisionPurchaseCommands, 109);
  assert.equal(summary.remoteProvisionMealsCovered, 27);
  assert.equal(summary.carriedProvisionSubstitutions, 24);
  assert.deepEqual(summary.finalProvisionInventory, {
    ITM008: 0, ITM082: 0, ITM072: 0, ITM163: 0,
    ITM179: 0, ITM192: 0, ITM023: 0, ITM205: 0,
  });
  assert.equal(summary.workerLodgingTotalRows, 20);
  assert.deepEqual(summary.workerLodgingRejectedLegacyRows, ["VR2-D48-10"]);
  assert.equal(summary.extraWorkRows, 37);
  assert.equal(summary.extraWorkCommands, 40);
  assert.equal(summary.extraWorkIncome, 132);
  assert.equal(summary.proposedMoveLocalInsertions, 336);
  assert.equal(summary.expandedV3Rows, 1526);
  assert.equal(summary.canonicalJobsInCatalog, 28);
  assert.equal(summary.canonicalProductsInCatalog, 44);
  assert.deepEqual(summary.unresolvedByReason, {});
  assert.equal(summary.unresolvedByReason.MISSING_MATERIAL_LINEAGE, undefined);
  assert.equal(summary.unresolvedByReason.MISSING_LODGING_PRODUCT, undefined);
  assert.equal(summary.unresolvedByReason.MISSING_CANONICAL_FOOD, undefined);
  assert.equal(summary.unresolvedByReason.MISSION_BATTLE_OR_AUTHORED_SPLIT, undefined);
  assert.equal(summary.unresolvedByReason.MISSING_AUTHORED_MISSION_MATCH, undefined);
  assert.equal(summary.unresolvedByReason.MISSING_DEBT_RUNTIME_ID, undefined);
  assert.equal(summary.sourceRowCount, 831);
  assert.equal(summary.sourceColumnCount, 32);
  assert.equal(summary.sourceHash, "eb26d459851f7bcc8d9d159e6f86f5da016ce70cccbdbac329e9e684b4d14120");
  assert.equal(summary.forbiddenStatusRows, 0);
  assert.equal(summary.nonFinalStatusRows, 0);
  assert.equal(summary.forbiddenReplayExecuted, false);

  const matrix = parseCsv(first[0]);
  const headers = matrix[0];
  const rows = matrix.slice(1).map((cells) => Object.fromEntries(
    headers.map((header, index) => [header, cells[index] ?? ""]),
  ));
  const byId = Object.fromEntries(rows.map((row) => [row.legacyRowId, row]));
  const stepIds = (rowId) => JSON.parse(byId[rowId].replacementSteps).map((step) => step.actionId);

  assert.equal(byId["VR2-D01-01"].actionId, "LIFE:EAT:ITM003");
  assert.equal(byId["VR2-D01-04"].classification, "NARRATIVE_OUTCOME");
  assert.equal(byId["VR2-D01-08"].classification, "NARRATIVE_OUTCOME");
  assert.match(byId["VR2-D01-04"].notes, /does not invent/u);

  for (const row of rows.filter((entry) => entry.status === "OUTCOME")) {
    assert.ok(row.implementationSource, `${row.legacyRowId} outcome needs an implementation source`);
    assert.ok(row.resultingState, `${row.legacyRowId} outcome needs a concrete resulting state`);
    assert.ok(row.notes, `${row.legacyRowId} outcome needs a reason why no second command exists`);
  }

  for (const row of rows) {
    const steps = row.replacementSteps
      ? JSON.parse(row.replacementSteps)
      : [{ commandType: row.commandType, actionId: row.actionId, payload: JSON.parse(row.payload || "{}") }];
    for (const step of steps) {
      if (step.commandType === "LEARN_SKILL") assert.equal(step.actionId, step.payload.skillId);
      if (step.commandType === "SHOP_BUY") assert.equal(step.actionId, step.payload.stockId);
      if (step.commandType === "SHOP_SELL") assert.equal(step.actionId, step.payload.equipmentId);
      if (step.commandType === "EQUIP") assert.equal(step.actionId, step.payload.equipmentId);
      if (step.commandType === "UNEQUIP") assert.equal(step.actionId, step.payload.slot);
    }
  }

  const runtimeCatalog = JSON.parse(await readFile(
    path.join(ROOT, "tools/trpg-sim/lib/virtue-route-v3-runtime-catalog.json"),
    "utf8",
  ));
  const products = new Map(runtimeCatalog.products.map((product) => [product.productId, product]));
  const provisions = {};
  for (const row of rows) {
    const steps = row.replacementSteps
      ? JSON.parse(row.replacementSteps)
      : [{ actionId: row.actionId }];
    for (const step of steps) {
      if (step.actionId?.startsWith("LIFE:BUY:")) {
        const productId = step.actionId.split(":").at(-1);
        const product = products.get(productId);
        if (product?.kind === "provision") {
          provisions[productId] = Number(provisions[productId] ?? 0) + Number(product.portions ?? 1);
        }
      }
      if (step.actionId?.startsWith("LIFE:EAT:")) {
        const productId = step.actionId.split(":").at(-1);
        const product = products.get(productId);
        if (product?.kind === "provision") {
          provisions[productId] = Number(provisions[productId] ?? 0) - 1;
          assert.ok(provisions[productId] >= 0, `${row.legacyRowId} consumes unowned ${productId}`);
        }
      }
    }
  }

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
  assert.deepEqual(stepIds("VR2-D01-07"), [
    "MISSION_FLOW:T01:SQUARE_AFTERCARE:help_mira",
    "MISSION_FLOW:T01:SQUARE_SUPPER:share_bread",
  ]);
  assert.equal(byId["VR2-D01-10"].actionId, "MISSION_FLOW:T01:VILLAGE_NIGHT:sleep_at_miras");
  assert.deepEqual(stepIds("VR2-D02-02"), [
    "MISSION_FLOW:T01:DAY2_MERCHANT:help_unload",
    "MISSION_FLOW:T01:DAY2_MERCHANT_PAYMENT:take_three_gold",
    "MISSION_FLOW:T01:DAY2_MERCHANT_STALL:take_hunter_parcel",
    "MISSION_FLOW:T01:DAY2_MERCHANT_FOLLOWUP:t01-day2-hunter-parcel:leave_for_hut",
    "MISSION_FLOW:T01:DAY2_HUNTER_HUT:repair_snare",
    "MISSION_FLOW:T01:DAY2_HUNTER_LUNCH:send_warning",
  ]);
  assert.deepEqual(stepIds("VR2-D02-04"), [
    "MISSION_FLOW:T01:DAY2_VILLAGE_WARNING:inspect_warning_bells",
    "MISSION_FLOW:T01:DAY2_VILLAGE_WATCH:circulate_watch_tags",
  ]);
  const equipmentSteps = JSON.parse(byId["VR2-D03-09"].replacementSteps);
  assert.deepEqual(equipmentSteps.map((step) => [step.commandType, step.actionId, step.payload.equipmentId]), [
    ["EQUIP", "EQP-W-0201", "EQP-W-0201"],
    ["EQUIP", "EQP-S-0001", "EQP-S-0001"],
  ]);
  assert.match(byId["VR2-D03-09"].notes, /no canonical loanId/u);
  assert.equal(byId["VR2-D08-06"].classification, "NARRATIVE_OUTCOME");
  assert.equal(byId["VR2-D08-08"].actionId, "LIFE:REST:90");
  assert.deepEqual(stepIds("VR2-D08-09"), [
    "MOVE_LOCAL:LOC_FARM_NORTH_FENCE",
    "WORK:FACILITY:JOB-FARM-04",
    "MISSION_FLOW:T03:DAY8_FIRST_HOWL:call_jill_to_fence",
    "MISSION_FLOW:T03:DAY8_NIGHT_VIGIL:keep_written_watch_until_dawn",
    "MISSION_FLOW:T03:DAY8_COMMUNITY:serve_watch_breakfast",
  ]);
  assert.equal(byId["VR2-D08-09"].jobId, "JOB-FARM-04");
  assert.equal(byId["VR2-D08-09"].plannedStart, "17:30");
  assert.equal(byId["VR2-D08-09"].plannedEnd, "05:38(+1)");
  assert.deepEqual(JSON.parse(byId["VR2-D08-09"].replacementSteps).map((step) => [step.scheduledStart, step.scheduledEnd]), [
    ["17:30", "17:54"], ["18:00", "22:00"], ["22:00", "22:40"],
    ["22:40", "05:10(+1)"], ["05:10(+1)", "05:38(+1)"],
  ]);
  assert.deepEqual(stepIds("VR2-D11-08"), ["WORK:FACILITY:JOB-TRADE-02", "LIFE:EAT:ITM082"]);
  assert.equal(byId["VR2-D11-09"].actionId, "LIFE:REST:60");
  assert.equal(byId["VR2-D11-10"].actionId, "LIFE:SLEEP:ITM222");
  assert.equal(byId["VR2-D48-10"].actionId, "LIFE:SLEEP:ITM076");
  assert.equal(byId["VR2-D19-08"].actionId, "LIFE:EAT:ITM003");
  assert.ok(stepIds("VR2-D19-09").includes("WORK:FACILITY:JOB-FARM-03"));
  assert.equal(byId["VR2-D20-02"].actionId, "ACTION:MSN-T03:battle");
  assert.match(byId["VR2-D20-02"].resultingState, /ENC-0006/u);
  assert.ok(JSON.parse(byId["VR2-D20-04"].replacementSteps)
    .some((step) => step.actionId === "MISSION_FLOW:red-fang-migration:RESOLUTION:relocate_den:active"));
  assert.ok(JSON.parse(byId["VR2-D32-05"].replacementSteps)
    .some((step) => step.actionId === "MISSION_FLOW:pilgrim-transfer-disappearance:RESOLUTION:recover_then_pause:active"));
  assert.deepEqual(stepIds("VR2-D05-02"), [
    "MISSION_FLOW:T02:T02_GRANARY_DAWN:rope_the_scene",
    "MISSION_FLOW:T02:T02_DAWN_SCENE_RECORD:trace_oil",
  ]);
  assert.equal(byId["VR2-D06-02"].actionId, "T02_GRANARY:EVIDENCE:CONTRACT:LEDGER_GAP");
  assert.equal(byId["VR2-D07-02"].actionId, "T02_GRANARY:EVIDENCE:HAND:BOOT_ASH");
  assert.ok(stepIds("VR2-D07-04")
    .includes("MISSION_FLOW:granary-arson:RESOLUTION:public_prosecution_and_contract_void:active"));
  assert.deepEqual(stepIds("VR2-D32-03").filter((id) => id.includes(":EVIDENCE:")), [
    "MISSION_FLOW:pilgrim-transfer-disappearance:EVIDENCE:concealed_records",
    "MISSION_FLOW:pilgrim-transfer-disappearance:EVIDENCE:corridor_resonance",
    "MISSION_FLOW:pilgrim-transfer-disappearance:EVIDENCE:pilgrim_route",
  ]);
  assert.ok(stepIds("VR2-D38-02").includes("ACTION:MSN-T05:battle"));
  assert.ok(stepIds("VR2-D38-02")
    .includes("MISSION_FLOW:trade-lord-poisoning:RESOLUTION:protect_nicolas_and_treat:active"));
  assert.ok(stepIds("VR2-D44-05")
    .includes("MISSION_FLOW:port-labor-unrest:RESOLUTION:worker_cooperative_and_smuggling_watch:active"));
  assert.ok(stepIds("VR2-D45-09")
    .includes("MISSION_FLOW:northern-fortress-false-flag:RESOLUTION:joint_border_inquiry_and_nonaggression_line:active"));
  assert.equal(byId["VR2-D48-03"].actionId, "ACTION:MSN-T07:battle");
  assert.equal(byId["VR2-D51-08"].actionId,
    "MISSION_FLOW:runaway-elf-trafficking:RESOLUTION:voluntary_return_with_youth_charter:active");
  assert.equal(byId["VR2-D58-05"].actionId,
    "MISSION_FLOW:forest-king-slime-world-tree-collapse:RESOLUTION:sever_core_restore_river_and_seal:active");
  assert.ok(stepIds("VR2-D41-04").includes(
    "MISSION_FLOW:capital-second-summoning:RESOLUTION:royal_public_suspension_and_living_witness",
  ));
  assert.ok(stepIds("VR2-D78-02").includes(
    "MISSION_FLOW:capital-persecution-riot:RESOLUTION:public_retraction_and_legal_accountability",
  ));

  const allActionIds = rows.flatMap((row) => [
    row.actionId,
    ...(row.replacementSteps ? JSON.parse(row.replacementSteps).map((step) => step.actionId) : []),
  ]).filter(Boolean);
  const packById = new Map(AUTHORED_MISSION_FLOW_PACKS.map((pack) => [pack.id, pack]));
  const statusless = new Set(["capital-persecution-riot", "capital-second-summoning"]);
  for (const actionId of allActionIds.filter((id) => /^MISSION_FLOW:[^:]+:RESOLUTION:/u.test(id))) {
    const [, packId, , routeId, troubleStatus] = actionId.split(":");
    const pack = packById.get(packId);
    assert.ok(pack, `missing authored pack for ${actionId}`);
    assert.ok(pack.resolution.choices.some((choice) => choice.id === routeId),
      `missing authored route for ${actionId}`);
    if (statusless.has(packId)) assert.equal(troubleStatus, undefined, `${actionId} must be statusless`);
    else assert.ok(["active", "critical"].includes(troubleStatus), `${actionId} needs live trouble status`);
  }
  for (const id of ["VR2-D52-04", "VR2-D52-09", "VR2-D53-01"]) {
    assert.equal(byId[id].actionId, "LIFE:EAT:ITM023");
  }
  assert.equal(byId["VR2-D52-11"].actionId, "LIFE:SLEEP:ITM195");
  assert.equal(byId["VR2-D20-08"].actionId, "MATERIAL_SELL:MAT_RED_FANG_LARGE:Q1");
  assert.match(byId["VR2-D20-08"].notes, /3G.*legacy \+9G/u);
  assert.equal(byId["VR2-D58-08"].actionId, "MATERIAL_SELL:MAT_KING_GEL_CORE:Q1");
  for (const [rowId, removedGold] of [["VR2-D28-06", 8], ["VR2-D32-09", 13], ["VR2-D47-06", 9]]) {
    assert.equal(byId[rowId].classification, "NARRATIVE_OUTCOME");
    assert.equal(byId[rowId].status, "OUTCOME");
    assert.equal(byId[rowId].resolutionMethod, "EXACT_CANONICAL");
    assert.match(byId[rowId].resultingState, /gold\+=0/u);
    assert.match(byId[rowId].resultingState, new RegExp(`\\+${removedGold}G`));
  }
  assert.equal(byId["VR2-D81-06"].actionId, "OBLIGATION:PAY:DEBT:EDA:ITM014:FULL");

  const jobs = new Map(runtimeCatalog.jobs.map((job) => [job.jobId, job]));
  const workedFacilityDays = new Map();
  const portWorkDays = new Set();
  for (const row of rows) {
    for (const step of (row.replacementSteps ? JSON.parse(row.replacementSteps) : [{ actionId: row.actionId }])) {
      if (!step.actionId?.startsWith("WORK:FACILITY:")) continue;
      const jobId = step.actionId.slice("WORK:FACILITY:".length);
      const job = jobs.get(jobId);
      assert.ok(job, `${row.legacyRowId} uses missing ${jobId}`);
      const key = `${row.legacyDay}|${job.facilityId}`;
      assert.equal(workedFacilityDays.has(key), false, `${row.legacyRowId} repeats work at ${key}`);
      workedFacilityDays.set(key, row.legacyRowId);
      if (["JOB-TRADE-01", "JOB-TRADE-02"].includes(jobId)) portWorkDays.add(row.legacyDay);
    }
  }
  for (const row of rows.filter((entry) => entry.actionId === "LIFE:SLEEP:ITM222")) {
    assert.ok(portWorkDays.has(row.legacyDay), `${row.legacyRowId} uses worker lodging without same-day port work`);
  }
});
