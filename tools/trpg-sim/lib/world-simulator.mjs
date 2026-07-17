import { createHash } from "node:crypto";
import { planDijkstra } from "./goap.mjs";
import {
  auditNpcLifeSimulation,
  completeNpcLifeTick,
  createNpcLifeEngine,
  finalizeNpcLifeEngine,
  isNpcLifeEligible,
  npcRandom,
  prepareNpcLifeTick,
  settleNpcLifeAtEnd,
} from "./npc-life-engine.mjs";
import {
  TERMINAL_TROUBLE_STATES,
  TIME_SLOTS,
  createSeededRandom,
  loadWorldModel,
} from "./world-model.mjs";

export const HARD_TROUBLE_GATES = Object.freeze({
  T15: Object.freeze({ mode: "any-failure", prerequisites: Object.freeze(["T05", "T06"]) }),
  T18: Object.freeze({ mode: "all-failure", prerequisites: Object.freeze(["T13"]) }),
  T19: Object.freeze({ mode: "all-failure", prerequisites: Object.freeze(["T13"]) }),
});

export const DEFAULT_WORLD_TUNING = Object.freeze({
  neutralMitigationProbability: 0.52,
  resolutionDifficultyScale: 1,
  difficultyScaleByTrouble: Object.freeze({}),
  playerInterventionMode: false,
});

const LARGE_SCALE_TROUBLES = new Set(["T13", "T15", "T16", "T17", "T18", "T19"]);
const PHASE_OFFSET = new Map(TIME_SLOTS.map((slot) => [slot.index, slot.offsetHours]));
const SLOT_NAME = new Map(TIME_SLOTS.map((slot) => [slot.index, slot.id]));

export function isFailureLike(status) {
  return status === "critical" || status === "failed";
}

function stateStatus(stateById, id) {
  if (stateById instanceof Map) return stateById.get(id)?.status;
  return stateById?.[id]?.status ?? stateById?.[id];
}

export function evaluateTroubleGate(troubleId, stateById) {
  const rule = HARD_TROUBLE_GATES[troubleId];
  if (!rule) {
    const softPrerequisites = troubleId === "T16" ? ["T07", "T12", "T13"] : [];
    return {
      open: true,
      hard: false,
      rule: "unconditional",
      prerequisites: softPrerequisites,
      matched: softPrerequisites.filter((id) => isFailureLike(stateStatus(stateById, id))),
    };
  }
  const matched = rule.prerequisites.filter((id) => isFailureLike(stateStatus(stateById, id)));
  const open = rule.mode === "any-failure"
    ? matched.length > 0
    : matched.length === rule.prerequisites.length;
  return {
    open,
    hard: true,
    rule: rule.mode,
    prerequisites: [...rule.prerequisites],
    matched,
  };
}

function atOrAfter(day, phaseIndex, targetDay, targetPhase) {
  return day > targetDay || (day === targetDay && phaseIndex >= targetPhase);
}

function beforeOrAt(day, phaseIndex, targetDay, targetPhase) {
  return day < targetDay || (day === targetDay && phaseIndex <= targetPhase);
}

function absoluteHour(day, phaseIndex) {
  return (day - 1) * 24 + (PHASE_OFFSET.get(phaseIndex) ?? 0);
}

function eventDifficulty(trouble, tuning = DEFAULT_WORLD_TUNING) {
  let baseDifficulty = 3;
  if (trouble.id === "T13") baseDifficulty = 12;
  else if (LARGE_SCALE_TROUBLES.has(trouble.id)) baseDifficulty = 10;
  else if (/政治陰謀|軍事|古代|モンスター|人身売買/u.test(trouble.category)) baseDifficulty = 7;
  const difficultyScale = Number(tuning.difficultyScaleByTrouble?.[trouble.id] ?? tuning.resolutionDifficultyScale);
  return Number((baseDifficulty * difficultyScale).toFixed(6));
}

function initialTroubleState(trouble, tuning) {
  return {
    id: trouble.id,
    name: trouble.name,
    status: "scheduled",
    resolutionProgress: 0,
    escalationProgress: 0,
    casualtyMitigation: 0,
    lifeResolutionProgress: 0,
    lifeEscalationProgress: 0,
    resolutionThreshold: eventDifficulty(trouble, tuning),
    chainPressure: 0,
    gate: null,
    activatedAt: null,
    terminalAt: null,
    transitions: [],
    contributors: [],
  };
}

function initialNpcState(npc) {
  return {
    id: npc.id,
    name: npc.name,
    behaviorType: npc.behaviorType,
    disposition: npc.disposition,
    home: npc.home,
    location: npc.initialLocation,
    status: npc.initialStatus,
    travel: null,
    contributions: [],
    plansCreated: 0,
    routineTicks: 0,
    lastRoutine: null,
  };
}

