import fs from "node:fs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`missing_anchor:${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`duplicate_anchor:${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`missing_start:${label}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`missing_end:${label}`);
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

const runnerPath = "tools/trpg-sim/lib/day100-player-runner.mjs";
let runner = fs.readFileSync(runnerPath, "utf8");
runner = replaceSection(
  runner,
  'import { createTrpgNarrator } from "../../../src/server/trpg/gemini-narrator.js";\n',
  'import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";\n',
  `import {
  createDay100ExperienceAudit,
  finalizeExperienceAudit,
  observeBattleExperience,
  observeSaveExperience,
} from "./day100-experience-audit.mjs";
import { createDay100Narrator } from "./day100-narrator.mjs";
`,
  "runner-imports",
);
runner = replaceOnce(
  runner,
  `const DEFAULT_MAX_ACTIONS = 4200;
const DEFAULT_LIVE_SAMPLE_LIMIT = 48;
`,
  `const DEFAULT_MAX_ACTIONS = 4200;
const DEFAULT_NARRATIVE_CALL_LIMIT = 600;
`,
  "runner-constants",
);
runner = replaceOnce(
  runner,
  `    fatigue: save.player?.needs?.fatigue ?? null,
    choiceIds: (save.choices ?? []).map((choice) => choice.actionId),
`,
  `    fatigue: save.player?.needs?.fatigue ?? null,
    inventoryEquipment: JSON.parse(JSON.stringify(save.player?.inventory?.equipment ?? [])),
    skills: JSON.parse(JSON.stringify(save.skills ?? {})),
    choiceIds: (save.choices ?? []).map((choice) => choice.actionId),
`,
  "compact-experience-state",
);
runner = replaceSection(
  runner,
  "function candidateChoice(candidate) {\n",
  "export class Day100GameRunner {\n",
  "",
  "remove-sampled-narrator",
);
runner = replaceOnce(
  runner,
  `    maxActions = DEFAULT_MAX_ACTIONS,
    liveSampleLimit = DEFAULT_LIVE_SAMPLE_LIMIT,
    auditFilePath,
`,
  `    maxActions = DEFAULT_MAX_ACTIONS,
    maxNarrativeCalls = DEFAULT_NARRATIVE_CALL_LIMIT,
    auditFilePath,
`,
  "runner-constructor-args",
);
runner = replaceOnce(
  runner,
  `    this.store = new MemoryTrpgSaveStore();
    this.narrator = createDay100SampledNarrator({ auditFilePath, liveSampleLimit });
    this.game = new TrpgGameService({
`,
  `    this.store = new MemoryTrpgSaveStore();
    this.experienceAudit = createDay100ExperienceAudit();
    this.narrator = createDay100Narrator({
      auditFilePath,
      maxNarrativeCalls,
      experienceAudit: this.experienceAudit,
    });
    this.game = new TrpgGameService({
`,
  "runner-narrator-create",
);
runner = replaceOnce(
  runner,
  `    this.save = await this.game.create(this.owner, { playerName: this.playerName, seed: this.seed });
    observeDay100Coverage(this.coverage, this.save);
`,
  `    this.save = await this.game.create(this.owner, { playerName: this.playerName, seed: this.seed });
    observeDay100Coverage(this.coverage, this.save);
    observeSaveExperience(this.experienceAudit, {}, compactSave(this.save), {
      accepted: true,
      actionId: "GAME_START",
    });
`,
  "runner-start-audit",
);
runner = replaceOnce(
  runner,
  `    const observedDecision = { ...decision, accepted, outcome };
    observeDay100Coverage(this.coverage, this.save, observedDecision);
    this.trace.push({
`,
  `    const observedDecision = { ...decision, accepted, outcome };
    const after = compactSave(this.save);
    observeDay100Coverage(this.coverage, this.save, observedDecision);
    observeSaveExperience(this.experienceAudit, before, after, observedDecision);
    this.trace.push({
`,
  "runner-command-audit",
);
runner = replaceOnce(
  runner,
  `      before,
      after: compactSave(this.save),
`,
  `      before,
      after,
`,
  "runner-command-after",
);
runner = replaceOnce(
  runner,
  `      const available = (this.save.battle.commands ?? []).filter((command) => command.available !== false);
      const action = available.find((command) => command.kind === "skill")
        ?? available.find((command) => command.kind === "attack")
        ?? available.find((command) => command.kind === "defend")
        ?? available.find((command) => command.kind === "flee")
        ?? available[0];
`,
  `      const available = (this.save.battle.commands ?? []).filter((command) => command.available !== false);
      const skillActions = available.filter((command) => command.kind === "skill")
        .sort((left, right) => Number(this.experienceAudit.skills.useCounts[left.actionId] ?? 0)
          - Number(this.experienceAudit.skills.useCounts[right.actionId] ?? 0)
          || String(left.actionId).localeCompare(String(right.actionId), "en"));
      for (const command of skillActions) {
        observeBattleExperience(this.experienceAudit, this.save, { ...command, selected: false });
      }
      const action = skillActions[0]
        ?? available.find((command) => command.kind === "attack")
        ?? available.find((command) => command.kind === "defend")
        ?? available.find((command) => command.kind === "flee")
        ?? available[0];
`,
  "runner-battle-rotation",
);
runner = replaceOnce(
  runner,
  `      if (!action) throw new Error(\`no available battle action at round \${this.save.battle.round}\`);
      const target = action.targets?.find((entry) => entry.side === "enemy" && entry.alive !== false) ?? action.targets?.[0];
      const before = compactSave(this.save);
`,
  `      if (!action) throw new Error(\`no available battle action at round \${this.save.battle.round}\`);
      const target = action.targets?.find((entry) => entry.side === "enemy" && entry.alive !== false) ?? action.targets?.[0];
      observeBattleExperience(this.experienceAudit, this.save, { ...action, selected: true });
      const before = compactSave(this.save);
`,
  "runner-battle-selected",
);
runner = replaceOnce(
  runner,
  `      this.save = response.save;
      this.trace.push({
        event: "BATTLE_ACT",
`,
  `      this.save = response.save;
      const after = compactSave(this.save);
      observeSaveExperience(this.experienceAudit, before, after, {
        accepted: true,
        actionId: action.actionId,
        category: "battle_action",
      });
      this.trace.push({
        event: "BATTLE_ACT",
`,
  "runner-battle-save-audit",
);
runner = replaceOnce(
  runner,
  `        before,
        after: compactSave(this.save),
`,
  `        before,
        after,
`,
  "runner-battle-after",
);
runner = replaceOnce(
  runner,
  `    report.errors = this.errors;
    report.narrative = { ...this.narrator.stats };
    report.quality = {
`,
  `    report.errors = this.errors;
    report.narrative = { ...this.narrator.stats };
    report.experience = finalizeExperienceAudit(this.experienceAudit);
    report.quality = {
`,
  "runner-report-experience",
);
runner = replaceOnce(
  runner,
  `      laterTroubleProgressed: report.counts.progressed > 1,
      noRunnerError: report.errors.length === 0,
`,
  `      laterTroubleProgressed: report.counts.progressed > 1,
      noRunnerError: report.errors.length === 0,
      noMeaningfulNarrativeFallback: report.experience.narrative.passed,
      conversationHasInformation: report.experience.conversation.gainedInformationTurns > 0,
      conversationHasChoiceVariety: report.experience.conversation.distinctChoiceIntentSignatureCount >= 2,
      conversationAvoidsHeavyRepetition: report.experience.conversation.repeatedLineCount
        <= Math.max(2, Math.floor(report.experience.conversation.turns * 0.15)),
      skillBreadthObserved: report.experience.skills.acquiredCount >= 10,
      skillUsageObserved: report.experience.skills.usedCount >= 3,
      weaponBreadthObserved: report.experience.equipment.weaponTypeOwnedCount >= 3
        && report.experience.equipment.weaponTypeEquippedCount >= 2,
      noMealSearchLoop: report.experience.survival.mealSeekingMoves
        <= report.experience.survival.mealsConsumed * 4 + 20,
`,
  "runner-quality-experience",
);
runner = replaceOnce(
  runner,
  `- 生活: 食事\${report.meals}・休息\${report.rests}・仕事\${report.jobs}・戦闘\${report.battles}
- Gemini実サンプル: \${report.narrative.liveCalls}/\${report.narrative.liveLimit} / 決定論的通常場面\${report.narrative.policyFallbacks}
- 品質判定: \${report.quality.passed ? "PASS" : \`BLOCKED（\${failedChecks.join("、")}）\`}
`,
  `- 生活: 食事\${report.meals}・食事処探索移動\${report.mealSeekingMoves}・休息\${report.rests}・仕事\${report.jobs}・戦闘\${report.battles}
- 物語生成: Gemini/承認再生\${report.narrative.liveCalls}・生活テンプレート\${report.narrative.routineTemplates}・意味場面フォールバック\${report.narrative.meaningfulFallbacks}
- 会話: \${report.experience.conversation.turns}ターン・話者\${report.experience.conversation.distinctSpeakerCount}人・話題\${report.experience.conversation.distinctTopicCount}種・情報取得\${report.experience.conversation.gainedInformationTurns}回・反復\${report.experience.conversation.repeatedLineCount}回
- 成長: 取得スキル\${report.experience.skills.acquiredCount}種・実使用\${report.experience.skills.usedCount}種
- 武器: 所有\${report.experience.equipment.weaponTypeOwnedCount}種・装備経験\${report.experience.equipment.weaponTypeEquippedCount}種・試用\${report.experience.equipment.triedIds.length}件
- 品質判定: \${report.quality.passed ? "PASS" : \`BLOCKED（\${failedChecks.join("、")}）\`}
`,
  "runner-markdown-summary",
);
fs.writeFileSync(runnerPath, runner, "utf8");

