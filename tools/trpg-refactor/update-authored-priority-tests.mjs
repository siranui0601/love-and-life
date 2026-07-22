import fs from "node:fs";

const gameTestPath = "tools/trpg-sim/test/game-service.test.mjs";
const uiTestPath = "tools/trpg-sim/test/trpg-needs-ui-contract.test.mjs";
const selfPath = "tools/trpg-refactor/update-authored-priority-tests.mjs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error("Missing test update anchor: " + label);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error("Ambiguous test update anchor: " + label);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

let gameTest = fs.readFileSync(gameTestPath, "utf8");
gameTest = replaceOnce(
  gameTest,
  `  const battleNarrativeInput = narrativeInputs.findLast((input) => input.authoritativeOutcome?.battle);
  assert.ok(battleRecord.lastOutcome?.battle?.playback, "latest presentation keeps playback");
  assert.equal(battleJournal.outcome.battle.playback, undefined, "replay journal stays compatible with v4 outcomes");
  assert.ok(battleNarrativeInput, "the decisive result now receives a scene-specific Gemini aftermath request");
  assert.equal(battleNarrativeInput.action.dialogueTopic, "t01_rescue_aftermath");
  assert.equal(battleNarrativeInput.action.targetNpcId, "NPC001");
  assert.equal(battleNarrativeInput.action.requiredDisclosure, null);
  assert.deepEqual(battleNarrativeInput.authoritativeState.reactionContract.requiredActorIds, ["NPC001"]);
  assert.ok(battleNarrativeInput.authoritativeState.reactionContract.goals.some((goal) => /一人では歩けない/u.test(goal)));
  assert.equal(battleRecord.presentation.source, "test");
  assert.match(battleRecord.presentation.narrative, /斜面の下.*少年/u);
  assert.ok(battleRecord.presentation.speeches.some((speech) => speech.actorId === "NPC001"
    && /フィン.*足.*歩けない.*村の広場/u.test(speech.text)));`,
  `  const battleNarrativeInput = narrativeInputs.findLast((input) => input.authoritativeOutcome?.battle);
  assert.ok(battleRecord.lastOutcome?.battle?.playback, "latest presentation keeps playback");
  assert.equal(battleJournal.outcome.battle.playback, undefined, "replay journal stays compatible with v4 outcomes");
  assert.equal(battleNarrativeInput, undefined, "a reviewed authored aftermath bypasses Gemini generation");
  assert.equal(battleRecord.presentation.source, "authored_scene");
  assert.equal(battleRecord.presentation.sceneId, "t01.rescue.after_battle");
  assert.match(battleRecord.presentation.narrative, /斜面の下.*青年/u);
  assert.ok(battleRecord.presentation.speeches.some((speech) => speech.actorId === "NPC001"
    && /フィン.*足.*一人では村まで戻れそうにない/u.test(speech.text)));`,
  "T01 authored aftermath expectations",
);
gameTest = replaceOnce(
  gameTest,
  `  await runner.run("MOVE", { moveId: capital.moveId });

  const capitalInput = inputs.findLast((input) => input.authoritativeState?.location === "王都");`,
  `  await runner.run("MOVE", { moveId: capital.moveId });
  const followup = runner.save.choices.find((choice) => !String(choice.actionId).startsWith("MOVE_REGION:"))
    ?? runner.save.choices[0];
  assert.ok(followup, "the reviewed capital arrival must still expose a next action");
  await runner.run("CHOOSE", { choiceId: followup.choiceId, actionId: followup.actionId });

  const capitalInput = inputs.findLast((input) => input.authoritativeState?.location === "王都");`,
  "Gemini context after reviewed capital arrival",
);
fs.writeFileSync(gameTestPath, gameTest);

fs.writeFileSync(uiTestPath, `import assert from "node:assert/strict";
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
`);

fs.rmSync(selfPath, { force: true });
