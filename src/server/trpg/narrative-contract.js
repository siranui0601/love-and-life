import crypto from "node:crypto";

export const TRPG_NARRATIVE_MODEL = "gemini-2.5-flash-lite";
export const TRPG_NARRATIVE_PROMPT_VERSION = "trpg-narrative-v4.2";

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
    role: boundedText(npc?.role ?? npc?.occupation ?? npc?.type, 120),
    mood: boundedText(npc?.mood ?? npc?.initialStatus, 120),
    currentGoal: boundedText(npc?.currentGoal ?? npc?.goal, 180),
    relationship: Number.isFinite(Number(npc?.relationship)) ? Number(npc.relationship) : 0,
    speechStyle: boundedText(npc?.speechStyle, 180),
    knownLocalFacts: Array.isArray(npc?.knownLocalFacts)
      ? npc.knownLocalFacts.slice(0, 8).map((entry) => boundedText(entry, 180))
      : [],
  };
}

function normalizeMission(mission) {
  return {
    id: boundedText(mission?.id, 80),
    title: boundedText(mission?.title, 120),
    status: boundedText(mission?.status, 40),
    currentStep: boundedText(mission?.currentStep ?? mission?.step, 180),
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
    [...(state.presentNpcIds ?? []), action.targetNpcId]
      .filter(Boolean)
      .map(String),
  );
  const suppliedNpcs = Array.isArray(state.npcs) ? state.npcs : [];
  const localNpcs = suppliedNpcs
    .filter((npc) => presentNpcIds.has(String(npc?.id)))
    .map(normalizeNpc)
    .filter((npc) => npc.id)
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
    .slice(0, 12);

  const visibleRumorIds = new Set((state.visibleRumorIds ?? []).map(String));
  const rumors = (Array.isArray(state.localRumors) ? state.localRumors : state.rumors ?? [])
    .filter((rumor) => !visibleRumorIds.size || visibleRumorIds.has(String(rumor?.id)))
    .map(normalizeRumor)
    .slice(-12);

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
      targetNpcId: localNpcIds.has(String(action.targetNpcId)) ? String(action.targetNpcId) : null,
    },
    authoritativeOutcome: stableValue(state.authoritativeOutcome ?? input.authoritativeOutcome ?? {}),
    localNpcs,
    missions,
    localRumors: rumors,
    visibleFlags: stableValue(state.visibleFlags ?? {}),
  };

  return {
    context,
    audit: {
      suppliedNpcCount: suppliedNpcs.length,
      includedNpcIds: [...localNpcIds].sort(),
      excludedNpcIds: [...new Set(excludedNpcIds)].sort(),
      remoteNpcDataRemoved: excludedNpcIds.length,
    },
  };
}

export function narrativeReplayKey(context, options = {}) {
  return sha256({
    model: options.model ?? TRPG_NARRATIVE_MODEL,
    promptVersion: options.promptVersion ?? TRPG_NARRATIVE_PROMPT_VERSION,
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
  const speeches = Array.isArray(value.speeches) ? value.speeches : [];
  if (speeches.length > 6) errors.push("too many speeches");
  speeches.forEach((speech, index) => {
    if (!plainObject(speech) || !localNpcIds.has(String(speech?.actorId))) {
      errors.push(`speeches[${index}] actor is not present`);
    }
    if (!boundedText(speech?.text, 500)) errors.push(`speeches[${index}].text is empty`);
  });
  const proposals = Array.isArray(value.proposals) ? value.proposals : [];
  if (proposals.length > 5) errors.push("too many proposals");
  proposals.forEach((proposal, index) => validateProposal(proposal, index, localNpcIds, errors));
  return { ok: errors.length === 0, errors };
}

function defaultChoices(context) {
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

export function deterministicNarrativeFallback(context, reason = "model_unavailable") {
  const place = context.place.facilityName ?? context.place.locationId ?? "その場";
  const outcome = boundedText(
    context.authoritativeOutcome?.summary
      ?? context.authoritativeOutcome?.message
      ?? context.action.label,
    360,
  );
  return {
    narrative: outcome
      ? `${place}では、${outcome}。周囲の状況を確かめながら、次の行動を選べる。`
      : `${place}の状況に大きな変化はない。周囲を見渡し、次の行動を選ぶ。`,
    choices: defaultChoices(context),
    speeches: [],
    proposals: [],
    fallbackReason: reason,
  };
}

export function sanitizeNarrativeOutput(value, context) {
  const localNpcIds = new Set(context.localNpcs.map((npc) => npc.id));
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
    if (!id || !label || !intentType || usedIds.has(id)) continue;
    usedIds.add(id);
    choices.push({ id, label, intentType, targetNpcId });
  }
  for (const candidate of fallback.choices) {
    if (choices.length >= 3) break;
    let id = candidate.id;
    while (usedIds.has(id)) id = `${id}F`;
    usedIds.add(id);
    choices.push({ ...candidate, id });
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
    if (proposal.targetNpcId && !localNpcIds.has(String(proposal.targetNpcId))) reason = "remote_npc";
    else if (proposal.type === "flag_candidate" && !allowedFlagPath(proposal.flagPath)) reason = "flag_not_allowlisted";
    else if (proposal.type === "special_mission_candidate" && !allowedMissionTemplates.has(proposal.templateId)) reason = "unknown_mission_template";
    else if (proposal.troubleId && !allowedTroubleIds.has(proposal.troubleId)) reason = "invisible_trouble";
    else if (forbiddenKeys(proposal).size) reason = "authoritative_mutation";
    if (reason) rejected.push({ proposal, reason });
    else accepted.push({ proposal, status: "candidate_for_authoritative_resolver" });
  }
  return { accepted, rejected };
}
