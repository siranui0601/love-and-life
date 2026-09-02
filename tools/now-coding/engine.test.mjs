import test from "node:test";
import assert from "node:assert/strict";
import {
  createTerritoryState,
  decideAction,
  makeNpcProgram,
  runTerritoryToEnd,
  stepTerritory,
} from "../../public/now-coding/engine.js";
import { createGameState, gameResults, makeTestNpcProgram, senseModeCell, stepGame } from "../../public/now-coding/modes.js";
import { evaluateVmExpression } from "../../public/now-coding/vm.js";
import { createBattleSpawns, createBoardDefinition, createRandomSpawns, isPlayableCell, resolveBoardChoice } from "../../public/now-coding/boards.js";

const move = { type: "action", action: "move" };
const right = { type: "action", action: "turnRight" };
const left = { type: "action", action: "turnLeft" };
const literal = (value) => ({ type: "literal", value });

function stateWithPrograms(aProgram, bProgram = [right], spawns = [{ x: 2, y: 2, dir: 1 }, { x: 12, y: 12, dir: 3 }]) {
  return createTerritoryState({
    seed: "test-seed",
    size: 15,
    maxTicks: 40,
    players: [
      { id: "a", name: "A", color: "blue", program: aProgram },
      { id: "b", name: "B", color: "red", program: bProgram },
    ],
    spawns,
  });
}

test("same seed and programs produce the same territory result", () => {
  const config = {
    seed: "fixed-seed",
    size: 15,
    maxTicks: 120,
    players: [
      { id: "a", name: "A", color: "blue", program: [{ type: "forever", body: [move, right] }] },
      { id: "b", name: "B", color: "red", program: [{ type: "forever", body: [move, left] }] },
    ],
  };
  const first = runTerritoryToEnd(config);
  const second = runTerritoryToEnd(config);
  assert.deepEqual(first.results, second.results);
  assert.deepEqual(first.state.board, second.state.board);
  assert.equal(first.state.tick, second.state.tick);
});

test("turning consumes a tick without moving", () => {
  const state = stateWithPrograms([right]);
  const before = { x: state.agents[0].x, y: state.agents[0].y, dir: state.agents[0].dir };
  stepTerritory(state);
  assert.equal(state.tick, 1);
  assert.equal(state.agents[0].x, before.x);
  assert.equal(state.agents[0].y, before.y);
  assert.equal(state.agents[0].dir, (before.dir + 1) % 4);
});

test("a top-level one-step program halts instead of wrapping forever", () => {
  const state = stateWithPrograms([move]);
  const agent = state.agents[0];
  assert.equal(decideAction(state, agent), "move");
  assert.equal(decideAction(state, agent), "none");
  assert.equal(decideAction(state, agent), "none");
});

test("moving over the map edge is immediate game over", () => {
  const state = stateWithPrograms([move], [right], [{ x: 0, y: 5, dir: 3 }, { x: 12, y: 12, dir: 2 }]);
  stepTerritory(state);
  assert.equal(state.agents[0].alive, false);
  assert.equal(state.agents[0].deathReason, "cliff");
});

test("enemy territory blocks movement and still consumes the tick", () => {
  const state = stateWithPrograms([move], [right], [{ x: 5, y: 5, dir: 1 }, { x: 6, y: 5, dir: 2 }]);
  const beforeX = state.agents[0].x;
  stepTerritory(state);
  assert.equal(state.tick, 1);
  assert.equal(state.agents[0].x, beforeX);
  assert.equal(state.agents[0].lastAction, "blocked");
});


test("territory treats every claimed cell as a wall, including its own trail", () => {
  const state = stateWithPrograms([move, right, right, move], [right], [{ x: 5, y: 5, dir: 1 }, { x: 12, y: 12, dir: 2 }]);
  const agent = state.agents[0];
  assert.equal(state.ruleVersion, "territory-v5");

  stepTerritory(state); // move to 6,5 and color it
  assert.equal(agent.x, 6);
  assert.equal(agent.y, 5);
  assert.equal(agent.claimed, 2);

  stepTerritory(state); // right
  stepTerritory(state); // right again: now facing the spawn cell
  assert.equal(agent.dir, 3);

  stepTerritory(state); // own spawn cell is already colored, so it is a wall
  assert.equal(agent.x, 6);
  assert.equal(agent.y, 5);
  assert.equal(agent.lastAction, "blocked");
  assert.equal(agent.claimed, 2);
});

