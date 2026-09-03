import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, senseModeCell, stepGame } from "../../public/now-coding/modes.js";

// Canonical fall timing: the deadline action resolves before the stepped tile collapses.
const move = { type: "action", action: "move" };
const right = { type: "action", action: "turnRight" };
const literal = (value) => ({ type: "literal", value });
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

test("fall v4 collapses a first-stepped tile after the deadline action resolves", () => {
  const state = fallState([forever([move])]);
  const agent = state.agents[0];
  assert.equal(state.ruleVersion, "fall-v4");
  assert.equal(state.fallCollapseAt.get("5,5"), 2, "starting floor is already stepped on at tick 0");

  stepGame(state); // tick 1: move1 -> 6,5; due at tick 3
  assert.equal(state.tick, 1);
  assert.equal(agent.x, 6);
  assert.equal(state.fallCollapseAt.get("6,5"), 3);
  assert.equal(state.holes.has("5,5"), false);

  stepGame(state); // tick 2: move2 resolves, then spawn floor collapses
  assert.equal(state.tick, 2);
  assert.equal(agent.alive, true);
  assert.equal(agent.x, 7);
  assert.equal(state.holes.has("5,5"), true);
  assert.equal(state.holes.has("6,5"), false);

  stepGame(state); // tick 3: move3 resolves, then move1 floor collapses
  assert.equal(state.tick, 3);
  assert.equal(agent.alive, true);
  assert.equal(agent.x, 8);
  assert.equal(state.holes.has("6,5"), true);
  assert.equal(state.holes.has("7,5"), false);
});

test("move then turn then move escapes before the stepped floor collapses", () => {
  const state = fallState([move, right, move], { x: 5, y: 5, dir: 0 });
  const agent = state.agents[0];

  stepGame(state); // tick 1: move1 -> 5,4; due at tick 3
  assert.equal(agent.alive, true);
  assert.equal(state.fallCollapseAt.get("5,4"), 3);

  stepGame(state); // tick 2: one turn is allowed
  assert.equal(agent.alive, true);
  assert.equal(state.holes.has("5,4"), false);

  stepGame(state); // tick 3: move2 executes first; then 5,4 becomes a cliff
  assert.equal(agent.alive, true);
  assert.equal(agent.x, 6);
  assert.equal(agent.y, 4);
  assert.equal(state.holes.has("5,4"), true);
});

test("staying on a due tile for the deadline action still causes floor collapse", () => {
  const state = fallState([move, right, right], { x: 5, y: 5, dir: 0 });
  const agent = state.agents[0];
  stepGame(state);
  stepGame(state);
  stepGame(state);
  assert.equal(agent.alive, false);
  assert.equal(agent.deathReason, "floor_collapse");
  assert.equal(agent.deathTick, 3);
  assert.equal(state.holes.has("5,4"), true);
});

test("the user mode-detection structure reaches forever move and observes the collapsed floor", () => {
  const program = [
    move,
    right,
    {
      type: "if",
      condition: { type: "binary", op: "==", left: { type: "sensor", direction: "right" }, right: literal("cliff") },
      then: [
        { type: "set", name: "ゲームモード", value: literal("床抜け") },
        forever([move]),
      ],
      else: [],
    },
  ];
  const state = fallState(program, { x: 5, y: 5, dir: 1 });
  const agent = state.agents[0];

  stepGame(state); // tick 1: move to 6,5
  stepGame(state); // tick 2: turn right; starting floor 5,5 collapses after the turn
  assert.equal(agent.alive, true);
  assert.equal(state.holes.has("5,5"), true);

  stepGame(state); // tick 3: right sensor points back to 5,5 and sees cliff; then forever move runs
  assert.equal(agent.alive, true);
  assert.equal(agent.vars["ゲームモード"], "床抜け");
  assert.equal(agent.x, 6);
  assert.equal(agent.y, 6);
  assert.equal(state.holes.has("6,5"), true, "move1 floor collapses only after the tick 3 move has resolved");
});

test("revisiting a scheduled floor never extends its original collapse deadline", () => {
  const state = fallState([forever([move])]);
  state.fallCollapseAt.set("6,5", 2);
  stepGame(state); // tick 1 enters 6,5, existing deadline remains tick 2
  assert.equal(state.fallCollapseAt.get("6,5"), 2);
  stepGame(state); // tick 2 move escapes, then 6,5 collapses
  assert.equal(state.agents[0].alive, true);
  assert.equal(state.holes.has("6,5"), true);
});

test("collapsed fall tiles are exposed to sensors as cliffs", () => {
  const state = fallState([forever([move])]);
  const agent = state.agents[0];
  state.holes.add("6,5");
  assert.equal(senseModeCell(state, agent, "front").state, "cliff");
});

test("zero-time VM work does not change a tile deadline because only game ticks age floors", () => {
  const program = [
    move,
    { type: "set", name: "mode", value: literal("床抜け") },
    { type: "if", condition: literal(true), then: [forever([move])], else: [] },
  ];
  const state = fallState(program);
  stepGame(state); // tick 1: move to 6,5; schedule tick 3
  assert.equal(state.fallCollapseAt.get("6,5"), 3);
  stepGame(state); // set/if/forever are zero-time; inner move is tick 2 physical action
  assert.equal(state.tick, 2);
  assert.equal(state.agents[0].vars.mode, "床抜け");
  assert.equal(state.agents[0].x, 7);
  assert.equal(state.fallCollapseAt.get("6,5"), 3);
  stepGame(state); // tick 3 move resolves, then 6,5 collapses
  assert.equal(state.holes.has("6,5"), true);
});
