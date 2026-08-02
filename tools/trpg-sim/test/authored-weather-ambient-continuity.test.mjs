import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_WEATHER_AMBIENT_CONTINUITY_VERSION,
  AUTHORED_WEATHER_AMBIENT_INTERNALS,
} from "../../../src/server/trpg/content/authored-weather-ambient-continuity.js";

function runtime({
  day = 8,
  daypart = "day",
  location = "田園の村",
  facilityId = "LOC_FARM_SQUARE",
  weatherId = "rain",
  weatherLabel = "雨",
} = {}) {
  return {
    tutorial: { stage: "free" },
    playerState: {
      day,
      daypart,
      absoluteMinute: (day - 1) * 1440 + 600,
      weather: {
        id: weatherId,
        label: weatherLabel,
        tags: weatherId === "rain" ? ["rain", "wet", "outdoor"] : [weatherId, "outdoor"],
      },
      player: { location, facilityId },
      worldFlags: {},
      history: [],
    },
  };
}

const context = {
  presentNpcs: [
    { id: "NPC010", name: "ミラ" },
    { id: "NPC011", name: "ガロ" },
  ],
};

test("weather creates one handwritten daily three-choice scene per location", () => {
  const value = runtime();
  const actions = AUTHORED_WEATHER_AMBIENT_INTERNALS.weatherAmbientActions(value, context);

  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.weatherAmbientBranchId), ["talk", "help", "observe"]);
  assert.equal(new Set(actions.map((action) => action.family)).size, 3);
  assert.ok(actions.every((action) => action.weatherAmbientWeatherId === "rain"));
  assert.match(actions[0].label, /雨宿り|雨/u);
  assert.equal(actions[0].targetNpcId, "NPC010");
  assert.equal(actions[0].requiredDisclosure.includes("軒下"), true);
});

test("selecting one weather branch permanently closes the other two for that day and location", () => {
  const value = runtime();
  const actions = AUTHORED_WEATHER_AMBIENT_INTERNALS.weatherAmbientActions(value, context);
  const result = { ok: true };

  assert.equal(AUTHORED_WEATHER_AMBIENT_INTERNALS.applyWeatherAmbientAction(value, actions[1], result), true);
  const state = value.playerState.weatherAmbientContinuity;
  assert.equal(state.version, AUTHORED_WEATHER_AMBIENT_CONTINUITY_VERSION);
  assert.deepEqual(state.selectedBranchIds, [actions[1].id]);
  assert.deepEqual(state.closedBranchIds.sort(), [actions[0].id, actions[2].id].sort());
  assert.equal(AUTHORED_WEATHER_AMBIENT_INTERNALS.weatherAmbientActions(value, context), null);
  assert.equal(value.playerState.worldFlags.communityWeatherReadiness["田園の村"], 1);
  assert.equal(value.playerState.history.at(-1).type, "WEATHER_AMBIENT_BRANCH_SELECTED");
  assert.match(result.sceneTransition, /選ばなかった二つの機会は過去/u);
});

test("a later meeting remembers the prior NPC choice instead of replaying the same conversation", () => {
  const value = runtime({ day: 8, weatherId: "light_rain", weatherLabel: "小雨" });
  const first = AUTHORED_WEATHER_AMBIENT_INTERNALS.weatherAmbientActions(value, context);
  AUTHORED_WEATHER_AMBIENT_INTERNALS.applyWeatherAmbientAction(value, first[0], { ok: true });

  value.playerState.day = 9;
  value.playerState.absoluteMinute += 1440;
  value.playerState.weather = { id: "strong_wind", label: "強風", tags: ["wind", "outdoor"] };
  const second = AUTHORED_WEATHER_AMBIENT_INTERNALS.weatherAmbientActions(value, context);

  assert.equal(second.length, 3);
  assert.notDeepEqual(second.map((action) => action.id), first.map((action) => action.id));
  assert.equal(second[0].targetNpcId, "NPC011", "the least-used present NPC receives the next encounter");
  AUTHORED_WEATHER_AMBIENT_INTERNALS.applyWeatherAmbientAction(value, second[1], { ok: true });

  value.playerState.day = 10;
  value.playerState.absoluteMinute += 1440;
  value.playerState.weather = { id: "fog", label: "霧", tags: ["fog", "humid", "outdoor"] };
  const third = AUTHORED_WEATHER_AMBIENT_INTERNALS.weatherAmbientActions(value, {
    presentNpcs: [{ id: "NPC010", name: "ミラ" }],
  });
  assert.match(third[0].label, /前に空模様の話を聞いたミラ/u);
  assert.equal(value.playerState.weatherAmbientContinuity.npcMemories.NPC010.encounterCount, 1);
});

test("weather scenes remain available without an NPC through physical traces, not a fake speaker", () => {
  const value = runtime({ weatherId: "snow", weatherLabel: "雪", location: "北陵要塞" });
  const actions = AUTHORED_WEATHER_AMBIENT_INTERNALS.weatherAmbientActions(value, { presentNpcs: [] });

  assert.equal(actions.length, 3);
  assert.equal(actions[0].targetNpcId, undefined);
  assert.equal(actions[0].type, "localInvestigate");
  assert.match(actions[0].label, /残った言葉/u);
  assert.match(actions[2].label, /足跡/u);
});

test("tutorial and an already active battle keep priority over ambient weather", () => {
  const tutorial = runtime();
  tutorial.tutorial.stage = "first-choice";
  assert.equal(AUTHORED_WEATHER_AMBIENT_INTERNALS.weatherAmbientActions(tutorial, context), null);

  const battle = runtime();
  battle.pendingBattle = { session: { status: "active" } };
  assert.equal(AUTHORED_WEATHER_AMBIENT_INTERNALS.weatherAmbientActions(battle, context), null);
});
