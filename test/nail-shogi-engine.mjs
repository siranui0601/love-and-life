import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCare,
  applyCommandBundle,
  createInitialState,
  finishCommand,
  getNail,
  previewMove,
  setDirection,
} from "../public/nail-shogi/engine.js";

function disableExcept(state, ids) {
  const keep = new Set(ids);
  for (const nail of state.nails) {
    if (!keep.has(nail.id)) {
      nail.alive = false;
      nail.path = [];
      nail.materials = [];
    }
  }
}

function resolveRound(state) {
  const first = state.commander;
  const r1 = finishCommand(state, first);
  assert.equal(r1.ok, true);
  if (!r1.resolved) {
    const r2 = finishCommand(state, state.commander);
    assert.equal(r2.ok, true);
    return r2;
  }
  return r1;
}

test("friendly nails trying to enter the same cell block each other", () => {
  const state = createInitialState();
  disableExcept(state, ["0:0", "0:1"]);
  assert.equal(setDirection(state, 0, 0, 1), true);
  assert.equal(setDirection(state, 0, 1, -1), true);
  const result = resolveRound(state);
  assert.equal(getNail(state, 0, 0).path.length, 1);
  assert.equal(getNail(state, 0, 1).path.length, 1);
  assert.ok(result.events.some((event) => event.type === "own-block"));
});

test("hide never lets friendly nails phase through one another", () => {
  const state = createInitialState();
  disableExcept(state, ["0:0", "0:1"]);
  setDirection(state, 0, 0, 1);
  setDirection(state, 0, 1, -1);
  assert.equal(applyCare(state, 0, 0, "hide").ok, true);
  const result = resolveRound(state);
  assert.equal(getNail(state, 0, 0).path.length, 1);
  assert.equal(getNail(state, 0, 1).path.length, 1);
  assert.ok(result.events.some((event) => event.type === "own-block"));
});

test("hook cuts a nail only when it actually enters the body from the side", () => {
  const state = createInitialState();
  disableExcept(state, ["0:0", "1:0"]);
  const attacker = getNail(state, 0, 0);
  const defender = getNail(state, 1, 0);
  attacker.path = [{ x: 0, y: 2 }];
  attacker.materials = [{ kind: "hook", gel: false, sharpened: false }];
  defender.path = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }];
  defender.materials = Array.from({ length: 3 }, () => ({ kind: "bare", gel: false, sharpened: false }));
  setDirection(state, 0, 0, 1);
  const preview = previewMove(state, 0, 0);
  assert.equal(preview.kind, "hook-cut");
  const result = resolveRound(state);
  assert.deepEqual(defender.path, [{ x: 1, y: 0 }]);
  assert.ok(result.events.some((event) => event.type === "segment-collision" && event.hookCut === true));
  const sever = result.events.find((event) => event.type === "sever" && event.nailId === defender.id);
  assert.ok(sever);
  assert.equal(sever.removed.length, 2);
  assert.equal(result.events.some((event) => event.type === "grow" && event.nailId === defender.id), false);
});

test("hook does not become a side cut in a head-on tip swap", () => {
  const state = createInitialState();
  disableExcept(state, ["0:0", "1:0"]);
  const attacker = getNail(state, 0, 0);
  const defender = getNail(state, 1, 0);
  attacker.path = [{ x: 1, y: 3 }];
  attacker.materials = [{ kind: "hook", gel: false, sharpened: false }];
  defender.path = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }];
  defender.materials = Array.from({ length: 3 }, () => ({ kind: "bare", gel: false, sharpened: false }));
  setDirection(state, 0, 0, 0);
  const preview = previewMove(state, 0, 0);
  assert.equal(preview.kind, "collision");
  const result = resolveRound(state);
  assert.equal(defender.path.length, 2);
  assert.equal(attacker.path.length, 1);
  assert.ok(result.events.some((event) => event.type === "tip-collision"));
  assert.equal(result.events.some((event) => event.type === "segment-collision" && event.hookCut === true), false);
});

test("touching an enemy finger captures immediately even if its nail is long", () => {
  const state = createInitialState();
  disableExcept(state, ["0:1", "1:0"]);
  const attacker = getNail(state, 0, 1);
  const defender = getNail(state, 1, 0);
  attacker.path = [{ x: 2, y: 1 }];
  attacker.materials = [{ kind: "bare", gel: false, sharpened: false }];
  defender.path = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }];
  defender.materials = Array.from({ length: 3 }, () => ({ kind: "bare", gel: false, sharpened: false }));
  setDirection(state, 0, 1, -1);
  const result = resolveRound(state);
  assert.equal(state.captures[0], 1);
  assert.equal(defender.alive, false);
  assert.equal(attacker.path.length, 1);
  assert.ok(result.events.some((event) => event.type === "capture" && event.defenderFinger === 0));
});

test("command bundle is atomic when a care is invalid", () => {
  const state = createInitialState();
  state.stock[0].gel = 0;
  const before = structuredClone(state);
  const result = applyCommandBundle(state, 0, {
    directions: [{ fingerIndex: 0, direction: 1 }],
    cares: [{ fingerIndex: 0, type: "gel", segmentIndex: 0 }],
  });
  assert.equal(result.ok, false);
  assert.deepEqual(state, before);
});
