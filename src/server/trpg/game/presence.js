const INACTIVE_PRESENCE = new Set(["dead", "missing", "departed", "sealed", "not-yet-present", "traveling"]);

function publicRole(npc) {
  // The authoring occupation and GOAP goal may themselves reveal the answer to
  // a mystery. Until the sheet has an explicit public-role column, keep the
  // API and Gemini boundary neutral instead of relying on a fragile blacklist.
  return `${npc.home || npc.initialLocation || "この土地"}の住人`;
}

export function publicNpc(npc, state) {
  return {
    id: npc.id,
    name: npc.name,
    role: publicRole(npc),
    species: npc.species,
    speechStyle: null,
    importance: null,
    mood: state.lifeStatus === "injured" ? "負傷" : "通常",
    lifeStatus: state.lifeStatus,
    presence: state.presence,
    locationId: state.position?.hubId ?? state.location,
    facilityId: state.position?.facilityId ?? null,
    currentGoal: null,
    knownLocalFacts: [],
  };
}

/** The only production boundary for deciding who may speak in a scene. */
export function presentNpcsAt(runtime, data, { location, facilityId } = {}) {
  const hubId = location ?? runtime.playerState.player.location;
  const localFacilityId = facilityId ?? runtime.playerState.player.facilityId;
  return data.model.npcs
    .flatMap((npc) => {
      const state = runtime.livingWorld.npcStates[npc.id];
      if (!state || INACTIVE_PRESENCE.has(state.presence) || ["dead", "missing"].includes(state.lifeStatus)) return [];
      if (state.presence !== "present") return [];
      if ((state.position?.hubId ?? state.location) !== hubId) return [];
      if ((state.position?.facilityId ?? null) !== (localFacilityId ?? null)) return [];
      return [publicNpc(npc, state)];
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function syncAuthoritativePresentNpcIds(runtime, data) {
  const present = presentNpcsAt(runtime, data);
  runtime.playerState.authoritativePresentNpcIds = new Set(present.map((npc) => npc.id));
  return present;
}

export function npcPopulationSummary(runtime) {
  const counts = { alive: 0, injured: 0, dead: 0, missing: 0, traveling: 0, departed: 0, present: 0 };
  for (const state of Object.values(runtime.livingWorld.npcStates)) {
    if (state.lifeStatus === "dead") counts.dead += 1;
    else if (state.lifeStatus === "injured") counts.injured += 1;
    else if (state.lifeStatus === "missing") counts.missing += 1;
    else counts.alive += 1;
    if (state.presence === "traveling") counts.traveling += 1;
    if (state.presence === "departed") counts.departed += 1;
    if (state.presence === "present") counts.present += 1;
  }
  return counts;
}
