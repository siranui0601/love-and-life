import fs from "node:fs";

const policyPath = "tools/trpg-sim/lib/day100-player-policy.mjs";
const testPath = "tools/trpg-sim/test/day100-player-policy.test.mjs";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`missing patch anchor: ${label}`);
  return source.replace(before, after);
}

let policy = fs.readFileSync(policyPath, "utf8");

policy = replaceOnce(policy,
`    failedMealSourceContexts: {},
    triedStockIds: [],`,
`    failedMealSourceContexts: {},
    usedInformationContexts: {},
    triedStockIds: [],`,
"coverage state information ledger");

policy = replaceOnce(policy,
`function mealSourceBlocked(state, facilityId, save) {
  return state.failedMealSourceContexts?.[facilityId] === resourceContextSignature(save);
}

function rejectionReason(outcome) {`,
`function mealSourceBlocked(state, facilityId, save) {
  return state.failedMealSourceContexts?.[facilityId] === resourceContextSignature(save);
}

function informationContextSignature(save, troubleId = null) {
  const mission = troubleId ? troubleMission(save, troubleId) : null;
  const rumorCount = troubleId
    ? (save?.rumors ?? []).filter((rumor) => rumor.troubleId === troubleId).length
    : (save?.rumors ?? []).length;
  return [
    save?.scene?.location ?? "",
    save?.scene?.facilityId ?? "",
    troubleId ?? "",
    mission?.status ?? "",
    mission?.currentStep?.id ?? "",
    number(mission?.currentStep?.progress),
    number(mission?.currentStep?.required),
    rumorCount,
  ].join("|");
}

function informationProbeKey(actionId, save, troubleId = null) {
  return `${String(actionId ?? "")}|${informationContextSignature(save, troubleId)}`;
}

function informationProbeUsed(state, choice, save, troubleId = null) {
  return Boolean(state.usedInformationContexts?.[informationProbeKey(choice?.actionId, save, troubleId)]);
}

function rejectionReason(outcome) {`,
"information context helpers");

policy = replaceOnce(policy,
`    if (accepted && decision.category === "meal_search_move") {
      state.mealSearchMoveCount += 1;
      const hasAffordableMeal = (save?.choices ?? []).some((choice) => choice.type === "eat" && mealAffordable(choice, save));
      if (!hasAffordableMeal && facilityId) {
        state.failedMealSourceContexts[facilityId] = resourceContextSignature(save);
      }
    }
    if (accepted && decision.type === "SHOP_TRY") {`,
`    if (accepted && decision.category === "meal_search_move") {
      state.mealSearchMoveCount += 1;
      const hasAffordableMeal = (save?.choices ?? []).some((choice) => choice.type === "eat" && mealAffordable(choice, save));
      if (!hasAffordableMeal && facilityId) {
        state.failedMealSourceContexts[facilityId] = resourceContextSignature(save);
      }
    }
    if (accepted && decision.category === "information_probe" && decision.actionId) {
      state.usedInformationContexts[informationProbeKey(decision.actionId, save, decision.troubleId)] = minute;
    }
    if (accepted && decision.type === "SHOP_TRY") {`,
"record information probes");

policy = replaceOnce(policy,
`      const local = bestChoice(save, state, (choice) => INFORMATION_PATTERN.test(actionText(choice)) && !/:END$/iu.test(choice.actionId), 125);
      if (local) {
        return choiceDecision(local, \`「${mission.title}」の現地情報を探す\`, {
          missionId: mission.id,
          troubleId: mission.troubleId,
          stepId: mission.currentStep?.id ?? null,
        });`,
`      const local = bestChoice(save, state, (choice) => INFORMATION_PATTERN.test(actionText(choice))
        && !/:END$/iu.test(choice.actionId)
        && !informationProbeUsed(state, choice, save, mission.troubleId), 125);
      if (local) {
        return choiceDecision(local, \`「${mission.title}」の現地情報を探す\`, {
          missionId: mission.id,
          troubleId: mission.troubleId,
          stepId: mission.currentStep?.id ?? null,
          category: "information_probe",
        });`,
"active mission information probe");

