import test from "node:test";
import assert from "node:assert/strict";
import { executeNpcGoapPlansForRun } from "../lib/goap-execution-v4.mjs";

function model() {
  const facility = {
    id: "FAC-GUARD",
    name: "村の詰所",
    type: "詰所",
    function: "警備",
    hub: "田園の村",
    relatedTroubleIds: ["T01"],
    sourceOrder: 1,
  };
  const trouble = { id: "T01", name: "少年の失踪", primaryLocations: ["田園の村"] };
  return {
    npcs: [{
      id: "NPC-GUARD",
      name: "村の衛兵",
      occupation: "衛兵",
      initialLocation: "田園の村",
      home: "田園の村",
      mainFacilityId: "FAC-GUARD",
      initialStatus: "勤務中",
      importanceWeight: 0.8,
      relatedTroubleIds: ["T01"],
      disposition: "mitigate",
    }],
    troubles: [trouble],
    troubleById: { T01: trouble },
    facilities: [facility],
    facilitiesByHub: { "田園の村": [facility] },
    adjacency: { "田園の村": [] },
    routeById: {},
  };
}

function runWithRumors(rumors) {
  return {
    summary: { profileId: "story", seed: "goap-v4-test" },
    state: {
      worldFlags: {},
      routeCache: {},
      history: [{
        type: "TROUBLE_TRANSITION",
        troubleId: "T01",
        from: "active",
        to: "resolved",
        minute: 110,
        reason: "player-mission-resolution",
      }],
      rumors,
    },
  };
}

test("GOAP execution reaches a facility and records the completed action", () => {
  const run = runWithRumors([{
    id: "RUM-T01-resolved",
    troubleId: "T01",
    origin: "田園の村",
    originMinute: 110,
    recipients: { "NPC-GUARD": { minute: 130, hub: "田園の村" } },
  }]);
  const result = executeNpcGoapPlansForRun(run, model());
  assert.equal(result.blocked, 0);
  assert.equal(result.completed, 1);
  assert.equal(result.facilityEntries, 1);
  assert.equal(result.overlapViolations, 0);
  assert.equal(result.actionAfterCancellation, 0);
  assert.ok(result.logs.some((entry) => entry.type === "NPC_FACILITY_ENTERED"));
  assert.ok(result.logs.some((entry) => entry.type === "NPC_FACILITY_ACTION_COMPLETED"));
  assert.ok(result.logs.some((entry) => entry.type === "NPC_GOAP_STATE_UPDATED"));
});

test("a resolved rumor cancels the old crisis plan before it starts", () => {
  const run = runWithRumors([
    {
      id: "RUM-T01-active",
      troubleId: "T01",
      origin: "田園の村",
      originMinute: 50,
      recipients: { "NPC-GUARD": { minute: 70, hub: "田園の村" } },
    },
    {
      id: "RUM-T01-resolved",
      troubleId: "T01",
      origin: "田園の村",
      originMinute: 80,
      recipients: { "NPC-GUARD": { minute: 90, hub: "田園の村" } },
    },
  ]);
  const result = executeNpcGoapPlansForRun(run, model());
  assert.equal(result.cancelledBeforeStart, 1);
  assert.equal(result.completed, 1);
  assert.equal(result.staleCrisisCompletions, 0);
  assert.equal(result.actionAfterCancellation, 0);
  const completed = result.executions.find((entry) => entry.result === "completed");
  assert.equal(completed.status, "resolved");
});
