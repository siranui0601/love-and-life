import test from "node:test";
import assert from "node:assert/strict";
import { loadBattleData } from "../lib/battle-model.mjs";
import { loadSkills } from "../lib/fixtures.mjs";
import {
  availableLocalMovementActions,
  createInitialJourneyState,
  deterministicWeather,
  playerNeedActions,
  resolveMovementAction,
  resolvePlayerAction,
} from "../lib/player-journey.mjs";
import { loadWorldModel } from "../lib/world-model.mjs";
import {
  TrpgGameService,
  createGameRuntime,
  executeGameRuntimeCommand,
} from "../../../src/server/trpg/game/service.js";
import { presentNpcsAt } from "../../../src/server/trpg/game/presence.js";
import {
  buildLocalNarrativeContext,
  sanitizeNarrativeOutput,
  validateNarrativeOutput,
} from "../../../src/server/trpg/narrative-contract.js";

const model = loadWorldModel();
const battleData = await loadBattleData();
const skills = loadSkills();

function fresh() {
  return createInitialJourneyState({ model, battleData, skills, profile: "balanced", seed: "generative-world-needs" });
}

test("capital facilities respect T10 chronology", () => {
  const state = fresh();
  state.player.location = "王都";
  state.player.facilityId = "LOC_CAP_LOWER_INN";
  let ids = new Set(availableLocalMovementActions(state, model).map((entry) => entry.destinationFacilityId));
  assert.equal(ids.has("LOC_CAP_ORPHANAGE"), true);
  assert.equal(ids.has("LOC_CAP_BIG_STORE"), false);

  state.day = 70;
  state.troubles.T10.status = "failed";
  ids = new Set(availableLocalMovementActions(state, model).map((entry) => entry.destinationFacilityId));
  assert.equal(ids.has("LOC_CAP_ORPHANAGE"), false);
  assert.equal(ids.has("LOC_CAP_BIG_STORE"), true);
});

test("weather is global-calendar deterministic and region-sensitive", () => {
  const a = deterministicWeather(17, 660, "王都");
  const b = deterministicWeather(17, 660, "王都");
  const forest = deterministicWeather(17, 660, "エルフの隠れ里");
  assert.deepEqual(a, b);
  assert.notEqual(a.climate, forest.climate);
  assert.ok(a.label);
  assert.ok(forest.label);
});

test("food and sleep actions change hunger, fatigue, time and money authoritatively", () => {
  const state = fresh();
  state.player.location = "王都";
  state.player.facilityId = "LOC_CAP_LOWER_INN";
  state.player.freeMeals = 0;
  state.player.freeLodging = 0;
  state.player.gold = 50;
  state.player.satiety = 20;
  state.player.fatigue = 75;
  const actions = playerNeedActions(state, model);
  const eat = actions.find((entry) => entry.type === "eat");
  const sleep = actions.find((entry) => entry.type === "sleep");
  assert.ok(eat);
  assert.ok(sleep);
  const before = state.absoluteMinute;
  resolvePlayerAction(state, model, battleData, skills, state.catalog, "balanced", eat);
  assert.ok(state.player.satiety > 20);
  assert.ok(state.absoluteMinute > before);
  const afterMeal = state.absoluteMinute;
  resolvePlayerAction(state, model, battleData, skills, state.catalog, "balanced", sleep);
  assert.ok(state.player.fatigue < 30);
  assert.ok(state.absoluteMinute > afterMeal);
  assert.ok(state.player.gold < 50);
});

test("regional travel always records a journey moment and may interrupt with encounters", () => {
  const state = fresh();
  const action = {
    id: "MOVE_REGIONAL:CAPITAL",
    type: "move",
    movementScope: "regional",
    destinationHub: "王都",
    destinationFacilityId: "LOC_CAP_LOWER_INN",
    minutes: 180,
  };
  const result = resolveMovementAction(state, model, battleData, skills, "balanced", action);
  assert.ok(result.travelEvent?.description);
  assert.match(result.travelEvent.description, /道|街道|雨|雪|霧|商隊|旅人|巡回|祠|獣/u);
  assert.ok(result.minutes >= action.minutes || result.reason === "travel_defeat");
});

test("Gemini may mix one authoritative progress anchor with two generated actions", () => {
  const built = buildLocalNarrativeContext({
    action: { id: "LOOK", type: "observe", label: "周囲を見る" },
    authoritativeState: {
      day: 1,
      hour: 11,
      minute: 25,
      daypart: "day",
      locationId: "田園の村",
      facilityId: "LOC_FARM_EDGE",
      facilityName: "村外れ・見張り小屋道",
      presentNpcIds: ["NPC006"],
      npcs: [{ id: "NPC006", name: "青年", role: "旅人", presence: "present", lifeStatus: "alive", locationId: "田園の村", facilityId: "LOC_FARM_EDGE" }],
      availableActionCandidates: [{ id: "ACTION:T01:TRACK", label: "足跡を追う", intentType: "investigate", progressRole: "progress" }],
      progressContract: { mode: "must_offer_progress", anchorCandidateIds: ["ACTION:T01:TRACK"] },
      actionAffordances: {
        allowedKinds: ["talk", "move", "observe"],
        talkNpcIds: ["NPC006"],
        movements: [{ id: "MOVE_LOCAL:LOC_FARM_SQUARE", destinationFacilityId: "LOC_FARM_SQUARE", destinationHub: "田園の村", label: "村の広場へ向かう" }],
        needActions: [],
        workEmployerNpcIds: [],
      },
    },
  }).context;
  const raw = {
    narrative: "青年が道の脇からこちらを見ている。",
    choices: [
      { id: "ACTION:T01:TRACK", label: "足跡を一度だけ確かめる", intentType: "investigate" },
      { id: "GENERATED:1", label: "青年に、この道で見たものを尋ねる", intentType: "talk", targetNpcId: "NPC006", generatedAction: { kind: "talk", targetNpcId: "NPC006" } },
      { id: "GENERATED:2", label: "いったん村の広場へ戻る", intentType: "move", generatedAction: { kind: "move", destinationFacilityId: "LOC_FARM_SQUARE", destinationHub: "田園の村" } },
    ],
    speeches: [],
    proposals: [],
  };
  assert.equal(validateNarrativeOutput(raw, built).ok, true);
  const sanitized = sanitizeNarrativeOutput(raw, built);
  assert.deepEqual(sanitized.choices.map((entry) => entry.generatedAction?.kind ?? "anchor"), ["anchor", "talk", "move"]);
});

test("every visible NPC can be addressed through TALK_NPC independently of the three choices", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, { seed: "direct-talk", profileId: "balanced", playerName: "旅人", tutorial: false });
  const target = presentNpcsAt(runtime, game.data)[0];
  assert.ok(target);
  const result = executeGameRuntimeCommand(runtime, game.data, { type: "TALK_NPC", payload: { npcId: target.id } });
  assert.equal(result.resolvedAction.type, "conversation");
  assert.equal(result.resolvedAction.targetNpcId, target.id);
});
