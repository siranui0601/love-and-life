import fs from "node:fs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`missing_anchor:${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`duplicate_anchor:${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

const servicePath = "src/server/trpg/game/service.js";
let service = fs.readFileSync(servicePath, "utf8");
service = replaceOnce(
  service,
  'export const TRPG_GAME_RESOLVER_VERSION = "trpg-player-world-v13";\nconst MIGRATABLE_RESOLVER_VERSIONS = new Set(["trpg-player-world-v8", "trpg-player-world-v9", "trpg-player-world-v10", "trpg-player-world-v11", "trpg-player-world-v12"]);',
  'export const TRPG_GAME_RESOLVER_VERSION = "trpg-player-world-v14";\nconst MIGRATABLE_RESOLVER_VERSIONS = new Set(["trpg-player-world-v8", "trpg-player-world-v9", "trpg-player-world-v10", "trpg-player-world-v11", "trpg-player-world-v12", "trpg-player-world-v13"]);',
  "resolver-version",
);
service = replaceOnce(
  service,
  'function decorateWorkOfferAction(action, runtime, data, preferredNpcId = null) {',
  `const BLOCKED_WORK_GIVER_NPC_IDS = new Set(["NPC001", "NPC062"]);
const PREFERRED_WORK_GIVER_BY_FACILITY = Object.freeze({
  LOC_FARM_FIELD: "NPC004",
  LOC_FARM_SQUARE: "NPC003",
});

function eligibleWorkGiver(runtime, npc) {
  if (!npc || BLOCKED_WORK_GIVER_NPC_IDS.has(npc.id)) return false;
  const state = runtime.livingWorld.npcStates?.[npc.id];
  if (!state || state.presence !== "present") return false;
  if (["injured", "missing", "dead"].includes(String(state.lifeStatus ?? ""))) return false;
  return true;
}

function workGiverAt(runtime, data, facilityId, preferredNpcId = null) {
  const present = presentNpcsAt(runtime, data).filter((npc) => eligibleWorkGiver(runtime, npc));
  const preferredIds = [preferredNpcId, PREFERRED_WORK_GIVER_BY_FACILITY[facilityId]].filter(Boolean);
  for (const npcId of preferredIds) {
    const match = present.find((npc) => npc.id === npcId);
    if (match) return match;
  }
  return present[0] ?? null;
}

function decorateWorkOfferAction(action, runtime, data, preferredNpcId = null) {`,
  "work-giver-helpers",
);
service = replaceOnce(
  service,
  `  const present = presentNpcsAt(runtime, data);
  const actor = present.find((npc) => npc.id === preferredNpcId)
    ?? present.find((npc) => npc.id === action.targetNpcId)
    ?? present[0]
    ?? null;`,
  `  const actor = workGiverAt(runtime, data, facilityId, preferredNpcId ?? action.targetNpcId);`,
  "work-giver-selection",
);
service = replaceOnce(
  service,
  `  const publicNpc = presentNpcsAt(runtime, data)[0] ?? null;
`,
  `  const publicNpc = presentNpcsAt(runtime, data)[0] ?? null;
  const workGiver = workGiverAt(runtime, data, facilityId);
`,
  "contextual-work-giver",
);
service = replaceOnce(
  service,
  `  if (action.type === "work") {
    if (facilityId === "LOC_FARM_EDGE" || !publicNpc) return null;`,
  `  if (action.type === "work") {
    if (facilityId === "LOC_FARM_EDGE" || !workGiver) return null;`,
  "work-giver-required",
);
service = replaceOnce(
  service,
  `    return decorateWorkOfferAction({ ...action, id: \`WORK:\${facilityId}\`, label, workOffer: true }, runtime, data, publicNpc?.id ?? null);`,
  `    return decorateWorkOfferAction({ ...action, id: \`WORK:\${facilityId}\`, label, workOffer: true }, runtime, data, workGiver.id);`,
  "work-giver-decoration",
);
service = replaceOnce(
  service,
  `function choiceActionPool(runtime, data, { limit = 9 } = {}) {`,
  `function t01FocusedChoiceAllowed(action, runtime) {
  const mission = runtime.playerState.missions?.["MSN-T01"];
  const focused = runtime.playerState.player.facilityId === "LOC_FARM_EDGE"
    && ["active", "available", "in_progress"].includes(String(mission?.status ?? ""));
  if (!focused || action.type !== "conversation") return true;
  return action.missionId === "MSN-T01" || action.targetNpcId === "NPC001";
}

function choiceActionPool(runtime, data, { limit = 9 } = {}) {`,
  "t01-choice-focus-helper",
);
service = replaceOnce(
  service,
  `  )).filter(Boolean).filter((action) => !(action.missionId === "MSN-T01"
    && action.stepId === "decide"
    && !ensureT01EscortState(runtime).arrivedSquare));`,
  `  )).filter(Boolean).filter((action) => !(action.missionId === "MSN-T01"
    && action.stepId === "decide"
    && !ensureT01EscortState(runtime).arrivedSquare))
    .filter((action) => t01FocusedChoiceAllowed(action, runtime));`,
  "t01-choice-focus-filter",
);
service = replaceOnce(
  service,
  `  const arrivalVisitCount = completedRegionalMoves.filter((entry) => entry.to === state.player.location).length;
  return {`,
  `  const arrivalVisitCount = completedRegionalMoves.filter((entry) => entry.to === state.player.location).length;
  const t01Escort = ensureT01EscortState(runtime);
  return {`,
  "authored-context-escort",
);
service = replaceOnce(
  service,
  `    journey: {
      fromHub: latestRegionalMove?.from ?? null,
      toHub: latestRegionalMove?.to ?? null,
      arrivalVisitCount,
    },
    weather: canonicalWeatherForState(state),`,
  `    journey: {
      fromHub: latestRegionalMove?.from ?? null,
      toHub: latestRegionalMove?.to ?? null,
      arrivalVisitCount,
    },
    story: {
      t01ReunionNow: state.player.facilityId === "LOC_FARM_SQUARE"
        && t01Escort.reunionBeatAtMinute === state.absoluteMinute,
    },
    weather: canonicalWeatherForState(state),`,
  "authored-context-story",
);
fs.writeFileSync(servicePath, service, "utf8");

