import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNarrativePrompt,
  createTrpgNarrator,
} from "../../../src/server/trpg/gemini-narrator.js";
import {
  buildLocalNarrativeContext,
  isConversationClosingAction,
  minimumConversationReplyLength,
  sanitizeNarrativeOutput,
  validateNarrativeOutput,
} from "../../../src/server/trpg/narrative-contract.js";
import { evaluateNarrativeAuditRecord } from "../../../src/server/trpg/narrative-audit.js";

function input({
  actionId = "DIALOGUE:NPC-LOCAL:2:local_concern",
  firstIntroduction = false,
  introductionName = null,
} = {}) {
  return {
    locale: "ja-JP",
    playerName: "旅人",
    sceneMode: "conversation",
    action: {
      id: actionId,
      type: "conversation",
      label: actionId.endsWith(":END") ? "相手に礼を言い、会話を終える" : "相手へ声をかける",
      targetNpcId: "NPC-LOCAL",
      firstIntroduction,
      introductionName,
    },
    authoritativeState: {
      day: 2,
      hour: 12,
      minute: 15,
      daypart: "day",
      locationId: "王都",
      facilityId: "LOC_CAP_LOWER_INN",
      facilityName: "下層の安宿",
      presentNpcIds: ["NPC-LOCAL"],
      npcs: [{
        id: "NPC-LOCAL",
        name: firstIntroduction ? "見知らぬ人物" : "レン",
        role: "旅人",
        mood: "警戒",
        locationId: "王都",
        facilityId: "LOC_CAP_LOWER_INN",
        presence: "present",
      }],
      availableActionCandidates: [
        { id: "ACT-EAT", label: "食事を取る", intentType: "prepare", actionType: "meal" },
        { id: "ACT-LOOK", label: "宿の様子を調べる", intentType: "investigate", actionType: "investigate" },
        { id: "ACT-MOVE", label: "中央市場へ向かう", intentType: "leave", actionType: "move" },
      ],
      player: { displayName: "旅人" },
      authoritativeOutcome: { kind: "conversation", summary: "相手が会話に応じた。" },
    },
  };
}

function output(speechText = "道中には気をつけてくれ。") {
  return {
    narrative: "相手は旅人の言葉を聞き、静かに頷いた。",
    choices: [
      { id: "ACT-EAT", label: "食事を取る", intentType: "prepare", targetNpcId: null },
      { id: "ACT-LOOK", label: "宿の様子を調べる", intentType: "investigate", targetNpcId: null },
      { id: "ACT-MOVE", label: "中央市場へ向かう", intentType: "leave", targetNpcId: null },
    ],
    speeches: [{ actorId: "NPC-LOCAL", text: speechText, emotion: "平静" }],
    proposals: [],
  };
}

test("first introductions keep the name in speech but remove it from narrative and next-action labels", () => {
  const context = buildLocalNarrativeContext(input({
    firstIntroduction: true,
    introductionName: "レン",
  })).context;
  const sanitized = sanitizeNarrativeOutput({
    narrative: "レンは地図から顔を上げ、旅人を見た。",
    choices: [
      { id: "ACT-EAT", label: "レンに礼を言って食事を取る", intentType: "prepare" },
      { id: "ACT-LOOK", label: "レンの近くにある掲示を調べる", intentType: "investigate" },
      { id: "ACT-MOVE", label: "レンと別れて中央市場へ向かう", intentType: "leave" },
    ],
    speeches: [{ actorId: "NPC-LOCAL", text: "俺はレンだ。旅人なら道中に気をつけろ。" }],
    proposals: [],
  }, context);
  assert.doesNotMatch(sanitized.narrative, /レン/u);
  assert.ok(sanitized.choices.every((choice) => !choice.label.includes("レン")));
  assert.ok(sanitized.choices.every((choice) => !String(choice.approach ?? "").includes("レン")));
  assert.match(sanitized.speeches[0].text, /レン/u);
  assert.equal(validateNarrativeOutput(sanitized, context).ok, true);
});

test("a farewell accepts a brief meaningful reply while ordinary information talk does not", () => {
  const closingContext = buildLocalNarrativeContext(input({ actionId: "DIALOGUE:NPC-LOCAL:2:END" })).context;
  const ordinaryContext = buildLocalNarrativeContext(input()).context;
  const brief = output("気をつけてな。");

  assert.equal(isConversationClosingAction(closingContext.action), true);
  assert.equal(minimumConversationReplyLength(closingContext.action), 4);
  assert.equal(validateNarrativeOutput(brief, closingContext).ok, true);
  assert.equal(evaluateNarrativeAuditRecord({ context: closingContext, response: brief }).checks.conversationHasSubstance, true);

  assert.equal(isConversationClosingAction(ordinaryContext.action), false);
  assert.equal(minimumConversationReplyLength(ordinaryContext.action), 12);
  assert.equal(validateNarrativeOutput(brief, ordinaryContext).ok, false);
  assert.equal(evaluateNarrativeAuditRecord({ context: ordinaryContext, response: brief }).checks.conversationHasSubstance, false);
});

test("the closing prompt asks for a natural farewell instead of inventing another lead", () => {
  const context = buildLocalNarrativeContext(input({ actionId: "DIALOGUE:NPC-LOCAL:2:END" })).context;
  const prompt = buildNarrativePrompt(context);
  assert.match(prompt, /短い別れの言葉/u);
  assert.match(prompt, /新しい情報や新たな依頼を無理に追加しない/u);
});

test("partial model output records its concrete validation errors even without a repair call", async () => {
  const scenario = input();
  const context = buildLocalNarrativeContext(scenario).context;
  const invalid = {
    ...output("この宿では夜になる前に戸締まりを確かめている。"),
    choices: context.allowedActionCandidates.map((candidate) => ({
      id: candidate.id,
      label: "同じ行動を選ぶ",
      intentType: candidate.intentType,
      targetNpcId: candidate.targetNpcId,
    })),
  };
  const narrator = createTrpgNarrator({
    approvedCache: false,
    memoryOnlyCache: true,
    auditLog: false,
    provider: {
      async generate() {
        return JSON.stringify(invalid);
      },
    },
  });
  const response = await narrator.generate(scenario);
  assert.equal(response.meta.source, "gemini_partial");
  assert.equal(response.meta.repairCalls, 0);
  assert.ok(response.meta.validationErrors.some((error) => /choice labels are semantically duplicated/u.test(error)));
});
