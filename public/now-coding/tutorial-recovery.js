const moveBlock = () => ({ type: "action", action: "move" });
const turnBlock = () => ({ type: "action", action: "turnRight", uiKind: "turn" });
const compareBlock = (left = null, right = null) => ({ type: "binary", op: "==", left, right });
const frontSensor = () => ({ type: "sensor", direction: "front" });
const cliffLiteral = () => ({ type: "literal", value: "cliff" });
const ifBlock = (condition = null, then = []) => ({ type: "if", condition, then, else: [] });
const foreverBlock = (body = []) => ({ type: "forever", body });

function clone(value) {
  return structuredClone(value);
}

function tutorialParts(blocks) {
  const root = Array.isArray(blocks) ? blocks : [];
  const foreverIndex = root.findIndex((block) => block?.type === "forever");
  const forever = foreverIndex >= 0 ? root[foreverIndex] : null;
  const body = Array.isArray(forever?.body) ? forever.body : [];
  const moveIndex = body.findIndex((block) => block?.type === "action" && block.action === "move");
  const ifIndex = body.findIndex((block) => block?.type === "if");
  const conditional = ifIndex >= 0 ? body[ifIndex] : null;
  return { root, foreverIndex, forever, body, moveIndex, ifIndex, conditional };
}

function isCompare(expr) {
  return expr?.type === "binary" && ["==", "!=", "<", "<=", ">", ">="].includes(expr.op);
}

function isFront(expr) {
  return expr?.type === "sensor" && expr.direction === "front";
}

function isCliff(expr) {
  return expr?.type === "literal" && expr.value === "cliff";
}

function hasMoveAnywhere(blocks) {
  const root = Array.isArray(blocks) ? blocks : [];
  return root.some((block) => block?.type === "action" && block.action === "move") || tutorialParts(root).moveIndex >= 0;
}

function hasPrerequisites(blocks, step) {
  if (step <= 1) return true;
  if (step <= 3) return hasMoveAnywhere(blocks);
  const parts = tutorialParts(blocks);
  if (!parts.forever || parts.moveIndex < 0) return false;
  if (step <= 5) return true;
  if (!parts.conditional || parts.ifIndex > parts.moveIndex) return false;
  if (step === 6) return true;
  if (!isCompare(parts.conditional.condition)) return false;
  if (step === 7) return true;
  if (!isFront(parts.conditional.condition.left)) return false;
  if (step === 8) return true;
  if (!isCliff(parts.conditional.condition.right)) return false;
  if (step === 9) return true;
  return (parts.conditional.then || []).some((block) => block?.type === "action" && ["turnLeft", "turnRight"].includes(block.action));
}

export function tutorialScaffoldBlocks(stepValue = 0) {
  const step = Math.max(0, Math.floor(Number(stepValue) || 0));
  if (step <= 1) return [];
  if (step <= 3) return [moveBlock()];
  if (step <= 5) return [foreverBlock([moveBlock()])];
  if (step === 6) return [foreverBlock([ifBlock(null), moveBlock()])];
  if (step === 7) return [foreverBlock([ifBlock(compareBlock()), moveBlock()])];
  if (step === 8) return [foreverBlock([ifBlock(compareBlock(frontSensor(), null)), moveBlock()])];
  if (step === 9) return [foreverBlock([ifBlock(compareBlock(frontSensor(), cliffLiteral())), moveBlock()])];
  return [foreverBlock([ifBlock(compareBlock(frontSensor(), cliffLiteral()), [turnBlock()]), moveBlock()])];
}

export function repairTutorialBlocks(blocks, stepValue = 0) {
  const step = Math.max(0, Math.floor(Number(stepValue) || 0));
  let next = clone(Array.isArray(blocks) ? blocks : []);
  if (!hasPrerequisites(next, step)) next = tutorialScaffoldBlocks(step);

  const parts = tutorialParts(next);
  const condition = parts.conditional?.condition;

  // Current-step mistakes must never occupy the slot required by the tutorial.
  if (step === 6 && condition != null && !isCompare(condition)) {
    parts.conditional.condition = null;
  }
  if (step === 7 && isCompare(condition)) {
    if (condition.left != null && !isFront(condition.left)) condition.left = null;
    if (condition.right != null && !isCliff(condition.right)) condition.right = null;
  }
  if (step === 8 && isCompare(condition) && condition.right != null && !isCliff(condition.right)) {
    condition.right = null;
  }
  return next;
}

export function tutorialExpressionSlotAllowed(stepValue, preset, slotRole) {
  const step = Math.max(0, Math.floor(Number(stepValue) || 0));
  if (step === 7 && preset === "sensor") return slotRole === "left";
  if (step === 8 && preset === "cellState") return slotRole === "right";
  return true;
}
