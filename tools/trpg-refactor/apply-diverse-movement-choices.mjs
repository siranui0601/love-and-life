import fs from "node:fs";

const servicePath = "src/server/trpg/game/service.js";
const contractPath = "src/server/trpg/content/choice-contract.js";
const gameServiceTestPath = "tools/trpg-sim/test/game-service.test.mjs";
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
  `  const hasWorkCandidate = prioritized.some((action) => action.workOffer === true || action.type === "work");`,
  `  const movementCandidates = (!runtime.tutorial || runtime.tutorial.stage === "free")\n    ? movementActions(runtime, data).slice(0, 6).map((action) => ({\n      ...action,\n      label: action.movementScope === "regional"\n        ? \`\${action.destinationHub}へ向かう\`\n        : \`\${data.model.facilityById[action.destinationFacilityId]?.name ?? action.destinationFacilityId}へ向かう\`,\n    }))\n    : [];\n  const hasWorkCandidate = prioritized.some((action) => action.workOffer === true || action.type === "work");`,
  "movement choice candidates",
);
service = replaceOnce(
  service,
  `  return eligible.slice(0, Math.max(3, Math.min(12, Number(limit) || 9)));\n}\n\nfunction narrativeChoicePoolKey`,
  `  const cap = Math.max(3, Math.min(12, Number(limit) || 9));\n  const selected = eligible.slice(0, cap);\n  if (cap > 3 && movementCandidates.length && !selected.some((action) => action.type === "move")) {\n    const movement = movementCandidates.find((action) => !selected.some((entry) => entry.id === action.id));\n    if (movement) {\n      if (selected.length >= cap) selected[selected.length - 1] = movement;\n      else selected.push(movement);\n    }\n  }\n  return selected;\n}\n\nexport function availableGameRuntimeChoiceCandidates(runtime, data, options = {}) {\n  return choiceActionPool(runtime, data, options);\n}\n\nfunction narrativeChoicePoolKey`,
  "movement candidate reservation and testable pool",
);
service = replaceOnce(
  service,
  `function selectedChoiceActions(runtime, actions) {\n  if (!actions.length) return [];\n  const key = narrativeChoicePoolKey(runtime, actions);\n  const selection = runtime.narrativeChoiceSelection?.poolKey === key\n    ? runtime.narrativeChoiceSelection\n    : null;\n  const byId = new Map(actions.map((action) => [action.id, action]));\n  const selected = [];\n  for (const id of selection?.actionIds ?? []) {\n    const action = byId.get(id);\n    if (action && !selected.some((entry) => entry.id === id)) selected.push(action);\n    if (selected.length >= 3) break;\n  }\n  for (const action of actions) {\n    if (selected.length >= 3) break;\n    if (!selected.some((entry) => entry.id === action.id)) selected.push(action);\n  }\n  return withChoiceIds(selected.slice(0, 3).map((action) => generatedChoiceDetail(action, runtime, selection)));\n}`,
  `function selectedChoiceActions(runtime, actions) {\n  if (!actions.length) return [];\n  const key = narrativeChoicePoolKey(runtime, actions);\n  const selection = runtime.narrativeChoiceSelection?.poolKey === key\n    ? runtime.narrativeChoiceSelection\n    : null;\n  const byId = new Map(actions.map((action) => [action.id, action]));\n  const preferred = [];\n  for (const id of selection?.actionIds ?? []) {\n    const action = byId.get(id);\n    if (action && !preferred.some((entry) => entry.id === id)) preferred.push(action);\n    if (preferred.length >= 3) break;\n  }\n  const legacy = [\n    ...preferred,\n    ...actions.filter((action) => !preferred.some((entry) => entry.id === action.id)),\n  ].slice(0, 3);\n  const preserveReviewedOrder = !selection || (runtime.tutorial && runtime.tutorial.stage !== "free");\n  const selected = preserveReviewedOrder\n    ? legacy\n    : selectDiverseChoices([\n      ...preferred,\n      ...actions.filter((action) => !preferred.some((entry) => entry.id === action.id)),\n    ], { expectedCount: Math.min(3, actions.length) });\n  return withChoiceIds(selected.map((action) => generatedChoiceDetail(action, runtime, selection)));\n}`,
  "Gemini-only semantic choice diversification",
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

let gameServiceTest = fs.readFileSync(gameServiceTestPath, "utf8");
gameServiceTest = replaceOnce(
  gameServiceTest,
  `  const chooseSearch = async (approachId) => {\n    const choice = runner.save.choices.find((entry) => entry.missionId === "MSN-T01"\n      && entry.stepId === "search"\n      && entry.actionId.endsWith(\`:\${approachId}\`));\n    assert.ok(choice, \`\${approachId} must be one of the current T01 search approaches\`);\n    return runner.run("CHOOSE", { choiceId: choice.choiceId, actionId: choice.actionId });\n  };`,
  `  const chooseSearch = async (preferredApproachId = null) => {\n    const available = runner.save.choices.filter((entry) => entry.missionId === "MSN-T01"\n      && entry.stepId === "search");\n    const choice = available.find((entry) => preferredApproachId && entry.actionId.endsWith(\`:\${preferredApproachId}\`))\n      ?? available[0];\n    assert.ok(choice, "at least one T01 search approach must remain among the diverse decisions");\n    const response = await runner.run("CHOOSE", { choiceId: choice.choiceId, actionId: choice.actionId });\n    return { response, discoveryId: response.save.scene.lastOutcome.discovery.id };\n  };`,
  "dynamic T01 search helper",
);
gameServiceTest = replaceOnce(
  gameServiceTest,
  `  await chooseSearch("tracks");\n  await chooseSearch("faint-voice");\n  const searchInputs = narrativeInputs.filter((input) => input.action?.stepId === "search");\n  assert.equal(searchInputs.length, 2);\n  assert.equal(searchInputs[0].authoritativeOutcome.discovery.id, "T01-CLUE-BOOT-TRACKS");\n  assert.equal(searchInputs[0].authoritativeState.missions.find((mission) => mission.id === "MSN-T01")\n    ?.currentStep.progress, 1);\n  assert.equal(searchInputs[0].authoritativeState.missions.find((mission) => mission.id === "MSN-T01")\n    ?.currentStep.required, 2);\n  assert.deepEqual(searchInputs[1].authoritativeState.missions.find((mission) => mission.id === "MSN-T01")\n    ?.discoveries.map((discovery) => discovery.id), ["T01-CLUE-BOOT-TRACKS", "T01-CLUE-FAINT-VOICE"]);`,
  `  const firstSearch = await chooseSearch("tracks");\n  const secondSearch = await chooseSearch("faint-voice");\n  const searchInputs = narrativeInputs.filter((input) => input.action?.stepId === "search");\n  assert.equal(searchInputs.length, 2);\n  assert.equal(searchInputs[0].authoritativeOutcome.discovery.id, firstSearch.discoveryId);\n  assert.equal(searchInputs[0].authoritativeState.missions.find((mission) => mission.id === "MSN-T01")\n    ?.currentStep.progress, 1);\n  assert.equal(searchInputs[0].authoritativeState.missions.find((mission) => mission.id === "MSN-T01")\n    ?.currentStep.required, 2);\n  assert.deepEqual(searchInputs[1].authoritativeState.missions.find((mission) => mission.id === "MSN-T01")\n    ?.discoveries.map((discovery) => discovery.id), [firstSearch.discoveryId, secondSearch.discoveryId]);`,
  "dynamic T01 discovery assertions",
);
fs.writeFileSync(gameServiceTestPath, gameServiceTest);

fs.rmSync(workflowPath, { force: true });
fs.rmSync(scriptPath, { force: true });
