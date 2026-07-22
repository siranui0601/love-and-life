import fs from "node:fs";

const journeyPath = "tools/trpg-sim/lib/player-journey.mjs";
const servicePath = "src/server/trpg/game/service.js";
const integrationTestPath = "tools/trpg-sim/test/player-needs-integration.test.mjs";
const workflowPath = ".github/workflows/apply-trpg-player-needs-v2.yml";
const scriptPath = "tools/trpg-refactor/apply-player-needs-v2.mjs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`Missing integration anchor: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`Ambiguous integration anchor: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

let journey = fs.readFileSync(journeyPath, "utf8");
journey = replaceOnce(
  journey,
  'import { autoShop, createShopRuntime } from "./shop-runtime.mjs";\n',
  `import { autoShop, createShopRuntime } from "./shop-runtime.mjs";
import {
  advancePlayerNeeds,
  completePlayerRest,
  consumeMeal,
  createPlayerNeeds,
  needsUtility,
  publicPlayerNeeds,
} from "./player-needs.mjs";
`,
  "player needs import",
);
journey = replaceOnce(
  journey,
  `function advance(state, model, minutes, reason) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (!value) return;
  const before = state.absoluteMinute;
  state.absoluteMinute = Math.min(GAME_END_MINUTE, state.absoluteMinute + value);
  syncClock(state);
  updateTroubles(state, model);
  propagateRumors(state, model);
  state.history.push({ type: "TIME_ADVANCE", minute: before, minutes: value, reason, afterMinute: state.absoluteMinute });
}`,
  `function advance(state, model, minutes, reason) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (!value) return;
  const before = state.absoluteMinute;
  const normalizedReason = String(reason ?? "time");
  const outdoors = normalizedReason.startsWith("regional-move:")
    || normalizedReason.startsWith("local-move:")
    || normalizedReason.startsWith("mission-battle:")
    || normalizedReason.startsWith("local-investigate:")
    || ["seek-battle", "outdoor-rest", "camp-sleep"].includes(normalizedReason);
  const needChange = advancePlayerNeeds(state.player, {
    minutes: value,
    reason: normalizedReason,
    daypart: state.daypart,
    weatherTags: state.weather?.tags ?? [],
    outdoors,
  });
  if (needChange.hpDrain > 0) state.player.hpRatio = Math.max(0.15, Number(state.player.hpRatio ?? 1) - needChange.hpDrain);
  if (needChange.mpDrain > 0) state.player.mpRatio = Math.max(0.05, Number(state.player.mpRatio ?? 1) - needChange.mpDrain);
  state.absoluteMinute = Math.min(GAME_END_MINUTE, state.absoluteMinute + value);
  syncClock(state);
  updateTroubles(state, model);
  propagateRumors(state, model);
  state.history.push({ type: "TIME_ADVANCE", minute: before, minutes: value, reason, afterMinute: state.absoluteMinute });
}`,
  "needs-aware time advance",
);
journey = replaceOnce(
  journey,
  `function skillContext(state, data) {
  const equipmentIds = Object.values(state.player.equipment).filter(Boolean);
  const grantedSkillIds = equipmentIds.map((id) => data.equipmentById.get(id)?.grantedSkillId).filter(Boolean);
  return {
    player: { level: state.player.level, skills: new Set(state.player.skills) },
    progress: state.progress,
    world: { ...state.worldFlags, troubles: troubleStatusContext(state) },`,
  `function skillContext(state, data) {
  const equipmentIds = Object.values(state.player.equipment).filter(Boolean);
  const grantedSkillIds = equipmentIds.map((id) => data.equipmentById.get(id)?.grantedSkillId).filter(Boolean);
  const needs = publicPlayerNeeds(state.player);
  return {
    player: { level: state.player.level, skills: new Set(state.player.skills) },
    progress: state.progress,
    world: {
      ...state.worldFlags,
      troubles: troubleStatusContext(state),
      daypart: state.daypart,
      hour: state.hour,
      weather: state.weather?.id ?? null,
      weatherTags: new Set(state.weather?.tags ?? []),
      hunger: needs.hunger,
      fatigue: needs.fatigue,
    },`,
  "needs in skill context",
);
journey = replaceOnce(
  journey,
  `function utility(action, state, profile) {
  let score = unit(state.seed, state.absoluteMinute, action.id) * 0.2;`,
  `function utility(action, state, profile) {
  let score = unit(state.seed, state.absoluteMinute, action.id) * 0.2;
  const needScores = needsUtility(state.player);`,
  "needs utility scores",
);
journey = replaceOnce(
  journey,
  `  if (action.type === "rest") {
    score += profile.caution * 8 + (1 - state.player.hpRatio) * 12 + (1 - state.player.mpRatio) * 4;
    if (state.player.hpRatio < 0.6) score += 32;
    if (state.player.mpRatio < 0.25) score += 10;
  }
  if (action.type === "observe") score += profile.explore * 4;`,
  `  if (action.type === "rest") {
    score += profile.caution * 8 + (1 - state.player.hpRatio) * 12 + (1 - state.player.mpRatio) * 4 + needScores.rest;
    if (state.player.hpRatio < 0.6) score += 32;
    if (state.player.mpRatio < 0.25) score += 10;
  }
  if (action.type === "eat") score += needScores.eat + profile.caution * 3;
  if (action.type === "observe") score += profile.explore * 4;`,
  "eat and fatigue action utility",
);
journey = replaceOnce(
  journey,
  `  if (state.player.hpRatio < 0.82 || state.player.mpRatio < 0.55 || state.hour >= 22) {
    candidates.push({ id: "REST", type: "rest", minutes: state.hour >= 20 ? 480 : 120, label: "休息して回復する" });
  }
  if (state.player.gold < (state.tuning.workGoldThreshold ?? 30)) candidates.push({ id: "WORK", type: "work", minutes: 120, label: "仕事をして路銀を得る" });`,
  `  const needs = publicPlayerNeeds(state.player);
  if (needs.hunger >= 38) {
    candidates.push({ id: "EAT", type: "eat", minutes: 30, label: needs.hunger >= 72 ? "食事を取って空腹を満たす" : "軽く食事を取る" });
  }
  if (state.player.hpRatio < 0.82 || state.player.mpRatio < 0.55 || needs.fatigue >= 55 || state.hour >= 21) {
    candidates.push({
      id: "REST",
      type: "rest",
      minutes: state.hour >= 20 || needs.fatigue >= 75 ? 480 : 120,
      label: state.hour >= 20 || needs.fatigue >= 75 ? "今夜の寝床を確保して休む" : "短く休息して疲れを取る",
    });
  }
  if (state.player.gold < (state.tuning.workGoldThreshold ?? 30)) candidates.push({ id: "WORK", type: "work", minutes: 120, label: "仕事をして路銀を得る" });`,
  "survival action generation",
);
journey = replaceOnce(
  journey,
  `  } else if (action.type === "rest") {
    const price = state.player.freeLodging > 0 ? 0 : (state.tuning.restPrice ?? 4);
    if (price > state.player.gold) {
      advance(state, model, Math.min(action.minutes, 180), "outdoor-rest");
      state.player.hpRatio = Math.min(1, state.player.hpRatio + 0.25);
      state.player.mpRatio = Math.min(1, state.player.mpRatio + 0.18);
    } else {
      if (price) state.player.gold -= price;
      else state.player.freeLodging -= 1;
      advance(state, model, action.minutes, "inn-rest");
      state.player.hpRatio = 1;
      state.player.mpRatio = 1;
    }
  } else if (action.type === "work") {`,
  `  } else if (action.type === "rest") {
    const lodging = action.lodging === true;
    const price = lodging
      ? (state.player.freeLodging > 0 ? 0 : Math.max(0, Number(action.price ?? state.tuning.restPrice ?? 4)))
      : 0;
    if (lodging && price > state.player.gold) {
      output = { ok: false, type: action.type, reason: "insufficient_gold_for_lodging", requiredGold: price };
    } else {
      if (lodging) {
        if (price) state.player.gold -= price;
        else state.player.freeLodging = Math.max(0, Number(state.player.freeLodging ?? 0) - 1);
      }
      const duration = lodging ? Math.max(420, Number(action.minutes ?? 480)) : Math.min(180, Number(action.minutes ?? 120));
      advance(state, model, duration, lodging ? "inn-rest" : "outdoor-rest");
      const rest = completePlayerRest(state.player, {
        minute: state.absoluteMinute,
        durationMinutes: duration,
        lodging,
        safety: action.safety ?? "normal",
        weatherTags: state.weather?.tags ?? [],
      });
      state.player.hpRatio = lodging ? 1 : Math.min(1, state.player.hpRatio + 0.25);
      state.player.mpRatio = lodging ? 1 : Math.min(1, state.player.mpRatio + 0.18);
      output.rest = { lodging, price, quality: rest.quality, fatigueReduced: rest.fatigueReduced };
      output.summary = lodging
        ? "宿で" + duration + "分休み、疲労を回復した。"
        : duration + "分休息し、疲労を" + Math.round(rest.fatigueReduced) + "軽減した。";
    }
  } else if (action.type === "eat") {
    const price = state.player.freeMeals > 0
      ? 0
      : Math.max(0, Number(action.price ?? state.tuning.mealPrice ?? 4));
    if (price > state.player.gold) {
      output = { ok: false, type: action.type, reason: "insufficient_gold_for_meal", requiredGold: price };
    } else {
      if (price) state.player.gold -= price;
      else state.player.freeMeals = Math.max(0, Number(state.player.freeMeals ?? 0) - 1);
      const duration = Math.max(10, Number(action.minutes ?? 30));
      advance(state, model, duration, "meal");
      const meal = consumeMeal(state.player, {
        minute: state.absoluteMinute,
        nutrition: action.nutrition ?? 58,
        quality: action.mealQuality ?? "standard",
      });
      state.player.hpRatio = Math.min(1, state.player.hpRatio + 0.05);
      output.meal = { price, quality: meal.quality, hungerReduced: meal.hungerReduced };
      output.summary = "食事を取り、空腹を" + Math.round(meal.hungerReduced) + "軽減した。";
    }
  } else if (action.type === "work") {`,
  "authoritative meal and rest resolution",
);
journey = replaceOnce(
  journey,
  `      freeMeals: Number(tuning.freeStarterMeals ?? 1),
      freeLodging: Number(tuning.freeStarterLodging ?? 1),
      inventory: { items: {}, equipment: owned },`,
  `      freeMeals: Number(tuning.freeStarterMeals ?? 1),
      freeLodging: Number(tuning.freeStarterLodging ?? 1),
      needs: createPlayerNeeds(),
      inventory: { items: {}, equipment: owned },`,
  "initial player needs",
);
fs.writeFileSync(journeyPath, journey);

