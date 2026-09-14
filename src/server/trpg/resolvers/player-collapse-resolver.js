import {
  completePlayerCollapseRescue,
  openPlayerCollapseIncident,
  playerCollapseCommandBlock,
  PLAYER_COLLAPSE_BLOCKED_COMMAND_TYPES,
} from "../../../../tools/trpg-sim/lib/player-needs.mjs";

export const PLAYER_COLLAPSE_RESCUE_VERSION = "player-incapacitation-rescue-v8";
export const PLAYER_COLLAPSE_RESCUE_COMMAND = "RESOLVE_COLLAPSE_RESCUE";

const DEFAULT_WAKE_DELAY_MINUTES = 180;
const DEFAULT_FALLBACK_DISCOVERY_MINUTES = 60;
const DEFAULT_FALLBACK_EVACUATION_MINUTES = 30;
const COLLAPSE_CAUSE_LABELS = Object.freeze({
  hunger: "空腹",
  fatigue: "疲労",
  battle_defeat: "戦闘での負傷",
});
const COLLAPSE_BLOCKED_COMMAND_TYPES = new Set(PLAYER_COLLAPSE_BLOCKED_COMMAND_TYPES);

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
  if (value && typeof value === "object") return new Set(Object.keys(value));
  return new Set();
}

function sourceValue(source, id) {
  if (!source) return null;
  if (source instanceof Map) return source.get(id) ?? null;
  return source[id] ?? null;
}

function normalizedIdSet(value) {
  if (value instanceof Set) return new Set([...value].map(String));
  if (Array.isArray(value)) return new Set(value.map(String));
  return new Set();
}

function battleDefeatIncident(player, context = {}) {
  const pending = player?.pendingDefeatSettlement;
  if (!pending || typeof pending !== "object") return null;
  const atMinute = finiteMinute(
    pending.defeatedAtMinute,
    finiteMinute(context.minute, 0),
  );
  const location = optionalId(context.location ?? player?.location);
  const facilityId = optionalId(context.facilityId ?? player?.facilityId);
  return {
    id: optionalId(pending.incidentId)
      ?? `INCAPACITATION:${atMinute}:battle_defeat:${location ?? "unknown"}:${facilityId ?? "none"}`,
    status: "pending_rescue",
    causes: ["battle_defeat"],
    primaryCause: "battle_defeat",
    atMinute,
    location,
    facilityId,
    rescuedAtMinute: null,
    rescuerId: null,
    wakeLocation: null,
    wakeFacilityId: null,
  };
}

function candidateScore(candidate, incident) {
  const knowledge = normalizedKnowledge(candidate.knowledge);
  let score = 0;
  if (candidate.companion === true) score += 180;
  if (candidate.present === true) score += 100;
  if (optionalId(candidate.location) === incident.location) score += 30;
  if (incident.facilityId && optionalId(candidate.facilityId) === incident.facilityId) score += 40;
  if (candidate.canRescue === true) score += 25;
  if (
    knowledge.has("first_aid")
    || knowledge.has("healing")
    || knowledge.has("治療")
    || knowledge.has("応急処置")
  ) score += 15;
  score += Math.max(-20, Math.min(20, Number(candidate.playerTrust) || 0));
  score -= Math.max(0, Number(candidate.rescueCost) || 0);
  score -= Math.min(90, Math.max(0, Number(candidate.travelMinutes) || 0) / 3);
  return score;
}

function eligibleCandidate(candidate) {
  if (!candidate || typeof candidate !== "object" || !optionalId(candidate.id)) return false;
  if (candidate.alive === false || candidate.dead === true) return false;
  if (candidate.detained === true || candidate.missing === true || candidate.departed === true) return false;
  if (candidate.incapacitated === true || candidate.hostile === true) return false;
  if (
    candidate.present !== true
    && candidate.canReach !== true
    && candidate.companion !== true
  ) return false;
  return candidate.canRescue !== false;
}

