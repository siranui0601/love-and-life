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

edit("tools/trpg-sim/lib/day100-player-policy.mjs", (input) => {
  let source = input;

  source = replaceOnce(
    source,
    `function actionText(entry) {
  return \`${"${entry?.actionId ?? entry?.moveId ?? \"\"} ${entry?.label ?? \"\"}"}\`;
}
`,
    `function actionText(entry) {
  return \`${"${entry?.actionId ?? entry?.moveId ?? \"\"} ${entry?.label ?? \"\"}"}\`;
}

function actionPrice(entry) {
  for (const value of [entry?.price, entry?.cost, entry?.goldCost, entry?.mealPrice]) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  const labelMatch = String(entry?.label ?? "").match(/(?:^|[（(・\\s])([0-9]+)G(?:[）)・\\s]|$)/u);
  if (labelMatch) return Number(labelMatch[1]);
  const idMatch = String(entry?.actionId ?? "").match(/(?:^|:)([0-9]+)$/u);
  return idMatch ? Number(idMatch[1]) : null;
}

function decisionContextSignature(save) {
  return [
    save?.scene?.location ?? "",
    save?.scene?.facilityId ?? "",
    Number(save?.player?.gold ?? 0),
    Number(save?.player?.freeMeals ?? 0),
    Number(save?.player?.freeLodging ?? 0),
  ].join("|");
}

function rejectionReason(outcome) {
  return String(outcome?.reason ?? outcome?.error ?? outcome?.message ?? outcome?.summary ?? outcome?.type ?? "rejected");
}

function isDecisionBlocked(state, key, save) {
  const blocked = state.blockedDecisionKeys?.[key];
  return Boolean(blocked && blocked.contextSignature === decisionContextSignature(save));
}

function mealAffordable(choice, save) {
  if (Number(save?.player?.freeMeals ?? 0) > 0) return true;
  const price = actionPrice(choice);
  return price == null || price <= Number(save?.player?.gold ?? 0);
}
`,
    "decision-contract-helpers",
  );

  source = replaceOnce(
    source,
    `    recentDecisionKeys: [],
    acknowledgedIntroductionTokens: [],
    actionCount: 0,
    deadEndCount: 0,`,
    `    recentDecisionKeys: [],
    acknowledgedIntroductionTokens: [],
    blockedDecisionKeys: {},
    knownMealSources: {},
    actionCount: 0,
    acceptedActionCount: 0,
    rejectedActionCount: 0,
    deadEndCount: 0,`,
    "coverage-ledgers",
  );

  source = replaceOnce(
    source,
    `  if (hub) state.visitedHubs[hub] = (state.visitedHubs[hub] ?? 0) + 1;
  if (facilityId) state.visitedFacilities[facilityId] = (state.visitedFacilities[facilityId] ?? 0) + 1;

  for (const entry of Object.values(state.trouble)) {`,
    `  if (hub) state.visitedHubs[hub] = (state.visitedHubs[hub] ?? 0) + 1;
  if (facilityId) state.visitedFacilities[facilityId] = (state.visitedFacilities[facilityId] ?? 0) + 1;
  const mealPrices = (save?.choices ?? [])
    .filter((choice) => choice.type === "eat" || SURVIVAL_MEAL_PATTERN.test(actionText(choice)))
    .map((choice) => actionPrice(choice))
    .filter((price) => Number.isFinite(price));
  if (facilityId && mealPrices.length) {
    state.knownMealSources[facilityId] = {
      facilityId,
      hub,
      minimumPrice: Math.min(...mealPrices),
    };
  }

  for (const entry of Object.values(state.trouble)) {`,
    "remember-meal-sources",
  );

  source = replaceOnce(
    source,
    `  if (decision) {
    state.actionCount += 1;
    const key = decision.key ?? \`${"${decision.type}:${decision.actionId ?? decision.moveId ?? decision.reason ?? \"unknown\"}"}\`;
    state.recentDecisionKeys.push(key);
    if (state.recentDecisionKeys.length > 18) state.recentDecisionKeys.shift();
    if (decision.type === "ACK_NPC_INTRODUCTION") {
      appendUnique(state.acknowledgedIntroductionTokens, decision.payload?.token, 80);
    }
    if (decision.missionId) {`,
    `  if (decision) {
    state.actionCount += 1;
    const key = decision.key ?? \`${"${decision.type}:${decision.actionId ?? decision.moveId ?? decision.reason ?? \"unknown\"}"}\`;
    state.recentDecisionKeys.push(key);
    if (state.recentDecisionKeys.length > 18) state.recentDecisionKeys.shift();
    const accepted = decision.accepted !== false;
    if (accepted) {
      state.acceptedActionCount += 1;
      delete state.blockedDecisionKeys[key];
    } else {
      state.rejectedActionCount += 1;
      const previous = state.blockedDecisionKeys[key];
      state.blockedDecisionKeys[key] = {
        key,
        count: Number(previous?.count ?? 0) + 1,
        contextSignature: decisionContextSignature(save),
        reason: rejectionReason(decision.outcome),
        minute,
      };
    }
    if (accepted && decision.type === "ACK_NPC_INTRODUCTION") {
      appendUnique(state.acknowledgedIntroductionTokens, decision.payload?.token, 80);
    }
    if (accepted && decision.missionId) {`,
    "record-accepted-and-rejected-actions",
  );

  source = replaceOnce(
    source,
    `    if (decision.type === "BATTLE") state.battleCount += 1;
    if (decision.category === "work") state.workCount += 1;
    if (decision.category === "meal") state.mealCount += 1;
    if (decision.category === "rest") state.restCount += 1;`,
    `    if (accepted && decision.type === "BATTLE") state.battleCount += 1;
    if (accepted && decision.category === "work") state.workCount += 1;
    if (accepted && decision.category === "meal") state.mealCount += 1;
    if (accepted && decision.category === "rest") state.restCount += 1;`,
    "accepted-counters-only",
  );

  source = replaceOnce(
    source,
    `function bestChoice(save, state, predicate, baseScore = 100) {
  return (save?.choices ?? [])
    .filter(predicate)`,
    `function bestChoice(save, state, predicate, baseScore = 100) {
  return (save?.choices ?? [])
    .filter((choice) => !isDecisionBlocked(state, \`CHOOSE:${"${choice.actionId}"}\`, save))
    .filter(predicate)`,
    "blocked-choice-filter",
  );

  source = replaceOnce(
    source,
    `function movementToward(save, model, state, { facilityId = null, hub = null } = {}) {
  if (facilityId) {
    const exact = (save.movement ?? []).find((move) => move.destinationFacilityId === facilityId);`,
    `function movementToward(save, model, state, { facilityId = null, hub = null } = {}) {
  const movement = (save.movement ?? []).filter((move) => !isDecisionBlocked(state, \`MOVE:${"${move.moveId}"}\`, save));
  if (facilityId) {
    const exact = movement.find((move) => move.destinationFacilityId === facilityId);`,
    "blocked-movement-filter",
  );
  source = replaceOnce(
    source,
    `  const direct = (save.movement ?? []).find((move) => move.destination === hub);`,
    `  const direct = movement.find((move) => move.destination === hub);`,
    "blocked-direct-movement",
  );
  source = replaceOnce(
    source,
    `  return (save.movement ?? []).find((move) => move.destination === hop) ?? null;`,
    `  return movement.find((move) => move.destination === hop) ?? null;`,
    "blocked-hop-movement",
  );

  source = replaceOnce(
    source,
    `  if (hunger >= 72) {
    const meal = bestChoice(save, state, (choice) => choice.type === "eat" || SURVIVAL_MEAL_PATTERN.test(actionText(choice)), 170);
    if (meal) return choiceDecision(meal, "空腹が強まる前に食事を取る", { category: "meal" });
    const mealMove = (save.movement ?? []).find((move) => facilityLooksLike(move, /宿|食堂|酒場|茶屋|パン|市場/u));
    if (mealMove) return moveDecision(mealMove, "食事を取れる施設へ向かう", { category: "meal" });
  }`,
    `  if (hunger >= 72) {
    const meal = bestChoice(save, state, (choice) => (choice.type === "eat" || SURVIVAL_MEAL_PATTERN.test(actionText(choice)))
      && mealAffordable(choice, save), 170);
    if (meal) return choiceDecision(meal, "空腹が強まる前に、支払える食事を取る", { category: "meal" });
    const affordableSource = Object.values(state.knownMealSources ?? {})
      .filter((source) => Number(source.minimumPrice) <= Number(save.player?.gold ?? 0))
      .sort((left, right) => Number(left.minimumPrice) - Number(right.minimumPrice))[0];
    if (affordableSource) {
      const knownMealMove = movementToward(save, model, state, {
        facilityId: affordableSource.hub === save.scene?.location ? affordableSource.facilityId : null,
        hub: affordableSource.hub,
      });
      if (knownMealMove) return moveDecision(knownMealMove, "所持金で食べられる食事処へ戻る", { category: "meal" });
    }
    const work = bestChoice(save, state, (choice) => WORK_PATTERN.test(actionText(choice)), 160);
    if (work) return choiceDecision(work, "食費を確保するため、実行可能な仕事を探す", { category: "work" });
    const mealMove = (save.movement ?? [])
      .filter((move) => !isDecisionBlocked(state, \`MOVE:${"${move.moveId}"}\`, save))
      .find((move) => facilityLooksLike(move, /宿|食堂|酒場|茶屋|パン|市場/u));
    if (mealMove) return moveDecision(mealMove, "別の食事処で価格や無料の食事を確かめる", { category: "meal" });
  }`,
    "affordable-survival-recovery",
  );

  source = replaceOnce(
    source,
    `  const workConfirm = findChoice(save, (choice) => /WORK_CONFIRM/iu.test(actionText(choice)));
  if (workConfirm) return choiceDecision(workConfirm, "提示済みの仕事を完了する", { category: "work" });`,
    `  const workConfirm = bestChoice(save, state, (choice) => /WORK_CONFIRM/iu.test(actionText(choice)), 150);
  if (workConfirm) return choiceDecision(workConfirm, "提示済みの仕事を完了する", { category: "work" });`,
    "blocked-work-confirm",
  );

  source = replaceOnce(
    source,
    `    actions: state.actionCount,
    deadEnds: state.deadEndCount,`,
    `    actions: state.actionCount,
    acceptedActions: state.acceptedActionCount,
    rejectedActions: state.rejectedActionCount,
    blockedDecisionCount: Object.keys(state.blockedDecisionKeys ?? {}).length,
    deadEnds: state.deadEndCount,`,
    "report-rejection-counts",
  );

  source = replaceOnce(
    source,
    `  missionProgress,
});`,
    `  missionProgress,
  actionPrice,
  decisionContextSignature,
  isDecisionBlocked,
  mealAffordable,
});`,
    "export-policy-internals",
  );

  return source;
});

