import crypto from "node:crypto";

export const TRPG_NARRATIVE_MODEL = "gemini-2.5-flash";
export const TRPG_NARRATIVE_PROMPT_VERSION = "trpg-narrative-v4.8";

export const INTENT_TYPES = Object.freeze([
  "talk",
  "ask",
  "observe",
  "investigate",
  "help",
  "trade",
  "leave",
  "wait",
  "prepare",
]);

export const PROPOSAL_TYPES = Object.freeze([
  "npc_intent",
  "flag_candidate",
  "special_mission_candidate",
  "rumor_candidate",
]);

const ALLOWED_FLAG_PREFIXES = Object.freeze([
  "dialogue.local.",
  "npc.relationship.",
  "mission.discovery.",
  "rumor.local.",
]);

const FORBIDDEN_PROPOSAL_KEYS = new Set([
  "exp",
  "experience",
  "gold",
  "level",
  "sp",
  "skill",
  "skills",
  "resolved",
  "status",
  "hp",
  "mp",
  "inventory",
  "equipment",
  "teleport",
  "worldflags",
]);

export const GEMINI_NARRATIVE_RESPONSE_SCHEMA = Object.freeze({
  type: "OBJECT",
  required: ["narrative", "choices", "speeches", "proposals"],
  properties: {
    narrative: {
      type: "STRING",
      description: "プレイヤーに表示する現在場面の描写。確定済み結果だけを説明する。",
    },
    choices: {
      type: "ARRAY",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "OBJECT",
        required: ["id", "label", "intentType"],
        properties: {
          id: { type: "STRING" },
          label: { type: "STRING" },
          intentType: { type: "STRING", enum: [...INTENT_TYPES] },
          targetNpcId: { type: "STRING", nullable: true },
        },
      },
    },
    speeches: {
      type: "ARRAY",
      maxItems: 6,
      items: {
        type: "OBJECT",
        required: ["actorId", "text"],
        properties: {
          actorId: { type: "STRING" },
          text: { type: "STRING" },
          emotion: { type: "STRING", nullable: true },
        },
      },
    },
    proposals: {
      type: "ARRAY",
      maxItems: 5,
      items: {
        type: "OBJECT",
        required: ["type", "reason"],
        properties: {
          type: { type: "STRING", enum: [...PROPOSAL_TYPES] },
          targetNpcId: { type: "STRING", nullable: true },
          intent: { type: "STRING", nullable: true },
          flagPath: { type: "STRING", nullable: true },
          value: { type: "STRING", nullable: true },
          templateId: { type: "STRING", nullable: true },
          troubleId: { type: "STRING", nullable: true },
          text: { type: "STRING", nullable: true },
          reason: { type: "STRING" },
        },
      },
    },
  },
});

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!plainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex");
}

function boundedText(value, maximum) {
  return String(value ?? "").trim().slice(0, maximum);
}

function normalizeNpc(npc) {
  return {
    id: boundedText(npc?.id, 80),
    name: boundedText(npc?.name, 80),
    role: boundedText(npc?.role ?? npc?.type, 120),
    mood: boundedText(npc?.mood ?? npc?.initialStatus, 120),
    currentGoal: boundedText(npc?.currentGoal, 180),
    relationship: Number.isFinite(Number(npc?.relationship)) ? Number(npc.relationship) : 0,
    speechStyle: boundedText(npc?.speechStyle, 180),
    knownLocalFacts: Array.isArray(npc?.knownLocalFacts)
      ? npc.knownLocalFacts.slice(0, 8).map((entry) => boundedText(entry, 180))
      : [],
  };
}

function npcIsPresentAtPlace(npc, state) {
  const presence = boundedText(npc?.presence, 40).toLowerCase();
  const lifeStatus = boundedText(npc?.lifeStatus ?? npc?.vitalState, 40).toLowerCase();
  if (presence && presence !== "present") return false;
  if (["dead", "missing"].includes(lifeStatus)) return false;
  const npcLocation = boundedText(npc?.locationId ?? npc?.currentLocation ?? npc?.location, 100);
  const stateLocation = boundedText(state?.locationId ?? state?.location, 100);
  if (npcLocation && stateLocation && npcLocation !== stateLocation) return false;
  const npcFacility = boundedText(npc?.facilityId ?? npc?.currentFacilityId, 100);
  const stateFacility = boundedText(state?.facilityId, 100);
  if (npcFacility && stateFacility && npcFacility !== stateFacility) return false;
  return true;
}

