import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_T02_GRANARY_DAWN_INTERNALS as dawn,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const DAY6_DAWN = 5 * 1440 + 5 * 60;

function runtime() {
  return {
    playerState: {
      absoluteMinute: DAY6_DAWN,
      player: { location: "田園の村", facilityId: "LOC_FARM_SQUARE" },
      missions: [{ id: "MSN-T02", troubleId: "T02", status: "active" }],
      troubles: { T02: { status: "active" } },
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

test("the Day5 dawn scene offers three approaches that protect different things", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.label), [
    "人を先に数える",
    "焼け跡に縄を張る",
    "残った食料を数える",
  ]);
  assert.equal(new Set(actions.map((action) => action.family)).size, 3);
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
  for (const action of actions) {
    assert.equal(action.actionId, action.id);
    assert.equal(action.missionId, "MSN-T02");
    assert.ok(action.label.length >= 4 && action.label.length <= 20);
    assert.ok(action.authoredT02DawnSummary.length > 40);
    assert.ok(action.authoredT02DawnSpeech.text.length > 20);
  }
  assert.equal(authoredMissionFlowGuidance(state).title, "焼け跡で最初に守るもの");
});

test("each dawn approach leads to a different second scene", () => {
  const people = runtime();
  choose(people, dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[0]));
  assert.deepEqual(labels(people), [
    "川べりの水車小屋を見る",
    "エダに聞いて回る",
    "炊き出しを始める",
  ]);

  const roped = runtime();
  choose(roped, dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[1]));
  assert.deepEqual(labels(roped), [
    "油筋を布へ写し取る",
    "村務帳へ時刻を残す",
    "野次馬を下がらせる",
  ]);

  const stock = runtime();
  choose(stock, dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[2]));
  assert.deepEqual(labels(stock), [
    "パオロの粉樽を数える",
    "ローナに値を聞く",
    "行商人へ使いを出す",
  ]);
});

test("choosing one approach permanently closes the other two", () => {
  const state = runtime();
  const chosen = dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[1]);
  choose(state, chosen);

  const saved = state.playerState.t02GranaryDawn;
  assert.equal(saved.completedScenes[dawn.DAWN_SCENE], DAY6_DAWN);
  assert.deepEqual(saved.closedActionIds[dawn.DAWN_SCENE], [
    dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[0]),
    dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[2]),
  ]);

  const offered = authoredMissionFlowExclusiveActions(state).map((action) => action.id);
  assert.equal(offered.includes(chosen), false);
  for (const closed of saved.closedActionIds[dawn.DAWN_SCENE]) {
    assert.equal(offered.includes(closed), false);
  }
});

test("the three approaches record different world flags and evidence", () => {
  const people = runtime();
  choose(people, dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[0]));
  assert.equal(people.playerState.worldFlags.t02ThomaMissingAtDawn, true);
  assert.ok(people.playerState.evidence["T02-EVIDENCE-DAWN-KEEPER-ABSENT"]);
  assert.equal(people.playerState.worldFlags.t02FloorEvidenceProtected, undefined);

  const roped = runtime();
  choose(roped, dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[1]));
  assert.equal(roped.playerState.worldFlags.t02FloorEvidenceProtected, true);
  assert.ok(roped.playerState.evidence["T02-EVIDENCE-DAWN-UNTRAMPLED-FLOOR"]);
  assert.equal(roped.playerState.worldFlags.t02ThomaMissingAtDawn, undefined);

  const stock = runtime();
  choose(stock, dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[2]));
  assert.equal(stock.playerState.worldFlags.t02VillageFoodWindowKnown, true);
  assert.ok(stock.playerState.evidence["T02-EVIDENCE-DAWN-TEN-DAY-MARGIN"]);
});

test("the search branch turns Thoma's self-blame into a canonical lamp testimony", () => {
  const state = runtime();
  choose(state, dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[0]));
  const result = choose(state, dawn.actionIdFor(dawn.HEADCOUNT_SCENE, dawn.HEADCOUNT_CHOICES[0]));

  assert.equal(state.playerState.worldFlags.t02ThomaSelfBlameBroken, true);
  const evidence = state.playerState.evidence["T02-EVIDENCE-DAWN-KEEPER-LAMP-HABIT"];
  assert.equal(evidence.sourceId, "NPC005:WATERMILL_TESTIMONY");
  assert.equal(result.speeches[0].actorId, "NPC005");
  assert.equal(state.playerState.player.facilityId, "LOC_FARM_WELL");
});

test("the scene never reopens once both of its steps are spent", () => {
  const state = runtime();
  choose(state, dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[2]));
  choose(state, dawn.actionIdFor(dawn.STOCK_SCENE, dawn.STOCK_CHOICES[1]));

  assert.equal(dawn.activeSceneId(state), null);
  const after = authoredMissionFlowExclusiveActions(state);
  const ownIds = new Set(Object.values(dawn.SCENES).flatMap((choices, index) =>
    choices.map((choice) => dawn.actionIdFor(Object.keys(dawn.SCENES)[index], choice))));
  for (const action of after ?? []) {
    assert.equal(ownIds.has(action.id), false);
  }
});

test("there is no burnt granary to stand in before the fire on the night of Day5", () => {
  const beforeTheFire = runtime();
  beforeTheFire.playerState.absoluteMinute = 4 * 1440 + 6 * 60;
  assert.equal(dawn.activeSceneId(beforeTheFire), null,
    "正本の放火はDay5の夜。その日の朝に焼け跡は無い");

  const afterTheFire = runtime();
  afterTheFire.playerState.absoluteMinute = 4 * 1440 + 23 * 60;
  assert.equal(dawn.activeSceneId(afterTheFire), dawn.DAWN_SCENE);
});

test("the dawn scene is absent outside the village, outside Day6, and after T02 closes", () => {
  const away = runtime();
  away.playerState.player.location = "王都";
  assert.equal(dawn.activeSceneId(away), null);

  const early = runtime();
  early.playerState.absoluteMinute = 3 * 1440;
  assert.equal(dawn.activeSceneId(early), null);

  const late = runtime();
  late.playerState.absoluteMinute = 6 * 1440;
  assert.equal(dawn.activeSceneId(late), null);

  const resolved = runtime();
  resolved.playerState.missions[0].status = "completed";
  resolved.playerState.troubles.T02.status = "completed";
  assert.equal(dawn.activeSceneId(resolved), null);
});

test("saved state survives a serialize and restore without replaying the scene", () => {
  const state = runtime();
  choose(state, dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[0]));

  const restored = runtime();
  restored.playerState.t02GranaryDawn = JSON.parse(
    JSON.stringify(state.playerState.t02GranaryDawn));

  assert.equal(dawn.activeSceneId(restored), dawn.HEADCOUNT_SCENE);
  const offered = authoredMissionFlowExclusiveActions(restored).map((action) => action.id);
  assert.equal(offered.includes(dawn.actionIdFor(dawn.DAWN_SCENE, dawn.DAWN_CHOICES[0])), false);
});
