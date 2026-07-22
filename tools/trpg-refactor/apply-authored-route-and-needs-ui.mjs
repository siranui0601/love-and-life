import fs from "node:fs";

const servicePath = "src/server/trpg/game/service.js";
const indexPath = "public/TRPG/index.html";
const appPath = "public/TRPG/app.js";
const stylePath = "public/TRPG/style.css";
const authoredTestPath = "tools/trpg-sim/test/authored-journey-presentation.test.mjs";
const uiTestPath = "tools/trpg-sim/test/trpg-needs-ui-contract.test.mjs";
const workflowPath = ".github/workflows/apply-trpg-authored-route-and-needs-ui.yml";
const scriptPath = "tools/trpg-refactor/apply-authored-route-and-needs-ui.mjs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error("Missing integration anchor: " + label);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error("Ambiguous integration anchor: " + label);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

let service = fs.readFileSync(servicePath, "utf8");
service = replaceOnce(
  service,
  'import { selectDiverseChoices } from "../content/choice-contract.js";\n',
  'import { selectDiverseChoices } from "../content/choice-contract.js";\nimport { resolveAuthoredScene } from "../content/authored-scene-registry.js";\n',
  "authored registry import",
);

const authoredHelpers = `function authoredSceneContext(runtime, action, outcome) {
  const resolved = action?.resolvedAction ?? action ?? {};
  const state = runtime.playerState;
  const completedRegionalMoves = state.history.filter((entry) => entry.type === "REGIONAL_MOVE_COMPLETED");
  const latestRegionalMove = completedRegionalMoves.at(-1) ?? null;
  const arrivalVisitCount = completedRegionalMoves.filter((entry) => entry.to === state.player.location).length;
  return {
    action: {
      id: resolved.id ?? null,
      type: resolved.type ?? null,
      movementScope: resolved.movementScope ?? null,
      destinationHub: resolved.destinationHub ?? null,
      destinationFacilityId: resolved.destinationFacilityId ?? null,
      lodging: resolved.lodging === true,
      price: Number.isFinite(Number(resolved.price)) ? Number(resolved.price) : null,
    },
    outcome: outcome ?? {},
    mission: {
      id: resolved.missionId ?? null,
      stepId: resolved.stepId ?? null,
    },
    location: {
      hub: state.player.location,
      facilityId: state.player.facilityId,
    },
    journey: {
      fromHub: latestRegionalMove?.from ?? null,
      toHub: latestRegionalMove?.to ?? null,
      arrivalVisitCount,
    },
    weather: canonicalWeatherForState(state),
    player: {
      needs: publicPlayerNeeds(state.player),
    },
  };
}

function authoredNarrativeForWeather(scene, weather) {
  const byId = scene?.narrativeByWeatherId?.[weather?.id];
  if (String(byId ?? "").trim()) return String(byId).trim();
  const tags = new Set(weather?.tags ?? []);
  const priority = ["storm", "snow", "rain", "fog", "wind", "dry", "clear"];
  for (const tag of priority) {
    const candidate = scene?.narrativeByWeatherTag?.[tag];
    if (tags.has(tag) && String(candidate ?? "").trim()) return String(candidate).trim();
  }
  return String(scene?.narrative ?? "").trim();
}

export function resolveReviewedAuthoredPresentation(runtime, data, action = null, outcome = null) {
  const context = authoredSceneContext(runtime, action, outcome);
  const scene = resolveAuthoredScene(context);
  if (!scene) return null;
  const presentIds = new Set(presentNpcsAt(runtime, data).map((npc) => npc.id));
  const speeches = (scene.beats ?? [])
    .filter((beat) => beat?.kind === "npc" && beat.actorId && presentIds.has(beat.actorId))
    .map((beat) => ({
      actorId: beat.actorId,
      text: cleanText(beat.text, 500),
      emotion: cleanText(beat.emotion, 40) || null,
    }));
  return {
    sceneId: scene.sceneId,
    presentationOnly: scene.presentationOnly === true,
    narrative: authoredNarrativeForWeather(scene, context.weather),
    speeches,
  };
}

`;
service = replaceOnce(
  service,
  "async function updatePresentation(record, runtime, data, narrator, action = null, outcome = null) {",
  authoredHelpers + "async function updatePresentation(record, runtime, data, narrator, action = null, outcome = null) {",
  "authored presentation resolver",
);
service = replaceOnce(
  service,
  `  const deterministic = deterministicFallbackPresentation(runtime, data, action, outcome);
  const resolvedAction = action?.resolvedAction ?? action;`,
  `  const reviewed = resolveReviewedAuthoredPresentation(runtime, data, action, outcome);
  if (reviewed) {
    runtime.narrativeChoiceSelection = null;
    const base = {
      revision: record.revision,
      source: "authored_scene",
      sceneId: reviewed.sceneId,
      narrative: reviewed.narrative,
      speeches: reviewed.speeches,
      choiceLabels: {},
    };
    record.presentation = presentationWithOrderedBeats(runtime, data, action?.resolvedAction ?? action, base);
    return;
  }
  const deterministic = deterministicFallbackPresentation(runtime, data, action, outcome);
  const resolvedAction = action?.resolvedAction ?? action;`,
  "authored scene priority before Gemini",
);
fs.writeFileSync(servicePath, service);

