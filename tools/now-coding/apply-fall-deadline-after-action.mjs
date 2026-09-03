import fs from "node:fs";

const path = "public/now-coding/modes.js";
let source = fs.readFileSync(path, "utf8");

const before = `  // A tile disappears at the start of the tick exactly two ticks after it was\n  // first stepped on. The first visit owns the deadline; revisiting the tile\n  // never extends its lifetime.\n  collapseDueFallCells(state);\n\n  const actions = new Map();`;
const after = `  const actions = new Map();`;
if (!source.includes(before)) throw new Error("fall_start_collapse_block_not_found");
source = source.replace(before, after);

const beforeEnd = `    scheduleFallCollapse(state, agent.x, agent.y);\n  }\n  finishSurvival(state);\n  return state;\n}\n\nfunction createSplatState`;
const afterEnd = `    scheduleFallCollapse(state, agent.x, agent.y);\n  }\n\n  // The deadline tick is still playable. Sensors and the physical action run\n  // first, then every due tile becomes a cliff. A piece that escapes on this\n  // tick survives; a piece that remains on the tile is eliminated.\n  collapseDueFallCells(state);\n  finishSurvival(state);\n  return state;\n}\n\nfunction createSplatState`;
if (!source.includes(beforeEnd)) throw new Error("fall_end_anchor_not_found");
source = source.replace(beforeEnd, afterEnd);

fs.writeFileSync(path, source);
