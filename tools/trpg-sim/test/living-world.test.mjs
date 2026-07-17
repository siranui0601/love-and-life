import assert from "node:assert/strict";
import test from "node:test";

import { loadWorldModel } from "../lib/world-model.mjs";
import { simulateWorld } from "../lib/world-simulator.mjs";

const model = loadWorldModel();
const baseline = simulateWorld({ model, seed: "living-world-contract-v2" });

test("all 110 NPCs retain a 400-tick causal history and eligible actors decide every tick", () => {
  assert.equal(Object.keys(baseline.npcTraces).length, 110);
  assert.ok(model.npcs.every((npc) => baseline.npcTraces[npc.id]?.length === 400));
  assert.equal(baseline.activityCoverage.coverage, 1);
  assert.equal(baseline.activityCoverage.eligibleTicks, baseline.activityCoverage.decisionTicks);
  assert.equal(baseline.invariants.traceCoverageViolations.length, 0);
  assert.equal(baseline.invariants.decisionCoverageViolations.length, 0);

  const movers = new Set([...baseline.localMovementEvents, ...baseline.movements].map((entry) => entry.npcId));
  assert.ok(movers.size >= 100, `expected at least 100 movers, got ${movers.size}`);
  assert.ok(baseline.localMovementEvents.every((entry) => entry.durationHours === 0.5));
  assert.ok(baseline.localMovementEvents.every((entry) => model.facilityById[entry.toFacilityId]?.hub === entry.hubId));

  const finalHour = (baseline.end.day - 1) * 24 + 14;
  assert.ok(Object.values(baseline.npcStates).every((state) => state.localTravel === null));
  for (const npc of model.npcs) {
    const state = baseline.npcStates[npc.id];
    const finalTrace = baseline.npcTraces[npc.id].at(-1);
    assert.equal(finalTrace.absoluteHour, finalHour, npc.id);
    assert.equal(finalTrace.hubId, state.position.hubId, npc.id);
    assert.equal(finalTrace.facilityId, state.position.facilityId, npc.id);
    assert.equal(finalTrace.presence, state.presence, npc.id);
    assert.equal(finalTrace.lifeStatus, state.lifeStatus, npc.id);
  }
  const finalPopulation = baseline.populationByTick.at(-1);
  assert.equal(finalPopulation.absoluteHour, finalHour);
  assert.equal(finalPopulation.traveling, Object.values(baseline.npcStates).filter((state) => state.presence === "traveling").length);
});

test("rumors spread after their source event and low-importance rumors are interest-selective", () => {
  const eventById = new Map(baseline.knowledgeEvents.map((entry) => [entry.id, entry]));
  const sourceEvents = baseline.knowledgeEvents.filter((entry) => entry.type === "rumor-source");
  assert.ok(sourceEvents.length >= model.troubles.length);
  assert.equal(baseline.knowledgeEvents.some((entry) => entry.type === "observe"), false);
  const t01Source = sourceEvents.filter((entry) => entry.factId === "trouble:T01:active");
  assert.equal(t01Source.length, 1);
  assert.equal(t01Source[0].location.facilityId, "LOC_FARM_EDGE");
  assert.equal(t01Source[0].hopCount, 0);
  assert.deepEqual(t01Source[0].path, ["facility:LOC_FARM_EDGE"]);

  const transfers = baseline.knowledgeEvents.filter((entry) => ["source-pickup", "share", "rumor-pickup"].includes(entry.type));
  assert.ok(transfers.some((entry) => entry.type === "source-pickup"));
  assert.ok(transfers.some((entry) => entry.carrierType === "route-carrier"));
  for (const transfer of transfers) {
    const source = eventById.get(transfer.sourceEventId);
    assert.ok(source, JSON.stringify(transfer));
    assert.ok(transfer.learnedAt >= source.propagationAt, JSON.stringify(transfer));
    if (source.learnedAt >= 0) assert.ok(transfer.learnedAt >= source.learnedAt + 4, JSON.stringify(transfer));
    assert.equal(transfer.hopCount, source.hopCount + 1, JSON.stringify(transfer));
    assert.deepEqual(transfer.path, [...source.path, transfer.npcId], JSON.stringify(transfer));
  }

  const rumorPickups = baseline.knowledgeEvents.filter((entry) => entry.type === "rumor-pickup");
  assert.ok(rumorPickups.length > 100);
  for (const rumor of rumorPickups) {
    assert.ok(rumor.hopCount >= 1, JSON.stringify(rumor));
    assert.ok(rumor.path.length >= 2, JSON.stringify(rumor));
    assert.ok(rumor.learnedAt >= rumor.sourceLearnedAt + 4, JSON.stringify(rumor));
    assert.ok(eventById.has(rumor.sourceEventId), JSON.stringify(rumor));
  }

  const selective = rumorPickups.filter((entry) => entry.importance < 0.82 && entry.troubleId);
  assert.ok(selective.length > 0);
  assert.ok(new Set(selective.map((entry) => entry.npcId)).size < model.npcs.length);
  for (const rumor of selective) {
    assert.ok(
      baseline.npcStates[rumor.npcId].interestTroubleIds.includes(rumor.troubleId),
      `${rumor.npcId} accepted unrelated ${rumor.troubleId}`,
    );
  }
});

