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
  narrativeReplayKey,
  parseNarrativeJson,
  resolveNarrativeProposals,
  sanitizeNarrativeOutput,
  stableStringify,
  validateNarrativeOutput,
} from "./narrative-contract.js";
import { createNarrativeReplayCache } from "./narrative-cache.js";
import {
  createNarrativeAuditLog,
  createNarrativeAuditRecord,
} from "./narrative-audit.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CACHE_PATH = path.resolve(HERE, "../../../runtime-data/TRPG/narrative-cache.jsonl");
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

export function buildNarrativePrompt(context, { repair = null, policy = {} } = {}) {
  const present = context.localNpcs.map((npc) => `${npc.id}:${npc.name}`).join(", ") || "なし";
  const allowedMissionTemplateIds = [...(policy.allowedMissionTemplateIds ?? [])];
  const allowedTroubleIds = [...(policy.allowedTroubleIds ?? [])];
  const exampleTemplateId = allowedMissionTemplateIds.includes("local-investigation")
    ? "local-investigation"
    : allowedMissionTemplateIds[0] ?? "local-investigation";
  const exampleTroubleId = allowedTroubleIds[0] ?? "T13";
  const core = `あなたはTRPG（仮題）の表示文章生成器です。ゲーム状態を決定する権限はありません。

絶対規則:
1. authoritativeOutcomeはサーバーが確定した事実であり、変更・否定・追加しない。
2. 会話・発言・NPC intent候補は、現在同じ施設または同じ場にいるlocalNpcsだけを対象にする。
3. localNpcsにないNPCの現在行動、感情、移動、発言を推測しない。遠隔NPCを動かさない。
4. EXP、所持金、レベル、スキル、HP、MP、装備、所持品、事件status、world flagを直接変更しない。
5. proposalsは候補にすぎない。特別ミッションやフラグは、サーバーresolverが採否を決める。
6. choicesは必ず3件。移動先一覧は別UIなので、移動を強制する選択肢だけで埋めない。
7. 同じ入力では再利用できるよう、余計なランダム設定や未提示の固有名詞を作らない。
8. JSON以外を出力しない。
9. 普通に立ち去る、待つ、会話を終えるだけならflag_candidateを提案しない。
10. allowedActionCandidatesが3件ある場合、choicesのidはその3件と完全一致させ、別IDを作らない。
11. npc_intentには、その場にいるtargetNpcIdと具体的なintentを必ず含める。
12. action.typeがconversationの場合、action.playerUtteranceが直前にプレイヤー画面へ出た実際の発言である。NPCの台詞はその内容へ一文目から直接答え、前件のない「もっともだ」「そうだね」などの相槌だけで始めない。
13. placeのfacilityName、facilityType、publicDescriptionを現在地の公開情報の正本として扱う。別施設の景観や機能を混ぜず、公開情報にない事件・用途・未来の変化を推測しない。
14. 「こちらを見ている」「静かな時間が流れる」だけで行動結果を終えない。authoritativeOutcomeを変えず、現在地で具体的に見聞きできた対象・動作・変化を最低一つ描く。
15. conversationでは、対象NPCの返答を合計55〜260文字程度で作り、(a)直前の質問への答え、(b)そのNPCだけが知る具体的な情報または感情、(c)次に聞く・調べる・決断するきっかけ、の三つを含める。一言だけで会話を打ち切らない。
16. previouslyAskedTopicsを言い直さず、conversationTurnが進むほど情報を一段深くする。ただしNPCが知らない秘密は作らず、「知らない」と理由や知っていそうな相手を自然に返す。
17. choicesの文言は、調べる・人へ働きかける・危険を引き受ける・保留する等、結果の違いが一目で分かるようにする。同義語だけの三択にしない。
18. allowedActionCandidatesがある場合、各choiceは同じidだけでなく、対応するintentTypeも変えない。文言はその行動結果を正確に表す範囲で具体化する。
19. action.firstIntroductionがtrueなら、action.introductionNameは対象NPCが最初の返答で自然に自分の名前を名乗るためだけに使う。本名をnarrative、choices、別NPCの台詞へ書いてはならない。localNpcs上の匿名名は自己紹介が終わるまで維持する。既知の人物には毎回名乗らせない。
20. localNpcs.knownLocalFactsは、そのNPCが話せる事実の上限である。そこにない秘密を作らない。話せる事実がない場合も、知らない理由と次に当たる相手・場所のどちらかを具体的に示す。
21. conversationの一往復ごとに、localRumors、knownLocalFacts、missions、現在地のいずれかに根拠を持つ新情報、NPCの明確な感情、次の具体的行動の手掛かりを最低一つ与える。進展のない見つめ合いや一言返答は禁止する。
22. action.requiredDisclosureがある場合、それはこの質問でプレイヤーが取得する唯一の新しい事実である。対象NPCの台詞にその文字列を原文のまま必ず含め、意味を変えずに前後の会話を自然に広げる。ない場合はknownLocalFactsにない新事実を開示しない。
23. authoritativeOutcome.discoveryがある場合、そのtextは今回確定した発見である。narrativeへ具体的に反映し、「結果が反映された」のような抽象文へ置き換えない。
24. missionsのcurrentStepProgress/currentStepRequiredとdiscoveriesを参照し、既に発見済みの内容を新発見として繰り返さない。進捗後のchoicesは次の段階に対応する差のある三択にする。
25. narrativeとspeechesは世界内の描写と発言だけを書く。NPCや地の文に、ミッション、クエスト、選択肢、3択、ボタン、タップ、クリック、画面、UI、メニュー、フラグ、プレイヤー、ゲーム、チュートリアル、SP、HP、MP、レベル、ステータス、ログ、システム、resolver、Gemini等の操作・実装用語を話させない。必要な概念は依頼、技、体力、魔力、経験、記録など世界内の語へ置き換える。操作説明は別のチュートリアルUIが担う。
26. NPCの発言はrole、mood、speechStyle、currentGoal、relationship、knownLocalFactsに従う。NPCを全知の解説役やゲームルールの代弁者にせず、プレイヤーへ教訓を説くための台詞を作らない。責任、恐れ、望み、見聞きした事実を、その人物自身の立場から話させる。

提案ポリシー:
- 許可ミッションテンプレート: ${allowedMissionTemplateIds.join(", ") || "なし"}
- 許可troubleId: ${allowedTroubleIds.join(", ") || "なし"}
- 特別ミッション候補の正しい例: {"type":"special_mission_candidate","templateId":"${exampleTemplateId}","troubleId":"${exampleTroubleId}","reason":"現地で追加対応が必要"}
- MSN-T13のようなmission IDをtemplateIdへ入れない。

現在その場にいるNPC: ${present}

入力JSON:
${stableStringify(context)}`;
  if (!repair) return core;
  return `${core}

前回出力は検証に失敗しました。次の違反をすべて修正し、完全なJSONだけを再出力してください。
検証エラー:
${repair.errors.map((entry) => `- ${entry}`).join("\n")}
前回出力:
${String(repair.raw ?? "").slice(0, 5000)}
修復時は各文字列を簡潔にし、全体を1200文字以内の閉じたJSONにしてください。`;
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

export function createTrpgNarrator(options = {}) {
  const model = options.model ?? TRPG_NARRATIVE_MODEL;
  const promptVersion = options.promptVersion ?? TRPG_NARRATIVE_PROMPT_VERSION;
  const provider = options.provider === undefined ? createGoogleGeminiProvider({ model }) : options.provider;
  const cache = options.cache ?? createNarrativeReplayCache({
    filePath: options.cacheFilePath ?? process.env.TRPG_NARRATIVE_CACHE_FILE ?? DEFAULT_CACHE_PATH,
    memoryOnly: options.memoryOnlyCache ?? false,
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
    auditLog,
    async generate(input, resolverRules = {}) {
      const startedAt = Date.now();
      const { context, audit: contextAudit } = buildLocalNarrativeContext(input);
      const policy = normalizeNarrativePolicy(resolverRules, context);
      const key = narrativeReplayKey(context, { model, promptVersion, policy });
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
      let validation = null;
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
          try {
            parsed = parseNarrativeJson(raw);
            validation = validateNarrativeOutput(parsed, context);
          } catch (error) {
            validation = { ok: false, errors: [`json_parse: ${String(error?.message ?? error)}`] };
          }
          if (!validation.ok) {
            audit.validationErrors.push(...validation.errors);
            audit.repairCalls += 1;
            const repairedResult = normalizeProviderResult(await callProvider(provider, {
              prompt: buildNarrativePrompt(context, { repair: { errors: validation.errors, raw }, policy }),
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
              parsed = parseNarrativeJson(raw);
              validation = validateNarrativeOutput(parsed, context);
            } catch (error) {
              validation = { ok: false, errors: [`repair_json_parse: ${String(error?.message ?? error)}`] };
            }
            if (!validation.ok) audit.validationErrors.push(...validation.errors);
          }
        } catch (error) {
          audit.providerErrors.push({ stage: "final", message: String(error?.message ?? error).slice(0, 300) });
        }
      }

      const output = validation?.ok
        ? sanitizeNarrativeOutput(parsed, context)
        : deterministicNarrativeFallback(context, provider ? "invalid_or_failed_model_output" : "gemini_key_missing");
      const proposalResolution = resolveNarrativeProposals(output, context, resolverRules);
      const response = {
        narrative: output.narrative,
        choices: output.choices,
        speeches: output.speeches,
        proposals: output.proposals,
        proposalResolution,
        meta: {
          ...audit,
          source: validation?.ok ? audit.source : "deterministic_fallback",
          validAfterRepair: Boolean(validation?.ok && audit.repairCalls),
          usedFallback: !validation?.ok,
        },
      };
      // A provider outage, timeout, or malformed reply must not poison the
      // replay cache for every future player who reaches the same scene.
      // The current save still persists its deterministic presentation, while
      // a later independent generation is allowed to try Gemini again.
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
