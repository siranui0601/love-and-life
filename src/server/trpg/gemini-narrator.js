import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../../foundation/env.js";
import {
  GEMINI_NARRATIVE_RESPONSE_SCHEMA,
  TRPG_NARRATIVE_MODEL,
  TRPG_NARRATIVE_PROMPT_VERSION,
  buildLocalNarrativeContext,
  deterministicNarrativeFallback,
  mergeNarrativeOutputs,
  narrativeReplayKey,
  parseNarrativeJson,
  resolveNarrativeProposals,
  sanitizeNarrativeOutput,
  stableStringify,
  validateNarrativeOutput,
} from "./narrative-contract.js";
import { createNarrativeReplayCache } from "./narrative-cache.js";
import { createApprovedNarrativeReplayCache } from "./approved-narrative-replays.js";
import {
  createNarrativeAuditLog,
  createNarrativeAuditRecord,
} from "./narrative-audit.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CACHE_PATH = path.resolve(HERE, "../../../runtime-data/TRPG/narrative-cache.jsonl");
const DEFAULT_APPROVED_REPLAY_PATH = path.resolve(HERE, "content/approved-narrative-replays.json");
export function boundedNarrativeRequestTimeout(value, fallback = 18_000) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(3_000, Math.min(25_000, parsed)) : fallback;
}

const NARRATIVE_REQUEST_TIMEOUT_MS = boundedNarrativeRequestTimeout(process.env.TRPG_NARRATIVE_REQUEST_TIMEOUT_MS);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function transient(error) {
  const status = Number(error?.status ?? error?.response?.status ?? 0);
  const message = String(error?.message ?? "");
  return [408, 429, 500, 502, 503, 504].includes(status)
    || /timeout|temporar|quota|resource exhausted|unavailable|internal|deadline/iu.test(message);
}

function schemaError(error) {
  const status = Number(error?.status ?? error?.response?.status ?? 0);
  return status === 400 && /schema|generationconfig|responsemime|invalid argument/iu.test(String(error?.message ?? ""));
}

function normalizeProviderResult(result) {
  if (typeof result === "string") return { text: result, usageMetadata: null };
  if (result && typeof result.text === "string") {
    return { text: result.text, usageMetadata: result.usageMetadata ?? null };
  }
  return { text: String(result ?? ""), usageMetadata: null };
}

function mergeUsageMetadata(current, next) {
  if (!next) return current ?? null;
  if (!current) return { ...next };
  const merged = { ...current };
  for (const [key, value] of Object.entries(next)) {
    if (Number.isFinite(Number(value))) merged[key] = Number(merged[key] ?? 0) + Number(value);
    else if (value !== undefined) merged[key] = value;
  }
  return merged;
}

async function writeAuditSafely(auditLog, payload) {
  if (!auditLog) return;
  try {
    await auditLog.record(payload);
  } catch (error) {
    console.error("TRPG narrative audit record failed", error);
  }
}