test("acquired facts are recorded as causes of replanning and crisis behavior", () => {
  const causalDecisions = baseline.decisionEvents.filter((entry) =>
    entry.replanned && entry.usedFactIds?.length > 0 && /knowledge|crisis/u.test(entry.reason)
  );
  assert.ok(causalDecisions.length > 0);
  for (const decision of causalDecisions.slice(0, 200)) {
    const learned = baseline.knowledgeEvents.some((event) =>
      event.npcId === decision.npcId &&
      decision.usedFactIds.includes(event.factId) &&
      event.learnedAt <= decision.absoluteHour
    );
    assert.equal(learned, true, JSON.stringify(decision));
  }
});

test("no-player mode cannot solve authored crises and T01 kills Finn", () => {
  for (const seed of ["no-player-a", "no-player-b", "no-player-c"]) {
    const result = simulateWorld({ model, seed });
    assert.ok(Object.values(result.troubleStates).every((state) => state.status === "failed"));
    assert.ok(result.lifeEvents.some((entry) =>
      entry.npcId === "NPC001" &&
      entry.toLifeStatus === "dead" &&
      entry.day === 2 &&
      entry.phaseIndex === 3 &&
      entry.cause === "canonical-no-player-t01-failure"
    ));
  }

  const rescueConsequences = baseline.lifeEvents.filter((entry) =>
    entry.cause === "t01-rescue-exposure" &&
    model.npcById[entry.npcId]?.home === model.npcById.NPC001.home
  );
  assert.ok(rescueConsequences.some((entry) => ["injured", "missing", "dead"].includes(entry.toLifeStatus)));
  for (const injury of rescueConsequences.filter((entry) => entry.toLifeStatus === "injured")) {
    assert.equal(injury.type, "injury");
    assert.equal(injury.to, "injured");
    assert.equal(injury.vitalState, "injured");
    assert.ok(injury.presence);
    assert.ok(injury.locationId);
  }
  assert.equal(baseline.invariants.postMortemActionViolations.length, 0);
  assert.equal(baseline.invariants.postInactiveKnowledgeViolations.length, 0);
});

test("source non-intervention fates change life state at deterministic anchors", () => {
  const byNpc = new Map(baseline.lifeEvents.map((entry) => [entry.npcId, entry]));
  assert.equal(byNpc.get("NPC009")?.toLifeStatus, "dead");
  assert.equal(byNpc.get("NPC009")?.day, 38);
  assert.equal(byNpc.get("NPC016")?.toLifeStatus, "dead");
  assert.equal(byNpc.get("NPC016")?.day, 49);
  assert.equal(byNpc.get("NPC027")?.toLifeStatus, "missing");
  assert.equal(byNpc.get("NPC027")?.day, 48);
  assert.equal(byNpc.get("NPC035")?.toLifeStatus, "dead");
  assert.equal(byNpc.get("NPC035")?.day, 32);
  assert.ok(baseline.lifeEvents.every((entry) => entry.cause && entry.location && Number.isFinite(entry.absoluteHour)));
});

test("stateless per-NPC randomness is invariant to source NPC row order", () => {
  const reversedModel = { ...model, npcs: [...model.npcs].reverse() };
  const normal = simulateWorld({ model, seed: "npc-order-invariance" });
  const reversed = simulateWorld({ model: reversedModel, seed: "npc-order-invariance" });
  assert.equal(normal.fingerprint, reversed.fingerprint);
  assert.deepEqual(normal.npcTraces, reversed.npcTraces);
  assert.deepEqual(normal.knowledgeEvents, reversed.knowledgeEvents);
  assert.deepEqual(normal.lifeEvents, reversed.lifeEvents);
});
