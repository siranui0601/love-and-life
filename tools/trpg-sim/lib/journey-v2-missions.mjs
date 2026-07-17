import {
  activateNextPermanentMissionV2,
  checkPermanentMissionV2,
  experienceToNextLevelV2,
} from "./mission-model-v2.mjs";
import { incV2 } from "./journey-v2-core.mjs";
import { effectiveSkillIdsV2, refreshSkillStateV2 } from "./journey-v2-skills.mjs";

export function currentMissionStepV2(mission, runtime) {
  return mission.steps?.find((step) => Number(runtime.progress[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

export function finishMissionStepV2(state, mission, runtime, step, amount = 1) {
  runtime.progress[step.id] = Math.min(Number(step.required ?? 1), Number(runtime.progress[step.id] ?? 0) + amount);
  state.history.push({ type: "MISSION_STEP", minute: state.absoluteMinute, missionId: mission.id, stepId: step.id, value: runtime.progress[step.id] });
}

export function addExperienceV2(state, data, skills, profile, amount, source) {
  const gain = Math.max(0, Math.round(Number(amount) || 0));
  if (!gain) return;
  state.player.exp += gain;
  state.progress.experience.total += gain;
  if (source.startsWith("battle:")) state.progress.experience.fromBattles += gain;
  else if (source.startsWith("mission:permanent")) state.progress.experience.fromPermanentMissions += gain;
  else if (source.startsWith("mission:special")) state.progress.experience.fromSpecialMissions += gain;
  state.history.push({ type: "EXP_GAIN", minute: state.absoluteMinute, amount: gain, source });
  while (state.player.level < 24 && state.player.exp >= experienceToNextLevelV2(state.player.level)) {
    state.player.exp -= experienceToNextLevelV2(state.player.level);
    state.player.level += 1;
    state.player.sp += 1;
    if (!state.metrics.firstLevelUpDay) state.metrics.firstLevelUpDay = state.day;
    const points = state.player.level % 5 === 0 ? 6 : 4;
    const ratios = profile.id === "fighter" ? [.55, .2, .2, .05]
      : profile.id === "cautious" ? [.2, .5, .2, .1]
        : profile.id === "explorer" ? [.25, .15, .45, .15] : [.35, .3, .25, .1];
    const names = ["attack", "defense", "agility", "luck"];
    let remaining = points;
    names.forEach((name, index) => {
      const value = index === names.length - 1 ? remaining : Math.floor(points * ratios[index]);
      state.player.stats[name] += value;
      remaining -= value;
    });
    state.history.push({ type: "LEVEL_UP", minute: state.absoluteMinute, level: state.player.level });
  }
  refreshSkillStateV2(state, data, skills, profile);
}

export function claimMissionV2(state, mission, runtime, data, skills, profile) {
  if (runtime.status === "completed") return false;
  runtime.status = "completed";
  runtime.completedAt = state.absoluteMinute;
  runtime.outcome = "resolved";
  incV2(state.progress, "missions.totalCompleted");
  if (mission.kind === "special") {
    incV2(state.progress, "missions.specialCompleted");
    state.progress.events.completedTroubleIds.add(mission.troubleId);
    state.metrics.specialMissionsCompleted += 1;
  } else {
    incV2(state.progress, "missions.permanentCompleted");
    incV2(state.progress.missions.completedByFamily, mission.family);
    state.metrics.permanentMissionsCompleted += 1;
  }
  addExperienceV2(state, data, skills, profile, mission.expReward, `mission:${mission.kind}:${mission.id}`);
  state.player.gold += Number(mission.goldReward ?? 0);
  state.history.push({ type: "MISSION_COMPLETED", minute: state.absoluteMinute, missionId: mission.id, exp: mission.expReward, gold: mission.goldReward ?? 0 });
  if (mission.kind === "permanent") {
    const next = activateNextPermanentMissionV2(state.catalog, state.missions, mission, state);
    if (next) state.history.push({ type: "MISSION_ACTIVATED", minute: state.absoluteMinute, missionId: next.id, reason: "previous-tier-completed" });
  }
  refreshSkillStateV2(state, data, skills, profile);
  return true;
}

function playerKnowsTrouble(state, troubleId) {
  return [...state.player.knownRumorIds].some((rumorId) => state.rumorById[rumorId]?.troubleId === troubleId);
}

export function refreshMissionsV2(state, data, skills, profile) {
  for (const mission of state.catalog.special) {
    const runtime = state.missions[mission.id];
    const trouble = state.troubles[mission.troubleId];
    if (["failed", "suppressed"].includes(trouble.status) && runtime.status !== "completed") {
      runtime.status = "failed";
      runtime.failedAt ??= state.absoluteMinute;
      runtime.outcome = trouble.status;
      continue;
    }
    if (runtime.status === "locked" && ["active", "critical"].includes(trouble.status)) {
      const discovered = playerKnowsTrouble(state, mission.troubleId) || mission.targetLocations.includes(state.player.location);
      if (discovered) {
        runtime.status = "active";
        runtime.activatedAt = state.absoluteMinute;
        runtime.discoveredAt = state.absoluteMinute;
        state.metrics.specialMissionsDiscovered += 1;
        state.history.push({ type: "MISSION_DISCOVERED", minute: state.absoluteMinute, missionId: mission.id, troubleId: mission.troubleId });
      }
    }
  }

  for (const mission of state.catalog.permanent) {
    const runtime = state.missions[mission.id];
    if (runtime.status !== "active") continue;
    const check = checkPermanentMissionV2(mission, runtime, state);
    runtime.progress.value = check.progress;
    runtime.progress.actual = check.actual;
    if (check.complete) claimMissionV2(state, mission, runtime, data, skills, profile);
  }

  const activePermanent = state.catalog.permanent.filter((mission) => state.missions[mission.id].status === "active").length;
  const activeSpecial = state.catalog.special.filter((mission) => state.missions[mission.id].status === "active").length;
  state.metrics.missionSamples += 1;
  state.metrics.activeMissionSum += activePermanent + activeSpecial;
  state.metrics.activeSpecialSum += activeSpecial;
  state.metrics.maxActiveMissions = Math.max(state.metrics.maxActiveMissions, activePermanent + activeSpecial);
  state.metrics.maxActiveSpecialMissions = Math.max(state.metrics.maxActiveSpecialMissions, activeSpecial);
}

export function resolutionScoreV2(state, mission, runtime, option, profile, data) {
  const evidence = Number(state.player.evidenceByTrouble[mission.troubleId] ?? 0);
  const support = Number(runtime.progress.support ?? 0);
  const battleStep = Number(runtime.progress.battle ?? runtime.progress.rescue ?? 0);
  const reputation = Number(state.player.reputation[state.player.location] ?? 0);
  const skills = [...effectiveSkillIdsV2(state, data)].map((id) => data.playerSkillById.get(id)).filter(Boolean);
  const supportSkills = skills.filter((skill) => /支援|回復|防御|デバフ|汎用/u.test(`${skill.category ?? ""}`)).length;
  const combatSkills = skills.filter((skill) => /物理|剣|斧|槍|弓|魔法|魔導/u.test(`${skill.category ?? ""}`)).length;
  let score = state.player.level * .32 + evidence * 1.6 + support * 1.8 + battleStep * 2.2 + reputation * .12 + Math.min(3, supportSkills * .18) + state.troubles[mission.troubleId].casualtyMitigation;
  if (option.focus === "combat") score += profile.combat * 3 + Math.min(4, combatSkills * .12);
  if (option.focus === "evidence") score += evidence * .9 + profile.story * 2 + profile.explore;
  if (option.focus === "reputation") score += reputation * .12 + profile.story * 1.5 + profile.trade;
  if (option.focus === "protection") score += support * 1.2 + profile.caution * 3;
  const threshold = 4.5 + mission.difficulty * 1.45 + Number(option.thresholdModifier ?? 0);
  return { score, threshold, evidence, support, battleStep, reputation, supportSkills, combatSkills };
}