function sceneSpecificRules(context) {
  const rules = [];
  if (context.sceneMode === "conversation") {
    rules.push("対象NPCはplayerUtteranceへ直接答え、プロフィール・知っている事実・現在の感情から自然に返す");
    rules.push("会話を同じ言い換えで停滞させず、新情報・感情の変化・次の具体的な糸口のどれかを一つ加える");
  }
  if (context.sceneMode === "exploration") {
    rules.push("authoritativeOutcomeや発見済み情報を具体的な感覚・痕跡として描き、同じ発見を繰り返さない");
  }
  if (context.sceneMode === "battle_aftermath") {
    rules.push("戦闘結果を変更せず、その場にいる当事者の負傷・安堵・恐怖・次の目的への反応を描く");
  }
  if (context.sceneMode === "arrival") {
    rules.push("到着先の公開情報と同席人物だけを使い、到着によって自然に起きる最初の反応を描く");
  }
  const hasWorkCandidate = (context.allowedActionCandidates ?? []).some((candidate) => candidate.workOffer === true);
  if (context.sceneMode === "work_generation" || hasWorkCandidate) {
    rules.push("workOffer=trueの候補を選ぶ場合はworkProposalを付け、現在地・時刻・人物・localDemandTagsに合う具体的な仕事を一件作る");
    rules.push("workProposalでは賃金額を決めない。title、durationClass、riskClassだけを返し、金額はサーバーに任せる");
    if (context.workMarket?.recentWorkTitles?.length) {
      rules.push(`直近に行った仕事と同じ内容を繰り返さない: ${context.workMarket.recentWorkTitles.join(" / ")}`);
    }
  }
  if (context.action.requiredDisclosure) {
    rules.push(`対象NPCの発言に次の確定情報を意味を変えず含める: ${context.action.requiredDisclosure}`);
  }
  if (context.action.firstIntroduction && context.action.introductionName) {
    rules.push(`対象NPCは最初の発言で「${context.action.introductionName}」と自然に名乗る。地の文や選択肢では先に名前を明かさない`);
  }
  // T01固有の要件は、その場面に到達した時だけ加える。別の土地や後続章のプロンプトへ持ち越さない。
  if (context.action.dialogueTopic === "t01_escort") {
    rules.push("この場面では、負傷した本人が一人で歩けない事情と村へ戻りたい希望を、自分の言葉で同行者へ伝える");
  }
  if (context.action.dialogueTopic === "t01_rescue_aftermath") {
    rules.push("この場面では、狼から救われた負傷者本人が名乗り、助かった安堵と一人で歩けない状態を旅人へ伝える");
  }
  if (context.action.dialogueTopic === "t01_reunion") {
    rules.push("この場面では、帰還した本人、迎えた家族、村の責任者が、到着直後の再会と感謝をそれぞれの立場から交わす");
  }
  if (context.continuityContract?.mode === "must_offer_continuation") {
    rules.push(`プレイヤーが続けようとしている「${context.continuityContract.intent ?? "直前の活動"}」を継続できる候補を一件含める`);
  }
  if (context.reactionContract?.requiredActorIds?.length) {
    rules.push(`次の人物はこの場面の当事者なので、無言記号だけではなく短くても意味のある発言を一つずつ返す: ${context.reactionContract.requiredActorIds.join(", ")}`);
  }
  for (const goal of context.reactionContract?.goals ?? []) rules.push(`当事者反応の要点: ${goal}`);
  return rules;
}

export function buildNarrativePrompt(context, { repair = null, policy = {} } = {}) {
  const modeRules = sceneSpecificRules(context);
  const allowedMissionTemplateIds = [...(policy.allowedMissionTemplateIds ?? [])];
  const allowedTroubleIds = [...(policy.allowedTroubleIds ?? [])];
  const core = `あなたはTRPGの場面監督です。サーバーが示す現実の範囲内で、場面描写、会話、次の三つの行動、必要なら世界状態の提案を生成してください。

共通規則:
1. authoritativeOutcome、現在地、時刻、人物の生死・所在、所持品、戦闘結果を変更しない。
2. 発言・感情・行動を描ける人物はlocalNpcsだけ。知らない秘密や遠隔人物の現在を作らない。
3. choicesはallowedActionCandidatesから異なる3件を選び、id・intentType・targetNpcIdを候補どおり使う。labelとapproachは場面に合わせて具体化してよい。
4. progressContract.modeがmust_offer_progressならanchorCandidateIdsから一件、continuityContract.modeがmust_offer_continuationならcandidateIdsから一件を含める。同じ候補が両方を満たしてもよい。
5. proposalsは任意の候補であり、確信がなければ空配列にする。重大な報酬、生死、事件解決、所持品変更を提案で決めない。
6. local_fact_candidateはsubjectId・predicate・summary、npc_memory_candidateはsubjectId・predicate・summary、mission_lead_candidateはtroubleId・summaryを必ず含める。欠けるならその提案を出さない。
7. narrativeとspeechesは世界内の表現だけにし、ゲーム、UI、選択肢、フラグ等の実装語やNPC/LOC/SKL等の内部IDを表示文へ書かない。
8. オレゴンは旅人を指す固定別名である。別名の由来を説明せず、必要な場合だけ自然に呼ぶ。
9. 「……」だけの発言は作らない。言葉がない人物はspeechesへ含めず、沈黙はnarrativeで描く。
10. JSON以外を出力しない。

今回の場面規則:
${modeRules.length ? modeRules.map((rule) => `- ${rule}`).join("\n") : "- 現在地で具体的に見聞きできる変化を一つ描く"}

提案可能範囲:
- 許可ミッションテンプレート: ${allowedMissionTemplateIds.join(", ") || "なし"}
- 許可troubleId: ${allowedTroubleIds.join(", ") || "なし"}
- local_fact_candidate、npc_memory_candidate、mission_lead_candidateは意味的な候補として返し、内部フラグ名を無理に発明しない。
- 提案の構造に自信がなければproposalsは[]にする。会話・描写・三つの行動の品質を優先する。

入力JSON:
${stableStringify(context)}`;
  if (!repair) return core;
  return `${core}

前回の使用可能な部分は残し、次の不備がある部品だけ直してください。JSON全体を返してください。
不備:
${repair.errors.map((entry) => `- ${entry}`).join("\n")}
前回の整形済み出力:
${stableStringify(repair.previous ?? {}).slice(0, 6000)}`;
}

