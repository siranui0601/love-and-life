import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync("public/TRPG/app.js", "utf8");
const style = fs.readFileSync("public/TRPG/style.css", "utf8");

test("portrait cards expose an accessible TALK interaction", () => {
  assert.match(app, /npc\.directTalkAvailable === true/u);
  assert.match(app, /sendCommand\("TALK", \{ npcId: npc\.id \}\)/u);
  assert.match(app, /card\.setAttribute\("role", "button"\)/u);
  assert.match(app, /event\.key !== "Enter" && event\.key !== " "/u);
  assert.match(style, /\.npc-card\.is-talkable \{ pointer-events: auto; cursor: pointer; \}/u);
});
