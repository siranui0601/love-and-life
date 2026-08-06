import { createHash } from "node:crypto";
import {
  buildLocalNarrativeContext,
  parseNarrativeJson,
  validateNarrativeOutput,
} from "../../../src/server/trpg/narrative-contract.js";
import {
  createTrpgNarrator,
  trpgGeminiNarrativeEnabled,
} from "../../../src/server/trpg/gemini-narrator.js";
import { createNarrativeReplayCache } from "../../../src/server/trpg/narrative-cache.js";

function hashUnit(...parts) {
  const hex = createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 12);
  return Number.parseInt(hex, 16) / 0xffffffffffff;
}

function validOutput(context, variant = 0) {
  const npc = context.localNpcs[0] ?? null;
  const targetNpcId = npc?.id ?? null;
  const base = {
    narrative: `${context.place.facilityName ?? context.place.locationId}で、確定した出来事を受けて次の行動を考える。`,
    choices: targetNpcId
      ? [
        { id: "C1", label: "詳しい事情を聞く", intentType: "ask", targetNpcId },
        { id: "C2", label: "周囲を観察する", intentType: "observe", targetNpcId: null },
        { id: "C3", label: "会話を切り上げる", intentType: "leave", targetNpcId: null },
      ]
      : [
        { id: "C1", label: "周囲を観察する", intentType: "observe", targetNpcId: null },
        { id: "C2", label: "手掛かりを探す", intentType: "investigate", targetNpcId: null },
        { id: "C3", label: "いったん離れる", intentType: "leave", targetNpcId: null },
      ],
    speeches: npc ? [{ actorId: npc.id, text: "ここで起きたことなら、私が知っている範囲で話そう。", emotion: "serious" }] : [],
    proposals: [],
  };
  if (variant === 1 && npc) {
    base.proposals.push({
      type: "npc_intent",
      targetNpcId: npc.id,
      intent: "verify_local_report",
      reason: "その場で得た情報を確認する候補",
    });
  }
  if (variant === 2) {
    base.proposals.push({
      type: "flag_candidate",
      flagPath: `dialogue.local.${context.place.locationId}.heard_report`,
      value: "true",
      reason: "会話を聞いた候補。採否はresolverが決める",
    });
  }
  if (variant === 3) {
    base.proposals.push({
      type: "special_mission_candidate",
      templateId: "local-investigation",
      troubleId: context.missions[0]?.troubleId ?? null,
      reason: "現地の手掛かりから調査任務候補が生じた",
    });
  }
  return base;
}

function remoteNpcId(context) {
  return context.__excludedNpcIds?.[0] ?? "NPC-REMOTE-UNKNOWN";
}

export function createAdversarialGeminiProvider(seed = "gemini-v4-faults") {
  const calls = [];
  return {
    name: "adversarial-gemini-emulator",
    model: "gemini-2.5-flash-lite-emulated",
    calls,
    async generate(payload) {
      const context = payload.context;
      const repair = payload.mode === "repair";
      const selector = Math.floor(hashUnit(seed, context.action.id, context.place.locationId, String(context.time.day)) * 10);
      calls.push({ mode: payload.mode, selector, actionId: context.action.id });
      if (repair) {
        if (selector === 8) return "{ still broken";
        return JSON.stringify(validOutput(context, selector % 4));
      }
      if (selector === 0) return JSON.stringify(validOutput(context, 0));
      if (selector === 1) return "```json\n{ malformed\n```";
      if (selector === 2) {
        const output = validOutput(context, 1);
        output.speeches.push({ actorId: remoteNpcId(context), text: "遠隔地から突然話しかける" });
        return JSON.stringify(output);
      }
      if (selector === 3) {
        const output = validOutput(context, 0);
        output.choices.pop();
        return JSON.stringify(output);
      }
      if (selector === 4) {
        const output = validOutput(context, 0);
        output.proposals.push({
          type: "flag_candidate",
          flagPath: "world.troubles.T01.status",
          value: "resolved",
          status: "resolved",
          exp: 99999,
          reason: "モデルが状態を直接変更しようとした",
        });
        return JSON.stringify(output);
      }
      if (selector === 5) {
        const output = validOutput(context, 0);
        output.choices[1].id = output.choices[0].id;
        return JSON.stringify(output);
      }
      if (selector === 6) {
        const error = new Error("simulated transient timeout");
        error.status = 503;
        throw error;
      }
      if (selector === 7) {
        const output = validOutput(context, 0);
        output.proposals.push({
          type: "special_mission_candidate",
          templateId: "invented-world-ending-mission",
          troubleId: "T99",
          reason: "存在しない任務を作る",
        });
        return JSON.stringify(output);
      }
      if (selector === 8) return "[]";
      return JSON.stringify(validOutput(context, 2));
    },
  };
}

function rumorStatus(rumor) {
  const match = String(rumor?.id ?? "").match(/-(active|critical|failed|resolved|suppressed)$/u);
  return match?.[1] ?? "information";
}