function routeAllowed(route, from, to, npc, worldFlags) {
  if (route.gate === "elf-access") {
    if (from === "エルフの隠れ里") return true;
    if (to !== "エルフの隠れ里") return true;
    return Boolean(
      worldFlags.worldTreeFallen ||
      worldFlags.elfApproval ||
      npc.home === "エルフの隠れ里"
    );
  }
  if (route.gate === "blackridge-forest-access") {
    if (worldFlags.worldTreeFallen || worldFlags.blackridgePermit) return true;
    return npc.home === "黒嶺連合領" || npc.home === "エルフの隠れ里";
  }
  return true;
}

function movementActions(model, npc, worldFlags) {
  const actions = [];
  for (const route of model.routes) {
    const directions = [{ from: route.from, to: route.to }];
    if (route.bidirectional) directions.push({ from: route.to, to: route.from });
    for (const direction of directions) {
      if (!routeAllowed(route, direction.from, direction.to, npc, worldFlags)) continue;
      actions.push({
        id: `move:${route.id}:${direction.from}->${direction.to}`,
        routeId: route.id,
        from: direction.from,
        to: direction.to,
        cost: route.hours,
        preconditions: { at: direction.from },
        effects: { at: direction.to },
      });
    }
  }
  return actions;
}

export function planNpcTravel(model, npc, currentLocation, targets, worldFlags = {}) {
  const uniqueTargets = [...new Set(targets)].filter((target) => model.locations.includes(target));
  const actions = movementActions(model, npc, worldFlags);
  const candidates = uniqueTargets.map((target) => ({
    target,
    plan: planDijkstra({
      initialState: { at: currentLocation },
      goal: { at: target },
      actions,
      stateKey: (state) => state.at,
      maxExpansions: 1_000,
    }),
  })).filter((candidate) => candidate.plan.status === "success");
  candidates.sort((a, b) =>
    a.plan.cost - b.plan.cost ||
    a.plan.actions.length - b.plan.actions.length ||
    a.target.localeCompare(b.target, "ja")
  );
  return candidates[0] ?? null;
}

function transitionTrouble(runtime, trouble, nextStatus, time, reason) {
  const state = runtime.troubleStates[trouble.id];
  if (state.status === nextStatus) return null;
  const transition = {
    troubleId: trouble.id,
    from: state.status,
    to: nextStatus,
    day: time.day,
    phaseIndex: time.phaseIndex,
    hour: time.hour,
    absoluteHour: time.absoluteHour,
    reason,
  };
  state.status = nextStatus;
  state.transitions.push(transition);
  runtime.eventTransitions.push(transition);
  if (nextStatus === "active") state.activatedAt = { ...time };
  if (TERMINAL_TROUBLE_STATES.includes(nextStatus)) state.terminalAt = { ...time };
  applyWorldConsequences(runtime, trouble.id, nextStatus, time);
  applyTriggeredChains(runtime, trouble.id, nextStatus, time);
  return transition;
}

function applyWorldConsequences(runtime, troubleId, status, time) {
  const failureLike = status === "critical" || status === "failed";
  if (troubleId === "T13" && failureLike) {
    runtime.worldFlags.worldTreeFallen = true;
    runtime.worldFlags.forestMazeOpen = true;
    runtime.worldFlags.worldTreeFallenAt ??= { ...time };
  }
  if (troubleId === "T08" && status === "resolved") runtime.worldFlags.elfApproval = true;
  if (troubleId === "T12" && status === "resolved") runtime.worldFlags.blackridgePermit = true;
  if (troubleId === "T15" && failureLike) runtime.worldFlags.foreignFleetLanded = true;
  if (troubleId === "T17" && status === "resolved") runtime.worldFlags.secondSummoningStopped = true;
  if (troubleId === "T18" && failureLike) runtime.worldFlags.colossusAwake = true;
  if (troubleId === "T19" && status === "critical") runtime.worldFlags.blackridgeArmyAtCapital = true;
  if (troubleId === "T19" && status === "failed") runtime.worldFlags.capitalFallen = true;
}

function chainMatches(chain, troubleId, status) {
  if (chain.trigger.troubleId !== troubleId) return false;
  if (chain.trigger.state === "failed") return status === "critical" || status === "failed";
  return chain.trigger.state === status;
}