edit("tools/trpg-sim/lib/day100-player-runner.mjs", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    `    revision: save.revision,
    day: save.clock?.day ?? null,`,
    `    revision: save.revision,
    stateHash: save.stateHash ?? null,
    day: save.clock?.day ?? null,`,
    "compact-state-hash",
  );
  source = replaceOnce(
    source,
    `    gold: save.player?.gold ?? null,
    hunger: save.player?.needs?.hunger ?? null,`,
    `    gold: save.player?.gold ?? null,
    freeMeals: save.player?.freeMeals ?? 0,
    freeLodging: save.player?.freeLodging ?? 0,
    hunger: save.player?.needs?.hunger ?? null,`,
    "compact-free-needs",
  );
  source = replaceOnce(
    source,
    `    battle: save.battle ? { id: save.battle.id, round: save.battle.round, status: save.battle.status } : null,
    ended: Boolean(save.world?.ended),`,
    `    battle: save.battle ? { id: save.battle.id, round: save.battle.round, status: save.battle.status } : null,
    lastOutcome: save.scene?.lastOutcome ?? null,
    ended: Boolean(save.world?.ended),`,
    "compact-last-outcome",
  );
  source = replaceOnce(
    source,
    `    this.save = response.save;
    observeDay100Coverage(this.coverage, this.save, decision);
    this.trace.push({`,
    `    this.save = response.save;
    const outcome = this.save.scene?.lastOutcome ?? null;
    const accepted = outcome?.ok !== false && outcome?.success !== false && outcome?.accepted !== false;
    const observedDecision = { ...decision, accepted, outcome };
    observeDay100Coverage(this.coverage, this.save, observedDecision);
    this.trace.push({`,
    "classify-command-outcome",
  );
  source = replaceOnce(
    source,
    `        category: decision?.category ?? null,
      },
      before,
      after: compactSave(this.save),`,
    `        category: decision?.category ?? null,
        accepted,
        rejectionReason: accepted ? null : text(outcome?.reason ?? outcome?.error ?? outcome?.message ?? outcome?.summary ?? outcome?.type),
      },
      outcome,
      before,
      after: compactSave(this.save),`,
    "trace-command-outcome",
  );
  source = replaceOnce(
    source,
    `- 行動数: ${"${report.actions}"} / 上限${"${report.maxActions}"}`, 
    `- 行動数: ${"${report.actions}"}（成功${"${report.acceptedActions}"}・拒否${"${report.rejectedActions}"}） / 上限${"${report.maxActions}"}`, 
    "markdown-action-counts",
  );
  return source;
});

