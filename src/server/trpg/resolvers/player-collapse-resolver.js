import {
  completePlayerCollapseRescue,
  openPlayerCollapseIncident,
  playerCollapseCommandBlock,
} from "../../../../tools/trpg-sim/lib/player-needs.mjs";

export const PLAYER_COLLAPSE_RESCUE_VERSION = "player-collapse-rescue-v4";

const DEFAULT_WAKE_DELAY_MINUTES = 180;
const COLLAPSE_CAUSE_LABELS = Object.freeze({
  hunger: "空腹",
  fatigue: "疲労",
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
  if (candidate.present === true) score += 100;
  if (optionalId(candidate.location) === incident.location) score += 30;
  if (incident.facilityId && optionalId(candidate.facilityId) === incident.facilityId) score += 40;
  if (candidate.canRescue === true) score += 25;
  if (knowledge.has("first_aid") || knowledge.has("healing")) score += 15;
  score += Math.max(-20, Math.min(20, Number(candidate.playerTrust) || 0));
  score -= Math.max(0, Number(candidate.rescueCost) || 0);
  return score;
}

function eligibleCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") return false;
  if (!optionalId(candidate.id)) return false;
  if (candidate.alive === false || candidate.dead === true) return false;
  if (candidate.detained === true || candidate.missing === true) return false;
  if (candidate.present !== true && candidate.canReach !== true) return false;
  return candidate.canRescue !== false;
}

export function buildCollapseRescueCandidates({
  presentNpcIds = [],
  npcStates = null,
  npcDefinitions = null,
  reachableNpcIds = [],
  location = null,
  facilityId = null,
  fallbackWakeFacilityId = null,
} = {}) {
  const present = normalizedIdSet(presentNpcIds);
  const reachable = normalizedIdSet(reachableNpcIds);
  const candidateIds = new Set([...present, ...reachable]);
  return [...candidateIds]
    .sort((left, right) => left.localeCompare(right, "ja"))
    .map((id) => {
      const state = sourceValue(npcStates, id) ?? {};
      const definition = sourceValue(npcDefinitions, id) ?? {};
      const stateLocation = optionalId(state.location ?? state.currentLocation);
      const stateFacilityId = optionalId(state.facilityId ?? state.currentFacilityId);
      const knowledge = state.knowledge ?? state.knownFacts ?? definition.knowledge ?? [];
      const status = String(state.status ?? "").toLowerCase();
      const dead = state.dead === true || state.alive === false || status === "dead" || status === "死亡";
      const missing = state.missing === true || status === "missing" || status === "行方不明";
      const detained = state.detained === true || state.restrained === true || ["detained", "拘束", "拘束中"].includes(status);
      return {
        id,
        name: definition.name ?? state.name ?? id,
        present: present.has(id),
        canReach: reachable.has(id),
        alive: !dead,
        dead,
        missing,
        detained,
        canRescue: state.canRescue ?? definition.canRescue ?? true,
        location: stateLocation ?? optionalId(location),
        facilityId: stateFacilityId ?? (present.has(id) ? optionalId(facilityId) : null),
        wakeLocation: optionalId(state.wakeLocation) ?? stateLocation ?? optionalId(location),
        wakeFacilityId: optionalId(state.wakeFacilityId)
          ?? stateFacilityId
          ?? optionalId(fallbackWakeFacilityId)
          ?? (present.has(id) ? optionalId(facilityId) : null),
        knowledge,
        playerTrust: Number(state.playerTrust ?? state.trustToPlayer ?? 0),
        rescueCost: Number(state.rescueCost ?? definition.rescueCost ?? 0),
        goapGoalId: optionalId(state.currentGoalId ?? state.goalId),
        goapPlanId: optionalId(state.currentPlanId ?? state.planId),
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
  hungerAfter = 70,
  fatigueAfter = 70,
} = {}) {
  const opened = openPlayerCollapseIncident(player, { minute, location, facilityId });
  const incident = opened.incident;
  if (!incident || incident.status !== "pending_rescue") {
    return { completed: false, incident: null, rescuer: null, usedFallback: false };
  }

  const rescuer = selectCollapseRescuer(incident, candidates);
  const rescueMinute = Math.max(
    incident.atMinute,
    finiteMinute(minute, incident.atMinute),
  ) + Math.max(0, finiteMinute(wakeDelayMinutes, DEFAULT_WAKE_DELAY_MINUTES));
  const wakeLocation = optionalId(rescuer?.wakeLocation)
    ?? optionalId(rescuer?.location)
    ?? optionalId(fallbackWakeLocation)
    ?? incident.location;
  const wakeFacilityId = optionalId(rescuer?.wakeFacilityId)
    ?? optionalId(rescuer?.facilityId)
    ?? optionalId(fallbackWakeFacilityId)
    ?? incident.facilityId;
  const rescuerId = optionalId(rescuer?.id) ?? optionalId(fallbackRescuerId);

  const result = completePlayerCollapseRescue(player, {
    minute: rescueMinute,
    rescuerId,
    wakeLocation,
    wakeFacilityId,
    hungerAfter,
    fatigueAfter,
  });
  return {
    ...result,
    rescuer,
    usedFallback: !rescuer,
    rescueMinute,
    wakeLocation,
    wakeFacilityId,
  };
}
