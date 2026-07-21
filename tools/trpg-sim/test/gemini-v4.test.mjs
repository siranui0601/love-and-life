import test from "node:test";
import assert from "node:assert/strict";
import {
  boundedNarrativeRequestTimeout,
  buildNarrativePrompt,
  createTrpgNarrator,
  geminiNarrativeGenerationConfig,
} from "../../../src/server/trpg/gemini-narrator.js";
import { createNarrativeReplayCache } from "../../../src/server/trpg/narrative-cache.js";
import {
  buildLocalNarrativeContext,
  deterministicNarrativeFallback,
  resolveNarrativeProposals,
  sanitizeNarrativeOutput,
  validateNarrativeOutput,
} from "../../../src/server/trpg/narrative-contract.js";
import { summarizeNarrativeReplayBehavior } from "../lib/gemini-simulation-v4.mjs";

function scenario() {
  return {
    action: { id: "ACT-1", type: "talk", label: "衛兵に話を聞く", targetNpcId: "NPC-LOCAL" },
    authoritativeState: {
      day: 2,
      hour: 12,
      minute: 15,
      daypart: "day",
      locationId: "田園の村",
      facilityId: "FAC-1",
      facilityName: "村の広場",
      presentNpcIds: ["NPC-LOCAL"],
      npcs: [
        { id: "NPC-LOCAL", name: "村の衛兵", role: "衛兵", mood: "警戒中" },
        { id: "NPC-REMOTE", name: "王都の司書", role: "司書", mood: "勤務中" },
      ],
      missions: [{
        id: "MSN-T01",
        title: "少年を助ける",
        troubleId: "T01",
        currentStep: { id: "hear", label: "村で少年の行方を聞く", progress: 1, required: 2 },
        discoveries: [{
          id: "T01-CLUE-TRACKS",
          text: "小さな靴跡が見張り小屋へ続いている。",
          stepId: "search",
          stage: 0,
          approachId: "tracks",
        }],
        targetLocations: ["田園の村"],
      }],
      localRumors: [{ id: "RUM-T01-active", troubleId: "T01", text: "少年が戻らない" }],
      player: { displayName: "旅人" },
      authoritativeOutcome: { kind: "conversation_started", summary: "衛兵が話せる状態になった" },
    },
  };
}

test("local narrative context excludes NPCs who are not present", () => {
  const input = scenario();
  input.authoritativeState.facilityType = "広場";
  input.authoritativeState.publicDescription = "村人が行き交い、日々の知らせが集まる広場。";
  input.authoritativeState.facilityFunction = "T01捜索、T03狼遭遇";
  input.authoritativeState.facilityNotes = "失敗時に別の店へ置換";
  input.authoritativeState.npcs[0].occupation = "密輸倉庫番";
  input.authoritativeState.npcs[0].goal = "証拠を隠す";
  const built = buildLocalNarrativeContext(input);
  assert.deepEqual(built.audit.includedNpcIds, ["NPC-LOCAL"]);
  assert.deepEqual(built.audit.excludedNpcIds, ["NPC-REMOTE"]);
  assert.equal(built.context.localNpcs.length, 1);
  assert.equal(JSON.stringify(built.context).includes("王都の司書"), false);
  assert.equal(built.context.missions[0].currentStep, "村で少年の行方を聞く");
  assert.equal(built.context.missions[0].currentStepProgress, 1);
  assert.equal(built.context.missions[0].currentStepRequired, 2);
  assert.deepEqual(built.context.missions[0].discoveries, [{
    id: "T01-CLUE-TRACKS",
    text: "小さな靴跡が見張り小屋へ続いている。",
    stepId: "search",
    stage: 0,
    approachId: "tracks",
  }]);
  assert.equal(built.context.place.publicDescription, "村人が行き交い、日々の知らせが集まる広場。");
  assert.doesNotMatch(JSON.stringify(built.context), /T01捜索|T03狼遭遇|失敗時|密輸倉庫番|証拠を隠す/u);
});