let service = fs.readFileSync(servicePath, "utf8");
service = replaceOnce(
  service,
  'import { experienceToNextLevel } from "../../../../tools/trpg-sim/lib/mission-model.mjs";\n',
  `import { experienceToNextLevel } from "../../../../tools/trpg-sim/lib/mission-model.mjs";
import { ensurePlayerNeeds, publicPlayerNeeds } from "../../../../tools/trpg-sim/lib/player-needs.mjs";
`,
  "service player needs import",
);
service = replaceOnce(
  service,
  `export const TRPG_GAME_RESOLVER_VERSION = "trpg-player-world-v11";
const MIGRATABLE_RESOLVER_VERSIONS = new Set(["trpg-player-world-v8", "trpg-player-world-v9", "trpg-player-world-v10"]);`,
  `export const TRPG_GAME_RESOLVER_VERSION = "trpg-player-world-v12";
const MIGRATABLE_RESOLVER_VERSIONS = new Set(["trpg-player-world-v8", "trpg-player-world-v9", "trpg-player-world-v10", "trpg-player-world-v11"]);`,
  "resolver version v12",
);
service = replaceOnce(
  service,
  `    workGoldThreshold: 24,
    restPrice: 4,`,
  `    workGoldThreshold: 24,
    mealPrice: 4,
    restPrice: 4,`,
  "meal price tuning",
);
service = replaceOnce(
  service,
  `const REGION_BASE_HOURLY_WAGE = Object.freeze({`,
  `const REGION_MEAL_PRICE = Object.freeze({
  "田園の村": 4,
  "王都": 8,
  "交易都市": 7,
  "犯罪都市": 9,
  "辺境の村": 6,
  "北陵要塞": 7,
  "ドワーフ洞窟": 8,
  "エルフの隠れ里": 6,
  "古代神殿": 8,
  "魔王領": 12,
});

const REGION_LODGING_PRICE = Object.freeze({
  "田園の村": 12,
  "王都": 28,
  "交易都市": 24,
  "犯罪都市": 22,
  "辺境の村": 16,
  "北陵要塞": 18,
  "ドワーフ洞窟": 20,
  "エルフの隠れ里": 18,
  "古代神殿": 20,
  "魔王領": 35,
});

function facilityOffersMeals(facility) {
  return /宿|飯|食堂|酒場|茶屋|パン|市場|料理|厨房/u.test(String(facility?.name ?? "") + " " + String(facility?.type ?? ""));
}

function facilityOffersLodging(facility) {
  return /宿|旅籠|宿泊/u.test(String(facility?.name ?? "") + " " + String(facility?.type ?? ""));
}

function canonicalWeatherForState(state) {
  return resolveCanonicalWeather({ day: state.day, regionId: state.player.location, daypart: state.daypart });
}

const REGION_BASE_HOURLY_WAGE = Object.freeze({`,
  "regional survival affordances",
);
service = replaceOnce(
  service,
  `  playerState.player.displayName = playerName;
  playerState.player.name = playerName;`,
  `  playerState.player.displayName = playerName;
  playerState.player.name = playerName;
  ensurePlayerNeeds(playerState.player);
  playerState.weather = canonicalWeatherForState(playerState);`,
  "initialize needs and weather",
);
service = replaceOnce(
  service,
  `function choiceIntent(action) {
  if (action.type === "conversation") return action.targetNpcId ? "talk" : "investigate";`,
  `function choiceIntent(action) {
  if (action.type === "conversation") return action.targetNpcId ? "talk" : "investigate";
  if (action.type === "eat") return "prepare";`,
  "eat intent",
);
service = replaceOnce(
  service,
  `  if (action.type === "wait" || (action.type === "observe" && String(action.id).startsWith("WAIT-"))) {`,
  `  if (action.type === "eat") {
    if (!facilityOffersMeals(facility)) return null;
    const price = runtime.playerState.player.freeMeals > 0
      ? 0
      : Number(REGION_MEAL_PRICE[runtime.playerState.player.location] ?? 6);
    if (price > runtime.playerState.player.gold) return null;
    return {
      ...action,
      id: "EAT:" + facilityId + ":" + price,
      type: "eat",
      minutes: Math.max(20, Number(action.minutes ?? 30)),
      price,
      nutrition: 58,
      mealQuality: facilityId === "LOC_FARM_INN" ? "hearty" : "standard",
      label: price > 0
        ? String(facility?.name ?? "この場所") + "で食事を取る（" + price + "G）"
        : String(facility?.name ?? "この場所") + "で用意された食事を取る",
    };
  }
  if (action.type === "rest") {
    const lodgingAvailable = facilityOffersLodging(facility);
    const lodgingPrice = runtime.playerState.player.freeLodging > 0
      ? 0
      : Number(REGION_LODGING_PRICE[runtime.playerState.player.location] ?? 20);
    const canAffordLodging = lodgingAvailable
      && (runtime.playerState.player.freeLodging > 0 || lodgingPrice <= runtime.playerState.player.gold);
    const needs = publicPlayerNeeds(runtime.playerState.player);
    const lodging = canAffordLodging && (runtime.playerState.hour >= 18 || needs.fatigue >= 70 || Number(action.minutes ?? 0) >= 420);
    const price = lodging ? lodgingPrice : 0;
    const tags = new Set(runtime.playerState.weather?.tags ?? []);
    const severeWeather = tags.has("storm") || tags.has("snow");
    return {
      ...action,
      id: lodging ? "LODGE:" + facilityId + ":" + price : "REST_OUTDOOR:" + facilityId,
      type: "rest",
      lodging,
      price,
      safety: lodging ? "good" : severeWeather ? "poor" : "normal",
      minutes: lodging ? Math.max(420, Number(action.minutes ?? 480)) : Math.min(180, Number(action.minutes ?? 120)),
      label: lodging
        ? price > 0
          ? String(facility?.name ?? "宿") + "に泊まる（" + price + "G）"
          : String(facility?.name ?? "宿") + "で今夜は休む"
        : severeWeather
          ? "風雨を避けられる場所を探し、短く休息する"
          : "安全そうな場所を探し、短く休息する",
    };
  }
  if (action.type === "wait" || (action.type === "observe" && String(action.id).startsWith("WAIT-"))) {`,
  "facility meal and lodging choices",
);
service = replaceOnce(
  service,
  `    workDescription: cleanText(action.workDescription, 180) || null,
    localVariant: Number(action.localVariant ?? 0),`,
  `    workDescription: cleanText(action.workDescription, 180) || null,
    lodging: action.lodging === true,
    price: Number.isFinite(Number(action.price)) ? Number(action.price) : null,
    nutrition: Number.isFinite(Number(action.nutrition)) ? Number(action.nutrition) : null,
    mealQuality: cleanText(action.mealQuality, 40) || null,
    safety: cleanText(action.safety, 40) || null,
    localVariant: Number(action.localVariant ?? 0),`,
  "survival presentation action fields",
);
service = replaceOnce(
  service,
  `function safeOutcome(result, data = null) {
  const output = { ok: result?.ok !== false, type: result?.type ?? null, reason: result?.reason ?? null };`,
  `function safeOutcome(result, data = null) {
  const output = { ok: result?.ok !== false, type: result?.type ?? null, reason: result?.reason ?? null };
  if (result?.requiredGold !== undefined) output.requiredGold = Number(result.requiredGold);
  if (result?.meal) output.meal = { ...result.meal };
  if (result?.rest) output.rest = { ...result.rest };`,
  "survival outcome fields",
);
service = replaceOnce(
  service,
  `function errorFromResult(result) {
  const code = result?.reason ?? "command_rejected";
  const status = ["insufficient_gold", "insufficient_sp"].includes(code) ? 409 : 400;`,
  `function errorFromResult(result) {
  const code = result?.reason ?? "command_rejected";
  const status = ["insufficient_gold", "insufficient_sp", "insufficient_gold_for_meal", "insufficient_gold_for_lodging"].includes(code) ? 409 : 400;`,
  "survival command statuses",
);
service = replaceOnce(
  service,
  `export function executeGameRuntimeCommand(runtime, data, command) {
  if (!COMMAND_TYPES.has(command.type)) throw new TrpgGameError(400, "unknown_command_type");`,
  `export function executeGameRuntimeCommand(runtime, data, command) {
  if (!COMMAND_TYPES.has(command.type)) throw new TrpgGameError(400, "unknown_command_type");
  ensurePlayerNeeds(runtime.playerState.player);
  runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);`,
  "normalize needs before command",
);
service = replaceOnce(
  service,
  `  updateDialogueSession(runtime, resolvedPlayerAction);
  expireDialogueSession(runtime);
  return {`,
  `  updateDialogueSession(runtime, resolvedPlayerAction);
  expireDialogueSession(runtime);
  runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
  return {`,
  "refresh weather after command",
);
service = replaceOnce(
  service,
  `  if (["work", "localInvestigate", "wait", "plan"].includes(resolved?.type)) {`,
  `  if (resolved?.type === "eat") {
    return {
      narrative: outcome?.meal?.hungerReduced
        ? "温かい食事を取り、空腹が和らいだ。次に歩けるだけの力が戻るまで腰を落ち着けた。"
        : "食事を取り、次の行動に備えた。",
      speeches: [],
    };
  }
  if (resolved?.type === "rest") {
    return {
      narrative: resolved.lodging
        ? "戸を閉められる寝床を確保し、装備を手の届く所へ置いて横になる。目を覚ます頃には、身体の重さが抜けていた。"
        : "風と人目を避けられる場所を選び、荷物を抱えたまま短く身体を休める。宿ほど深くは眠れないが、歩き続けるよりはましだ。",
      speeches: [],
    };
  }
  if (["work", "localInvestigate", "wait", "plan"].includes(resolved?.type)) {`,
  "survival deterministic presentation",
);
service = replaceOnce(
  service,
  `      player: {
        displayName: "オレゴン",
        visibleCondition: "行動可能",
        knownFacts: [`,
  `      player: {
        displayName: "オレゴン",
        visibleCondition: publicPlayerNeeds(runtime.playerState.player).critical
          ? "空腹か疲労が限界に近い"
          : publicPlayerNeeds(runtime.playerState.player).urgent
            ? "空腹か疲労が強い"
            : "行動可能",
        needs: publicPlayerNeeds(runtime.playerState.player),
        knownFacts: [`,
  "needs in narrative input",
);
service = replaceOnce(
  service,
  `      hpRatio: state.player.hpRatio,
      mpRatio: state.player.mpRatio,
      stats: { ...state.player.stats },`,
  `      hpRatio: state.player.hpRatio,
      mpRatio: state.player.mpRatio,
      needs: publicPlayerNeeds(state.player),
      freeMeals: Number(state.player.freeMeals ?? 0),
      freeLodging: Number(state.player.freeLodging ?? 0),
      stats: { ...state.player.stats },`,
  "needs in game view",
);
service = replaceOnce(
  service,
  `      const normalizedSnapshot = serializeRuntime(runtime);
      record.replayBase = {`,
  `      ensurePlayerNeeds(runtime.playerState.player);
      runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
      const normalizedSnapshot = serializeRuntime(runtime);
      record.replayBase = {`,
  "needs after legacy hash verification",
);
service = replaceOnce(
  service,
  `        if (baseHash !== replayBase.stateHash) {
          return { ok: false, revision: replayBase.revision, stateHash: gameStateHash(runtime, this.data), checks: [], baseMatches: false };
        }
        revision = replayBase.revision;`,
  `        if (baseHash !== replayBase.stateHash) {
          return { ok: false, revision: replayBase.revision, stateHash: gameStateHash(runtime, this.data), checks: [], baseMatches: false };
        }
        ensurePlayerNeeds(runtime.playerState.player);
        runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
        revision = replayBase.revision;`,
  "needs in replay migration",
);
fs.writeFileSync(servicePath, service);

