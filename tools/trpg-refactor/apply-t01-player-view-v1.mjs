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

fs.rmSync("tools/trpg-refactor/apply-t01-player-view-v1.mjs");
console.log("T01 player-view integration applied");
