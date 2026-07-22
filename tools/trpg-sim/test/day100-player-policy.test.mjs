import assert from "node:assert/strict";
import test from "node:test";
import {
  DAY100_POLICY_INTERNALS,
  createDay100CoverageState,
  finalizeDay100Coverage,
  observeDay100Coverage,
  selectDay100Decision,
} from "../lib/day100-player-policy.mjs";

const model = {
  troubles: [
    { id: "T01", name: "最初の危機", startDay: 1, deadlineDay: 2, finalDay: 3, primaryLocations: ["田園の村"] },
    { id: "T02", name: "王都の異変", startDay: 4, deadlineDay: 8, finalDay: 10, primaryLocations: ["王都"] },
  ],
  adjacency: {
    "田園の村": [{ to: "王都", hours: 4 }],
    "王都": [{ to: "田園の村", hours: 4 }, { to: "交易都市", hours: 5 }],
    "交易都市": [{ to: "王都", hours: 5 }],
  },
};

function save(overrides = {}) {
  return {
    clock: { day: 4, hour: 10, time: "10:00", absoluteMinute: 4320 },
    scene: { location: "田園の村", facilityId: "LOC_FARM_SQUARE", beats: [] },
    player: { gold: 40, needs: { hunger: 20, fatigue: 20 } },
    tutorial: null,
    battle: null,
    choices: [],
    movement: [],
    missions: [],
    rumors: [],
    world: { ended: false },
    ...overrides,
  };
}

test("critical survival needs take priority over mission and coverage actions", () => {
  const state = createDay100CoverageState(model);
  const current = save({
    player: { gold: 40, needs: { hunger: 88, fatigue: 30 } },
    choices: [
      { choiceId: "CHOICE-1", actionId: "ACTION:MSN-T02:hear", label: "異変について聞く", type: "conversation", missionId: "MSN-T02", stepId: "hear" },
      { choiceId: "CHOICE-2", actionId: "EAT:LOC_FARM_INN:4", label: "食事を取る", type: "eat" },
      { choiceId: "CHOICE-3", actionId: "WAIT", label: "少し待つ", type: "wait" },
    ],
    missions: [{ id: "MSN-T02", troubleId: "T02", kind: "special", title: "王都の異変", status: "active", currentStep: { id: "hear", progress: 0, required: 1 } }],
  });
  const decision = selectDay100Decision({ save: current, model, state });
  assert.equal(decision.actionId, "EAT:LOC_FARM_INN:4");
  assert.equal(decision.category, "meal");
});

test("an executable active-mission choice outranks patrol and ordinary work", () => {
  const state = createDay100CoverageState(model);
  const current = save({
    choices: [
      { choiceId: "CHOICE-1", actionId: "WORK:LOC_FARM_SQUARE", label: "仕事を尋ねる", type: "conversation" },
      { choiceId: "CHOICE-2", actionId: "ACTION:MSN-T02:hear:1", label: "王都の異変を聞く", type: "conversation", missionId: "MSN-T02", stepId: "hear" },
      { choiceId: "CHOICE-3", actionId: "INSPECT", label: "広場を調べる", type: "localInvestigate" },
    ],
    missions: [{ id: "MSN-T02", troubleId: "T02", kind: "special", title: "王都の異変", status: "active", deadlineDay: 8, currentStep: { id: "hear", progress: 0, required: 1 } }],
  });
  const decision = selectDay100Decision({ save: current, model, state });
  assert.equal(decision.actionId, "ACTION:MSN-T02:hear:1");
  assert.equal(decision.missionId, "MSN-T02");
  assert.equal(decision.troubleId, "T02");
});

test("regional pathfinding chooses the first legal hop instead of teleporting", () => {
  assert.equal(DAY100_POLICY_INTERNALS.regionalFirstHop(model, "田園の村", "交易都市"), "王都");
  const state = createDay100CoverageState(model);
  const current = save({
    movement: [
      { moveId: "MOVE:CAPITAL", scope: "regional", destination: "王都", label: "王都へ向かう" },
      { moveId: "MOVE:LOCAL", scope: "local", destinationFacilityId: "LOC_FARM_INN", label: "麦穂亭へ向かう" },
    ],
  });
  const movement = DAY100_POLICY_INTERNALS.movementToward(current, model, state, { hub: "交易都市" });
  assert.equal(movement.moveId, "MOVE:CAPITAL");
});

test("coverage distinguishes discovery, progress, engagement and terminal state", () => {
  const state = createDay100CoverageState(model);
  const current = save({
    rumors: [{ id: "R-T02", troubleId: "T02", text: "王都で異変がある" }],
    missions: [{
      id: "MSN-T02",
      troubleId: "T02",
      kind: "special",
      title: "王都の異変",
      status: "active",
      progressRatio: 0.5,
      currentStep: { id: "investigate", progress: 1, required: 2 },
    }],
  });
  observeDay100Coverage(state, current, {
    type: "CHOOSE",
    actionId: "ACTION:MSN-T02:investigate",
    missionId: "MSN-T02",
    troubleId: "T02",
    key: "CHOOSE:ACTION:MSN-T02:investigate",
  });
  const runtime = {
    playerState: {
      troubles: { T01: { status: "failed" }, T02: { status: "resolved" } },
      catalog: { special: [{ id: "MSN-T01", troubleId: "T01" }, { id: "MSN-T02", troubleId: "T02" }] },
      missions: { "MSN-T01": { status: "failed" }, "MSN-T02": { status: "completed" } },
    },
  };
  const report = finalizeDay100Coverage(state, {
    save: { ...current, clock: { ...current.clock, day: 100 }, world: { ended: true } },
    runtime,
    model,
  });
  const t02 = report.troubles.find((entry) => entry.id === "T02");
  assert.equal(t02.discovered, true);
  assert.equal(t02.progressed, true);
  assert.equal(t02.engaged, true);
  assert.equal(t02.resolved, true);
  assert.equal(report.counts.terminal, 2);
});