test("two heads entering the same unclaimed cell are both eliminated", () => {
  const state = stateWithPrograms([move], [move], [{ x: 4, y: 5, dir: 1 }, { x: 6, y: 5, dir: 3 }]);
  stepTerritory(state);
  assert.equal(state.agents[0].alive, false);
  assert.equal(state.agents[1].alive, false);
  assert.equal(state.agents[0].deathReason, "collision");
  assert.equal(state.agents[1].deathReason, "collision");
});

test("forever keeps execution inside its body across ticks", () => {
  const state = stateWithPrograms([
    { type: "forever", body: [right, move] },
    left,
  ]);
  const agent = state.agents[0];
  assert.equal(decideAction(state, agent), "turnRight");
  assert.equal(decideAction(state, agent), "move");
  assert.equal(decideAction(state, agent), "turnRight");
});

test("repeat keeps state across ticks then continues to the next block", () => {
  const state = stateWithPrograms([
    { type: "repeat", times: literal(2), body: [move] },
    right,
  ]);
  const agent = state.agents[0];
  assert.equal(decideAction(state, agent), "move");
  assert.equal(decideAction(state, agent), "move");
  assert.equal(decideAction(state, agent), "turnRight");
  assert.equal(decideAction(state, agent), "none");
});

test("nested if branch resumes after a physical action", () => {
  const state = stateWithPrograms([
    { type: "if", condition: literal(true), then: [move, right], else: [] },
    left,
  ]);
  const agent = state.agents[0];
  assert.equal(decideAction(state, agent), "move");
  assert.equal(decideAction(state, agent), "turnRight");
  assert.equal(decideAction(state, agent), "turnLeft");
  assert.equal(decideAction(state, agent), "none");
});

test("conditional forever (while) rechecks its expression between iterations", () => {
  const state = stateWithPrograms([
    { type: "set", name: "count", value: literal(0) },
    {
      type: "while",
      condition: { type: "binary", op: "<", left: { type: "var", name: "count" }, right: literal(3) },
      body: [
        { type: "change", name: "count", value: literal(1) },
        move,
      ],
    },
    right,
  ]);
  const agent = state.agents[0];
  assert.equal(decideAction(state, agent), "move");
  assert.equal(agent.vars.count, 1);
  assert.equal(decideAction(state, agent), "move");
  assert.equal(agent.vars.count, 2);
  assert.equal(decideAction(state, agent), "move");
  assert.equal(agent.vars.count, 3);
  assert.equal(decideAction(state, agent), "turnRight");
});

test("break exits the nearest loop and continues after it", () => {
  const state = stateWithPrograms([
    { type: "forever", body: [move, { type: "break" }, left] },
    right,
  ]);
  const agent = state.agents[0];
  assert.equal(decideAction(state, agent), "move");
  assert.equal(decideAction(state, agent), "turnRight");
  assert.equal(decideAction(state, agent), "none");
});

test("enemy count reports only currently living opponents", () => {
  const state = createTerritoryState({
    seed: "enemy-count", size: 15, maxTicks: 40,
    players: [
      { id: "a", program: [right] },
      { id: "b", program: [right] },
      { id: "c", program: [right] },
    ],
    spawns: [{ x: 2, y: 2, dir: 1 }, { x: 12, y: 2, dir: 3 }, { x: 7, y: 12, dir: 0 }],
  });
  const context = { state, agent: state.agents[0], sense: () => ({ state: "unclaimed", owner: -1 }) };
  assert.equal(evaluateVmExpression({ type: "builtin", name: "enemyCount" }, context), 2);
  state.agents[2].alive = false;
  assert.equal(evaluateVmExpression({ type: "builtin", name: "enemyCount" }, context), 1);
  state.agents[1].alive = false;
  assert.equal(evaluateVmExpression({ type: "builtin", name: "enemyCount" }, context), 0);
});

