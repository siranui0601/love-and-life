import fs from "node:fs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`missing_anchor:${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`duplicate_anchor:${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

const path = "tools/trpg-sim/test/game-service.test.mjs";
let source = fs.readFileSync(path, "utf8");
source = replaceOnce(
  source,
  "  assert.equal(runner.save.scene.narrative, runner.save.scene.lastOutcome.discovery.text);",
  `  assert.match(runner.save.scene.narrative, /赤牙狼の爪痕/u);
  assert.match(runner.save.scene.narrative, /少年/u);
  assert.doesNotMatch(runner.save.scene.narrative, /見知らぬ人物|青年/u);`,
  "authored-discovery-copy",
);
source = replaceOnce(
  source,
  `  const record = await store.get(runner.save.id);
  const journal = record.commandLog.at(-1);`,
  `  const record = await store.get(runner.save.id);
  assert.equal(record.presentation.source, "authored_scene");
  assert.equal(record.presentation.sceneId, "t01.search.wolf_pursuit");
  const journal = record.commandLog.at(-1);`,
  "authored-discovery-source",
);
fs.writeFileSync(path, source, "utf8");
fs.rmSync("tools/trpg-refactor/apply-t01-authored-presentation-test-v1.mjs");
console.log("T01 authored presentation assertions applied");
