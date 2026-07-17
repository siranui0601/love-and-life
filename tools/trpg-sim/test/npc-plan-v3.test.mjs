import test from "node:test";
import assert from "node:assert/strict";
import { simulateNpcInterventionPlansForRun } from "../lib/npc-intervention-simulator-v3.mjs";

test("NPC response plan changes after player resolution", () => {
  const model = {
    locations: ["田園の村"],
    troubles: [{ id: "T01", primaryLocations: ["田園の村"] }],
    troubleById: { T01: { id: "T01", primaryLocations: ["田園の村"] } },
    npcs: [{
      id: "NPC-1",
      name: "村の衛兵",
      initialLocation: "田園の村",
      home: "田園の村",
      initialStatus: "勤務中",
      relatedTroubleIds: ["T01"],
      disposition: "mitigate",
      importanceWeight: 0.8,
    }],
    adjacency: { "田園の村": [] },
    routeById: {},
  };
  const run = {
    summary: { profileId: "story", seed: "test" },
    state: {
      worldFlags: {},
      routeCache: {},
      history: [{ type: "TROUBLE_TRANSITION", troubleId: "T01", from: "active", to: "resolved", minute: 200, reason: "player-mission-resolution" }],
      troubles: { T01: { status: "resolved", transitions: [{ from: "active", to: "resolved", minute: 200, reason: "player-mission-resolution" }] } },
      rumors: [
        { id: "RUM-T01-active", troubleId: "T01", origin: "田園の村", originMinute: 50, recipients: { "NPC-1": { minute: 80, hub: "田園の村" } } },
        { id: "RUM-T01-resolved", troubleId: "T01", origin: "田園の村", originMinute: 200, recipients: { "NPC-1": { minute: 230, hub: "田園の村" } } },
      ],
    },
  };
  const result = simulateNpcInterventionPlansForRun(run, model);
  assert.equal(result.totalPlans, 2);
  assert.equal(result.crisisToResolutionChanges, 1);
  assert.equal(result.resolutionChangeRate, 1);
  assert.equal(result.staleCrisisPlans, 0);
  assert.equal(result.roleMismatchCount, 0);
  assert.equal(result.impossibleTravelCount, 0);
  assert.equal(result.plans[0].kind, "defend_or_escort");
  assert.equal(result.plans[1].kind, "stand_down_and_patrol");
});