const testPath = "tools/trpg-sim/test/day100-rejection-ledger.test.mjs";
fs.writeFileSync(testPath, `import assert from "node:assert/strict";
import test from "node:test";
import {
  DAY100_POLICY_INTERNALS,
  createDay100CoverageState,
  observeDay100Coverage,
  selectDay100Decision,
} from "../lib/day100-player-policy.mjs";

const model = {
  troubles: [],
  adjacency: {},
};

function save({ gold = 2, freeMeals = 0 } = {}) {
  return {
    clock: { day: 25, hour: 14, time: "14:44", absoluteMinute: 34844 },
    scene: { location: "王都", facilityId: "LOC_CAP_MARKET", beats: [] },
    player: { gold, freeMeals, freeLodging: 0, needs: { hunger: 90, fatigue: 30 } },
    tutorial: null,
    battle: null,
    choices: [
      { choiceId: "CHOICE-1", actionId: "EAT:LOC_CAP_MARKET:6", label: "下層向けの食事（6G）", type: "eat" },
      { choiceId: "CHOICE-2", actionId: "WORK_OFFER:LOC_CAP_MARKET:NPC001", label: "荷運びの仕事を尋ねる", type: "conversation" },
      { choiceId: "CHOICE-3", actionId: "WAIT", label: "少し待つ", type: "wait" },
    ],
    movement: [],
    missions: [],
    rumors: [],
    world: { ended: false },
  };
}

test("a rejected meal is counted as a rejected attempt, not as a completed meal", () => {
  const state = createDay100CoverageState(model);
  const current = save();
  observeDay100Coverage(state, current, {
    type: "CHOOSE",
    payload: { choiceId: "CHOICE-1" },
    actionId: "EAT:LOC_CAP_MARKET:6",
    key: "CHOOSE:EAT:LOC_CAP_MARKET:6",
    category: "meal",
    accepted: false,
    outcome: { ok: false, reason: "insufficient_gold" },
  });
  assert.equal(state.actionCount, 1);
  assert.equal(state.acceptedActionCount, 0);
  assert.equal(state.rejectedActionCount, 1);
  assert.equal(state.mealCount, 0);
  assert.equal(DAY100_POLICY_INTERNALS.isDecisionBlocked(state, "CHOOSE:EAT:LOC_CAP_MARKET:6", current), true);
});

test("an unaffordable or blocked meal yields to an executable work recovery", () => {
  const state = createDay100CoverageState(model);
  const current = save();
  observeDay100Coverage(state, current, {
    type: "CHOOSE",
    actionId: "EAT:LOC_CAP_MARKET:6",
    key: "CHOOSE:EAT:LOC_CAP_MARKET:6",
    category: "meal",
    accepted: false,
    outcome: { ok: false, reason: "insufficient_gold" },
  });
  const decision = selectDay100Decision({ save: current, model, state });
  assert.equal(decision.actionId, "WORK_OFFER:LOC_CAP_MARKET:NPC001");
  assert.equal(decision.category, "work");
});

test("a payment rejection is reconsidered after the player's money changes", () => {
  const state = createDay100CoverageState(model);
  const poor = save();
  observeDay100Coverage(state, poor, {
    type: "CHOOSE",
    actionId: "EAT:LOC_CAP_MARKET:6",
    key: "CHOOSE:EAT:LOC_CAP_MARKET:6",
    category: "meal",
    accepted: false,
    outcome: { ok: false, reason: "insufficient_gold" },
  });
  const funded = save({ gold: 8 });
  assert.equal(DAY100_POLICY_INTERNALS.isDecisionBlocked(state, "CHOOSE:EAT:LOC_CAP_MARKET:6", funded), false);
  assert.equal(DAY100_POLICY_INTERNALS.mealAffordable(funded.choices[0], funded), true);
  const decision = selectDay100Decision({ save: funded, model, state });
  assert.equal(decision.actionId, "EAT:LOC_CAP_MARKET:6");
  assert.equal(decision.category, "meal");
});
`, "utf8");

fs.rmSync("tools/trpg-refactor/apply-day100-rejection-ledger-v1.mjs");
console.log("Day100 rejection ledger integrated");
