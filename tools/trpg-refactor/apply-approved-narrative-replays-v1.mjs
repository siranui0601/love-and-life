import fs from "node:fs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`missing_anchor:${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`duplicate_anchor:${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function write(path, content) {
  fs.writeFileSync(path, content, "utf8");
}

const narratorPath = "src/server/trpg/gemini-narrator.js";
let narrator = fs.readFileSync(narratorPath, "utf8");
narrator = replaceOnce(
  narrator,
  'import { createNarrativeReplayCache } from "./narrative-cache.js";\n',
  'import { createNarrativeReplayCache } from "./narrative-cache.js";\nimport { createApprovedNarrativeReplayCache } from "./approved-narrative-replays.js";\n',
  "approved-import",
);
narrator = replaceOnce(
  narrator,
  'const DEFAULT_CACHE_PATH = path.resolve(HERE, "../../../runtime-data/TRPG/narrative-cache.jsonl");\n',
  'const DEFAULT_CACHE_PATH = path.resolve(HERE, "../../../runtime-data/TRPG/narrative-cache.jsonl");\nconst DEFAULT_APPROVED_REPLAY_PATH = path.resolve(HERE, "content/approved-narrative-replays.json");\n',
  "approved-path",
);
narrator = replaceOnce(
  narrator,
  `  const cache = options.cache ?? createNarrativeReplayCache({
    filePath: options.cacheFilePath ?? process.env.TRPG_NARRATIVE_CACHE_FILE ?? DEFAULT_CACHE_PATH,
    memoryOnly: options.memoryOnlyCache ?? false,
  });
  const auditLog = options.auditLog === false
`,
  `  const cache = options.cache ?? createNarrativeReplayCache({
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
`,
  "approved-cache-create",
);
narrator = replaceOnce(
  narrator,
  `      const key = narrativeReplayKey(context, { model, promptVersion, policy });
      const cached = cache.get(key);
`,
  `      const key = narrativeReplayKey(context, { model, promptVersion, policy });
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
`,
  "approved-priority",
);
narrator = replaceOnce(
  narrator,
  `    promptVersion,
    cache,
    auditLog,
`,
  `    promptVersion,
    cache,
    approvedCache,
    auditLog,
`,
  "approved-public-cache",
);
write(narratorPath, narrator);

const livePath = "tools/trpg-sim/cli-narrative-live.mjs";
let live = fs.readFileSync(livePath, "utf8");
live = replaceOnce(
  live,
  `    source: response.meta?.source ?? "unknown",
    repairCalls: Number(response.meta?.repairCalls ?? 0),
`,
  `    source: response.meta?.source ?? "unknown",
    cacheKey: response.meta?.cacheKey ?? null,
    cachePersisted: response.meta?.cachePersisted === true,
    partialOutputUsed: response.meta?.partialOutputUsed === true,
    repairCalls: Number(response.meta?.repairCalls ?? 0),
`,
  "live-cache-fields",
);
live = replaceOnce(
  live,
  `- Gemini生成: \${report.summary.gemini}\n- 再生キャッシュ: \${report.summary.replayCache}\n`,
  `- Gemini生成: \${report.summary.gemini}\n- 承認済み再生: \${report.summary.approvedReplay}\n- 再生キャッシュ: \${report.summary.replayCache}\n`,
  "live-markdown-approved",
);
live = replaceOnce(
  live,
  `    gemini: results.filter((entry) => entry.source === "gemini").length,
    replayCache: results.filter((entry) => entry.source === "replay_cache").length,
`,
  `    gemini: results.filter((entry) => entry.source === "gemini" || entry.source === "gemini_repaired").length,
    approvedReplay: results.filter((entry) => entry.source === "approved_replay").length,
    replayCache: results.filter((entry) => entry.source === "replay_cache").length,
`,
  "live-summary-approved",
);
live = replaceOnce(
  live,
  `  cache: narrator.cache.snapshot(),
  sheetSync,
`,
  `  cache: narrator.cache.snapshot(),
  approvedCache: narrator.approvedCache?.snapshot?.() ?? null,
  sheetSync,
`,
  "live-approved-snapshot",
);
write(livePath, live);

const packagePath = "package.json";
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
packageJson.scripts["trpg:narrative-approve"] = "node tools/trpg-sim/approve-narrative-replays.mjs";
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const readmePath = "src/server/trpg/content/README.md";
let readme = fs.readFileSync(readmePath, "utf8");
if (!readme.includes("## 承認済みGemini再生")) {
  readme += `\n## 承認済みGemini再生\n\n- 実Gemini監査はまず通常のJSONL実行キャッシュへ保存する。\n- 人が監査レポートを確認した後、\\\`npm run trpg:narrative-approve -- --scenario <scenarioId>\\\`で指定した場面だけを承認する。\n- 承認対象は完全検証済みの\\\`gemini\\\`または\\\`gemini_repaired\\\`だけ。フォールバック、部分出力、通常キャッシュ再生は昇格できない。\n- 承認済みmanifestには描写、三択、発言、提案だけを保存し、生応答、利用量、秘密情報は保存しない。\n- 本番は承認済み再生、通常実行キャッシュ、Geminiの順に解決し、提案は現在のresolverで毎回再検証する。\n`;
}
write(readmePath, readme);

fs.rmSync("tools/trpg-refactor/apply-approved-narrative-replays-v1.mjs");
console.log("approved narrative replay integration applied");
