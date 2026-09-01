import test from "node:test";
import assert from "node:assert/strict";
import {
  createTerritoryState,
  runTerritoryToEnd,
  stepTerritory,
} from "../../public/now-coding/engine.js";

const move = { type: "action", action: "move" };
const right = { type: "action", action: "turnRight" };

test("same seed and programs produce the same territory result", () => {
  const config = {
    seed: "fixed-seed",
    size: 15,
    maxTicks: 120,
    players: [
      { id: "a", name: "A", color: "blue", program: [move, right] },
      { id: "b", name: "B", color: "red", program: [move, { type: "action", action: "turnLeft" }] },
    ],
  };
  const first = runTerritoryToEnd(config);
  const second = runTerritoryToEnd(config);
  assert.deepEqual(first.results, second.results);
  assert.deepEqual(first.state.board, second.state.board);
  assert.equal(first.state.tick, second.state.tick);
});

test("turning consumes a tick without moving", () => {
  const state = createTerritoryState({
    seed: "turn",
    size: 15,
    maxTicks: 20,
    players: [
      { id: "a", color: "blue", program: [right] },
      { id: "b", color: "red", program: [right] },
    ],
    spawns: [
      { x: 2, y: 2, dir: 0 },
      { x: 12, y: 12, dir: 2 },
    ],
  });
  const before = state.agents.map(({ x, y, dir }) => ({ x, y, dir }));
  stepTerritory(state);
  assert.equal(state.tick, 1);
  assert.equal(state.agents[0].x, before[0].x);
  assert.equal(state.agents[0].y, before[0].y);
  assert.equal(state.agents[0].dir, 1);
});

test("moving over the map edge is immediate game over", () => {
  const state = createTerritoryState({
    seed: "cliff",
    size: 15,
    maxTicks: 20,
    players: [
      { id: "a", color: "blue", program: [move] },
      { id: "b", color: "red", program: [right] },
    ],
    spawns: [
      { x: 0, y: 5, dir: 3 },
      { x: 12, y: 12, dir: 2 },
    ],
  });
  stepTerritory(state);
  assert.equal(state.agents[0].alive, false);
  assert.equal(state.agents[0].deathReason, "cliff");
});

test("enemy territory blocks movement and still consumes the tick", () => {
  const state = createTerritoryState({
    seed: "wall",
    size: 15,
    maxTicks: 20,
    players: [
      { id: "a", color: "blue", program: [move] },
      { id: "b", color: "red", program: [right] },
    ],
    spawns: [
      { x: 5, y: 5, dir: 1 },
      { x: 6, y: 5, dir: 2 },
    ],
  });
  const beforeX = state.agents[0].x;
  stepTerritory(state);
  assert.equal(state.tick, 1);
  assert.equal(state.agents[0].x, beforeX);
  assert.equal(state.agents[0].lastAction, "blocked");
});

test("two heads entering the same unclaimed cell are both eliminated", () => {
  const state = createTerritoryState({
    seed: "collision",
    size: 15,
    maxTicks: 20,
    players: [
      { id: "a", color: "blue", program: [move] },
      { id: "b", color: "red", program: [move] },
    ],
    spawns: [
      { x: 4, y: 5, dir: 1 },
      { x: 6, y: 5, dir: 3 },
    ],
  });
  stepTerritory(state);
  assert.equal(state.agents[0].alive, false);
  assert.equal(state.agents[1].alive, false);
  assert.equal(state.agents[0].deathReason, "collision");
  assert.equal(state.agents[1].deathReason, "collision");
});
