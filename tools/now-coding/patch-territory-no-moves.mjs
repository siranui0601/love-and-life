import fs from "node:fs";

const enginePath = "public/now-coding/engine.js";
const testPath = "tools/now-coding/engine.test.mjs";
let engine = fs.readFileSync(enginePath, "utf8");

const anchor = `function allCellsClaimed(state) {\n  return state.board.every((row) => !row.includes(-1));\n}\n`;
const replacement = `function allCellsClaimed(state) {\n  return state.board.every((row) => !row.includes(-1));\n}\n\nfunction hasLegalTerritoryMove(state, agent) {\n  if (!agent.alive) return false;\n  const ownIndex = state.agents.indexOf(agent);\n  return DIRECTIONS.some((vector) => {\n    const x = agent.x + vector.x;\n    const y = agent.y + vector.y;\n    if (x < 0 || y < 0 || x >= state.size || y >= state.size) return false;\n    if (headAt(state, x, y, agent.id)) return false;\n    const owner = state.board[y][x];\n    return owner < 0 || owner === ownIndex;\n  });\n}\n\nfunction noAliveAgentCanMove(state) {\n  const alive = state.agents.filter((agent) => agent.alive);\n  return alive.length > 0 && alive.every((agent) => !hasLegalTerritoryMove(state, agent));\n}\n`;
if (!engine.includes(anchor)) throw new Error("allCellsClaimed anchor missing");
engine = engine.replace(anchor, () => replacement);

const finishAnchor = `  } else if (!state.agents.some((agent) => agent.alive)) {\n    state.finished = true;\n    state.finishReason = "all_dead";\n  } else if (state.ticksSinceCapture >= state.stagnationTicks) {`;
const finishReplacement = `  } else if (!state.agents.some((agent) => agent.alive)) {\n    state.finished = true;\n    state.finishReason = "all_dead";\n  } else if (noAliveAgentCanMove(state)) {\n    state.finished = true;\n    state.finishReason = "no_moves";\n  } else if (state.ticksSinceCapture >= state.stagnationTicks) {`;
if (!engine.includes(finishAnchor)) throw new Error("finish anchor missing");
engine = engine.replace(finishAnchor, () => finishReplacement);
fs.writeFileSync(enginePath, engine);

let tests = fs.readFileSync(testPath, "utf8");
const marker = `test("territory ends when every surviving piece has no legal adjacent move", () => {`;
if (!tests.includes(marker)) {
  tests += `\n\ntest("territory ends when every surviving piece has no legal adjacent move", () => {\n  const state = createTerritoryState({\n    seed: "boxed-in",\n    size: 9,\n    maxTicks: 100,\n    stagnationTicks: 100,\n    allowSolo: true,\n    players: [{ id: "me", name: "me", color: "blue", program: [right] }],\n    spawns: [{ x: 4, y: 4, dir: 0 }],\n  });\n  const me = state.agents[0];\n  for (const [x, y] of [[4,3],[5,4],[4,5],[3,4]]) state.board[y][x] = 1;\n  stepTerritory(state);\n  assert.equal(me.alive, true);\n  assert.equal(state.finished, true);\n  assert.equal(state.finishReason, "no_moves");\n});\n\ntest("territory does not end for no-moves while another surviving piece still has a legal move", () => {\n  const state = createTerritoryState({\n    seed: "one-boxed",\n    size: 9,\n    maxTicks: 100,\n    stagnationTicks: 100,\n    players: [\n      { id: "a", name: "A", color: "blue", program: [right] },\n      { id: "b", name: "B", color: "red", program: [right] },\n    ],\n    spawns: [{ x: 2, y: 2, dir: 0 }, { x: 6, y: 6, dir: 0 }],\n  });\n  for (const [x, y] of [[2,1],[3,2],[2,3],[1,2]]) state.board[y][x] = 1;\n  stepTerritory(state);\n  assert.equal(state.finished, false);\n});\n`;
}
fs.writeFileSync(testPath, tests);
console.log("territory no-moves patch applied");