function applyTriggeredChains(runtime, troubleId, status, time) {
  for (const chain of runtime.model.chains) {
    if (!chainMatches(chain, troubleId, status) || runtime.appliedChainIds.has(chain.id)) continue;
    runtime.appliedChainIds.add(chain.id);
    const applied = {
      chainId: chain.id,
      triggerTroubleId: troubleId,
      triggerStatus: status,
      day: time.day,
      phaseIndex: time.phaseIndex,
      affectedTroubleIds: [...chain.affectedTroubleIds],
      worldChange: chain.worldChange,
    };
    runtime.appliedChains.push(applied);
    runtime.worldEffects.push({ ...applied });
    for (const affectedId of chain.affectedTroubleIds) {
      const affected = runtime.troubleStates[affectedId];
      if (affected && affected.status === "scheduled") affected.chainPressure += 0.75;
      else if (affected && affected.status === "active") affected.escalationProgress += 0.75;
    }
  }
}

function activateScheduledTroubles(runtime, time) {
  for (const trouble of runtime.model.troubles) {
    const state = runtime.troubleStates[trouble.id];
    if (state.status !== "scheduled") continue;
    if (!atOrAfter(time.day, time.phaseIndex, trouble.startDay, trouble.startPhase)) continue;
    const gate = evaluateTroubleGate(trouble.id, runtime.troubleStates);
    state.gate = { ...gate, checkedAt: { ...time } };
    runtime.gateChecks.push({ troubleId: trouble.id, ...state.gate });
    if (gate.hard && !gate.open) {
      transitionTrouble(runtime, trouble, "suppressed", time, `gate-closed:${gate.rule}`);
    } else {
      state.escalationProgress += state.chainPressure;
      transitionTrouble(runtime, trouble, "active", time, gate.hard ? `gate-open:${gate.rule}` : "scheduled-onset");
    }
  }
}

function settleNpcTravel(runtime, npcState, time) {
  const travel = npcState.travel;
  if (!travel || travel.arriveAt > time.absoluteHour + 1e-9) return false;
  npcState.location = travel.to;
  npcState.travel = null;
  runtime.movements.push({
    npcId: npcState.id,
    routeId: travel.routeId,
    from: travel.from,
    to: travel.to,
    departedAt: travel.departedAt,
    arrivedAt: travel.arriveAt,
    durationHours: travel.arriveAt - travel.departedAt,
    observedAt: time.absoluteHour,
  });
  return true;
}

function contributionDisposition(npc, rng, tuning) {
  if (npc.disposition === "mitigate" || npc.disposition === "escalate") return npc.disposition;
  if (/魔物|暗殺|人身売買|強硬派|武器商人|古代兵器/u.test(npc.occupation)) return "escalate";
  if (/医師|阻止派|代表|司令官|巫女|長老/u.test(npc.occupation)) return "mitigate";
  return rng() < tuning.neutralMitigationProbability ? "mitigate" : "escalate";
}

function contributeToTrouble(runtime, npc, npcState, trouble, time) {
  const key = `${npc.id}:${trouble.id}`;
  if (runtime.contributionKeys.has(key)) return false;
  runtime.contributionKeys.add(key);
  const disposition = contributionDisposition(npc, runtime.rng, runtime.tuning);
  const amount = Number((npc.importanceWeight * (0.82 + runtime.rng() * 0.36)).toFixed(6));
  const troubleState = runtime.troubleStates[trouble.id];
  if (disposition === "mitigate") {
    if (runtime.tuning.playerInterventionMode) troubleState.resolutionProgress += amount;
    else troubleState.casualtyMitigation = Number(((troubleState.casualtyMitigation ?? 0) + amount).toFixed(6));
  } else troubleState.escalationProgress += amount;
  const contribution = {
    npcId: npc.id,
    troubleId: trouble.id,
    disposition,
    amount,
    day: time.day,
    phaseIndex: time.phaseIndex,
    location: npcState.location,
  };
  troubleState.contributors.push(contribution);
  npcState.contributions.push(contribution);
  npcState.status = `${disposition}:${trouble.id}`;
  runtime.contributions.push(contribution);
  return true;
}

const NPC_LIFE_AUTONOMOUS_LOCAL_TROUBLES = new Set(["T01", "T03", "T04", "T09"]);