const registryPath = "src/server/trpg/content/authored-scene-registry.js";
let registry = fs.readFileSync(registryPath, "utf8");
registry = replaceOnce(
  registry,
  'export const AUTHORED_CONTENT_VERSION = "authored-content-v2";',
  'export const AUTHORED_CONTENT_VERSION = "authored-content-v3";',
  "authored-version",
);
fs.writeFileSync(registryPath, registry, "utf8");

const testPath = "tools/trpg-sim/test/game-service.test.mjs";
let testSource = fs.readFileSync(testPath, "utf8");
testSource = replaceOnce(
  testSource,
  `  const firstSearch = await chooseSearch("tracks");
  const secondSearch = await chooseSearch("faint-voice");
  const searchInputs = narrativeInputs.filter((input) => input.action?.stepId === "search");
  assert.equal(searchInputs.length, 2);
  assert.equal(searchInputs[0].authoritativeOutcome.discovery.id, firstSearch.discoveryId);
  assert.equal(searchInputs[0].authoritativeState.missions.find((mission) => mission.id === "MSN-T01")
    ?.currentStep.progress, 1);
  assert.equal(searchInputs[0].authoritativeState.missions.find((mission) => mission.id === "MSN-T01")
    ?.currentStep.required, 2);
  assert.deepEqual(searchInputs[1].authoritativeState.missions.find((mission) => mission.id === "MSN-T01")
    ?.discoveries.map((discovery) => discovery.id), [firstSearch.discoveryId, secondSearch.discoveryId]);`,
  `  const firstSearch = await chooseSearch("tracks");
  assert.match(firstSearch.response.save.scene.narrative, /小さな靴跡|赤牙狼の爪痕|青い糸/u);
  assert.doesNotMatch(firstSearch.response.save.scene.narrative, /見知らぬ人物|青年/u);
  const secondSearch = await chooseSearch("faint-voice");
  assert.match(secondSearch.response.save.scene.narrative, /フィン|子ども/u);
  assert.match(secondSearch.response.save.scene.narrative, /生きて|声|咳/u);
  assert.match(secondSearch.response.save.scene.narrative, /狼|赤牙狼/u);
  assert.doesNotMatch(secondSearch.response.save.scene.narrative, /見知らぬ人物|青年/u);
  const searchInputs = narrativeInputs.filter((input) => input.action?.stepId === "search");
  assert.equal(searchInputs.length, 0, "reviewed T01 search discoveries bypass Gemini generation");
  assert.deepEqual(runner.save.missions.find((mission) => mission.id === "MSN-T01")
    ?.discoveries.map((discovery) => discovery.id), [firstSearch.discoveryId, secondSearch.discoveryId]);`,
  "reviewed-search-expectations",
);
testSource = replaceOnce(
  testSource,
  `  assert.match(battleRecord.presentation.narrative, /斜面の下.*青年/u);
  assert.ok(battleRecord.presentation.speeches.some((speech) => speech.actorId === "NPC001"
    && /フィン.*足.*一人では村まで戻れそうにない/u.test(speech.text)));`,
  `  assert.match(battleRecord.presentation.narrative, /斜面の下.*少年/u);
  assert.doesNotMatch(battleRecord.presentation.narrative, /青年/u);
  assert.ok(battleRecord.presentation.speeches.some((speech) => speech.actorId === "NPC001"
    && /僕、フィン.*足が動かない.*置いていかないで.*村の広場/u.test(speech.text)));`,
  "reviewed-rescue-expectations",
);
testSource = replaceOnce(
  testSource,
  `  const escortInput = narrativeInputs.findLast((input) => input.action?.dialogueTopic === "t01_escort");
  assert.ok(escortInput);
  assert.equal(escortInput.action.requiredDisclosure, null);
  assert.deepEqual(escortInput.authoritativeState.reactionContract.requiredActorIds, ["NPC001"]);
  assert.ok(escortInput.authoritativeState.reactionContract.goals.some((goal) => /同行/u.test(goal)));
  assert.ok(runner.save.scene.beats.some((beat) => beat.actorId === "NPC001"
    && /足を痛めて.*村の広場.*一緒に戻って/u.test(beat.text)));`,
  `  const escortInput = narrativeInputs.findLast((input) => input.action?.dialogueTopic === "t01_escort");
  assert.equal(escortInput, undefined, "the reviewed escort request bypasses Gemini generation");
  const escortRecord = await store.get(runner.save.id);
  assert.equal(escortRecord.presentation.source, "authored_scene");
  assert.equal(escortRecord.presentation.sceneId, "t01.escort.request");
  assert.ok(runner.save.scene.beats.some((beat) => beat.actorId === "NPC001"
    && /足が動かない.*母さん.*肩を貸して.*置いていかないで/u.test(beat.text)));`,
  "reviewed-escort-expectations",
);
fs.writeFileSync(testPath, testSource, "utf8");

fs.rmSync("tools/trpg-refactor/apply-t01-player-view-v1.mjs");
console.log("T01 player-view source and reviewed-scene tests applied");
