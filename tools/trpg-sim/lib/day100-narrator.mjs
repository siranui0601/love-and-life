import { createTrpgNarrator } from "../../../src/server/trpg/gemini-narrator.js";
import {
  buildLocalNarrativeContext,
  deterministicNarrativeFallback,
  resolveNarrativeProposals,
} from "../../../src/server/trpg/narrative-contract.js";
import {
  meaningfulNarrativeScene,
  observeNarrativeExperience,
} from "./day100-experience-audit.mjs";

const ROUTINE_ACTION_TYPES = new Set(["eat", "rest", "wait", "work", "plan"]);
const LIVE_VALID_SOURCES = new Set(["gemini", "gemini_repaired", "approved_replay", "replay_cache"]);
const OFFLINE_REVIEWED_SOURCES = new Set(["approved_replay"]);

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function enabled(value) {
  return /^(?:1|true|yes|on)$/iu.test(String(value ?? "").trim());
}

function candidateChoice(candidate) {
  return {
    id: candidate.id,
    label: candidate.label,
    intentType: candidate.intentType,
    targetNpcId: candidate.targetNpcId ?? null,
  };
}

function routineChoices(context) {
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

export function isRoutineServerScene(input) {
  return input?.sceneMode === "free_roam"
    && !input?.action?.missionId
    && ROUTINE_ACTION_TYPES.has(input?.action?.type);
}

function routineServerNarrative(input, rules = {}) {
  const { context } = buildLocalNarrativeContext(input);
  const fallback = deterministicNarrativeFallback(context, "day100_routine_server_template");
  const choices = routineChoices(context);
  const response = {
    ...fallback,
    choices: choices.length === 3 ? choices : fallback.choices,
    proposalResolution: { accepted: [], rejected: [] },
    meta: {
      source: "routine_server_template",
      providerCalls: 0,
      repairCalls: 0,
      validationErrors: [],
      partialOutputUsed: false,
      promptVersion: "day100-routine-server-template-v1",
    },
  };
  response.proposalResolution = resolveNarrativeProposals(response, context, rules);
  return response;
}

function narrativeBudgetFallback(input, rules = {}) {
  const { context } = buildLocalNarrativeContext(input);
  const response = deterministicNarrativeFallback(context, "day100_narrative_budget_exhausted");
  response.proposalResolution = resolveNarrativeProposals(response, context, rules);
  response.meta = {
    ...(response.meta ?? {}),
    source: "narrative_budget_fallback",
    providerCalls: 0,
    repairCalls: 0,
    validationErrors: [],
    partialOutputUsed: false,
    usedFallback: true,
  };
  return response;
}

export function createDay100Narrator({
  auditFilePath,
  maxNarrativeCalls = 600,
  experienceAudit,
  provider,
  cache,
  approvedCache,
  offlineAuthoring = enabled(process.env.TRPG_DAY100_OFFLINE_AUTHORING),
} = {}) {
  const resolvedProvider = provider === undefined && offlineAuthoring ? false : provider;
  const live = createTrpgNarrator({
    auditFilePath,
    memoryOnlyAudit: false,
    memoryOnlyCache: cache ? undefined : true,
    ...(resolvedProvider !== undefined ? { provider: resolvedProvider } : {}),
    ...(cache ? { cache } : {}),
    ...(approvedCache ? { approvedCache } : {}),
  });
  const stats = {
    maxNarrativeCalls: Math.max(1, number(maxNarrativeCalls, 600)),
    offlineAuthoring,
    liveCalls: 0,
    routineTemplates: 0,
    budgetFallbacks: 0,
    meaningfulFallbacks: 0,
    sourceCounts: {},
  };
  return {
    stats,
    async generate(input, rules = {}) {
      let response;
      if (isRoutineServerScene(input)) {
        stats.routineTemplates += 1;
        response = routineServerNarrative(input, rules);
      } else {
        if (stats.liveCalls >= stats.maxNarrativeCalls) {
          stats.budgetFallbacks += 1;
          response = narrativeBudgetFallback(input, rules);
        } else {
          stats.liveCalls += 1;
          response = await live.generate(input, rules);
        }
      }
      const source = response?.meta?.source ?? "unknown";
      stats.sourceCounts[source] = number(stats.sourceCounts[source]) + 1;
      const acceptedSources = offlineAuthoring ? OFFLINE_REVIEWED_SOURCES : LIVE_VALID_SOURCES;
      const meaningful = meaningfulNarrativeScene(input);
      const invalidMeaningfulSource = !acceptedSources.has(source)
        || response?.meta?.usedFallback === true
        || response?.meta?.partialOutputUsed === true;
      if (meaningful && invalidMeaningfulSource) {
        stats.meaningfulFallbacks += 1;
        if (offlineAuthoring) {
          response = {
            ...response,
            meta: {
              ...(response?.meta ?? {}),
              source: "offline_unapproved",
              originalSource: source,
            },
          };
        }
      }
      if (experienceAudit) observeNarrativeExperience(experienceAudit, input, response);
      return response;
    },
  };
}
