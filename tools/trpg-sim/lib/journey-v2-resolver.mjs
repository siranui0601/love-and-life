import { createHash } from "node:crypto";
import {
  advanceV2, arrivalFacilityV2, incV2, publishRumorV2, routeTagsV2,
  transitionTroubleV2, unitV2,
} from "./journey-v2-core.mjs";
import { issueEventSkillRewardV2, refreshSkillStateV2 } from "./journey-v2-skills.mjs";
import {
  addExperienceV2, claimMissionV2, finishMissionStepV2,
  resolutionScoreV2,
} from "./journey-v2-missions.mjs";
import { runBattleV2 } from "./journey-v2-battle.mjs";
import { stateFingerprintV2 } from "./journey-v2-state.mjs";

function conditionAtom(text, state) {
  const value = String(text ?? "").trim(); if (!value) return true;
  let match = value.match(/Day\s*(>=|<=|>|<|=)?\s*(\d+)/iu);
  if (match) { const day = Number(match[2]); return match[1] === ">=" ? state.day >= day : match[1] === "<=" ? state.day <= day : match[1] === ">" ? state.day > day : match[1] === "<" ? state.day < day : state.day === day; }
  match = value.match(/(T\d{2})\.(?:status)?\s*(!=|=)\s*(resolved|failed|active|critical|suppressed|scheduled)/iu);
  if (match) return match[2] === "!=" ? state.troubles[match[1]]?.status !== match[3] : state.troubles[match[1]]?.status === match[3];
  if (/discovered|engaged|investigation|operation|boss|final|rescue|ambush|hostile|permit|entered|climax|reconnaissance|militarized|market hostility|illegal lab/u.test(value)) return false;
  return true;
}

function encounterAllowed(encounter, state) {
  if (state.day < encounter.startDay || state.day > encounter.endDay) return false;
  if (encounter.dayparts && encounter.dayparts !== "any" && !String(encounter.dayparts).split("|").includes(state.daypart)) return false;
  const text = String(encounter.condition ?? "").trim(); if (!text) return true;
  const ors = text.split(/\s+OR\s+/iu); if (ors.length > 1) return ors.some((part) => conditionAtom(part, state));
  return text.split(/\s+AND\s+/iu).every((part) => conditionAtom(part, state));
}

function dangerLimit(state, profile) {
  const levelBand = 1 + Math.floor((state.player.level - 1) / 4);
  const appetite = profile.combat - profile.caution > .4 ? 2 : profile.combat > profile.caution ? 1 : 0;
  return Math.max(1, Math.min(10, levelBand + appetite));
}
function encounters(state, data, profile, eventOnly = false) { const limit = dangerLimit(state, profile); return data.encounters.filter((x) => x.region === state.player.location && x.status === "active" && encounterAllowed(x, state)).filter((x) => eventOnly ? x.avoidability === "event" : !["event", "authorization", "diplomacy"].includes(x.avoidability)).filter((x) => x.dangerTier <= limit + (profile.id === "fighter" ? 1 : 0)); }
function weighted(items, key) { if (!items.length) return null; const total = items.reduce((sum, item) => sum + Math.max(1, Number(item.baseWeight || 1)), 0); let cursor = unitV2(key) * total; for (const item of items) { cursor -= Math.max(1, Number(item.baseWeight || 1)); if (cursor <= 0) return item; } return items.at(-1); }

function dailyCount(state) { return Number(state.dailyBattleCounts[state.day] ?? 0); }
export function canSeekBattleV2(state, profile) { const base = Number(state.tuning.maxNormalBattlesPerDay ?? 2); const cap = profile.id === "fighter" ? base + 1 : profile.id === "random" ? base + 1 : base; return state.absoluteMinute >= Number(state.encounterCooldowns[state.player.location] ?? 0) && dailyCount(state) < cap; }
function addExp(state, data, skills, profile) { return (amount, source) => addExperienceV2(state, data, skills, profile, amount, source); }

function discoverRumor(state, localOnly = true) {
  const list = state.rumors.filter((rumor) => !state.player.knownRumorIds.has(rumor.id)).filter((rumor) => !localOnly || rumor.origin === state.player.location || Object.values(rumor.recipients).some((entry) => entry.hub === state.player.location)).sort((a, b) => b.importance - a.importance || a.originMinute - b.originMinute);
  const rumor = list[0]; if (!rumor) return null; state.player.knownRumorIds.add(rumor.id); state.history.push({ type: "RUMOR_LEARNED", minute: state.absoluteMinute, rumorId: rumor.id, troubleId: rumor.troubleId }); return rumor;
}

