import { GAME_END_MINUTE, shortestTravelPlan } from "./player-journey.mjs";
import { simulateNpcInterventionPlansForRun } from "./npc-intervention-simulator-v3.mjs";

const CRISIS = new Set(["active", "critical", "failed"]);

function initialNpcHub(npc) {
  return npc.initialLocation ?? npc.home ?? null;
}

function facilityScore(facility, kind) {
  const text = `${facility.name ?? ""} ${facility.type ?? ""} ${facility.function ?? ""}`;
  if (/medical|recovery_care/u.test(kind) && /施療|病|診療|薬|神殿|寺院/u.test(text)) return 10;
  if (/defend|patrol|verify/u.test(kind) && /詰所|門|城|兵|警備|広場/u.test(text)) return 10;
  if (/supply/u.test(kind) && /市場|商|工房|鍛冶|倉庫|港/u.test(text)) return 10;
  if (/investigate/u.test(kind) && /研究|図書|現場|遺跡|役所|詰所/u.test(text)) return 10;
  if (/evacuate/u.test(kind) && /広場|宿|神殿|役所|門/u.test(text)) return 10;
  if (/recover|reassess|monitor/u.test(kind) && /役所|広場|本部|宿|詰所/u.test(text)) return 8;
  return 1;
}

function chooseFacility(model, plan) {
  const inHub = model.facilitiesByHub?.[plan.targetHub] ?? model.facilities.filter((facility) => facility.hub === plan.targetHub);
  const related = inHub.filter((facility) => facility.relatedTroubleIds?.includes(plan.troubleId));
  const candidates = related.length ? related : inHub;
  return [...candidates]
    .sort((left, right) => facilityScore(right, plan.kind) - facilityScore(left, plan.kind)
      || Number(left.sourceOrder ?? 0) - Number(right.sourceOrder ?? 0)
      || String(left.id).localeCompare(String(right.id)))
    [0] ?? null;
}

function segmentDurations(plan, route) {
  if (!route.routeIds.length) return [];
  const total = Math.max(route.routeIds.length, Math.ceil(route.hours * 60));
  const base = Math.floor(total / route.routeIds.length);
  let remainder = total - base * route.routeIds.length;
  return route.routeIds.map(() => {
    const duration = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return Math.max(1, duration);
  });
}

function event(log, data) {
  log.push({ schemaVersion: "goap-execution-log-v1", ...data });
}

function summarize(values) {
  const clean = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return { count: 0, mean: null, median: null, max: null };
  return {
    count: clean.length,
    mean: Number((clean.reduce((sum, value) => sum + value, 0) / clean.length).toFixed(3)),
    median: clean[Math.floor((clean.length - 1) * 0.5)],
    max: clean.at(-1),
  };
}

