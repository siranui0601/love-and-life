import {
  availableLocalMovementActionsV2,
  availableMovementActionsV2,
  availableRegionalMovementActionsV2,
  shortestTravelPlan,
  unitV2,
} from "./journey-v2-core.mjs";
import { currentMissionStepV2 } from "./journey-v2-missions.mjs";

function npcHub(npc, day) { return day <= 1 ? npc.initialLocation : npc.home || npc.initialLocation; }
function npcFacility(npc, day) { return day <= 1 ? npc.initialFacilityId ?? npc.mainFacilityId ?? null : npc.mainFacilityId ?? npc.initialFacilityId ?? null; }

function missionActions(state) {
  const actions = [];
  for (const mission of state.catalog.special) {
    const runtime = state.missions[mission.id]; if (runtime.status !== "active") continue;
    const step = currentMissionStepV2(mission, runtime); if (!step) continue;
    if (step.targetHub && step.targetHub !== state.player.location) continue;
    if (step.targetFacilityId && step.targetFacilityId !== state.player.facilityId) continue;
    const base = { missionId: mission.id, stepId: step.id, difficulty: mission.difficulty, encounterId: step.encounterId };
    if (step.type === "resolve") {
      for (const option of mission.resolutionOptions) actions.push({ ...base, id: `ACTION:${mission.id}:${step.id}:${option.id}`, type: "resolveMission", resolutionOption: option, minutes: 20 + mission.difficulty * 5, label: option.label });
    } else {
      actions.push({ ...base, id: `ACTION:${mission.id}:${step.id}`, type: step.type === "battle" ? "missionBattle" : step.type, minutes: step.type === "conversation" ? 10 + mission.difficulty * 2 : step.type === "investigate" ? 25 + mission.difficulty * 6 : step.type === "support" ? 35 + mission.difficulty * 4 : 25, label: step.label });
    }
  }
  return actions;
}

function localTalk(state, model) {
  const list = model.npcs.filter((npc) => {
    if (/死亡/u.test(npc.initialStatus) || npcHub(npc, state.day) !== state.player.location) return false;
    const facility = npcFacility(npc, state.day);
    return !state.player.facilityId || !facility || facility === state.player.facilityId;
  });
  if (!list.length) return null;
  const npc = list[Math.floor(unitV2(state.seed, state.absoluteMinute, state.player.facilityId ?? state.player.location) * list.length)];
  return { id: `TALK:${npc.id}`, type: "conversation", targetNpcId: npc.id, targetNpcName: npc.name, minutes: 8 + Math.floor(unitV2(npc.id, state.day) * 8), label: `${npc.name}に話を聞く` };
}

export function actionUtilityV2(action, state, profile) {
  let score = unitV2(state.seed, state.absoluteMinute, action.id) * .2;
  const missionAction = Boolean(action.missionId) && ["conversation", "investigate", "support", "missionBattle", "resolveMission"].includes(action.type);
  if (missionAction) score += profile.story * 11 + Number(action.difficulty ?? 1);
  if (action.type === "conversation" && !action.missionId) {
    score += profile.story * 1.2;
    if (state.history.slice(-12).some((entry) => entry.type === "PLAYER_ACTION_RESOLVED" && entry.actionId === action.id)) score -= 6;
  }
  if (action.type === "missionBattle") score += profile.combat * 9;
  if (action.type === "seekBattle") {
    score += profile.combat * 9 - profile.caution * 5 - (1 - state.player.hpRatio) * 10;
  }
  if (action.type === "resolveMission") {
    const focus = action.resolutionOption?.focus;
    if (focus === "combat") score += profile.combat * 5;
    if (focus === "evidence") score += profile.story * 5 + profile.explore * 3;
    if (focus === "reputation") score += profile.story * 4 + profile.trade * 3;
    if (focus === "protection") score += profile.caution * 5;
  }
  if (action.type === "work") score += profile.trade * 7 + (state.player.gold < 20 ? 6 : 0);
  if (action.type === "rest") score += profile.caution * 8 + (1 - state.player.hpRatio) * 12 + (1 - state.player.mpRatio) * 4 + (state.player.hpRatio < .6 ? 32 : 0) + (state.player.mpRatio < .25 ? 10 : 0);
  if (action.type === "observe") score += profile.explore * 4 + profile.story * 2;
  return score;
}

export function generateChoiceActionsV2(state, model, data, profile, canSeekBattle) {
  const list = missionActions(state); const talk = localTalk(state, model); if (talk) list.push(talk);
  if (canSeekBattle() && data.encounters.some((encounter) => encounter.region === state.player.location && encounter.status === "active")) list.push({ id: "SEEK_BATTLE", type: "seekBattle", minutes: 90, label: `${state.player.location}周辺で魔物を探す` });
  if (state.player.hpRatio < .82 || state.player.mpRatio < .55 || state.hour >= 22) list.push({ id: "REST", type: "rest", minutes: state.hour >= 20 ? 480 : 120, label: "休息して回復する" });
  if (state.player.gold < (state.tuning.workGoldThreshold ?? 30)) list.push({ id: "WORK", type: "work", minutes: 120, label: "仕事をして路銀を得る" });
  list.push({ id: "OBSERVE", type: "observe", minutes: 30, label: "周囲の噂と変化を確かめる" });
  const result = [...new Map(list.map((action) => [action.id, action])).values()].sort((a, b) => actionUtilityV2(b, state, profile) - actionUtilityV2(a, state, profile) || a.id.localeCompare(b.id)).slice(0, 3).map((action, index) => ({ ...action, choiceId: `CHOICE-${index + 1}` }));
  while (result.length < 3) result.push({ id: `WAIT-${result.length + 1}`, type: "observe", minutes: 30, label: "少し待つ", choiceId: `CHOICE-${result.length + 1}` });
  return result;
}

