import { GAME_END_MINUTE, clockFromMinute, shortestTravelPlan } from "./player-journey.mjs";

const CRISIS_STATUSES = new Set(["active", "critical", "failed"]);
const TERMINAL_STATUSES = new Set(["resolved", "suppressed"]);

function npcHubAtMinute(npc, minute) {
  const day = clockFromMinute(minute).day;
  return day <= 1 ? npc.initialLocation : npc.home || npc.initialLocation;
}

function rumorStatus(rumor) {
  const id = String(rumor.id ?? "");
  const transition = id.match(/RUM-(T\d{2})-(active|critical|failed|resolved|suppressed)$/u);
  if (transition) return transition[2];
  if (/RUM-PLAYER-T\d{2}-HEARD$/u.test(id)) return "information";
  return null;
}

function npcRoleText(npc) {
  return JSON.stringify({
    name: npc.name,
    occupation: npc.occupation,
    role: npc.role,
    type: npc.type,
    initialStatus: npc.initialStatus,
    notes: npc.notes,
    facility: npc.mainFacilityId,
  });
}

function planKind(npc, status) {
  const text = npcRoleText(npc);
  if (status === "suppressed") return "stand_down_and_monitor";
  if (status === "resolved") {
    if (/兵|騎士|警備|衛兵|軍|守備|門番/u.test(text)) return "stand_down_and_patrol";
    if (/医|治療|薬|神官|僧侶|施療/u.test(text)) return "recovery_care";
    if (/商|鍛冶|工房|職人|運送|倉庫/u.test(text)) return "recovery_supply";
    return "reassess_and_recover";
  }
  if (status === "information") {
    if (/学者|研究|調査|司書|記録|記者|斥候/u.test(text)) return "investigate_response";
    if (/兵|騎士|警備|衛兵|軍|守備|門番/u.test(text)) return "verify_and_prepare";
    return "observe_and_share";
  }
  if (/医|治療|薬|神官|僧侶|施療/u.test(text)) return "medical_response";
  if (/兵|騎士|警備|衛兵|軍|守備|門番/u.test(text)) return "defend_or_escort";
  if (/商|鍛冶|工房|職人|運送|倉庫/u.test(text)) return "supply_response";
  if (/学者|研究|調査|司書|記録|記者|斥候/u.test(text)) return "investigate_response";
  if (npc.disposition === "mitigate") return "evacuate_or_mitigate";
  return "observe_and_replan";
}

function targetHubFor(model, rumor, troubleId) {
  const trouble = model.troubleById?.[troubleId] ?? model.troubles.find((entry) => entry.id === troubleId);
  return rumor.origin ?? trouble?.primaryLocations?.[0] ?? null;
}

function planDelayMinutes(npc, status) {
  const weight = Math.max(0, Math.min(1, Number(npc.importanceWeight ?? 0.5)));
  const urgency = status === "failed" ? 4 : status === "critical" ? 3 : status === "active" ? 2 : status === "information" ? 1 : 0;
  return Math.max(10, Math.round(75 - weight * 35 - urgency * 8));
}

function actionDurationMinutes(kind, status) {
  const base = /investigate|verify/u.test(kind) ? 90
    : /defend|evacuate|medical/u.test(kind) ? 120
      : /supply/u.test(kind) ? 150
        : /recover|patrol/u.test(kind) ? 100
          : 60;
  return base + (status === "critical" ? 45 : status === "failed" ? 75 : 0);
}

function isRoleAppropriate(npc, status, kind) {
  const text = npcRoleText(npc);
  if (status === "resolved") return /stand_down|recovery|reassess/u.test(kind);
  if (status === "suppressed") return kind === "stand_down_and_monitor";
  if (status === "information") return /investigate|verify|observe/u.test(kind);
  if (/医|治療|薬|神官|僧侶|施療/u.test(text)) return kind === "medical_response";
  if (/兵|騎士|警備|衛兵|軍|守備|門番/u.test(text)) return kind === "defend_or_escort";
  if (/商|鍛冶|工房|職人|運送|倉庫/u.test(text)) return kind === "supply_response";
  if (/学者|研究|調査|司書|記録|記者|斥候/u.test(text)) return kind === "investigate_response";
  return ["evacuate_or_mitigate", "observe_and_replan"].includes(kind);
}

