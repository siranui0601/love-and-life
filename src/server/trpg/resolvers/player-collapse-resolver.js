import {
  completePlayerCollapseRescue,
  openPlayerCollapseIncident,
  playerCollapseCommandBlock,
} from "../../../../tools/trpg-sim/lib/player-needs.mjs";

export const PLAYER_COLLAPSE_RESCUE_VERSION = "player-incapacitation-rescue-v6";
export const PLAYER_COLLAPSE_RESCUE_COMMAND = "RESOLVE_COLLAPSE_RESCUE";

const DEFAULT_WAKE_DELAY_MINUTES = 180;
const DEFAULT_FALLBACK_DISCOVERY_MINUTES = 60;
const DEFAULT_FALLBACK_EVACUATION_MINUTES = 30;
const COLLAPSE_CAUSE_LABELS = Object.freeze({
  hunger: "空腹",
  fatigue: "疲労",
  battle_defeat: "戦闘での負傷",
});

function optionalId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function finiteMinute(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function normalizedKnowledge(value) {
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value.map(String));
  if (value && typeof value === "object") return new Set(Object.keys(value));
  return new Set();
}

function sourceValue(source, id) {
  if (!source) return null;
  if (source instanceof Map) return source.get(id) ?? null;
  return source[id] ?? null;
}

function normalizedIdSet(value) {
  if (value instanceof Set) return new Set([...value].map(String));
  if (Array.isArray(value)) return new Set(value.map(String));
  return new Set();
}

function candidateScore(candidate, incident) {
  const knowledge = normalizedKnowledge(candidate.knowledge);
  let score = 0;
  // A surviving companion who shared the encounter is the most natural rescuer.
  if (candidate.companion === true) score += 180;
  if (candidate.present === true) score += 100;
  if (optionalId(candidate.location) === incident.location) score += 30;
  if (incident.facilityId && optionalId(candidate.facilityId) === incident.facilityId) score += 40;
  if (candidate.canRescue === true) score += 25;
  if (knowledge.has("first_aid") || knowledge.has("healing") || knowledge.has("治療") || knowledge.has("応急処置")) score += 15;
  score += Math.max(-20, Math.min(20, Number(candidate.playerTrust) || 0));
  score -= Math.max(0, Number(candidate.rescueCost) || 0);
  score -= Math.min(90, Math.max(0, Number(candidate.travelMinutes) || 0) / 3);
  return score;
}

function eligibleCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") return false;
  if (!optionalId(candidate.id)) return false;
  if (candidate.alive === false || candidate.dead === true) return false;
  if (candidate.detained === true || candidate.missing === true || candidate.departed === true) return false;
  if (candidate.incapacitated === true || candidate.hostile === true) return false;
  if (candidate.present !== true && candidate.canReach !== true && candidate.companion !== true) return false;
  return candidate.canRescue !== false;
}

export function buildCollapseRescueCandidates({
  presentNpcIds = [],
  companionNpcIds = [],
  npcStates = null,
  npcDefinitions = null,
  reachableNpcIds = [],
  location = null,
  facilityId = null,
  fallbackWakeFacilityId = null,
} = {}) {
  const present = normalizedIdSet(presentNpcIds);
  const companion = normalizedIdSet(companionNpcIds);
  const reachable = normalizedIdSet(reachableNpcIds);
  const candidateIds = new Set([...present, ...companion, ...reachable]);
  return [...candidateIds]
    .sort((left, right) => left.localeCompare(right, "ja"))
    .map((id) => {
      const state = sourceValue(npcStates, id) ?? {};
      const definition = sourceValue(npcDefinitions, id) ?? {};
      const stateLocation = optionalId(state.position?.hubId ?? state.location ?? state.currentLocation);
      const stateFacilityId = optionalId(state.position?.facilityId ?? state.facilityId ?? state.currentFacilityId);
      const knowledge = state.knowledge ?? state.knownFacts ?? state.beliefs ?? definition.knowledge ?? [];
      const status = String(state.lifeStatus ?? state.status ?? "").toLowerCase();
      const presence = String(state.presence ?? "").toLowerCase();
      const disposition = String(state.disposition ?? state.relation ?? state.attitude ?? "").toLowerCase();
      const dead = state.dead === true || state.alive === false || status === "dead" || status === "死亡";
      const missing = state.missing === true || status === "missing" || status === "行方不明" || presence === "missing";
      const detained = state.detained === true || state.restrained === true || ["detained", "拘束", "拘束中"].includes(status);
      const departed = status === "departed" || presence === "departed";
      const incapacitated = state.incapacitated === true || state.unconscious === true || ["incapacitated", "unconscious", "戦闘不能", "気絶"].includes(status);
      const hostile = state.hostile === true || ["hostile", "enemy", "敵対", "敵対中"].includes(disposition);
      return {
        id,
        name: definition.name ?? state.name ?? id,
        companion: companion.has(id),
        present: present.has(id),
        canReach: reachable.has(id) && !departed,
        alive: !dead,
        dead,
        missing,
        detained,
        departed,
        incapacitated,
        hostile,
        canRescue: state.canRescue ?? definition.canRescue ?? (!departed && !hostile && !incapacitated),
        location: stateLocation ?? optionalId(location),
        facilityId: stateFacilityId ?? (present.has(id) ? optionalId(facilityId) : null),
        wakeLocation: optionalId(state.wakeLocation) ?? stateLocation ?? optionalId(location),
        wakeFacilityId: optionalId(state.wakeFacilityId)
          ?? stateFacilityId
          ?? optionalId(fallbackWakeFacilityId)
          ?? (present.has(id) ? optionalId(facilityId) : null),
        travelMinutes: finiteMinute(state.rescueTravelMinutes ?? state.travelMinutes ?? 0, 0),
        knowledge,
        playerTrust: Number(state.playerTrust ?? state.trustToPlayer ?? 0),
        rescueCost: Number(state.rescueCost ?? definition.rescueCost ?? 0),
        goapGoalId: optionalId(state.currentGoalId ?? state.goalId ?? state.currentGoal),
        goapPlanId: optionalId(state.currentPlanId ?? state.planId ?? state.currentPlan?.id),
      };
    });
}