function normalizeActionCandidate(candidate, localNpcIds) {
  const id = boundedText(candidate?.id ?? candidate?.actionCandidateId, 120);
  const intentType = INTENT_TYPES.includes(candidate?.intentType) ? candidate.intentType : null;
  const rawTargetNpcId = boundedText(candidate?.targetNpcId, 80) || null;
  if (!id || !intentType || (rawTargetNpcId && !localNpcIds.has(rawTargetNpcId))) return null;
  return {
    id,
    label: boundedText(candidate?.label, 180) || id,
    intentType,
    targetNpcId: rawTargetNpcId,
  };
}

function normalizeMission(mission) {
  const rawStep = mission?.currentStep ?? mission?.step;
  const currentStep = rawStep && typeof rawStep === "object"
    ? boundedText(rawStep.label ?? rawStep.id, 180)
    : boundedText(rawStep, 180);
  const discoveries = (Array.isArray(mission?.discoveries) ? mission.discoveries : [])
    .map((discovery) => ({
      id: boundedText(discovery?.id, 120),
      text: boundedText(discovery?.text, 500),
      stepId: boundedText(discovery?.stepId, 80) || null,
      stage: Number.isFinite(Number(discovery?.stage)) ? Number(discovery.stage) : null,
      approachId: boundedText(discovery?.approachId, 80) || null,
    }))
    .filter((discovery) => discovery.id && discovery.text)
    .slice(-8);
  return {
    id: boundedText(mission?.id, 80),
    title: boundedText(mission?.title, 120),
    status: boundedText(mission?.status, 40),
    currentStep,
    currentStepId: rawStep && typeof rawStep === "object" ? boundedText(rawStep.id, 80) || null : null,
    currentStepProgress: rawStep && typeof rawStep === "object" && Number.isFinite(Number(rawStep.progress))
      ? Number(rawStep.progress)
      : null,
    currentStepRequired: rawStep && typeof rawStep === "object" && Number.isFinite(Number(rawStep.required))
      ? Number(rawStep.required)
      : null,
    discoveries,
    troubleId: boundedText(mission?.troubleId, 40) || null,
  };
}

function normalizeRumor(rumor) {
  return {
    id: boundedText(rumor?.id, 100),
    troubleId: boundedText(rumor?.troubleId, 40) || null,
    text: boundedText(rumor?.text, 240),
    importance: Number.isFinite(Number(rumor?.importance)) ? Number(rumor.importance) : 0.5,
  };
}

