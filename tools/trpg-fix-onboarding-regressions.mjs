import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = (relativePath) => path.join(ROOT, relativePath);

function replaceOnce(relativePath, before, after, label) {
  const file = target(relativePath);
  const source = fs.readFileSync(file, "utf8");
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: source not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source is duplicated`);
  fs.writeFileSync(file, `${source.slice(0, first)}${after}${source.slice(first + before.length)}`);
}

const service = "src/server/trpg/game/service.js";
const app = "public/TRPG/app.js";

replaceOnce(service,
`  if (tutorial.stage === "movement_aftermath") return {
    ...base,
    id: null,
    title: null,
    body: null,
    progressLabel: null,
    emphasisTarget: null,
  };`,
`  if (tutorial.stage === "movement_aftermath") return {
    ...base,
    id: "world-keeps-moving",
    visible: false,
    title: null,
    body: null,
    progressLabel: null,
    emphasisTarget: null,
  };`,
  "preserve movement aftermath state without showing another coach");

replaceOnce(service,
`  if (tutorial.stage === "aftermath_intro") return {
    ...base,
    id: null,
    title: null,
    body: null,
    progressLabel: null,
    emphasisTarget: null,
  };`,
`  if (tutorial.stage === "aftermath_intro") return {
    ...base,
    id: "trouble-aftermath",
    visible: false,
    title: null,
    body: null,
    progressLabel: null,
    emphasisTarget: null,
  };`,
  "preserve aftermath state without showing a tutorial coach");

replaceOnce(service,
  '    actionLabel: "ミッションを確認",',
  '    actionLabel: "依頼を確認",',
  "rename mission tutorial action");

replaceOnce(service,
  '    acknowledgeable: false,',
  '    acknowledgeable: !acknowledged.has("skills"),',
  "preserve skill acknowledgement compatibility");

replaceOnce(app,
  '  const visible = Boolean(value && value.complete !== true && (value.id || value.emphasisTarget));',
  '  const visible = Boolean(value && value.visible !== false && value.complete !== true && (value.id || value.emphasisTarget));',
  "support hidden stateful tutorial beats");

for (const relativePath of [
  "tools/trpg-fix-onboarding-regressions.mjs",
  ".github/workflows/trpg-onboarding-test-diagnostics.yml",
  "tools/trpg-sim/test-diagnostics.log",
]) {
  fs.rmSync(target(relativePath), { force: true });
}

console.log("Onboarding regression fixes applied.");
