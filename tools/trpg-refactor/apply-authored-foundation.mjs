import fs from "node:fs";

const servicePath = "src/server/trpg/game/service.js";
const workflowPath = ".github/workflows/apply-trpg-authored-foundation.yml";
const scriptPath = "tools/trpg-refactor/apply-authored-foundation.mjs";

let source = fs.readFileSync(servicePath, "utf8");

function replaceOnce(needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`Missing integration anchor: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`Ambiguous integration anchor: ${label}`);
  source = `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

replaceOnce(
  'import { presentNpcsAt, syncAuthoritativePresentNpcIds } from "./presence.js";\n',
  'import { presentNpcsAt, syncAuthoritativePresentNpcIds } from "./presence.js";\n'
    + 'import { facilityVisibility } from "../resolvers/facility-visibility-resolver.js";\n'
    + 'import { resolveCanonicalWeather, WEATHER_RULESET_VERSION } from "../resolvers/weather-resolver.js";\n',
  "resolver imports",
);

replaceOnce(
  `  const actions = journey.availableMovementActions(runtime.playerState, data.model)\n    .filter((action) => action.movementScope === "local"\n      ? knowledge.knownFacilityIds.has(action.destinationFacilityId)\n      : knowledge.knownHubIds.has(action.destinationHub));`,
  `  const facilityWorldState = { day: runtime.playerState.day, troubles: runtime.playerState.troubles };\n  const actions = journey.availableMovementActions(runtime.playerState, data.model)\n    .filter((action) => action.movementScope !== "local"\n      || facilityVisibility(action.destinationFacilityId, facilityWorldState).visible)\n    .filter((action) => action.movementScope === "local"\n      ? knowledge.knownFacilityIds.has(action.destinationFacilityId)\n      : knowledge.knownHubIds.has(action.destinationHub));`,
  "movement facility visibility",
);

replaceOnce(
  `export function buildGameView(record, runtime, data) {\n  const state = runtime.playerState;`,
  `export function buildGameView(record, runtime, data) {\n  const state = runtime.playerState;\n  const weather = resolveCanonicalWeather({\n    day: state.day,\n    regionId: state.player.location,\n    daypart: state.daypart,\n  });`,
  "game view weather",
);

replaceOnce(
  `      absoluteMinute: state.absoluteMinute,\n    },\n    scene: {`,
  `      absoluteMinute: state.absoluteMinute,\n      weatherId: weather.id,\n      weatherLabel: weather.label,\n    },\n    weather,\n    scene: {`,
  "public weather view",
);

replaceOnce(
  `      knownResolvedTroubleIds: [...state.progress.missions.resolvedTroubleIds].sort(),\n    },`,
  `      knownResolvedTroubleIds: [...state.progress.missions.resolvedTroubleIds].sort(),\n      weatherRulesetVersion: WEATHER_RULESET_VERSION,\n    },`,
  "weather ruleset metadata",
);

fs.writeFileSync(servicePath, source);
fs.rmSync(workflowPath, { force: true });
fs.rmSync(scriptPath, { force: true });
