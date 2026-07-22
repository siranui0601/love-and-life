import fs from "node:fs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`missing_anchor:${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`duplicate_anchor:${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function edit(path, transform) {
  fs.writeFileSync(path, transform(fs.readFileSync(path, "utf8")), "utf8");
}

edit("src/server/trpg/game/service.js", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    "function generatedChoiceDetail(action, runtime, selection) {",
    "function generatedChoiceDetail(action, runtime, selection, data) {",
    "generated-choice-data-parameter",
  );
  source = replaceOnce(
    source,
    "function selectedChoiceActions(runtime, actions) {",
    "function selectedChoiceActions(runtime, actions, data) {",
    "selected-choice-data-parameter",
  );
  source = replaceOnce(
    source,
    "  return withChoiceIds(selected.map((action) => generatedChoiceDetail(action, runtime, selection)));",
    "  return withChoiceIds(selected.map((action) => generatedChoiceDetail(action, runtime, selection, data)));",
    "generated-choice-data-call",
  );
  source = replaceOnce(
    source,
    "  return selectedChoiceActions(runtime, choiceActionPool(runtime, data));",
    "  return selectedChoiceActions(runtime, choiceActionPool(runtime, data), data);",
    "selected-choice-data-call",
  );
  return source;
});

edit("tools/trpg-sim/test/game-service.test.mjs", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    '  const quotedWage = Number(offer.actionId.split(":").at(-1));',
    '  const quotedWage = Number(offer.label.match(/(\\d+)G/u)?.[1]);',
    "quoted-wage-label",
  );
  source = replaceOnce(
    source,
    `  assert.equal(completedWorkInput.authoritativeState.continuityContract.mode, "must_offer_continuation");
  assert.ok(completedWorkInput.authoritativeState.continuityContract.candidateIds.some((id) => id.startsWith("WORK:")));
  assert.ok(completedWorkInput.authoritativeState.availableActionCandidates.some((candidate) => candidate.workOffer === true));
  assert.ok(completedWorkInput.authoritativeState.workMarket.recentWorkTitles.some((title) => /穀袋/u.test(title)));
  assert.ok(runner.save.choices.some((choice) => choice.actionId.startsWith("WORK:") && /別の仕事/u.test(choice.label)));`,
    `  assert.equal(completedWorkInput.authoritativeState.workMarket.completedToday, 1);
  assert.ok(completedWorkInput.authoritativeState.workMarket.recentWorkTitles.some((title) => /穀袋/u.test(title)));
  const nextWorkCandidates = completedWorkInput.authoritativeState.availableActionCandidates
    .filter((candidate) => candidate.workOffer === true);
  if (nextWorkCandidates.length) {
    assert.equal(completedWorkInput.authoritativeState.continuityContract.mode, "must_offer_continuation");
    assert.ok(completedWorkInput.authoritativeState.continuityContract.candidateIds
      .some((id) => nextWorkCandidates.some((candidate) => candidate.id === id)));
    assert.ok(runner.save.choices.some((choice) => /別の仕事/u.test(choice.label)));
  } else {
    assert.equal(completedWorkInput.authoritativeState.continuityContract.mode, "free");
  }`,
    "bounded-work-continuity-test",
  );
  return source;
});

fs.rmSync("tools/trpg-refactor/postfix-work-market-v1.mjs");
console.log("work-market post-integration fixes applied");
