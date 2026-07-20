import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const index = read("public/TRPG/index.html");
const uxScript = read("public/TRPG/p0-ux.js");
const uxStyle = read("public/TRPG/p0-ux.css");

test("P0 observer loads before the main TRPG module", () => {
  const observerPosition = index.indexOf("/TRPG/p0-ux.js");
  const appPosition = index.indexOf("/TRPG/app.js");
  assert.ok(observerPosition >= 0);
  assert.ok(appPosition >= 0);
  assert.ok(observerPosition < appPosition);
  assert.match(index, /id="missionToastRegion"/u);
});

test("onboarding does not create a parallel movement or skill control", () => {
  assert.doesNotThrow(() => new Function(uxScript));
  assert.doesNotMatch(uxScript, /progressionMovementButton/u);
  assert.doesNotMatch(uxScript, /progressionSkillButton/u);
  assert.doesNotMatch(uxScript, /中央の3択を繰り返す/u);
  assert.match(uxScript, /tutorial?.id === "skills"/u);
  assert.match(uxScript, /data-p0-tutorial-locked/u);
});

test("mission notices are restrained and do not duplicate the mission tutorial", () => {
  assert.match(uxScript, /save?.tutorial?.id !== "mission-log"/u);
  assert.match(uxScript, /救出成功/u);
  assert.doesNotMatch(uxScript, /ミッション更新/u);
});

test("mobile battle commands remain fully reachable", () => {
  assert.match(uxStyle, /battle-command-panel:not([hidden])/u);
  assert.match(uxStyle, /max-height: min(42dvh, 240px) !important/u);
  assert.match(uxStyle, /battle-command-menu[data-mode="root"]/u);
  assert.match(uxStyle, /min-height: 108px/u);
});
