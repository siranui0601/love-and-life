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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CACHE_PATH = path.resolve(HERE, "../../../runtime-data/TRPG/narrative-cache.jsonl");

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

export function buildNarrativePrompt(context, { repair = null } = {}) {
  const present = context.localNpcs.map((npc) => `${npc.id}:${npc.name}`).join(", ") || "なし";
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

現在その場にいるNPC: ${present}

入力JSON:
${stableStringify(context)}`;
  if (!repair) return core;
  return `${core}

前回出力は検証に失敗しました。次の違反をすべて修正し、完全なJSONだけを再出力してください。
検証エラー:
${repair.errors.map((entry) => `- ${entry}`).join("\n")}
前回出力:
${String(repair.raw ?? "").slice(0, 5000)}`;
}

export function createGoogleGeminiProvider({ apiKey = GEMINI_API_KEY, model = TRPG_NARRATIVE_MODEL } = {}) {
  if (!apiKey) return null;
  const client = new GoogleGenerativeAI(apiKey);
  return {
    name: "google-gemini",
    model,
    async generate({ prompt, useSchema = true }) {
      const generationConfig = {
        temperature: 0.35,
        topP: 0.9,
        maxOutputTokens: 1600,
        responseMimeType: "application/json",
        ...(useSchema ? { responseSchema: GEMINI_NARRATIVE_RESPONSE_SCHEMA } : {}),
      };
      const instance = client.getGenerativeModel({ model, generationConfig });
      try {
        const result = await instance.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        if (useSchema && schemaError(error)) {
          const compatible = client.getGenerativeModel({
            model,
            generationConfig: { ...generationConfig, responseSchema: undefined },
          });
          const result = await compatible.generateContent(prompt);
          return result.response.text();
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
      if (!transient(error) || attempt === 1) break;
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

  return {
    model,
    promptVersion,
    cache,
    async generate(input, resolverRules = {}) {
      const { context, audit: contextAudit } = buildLocalNarrativeContext(input);
      const key = narrativeReplayKey(context, { model, promptVersion });
      const cached = cache.get(key);
      if (cached) {
        return {
          ...cached.response,
          meta: {
            ...cached.response.meta,
            source: "replay_cache",
            cacheKey: key,
            providerCalls: 0,
            contextAudit,
          },
        };
      }

      const audit = {
        source: provider ? "gemini" : "deterministic_fallback",
        cacheKey: key,
        model,
        promptVersion,
        providerCalls: 0,
        repairCalls: 0,
        providerErrors: [],
        validationErrors: [],
        contextAudit,
      };

      let raw = null;
      let parsed = null;
      let validation = null;
      if (provider) {
        try {
          raw = await callProvider(provider, { prompt: buildNarrativePrompt(context), useSchema: true, mode: "primary", context }, audit);
          try {
            parsed = parseNarrativeJson(raw);
            validation = validateNarrativeOutput(parsed, context);
          } catch (error) {
            validation = { ok: false, errors: [`json_parse: ${String(error?.message ?? error)}`] };
          }
          if (!validation.ok) {
            audit.validationErrors.push(...validation.errors);
            audit.repairCalls += 1;
            const repairedRaw = await callProvider(provider, {
              prompt: buildNarrativePrompt(context, { repair: { errors: validation.errors, raw } }),
              useSchema: true,
              mode: "repair",
              context,
              previousRaw: raw,
              validationErrors: validation.errors,
            }, audit);
            raw = repairedRaw;
            try {
              parsed = parseNarrativeJson(repairedRaw);
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
      await cache.set(key, response, {
        model,
        promptVersion,
        contextHash: key,
      });
      return response;
    },
  };
}
