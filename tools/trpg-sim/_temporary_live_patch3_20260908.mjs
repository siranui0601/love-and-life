#!/usr/bin/env node
import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`${path}: expected patch anchor missing`);
  const next = source.replace(before, after);
  if (next === source) throw new Error(`${path}: patch produced no change`);
  fs.writeFileSync(path, next);
}

replaceOnce(
  'src/server/trpg/content/authored-mission-flow-registry.js',
`  const ownsWholePanel = actions.some((action) => action?.ownsWholeChoicePanel === true
    || action?.exclusiveChoicePanel === true);
  if (ownsWholePanel) return actions;`,
`  const ownsWholePanel = actions.some((action) => action?.ownsWholeChoicePanel === true
    || action?.exclusiveChoicePanel === true
    || (action?.authoredMissionFlowExclusiveChoice === true
      && action?.canonicalWorldLifeChoice !== true
      && action?.authoredDailyLifeChoice !== true));
  if (ownsWholePanel) return actions;`,
);

const testPath = 'tools/trpg-sim/test/authored-village-bakery-evening.test.mjs';
const testSource = fs.readFileSync(testPath, 'utf8');
const marker = 'Day2 merchant-owned three-choice panel is not polluted by public bakery products';
if (testSource.includes(marker)) throw new Error('merchant regression test already present');
fs.writeFileSync(testPath, `${testSource.trimEnd()}\n\ntest("${marker}", () => {\n  const state = runtime({ wallMinute: 7 * 60 + 47, facilityId: "LOC_FARM_BAKERY", hunger: 8, fatigue: 8 });\n  state.playerState.history.push({ type: "DAY2_MERCHANT_CASH_WAGE_TAKEN", minute: state.playerState.absoluteMinute - 1 });\n  const actions = authoredMissionFlowExclusiveActions(state);\n  assert.deepEqual(actions.map((action) => action.id), [\n    "MISSION_FLOW:T01:DAY2_MERCHANT_STALL:buy_black_bread",\n    "MISSION_FLOW:T01:DAY2_MERCHANT_STALL:copy_prices",\n    "MISSION_FLOW:T01:DAY2_MERCHANT_STALL:take_hunter_parcel",\n  ]);\n  assert.ok(actions.every((action) => action.authoredDay2T01MerchantStallChoice === true));\n  assert.ok(actions.every((action) => action.canonicalWorldLifeChoice !== true));\n});\n`);

console.log('owned authored panel public-product merge regression fixed');