function applyNpcLifeCrisisAction(runtime, intent, time) {
  const trouble = runtime.model.troubleById[intent.troubleId];
  const troubleState = runtime.troubleStates[intent.troubleId];
  if (!trouble || !troubleState || !["active", "critical"].includes(troubleState.status)) return false;
  const key = `${intent.npc.id}:${intent.troubleId}:${time.day}:${intent.action}`;
  if (runtime.lifeContributionKeys.has(key)) return false;
  runtime.lifeContributionKeys.add(key);

  const mitigating = intent.action !== "escalate-crisis";
  if (mitigating && !NPC_LIFE_AUTONOMOUS_LOCAL_TROUBLES.has(intent.troubleId)) return false;
  const cap = troubleState.resolutionThreshold * (mitigating ? 0.35 : 0.25);
  const used = mitigating
    ? Number(troubleState.lifeResolutionProgress ?? 0)
    : Number(troubleState.lifeEscalationProgress ?? 0);
  if (used >= cap - 1e-9) return false;
  const base = 0.035 + intent.npc.importanceWeight * 0.025;
  const variance = 0.85 + npcRandom(runtime.seed, intent.npc.id, time.day, time.phaseIndex, `crisis-action:${intent.troubleId}`) * 0.3;
  const amount = Number(Math.min(base * variance, cap - used).toFixed(6));
  if (!(amount > 0)) return false;
  if (mitigating) {
    if (runtime.tuning.playerInterventionMode) troubleState.resolutionProgress += amount;
    else troubleState.casualtyMitigation = Number(((troubleState.casualtyMitigation ?? 0) + amount).toFixed(6));
    troubleState.lifeResolutionProgress = used + amount;
  } else {
    troubleState.escalationProgress += amount;
    troubleState.lifeEscalationProgress = used + amount;
  }
  const contribution = {
    npcId: intent.npc.id,
    troubleId: trouble.id,
    disposition: mitigating ? "mitigate" : "escalate",
    amount,
    day: time.day,
    phaseIndex: time.phaseIndex,
    location: intent.state.location,
    facilityId: intent.state.position?.facilityId ?? null,
    source: "npc-life-engine",
    action: intent.action,
  };
  troubleState.contributors.push(contribution);
  intent.state.contributions.push(contribution);
  runtime.contributions.push(contribution);
  return true;
}

function eventCandidates(runtime, npc) {
  return npc.relatedTroubleIds
    .map((id) => runtime.model.troubleById[id])
    .filter(Boolean)
    .filter((trouble) => {
      const state = runtime.troubleStates[trouble.id];
      return state.status === "active" && !runtime.contributionKeys.has(`${npc.id}:${trouble.id}`);
    })
    .sort((a, b) =>
      a.deadlineDay - b.deadlineDay ||
      a.deadlinePhase - b.deadlinePhase ||
      a.sourceOrder - b.sourceOrder
    );
}

function beginFirstRoute(runtime, npcState, planCandidate, time) {
  const action = planCandidate.plan.actions[0];
  if (!action) return false;
  const route = runtime.model.routeById[action.routeId];
  if (!route || action.from !== npcState.location) return false;
  npcState.travel = {
    routeId: route.id,
    from: action.from,
    to: action.to,
    departedAt: time.absoluteHour,
    arriveAt: time.absoluteHour + route.hours,
    target: planCandidate.target,
  };
  runtime.departures.push({
    npcId: npcState.id,
    routeId: route.id,
    from: action.from,
    to: action.to,
    departedAt: time.absoluteHour,
    arriveAt: time.absoluteHour + route.hours,
  });
  return true;
}

function actNpc(runtime, npc, npcState, time) {
  settleNpcTravel(runtime, npcState, time);
  if (!isNpcLifeEligible(npcState)) return;
  if (npcState.travel) return;

  if (npc.behaviorType === "routine") {
    npcState.routineTicks += 1;
    npcState.lastRoutine = npc.routine[SLOT_NAME.get(time.phaseIndex)] ?? "";
    runtime.stats.routineDecisions += 1;
    return;
  }

  const candidates = eventCandidates(runtime, npc);
  for (const trouble of candidates) {
    const planCandidate = planNpcTravel(runtime.model, npc, npcState.location, trouble.primaryLocations, runtime.worldFlags);
    if (!planCandidate) continue;
    npcState.plansCreated += 1;
    runtime.stats.goapPlans += 1;
    runtime.goapPlanLog.push({
      npcId: npc.id,
      troubleId: trouble.id,
      day: time.day,
      phaseIndex: time.phaseIndex,
      from: npcState.location,
      target: planCandidate.target,
      cost: planCandidate.plan.cost,
      actions: planCandidate.plan.actions.map((action) => action.id),
    });
    if (planCandidate.plan.actions.length === 0) {
      contributeToTrouble(runtime, npc, npcState, trouble, time);
    } else {
      beginFirstRoute(runtime, npcState, planCandidate, time);
    }
    return;
  }

  const fallback = planNpcTravel(runtime.model, npc, npcState.location, [npc.home], runtime.worldFlags);
  if (!fallback) {
    runtime.goapCandidateExhaustions.push({
      npcId: npc.id,
      day: time.day,
      phaseIndex: time.phaseIndex,
      location: npcState.location,
      activeRelatedTroubles: candidates.map((trouble) => trouble.id),
    });
    return;
  }
  npcState.plansCreated += 1;
  runtime.stats.goapPlans += 1;
  if (fallback.plan.actions.length > 0) beginFirstRoute(runtime, npcState, fallback, time);
  else {
    npcState.lastRoutine = npc.routine[SLOT_NAME.get(time.phaseIndex)] ?? "";
    runtime.stats.goapWaits += 1;
  }
}