test("nearest enemy distance is available as a numeric builtin and uses -1 when none survive", () => {
  const state = stateWithPrograms([
    {
      type: "if",
      condition: { type: "binary", op: "==", left: { type: "builtin", name: "enemyDistance" }, right: literal(10) },
      then: [right],
      else: [left],
    },
  ], [right], [{ x: 2, y: 2, dir: 1 }, { x: 12, y: 2, dir: 3 }]);
  assert.equal(decideAction(state, state.agents[0]), "turnRight");

  const solo = stateWithPrograms([
    {
      type: "if",
      condition: { type: "binary", op: "==", left: { type: "builtin", name: "enemyDistance" }, right: literal(-1) },
      then: [right],
      else: [left],
    },
  ]);
  solo.agents[1].alive = false;
  assert.equal(decideAction(solo, solo.agents[0]), "turnRight");
});

test("unsupported attack is zero-tick and interpretation continues to the next physical action", () => {
  const attack = { type: "action", action: "attack", range: literal(5) };
  const state = stateWithPrograms([attack, move]);
  const before = state.agents[0].x;
  stepTerritory(state);
  assert.equal(state.agents[0].x, before + 1);
});

test("weak medium and strong NPC programs are all executable and explicitly loop", () => {
  for (const level of ["weak", "medium", "strong"]) {
    const program = makeNpcProgram(level, 0);
    assert.equal(program[0]?.type, "forever");
    const state = stateWithPrograms(program);
    const first = decideAction(state, state.agents[0]);
    const second = decideAction(state, state.agents[0]);
    assert.ok(["move", "turnLeft", "turnRight", "none"].includes(first));
    assert.ok(["move", "turnLeft", "turnRight", "none"].includes(second));
  }
});

test("cobra steering still advances one cell in the same tick", () => {
  const state = createGameState({ mode: "cobra", seed: "cobra-turn", size: 15, players: [{ id:"a", program:[right] }, { id:"b", program:[move] }], spawns:[{x:5,y:5,dir:0},{x:12,y:12,dir:2}] });
  stepGame(state);
  assert.equal(state.agents[0].dir, 1);
  assert.equal(state.agents[0].x, 6);
  assert.equal(state.agents[0].y, 5);
});

test("cobra exposes all tails as the same sensor state while retaining owner metadata", () => {
  const state = createGameState({ mode: "cobra", seed: "tail-sensor", size: 15, players: [{ id:"a", program:[move] }, { id:"b", program:[move] }], spawns:[{x:5,y:5,dir:1},{x:8,y:5,dir:3}] });
  state.agents[1].tail = [{ x: 6, y: 5 }];
  const sensed = senseModeCell(state, state.agents[0], "front");
  assert.equal(sensed.state, "tail");
  assert.equal(sensed.owner, 1);
});

test("cobra allows entering the tail cell that disappears on this tick", () => {
  const state = createGameState({ mode: "cobra", seed: "tail-gap", size: 15, players: [{ id:"a", program:[move] }, { id:"b", program:[right] }], spawns:[{x:5,y:5,dir:1},{x:12,y:12,dir:2}], growthEvery:5 });
  state.agents[0].tail = [{x:6,y:5},{x:5,y:6}];
  stepGame(state);
  assert.equal(state.agents[0].alive, true);
  assert.equal(state.agents[0].x, 6);
  assert.equal(state.agents[0].y, 5);
});

test("floor mode eliminates a piece after two consecutive non-movement ticks", () => {
  const state = createGameState({ mode: "fall", seed: "fall", size: 15, players: [{ id:"a", program:[right,right] }, { id:"b", program:[move] }], spawns:[{x:5,y:5,dir:0},{x:12,y:12,dir:2}] });
  stepGame(state);
  assert.equal(state.agents[0].alive, true);
  stepGame(state);
  assert.equal(state.agents[0].alive, false);
  assert.equal(state.agents[0].deathReason, "floor_collapse");
  assert.equal(state.holes.has("5,5"), true);
});