fs.writeFileSync(integrationTestPath, `import assert from "node:assert/strict";
import test from "node:test";
import {
  availableGameRuntimeChoiceCandidates,
  buildGameView,
  createGameRuntime,
  gameStateHash,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";
import { resolvePlayerAction } from "../lib/player-journey.mjs";
import { PLAYER_NEEDS_VERSION } from "../lib/player-needs.mjs";

function view(runtime, data) {
  return buildGameView({
    id: "needs-integration",
    schemaVersion: "test",
    contentRevision: data.contentRevision,
    revision: 0,
    stateHash: gameStateHash(runtime, data),
    playerName: "旅人",
    presentation: null,
    lastOutcome: null,
  }, runtime, data);
}

test("new games and the public view expose the formal needs contract", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, { seed: "needs-public-view", profileId: "balanced", playerName: "旅人", tutorial: false });
  const publicView = view(runtime, game.data);
  assert.equal(runtime.playerState.player.needs.version, PLAYER_NEEDS_VERSION);
  assert.equal(publicView.player.needs.version, PLAYER_NEEDS_VERSION);
  assert.equal(publicView.player.needs.hungerLabel, "満たされている");
  assert.ok(publicView.weather.scheduleKey);
});

test("an inn exposes affordable meal and lodging actions when needs are high", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, { seed: "needs-affordances", profileId: "balanced", playerName: "旅人", tutorial: false });
  runtime.playerState.player.facilityId = "LOC_FARM_INN";
  runtime.playerState.player.gold = 100;
  runtime.playerState.player.freeMeals = 0;
  runtime.playerState.player.freeLodging = 0;
  runtime.playerState.player.needs.hunger = 82;
  runtime.playerState.player.needs.fatigue = 88;
  runtime.playerState.hour = 21;
  runtime.playerState.minuteOfDay = 1260;
  runtime.playerState.daypart = "dusk";
  runtime.playerKnowledge.knownFacilityIds.add("LOC_FARM_INN");
  const candidates = availableGameRuntimeChoiceCandidates(runtime, game.data, { limit: 9 });
  const meal = candidates.find((action) => action.type === "eat");
  const lodging = candidates.find((action) => action.type === "rest" && action.lodging === true);
  assert.ok(meal, candidates.map((entry) => entry.type + ":" + entry.label).join(" / "));
  assert.ok(lodging, candidates.map((entry) => entry.type + ":" + entry.label).join(" / "));
  assert.equal(meal.price, 4);
  assert.equal(lodging.price, 12);
});

test("meals and lodging mutate hunger fatigue time and money authoritatively", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, { seed: "needs-resolution", profileId: "balanced", playerName: "旅人", tutorial: false });
  const state = runtime.playerState;
  state.player.gold = 100;
  state.player.freeMeals = 0;
  state.player.freeLodging = 0;
  state.player.needs.hunger = 82;
  state.player.needs.fatigue = 88;
  const beforeMeal = state.absoluteMinute;
  const meal = resolvePlayerAction(state, game.data.model, game.data.battleData, game.data.skills, state.catalog, "balanced", { id: "TEST:EAT", type: "eat", minutes: 30, price: 8, nutrition: 58 });
  assert.equal(meal.ok, true);
  assert.equal(state.player.gold, 92);
  assert.ok(state.player.needs.hunger < 30);
  assert.equal(state.absoluteMinute, beforeMeal + 30);
  const beforeSleep = state.absoluteMinute;
  const rest = resolvePlayerAction(state, game.data.model, game.data.battleData, game.data.skills, state.catalog, "balanced", { id: "TEST:LODGE", type: "rest", lodging: true, minutes: 480, price: 28 });
  assert.equal(rest.ok, true);
  assert.equal(state.player.gold, 64);
  assert.equal(state.player.needs.fatigue, 0);
  assert.equal(state.absoluteMinute, beforeSleep + 480);
});

test("unaffordable paid survival actions reject without advancing time", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, { seed: "needs-insufficient-gold", profileId: "balanced", playerName: "旅人", tutorial: false });
  const state = runtime.playerState;
  state.player.gold = 0;
  state.player.freeMeals = 0;
  state.player.freeLodging = 0;
  const minute = state.absoluteMinute;
  const meal = resolvePlayerAction(state, game.data.model, game.data.battleData, game.data.skills, state.catalog, "balanced", { id: "TEST:EAT:EXPENSIVE", type: "eat", minutes: 30, price: 8 });
  assert.equal(meal.ok, false);
  assert.equal(meal.reason, "insufficient_gold_for_meal");
  assert.equal(state.absoluteMinute, minute);
  const lodging = resolvePlayerAction(state, game.data.model, game.data.battleData, game.data.skills, state.catalog, "balanced", { id: "TEST:LODGE:EXPENSIVE", type: "rest", lodging: true, minutes: 480, price: 28 });
  assert.equal(lodging.ok, false);
  assert.equal(lodging.reason, "insufficient_gold_for_lodging");
  assert.equal(state.absoluteMinute, minute);
});
`);

fs.rmSync(workflowPath, { force: true });
fs.rmSync(scriptPath, { force: true });