export function executeNpcGoapPlansForRun(run, model) {
  const planned = simulateNpcInterventionPlansForRun(run, model);
  const npcById = new Map(model.npcs.map((npc) => [npc.id, npc]));
  const runtimeByNpc = new Map(model.npcs.map((npc) => [npc.id, {
    npcId: npc.id,
    hub: initialNpcHub(npc),
    facilityId: npc.mainFacilityId ?? null,
    availableAt: 0,
    goal: null,
    completedPlans: 0,
  }]));
  const logs = [];
  const executions = [];
  const troubleMitigation = {};
  let blocked = 0;
  let cancelledBeforeStart = 0;
  let cancelledInProgress = 0;
  let completed = 0;
  let started = 0;
  let arrived = 0;
  let facilityEntries = 0;
  let overlapViolations = 0;
  let actionAfterCancellation = 0;
  let staleCrisisCompletions = 0;
  let roleMismatch = 0;
  let movementContinuityErrors = 0;
  const startDelays = [];

  const ordered = [...planned.plans].sort((left, right) => left.plannedAt - right.plannedAt
    || left.npcId.localeCompare(right.npcId)
    || left.id.localeCompare(right.id));

  for (const plan of ordered) {
    const npc = npcById.get(plan.npcId);
    const runtime = runtimeByNpc.get(plan.npcId);
    if (!npc || !runtime) continue;
    event(logs, {
      type: "PLAN_SCHEDULED",
      minute: plan.plannedAt,
      planId: plan.id,
      npcId: plan.npcId,
      troubleId: plan.troubleId,
      kind: plan.kind,
      targetHub: plan.targetHub,
    });

    if (!plan.roleAppropriate) roleMismatch += 1;
    const actualStart = Math.max(plan.startedAt, runtime.availableAt);
    startDelays.push(actualStart - plan.startedAt);
    if (plan.cancelledAt != null && plan.cancelledAt <= actualStart) {
      cancelledBeforeStart += 1;
      event(logs, {
        type: "PLAN_CANCELLED",
        minute: plan.cancelledAt,
        planId: plan.id,
        npcId: plan.npcId,
        troubleId: plan.troubleId,
        reason: "superseded_before_start",
        supersededByPlanId: plan.supersededByPlanId,
      });
      executions.push({ ...plan, result: "cancelled_before_start", actualStart: null, actualComplete: null });
      continue;
    }

    if (actualStart < runtime.availableAt) overlapViolations += 1;
    const route = shortestTravelPlan(model, run.state, runtime.hub, plan.targetHub);
    if (!route) {
      blocked += 1;
      event(logs, {
        type: "PLAN_BLOCKED",
        minute: actualStart,
        planId: plan.id,
        npcId: plan.npcId,
        troubleId: plan.troubleId,
        fromHub: runtime.hub,
        targetHub: plan.targetHub,
        reason: "no_route",
      });
      executions.push({ ...plan, result: "blocked", actualStart, actualComplete: null });
      continue;
    }

    started += 1;
    event(logs, {
      type: "NPC_DEPARTED",
      minute: actualStart,
      planId: plan.id,
      npcId: plan.npcId,
      troubleId: plan.troubleId,
      fromHub: runtime.hub,
      targetHub: plan.targetHub,
      routeIds: route.routeIds,
    });

    let cursor = actualStart;
    let currentHub = runtime.hub;
    let cancelled = false;
    const durations = segmentDurations(plan, route);
    for (let index = 0; index < route.routeIds.length; index += 1) {
      const duration = durations[index];
      const nextHub = route.hubs[index + 1];
      event(logs, {
        type: "NPC_ROUTE_SEGMENT_STARTED",
        minute: cursor,
        planId: plan.id,
        npcId: plan.npcId,
        routeId: route.routeIds[index],
        fromHub: currentHub,
        toHub: nextHub,
      });
      const segmentEnd = cursor + duration;
      if (plan.cancelledAt != null && plan.cancelledAt < segmentEnd) {
        cancelled = true;
        cancelledInProgress += 1;
        event(logs, {
          type: "PLAN_CANCELLED",
          minute: plan.cancelledAt,
          planId: plan.id,
          npcId: plan.npcId,
          troubleId: plan.troubleId,
          reason: "superseded_during_travel",
          supersededByPlanId: plan.supersededByPlanId,
        });
        runtime.availableAt = plan.cancelledAt;
        break;
      }
      cursor = segmentEnd;
      currentHub = nextHub;
      event(logs, {
        type: "NPC_ROUTE_SEGMENT_COMPLETED",
        minute: cursor,
        planId: plan.id,
        npcId: plan.npcId,
        routeId: route.routeIds[index],
        hub: currentHub,
      });
    }
    if (cancelled) {
      executions.push({ ...plan, result: "cancelled_in_travel", actualStart, actualComplete: null });
      continue;
    }
    if (currentHub !== plan.targetHub) movementContinuityErrors += 1;
    runtime.hub = currentHub;
    arrived += 1;
    event(logs, {
      type: "NPC_ARRIVED",
      minute: cursor,
      planId: plan.id,
      npcId: plan.npcId,
      troubleId: plan.troubleId,
      hub: currentHub,
    });

    const facility = chooseFacility(model, plan);
    if (facility) {
      runtime.facilityId = facility.id;
      facilityEntries += 1;
      event(logs, {
        type: "NPC_FACILITY_ENTERED",
        minute: cursor + 5,
        planId: plan.id,
        npcId: plan.npcId,
        troubleId: plan.troubleId,
        hub: currentHub,
        facilityId: facility.id,
        facilityName: facility.name,
      });
      cursor += 5;
    }

    const actionDuration = Math.max(10, plan.completedAt - plan.arrivedAt);
    const actionStart = cursor;
    const actionComplete = actionStart + actionDuration;
    event(logs, {
      type: "NPC_FACILITY_ACTION_STARTED",
      minute: actionStart,
      planId: plan.id,
      npcId: plan.npcId,
      troubleId: plan.troubleId,
      facilityId: runtime.facilityId,
      kind: plan.kind,
    });
    if (plan.cancelledAt != null && plan.cancelledAt < actionComplete) {
      cancelledInProgress += 1;
      event(logs, {
        type: "PLAN_CANCELLED",
        minute: plan.cancelledAt,
        planId: plan.id,
        npcId: plan.npcId,
        troubleId: plan.troubleId,
        reason: "superseded_during_action",
        supersededByPlanId: plan.supersededByPlanId,
      });
      runtime.availableAt = plan.cancelledAt;
      executions.push({ ...plan, result: "cancelled_in_action", actualStart, actualComplete: null });
      continue;
    }
    if (actionComplete > GAME_END_MINUTE) {
      runtime.availableAt = GAME_END_MINUTE;
      executions.push({ ...plan, result: "game_end", actualStart, actualComplete: null });
      continue;
    }

    event(logs, {
      type: "NPC_FACILITY_ACTION_COMPLETED",
      minute: actionComplete,
      planId: plan.id,
      npcId: plan.npcId,
      troubleId: plan.troubleId,
      facilityId: runtime.facilityId,
      kind: plan.kind,
      mitigationContribution: plan.mitigationContribution,
    });
    if (plan.cancelledAt != null && actionComplete > plan.cancelledAt) actionAfterCancellation += 1;
    if (CRISIS.has(plan.status) && plan.supersededByPlanId && actionComplete > (plan.cancelledAt ?? Infinity)) staleCrisisCompletions += 1;
    if (CRISIS.has(plan.status) && plan.mitigationContribution > 0) {
      troubleMitigation[plan.troubleId] = Number(Math.min(0.9, Number(troubleMitigation[plan.troubleId] ?? 0) + plan.mitigationContribution).toFixed(4));
    }
    runtime.goal = plan.kind;
    runtime.availableAt = actionComplete;
    runtime.completedPlans += 1;
    completed += 1;
    event(logs, {
      type: "NPC_GOAP_STATE_UPDATED",
      minute: actionComplete,
      planId: plan.id,
      npcId: plan.npcId,
      troubleId: plan.troubleId,
      currentHub: runtime.hub,
      currentFacilityId: runtime.facilityId,
      currentGoal: runtime.goal,
      worldMutationAuthority: "mitigation_only",
    });
    executions.push({ ...plan, result: "completed", actualStart, actualComplete: actionComplete, facilityId: runtime.facilityId });
  }

  const eligible = ordered.length - cancelledBeforeStart;
  return {
    schemaVersion: "goap-execution-v4",
    profileId: run.summary.profileId,
    seed: run.summary.seed,
    sourcePlanCount: ordered.length,
    started,
    arrived,
    facilityEntries,
    completed,
    cancelledBeforeStart,
    cancelledInProgress,
    blocked,
    completionRate: eligible > 0 ? completed / eligible : 1,
    overlapViolations,
    actionAfterCancellation,
    staleCrisisCompletions,
    roleMismatch,
    movementContinuityErrors,
    startDelayMinutes: summarize(startDelays),
    troubleMitigation,
    finalNpcRuntime: Object.fromEntries([...runtimeByNpc].map(([id, runtime]) => [id, runtime])),
    logs,
    executions,
  };
}