function requestTimedOut(error) {
  return /abort|timeout|deadline/iu.test(`${error?.name ?? ""} ${error?.message ?? ""}`);
}

function normalizeNarrativePolicy(rules = {}, context = {}) {
  const sortedUnique = (values) => [...new Set((values ?? []).filter(Boolean).map(String))].sort();
  return {
    version: String(rules.policyVersion ?? "trpg-narrative-policy-v1").slice(0, 80),
    allowedMissionTemplateIds: sortedUnique(rules.allowedMissionTemplateIds),
    allowedTroubleIds: sortedUnique(
      rules.allowedTroubleIds
        ?? context.missions?.map((mission) => mission.troubleId).filter(Boolean)
        ?? [],
    ),
  };
}

export function geminiNarrativeGenerationConfig({ model = TRPG_NARRATIVE_MODEL, useSchema = true } = {}) {
  const isGemini25Flash = /^gemini-2\.5-flash(?:$|-)/u.test(String(model));
  return {
    temperature: 0.35,
    topP: 0.9,
    maxOutputTokens: 2_048,
    responseMimeType: "application/json",
    // Gemini 2.5 Flash otherwise spends the shared output allowance on
    // internal thinking and can truncate a small JSON response mid-string.
    // This task is bounded JSON rendering, so reserve the allowance for the
    // player-visible answer. Other model families keep their native setting.
    ...(isGemini25Flash ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    ...(useSchema ? { responseSchema: GEMINI_NARRATIVE_RESPONSE_SCHEMA } : {}),
  };
}

export function createGoogleGeminiProvider({ apiKey = GEMINI_API_KEY, model = TRPG_NARRATIVE_MODEL } = {}) {
  if (!apiKey) return null;
  const client = new GoogleGenerativeAI(apiKey);
  return {
    name: "google-gemini",
    model,
    async generate({ prompt, useSchema = true }) {
      const generationConfig = geminiNarrativeGenerationConfig({ model, useSchema });
      const instance = client.getGenerativeModel({ model, generationConfig });
      try {
        const result = await instance.generateContent(prompt, { timeout: NARRATIVE_REQUEST_TIMEOUT_MS });
        return {
          text: result.response.text(),
          usageMetadata: result.response.usageMetadata ?? null,
        };
      } catch (error) {
        if (useSchema && schemaError(error)) {
          const compatible = client.getGenerativeModel({
            model,
            generationConfig: { ...generationConfig, responseSchema: undefined },
          });
          const result = await compatible.generateContent(prompt, { timeout: NARRATIVE_REQUEST_TIMEOUT_MS });
          return {
            text: result.response.text(),
            usageMetadata: result.response.usageMetadata ?? null,
          };
        }
        throw error;
      }
    },
  };
}

async function callProvider(provider, payload, audit) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      audit.providerCalls += 1;
      return await provider.generate(payload);
    } catch (error) {
      lastError = error;
      audit.providerErrors.push({
        attempt: attempt + 1,
        status: error?.status ?? null,
        message: String(error?.message ?? error).slice(0, 300),
      });
      // A timed-out request already consumed the full latency budget. Retrying
      // it here would hold the save lock long enough for the browser to abort.
      if (requestTimedOut(error) || !transient(error) || attempt === 1) break;
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastError;
}

function componentRepairErrors(rawValidation, sanitizedValidation) {
  // Optional proposal mistakes are normalized or discarded locally. A second
  // model call is reserved for player-visible or progression-critical parts.
  const structuralPattern = /(?:json_parse|choices must contain|choice ids are duplicated|id is not in the executable candidate pool|workProposal|progress anchor|active player-intent continuation|conversation must include a reply|required reaction actor missing|narrative is empty)/iu;
  return [...new Set([
    ...(sanitizedValidation?.errors ?? []).filter((error) => structuralPattern.test(error)),
    ...(rawValidation?.errors ?? []).filter((error) => structuralPattern.test(error)),
  ])];
}