export function buildLocalNarrativeContext(input = {}) {
  const state = input.authoritativeState ?? input.state ?? {};
  const action = input.action ?? {};
  const presentNpcIds = new Set(
    [...(state.presentNpcIds ?? [])]
      .filter(Boolean)
      .map(String),
  );
  const suppliedNpcs = Array.isArray(state.npcs) ? state.npcs : [];
  const localNpcs = suppliedNpcs
    .filter((npc) => presentNpcIds.has(String(npc?.id)) && npcIsPresentAtPlace(npc, state))
    .map(normalizeNpc)
    .filter((npc) => npc.id)
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, 12);
  const localNpcIds = new Set(localNpcs.map((npc) => npc.id));
  const excludedNpcIds = suppliedNpcs
    .map((npc) => String(npc?.id ?? ""))
    .filter((id) => id && !localNpcIds.has(id));

  const visibleMissionIds = new Set((state.visibleMissionIds ?? []).map(String));
  const missions = (Array.isArray(state.missions) ? state.missions : [])
    .filter((mission) => !visibleMissionIds.size || visibleMissionIds.has(String(mission?.id)))
    .filter((mission) => {
      const locations = mission?.locations ?? mission?.targetLocations ?? [];
      return !locations.length || locations.includes(state.locationId ?? state.location);
    })
    .map(normalizeMission)
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, 12);

  const visibleRumorIds = new Set((state.visibleRumorIds ?? []).map(String));
  const rumors = (Array.isArray(state.localRumors) ? state.localRumors : state.rumors ?? [])
    .filter((rumor) => !visibleRumorIds.size || visibleRumorIds.has(String(rumor?.id)))
    .map(normalizeRumor)
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(-12);

  const rawActionCandidates = state.allowedActionCandidates
    ?? state.availableActionCandidates
    ?? input.allowedActionCandidates
    ?? [];
  const allowedActionCandidates = (Array.isArray(rawActionCandidates) ? rawActionCandidates : [])
    .map((candidate) => normalizeActionCandidate(candidate, localNpcIds))
    .filter(Boolean)
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, 3);

  const context = {
    contractVersion: "trpg-local-context-v1",
    locale: boundedText(input.locale ?? "ja-JP", 20),
    time: {
      day: Math.max(1, Number(state.day ?? 1)),
      hour: Math.max(0, Math.min(24, Number(state.hour ?? 10))),
      minute: Math.max(0, Math.min(59, Number(state.minute ?? 0))),
      daypart: boundedText(state.daypart ?? "day", 20),
    },
    place: {
      locationId: boundedText(state.locationId ?? state.location, 100),
      facilityId: boundedText(state.facilityId, 100) || null,
      facilityName: boundedText(state.facilityName, 120) || null,
      facilityType: boundedText(state.facilityType, 120) || null,
      publicDescription: boundedText(state.publicDescription, 300) || null,
    },
    player: {
      displayName: boundedText(state.player?.displayName ?? input.playerName ?? "旅人", 80),
      visibleCondition: boundedText(state.player?.visibleCondition, 160),
      knownFacts: Array.isArray(state.player?.knownFacts)
        ? state.player.knownFacts.slice(0, 12).map((entry) => boundedText(entry, 180))
        : [],
    },
    action: {
      id: boundedText(action.id, 120),
      type: boundedText(action.type, 60),
      label: boundedText(action.label, 180),
      playerUtterance: boundedText(action.playerUtterance, 240) || null,
      targetNpcId: localNpcIds.has(String(action.targetNpcId)) ? String(action.targetNpcId) : null,
      dialogueTopic: boundedText(action.dialogueTopic, 100) || null,
      firstIntroduction: action.firstIntroduction === true,
      // The canonical name is deliberately isolated from localNpcs.  Before
      // the introduction acknowledgement, every public NPC surface keeps the
      // anonymous label; only the target's first spoken reply may use this.
      introductionName: action.firstIntroduction === true
        ? boundedText(action.introductionName, 80) || null
        : null,
      conversationTurn: Math.max(0, Math.min(12, Number(action.conversationTurn ?? 0))),
      previouslyAskedTopics: Array.isArray(action.previouslyAskedTopics)
        ? action.previouslyAskedTopics.slice(0, 10).map((entry) => boundedText(entry, 100))
        : [],
      requiredDisclosure: boundedText(action.requiredDisclosure, 180) || null,
    },
    authoritativeOutcome: stableValue(state.authoritativeOutcome ?? input.authoritativeOutcome ?? {}),
    localNpcs,
    missions,
    localRumors: rumors,
    allowedActionCandidates,
    visibleFlags: stableValue(state.visibleFlags ?? {}),
  };

  return {
    context,
    audit: {
      suppliedNpcCount: suppliedNpcs.length,
      includedNpcIds: [...localNpcIds].sort(),
      excludedNpcIds: [...new Set(excludedNpcIds)].sort(),
      remoteNpcDataRemoved: excludedNpcIds.length,
      rejectedActionTargetId: action.targetNpcId && !localNpcIds.has(String(action.targetNpcId))
        ? String(action.targetNpcId)
        : null,
    },
  };
}