export function aggregateGoapExecutions(results) {
  const sum = (key) => results.reduce((total, result) => total + Number(result[key] ?? 0), 0);
  return {
    runs: results.length,
    sourcePlanCount: sum("sourcePlanCount"),
    started: sum("started"),
    arrived: sum("arrived"),
    facilityEntries: sum("facilityEntries"),
    completed: sum("completed"),
    cancelledBeforeStart: sum("cancelledBeforeStart"),
    cancelledInProgress: sum("cancelledInProgress"),
    blocked: sum("blocked"),
    completionRate: summarize(results.map((result) => result.completionRate)),
    overlapViolations: sum("overlapViolations"),
    actionAfterCancellation: sum("actionAfterCancellation"),
    staleCrisisCompletions: sum("staleCrisisCompletions"),
    roleMismatch: sum("roleMismatch"),
    movementContinuityErrors: sum("movementContinuityErrors"),
    startDelayMinutes: summarize(results.map((result) => result.startDelayMinutes.median ?? 0)),
    logEvents: results.reduce((total, result) => total + result.logs.length, 0),
    sample: results.slice(0, 3).map((result) => ({
      profileId: result.profileId,
      seed: result.seed,
      sourcePlanCount: result.sourcePlanCount,
      completed: result.completed,
      cancelledBeforeStart: result.cancelledBeforeStart,
      cancelledInProgress: result.cancelledInProgress,
      blocked: result.blocked,
      logs: result.logs.slice(0, 30),
    })),
  };
}
