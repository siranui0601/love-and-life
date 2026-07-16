import assert from "node:assert/strict";
import test from "node:test";

import { planDijkstra, planGoap } from "../lib/goap.mjs";
import {
  SAFE_ASSUMPTIONS,
  TERMINAL_TROUBLE_STATES,
  loadWorldModel,
} from "../lib/world-model.mjs";
import {
  auditWorldSimulation,
  evaluateTroubleGate,
  planNpcTravel,
  simulateWorld,
} from "../lib/world-simulator.mjs";

const model = loadWorldModel();
const baseline = simulateWorld({ model, seed: "world-regression-v1" });

test("generic GOAP uses the cheapest deterministic Dijkstra/A* plan", () => {
  const actions = [
    { id: "direct", cost: 8, preconditions: { at: "A" }, effects: { at: "C" } },
    { id: "a-to-b", cost: 2, preconditions: { at: "A" }, effects: { at: "B" } },
    { id: "b-to-c", cost: 2, preconditions: { at: "B" }, effects: { at: "C" } },
    { id: "loop", cost: 0.5, preconditions: { at: "B" }, effects: { at: "A" } },
  ];

  const dijkstra = planDijkstra({ initialState: { at: "A" }, goal: { at: "C" }, actions });
  assert.equal(dijkstra.status, "success");
  assert.equal(dijkstra.cost, 4);
  assert.deepEqual(dijkstra.actions.map((action) => action.id), ["a-to-b", "b-to-c"]);

  const astar = planGoap({
    initialState: { at: "A" },
    goal: { at: "C" },
    actions,
    heuristic: (state) => ({ A: 4, B: 2, C: 0 })[state.at],
  });
  assert.equal(astar.cost, 4);
  assert.deepEqual(astar.actions.map((action) => action.id), ["a-to-b", "b-to-c"]);
});

test("GOAP reports an exhausted state space without fabricating an action", () => {
  const result = planDijkstra({
    initialState: { at: "A" },
    goal: { at: "Z" },
    actions: [{ id: "a-to-b", preconditions: { at: "A" }, effects: { at: "B" } }],
  });
  assert.equal(result.status, "failure");
  assert.equal(result.reason, "no-plan");
  assert.deepEqual(result.actions, []);
});

test("world snapshot normalizes every required entity and safe assumption", () => {
  assert.equal(model.routes.length, 15);
  assert.equal(model.troubles.length, 19);
  assert.equal(model.timeline.length, 55);
  assert.equal(model.chains.length, 23);
  assert.equal(model.npcs.length, 110);
  assert.equal(model.locations.length, 11);
  assert.ok(model.locations.includes("黒嶺連合領"));
  assert.ok(!model.locations.includes("魔王領"));

  const behaviorCounts = Object.fromEntries(
    ["routine", "event-goap", "autonomous-goap"].map((type) => [
      type,
      model.npcs.filter((npc) => npc.behaviorType === type).length,
    ])
  );
  assert.deepEqual(behaviorCounts, { routine: 62, "event-goap": 30, "autonomous-goap": 18 });
  assert.ok(model.npcs.every((npc) => model.locations.includes(npc.initialLocation)));
  assert.ok(model.troubles.every((trouble) => trouble.primaryLocations.every((location) => model.locations.includes(location))));
  assert.ok(model.diagnostics.every((entry) => entry.severity !== "error"));

  const diagnosticCodes = new Set(model.diagnostics.map((entry) => entry.code));
  for (const code of [
    "ASSUMPTION_DAY1_START",
    "ALIAS_NORMALIZED",
    "SAME_DAY_SOURCE_ORDER",
    "TIMELINE_DATE_SERIAL_IGNORED",
    "CONDITIONAL_DISTANCE",
  ]) assert.ok(diagnosticCodes.has(code), `missing diagnostic ${code}`);
  assert.match(SAFE_ASSUMPTIONS.sameDayOrder, /行順/u);
});

test("all route costs are honored and conditional forest gates are explicit", () => {
  const capitalNpc = model.npcById.NPC016;
  const northToCapital = planNpcTravel(model, capitalNpc, "北陵要塞", ["王都"], {});
  assert.ok(northToCapital);
  assert.equal(northToCapital.plan.cost, 8);
  assert.deepEqual(northToCapital.plan.actions.map((action) => action.routeId), ["R03", "R06"]);

  const forestToElfClosed = planNpcTravel(model, capitalNpc, "森", ["エルフの隠れ里"], {});
  assert.equal(forestToElfClosed, null);
  const forestToElfOpen = planNpcTravel(model, capitalNpc, "森", ["エルフの隠れ里"], { elfApproval: true });
  assert.ok(forestToElfOpen);
  assert.equal(forestToElfOpen.plan.cost, 0.17);
  assert.equal(forestToElfOpen.plan.actions[0].routeId, "R14");
});