export function narrativeReplayKey(context, options = {}) {
  return sha256({
    model: options.model ?? TRPG_NARRATIVE_MODEL,
    promptVersion: options.promptVersion ?? TRPG_NARRATIVE_PROMPT_VERSION,
    policy: stableValue(options.policy ?? {}),
    context,
  });
}

function stripFence(text) {
  return String(text ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
}

export function parseNarrativeJson(raw) {
  if (plainObject(raw)) return raw;
  return JSON.parse(stripFence(raw));
}

function forbiddenKeys(value, found = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((entry) => forbiddenKeys(entry, found));
    return found;
  }
  if (!plainObject(value)) return found;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_PROPOSAL_KEYS.has(String(key).toLowerCase())) found.add(key);
    forbiddenKeys(entry, found);
  }
  return found;
}

function allowedFlagPath(path) {
  return ALLOWED_FLAG_PREFIXES.some((prefix) => String(path ?? "").startsWith(prefix));
}

function validateChoice(choice, index, localNpcIds, errors) {
  if (!plainObject(choice)) {
    errors.push(`choices[${index}] is not an object`);
    return;
  }
  if (!boundedText(choice.id, 80)) errors.push(`choices[${index}].id is empty`);
  if (!boundedText(choice.label, 120)) errors.push(`choices[${index}].label is empty`);
  if (!INTENT_TYPES.includes(choice.intentType)) errors.push(`choices[${index}].intentType is invalid`);
  if (choice.targetNpcId && !localNpcIds.has(String(choice.targetNpcId))) {
    errors.push(`choices[${index}] targets an NPC who is not present`);
  }
}

function validateProposal(proposal, index, localNpcIds, errors) {
  if (!plainObject(proposal)) {
    errors.push(`proposals[${index}] is not an object`);
    return;
  }
  if (!PROPOSAL_TYPES.includes(proposal.type)) errors.push(`proposals[${index}].type is invalid`);
  if (!boundedText(proposal.reason, 240)) errors.push(`proposals[${index}].reason is empty`);
  if (proposal.targetNpcId && !localNpcIds.has(String(proposal.targetNpcId))) {
    errors.push(`proposals[${index}] targets an NPC who is not present`);
  }
  if (proposal.type === "flag_candidate" && !allowedFlagPath(proposal.flagPath)) {
    errors.push(`proposals[${index}].flagPath is not allowlisted`);
  }
  if (proposal.type === "npc_intent") {
    if (!boundedText(proposal.targetNpcId, 80)) errors.push(`proposals[${index}].targetNpcId is required for npc_intent`);
    if (!boundedText(proposal.intent, 120)) errors.push(`proposals[${index}].intent is required for npc_intent`);
  }
  const forbidden = [...forbiddenKeys(proposal)];
  if (forbidden.length) errors.push(`proposals[${index}] contains authoritative keys: ${forbidden.join(",")}`);
}

