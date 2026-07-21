import fs from "node:fs";

const servicePath = "src/server/trpg/game/service.js";
const contractPath = "src/server/trpg/content/choice-contract.js";
const workflowPath = ".github/workflows/apply-trpg-diverse-movement-choices.yml";
const scriptPath = "tools/trpg-refactor/apply-diverse-movement-choices.mjs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`Missing integration anchor: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`Ambiguous integration anchor: ${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

let service = fs.readFileSync(servicePath, "utf8");
service = replaceOnce(
  service,
  'import { resolveCanonicalWeather, WEATHER_RULESET_VERSION } from "../resolvers/weather-resolver.js";\n',
  'import { resolveCanonicalWeather, WEATHER_RULESET_VERSION } from "../resolvers/weather-resolver.js";\n'
    + 'import { selectDiverseChoices } from "../content/choice-contract.js";\n',
  "choice contract import",
);
service = replaceOnce(
  service,
  `  const actionPriority = (action) => {\n    if (action.missionId) return 0;\n    if (action.type === "localInvestigate") return 1;\n    if (action.type === "conversation" && !action.workOffer) return 2;\n    const hasLearnedSkill = runtime.playerState.player.skills.size > 0;`,
  `  const actionPriority = (action) => {\n    if (action.missionId) return 0;\n    if (action.type === "localInvestigate") return 1;\n    if (action.type === "move") return 2;\n    if (action.type === "conversation" && !action.workOffer) return 3;\n    const hasLearnedSkill = runtime.playerState.player.skills.size > 0;`,
  "movement choice priority",
);
service = replaceOnce(
  service,
  `  const hasWorkCandidate = prioritized.some((action) => action.workOffer === true || action.type === "work");`,
  `  const movementCandidates = (!runtime.tutorial || runtime.tutorial.stage === "free")\n    ? movementActions(runtime, data).slice(0, 6).map((action) => ({\n      ...action,\n      label: action.movementScope === "regional"\n        ? \`\${action.destinationHub}へ向かう\`\n        : \`\${data.model.facilityById[action.destinationFacilityId]?.name ?? action.destinationFacilityId}へ向かう\`,\n    }))\n    : [];\n  const hasWorkCandidate = prioritized.some((action) => action.workOffer === true || action.type === "work");`,
  "movement choice candidates",
);
service = replaceOnce(
  service,
  `  const combined = [...prioritized, ...fillers]`,
  `  const combined = [...prioritized, ...movementCandidates, ...fillers]`,
  "movement candidates in pool",
);
service = replaceOnce(
  service,
  `function selectedChoiceActions(runtime, actions) {\n  if (!actions.length) return [];\n  const key = narrativeChoicePoolKey(runtime, actions);\n  const selection = runtime.narrativeChoiceSelection?.poolKey === key\n    ? runtime.narrativeChoiceSelection\n    : null;\n  const byId = new Map(actions.map((action) => [action.id, action]));\n  const selected = [];\n  for (const id of selection?.actionIds ?? []) {\n    const action = byId.get(id);\n    if (action && !selected.some((entry) => entry.id === id)) selected.push(action);\n    if (selected.length >= 3) break;\n  }\n  for (const action of actions) {\n    if (selected.length >= 3) break;\n    if (!selected.some((entry) => entry.id === action.id)) selected.push(action);\n  }\n  return withChoiceIds(selected.slice(0, 3).map((action) => generatedChoiceDetail(action, runtime, selection)));\n}`,
  `function selectedChoiceActions(runtime, actions) {\n  if (!actions.length) return [];\n  const key = narrativeChoicePoolKey(runtime, actions);\n  const selection = runtime.narrativeChoiceSelection?.poolKey === key\n    ? runtime.narrativeChoiceSelection\n    : null;\n  const byId = new Map(actions.map((action) => [action.id, action]));\n  const preferred = [];\n  for (const id of selection?.actionIds ?? []) {\n    const action = byId.get(id);\n    if (action && !preferred.some((entry) => entry.id === id)) preferred.push(action);\n  }\n  const ordered = [\n    ...preferred,\n    ...actions.filter((action) => !preferred.some((entry) => entry.id === action.id)),\n  ];\n  const diversified = selectDiverseChoices(ordered, { expectedCount: Math.min(3, ordered.length) });\n  return withChoiceIds(diversified.map((action) => generatedChoiceDetail(action, runtime, selection)));\n}`,
  "semantic choice diversification",
);
service = replaceOnce(
  service,
  `    if (["missionBattle", "seekBattle"].includes(action.type)) {`,
  `    if (["missionBattle", "seekBattle"].includes(action.type)) {`,
  "battle branch anchor",
);
service = replaceOnce(
  service,
  `      }\n    } else {\n      const resolve = () => journey.resolvePlayerAction(`,
  `      }\n    } else if (action.type === "move" && action.movementScope) {\n      const resolve = () => journey.resolveMovementAction(\n        runtime.playerState,\n        data.model,\n        data.battleData,\n        data.skills,\n        profileFor(runtime.playerState.profileId),\n        action,\n      );\n      const resolveWithPlayback = () => withTemporaryTuning(runtime.playerState, "captureBattleTimeline", true, resolve);\n      result = action.movementScope === "regional" && runtime.tutorial && runtime.playerState.player.skills.size === 0\n        ? withTemporaryTuning(runtime.playerState, "disableTravelEncounters", true, resolveWithPlayback)\n        : resolveWithPlayback();\n    } else {\n      const resolve = () => journey.resolvePlayerAction(`,
  "choice movement execution",
);
service = replaceOnce(
  service,
  `  if (command.type === "MOVE" && result.ok && !result.summary) {`,
  `  if (resolvedPlayerAction?.type === "move" && result.ok && !result.summary) {`,
  "movement result summary",
);
service = replaceOnce(
  service,
  `  if (result.ok && command.type === "MOVE") discoverArrival(runtime, data);`,
  `  if (result.ok && resolvedPlayerAction?.type === "move") discoverArrival(runtime, data);`,
  "choice movement arrival discovery",
);
fs.writeFileSync(servicePath, service);

let contract = fs.readFileSync(contractPath, "utf8");
contract = replaceOnce(
  contract,
  `    choice?.targetLocationId,\n    choice?.targetId,`,
  `    choice?.targetLocationId,\n    choice?.destinationFacilityId,\n    choice?.destinationHub,\n    choice?.targetId,`,
  "top-level movement targets",
);
fs.writeFileSync(contractPath, contract);

fs.rmSync(workflowPath, { force: true });
fs.rmSync(scriptPath, { force: true });