export function createTrpgNarrator(options = {}) {
  const model = options.model ?? TRPG_NARRATIVE_MODEL;
  const promptVersion = options.promptVersion ?? TRPG_NARRATIVE_PROMPT_VERSION;
  const provider = options.provider === undefined ? createGoogleGeminiProvider({ model }) : options.provider;
  const cache = options.cache ?? createNarrativeReplayCache({
    filePath: options.cacheFilePath ?? process.env.TRPG_NARRATIVE_CACHE_FILE ?? DEFAULT_CACHE_PATH,
    memoryOnly: options.memoryOnlyCache ?? false,
  });
  const approvedCache = options.approvedCache === false
    ? null
    : options.approvedCache ?? createApprovedNarrativeReplayCache({
      filePath: options.approvedReplayFilePath
        ?? process.env.TRPG_APPROVED_NARRATIVE_REPLAY_FILE
        ?? DEFAULT_APPROVED_REPLAY_PATH,
    });
  const auditLog = options.auditLog === false
    ? null
    : options.auditLog ?? createNarrativeAuditLog({
      filePath: options.auditFilePath,
      memoryOnly: options.memoryOnlyAudit ?? options.memoryOnlyCache ?? false,
    });
  const inFlight = new Map();

  return {
    model,
    promptVersion,
    cache,
    approvedCache,
    auditLog,
    async generate(input, resolverRules = {}) {
      const startedAt = Date.now();
      const { context, audit: contextAudit } = buildLocalNarrativeContext(input);
      const policy = normalizeNarrativePolicy(resolverRules, context);
      const key = narrativeReplayKey(context, { model, promptVersion, policy });
      const approved = approvedCache?.get(key);
      if (approved) {
        const response = {
          ...approved.response,
          proposalResolution: resolveNarrativeProposals(approved.response, context, resolverRules),
          meta: {
            ...(approved.response.meta ?? {}),
            source: "approved_replay",
            cacheKey: key,
            model,
            promptVersion,
            providerCalls: 0,
            repairCalls: 0,
            providerErrors: [],
            validationErrors: [],
            usageMetadata: null,
            contextAudit,
            policy,
            usedFallback: false,
            partialOutputUsed: false,
            cachePersisted: true,
            approvedMetadata: approved.metadata ?? {},
            approvedAt: approved.approvedAt ?? null,
          },
        };
        await writeAuditSafely(auditLog, createNarrativeAuditRecord({
          input,
          context,
          response,
          startedAt,
          finishedAt: Date.now(),
        }));
        return response;
      }
      const cached = cache.get(key);
      if (cached) {
        const response = {
          ...cached.response,
          proposalResolution: resolveNarrativeProposals(cached.response, context, resolverRules),
          meta: {
            ...cached.response.meta,
            source: "replay_cache",
            cacheKey: key,
            providerCalls: 0,
            contextAudit,
            policy,
          },
        };
        await writeAuditSafely(auditLog, createNarrativeAuditRecord({
          input,
          context,
          response,
          startedAt,
          finishedAt: Date.now(),
        }));
        return response;
      }

      const pending = inFlight.get(key);
      if (pending) {
        const shared = await pending;
        const response = {
          ...shared,
          proposalResolution: resolveNarrativeProposals(shared, context, resolverRules),
          meta: {
            ...shared.meta,
            source: "replay_cache",
            cacheKey: key,
            providerCalls: 0,
            contextAudit,
            policy,
          },
        };
        await writeAuditSafely(auditLog, createNarrativeAuditRecord({
          input,
          context,
          response,
          startedAt,
          finishedAt: Date.now(),
        }));
        return response;
      }

      let resolvePending;
      let rejectPending;
      const pendingGeneration = new Promise((resolve, reject) => {
        resolvePending = resolve;
        rejectPending = reject;
      });
      pendingGeneration.catch(() => {});
      inFlight.set(key, pendingGeneration);

      try {

      const audit = {
        source: provider ? "gemini" : "deterministic_fallback",
        cacheKey: key,
        model,
        promptVersion,
        providerCalls: 0,
        repairCalls: 0,
        providerErrors: [],
        validationErrors: [],
        usageMetadata: null,
        contextAudit,
        policy,
      };

      let raw = null;
      let rawPrimary = "";
      let rawFinal = "";
      let parsed = null;
      let output = null;
      let validation = null;
      let providerProducedContent = false;
      if (provider) {
        try {
          const primaryResult = normalizeProviderResult(await callProvider(provider, {
            prompt: buildNarrativePrompt(context, { policy }),
            useSchema: true,
            mode: "primary",
            context,
          }, audit));
          raw = primaryResult.text;
          rawPrimary = raw;
          rawFinal = raw;
          audit.usageMetadata = mergeUsageMetadata(audit.usageMetadata, primaryResult.usageMetadata);
          let repairErrors = [];
          try {
            parsed = parseNarrativeJson(raw);
            providerProducedContent = Boolean(parsed && typeof parsed === "object");
            const rawValidation = validateNarrativeOutput(parsed, context);
            output = sanitizeNarrativeOutput(parsed, context);
            validation = validateNarrativeOutput(output, context);
            repairErrors = componentRepairErrors(rawValidation, validation);
          } catch (error) {
            validation = { ok: false, errors: [`json_parse: ${String(error?.message ?? error)}`] };
            repairErrors = [...validation.errors];
          }
          if (repairErrors.length) {
            audit.validationErrors.push(...repairErrors);
            audit.repairCalls += 1;
            const previous = output ?? sanitizeNarrativeOutput(parsed ?? {}, context);
            const repairedResult = normalizeProviderResult(await callProvider(provider, {
              prompt: buildNarrativePrompt(context, { repair: { errors: repairErrors, previous }, policy }),
              useSchema: true,
              mode: "repair",
              context,
              previousRaw: raw,
              validationErrors: validation.errors,
            }, audit));
            raw = repairedResult.text;
            rawFinal = raw;
            audit.usageMetadata = mergeUsageMetadata(audit.usageMetadata, repairedResult.usageMetadata);
            try {
              const repaired = parseNarrativeJson(raw);
              providerProducedContent = true;
              output = mergeNarrativeOutputs(previous, repaired, context);
              validation = validateNarrativeOutput(output, context);
            } catch (error) {
              output = previous;
              validation = { ok: false, errors: [`repair_json_parse: ${String(error?.message ?? error)}`] };
            }
            if (!validation.ok) audit.validationErrors.push(...validation.errors);
          }
        } catch (error) {
          audit.providerErrors.push({ stage: "final", message: String(error?.message ?? error).slice(0, 300) });
        }
      }

      if (!output) {
        output = providerProducedContent
          ? sanitizeNarrativeOutput(parsed ?? {}, context)
          : deterministicNarrativeFallback(context, provider ? "provider_unavailable" : "gemini_key_missing");
      }
      const proposalResolution = resolveNarrativeProposals(output, context, resolverRules);
      const source = !providerProducedContent
        ? "deterministic_fallback"
        : validation?.ok
          ? audit.repairCalls ? "gemini_repaired" : "gemini"
          : "gemini_partial";
      const response = {
        narrative: output.narrative,
        choices: output.choices,
        speeches: output.speeches,
        proposals: output.proposals,
        proposalResolution,
        meta: {
          ...audit,
          source,
          validAfterRepair: Boolean(validation?.ok && audit.repairCalls),
          usedFallback: !providerProducedContent,
          partialOutputUsed: Boolean(providerProducedContent && !validation?.ok),
        },
      };
      // Only fully validated model output is shared across future saves. A
      // partial response is useful for the current turn, but must be regenerated
      // next time so one weak scene never becomes a permanent cache entry.
      const cachePersisted = Boolean(validation?.ok || !provider);
      response.meta.cachePersisted = cachePersisted;
      if (cachePersisted) {
        await cache.set(key, response, {
          model,
          promptVersion,
          contextHash: key,
          policy,
        });
      }
      await writeAuditSafely(auditLog, createNarrativeAuditRecord({
        input,
        context,
        response,
        rawPrimary,
        rawFinal,
        startedAt,
        finishedAt: Date.now(),
      }));
      resolvePending(response);
      return response;
      } catch (error) {
        rejectPending(error);
        throw error;
      } finally {
        if (inFlight.get(key) === pendingGeneration) inFlight.delete(key);
      }
    },
  };
}