function canAutonomouslyResolve(troubleState, tuning = DEFAULT_WORLD_TUNING) {
  if (!tuning.playerInterventionMode) return false;
  return troubleState.resolutionProgress >= troubleState.resolutionThreshold &&
    troubleState.resolutionProgress > troubleState.escalationProgress + 0.5;
}

function progressTroubles(runtime, time) {
  for (const trouble of runtime.model.troubles) {
    const state = runtime.troubleStates[trouble.id];
    if (state.status === "active" && beforeOrAt(time.day, time.phaseIndex, trouble.deadlineDay, trouble.deadlinePhase)) {
      if (canAutonomouslyResolve(state, runtime.tuning)) {
        transitionTrouble(runtime, trouble, "resolved", time, "autonomous-goap-threshold");
        continue;
      }
    }
    if (state.status === "active" && atOrAfter(time.day, time.phaseIndex, trouble.deadlineDay, trouble.deadlinePhase)) {
      transitionTrouble(runtime, trouble, "critical", time, "major-deadline-missed");
    }
    if (state.status === "critical" && atOrAfter(time.day, time.phaseIndex, trouble.finalDay, trouble.finalPhase)) {
      transitionTrouble(runtime, trouble, "failed", time, "final-worsening-reached");
    }
  }
}

function timelineConditionMet(runtime, entry) {
  const text = entry.conditionText;
  if (!text) return true;
  const ids = entry.troubleIds.length ? entry.troubleIds : (text.match(/T\d{2}/gu) ?? []);
  if (/未解決/u.test(text)) return ids.some((id) => runtime.troubleStates[id]?.status !== "resolved");
  if (/失敗/u.test(text)) {
    return ids.some((id) => {
      const state = runtime.troubleStates[id];
      const trouble = runtime.model.troubleById[id];
      if (!state || !trouble) return false;
      if (isFailureLike(state.status)) return true;
      return state.status === "active" && entry.day >= trouble.deadlineDay && !canAutonomouslyResolve(state, runtime.tuning);
    });
  }
  return true;
}

function recordTimeline(runtime, time) {
  const entries = runtime.model.timeline
    .filter((entry) => entry.day === time.day && entry.phaseIndex === time.phaseIndex)
    .sort((a, b) => a.sourceOrder - b.sourceOrder);
  for (const entry of entries) {
    if (!timelineConditionMet(runtime, entry)) continue;
    runtime.timelineLog.push({
      timelineId: entry.id,
      day: entry.day,
      phaseIndex: entry.phaseIndex,
      sourceOrder: entry.sourceOrder,
      troubleIds: [...entry.troubleIds],
      event: entry.event,
      conditionText: entry.conditionText,
    });
  }
}

function normalizeWorldTuning(tuning = {}) {
  const normalized = {
    ...DEFAULT_WORLD_TUNING,
    ...tuning,
    difficultyScaleByTrouble: Object.freeze({
      ...DEFAULT_WORLD_TUNING.difficultyScaleByTrouble,
      ...(tuning.difficultyScaleByTrouble ?? {}),
    }),
  };
  if (!(normalized.neutralMitigationProbability >= 0 && normalized.neutralMitigationProbability <= 1)) {
    throw new RangeError("neutralMitigationProbability must be between 0 and 1");
  }
  if (!(normalized.resolutionDifficultyScale > 0)) {
    throw new RangeError("resolutionDifficultyScale must be greater than 0");
  }
  for (const [troubleId, scale] of Object.entries(normalized.difficultyScaleByTrouble)) {
    if (!(Number(scale) > 0)) throw new RangeError(`difficultyScaleByTrouble.${troubleId} must be greater than 0`);
  }
  return Object.freeze(normalized);
}

function createRuntime(model, seed, tuning) {
  const normalizedTuning = normalizeWorldTuning(tuning);
  const runtime = {
    model,
    seed: String(seed),
    tuning: normalizedTuning,
    rng: createSeededRandom(seed),
    troubleStates: Object.fromEntries(model.troubles.map((trouble) => [trouble.id, initialTroubleState(trouble, normalizedTuning)])),
    npcStates: Object.fromEntries(model.npcs.map((npc) => [npc.id, initialNpcState(npc)])),
    worldFlags: {
      worldTreeFallen: false,
      forestMazeOpen: false,
      elfApproval: false,
      blackridgePermit: false,
      foreignFleetLanded: false,
      secondSummoningStopped: false,
      colossusAwake: false,
      blackridgeArmyAtCapital: false,
      capitalFallen: false,
    },
    contributionKeys: new Set(),
    lifeContributionKeys: new Set(),
    appliedChainIds: new Set(),
    appliedChains: [],
    worldEffects: [],
    contributions: [],
    movements: [],
    departures: [],
    eventTransitions: [],
    timelineLog: [],
    gateChecks: [],
    goapPlanLog: [],
    goapCandidateExhaustions: [],
    ticks: [],
    stats: { goapPlans: 0, goapWaits: 0, routineDecisions: 0 },
  };
  runtime.npcLife = createNpcLifeEngine({
    model,
    seed,
    npcStates: runtime.npcStates,
    departures: runtime.departures,
  });
  return runtime;
}