function travelEncounter(state, model, data, skills, profile, action) {
  const chance = Number(state.tuning.travelEncounterBaseChance ?? .1) * Math.min(2, action.minutes / 180);
  if (unitV2(state.seed, "travel", state.metrics.regionalMovementActions, state.metrics.battles) >= chance) return null;
  const encounter = weighted(encounters(state, data, profile), `${state.seed}:travel:${state.metrics.regionalMovementActions}`);
  if (!encounter) return null;
  const safeTier = 1 + Math.floor((state.player.level - 1) / 4);
  const tierRisk = Math.max(0, Number(encounter.dangerTier ?? 1) - safeTier);
  const avoidChance = Math.min(.92, .15 + profile.caution * .55 + tierRisk * .18 + (1 - state.player.hpRatio) * .25);
  if (unitV2(state.seed, "travel-avoid", state.metrics.regionalMovementActions, encounter.id, state.day) < avoidChance) {
    state.metrics.travelEncountersAvoided += 1;
    state.history.push({ type: "TRAVEL_ENCOUNTER_AVOIDED", minute: state.absoluteMinute, encounterId: encounter.id, dangerTier: encounter.dangerTier, avoidChance });
    return null;
  }
  return runBattleV2({ state, model, data, profile, encounterId: encounter.id, key: `${state.seed}:travel:${state.metrics.regionalMovementActions}:${encounter.id}:${state.metrics.battles}`, addExperience: addExp(state, data, skills, profile) });
}

export function resolveMovementActionV2(state, model, data, skills, profile, action) {
  if (action.type === "localTravel") {
    const from = state.player.facilityId; advanceV2(state, model, action.minutes, `local-travel:${from}->${action.destinationFacilityId}`); state.player.facilityId = action.destinationFacilityId;
    state.progress.travel.visitedFacilities.add(action.destinationFacilityId); incV2(state.progress, "travel.actions"); incV2(state.progress, "travel.localActions"); incV2(state.progress, "walkMinutes.total", action.minutes); incV2(state.progress, "walkMinutes.local", action.minutes); state.metrics.localMovementActions += 1;
    state.history.push({ type: "LOCAL_TRAVEL_COMPLETED", minute: state.absoluteMinute, hub: state.player.location, fromFacilityId: from, toFacilityId: action.destinationFacilityId }); refreshSkillStateV2(state, data, skills, profile); return true;
  }
  if (action.type === "regionalTravel") {
    const from = state.player.location; const battle = travelEncounter(state, model, data, skills, profile, action);
    if (battle && !battle.won && profile.caution > .5) {
      state.metrics.travelInterrupted += 1;
      state.history.push({ type: "REGIONAL_TRAVEL_INTERRUPTED", minute: state.absoluteMinute, from, to: action.destination, reason: "battle-defeat" });
      return false;
    }
    advanceV2(state, model, action.minutes, `regional-travel:${from}->${action.destination}`); state.player.location = action.destination; state.player.facilityId = action.destinationFacilityId ?? arrivalFacilityV2(model, action.destination)?.id ?? null;
    state.progress.travel.visitedHubs.add(action.destination); if (state.player.facilityId) state.progress.travel.visitedFacilities.add(state.player.facilityId);
    incV2(state.progress, "travel.actions"); incV2(state.progress, "travel.regionalActions"); incV2(state.progress, "walkMinutes.total", action.minutes); incV2(state.progress, "walkMinutes.regional", action.minutes); for (const tag of routeTagsV2(model, action.routeIds ?? [])) incV2(state.progress, `walkMinutes.byTag.${tag}`, action.minutes); state.metrics.regionalMovementActions += 1;
    if (profile.id === "merchant") {
      state.ai.merchantVisitedAt[action.destination] = state.absoluteMinute;
      state.ai.nextMerchantRegionalAt = state.absoluteMinute + Number(state.tuning.merchantRegionalCooldownMinutes ?? 1440);
    }
    state.history.push({ type: "REGIONAL_TRAVEL_COMPLETED", minute: state.absoluteMinute, from, to: action.destination, facilityId: state.player.facilityId }); refreshSkillStateV2(state, data, skills, profile); return true;
  }
  return false;
}

function failMission(state, model, mission, runtime, reason) { runtime.status = "failed"; runtime.failedAt = state.absoluteMinute; runtime.outcome = "failed"; transitionTroubleV2(state, model, mission.troubleId, "failed", reason); state.metrics.troubleFailedByPlayerAction += 1; state.history.push({ type: "MISSION_FAILED_BY_ACTION", minute: state.absoluteMinute, missionId: mission.id, reason }); }