test("Gemini 2.5 Flash reserves its output budget for complete narrative JSON", () => {
  const flash = geminiNarrativeGenerationConfig({ model: "gemini-2.5-flash", useSchema: true });
  assert.equal(flash.maxOutputTokens, 2_048);
  assert.deepEqual(flash.thinkingConfig, { thinkingBudget: 0 });
  assert.ok(flash.responseSchema);

  const other = geminiNarrativeGenerationConfig({ model: "gemini-3.1-pro-preview", useSchema: false });
  assert.equal("thinkingConfig" in other, false);
  assert.equal("responseSchema" in other, false);
  assert.equal(boundedNarrativeRequestTimeout("not-a-number"), 18_000);
  assert.equal(boundedNarrativeRequestTimeout(1), 3_000);
  assert.equal(boundedNarrativeRequestTimeout(99_000), 25_000);
});

test("an action target cannot add an absent, missing, or remote NPC to local context", () => {
  const input = scenario();
  input.action.targetNpcId = "NPC-REMOTE";
  input.authoritativeState.presentNpcIds = ["NPC-LOCAL", "NPC-REMOTE"];
  input.authoritativeState.npcs[1] = {
    ...input.authoritativeState.npcs[1],
    presence: "missing",
    locationId: "王都",
  };
  const built = buildLocalNarrativeContext(input);
  assert.deepEqual(built.audit.includedNpcIds, ["NPC-LOCAL"]);
  assert.equal(built.audit.rejectedActionTargetId, "NPC-REMOTE");
  assert.equal(built.context.action.targetNpcId, null);
});

test("Gemini selects three executable actions from a broader pool and keeps a progress route", () => {
  const input = scenario();
  input.authoritativeState.availableActionCandidates = [
    { id: "ACT-PROGRESS", label: "少年の足跡を追う", intentType: "investigate", actionType: "investigate", missionId: "MSN-T01", progressRole: "progress" },
    { id: "ACT-ASK", label: "衛兵に詳しく聞く", intentType: "ask", actionType: "conversation", targetNpcId: "NPC-LOCAL" },
    { id: "ACT-LOOK", label: "広場を調べる", intentType: "observe", actionType: "localInvestigate" },
    { id: "ACT-WORK", label: "仕事を尋ねる", intentType: "help", actionType: "work", targetNpcId: "NPC-LOCAL", workOffer: true },
    { id: "ACT-LEAVE", label: "広場を離れる", intentType: "leave", actionType: "plan" },
  ];
  input.authoritativeState.progressContract = {
    mode: "must_offer_progress",
    anchorCandidateIds: ["ACT-PROGRESS"],
    missionId: "MSN-T01",
    currentStep: "少年の行方を追う",
  };
  input.authoritativeState.actionAffordances = {
    allowedKinds: ["talk", "investigate", "observe"],
    talkNpcIds: ["NPC-LOCAL"],
    movements: [],
    needActions: [],
    workEmployerNpcIds: ["NPC-LOCAL"],
  };
  const context = buildLocalNarrativeContext(input).context;
  assert.equal(context.allowedActionCandidates.length, 5);
  const valid = {
    narrative: "衛兵の向こうで、村外れへ続く道に泥が残っている。",
    choices: [
      { id: "ACT-PROGRESS", label: "泥に残る小さな足跡を村外れまで追う", intentType: "investigate", targetNpcId: null },
      { id: "ACT-ASK", label: "衛兵に最後に少年を見た時刻を尋ねる", intentType: "ask", targetNpcId: "NPC-LOCAL" },
      { id: "ACT-WORK", label: "急ぎの仕事がないか衛兵に尋ねる", intentType: "help", targetNpcId: "NPC-LOCAL", workProposal: { title: "門前の荷車から食料袋を倉庫へ運ぶ", durationClass: "half_day", riskClass: "low" } },
    ],
    speeches: [],
    proposals: [],
  };
  assert.equal(validateNarrativeOutput(valid, context).ok, true);
  const generated = validateNarrativeOutput({
    ...valid,
    choices: [
      valid.choices[0],
      { id: "GENERATED:1", label: "衛兵に路地の見張りについて聞く", intentType: "talk", targetNpcId: "NPC-LOCAL", generatedAction: { kind: "talk", targetNpcId: "NPC-LOCAL" } },
      { id: "GENERATED:2", label: "井戸端から広場全体の人の流れを観察する", intentType: "observe", generatedAction: { kind: "observe", approach: "高い位置から人の流れを見る" } },
    ],
  }, context);
  assert.equal(generated.ok, true);
  const invalid = validateNarrativeOutput({
    ...valid,
    choices: [valid.choices[1], valid.choices[2], { id: "MADE-UP", label: "存在しない行動", intentType: "prepare" }],
  }, context);
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => /executable candidate or provide generatedAction/u.test(error)));
  assert.ok(invalid.errors.includes("choices must include at least one progress anchor candidate"));

  const sanitized = sanitizeNarrativeOutput({
    ...valid,
    choices: [
      valid.choices[1],
      valid.choices[2],
      { id: "MADE-UP", label: "存在しない行動", intentType: "prepare" },
    ],
  }, context);
  assert.equal(sanitized.choices.length, 3);
  assert.ok(sanitized.choices.some((choice) => choice.id === "ACT-PROGRESS"));
  assert.ok(sanitized.choices.some((choice) => choice.id === "ACT-ASK"));
});