let index = fs.readFileSync(indexPath, "utf8");
index = replaceOnce(index, "/TRPG/style.css?v=20260719-agency-v7", "/TRPG/style.css?v=20260722-needs-v2", "style cache version");
index = replaceOnce(
  index,
  '<span class="compact-clock"><span id="dayLabel">Day —</span><time id="timeLabel">--:--</time><span id="daypartLabel" class="sr-only">—</span></span>',
  '<span class="compact-clock"><span id="dayLabel">Day —</span><time id="timeLabel">--:--</time><span id="weatherLabel" class="weather-label">天気—</span><span id="daypartLabel" class="sr-only">—</span></span>',
  "weather label",
);
index = replaceOnce(
  index,
  `          <label>MP <progress id="mpBar" max="1" value="1"></progress><span id="mpText">100%</span></label>
          <b id="playerGold">0 G</b>`,
  `          <label>MP <progress id="mpBar" max="1" value="1"></progress><span id="mpText">100%</span></label>
          <span id="hungerStatus" class="need-status" data-level="normal" title="空腹度">食 15</span>
          <span id="fatigueStatus" class="need-status" data-level="normal" title="疲労度">疲 8</span>
          <b id="playerGold">0 G</b>`,
  "needs status chips",
);
index = replaceOnce(index, "/TRPG/app.js?v=20260720-onboarding-v2", "/TRPG/app.js?v=20260722-needs-v2", "app cache version");
fs.writeFileSync(indexPath, index);

let app = fs.readFileSync(appPath, "utf8");
app = replaceOnce(
  app,
  '  const parts = [`${clock.day} ${clock.time}、${facility}`];',
  '  const weatherText = save?.weather?.label ? "、天気は" + escapeText(save.weather.label) : "";\n  const parts = [clock.day + " " + clock.time + "、" + facility + weatherText];',
  "weather scene announcement",
);
app = replaceOnce(
  app,
  `  $("#hpText").textContent = formatPercent(hp);
  $("#mpText").textContent = formatPercent(mp);
}`,
  `  $("#hpText").textContent = formatPercent(hp);
  $("#mpText").textContent = formatPercent(mp);
  const hunger = Math.max(0, Math.min(100, number(player.needs?.hunger, 0)));
  const fatigue = Math.max(0, Math.min(100, number(player.needs?.fatigue, 0)));
  const hungerStatus = $("#hungerStatus");
  const fatigueStatus = $("#fatigueStatus");
  hungerStatus.textContent = "食 " + Math.round(hunger);
  hungerStatus.title = "空腹度 " + Math.round(hunger) + "：" + escapeText(player.needs?.hungerLabel, "状態不明");
  hungerStatus.dataset.level = hunger >= 80 ? "critical" : hunger >= 55 ? "warning" : "normal";
  fatigueStatus.textContent = "疲 " + Math.round(fatigue);
  fatigueStatus.title = "疲労度 " + Math.round(fatigue) + "：" + escapeText(player.needs?.fatigueLabel, "状態不明");
  fatigueStatus.dataset.level = fatigue >= 80 ? "critical" : fatigue >= 55 ? "warning" : "normal";
}`,
  "render needs status",
);
app = replaceOnce(
  app,
  `  $("#timeLabel").textContent = clock.time;
  $("#daypartLabel").textContent = clock.daypart;
  $("#locationName").textContent = escapeText(scene.location, "未知の地域");`,
  `  $("#timeLabel").textContent = clock.time;
  $("#daypartLabel").textContent = clock.daypart;
  const weather = save.weather ?? {};
  $("#weatherLabel").textContent = weather.label ? escapeText(weather.label) : "天気—";
  $("#weatherLabel").title = weather.label
    ? escapeText(weather.label) + "。移動時間倍率 " + Number(weather.travelTimeMultiplier ?? 1).toFixed(2)
    : "天候情報なし";
  $("#locationName").textContent = escapeText(scene.location, "未知の地域");`,
  "render canonical weather",
);
fs.writeFileSync(appPath, app);

let style = fs.readFileSync(stylePath, "utf8");
style += `

.weather-label {
  color: #c9d8c6;
  font-size: .58rem;
  white-space: nowrap;
}
.need-status {
  padding: 1px 5px;
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 999px;
  color: #dfe8dc;
  background: rgba(255,255,255,.08);
  font-size: .58rem;
  font-weight: 800;
  white-space: nowrap;
}
.need-status[data-level="warning"] {
  border-color: rgba(255,205,111,.28);
  color: #ffe0a0;
  background: rgba(160,104,20,.25);
}
.need-status[data-level="critical"] {
  border-color: rgba(255,148,123,.34);
  color: #ffd0c6;
  background: rgba(150,45,30,.34);
}
@media (max-width: 420px) {
  .weather-label { max-width: 64px; overflow: hidden; text-overflow: ellipsis; }
  .scene-status { gap: 4px; }
  .need-status { padding-inline: 3px; }
}
`;
fs.writeFileSync(stylePath, style);

