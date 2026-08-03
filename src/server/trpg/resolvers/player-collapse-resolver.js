import {
  completePlayerCollapseRescue,
  openPlayerCollapseIncident,
  playerCollapseCommandBlock,
} from "../../../../tools/trpg-sim/lib/player-needs.mjs";

export const PLAYER_COLLAPSE_RESCUE_VERSION = "player-collapse-rescue-v1";

const DEFAULT_WAKE_DELAY_MINUTES = 180;

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