function terminalStateCounts(troubleStates) {
  const counts = {};
  for (const state of Object.values(troubleStates)) counts[state.status] = (counts[state.status] ?? 0) + 1;
  return counts;
}

function finalizeRuntime(runtime, endDay) {
  const finalAbsoluteHour = (endDay - 1) * 24 + 14;
  const finalTime = { day: endDay, phaseIndex: 3, hour: 24, absoluteHour: finalAbsoluteHour };
  const movementStart = runtime.movements.length;
  for (const npcState of Object.values(runtime.npcStates)) settleNpcTravel(runtime, npcState, finalTime);
  const endSettlement = settleNpcLifeAtEnd(runtime.npcLife, { time: finalTime });
  const finalTick = runtime.ticks.at(-1);
  if (finalTick) {
    finalTick.movementsCompleted += runtime.movements.length - movementStart;
    finalTick.localMovementsCompleted += endSettlement.localMovementsCompleted;
    finalTick.travelingNpcs = endSettlement.population.traveling;
  }
  const npcLife = finalizeNpcLifeEngine(runtime.npcLife);

  const result = {
    schemaVersion: "2.0.0",
    engineVersion: "living-world-v2",
    rngVersion: "stateless-fnv1a32-v1",
    simulationMode: "no-player",
    rules: { npcMitigationCanResolve: false },
    seed: runtime.seed,
    tuning: runtime.tuning,
    start: { day: 1, hour: 10 },
    end: { day: endDay, hour: 24 },
    tickCount: runtime.ticks.length,
    modelCounts: {
      locations: runtime.model.locations.length,
      routes: runtime.model.routes.length,
      troubles: runtime.model.troubles.length,
      chains: runtime.model.chains.length,
      npcs: runtime.model.npcs.length,
      facilities: runtime.model.facilities?.length ?? 0,
    },
    assumptions: runtime.model.assumptions,
    diagnostics: runtime.model.diagnostics,
    worldFlags: runtime.worldFlags,
    troubleStates: runtime.troubleStates,
    npcStates: runtime.npcStates,
    eventTransitions: runtime.eventTransitions,
    appliedChains: runtime.appliedChains,
    worldEffects: runtime.worldEffects,
    timelineLog: runtime.timelineLog,
    contributions: runtime.contributions,
    movements: runtime.movements,
    departures: runtime.departures,
    gateChecks: runtime.gateChecks,
    goapPlanLog: runtime.goapPlanLog,
    goapCandidateExhaustions: runtime.goapCandidateExhaustions,
    ticks: runtime.ticks,
    stats: runtime.stats,
    npcTraces: npcLife.npcTraces,
    lifeEvents: npcLife.lifeEvents,
    knowledgeEvents: npcLife.knowledgeEvents,
    decisionEvents: npcLife.decisionEvents,
    localMovementEvents: npcLife.localMovementEvents,
    populationByTick: npcLife.populationByTick,
    activityCoverage: npcLife.activityCoverage,
    npcLifeTraceFingerprint: npcLife.traceFingerprint,
    summary: {
      troubleStates: terminalStateCounts(runtime.troubleStates),
      terminalTroubles: Object.values(runtime.troubleStates).filter((state) => TERMINAL_TROUBLE_STATES.includes(state.status)).length,
      totalTroubles: runtime.model.troubles.length,
      npcContributors: new Set(runtime.contributions.map((entry) => entry.npcId)).size,
      movements: runtime.movements.length,
      localMovements: npcLife.localMovementEvents.length,
      knowledgeEvents: npcLife.knowledgeEvents.length,
      lifeEvents: npcLife.lifeEvents.length,
      activeNpcCoverage: npcLife.activityCoverage.coverage,
      appliedChains: runtime.appliedChains.length,
    },
  };
  result.invariants = auditWorldSimulation(result, runtime.model);
  result.summary.worldEnded = result.invariants.ok;
  result.fingerprint = stableSimulationFingerprint(result);
  return result;
}