function contribution(kind, npc, status) {
  if (!CRISIS_STATUSES.has(status)) return 0;
  const weight = Math.max(0.1, Number(npc.importanceWeight ?? 0.5));
  const factor = /defend|evacuate|medical/u.test(kind) ? 0.08
    : /supply|investigate/u.test(kind) ? 0.05
      : 0.025;
  return Number((weight * factor).toFixed(4));
}

function createPlan({ run, model, npc, rumor, status }) {
  const fromHub = npcHubAtMinute(npc, rumor.recipients[npc.id].minute);
  const targetHub = targetHubFor(model, rumor, rumor.troubleId);
  const receivedAt = Number(rumor.recipients[npc.id].minute);
  const route = targetHub ? shortestTravelPlan(model, run.state, fromHub, targetHub) : null;
  const travelMinutes = fromHub === targetHub ? 0 : route ? Math.ceil(route.hours * 60) : Infinity;
  const kind = planKind(npc, status);
  const plannedAt = receivedAt + planDelayMinutes(npc, status);
  const startedAt = plannedAt;
  const arrivedAt = Number.isFinite(travelMinutes) ? startedAt + travelMinutes : Infinity;
  const completedAt = Number.isFinite(arrivedAt) ? arrivedAt + actionDurationMinutes(kind, status) : Infinity;
  return {
    id: `NPCPLAN:${npc.id}:${rumor.troubleId}:${receivedAt}:${status}`,
    npcId: npc.id,
    npcName: npc.name,
    troubleId: rumor.troubleId,
    rumorId: rumor.id,
    status,
    kind,
    fromHub,
    targetHub,
    receivedAt,
    plannedAt,
    startedAt,
    arrivedAt,
    completedAt,
    executable: Number.isFinite(completedAt) && completedAt <= GAME_END_MINUTE,
    roleAppropriate: isRoleAppropriate(npc, status, kind),
    mitigationContribution: contribution(kind, npc, status),
    cancelledAt: null,
    supersededByPlanId: null,
  };
}

function statusPriority(status) {
  return status === "failed" ? 5
    : status === "critical" ? 4
      : status === "resolved" ? 3
        : status === "active" ? 2
          : status === "information" ? 1
            : 0;
}

function playerResolvedTroubleIds(run) {
  return new Set(run.state.history
    .filter((entry) => entry.type === "TROUBLE_TRANSITION" && entry.to === "resolved" && entry.reason === "player-mission-resolution")
    .map((entry) => entry.troubleId));
}

