import assert from "node:assert/strict";
import test from "node:test";
import { createPlayerNeeds } from "../../../../tools/trpg-sim/lib/player-needs.mjs";
import {
  applyCollapseRescueView,
  buildCollapseRescueCandidates,
  collapseRescueView,
  prepareCollapseCommand,
  resolveCollapseRescue,
  selectCollapseRescuer,
} from "./player-collapse-resolver.js";

function collapsedPlayer() {
  return { needs: createPlayerNeeds({ hunger: 100, fatigue: 100 }) };
}

test("prepareCollapseCommand opens one incident and blocks normal commands", () => {
  const player = collapsedPlayer();
  const first = prepareCollapseCommand(player, "MOVE", {
    minute: 1200,
    location: "CAPITAL",
    facilityId: "LOC_CAPITAL_ORPHANAGE",
  });
  const second = prepareCollapseCommand(player, "MOVE", {
    minute: 1300,
    location: "CAPITAL",
    facilityId: "LOC_CAPITAL_INN",
  });

  assert.equal(first.opened, true);
  assert.equal(first.blocked, true);
  assert.equal(first.code, "player_collapse_pending_rescue");
  assert.equal(second.opened, false);
  assert.equal(second.incident.id, first.incident.id);
  assert.equal(second.incident.facilityId, "LOC_CAPITAL_ORPHANAGE");
});

test("collapseRescueView exposes one rescue scene and empties normal UI collections", () => {
  const player = collapsedPlayer();
  prepareCollapseCommand(player, "MOVE", {
    minute: 1200,
    location: "CAPITAL",
    facilityId: "LOC_CAPITAL_ORPHANAGE",
  });

  const view = collapseRescueView(player, { facilityName: "白鈴孤児院" });

  assert.equal(view.active, true);
  assert.equal(view.status, "pending_rescue");
  assert.equal(view.facilityId, "LOC_CAPITAL_ORPHANAGE");
  assert.deepEqual(view.causes, ["空腹", "疲労"]);
  assert.match(view.narrative, /白鈴孤児院/u);
  assert.match(view.narrative, /空腹と疲労/u);
  assert.deepEqual(view.uiLock, {
    choices: [],
    movement: [],
    stock: [],
    saleQuotes: [],
    loans: [],
    rewards: [],
    learnableSkills: [],
    battleCommands: [],
  });
});

test("applyCollapseRescueView replaces every normal game-view action surface", () => {
  const player = collapsedPlayer();
  prepareCollapseCommand(player, "MOVE", {
    minute: 1200,
    location: "CAPITAL",
    facilityId: "LOC_CAPITAL_ORPHANAGE",
  });
  const source = {
    scene: { title: "元の場面", narrative: "元の説明", keep: true },
    choices: [{ choiceId: "CHOICE-1" }],
    movement: [{ id: "MOVE-1" }],
    shop: {
      currency: 50,
      stock: [{ id: "STOCK-1" }],
      saleQuotes: [{ equipmentId: "EQ-1" }],
      loans: [{ id: "LOAN-1" }],
      rewards: [{ id: "REWARD-1" }],
    },
    skills: {
      owned: [{ id: "SKL-1" }],
      learnable: [{ id: "SKL-2" }],
      learnableSkills: [{ id: "SKL-2" }],
    },
    battle: { id: "BATTLE-1", commands: [{ actionId: "ATTACK" }] },
    availableActions: ["MOVE", "CHOOSE"],
  };

  const view = applyCollapseRescueView(source, player, { facilityName: "白鈴孤児院" });

  assert.notEqual(view, source);
  assert.equal(view.scene.keep, true);
  assert.equal(view.scene.title, "力尽きて倒れた");
  assert.equal(view.scene.collapseRescue.incidentId, view.collapseRescue.incidentId);
  assert.deepEqual(view.choices, []);
  assert.deepEqual(view.movement, []);
  assert.equal(view.shop.currency, 50);
  assert.deepEqual(view.shop.stock, []);
  assert.deepEqual(view.shop.saleQuotes, []);
  assert.deepEqual(view.shop.loans, []);
  assert.deepEqual(view.shop.rewards, []);
  assert.deepEqual(view.skills.owned, [{ id: "SKL-1" }]);
  assert.deepEqual(view.skills.learnable, []);
  assert.deepEqual(view.skills.learnableSkills, []);
  assert.deepEqual(view.battle.commands, []);
  assert.deepEqual(view.availableActions, []);
  assert.deepEqual(source.choices, [{ choiceId: "CHOICE-1" }]);
});

test("applyCollapseRescueView returns the original view when no rescue is pending", () => {
  const player = { needs: createPlayerNeeds({ hunger: 40, fatigue: 40 }) };
  const source = { choices: [{ choiceId: "CHOICE-1" }] };
  assert.equal(applyCollapseRescueView(source, player), source);
});

test("collapseRescueView is absent before collapse and after completed rescue", () => {
  const healthy = { needs: createPlayerNeeds({ hunger: 40, fatigue: 40 }) };
  assert.equal(collapseRescueView(healthy), null);

  const player = collapsedPlayer();
  const resolved = resolveCollapseRescue(player, {
    minute: 300,
    location: "FARM",
    facilityId: "LOC_FARM_EDGE",
    fallbackWakeFacilityId: "LOC_FARM_INN",
    candidates: [],
  });

  assert.equal(resolved.completed, true);
  assert.equal(collapseRescueView(player), null);
});

