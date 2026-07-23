import fs from "node:fs";
import path from "node:path";
import {
  createDay100ExperienceAudit,
  finalizeExperienceAudit,
  observeBattleExperience,
  observeSaveExperience,
} from "./day100-experience-audit.mjs";
import { createDay100Narrator } from "./day100-narrator.mjs";
import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";
import { deserializeRuntime } from "../../../src/server/trpg/game/serializer.js";
import { TrpgGameService } from "../../../src/server/trpg/game/service.js";
import { loadWorldModel } from "./world-model.mjs";
import {
  createDay100CoverageState,
  finalizeDay100Coverage,
  observeDay100Coverage,
  selectDay100Decision,
} from "./day100-player-policy.mjs";

const DEFAULT_MAX_ACTIONS = 4200;
const DEFAULT_NARRATIVE_CALL_LIMIT = 600;

function text(value) {
  return String(value ?? "").trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function compactSave(save) {
  return {
    revision: save.revision,
    stateHash: save.stateHash ?? null,
    day: save.clock?.day ?? null,
    time: save.clock?.time ?? null,
    minute: save.clock?.absoluteMinute ?? null,
    location: save.scene?.location ?? null,
    facilityId: save.scene?.facilityId ?? null,
    gold: save.player?.gold ?? null,
    freeMeals: save.player?.freeMeals ?? 0,
    freeLodging: save.player?.freeLodging ?? 0,
    hunger: save.player?.needs?.hunger ?? null,
    fatigue: save.player?.needs?.fatigue ?? null,
    inventoryEquipment: JSON.parse(JSON.stringify(save.player?.inventory?.equipment ?? [])),
    skills: JSON.parse(JSON.stringify(save.skills ?? {})),
    choiceIds: (save.choices ?? []).map((choice) => choice.actionId),
    movementIds: (save.movement ?? []).map((move) => move.moveId),
    activeMissions: (save.missions ?? [])
      .filter((mission) => mission.kind === "special" && !["completed", "resolved", "failed", "expired", "suppressed", "unavailable"].includes(mission.status))
      .map((mission) => ({
        id: mission.id,
        troubleId: mission.troubleId,
        status: mission.status,
        stepId: mission.currentStep?.id ?? null,
        progress: mission.currentStep?.progress ?? null,
        required: mission.currentStep?.required ?? null,
      })),
    battle: save.battle ? { id: save.battle.id, round: save.battle.round, status: save.battle.status } : null,
    lastOutcome: save.scene?.lastOutcome ?? null,
    ended: Boolean(save.world?.ended),
  };
}

export class Day100GameRunner {
  constructor({
    playerName = "百日の旅人",
    seed = "trpg-day100-player-v1",
    maxActions = DEFAULT_MAX_ACTIONS,
    maxNarrativeCalls = DEFAULT_NARRATIVE_CALL_LIMIT,
    auditFilePath,
  } = {}) {
    this.playerName = playerName;
    this.seed = seed;
    this.owner = `day100:${seed}`;
    this.maxActions = Math.max(100, number(maxActions, DEFAULT_MAX_ACTIONS));
    this.store = new MemoryTrpgSaveStore();
    this.experienceAudit = createDay100ExperienceAudit();
    this.narrator = createDay100Narrator({
      auditFilePath,
      maxNarrativeCalls,
      experienceAudit: this.experienceAudit,
    });
    this.game = new TrpgGameService({
      store: this.store,
      narrator: this.narrator,
      allowCustomSeed: true,
      maxSavesPerOwner: 2,
    });
    this.model = loadWorldModel();
    this.coverage = createDay100CoverageState(this.model);
    this.save = null;
    this.sequence = 0;
    this.trace = [];
    this.errors = [];
  }

  async start() {
    this.save = await this.game.create(this.owner, { playerName: this.playerName, seed: this.seed });
    observeDay100Coverage(this.coverage, this.save);
    observeSaveExperience(this.experienceAudit, {}, compactSave(this.save), {
      accepted: true,
      actionId: "GAME_START",
    });
    this.trace.push({ event: "START", after: compactSave(this.save) });
    return this.save;
  }

  async command(type, payload, decision) {
    const before = compactSave(this.save);
    const response = await this.game.command(this.owner, this.save.id, {
      commandId: `${this.seed}-${++this.sequence}`,
      expectedRevision: this.save.revision,
      type,
      payload,
    });
    this.save = response.save;
    const outcome = this.save.scene?.lastOutcome ?? null;
    const accepted = outcome?.ok !== false && outcome?.success !== false && outcome?.accepted !== false;
    const observedDecision = { ...decision, accepted, outcome };
    const after = compactSave(this.save);
    observeDay100Coverage(this.coverage, this.save, observedDecision);
    observeSaveExperience(this.experienceAudit, before, after, observedDecision);
    this.trace.push({
      event: type,
      decision: {
        reason: decision?.reason ?? null,
        actionId: decision?.actionId ?? null,
        moveId: decision?.moveId ?? null,
        missionId: decision?.missionId ?? null,
        troubleId: decision?.troubleId ?? null,
        category: decision?.category ?? null,
        accepted,
        rejectionReason: accepted ? null : text(outcome?.reason ?? outcome?.error ?? outcome?.message ?? outcome?.summary ?? outcome?.type),
      },
      outcome,
      before,
      after,
    });
    return response;
  }

  async finishBattle(decision) {
    let rounds = 0;
    while (this.save.battle && rounds < 160) {
      rounds += 1;
      const available = (this.save.battle.commands ?? []).filter((command) => command.available !== false);
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
      if (!action) throw new Error(`no available battle action at round ${this.save.battle.round}`);
      const target = action.targets?.find((entry) => entry.side === "enemy" && entry.alive !== false) ?? action.targets?.[0];
      observeBattleExperience(this.experienceAudit, this.save, { ...action, selected: true });
      const before = compactSave(this.save);
      const response = await this.game.command(this.owner, this.save.id, {
        commandId: `${this.seed}-${++this.sequence}`,
        expectedRevision: this.save.revision,
        type: "BATTLE_ACT",
        payload: {
          battleId: this.save.battle.id,
          actionId: action.actionId,
          ...(target ? { targetInstanceId: target.instanceId } : {}),
        },
      });
      this.save = response.save;
      const after = compactSave(this.save);
      observeSaveExperience(this.experienceAudit, before, after, {
        accepted: true,
        actionId: action.actionId,
        category: "battle_action",
      });
      this.trace.push({
        event: "BATTLE_ACT",
        decision: { reason: decision.reason, actionId: action.actionId, targetId: target?.instanceId ?? null },
        before,
        after,
      });
    }
    if (this.save.battle) throw new Error("battle did not finish within 160 rounds");
    observeDay100Coverage(this.coverage, this.save, decision);
    return rounds;
  }

  async step() {
    const decision = selectDay100Decision({ save: this.save, model: this.model, state: this.coverage });
    if (!decision) {
      if (!this.save.world?.ended) this.coverage.deadEndCount += 1;
      return false;
    }
    if (decision.type === "BATTLE") {
      await this.finishBattle(decision);
      return true;
    }
    await this.command(decision.type, decision.payload ?? {}, decision);
    return true;
  }

  async run() {
    await this.start();
    while (!this.save.world?.ended && this.coverage.actionCount < this.maxActions) {
      try {
        const advanced = await this.step();
        if (!advanced) break;
      } catch (error) {
        this.errors.push({
          action: this.coverage.actionCount,
          minute: this.save?.clock?.absoluteMinute ?? null,
          message: text(error?.stack ?? error),
          save: this.save ? compactSave(this.save) : null,
        });
        break;
      }
    }
    const record = this.save ? await this.store.get(this.save.id) : null;
    const runtime = record ? deserializeRuntime(record.runtimeSnapshot, this.game.data) : null;
    const report = finalizeDay100Coverage(this.coverage, {
      save: this.save,
      runtime,
      model: this.model,
    });
    report.seed = this.seed;
    report.playerName = this.playerName;
    report.maxActions = this.maxActions;
    report.stoppedByActionLimit = !this.save?.world?.ended && this.coverage.actionCount >= this.maxActions;
    report.errors = this.errors;
    report.narrative = { ...this.narrator.stats };
    report.experience = finalizeExperienceAudit(this.experienceAudit);
    report.quality = {
      reachedDay100: report.reachedDay100,
      noDeadEnd: report.deadEnds === 0,
      allTroublesTerminal: report.counts.terminal === report.counts.total,
      laterTroubleDiscovered: report.counts.discovered > 1,
      laterTroubleProgressed: report.counts.progressed > 1,
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
    };
    report.quality.passed = Object.values(report.quality).every(Boolean);
    return { report, trace: this.trace };
  }
}

export function renderDay100PlayerMarkdown(report) {
  const failedChecks = Object.entries(report.quality ?? {}).filter(([key, value]) => key !== "passed" && value === false).map(([key]) => key);
  const troubleRows = report.troubles.map((entry) => `| ${entry.id} | ${entry.name} | ${entry.discovered ? "○" : "—"} | ${entry.progressed ? "○" : "—"} | ${entry.engaged ? "○" : "—"} | ${entry.finalTroubleStatus ?? "不明"} | ${entry.finalMissionStatus ?? "—"} |`).join("\n");
  return `# TRPG Day1→Day100 単一路線プレイヤー監査

- 到達: ${report.reachedDay100 ? "Day100完走" : `Day ${report.finalClock?.day ?? "?"}で停止`}
- 行動数: ${report.actions}（成功${report.acceptedActions}・拒否${report.rejectedActions}） / 上限${report.maxActions}
- 地域: ${report.visitedHubCount} / 施設: ${report.visitedFacilityCount}
- トラブル: 発見${report.counts.discovered}/${report.counts.total}・関与${report.counts.engaged}・進行${report.counts.progressed}・解決${report.counts.resolved}・失敗${report.counts.failed}・終端${report.counts.terminal}
- 生活: 食事${report.meals}・食事処探索移動${report.mealSeekingMoves}・休息${report.rests}・仕事${report.jobs}・戦闘${report.battles}
- 物語生成: Gemini/承認再生${report.narrative.liveCalls}・生活テンプレート${report.narrative.routineTemplates}・意味場面フォールバック${report.narrative.meaningfulFallbacks}
- 会話: ${report.experience.conversation.turns}ターン・話者${report.experience.conversation.distinctSpeakerCount}人・話題${report.experience.conversation.distinctTopicCount}種・情報取得${report.experience.conversation.gainedInformationTurns}回・反復${report.experience.conversation.repeatedLineCount}回
- 成長: 取得スキル${report.experience.skills.acquiredCount}種・実使用${report.experience.skills.usedCount}種
- 武器: 所有${report.experience.equipment.weaponTypeOwnedCount}種・装備経験${report.experience.equipment.weaponTypeEquippedCount}種・試用${report.experience.equipment.triedIds.length}件
- 品質判定: ${report.quality.passed ? "PASS" : `BLOCKED（${failedChecks.join("、")}）`}

## トラブル別到達状況

| ID | トラブル | 発見 | 進行 | プレイヤー関与 | 世界最終状態 | 依頼最終状態 |
|---|---|---:|---:|---:|---|---|
${troubleRows}

## 実行エラー

${report.errors.length ? report.errors.map((entry) => `- Day minute ${entry.minute}: ${entry.message.split("\n")[0]}`).join("\n") : "なし"}
`;
}

export async function writeDay100PlayerArtifacts({ report, trace }, {
  reportsDirectory,
  prefix = "day100-player-latest",
} = {}) {
  fs.mkdirSync(reportsDirectory, { recursive: true });
  const summaryPath = path.join(reportsDirectory, `${prefix}.json`);
  const markdownPath = path.join(reportsDirectory, `${prefix}.md`);
  const tracePath = path.join(reportsDirectory, `${prefix}-trace.jsonl`);
  fs.writeFileSync(summaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownPath, renderDay100PlayerMarkdown(report), "utf8");
  fs.writeFileSync(tracePath, `${trace.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
  return { summaryPath, markdownPath, tracePath };
}
