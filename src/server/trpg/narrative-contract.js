import crypto from "node:crypto";

export const TRPG_NARRATIVE_MODEL = "gemini-2.5-flash";
export const TRPG_NARRATIVE_PROMPT_VERSION = "trpg-narrative-v5.3-world-actions";

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

export const ACTION_KINDS = Object.freeze([
  "candidate",
  "talk",
  "investigate",
  "move_local",
  "move_region",
  "wait",
  "rest",
  "eat",
  "work",
  "prepare",
]);

export const PROPOSAL_TYPES = Object.freeze([
  "npc_intent",
  "flag_candidate",
  "local_fact_candidate",
  "npc_memory_candidate",
  "mission_lead_candidate",
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

const DIEGETIC_META_PATTERN = /(?:ミッション|クエスト|選択肢|3択|三択|ボタン|タップ|クリック|画面|メニュー|フラグ|プレイヤー|ゲーム|チュートリアル|レベル|ステータス|システム|resolver|Gemini|(?:^|[^A-Za-z])(?:UI|SP|HP|MP)(?:[^A-Za-z]|$)|ログ(?:を|へ|で|に|が|は|一覧|画面))/iu;

function containsDiegeticMetaLanguage(value) {
  return DIEGETIC_META_PATTERN.test(String(value ?? ""));
}

const INTERNAL_VISIBLE_ID_PATTERN = /(?:[（(]\s*(?:NPC\d+|SKL-[A-Z0-9-]+|LOC_[A-Z0-9_]+|MSN-[A-Z0-9-]+|ACTION:[^)）\s]+)\s*[）)]|\b(?:NPC\d+|SKL-[A-Z0-9-]+|LOC_[A-Z0-9_]+|MSN-[A-Z0-9-]+|ACTION:[^\s、。！？!?）)]+)\b)/gu;
const EMPTY_REACTION_PATTERN = /^(?:[.．。…・⋯—―\-\s]+|(?:ふむ|そうだな|なるほど)[。…\s]*)$/u;

function stripInternalVisibleIds(value) {
  return String(value ?? "")
    .replace(INTERNAL_VISIBLE_ID_PATTERN, "")
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/\s+([、。！？!?])/gu, "$1")
    .trim();
}

