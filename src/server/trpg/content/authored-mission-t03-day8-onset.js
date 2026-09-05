import * as base from "./authored-mission-t02-village-resolution.js";

export * from "./authored-mission-t02-village-resolution.js";

export const AUTHORED_MISSION_T03_DAY8_ONSET_VERSION = "authored-mission-t03-day8-onset-v3";

const TROUBLE_ID = "T03";
const MISSION_ID = "MSN-T03";
const LOCATION = "田園の村";
const ONSET_MINUTE = 7 * 1440 + 5 * 60 - 10 * 60;
const RUMOR_ID = "RUM-T03-active";
const TERMINAL_MISSION_STATUSES = new Set(["completed", "failed", "suppressed"]);

function missionById(runtime, missionId) {
  const missions = runtime?.playerState?.missions;
  if (Array.isArray(missions)) return missions.find((mission) => mission?.id === missionId) ?? null;
  if (missions instanceof Map) return missions.get(missionId) ?? null;
  return missions?.[missionId] ?? null;
}

function ensureKnownRumor(runtime, minute) {
  const state = runtime?.playerState;
  if (!state) return false;
  state.rumors ??= [];
  state.rumorById ??= {};
  if (state.rumorById[RUMOR_ID] || state.rumors.some((rumor) => rumor?.id === RUMOR_ID)) return false;

  const rumor = {
    id: RUMOR_ID,
    troubleId: TROUBLE_ID,
    text: "赤牙狼の群れの南下:active",
    origin: LOCATION,
    originMinute: minute,
    importance: 0.75,
    playerOriginated: false,
    recipients: {},
  };
  state.rumors.push(rumor);
  state.rumorById[RUMOR_ID] = rumor;
  if (state.player?.location === LOCATION) {
    state.player.knownRumorIds ??= new Set();
    state.player.knownRumorIds.add(RUMOR_ID);
  }
  state.history ??= [];
  state.history.push({ type: "RUMOR_PUBLISHED", minute, rumorId: RUMOR_ID, troubleId: TROUBLE_ID });
  return true;
}

function syncCanonicalT03Day8Onset(runtime, result = { ok: true }) {
  if (result?.ok === false) return false;
  const state = runtime?.playerState;
  const trouble = state?.troubles?.[TROUBLE_ID];
  if (!state || !trouble || trouble.status !== "scheduled") return false;

  const minute = Number(state.absoluteMinute ?? 0);
  if (!Number.isFinite(minute) || minute < ONSET_MINUTE) return false;

  const mission = missionById(runtime, MISSION_ID);
  if (mission && TERMINAL_MISSION_STATUSES.has(String(mission.status ?? ""))) return false;

  const from = trouble.status;
  trouble.status = "active";
  trouble.activatedAt ??= minute;
  trouble.transitions ??= [];
  trouble.transitions.push({ from, to: "active", minute, reason: "canonical-t03-day8-dawn-onset" });

  state.history ??= [];
  state.history.push({
    type: "TROUBLE_TRANSITION",
    minute,
    troubleId: TROUBLE_ID,
    from,
    to: "active",
    reason: "canonical-t03-day8-dawn-onset",
  });

  ensureKnownRumor(runtime, minute);
  if (mission?.status === "locked") mission.status = "active";
  base.initializeAuthoredMissionFlowForMission?.(runtime, MISSION_ID);
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  return base.authoredMissionFlowGuidance(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, selected, result) {
  // Day8 controls when T03 becomes real in the common world. It does not
  // rewrite the authored hearing branch chosen by the player. In particular,
  // feeding_pattern keeps the two leads defined by the T03 pack instead of
  // silently receiving a third lead that the other opening branches did not
  // choose and the canonical Human Virtue ledger never requires.
  const consumed = base.applyAuthoredMissionFlowAction(runtime, selected, result);
  const activated = syncCanonicalT03Day8Onset(runtime, result);
  return consumed || activated;
}

export const AUTHORED_MISSION_T03_DAY8_ONSET_INTERNALS = Object.freeze({
  TROUBLE_ID,
  MISSION_ID,
  LOCATION,
  ONSET_MINUTE,
  RUMOR_ID,
  missionById,
  ensureKnownRumor,
  syncCanonicalT03Day8Onset,
});
