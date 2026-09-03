import test from "node:test";
import assert from "node:assert/strict";
import {
  repairTutorialBlocks,
  tutorialExpressionSlotAllowed,
  tutorialScaffoldBlocks,
} from "../../public/now-coding/tutorial-recovery.js";

function parts(blocks) {
  const forever = blocks.find((block) => block?.type === "forever");
  const body = forever?.body || [];
  return {
    forever,
    body,
    conditional: body.find((block) => block?.type === "if"),
    move: body.find((block) => block?.type === "action" && block.action === "move"),
  };
}

test("resume scaffold rebuilds the code required before each tutorial step", () => {
  assert.deepEqual(tutorialScaffoldBlocks(1), []);
  assert.equal(tutorialScaffoldBlocks(2)[0]?.action, "move");

  const step7 = parts(tutorialScaffoldBlocks(7));
  assert.ok(step7.forever);
  assert.ok(step7.move);
  assert.equal(step7.conditional?.condition?.type, "binary");
  assert.equal(step7.conditional.condition.left, null);
  assert.equal(step7.conditional.condition.right, null);

  const step8 = parts(tutorialScaffoldBlocks(8));
  assert.equal(step8.conditional.condition.left?.type, "sensor");
  assert.equal(step8.conditional.condition.left?.direction, "front");
  assert.equal(step8.conditional.condition.right, null);

  const step10 = parts(tutorialScaffoldBlocks(10));
  assert.equal(step10.conditional.condition.right?.value, "cliff");
  assert.ok(step10.conditional.then.some((block) => block.action === "turnRight"));
});

test("resume repairs the exact cliff-in-left-slot dead end without skipping the step", () => {
  const broken = tutorialScaffoldBlocks(7);
  const conditional = parts(broken).conditional;
  conditional.condition.left = { type: "literal", value: "cliff" };

  const repaired = repairTutorialBlocks(broken, 7);
  const condition = parts(repaired).conditional.condition;
  assert.equal(condition.left, null, "the left slot must be free for the highlighted front sensor");
  assert.equal(condition.right, null);
});

test("resume keeps completed prerequisites while freeing a wrong current target", () => {
  const broken = tutorialScaffoldBlocks(8);
  const conditional = parts(broken).conditional;
  conditional.condition.right = { type: "literal", value: 99 };

  const repaired = repairTutorialBlocks(broken, 8);
  const condition = parts(repaired).conditional.condition;
  assert.equal(condition.left?.type, "sensor");
  assert.equal(condition.left?.direction, "front");
  assert.equal(condition.right, null);
});

test("missing tutorial code is reconstructed from server-side progress", () => {
  const repaired = repairTutorialBlocks([], 9);
  const { conditional, move } = parts(repaired);
  assert.ok(move);
  assert.equal(conditional.condition.left?.direction, "front");
  assert.equal(conditional.condition.right?.value, "cliff");
});

test("tutorial expression placement only accepts the instructed comparison side", () => {
  assert.equal(tutorialExpressionSlotAllowed(7, "sensor", "left"), true);
  assert.equal(tutorialExpressionSlotAllowed(7, "sensor", "right"), false);
  assert.equal(tutorialExpressionSlotAllowed(8, "cellState", "right"), true);
  assert.equal(tutorialExpressionSlotAllowed(8, "cellState", "left"), false);
  assert.equal(tutorialExpressionSlotAllowed(5, "sensor", "right"), true, "normal editing stays unrestricted outside the guarded tutorial steps");
});