const policyPath = "tools/trpg-sim/lib/day100-player-policy.mjs";
let policy = fs.readFileSync(policyPath, "utf8");
policy = replaceOnce(
  policy,
  `function rejectionReason(outcome) {
`,
  `function resourceContextSignature(save) {
  const hunger = Math.floor(number(save?.player?.needs?.hunger) / 10) * 10;
  return [
    Number(save?.player?.gold ?? 0),
    Number(save?.player?.freeMeals ?? 0),
    hunger,
  ].join("|");
}

function mealSourceBlocked(state, facilityId, save) {
  return state.failedMealSourceContexts?.[facilityId] === resourceContextSignature(save);
}

function rejectionReason(outcome) {
`,
  "policy-resource-signature",
);
policy = replaceOnce(
  policy,
  `    knownMealSources: {},
    actionCount: 0,
`,
  `    knownMealSources: {},
    failedMealSourceContexts: {},
    triedStockIds: [],
    weaponTypesTried: [],
    equippedEquipmentIds: [],
    actionCount: 0,
`,
  "policy-state-equipment",
);
policy = replaceOnce(
  policy,
  `    mealCount: 0,
    restCount: 0,
`,
  `    mealCount: 0,
    mealSearchMoveCount: 0,
    restCount: 0,
`,
  "policy-meal-search-count",
);
policy = replaceOnce(
  policy,
  `    if (accepted && decision.type === "BATTLE") state.battleCount += 1;
    if (accepted && decision.category === "work") state.workCount += 1;
    if (accepted && decision.category === "meal") state.mealCount += 1;
    if (accepted && decision.category === "rest") state.restCount += 1;
`,
  `    if (accepted && decision.type === "BATTLE") state.battleCount += 1;
    if (accepted && decision.category === "work") state.workCount += 1;
    if (accepted && decision.category === "meal_consumed") state.mealCount += 1;
    if (accepted && decision.category === "meal_search_move") {
      state.mealSearchMoveCount += 1;
      const hasAffordableMeal = (save?.choices ?? []).some((choice) => choice.type === "eat" && mealAffordable(choice, save));
      if (!hasAffordableMeal && facilityId) {
        state.failedMealSourceContexts[facilityId] = resourceContextSignature(save);
      }
    }
    if (accepted && decision.type === "SHOP_TRY") {
      appendUnique(state.triedStockIds, decision.stockId, 100);
      appendUnique(state.weaponTypesTried, decision.weaponType, 40);
    }
    if (accepted && decision.type === "EQUIP") appendUnique(state.equippedEquipmentIds, decision.equipmentId, 100);
    if (accepted && decision.category === "rest") state.restCount += 1;
`,
  "policy-observe-categories",
);
policy = replaceOnce(
  policy,
  `function moveDecision(move, reason, extras = {}) {
`,
  `function commandDecision(type, payload, reason, extras = {}) {
  const identity = payload?.skillId ?? payload?.stockId ?? payload?.offerId ?? payload?.loanId
    ?? payload?.rewardId ?? payload?.equipmentId ?? "command";
  return {
    type,
    payload,
    key: \`${type}:\${identity}\`,
    actionId: \`${type}:\${identity}\`,
    reason,
    ...extras,
  };
}

function moveDecision(move, reason, extras = {}) {
`,
  "policy-command-decision",
);
policy = replaceOnce(
  policy,
  `function survivalDecision(save, model, state) {
`,
  `function skillLearningDecision(save) {
  const learnable = [...(save?.skills?.learnable ?? [])]
    .sort((left, right) => Number(Boolean(right.recommended)) - Number(Boolean(left.recommended))
      || Number(left.spCost ?? left.cost ?? 0) - Number(right.spCost ?? right.cost ?? 0)
      || String(left.id).localeCompare(String(right.id), "en"));
  const skill = learnable[0];
  if (!skill) return null;
  return commandDecision("LEARN_SKILL", { skillId: skill.id }, \`取得可能な「\${skill.name ?? skill.id}」を覚える\`, {
    skillId: skill.id,
    category: "skill_learning",
  });
}

function shopDecision(save, state) {
  const guidedChoice = (save?.choices ?? []).find((choice) => /LOC_CAP_WEAPON_SHOP|王都武器屋/u.test(actionText(choice)));
  if (guidedChoice) return choiceDecision(guidedChoice, "王都で案内された武器屋を訪ねる", { category: "shop_discovery" });

  const reward = save?.shop?.rewards?.[0];
  if (reward) {
    return commandDecision("CLAIM_EQUIPMENT_REWARD", { rewardId: reward.rewardId }, "依頼で得た装備報酬を受け取る", {
      equipmentId: reward.equipmentId,
      category: "equipment_reward",
    });
  }
  if (!save?.shop?.available) return null;

  const stock = save.shop.stock ?? [];
  const trial = stock.find((entry) => entry.access?.trial?.available !== false
    && entry.access?.trial
    && !state.triedStockIds.includes(entry.stockId)
    && entry.equipment?.weaponType
    && !state.weaponTypesTried.includes(entry.equipment.weaponType));
  if (trial && state.weaponTypesTried.length < 4) {
    return commandDecision("SHOP_TRY", { stockId: trial.stockId }, \`\${trial.name}を試し、今の装備と扱いを比べる\`, {
      stockId: trial.stockId,
      equipmentId: trial.equipmentId,
      weaponType: trial.equipment.weaponType,
      category: "equipment_trial",
    });
  }

  const equippedIds = new Set(Object.values(save?.player?.equipment ?? {}).map((entry) => entry?.id ?? entry).filter(Boolean));
  const owned = (save?.player?.inventory?.equipment ?? []).find((entry) => entry.weaponType
    && !equippedIds.has(entry.id)
    && !state.equippedEquipmentIds.includes(entry.id));
  if (owned) {
    return commandDecision("EQUIP", { equipmentId: owned.id }, \`\${owned.name ?? owned.id}を装備して使い心地を確かめる\`, {
      equipmentId: owned.id,
      weaponType: owned.weaponType,
      category: "equipment_change",
    });
  }

  const hasActiveBattleMission = (save?.missions ?? []).some((mission) => mission.status === "active"
    && /battle|戦|討伐|護衛/u.test(`${mission.currentStep?.type ?? ""} ${mission.currentStep?.label ?? ""}`));
  const loanEntry = hasActiveBattleMission && !(save.shop.loans ?? []).length
    ? stock.find((entry) => entry.access?.loan && entry.access.loan.available !== false) : null;
  if (loanEntry) {
    return commandDecision("SHOP_BORROW", { loanId: loanEntry.access.loan.loanId }, \`依頼用に\${loanEntry.name}を借りる\`, {
      equipmentId: loanEntry.equipmentId,
      weaponType: loanEntry.equipment?.weaponType ?? null,
      category: "equipment_loan",
    });
  }

  const usedEntry = stock.find((entry) => entry.access?.used
    && entry.access.used.available !== false
    && Number(entry.access.used.price ?? Infinity) <= Math.max(0, Number(save.player?.gold ?? 0) - 12)
    && entry.equipment?.weaponType
    && !state.weaponTypesTried.includes(entry.equipment.weaponType));
  if (usedEntry) {
    return commandDecision("SHOP_BUY_USED", { offerId: usedEntry.access.used.offerId }, \`中古の\${usedEntry.name}を購入する\`, {
      equipmentId: usedEntry.equipmentId,
      weaponType: usedEntry.equipment.weaponType,
      category: "equipment_purchase",
    });
  }
  return null;
}

function survivalDecision(save, model, state) {
`,
  "policy-skill-shop-decisions",
);
policy = replaceOnce(
  policy,
  `    if (meal) return choiceDecision(meal, "空腹が強まる前に、支払える食事を取る", { category: "meal" });
`,
  `    if (meal) return choiceDecision(meal, "空腹が強まる前に、支払える食事を取る", { category: "meal_consumed" });
`,
  "policy-meal-consumed",
);
policy = replaceOnce(
  policy,
  `      .filter((source) => Number(source.minimumPrice) <= Number(save.player?.gold ?? 0))
`,
  `      .filter((source) => Number(source.minimumPrice) <= Number(save.player?.gold ?? 0))
      .filter((source) => !mealSourceBlocked(state, source.facilityId, save))
`,
  "policy-known-meal-block",
);
policy = replaceOnce(
  policy,
  `      if (knownMealMove) return moveDecision(knownMealMove, "所持金で食べられる食事処へ戻る", { category: "meal" });
`,
  `      if (knownMealMove) return moveDecision(knownMealMove, "所持金で食べられる食事処へ戻る", { category: "meal_search_move" });
`,
  "policy-known-meal-category",
);
policy = replaceOnce(
  policy,
  `    const mealMove = (save.movement ?? [])
      .filter((move) => !isDecisionBlocked(state, \`MOVE:\${move.moveId}\`, save))
      .find((move) => facilityLooksLike(move, /宿|食堂|酒場|茶屋|パン|市場/u));
    if (mealMove) return moveDecision(mealMove, "別の食事処で価格や無料の食事を確かめる", { category: "meal" });
`,
  `    const mealMove = (save.movement ?? [])
      .filter((move) => !isDecisionBlocked(state, \`MOVE:\${move.moveId}\`, save))
      .filter((move) => !mealSourceBlocked(state, move.destinationFacilityId, save))
      .find((move) => facilityLooksLike(move, /宿|食堂|酒場|茶屋|パン|市場/u));
    if (mealMove) return moveDecision(mealMove, "別の食事処で価格や無料の食事を確かめる", { category: "meal_search_move" });
`,
  "policy-meal-move-block",
);
policy = replaceOnce(
  policy,
  `function choiceCategory(choice) {
  if (choice?.type === "eat" || SURVIVAL_MEAL_PATTERN.test(actionText(choice))) return "meal";
`,
  `function choiceCategory(choice) {
  if (choice?.type === "eat") return "meal_consumed";
`,
  "policy-choice-category",
);
policy = replaceOnce(
  policy,
  `  return survivalDecision(save, model, state)
    ?? activeMissionDecision(save, model, state)
`,
  `  return skillLearningDecision(save)
    ?? shopDecision(save, state)
    ?? survivalDecision(save, model, state)
    ?? activeMissionDecision(save, model, state)
`,
  "policy-priority-growth",
);
policy = replaceOnce(
  policy,
  `    meals: state.mealCount,
    rests: state.restCount,
`,
  `    meals: state.mealCount,
    mealSeekingMoves: state.mealSearchMoveCount,
    rests: state.restCount,
`,
  "policy-report-meal-search",
);
policy = replaceOnce(
  policy,
  `  decisionContextSignature,
  isDecisionBlocked,
`,
  `  decisionContextSignature,
  resourceContextSignature,
  mealSourceBlocked,
  isDecisionBlocked,
`,
  "policy-internals",
);
fs.writeFileSync(policyPath, policy, "utf8");

