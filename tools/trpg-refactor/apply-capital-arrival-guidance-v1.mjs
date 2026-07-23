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
  'import { selectDiverseChoices } from "../content/choice-contract.js";\n',
  'import { selectDiverseChoices } from "../content/choice-contract.js";\nimport {\n  CAPITAL_ARRIVAL_GUIDANCE_VERSION,\n  ensureCapitalWeaponShopChoice,\n  prioritizeCapitalWeaponShopMovement,\n  recordCapitalArrivalGuidance,\n} from "../resolvers/capital-arrival-guidance.js";\n',
  "capital-guidance-import",
);
service = replaceOnce(
  service,
  `function discoverArrival(runtime, data) {
  const knowledge = ensurePlayerKnowledge(runtime);
  const hubId = runtime.playerState.player.location;
  const facilityId = runtime.playerState.player.facilityId;
`,
  `function discoverArrival(runtime, data) {
  const knowledge = ensurePlayerKnowledge(runtime);
  const hubId = runtime.playerState.player.location;
  const facilityId = runtime.playerState.player.facilityId;
  recordCapitalArrivalGuidance(runtime, {
    hubId,
    facilityId,
    absoluteMinute: runtime.playerState.absoluteMinute,
  });
`,
  "record-capital-arrival",
);
service = replaceOnce(
  service,
  `  ensureNarrativeMemory(runtime);
  ensureWorkMarket(runtime);
  syncAuthoritativePresentNpcIds(runtime, data);
`,
  `  ensureNarrativeMemory(runtime);
  ensureWorkMarket(runtime);
  recordCapitalArrivalGuidance(runtime);
  syncAuthoritativePresentNpcIds(runtime, data);
`,
  "hydrate-capital-guidance",
);
service = replaceOnce(
  service,
  `  const selected = preserveReviewedOrder
    ? legacy
    : selectDiverseChoices([
      ...preferred,
      ...actions.filter((action) => !preferred.some((entry) => entry.id === action.id)),
    ], { expectedCount: Math.min(3, actions.length) });
  return withChoiceIds(selected.map((action) => generatedChoiceDetail(action, runtime, selection, data)));
`,
  `  const selected = preserveReviewedOrder
    ? legacy
    : selectDiverseChoices([
      ...preferred,
      ...actions.filter((action) => !preferred.some((entry) => entry.id === action.id)),
    ], { expectedCount: Math.min(3, actions.length) });
  const guided = ensureCapitalWeaponShopChoice(selected, actions, runtime);
  return withChoiceIds(guided.map((action) => generatedChoiceDetail(action, runtime, selection, data)));
`,
  "guarantee-capital-choice",
);
service = replaceOnce(
  service,
  `  if (!runtime.tutorial || runtime.tutorial.stage === "free") return actions;
`,
  `  if (!runtime.tutorial || runtime.tutorial.stage === "free") {
    return prioritizeCapitalWeaponShopMovement(actions, runtime);
  }
`,
  "prioritize-capital-movement",
);
service = replaceOnce(
  service,
  `      workMarketVersion: WORK_MARKET_VERSION,
      workMarket: publicWorkMarket(runtime, facility),
`,
  `      workMarketVersion: WORK_MARKET_VERSION,
      capitalArrivalGuidanceVersion: CAPITAL_ARRIVAL_GUIDANCE_VERSION,
      workMarket: publicWorkMarket(runtime, facility),
`,
  "public-guidance-version",
);
fs.writeFileSync(servicePath, service, "utf8");

const testPath = "tools/trpg-sim/test/authored-journey-presentation.test.mjs";
let testSource = fs.readFileSync(testPath, "utf8");
testSource = replaceOnce(
  testSource,
  `  assert.match(presentation.narrative, /王都/u);
  assert.match(presentation.narrative, /安宿/u);
`,
  `  assert.match(presentation.narrative, /王都/u);
  assert.match(presentation.narrative, /安宿/u);
  assert.match(presentation.narrative, /王都武器屋/u);
  assert.match(presentation.narrative, /剣.*槍.*弓.*杖/u);
  const capitalActions = availableGameRuntimeActions(runtime, game.data);
  const weaponShopChoice = capitalActions.choices.find((entry) => entry.destinationFacilityId === "LOC_CAP_WEAPON_SHOP");
  assert.ok(weaponShopChoice, "first capital arrival must expose the weapon shop in the visible choices");
  assert.equal(weaponShopChoice.capitalArrivalGuidance, true);
  const weaponShopMove = capitalActions.movement.find((entry) => entry.destinationFacilityId === "LOC_CAP_WEAPON_SHOP");
  assert.ok(weaponShopMove, "weapon shop must remain an authoritative MOVE action");
  executeGameRuntimeCommand(runtime, game.data, {
    type: "MOVE",
    payload: { moveId: weaponShopMove.id },
  });
  assert.equal(runtime.playerState.player.facilityId, "LOC_CAP_WEAPON_SHOP");
  assert.equal(availableGameRuntimeActions(runtime, game.data).choices.some((entry) => entry.capitalArrivalGuidance === true), false);
`,
  "capital-arrival-test",
);
fs.writeFileSync(testPath, testSource, "utf8");

fs.rmSync("tools/trpg-refactor/apply-capital-arrival-guidance-v1.mjs");
console.log("capital arrival guidance integrated");