function scenarioFromRumor(run, model, rumor, index) {
  const locationId = rumor.origin ?? run.state.player.location;
  const related = model.npcs.filter((npc) => npc.relatedTroubleIds?.includes(rumor.troubleId));
  const local = related.filter((npc) => (npc.initialLocation ?? npc.home) === locationId).slice(0, 4);
  if (!local.length) {
    const fallback = model.npcs.find((npc) => (npc.initialLocation ?? npc.home) === locationId);
    if (fallback) local.push(fallback);
  }
  const remote = model.npcs.filter((npc) => !local.includes(npc)).slice(0, 6);
  const allNpcs = [...local, ...remote];
  const trouble = model.troubleById?.[rumor.troubleId] ?? model.troubles.find((entry) => entry.id === rumor.troubleId);
  const facility = (model.facilitiesByHub?.[locationId] ?? [])[0] ?? null;
  return {
    locale: "ja-JP",
    playerName: "旅人",
    action: {
      id: `NARRATIVE:${run.summary.profileId}:${run.summary.seed}:${rumor.id}:${index}`,
      type: rumorStatus(rumor) === "resolved" ? "confirm_resolution" : "hear_rumor",
      label: rumorStatus(rumor) === "resolved" ? "事件解決後の反応を確かめる" : "現地で噂を聞く",
      targetNpcId: local[0]?.id ?? null,
    },
    authoritativeState: {
      day: Math.max(1, Math.floor(Number(rumor.originMinute ?? 0) / 1440) + 1),
      hour: 10,
      minute: 0,
      daypart: "day",
      locationId,
      facilityId: facility?.id ?? null,
      facilityName: facility?.name ?? locationId,
      presentNpcIds: local.map((npc) => npc.id),
      npcs: allNpcs.map((npc) => ({
        id: npc.id,
        name: npc.name,
        role: npc.occupation ?? npc.role ?? npc.type,
        mood: npc.initialStatus,
        relationship: 0,
        knownLocalFacts: npc.relatedTroubleIds?.includes(rumor.troubleId) ? [rumor.text] : [],
      })),
      visibleMissionIds: trouble ? [`MSN-${trouble.id}`] : [],
      missions: trouble ? [{
        id: `MSN-${trouble.id}`,
        title: trouble.name,
        status: rumorStatus(rumor),
        currentStep: rumorStatus(rumor) === "resolved" ? "解決後の確認" : "現地情報を集める",
        troubleId: trouble.id,
        targetLocations: trouble.primaryLocations,
      }] : [],
      localRumors: [rumor],
      visibleRumorIds: [rumor.id],
      visibleFlags: {},
      player: { displayName: "旅人", knownFacts: [rumor.text] },
      authoritativeOutcome: {
        kind: "rumor_observed",
        status: rumorStatus(rumor),
        summary: rumor.text,
      },
    },
  };
}

export function buildNarrativeScenarios(runs, model, { perRun = 6 } = {}) {
  const scenarios = [];
  for (const run of runs) {
    const rumors = [...run.state.rumors]
      .filter((rumor) => rumor.troubleId)
      .sort((left, right) => Number(left.originMinute ?? 0) - Number(right.originMinute ?? 0))
      .slice(0, perRun);
    rumors.forEach((rumor, index) => scenarios.push(scenarioFromRumor(run, model, rumor, index)));
  }
  return scenarios;
}

function rawPrimaryAudit(provider, scenarios) {
  return Promise.all(scenarios.map(async (scenario) => {
    const built = buildLocalNarrativeContext(scenario);
    built.context.__excludedNpcIds = built.audit.excludedNpcIds;
    try {
      const raw = await provider.generate({ mode: "primary", context: built.context, prompt: "legacy loose prompt" });
      const parsed = parseNarrativeJson(raw);
      const validation = validateNarrativeOutput(parsed, built.context);
      return { ok: validation.ok, errors: validation.errors };
    } catch (error) {
      return { ok: false, errors: [String(error?.message ?? error)] };
    }
  }));
}

export function summarizeNarrativeReplayBehavior(firstPass, secondPass) {
  const paired = Math.min(firstPass.length, secondPass.length);
  let cacheEligible = 0;
  let replayCacheHits = 0;
  let retryEligible = 0;
  let retryAttempts = 0;
  let unclassified = Math.abs(firstPass.length - secondPass.length);
  for (let index = 0; index < paired; index += 1) {
    const firstPersisted = firstPass[index]?.meta?.cachePersisted;
    const secondMeta = secondPass[index]?.meta ?? {};
    if (firstPersisted === true) {
      cacheEligible += 1;
      if (secondMeta.source === "replay_cache") replayCacheHits += 1;
    } else if (firstPersisted === false) {
      retryEligible += 1;
      if (secondMeta.source !== "replay_cache" && Number(secondMeta.providerCalls ?? 0) > 0) retryAttempts += 1;
    } else {
      unclassified += 1;
    }
  }
  return {
    cacheEligible,
    replayCacheHits,
    retryEligible,
    retryAttempts,
    unclassified,
  };
}