function isEmptyReaction(value) {
  return EMPTY_REACTION_PATTERN.test(String(value ?? "").trim());
}

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
        required: ["id", "label", "intentType", "actionKind"],
        properties: {
          id: { type: "STRING" },
          label: { type: "STRING" },
          intentType: { type: "STRING", enum: [...INTENT_TYPES] },
          actionKind: { type: "STRING", enum: [...ACTION_KINDS] },
          candidateId: { type: "STRING", nullable: true },
          targetNpcId: { type: "STRING", nullable: true },
          destinationFacilityId: { type: "STRING", nullable: true },
          destinationHub: { type: "STRING", nullable: true },
          minutes: { type: "INTEGER", nullable: true },
          topic: { type: "STRING", nullable: true },
          approach: { type: "STRING", nullable: true },
          workProposal: {
            type: "OBJECT",
            nullable: true,
            properties: {
              title: { type: "STRING" },
              durationClass: { type: "STRING", enum: ["short", "half_day", "full_day"] },
              riskClass: { type: "STRING", enum: ["low", "medium", "high"] },
            },
          },
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
          subjectId: { type: "STRING", nullable: true },
          predicate: { type: "STRING", nullable: true },
          scope: { type: "STRING", nullable: true },
          locationId: { type: "STRING", nullable: true },
          summary: { type: "STRING", nullable: true },
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
    recentMemories: Array.isArray(npc?.recentMemories)
      ? npc.recentMemories.slice(-6).map((entry) => boundedText(entry, 240)).filter(Boolean)
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
    actionType: boundedText(candidate?.actionType, 60) || null,
    targetNpcId: rawTargetNpcId,
    missionId: boundedText(candidate?.missionId, 80) || null,
    stepId: boundedText(candidate?.stepId, 80) || null,
    minutes: Number.isFinite(Number(candidate?.minutes)) ? Math.max(0, Number(candidate.minutes)) : 0,
    workOffer: candidate?.workOffer === true,
    progressRole: candidate?.progressRole === "progress" ? "progress" : "optional",
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

function normalizeWorldAffordances(value, localNpcIds) {
  const source = plainObject(value) ? value : {};
  const localFacilities = (Array.isArray(source.localFacilities) ? source.localFacilities : [])
    .map((entry) => ({
      id: boundedText(entry?.id, 100),
      name: boundedText(entry?.name, 120),
      minutes: Number.isFinite(Number(entry?.minutes)) ? Math.max(1, Math.min(720, Number(entry.minutes))) : null,
    }))
    .filter((entry) => entry.id && entry.name)
    .slice(0, 20);
  const regionalDestinations = (Array.isArray(source.regionalDestinations) ? source.regionalDestinations : [])
    .map((entry) => ({
      hub: boundedText(entry?.hub, 100),
      minutes: Number.isFinite(Number(entry?.minutes)) ? Math.max(1, Math.min(4320, Number(entry.minutes))) : null,
    }))
    .filter((entry) => entry.hub)
    .slice(0, 12);
  return {
    presentNpcIds: (Array.isArray(source.presentNpcIds) ? source.presentNpcIds : [])
      .map(String).filter((id) => localNpcIds.has(id)).slice(0, 12),
    localFacilities,
    regionalDestinations,
    canInvestigate: source.canInvestigate !== false,
    canWait: source.canWait !== false,
    canPrepare: source.canPrepare !== false,
    canWork: source.canWork === true,
    canEat: source.canEat === true,
    canRest: source.canRest === true,
    canLodge: source.canLodge === true,
    hunger: Number.isFinite(Number(source.hunger)) ? Math.max(0, Math.min(100, Number(source.hunger))) : 0,
    fatigue: Number.isFinite(Number(source.fatigue)) ? Math.max(0, Math.min(100, Number(source.fatigue))) : 0,
    note: boundedText(source.note, 360) || null,
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
    .sort((left, right) => (left.progressRole === right.progressRole ? 0 : left.progressRole === "progress" ? -1 : 1)
      || left.id.localeCompare(right.id))
    .slice(0, 12);

  const progressContract = plainObject(state.progressContract) ? {
    mode: state.progressContract.mode === "must_offer_progress" ? "must_offer_progress" : "free",
    anchorCandidateIds: Array.isArray(state.progressContract.anchorCandidateIds)
      ? state.progressContract.anchorCandidateIds.map((entry) => boundedText(entry, 120)).filter(Boolean).slice(0, 9)
      : [],
    missionId: boundedText(state.progressContract.missionId, 80) || null,
    currentStep: boundedText(state.progressContract.currentStep, 180) || null,
    rationale: boundedText(state.progressContract.rationale, 240) || null,
  } : { mode: "free", anchorCandidateIds: [], missionId: null, currentStep: null, rationale: null };
  const continuityContract = plainObject(state.continuityContract) ? {
    mode: state.continuityContract.mode === "must_offer_continuation" ? "must_offer_continuation" : "free",
    intent: boundedText(state.continuityContract.intent, 40) || null,
    candidateIds: Array.isArray(state.continuityContract.candidateIds)
      ? state.continuityContract.candidateIds.map((entry) => boundedText(entry, 120)).filter(Boolean).slice(0, 9)
      : [],
    rationale: boundedText(state.continuityContract.rationale, 240) || null,
  } : { mode: "free", intent: null, candidateIds: [], rationale: null };
  const choiceDiversityContract = plainObject(state.choiceDiversityContract) ? {
    minimumGeneratedChoices: Math.max(0, Math.min(3, Number(state.choiceDiversityContract.minimumGeneratedChoices ?? 0))),
    maximumCandidateChoices: Math.max(0, Math.min(3, Number(state.choiceDiversityContract.maximumCandidateChoices ?? 3))),
    rationale: boundedText(state.choiceDiversityContract.rationale, 240) || null,
  } : { minimumGeneratedChoices: 0, maximumCandidateChoices: 3, rationale: null };
  const reactionContract = plainObject(state.reactionContract) ? {
    requiredActorIds: Array.isArray(state.reactionContract.requiredActorIds)
      ? state.reactionContract.requiredActorIds.map((entry) => boundedText(entry, 80)).filter((id) => localNpcIds.has(id)).slice(0, 6)
      : [],
    goals: Array.isArray(state.reactionContract.goals)
      ? state.reactionContract.goals.map((entry) => boundedText(entry, 180)).filter(Boolean).slice(0, 8)
      : [],
  } : { requiredActorIds: [], goals: [] };
  const workMarket = plainObject(state.workMarket) ? {
    region: boundedText(state.workMarket.region, 100) || null,
    baseHourlyWage: Number.isFinite(Number(state.workMarket.baseHourlyWage)) ? Number(state.workMarket.baseHourlyWage) : null,
    daypart: boundedText(state.workMarket.daypart, 40) || null,
    localDemandTags: Array.isArray(state.workMarket.localDemandTags)
      ? state.workMarket.localDemandTags.map((entry) => boundedText(entry, 80)).filter(Boolean).slice(0, 10)
      : [],
    recentWorkTitles: Array.isArray(state.workMarket.recentWorkTitles)
      ? state.workMarket.recentWorkTitles.map((entry) => boundedText(entry, 120)).filter(Boolean).slice(-8)
      : [],
    durationClasses: ["short", "half_day", "full_day"],
    riskClasses: ["low", "medium", "high"],
    note: boundedText(state.workMarket.note, 240) || null,
  } : null;

  const recentChoices = Array.isArray(state.recentChoices)
    ? state.recentChoices.map((entry) => boundedText(entry, 180)).filter(Boolean).slice(-12)
    : [];

  const context = {
    contractVersion: "trpg-local-context-v2",
    locale: boundedText(input.locale ?? "ja-JP", 20),
    sceneMode: boundedText(input.sceneMode ?? state.sceneMode ?? "free_roam", 40),
    time: {
      day: Math.max(1, Number(state.day ?? 1)),
      hour: Math.max(0, Math.min(24, Number(state.hour ?? 10))),
      minute: Math.max(0, Math.min(59, Number(state.minute ?? 0))),
      daypart: boundedText(state.daypart ?? "day", 20),
      weather: plainObject(state.weather) ? {
        id: boundedText(state.weather.id, 40),
        label: boundedText(state.weather.label, 60),
        intensity: Number.isFinite(Number(state.weather.intensity)) ? Number(state.weather.intensity) : 0,
        temperatureC: Number.isFinite(Number(state.weather.temperatureC)) ? Number(state.weather.temperatureC) : null,
        description: boundedText(state.weather.description, 240) || null,
      } : null,
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
      needs: plainObject(state.player?.needs) ? {
        hunger: Number.isFinite(Number(state.player.needs.hunger)) ? Math.max(0, Math.min(100, Number(state.player.needs.hunger))) : 0,
        fatigue: Number.isFinite(Number(state.player.needs.fatigue)) ? Math.max(0, Math.min(100, Number(state.player.needs.fatigue))) : 0,
      } : { hunger: 0, fatigue: 0 },
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
      movementScope: boundedText(action.movementScope, 40) || null,
      originLocation: boundedText(action.originLocation, 100) || null,
      originFacilityId: boundedText(action.originFacilityId, 100) || null,
      destinationHub: boundedText(action.destinationHub, 100) || null,
      destinationFacilityId: boundedText(action.destinationFacilityId, 100) || null,
      travelMinutes: Number.isFinite(Number(action.travelMinutes)) ? Math.max(0, Number(action.travelMinutes)) : 0,
      departureWeather: plainObject(action.departureWeather) ? stableValue(action.departureWeather) : null,
      arrivalWeather: plainObject(action.arrivalWeather) ? stableValue(action.arrivalWeather) : null,
    },
    authoritativeOutcome: stableValue(state.authoritativeOutcome ?? input.authoritativeOutcome ?? {}),
    localNpcs,
    missions,
    localRumors: rumors,
    allowedActionCandidates,
    progressContract,
    continuityContract,
    choiceDiversityContract,
    reactionContract,
    workMarket,
    recentChoices,
    worldAffordances: normalizeWorldAffordances(state.worldAffordances, localNpcIds),
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
  if (!boundedText(choice.id, 120)) errors.push(`choices[${index}].id is empty`);
  if (!boundedText(choice.label, 180)) errors.push(`choices[${index}].label is empty`);
  if (!INTENT_TYPES.includes(choice.intentType)) errors.push(`choices[${index}].intentType is invalid`);
  const actionKind = ACTION_KINDS.includes(choice.actionKind) ? choice.actionKind : "candidate";
  if (choice.actionKind && !ACTION_KINDS.includes(choice.actionKind)) errors.push(`choices[${index}].actionKind is invalid`);
  if (choice.targetNpcId && !localNpcIds.has(String(choice.targetNpcId))) {
    errors.push(`choices[${index}] targets an NPC who is not present`);
  }
  if (choice.workProposal !== undefined && choice.workProposal !== null) {
    if (!plainObject(choice.workProposal) || !boundedText(choice.workProposal.title, 120)) {
      errors.push(`choices[${index}].workProposal.title is required`);
    }
    if (!["short", "half_day", "full_day"].includes(choice.workProposal?.durationClass)) {
      errors.push(`choices[${index}].workProposal.durationClass is invalid`);
    }
    if (!["low", "medium", "high"].includes(choice.workProposal?.riskClass)) {
      errors.push(`choices[${index}].workProposal.riskClass is invalid`);
    }
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
  if (["local_fact_candidate", "npc_memory_candidate"].includes(proposal.type)) {
    if (!boundedText(proposal.subjectId, 120)) errors.push(`proposals[${index}].subjectId is required`);
    if (!boundedText(proposal.predicate, 120)) errors.push(`proposals[${index}].predicate is required`);
  }
  if (proposal.type === "mission_lead_candidate") {
    if (!boundedText(proposal.troubleId, 40)) errors.push(`proposals[${index}].troubleId is required for mission_lead_candidate`);
    if (!boundedText(proposal.summary, 240)) errors.push(`proposals[${index}].summary is required for mission_lead_candidate`);
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
  if (containsDiegeticMetaLanguage(narrative)) errors.push("narrative contains non-diegetic game or UI language");
  const choices = Array.isArray(value.choices) ? value.choices : [];
  if (choices.length !== 3) errors.push(`choices must contain exactly 3 entries, got ${choices.length}`);
  choices.forEach((choice, index) => validateChoice(choice, index, localNpcIds, errors));
  const choiceIds = choices.map((choice) => String(choice?.id ?? ""));
  if (new Set(choiceIds).size !== choiceIds.length) errors.push("choice ids are duplicated");
  const choiceLabels = choices.map((choice) => boundedText(choice?.label, 120).replace(/[\s、。！？!?・「」『』（）()]/gu, ""));
  if (new Set(choiceLabels).size !== choiceLabels.length) errors.push("choice labels are semantically duplicated");
  const allowedChoiceIds = new Set((context.allowedActionCandidates ?? []).map((candidate) => candidate.id));
  const candidatesById = new Map((context.allowedActionCandidates ?? []).map((candidate) => [candidate.id, candidate]));
  const affordances = context.worldAffordances ?? {};
  const localFacilityIds = new Set((affordances.localFacilities ?? []).map((entry) => entry.id));
  const regionalHubs = new Set((affordances.regionalDestinations ?? []).map((entry) => entry.hub));
  choices.forEach((choice, index) => {
    const actionKind = ACTION_KINDS.includes(choice?.actionKind) ? choice.actionKind : (allowedChoiceIds.has(String(choice?.id ?? "")) ? "candidate" : null);
    if (!actionKind) {
      errors.push(`choices[${index}] does not declare an executable action kind`);
      return;
    }
    if (actionKind === "candidate") {
      const candidateId = String(choice?.candidateId ?? choice?.id ?? "");
      const candidate = candidatesById.get(candidateId);
      if (!candidate) {
        errors.push(`choices[${index}].candidateId is not in the executable candidate pool`);
        return;
      }
      if (choice.intentType !== candidate.intentType) errors.push(`choices[${index}].intentType must match its authoritative action candidate`);
      if ((choice.targetNpcId ?? candidate.targetNpcId ?? null) !== (candidate.targetNpcId ?? null)) errors.push(`choices[${index}].targetNpcId must match its authoritative action candidate`);
      if (choice.workProposal && !candidate.workOffer) errors.push(`choices[${index}].workProposal is only allowed for a work candidate`);
      return;
    }
    if (actionKind === "talk" && !localNpcIds.has(String(choice?.targetNpcId ?? ""))) errors.push(`choices[${index}] talk target is not present`);
    if (actionKind === "move_local" && !localFacilityIds.has(String(choice?.destinationFacilityId ?? ""))) errors.push(`choices[${index}] local destination is not available`);
    if (actionKind === "move_region" && !regionalHubs.has(String(choice?.destinationHub ?? ""))) errors.push(`choices[${index}] regional destination is not available`);
    if (actionKind === "work" && affordances.canWork !== true) errors.push(`choices[${index}] work is not available here`);
    if (actionKind === "eat" && affordances.canEat !== true) errors.push(`choices[${index}] eating is not available here`);
    if (actionKind === "rest" && affordances.canRest !== true && affordances.canLodge !== true) errors.push(`choices[${index}] rest is not available here`);
    if (actionKind === "investigate" && affordances.canInvestigate !== true) errors.push(`choices[${index}] investigation is not available here`);
  });
  if (context.progressContract?.mode === "must_offer_progress") {
    const anchors = new Set(context.progressContract.anchorCandidateIds ?? []);
    if (!choices.some((choice) => anchors.has(String(choice?.candidateId ?? choice?.id ?? "")))) {
      errors.push("choices must include at least one progress anchor candidate");
    }
  }
  if (context.continuityContract?.mode === "must_offer_continuation") {
    const continuations = new Set(context.continuityContract.candidateIds ?? []);
    if (continuations.size && !choices.some((choice) => continuations.has(String(choice?.candidateId ?? choice?.id ?? "")))) {
      errors.push("choices must include the active player-intent continuation candidate");
    }
  }
  const generatedChoiceCount = choices.filter((choice) => {
    const kind = ACTION_KINDS.includes(choice?.actionKind)
      ? choice.actionKind
      : (allowedChoiceIds.has(String(choice?.id ?? "")) ? "candidate" : null);
    return kind && kind !== "candidate";
  }).length;
  if (generatedChoiceCount < Number(context.choiceDiversityContract?.minimumGeneratedChoices ?? 0)) {
    errors.push(`choices must include at least ${context.choiceDiversityContract.minimumGeneratedChoices} generated world actions`);
  }
  const candidateChoiceCount = choices.length - generatedChoiceCount;
  if (candidateChoiceCount > Number(context.choiceDiversityContract?.maximumCandidateChoices ?? 3)) {
    errors.push(`choices may include at most ${context.choiceDiversityContract.maximumCandidateChoices} server candidate actions`);
  }
  const speeches = Array.isArray(value.speeches) ? value.speeches : [];
  if (speeches.length > 6) errors.push("too many speeches");
  speeches.forEach((speech, index) => {
    if (!plainObject(speech) || !localNpcIds.has(String(speech?.actorId))) {
      errors.push(`speeches[${index}] actor is not present`);
    }
    if (!boundedText(speech?.text, 500)) errors.push(`speeches[${index}].text is empty`);
    if (isEmptyReaction(speech?.text)) errors.push(`speeches[${index}].text is an empty reaction`);
    if (containsDiegeticMetaLanguage(speech?.text)) errors.push(`speeches[${index}].text contains non-diegetic game or UI language`);
  });
  for (const actorId of context.reactionContract?.requiredActorIds ?? []) {
    if (localNpcIds.has(actorId) && !speeches.some((speech) => String(speech?.actorId) === actorId && !isEmptyReaction(speech?.text))) {
      errors.push(`required reaction actor missing: ${actorId}`);
    }
  }
  if (context.action.type === "conversation" && context.action.targetNpcId) {
    const directReplies = speeches.filter((speech) => String(speech?.actorId) === context.action.targetNpcId);
    const replyLength = directReplies.reduce((sum, speech) => sum + boundedText(speech?.text, 500).length, 0);
    if (!directReplies.length) errors.push("conversation must include a reply from the target NPC");
    if (directReplies.length && replyLength < 12) errors.push("conversation reply is too short to carry useful meaning");
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

function sanitizeDiegeticText(value, maximum = 1400) {
  return stripInternalVisibleIds(boundedText(value, maximum)
    .replaceAll("ミッション", "依頼")
    .replaceAll("クエスト", "依頼")
    .replaceAll("選択肢", "行動")
    .replaceAll("三択", "三つの道")
    .replaceAll("3択", "三つの道")
    .replaceAll("プレイヤー", "旅人")
    .replaceAll("チュートリアル", "案内")
    .replaceAll("ステータス", "状態")
    .replaceAll("システム", "仕組み")
    .replaceAll("ボタン", "印")
    .replaceAll("タップ", "触れる")
    .replaceAll("クリック", "選ぶ")
    .replaceAll("画面", "視界")
    .replaceAll("メニュー", "一覧")
    .replaceAll("フラグ", "兆し")
    .replaceAll("レベル", "段階")
    .replaceAll("resolver", "裁定")
    .replaceAll("ログ", "記録")
    .replaceAll("HP", "体力")
    .replaceAll("MP", "魔力")
    .replaceAll("SP", "技の余力")
    .replace(/\bUI\b/gu, "表示")
    .replace(/\bGemini\b/gu, "語り手")
    .trim());
}

function candidateChoice(candidate, overrides = {}) {
  return {
    id: candidate.id,
    actionKind: "candidate",
    candidateId: candidate.id,
    label: sanitizeDiegeticText(overrides.label ?? candidate.label, 180) || candidate.label,
    intentType: candidate.intentType,
    targetNpcId: candidate.targetNpcId ?? null,
    approach: sanitizeDiegeticText(overrides.approach, 180) || null,
    ...(overrides.workProposal ? { workProposal: overrides.workProposal } : {}),
  };
}

function defaultChoices(context) {
  const pool = context.allowedActionCandidates ?? [];
  if (!pool.length) {
    const targetNpcId = context.action.targetNpcId ?? context.localNpcs[0]?.id ?? null;
    return targetNpcId
      ? [
        { id: "C1", actionKind: "talk", label: "もう少し詳しく話を聞く", intentType: "ask", targetNpcId },
        { id: "C2", actionKind: "investigate", label: "周囲の様子を確かめる", intentType: "observe", targetNpcId: null },
        { id: "C3", actionKind: "prepare", label: "いったん会話を終え、次の行動を考える", intentType: "leave", targetNpcId: null },
      ]
      : [
        { id: "C1", actionKind: "investigate", label: "周囲を観察する", intentType: "observe", targetNpcId: null },
        { id: "C2", actionKind: "investigate", label: "手掛かりを調べる", intentType: "investigate", targetNpcId: null },
        { id: "C3", actionKind: "prepare", label: "別の行動へ移る準備をする", intentType: "leave", targetNpcId: null },
      ];
  }
  const anchors = new Set(context.progressContract?.anchorCandidateIds ?? []);
  const selected = [];
  const add = (candidate) => {
    if (candidate && !selected.some((entry) => entry.id === candidate.id)) selected.push(candidateChoice(candidate));
  };
  if (context.progressContract?.mode === "must_offer_progress") add(pool.find((candidate) => anchors.has(candidate.id)));
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

function sentenceFragment(value) {
  return sanitizeDiegeticText(value, 360).replace(/[。．.!！?？]+$/gu, "").trim();
}

function safeFallbackSpeeches(context) {
  const npc = context.localNpcs.find((entry) => entry.id === context.action.targetNpcId) ?? null;
  if (!npc || !context.action.requiredDisclosure) return [];
  const introductionName = context.action.introductionName ?? npc.name;
  const introduction = context.action.firstIntroduction && introductionName ? `私は${introductionName}。` : "";
  return [{
    actorId: npc.id,
    text: `${introduction}${sanitizeDiegeticText(context.action.requiredDisclosure, 360)}`,
    emotion: null,
  }];
}

function fallbackNarrativeForAction(context, npc, place, normalizedOutcome) {
  if (normalizedOutcome) return `${place}では、${normalizedOutcome}。`;
  if (npc && ["conversation", "talk"].includes(context.action.type)) {
    return `${npc.name}は問いかけを聞き、返す言葉を探している。`;
  }
  return `${place}の様子を確かめ、次に取れる行動を見定める。`;
}

export function deterministicNarrativeFallback(context, reason = "model_unavailable") {
  const place = context.place.facilityName ?? context.place.locationId ?? "その場";
  const npc = context.localNpcs.find((entry) => entry.id === context.action.targetNpcId) ?? null;
  const outcome = context.authoritativeOutcome?.summary
    ?? context.authoritativeOutcome?.message
    ?? context.authoritativeOutcome?.discovery?.text
    ?? context.action.label;
  return {
    narrative: fallbackNarrativeForAction(context, npc, place, sentenceFragment(outcome)),
    choices: defaultChoices(context),
    speeches: safeFallbackSpeeches(context),
    proposals: [],
    fallbackReason: reason,
  };
}

function normalizedWorkProposal(value) {
  if (!plainObject(value) || !boundedText(value.title, 120)) return null;
  return {
    title: sanitizeDiegeticText(value.title, 120),
    durationClass: ["short", "half_day", "full_day"].includes(value.durationClass) ? value.durationClass : "short",
    riskClass: ["low", "medium", "high"].includes(value.riskClass) ? value.riskClass : "low",
  };
}

function normalizedProposal(proposal, context, localNpcIds) {
  if (!plainObject(proposal) || !PROPOSAL_TYPES.includes(proposal.type)) return null;
  if (forbiddenKeys(proposal).size) return null;
  const reason = sanitizeDiegeticText(proposal.reason, 240);
  if (!reason) return null;
  const targetNpcId = proposal.targetNpcId && localNpcIds.has(String(proposal.targetNpcId))
    ? String(proposal.targetNpcId)
    : null;
  const placeSubject = context.place.facilityId ?? context.place.locationId ?? null;
  const normalized = {
    type: proposal.type,
    targetNpcId,
    intent: sanitizeDiegeticText(proposal.intent ?? proposal.text, 120) || null,
    flagPath: boundedText(proposal.flagPath, 160) || null,
    value: sanitizeDiegeticText(proposal.value, 240) || null,
    templateId: boundedText(proposal.templateId, 100) || null,
    troubleId: boundedText(proposal.troubleId, 40) || null,
    text: sanitizeDiegeticText(proposal.text, 300) || null,
    subjectId: boundedText(proposal.subjectId, 120) || null,
    predicate: boundedText(proposal.predicate, 120) || null,
    scope: boundedText(proposal.scope, 80) || null,
    locationId: boundedText(proposal.locationId, 100) || null,
    summary: sanitizeDiegeticText(proposal.summary ?? proposal.text ?? proposal.reason, 300) || null,
    reason,
  };
  if (normalized.type === "flag_candidate" && !allowedFlagPath(normalized.flagPath)) return null;
  if (normalized.type === "npc_intent") {
    if (!normalized.targetNpcId || !normalized.intent) return null;
  }
  if (normalized.type === "local_fact_candidate") {
    normalized.subjectId ??= placeSubject;
    normalized.predicate ??= "observed_state";
    normalized.locationId ??= context.place.locationId ?? null;
    if (!normalized.subjectId || !normalized.summary) return null;
  }
  if (normalized.type === "npc_memory_candidate") {
    normalized.subjectId ??= normalized.targetNpcId;
    normalized.predicate ??= "remembered_event";
    if (!normalized.subjectId || !localNpcIds.has(normalized.subjectId) || !normalized.summary) return null;
  }
  if (normalized.type === "mission_lead_candidate") {
    if (!normalized.troubleId || !normalized.summary) return null;
    normalized.locationId ??= context.place.locationId ?? null;
  }
  return normalized;
}

export function sanitizeNarrativeOutput(value, context) {
  const localNpcIds = new Set(context.localNpcs.map((npc) => npc.id));
  const candidatesById = new Map((context.allowedActionCandidates ?? []).map((candidate) => [candidate.id, candidate]));
  const affordances = context.worldAffordances ?? {};
  const localFacilityIds = new Set((affordances.localFacilities ?? []).map((entry) => entry.id));
  const regionalHubs = new Set((affordances.regionalDestinations ?? []).map((entry) => entry.hub));
  const fallback = deterministicNarrativeFallback(context, "sanitized_output");
  const choices = [];
  const usedIds = new Set();
  for (const generated of Array.isArray(value?.choices) ? value.choices : []) {
    if (!plainObject(generated) || choices.length >= 3) continue;
    const rawId = boundedText(generated.id, 120) || `GEN-${choices.length + 1}`;
    const actionKind = ACTION_KINDS.includes(generated.actionKind)
      ? generated.actionKind
      : (candidatesById.has(boundedText(generated.candidateId ?? rawId, 120)) ? "candidate" : null);
    if (!actionKind) continue;
    if (actionKind === "candidate") {
      const candidateId = boundedText(generated.candidateId ?? rawId, 120);
      const candidate = candidatesById.get(candidateId);
      if (!candidate || usedIds.has(candidateId)) continue;
      const workProposal = candidate.workOffer ? normalizedWorkProposal(generated.workProposal) : null;
      usedIds.add(candidateId);
      choices.push(candidateChoice(candidate, { label: generated.label, approach: generated.approach, workProposal }));
      continue;
    }
    if (actionKind === "talk" && !localNpcIds.has(String(generated.targetNpcId ?? ""))) continue;
    if (actionKind === "move_local" && !localFacilityIds.has(String(generated.destinationFacilityId ?? ""))) continue;
    if (actionKind === "move_region" && !regionalHubs.has(String(generated.destinationHub ?? ""))) continue;
    if (actionKind === "work" && affordances.canWork !== true) continue;
    if (actionKind === "eat" && affordances.canEat !== true) continue;
    if (actionKind === "rest" && affordances.canRest !== true && affordances.canLodge !== true) continue;
    if (actionKind === "investigate" && affordances.canInvestigate !== true) continue;
    const uniqueId = rawId.startsWith("GEN-") ? rawId : `GEN-${choices.length + 1}-${rawId}`;
    if (usedIds.has(uniqueId)) continue;
    usedIds.add(uniqueId);
    choices.push({
      id: uniqueId,
      actionKind,
      candidateId: null,
      label: sanitizeDiegeticText(generated.label, 180),
      intentType: INTENT_TYPES.includes(generated.intentType) ? generated.intentType : "observe",
      targetNpcId: localNpcIds.has(String(generated.targetNpcId ?? "")) ? String(generated.targetNpcId) : null,
      destinationFacilityId: boundedText(generated.destinationFacilityId, 100) || null,
      destinationHub: boundedText(generated.destinationHub, 100) || null,
      minutes: Number.isFinite(Number(generated.minutes)) ? Math.max(1, Math.min(1440, Number(generated.minutes))) : null,
      topic: sanitizeDiegeticText(generated.topic, 160) || null,
      approach: sanitizeDiegeticText(generated.approach, 180) || null,
      ...(actionKind === "work" ? { workProposal: normalizedWorkProposal(generated.workProposal) } : {}),
    });
  }

  const anchors = new Set(context.progressContract?.anchorCandidateIds ?? []);
  if (context.progressContract?.mode === "must_offer_progress" && !choices.some((choice) => anchors.has(choice.candidateId ?? choice.id))) {
    const anchor = (context.allowedActionCandidates ?? []).find((candidate) => anchors.has(candidate.id));
    if (anchor) {
      if (choices.length >= 3) {
        const replaceIndex = choices.findIndex((choice) => !anchors.has(choice.id));
        choices.splice(replaceIndex >= 0 ? replaceIndex : choices.length - 1, 1);
      }
      choices.unshift(candidateChoice(anchor));
      usedIds.add(anchor.id);
    }
  }
  const continuityIds = new Set(context.continuityContract?.candidateIds ?? []);
  if (context.continuityContract?.mode === "must_offer_continuation"
    && continuityIds.size
    && !choices.some((choice) => continuityIds.has(choice.candidateId ?? choice.id))) {
    const continuation = (context.allowedActionCandidates ?? []).find((candidate) => continuityIds.has(candidate.id));
    if (continuation) {
      if (choices.length >= 3) {
        const replaceIndex = choices.findIndex((choice) => !anchors.has(choice.id) && !continuityIds.has(choice.id));
        choices.splice(replaceIndex >= 0 ? replaceIndex : choices.length - 1, 1);
      }
      choices.push(candidateChoice(continuation));
      usedIds.add(continuation.id);
    }
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
      text: sanitizeDiegeticText(speech.text, 500),
      emotion: sanitizeDiegeticText(speech.emotion, 60) || null,
    }))
    .filter((speech) => speech.text && !isEmptyReaction(speech.text))
    .slice(0, 6);

  if (context.action.type === "conversation" && context.action.targetNpcId) {
    let target = speeches.find((speech) => speech.actorId === context.action.targetNpcId);
    if (!target && context.action.requiredDisclosure) {
      target = { actorId: context.action.targetNpcId, text: "", emotion: null };
      speeches.unshift(target);
    }
    if (target && context.action.firstIntroduction && context.action.introductionName && !target.text.includes(context.action.introductionName)) {
      target.text = `私は${context.action.introductionName}。${target.text}`;
    }
    const disclosure = sanitizeDiegeticText(context.action.requiredDisclosure, 360);
    if (target && disclosure && !target.text.includes(disclosure)) {
      target.text = `${target.text}${target.text && !/[。！？!?]$/u.test(target.text) ? "。" : ""}${disclosure}`;
    }
  }

  const proposals = (Array.isArray(value?.proposals) ? value.proposals : [])
    .map((proposal) => normalizedProposal(proposal, context, localNpcIds))
    .filter(Boolean)
    .slice(0, 5);

  return {
    narrative: sanitizeDiegeticText(value?.narrative, 1400) || fallback.narrative,
    choices: choices.slice(0, 3),
    speeches,
    proposals,
  };
}

export function mergeNarrativeOutputs(primary, repair, context) {
  const merged = {
    narrative: boundedText(repair?.narrative, 1400) || boundedText(primary?.narrative, 1400),
    choices: Array.isArray(repair?.choices) && repair.choices.length ? repair.choices : primary?.choices,
    speeches: Array.isArray(repair?.speeches) && repair.speeches.length ? repair.speeches : primary?.speeches,
    proposals: Array.isArray(repair?.proposals) ? repair.proposals : primary?.proposals,
  };
  return sanitizeNarrativeOutput(merged, context);
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
    else if (proposal.type === "local_fact_candidate"
      && ![context.place.locationId, context.place.facilityId].filter(Boolean).includes(proposal.subjectId)) reason = "nonlocal_fact_subject";
    else if (proposal.type === "npc_memory_candidate" && !localNpcIds.has(String(proposal.subjectId))) reason = "remote_memory_subject";
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