export function simulateWorld({ model = loadWorldModel(), seed = "world-default", endDay = 100, tuning = DEFAULT_WORLD_TUNING } = {}) {
  if (!Number.isInteger(endDay) || endDay < 1 || endDay > 100) {
    throw new RangeError("endDay must be an integer from 1 through 100");
  }
  const runtime = createRuntime(model, seed, tuning);
  for (let day = 1; day <= endDay; day += 1) {
    for (const slot of TIME_SLOTS) {
      const time = {
        day,
        phaseIndex: slot.index,
        phase: slot.id,
        hour: slot.hour,
        absoluteHour: absoluteHour(day, slot.index),
      };
      const movementStart = runtime.movements.length;
      const localMovementStart = runtime.npcLife.localMovementEvents.length;
      const transitionStart = runtime.eventTransitions.length;
      const planStart = runtime.stats.goapPlans;
      const decisionStart = runtime.npcLife.decisionEvents.length;
      activateScheduledTroubles(runtime, time);
      for (const npc of [...model.npcs].sort((left, right) => left.id.localeCompare(right.id, "en"))) {
        settleNpcTravel(runtime, runtime.npcStates[npc.id], time);
      }
      prepareNpcLifeTick(runtime.npcLife, {
        time,
        troubleStates: runtime.troubleStates,
        worldFlags: runtime.worldFlags,
      });
      const lifeCrisisActions = completeNpcLifeTick(runtime.npcLife, {
        time,
        troubleStates: runtime.troubleStates,
        worldFlags: runtime.worldFlags,
      });
      for (const decision of runtime.npcLife.decisionEvents.slice(decisionStart)) {
        const npc = model.npcById[decision.npcId];
        if (npc?.behaviorType === "routine") runtime.stats.routineDecisions += 1;
        else if (decision.replanned) runtime.stats.goapPlans += 1;
        if (["rest", "eat", "socialize", "work", "hide", "observe", "wait-no-route"].includes(decision.action)) runtime.stats.goapWaits += 1;
      }
      for (const intent of lifeCrisisActions) applyNpcLifeCrisisAction(runtime, intent, time);
      progressTroubles(runtime, time);
      recordTimeline(runtime, time);
      const counts = terminalStateCounts(runtime.troubleStates);
      runtime.ticks.push({
        day,
        phaseIndex: slot.index,
        phase: slot.id,
        hour: slot.hour,
        active: counts.active ?? 0,
        critical: counts.critical ?? 0,
        terminal: (counts.failed ?? 0) + (counts.resolved ?? 0) + (counts.suppressed ?? 0),
        travelingNpcs: Object.values(runtime.npcStates).filter((state) => state.travel || state.localTravel).length,
        movementsCompleted: runtime.movements.length - movementStart,
        localMovementsCompleted: runtime.npcLife.localMovementEvents.length - localMovementStart,
        transitions: runtime.eventTransitions.length - transitionStart,
        goapPlans: runtime.stats.goapPlans - planStart,
      });
    }
  }
  return finalizeRuntime(runtime, endDay);
}

function chronologicalCompare(a, b) {
  return a.day - b.day || a.phaseIndex - b.phaseIndex || a.sourceOrder - b.sourceOrder;
}

