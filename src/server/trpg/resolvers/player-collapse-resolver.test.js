import assert from "node:assert/strict";
import test from "node:test";
import { createPlayerNeeds } from "../../../../tools/trpg-sim/lib/player-needs.mjs";
import {
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
