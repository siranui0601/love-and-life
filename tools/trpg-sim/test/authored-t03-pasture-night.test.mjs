import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_T03_PASTURE_NIGHT_INTERNALS as pasture,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const DAY8_NIGHT = 7 * 1440 + 21 * 60;

function runtime() {
  return {
    playerState: {
      absoluteMinute: DAY8_NIGHT,
      player: { location: "田園の村", facilityId: "LOC_FARM_STABLE" },
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

function labels(state) {
  return authoredMissionFlowExclusiveActions(state).map((action) => action.label);
}

test("the pasture night offers force, logistics, and tracking as separate answers", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.label), [
    "先頭の一頭を叩く",
    "羊を先に動かす",
    "追わずに退路を辿る",
  ]);
  assert.deepEqual(actions.map((action) => action.family), ["battle", "prepare", "investigate"]);
  assert.equal(authoredMissionFlowGuidance(state).title, "群れと向き合う夜");
  for (const action of actions) {
    assert.equal(action.actionId, action.id);
    assert.equal(action.missionId, "MSN-T03");
    assert.ok(action.label.length >= 4 && action.label.length <= 20);
  }
});

test("only the standoff carries a canonical encounter", () => {
  const actions = authoredMissionFlowExclusiveActions(runtime());
  assert.equal(actions[0].encounterId, "ENC-0005");
  assert.equal(actions[1].encounterId, null);
  assert.equal(actions[2].encounterId, null);
});

test("each answer opens its own follow-up scene", () => {
  const stand = runtime();
  choose(stand, pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[0]));
  assert.deepEqual(labels(stand), ["崩れ目を塞ぐ", "ジルに狼の読み方を習う", "村長へ夜の報告を上げる"]);

  const move = runtime();
  choose(move, pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[1]));
  assert.deepEqual(labels(move), ["新しい餌場を下見する", "食われた頭数を数える", "村会合で負担を分ける"]);

  const track = runtime();
  choose(track, pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[2]));
  assert.deepEqual(labels(track), ["岩場の奥の爪痕を見る", "フィンの地図に描き足す", "ネネ婆に昔の話を聞く"]);
});

test("force and tracking both reveal a predator behind the pack, by different evidence", () => {
  const stand = runtime();
  choose(stand, pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[0]));
  const track = runtime();
  choose(track, pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[2]));

  assert.equal(stand.playerState.worldFlags.t03PredatorBehindIndicated, true);
  assert.equal(track.playerState.worldFlags.t03PredatorBehindIndicated, true);
  assert.ok(stand.playerState.evidence["T03-EVIDENCE-PASTURE-PACK-LOOKS-BACK"]);
  assert.ok(track.playerState.evidence["T03-EVIDENCE-PASTURE-BLOCKED-DEN-RETURN"]);
  assert.equal(stand.playerState.evidence["T03-EVIDENCE-PASTURE-BLOCKED-DEN-RETURN"], undefined);
});

test("moving the herd seeds the relocation plan instead of a predator lead", () => {
  const state = runtime();
  choose(state, pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[1]));

  assert.equal(state.playerState.worldFlags.t03RelocationPlanSeeded, true);
  assert.equal(state.playerState.worldFlags.t03PackFollowsFood, true);
  assert.equal(state.playerState.worldFlags.t03PredatorBehindIndicated, undefined);
  assert.equal(state.playerState.player.facilityId, "LOC_FARM_FIELD");
});

test("the tracking branch reaches the apex predator claw marks", () => {
  const state = runtime();
  choose(state, pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[2]));
  const result = choose(state, pasture.actionIdFor(pasture.TRACK_SCENE, pasture.TRACK_CHOICES[0]));

  assert.equal(state.playerState.worldFlags.t03ApexPredatorTraceFound, true);
  assert.equal(result.speeches[0].actorId, "NPC060");
  assert.ok(state.playerState.evidence["T03-EVIDENCE-TRACK-APEX-CLAW-MARKS"]);
});

test("the elder's precedent points the player at the river, not the wolves", () => {
  const state = runtime();
  choose(state, pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[2]));
  choose(state, pasture.actionIdFor(pasture.TRACK_SCENE, pasture.TRACK_CHOICES[2]));

  assert.equal(state.playerState.worldFlags.t03RiverWatchAdvised, true);
  assert.equal(state.playerState.worldFlags.t03OldPrecedentHeard, true);
});

test("choosing one answer closes the other two for good", () => {
  const state = runtime();
  const chosen = pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[0]);
  choose(state, chosen);

  const saved = state.playerState.t03PastureNight;
  assert.deepEqual(saved.closedActionIds[pasture.PASTURE_SCENE], [
    pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[1]),
    pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[2]),
  ]);
  const offered = authoredMissionFlowExclusiveActions(state).map((action) => action.id);
  for (const closed of saved.closedActionIds[pasture.PASTURE_SCENE]) {
    assert.equal(offered.includes(closed), false);
  }
  assert.equal(offered.includes(chosen), false);
});

test("the scene is absent outside the village, outside Day8-13, and after T03 closes", () => {
  const away = runtime();
  away.playerState.player.location = "王都";
  assert.equal(pasture.activeSceneId(away), null);

  const early = runtime();
  early.playerState.absoluteMinute = 6 * 1440;
  assert.equal(pasture.activeSceneId(early), null);

  const late = runtime();
  late.playerState.absoluteMinute = 14 * 1440;
  assert.equal(pasture.activeSceneId(late), null);

  const done = runtime();
  done.playerState.missions[0].status = "completed";
  done.playerState.troubles.T03.status = "resolved";
  assert.equal(pasture.activeSceneId(done), null);
});

test("the first night never shadows the other authored T03 modules", () => {
  const atNorthFence = runtime();
  atNorthFence.playerState.player.facilityId = "LOC_FARM_NORTH_FENCE";
  assert.equal(pasture.activeSceneId(atNorthFence), null,
    "the Day8 howl follow-up owns the north fence");

  const elsewhere = runtime();
  elsewhere.playerState.player.facilityId = "LOC_FARM_CHIEF";
  assert.equal(pasture.activeSceneId(elsewhere), null,
    "the first night only opens where the livestock actually are");

  const investigating = runtime();
  investigating.playerState.catalog = {
    byId: new Map([["MSN-T03", {
      id: "MSN-T03",
      steps: [
        { id: "hear", type: "conversation", required: 1 },
        { id: "investigate", type: "investigate", required: 2 },
      ],
    }]]),
  };
  investigating.playerState.missions = [{
    id: "MSN-T03",
    troubleId: "T03",
    status: "active",
    progress: { hear: 1, investigate: 0 },
  }];
  assert.equal(pasture.beforeCanonicalHearing(investigating), false);
  assert.equal(pasture.activeSceneId(investigating), null,
    "once the canonical hearing is done the wolf investigation owns the village");
});

test("saved progress restores mid-branch without replaying the first night", () => {
  const state = runtime();
  choose(state, pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[1]));

  const restored = runtime();
  restored.playerState.t03PastureNight = JSON.parse(
    JSON.stringify(state.playerState.t03PastureNight));

  assert.equal(pasture.activeSceneId(restored), pasture.MOVE_SCENE);
  const offered = authoredMissionFlowExclusiveActions(restored).map((action) => action.id);
  assert.equal(
    offered.includes(pasture.actionIdFor(pasture.PASTURE_SCENE, pasture.PASTURE_CHOICES[1])),
    false);
});