export function buildCollapseRescueCandidates({
  presentNpcIds = [],
  companionNpcIds = [],
  npcStates = null,
  npcDefinitions = null,
  reachableNpcIds = [],
  location = null,
  facilityId = null,
  fallbackWakeFacilityId = null,
} = {}) {
  const present = normalizedIdSet(presentNpcIds);
  const companion = normalizedIdSet(companionNpcIds);
  const reachable = normalizedIdSet(reachableNpcIds);
  const candidateIds = new Set([...present, ...companion, ...reachable]);
  return [...candidateIds]
    .sort((left, right) => left.localeCompare(right, "ja"))
    .map((id) => {
      const state = sourceValue(npcStates, id) ?? {};
      const definition = sourceValue(npcDefinitions, id) ?? {};
      const stateLocation = optionalId(
        state.position?.hubId ?? state.location ?? state.currentLocation,
      );
      const stateFacilityId = optionalId(
        state.position?.facilityId ?? state.facilityId ?? state.currentFacilityId,
      );
      const knowledge =
        state.knowledge
        ?? state.knownFacts
        ?? state.beliefs
        ?? definition.knowledge
        ?? [];
      const status = String(state.lifeStatus ?? state.status ?? "").toLowerCase();
      const presence = String(state.presence ?? "").toLowerCase();
      const disposition = String(
        state.disposition ?? state.relation ?? state.attitude ?? "",
      ).toLowerCase();
      const dead =
        state.dead === true
        || state.alive === false
        || status === "dead"
        || status === "死亡";
      const missing =
        state.missing === true
        || status === "missing"
        || status === "行方不明"
        || presence === "missing";
      const detained =
        state.detained === true
        || state.restrained === true
        || ["detained", "拘束", "拘束中"].includes(status);
      const departed = status === "departed" || presence === "departed";
      const incapacitated =
        state.incapacitated === true
        || state.unconscious === true
        || ["incapacitated", "unconscious", "戦闘不能", "気絶"].includes(status);
      const hostile =
        state.hostile === true
        || ["hostile", "enemy", "敵対", "敵対中"].includes(disposition);
      return {
        id,
        name: definition.name ?? state.name ?? id,
        companion: companion.has(id),
        present: present.has(id),
        canReach: reachable.has(id) && !departed,
        alive: !dead,
        dead,
        missing,
        detained,
        departed,
        incapacitated,
        hostile,
        canRescue:
          state.canRescue
          ?? definition.canRescue
          ?? (!departed && !hostile && !incapacitated),
        location: stateLocation ?? optionalId(location),
        facilityId:
          stateFacilityId
          ?? (present.has(id) ? optionalId(facilityId) : null),
        // Legacy fields are retained for save/test compatibility only. Production D
        // passes an explicit destination to the planner, so these do not decide wake location.
        wakeLocation:
          optionalId(state.wakeLocation)
          ?? stateLocation
          ?? optionalId(location),
        wakeFacilityId:
          optionalId(state.wakeFacilityId)
          ?? stateFacilityId
          ?? optionalId(fallbackWakeFacilityId)
          ?? (present.has(id) ? optionalId(facilityId) : null),
        travelMinutes: finiteMinute(
          state.rescueTravelMinutes ?? state.travelMinutes ?? 0,
          0,
        ),
        knowledge,
        playerTrust: Number(state.playerTrust ?? state.trustToPlayer ?? 0),
        rescueCost: Number(state.rescueCost ?? definition.rescueCost ?? 0),
        goapGoalId: optionalId(
          state.currentGoalId ?? state.goalId ?? state.currentGoal,
        ),
        goapPlanId: optionalId(
          state.currentPlanId ?? state.planId ?? state.currentPlan?.id,
        ),
      };
    });
}

export function selectCollapseRescuer(incident, candidates = []) {
  if (!incident || incident.status !== "pending_rescue") return null;
  return candidates
    .filter(eligibleCandidate)
    .map((candidate) => ({
      candidate,
      score: candidateScore(candidate, incident),
    }))
    .sort(
      (left, right) =>
        right.score - left.score
        || optionalId(left.candidate.id).localeCompare(
          optionalId(right.candidate.id),
          "ja",
        ),
    )[0]?.candidate ?? null;
}

