import test from "node:test";
import assert from "node:assert/strict";
import {
  createTerritoryState,
  decideAction,
  makeNpcProgram,
  runTerritoryToEnd,
  stepTerritory,
} from "../../public/now-coding/engine.js";
import { createGameState, gameResults, stepGame } from "../../public/now-coding/modes.js";

const move = { type: "action", action: "move" };
const right = { type: "action", action: "turnRight" };
const left = { type: "action", action: "turnLeft" };

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
      { id: "a", name: "A", color: "blue", program: [move, right] },
      { id: "b", name: "B", color: "red", program: [move, left] },
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
  assert.equal(agent.pc, 0);
  assert.equal(decideAction(state, agent), "move");
  assert.equal(agent.pc, 0);
  assert.equal(decideAction(state, agent), "turnRight");
});

test("repeat keeps state across ticks then continues to the next block", () => {
  const state = stateWithPrograms([
    { type: "repeat", times: { type: "literal", value: 2 }, body: [move] },
    right,
  ]);
  const agent = state.agents[0];
  assert.equal(decideAction(state, agent), "move");
  assert.equal(agent.pc, 0);
  assert.equal(decideAction(state, agent), "move");
  assert.equal(agent.pc, 1);
  assert.equal(decideAction(state, agent), "turnRight");
});

test("weak medium and strong NPC programs are all executable", () => {
  for (const level of ["weak", "medium", "strong"]) {
    const program = makeNpcProgram(level, 0);
    assert.ok(Array.isArray(program) && program.length > 0);
    const state = stateWithPrograms(program);
    const action = decideAction(state, state.agents[0]);
    assert.ok(["move", "turnLeft", "turnRight", "none"].includes(action));
  }
});

test("cobra steering still advances one cell in the same tick", () => {
  const state = createGameState({ mode: "cobra", seed: "cobra-turn", size: 15, players: [{ id:"a", program:[right] }, { id:"b", program:[move] }], spawns:[{x:5,y:5,dir:0},{x:12,y:12,dir:2}] });
  stepGame(state);
  assert.equal(state.agents[0].dir, 1);
  assert.equal(state.agents[0].x, 6);
  assert.equal(state.agents[0].y, 5);
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
  const attack = { type:"action", action:"attack", range:{ type:"literal", value:2 } };
  const state = createGameState({ mode:"splat", seed:"splat", size:15, players:[{id:"a",program:[right,attack]},{id:"b",program:[right]}], spawns:[{x:5,y:5,dir:0},{x:7,y:5,dir:2}], maxTicks:20 });
  assert.equal(state.agents[0].ink, 0);
  stepGame(state);
  assert.equal(state.agents[0].ink, 1);
  state.agents[0].ink = 5;
  state.agents[0].pc = 1;
  state.agents[0].dir = 1;
  stepGame(state);
  assert.equal(state.agents[0].ink, 2);
  assert.equal(state.agents[1].alive, false);
  assert.equal(state.agents[1].deathReason, "shot");
});

test("splat winner is based on colored area", () => {
  const state = createGameState({ mode:"splat", seed:"paint", size:15, players:[{id:"a",program:[move]},{id:"b",program:[right]}], spawns:[{x:2,y:2,dir:1},{x:12,y:12,dir:2}], maxTicks:3 });
  while (!state.finished) stepGame(state);
  const results = gameResults(state);
  assert.ok(results[0].colored >= results[1].colored);
  assert.match(results[0].metric, /マス/);
});


test("splat invalid attack neither spends ink nor grants recovery", () => {
  const attack = { type: "action", action: "attack", range: { type: "literal", value: 4 } };
  const state = createGameState({
    mode: "splat", seed: "no-ink-attack", size: 15, maxTicks: 20,
    players: [{ id: "a", program: [attack] }, { id: "b", program: [{ type: "action", action: "turnRight" }] }],
    spawns: [{ x: 5, y: 5, dir: 0 }, { x: 12, y: 12, dir: 2 }],
  });
  assert.equal(state.agents[0].ink, 0);
  stepGame(state);
  assert.equal(state.agents[0].ink, 0);
  assert.equal(state.agents[0].x, 5);
  assert.equal(state.agents[0].y, 5);
});
