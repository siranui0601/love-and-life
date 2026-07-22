import fs from "node:fs";

const targetPath = "tools/trpg-refactor/apply-authored-route-and-needs-ui.mjs";
const selfPath = "tools/trpg-refactor/fix-authored-route-test-generator.mjs";
const source = fs.readFileSync(targetPath, "utf8");
const needle = 'validation.errors.join("\\n")';
const replacement = 'validation.errors.join("\\\\n")';
const first = source.indexOf(needle);
if (first < 0) throw new Error("Missing authored test newline generator anchor");
if (source.indexOf(needle, first + needle.length) >= 0) throw new Error("Ambiguous authored test newline generator anchor");
fs.writeFileSync(targetPath, source.slice(0, first) + replacement + source.slice(first + needle.length));
fs.rmSync(selfPath, { force: true });
