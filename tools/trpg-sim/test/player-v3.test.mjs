import test from "node:test";
import assert from "node:assert/strict";
import {
  checkPermanentMission,
  createPermanentMissions,
} from "../lib/mission-model.mjs";
import { auditNpcInterventionRuns } from "../lib/player-suite-v3.mjs";

function missionByChain(missions, chainId) {
  return missions.filter((mission) => mission.chainId === chainId);
}

test("v3 permanent missions contain 12 chains and 48 sequential definitions", () => {
  const missions = createPermanentMissions({ missionExpMultiplier: 1 });
  assert.equal(missions.length, 48);
  const chains = [...new Set(missions.map((mission) => mission.chainId))];
  assert.equal(chains.length, 12);
  for (const chainId of chains) {
    const chain = missionByChain(missions, chainId);
    assert.equal(chain.length, 4);
    assert.equal(chain[0].previousMissionId, null);
    for (let index = 1; index < chain.length; index += 1) {
      assert.equal(chain[index].previousMissionId, chain[index - 1].id);
      assert.ok(chain[index].target > chain[index - 1].target);
      assert.ok(chain[index].expReward > chain[index - 1].expReward);
    }
  }
});

test("v3 derived mission metrics combine economy, rumor and skill counters", () => {
  const missions = createPermanentMissions({ missionExpMultiplier: 1 });
  const state = {
    progress: {
      economy: { goldFromBattles: 40, goldFromWork: 50, goldEarnedFromSales: 30, goldSpent: 100 },
      rumors: { npcRecipients: 20, npcReplans: 5 },
      combat: { physicalSkillUses: 35 },
      magic: { totalCasts: 15 },
      travel: { visitedHubs: new Set(), visitedFacilities: new Set() },
    },
  };
  const earn = missionByChain(missions, "earn")[1];
  const rumor = missionByChain(missions, "rumor")[1];
  const skill = missionByChain(missions, "skill")[1];
  assert.deepEqual(checkPermanentMission(earn, state), { actual: 120, complete: true });
  assert.deepEqual(checkPermanentMission(rumor, state), { actual: 30, complete: true });
  assert.deepEqual(checkPermanentMission(skill, state), { actual: 50, complete: true });
});

test("NPC intervention audit attributes related replans to player resolution", () => {
  const model = {
    troubles: [{ id: "T01" }],
    npcs: [{
      id: "NPC-1",
      name: "村の衛兵",
      initialLocation: "田園の村",
      home: "田園の村",
      initialStatus: "勤務中",
      relatedTroubleIds: ["T01"],
      disposition: "mitigate",
    }],
    adjacency: { "田園の村": [] },
    routeById: {},
  };
  const run = {
    summary: { profileId: "story", seed: "test" },
    state: {
      worldFlags: {},
      routeCache: {},
      history: [{ type: "TROUBLE_TRANSITION", troubleId: "T01", from: "active", to: "resolved", minute: 100, reason: "player-mission-resolution" }],
      troubles: { T01: { status: "resolved", casualtyMitigation: 0.1, transitions: [{ from: "active", to: "resolved", minute: 100, reason: "player-mission-resolution" }] } },
      rumors: [{ id: "RUM-T01-resolved", troubleId: "T01", origin: "田園の村", originMinute: 100, recipients: { "NPC-1": { minute: 130, hub: "田園の村" } } }],
      progress: { rumors: { npcReplans: 1 } },
    },
  };
  const audit = auditNpcInterventionRuns([run], model);
  assert.equal(audit.relevantResponseRate.median, 1);
  assert.equal(audit.resolvedRumorResponseRate.median, 1);
  assert.equal(audit.unrelatedNpcReplans, 0);
  assert.equal(audit.staleEscalationsAfterResolution, 0);
  assert.equal(audit.resolutionAuthorityViolations, 0);
  assert.equal(audit.responseKinds.stand_down_and_patrol, 1);
});
