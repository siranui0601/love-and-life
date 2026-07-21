import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTrpgNarrator } from "../../src/server/trpg/gemini-narrator.js";
import { syncNarrativeAuditToSheet } from "../../src/server/trpg/narrative-audit.js";
import { MemoryTrpgSaveStore } from "../../src/server/trpg/game/save-store.js";
import { TrpgGameService } from "../../src/server/trpg/game/service.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = path.join(HERE, "reports");
fs.mkdirSync(REPORTS, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
const runId = process.env.TRPG_NARRATIVE_RUN_ID || `experiential-v6-${stamp}`;
process.env.TRPG_NARRATIVE_RUN_ID = runId;
const auditFilePath = path.join(REPORTS, `experiential-v6-${stamp}-narrative-audit.jsonl`);
const cursorFilePath = path.join(REPORTS, `experiential-v6-${stamp}-sheet-cursor.json`);
const META_PATTERN = /(ミッション|クエスト|選択肢|3択|ボタン|タップ|クリック|画面|UI|メニュー|フラグ|プレイヤー|ゲーム|チュートリアル|SP|HP|MP|レベル|ステータス|ログ|システム|resolver|Gemini)/iu;

const narrator = createTrpgNarrator({ auditFilePath, memoryOnlyAudit: false, memoryOnlyCache: true });
const game = new TrpgGameService({
  store: new MemoryTrpgSaveStore(),
  narrator,
  allowCustomSeed: true,
  maxSavesPerOwner: 10,
});

const text = (value) => String(value ?? "").trim();
const t01 = (save) => save.missions.find((mission) => mission.id === "MSN-T01") ?? null;
const terminalT01 = (save) => ["completed", "resolved", "failed", "expired", "suppressed", "unavailable"].includes(t01(save)?.status);
const sceneLines = (save) => (save.scene?.beats ?? []).map((beat) => text(beat.text)).filter(Boolean);

function compact(save) {
  const mission = t01(save);
  return {
    revision: save.revision,
    day: save.clock.day,
    time: save.clock.time,
    absoluteMinute: save.clock.absoluteMinute,
    location: save.scene.location,
    facilityId: save.scene.facilityId,
    facilityName: save.scene.facilityName,
    gold: Number(save.player?.gold ?? 0),
    tutorialId: save.tutorial?.id ?? null,
    choices: save.choices.map((choice) => ({ actionId: choice.actionId, label: choice.label })),
    movement: save.movement.map((move) => ({ moveId: move.moveId, label: move.label, destinationFacilityId: move.destinationFacilityId ?? null, destinationHub: move.destination ?? null })),
    battle: save.battle ? {
      id: save.battle.id,
      round: save.battle.round,
      commands: save.battle.commands.map((command) => ({
        actionId: command.actionId,
        name: command.name,
        kind: command.kind,
        available: command.available,
        disabledReason: command.disabledReason ?? null,
        disabledDetail: command.disabledDetail ?? null,
      })),
    } : null,
    t01: mission ? {
      status: mission.status,
      optional: mission.optional,
      stepId: mission.currentStep?.id ?? null,
      stepLabel: mission.currentStep?.label ?? null,
      progress: mission.currentStep?.progress ?? null,
      required: mission.currentStep?.required ?? null,
      discoveries: mission.discoveries ?? [],
    } : null,
    lines: sceneLines(save),
  };
}

class Runner {
  constructor(name, seed) {
    this.name = name;
    this.seed = seed;
    this.owner = `experiential:${name}`;
    this.save = null;
    this.sequence = 0;
    this.trace = [];
    this.jobs = [];
    this.disabledBattleCommands = [];
  }

  async start() {
    this.save = await game.create(this.owner, { playerName: this.name, seed: this.seed });
    this.trace.push({ event: "START", after: compact(this.save) });
  }

  async command(type, payload, selection = null) {
    const before = compact(this.save);
    const response = await game.command(this.owner, this.save.id, {
      commandId: `${this.name}-${++this.sequence}`,
      expectedRevision: this.save.revision,
      type,
      payload,
    });
    this.save = response.save;
    if (type === "CHOOSE" && selection?.actionId?.startsWith("WORK_CONFIRM:")) {
      const quoted = Number(selection.actionId.split(":").at(-1));
      this.jobs.push({
        actionId: selection.actionId,
        quoted: Number.isFinite(quoted) ? quoted : null,
        actual: Number(this.save.player.gold ?? 0) - before.gold,
        lines: sceneLines(this.save),
      });
    }
    if (this.save.battle) {
      for (const command of this.save.battle.commands.filter((entry) => entry.available === false)) {
        this.disabledBattleCommands.push({
          round: this.save.battle.round,
          actionId: command.actionId,
          name: command.name,
          disabledReason: command.disabledReason ?? null,
          disabledDetail: command.disabledDetail ?? null,
        });
      }
    }
    this.trace.push({ event: type, selection, before, after: compact(this.save) });
    return response;
  }

  choice(predicate, description) {
    const choice = this.save.choices.find(predicate);
    if (!choice) throw new Error(`${this.name}: choice not found: ${description}\n${JSON.stringify(this.save.choices, null, 2)}`);
    return choice;
  }

  async chooseId(actionId) {
    const choice = this.choice((entry) => entry.actionId === actionId, actionId);
    return this.command("CHOOSE", { choiceId: choice.choiceId }, { actionId: choice.actionId, label: choice.label });
  }

  async choose(pattern, description = String(pattern), exclude = null) {
    const choice = this.choice((entry) => {
      const haystack = `${entry.actionId} ${entry.label}`;
      return pattern.test(haystack) && (!exclude || !exclude.test(haystack));
    }, description);
    return this.command("CHOOSE", { choiceId: choice.choiceId }, { actionId: choice.actionId, label: choice.label });
  }

  async move(predicate, description) {
    const move = this.save.movement.find(predicate);
    if (!move) throw new Error(`${this.name}: movement not found: ${description}\n${JSON.stringify(this.save.movement, null, 2)}`);
    return this.command("MOVE", { moveId: move.moveId }, { moveId: move.moveId, label: move.label });
  }

  moveFacility(facilityId) {
    return this.move((entry) => entry.destinationFacilityId === facilityId, facilityId);
  }

  moveHub(hub) {
    return this.move((entry) => entry.destination === hub, hub);
  }

  async acknowledgeIntroduction() {
    const beat = this.save.scene.beats.find((entry) => entry.introductionToken);
    if (!beat) return false;
    await this.command("ACK_NPC_INTRODUCTION", { token: beat.introductionToken }, { introductionToken: beat.introductionToken });
    return true;
  }

  async acknowledgeTutorial() {
    if (!this.save.tutorial?.acknowledgeable) return false;
    await this.command("TUTORIAL_ACK", { tutorialId: this.save.tutorial.id }, { tutorialId: this.save.tutorial.id });
    return true;
  }

  async finishBattle() {
    let rounds = 0;
    while (this.save.battle && rounds < 120) {
      rounds += 1;
      const commands = this.save.battle.commands;
      const action = commands.find((entry) => entry.available && entry.kind === "skill")
        ?? commands.find((entry) => entry.available && entry.kind === "attack")
        ?? commands.find((entry) => entry.available && entry.kind === "defend")
        ?? commands.find((entry) => entry.available);
      if (!action) throw new Error(`${this.name}: no available battle command at round ${this.save.battle.round}`);
      const target = action.targets?.find((entry) => entry.side === "enemy") ?? action.targets?.[0];
      await this.command("BATTLE_ACT", {
        battleId: this.save.battle.id,
        actionId: action.actionId,
        ...(target ? { targetInstanceId: target.instanceId } : {}),
      }, { actionId: action.actionId, label: action.name, target: target?.instanceId ?? null });
    }
    if (this.save.battle) throw new Error(`${this.name}: battle did not finish within 120 rounds`);
    return rounds;
  }
}

async function opening(runner) {
  await runner.start();
  await runner.chooseId("TUTORIAL:AWAKEN:LISTEN");
  await runner.chooseId("TUTORIAL:CONTACT:WHERE");
  await runner.acknowledgeIntroduction();
  await runner.chooseId("TUTORIAL:ORIENT:VOICES");
  await runner.moveFacility("LOC_FARM_SQUARE");
}

async function rescueJourney() {
  const runner = new Runner("救助優先の旅人", "experiential-v6-rescue");
  const checks = {};
  try {
    await opening(runner);
    checks.openingHasHelpWorkAndLeave = ["INQUIRY:MIRA", "DEFER:WORK", "DEFER:LEAVE"].every((needle) => runner.save.choices.some((choice) => choice.actionId.includes(needle)));
    await runner.chooseId("TUTORIAL:INQUIRY:MIRA");
    await runner.acknowledgeIntroduction();
    await runner.acknowledgeTutorial();
    await runner.moveFacility("LOC_FARM_EDGE");
    checks.skillTutorialIsStepwise = ["①", "②", "③"].every((token) => text(runner.save.tutorial?.body).includes(token));
    checks.skillTutorialDoesNotLockChoices = runner.save.choices.length === 3;
    const skill = runner.save.skills.learnable.find((entry) => entry.recommended) ?? runner.save.skills.learnable[0];
    if (!skill) throw new Error("no learnable tutorial skill");
    await runner.command("LEARN_SKILL", { skillId: skill.id }, { skillId: skill.id, label: skill.name });
    await runner.acknowledgeTutorial();
    await runner.choose(/ACTION:MSN-T01:search:(?:claw-marks|tracks|jacket-thread)/u, "first search approach");
    await runner.choose(/ACTION:MSN-T01:search:faint-voice/u, "Finn voice");
    checks.voiceBeforeBattle = sceneLines(runner.save).some((line) => /声|フィン|生きて/u.test(line));
    await runner.choose(/ACTION:MSN-T01:rescue|赤牙狼/u, "rescue battle");
    const battleRounds = await runner.finishBattle();
    checks.battleFinishes = battleRounds > 0 && !runner.save.battle;
    checks.finnSpeaksAfterBattle = sceneLines(runner.save).some((line) => /僕、フィン|置いていかない|村の広場/u.test(line));
    checks.escortStepExists = t01(runner.save)?.currentStep?.id === "escort" && runner.save.choices.some((choice) => /escort/u.test(choice.actionId));
    await runner.choose(/ACTION:MSN-T01:escort|フィンに声|斜面の下/u, "escort conversation");
    checks.escortRequestIsHuman = sceneLines(runner.save).some((line) => /足|歩け|広場|一緒|置いて/u.test(line));
    await runner.acknowledgeIntroduction();
    await runner.moveFacility("LOC_FARM_SQUARE");
    const reunion = sceneLines(runner.save).join("\n");
    checks.reunionBeforeChoice = /母さん.*ただいま/u.test(reunion) && /よかった.*ありがとう/u.test(reunion) && /村を預かる者/u.test(reunion) && runner.save.choices.some((choice) => /MSN-T01:decide/u.test(choice.actionId));
    await runner.choose(/ACTION:MSN-T01:decide|少年を連れ帰る/u, "handoff");
    checks.completesAfterHandoff = ["completed", "resolved"].includes(t01(runner.save)?.status);
    return { id: "rescue", passed: Object.values(checks).every(Boolean), checks, battleRounds, disabledBattleCommands: runner.disabledBattleCommands, final: compact(runner.save), trace: runner.trace };
  } catch (error) {
    return { id: "rescue", passed: false, checks, error: String(error?.stack ?? error), final: runner.save ? compact(runner.save) : null, trace: runner.trace };
  }
}

function passiveChoice(save) {
  return save.choices.find((choice) => /^WORK(?:_|:)/u.test(choice.actionId))
    ?? save.choices.find((choice) => /:END$/u.test(choice.actionId))
    ?? save.choices.find((choice) => /WAIT|INSPECT|PAUSE|PLAN/u.test(choice.actionId) && !/MSN-T01/u.test(choice.actionId))
    ?? save.choices.find((choice) => !/MSN-T01|SEEK_BATTLE/u.test(`${choice.actionId} ${choice.label}`))
    ?? null;
}

async function workJourney() {
  const runner = new Runner("仕事優先の旅人", "experiential-v6-work");
  const checks = {};
  const offers = [];
  try {
    await opening(runner);
    await runner.chooseId("TUTORIAL:DEFER:WORK");
    offers.push(sceneLines(runner.save).join("\n"));
    await runner.acknowledgeIntroduction();
    checks.firstOfferHasJobAndWage = offers.some((entry) => /仕事は「.+」.*(?:報酬|賃金).*\d+G/u.test(entry));
    checks.offerHasAcceptClarifyDecline = ["WORK_CONFIRM:", "WORK_CLARIFY:", "WORK_DECLINE:"].every((prefix) => runner.save.choices.some((choice) => choice.actionId.startsWith(prefix)));
    for (let guard = 0; guard < 90 && !terminalT01(runner.save); guard += 1) {
      const confirm = runner.save.choices.find((choice) => choice.actionId.startsWith("WORK_CONFIRM:"));
      if (confirm) {
        await runner.command("CHOOSE", { choiceId: confirm.choiceId }, { actionId: confirm.actionId, label: confirm.label });
        continue;
      }
      const offer = runner.save.choices.find((choice) => /^WORK(?:_|:)/u.test(choice.actionId));
      if (offer) {
        await runner.command("CHOOSE", { choiceId: offer.choiceId }, { actionId: offer.actionId, label: offer.label });
        offers.push(sceneLines(runner.save).join("\n"));
        await runner.acknowledgeIntroduction();
        continue;
      }
      const end = runner.save.choices.find((choice) => /:END$/u.test(choice.actionId));
      if (end) {
        await runner.command("CHOOSE", { choiceId: end.choiceId }, { actionId: end.actionId, label: end.label });
        continue;
      }
      const destination = runner.save.scene.facilityId === "LOC_FARM_FIELD" ? "LOC_FARM_SQUARE" : "LOC_FARM_FIELD";
      const move = runner.save.movement.find((entry) => entry.destinationFacilityId === destination) ?? runner.save.movement.find((entry) => entry.destinationFacilityId && entry.destinationFacilityId !== "LOC_FARM_EDGE");
      if (move) {
        await runner.command("MOVE", { moveId: move.moveId }, { moveId: move.moveId, label: move.label });
        continue;
      }
      const choice = passiveChoice(runner.save);
      if (!choice) throw new Error("no non-mission action while working");
      await runner.command("CHOOSE", { choiceId: choice.choiceId }, { actionId: choice.actionId, label: choice.label });
    }
    checks.severalJobsCompleted = runner.jobs.length >= 3;
    checks.offersRemainConcrete = offers.length > 0 && offers.every((entry) => /\d+G/u.test(entry));
    checks.payMatchesQuote = runner.jobs.length > 0 && runner.jobs.every((job) => job.quoted === job.actual);
    checks.timePasses = runner.save.clock.absoluteMinute >= 1_200;
    checks.finnCanBeLostWhileWorking = ["failed", "expired", "suppressed", "unavailable"].includes(t01(runner.save)?.status);
    checks.notSilentlyCompleted = !["completed", "resolved"].includes(t01(runner.save)?.status);
    return { id: "work-first", passed: Object.values(checks).every(Boolean), checks, jobs: runner.jobs, offers, final: compact(runner.save), trace: runner.trace };
  } catch (error) {
    return { id: "work-first", passed: false, checks, jobs: runner.jobs, error: String(error?.stack ?? error), final: runner.save ? compact(runner.save) : null, trace: runner.trace };
  }
}

async function capitalJourney() {
  const runner = new Runner("王都直行の旅人", "experiential-v6-capital");
  const checks = {};
  let conversations = 0;
  try {
    await opening(runner);
    await runner.chooseId("TUTORIAL:DEFER:LEAVE");
    await runner.acknowledgeTutorial();
    checks.capitalKnownWithoutAcceptingT01 = runner.save.movement.some((move) => move.destination === "王都");
    await runner.moveHub("王都");
    checks.reachedCapital = runner.save.scene.location === "王都";
    for (let guard = 0; guard < 120 && !terminalT01(runner.save); guard += 1) {
      const confirm = runner.save.choices.find((choice) => choice.actionId.startsWith("WORK_CONFIRM:"));
      if (confirm) {
        await runner.command("CHOOSE", { choiceId: confirm.choiceId }, { actionId: confirm.actionId, label: confirm.label });
        continue;
      }
      const end = runner.save.choices.find((choice) => /:END$/u.test(choice.actionId));
      if (end) {
        await runner.command("CHOOSE", { choiceId: end.choiceId }, { actionId: end.actionId, label: end.label });
        continue;
      }
      const offer = runner.save.choices.find((choice) => /^WORK(?:_|:)/u.test(choice.actionId));
      if (offer) {
        await runner.command("CHOOSE", { choiceId: offer.choiceId }, { actionId: offer.actionId, label: offer.label });
        conversations += 1;
        await runner.acknowledgeIntroduction();
        continue;
      }
      const talk = runner.save.choices.find((choice) => /^(?:TALK|DIALOGUE):/u.test(choice.actionId));
      if (talk && conversations < 6) {
        await runner.command("CHOOSE", { choiceId: talk.choiceId }, { actionId: talk.actionId, label: talk.label });
        conversations += 1;
        await runner.acknowledgeIntroduction();
        continue;
      }
      const localMove = runner.save.movement.find((move) => move.destinationFacilityId && move.destination !== "田園の村");
      if (localMove) {
        await runner.command("MOVE", { moveId: localMove.moveId }, { moveId: localMove.moveId, label: localMove.label });
        continue;
      }
      const choice = passiveChoice(runner.save);
      if (!choice) throw new Error("no capital action");
      await runner.command("CHOOSE", { choiceId: choice.choiceId }, { actionId: choice.actionId, label: choice.label });
    }
    checks.remainsOutsideVillage = runner.save.scene.location !== "田園の村";
    checks.capitalHasInteractions = conversations >= 2 || runner.jobs.length >= 1;
    checks.t01FailsWithoutPlayer = ["failed", "expired", "suppressed", "unavailable"].includes(t01(runner.save)?.status);
    checks.worldRemainsPlayable = runner.save.choices.length > 0 || runner.save.movement.length > 0;
    return { id: "capital-first", passed: Object.values(checks).every(Boolean), checks, conversations, jobs: runner.jobs, final: compact(runner.save), trace: runner.trace };
  } catch (error) {
    return { id: "capital-first", passed: false, checks, error: String(error?.stack ?? error), final: runner.save ? compact(runner.save) : null, trace: runner.trace };
  }
}

function auditSummary(records) {
  const sources = {};
  let providerCalls = 0;
  let providerErrors = 0;
  const failed = [];
  const metaLeaks = [];
  for (const record of records) {
    sources[record.source] = (sources[record.source] ?? 0) + 1;
    providerCalls += Number(record.providerCalls ?? 0);
    providerErrors += (record.providerErrors ?? []).length;
    if (!record.evaluation?.passed) failed.push({ scenarioId: record.scenarioId, actionId: record.action?.id, source: record.source, checks: record.evaluation?.checks, validationErrors: record.validationErrors });
    const visible = [record.response?.narrative, ...(record.response?.speeches ?? []).map((speech) => speech.text)].filter(Boolean).join("\n");
    if (META_PATTERN.test(visible)) metaLeaks.push({ scenarioId: record.scenarioId, actionId: record.action?.id, visible });
  }
  return { total: records.length, sources, providerCalls, providerErrors, passed: records.length - failed.length, failed, metaLeaks };
}

function markdown(report) {
  const lines = [
    "# TRPG 実プレイヤー型シミュレーション v6",
    "",
    `- 実行ID: \`${report.runId}\``,
    `- Gemini API: ${report.environment.geminiConfigured ? "設定済み" : "未設定"}`,
    `- Sheets認証: ${report.environment.sheetsConfigured ? "設定済み" : "未設定"}`,
    `- 総合判定: **${report.quality.passed ? "PASS" : "BLOCKED"}**`,
    "",
    "## 旅程",
  ];
  for (const journey of report.journeys) {
    lines.push("", `### ${journey.id}: ${journey.passed ? "PASS" : "FAIL"}`);
    if (journey.error) lines.push("", "```text", journey.error, "```");
    for (const [key, value] of Object.entries(journey.checks ?? {})) lines.push(`- ${value ? "✅" : "❌"} ${key}`);
    if (journey.final) lines.push(`- 最終地点: ${journey.final.location} / ${journey.final.facilityName} / Day ${journey.final.day} ${journey.final.time}`);
  }
  lines.push("", "## Gemini監査", `- 記録数: ${report.audit.total}`, `- provider呼出し: ${report.audit.providerCalls}`, `- providerエラー: ${report.audit.providerErrors}`, `- 自動評価合格: ${report.audit.passed}/${report.audit.total}`, `- ソース: \`${JSON.stringify(report.audit.sources)}\``);
  if (report.audit.failed.length) {
    lines.push("", "### 不合格応答");
    for (const failure of report.audit.failed.slice(0, 30)) lines.push(`- ${failure.scenarioId} / ${failure.actionId}: \`${JSON.stringify(failure.checks)}\``);
  }
  if (report.audit.metaLeaks.length) {
    lines.push("", "### メタ用語混入");
    for (const leak of report.audit.metaLeaks.slice(0, 20)) lines.push(`- ${leak.scenarioId} / ${leak.actionId}`);
  }
  lines.push("", "## スプレッドシート同期", "```json", JSON.stringify(report.sheetSync, null, 2), "```", "");
  return `${lines.join("\n")}\n`;
}

const journeys = [];
for (const journey of [rescueJourney, workJourney, capitalJourney]) journeys.push(await journey());
const audit = auditSummary(narrator.auditLog?.records?.() ?? []);
let sheetSync;
try {
  sheetSync = await syncNarrativeAuditToSheet({ filePath: auditFilePath, cursorFilePath, spreadsheetId: process.env.TRPG_SPREADSHEET_ID });
} catch (error) {
  sheetSync = { ok: false, error: String(error?.stack ?? error) };
}
const environment = { geminiConfigured: Boolean(process.env.GEMINI_API_KEY), sheetsConfigured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY) };
const qualityChecks = {
  allJourneysPass: journeys.every((journey) => journey.passed),
  geminiWasActuallyCalled: environment.geminiConfigured && audit.providerCalls > 0,
  noProviderErrors: audit.providerErrors === 0,
  allNarrativeAuditsPass: audit.total > 0 && audit.failed.length === 0,
  noMetaLeaks: audit.metaLeaks.length === 0,
  sheetRowsWereSynced: !environment.sheetsConfigured || (sheetSync.ok === true && Number(sheetSync.synced ?? 0) > 0),
};
const report = {
  runId,
  generatedAt: new Date().toISOString(),
  environment,
  journeys,
  audit,
  sheetSync,
  quality: { passed: Object.values(qualityChecks).every(Boolean), checks: qualityChecks },
};
fs.writeFileSync(path.join(REPORTS, "experiential-player-v6-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(REPORTS, "experiential-player-v6-latest.md"), markdown(report));
console.log(markdown(report));
console.log(`TRPG_EXPERIENTIAL_V6=${report.quality.passed ? "PASS" : "BLOCKED"}`);
if (!report.quality.passed) process.exitCode = 1;