export function validateNarrativeOutput(value, context) {
  const errors = [];
  const localNpcIds = new Set(context.localNpcs.map((npc) => npc.id));
  if (!plainObject(value)) return { ok: false, errors: ["response is not an object"] };
  const narrative = boundedText(value.narrative, 1400);
  if (!narrative) errors.push("narrative is empty");
  const choices = Array.isArray(value.choices) ? value.choices : [];
  if (choices.length !== 3) errors.push(`choices must contain exactly 3 entries, got ${choices.length}`);
  choices.forEach((choice, index) => validateChoice(choice, index, localNpcIds, errors));
  const choiceIds = choices.map((choice) => String(choice?.id ?? ""));
  if (new Set(choiceIds).size !== choiceIds.length) errors.push("choice ids are duplicated");
  const choiceLabels = choices.map((choice) => boundedText(choice?.label, 120).replace(/[\s、。！？!?・「」『』（）()]/gu, ""));
  if (new Set(choiceLabels).size !== choiceLabels.length) errors.push("choice labels are semantically duplicated");
  const allowedChoiceIds = (context.allowedActionCandidates ?? []).map((candidate) => candidate.id);
  if (allowedChoiceIds.length) {
    const actual = [...choiceIds].sort();
    const expected = [...allowedChoiceIds].sort();
    if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
      errors.push("choice ids must exactly match allowedActionCandidates");
    }
    const candidatesById = new Map((context.allowedActionCandidates ?? []).map((candidate) => [candidate.id, candidate]));
    choices.forEach((choice, index) => {
      const candidate = candidatesById.get(String(choice?.id ?? ""));
      if (candidate && choice.intentType !== candidate.intentType) {
        errors.push(`choices[${index}].intentType must match its authoritative action candidate`);
      }
      if (candidate && (choice.targetNpcId ?? null) !== (candidate.targetNpcId ?? null)) {
        errors.push(`choices[${index}].targetNpcId must match its authoritative action candidate`);
      }
    });
  }
  const speeches = Array.isArray(value.speeches) ? value.speeches : [];
  if (speeches.length > 6) errors.push("too many speeches");
  speeches.forEach((speech, index) => {
    if (!plainObject(speech) || !localNpcIds.has(String(speech?.actorId))) {
      errors.push(`speeches[${index}] actor is not present`);
    }
    if (!boundedText(speech?.text, 500)) errors.push(`speeches[${index}].text is empty`);
  });
  if (context.action.type === "conversation" && context.action.targetNpcId) {
    const directReplies = speeches.filter((speech) => String(speech?.actorId) === context.action.targetNpcId);
    const replyLength = directReplies.reduce((sum, speech) => sum + boundedText(speech?.text, 500).length, 0);
    if (!directReplies.length) errors.push("conversation must include a reply from the target NPC");
    if (replyLength < 55) errors.push("conversation reply is too short to answer, add useful detail, and create a next hook");
    const firstReply = boundedText(directReplies[0]?.text, 500);
    if (/^(?:もっとも|そうだね|そうだな|なるほど|ふむ)[、。…\s]/u.test(firstReply)) {
      errors.push("conversation reply starts with an orphan acknowledgement instead of answering the player's actual words");
    }
    if (context.action.firstIntroduction) {
      const targetName = context.action.introductionName
        ?? context.localNpcs.find((npc) => npc.id === context.action.targetNpcId)?.name;
      if (targetName && !firstReply.includes(targetName)) {
        errors.push("first conversation must introduce the target NPC by name before continuing");
      }
      if (context.action.introductionName) {
        if (narrative.includes(context.action.introductionName)) {
          errors.push("first-introduction narrative must keep the target NPC anonymous");
        }
        choices.forEach((choice, index) => {
          if (boundedText(choice?.label, 120).includes(context.action.introductionName)) {
            errors.push(`choices[${index}].label reveals the target NPC name before introduction acknowledgement`);
          }
        });
      }
    }
    if (context.action.requiredDisclosure) {
      const combinedReply = directReplies.map((speech) => boundedText(speech?.text, 500)).join("\n");
      if (!combinedReply.includes(context.action.requiredDisclosure)) {
        errors.push("conversation reply must include the authoritative disclosed fact verbatim");
      }
    }
  }
  const proposals = Array.isArray(value.proposals) ? value.proposals : [];
  if (proposals.length > 5) errors.push("too many proposals");
  proposals.forEach((proposal, index) => validateProposal(proposal, index, localNpcIds, errors));
  return { ok: errors.length === 0, errors };
}

function defaultChoices(context) {
  if ((context.allowedActionCandidates ?? []).length === 3) {
    return context.allowedActionCandidates.map((candidate) => ({ ...candidate }));
  }
  const targetNpcId = context.action.targetNpcId ?? context.localNpcs[0]?.id ?? null;
  const candidates = targetNpcId
    ? [
      { id: "C1", label: "もう少し詳しく話を聞く", intentType: "ask", targetNpcId },
      { id: "C2", label: "周囲の様子を確かめる", intentType: "observe", targetNpcId: null },
      { id: "C3", label: "いったん会話を終える", intentType: "leave", targetNpcId: null },
    ]
    : [
      { id: "C1", label: "周囲を観察する", intentType: "observe", targetNpcId: null },
      { id: "C2", label: "手掛かりを調べる", intentType: "investigate", targetNpcId: null },
      { id: "C3", label: "別の行動へ移る", intentType: "leave", targetNpcId: null },
    ];
  return candidates;
}