policy = replaceOnce(policy,
`  const information = bestChoice(save, state, (choice) => INFORMATION_PATTERN.test(actionText(choice)) && !/:END$/iu.test(choice.actionId), 120);
  if (information) return choiceDecision(information, \`${target.id}の噂や現地の変化を確かめる\`, { troubleId: target.id });`,
`  const information = bestChoice(save, state, (choice) => INFORMATION_PATTERN.test(actionText(choice))
    && !/:END$/iu.test(choice.actionId)
    && !informationProbeUsed(state, choice, save, target.id), 120);
  if (information) return choiceDecision(information, \`${target.id}の噂や現地の変化を確かめる\`, {
    troubleId: target.id,
    category: "information_probe",
  });`,
"discovery information probe");

policy = replaceOnce(policy,
`  const choice = (save.choices ?? [])
    .map((entry) => ({ entry, penalty: recentPenalty(state, \`CHOOSE:${entry.actionId}\`) }))
    .sort((left, right) => left.penalty - right.penalty)[0]?.entry;`,
`  const activeTroubleId = (save.missions ?? [])
    .find((mission) => mission.kind === "special" && !TERMINAL_MISSION_STATES.has(mission.status))?.troubleId
    ?? coverageTarget(save, model, state)?.id
    ?? null;
  const choice = (save.choices ?? [])
    .filter((entry) => !INFORMATION_PATTERN.test(actionText(entry))
      || !activeTroubleId
      || !informationProbeUsed(state, entry, save, activeTroubleId))
    .map((entry) => ({ entry, penalty: recentPenalty(state, \`CHOOSE:${entry.actionId}\`) }))
    .sort((left, right) => left.penalty - right.penalty)[0]?.entry;`,
"fallback information filter");

policy = replaceOnce(policy,
`  mealSourceBlocked,
  isDecisionBlocked,`,
`  mealSourceBlocked,
  informationContextSignature,
  informationProbeKey,
  informationProbeUsed,
  isDecisionBlocked,`,
"export information helpers");

fs.writeFileSync(policyPath, policy, "utf8");

let tests = fs.readFileSync(testPath, "utf8");
if (!tests.includes("a generic information probe is not repeated")) {
  tests += `\n\ntest("a generic information probe is not repeated in the same mission-step context", () => {\n  const state = createDay100CoverageState(model);\n  const current = save({\n    scene: { location: "王都", facilityId: "LOC_CAP_WEAPON_SHOP", beats: [] },\n    choices: [\n      { choiceId: "CHOICE-1", actionId: "INSPECT:LOC_CAP_WEAPON_SHOP:1", label: "店内の痕跡を調べる", type: "localInvestigate" },\n      { choiceId: "CHOICE-2", actionId: "WAIT", label: "少し待つ", type: "wait" },\n    ],\n    movement: [\n      { moveId: "MOVE_LOCAL:LOC_CAP_SQUARE", destination: "王都", destinationFacilityId: "LOC_CAP_SQUARE", destinationFacilityName: "王都広場", scope: "local" },\n    ],\n    missions: [{ id: "MSN-T02", troubleId: "T02", kind: "special", title: "王都の異変", status: "active", deadlineDay: 8, currentStep: { id: "hear", progress: 0, required: 1 }, targetLocation: "王都" }],\n  });\n\n  const first = selectDay100Decision({ save: current, model, state });\n  assert.equal(first.actionId, "INSPECT:LOC_CAP_WEAPON_SHOP:1");\n  assert.equal(first.category, "information_probe");\n  observeDay100Coverage(state, current, { ...first, accepted: true, outcome: { ok: true } });\n\n  const second = selectDay100Decision({ save: current, model, state });\n  assert.notEqual(second.actionId, "INSPECT:LOC_CAP_WEAPON_SHOP:1");\n  assert.equal(second.type, "MOVE");\n  assert.equal(second.moveId, "MOVE_LOCAL:LOC_CAP_SQUARE");\n});\n`;
}
fs.writeFileSync(testPath, tests, "utf8");