test("splat starts at zero ink, recovers on existing own paint, and attack costs one plus range", () => {
  const attack = { type:"action", action:"attack", range:literal(2) };
  const state = createGameState({ mode:"splat", seed:"splat", size:15, players:[{id:"a",program:[right,attack]},{id:"b",program:[right]}], spawns:[{x:5,y:5,dir:0},{x:7,y:5,dir:2}], maxTicks:20 });
  assert.equal(state.agents[0].ink, 0);
  stepGame(state);
  assert.equal(state.agents[0].ink, 1);
  state.agents[0].ink = 5;
  state.agents[0].dir = 1;
  stepGame(state);
  assert.equal(state.agents[0].ink, 2);
  assert.equal(state.agents[1].alive, false);
  assert.equal(state.agents[1].deathReason, "shot");
});

test("attack range accepts numeric expressions, floors decimals, and costs one plus resolved range", () => {
  const attack = {
    type: "action",
    action: "attack",
    range: { type: "binary", op: "+", left: literal(1.9), right: literal(2) },
  };
  const state = createGameState({ mode:"splat", seed:"expr-range", size:15, players:[{id:"a",program:[attack]},{id:"b",program:[right]}], spawns:[{x:5,y:5,dir:1},{x:8,y:5,dir:2}], maxTicks:20 });
  state.agents[0].ink = 6;
  stepGame(state);
  assert.equal(state.agents[0].ink, 2); // floor(3.9)=3, cost=4
  assert.equal(state.agents[1].alive, false);
});

test("splat winner is based on colored area", () => {
  const state = createGameState({ mode:"splat", seed:"paint", size:15, players:[{id:"a",program:[move]},{id:"b",program:[right]}], spawns:[{x:2,y:2,dir:1},{x:12,y:12,dir:2}], maxTicks:3 });
  while (!state.finished) stepGame(state);
  const results = gameResults(state);
  assert.ok(results[0].colored >= results[1].colored);
  assert.match(results[0].metric, /マス/);
});

test("splat invalid attack neither spends ink nor grants recovery when no later physical action exists", () => {
  const attack = { type: "action", action: "attack", range: literal(4) };
  const state = createGameState({
    mode: "splat", seed: "no-ink-attack", size: 15, maxTicks: 20,
    players: [{ id: "a", program: [attack] }, { id: "b", program: [right] }],
    spawns: [{ x: 5, y: 5, dir: 0 }, { x: 12, y: 12, dir: 2 }],
  });
  assert.equal(state.agents[0].ink, 0);
  stepGame(state);
  assert.equal(state.agents[0].ink, 0);
  assert.equal(state.agents[0].x, 5);
  assert.equal(state.agents[0].y, 5);
});

test("invalid attack range is zero-tick and can fall through to a later physical command", () => {
  const attack = { type: "action", action: "attack", range: literal(-2) };
  const state = createGameState({
    mode: "splat", seed: "negative-range", size: 15, maxTicks: 20,
    players: [{ id: "a", program: [attack, right] }, { id: "b", program: [right] }],
    spawns: [{ x: 5, y: 5, dir: 0 }, { x: 12, y: 12, dir: 2 }],
  });
  stepGame(state);
  assert.equal(state.agents[0].dir, 1);
  assert.equal(state.agents[0].ink, 1);
});


function containsAction(program, actionName) {
  const visit = (seq) => (seq || []).some((b) => (b?.type === "action" && b.action === actionName) || visit(b?.body) || visit(b?.then) || visit(b?.else));
  return visit(program);
}

test("solo test states keep exactly one player when allowSolo is enabled", () => {
  for (const mode of ["territory", "fall", "cobra", "splat"]) {
    const state = createGameState({ mode, allowSolo: true, seed: "solo", size: 15, maxTicks: 20, players: [{ id: "me", name: "me", color: "blue", program: [move] }], spawns: [{ x: 7, y: 7, dir: 1 }] });
    assert.equal(state.agents.length, 1, mode);
    if (mode === "cobra") { stepGame(state); assert.equal(state.finished, false); }
  }
});

