import { GAME_END_MINUTE, clockFromMinute, shortestTravelPlan } from "./player-journey.mjs";

export { GAME_END_MINUTE, shortestTravelPlan };

export const PLAYER_PROFILES_V2 = Object.freeze([
  { id: "balanced", label: "均衡型", weaponTypes: ["oneHandedSword", "shield"], story: .75, combat: .55, explore: .55, trade: .35, caution: .55 },
  { id: "story", label: "事件調査型", weaponTypes: ["oneHandedSword", "shield"], story: 1, combat: .45, explore: .7, trade: .25, caution: .55 },
  { id: "fighter", label: "戦闘優先型", weaponTypes: ["twoHandedSword", "axe", "spear", "oneHandedSword"], story: .35, combat: 1, explore: .3, trade: .2, caution: .25 },
  { id: "explorer", label: "探索優先型", weaponTypes: ["bow", "oneHandedSword"], story: .6, combat: .45, explore: 1, trade: .2, caution: .45 },
  { id: "merchant", label: "商人型", weaponTypes: ["oneHandedSword", "staff", "book"], story: .3, combat: .25, explore: .65, trade: 1, caution: .65 },
  { id: "cautious", label: "生存優先型", weaponTypes: ["oneHandedSword", "shield"], story: .7, combat: .2, explore: .45, trade: .35, caution: 1 },
  { id: "random", label: "ランダム有効選択型", weaponTypes: ["oneHandedSword", "bow", "staff"], story: .5, combat: .5, explore: .5, trade: .5, caution: .5 },
].map(Object.freeze));

const PROFILES = new Map(PLAYER_PROFILES_V2.map((profile) => [profile.id, profile]));
const GATES = { T15: ["any", "T05", "T06"], T18: ["all", "T13"], T19: ["all", "T13"] };
const TERMINAL = new Set(["resolved", "failed", "suppressed"]);