export function selectCollapseRescuer(incident, candidates = []) {
  if (!incident || incident.status !== "pending_rescue") return null;
  return candidates
    .filter(eligibleCandidate)
    .map((candidate) => ({ candidate, score: candidateScore(candidate, incident) }))
    .sort((left, right) => right.score - left.score
      || optionalId(left.candidate.id).localeCompare(optionalId(right.candidate.id), "ja"))[0]?.candidate ?? null;
}

export function planIncapacitationRescue(incident, {
  candidates = [],
  fallbackRescuerId = "SYSTEM_LOCAL_AID",
  fallbackWakeLocation = null,
  fallbackWakeFacilityId = null,
  fallbackDiscoveryMinutes = DEFAULT_FALLBACK_DISCOVERY_MINUTES,
  fallbackEvacuationMinutes = DEFAULT_FALLBACK_EVACUATION_MINUTES,
  treatmentRecoveryMinutes = DEFAULT_WAKE_DELAY_MINUTES,
} = {}) {
  if (!incident || incident.status !== "pending_rescue") return null;
  const rescuer = selectCollapseRescuer(incident, candidates);
  const usedFallback = !rescuer;
  const wakeLocation = optionalId(rescuer?.wakeLocation)
    ?? optionalId(rescuer?.location)
    ?? optionalId(fallbackWakeLocation)
    ?? incident.location;
  const wakeFacilityId = optionalId(rescuer?.wakeFacilityId)
    ?? optionalId(rescuer?.facilityId)
    ?? optionalId(fallbackWakeFacilityId)
    ?? incident.facilityId;
  const discoveryDelayMinutes = usedFallback
    ? finiteMinute(fallbackDiscoveryMinutes, DEFAULT_FALLBACK_DISCOVERY_MINUTES)
    : 0;
  const evacuationMinutes = rescuer
    ? finiteMinute(rescuer.travelMinutes, rescuer.present || rescuer.companion ? 0 : DEFAULT_FALLBACK_EVACUATION_MINUTES)
    : finiteMinute(fallbackEvacuationMinutes, DEFAULT_FALLBACK_EVACUATION_MINUTES);
  const recoveryMinutes = finiteMinute(treatmentRecoveryMinutes, DEFAULT_WAKE_DELAY_MINUTES);
  return {
    rescuer,
    rescuerId: optionalId(rescuer?.id) ?? optionalId(fallbackRescuerId),
    usedFallback,
    wakeLocation,
    wakeFacilityId,
    discoveryDelayMinutes,
    evacuationMinutes,
    treatmentRecoveryMinutes: recoveryMinutes,
    elapsedMinutes: discoveryDelayMinutes + evacuationMinutes + recoveryMinutes,
  };
}

export function prepareCollapseCommand(player, commandType, context = {}) {
  const opened = openPlayerCollapseIncident(player, {
    minute: context.minute,
    location: context.location,
    facilityId: context.facilityId,
  });
  const block = playerCollapseCommandBlock(player, commandType);
  return {
    version: PLAYER_COLLAPSE_RESCUE_VERSION,
    opened: opened.opened,
    incident: opened.incident ?? block.incident ?? null,
    blocked: block.blocked,
    code: block.code,
    commandType: block.commandType,
    causes: block.causes ?? [],
  };
}