const cliPath = "tools/trpg-sim/cli-day100-player.mjs";
let cli = fs.readFileSync(cliPath, "utf8");
cli = replaceOnce(
  cli,
  `  liveSampleLimit: Number(process.env.TRPG_DAY100_LIVE_MAX || 48),
`,
  `  maxNarrativeCalls: Number(process.env.TRPG_DAY100_NARRATIVE_MAX || 600),
`,
  "cli-narrative-limit",
);
fs.writeFileSync(cliPath, cli, "utf8");

const runnerTestPath = "tools/trpg-sim/test/day100-player-runner.test.mjs";
let runnerTest = fs.readFileSync(runnerTestPath, "utf8");
runnerTest = replaceOnce(
  runnerTest,
  `import { createDay100SampledNarrator } from "../lib/day100-player-runner.mjs";
`,
  `import { createDay100ExperienceAudit } from "../lib/day100-experience-audit.mjs";
import { createDay100Narrator } from "../lib/day100-narrator.mjs";
`,
  "runner-test-import",
);
runnerTest = replaceOnce(
  runnerTest,
  `test("Day100 sampled narrator can run a routine scene without a Gemini provider call", async () => {
  const narrator = createDay100SampledNarrator({ liveSampleLimit: 0 });
  const response = await narrator.generate(scenario());
  assert.equal(response.meta.source, "day100_policy_fallback");
`,
  `test("Day100 narrator limits server templates to routine life processing", async () => {
  const experienceAudit = createDay100ExperienceAudit();
  const narrator = createDay100Narrator({ maxNarrativeCalls: 1, experienceAudit });
  const response = await narrator.generate(scenario());
  assert.equal(response.meta.source, "routine_server_template");
`,
  "runner-test-routine",
);
runnerTest = replaceOnce(
  runnerTest,
  `  assert.equal(narrator.stats.liveCalls, 0);
  assert.equal(narrator.stats.policyFallbacks, 1);
`,
  `  assert.equal(narrator.stats.liveCalls, 0);
  assert.equal(narrator.stats.routineTemplates, 1);
  assert.equal(experienceAudit.narrative.meaningfulScenes, 0);
`,
  "runner-test-stats",
);
fs.writeFileSync(runnerTestPath, runnerTest, "utf8");