function objectiveReachable(state, model, objective) {
  if (!objective?.hub) return false;
  if (objective.hub === state.player.location) {
    if (!objective.facilityId) return true;
    const facility = model.facilityById[objective.facilityId];
    return Boolean(facility && facility.hub === state.player.location);
  }
  return Boolean(shortestTravelPlan(model, state, state.player.location, objective.hub));
}

function noteWaitingObjective(state, mission, step, objective) {
  const key = `${mission.id}:${step.id}:${objective.hub}:${objective.facilityId ?? ""}`;
  if (state.ai.inaccessibleObjectiveKeys.has(key)) return;
  state.ai.inaccessibleObjectiveKeys.add(key);
  state.metrics.movementObjectivesWaiting += 1;
  state.history.push({
    type: "MISSION_OBJECTIVE_WAITING_FOR_ACCESS",
    minute: state.absoluteMinute,
    missionId: mission.id,
    stepId: step.id,
    targetHub: objective.hub,
    targetFacilityId: objective.facilityId,
  });
}

function currentMissionObjective(state, profile, model) {
  const active = state.catalog.special
    .map((mission) => ({ mission, runtime: state.missions[mission.id] }))
    .filter(({ runtime }) => runtime.status === "active")
    .map(({ mission, runtime }) => ({ mission, step: currentMissionStepV2(mission, runtime) }))
    .filter(({ step }) => step)
    .sort((a, b) => a.mission.finalDay - b.mission.finalDay || b.mission.difficulty - a.mission.difficulty);
  if (!active.length || profile.story < .5) return null;
  for (const selected of active) {
    const objective = {
      hub: selected.step.targetHub ?? selected.mission.targetLocations[0],
      facilityId: selected.step.targetFacilityId ?? null,
      reason: `mission:${selected.mission.id}`,
    };
    if (objectiveReachable(state, model, objective)) return objective;
    noteWaitingObjective(state, selected.mission, selected.step, objective);
  }
  return null;
}

export function movementObjectiveV2(state, model, data, profile) {
  const mission = currentMissionObjective(state, profile, model);
  if (mission && (mission.hub !== state.player.location || mission.facilityId && mission.facilityId !== state.player.facilityId)) return mission;
  if (profile.id === "explorer" || profile.explore >= .8) {
    const local = (model.facilitiesByHub[state.player.location] ?? []).filter((facility) => !state.progress.travel.visitedFacilities.has(facility.id));
    if (local.length) return { hub: state.player.location, facilityId: local[0].id, reason: "explore-local" };
    const hubs = model.locations.filter((hub) => !state.progress.travel.visitedHubs.has(hub)).map((hub) => ({ hub, plan: shortestTravelPlan(model, state, state.player.location, hub) })).filter((entry) => entry.plan).sort((a, b) => a.plan.hours - b.plan.hours || a.hub.localeCompare(b.hub, "ja"));
    if (hubs.length) return { hub: hubs[0].hub, facilityId: null, reason: "explore-region" };
  }
  if (profile.id === "merchant" && state.player.gold >= 20 && state.absoluteMinute >= Number(state.ai.nextMerchantRegionalAt ?? 0)) {
    const regions = [...new Set(data.inventory.map((item) => item.location))]
      .filter((location) => location !== state.player.location)
      .map((location) => ({
        location,
        plan: shortestTravelPlan(model, state, state.player.location, location),
        lastVisitedAt: Number(state.ai.merchantVisitedAt[location] ?? -Infinity),
      }))
      .filter((entry) => entry.plan)
      .sort((a, b) => a.lastVisitedAt - b.lastVisitedAt || a.plan.hours - b.plan.hours || a.location.localeCompare(b.location, "ja"));
    if (regions.length) return { hub: regions[0].location, facilityId: null, reason: "merchant-region" };
  }
  if (profile.id === "random" && unitV2(state.seed, state.metrics.actions, "movement") < .16) {
    const actions = availableMovementActionsV2(state, model);
    if (actions.length) { const selected = actions[Math.floor(unitV2(state.seed, state.metrics.actions, "move-pick") * actions.length)]; return { hub: selected.destination, facilityId: selected.destinationFacilityId ?? null, reason: "random-movement" }; }
  }
  return null;
}

export function chooseMovementActionV2(state, model, objective) {
  if (!objective) return null;
  if (objective.hub === state.player.location && objective.facilityId && objective.facilityId !== state.player.facilityId) return availableLocalMovementActionsV2(state, model).find((action) => action.destinationFacilityId === objective.facilityId) ?? null;
  if (objective.hub !== state.player.location) return availableRegionalMovementActionsV2(state, model).find((action) => action.destination === objective.hub) ?? null;
  return null;
}

export function chooseActionV2(state, actions, profile) {
  if (profile.id === "random") return actions[Math.floor(unitV2(state.seed, state.absoluteMinute, state.metrics.actions, "choice") * actions.length)];
  return [...actions].sort((a, b) => actionUtilityV2(b, state, profile) - actionUtilityV2(a, state, profile) || a.id.localeCompare(b.id))[0];
}
