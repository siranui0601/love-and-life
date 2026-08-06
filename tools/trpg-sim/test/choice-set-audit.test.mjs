import test from "node:test";
import assert from "node:assert/strict";
import {
  choiceSetSignature,
  createChoiceSetAudit,
  finalizeChoiceSetAudit,
  inspectChoiceSetBeforeSelection,
  recordChoiceSetSelection,
} from "../lib/choice-set-audit.mjs";

function save(actionIds) {
  return {
    clock: { day: 12, time: "14:30", absoluteMinute: 16590 },
    scene: { location: "森", facilityId: "LOC_FOREST_EDGE" },
    choices: actionIds.map((actionId, index) => ({
      actionId,
      label: `選択肢${index + 1}`,
    })),
  };
}

test("choice set signature ignores display order", () => {
  assert.equal(
    choiceSetSignature(save(["ACTION:C", "ACTION:A", "ACTION:B"])),
    choiceSetSignature(save(["ACTION:B", "ACTION:C", "ACTION:A"])),
  );
});

test("a displayed set becomes consumed only after an accepted selection", () => {
  const audit = createChoiceSetAudit();
  const first = inspectChoiceSetBeforeSelection(audit, save(["A", "B", "C"]));
  assert.equal(first.duplicate, false);
  recordChoiceSetSelection(audit, first.signature, false);
  assert.equal(inspectChoiceSetBeforeSelection(audit, save(["A", "B", "C"])).duplicate, false);

  recordChoiceSetSelection(audit, first.signature, true);
  assert.equal(inspectChoiceSetBeforeSelection(audit, save(["A", "B", "C"])).duplicate, true);
});

test("one repeated choice set blocks route quality", () => {
  const audit = createChoiceSetAudit();
  const first = inspectChoiceSetBeforeSelection(audit, save(["A", "B", "C"]));
  recordChoiceSetSelection(audit, first.signature, true);
  inspectChoiceSetBeforeSelection(audit, save(["C", "A", "B"]));
  const report = finalizeChoiceSetAudit(audit);

  assert.equal(report.consumedCount, 1);
  assert.equal(report.duplicateEncounterCount, 1);
  assert.equal(report.duplicateUniqueSetCount, 1);
  assert.equal(report.passed, false);
  assert.equal(report.duplicateExamples[0].location, "森");
});
