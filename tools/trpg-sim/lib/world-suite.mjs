import { mean, quantile } from "./statistics.mjs";
import { simulateWorld } from "./world-simulator.mjs";

function increment(target, key, amount = 1) {
  target[key] = (target[key] ?? 0) + amount;
}

export function compactWorldRun(result) {
  const days = [];
  for (let day = 1; day <= result.end.day; day += 1) {
    const ticks = result.ticks.filter((tick) => tick.day === day);
    const last = ticks.at(-1) ?? {};
    days.push({
      day,
      active: Number(last.active ?? 0),
      critical: Number(last.critical ?? 0),
      terminal: Number(last.terminal ?? 0),
      travelingNpcs: Number(last.travelingNpcs ?? 0),
      movements: ticks.reduce((sum, tick) => sum + Number(tick.movementsCompleted ?? 0), 0),
      transitions: ticks.reduce((sum, tick) => sum + Number(tick.transitions ?? 0), 0),
      goapPlans: ticks.reduce((sum, tick) => sum + Number(tick.goapPlans ?? 0), 0),
    });
  }
  return {
    seed: result.seed,
    tuning: result.tuning,
    fingerprint: result.fingerprint,
    summary: result.summary,
    stats: result.stats,
    invariants: result.invariants,
    days,
    transitions: result.eventTransitions.map((entry) => ({
      troubleId: entry.troubleId,
      from: entry.from,
      to: entry.to,
      day: entry.day,
      phaseIndex: entry.phaseIndex,
      phase: ["morning", "day", "evening", "night"][entry.phaseIndex] ?? "unknown",
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
  const goapPlans = [];
  const npcContributors = [];
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
    movements.push(result.summary.movements);
    goapPlans.push(result.stats.goapPlans);
    npcContributors.push(result.summary.npcContributors);
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
    movements: { mean: mean(movements), median: quantile(movements, 0.5) },
    goapPlans: { mean: mean(goapPlans), median: quantile(goapPlans, 0.5) },
    npcContributors: { mean: mean(npcContributors), median: quantile(npcContributors, 0.5) },
    outcomeByTrouble,
    seedsWithT13Resolved: Number(outcomeByTrouble.T13?.resolved ?? 0),
    representative: compactWorldRun(representativeResult),
  };
}