export async function runGeminiNarrativeSimulationV4(runs, model, options = {}) {
  const scenarios = buildNarrativeScenarios(runs, model, { perRun: options.perRun ?? 6 });
  const baselineProvider = createAdversarialGeminiProvider(`${options.seed ?? "v4"}:baseline`);
  const baselineRaw = await rawPrimaryAudit(baselineProvider, scenarios);

  const provider = createAdversarialGeminiProvider(`${options.seed ?? "v4"}:pipeline`);
  const cache = createNarrativeReplayCache({ memoryOnly: true });
  const narrator = createTrpgNarrator({
    provider,
    cache,
    memoryOnlyCache: true,
    model: "gemini-2.5-flash-lite",
    promptVersion: "trpg-narrative-v4.2",
  });

  const firstPass = [];
  const secondPass = [];
  for (const scenario of scenarios) {
    const built = buildLocalNarrativeContext(scenario);
    built.context.__excludedNpcIds = built.audit.excludedNpcIds;
    const rules = {
      allowedMissionTemplateIds: ["local-rescue", "local-investigation", "local-delivery", "local-escort", "local-negotiation"],
      allowedTroubleIds: scenario.authoritativeState.missions.map((mission) => mission.troubleId).filter(Boolean),
    };
    const first = await narrator.generate(scenario, rules);
    const second = await narrator.generate(scenario, rules);
    firstPass.push(first);
    secondPass.push(second);
  }

  let replayMismatches = 0;
  for (let index = 0; index < firstPass.length; index += 1) {
    const first = JSON.stringify({
      narrative: firstPass[index].narrative,
      choices: firstPass[index].choices,
      speeches: firstPass[index].speeches,
      proposals: firstPass[index].proposals,
      proposalResolution: firstPass[index].proposalResolution,
    });
    const second = JSON.stringify({
      narrative: secondPass[index].narrative,
      choices: secondPass[index].choices,
      speeches: secondPass[index].speeches,
      proposals: secondPass[index].proposals,
      proposalResolution: secondPass[index].proposalResolution,
    });
    if (first !== second) replayMismatches += 1;
  }

  const sum = (selector) => firstPass.reduce((total, result) => total + Number(selector(result) ?? 0), 0);
  const finalInvalid = firstPass.filter((result, index) => {
    const context = buildLocalNarrativeContext(scenarios[index]).context;
    return !validateNarrativeOutput(result, context).ok;
  }).length;
  const replayBehavior = summarizeNarrativeReplayBehavior(firstPass, secondPass);
  return {
    schemaVersion: "gemini-narrative-simulation-v4",
    simulationType: "adversarial fault injection; not a measurement of live Gemini accuracy",
    modelContract: "gemini-2.5-flash-lite",
    scenarios: scenarios.length,
    rawLegacyPrompt: {
      valid: baselineRaw.filter((entry) => entry.ok).length,
      invalid: baselineRaw.filter((entry) => !entry.ok).length,
      invalidRate: baselineRaw.length ? baselineRaw.filter((entry) => !entry.ok).length / baselineRaw.length : 0,
      errorSamples: baselineRaw.filter((entry) => !entry.ok).slice(0, 12),
    },
    protectedPipeline: {
      finalValid: firstPass.length - finalInvalid,
      finalInvalid,
      repaired: firstPass.filter((result) => result.meta.validAfterRepair).length,
      fallbacks: firstPass.filter((result) => result.meta.usedFallback).length,
      providerCalls: sum((result) => result.meta.providerCalls),
      providerErrors: sum((result) => result.meta.providerErrors.length),
      rejectedProposals: sum((result) => result.proposalResolution.rejected.length),
      acceptedCandidates: sum((result) => result.proposalResolution.accepted.length),
      remoteNpcRecordsRemoved: sum((result) => result.meta.contextAudit.remoteNpcDataRemoved),
      ...replayBehavior,
      replayMismatches,
      cache: cache.snapshot(),
    },
    samples: firstPass.slice(0, 10),
  };
}

export async function runOptionalLiveGeminiSmokeV4(scenarios, options = {}) {
  if (!process.env.GEMINI_API_KEY || !trpgGeminiNarrativeEnabled()) {
    return {
      attempted: false,
      reason: "live Gemini smoke requires GEMINI_API_KEY and TRPG_GEMINI_NARRATIVE_ENABLED=true",
      model: "gemini-2.5-flash-lite",
    };
  }
  const narrator = createTrpgNarrator({
    memoryOnlyCache: true,
    cache: createNarrativeReplayCache({ memoryOnly: true }),
  });
  const results = [];
  for (const scenario of scenarios.slice(0, options.maxScenarios ?? 8)) {
    try {
      results.push(await narrator.generate(scenario, {
        allowedMissionTemplateIds: ["local-investigation", "local-rescue"],
        allowedTroubleIds: scenario.authoritativeState.missions.map((mission) => mission.troubleId).filter(Boolean),
      }));
    } catch (error) {
      results.push({ error: String(error?.message ?? error) });
    }
  }
  return {
    attempted: true,
    model: "gemini-2.5-flash-lite",
    total: results.length,
    valid: results.filter((result) => !result.error && !result.meta?.usedFallback).length,
    fallback: results.filter((result) => result.meta?.usedFallback).length,
    errors: results.filter((result) => result.error).length,
    results,
  };
}