test("continuity contracts keep the player's current activity available without fixing all three choices", () => {
  const input = scenario();
  input.authoritativeState.availableActionCandidates = [
    { id: "ACT-PROGRESS", label: "足跡を追う", intentType: "investigate", missionId: "MSN-T01", progressRole: "progress" },
    { id: "ACT-WORK", label: "別の仕事を尋ねる", intentType: "help", targetNpcId: "NPC-LOCAL", workOffer: true },
    { id: "ACT-TALK", label: "衛兵と話す", intentType: "talk", targetNpcId: "NPC-LOCAL" },
    { id: "ACT-WAIT", label: "少し待つ", intentType: "wait" },
  ];
  input.authoritativeState.progressContract = {
    mode: "must_offer_progress",
    anchorCandidateIds: ["ACT-PROGRESS"],
  };
  input.authoritativeState.continuityContract = {
    mode: "must_offer_continuation",
    intent: "仕事を続ける",
    candidateIds: ["ACT-WORK"],
  };
  const context = buildLocalNarrativeContext(input).context;
  const sanitized = sanitizeNarrativeOutput({
    narrative: "広場では荷車の積み替えと捜索の相談が同時に続いている。",
    choices: [
      { id: "ACT-PROGRESS", label: "足跡を追う", intentType: "investigate" },
      { id: "ACT-TALK", label: "衛兵と話す", intentType: "talk", targetNpcId: "NPC-LOCAL" },
      { id: "ACT-WAIT", label: "少し待つ", intentType: "wait" },
    ],
    speeches: [],
    proposals: [],
  }, context);
  assert.equal(sanitized.choices.length, 3);
  assert.ok(sanitized.choices.some((choice) => choice.id === "ACT-PROGRESS"));
  assert.ok(sanitized.choices.some((choice) => choice.id === "ACT-WORK"));
  assert.equal(validateNarrativeOutput(sanitized, context).ok, true);
});