export function collapseRescueView(player, {
  facilityName = null,
  fallbackPlaceLabel = "その場",
} = {}) {
  const incident = player?.needs?.activeCollapse;
  if (!incident || incident.status !== "pending_rescue") return null;
  const causes = (Array.isArray(incident.causes) ? incident.causes : [])
    .map((cause) => COLLAPSE_CAUSE_LABELS[cause] ?? String(cause))
    .filter(Boolean);
  const placeLabel = String(facilityName ?? "").trim() || fallbackPlaceLabel;
  const causeLabel = causes.length ? causes.join("と") : "体調不良";
  return {
    version: PLAYER_COLLAPSE_RESCUE_VERSION,
    active: true,
    incidentId: incident.id,
    status: incident.status,
    title: "力尽きて倒れた",
    narrative: `${placeLabel}で${causeLabel}のため動けなくなった。周囲の誰かが気づき、救助へ動いている。`,
    causes,
    collapsedAtMinute: Number(incident.atMinute ?? 0),
    location: optionalId(incident.location),
    facilityId: optionalId(incident.facilityId),
    command: {
      type: PLAYER_COLLAPSE_RESCUE_COMMAND,
      label: "救助を受け、目を覚ます",
    },
    uiLock: {
      choices: [],
      movement: [],
      stock: [],
      saleQuotes: [],
      loans: [],
      rewards: [],
      learnableSkills: [],
      battleCommands: [],
    },
  };
}

export function applyCollapseRescueView(gameView, player, options = {}) {
  const rescueView = collapseRescueView(player, options);
  if (!rescueView) return gameView;
  const source = gameView && typeof gameView === "object" ? gameView : {};
  const shop = source.shop && typeof source.shop === "object" ? source.shop : {};
  const skills = source.skills && typeof source.skills === "object" ? source.skills : {};
  const battle = source.battle && typeof source.battle === "object" ? source.battle : null;
  return {
    ...source,
    scene: {
      ...(source.scene && typeof source.scene === "object" ? source.scene : {}),
      title: rescueView.title,
      narrative: rescueView.narrative,
      collapseRescue: rescueView,
    },
    collapseRescue: rescueView,
    choices: rescueView.uiLock.choices,
    movement: rescueView.uiLock.movement,
    shop: {
      ...shop,
      available: false,
      stock: rescueView.uiLock.stock,
      saleQuotes: rescueView.uiLock.saleQuotes,
      loans: rescueView.uiLock.loans,
      rewards: rescueView.uiLock.rewards,
    },
    skills: {
      ...skills,
      learnable: rescueView.uiLock.learnableSkills,
      learnableSkills: rescueView.uiLock.learnableSkills,
    },
    battle: battle ? {
      ...battle,
      commands: rescueView.uiLock.battleCommands,
    } : battle,
    availableActions: [],
  };
}

export function resolveCollapseRescue(player, {
  minute = 0,
  location = null,
  facilityId = null,
  candidates = [],
  fallbackRescuerId = "SYSTEM_LOCAL_AID",
  fallbackWakeLocation = null,
  fallbackWakeFacilityId = null,
  wakeDelayMinutes = DEFAULT_WAKE_DELAY_MINUTES,
  fallbackDiscoveryMinutes = 0,
  fallbackEvacuationMinutes = 0,
  hungerAfter = 70,
  fatigueAfter = 70,
} = {}) {
  const opened = openPlayerCollapseIncident(player, { minute, location, facilityId });
  const incident = opened.incident;
  if (!incident || incident.status !== "pending_rescue") {
    return { completed: false, incident: null, rescuer: null, usedFallback: false };
  }

  // Existing hunger/fatigue collapse retains its historical wake delay by default.
  // Battle defeat can opt into explicit discovery/evacuation/treatment components
  // through the same planner without creating a second rescue architecture.
  const plan = planIncapacitationRescue(incident, {
    candidates,
    fallbackRescuerId,
    fallbackWakeLocation,
    fallbackWakeFacilityId,
    fallbackDiscoveryMinutes,
    fallbackEvacuationMinutes,
    treatmentRecoveryMinutes: wakeDelayMinutes,
  });
  const rescueMinute = Math.max(
    incident.atMinute,
    finiteMinute(minute, incident.atMinute),
  ) + plan.elapsedMinutes;

  const result = completePlayerCollapseRescue(player, {
    minute: rescueMinute,
    rescuerId: plan.rescuerId,
    wakeLocation: plan.wakeLocation,
    wakeFacilityId: plan.wakeFacilityId,
    hungerAfter,
    fatigueAfter,
  });
  return {
    ...result,
    ...plan,
    rescueMinute,
  };
}