export function planIncapacitationRescue(incident, {
  candidates = [],
  fallbackRescuerId = "SYSTEM_LOCAL_AID",
  destination = null,
  fallbackWakeLocation = null,
  fallbackWakeFacilityId = null,
  fallbackDiscoveryMinutes = DEFAULT_FALLBACK_DISCOVERY_MINUTES,
  fallbackEvacuationMinutes = DEFAULT_FALLBACK_EVACUATION_MINUTES,
  rescueArrivalMinutes = null,
  evacuationMinutes = null,
  treatmentRecoveryMinutes = DEFAULT_WAKE_DELAY_MINUTES,
} = {}) {
  if (!incident || incident.status !== "pending_rescue") return null;
  const rescuer = selectCollapseRescuer(incident, candidates);
  const usedFallback = !rescuer;
  const wakeLocation =
    optionalId(destination?.location)
    ?? optionalId(fallbackWakeLocation)
    ?? optionalId(rescuer?.wakeLocation)
    ?? optionalId(rescuer?.location)
    ?? incident.location;
  const wakeFacilityId =
    optionalId(destination?.facilityId)
    ?? optionalId(fallbackWakeFacilityId)
    ?? optionalId(rescuer?.wakeFacilityId)
    ?? optionalId(rescuer?.facilityId)
    ?? incident.facilityId;
  const explicitArrival =
    rescueArrivalMinutes != null
      ? finiteMinute(rescueArrivalMinutes, 0)
      : null;
  const discoveryDelayMinutes =
    explicitArrival != null
      ? explicitArrival
      : usedFallback
        ? finiteMinute(
            fallbackDiscoveryMinutes,
            DEFAULT_FALLBACK_DISCOVERY_MINUTES,
          )
        : 0;
  const explicitEvacuation =
    evacuationMinutes != null ? finiteMinute(evacuationMinutes, 0) : null;
  const evacuationDuration =
    explicitEvacuation != null
      ? explicitEvacuation
      : rescuer
        ? finiteMinute(
            rescuer.travelMinutes,
            rescuer.present || rescuer.companion
              ? 0
              : DEFAULT_FALLBACK_EVACUATION_MINUTES,
          )
        : finiteMinute(
            fallbackEvacuationMinutes,
            DEFAULT_FALLBACK_EVACUATION_MINUTES,
          );
  const recoveryMinutes = finiteMinute(
    treatmentRecoveryMinutes,
    DEFAULT_WAKE_DELAY_MINUTES,
  );
  return {
    rescuer,
    rescuerId:
      optionalId(rescuer?.id) ?? optionalId(fallbackRescuerId),
    usedFallback,
    wakeLocation,
    wakeFacilityId,
    discoveryDelayMinutes,
    evacuationMinutes: evacuationDuration,
    treatmentRecoveryMinutes: recoveryMinutes,
    elapsedMinutes:
      discoveryDelayMinutes + evacuationDuration + recoveryMinutes,
  };
}

export function prepareCollapseCommand(player, commandType, context = {}) {
  const opened = openPlayerCollapseIncident(player, {
    minute: context.minute,
    location: context.location,
    facilityId: context.facilityId,
  });
  const incident = opened.incident ?? battleDefeatIncident(player, context);
  const baseBlock = playerCollapseCommandBlock(player, commandType);
  const normalizedType = String(commandType ?? "").trim().toUpperCase();
  const battleBlocked = Boolean(
    incident?.primaryCause === "battle_defeat"
    && COLLAPSE_BLOCKED_COMMAND_TYPES.has(normalizedType),
  );
  return {
    version: PLAYER_COLLAPSE_RESCUE_VERSION,
    opened: opened.opened,
    incident: incident ?? baseBlock.incident ?? null,
    blocked: baseBlock.blocked || battleBlocked,
    code:
      baseBlock.code
      ?? (battleBlocked ? "player_collapse_pending_rescue" : null),
    commandType: (baseBlock.commandType ?? normalizedType) || null,
    causes:
      incident?.causes
      ?? baseBlock.causes
      ?? [],
  };
}

export function collapseRescueView(
  player,
  { facilityName = null, fallbackPlaceLabel = "その場" } = {},
) {
  const incident =
    player?.needs?.activeCollapse?.status === "pending_rescue"
      ? player.needs.activeCollapse
      : battleDefeatIncident(player, {
          location: player?.location,
          facilityId: player?.facilityId,
        });
  if (!incident || incident.status !== "pending_rescue") return null;
  const causes = (Array.isArray(incident.causes) ? incident.causes : [])
    .map((cause) => COLLAPSE_CAUSE_LABELS[cause] ?? String(cause))
    .filter(Boolean);
  const placeLabel = String(facilityName ?? "").trim() || fallbackPlaceLabel;
  const causeLabel = causes.length ? causes.join("と") : "体調不良";
  return {
    version: PLAYER_COLLAPSE_RESCUE_VERSION,
    active: true,
    incidentId: incident.id,
    status: incident.status,
    title: "力尽きて倒れた",
    narrative: `${placeLabel}で${causeLabel}のため動けなくなった。周囲の誰かが気づき、救助へ動いている。`,
    causes,
    collapsedAtMinute: Number(incident.atMinute ?? 0),
    location: optionalId(incident.location),
    facilityId: optionalId(incident.facilityId),
    command: {
      type: PLAYER_COLLAPSE_RESCUE_COMMAND,
      label: "救助を受け、目を覚ます",
    },
    uiLock: {
      choices: [],
      movement: [],
      stock: [],
      saleQuotes: [],
      loans: [],
      rewards: [],
      learnableSkills: [],
      battleCommands: [],
    },
  };
}

