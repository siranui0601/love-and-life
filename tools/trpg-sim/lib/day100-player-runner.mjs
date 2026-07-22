import fs from "node:fs";
import path from "node:path";
import { createTrpgNarrator } from "../../../src/server/trpg/gemini-narrator.js";
import {
  buildLocalNarrativeContext,
  deterministicNarrativeFallback,
  resolveNarrativeProposals,
} from "../../../src/server/trpg/narrative-contract.js";
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
const DEFAULT_LIVE_SAMPLE_LIMIT = 48;

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

function candidateChoice(candidate) {
  return {
    id: candidate.id,
    label: candidate.label,
    intentType: candidate.intentType,
    targetNpcId: candidate.targetNpcId ?? null,
  };
}

function policyFallbackChoices(context) {
  const pool = context.allowedActionCandidates ?? [];
  const selected = [];
  const add = (candidate) => {
    if (!candidate || selected.some((entry) => entry.id === candidate.id)) return;
    selected.push(candidateChoice(candidate));
  };
  const progress = new Set(context.progressContract?.anchorCandidateIds ?? []);
  const continuity = new Set(context.continuityContract?.candidateIds ?? []);
  add(pool.find((candidate) => progress.has(candidate.id)));
  add(pool.find((candidate) => continuity.has(candidate.id)));
  add(pool.find((candidate) => candidate.workOffer === true));
  for (const candidate of pool) {
    if (selected.length >= 3) break;
    if (!selected.some((entry) => entry.intentType === candidate.intentType)) add(candidate);
  }
  for (const candidate of pool) {
    if (selected.length >= 3) break;
    add(candidate);
  }
  return selected.slice(0, 3);
}

function deterministicPolicyNarrative(input, rules = {}) {
  const { context } = buildLocalNarrativeContext(input);
  const fallback = deterministicNarrativeFallback(context, "day100_policy_sampling");
  const choices = policyFallbackChoices(context);
  const response = {
    ...fallback,
    choices: choices.length === 3 ? choices : fallback.choices,
    proposalResolution: { accepted: [], rejected: [] },
    meta: {
      source: "day100_policy_fallback",
      providerCalls: 0,
      repairCalls: 0,
      validationErrors: [],
      promptVersion: "day100-policy-fallback-v1",
    },
  };
  response.proposalResolution = resolveNarrativeProposals(response, context, rules);
  return response;
}

function narrativeSampleKey(input) {
  const action = input?.action ?? {};
  const missions = input?.authoritativeState?.missions ?? [];
  const mission = missions.find((entry) => entry.id === action.missionId) ?? missions[0] ?? null;
  return [
    input?.sceneMode ?? "unknown",
    mission?.troubleId ?? "none",
    action.missionId ?? mission?.id ?? "none",
    action.stepId ?? mission?.currentStep?.id ?? "none",
    action.dialogueTopic ?? action.type ?? "unknown",
    input?.authoritativeState?.locationId ?? "unknown",
  ].join(":");
}

function shouldSampleLive(input, sampledKeys) {
  const action = input?.action ?? {};
  const sceneMode = input?.sceneMode ?? "";
  const missions = input?.authoritativeState?.missions ?? [];
  const key = narrativeSampleKey(input);
  if (sampledKeys.has(key)) return false;
  if (action.missionId || missions.some((mission) => mission.troubleId)) return true;
  if (action.firstIntroduction) return true;
  if (["battle_aftermath", "arrival"].includes(sceneMode)) return true;
  if (sceneMode === "conversation" && action.dialogueTopic && action.dialogueTopic !== "work_offer") return true;
  return false;
}

export function createDay100SampledNarrator({
  auditFilePath,
  liveSampleLimit = DEFAULT_LIVE_SAMPLE_LIMIT,
} = {}) {
  const live = createTrpgNarrator({
    auditFilePath,
    memoryOnlyAudit: false,
    memoryOnlyCache: true,
  });
  const sampledKeys = new Set();
  const stats = {
    liveLimit: Math.max(0, number(liveSampleLimit, DEFAULT_LIVE_SAMPLE_LIMIT)),
    liveCalls: 0,
    policyFallbacks: 0,
    liveKeys: [],
    sourceCounts: {},
  };
  return {
    stats,
    async generate(input, rules = {}) {
      const key = narrativeSampleKey(input);
      if (stats.liveCalls < stats.liveLimit && shouldSampleLive(input, sampledKeys)) {
        sampledKeys.add(key);
        stats.liveCalls += 1;
        stats.liveKeys.push(key);
        const response = await live.generate(input, rules);
        const source = response.meta?.source ?? "unknown";
        stats.sourceCounts[source] = (stats.sourceCounts[source] ?? 0) + 1;
        return response;
      }
      stats.policyFallbacks += 1;
      stats.sourceCounts.day100_policy_fallback = (stats.sourceCounts.day100_policy_fallback ?? 0) + 1;
      return deterministicPolicyNarrative(input, rules);
    },
  };
}

export class Day100GameRunner {
  constructor({
    playerName = "百日の旅人",
    seed = "trpg-day100-player-v1",
    maxActions = DEFAULT_MAX_ACTIONS,
    liveSampleLimit = DEFAULT_LIVE_SAMPLE_LIMIT,
    auditFilePath,
  } = {}) {
    this.playerName = playerName;
    this.seed = seed;
    this.owner = `day100:${seed}`;
    this.maxActions = Math.max(100, number(maxActions, DEFAULT_MAX_ACTIONS));
    this.store = new MemoryTrpgSaveStore();
    this.narrator = createDay100SampledNarrator({ auditFilePath, liveSampleLimit });
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
    observeDay100Coverage(this.coverage, this.save, observedDecision);
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
      after: compactSave(this.save),
    });
    return response;
  }

  async finishBattle(decision) {
    let rounds = 0;
    while (this.save.battle && rounds < 160) {
      rounds += 1;
      const available = (this.save.battle.commands ?? []).filter((command) => command.available !== false);
      const action = available.find((command) => command.kind === "skill")
        ?? available.find((command) => command.kind === "attack")
        ?? available.find((command) => command.kind === "defend")
        ?? available.find((command) => command.kind === "flee")
        ?? available[0];
      if (!action) throw new Error(`no available battle action at round ${this.save.battle.round}`);
      const target = action.targets?.find((entry) => entry.side === "enemy" && entry.alive !== false) ?? action.targets?.[0];
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
      this.trace.push({
        event: "BATTLE_ACT",
        decision: { reason: decision.reason, actionId: action.actionId, targetId: target?.instanceId ?? null },
        before,
        after: compactSave(this.save),
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
    report.quality = {
      reachedDay100: report.reachedDay100,
      noDeadEnd: report.deadEnds === 0,
      allTroublesTerminal: report.counts.terminal === report.counts.total,
      laterTroubleDiscovered: report.counts.discovered > 1,
      laterTroubleProgressed: report.counts.progressed > 1,
      noRunnerError: report.errors.length === 0,
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
- 生活: 食事${report.meals}・休息${report.rests}・仕事${report.jobs}・戦闘${report.battles}
- Gemini実サンプル: ${report.narrative.liveCalls}/${report.narrative.liveLimit} / 決定論的通常場面${report.narrative.policyFallbacks}
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