test("test NPC catalog has generic archetypes and mode-specific difficulty programs", () => {
  for (const type of ["straight","wall","explore","evade","chase","random","beginner","intermediate","advanced"]) {
    const p = makeTestNpcProgram("territory", type, 0);
    assert.equal(p[0]?.type, "forever", type);
  }
  assert.equal(containsAction(makeTestNpcProgram("cobra", "intermediate", 0), "attack"), false);
  assert.equal(containsAction(makeTestNpcProgram("cobra", "advanced", 0), "attack"), false);
  assert.equal(containsAction(makeTestNpcProgram("fall", "advanced", 0), "attack"), false);
  assert.equal(containsAction(makeTestNpcProgram("splat", "intermediate", 0), "attack"), true);
  assert.equal(containsAction(makeTestNpcProgram("splat", "advanced", 0), "attack"), true);
});


test("territory ends when every surviving piece has no legal adjacent move", () => {
  const state = createTerritoryState({
    seed: "boxed-in",
    size: 9,
    maxTicks: 100,
    stagnationTicks: 100,
    allowSolo: true,
    players: [{ id: "me", name: "me", color: "blue", program: [right] }],
    spawns: [{ x: 4, y: 4, dir: 0 }],
  });
  const me = state.agents[0];
  for (const [x, y] of [[4,3],[5,4],[4,5],[3,4]]) state.board[y][x] = 1;
  stepTerritory(state);
  assert.equal(me.alive, true);
  assert.equal(state.finished, true);
  assert.equal(state.finishReason, "no_moves");
});

test("territory does not end for no-moves while another surviving piece still has a legal move", () => {
  const state = createTerritoryState({
    seed: "one-boxed",
    size: 9,
    maxTicks: 100,
    stagnationTicks: 100,
    players: [
      { id: "a", name: "A", color: "blue", program: [right] },
      { id: "b", name: "B", color: "red", program: [right] },
    ],
    spawns: [{ x: 2, y: 2, dir: 0 }, { x: 6, y: 6, dir: 0 }],
  });
  for (const [x, y] of [[2,1],[3,2],[2,3],[1,2]]) state.board[y][x] = 1;
  stepTerritory(state);
  assert.equal(state.finished, false);
});


test("nested arithmetic expressions preserve explicit parenthesis structure", () => {
  const context = {
    agent: { id: "me", vars: { A: 10, B: 6, C: 5, D: 2 } },
    state: { agents: [], random: () => 0.5 },
    sense: () => ({ state: "unclaimed", owner: -1 }),
  };
  const expr = {
    type: "binary", op: "+", left: { type: "var", name: "A" }, right: {
      type: "binary", op: "/", left: { type: "var", name: "B" }, right: {
        type: "binary", op: "-", left: { type: "var", name: "C" }, right: { type: "var", name: "D" },
      },
    },
  };
  assert.equal(evaluateVmExpression(expr, context), 12);
  assert.equal(evaluateVmExpression({ type: "binary", op: ">=", left: expr, right: literal(12) }, context), true);
});


test("all eight board presets have a deterministic playable mask", () => {
  const expected = {
    "square:small": [15, 225], "square:large": [21, 441],
    "diamond:small": [21, 221], "diamond:large": [29, 421],
    "cross:small": [19, 217], "cross:large": [27, 405],
    "donut:small": [19, 336], "donut:large": [27, 680],
  };
  for (const [key, [size, count]] of Object.entries(expected)) {
    const [boardShape, boardSizeKey] = key.split(":");
    const def = createBoardDefinition({ boardShape, boardSizeKey });
    assert.equal(def.size, size, key);
    assert.equal(def.playableCount, count, key);
  }
});

test("random board choices are seed deterministic and only randomize requested dimensions", () => {
  const a = resolveBoardChoice({ shape: "random", sizeKey: "large", seed: "same" });
  const b = resolveBoardChoice({ shape: "random", sizeKey: "large", seed: "same" });
  assert.deepEqual(a, b);
  assert.equal(a.sizeKey, "large");
  const c = resolveBoardChoice({ shape: "donut", sizeKey: "random", seed: "same" });
  assert.equal(c.shape, "donut");
  assert.ok(["small", "large"].includes(c.sizeKey));
});

