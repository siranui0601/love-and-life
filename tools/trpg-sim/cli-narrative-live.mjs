import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTrpgNarrator } from "../../src/server/trpg/gemini-narrator.js";
import { syncNarrativeAuditToSheet } from "../../src/server/trpg/narrative-audit.js";
import { loadWorldModel } from "./lib/world-model.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const reportsDirectory = path.join(HERE, "reports");
fs.mkdirSync(reportsDirectory, { recursive: true });

function troubleById(model, troubleId) {
  return model.troubleById?.[troubleId] ?? model.troubles.find((entry) => entry.id === troubleId) ?? null;
}

function chooseFacility(model, locationId, preferredPattern = null) {
  const facilities = model.facilitiesByHub?.[locationId] ?? [];
  if (!preferredPattern) return facilities[0] ?? null;
  return facilities.find((facility) => preferredPattern.test(`${facility.name} ${facility.type}`)) ?? facilities[0] ?? null;
}

function locationOfNpc(npc) {
  return npc.initialLocation ?? npc.home ?? npc.location ?? "";
}

function chooseNpcs(model, locationId, troubleId, limit = 3) {
  const local = model.npcs
    .filter((npc) => locationOfNpc(npc) === locationId)
    .sort((left, right) => {
      const leftRelated = left.relatedTroubleIds?.includes(troubleId) ? 1 : 0;
      const rightRelated = right.relatedTroubleIds?.includes(troubleId) ? 1 : 0;
      return rightRelated - leftRelated || String(left.id).localeCompare(String(right.id));
    })
    .slice(0, limit);
  const remote = model.npcs
    .filter((npc) => locationOfNpc(npc) !== locationId)
    .slice(0, 4);
  return { local, remote };
}

function scenario(model, spec, index, runId) {
  const trouble = spec.troubleId ? troubleById(model, spec.troubleId) : null;
  const locationId = spec.locationId ?? trouble?.primaryLocations?.[0] ?? model.locations?.[0] ?? "田園の村";
  const facility = chooseFacility(model, locationId, spec.facilityPattern ?? null);
  const { local, remote } = chooseNpcs(model, locationId, spec.troubleId, spec.localNpcCount ?? 3);
  const npcs = [...local, ...remote].map((npc, npcIndex) => ({
    id: npc.id,
    name: npc.name,
    role: npc.occupation ?? npc.role ?? npc.type ?? "住民",
    mood: npcIndex === 0 ? spec.primaryMood ?? "serious" : npc.initialStatus ?? "normal",
    relationship: npcIndex === 0 ? spec.relationship ?? 0 : 0,
    knownLocalFacts: npc.relatedTroubleIds?.includes(spec.troubleId)
      ? [spec.fact ?? `${trouble?.name ?? "地域の出来事"}に関する現地情報`]
      : [],
  }));
  const mission = trouble ? {
    id: `MSN-${trouble.id}`,
    title: trouble.name,
    status: spec.status ?? "active",
    currentStep: spec.currentStep ?? "現地情報を集める",
    troubleId: trouble.id,
    targetLocations: trouble.primaryLocations,
  } : null;
  const rumor = trouble ? {
    id: `RUM-LIVE-${trouble.id}-${spec.status ?? "active"}-${index}`,
    troubleId: trouble.id,
    text: spec.rumorText ?? `${trouble.name}について、現地で新しい情報が広がっている。`,
    status: spec.status ?? "information",
    origin: locationId,
    importance: spec.importance ?? 0.8,
  } : null;
  return {
    runId,
    scenarioId: `LIVE-${String(index + 1).padStart(2, "0")}-${spec.id}`,
    locale: "ja-JP",
    playerName: "旅人",
    action: {
      id: `LIVE_ACTION:${spec.id}`,
      type: spec.actionType ?? "talk",
      label: spec.actionLabel ?? "現地の人物に詳しい事情を聞く",
      targetNpcId: local[0]?.id ?? null,
    },
    authoritativeState: {
      day: spec.day ?? 1,
      hour: spec.hour ?? 10,
      minute: spec.minute ?? 0,
      daypart: spec.daypart ?? "day",
      locationId,
      facilityId: facility?.id ?? null,
      facilityName: facility?.name ?? locationId,
      presentNpcIds: local.map((npc) => npc.id),
      npcs,
      visibleMissionIds: mission ? [mission.id] : [],
      missions: mission ? [mission] : [],
      localRumors: rumor ? [rumor] : [],
      visibleRumorIds: rumor ? [rumor.id] : [],
      visibleFlags: spec.visibleFlags ?? {},
      player: {
        displayName: "旅人",
        knownFacts: spec.playerKnownFacts ?? (spec.fact ? [spec.fact] : []),
      },
      authoritativeOutcome: {
        kind: spec.outcomeKind ?? "conversation_opened",
        status: spec.status ?? "information",
        summary: spec.outcomeSummary ?? spec.fact ?? "現地で会話を始められる状態が確定した。",
      },
    },
  };
}