export function applyCollapseRescueView(gameView, player, options = {}) {
  const rescueView = collapseRescueView(player, options);
  if (!rescueView) return gameView;
  const source =
    gameView && typeof gameView === "object" ? gameView : {};
  const shop =
    source.shop && typeof source.shop === "object" ? source.shop : {};
  const skills =
    source.skills && typeof source.skills === "object" ? source.skills : {};
  const battle =
    source.battle && typeof source.battle === "object" ? source.battle : null;
  const publicPlayer =
    source.player && typeof source.player === "object"
      ? {
          ...source.player,
          needs: {
            ...(source.player.needs ?? {}),
            collapsed: true,
            collapsePending: true,
            collapseCauses:
              rescueView.causes.includes(COLLAPSE_CAUSE_LABELS.battle_defeat)
                ? ["battle_defeat"]
                : source.player.needs?.collapseCauses ?? [],
            collapseIncidentId: rescueView.incidentId,
          },
        }
      : source.player;
  return {
    ...source,
    player: publicPlayer,
    scene: {
      ...(source.scene && typeof source.scene === "object"
        ? source.scene
        : {}),
      title: rescueView.title,
      narrative: rescueView.narrative,
      collapseRescue: rescueView,
    },
    collapseRescue: rescueView,
    choices: rescueView.uiLock.choices,
    movement: rescueView.uiLock.movement,
    shop: {
      ...shop,
      available: false,
      stock: [],
      saleQuotes: [],
      loans: [],
      rewards: [],
    },
    skills: { ...skills, learnable: [], learnableSkills: [] },
    battle: battle ? { ...battle, commands: [] } : battle,
    availableActions: [],
  };
}

export function resolveCollapseRescue(player, {
  minute = 0,
  location = null,
  facilityId = null,
  candidates = [],
  fallbackRescuerId = "SYSTEM_LOCAL_AID",
  destination = null,
  fallbackWakeLocation = null,
  fallbackWakeFacilityId = null,
  wakeDelayMinutes = DEFAULT_WAKE_DELAY_MINUTES,
  fallbackDiscoveryMinutes = 0,
  fallbackEvacuationMinutes = 0,
  rescueArrivalMinutes = null,
  evacuationMinutes = null,
  hungerAfter = 70,
  fatigueAfter = 70,
} = {}) {
  const opened = openPlayerCollapseIncident(player, {
    minute,
    location,
    facilityId,
  });
  const incident =
    opened.incident
    ?? battleDefeatIncident(player, { minute, location, facilityId });
  if (!incident || incident.status !== "pending_rescue") {
    return {
      completed: false,
      incident: null,
      rescuer: null,
      usedFallback: false,
    };
  }
  const plan = planIncapacitationRescue(incident, {
    candidates,
    fallbackRescuerId,
    destination,
    fallbackWakeLocation,
    fallbackWakeFacilityId,
    fallbackDiscoveryMinutes,
    fallbackEvacuationMinutes,
    rescueArrivalMinutes,
    evacuationMinutes,
    treatmentRecoveryMinutes: wakeDelayMinutes,
  });
  const rescueMinute =
    Math.max(incident.atMinute, finiteMinute(minute, incident.atMinute))
    + plan.elapsedMinutes;
  let result;
  if (incident.primaryCause === "battle_defeat") {
    result = {
      completed: true,
      incident: {
        ...incident,
        status: "rescued",
        rescuedAtMinute: rescueMinute,
        rescuerId: plan.rescuerId,
        wakeLocation: plan.wakeLocation,
        wakeFacilityId: plan.wakeFacilityId,
      },
    };
  } else {
    result = completePlayerCollapseRescue(player, {
      minute: rescueMinute,
      rescuerId: plan.rescuerId,
      wakeLocation: plan.wakeLocation,
      wakeFacilityId: plan.wakeFacilityId,
      hungerAfter,
      fatigueAfter,
    });
  }
  return { ...result, ...plan, rescueMinute };
}