function sentenceFragment(value) {
  return boundedText(value, 360).replace(/[。．.!！?？]+$/gu, "").trim();
}

function safeFallbackSpeeches(context) {
  const npc = context.localNpcs.find((entry) => entry.id === context.action.targetNpcId)
    ?? context.localNpcs[0]
    ?? null;
  if (!npc) return [];
  const fact = context.action.requiredDisclosure
    ?? npc.knownLocalFacts?.[0]
    ?? context.localRumors?.[0]?.text
    ?? null;
  const mission = context.missions.find((entry) => ["active", "available", "in_progress"].includes(entry.status))
    ?? context.missions[0]
    ?? null;
  const place = context.place.facilityName ?? context.place.locationId ?? "この辺り";
  const introductionName = context.action.introductionName ?? npc.name;
  const introduction = context.action.firstIntroduction ? `私は${introductionName}。` : "";
  const verification = "私の話だけで決めず、現場か最初に見た人へ確かめてほしい。聞いた相手と時刻も覚えておくと、古い噂と今の事実を分けられる。";
  const detail = {
    active_mission: mission
      ? `「${mission.title}」なら、今は「${mission.currentStep || "手掛かりを集める"}」を先に進めるべきだ。期限と行き先を確かめてから動いてくれ。`
      : `今すぐ任務として頼める話は持っていない。掲示や人だかりが出た時は、事情と期限を聞いてから動くといい。`,
    route_to_lead: mission
      ? `「${mission.currentStep || mission.title}」へ向かうなら、${place}を出る前に目印と危険な分かれ道を確かめてくれ。明るいうちに着ける時間を選ぶ方がいい。`
      : `${place}から先の道は、今日そこを通った人に目印と危険な分かれ道を聞くのが確実だ。`,
    local_concern: fact
      ? `${fact}という話が、今いちばん気に掛かっている。放っておけば困る人が増えるかもしれない。${verification}`
      : `${place}では、普段と違う人の出入りや品物の減り方が最初の兆しになる。まだ断言はできない。${verification}`,
    local_change: fact
      ? `${fact}という変化までは確かめた。ただ、いつから変わったかは、ここを毎日使う人にも聞いてほしい。${verification}`
      : `${place}を通る顔ぶれと運ばれる物が、いつもと少し違う。時間を変えてもう一度見れば、見間違いかどうか分かるはずだ。`,
    personal_stake: `${place}は私も毎日使う場所で、困っている顔を見れば放っておけない。それでも一人で決めつけるのは危険だから、確かな手掛かりを持ち帰ってほしい。`,
    local_rumor: context.action.requiredDisclosure
      ? `${context.action.requiredDisclosure}。そこから先は、話が届いた時刻と最初に見た人も辿って確かめてほしい。`
      : fact
        ? `${fact}という話は聞いている。誰が最初に、いつ話したのかまで辿れば、今も続く異変か古い噂かを分けられる。${verification}`
      : `その噂はまだ私のところまで届いていない。人が集まる場所で、誰が最初に、いつ話したのかまで尋ねてみてくれ。`,
    work_offer: `${place}で今すぐ手が要るのは、運搬や片づけのような短い仕事だ。始める前に仕事内容と賃金を確かめ、終わったら頼んだ本人へ報告してくれ。`,
    end_conversation: "分かった。ここで聞いた話も、現場が変われば古くなる。行き先で何を見つけたか、また会えた時に聞かせてくれ。",
  }[context.action.dialogueTopic] ?? (fact
    ? `${fact}という話なら知っている。${verification}`
    : `その件について、私が確かに知っていることはまだ少ない。ここで作り話をするより、人が集まる場所か現場を毎日使う人へ尋ねた方がいい。${verification}`);
  let text = `${introduction}${detail}`;
  if (npc.relationship <= -20 || /hostile|敵対|警戒/iu.test(npc.mood)) {
    text = `${introduction}まだ信用していない。それでも今話せる範囲は話す。${detail}`;
  } else if (npc.relationship >= 20 || /friendly|友好|好意/iu.test(npc.mood)) {
    text = `${introduction}分かる範囲なら、順に話そう。${detail}`;
  }
  return [{ actorId: npc.id, text, emotion: null }];
}

