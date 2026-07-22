import fs from "node:fs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`missing_anchor:${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`duplicate_anchor:${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function edit(path, transform) {
  fs.writeFileSync(path, transform(fs.readFileSync(path, "utf8")), "utf8");
}

edit("src/server/trpg/narrative-contract.js", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    'export const TRPG_NARRATIVE_PROMPT_VERSION = "trpg-narrative-v5.2-director";',
    'export const TRPG_NARRATIVE_PROMPT_VERSION = "trpg-narrative-v5.3-conversation-boundaries";',
    "prompt-version",
  );
  source = replaceOnce(
    source,
    `function isEmptyReaction(value) {
  return EMPTY_REACTION_PATTERN.test(String(value ?? "").trim());
}
 `,
    `function isEmptyReaction(value) {
  return EMPTY_REACTION_PATTERN.test(String(value ?? "").trim());
}

export function isConversationClosingAction(action = {}) {
  const id = String(action?.id ?? "");
  const topic = String(action?.dialogueTopic ?? "").toLowerCase();
  return action?.conversationClosing === true
    || /(?:^|:)END$/iu.test(id)
    || ["end", "farewell", "goodbye", "conversation_end"].includes(topic);
}

export function minimumConversationReplyLength(action = {}) {
  return isConversationClosingAction(action) ? 4 : 12;
}
 `,
    "conversation-boundary-helpers",
  );
  source = replaceOnce(
    source,
    '    if (directReplies.length && replyLength < 12) errors.push("conversation reply is too short to carry useful meaning");',
    '    if (directReplies.length && replyLength < minimumConversationReplyLength(context.action)) errors.push("conversation reply is too short to carry useful meaning");',
    "conversation-minimum",
  );
  source = replaceOnce(
    source,
    `  for (const candidate of fallback.choices) {
    if (choices.length >= 3) break;
    if (usedIds.has(candidate.id)) continue;
    usedIds.add(candidate.id);
    choices.push({ ...candidate });
  }

  const speeches =`,
    `  for (const candidate of fallback.choices) {
    if (choices.length >= 3) break;
    if (usedIds.has(candidate.id)) continue;
    usedIds.add(candidate.id);
    choices.push({ ...candidate });
  }

  let sanitizedNarrative = sanitizeDiegeticText(value?.narrative, 1400) || fallback.narrative;
  const introductionName = context.action.firstIntroduction ? boundedText(context.action.introductionName, 80) : "";
  if (introductionName) {
    sanitizedNarrative = sanitizedNarrative.replaceAll(introductionName, "その人物");
    for (const choice of choices) {
      choice.label = String(choice.label ?? "").replaceAll(introductionName, "相手");
      if (choice.approach) choice.approach = String(choice.approach).replaceAll(introductionName, "相手");
    }
  }

  const speeches =`,
    "anonymous-introduction-surfaces",
  );
  source = replaceOnce(
    source,
    '    narrative: sanitizeDiegeticText(value?.narrative, 1400) || fallback.narrative,',
    '    narrative: sanitizedNarrative,',
    "sanitized-narrative-return",
  );
  return source;
});

edit("src/server/trpg/narrative-audit.js", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    'import { fileURLToPath } from "node:url";\n',
    'import { fileURLToPath } from "node:url";\nimport { minimumConversationReplyLength } from "./narrative-contract.js";\n',
    "audit-minimum-import",
  );
  source = replaceOnce(
    source,
    '    conversationHasSubstance: !isConversation || targetReplies.length >= 12,',
    '    conversationHasSubstance: !isConversation || targetReplies.length >= minimumConversationReplyLength(action),',
    "audit-conversation-minimum",
  );
  return source;
});

edit("src/server/trpg/gemini-narrator.js", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    `  mergeNarrativeOutputs,
  narrativeReplayKey,`,
    `  isConversationClosingAction,
  mergeNarrativeOutputs,
  narrativeReplayKey,`,
    "narrator-closing-import",
  );
  source = replaceOnce(
    source,
    `  if (context.sceneMode === "conversation") {
    rules.push("対象NPCはplayerUtteranceへ直接答え、プロフィール・知っている事実・現在の感情から自然に返す");
    rules.push("会話を同じ言い換えで停滞させず、新情報・感情の変化・次の具体的な糸口のどれかを一つ加える");
  }`,
    `  if (context.sceneMode === "conversation") {
    if (isConversationClosingAction(context.action)) {
      rules.push("会話を終える場面では、対象NPCは自然な短い別れの言葉を返す");
      rules.push("別れ際に新しい情報や新たな依頼を無理に追加しない");
    } else {
      rules.push("対象NPCはplayerUtteranceへ直接答え、プロフィール・知っている事実・現在の感情から自然に返す");
      rules.push("会話を同じ言い換えで停滞させず、新情報・感情の変化・次の具体的な糸口のどれかを一つ加える");
    }
  }`,
    "closing-scene-rules",
  );
  source = replaceOnce(
    source,
    `            validation = validateNarrativeOutput(output, context);
            repairErrors = componentRepairErrors(rawValidation, validation);
          } catch (error) {`,
    `            validation = validateNarrativeOutput(output, context);
            repairErrors = componentRepairErrors(rawValidation, validation);
            if (!validation.ok && !repairErrors.length) {
              audit.validationErrors.push(...validation.errors);
            }
          } catch (error) {`,
    "partial-validation-diagnostics",
  );
  return source;
});

edit("tools/trpg-sim/test/experiential-v6-contract.test.mjs", (source) => replaceOnce(
  source,
  '  assert.equal(TRPG_NARRATIVE_PROMPT_VERSION, "trpg-narrative-v5.2-director");',
  '  assert.equal(TRPG_NARRATIVE_PROMPT_VERSION, "trpg-narrative-v5.3-conversation-boundaries");',
  "prompt-version-test",
));

fs.rmSync("tools/trpg-refactor/apply-narrative-conversation-boundaries-v1.mjs");
console.log("narrative conversation boundaries integrated");
