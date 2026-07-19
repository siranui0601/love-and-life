const INACTIVE_PRESENCE = new Set(["dead", "missing", "departed", "sealed", "not-yet-present", "traveling"]);

// Explicitly reviewed, player-safe presentation fields. Authoring occupations
// remain private because some of them disclose a culprit or hidden allegiance.
const SAFE_PUBLIC_PERSONA = Object.freeze({
  NPC001: { role: "冒険家に憧れる村の少年", speechStyle: "少年らしく早口。冒険の話になると夢中になる" },
  NPC002: { role: "心配そうな村の女性", speechStyle: "震えを抑えながら、相手へすがるように話す" },
  NPC003: { role: "田園の村の村長", speechStyle: "慎重で、要点を順序立てて話す" },
  NPC004: { role: "麦畑で働く村人", speechStyle: "温かい田舎言葉。まず相手の体調を気遣う" },
  NPC062: { role: "落ち着かない村の子ども", speechStyle: "正直だが、言い出すまでにためらう" },
});

const UNKNOWN_NPC_LABELS = Object.freeze({
  NPC001: "行方不明の少年",
  NPC002: "取り乱した女性",
  NPC003: "年配の村人",
  NPC004: "見知らぬ女性",
  NPC062: "落ち着かない少年",
});

function publicRole(npc) {
  // The authoring occupation and GOAP goal may themselves reveal the answer to
  // a mystery. Until the sheet has an explicit public-role column, keep the
  // API and Gemini boundary neutral instead of relying on a fragile blacklist.
  return SAFE_PUBLIC_PERSONA[npc.id]?.role ?? `${npc.home || npc.initialLocation || "この土地"}の住人`;
}

export function publicNpc(npc, state, { known = true } = {}) {
  return {
    id: npc.id,
    name: known ? npc.name : UNKNOWN_NPC_LABELS[npc.id] ?? "見知らぬ人物",
    identified: Boolean(known),
    role: publicRole(npc),
    species: npc.species,
    speechStyle: SAFE_PUBLIC_PERSONA[npc.id]?.speechStyle ?? null,
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
      const knownNpcIds = runtime.playerKnowledge?.knownNpcIds;
      const known = !knownNpcIds || knownNpcIds.has(npc.id);
      return [publicNpc(npc, state, { known })];
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