export function simulateNpcInterventionPlansForRun(run, model) {
  const npcById = new Map(model.npcs.map((npc) => [npc.id, npc]));
  const currentByNpcTrouble = new Map();
  const plans = [];
  let revisions = 0;
  let crisisToResolutionChanges = 0;
  let lowerPriorityIgnored = 0;

  const rumors = [...run.state.rumors]
    .filter((rumor) => rumorStatus(rumor) && rumor.troubleId)
    .sort((left, right) => Number(left.originMinute) - Number(right.originMinute) || String(left.id).localeCompare(String(right.id)));

  for (const rumor of rumors) {
    const status = rumorStatus(rumor);
    for (const npcId of Object.keys(rumor.recipients ?? {}).sort()) {
      const npc = npcById.get(npcId);
      if (!npc || !npc.relatedTroubleIds?.includes(rumor.troubleId) || /死亡/u.test(String(npc.initialStatus ?? ""))) continue;
      const plan = createPlan({ run, model, npc, rumor, status });
      const key = `${npc.id}:${rumor.troubleId}`;
      const previous = currentByNpcTrouble.get(key);
      if (previous) {
        const sameTerminal = TERMINAL_STATUSES.has(previous.status) && TERMINAL_STATUSES.has(plan.status);
        if (!sameTerminal && statusPriority(plan.status) < statusPriority(previous.status) && plan.status !== "resolved") {
          lowerPriorityIgnored += 1;
          continue;
        }
        previous.cancelledAt = plan.receivedAt;
        previous.supersededByPlanId = plan.id;
        revisions += 1;
        if (CRISIS_STATUSES.has(previous.status) && plan.status === "resolved") crisisToResolutionChanges += 1;
      }
      currentByNpcTrouble.set(key, plan);
      plans.push(plan);
    }
  }

  const playerResolved = playerResolvedTroubleIds(run);
  let expectedResolutionChanges = 0;
  let staleCrisisPlans = 0;
  for (const [key, plan] of currentByNpcTrouble) {
    if (!playerResolved.has(plan.troubleId)) continue;
    expectedResolutionChanges += 1;
    if (CRISIS_STATUSES.has(plan.status)) staleCrisisPlans += 1;
  }

  const executable = plans.filter((plan) => plan.executable);
  const roleMismatch = plans.filter((plan) => !plan.roleAppropriate);
  const impossibleTravel = plans.filter((plan) => !Number.isFinite(plan.arrivedAt));
  const executedMitigation = executable.reduce((sum, plan) => sum + plan.mitigationContribution, 0);
  const planKinds = {};
  const statuses = {};
  for (const plan of plans) {
    planKinds[plan.kind] = (planKinds[plan.kind] ?? 0) + 1;
    statuses[plan.status] = (statuses[plan.status] ?? 0) + 1;
  }

  return {
    profileId: run.summary.profileId,
    seed: run.summary.seed,
    plans,
    totalPlans: plans.length,
    executablePlans: executable.length,
    executionRate: plans.length ? executable.length / plans.length : 1,
    revisions,
    crisisToResolutionChanges,
    expectedResolutionChanges,
    resolutionChangeRate: expectedResolutionChanges ? crisisToResolutionChanges / expectedResolutionChanges : 1,
    staleCrisisPlans,
    roleMismatchCount: roleMismatch.length,
    impossibleTravelCount: impossibleTravel.length,
    lowerPriorityIgnored,
    executedMitigation: Number(executedMitigation.toFixed(4)),
    planKinds,
    statuses,
  };
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
}

function quantile(values, probability) {
  const clean = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!clean.length) return null;
  return clean[Math.min(clean.length - 1, Math.max(0, Math.floor((clean.length - 1) * probability)))];
}

function summarize(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  return {
    count: clean.length,
    mean: Number(mean(clean).toFixed(4)),
    min: clean.length ? Math.min(...clean) : null,
    median: quantile(clean, 0.5),
    max: clean.length ? Math.max(...clean) : null,
  };
}

function mergeCounts(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) target[key] = Number(target[key] ?? 0) + Number(value ?? 0);
}

export function simulateNpcInterventionPlans(runs, model) {
  const results = runs.map((run) => simulateNpcInterventionPlansForRun(run, model));
  const planKinds = {};
  const statuses = {};
  results.forEach((result) => {
    mergeCounts(planKinds, result.planKinds);
    mergeCounts(statuses, result.statuses);
  });
  return {
    runs: results.length,
    totalPlans: results.reduce((sum, result) => sum + result.totalPlans, 0),
    executablePlans: results.reduce((sum, result) => sum + result.executablePlans, 0),
    executionRate: summarize(results.map((result) => result.executionRate)),
    revisions: results.reduce((sum, result) => sum + result.revisions, 0),
    crisisToResolutionChanges: results.reduce((sum, result) => sum + result.crisisToResolutionChanges, 0),
    expectedResolutionChanges: results.reduce((sum, result) => sum + result.expectedResolutionChanges, 0),
    resolutionChangeRate: summarize(results.map((result) => result.resolutionChangeRate)),
    staleCrisisPlans: results.reduce((sum, result) => sum + result.staleCrisisPlans, 0),
    roleMismatchCount: results.reduce((sum, result) => sum + result.roleMismatchCount, 0),
    impossibleTravelCount: results.reduce((sum, result) => sum + result.impossibleTravelCount, 0),
    lowerPriorityIgnored: results.reduce((sum, result) => sum + result.lowerPriorityIgnored, 0),
    executedMitigation: summarize(results.map((result) => result.executedMitigation)),
    planKinds,
    statuses,
    samples: results.slice(0, 7).map((result) => ({ ...result, plans: result.plans.slice(0, 50) })),
  };
}
