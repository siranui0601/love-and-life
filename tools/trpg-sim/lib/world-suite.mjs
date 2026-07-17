import { mean, quantile } from "./statistics.mjs";
import { simulateWorld } from "./world-simulator.mjs";

const PHASES = Object.freeze(["morning", "day", "evening", "night"]);

function increment(target, key, amount = 1) {
  target[key] = (target[key] ?? 0) + amount;
}

function distribution(values) {
  return {
    mean: mean(values),
    median: quantile(values, 0.5),
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function asEntries(value) {
  if (Array.isArray(value)) return value.map((entry, index) => [String(index), entry]);
  if (value && typeof value === "object") return Object.entries(value);
  return [];
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function dayOf(entry) {
  const explicit = finite(entry?.day ?? entry?.time?.day, NaN);
  if (Number.isFinite(explicit)) return Math.max(1, Math.trunc(explicit));
  const tick = finite(entry?.tick ?? entry?.tickIndex, NaN);
  if (Number.isFinite(tick)) return Math.floor(Math.max(0, tick) / 4) + 1;
  const absoluteHour = finite(
    entry?.absoluteHour ?? entry?.learnedAt ?? entry?.observedAt ?? entry?.arrivedAt ?? entry?.departedAt,
    NaN
  );
  return Number.isFinite(absoluteHour) ? Math.floor(Math.max(0, absoluteHour) / 24) + 1 : 1;
}

function phaseIndexOf(entry) {
  const explicit = finite(entry?.phaseIndex ?? entry?.time?.phaseIndex, NaN);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(3, Math.trunc(explicit)));
  const phase = String(entry?.phase ?? entry?.time?.phase ?? "").toLowerCase();
  const index = PHASES.indexOf(phase);
  if (index >= 0) return index;
  const tick = finite(entry?.tick ?? entry?.tickIndex, NaN);
  if (Number.isFinite(tick)) return Math.max(0, Math.trunc(tick)) % 4;
  const absoluteHour = finite(entry?.absoluteHour ?? entry?.learnedAt ?? entry?.observedAt ?? entry?.arrivedAt, NaN);
  if (!Number.isFinite(absoluteHour)) return 0;
  const offset = ((absoluteHour % 24) + 24) % 24;
  return offset >= 12 ? 3 : offset >= 8 ? 2 : offset >= 4 ? 1 : 0;
}

function tickOf(entry) {
  const explicit = finite(entry?.tick ?? entry?.tickIndex, NaN);
  return Number.isFinite(explicit) ? Math.max(0, Math.trunc(explicit)) : (dayOf(entry) - 1) * 4 + phaseIndexOf(entry);
}

function npcIdOf(entry, fallback = null) {
  return entry?.npcId ?? entry?.recipientNpcId ?? entry?.recipientId ?? entry?.listenerId ?? entry?.actorId ?? entry?.agentId ?? entry?.npc?.id ?? fallback;
}

function locationOf(entry, fallback = null) {
  const value = entry?.locationId ?? entry?.facilityId ?? entry?.position?.facilityId ?? entry?.hubId ?? entry?.position?.hubId
    ?? entry?.placeId ?? entry?.location ?? entry?.currentLocation ?? entry?.after?.locationId ?? fallback;
  if (value && typeof value === "object") {
    return value.facilityId ?? value.hubId ?? value.id ?? value.placeId ?? value.name ?? fallback;
  }
  return value ?? fallback;
}

function lifeStateOf(entry, fallback = "alive") {
  const raw = String(entry?.toLifeStatus ?? entry?.vitalState ?? entry?.lifeStatus ?? entry?.lifeState
    ?? entry?.healthState ?? entry?.after?.vitalState ?? entry?.after?.lifeStatus ?? fallback).toLowerCase();
  if (/dead|死亡|死亡済/u.test(raw)) return "dead";
  if (/injur|wound|負傷|重傷|衰弱|病気/u.test(raw)) return "injured";
  return raw || "alive";
}

function presenceOf(entry, fallback = "present") {
  const raw = String(entry?.presence ?? entry?.presenceState ?? entry?.stageState ?? entry?.after?.presence ?? fallback).toLowerCase();
  if (/missing|行方不明|失踪/u.test(raw)) return "missing";
  if (/travel|移動中/u.test(raw)) return "traveling";
  if (/captur|拘束|捕虜/u.test(raw)) return "captured";
  if (/depart|退場|離脱/u.test(raw)) return "departed";
  return raw || "present";
}

function actionOf(entry) {
  const action = entry?.actionType ?? entry?.selectedAction ?? entry?.action?.type ?? entry?.action
    ?? entry?.decision?.actionType ?? entry?.decision?.selectedAction;
  if (action && typeof action === "object") return action.id ?? action.type ?? action.label ?? "act";
  return action ? String(action) : null;
}

function goalOf(entry) {
  const goal = entry?.goalId ?? entry?.selectedGoalId ?? entry?.currentGoal ?? entry?.goal ?? entry?.decision?.selectedGoalId;
  if (goal && typeof goal === "object") return goal.id ?? goal.label ?? null;
  return goal ? String(goal) : null;
}

function reasonOf(entry) {
  return entry?.reason ?? entry?.reasonCode ?? entry?.decisionReason ?? entry?.decision?.reason ?? entry?.cause ?? null;
}

function uniqueStrings(values, limit = 6) {
  return [...new Set(values.filter(Boolean).map(String))].slice(0, limit);
}

function chronological(left, right) {
  return tickOf(left) - tickOf(right) || String(npcIdOf(left) ?? "").localeCompare(String(npcIdOf(right) ?? ""), "en");
}

function compactMovement(entry) {
  return {
    type: "movement",
    eventId: entry.eventId ?? entry.id ?? null,
    npcId: npcIdOf(entry),
    tick: tickOf(entry),
    day: dayOf(entry),
    phaseIndex: phaseIndexOf(entry),
    from: entry.fromPlaceId ?? entry.fromFacilityId ?? entry.from ?? entry.origin ?? null,
    to: entry.toPlaceId ?? entry.toFacilityId ?? entry.to ?? entry.destination ?? null,
    routeId: entry.routeId ?? null,
    movementKind: entry.movementKind ?? entry.kind ?? (entry.scope === "facility" ? "local" : entry.routeId ? "inter-settlement" : "local"),
    reason: reasonOf(entry),
  };
}

function compactLifeEvent(entry) {
  const toLifeStatus = entry.toLifeStatus ?? entry.vitalState ?? entry.lifeStatus ?? entry.lifeState ?? null;
  const toPresence = entry.toPresence ?? entry.presence ?? entry.presenceState ?? null;
  const to = entry.to ?? entry.nextState ?? toPresence ?? toLifeStatus ?? entry.status ?? null;
  const type = entry.type ?? entry.eventType ?? "lifecycle";
  const lifecycleText = `${type} ${toLifeStatus ?? ""}`.toLowerCase();
  const vitalState = /death|dead|died|死亡/u.test(lifecycleText)
    ? "dead"
    : /injur|wound|負傷|重傷/u.test(lifecycleText)
      ? "injured"
      : lifeStateOf(entry, String(toLifeStatus ?? "alive"));
  const presenceText = `${type} ${toPresence ?? ""}`.toLowerCase();
  const presence = /missing|lost|行方不明|失踪/u.test(presenceText)
    ? "missing"
    : /depart|退場|離脱/u.test(presenceText)
      ? "departed"
      : presenceOf(entry, String(toPresence ?? "present"));
  const relatedTroubleIds = uniqueStrings([
    entry.troubleId,
    entry.causeTroubleId,
    ...asArray(entry.relatedTroubleIds),
    ...asArray(entry.troubleIds),
  ], 20);
  return {
    type,
    eventId: entry.eventId ?? entry.id ?? null,
    npcId: npcIdOf(entry),
    tick: tickOf(entry),
    day: dayOf(entry),
    phaseIndex: phaseIndexOf(entry),
    from: entry.from ?? entry.previousState ?? null,
    to,
    vitalState,
    presence,
    location: locationOf(entry),
    troubleId: entry.troubleId ?? entry.causeTroubleId ?? relatedTroubleIds[0] ?? null,
    relatedTroubleIds,
    cause: entry.cause ?? entry.reason ?? null,
    causeEventId: entry.causeEventId ?? entry.sourceEventId ?? null,
    reason: reasonOf(entry),
  };
}

function compactKnowledgeEvent(entry) {
  const accepted = entry.accepted ?? entry.pickedUp ?? entry.learned ?? !/ignore|reject|ignored|無視|却下/u.test(`${entry.outcome ?? ""} ${entry.reason ?? ""}`);
  const learnedAt = finite(entry.learnedAt ?? entry.observedAt, NaN);
  const sourceLearnedAt = finite(entry.sourceLearnedAt, NaN);
  const explicitLatency = Number(entry.latencyTicks ?? entry.delayTicks);
  const latencyTicks = Number.isFinite(explicitLatency)
    ? explicitLatency
    : Number.isFinite(learnedAt) && Number.isFinite(sourceLearnedAt)
      ? Math.max(0, (learnedAt - sourceLearnedAt) / 4)
      : null;
  return {
    type: entry.type ?? entry.eventType ?? "knowledge",
    eventId: entry.eventId ?? entry.id ?? null,
    npcId: npcIdOf(entry),
    tick: tickOf(entry),
    day: dayOf(entry),
    phaseIndex: phaseIndexOf(entry),
    factId: entry.factId ?? entry.knowledgeId ?? entry.fact?.id ?? entry.tag ?? null,
    label: entry.label ?? entry.fact?.label ?? entry.text ?? null,
    sourceNpcId: entry.sourceNpcId ?? entry.fromNpcId ?? null,
    sourceEventId: entry.sourceEventId ?? entry.causeEventId ?? null,
    learnedAt: Number.isFinite(learnedAt) ? learnedAt : null,
    sourceLearnedAt: Number.isFinite(sourceLearnedAt) ? sourceLearnedAt : null,
    availableAt: Number.isFinite(Number(entry.propagationAt)) ? Number(entry.propagationAt) : null,
    propagationId: entry.propagationId ?? entry.rumorId ?? null,
    hopCount: finite(entry.hopCount ?? entry.hops),
    path: asArray(entry.path ?? entry.hopPath ?? entry.propagationPath).map(String),
    importance: Number.isFinite(Number(entry.importance ?? entry.priority)) ? Number(entry.importance ?? entry.priority) : null,
    latencyTicks,
    accepted: Boolean(accepted),
    outcome: entry.outcome ?? (accepted ? "accepted" : "ignored"),
    ignoredReason: entry.ignoredReason ?? (!accepted ? reasonOf(entry) : null),
    location: locationOf(entry),
    confidence: Number.isFinite(Number(entry.confidence)) ? Number(entry.confidence) : null,
    reason: reasonOf(entry),
  };
}

function compactDecisionEvent(entry) {
  const usedFacts = asArray(entry.usedFactIds ?? entry.usedKnowledgeIds ?? entry.knowledgeUsed ?? entry.decision?.usedFactIds);
  return {
    type: entry.type ?? entry.eventType ?? "decision",
    eventId: entry.eventId ?? entry.id ?? null,
    npcId: npcIdOf(entry),
    tick: tickOf(entry),
    day: dayOf(entry),
    phaseIndex: phaseIndexOf(entry),
    goalId: goalOf(entry),
    planId: entry.planId ?? entry.selectedPlanId ?? entry.decision?.planId ?? null,
    previousPlanId: entry.previousPlanId ?? entry.fromPlanId ?? null,
    actionType: actionOf(entry),
    changed: Boolean(entry.changed ?? entry.planChanged ?? entry.replanned ?? entry.type === "plan-revised"),
    usedFactIds: uniqueStrings(usedFacts, 10),
    location: locationOf(entry),
    reason: reasonOf(entry),
  };
}

function isSignificantDecision(entry) {
  const text = `${entry.type ?? ""} ${entry.reason ?? ""} ${entry.actionType ?? ""}`;
  return Boolean(
    (entry.changed && entry.usedFactIds?.length) ||
    /source-fate|flee|evac|rescue|death|missing|運命|避難|救出/u.test(text)
  );
}

function normalizeTraceEntries(value) {
  return asEntries(value).map(([key, trace]) => ({
    key,
    trace: Array.isArray(trace) ? trace : trace && typeof trace === "object" ? trace : {},
  }));
}

function compactNpcTrace({ id, trace, state, movements, lifeEvents, knowledgeEvents, decisionEvents, endDay }) {
  const traceObject = Array.isArray(trace) ? {} : trace;
  const ticks = (Array.isArray(trace)
    ? trace
    : asArray(traceObject.ticks ?? traceObject.states ?? traceObject.snapshots ?? traceObject.timelineTicks))
    .slice()
    .sort(chronological);
  const suppliedDaily = asArray(traceObject.daily ?? traceObject.days ?? traceObject.dailySummaries);
  const traceEvents = asArray(traceObject.events ?? traceObject.timeline ?? traceObject.significantEvents);
  const ownMovements = movements.filter((entry) => entry.npcId === id);
  const ownLife = lifeEvents.filter((entry) => entry.npcId === id);
  const ownKnowledge = knowledgeEvents.filter((entry) => entry.npcId === id);
  const ownDecisions = decisionEvents.filter((entry) => entry.npcId === id);
  const ownEvents = [...traceEvents, ...ownMovements, ...ownLife, ...ownKnowledge, ...ownDecisions]
    .filter((entry) => !npcIdOf(entry) || npcIdOf(entry) === id)
    .sort(chronological);

  const dailySource = suppliedDaily.length ? suppliedDaily : ticks;
  const byDay = new Map();
  for (const entry of dailySource) {
    const day = dayOf(entry);
    if (day < 1 || day > endDay) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(entry);
  }
  const eventsByDay = new Map();
  for (const entry of ownEvents) {
    const day = dayOf(entry);
    if (!eventsByDay.has(day)) eventsByDay.set(day, []);
    eventsByDay.get(day).push(entry);
  }

  const initial = traceObject.initial ?? ticks[0] ?? state;
  let carriedLocation = locationOf(initial, state?.location ?? state?.initialLocation ?? null);
  let carriedLife = lifeStateOf(initial, "alive");
  let carriedPresence = presenceOf(initial, state?.travel ? "traveling" : "present");
  let carriedGoal = goalOf(initial);
  const daily = [];
  for (let day = 1; day <= endDay; day += 1) {
    const entries = byDay.get(day) ?? [];
    const events = eventsByDay.get(day) ?? [];
    if (!entries.length && !events.length && !suppliedDaily.length && !ticks.length) continue;
    const last = entries.at(-1) ?? {};
    const life = events.filter((entry) => entry.type === "lifecycle" || /death|dead|died|missing|injur|depart|captur/u.test(String(entry.type ?? ""))).at(-1);
    carriedLocation = locationOf(last, events.map((entry) => entry.to ?? entry.location).filter(Boolean).at(-1) ?? carriedLocation);
    carriedLife = life ? lifeStateOf(life, carriedLife) : lifeStateOf(last, carriedLife);
    carriedPresence = life ? presenceOf(life, carriedPresence) : presenceOf(last, carriedPresence);
    carriedGoal = goalOf(last) ?? carriedGoal;
    const dayMovements = ownMovements.filter((entry) => entry.day === day);
    const dayKnowledge = ownKnowledge.filter((entry) => entry.day === day && entry.accepted !== false);
    const dayDecisions = ownDecisions.filter((entry) => entry.day === day);
    const actions = uniqueStrings([...entries.map(actionOf), ...dayDecisions.map((entry) => entry.actionType)], 4);
    const tickDecisionCount = entries.filter((entry) => entry.eligible !== false && actionOf(entry)).length;
    daily.push({
      day,
      location: carriedLocation,
      vitalState: carriedLife,
      presence: carriedPresence,
      goalId: carriedGoal,
      action: actions[0] ?? null,
      actions,
      moved: dayMovements.length > 0,
      learned: dayKnowledge.length > 0,
      replanned: dayDecisions.some((entry) => entry.changed),
      movementCount: dayMovements.length,
      knowledgeCount: dayKnowledge.length,
      decisionCount: tickDecisionCount || dayDecisions.length,
      reason: reasonOf(dayDecisions.at(-1) ?? last) ?? events.map(reasonOf).filter(Boolean).at(-1) ?? null,
    });
  }

  const metadata = traceObject.npc ?? traceObject.profile ?? traceObject.meta ?? {};
  const final = traceObject.final ?? ticks.at(-1) ?? state ?? {};
  return {
    id,
    name: metadata.name ?? traceObject.name ?? state?.name ?? id,
    behaviorType: metadata.behaviorType ?? traceObject.behaviorType ?? state?.behaviorType ?? "unknown",
    importance: metadata.importance ?? traceObject.importance ?? state?.importance ?? null,
    home: metadata.home ?? traceObject.home ?? state?.home ?? null,
    initialLocation: locationOf(initial, state?.initialLocation ?? state?.home ?? null),
    finalLocation: locationOf(final, state?.location ?? null),
    vitalState: lifeStateOf(final, carriedLife),
    presence: presenceOf(final, state?.travel ? "traveling" : carriedPresence),
    daily,
    stats: {
      stateTicks: ticks.length,
      observedDays: daily.length,
      decisions: ticks.length ? ticks.filter((entry) => entry.eligible !== false && actionOf(entry)).length : ownDecisions.length,
      movements: ownMovements.length,
      knowledgeGained: ownKnowledge.filter((entry) => entry.accepted !== false).length,
      replans: ownDecisions.filter((entry) => entry.changed).length,
      lifecycleEvents: ownLife.length,
    },
    traceFingerprint: traceObject.traceFingerprint ?? traceObject.fingerprint ?? null,
  };
}

function normalizePopulation(result, npcCount, npcTraces) {
  const supplied = asArray(result.populationByTick ?? result.populationTimeline ?? result.population);
  if (supplied.length) return supplied.map((entry) => ({
    tick: tickOf(entry),
    day: dayOf(entry),
    phaseIndex: phaseIndexOf(entry),
    phase: PHASES[phaseIndexOf(entry)],
    alive: finite(entry.alive ?? entry.living, npcCount),
    injured: finite(entry.injured ?? entry.wounded),
    dead: finite(entry.dead ?? entry.deaths),
    missing: finite(entry.missing),
    captured: finite(entry.captured),
    departed: finite(entry.departed ?? entry.offstage),
    traveling: finite(entry.traveling ?? entry.travelingNpcs),
  })).sort(chronological);

  const runtimeTicks = asArray(result.ticks);
  if (runtimeTicks.length) {
    return runtimeTicks.map((tick, index) => {
      const day = dayOf(tick);
      const states = npcTraces.map((trace) => trace.daily.find((entry) => entry.day === day)).filter(Boolean);
      const dead = states.filter((entry) => entry.vitalState === "dead").length;
      return {
        tick: index,
        day,
        phaseIndex: phaseIndexOf(tick),
        phase: tick.phase ?? PHASES[phaseIndexOf(tick)],
        alive: states.length ? Math.max(0, states.length - dead) : npcCount,
        injured: states.filter((entry) => entry.vitalState === "injured").length,
        dead,
        missing: states.filter((entry) => entry.presence === "missing").length,
        captured: states.filter((entry) => entry.presence === "captured").length,
        departed: states.filter((entry) => entry.presence === "departed").length,
        traveling: finite(tick.travelingNpcs),
        inferred: true,
      };
    });
  }

  if (npcTraces.some((trace) => trace.daily.length)) {
    const rows = [];
    const endDay = result.end?.day ?? 100;
    for (let day = 1; day <= endDay; day += 1) {
      const states = npcTraces.map((trace) => trace.daily.find((entry) => entry.day === day)).filter(Boolean);
      const dead = states.filter((entry) => entry.vitalState === "dead").length;
      rows.push({
        tick: day * 4 - 1,
        day,
        phaseIndex: 3,
        phase: "night",
        alive: Math.max(0, states.length - dead),
        injured: states.filter((entry) => entry.vitalState === "injured").length,
        dead,
        missing: states.filter((entry) => entry.presence === "missing").length,
        captured: states.filter((entry) => entry.presence === "captured").length,
        departed: states.filter((entry) => entry.presence === "departed").length,
        traveling: states.filter((entry) => entry.presence === "traveling").length,
      });
    }
    return rows;
  }

  return [];
}

function buildCrisisOutcomes(result, lifeEvents) {
  const transitions = asArray(result.eventTransitions);
  return Object.values(result.troubleStates ?? {}).map((state) => {
    const ownTransitions = transitions.filter((entry) => entry.troubleId === state.id).sort(chronological);
    const casualties = lifeEvents.filter((entry) =>
      entry.troubleId === state.id || asArray(entry.relatedTroubleIds).includes(state.id)
    );
    return {
      troubleId: state.id,
      name: state.name ?? state.id,
      status: state.status,
      activatedDay: state.activatedAt?.day ?? ownTransitions.find((entry) => entry.to === "active")?.day ?? null,
      terminalDay: state.terminalAt?.day ?? ownTransitions.at(-1)?.day ?? null,
      terminalReason: ownTransitions.at(-1)?.reason ?? null,
      deaths: casualties.filter((entry) => entry.vitalState === "dead" || /death|dead/u.test(entry.type)).length,
      missing: casualties.filter((entry) => entry.presence === "missing" || /missing/u.test(entry.type)).length,
      injured: casualties.filter((entry) => entry.vitalState === "injured" || /injur|wound/u.test(entry.type)).length,
    };
  }).sort((left, right) => finite(left.terminalDay, 999) - finite(right.terminalDay, 999) || left.troubleId.localeCompare(right.troubleId, "en"));
}

export function compactWorldRun(result) {
  const endDay = result.end?.day ?? 100;
  const movements = [...asArray(result.movements), ...asArray(result.localMovementEvents)]
    .map(compactMovement)
    .sort(chronological);
  const lifeEvents = asArray(result.lifeEvents ?? result.lifecycleEvents).map(compactLifeEvent).sort(chronological);
  const knowledgeEvents = asArray(result.knowledgeEvents ?? result.knowledgeLog).map(compactKnowledgeEvent).sort(chronological);
  const rawDecisions = asArray(result.decisionEvents ?? result.decisionLog ?? result.goapPlanLog).map(compactDecisionEvent).sort(chronological);
  const decisionEvents = [];
  const seenDecisions = new Set();
  for (const entry of rawDecisions.filter(isSignificantDecision)) {
    const key = [entry.npcId, entry.day, entry.goalId, entry.actionType, entry.reason].join("\u0000");
    if (seenDecisions.has(key)) continue;
    seenDecisions.add(key);
    decisionEvents.push(entry);
  }
  const states = result.npcStates ?? {};
  const traceEntries = normalizeTraceEntries(result.npcTraces ?? result.agentTraces);
  const traceById = new Map(traceEntries.map(({ key, trace }) => [String(npcIdOf(trace, trace.id ?? key)), trace]));
  const ids = new Set([...Object.keys(states), ...traceById.keys()]);
  for (const entry of [...movements, ...lifeEvents, ...knowledgeEvents, ...decisionEvents]) if (entry.npcId) ids.add(String(entry.npcId));
  const npcTraces = [...ids].sort((left, right) => left.localeCompare(right, "en")).map((id) => compactNpcTrace({
    id,
    trace: traceById.get(id) ?? {},
    state: states[id] ?? {},
    movements,
    lifeEvents,
    knowledgeEvents,
    decisionEvents,
    endDay,
  }));
  const npcIndex = npcTraces.map(({ daily, ...trace }) => ({ ...trace, daysObserved: daily.length }));
  const npcCount = result.modelCounts?.npcs ?? npcIndex.length;
  const populationByTick = normalizePopulation(result, npcCount, npcTraces);
  const events = [
    ...lifeEvents,
    ...knowledgeEvents.filter((entry) => entry.type !== "initial"),
    ...decisionEvents,
    ...movements.filter((entry) => entry.movementKind !== "local"),
  ]
    .sort(chronological)
    .map((entry) => ({ ...entry }));

  const days = [];
  for (let day = 1; day <= endDay; day += 1) {
    const ticks = asArray(result.ticks).filter((tick) => dayOf(tick) === day);
    const last = ticks.at(-1) ?? {};
    const population = populationByTick.filter((entry) => entry.day === day).at(-1) ?? {};
    const dayLife = lifeEvents.filter((entry) => entry.day === day);
    const dayKnowledge = knowledgeEvents.filter((entry) => entry.day === day);
    const dayDecisions = decisionEvents.filter((entry) => entry.day === day);
    days.push({
      day,
      active: finite(last.active),
      critical: finite(last.critical),
      terminal: finite(last.terminal),
      travelingNpcs: finite(population.traveling ?? last.travelingNpcs),
      movements: ticks.reduce((sum, tick) => sum + finite(tick.movementsCompleted), 0) || movements.filter((entry) => entry.day === day).length,
      transitions: ticks.reduce((sum, tick) => sum + finite(tick.transitions), 0),
      goapPlans: ticks.reduce((sum, tick) => sum + finite(tick.goapPlans), 0),
      alive: finite(population.alive, npcCount),
      injured: finite(population.injured),
      dead: finite(population.dead),
      missing: finite(population.missing),
      departed: finite(population.departed),
      knowledgeGained: dayKnowledge.length,
      replans: dayDecisions.filter((entry) => entry.changed).length,
      lifeEvents: dayLife.length,
    });
  }

  const expectedStateTicks = npcCount * finite(result.tickCount, endDay * 4);
  const observedStateTicks = npcTraces.reduce((sum, trace) => sum + finite(trace.stats.stateTicks), 0);
  const suppliedCoverage = result.coverage ?? result.summary?.coverage ?? {};
  const activityCoverage = result.activityCoverage ?? {};
  const coverage = {
    expectedStateTicks,
    observedStateTicks: suppliedCoverage.observedStateTicks ?? suppliedCoverage.stateTicks ?? observedStateTicks,
    stateCoverage: suppliedCoverage.stateCoverage ?? (expectedStateTicks ? observedStateTicks / expectedStateTicks : 0),
    npcCount,
    trackedNpcCount: npcIndex.length,
    npcTimelineCount: npcTraces.filter((trace) => trace.daily.length > 0).length,
    eligibleDecisionTicks: suppliedCoverage.eligibleDecisionTicks ?? activityCoverage.eligibleTicks ?? null,
    decisionsLogged: suppliedCoverage.decisionsLogged ?? suppliedCoverage.decisionTicks ?? activityCoverage.decisionTicks ?? rawDecisions.length,
    decisionCoverage: suppliedCoverage.decisionCoverage ?? suppliedCoverage.eligibleDecisionCoverage ?? activityCoverage.coverage ?? null,
    movers: new Set(movements.map((entry) => entry.npcId).filter(Boolean)).size,
    learners: new Set(knowledgeEvents.filter((entry) => entry.accepted !== false).map((entry) => entry.npcId).filter(Boolean)).size,
    replanners: new Set(decisionEvents.filter((entry) => entry.changed).map((entry) => entry.npcId).filter(Boolean)).size,
    dead: npcIndex.filter((npc) => npc.vitalState === "dead").length,
    missing: npcIndex.filter((npc) => npc.presence === "missing").length,
    fateEvaluated: suppliedCoverage.fateEvaluated ?? suppliedCoverage.fateEvaluationCount ?? activityCoverage.fateEvaluatedNpcs ?? null,
    fateEvaluationCoverage: suppliedCoverage.fateEvaluationCoverage ?? activityCoverage.fateEvaluationCoverage ?? null,
  };

  return {
    seed: result.seed,
    tuning: result.tuning,
    fingerprint: result.fingerprint,
    replay: {
      schemaVersion: result.schemaVersion ?? "1.0.0",
      representativeSeed: result.seed,
      fingerprint: result.fingerprint,
      engineVersion: result.engineVersion ?? result.replay?.engineVersion ?? null,
      rngVersion: result.rngVersion ?? result.replay?.rngVersion ?? null,
      tickCount: result.tickCount,
      deterministic: Boolean(result.fingerprint),
      mode: result.simulationMode ?? result.mode ?? result.replay?.mode ?? "no-player",
      npcMitigationCanResolve: result.rules?.npcMitigationCanResolve ?? result.replay?.npcMitigationCanResolve ?? false,
      ...(result.replay ?? {}),
    },
    summary: result.summary,
    stats: result.stats,
    invariants: result.invariants,
    coverage,
    days,
    populationByTick,
    npcIndex,
    npcTraces,
    events,
    lifeEvents,
    knowledgeEvents,
    decisionEvents,
    crisisOutcomes: buildCrisisOutcomes(result, lifeEvents),
    transitions: asArray(result.eventTransitions).map((entry) => ({
      troubleId: entry.troubleId,
      from: entry.from,
      to: entry.to,
      tick: tickOf(entry),
      day: dayOf(entry),
      phaseIndex: phaseIndexOf(entry),
      phase: PHASES[phaseIndexOf(entry)] ?? "unknown",
      reason: entry.reason,
    })),
    assumptions: result.assumptions,
    diagnostics: result.diagnostics,
  };
}

export function runWorldSweep({ model, seedPrefix, seeds = 100, tuning } = {}) {
  if (!model) throw new Error("runWorldSweep requires a world model");
  const resolvedCounts = [];
  const failedCounts = [];
  const movements = [];
  const interHubMovements = [];
  const localMovements = [];
  const goapPlans = [];
  const npcContributors = [];
  const livingMovers = [];
  const knowledgeCounts = [];
  const rumorPickupCounts = [];
  const lifeEventCounts = [];
  const decisionCoverages = [];
  const stateCoverages = [];
  const finalDead = [];
  const finalMissing = [];
  const finalInjured = [];
  const t01Deaths = [];
  const t01Missing = [];
  const t01Injured = [];
  const outcomeByTrouble = {};
  const seedSummaries = [];
  let invariantFailures = 0;

  for (let index = 0; index < seeds; index += 1) {
    const seed = `${seedPrefix}:${index}`;
    const result = simulateWorld({ model, seed, tuning });
    const resolved = Number(result.summary.troubleStates.resolved ?? 0);
    const failed = Number(result.summary.troubleStates.failed ?? 0);
    const suppressed = Number(result.summary.troubleStates.suppressed ?? 0);
    resolvedCounts.push(resolved);
    failedCounts.push(failed);
    const allMovements = [...result.movements, ...result.localMovementEvents];
    movements.push(allMovements.length);
    interHubMovements.push(result.movements.length);
    localMovements.push(result.localMovementEvents.length);
    goapPlans.push(result.stats.goapPlans);
    npcContributors.push(result.summary.npcContributors);
    livingMovers.push(new Set(allMovements.map((entry) => entry.npcId)).size);
    knowledgeCounts.push(result.knowledgeEvents.length);
    rumorPickupCounts.push(result.knowledgeEvents.filter((entry) => entry.type === "rumor-pickup").length);
    lifeEventCounts.push(result.lifeEvents.length);
    decisionCoverages.push(result.activityCoverage.coverage);
    const observedStateTicks = Object.values(result.npcTraces).reduce((sum, trace) => sum + trace.length, 0);
    stateCoverages.push(observedStateTicks / (result.modelCounts.npcs * result.tickCount));
    const finalPopulation = result.populationByTick.at(-1) ?? {};
    finalDead.push(finite(finalPopulation.dead));
    finalMissing.push(finite(finalPopulation.missing));
    finalInjured.push(finite(finalPopulation.injured));
    const t01Casualties = result.lifeEvents.filter((entry) =>
      entry.troubleId === "T01" || asArray(entry.relatedTroubleIds).includes("T01") || asArray(entry.troubleIds).includes("T01")
    );
    t01Deaths.push(t01Casualties.filter((entry) => entry.toLifeStatus === "dead" || entry.type === "death").length);
    t01Missing.push(t01Casualties.filter((entry) => entry.toPresence === "missing" || entry.type === "missing").length);
    t01Injured.push(t01Casualties.filter((entry) => entry.toLifeStatus === "injured" || entry.type === "injury").length);
    if (!result.invariants.ok) invariantFailures += 1;
    for (const [troubleId, state] of Object.entries(result.troubleStates)) {
      outcomeByTrouble[troubleId] ??= {};
      increment(outcomeByTrouble[troubleId], state.status);
    }
    seedSummaries.push({ seed, resolved, failed, suppressed, fingerprint: result.fingerprint });
  }

  const targetResolved = quantile(resolvedCounts, 0.5);
  const representative = seedSummaries
    .slice()
    .sort((left, right) => Math.abs(left.resolved - targetResolved) - Math.abs(right.resolved - targetResolved) || left.seed.localeCompare(right.seed))[0];
  const representativeResult = simulateWorld({ model, seed: representative.seed, tuning });

  return {
    seeds,
    tuning: representativeResult.tuning,
    invariantFailures,
    worldCompletionRate: 1 - invariantFailures / seeds,
    resolved: {
      mean: mean(resolvedCounts),
      median: targetResolved,
      minimum: Math.min(...resolvedCounts),
      maximum: Math.max(...resolvedCounts),
    },
    failed: {
      mean: mean(failedCounts),
      median: quantile(failedCounts, 0.5),
      minimum: Math.min(...failedCounts),
      maximum: Math.max(...failedCounts),
    },
    movements: distribution(movements),
    livingWorld: {
      interHubMovements: distribution(interHubMovements),
      localMovements: distribution(localMovements),
      movers: distribution(livingMovers),
      knowledgeEvents: distribution(knowledgeCounts),
      rumorPickups: distribution(rumorPickupCounts),
      lifeEvents: distribution(lifeEventCounts),
      decisionCoverage: distribution(decisionCoverages),
      stateCoverage: distribution(stateCoverages),
      finalPopulation: {
        dead: distribution(finalDead),
        missing: distribution(finalMissing),
        injured: distribution(finalInjured),
      },
      t01Casualties: {
        dead: distribution(t01Deaths),
        missing: distribution(t01Missing),
        injured: distribution(t01Injured),
      },
    },
    goapPlans: { mean: mean(goapPlans), median: quantile(goapPlans, 0.5) },
    npcContributors: { mean: mean(npcContributors), median: quantile(npcContributors, 0.5) },
    outcomeByTrouble,
    seedsWithT13Resolved: Number(outcomeByTrouble.T13?.resolved ?? 0),
    representative: compactWorldRun(representativeResult),
  };
}