function buildLiveScenarios(model, runId) {
  const specs = [
    {
      id: "t01-first-rumor",
      troubleId: "T01",
      status: "active",
      day: 1,
      locationId: "田園の村",
      actionLabel: "少年の行方について村人に聞く",
      fact: "少年が森の方角へ向かった可能性がある。",
      currentStep: "少年の足取りを聞き込む",
    },
    {
      id: "t01-resolution",
      troubleId: "T01",
      status: "resolved",
      day: 2,
      locationId: "田園の村",
      actionType: "confirm_resolution",
      actionLabel: "少年救出後の村人の反応を確かめる",
      outcomeKind: "mission_resolution_confirmed",
      outcomeSummary: "少年は救出され、事件は解決済みである。",
      primaryMood: "relieved",
      relationship: 15,
    },
    {
      id: "forest-crisis",
      troubleId: "T13",
      status: "critical",
      day: 48,
      locationId: "森",
      actionLabel: "世界樹周辺の異変を現地の者に聞く",
      fact: "世界樹の水脈が急激に弱っている。",
      importance: 0.98,
      primaryMood: "alarmed",
    },
    {
      id: "forest-after-failure",
      troubleId: "T13",
      status: "failed",
      day: 59,
      locationId: "森",
      actionType: "observe_aftermath",
      actionLabel: "世界樹倒壊後の被害を確認する",
      outcomeKind: "aftermath_observed",
      outcomeSummary: "世界樹は倒壊し、森の地形と水路が変化した。",
      primaryMood: "grieving",
    },
    {
      id: "capital-summoning",
      troubleId: "T17",
      status: "active",
      day: 72,
      locationId: "王都",
      actionLabel: "召喚儀式に関する証言を聞く",
      fact: "王都の一部で第二の召喚準備が進められている。",
      primaryMood: "guarded",
    },
    {
      id: "blackridge-diplomacy",
      troubleId: "T19",
      status: "active",
      day: 84,
      locationId: "黒嶺連合領",
      actionType: "negotiate",
      actionLabel: "現地代表と停戦条件について話す",
      fact: "黒嶺側は王都の説明責任と安全保証を求めている。",
      relationship: -10,
      primaryMood: "suspicious",
    },
    {
      id: "merchant-smalltalk",
      locationId: "交易都市",
      facilityPattern: /市場|商店|港/u,
      actionType: "talk",
      actionLabel: "市場の商人と最近の品不足について話す",
      outcomeKind: "local_conversation",
      outcomeSummary: "会話を始めることができる。価格や在庫の変更はまだ確定していない。",
      playerKnownFacts: ["港の荷動きが以前より遅い。"],
      visibleFlags: { "dialogue.local.trade_city.market_shortage": true },
    },
    {
      id: "hostile-relationship",
      locationId: "犯罪都市",
      actionType: "talk",
      actionLabel: "警戒している情報屋に接触する",
      relationship: -35,
      primaryMood: "hostile",
      outcomeKind: "contact_established",
      outcomeSummary: "情報屋は会話には応じるが、プレイヤーを信用していない。",
    },
    {
      id: "friendly-followup",
      locationId: "辺境の村",
      actionType: "talk",
      actionLabel: "以前助けた住民に近況を聞く",
      relationship: 45,
      primaryMood: "friendly",
      outcomeKind: "friendly_conversation",
      outcomeSummary: "住民は好意的に会話へ応じる。",
    },
    {
      id: "empty-location",
      locationId: "古代神殿",
      localNpcCount: 0,
      actionType: "observe",
      actionLabel: "無人の神殿内部を観察する",
      outcomeKind: "environment_observed",
      outcomeSummary: "その場に会話可能な人物はいない。古代の設備だけが残っている。",
    },
    {
      id: "resolved-no-new-crisis",
      troubleId: "T08",
      status: "resolved",
      day: 40,
      locationId: "エルフの隠れ里",
      actionType: "confirm_resolution",
      actionLabel: "解決後の里の様子を聞く",
      outcomeKind: "resolution_confirmed",
      outcomeSummary: "問題は解決済みで、新たな危機は発生していない。",
      primaryMood: "calm",
    },
    {
      id: "mission-candidate",
      troubleId: "T06",
      status: "active",
      day: 28,
      locationId: "交易都市",
      actionType: "investigate",
      actionLabel: "港の異常について追加調査する",
      outcomeKind: "new_local_clue",
      outcomeSummary: "現地調査に値する新しい手掛かりが確認された。",
      currentStep: "港の証言を集める",
    },
  ];
  return specs.map((spec, index) => scenario(model, spec, index, runId));
}

