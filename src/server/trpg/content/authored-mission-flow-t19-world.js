import * as core from "./authored-mission-flow-t19-core.js";
import {
  T19_BLACKRIDGE_INVASION_PACK as P,
  T19_CONTINUITY_CONTRACT as CONTRACT,
} from "./authored/missions/t19-blackridge-invasion.js";

export * from "./authored-mission-flow-t19-core.js";

const F = Object.freeze;
const {
  mission,
  missionDef,
  ensure19,
} = core.T19_CORE_INTERNALS;
const resolveAuthoredMissionFlowExtensionChoice =
  core.resolveAuthoredMissionFlowExtensionChoice;

function completeStep(runtime, stepId) {
  const state = mission(runtime);
  const definition = missionDef(runtime)?.steps?.find((entry) => entry.id === stepId);
  if (!state?.progress || !definition) return false;
  const required = Number(definition.required ?? 1);
  if (Number(state.progress[stepId] ?? 0) >= required) return false;
  state.progress[stepId] = required;
  return true;
}

function recordDiscovery(runtime, lead, action) {
  const state = mission(runtime);
  state.discoveries ??= [];
  if (!state.discoveries.some((entry) => entry.id === lead.discoveryId)) {
    state.discoveries.push({
      id: lead.discoveryId,
      text: action.discoveryText ?? lead.discoveryText,
      approachId: action.approachId ?? lead.approachId,
      discoveredAtMinute: runtime.playerState.absoluteMinute,
    });
  }
}

function evaluateBattleObjectives(runtime, battleLike, result) {
  const flow = ensure19(runtime);
  const battle = battleLike?.battle ?? battleLike ?? {};
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags.missionBattleObjectives ??= {};
  runtime.playerState.worldFlags.missionBattleObjectives[P.missionId] ??= {};
  runtime.narrativeMemory ??= {};
  runtime.narrativeMemory.semanticFlags ??= {};
  const acquired = new Set(flow.evidenceIds);
  for (const objective of CONTRACT.battleObjectives) {
    const rounds = Number(battle.rounds ?? battle.turns ?? 0);
    const won = battle.won !== false;
    const status = won
      && (!objective.requiredAnyEvidenceIds?.length
        || objective.requiredAnyEvidenceIds.some((id) => acquired.has(id)))
      && (objective.maxRounds == null || rounds <= objective.maxRounds)
      ? "success"
      : "failed";
    flow.battleObjectiveResults[objective.id] = {
      status,
      encounterId: battle.encounterId ?? null,
      rounds,
      evaluatedAtMinute: runtime.playerState.absoluteMinute,
    };
    runtime.playerState.worldFlags.missionBattleObjectives[P.missionId][objective.id] = status;
    runtime.narrativeMemory.semanticFlags[`trouble.T19.battleObjective.${objective.id}`] = status;
  }
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "AUTHORED_MISSION_BATTLE_OBJECTIVES_EVALUATED",
    minute: runtime.playerState.absoluteMinute,
    missionId: P.missionId,
    results: { ...flow.battleObjectiveResults },
  });
  if (result) {
    result.summary = `${result.summary ?? "黒嶺侵攻軍への実力介入を終えた。"} 副目標：`
      + CONTRACT.battleObjectives.map((objective) =>
        `${objective.label}=${flow.battleObjectiveResults[objective.id].status === "success"
          ? "達成"
          : "未達"}`).join("／");
  }
  return true;
}

function seedResolutionRumor(runtime, route) {
  const livingWorld = runtime.livingWorld;
  const effect = route.worldEffect;
  if (!livingWorld || !effect?.factId || !effect?.facilityId) return false;
  const minute = Number(runtime.playerState.absoluteMinute ?? 0);
  const learnedAt = minute / 60;
  const propagationAt = learnedAt + Number(effect.propagationDelayHours ?? 2);
  livingWorld.facilityRumors ??= {};
  const facilityRumors = livingWorld.facilityRumors[effect.facilityId] instanceof Map
    ? livingWorld.facilityRumors[effect.facilityId]
    : new Map(Object.entries(livingWorld.facilityRumors[effect.facilityId] ?? {}));
  livingWorld.facilityRumors[effect.facilityId] = facilityRumors;
  if (facilityRumors.has(effect.factId)) return false;
  livingWorld.seededTroubleFacts ??= new Set();
  livingWorld.seededTroubleFacts.add(effect.factId);
  livingWorld.knowledgeEvents ??= [];
  livingWorld.knowledgeEventSequence = Number(
    livingWorld.knowledgeEventSequence ?? livingWorld.knowledgeEvents.length,
  ) + 1;
  const eventId = `K${String(livingWorld.knowledgeEventSequence).padStart(7, "0")}`;
  const belief = {
    factId: effect.factId,
    kind: "trouble",
    text: effect.text,
    troubleId: P.troubleId,
    troubleIds: [P.troubleId],
    troubleStatus: "resolved",
    confidence: 1,
    importance: 0.99,
    secret: false,
    learnedAt,
    propagationAt,
    sourceType: "player-intervention",
    sourceNpcId: null,
    provenanceEventId: eventId,
    hopCount: 0,
    path: [`facility:${effect.facilityId}`],
    aftermathPlans: (effect.aftermathPlans ?? []).map((plan) => ({
      ...plan,
      npcIds: [...(plan.npcIds ?? [])],
    })),
  };
  livingWorld.knowledgeEvents.push({
    id: eventId,
    type: "rumor-source",
    npcId: null,
    factId: effect.factId,
    troubleId: P.troubleId,
    troubleStatus: "resolved",
    learnedAt,
    propagationAt,
    sourceType: "player-intervention",
    importance: belief.importance,
    confidence: belief.confidence,
    hopCount: 0,
    path: [...belief.path],
    location: {
      hubId: runtime.playerState.player.location,
      facilityId: effect.facilityId,
    },
  });
  facilityRumors.set(effect.factId, {
    factId: effect.factId,
    belief,
    propagationAt,
    sourceNpcId: null,
    sourceEventId: eventId,
    carrierType: "player-intervention",
  });
  return true;
}

