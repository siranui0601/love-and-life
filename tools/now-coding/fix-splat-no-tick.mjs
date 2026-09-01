import fs from "node:fs";

const modePath = "public/now-coding/modes.js";
let modes = fs.readFileSync(modePath, "utf8");
const oldRecovery = '    if (action === "turnLeft" || action === "turnRight" || action === "none") {';
const newRecovery = '    if (action === "turnLeft" || action === "turnRight") {';
if ((modes.split(oldRecovery).length - 1) !== 1) throw new Error("splat recovery anchor mismatch");
modes = modes.replace(oldRecovery, newRecovery);
fs.writeFileSync(modePath, modes, "utf8");

const testPath = "tools/now-coding/engine.test.mjs";
let tests = fs.readFileSync(testPath, "utf8");
const marker = 'test("splat invalid attack neither spends ink nor grants recovery",';
if (!tests.includes(marker)) {
  tests += `\n\ntest("splat invalid attack neither spends ink nor grants recovery", () => {\n  const attack = { type: "action", action: "attack", range: { type: "literal", value: 4 } };\n  const state = createGameState({\n    mode: "splat", seed: "no-ink-attack", size: 15, maxTicks: 20,\n    players: [{ id: "a", program: [attack] }, { id: "b", program: [{ type: "action", action: "turnRight" }] }],\n    spawns: [{ x: 5, y: 5, dir: 0 }, { x: 12, y: 12, dir: 2 }],\n  });\n  assert.equal(state.agents[0].ink, 0);\n  stepGame(state);\n  assert.equal(state.agents[0].ink, 0);\n  assert.equal(state.agents[0].x, 5);\n  assert.equal(state.agents[0].y, 5);\n});\n`;
}
fs.writeFileSync(testPath, tests, "utf8");
console.log("Splat invalid-attack no-tick semantics fixed.");
