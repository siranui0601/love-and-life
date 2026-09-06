import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_VILLAGE_DAILY_LIFE_INTERNALS as daily,
  AUTHORED_T03_PASTURE_NIGHT_INTERNALS as pasture,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const absoluteMinuteFor = (day, wallMinute) => (day - 1) * 1440 + wallMinute - 600;
const DAY2_MIDDAY = absoluteMinuteFor(2, 12 * 60);
const DAY2_EVENING = absoluteMinuteFor(2, 19 * 60);

function runtime(facilityId = "LOC_FARM_WELL", minute = DAY2_MIDDAY) {
  return {
    playerState: {
      absoluteMinute: minute,
      player: { location: "田園の村", facilityId, hunger: 40, fatigue: 50 },
      hunger: 40,
      fatigue: 50,
      missions: [],
      troubles: {},
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

test("the wellside offers an ordinary drink, a look, and a game", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.deepEqual(actions.map((action) => action.label), [
    "水をがぶ飲みする",
    "桶の縁の跡を見る",
    "子どもと水を掛け合う",
  ]);
  assert.equal(new Set(actions.map((action) => action.family)).size, 3);
  for (const action of actions) {
    assert.equal(action.actionId, action.id);
    assert.equal(action.missionId, undefined, "daily life is not filed under a mission");
  }
  assert.equal(authoredMissionFlowGuidance(state).title, "井戸端で一息つく");
  assert.equal(authoredMissionFlowGuidance(state).missionId, null);
});

test("drinking and playing are real actions, not decoration", () => {
  const drink = runtime();
  choose(drink, daily.actionIdFor(daily.WELL_SCENE, daily.WELL_CHOICES[0]));
  assert.equal(drink.playerState.player.hunger, 34);
  assert.equal(drink.playerState.player.fatigue, 41);
  assert.equal(drink.playerState.worldFlags.t13WaterTasteChanged, true);

  const play = runtime();
  choose(play, daily.actionIdFor(daily.WELL_SCENE, daily.WELL_CHOICES[2]));
  assert.equal(play.playerState.player.fatigue, 55, "horsing around is tiring");
  assert.equal(play.playerState.worldFlags.villageChildrenTrustPlayer, true);
});

test("a purely everyday choice can still yield a canonical lead", () => {
  const state = runtime();
  choose(state, daily.actionIdFor(daily.WELL_SCENE, daily.WELL_CHOICES[1]));

  assert.equal(state.playerState.worldFlags.t13EarlyWaterSignNoticed, true);
  const evidence = state.playerState.evidence["T13-EVIDENCE-DAILY-WELL-WATERLINE"];
  assert.equal(evidence.sourceId, "LOC_FARM_WELL:OLD_WATERLINE_STAIN");

  const play = runtime();
  choose(play, daily.actionIdFor(daily.WELL_SCENE, daily.WELL_CHOICES[2]));
  assert.ok(play.playerState.evidence["T13-EVIDENCE-DAILY-STREAM-GONE-QUIET"],
    "playing with the children reaches the same trouble by another road");
});

test("the three wellside answers reach three different states", () => {
  const flagSets = daily.WELL_CHOICES.map((choice) => {
    const state = runtime();
    choose(state, daily.actionIdFor(daily.WELL_SCENE, choice));
    return Object.keys(state.playerState.worldFlags).sort().join(",");
  });
  assert.equal(new Set(flagSets).size, 3);
});

test("each place has its own scene and its own hours", () => {
  const field = runtime("LOC_FARM_FIELD");
  assert.deepEqual(
    authoredMissionFlowExclusiveActions(field).map((action) => action.label),
    ["畝に寝転ぶ", "穂を一粒噛む", "案山子を直す"]);

  const innByDay = runtime("LOC_FARM_INN", DAY2_MIDDAY);
  assert.equal(daily.ownSceneId(innByDay), null, "the long table fills up after dark");

  const innByNight = runtime("LOC_FARM_INN", DAY2_EVENING);
  assert.deepEqual(
    authoredMissionFlowExclusiveActions(innByNight).map((action) => action.label),
    ["相席する", "女将の愚痴を聞く", "早めに寝る"]);

  const wellAtNight = runtime("LOC_FARM_WELL", DAY2_EVENING + 3 * 60);
  assert.equal(daily.ownSceneId(wellAtNight), null);
});

test("sleeping through the night costs the night and restores the body", () => {
  const state = runtime("LOC_FARM_INN", DAY2_EVENING);
  const action = authoredMissionFlowExclusiveActions(state)
    .find((entry) => entry.id === daily.actionIdFor(daily.INN_SCENE, daily.INN_CHOICES[2]));
  assert.equal(action.minutes, 420);
  choose(state, action.id);
  assert.equal(state.playerState.player.fatigue, 0);
  assert.equal(state.playerState.player.hunger, 52);
});

test("a spent scene does not come back, and the other two branches are closed", () => {
  const state = runtime();
  const chosen = daily.actionIdFor(daily.WELL_SCENE, daily.WELL_CHOICES[0]);
  choose(state, chosen);

  assert.equal(daily.ownSceneId(state), null);
  const saved = state.playerState.villageDailyLife;
  assert.deepEqual(saved.closedActionIds[daily.WELL_SCENE], [
    daily.actionIdFor(daily.WELL_SCENE, daily.WELL_CHOICES[1]),
    daily.actionIdFor(daily.WELL_SCENE, daily.WELL_CHOICES[2]),
  ]);
});

test("spending one place leaves the other places open", () => {
  const state = runtime();
  choose(state, daily.actionIdFor(daily.WELL_SCENE, daily.WELL_CHOICES[1]));

  state.playerState.player.facilityId = "LOC_FARM_FIELD";
  assert.equal(daily.ownSceneId(state), daily.FIELD_SCENE);
});

test("daily life never speaks over an authored trouble scene", () => {
  const duringTrouble = {
    playerState: {
      absoluteMinute: absoluteMinuteFor(8, 12 * 60),
      player: { location: "田園の村", facilityId: "LOC_FARM_STABLE", hunger: 40, fatigue: 50 },
      missions: [{ id: "MSN-T03", troubleId: "T03", status: "active" }],
      troubles: { T03: { status: "active" } },
      worldFlags: {},
      history: [],
      evidence: {},
    },
  };
  assert.equal(pasture.activeSceneId(duringTrouble), pasture.PASTURE_SCENE);
  assert.equal(daily.activeSceneId(duringTrouble), null);

  const offered = authoredMissionFlowExclusiveActions(duringTrouble).map((action) => action.label);
  assert.deepEqual(offered, ["先頭の一頭を叩く", "羊を先に動かす", "追わずに退路を辿る"]);
});

test("daily life returns once the trouble scene has passed", () => {
  const after = {
    playerState: {
      absoluteMinute: absoluteMinuteFor(21, 12 * 60),
      player: { location: "田園の村", facilityId: "LOC_FARM_WELL", hunger: 40, fatigue: 50 },
      missions: [{ id: "MSN-T03", troubleId: "T03", status: "completed", completedAt: 100 }],
      troubles: { T03: { status: "resolved" } },
      worldFlags: {},
      history: [],
      evidence: {},
    },
  };
  assert.equal(daily.activeSceneId(after), daily.WELL_SCENE);
});

test("a hungry or exhausted body outranks the scenery", () => {
  const hungry = runtime("LOC_FARM_WELL");
  hungry.playerState.player.hunger = 82;
  assert.equal(daily.needsAreCalm(hungry), false);
  assert.equal(daily.ownSceneId(hungry), null,
    "eating and lodging belong to the survival layer, not to a wellside chat");

  const tired = runtime("LOC_FARM_INN", DAY2_EVENING);
  tired.playerState.player.fatigue = 88;
  assert.equal(daily.ownSceneId(tired), null);

  const rested = runtime("LOC_FARM_INN", DAY2_EVENING);
  assert.equal(daily.ownSceneId(rested), daily.INN_SCENE);
});