export function auditWorldSimulation(result, model) {
  const knownLocations = new Set(model.locations);
  const teleports = [];
  const unknownLocations = [];
  const routeDurationViolations = [];
  const prematureTransitions = [];
  const timelineOrderViolations = [];
  const gateViolations = [];
  const missingChainApplications = [];
  const structuralViolations = [];
  const unauthorizedTroubleResolutionViolations = [];

  if (result.tickCount !== 400) structuralViolations.push({ code: "TICK_COUNT", expected: 400, actual: result.tickCount });
  for (const [key, expected] of Object.entries({ routes: 15, troubles: 19, chains: 23, npcs: 110, facilities: 103 })) {
    if (result.modelCounts[key] !== expected) structuralViolations.push({ code: `COUNT_${key.toUpperCase()}`, expected, actual: result.modelCounts[key] });
  }

  const lastLocation = Object.fromEntries(model.npcs.map((npc) => [npc.id, npc.initialLocation]));
  const movements = [...result.movements].sort((a, b) => a.arrivedAt - b.arrivedAt || a.npcId.localeCompare(b.npcId, "en"));
  for (const movement of movements) {
    const route = model.routeById[movement.routeId];
    if (!knownLocations.has(movement.from) || !knownLocations.has(movement.to)) unknownLocations.push(movement);
    if (!route) {
      teleports.push({ ...movement, reason: "unknown-route" });
      continue;
    }
    const endpointsMatch =
      (route.from === movement.from && route.to === movement.to) ||
      (route.bidirectional && route.from === movement.to && route.to === movement.from);
    if (!endpointsMatch || lastLocation[movement.npcId] !== movement.from) {
      teleports.push({ ...movement, expectedFrom: lastLocation[movement.npcId], reason: "non-contiguous-route" });
    }
    if (Math.abs(movement.durationHours - route.hours) > 1e-8) {
      routeDurationViolations.push({ ...movement, expectedHours: route.hours });
    }
    lastLocation[movement.npcId] = movement.to;
  }
  for (const npc of model.npcs) {
    const state = result.npcStates[npc.id];
    if (!state || !knownLocations.has(state.location)) unknownLocations.push({ npcId: npc.id, location: state?.location });
    if (state?.travel && (!knownLocations.has(state.travel.from) || !knownLocations.has(state.travel.to))) {
      unknownLocations.push({ npcId: npc.id, travel: state.travel });
    }
  }

  for (const transition of result.eventTransitions) {
    const trouble = model.troubleById[transition.troubleId];
    if (!trouble) continue;
    if (transition.to === "critical" && !atOrAfter(transition.day, transition.phaseIndex, trouble.deadlineDay, trouble.deadlinePhase)) prematureTransitions.push(transition);
    if (transition.to === "failed" && !atOrAfter(transition.day, transition.phaseIndex, trouble.finalDay, trouble.finalPhase)) prematureTransitions.push(transition);
    if ((transition.to === "suppressed" || transition.to === "resolved") && !atOrAfter(transition.day, transition.phaseIndex, trouble.startDay, trouble.startPhase)) prematureTransitions.push(transition);
  }

  const terminalLeaks = Object.values(result.troubleStates)
    .filter((state) => !TERMINAL_TROUBLE_STATES.includes(state.status))
    .map((state) => ({ troubleId: state.id, status: state.status }));

  if (!result.tuning?.playerInterventionMode) {
    for (const state of Object.values(result.troubleStates)) {
      if (state.status === "resolved") unauthorizedTroubleResolutionViolations.push({ troubleId: state.id, status: state.status });
    }
  }

  const sortedTimeline = [...result.timelineLog].sort(chronologicalCompare);
  for (let index = 0; index < result.timelineLog.length; index += 1) {
    if (result.timelineLog[index].timelineId !== sortedTimeline[index].timelineId) {
      timelineOrderViolations.push({ index, actual: result.timelineLog[index], expected: sortedTimeline[index] });
      break;
    }
  }

  for (const check of result.gateChecks) {
    if (!check.hard) continue;
    const transition = result.eventTransitions.find((entry) => entry.troubleId === check.troubleId && entry.from === "scheduled");
    if ((!check.open && transition?.to !== "suppressed") || (check.open && transition?.to !== "active")) {
      gateViolations.push({ check, transition });
    }
  }

  const applied = new Set(result.appliedChains.map((entry) => entry.chainId));
  for (const chain of model.chains) {
    const source = result.troubleStates[chain.trigger.troubleId];
    const shouldApply = chain.trigger.state === "failed"
      ? isFailureLike(source?.status)
      : chain.trigger.state === "resolved"
        ? source?.status === "resolved"
        : Boolean(source?.activatedAt);
    if (shouldApply && !applied.has(chain.id)) missingChainApplications.push(chain.id);
  }

  const lifeAudit = auditNpcLifeSimulation(result, model);
  const categories = {
    teleports,
    unknownLocations,
    routeDurationViolations,
    prematureTransitions,
    terminalLeaks,
    goapCandidateExhaustions: result.goapCandidateExhaustions,
    timelineOrderViolations,
    gateViolations,
    missingChainApplications,
    structuralViolations,
    unauthorizedTroubleResolutionViolations,
    ...lifeAudit,
  };
  return {
    ok: Object.values(categories).every((entries) => entries.length === 0),
    ...categories,
  };
}

export function stableSimulationFingerprint(result) {
  const canonical = {
    seed: result.seed,
    tuning: result.tuning,
    end: result.end,
    worldFlags: result.worldFlags,
    troubleStates: Object.values(result.troubleStates).map((state) => ({
      id: state.id,
      status: state.status,
      resolutionProgress: Number(state.resolutionProgress.toFixed(6)),
      escalationProgress: Number(state.escalationProgress.toFixed(6)),
    })),
    transitions: result.eventTransitions,
    chains: result.appliedChains.map((chain) => chain.chainId),
    movements: result.movements,
    contributions: result.contributions,
    npcLifeTraceFingerprint: result.npcLifeTraceFingerprint,
    lifeEvents: result.lifeEvents,
    knowledgeEvents: result.knowledgeEvents,
    localMovementEvents: result.localMovementEvents,
    populationByTick: result.populationByTick,
    activityCoverage: result.activityCoverage,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