test("sanitizer removes empty reactions and internal ids while salvaging optional semantic proposals", () => {
  const input = scenario();
  input.authoritativeState.availableActionCandidates = [
    { id: "ACT-ASK", label: "衛兵に聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
    { id: "ACT-LOOK", label: "広場を見る", intentType: "observe" },
    { id: "ACT-WAIT", label: "待つ", intentType: "wait" },
  ];
  const context = buildLocalNarrativeContext(input).context;
  const sanitized = sanitizeNarrativeOutput({
    narrative: "見知らぬ人物（NPC016）が広場を見回している。",
    choices: [
      { id: "ACT-ASK", label: "見知らぬ人物（NPC016）に聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
      { id: "ACT-LOOK", label: "広場を見る", intentType: "observe" },
      { id: "ACT-WAIT", label: "待つ", intentType: "wait" },
    ],
    speeches: [
      { actorId: "NPC-LOCAL", text: "……。" },
      { actorId: "NPC-LOCAL", text: "門の外で小さな足跡を見た。" },
    ],
    proposals: [
      {
        type: "local_fact_candidate",
        reason: "広場で衛兵の証言を聞いた",
        text: "門の外に小さな足跡がある",
      },
      {
        type: "npc_memory_candidate",
        subjectId: "NPC-LOCAL",
        reason: "衛兵が旅人との会話を覚えた",
        text: "旅人へ足跡の話をした",
      },
    ],
  }, context);
  assert.doesNotMatch(sanitized.narrative, /NPC016/u);
  assert.doesNotMatch(sanitized.choices[0].label, /NPC016/u);
  assert.deepEqual(sanitized.speeches.map((speech) => speech.text), ["門の外で小さな足跡を見た。"]);
  assert.equal(sanitized.proposals.length, 2);
  assert.equal(sanitized.proposals[0].subjectId, "FAC-1");
  assert.equal(sanitized.proposals[0].predicate, "observed_state");
  assert.equal(sanitized.proposals[1].predicate, "remembered_event");
  assert.equal(validateNarrativeOutput(sanitized, context).ok, true);
});

test("critical reactions are validated by actor contract rather than fixed production dialogue", () => {
  const input = scenario();
  input.authoritativeState.availableActionCandidates = [
    { id: "ACT-ASK", label: "話を聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
    { id: "ACT-LOOK", label: "周囲を見る", intentType: "observe" },
    { id: "ACT-WAIT", label: "待つ", intentType: "wait" },
  ];
  input.authoritativeState.reactionContract = {
    requiredActorIds: ["NPC-LOCAL"],
    goals: ["負傷者が自分の状態を伝える"],
  };
  const context = buildLocalNarrativeContext(input).context;
  const base = {
    narrative: "負傷者が顔を上げる。",
    choices: [
      { id: "ACT-ASK", label: "話を聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
      { id: "ACT-LOOK", label: "周囲を見る", intentType: "observe" },
      { id: "ACT-WAIT", label: "待つ", intentType: "wait" },
    ],
    speeches: [],
    proposals: [],
  };
  const missing = validateNarrativeOutput(base, context);
  assert.ok(missing.errors.includes("required reaction actor missing: NPC-LOCAL"));
  const present = validateNarrativeOutput({
    ...base,
    speeches: [{ actorId: "NPC-LOCAL", text: "足を痛めて、今は一人で歩けない。" }],
  }, context);
  assert.equal(present.ok, true);
});

test("the director prompt is short, scene-specific, and never carries Finn into unrelated scenes", () => {
  const context = buildLocalNarrativeContext(scenario()).context;
  const prompt = buildNarrativePrompt(context, {
    policy: {
      allowedMissionTemplateIds: ["local-investigation"],
      allowedTroubleIds: ["T13"],
    },
  });
  assert.match(prompt, /許可ミッションテンプレート: local-investigation/u);
  assert.match(prompt, /許可troubleId: T13/u);
  assert.match(prompt, /オレゴンは旅人を指す固定別名/u);
  assert.match(prompt, /local_fact_candidate、npc_memory_candidate、mission_lead_candidate/u);
  assert.doesNotMatch(prompt, /一人で歩けない|村へ戻りたい希望/u);

  const escortInput = scenario();
  escortInput.action = {
    ...escortInput.action,
    type: "conversation",
    dialogueTopic: "t01_escort",
    targetNpcId: "NPC-LOCAL",
  };
  const escortPrompt = buildNarrativePrompt(buildLocalNarrativeContext(escortInput).context);
  assert.match(escortPrompt, /一人で歩けない事情.*村へ戻りたい希望/u);

  const workInput = scenario();
  workInput.sceneMode = "work_generation";
  workInput.authoritativeState.workMarket = {
    region: "田園の村",
    baseHourlyWage: 24,
    localDemandTags: ["収穫", "運搬"],
    recentWorkTitles: ["麦束を荷車へ運ぶ"],
  };
  const workPrompt = buildNarrativePrompt(buildLocalNarrativeContext(workInput).context);
  assert.match(workPrompt, /賃金額を決めない/u);
  assert.match(workPrompt, /麦束を荷車へ運ぶ/u);
  assert.doesNotMatch(workPrompt, /村へ戻りたい希望/u);
});

test("npc_intent requires a local target and concrete intent before resolver validation", () => {
  const context = buildLocalNarrativeContext(scenario()).context;
  const missing = resolveNarrativeProposals({
    proposals: [{ type: "npc_intent", reason: "様子を見る" }],
  }, context);
  assert.equal(missing.rejected[0].reason, "npc_intent_target_required");

  const proposal = {
    type: "npc_intent",
    targetNpcId: "NPC-LOCAL",
    intent: "verify_tracks",
    reason: "足跡を確認できる",
  };
  const rejected = resolveNarrativeProposals({ proposals: [proposal] }, context, {
    validateNpcIntentCandidate: () => ({ ok: false, reason: "schedule_conflict" }),
  });
  assert.equal(rejected.rejected[0].reason, "schedule_conflict");
  const accepted = resolveNarrativeProposals({ proposals: [proposal] }, context, {
    validateNpcIntentCandidate: () => true,
  });
  assert.equal(accepted.accepted.length, 1);
});

test("full provider failure uses a minimal factual fallback without inventing NPC dialogue", () => {
  const input = scenario();
  input.authoritativeState.authoritativeOutcome.summary = "情報屋は旅人を信用していない。";
  const fallback = deterministicNarrativeFallback(buildLocalNarrativeContext(input).context);
  assert.doesNotMatch(fallback.narrative, /。。/u);
  assert.match(fallback.narrative, /信用していない/u);
  assert.deepEqual(fallback.speeches, []);
  assert.equal(fallback.choices.length, 3);
});

test("conversation fallback does not fabricate a bespoke answer when no fact is authoritative", () => {
  const input = scenario();
  input.action = {
    ...input.action,
    type: "conversation",
    dialogueTopic: "route_to_lead",
    playerUtterance: "手掛かりのある場所までの道と、途中の危険を教えてください。",
  };
  input.authoritativeState.authoritativeOutcome.summary = "1件の噂を新しく知った。";
  const fallback = deterministicNarrativeFallback(buildLocalNarrativeContext(input).context);
  assert.match(fallback.narrative, /1件の噂/u);
  assert.deepEqual(fallback.speeches, []);
  assert.equal(fallback.choices.length, 3);
});

test("a learned fact must appear verbatim in the target reply and in deterministic fallback", () => {
  const input = scenario();
  input.action = {
    ...input.action,
    type: "conversation",
    dialogueTopic: "local_concern",
    playerUtterance: "この辺りで、今いちばん困っていることは何ですか？",
    requiredDisclosure: "共同穀倉の食料が不足している",
  };
  input.authoritativeState.npcs[0].knownLocalFacts = [input.action.requiredDisclosure];
  const context = buildLocalNarrativeContext(input).context;
  const fallback = deterministicNarrativeFallback(context);
  assert.ok(fallback.speeches.some((speech) => speech.text.includes(context.action.requiredDisclosure)));

  const omitted = {
    ...fallback,
    speeches: [{
      actorId: "NPC-LOCAL",
      text: "この辺りには気になることがある。だが、今は詳しく言えない。ほかの人や現場にも当たり、複数の話を比べてから判断してほしい。",
      emotion: null,
    }],
  };
  const invalid = validateNarrativeOutput(omitted, context);
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.includes("conversation reply must include the authoritative disclosed fact verbatim"));

  const included = {
    ...omitted,
    speeches: [{
      ...omitted.speeches[0],
      text: `共同穀倉の食料が不足している。これは私が確かめた範囲の話だ。現場と帳簿を見比べ、誰がいつ気づいたかも聞いてほしい。`,
    }],
  };
  assert.equal(validateNarrativeOutput(included, context).ok, true);
});

test("invalid Gemini output is repaired and exact replay bypasses the provider", async () => {
  const calls = [];
  const provider = {
    async generate(payload) {
      calls.push(payload.mode);
      if (payload.mode === "primary") {
        return JSON.stringify({
          narrative: "衛兵と話す。",
          choices: [
            { id: "C1", label: "聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
            { id: "C2", label: "見る", intentType: "observe" },
          ],
          speeches: [{ actorId: "NPC-REMOTE", text: "遠隔地から話す" }],
          proposals: [],
        });
      }
      return JSON.stringify({
        narrative: "衛兵は村の広場で知っている範囲を話した。",
        choices: [
          { id: "C1", label: "詳しく聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
          { id: "C2", label: "周囲を見る", intentType: "observe", targetNpcId: null },
          { id: "C3", label: "会話を終える", intentType: "leave", targetNpcId: null },
        ],
        speeches: [{ actorId: "NPC-LOCAL", text: "村外れで足跡を見た。", emotion: "serious" }],
        proposals: [{
          type: "npc_intent",
          targetNpcId: "NPC-LOCAL",
          intent: "verify_tracks",
          reason: "その場で確認できる情報だから",
        }],
      });
    },
  };
  const narrator = createTrpgNarrator({
    provider,
    cache: createNarrativeReplayCache({ memoryOnly: true }),
    memoryOnlyCache: true,
  });
  const first = await narrator.generate(scenario(), { allowedTroubleIds: ["T01"] });
  const second = await narrator.generate(scenario(), { allowedTroubleIds: ["T01"] });
  assert.equal(first.choices.length, 3);
  assert.equal(first.speeches[0].actorId, "NPC-LOCAL");
  assert.equal(first.meta.validAfterRepair, true);
  assert.deepEqual(calls, ["primary", "repair"]);
  assert.equal(second.meta.source, "replay_cache");
  assert.equal(second.meta.providerCalls, 0);
  assert.equal(second.narrative, first.narrative);
  assert.deepEqual(second.choices, first.choices);
});

test("a transient Gemini timeout falls back once without poisoning replay cache", async () => {
  let calls = 0;
  const provider = {
    async generate() {
      calls += 1;
      if (calls === 1) {
        const error = new Error("request timeout");
        error.name = "AbortError";
        throw error;
      }
      return JSON.stringify({
        narrative: "衛兵は足跡が村外れへ続くと説明した。",
        choices: [
          { id: "C1", label: "詳しく聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
          { id: "C2", label: "周囲を見る", intentType: "observe", targetNpcId: null },
          { id: "C3", label: "会話を終える", intentType: "leave", targetNpcId: null },
        ],
        speeches: [{ actorId: "NPC-LOCAL", text: "小さな足跡なら村外れへ続いていた。" }],
        proposals: [],
      });
    },
  };
  const narrator = createTrpgNarrator({
    provider,
    cache: createNarrativeReplayCache({ memoryOnly: true }),
    memoryOnlyCache: true,
    auditLog: false,
  });
  const fallback = await narrator.generate(scenario());
  assert.equal(fallback.meta.usedFallback, true);
  assert.equal(fallback.meta.cachePersisted, false);
  const recovered = await narrator.generate(scenario());
  assert.equal(calls, 2);
  assert.equal(recovered.meta.usedFallback, false);
  assert.equal(recovered.meta.cachePersisted, true);
  assert.match(recovered.narrative, /足跡/u);
});

test("Gemini simulation audits cached successes separately from retryable fallbacks", () => {
  const summary = summarizeNarrativeReplayBehavior(
    [
      { meta: { cachePersisted: true } },
      { meta: { cachePersisted: false } },
      { meta: { cachePersisted: true } },
      { meta: { cachePersisted: false } },
    ],
    [
      { meta: { source: "replay_cache", providerCalls: 0 } },
      { meta: { source: "deterministic_fallback", providerCalls: 2 } },
      { meta: { source: "replay_cache", providerCalls: 0 } },
      { meta: { source: "gemini", providerCalls: 1 } },
    ],
  );
  assert.deepEqual(summary, {
    cacheEligible: 2,
    replayCacheHits: 2,
    retryEligible: 2,
    retryAttempts: 2,
    unclassified: 0,
  });
});

test("authoritative mutations and unknown missions are rejected as candidates", async () => {
  const provider = {
    async generate() {
      return JSON.stringify({
        narrative: "話を聞いた。",
        choices: [
          { id: "C1", label: "聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
          { id: "C2", label: "見る", intentType: "observe", targetNpcId: null },
          { id: "C3", label: "戻る", intentType: "leave", targetNpcId: null },
        ],
        speeches: [],
        proposals: [{
          type: "special_mission_candidate",
          templateId: "unknown-template",
          troubleId: "T99",
          reason: "勝手に作った任務",
        }],
      });
    },
  };
  const narrator = createTrpgNarrator({
    provider,
    cache: createNarrativeReplayCache({ memoryOnly: true }),
    memoryOnlyCache: true,
  });
  const result = await narrator.generate(scenario(), {
    allowedMissionTemplateIds: ["local-investigation"],
    allowedTroubleIds: ["T01"],
  });
  assert.equal(result.proposalResolution.accepted.length, 0);
  assert.equal(result.proposalResolution.rejected.length, 1);
  assert.equal(result.proposalResolution.rejected[0].reason, "unknown_mission_template");
});

test("cache replay recalculates proposal resolution and concurrent misses call provider once", async () => {
  let calls = 0;
  const provider = {
    async generate() {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return JSON.stringify({
        narrative: "衛兵は足跡を確認しようとしている。",
        choices: [
          { id: "C1", label: "詳しく聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
          { id: "C2", label: "周囲を見る", intentType: "observe", targetNpcId: null },
          { id: "C3", label: "会話を終える", intentType: "leave", targetNpcId: null },
        ],
        speeches: [{ actorId: "NPC-LOCAL", text: "足跡を確認してみる。" }],
        proposals: [{
          type: "npc_intent",
          targetNpcId: "NPC-LOCAL",
          intent: "verify_tracks",
          reason: "現地で確認できる",
        }],
      });
    },
  };
  const narrator = createTrpgNarrator({
    provider,
    cache: createNarrativeReplayCache({ memoryOnly: true }),
    memoryOnlyCache: true,
    auditLog: false,
  });
  const acceptingRules = { validateNpcIntentCandidate: () => true };
  const [first, simultaneous] = await Promise.all([
    narrator.generate(scenario(), acceptingRules),
    narrator.generate(scenario(), acceptingRules),
  ]);
  assert.equal(calls, 1);
  assert.equal(first.proposalResolution.accepted.length, 1);
  assert.equal(simultaneous.narrative, first.narrative);

  const replay = await narrator.generate(scenario(), {
    validateNpcIntentCandidate: () => ({ ok: false, reason: "schedule_conflict" }),
  });
  assert.equal(calls, 1);
  assert.equal(replay.meta.source, "replay_cache");
  assert.equal(replay.proposalResolution.accepted.length, 0);
  assert.equal(replay.proposalResolution.rejected[0].reason, "schedule_conflict");
});

test("mission policy participates in the generation cache key", async () => {
  let calls = 0;
  const provider = {
    async generate() {
      calls += 1;
      return JSON.stringify({
        narrative: "衛兵から話を聞いた。",
        choices: [
          { id: "C1", label: "聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
          { id: "C2", label: "見る", intentType: "observe", targetNpcId: null },
          { id: "C3", label: "戻る", intentType: "leave", targetNpcId: null },
        ],
        speeches: [],
        proposals: [],
      });
    },
  };
  const narrator = createTrpgNarrator({
    provider,
    cache: createNarrativeReplayCache({ memoryOnly: true }),
    auditLog: false,
  });
  await narrator.generate(scenario(), { allowedMissionTemplateIds: ["local-investigation"] });
  await narrator.generate(scenario(), { allowedMissionTemplateIds: ["local-rescue"] });
  assert.equal(calls, 2);
});