export function resolvePlayerActionV2(state, model, data, skills, profile, action) {
  const pre = stateFingerprintV2(state); const replay = createHash("sha256").update(JSON.stringify({ pre, actionId: action.id })).digest("hex"); let outcome = { ok: true, type: action.type };
  const mission = action.missionId ? state.catalog.byId.get(action.missionId) : null; const runtime = mission ? state.missions[mission.id] : null; const step = mission ? mission.steps.find((x) => x.id === action.stepId) : null;
  if (action.type === "conversation") {
    advanceV2(state, model, action.minutes, `conversation:${action.targetNpcId ?? action.missionId ?? "local"}`); incV2(state.progress, "social.conversations"); if (step) finishMissionStepV2(state, mission, runtime, step);
    if (mission) { publishRumorV2(state, { id: `RUM2-PLAYER-${mission.troubleId}`, troubleId: mission.troubleId, text: `${mission.title}の情報を得た` }); incV2(state.player.reputation, state.player.location, 2); } else { incV2(state.player.reputation, state.player.location, 1); discoverRumor(state, true); }
  } else if (action.type === "investigate") {
    advanceV2(state, model, action.minutes, `investigate:${action.missionId}`);
    if (step) {
      finishMissionStepV2(state, mission, runtime, step); incV2(state.player.evidenceByTrouble, mission.troubleId); incV2(state.progress, "investigation.total");
      if (mission.troubleId === "T08" && !state.worldFlags.elfApproval) { state.worldFlags.elfApproval = true; state.routeCache = {}; state.history.push({ type: "ACCESS_PERMISSION_GAINED", minute: state.absoluteMinute, access: "elf", missionId: mission.id }); }
      if (mission.troubleId === "T12" && !state.worldFlags.blackridgePermit) { state.worldFlags.blackridgePermit = true; state.routeCache = {}; state.history.push({ type: "ACCESS_PERMISSION_GAINED", minute: state.absoluteMinute, access: "blackridge", missionId: mission.id }); }
    }
  } else if (action.type === "support") {
    advanceV2(state, model, action.minutes, `support:${action.missionId}`); if (step) finishMissionStepV2(state, mission, runtime, step); incV2(state.progress, "social.supportActions"); incV2(state.player.reputation, state.player.location, 3 + mission.difficulty * .5); state.troubles[mission.troubleId].casualtyMitigation += .25 + mission.difficulty * .03;
  } else if (action.type === "missionBattle") {
    const readyAt = Number(runtime.lastAttemptAt ?? -Infinity) + Number(state.tuning.missionRetryCooldownMinutes ?? 360);
    if (state.absoluteMinute < readyAt) { advanceV2(state, model, Math.min(60, readyAt - state.absoluteMinute), "mission-retry-wait"); outcome = { ok: false, type: action.type, reason: "mission_retry_cooldown" }; }
    else { advanceV2(state, model, action.minutes, `mission-battle:${action.missionId}`); runtime.attempts += 1; runtime.lastAttemptAt = state.absoluteMinute; const encounterId = action.encounterId ?? weighted(encounters(state, data, profile, true), `${state.seed}:${action.id}`)?.id;
      if (!encounterId) outcome = { ok: false, type: action.type, reason: "no_encounter" }; else { const evidence = Number(state.player.evidenceByTrouble[mission.troubleId] ?? 0); const bonus = Math.min(Number(state.tuning.missionPreparationBonusMax ?? 1.5), evidence * Number(state.tuning.missionPreparationBonusPerEvidence ?? .25)); outcome.battle = runBattleV2({ state, model, data, profile, encounterId, key: `${state.seed}:mission:${action.missionId}:${state.metrics.battles}`, situationalMultiplier: 1 + bonus, addExperience: addExp(state, data, skills, profile) }); if (outcome.battle.won && step) finishMissionStepV2(state, mission, runtime, step); }
    }
  } else if (action.type === "resolveMission") {
    const incomplete = mission.steps.filter((x) => x.id !== step.id).some((x) => Number(runtime.progress[x.id] ?? 0) < Number(x.required ?? 1));
    if (incomplete) outcome = { ok: false, type: action.type, reason: "incomplete" }; else { advanceV2(state, model, action.minutes, `resolve:${mission.id}:${action.resolutionOption.id}`); runtime.attempts += 1; runtime.lastAttemptAt = state.absoluteMinute; const score = resolutionScoreV2(state, mission, runtime, action.resolutionOption, profile, data); outcome.resolution = { ...score, optionId: action.resolutionOption.id }; state.metrics.troubleResolutionAttempts += 1;
      if (score.score >= score.threshold) {
        finishMissionStepV2(state, mission, runtime, step); transitionTroubleV2(state, model, mission.troubleId, "resolved", `player-resolution:${action.resolutionOption.id}`); claimMissionV2(state, mission, runtime, data, skills, profile);
        outcome.eventSkillId = issueEventSkillRewardV2(state, data, skills, profile, { missionId: mission.id, troubleId: mission.troubleId, difficulty: mission.difficulty });
        incV2(state.player.reputation, state.player.location, 8 + mission.difficulty); state.metrics.troubleResolvedByPlayerAction += 1; outcome.resolution.result = "resolved";
      }
      else if (score.score >= score.threshold - 2 && action.resolutionOption.failureSeverity !== "fail") { runtime.outcome = "partial"; runtime.progress.partial = Number(runtime.progress.partial ?? 0) + 1; incV2(state.player.evidenceByTrouble, mission.troubleId); state.troubles[mission.troubleId].casualtyMitigation += .4; state.metrics.troublePartialByPlayerAction += 1; outcome.resolution.result = "partial"; }
      else if (action.resolutionOption.failureSeverity === "fail" || runtime.attempts >= Number(state.tuning.maxResolutionAttempts ?? 3)) { failMission(state, model, mission, runtime, `failed-resolution:${action.resolutionOption.id}`); outcome.resolution.result = "failed"; }
      else { runtime.outcome = "retry"; state.player.reputation[state.player.location] = Math.max(0, Number(state.player.reputation[state.player.location] ?? 0) - 2); outcome.resolution.result = "retry"; }
    }
  } else if (action.type === "seekBattle") {
    if (!canSeekBattleV2(state, profile)) outcome = { ok: false, type: action.type, reason: "encounter_cooldown" }; else { advanceV2(state, model, action.minutes, "seek-battle"); const encounter = weighted(encounters(state, data, profile), `${state.seed}:seek:${state.metrics.actions}:${state.player.location}`); if (!encounter) outcome = { ok: false, type: action.type, reason: "no_encounter" }; else { outcome.battle = runBattleV2({ state, model, data, profile, encounterId: encounter.id, key: `${state.seed}:seek:${state.metrics.battles}:${encounter.id}`, addExperience: addExp(state, data, skills, profile) }); state.encounterCooldowns[state.player.location] = state.absoluteMinute + Number(state.tuning.encounterRespawnMinutes ?? 240); state.dailyBattleCounts[state.day] = dailyCount(state) + 1; } }
  } else if (action.type === "rest") {
    const price = state.player.freeLodging > 0 ? 0 : Number(state.tuning.restPrice ?? 4); if (price > state.player.gold) { advanceV2(state, model, Math.min(action.minutes, 180), "outdoor-rest"); state.player.hpRatio = Math.min(1, state.player.hpRatio + .25); state.player.mpRatio = Math.min(1, state.player.mpRatio + .18); } else { if (price) state.player.gold -= price; else state.player.freeLodging -= 1; advanceV2(state, model, action.minutes, "inn-rest"); state.player.hpRatio = 1; state.player.mpRatio = 1; }
  } else if (action.type === "work") { advanceV2(state, model, action.minutes, "odd-job"); const wage = 5 + Math.floor(unitV2(state.seed, state.absoluteMinute, state.player.location, "wage") * 8); state.player.gold += wage; state.progress.economy.goldFromWork += wage; }
  else { advanceV2(state, model, action.minutes ?? 30, "observe"); discoverRumor(state, true); }
  refreshSkillStateV2(state, data, skills, profile); const post = stateFingerprintV2(state); const result = createHash("sha256").update(JSON.stringify({ actionId: action.id, outcome: { type: outcome.type, ok: outcome.ok, reason: outcome.reason, resolution: outcome.resolution?.result }, post })).digest("hex"); if (state.replayResults[replay] && state.replayResults[replay] !== result && !["seekBattle", "missionBattle", "investigate"].includes(action.type)) state.metrics.replayMismatches += 1; state.replayResults[replay] = result; state.history.push({ type: "PLAYER_ACTION_RESOLVED", minute: state.absoluteMinute, actionId: action.id, replayKey: replay, preHash: pre, postHash: post }); return outcome;
}