fs.writeFileSync(authoredTestPath, `import assert from "node:assert/strict";
import test from "node:test";
import {
  availableGameRuntimeActions,
  createGameRuntime,
  executeGameRuntimeCommand,
  resolveReviewedAuthoredPresentation,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";
import {
  resolveAuthoredScene,
  validateAuthoredScene,
} from "../../../src/server/trpg/content/authored-scene-registry.js";

test("the first farm-to-capital arrival resolves as a presentation-only reviewed scene", () => {
  const scene = resolveAuthoredScene({
    action: { type: "move", movementScope: "regional" },
    outcome: { ok: true },
    journey: { fromHub: "田園の村", toHub: "王都", arrivalVisitCount: 1 },
    location: { facilityId: "LOC_CAP_LOWER_INN" },
  });
  assert.equal(scene?.sceneId, "journey.farm_to_capital.first_arrival");
  const validation = validateAuthoredScene(scene);
  assert.equal(validation.valid, true, validation.errors.join("\n"));
  assert.equal(scene.presentationOnly, true);
  assert.deepEqual(scene.choices, []);
});

test("authoritative regional travel to the capital selects the reviewed lower-inn arrival", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, {
    seed: "authored-farm-capital-arrival",
    profileId: "balanced",
    playerName: "旅人",
    tutorial: false,
  });
  runtime.playerState.tuning.disableTravelEncounters = true;
  runtime.playerKnowledge.knownHubIds.add("王都");
  const movement = availableGameRuntimeActions(runtime, game.data).movement
    .find((entry) => entry.destinationHub === "王都");
  assert.ok(movement);
  const result = executeGameRuntimeCommand(runtime, game.data, {
    type: "MOVE",
    payload: { moveId: movement.id },
  });
  assert.equal(result.outcome.ok, true);
  assert.equal(runtime.playerState.player.location, "王都");
  assert.equal(runtime.playerState.player.facilityId, "LOC_CAP_LOWER_INN");
  const presentation = resolveReviewedAuthoredPresentation(runtime, game.data, result, result.outcome);
  assert.equal(presentation?.sceneId, "journey.farm_to_capital.first_arrival");
  assert.match(presentation.narrative, /王都/u);
  assert.match(presentation.narrative, /安宿/u);
});

test("weather-tagged reviewed prose takes precedence over the generic arrival prose", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, {
    seed: "authored-weather-prose",
    profileId: "balanced",
    playerName: "旅人",
    tutorial: false,
  });
  runtime.playerState.player.location = "王都";
  runtime.playerState.player.facilityId = "LOC_CAP_LOWER_INN";
  runtime.playerState.weather = { id: "rain", label: "雨", tags: ["rain", "wet", "outdoor"] };
  runtime.playerState.history.push({ type: "REGIONAL_MOVE_COMPLETED", from: "田園の村", to: "王都", facilityId: "LOC_CAP_LOWER_INN" });
  const presentation = resolveReviewedAuthoredPresentation(runtime, game.data, {
    resolvedAction: { id: "MOVE_REGION:王都", type: "move", movementScope: "regional" },
  }, { ok: true });
  assert.equal(presentation?.sceneId, "journey.farm_to_capital.first_arrival");
  assert.match(presentation.narrative, /雨|濡/u);
});
`);

fs.writeFileSync(uiTestPath, `import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("the playable UI renders canonical weather hunger and fatigue", () => {
  const html = fs.readFileSync("public/TRPG/index.html", "utf8");
  const app = fs.readFileSync("public/TRPG/app.js", "utf8");
  const css = fs.readFileSync("public/TRPG/style.css", "utf8");
  assert.match(html, /id="weatherLabel"/u);
  assert.match(html, /id="hungerStatus"/u);
  assert.match(html, /id="fatigueStatus"/u);
  assert.match(app, /player\.needs\?\.hunger/u);
  assert.match(app, /player\.needs\?\.fatigue/u);
  assert.match(app, /save\.weather/u);
  assert.match(css, /\.need-status/u);
  assert.match(css, /\.weather-label/u);
});

test("reviewed authored scenes are resolved before the Gemini branch", () => {
  const service = fs.readFileSync("src/server/trpg/game/service.js", "utf8");
  const reviewed = service.indexOf("const reviewed = resolveReviewedAuthoredPresentation");
  const gemini = service.indexOf("if (!narrator)", reviewed);
  assert.ok(reviewed >= 0);
  assert.ok(gemini > reviewed);
});
`);

fs.rmSync(workflowPath, { force: true });
fs.rmSync(scriptPath, { force: true });