test("T15/T18/T19 hard gates distinguish active, critical and resolved prerequisites", () => {
  const closed15 = evaluateTroubleGate("T15", { T05: { status: "resolved" }, T06: { status: "active" } });
  assert.equal(closed15.open, false);
  const open15 = evaluateTroubleGate("T15", { T05: { status: "critical" }, T06: { status: "resolved" } });
  assert.equal(open15.open, true);
  assert.deepEqual(open15.matched, ["T05"]);

  for (const id of ["T18", "T19"]) {
    assert.equal(evaluateTroubleGate(id, { T13: { status: "resolved" } }).open, false);
    assert.equal(evaluateTroubleGate(id, { T13: { status: "critical" } }).open, true);
    assert.equal(evaluateTroubleGate(id, { T13: { status: "failed" } }).open, true);
  }
});

test("Day1 through Day100 autonomously reach a strict terminal world", () => {
  assert.equal(baseline.tickCount, 400);
  assert.deepEqual(baseline.start, { day: 1, hour: 10 });
  assert.deepEqual(baseline.end, { day: 100, hour: 24 });
  assert.equal(baseline.summary.terminalTroubles, 19);
  assert.equal(baseline.summary.totalTroubles, 19);
  assert.equal(baseline.summary.worldEnded, true);
  assert.ok(Object.values(baseline.troubleStates).every((state) => TERMINAL_TROUBLE_STATES.includes(state.status)));

  assert.equal(baseline.invariants.ok, true, JSON.stringify(baseline.invariants));
  for (const key of [
    "teleports",
    "unknownLocations",
    "routeDurationViolations",
    "prematureTransitions",
    "terminalLeaks",
    "goapCandidateExhaustions",
    "timelineOrderViolations",
    "gateViolations",
    "missingChainApplications",
    "structuralViolations",
  ]) assert.deepEqual(baseline.invariants[key], [], key);

  assert.equal(baseline.stats.routineDecisions, 62 * 400);
  assert.ok(baseline.stats.goapPlans > 0);
  assert.ok(baseline.movements.length > 0);
  assert.ok(baseline.contributions.length > 0);
  assert.ok(baseline.summary.npcContributors > 0);
  assert.ok(Object.values(baseline.troubleStates).some((state) => state.status === "resolved"));
  assert.ok(Object.values(baseline.troubleStates).some((state) => state.status === "failed"));
});

test("event gates, chains and same-day timeline order are retained in the run", () => {
  const gateIds = new Set(baseline.gateChecks.filter((entry) => entry.hard).map((entry) => entry.troubleId));
  assert.deepEqual(gateIds, new Set(["T15", "T18", "T19"]));
  assert.ok(baseline.gateChecks.filter((entry) => entry.hard).every((entry) => entry.open));

  const parsedChainIds = new Set(model.chains.map((chain) => chain.id));
  assert.equal(parsedChainIds.size, 23);
  assert.ok(baseline.appliedChains.every((chain) => parsedChainIds.has(chain.chainId)));
  assert.ok(baseline.appliedChains.some((chain) => chain.chainId === "C13"));
  assert.ok(baseline.appliedChains.some((chain) => chain.chainId === "C21"));

  const sorted = [...baseline.timelineLog].sort((a, b) =>
    a.day - b.day || a.phaseIndex - b.phaseIndex || a.sourceOrder - b.sourceOrder
  );
  assert.deepEqual(baseline.timelineLog.map((entry) => entry.timelineId), sorted.map((entry) => entry.timelineId));
});

test("the alternate T13-success route suppresses T18/T19 and applies C22", () => {
  const branch = simulateWorld({ model, seed: "branch-12" });
  assert.equal(branch.troubleStates.T13.status, "resolved");
  assert.equal(branch.troubleStates.T18.status, "suppressed");
  assert.equal(branch.troubleStates.T19.status, "suppressed");
  assert.equal(branch.worldFlags.worldTreeFallen, false);
  assert.ok(branch.appliedChains.some((chain) => chain.chainId === "C22"));
  assert.ok(!branch.appliedChains.some((chain) => ["C13", "C14", "C15"].includes(chain.chainId)));
  assert.equal(branch.invariants.ok, true, JSON.stringify(branch.invariants));
});

test("a seed reproduces the exact simulation and another seed changes the trace", () => {
  const replay = simulateWorld({ model, seed: "world-regression-v1" });
  const alternate = simulateWorld({ model, seed: "world-regression-v2" });
  assert.equal(replay.fingerprint, baseline.fingerprint);
  assert.deepEqual(replay.eventTransitions, baseline.eventTransitions);
  assert.deepEqual(replay.contributions, baseline.contributions);
  assert.notEqual(alternate.fingerprint, baseline.fingerprint);
  assert.equal(alternate.invariants.ok, true);
});

test("strict audit detects route-time corruption and terminal leakage", () => {
  const corrupted = structuredClone(baseline);
  assert.ok(corrupted.movements.length > 0);
  corrupted.movements[0].durationHours = 0;
  corrupted.troubleStates.T19.status = "critical";
  const audit = auditWorldSimulation(corrupted, model);
  assert.equal(audit.ok, false);
  assert.equal(audit.routeDurationViolations.length, 1);
  assert.ok(audit.terminalLeaks.some((entry) => entry.troubleId === "T19"));
});
