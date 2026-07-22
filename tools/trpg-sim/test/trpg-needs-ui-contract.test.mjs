import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("the playable UI renders canonical weather hunger and fatigue", () => {
  const html = fs.readFileSync("public/TRPG/index.html", "utf8");
  const app = fs.readFileSync("public/TRPG/app.js", "utf8");
  const css = fs.readFileSync("public/TRPG/style.css", "utf8");
  assert.ok(html.includes('id="weatherLabel"'));
  assert.ok(html.includes('id="hungerStatus"'));
  assert.ok(html.includes('id="fatigueStatus"'));
  assert.ok(app.includes("player.needs?.hunger"));
  assert.ok(app.includes("player.needs?.fatigue"));
  assert.ok(app.includes("save.weather"));
  assert.ok(css.includes(".need-status"));
  assert.ok(css.includes(".weather-label"));
});

test("reviewed authored scenes are resolved before the Gemini branch", () => {
  const service = fs.readFileSync("src/server/trpg/game/service.js", "utf8");
  const reviewed = service.indexOf("const reviewed = resolveReviewedAuthoredPresentation");
  const gemini = service.indexOf("if (!narrator)", reviewed);
  assert.ok(reviewed >= 0);
  assert.ok(gemini > reviewed);
});