function fallbackNarrativeForAction(context, npc, place, normalizedOutcome) {
  if (npc && ["conversation", "talk"].includes(context.action.type)) {
    return {
      active_mission: `${npc.name}は任務の期限と手掛かりを思い返し、次に急ぐべき行動を整理した。`,
      route_to_lead: `${npc.name}は${place}から先の道を思い浮かべ、目印と危険な分かれ道を順に説明した。`,
      local_concern: `${npc.name}は周囲を見回し、ここで今いちばん気に掛けている問題を一つ挙げた。`,
      local_change: `${npc.name}は普段の様子と見比べながら、最近気づいた変化を具体的に話した。`,
      personal_stake: `${npc.name}は少し言葉を選び、この問題を放っておけない理由を自分の言葉で話した。`,
      local_rumor: `${npc.name}は噂を聞いた相手と時刻を思い返し、確かな部分と未確認の部分を分けた。`,
      work_offer: `${npc.name}は今ここで必要な仕事を挙げ、内容と賃金を先に説明した。`,
      end_conversation: `${npc.name}へ礼を伝え、聞いた情報を確かめるために会話を切り上げた。`,
    }[context.action.dialogueTopic]
      ?? `${npc.name}は問いかけを最後まで聞き、知っている事実と推測を分けて答えた。`;
  }
  return normalizedOutcome
    ? `${place}では、${normalizedOutcome}。周囲の状況を確かめながら、次の行動を選べる。`
    : `${place}の状況に大きな変化はない。周囲を見渡し、次の行動を選ぶ。`;
}

export function deterministicNarrativeFallback(context, reason = "model_unavailable") {
  const place = context.place.facilityName ?? context.place.locationId ?? "その場";
  const npc = context.localNpcs.find((entry) => entry.id === context.action.targetNpcId)
    ?? context.localNpcs[0]
    ?? null;
  const outcome = boundedText(
    context.authoritativeOutcome?.summary
      ?? context.authoritativeOutcome?.message
      ?? context.action.label,
    360,
  );
  const normalizedOutcome = sentenceFragment(outcome);
  return {
    narrative: fallbackNarrativeForAction(context, npc, place, normalizedOutcome),
    choices: defaultChoices(context),
    speeches: safeFallbackSpeeches(context),
    proposals: [],
    fallbackReason: reason,
  };
}