function applyResolutionEffect(runtime, route, flow, result) {
  const resolved = resolveAuthoredMissionFlowExtensionChoice(
    runtime,
    route,
    result?.authoredMissionFlowResolutionContextVariantId,
  );
  const objectiveSignature = Object.entries(flow.battleObjectiveResults)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, entry]) => `${id}:${entry.status}`)
    .join(",");
  const signature = [
    flow.openingChoiceId,
    flow.openingSourceId,
    flow.evidenceIds.join(">"),
    flow.interventionChoiceId ?? "post-day76-battle",
    route.id,
    resolved.contextId ?? "base",
    objectiveSignature,
  ].join("|");
  flow.selectedResolutionRouteId = route.id;
  flow.selectedResolutionContextId = resolved.contextId ?? null;
  flow.resolutionBranchId = `T19:${signature}`;
  const objectiveStatus = (id) => flow.battleObjectiveResults[id]?.status === "success";
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags[route.worldEffect.flagKey] = route.id;
  runtime.playerState.worldFlags.t19ResolutionRoute = route.id;
  runtime.playerState.worldFlags.t19ResolutionContext = flow.selectedResolutionContextId;
  runtime.playerState.worldFlags.t19ResolutionBranch = flow.resolutionBranchId;
  runtime.playerState.worldFlags.t19WarAverted = true;
  runtime.playerState.worldFlags.t19CapitalSaved = true;
  runtime.playerState.worldFlags.t19ForestBreakthroughStopped = true;
  runtime.playerState.worldFlags.t19CivilianProtectionSucceeded =
    objectiveStatus("protect-civilians-on-both-sides");
  runtime.playerState.worldFlags.t19OrderProofPreserved =
    objectiveStatus("preserve-orders-and-messenger-proof");
  runtime.playerState.worldFlags.t19DefenseCorridorMaintained =
    objectiveStatus("keep-capital-and-reinforcement-corridor");
  runtime.narrativeMemory ??= {};
  runtime.narrativeMemory.semanticFlags ??= {};
  runtime.narrativeMemory.semanticFlags["trouble.T19.resolutionRoute"] = route.id;
  runtime.narrativeMemory.semanticFlags["trouble.T19.resolutionContext"] =
    flow.selectedResolutionContextId;
  runtime.narrativeMemory.semanticFlags["trouble.T19.resolutionBranch"] =
    flow.resolutionBranchId;
  runtime.narrativeMemory.semanticFlags["trouble.T19.warAverted"] = true;
  runtime.narrativeMemory.semanticFlags["trouble.T19.capitalSaved"] = true;
  runtime.narrativeMemory.semanticFlags["trouble.T19.civilianProtectionSucceeded"] =
    runtime.playerState.worldFlags.t19CivilianProtectionSucceeded;
  runtime.narrativeMemory.semanticFlags["trouble.T19.orderProofPreserved"] =
    runtime.playerState.worldFlags.t19OrderProofPreserved;
  runtime.narrativeMemory.semanticFlags["trouble.T19.defenseCorridorMaintained"] =
    runtime.playerState.worldFlags.t19DefenseCorridorMaintained;
  runtime.narrativeMemory.localFacts ??= [];
  if (!runtime.narrativeMemory.localFacts.some((entry) =>
    entry.factId === route.worldEffect.factId)) {
    runtime.narrativeMemory.localFacts.push({
      type: "authored_resolution",
      factId: route.worldEffect.factId,
      subjectId: P.troubleId,
      predicate: "resolution_route",
      value: route.id,
      summary: route.worldEffect.text,
      troubleId: P.troubleId,
      locationId: runtime.playerState.player.location,
      facilityId: route.worldEffect.facilityId,
      recordedAtMinute: Number(runtime.playerState.absoluteMinute ?? 0),
    });
  }
  completeStep(runtime, P.resolution.stepId);
  result.summary = resolved.summary ?? route.summary;
  result.sceneTransition = resolved.sceneTransition ?? route.sceneTransition;
  seedResolutionRumor(runtime, resolved);
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "AUTHORED_MISSION_FLOW_RESOLUTION_SELECTED",
    minute: runtime.playerState.absoluteMinute,
    flowId: P.id,
    missionId: P.missionId,
    troubleId: P.troubleId,
    routeId: route.id,
    contextVariantId: flow.selectedResolutionContextId,
    resolutionBranchId: flow.resolutionBranchId,
    evidenceOrder: [...flow.evidenceIds],
    openingChoiceId: flow.openingChoiceId,
    interventionChoiceId: flow.interventionChoiceId,
    troubleStatus: "resolved",
    worldEffectFactId: resolved.worldEffect?.factId ?? route.worldEffect.factId,
    t19DefenseCorridorMaintained: runtime.playerState.worldFlags.t19DefenseCorridorMaintained,
  });
  return true;
}


export const T19_WORLD_INTERNALS = F({
  completeStep,
  recordDiscovery,
  evaluateBattleObjectives,
  seedResolutionRumor,
  applyResolutionEffect,
});
