import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  AUTHORED_T02_GRANARY_DAWN_INTERNALS as dawn,
  AUTHORED_T03_PASTURE_NIGHT_INTERNALS as pasture,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

// 事件は一つずつ片づけるものではない。長引く事件の途中で別の土地・別の事件へ
// 出かけられること、そして戻ってきた時に同じ場面が待ち構えていないことを固定する。

function t02Runtime(facilityId = "LOC_FARM_GRANARY") {
  return {
    playerState: {
      absoluteMinute: 5 * 1440 + 5 * 60,
      player: { location: "田園の村", facilityId },
      missions: [{ id: "MSN-T02", troubleId: "T02", status: "active" }],
      troubles: { T02: { status: "active" } },
      worldFlags: {},
      history: [],
      evidence: {},
    },
  };
}

function t03Runtime(facilityId = "LOC_FARM_STABLE") {
  return {
    playerState: {
      absoluteMinute: 7 * 1440 + 21 * 60,
      player: { location: "田園の村", facilityId },
      missions: [{ id: "MSN-T03", troubleId: "T03", status: "active" }],
      troubles: { T03: { status: "active" } },
      worldFlags: {},
      history: [],
      evidence: {},
    },
  };
}

function choose(state, actionId) {
  const action = authoredMissionFlowExclusiveActions(state)
    .find((entry) => entry.id === actionId);
  assert.ok(action, `action not offered: ${actionId}`);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

test("the granary dawn stays at the fire, not across the whole village", () => {
  assert.equal(dawn.activeSceneId(t02Runtime("LOC_FARM_GRANARY")), dawn.DAWN_SCENE);
  assert.equal(dawn.activeSceneId(t02Runtime("LOC_FARM_SQUARE")), dawn.DAWN_SCENE);

  for (const elsewhere of ["LOC_FARM_INN", "LOC_FARM_FIELD", "LOC_FARM_BAKERY", "LOC_FARM_EDGE"]) {
    assert.equal(dawn.activeSceneId(t02Runtime(elsewhere)), null,
      `${elsewhere} must stay free for other business`);
  }
});

test("a granary follow-up lapses once the player spends half a day elsewhere", () => {
  const state = t02Runtime();
  choose(state, dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[0]));
  assert.equal(dawn.activeSceneId(state), dawn.HEADCOUNT_SCENE);

  const stillWarm = t02Runtime();
  stillWarm.playerState.t02GranaryDawn = structuredClone(state.playerState.t02GranaryDawn);
  stillWarm.playerState.absoluteMinute
    = state.playerState.t02GranaryDawn.lastChoiceAtMinute + dawn.FOLLOW_UP_WINDOW_MINUTES;
  assert.equal(dawn.activeSceneId(stillWarm), dawn.HEADCOUNT_SCENE);

  const gone = t02Runtime();
  gone.playerState.t02GranaryDawn = structuredClone(state.playerState.t02GranaryDawn);
  gone.playerState.absoluteMinute
    = state.playerState.t02GranaryDawn.lastChoiceAtMinute + dawn.FOLLOW_UP_WINDOW_MINUTES + 1;
  assert.equal(dawn.activeSceneId(gone), null,
    "the village does not hold the moment open while the player is away");
});

test("a pasture follow-up lapses the same way", () => {
  const state = t03Runtime();
  choose(state, pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[1]));
  assert.equal(pasture.activeSceneId(state), pasture.MOVE_SCENE);

  const gone = t03Runtime();
  gone.playerState.t03PastureNight = structuredClone(state.playerState.t03PastureNight);
  gone.playerState.absoluteMinute
    = state.playerState.t03PastureNight.lastChoiceAtMinute + pasture.FOLLOW_UP_WINDOW_MINUTES + 1;
  assert.equal(pasture.activeSceneId(gone), null);
});

test("an unfinished granary case does not block the pasture night three days later", () => {
  const midT02 = t02Runtime();
  choose(midT02, dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[2]));

  // Day8の牧場へ。T02は未解決のまま持ち越している。
  const later = {
    playerState: {
      ...midT02.playerState,
      absoluteMinute: 7 * 1440 + 21 * 60,
      player: { location: "田園の村", facilityId: "LOC_FARM_STABLE" },
      missions: [
        { id: "MSN-T02", troubleId: "T02", status: "active" },
        { id: "MSN-T03", troubleId: "T03", status: "active" },
      ],
      troubles: { T02: { status: "active" }, T03: { status: "active" } },
    },
  };

  assert.equal(dawn.activeSceneId(later), null, "the granary dawn window has passed");
  assert.equal(pasture.activeSceneId(later), pasture.PASTURE_SCENE,
    "an open T02 must not stop T03 from reaching the player");

  const offered = authoredMissionFlowExclusiveActions(later).map((action) => action.label);
  assert.deepEqual(offered, ["先頭の一頭を叩く", "羊を先に動かす", "追わずに退路を辿る"]);
});

test("leaving the village entirely frees the player from both scenes", () => {
  for (const build of [t02Runtime, t03Runtime]) {
    const away = build();
    away.playerState.player.location = "王都";
    away.playerState.player.facilityId = "LOC_CAP_SQUARE";
    assert.equal(dawn.activeSceneId(away), null);
    assert.equal(pasture.activeSceneId(away), null);
  }
});
