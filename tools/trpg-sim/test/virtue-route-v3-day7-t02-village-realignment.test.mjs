import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseCsv } from "../export-virtue-route-v2-source.mjs";
import { applyDay7T02VillageRealignment } from "../realign-virtue-route-v3-day7-t02-village.mjs";

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeFixture(dir) {
  const headers = [
    "legacyRowId", "classification", "commandType", "actionId", "choiceId", "payload",
    "replacementSteps", "replacementRowIds", "resolutionMethod", "status", "legacyDescription",
    "regionId", "facilityId", "requiredState", "resultingState", "implementationSource", "notes",
  ];
  const stale = [
    { actionId: "MOVE_REGION:交易都市", commandType: "MOVE", payload: { moveId: "MOVE_REGION:交易都市" } },
    { actionId: "MOVE_LOCAL:LOC_TRADE_GUILD", commandType: "MOVE", payload: { moveId: "MOVE_LOCAL:LOC_TRADE_GUILD" } },
    { actionId: "MISSION_FLOW:granary-arson:RESOLUTION:public_prosecution_and_contract_void:active", commandType: "CHOOSE", payload: {} },
    { actionId: "MOVE_REGION:田園の村", commandType: "MOVE", payload: { moveId: "MOVE_REGION:田園の村" } },
  ];
  const row = {
    legacyRowId: "VR2-D07-04",
    classification: "PLAYER_COMMAND_SEQUENCE",
    commandType: "SEQUENCE",
    actionId: stale.at(-1).actionId,
    payload: JSON.stringify({ steps: stale }),
    replacementSteps: JSON.stringify(stale),
    replacementRowIds: "VR2-D07-04:S01|VR2-D07-04:S02|VR2-D07-04:S03|VR2-D07-04:S04",
    status: "RESOLVED_EXISTING",
  };
  fs.writeFileSync(path.join(dir, "virtue-route-v3-mapping.csv"), `${headers.join(",")}\n${headers.map((header) => csvCell(row[header])).join(",")}\n`);
  fs.writeFileSync(path.join(dir, "virtue-route-v3-static-summary.json"), `${JSON.stringify({ expandedV3Rows: 1521 }, null, 2)}\n`);
}

test("Day7 T02 stale Trade City roundtrip is replaced 4-to-4 by village production actions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "t02-day7-village-"));
  try {
    writeFixture(dir);
    const output = applyDay7T02VillageRealignment({ outDir: dir });
    assert.equal(output.expandedV3Rows, 1521);

    const matrix = parseCsv(fs.readFileSync(path.join(dir, "virtue-route-v3-mapping.csv"), "utf8"));
    const headers = matrix[0];
    const row = Object.fromEntries(headers.map((header, index) => [header, matrix[1][index] ?? ""]));
    const steps = JSON.parse(row.replacementSteps);
    assert.equal(steps.length, 4);
    assert.deepEqual(steps.map((step) => step.actionId), [
      "MOVE_LOCAL:LOC_FARM_GRANARY",
      "T02_GRANARY:RESOLUTION:REVIEW_CONTRACT_AND_TESTIMONY",
      "MISSION_FLOW:granary-arson:RESOLUTION:public_prosecution_and_contract_void:active",
      "T02_GRANARY:RESOLUTION:RECORD_DALK_PROTECTION_AND_REBUILD",
    ]);
    assert.equal(steps.some((step) => step.actionId.startsWith("MOVE_REGION:")), false);
    assert.equal(row.regionId, "田園の村");
    assert.equal(row.facilityId, "LOC_FARM_GRANARY");
    assert.match(row.notes, /no WAIT\/REST padding/u);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
