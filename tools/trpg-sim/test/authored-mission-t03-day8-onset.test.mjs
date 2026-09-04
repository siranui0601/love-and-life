import test from "node:test";
import assert from "node:assert/strict";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import { createGameRuntime } from "../../../src/server/trpg/game/service.js";
import {
  AUTHORED_MISSION_T03_DAY8_ONSET_INTERNALS,
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
} from "../../../src/server/trpg/content/authored-mission-t03-day8-onset.js";

const data = loadTrpgGameData();
const {
  ONSET_MINUTE,
  RUMOR_ID,
  CANONICAL_FIRST_LEAD_ID,
  syncCanonicalT03Day8Onset,
} = AUTHORED_MISSION_T03_DAY8_ONSET_INTERNALS;

function runtimeAt(minute) {
  const runtime = createGameRuntime(data, {
    seed: `test:t03-day8-onset:${minute}`,
    profileId: "balanced",
    playerName: "試験旅人",
    tutorial: false,
  });
  runtime.playerState.absoluteMinute = minute;
  runtime.playerState.player.location = "田園の村";
  runtime.playerState.player.facilityId = "LOC_FARM_CHIEF";
  runtime.playerState.troubles.T03.status = "scheduled";
  runtime.playerState.troubles.T03.activatedAt = null;
  runtime.playerState.troubles.T03.transitions = [];
  runtime.playerState.missions["MSN-T03"].status = "locked";
  runtime.playerState.rumors = runtime.playerState.rumors.filter((rumor) => rumor.troubleId !== "T03");
  for (const [id, rumor] of Object.entries(runtime.playerState.rumorById ?? {})) {
    if (rumor?.troubleId === "T03") delete runtime.playerState.rumorById[id];
  }
  for (const rumorId of [...runtime.playerState.player.knownRumorIds]) {
    if (String(rumorId).includes("T03")) runtime.playerState.player.knownRumorIds.delete(rumorId);
  }
  return runtime;
}

test("canonical T03 remains scheduled before Day8 05:00", () => {
  const runtime = runtimeAt(ONSET_MINUTE - 1);
  assert.equal(syncCanonicalT03Day8Onset(runtime, { ok: true }), false);
  assert.equal(runtime.playerState.troubles.T03.status, "scheduled");
  assert.equal(runtime.playerState.missions["MSN-T03"].status, "locked");
});

test("canonical T03 activates once at Day8 dawn and becomes a known local mission", () => {
  const runtime = runtimeAt(ONSET_MINUTE);
  assert.equal(syncCanonicalT03Day8Onset(runtime, { ok: true }), true);
  assert.equal(runtime.playerState.troubles.T03.status, "active");
  assert.equal(runtime.playerState.missions["MSN-T03"].status, "active");
  assert.equal(runtime.playerState.player.knownRumorIds.has(RUMOR_ID), true);
  assert.equal(runtime.playerState.rumorById[RUMOR_ID]?.troubleId, "T03");
  assert.ok(runtime.authoredMissionFlows?.["red-fang-migration"]);

  const transitionCount = runtime.playerState.troubles.T03.transitions.length;
  const rumorCount = runtime.playerState.rumors.filter((rumor) => rumor.id === RUMOR_ID).length;
  assert.equal(syncCanonicalT03Day8Onset(runtime, { ok: true }), false);
  assert.equal(runtime.playerState.troubles.T03.transitions.length, transitionCount);
  assert.equal(runtime.playerState.rumors.filter((rumor) => rumor.id === RUMOR_ID).length, rumorCount);
});

test("canonical T03 feeding-pattern opening exposes the livestock timeline lead", () => {
  const runtime = runtimeAt(ONSET_MINUTE + 180);
  assert.equal(syncCanonicalT03Day8Onset(runtime, { ok: true }), true);
  const opening = authoredMissionFlowExclusiveActions(runtime, {})?.find((action) =>
    action?.authoredMissionFlowId === "red-fang-migration"
      && action?.authoredMissionFlowChoiceId === "feeding_pattern");
  assert.ok(opening);
  assert.equal(applyAuthoredMissionFlowAction(runtime, opening, { ok: true }), true);

  const choices = authoredMissionFlowExclusiveActions(runtime, {}) ?? [];
  assert.ok(choices.some((action) => action?.id?.startsWith(
    `MISSION_FLOW:red-fang-migration:LEAD:${CANONICAL_FIRST_LEAD_ID}@`,
  )));
});

test("canonical T03 onset never revives a terminal mission", () => {
  const runtime = runtimeAt(ONSET_MINUTE + 60);
  runtime.playerState.missions["MSN-T03"].status = "completed";
  assert.equal(syncCanonicalT03Day8Onset(runtime, { ok: true }), false);
  assert.equal(runtime.playerState.troubles.T03.status, "scheduled");
  assert.equal(runtime.playerState.missions["MSN-T03"].status, "completed");
});