test("battle and random spawns always land on distinct playable cells", () => {
  for (const shape of ["square", "diamond", "cross", "donut"]) {
    for (const sizeKey of ["small", "large"]) {
      const def = createBoardDefinition({ boardShape: shape, boardSizeKey: sizeKey });
      for (const factory of [createBattleSpawns, createRandomSpawns]) {
        const spawns = factory(def, 4, `${shape}:${sizeKey}:${factory.name}`);
        assert.equal(new Set(spawns.map((s) => `${s.x},${s.y}`)).size, 4);
        for (const spawn of spawns) {
          assert.equal(isPlayableCell(def, spawn.x, spawn.y), true);
          assert.ok(spawn.dir >= 0 && spawn.dir <= 3);
        }
      }
    }
  }
});

test("diamond void is sensed as cliff and cannot be entered", () => {
  const state = createGameState({ mode: "territory", seed: "diamond-edge", boardShape: "diamond", boardSizeKey: "small", allowSolo: true, players: [{ id: "a", program: [move] }], spawns: [{ x: 10, y: 0, dir: 3 }] });
  assert.equal(senseModeCell(state, state.agents[0], "front").state, "cliff");
  stepGame(state);
  assert.equal(state.agents[0].alive, false);
  assert.equal(state.agents[0].deathReason, "cliff");
});

test("fixed spawn may use the outer edge on a square board", () => {
  const state = createGameState({ mode: "territory", seed: "edge-spawn", boardShape: "square", boardSizeKey: "small", allowSolo: true, players: [{ id: "a", program: [right] }], spawns: [{ x: 0, y: 14, dir: 0 }] });
  assert.equal(state.agents[0].x, 0);
  assert.equal(state.agents[0].y, 14);
});

test("splat shots cross the donut center void while pieces still cannot enter it", () => {
  const attack = { type: "action", action: "attack", range: literal(20) };
  const state = createGameState({ mode: "splat", seed: "donut-shot", boardShape: "donut", boardSizeKey: "small", players: [{ id: "a", program: [attack] }, { id: "b", program: [{ type: "action", action: "turnRight" }] }], spawns: [{ x: 9, y: 0, dir: 2 }, { x: 9, y: 18, dir: 0 }] });
  state.agents[0].ink = 30;
  stepGame(state);
  assert.equal(state.agents[1].alive, false);
  const shots = state.effects.filter((e) => e.type === "shot");
  assert.ok(shots.some((e) => e.y > 11), "shot resumes after the center void");
  assert.ok(!shots.some((e) => e.x === 9 && e.y >= 7 && e.y <= 11), "void itself is not painted/effected");
});

test("donut is a square board with a centered square hole", () => {
  for (const sizeKey of ["small", "large"]) {
    const def = createBoardDefinition({ boardShape: "donut", boardSizeKey: sizeKey });
    const center = (def.size - 1) / 2;
    const half = sizeKey === "small" ? 2 : 3;
    assert.equal(isPlayableCell(def, 0, 0), true, `${sizeKey}: outer corner stays playable`);
    assert.equal(isPlayableCell(def, def.size - 1, def.size - 1), true, `${sizeKey}: opposite outer corner stays playable`);
    assert.equal(isPlayableCell(def, center, center), false, `${sizeKey}: center is void`);
    assert.equal(isPlayableCell(def, center + half, center + half), false, `${sizeKey}: square-hole corner is void`);
    assert.equal(isPlayableCell(def, center + half + 1, center), true, `${sizeKey}: first cell outside square hole is playable`);
  }
});

test("square battle anchors use the same clockwise starting directions", () => {
  const def = createBoardDefinition({ boardShape: "square", boardSizeKey: "small" });
  const spawns = createBattleSpawns(def, 4, "square-anchor-directions");
  const center = (def.size - 1) / 2;
  for (const spawn of spawns) {
    let expected;
    if (spawn.x < center && spawn.y < center) expected = 1;       // left-top -> right
    else if (spawn.x > center && spawn.y < center) expected = 2;  // right-top -> down
    else if (spawn.x > center && spawn.y > center) expected = 3;  // right-bottom -> left
    else expected = 0;                                            // left-bottom -> up
    assert.equal(spawn.dir, expected, `spawn ${spawn.x},${spawn.y}`);
  }
});