export const profileByIdV2 = (id) => PROFILES.get(id);
export function hash32V2(text) { let h = 2166136261; for (const c of String(text)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const unitV2 = (...parts) => hash32V2(parts.join("\0")) / 4294967296;
export function incV2(root, path, amount = 1) { const p = String(path).split("."); let o = root; for (const k of p.slice(0, -1)) o = o[k] ??= {}; const k = p.at(-1); o[k] = Number(o[k] ?? 0) + Number(amount); return o[k]; }
export const momentV2 = (day, phase) => (day - 1) * 1440 + ([600, 840, 1080, 1320][phase] ?? 600) - 600;

export function syncClockV2(state) {
  Object.assign(state, clockFromMinute(state.absoluteMinute));
  state.daypart = state.minuteOfDay < 480 ? "dawn" : state.minuteOfDay < 1080 ? "day" : state.minuteOfDay < 1320 ? "dusk" : "night";
}

export function publishRumorV2(state, data) {
  const id = data.id ?? `RUM2-${String(state.rumors.length + 1).padStart(5, "0")}`;
  if (state.rumorById[id]) return state.rumorById[id];
  const rumor = { id, troubleId: data.troubleId ?? null, text: data.text, origin: data.origin ?? state.player.location, originMinute: state.absoluteMinute, importance: data.importance ?? .7, recipients: {} };
  state.rumors.push(rumor); state.rumorById[id] = rumor;
  if (data.playerKnows !== false) state.player.knownRumorIds.add(id);
  state.history.push({ type: "RUMOR_PUBLISHED", minute: state.absoluteMinute, rumorId: id, troubleId: rumor.troubleId });
  return rumor;
}

function gateOpen(state, id) { const gate = GATES[id]; if (!gate) return true; const hits = gate.slice(1).filter((x) => ["failed", "critical"].includes(state.troubles[x]?.status)).length; return gate[0] === "any" ? hits > 0 : hits === gate.length - 1; }
function consequences(state, id, status) {
  const failed = ["failed", "critical"].includes(status); const before = JSON.stringify(state.worldFlags);
  if (id === "T13" && failed) Object.assign(state.worldFlags, { worldTreeFallen: true, forestMazeOpen: true });
  if (id === "T08" && status === "resolved") state.worldFlags.elfApproval = true;
  if (id === "T12" && status === "resolved") state.worldFlags.blackridgePermit = true;
  if (id === "T15" && failed) state.worldFlags.foreignFleetLanded = true;
  if (id === "T17" && status === "resolved") state.worldFlags.secondSummoningStopped = true;
  if (id === "T18" && failed) state.worldFlags.colossusAwake = true;
  if (id === "T19" && status === "critical") state.worldFlags.blackridgeArmyAtCapital = true;
  if (id === "T19" && status === "failed") state.worldFlags.capitalFallen = true;
  if (before !== JSON.stringify(state.worldFlags)) state.routeCache = {};
}

export function transitionTroubleV2(state, model, id, to, reason) {
  const runtime = state.troubles[id]; if (!runtime || runtime.status === to || TERMINAL.has(runtime.status)) return false;
  const from = runtime.status; runtime.status = to; runtime.transitions.push({ from, to, minute: state.absoluteMinute, reason });
  if (to === "active") runtime.activatedAt = state.absoluteMinute; if (TERMINAL.has(to)) runtime.terminalAt = state.absoluteMinute;
  consequences(state, id, to); const trouble = model.troubleById[id];
  publishRumorV2(state, { id: `RUM2-${id}-${to}`, troubleId: id, origin: trouble.primaryLocations[0], importance: TERMINAL.has(to) || to === "critical" ? .95 : .78, playerKnows: state.player.location === trouble.primaryLocations[0], text: `${trouble.name}:${to}` });
  state.history.push({ type: "TROUBLE_TRANSITION", minute: state.absoluteMinute, troubleId: id, from, to, reason }); return true;
}

export function updateTroublesV2(state, model) {
  for (const trouble of model.troubles) { const runtime = state.troubles[trouble.id];
    if (runtime.status === "scheduled" && state.absoluteMinute >= momentV2(trouble.startDay, trouble.startPhase)) { const open = gateOpen(state, trouble.id); transitionTroubleV2(state, model, trouble.id, open ? "active" : "suppressed", open ? "scheduled-onset" : "gate-closed"); }
    if (runtime.status === "active" && state.absoluteMinute >= momentV2(trouble.deadlineDay, trouble.deadlinePhase)) transitionTroubleV2(state, model, trouble.id, "critical", "deadline-missed");
    if (runtime.status === "critical" && state.absoluteMinute >= momentV2(trouble.finalDay, trouble.finalPhase) && transitionTroubleV2(state, model, trouble.id, "failed", "final-deadline-missed")) state.metrics.troubleFailedByDeadline += 1;
  }
}

export function propagateRumorsV2(state, model) {
  for (const rumor of state.rumors) for (const npc of model.npcs) { if (rumor.recipients[npc.id]) continue; const hub = state.day <= 1 ? npc.initialLocation : npc.home || npc.initialLocation; const hours = shortestTravelPlan(model, state, rumor.origin, hub)?.hours; if (!Number.isFinite(hours) || state.absoluteMinute < rumor.originMinute + Math.ceil(hours * 60) + 30) continue; if (!(rumor.importance >= .8 || npc.relatedTroubleIds.includes(rumor.troubleId))) continue; rumor.recipients[npc.id] = { minute: state.absoluteMinute, hub }; incV2(state.progress, "rumors.npcRecipients"); if (rumor.troubleId && npc.relatedTroubleIds.includes(rumor.troubleId)) { incV2(state.progress, "rumors.npcReplans"); if (npc.disposition === "mitigate") state.troubles[rumor.troubleId].casualtyMitigation += npc.importanceWeight * .05; } }
}

export function advanceV2(state, model, minutes, reason) { const value = Math.max(0, Math.round(Number(minutes) || 0)); if (!value) return; const before = state.absoluteMinute; state.absoluteMinute = Math.min(GAME_END_MINUTE, state.absoluteMinute + value); syncClockV2(state); updateTroublesV2(state, model); propagateRumorsV2(state, model); state.history.push({ type: "TIME_ADVANCE", minute: before, minutes: value, reason, afterMinute: state.absoluteMinute }); }

function localMinutes(from, to) { const text = `${to.name} ${to.type} ${to.function} ${to.notes}`; if (/郊外|外れ|坑道|参道|森|河|世界樹|見張り|港/u.test(text)) return 24 + hash32V2(`${from?.id}->${to.id}`) % 17; if (/市場|広場|宿|酒場|工房|店|城|役所/u.test(text)) return 7 + hash32V2(to.id) % 8; return 11 + hash32V2(`${from?.id ?? "center"}:${to.id}`) % 12; }
export function arrivalFacilityV2(model, hub) { const list = model.facilitiesByHub[hub] ?? []; return list.find((x) => /広場|門|港|入口|参道口|馬屋/u.test(`${x.name} ${x.type}`)) ?? list[0] ?? null; }
export function availableLocalMovementActionsV2(state, model) { const current = state.player.facilityId ? model.facilityById[state.player.facilityId] : null; return (model.facilitiesByHub[state.player.location] ?? []).filter((x) => x.id !== state.player.facilityId).map((x) => { const minutes = localMinutes(current, x); return { id: `MOVE_LOCAL:${x.id}`, type: "localTravel", destination: state.player.location, destinationFacilityId: x.id, minutes, label: `${x.name}へ移動する（地域内・${minutes}分）` }; }).sort((a, b) => a.minutes - b.minutes || a.destinationFacilityId.localeCompare(b.destinationFacilityId)); }
export function availableRegionalMovementActionsV2(state, model) { return model.locations.filter((x) => x !== state.player.location).map((x) => shortestTravelPlan(model, state, state.player.location, x)).filter(Boolean).map((p) => ({ id: `MOVE_REGION:${p.destination}`, type: "regionalTravel", destination: p.destination, destinationFacilityId: arrivalFacilityV2(model, p.destination)?.id ?? null, minutes: Math.max(10, Math.round(p.hours * 60)), routeIds: p.routeIds, hubs: p.hubs, label: `${p.destination}へ移動する（地域外・${p.hours.toFixed(2)}時間）` })).sort((a, b) => a.minutes - b.minutes || a.destination.localeCompare(b.destination, "ja")); }
export function availableMovementActionsV2(state, model) { return [...availableLocalMovementActionsV2(state, model), ...availableRegionalMovementActionsV2(state, model)]; }