const rejectionTestPath = "tools/trpg-sim/test/day100-rejection-ledger.test.mjs";
let rejectionTest = fs.readFileSync(rejectionTestPath, "utf8")
  .replaceAll('category: "meal",', 'category: "meal_consumed",')
  .replace('assert.equal(decision.category, "meal");', 'assert.equal(decision.category, "meal_consumed");');
rejectionTest += `

test("an unsuccessful meal-source visit is not repeated under the same resources", () => {
  const state = createDay100CoverageState(model);
  const current = save({ gold: 0 });
  current.choices = [{ choiceId: "CHOICE-WAIT", actionId: "WAIT", label: "待つ", type: "wait" }];
  current.movement = [{
    moveId: "MOVE_LOCAL:LOC_CAP_INN",
    destinationFacilityId: "LOC_CAP_INN",
    destinationFacilityName: "安宿",
    label: "安宿へ行く",
    scope: "local",
  }];
  const first = selectDay100Decision({ save: current, model, state });
  assert.equal(first.category, "meal_search_move");
  const arrived = structuredClone(current);
  arrived.scene.facilityId = "LOC_CAP_INN";
  arrived.movement = [{
    moveId: "MOVE_LOCAL:LOC_CAP_MARKET",
    destinationFacilityId: "LOC_CAP_MARKET",
    destinationFacilityName: "市場",
    label: "市場へ行く",
    scope: "local",
  }];
  observeDay100Coverage(state, arrived, { ...first, accepted: true, outcome: { ok: true } });
  assert.equal(DAY100_POLICY_INTERNALS.mealSourceBlocked(state, "LOC_CAP_INN", arrived), true);
  arrived.movement.push({
    moveId: "MOVE_LOCAL:LOC_CAP_INN",
    destinationFacilityId: "LOC_CAP_INN",
    destinationFacilityName: "安宿",
    label: "安宿へ戻る",
    scope: "local",
  });
  const second = selectDay100Decision({ save: arrived, model, state });
  assert.notEqual(second?.moveId, "MOVE_LOCAL:LOC_CAP_INN");
});
`;
fs.writeFileSync(rejectionTestPath, rejectionTest, "utf8");

fs.rmSync("tools/trpg-refactor/apply-day100-experience-audit-v1.mjs");
console.log("strict Day100 experience simulation integrated");