export function sanitizeNarrativeOutput(value, context) {
  const localNpcIds = new Set(context.localNpcs.map((npc) => npc.id));
  const allowedChoiceIds = new Set((context.allowedActionCandidates ?? []).map((candidate) => candidate.id));
  const fallback = deterministicNarrativeFallback(context, "sanitized_output");
  const choices = [];
  const usedIds = new Set();
  for (const candidate of Array.isArray(value?.choices) ? value.choices : []) {
    if (!plainObject(candidate) || choices.length >= 3) continue;
    const id = boundedText(candidate.id, 80);
    const label = boundedText(candidate.label, 120);
    const intentType = INTENT_TYPES.includes(candidate.intentType) ? candidate.intentType : null;
    const targetNpcId = candidate.targetNpcId && localNpcIds.has(String(candidate.targetNpcId))
      ? String(candidate.targetNpcId)
      : null;
    if (!id || !label || !intentType || usedIds.has(id) || (allowedChoiceIds.size && !allowedChoiceIds.has(id))) continue;
    usedIds.add(id);
    choices.push({ id, label, intentType, targetNpcId });
  }
  for (const candidate of fallback.choices) {
    if (choices.length >= 3) break;
    if (usedIds.has(candidate.id)) continue;
    usedIds.add(candidate.id);
    choices.push({ ...candidate });
  }

  const speeches = (Array.isArray(value?.speeches) ? value.speeches : [])
    .filter((speech) => plainObject(speech) && localNpcIds.has(String(speech.actorId)))
    .map((speech) => ({
      actorId: String(speech.actorId),
      text: boundedText(speech.text, 500),
      emotion: boundedText(speech.emotion, 60) || null,
    }))
    .filter((speech) => speech.text)
    .slice(0, 6);

  const proposals = (Array.isArray(value?.proposals) ? value.proposals : [])
    .filter((proposal) => {
      if (!plainObject(proposal) || !PROPOSAL_TYPES.includes(proposal.type)) return false;
      if (proposal.targetNpcId && !localNpcIds.has(String(proposal.targetNpcId))) return false;
      if (proposal.type === "flag_candidate" && !allowedFlagPath(proposal.flagPath)) return false;
      if (proposal.type === "npc_intent" && (!boundedText(proposal.targetNpcId, 80) || !boundedText(proposal.intent, 120))) return false;
      return forbiddenKeys(proposal).size === 0;
    })
    .map((proposal) => ({
      type: proposal.type,
      targetNpcId: proposal.targetNpcId ? String(proposal.targetNpcId) : null,
      intent: boundedText(proposal.intent, 120) || null,
      flagPath: boundedText(proposal.flagPath, 160) || null,
      value: boundedText(proposal.value, 240) || null,
      templateId: boundedText(proposal.templateId, 100) || null,
      troubleId: boundedText(proposal.troubleId, 40) || null,
      text: boundedText(proposal.text, 300) || null,
      reason: boundedText(proposal.reason, 240),
    }))
    .filter((proposal) => proposal.reason)
    .slice(0, 5);

  return {
    narrative: boundedText(value?.narrative, 1400) || fallback.narrative,
    choices,
    speeches,
    proposals,
  };
}

export function resolveNarrativeProposals(output, context, rules = {}) {
  const localNpcIds = new Set(context.localNpcs.map((npc) => npc.id));
  const allowedMissionTemplates = new Set(rules.allowedMissionTemplateIds ?? []);
  const allowedTroubleIds = new Set(rules.allowedTroubleIds ?? context.missions.map((mission) => mission.troubleId).filter(Boolean));
  const accepted = [];
  const rejected = [];
  for (const proposal of output.proposals ?? []) {
    let reason = null;
    if (proposal.type === "npc_intent" && !boundedText(proposal.targetNpcId, 80)) reason = "npc_intent_target_required";
    else if (proposal.type === "npc_intent" && !boundedText(proposal.intent, 120)) reason = "npc_intent_required";
    else if (proposal.targetNpcId && !localNpcIds.has(String(proposal.targetNpcId))) reason = "remote_npc";
    else if (proposal.type === "flag_candidate" && !allowedFlagPath(proposal.flagPath)) reason = "flag_not_allowlisted";
    else if (proposal.type === "special_mission_candidate" && !allowedMissionTemplates.has(proposal.templateId)) reason = "unknown_mission_template";
    else if (proposal.troubleId && !allowedTroubleIds.has(proposal.troubleId)) reason = "invisible_trouble";
    else if (forbiddenKeys(proposal).size) reason = "authoritative_mutation";
    else if (proposal.type === "npc_intent" && typeof rules.validateNpcIntentCandidate === "function") {
      try {
        const verdict = rules.validateNpcIntentCandidate(proposal, context);
        if (verdict === false) reason = "npc_intent_rejected";
        else if (typeof verdict === "string" && verdict) reason = verdict;
        else if (plainObject(verdict) && verdict.ok === false) reason = boundedText(verdict.reason, 120) || "npc_intent_rejected";
      } catch {
        reason = "npc_intent_validator_error";
      }
    }
    if (reason) rejected.push({ proposal, reason });
    else accepted.push({ proposal, status: "candidate_for_authoritative_resolver" });
  }
  return { accepted, rejected };
}