test("buildCollapseRescueCandidates maps presence, GOAP state and canonical NPC data", () => {
  const candidates = buildCollapseRescueCandidates({
    presentNpcIds: ["NPC_HEALER", "NPC_DEAD"],
    reachableNpcIds: ["NPC_GUARD"],
    location: "CAPITAL",
    facilityId: "LOC_CAPITAL_ORPHANAGE",
    fallbackWakeFacilityId: "LOC_CAPITAL_CLINIC",
    npcDefinitions: new Map([
      ["NPC_HEALER", { name: "治療師", canRescue: true }],
      ["NPC_GUARD", { name: "衛兵" }],
      ["NPC_DEAD", { name: "故人" }],
    ]),
    npcStates: {
      NPC_HEALER: {
        status: "active",
        currentLocation: "CAPITAL",
        currentFacilityId: "LOC_CAPITAL_ORPHANAGE",
        knownFacts: ["healing"],
        trustToPlayer: 8,
        currentGoalId: "GOAL_TREAT_PLAYER",
        currentPlanId: "PLAN_RESCUE_PLAYER",
      },
      NPC_GUARD: {
        status: "active",
        currentLocation: "CAPITAL",
        currentFacilityId: "LOC_CAPITAL_GATE",
        knownFacts: ["first_aid"],
        canRescue: true,
      },
      NPC_DEAD: {
        status: "dead",
        currentLocation: "CAPITAL",
        currentFacilityId: "LOC_CAPITAL_ORPHANAGE",
      },
    },
  });

  assert.deepEqual(candidates.map((entry) => entry.id), ["NPC_DEAD", "NPC_GUARD", "NPC_HEALER"]);
  const healer = candidates.find((entry) => entry.id === "NPC_HEALER");
  assert.equal(healer.present, true);
  assert.equal(healer.facilityId, "LOC_CAPITAL_ORPHANAGE");
  assert.equal(healer.wakeFacilityId, "LOC_CAPITAL_ORPHANAGE");
  assert.equal(healer.playerTrust, 8);
  assert.equal(healer.goapGoalId, "GOAL_TREAT_PLAYER");
  assert.equal(healer.goapPlanId, "PLAN_RESCUE_PLAYER");
  assert.equal(candidates.find((entry) => entry.id === "NPC_GUARD").canReach, true);
  assert.equal(candidates.find((entry) => entry.id === "NPC_DEAD").dead, true);
});

test("authoritative candidate mapping never revives dead or missing NPCs", () => {
  const incident = {
    status: "pending_rescue",
    location: "CAPITAL",
    facilityId: "LOC_CAPITAL_ORPHANAGE",
  };
  const candidates = buildCollapseRescueCandidates({
    presentNpcIds: ["NPC_DEAD", "NPC_MISSING", "NPC_HEALER"],
    location: "CAPITAL",
    facilityId: "LOC_CAPITAL_ORPHANAGE",
    npcStates: {
      NPC_DEAD: { status: "死亡", knownFacts: ["healing"] },
      NPC_MISSING: { status: "行方不明", knownFacts: ["healing"] },
      NPC_HEALER: { status: "active", knownFacts: ["healing"], canRescue: true },
    },
  });

  assert.equal(selectCollapseRescuer(incident, candidates).id, "NPC_HEALER");
});

test("selectCollapseRescuer excludes impossible NPCs and prefers a present healer", () => {
  const incident = {
    status: "pending_rescue",
    location: "CAPITAL",
    facilityId: "LOC_CAPITAL_ORPHANAGE",
  };
  const selected = selectCollapseRescuer(incident, [
    { id: "NPC_DEAD", dead: true, present: true, canRescue: true },
    { id: "NPC_GUARD", alive: true, present: true, location: "CAPITAL", playerTrust: 5 },
    {
      id: "NPC_HEALER",
      alive: true,
      present: true,
      canRescue: true,
      location: "CAPITAL",
      facilityId: "LOC_CAPITAL_ORPHANAGE",
      knowledge: ["healing"],
      playerTrust: 3,
    },
  ]);

  assert.equal(selected.id, "NPC_HEALER");
});

test("resolveCollapseRescue records rescuer, wake place and restores actionability", () => {
  const player = collapsedPlayer();
  const resolved = resolveCollapseRescue(player, {
    minute: 1200,
    location: "CAPITAL",
    facilityId: "LOC_CAPITAL_ORPHANAGE",
    wakeDelayMinutes: 180,
    candidates: [{
      id: "NPC_HEALER",
      alive: true,
      present: true,
      canRescue: true,
      location: "CAPITAL",
      facilityId: "LOC_CAPITAL_CLINIC",
      knowledge: ["first_aid"],
    }],
  });
  const after = prepareCollapseCommand(player, "MOVE", {
    minute: resolved.rescueMinute,
    location: resolved.wakeLocation,
    facilityId: resolved.wakeFacilityId,
  });

  assert.equal(resolved.completed, true);
  assert.equal(resolved.usedFallback, false);
  assert.equal(resolved.incident.rescuerId, "NPC_HEALER");
  assert.equal(resolved.incident.wakeFacilityId, "LOC_CAPITAL_CLINIC");
  assert.equal(resolved.rescueMinute, 1380);
  assert.equal(after.blocked, false);
});

test("resolveCollapseRescue uses deterministic local aid fallback when no NPC qualifies", () => {
  const player = collapsedPlayer();
  const resolved = resolveCollapseRescue(player, {
    minute: 300,
    location: "FARM",
    facilityId: "LOC_FARM_EDGE",
    fallbackWakeFacilityId: "LOC_FARM_INN",
    candidates: [{ id: "NPC_MISSING", missing: true, canReach: true }],
  });

  assert.equal(resolved.completed, true);
  assert.equal(resolved.usedFallback, true);
  assert.equal(resolved.incident.rescuerId, "SYSTEM_LOCAL_AID");
  assert.equal(resolved.incident.wakeFacilityId, "LOC_FARM_INN");
});
