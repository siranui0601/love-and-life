import fs from "node:fs";

const targetPath = "tools/trpg-sim/test/trpg-ui-contract.test.mjs";
const selfPath = "tools/trpg-refactor/update-needs-ui-cache-test.mjs";
const source = fs.readFileSync(targetPath, "utf8");
const needle = "  assert.match(html, /20260719-agency-v7/u);";
const replacement = "  assert.match(html, /20260722-needs-v2/u);";
const first = source.indexOf(needle);
if (first < 0) throw new Error("Missing needs UI cache test anchor");
if (source.indexOf(needle, first + needle.length) >= 0) throw new Error("Ambiguous needs UI cache test anchor");
fs.writeFileSync(targetPath, source.slice(0, first) + replacement + source.slice(first + needle.length));
fs.rmSync(selfPath, { force: true });