test("all board shapes keep the preferred battle-anchor direction when that step is playable", () => {
  const vectors = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}];
  for (const shape of ["square", "diamond", "cross", "donut"]) {
    for (const sizeKey of ["small", "large"]) {
      const def = createBoardDefinition({ boardShape: shape, boardSizeKey: sizeKey });
      const spawns = createBattleSpawns(def, 4, `${shape}:${sizeKey}:directions`);
      const center = (def.size - 1) / 2;
      for (const spawn of spawns) {
        let expected;
        if (shape === "square" || shape === "donut") {
          if (spawn.x < center && spawn.y < center) expected = 1;
          else if (spawn.x > center && spawn.y < center) expected = 2;
          else if (spawn.x > center && spawn.y > center) expected = 3;
          else expected = 0;
        } else {
          const dx = spawn.x - center, dy = spawn.y - center;
          if (Math.abs(dy) >= Math.abs(dx)) expected = dy < 0 ? 1 : 3;
          else expected = dx > 0 ? 2 : 0;
        }
        const v = vectors[expected];
        assert.equal(isPlayableCell(def, spawn.x + v.x, spawn.y + v.y), true, `${shape}:${sizeKey} preferred step must be playable`);
        assert.equal(spawn.dir, expected, `${shape}:${sizeKey} ${spawn.x},${spawn.y}`);
      }
    }
  }
});

test("single-player battle placement can select all four formal anchors across seeds", () => {
  const def = createBoardDefinition({ boardShape: "square", boardSizeKey: "small" });
  const seen = new Set();
  for (let i = 0; i < 96; i += 1) {
    const [spawn] = createBattleSpawns(def, 1, `battle-reroll-${i}`);
    seen.add(`${spawn.x},${spawn.y}`);
  }
  assert.equal(seen.size, 4);
});



test("timer builtin exposes the shared game clock", () => {
  const state = stateWithPrograms([move]);
  state.tick = 17;
  const value = evaluateVmExpression({ type: "builtin", name: "timer" }, {
    state,
    agent: state.agents[0],
    sense: () => ({ state: "unclaimed", owner: -1 }),
  });
  assert.equal(value, 17);
});

test("plus concatenates when either operand is text and still adds numbers", () => {
  const state = stateWithPrograms([move]);
  const context = { state, agent: state.agents[0], sense: () => ({ state: "unclaimed", owner: -1 }) };
  assert.equal(evaluateVmExpression({ type: "binary", op: "+", left: literal(2), right: literal(3) }, context), 5);
  assert.equal(evaluateVmExpression({ type: "binary", op: "+", left: literal("現在の値は"), right: literal(3) }, context), "現在の値は3");
  assert.equal(evaluateVmExpression({ type: "binary", op: "+", left: literal(3), right: literal("です") }, context), "3です");
});

test("text variables can be compared and used for branching", () => {
  const state = stateWithPrograms([
    { type: "set", name: "mode", value: literal("コブラ") },
    { type: "if", condition: { type: "binary", op: "==", left: { type: "var", name: "mode" }, right: literal("コブラ") }, then: [move], else: [right] },
  ]);
  assert.equal(decideAction(state, state.agents[0]), "move");
  assert.equal(state.agents[0].vars.mode, "コブラ");
});

test("speech is zero-time, can interpolate values with plus, and later speech overwrites it", () => {
  const state = stateWithPrograms([
    { type: "set", name: "x", value: literal(3) },
    { type: "say", value: { type: "binary", op: "+", left: { type: "binary", op: "+", left: literal("現在の値は"), right: { type: "var", name: "x" } }, right: literal("です") } },
    { type: "say", value: literal("実行中") },
    move,
  ]);
  const beforeX = state.agents[0].x;
  stepTerritory(state);
  assert.equal(state.tick, 1);
  assert.equal(state.agents[0].x, beforeX + 1);
  assert.equal(state.agents[0].speech, "実行中");
});
