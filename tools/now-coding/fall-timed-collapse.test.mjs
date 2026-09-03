import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, senseModeCell, stepGame } from "../../public/now-coding/modes.js";

const move = { type: "action", action: "move" };
const right = { type: "action", action: "turnRight" };
const forever = (body) => ({ type: "forever", body });

function fallState(program, { x = 5, y = 5, dir = 1 } = {}) {
  return createGameState({
    mode: "fall",
    allowSolo: true,
    seed: "fall-timed-collapse",
    size: 15,
    maxTicks: 50,
    players: [{ id: "a", name: "A", color: "blue", program }],
    spawns: [{ x, y, dir }],
  });
}

test("fall v4 schedules every first-stepped tile to collapse at tick + 2", () => {
  const state = fallState([forever([move])]);
  const agent = state.agents[0];
  assert.equal(state.ruleVersion, "fall-v4");
  assert.equal(state.fallCollapseAt.get("5,5"), 2, "starting floor is already stepped on at tick 0");

  stepGame(state); // tick 1: move1 -> 6,5; due at tick 3
  assert.equal(state.tick, 1);
  assert.equal(agent.x, 6);
  assert.equal(agent.y, 5);
  assert.equal(state.fallCollapseAt.get("6,5"), 3);
  assert.equal(state.holes.has("5,5"), false);
  assert.equal(state.holes.has("6,5"), false);

  stepGame(state); // tick 2 start: spawn floor collapses; move2 -> 7,5
  assert.equal(state.tick, 2);
  assert.equal(agent.alive, true);
  assert.equal(agent.x, 7);
  assert.equal(state.holes.has("5,5"), true);
  assert.equal(state.holes.has("6,5"), false);

  stepGame(state); // tick 3 start: move1 floor (6,5) collapses; move3 -> 8,5
  assert.equal(state.tick, 3);
  assert.equal(agent.alive, true);
  assert.equal(agent.x, 8);
  assert.equal(state.holes.has("6,5"), true);
  assert.equal(state.holes.has("7,5"), false);
});

test("move then turn leaves the stepped floor due to collapse at the next-next tick start", () => {
  const state = fallState([move, right, move], { x: 5, y: 5, dir: 0 });
  const agent = state.agents[0];

  stepGame(state); // tick 1: move1 -> 5,4; due at tick 3
  assert.equal(agent.alive, true);
  assert.equal(agent.x, 5);
  assert.equal(agent.y, 4);
  assert.equal(state.fallCollapseAt.get("5,4"), 3);

  stepGame(state); // tick 2: turn on 5,4
  assert.equal(agent.alive, true);
  assert.equal(state.holes.has("5,4"), false);

  stepGame(state); // tick 3 start: 5,4 becomes a cliff before move2 can run
  assert.equal(state.holes.has("5,4"), true);
  assert.equal(agent.alive, false);
  assert.equal(agent.deathReason, "floor_collapse");
  assert.equal(agent.deathTick, 3);
});

test("revisiting a scheduled floor never extends its original collapse deadline", () => {
  const state = fallState([forever([move])]);
  state.fallCollapseAt.set("6,5", 2);

  stepGame(state); // tick 1 enters 6,5, but its existing due tick remains 2
  assert.equal(state.agents[0].x, 6);
  assert.equal(state.fallCollapseAt.get("6,5"), 2);

  stepGame(state); // tick 2 start collapses under the piece
  assert.equal(state.holes.has("6,5"), true);
  assert.equal(state.agents[0].alive, false);
  assert.equal(state.agents[0].deathReason, "floor_collapse");
});

test("collapsed fall tiles are exposed to sensors as cliffs", () => {
  const state = fallState([forever([move])], { x: 5, y: 5, dir: 1 });
  const agent = state.agents[0];
  state.holes.add("6,5");
  assert.equal(senseModeCell(state, agent, "front").state, "cliff");
});

test("zero-time VM work does not change a tile deadline because only game ticks age floors", () => {
  const program = [
    move,
    { type: "set", name: "mode", value: { type: "literal", value: "床抜け" } },
    { type: "if", condition: { type: "literal", value: true }, then: [forever([move])], else: [] },
  ];
  const state = fallState(program);

  stepGame(state); // tick 1: move to 6,5; schedule tick 3
  assert.equal(state.fallCollapseAt.get("6,5"), 3);
  stepGame(state); // set/if/forever are zero-time; inner move is tick 2 physical action
  assert.equal(state.tick, 2);
  assert.equal(state.agents[0].vars.mode, "床抜け");
  assert.equal(state.agents[0].x, 7);
  assert.equal(state.fallCollapseAt.get("6,5"), 3);
  stepGame(state); // tick 3 start collapses 6,5
  assert.equal(state.holes.has("6,5"), true);
});