function summarizeResult(scenarioInput, response, elapsedMs) {
  return {
    scenarioId: scenarioInput.scenarioId,
    actionId: scenarioInput.action.id,
    source: response.meta?.source ?? "unknown",
    repairCalls: Number(response.meta?.repairCalls ?? 0),
    usedFallback: Boolean(response.meta?.usedFallback),
    providerCalls: Number(response.meta?.providerCalls ?? 0),
    providerErrors: response.meta?.providerErrors ?? [],
    validationErrors: response.meta?.validationErrors ?? [],
    usageMetadata: response.meta?.usageMetadata ?? null,
    elapsedMs,
    narrative: response.narrative,
    choices: response.choices,
    speeches: response.speeches,
    proposals: response.proposals,
    proposalResolution: response.proposalResolution,
  };
}

function renderMarkdown(report) {
  const rows = report.results.map((entry) => `| ${entry.scenarioId} | ${entry.source} | ${entry.repairCalls} | ${entry.usedFallback ? "yes" : "no"} | ${entry.elapsedMs} | ${entry.choices.length} |`).join("\n");
  return `# TRPG Gemini実応答監査 v5\n\n- 実行ID: ${report.runId}\n- モデル: ${report.model}\n- シナリオ: ${report.total}\n- Gemini生成: ${report.summary.gemini}\n- 再生キャッシュ: ${report.summary.replayCache}\n- フォールバック: ${report.summary.fallback}\n- 修正再生成: ${report.summary.repaired}\n- エラー: ${report.summary.errors}\n- 平均応答時間: ${report.summary.averageElapsedMs.toFixed(1)}ms\n- Sheets同期: ${report.sheetSync.ok ? `${report.sheetSync.synced ?? 0}件` : `失敗: ${report.sheetSync.error}`}\n\n| scenario | source | repair | fallback | ms | choices |\n|---|---:|---:|---:|---:|---:|\n${rows}\n`;
}

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY が設定されていないため、実Gemini監査を開始できません。");
  process.exit(1);
}

const model = loadWorldModel();
const runId = `gemini-live-${new Date().toISOString().replace(/[:.]/gu, "-")}`;
const maxScenarios = Math.max(1, Number(process.env.TRPG_NARRATIVE_LIVE_MAX ?? 12));
const scenarios = buildLiveScenarios(model, runId).slice(0, maxScenarios);
const narrator = createTrpgNarrator();
const results = [];

for (const input of scenarios) {
  const started = Date.now();
  try {
    const response = await narrator.generate(input, {
      allowedMissionTemplateIds: ["local-rescue", "local-investigation", "local-delivery", "local-escort", "local-negotiation"],
      allowedTroubleIds: input.authoritativeState.missions.map((mission) => mission.troubleId).filter(Boolean),
    });
    results.push(summarizeResult(input, response, Date.now() - started));
  } catch (error) {
    results.push({
      scenarioId: input.scenarioId,
      actionId: input.action.id,
      source: "error",
      repairCalls: 0,
      usedFallback: false,
      providerCalls: 0,
      providerErrors: [String(error?.message ?? error)],
      validationErrors: [],
      usageMetadata: null,
      elapsedMs: Date.now() - started,
      narrative: "",
      choices: [],
      speeches: [],
      proposals: [],
      proposalResolution: { accepted: [], rejected: [] },
    });
  }
}

let sheetSync;
if (process.argv.includes("--no-sync")) {
  sheetSync = { ok: true, synced: 0, skipped: true };
} else {
  try {
    sheetSync = await syncNarrativeAuditToSheet();
  } catch (error) {
    sheetSync = { ok: false, error: String(error?.message ?? error) };
  }
}

const averageElapsedMs = results.length
  ? results.reduce((sum, entry) => sum + Number(entry.elapsedMs ?? 0), 0) / results.length
  : 0;
const report = {
  schemaVersion: "5.0.0",
  runId,
  model: narrator.model,
  promptVersion: narrator.promptVersion,
  total: results.length,
  summary: {
    gemini: results.filter((entry) => entry.source === "gemini").length,
    replayCache: results.filter((entry) => entry.source === "replay_cache").length,
    fallback: results.filter((entry) => entry.usedFallback).length,
    repaired: results.filter((entry) => entry.repairCalls > 0).length,
    errors: results.filter((entry) => entry.source === "error").length,
    averageElapsedMs,
  },
  audit: narrator.auditLog?.snapshot?.() ?? null,
  cache: narrator.cache.snapshot(),
  sheetSync,
  results,
};

const jsonPath = path.join(reportsDirectory, "gemini-live-v5-latest.json");
const markdownPath = path.join(reportsDirectory, "gemini-live-v5-latest.md");
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(markdownPath, renderMarkdown(report), "utf8");
console.log(renderMarkdown(report));
console.log(`GEMINI_LIVE_V5=${report.summary.errors === 0 ? "PASS" : "WARNING"}`);
