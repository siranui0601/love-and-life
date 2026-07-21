import { createHash } from "node:crypto";
import { createPlayerBuild } from "./battle-model.mjs";
import { simulateBattle } from "./battle-simulator.mjs";
import { evaluateConditions, flattenConditionLeaves } from "./skill-progression.mjs";
import {
  checkPermanentMission,
  createMissionCatalog,
  createMissionRuntime,
  experienceToNextLevel,
  unlockNextPermanentMission,
} from "./mission-model.mjs";
import { autoShop, createShopRuntime } from "./shop-runtime.mjs";

export const GAME_END_MINUTE = 99 * 1440 + 14 * 60;
export const PLAYER_PROFILES = Object.freeze([
  { id: "balanced", label: "均衡型", weaponTypes: ["oneHandedSword", "shield"], story: 0.78, combat: 0.55, explore: 0.55, trade: 0.35, caution: 0.55 },
  { id: "story", label: "事件調査型", weaponTypes: ["oneHandedSword", "shield"], story: 1, combat: 0.45, explore: 0.65, trade: 0.25, caution: 0.5 },
  { id: "fighter", label: "戦闘優先型", weaponTypes: ["twoHandedSword", "axe", "spear", "oneHandedSword"], story: 0.4, combat: 1, explore: 0.3, trade: 0.2, caution: 0.25 },
  { id: "explorer", label: "探索優先型", weaponTypes: ["bow", "oneHandedSword"], story: 0.65, combat: 0.5, explore: 1, trade: 0.2, caution: 0.45 },
  { id: "merchant", label: "商人型", weaponTypes: ["oneHandedSword", "staff", "book"], story: 0.35, combat: 0.25, explore: 0.6, trade: 1, caution: 0.65 },
  { id: "cautious", label: "生存優先型", weaponTypes: ["oneHandedSword", "shield"], story: 0.65, combat: 0.2, explore: 0.4, trade: 0.35, caution: 1 },
  { id: "random", label: "ランダム有効選択型", weaponTypes: ["oneHandedSword", "bow", "staff"], story: 0.5, combat: 0.5, explore: 0.5, trade: 0.5, caution: 0.5 },
].map(Object.freeze));

const PROFILE = new Map(PLAYER_PROFILES.map((profile) => [profile.id, profile]));
const GATES = { T15: ["any", "T05", "T06"], T18: ["all", "T13"], T19: ["all", "T13"] };
const TERMINAL = new Set(["resolved", "failed", "suppressed"]);

const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function hash32(text) {
  let value = 2166136261;
  for (const character of String(text)) {
    value ^= character.codePointAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
const unit = (...parts) => hash32(parts.join("\0")) / 4294967296;

function inc(root, path, amount = 1) {
  const segments = String(path).split(".");
  let cursor = root;
  for (const segment of segments.slice(0, -1)) cursor = cursor[segment] ??= {};
  const key = segments.at(-1);
  cursor[key] = Number(cursor[key] ?? 0) + Number(amount);
  return cursor[key];
}

function prerequisitesOf(skill) {
  if (!skill.prerequisites) return [];
  return Array.isArray(skill.prerequisites)
    ? skill.prerequisites
    : String(skill.prerequisites).split(",").map((value) => value.trim()).filter(Boolean);
}

export function clockFromMinute(minute) {
  if (minute >= GAME_END_MINUTE) return { day: 100, hour: 24, minute: 0, minuteOfDay: 1440 };
  const value = 600 + Math.max(0, Math.floor(minute));
  const minuteOfDay = value % 1440;
  return {
    day: Math.floor(value / 1440) + 1,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    minuteOfDay,
  };
}

function syncClock(state) {
  Object.assign(state, clockFromMinute(state.absoluteMinute));
  state.phaseIndex = state.minuteOfDay >= 1320 || state.minuteOfDay < 600 ? 3 : state.minuteOfDay >= 1080 ? 2 : state.minuteOfDay >= 840 ? 1 : 0;
  state.daypart = state.minuteOfDay < 480 ? "dawn" : state.minuteOfDay < 1080 ? "day" : state.minuteOfDay < 1320 ? "dusk" : "night";
}

const moment = (day, phase) => (day - 1) * 1440 + ([600, 840, 1080, 1320][phase] ?? 600) - 600;
const failedLike = (status) => status === "failed" || status === "critical";

function gateOpen(state, troubleId) {
  const gate = GATES[troubleId];
  if (!gate) return true;
  const hits = gate.slice(1).filter((id) => failedLike(state.troubles[id]?.status)).length;
  return gate[0] === "any" ? hits > 0 : hits === gate.length - 1;
}

function consequences(state, troubleId, status) {
  const fail = failedLike(status);
  const before = JSON.stringify(state.worldFlags);
  if (troubleId === "T13" && fail) Object.assign(state.worldFlags, { worldTreeFallen: true, forestMazeOpen: true });
  if (troubleId === "T08" && status === "resolved") state.worldFlags.elfApproval = true;
  if (troubleId === "T12" && status === "resolved") state.worldFlags.blackridgePermit = true;
  if (troubleId === "T15" && fail) state.worldFlags.foreignFleetLanded = true;
  if (troubleId === "T17" && status === "resolved") state.worldFlags.secondSummoningStopped = true;
  if (troubleId === "T18" && fail) state.worldFlags.colossusAwake = true;
  if (troubleId === "T19" && status === "critical") state.worldFlags.blackridgeArmyAtCapital = true;
  if (troubleId === "T19" && status === "failed") state.worldFlags.capitalFallen = true;
  if (before !== JSON.stringify(state.worldFlags)) state.routeCache = {};
}

function publishRumor(state, model, data) {
  const id = data.id ?? `RUM-${String(state.rumors.length + 1).padStart(6, "0")}`;
  if (state.rumorById[id]) return;
  const rumor = {
    id,
    troubleId: data.troubleId ?? null,
    text: data.text,
    origin: data.origin ?? state.player.location,
    originMinute: state.absoluteMinute,
    importance: data.importance ?? 0.7,
    // Hearing a rumor is not the same as spreading it. Callers must mark an
    // explicit player sharing/intervention action before permanent mission
    // credit can accrue.
    playerOriginated: data.playerOriginated === true,
    recipients: {},
  };
  state.rumors.push(rumor);
  state.rumorById[id] = rumor;
  if (data.playerKnows !== false) state.player.knownRumorIds.add(id);
  state.history.push({ type: "RUMOR_PUBLISHED", minute: state.absoluteMinute, rumorId: id, troubleId: rumor.troubleId });
}

function transition(state, model, troubleId, to, reason) {
  const runtime = state.troubles[troubleId];
  if (!runtime || runtime.status === to) return false;
  const from = runtime.status;
  runtime.status = to;
  runtime.transitions.push({ from, to, minute: state.absoluteMinute, reason });
  if (to === "active") runtime.activatedAt = state.absoluteMinute;
  if (TERMINAL.has(to)) runtime.terminalAt = state.absoluteMinute;
  consequences(state, troubleId, to);
  const trouble = model.troubleById[troubleId];
  publishRumor(state, model, {
    id: `RUM-${troubleId}-${to}`,
    troubleId,
    origin: trouble.primaryLocations[0],
    importance: TERMINAL.has(to) || to === "critical" ? 0.95 : 0.75,
    playerKnows: state.player.location === trouble.primaryLocations[0],
    text: `${trouble.name}:${to}`,
  });
  state.history.push({ type: "TROUBLE_TRANSITION", minute: state.absoluteMinute, troubleId, from, to, reason });
  return true;
}

function updateTroubles(state, model) {
  for (const trouble of model.troubles) {
    const runtime = state.troubles[trouble.id];
    if (runtime.status === "scheduled" && state.absoluteMinute >= moment(trouble.startDay, trouble.startPhase)) {
      const open = gateOpen(state, trouble.id);
      transition(state, model, trouble.id, open ? "active" : "suppressed", open ? "scheduled-onset" : "gate-closed");
    }
    if (runtime.status === "active" && state.absoluteMinute >= moment(trouble.deadlineDay, trouble.deadlinePhase)) {
      transition(
        state,
        model,
        trouble.id,
        trouble.id === "T01" ? "failed" : "critical",
        trouble.id === "T01" ? "rescue-window-missed" : "deadline-missed",
      );
    }
    if (runtime.status === "critical" && state.absoluteMinute >= moment(trouble.finalDay, trouble.finalPhase)) {
      transition(state, model, trouble.id, "failed", "final-deadline-missed");
    }
  }
}
function routeAllowed(state, route, from, to) {
  if (route.gate === "elf-access") {
    return from === "エルフの隠れ里" || to !== "エルフの隠れ里" || state.worldFlags.worldTreeFallen || state.worldFlags.elfApproval;
  }
  if (route.gate === "blackridge-forest-access") {
    return state.worldFlags.worldTreeFallen || state.worldFlags.blackridgePermit || from === "黒嶺連合領";
  }
  return true;
}

export function shortestTravelPlan(model, state, from, destination) {
  if (from === destination) return { destination, hours: 0, routeIds: [], hubs: [from] };
  const queue = [{ hub: from, cost: 0, routeIds: [], hubs: [from] }];
  const best = new Map([[from, 0]]);
  while (queue.length) {
    queue.sort((left, right) => left.cost - right.cost || left.hub.localeCompare(right.hub, "ja"));
    const current = queue.shift();
    if (current.hub === destination) return { destination, hours: current.cost, routeIds: current.routeIds, hubs: current.hubs };
    if (current.cost > best.get(current.hub)) continue;
    for (const edge of model.adjacency[current.hub] ?? []) {
      const route = model.routeById[edge.routeId];
      if (!route || !routeAllowed(state, route, edge.from, edge.to)) continue;
      const cost = current.cost + edge.hours;
      if (cost >= (best.get(edge.to) ?? Infinity)) continue;
      best.set(edge.to, cost);
      queue.push({ hub: edge.to, cost, routeIds: [...current.routeIds, edge.routeId], hubs: [...current.hubs, edge.to] });
    }
  }
  return null;
}

function preferredArrivalFacility(model, hub) {
  const facilities = model.facilitiesByHub[hub] ?? [];
  return facilities.find((facility) => /門|入口|広場|駅|港|船着|宿|詰所/u.test(`${facility.name} ${facility.type}`)) ?? facilities[0] ?? null;
}

function localMoveMinutes(model, state, facility) {
  const facilities = model.facilitiesByHub[state.player.location] ?? [];
  const fromIndex = Math.max(0, facilities.findIndex((entry) => entry.id === state.player.facilityId));
  const toIndex = Math.max(0, facilities.findIndex((entry) => entry.id === facility.id));
  const spread = Math.abs(toIndex - fromIndex);
  const typePenalty = /坑道|森|外れ|地下|遺跡|世界樹|港/u.test(`${facility.name} ${facility.type}`) ? 5 : 0;
  return Math.max(4, Math.min(24, 5 + spread * 2 + typePenalty));
}

export function availableLocalMovementActions(state, model) {
  return (model.facilitiesByHub[state.player.location] ?? [])
    .filter((facility) => facility.id !== state.player.facilityId)
    .map((facility) => ({
      id: `MOVE_LOCAL:${facility.id}`,
      type: "move",
      movementScope: "local",
      destination: state.player.location,
      destinationHub: state.player.location,
      destinationFacilityId: facility.id,
      minutes: localMoveMinutes(model, state, facility),
      label: `${facility.name}へ移動する（地域内・${localMoveMinutes(model, state, facility)}分）`,
    }))
    .sort((left, right) => left.minutes - right.minutes || left.destinationFacilityId.localeCompare(right.destinationFacilityId));
}

export function availableTravelActions(state, model) {
  return model.locations
    .filter((location) => location !== state.player.location)
    .map((location) => shortestTravelPlan(model, state, state.player.location, location))
    .filter(Boolean)
    .map((plan) => {
      const arrival = preferredArrivalFacility(model, plan.destination);
      return {
        id: `MOVE_REGION:${plan.destination}`,
        type: "move",
        movementScope: "regional",
        destination: plan.destination,
        destinationHub: plan.destination,
        destinationFacilityId: arrival?.id ?? null,
        minutes: Math.max(10, Math.round(plan.hours * 60)),
        routeIds: plan.routeIds,
        hubs: plan.hubs,
        label: `${plan.destination}へ移動する（地域間・${plan.hours.toFixed(2)}時間）`,
      };
    })
    .sort((left, right) => left.minutes - right.minutes || left.destination.localeCompare(right.destination, "ja"));
}

export function availableMovementActions(state, model) {
  return [...availableLocalMovementActions(state, model), ...availableTravelActions(state, model)];
}

function routeTags(model, routeIds) {
  const text = routeIds.map((id) => `${model.routeById[id]?.nature ?? ""} ${model.routeById[id]?.from ?? ""} ${model.routeById[id]?.to ?? ""}`).join(" ");
  return [
    /森|林/u.test(text) && "forest",
    /荒野|街道|近郊|平原/u.test(text) && "wilderness",
    /洞窟|坑道/u.test(text) && "cave",
    /川|河|水|港|海/u.test(text) && "waterSide",
  ].filter(Boolean);
}

function npcHub(npc, day) {
  return day <= 1 ? npc.initialLocation : npc.home || npc.initialLocation;
}

function npcFacility(npc, day) {
  return day <= 1 ? npc.initialFacilityId : npc.mainFacilityId || npc.initialFacilityId;
}

function routeHours(state, model, from, to) {
  const key = `${from}->${to}`;
  if (state.routeCache[key] !== undefined) return state.routeCache[key];
  state.routeCache[key] = shortestTravelPlan(model, state, from, to)?.hours ?? Infinity;
  return state.routeCache[key];
}

function propagateRumors(state, model) {
  for (const rumor of state.rumors) {
    for (const npc of model.npcs) {
      if (rumor.recipients[npc.id]) continue;
      const hub = npcHub(npc, state.day);
      const hours = routeHours(state, model, rumor.origin, hub);
      if (state.absoluteMinute < rumor.originMinute + Math.ceil(hours * 60) + 30) continue;
      if (!(rumor.importance >= 0.8 || npc.relatedTroubleIds.includes(rumor.troubleId) || npc.initialKnowledge?.interests?.some((interest) => rumor.text.includes(interest)))) continue;
      rumor.recipients[npc.id] = { minute: state.absoluteMinute, hub };
      inc(state.progress, "rumors.npcRecipients");
      if (rumor.playerOriginated) inc(state.progress, "rumors.playerRecipients");
      if (rumor.troubleId && npc.relatedTroubleIds.includes(rumor.troubleId)) {
        inc(state.progress, "rumors.npcReplans");
        if (rumor.playerOriginated) inc(state.progress, "rumors.playerReplans");
        if (npc.disposition === "mitigate") state.troubles[rumor.troubleId].casualtyMitigation += npc.importanceWeight * 0.05;
      }
    }
  }
}

function advance(state, model, minutes, reason) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (!value) return;
  const before = state.absoluteMinute;
  state.absoluteMinute = Math.min(GAME_END_MINUTE, state.absoluteMinute + value);
  syncClock(state);
  updateTroubles(state, model);
  propagateRumors(state, model);
  state.history.push({ type: "TIME_ADVANCE", minute: before, minutes: value, reason, afterMinute: state.absoluteMinute });
}

function conditionAtom(text, state) {
  const value = String(text ?? "").trim();
  if (!value) return true;
  let match = value.match(/Day\s*(>=|<=|>|<|=)?\s*(\d+)/iu);
  if (match) {
    const day = Number(match[2]);
    if (match[1] === ">=") return state.day >= day;
    if (match[1] === "<=") return state.day <= day;
    if (match[1] === ">") return state.day > day;
    if (match[1] === "<") return state.day < day;
    return state.day === day;
  }
  match = value.match(/(T\d{2})\.(?:status)?\s*(!=|=)\s*(resolved|failed|active|critical|suppressed|scheduled)/iu);
  if (match) return match[2] === "!=" ? state.troubles[match[1]]?.status !== match[3] : state.troubles[match[1]]?.status === match[3];
  match = value.match(/(T\d{2})(?:進行中|\.active)/iu);
  if (match) return ["active", "critical"].includes(state.troubles[match[1]]?.status);
  if (/stage</u.test(value)) return !/critical|failed/u.test(value);
  if (/discovered|engaged|investigation|operation|boss|final|rescue|ambush|hostile|permit|entered|climax|reconnaissance|militarized|market hostility|illegal lab/u.test(value)) return false;
  return true;
}

function encounterAllowed(encounter, state, forced = false) {
  if (state.day < encounter.startDay || state.day > encounter.endDay) return false;
  if (encounter.dayparts && encounter.dayparts !== "any" && !String(encounter.dayparts).split("|").includes(state.daypart)) return false;
  if (forced || !String(encounter.condition ?? "").trim()) return true;
  const text = String(encounter.condition);
  const alternatives = text.split(/\s+OR\s+/iu);
  if (alternatives.length > 1) return alternatives.some((entry) => conditionAtom(entry, state));
  return text.split(/\s+AND\s+/iu).every((entry) => conditionAtom(entry, state));
}

function dangerLimit(state, profile) {
  return Math.max(1, Math.min(10, 1 + Math.floor((state.player.level - 1) / 3) + (profile.combat - profile.caution > 0.4 ? 2 : profile.combat > profile.caution ? 1 : 0)));
}

function encounters(state, data, profile, { forcedId = null, eventOnly = false } = {}) {
  if (forcedId) return data.encounterById.has(forcedId) ? [data.encounterById.get(forcedId)] : [];
  const limit = dangerLimit(state, profile);
  return data.encounters
    .filter((encounter) => encounter.region === state.player.location && encounter.status === "active" && encounterAllowed(encounter, state))
    .filter((encounter) => eventOnly ? encounter.avoidability === "event" : !["event", "authorization", "diplomacy"].includes(encounter.avoidability))
    .filter((encounter) => encounter.dangerTier <= limit + (profile.id === "fighter" ? 1 : 0));
}

function weighted(items, key, weight = (item) => Number(item.baseWeight || 1)) {
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + Math.max(0.001, Number(weight(item)) || 0.001), 0);
  let cursor = unit(key) * total;
  for (const item of items) {
    cursor -= Math.max(0.001, Number(weight(item)) || 0.001);
    if (cursor <= 0) return item;
  }
  return items.at(-1);
}

function troubleStatusContext(state) {
  return Object.fromEntries(Object.entries(state.troubles).map(([id, runtime]) => [id, { status: runtime.status }]));
}

function skillContext(state, data) {
  const equipmentIds = Object.values(state.player.equipment).filter(Boolean);
  const grantedSkillIds = equipmentIds.map((id) => data.equipmentById.get(id)?.grantedSkillId).filter(Boolean);
  return {
    player: { level: state.player.level, skills: new Set(state.player.skills) },
    progress: state.progress,
    world: { ...state.worldFlags, troubles: troubleStatusContext(state) },
    inventory: { itemIds: new Set(Object.keys(state.player.inventory.items)), gold: state.player.gold },
    equipment: {
      activeWeaponTypes: new Set(equipmentIds.map((id) => data.equipmentById.get(id)?.weaponType).filter(Boolean)),
      grantedSkillIds: new Set(grantedSkillIds),
      equippedIds: new Set(equipmentIds),
    },
  };
}

function skillScore(skill, profile) {
  const text = `${skill.category ?? ""} ${skill.originalCategory ?? ""}`;
  let score = Number(skill.rank ?? 0) * 4 - Number(skill.requiredLevel ?? 0) * 0.5;
  if (profile.id === "fighter" && /物理|剣|斧|槍|弓/u.test(text)) score += 30;
  if (profile.id === "cautious" && /防御|回復|盾/u.test(text)) score += 35;
  if (profile.id === "explorer" && /弓|罠|探索|技巧/u.test(text)) score += 30;
  if (profile.id === "story" && /汎用|支援|回復|デバフ/u.test(text)) score += 15;
  if (profile.id === "merchant" && /金|商|道具|汎用/u.test(text)) score += 12;
  return score;
}

function revealEligible(skill, context) {
  return Number(skill.requiredLevel ?? 1) <= Number(context.player.level ?? 1)
    && evaluateConditions(skill.revealConditions, context)
    && evaluateConditions(skill.eventUnlockConditions, context);
}

function learnEligible(skill, context, state) {
  const cost = Math.max(1, Number(skill.spCost ?? 1));
  return ["basic_level_up", "flag_unlocked"].includes(skill.acquisitionCode)
    && !state.player.skills.has(skill.id)
    && Number(skill.requiredLevel ?? 1) <= state.player.level
    && cost <= state.player.sp
    && prerequisitesOf(skill).every((id) => state.player.skills.has(id))
    && evaluateConditions(skill.eventUnlockConditions, context)
    && evaluateConditions(skill.learnConditions, context);
}

function refreshSkillVisibility(state, data, skills) {
  const context = skillContext(state, data);
  state.player.visibleSkillIds = new Set(skills.filter((skill) => revealEligible(skill, context)).map((skill) => skill.id));
  state.player.flagEligibleSkillIds = new Set(skills
    .filter((skill) => skill.acquisitionCode === "flag_unlocked" && learnEligible(skill, context, state))
    .map((skill) => skill.id));
}

function updateMagicSkillCount(state, data) {
  state.player.magicSkillCount = [...state.player.skills]
    .filter((id) => /魔法|魔導|杖|本/u.test(`${data.playerSkillById.get(id)?.category ?? ""}`))
    .length;
}

export function listLearnablePlayerSkills(state, data, skills) {
  refreshSkillVisibility(state, data, skills);
  const context = skillContext(state, data);
  return skills
    .filter((skill) => ["basic_level_up", "flag_unlocked"].includes(skill.acquisitionCode))
    .map((skill) => {
      const cost = Math.max(1, Number(skill.spCost ?? 1));
      const missingPrerequisiteIds = prerequisitesOf(skill).filter((id) => !state.player.skills.has(id));
      const reasons = [];
      if (state.player.skills.has(skill.id)) reasons.push("already_learned");
      if (Number(skill.requiredLevel ?? 1) > state.player.level) reasons.push("insufficient_level");
      if (cost > state.player.sp) reasons.push("insufficient_sp");
      if (missingPrerequisiteIds.length) reasons.push("missing_prerequisites");
      if (!evaluateConditions(skill.eventUnlockConditions, context)) reasons.push("event_unlock_conditions_unmet");
      if (!evaluateConditions(skill.learnConditions, context)) reasons.push("learn_conditions_unmet");
      if (!state.player.visibleSkillIds.has(skill.id)) reasons.push("not_visible");
      return {
        id: skill.id,
        name: skill.name,
        acquisitionCode: skill.acquisitionCode,
        requiredLevel: Number(skill.requiredLevel ?? 1),
        spCost: cost,
        missingPrerequisiteIds,
        learnable: reasons.length === 0,
        reason: reasons[0] ?? "learnable",
        reasons,
      };
    })
    .sort((left, right) => Number(right.learnable) - Number(left.learnable)
      || left.requiredLevel - right.requiredLevel
      || left.id.localeCompare(right.id));
}

export function learnPlayerSkill(state, data, skills, skillId) {
  if (state.tuning?.manualSkillSelection !== true) {
    return { ok: false, reason: "manual_skill_selection_disabled", reasons: ["manual_skill_selection_disabled"] };
  }
  const skill = skills.find((entry) => entry.id === skillId);
  if (!skill) return { ok: false, reason: "unknown_skill", reasons: ["unknown_skill"] };
  const candidate = listLearnablePlayerSkills(state, data, skills).find((entry) => entry.id === skillId);
  if (!candidate) return { ok: false, reason: "unsupported_acquisition", reasons: ["unsupported_acquisition"] };
  if (!candidate.learnable) return { ok: false, reason: candidate.reasons[0], reasons: candidate.reasons, candidate };

  const context = skillContext(state, data);
  if (!learnEligible(skill, context, state)) {
    state.metrics.skillConditionViolations += 1;
    return { ok: false, reason: "conditions_changed", reasons: ["conditions_changed"] };
  }
  state.player.skills.add(skill.id);
  state.player.sp -= candidate.spCost;
  inc(state.progress, `skills.learnedBySource.${skill.acquisitionCode}`);
  state.history.push({
    type: "SKILL_LEARNED",
    minute: state.absoluteMinute,
    skillId: skill.id,
    acquisitionCode: skill.acquisitionCode,
    spCost: candidate.spCost,
    validAtAcquisition: true,
    selection: "manual",
  });
  refreshSkillVisibility(state, data, skills);
  updateMagicSkillCount(state, data);
  return { ok: true, skillId: skill.id, spCost: candidate.spCost, remainingSp: state.player.sp };
}

function autoLearn(state, data, skills, profile) {
  let count = 0;
  refreshSkillVisibility(state, data, skills);
  if (state.tuning?.manualSkillSelection === true) {
    updateMagicSkillCount(state, data);
    return 0;
  }
  while (state.player.sp > 0) {
    const context = skillContext(state, data);
    const candidates = skills
      .filter((skill) => learnEligible(skill, context, state))
      .sort((left, right) => skillScore(right, profile) - skillScore(left, profile) || left.id.localeCompare(right.id));
    const selected = candidates[0];
    if (!selected) break;
    const cost = Math.max(1, Number(selected.spCost ?? 1));
    const validAtAcquisition = learnEligible(selected, context, state);
    if (!validAtAcquisition) {
      state.metrics.skillConditionViolations += 1;
      break;
    }
    state.player.skills.add(selected.id);
    state.player.sp -= cost;
    count += 1;
    inc(state.progress, `skills.learnedBySource.${selected.acquisitionCode}`);
    state.history.push({
      type: "SKILL_LEARNED",
      minute: state.absoluteMinute,
      skillId: selected.id,
      acquisitionCode: selected.acquisitionCode,
      spCost: cost,
      validAtAcquisition,
    });
  }
  refreshSkillVisibility(state, data, skills);
  updateMagicSkillCount(state, data);
  return count;
}

const EVENT_THEMES_BY_LOCATION = Object.freeze({
  "田園の村": ["farmland"],
  "王都": ["capital"],
  "黒嶺連合領": ["blackridge"],
  "古代神殿": ["ancient", "ancientTemple"],
  "北陵要塞": ["northernFort"],
  "ドワーフ洞窟": ["dwarf"],
  "エルフの隠れ里": ["elf"],
  "森": ["forest", "worldTree"],
  "交易都市": ["trade"],
  "犯罪都市": ["crime"],
});

function eventThemes(event) {
  return [...new Set((event.targetLocations ?? []).flatMap((location) => EVENT_THEMES_BY_LOCATION[location] ?? []))];
}

function conditionMentionsEvent(skill, event) {
  const text = `${skill.eventFlagSummary ?? ""} ${skill.notes ?? ""} ${skill.classificationReason ?? ""}`;
  if ([event.troubleId, event.missionId, ...(event.targetLocations ?? [])].filter(Boolean).some((id) => text.includes(id))) return true;
  const themes = eventThemes(event);
  return flattenConditionLeaves(skill.grantConditions).some((leaf) => {
    const serialized = `${leaf.scope ?? ""}.${leaf.path ?? ""}:${JSON.stringify(leaf.value)}`;
    return [event.troubleId, event.missionId, ...themes].filter(Boolean).some((id) => serialized.includes(id));
  });
}

function eventGrantScore(skill, event) {
  const leaves = flattenConditionLeaves(skill.grantConditions);
  const themes = eventThemes(event);
  let score = conditionMentionsEvent(skill, event) ? 100 : 0;
  for (const leaf of leaves) {
    const path = String(leaf.path ?? "");
    if (themes.some((theme) => path.toLowerCase().includes(theme.toLowerCase()))) score += 80;
    if (path === "events.grantedSkillIds") score += 35;
    else if (path === "contracts.grantedSkillIds") score += 18;
    else if (path === "training.grantedSkillIds") score += 12;
    else if (path === "manuals.grantedSkillIds") score += 8;
    else if (path.startsWith("eventSkillGrants.byTheme.")) score += themes.some((theme) => path.endsWith(theme)) ? 70 : -100;
    else if (leaf.scope === "world" && path.startsWith("skillGrants.")) score += score ? 20 : -100;
  }
  score -= Math.max(0, Number(skill.requiredLevel ?? 1) - stateLevelForEvent(event)) * 2;
  return score;
}

function stateLevelForEvent(event) {
  return Number(event.playerLevel ?? 1);
}

function ensurePath(root, path) {
  const segments = String(path).split(".");
  let cursor = root;
  for (const segment of segments.slice(0, -1)) cursor = cursor[segment] ??= {};
  return { cursor, key: segments.at(-1) };
}

function provisionGrantConditions(state, skill) {
  for (const leaf of flattenConditionLeaves(skill.grantConditions)) {
    const root = leaf.scope === "world" ? state.worldFlags : leaf.scope === "progress" ? state.progress : null;
    if (!root) continue;
    const { cursor, key } = ensurePath(root, leaf.path);
    if (leaf.op === "contains") {
      if (!(cursor[key] instanceof Set)) cursor[key] = new Set(Array.isArray(cursor[key]) ? cursor[key] : []);
      cursor[key].add(leaf.value);
    } else if (leaf.op === "isTrue") cursor[key] = true;
  }
}

function grantEventSkills(state, data, skills, event) {
  const enrichedEvent = { ...event, playerLevel: state.player.level };
  const limit = Math.max(0, Number(state.tuning.maxEventSkillsPerMission ?? 1));
  const candidates = skills
    .filter((skill) => skill.acquisitionCode === "event_granted")
    .filter((skill) => !state.player.skills.has(skill.id))
    .filter((skill) => Number(skill.requiredLevel ?? 1) <= state.player.level + Number(state.tuning.eventSkillLevelGrace ?? 2))
    .map((skill) => ({ skill, score: eventGrantScore(skill, enrichedEvent) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || Number(left.skill.requiredLevel ?? 1) - Number(right.skill.requiredLevel ?? 1) || left.skill.id.localeCompare(right.skill.id));
  const granted = [];
  for (const entry of candidates) {
    if (granted.length >= limit) break;
    provisionGrantConditions(state, entry.skill);
    const context = skillContext(state, data);
    if (!evaluateConditions(entry.skill.grantConditions, context)) continue;
    state.player.skills.add(entry.skill.id);
    state.progress.events.grantedSkillIds.add(entry.skill.id);
    granted.push(entry.skill);
    state.history.push({ type: "SKILL_GRANTED", minute: state.absoluteMinute, skillId: entry.skill.id, event: enrichedEvent, providerScore: entry.score });
  }
  state.metrics.eventGrantMatchedCandidates += candidates.length;
  if (!granted.length) state.metrics.eventGrantMisses += 1;
  refreshSkillVisibility(state, data, skills);
  return granted.map((skill) => skill.id);
}

function addExperience(state, amount, source, data, skills, profile) {
  const gain = Math.max(0, Math.round(Number(amount) || 0));
  if (!gain) return;
  state.player.exp += gain;
  state.progress.experience.total += gain;
  const missionId = source.startsWith("mission:") ? source.slice("mission:".length) : null;
  const sourceType = source.startsWith("battle:")
    ? "battle"
    : missionId
      ? state.catalog.byId.get(missionId)?.kind === "special" ? "specialMission" : "permanentMission"
      : "other";
  inc(state.progress, `experience.bySource.${sourceType}`, gain);
  state.history.push({ type: "EXP_GAIN", minute: state.absoluteMinute, amount: gain, source, sourceType });
  while (state.player.level < 24 && state.player.exp >= experienceToNextLevel(state.player.level)) {
    state.player.exp -= experienceToNextLevel(state.player.level);
    state.player.level += 1;
    state.player.sp += 1;
    if (!state.metrics.firstLevelUpDay) state.metrics.firstLevelUpDay = state.day;
    const points = state.player.level % 5 === 0 ? 6 : 4;
    const ratios = profile.id === "fighter" ? [0.55, 0.2, 0.2, 0.05]
      : profile.id === "cautious" ? [0.2, 0.5, 0.2, 0.1]
        : profile.id === "explorer" ? [0.25, 0.15, 0.45, 0.15]
          : [0.35, 0.3, 0.25, 0.1];
    const names = ["attack", "defense", "agility", "luck"];
    let remaining = points;
    names.forEach((name, index) => {
      const value = index === names.length - 1 ? remaining : Math.floor(points * ratios[index]);
      state.player.stats[name] += value;
      remaining -= value;
    });
    state.history.push({ type: "LEVEL_UP", minute: state.absoluteMinute, level: state.player.level });
  }
  autoLearn(state, data, skills, profile);
}

function mission(catalog, id) {
  return catalog.byId?.get(id) ?? [...catalog.permanent, ...catalog.special].find((entry) => entry.id === id);
}

function missionClosedAfterTimeAdvance(state, missionDefinition) {
  if (missionDefinition?.kind !== "special") return null;
  const status = state.troubles[missionDefinition.troubleId]?.status;
  if (["active", "critical"].includes(status)) return null;
  return status === "failed" || status === "suppressed" ? "mission_expired" : "mission_unavailable";
}

function currentStep(missionDefinition, runtime) {
  return missionDefinition.steps?.find((step) => Number(runtime.progress[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function markMissionAttempt(state, missionDefinition, runtime) {
  if (runtime.attemptedAt == null) runtime.attemptedAt = state.absoluteMinute;
  if (missionDefinition.kind === "special") state.progress.missions.attemptedTroubleIds.add(missionDefinition.troubleId);
}

function finishStep(state, missionDefinition, runtime, step, amount = 1) {
  markMissionAttempt(state, missionDefinition, runtime);
  runtime.progress[step.id] = Math.min(Number(step.required ?? 1), Number(runtime.progress[step.id] ?? 0) + amount);
  state.history.push({ type: "MISSION_STEP", minute: state.absoluteMinute, missionId: missionDefinition.id, stepId: step.id, value: runtime.progress[step.id] });
}

function claim(state, missionDefinition, runtime, data, skills, profile) {
  if (runtime.status === "completed") return;
  runtime.status = "completed";
  runtime.completedAt = state.absoluteMinute;
  runtime.rewardClaimed = true;
  inc(state.progress, "missions.totalCompleted");
  state.progress.missions.completedIds.add(missionDefinition.id);
  if (missionDefinition.kind === "special") {
    inc(state.progress, "missions.specialCompleted");
    state.progress.missions.resolvedTroubleIds.add(missionDefinition.troubleId);
    state.progress.events.completedTroubleIds.add(missionDefinition.troubleId);
  } else {
    inc(state.progress, "missions.permanentCompleted");
  }
  addExperience(state, missionDefinition.expReward, `mission:${missionDefinition.id}`, data, skills, profile);
  state.player.gold += Number(missionDefinition.goldReward ?? 0);
  if (missionDefinition.kind === "special") {
    grantEventSkills(state, data, skills, {
      missionId: missionDefinition.id,
      troubleId: missionDefinition.troubleId,
      outcome: "resolved",
      title: missionDefinition.title,
      targetLocations: missionDefinition.targetLocations,
    });
  } else {
    unlockNextPermanentMission(state.catalog, state.missions, missionDefinition);
  }
  state.history.push({ type: "MISSION_COMPLETED", minute: state.absoluteMinute, missionId: missionDefinition.id, exp: missionDefinition.expReward });
}

function updateMissionPeaks(state) {
  const activePermanent = state.catalog.permanent.filter((missionDefinition) => state.missions[missionDefinition.id]?.status === "active").length;
  const activeSpecial = state.catalog.special.filter((missionDefinition) => state.missions[missionDefinition.id]?.status === "active").length;
  state.metrics.maxActivePermanent = Math.max(state.metrics.maxActivePermanent, activePermanent);
  state.metrics.maxActiveSpecial = Math.max(state.metrics.maxActiveSpecial, activeSpecial);
}

function refreshMissions(state, model, catalog, data, skills, profile) {
  for (const missionDefinition of catalog.special) {
    const runtime = state.missions[missionDefinition.id];
    const trouble = state.troubles[missionDefinition.troubleId];
    if (runtime.status === "locked" && ["active", "critical"].includes(trouble.status)) runtime.status = "active";
    if (["failed", "suppressed"].includes(trouble.status) && runtime.status !== "completed") {
      runtime.status = "failed";
      runtime.failedAt ??= state.absoluteMinute;
    }
    if (trouble.status === "resolved" && runtime.status !== "completed") claim(state, missionDefinition, runtime, data, skills, profile);
  }
  for (const missionDefinition of catalog.permanent) {
    const runtime = state.missions[missionDefinition.id];
    if (runtime.status !== "active") continue;
    const check = checkPermanentMission(missionDefinition, state);
    runtime.progress.value = check.actual;
    if (check.complete) claim(state, missionDefinition, runtime, data, skills, profile);
  }
  updateMissionPeaks(state);
}

function build(state, data, situationalMultiplier = 1) {
  const power = Math.max(0.5, Number(state.tuning.soloCombatPowerMultiplier ?? 1) * Number(situationalMultiplier ?? 1));
  return createPlayerBuild(data, {
    id: `journey-${state.profileId}-lv${state.player.level}`,
    level: state.player.level,
    equipmentIds: Object.values(state.player.equipment).filter(Boolean),
    skillIds: [...state.player.skills],
    baseStats: {
      attack: (8 + state.player.level * 3 + state.player.stats.attack) * power,
      defense: (5 + state.player.level * 2.2 + state.player.stats.defense) * power,
      agility: (8 + state.player.level * 1.8 + state.player.stats.agility) * Math.sqrt(power),
      luck: 5 + state.player.level * 0.6 + state.player.stats.luck,
      maxHp: (70 + state.player.level * 18 + state.player.stats.defense * 3) * power,
      maxMp: (25 + state.player.level * 6) * Math.max(1, Math.sqrt(power)),
    },
  });
}

function battleProgress(state, data, result, fullBuild) {
  inc(state.progress, "battles.totalCount");
  const won = result.winner === "players";
  if (won) inc(state.progress, "battles.wins");
  else if (result.winner !== "fled") inc(state.progress, "battles.defeatCount");
  inc(state.progress, `battles.byDaypart.${state.daypart}`);
  if (state.daypart === "night") inc(state.progress, "battles.nightCount");
  inc(state.progress, `battles.byDay.${state.day}`);
  inc(state.progress, `battles.byRegion.${state.player.location}`);
  inc(state.progress, "combat.criticalHits", result.totalCriticals);
  const weapon = fullBuild.equipmentIds.map((id) => data.equipmentById.get(id)).find((item) => item?.slot === "mainHand");
  const weaponPath = { oneHandedSword: "oneHanded", twoHandedSword: "twoHanded", axe: "axe", spear: "spear", bow: "bow", staff: "staff", book: "book" }[weapon?.weaponType];
  if (weaponPath) {
    inc(state.progress, `weapon.${weaponPath}.skillUses`, Object.entries(result.actionUsage).filter(([id]) => id !== "__normal__").reduce((sum, [, count]) => sum + Number(count), 0));
  }
  for (const [id, count] of Object.entries(result.actionUsage)) {
    if (id === "__normal__") continue;
    const skill = data.playerSkillById.get(id);
    if (!skill) continue;
    if (/魔法|魔導|杖|本/u.test(`${skill.category ?? ""}`)) {
      inc(state.progress, "magic.totalCasts", count);
      inc(state.progress, "magic.mpSpent", Number(skill.costs?.mp ?? 0) * count);
    } else inc(state.progress, "combat.physicalSkillUses", count);
    if (skill.debuffs?.length) inc(state.progress, "debuffs.stat.successfulApplications", Math.floor(count * 0.65));
    if (skill.buffs?.length) inc(state.progress, "buffs.successfulApplications", count);
    if (Number(skill.damage?.hits ?? 1) > 1) inc(state.progress, "multiHit.actions", count);
  }
  return won;
}

function rewards(state, data, result, key, skills, profile) {
  let exp = 0;
  let gold = 0;
  let kills = 0;
  result.monsterIds.forEach((id, index) => {
    const monster = data.monsterById.get(id);
    if (!monster) return;
    exp += Number(monster.exp ?? 0) * Number(state.tuning.battleExpMultiplier ?? 1);
    gold += Math.round(Number(monster.goldMin ?? 0) + unit(key, id, index) * (Number(monster.goldMax ?? 0) - Number(monster.goldMin ?? 0)));
    kills += 1;
    inc(state.progress.combat.killsByName, monster.name);
  });
  inc(state.progress, "combat.totalKills", kills);
  inc(state.progress, "combat.physicalKills", kills);
  const mainHand = Object.values(state.player.equipment).map((id) => data.equipmentById.get(id)).find((item) => item?.slot === "mainHand");
  const weaponPath = { oneHandedSword: "oneHanded", twoHandedSword: "twoHanded", axe: "axe", spear: "spear", bow: "bow" }[mainHand?.weaponType];
  if (weaponPath) inc(state.progress, `weapon.${weaponPath}.kills`, kills);
  state.player.gold += gold;
  state.progress.economy.goldFromBattles += gold;
  exp = Math.max(0, Math.round(exp));
  addExperience(state, exp, `battle:${result.encounterId}`, data, skills, profile);
  return { exp, gold, kills };
}

export function prepareJourneyBattle(state, data, encounterId, key, situationalMultiplier = 1) {
  const fullBuild = build(state, data, situationalMultiplier);
  const scaledBuild = {
    ...fullBuild,
    id: `${fullBuild.id}:${state.metrics.battles + 1}`,
    maxHp: Math.max(1, Math.round(fullBuild.maxHp * Math.max(0.18, state.player.hpRatio))),
    maxMp: Math.max(0, Math.round(fullBuild.maxMp * Math.max(0.03, state.player.mpRatio))),
  };
  return { encounterId, key, fullBuild, scaledBuild };
}

export function settleJourneyBattle(state, model, data, skills, profileInput, result, prepared) {
  const profile = typeof profileInput === "string" ? PROFILE.get(profileInput) : profileInput;
  const { encounterId, key, fullBuild, scaledBuild } = prepared;
  state.metrics.battles += 1;
  const actor = result.players[0];
  state.player.hpRatio = Math.max(0, Math.min(1, state.player.hpRatio * actor.hp / Math.max(1, scaledBuild.maxHp)));
  state.player.mpRatio = scaledBuild.maxMp ? Math.max(0, Math.min(1, state.player.mpRatio * actor.mp / scaledBuild.maxMp)) : 0;
  const won = battleProgress(state, data, result, fullBuild);
  const fled = result.winner === "fled";
  let gain = { exp: 0, gold: 0, kills: 0 };
  if (won) {
    state.metrics.wins += 1;
    gain = rewards(state, data, result, key, skills, profile);
  } else if (fled) {
    inc(state.metrics, "escapes");
  } else {
    state.metrics.losses += 1;
    state.player.gold = Math.floor(state.player.gold * 0.9);
    state.player.hpRatio = Math.max(state.player.hpRatio, 0.35);
    state.player.mpRatio = Math.max(state.player.mpRatio, 0.2);
    advance(state, model, state.tuning.defeatRecoveryMinutes ?? 360, "defeat-recovery");
  }
  state.history.push({ type: fled ? "BATTLE_FLED" : "BATTLE_RESOLVED", minute: state.absoluteMinute, encounterId, winner: result.winner, rewards: gain });
  return { ...result, won, fled, rewards: gain };
}

function runBattle(state, model, data, skills, profile, encounterId, key, situationalMultiplier = 1) {
  const prepared = prepareJourneyBattle(state, data, encounterId, key, situationalMultiplier);
  const result = simulateBattle({
    data,
    encounterId,
    playerBuild: prepared.scaledBuild,
    seed: key,
    maxTurns: 100,
    captureTimeline: state.tuning.captureBattleTimeline === true,
  });
  return settleJourneyBattle(state, model, data, skills, profile, result, prepared);
}

function compact(state) {
  return {
    minute: state.absoluteMinute,
    player: {
      location: state.player.location,
      facilityId: state.player.facilityId,
      level: state.player.level,
      exp: state.player.exp,
      gold: state.player.gold,
      hp: Number(state.player.hpRatio.toFixed(4)),
      mp: Number(state.player.mpRatio.toFixed(4)),
      equipment: state.player.equipment,
      skills: [...state.player.skills].sort(),
      rumors: [...state.player.knownRumorIds].sort(),
      evidence: state.player.evidenceByTrouble,
      reputation: state.player.reputation,
    },
    progress: {
      missions: {
        totalCompleted: state.progress.missions.totalCompleted,
        permanentCompleted: state.progress.missions.permanentCompleted,
        specialCompleted: state.progress.missions.specialCompleted,
        completedIds: [...state.progress.missions.completedIds].sort(),
      },
      travel: {
        actions: state.progress.travel.actions,
        localActions: state.progress.travel.localActions,
        regionalActions: state.progress.travel.regionalActions,
        visitedHubs: [...state.progress.travel.visitedHubs].sort(),
        visitedFacilities: [...state.progress.travel.visitedFacilities].sort(),
      },
      walk: state.progress.walkMinutes,
      battles: state.progress.battles,
      combat: state.progress.combat,
      economy: state.progress.economy,
      investigation: state.progress.investigation,
      social: state.progress.social,
      rumors: state.progress.rumors,
      experience: state.progress.experience,
    },
    worldFlags: state.worldFlags,
    troubles: Object.fromEntries(Object.entries(state.troubles).map(([id, runtime]) => [id, runtime.status])),
    missions: Object.fromEntries(Object.entries(state.missions).map(([id, runtime]) => [id, {
      status: runtime.status,
      progress: runtime.progress,
      ...(Array.isArray(runtime.discoveries) && runtime.discoveries.length
        ? { discoveries: runtime.discoveries.map((discovery) => ({ ...discovery })) }
        : {}),
    }])),
  };
}

export const stateFingerprint = (state) => hash(compact(state));

function playerKnowsSpecialMission(state, missionDefinition) {
  if (state.tuning?.requireKnownSpecialMissions !== true) return true;
  const troubleId = missionDefinition.troubleId;
  if (state.progress.missions.attemptedTroubleIds.has(troubleId)
    || state.progress.missions.resolvedTroubleIds.has(troubleId)
    || state.progress.missions.completedIds.has(missionDefinition.id)) return true;
  return state.rumors.some((rumor) => rumor.troubleId === troubleId
    && state.player.knownRumorIds.has(rumor.id));
}

const T01_SEARCH_APPROACHES = Object.freeze({
  0: Object.freeze([
    Object.freeze({
      approachId: "tracks",
      minutes: 24,
      label: "小さな靴跡を選び、折れた草の向きへたどる",
      discoveryId: "T01-CLUE-BOOT-TRACKS",
      discoveryText: "子どもの小さな靴跡は村へ戻らず、折れた草の列に沿って古い見張り小屋へ続いている。",
    }),
    Object.freeze({
      approachId: "claw-marks",
      minutes: 31,
      label: "爪痕の深さと向きを調べ、獣が追った経路を読む",
      discoveryId: "T01-CLUE-WOLF-PURSUIT",
      discoveryText: "赤牙狼の爪痕は靴跡の後ろから現れ、途中で横へ回り込んでいる。獣は少年を獲物として追っていた。",
    }),
    Object.freeze({
      approachId: "jacket-thread",
      minutes: 38,
      label: "枝に絡んだ青い糸を手掛かりに、崩れた斜面を探す",
      discoveryId: "T01-CLUE-JACKET-THREAD",
      discoveryText: "道端の枝に子どもの上着と同じ青い糸が残り、その先の足跡だけが見張り小屋裏の崩れた斜面へそれている。",
    }),
  ]),
  1: Object.freeze([
    Object.freeze({
      approachId: "dropped-map",
      minutes: 27,
      label: "泥に落ちた古い地図を拾い、見張り小屋の裏道と照合する",
      discoveryId: "T01-CLUE-DROPPED-MAP",
      discoveryText: "泥の中からフィンが持ち出した古い地図を見つけた。書き込みは見張り小屋の裏から斜面下へ抜ける道を示している。",
    }),
    Object.freeze({
      approachId: "faint-voice",
      minutes: 34,
      label: "風が止むのを待ち、斜面の下から聞こえる声を探す",
      discoveryId: "T01-CLUE-FAINT-VOICE",
      discoveryText: "風の切れ間に、斜面の下から子どもの弱い呼び声が届いた。フィンはまだ生きているが、声の近くで獣が唸っている。",
    }),
    Object.freeze({
      approachId: "wolf-blockade",
      minutes: 41,
      label: "風下へ回り、赤牙狼が塞いでいる退路を突き止める",
      discoveryId: "T01-CLUE-WOLF-BLOCKADE",
      discoveryText: "風下から見張り小屋裏を確かめると、赤牙狼が斜面の出口を塞いでいた。少年を救うには、まずこの獣を退ける必要がある。",
    }),
  ]),
});

function t01SearchActions(base, runtime, step) {
  const stage = Math.max(0, Math.floor(Number(runtime.progress[step.id] ?? 0)));
  const approaches = T01_SEARCH_APPROACHES[stage] ?? [];
  return approaches.map((approach) => ({
    ...base,
    id: `ACTION:MSN-T01:search:${approach.approachId}`,
    type: "investigate",
    minutes: approach.minutes,
    label: approach.label,
    investigationStage: stage,
    approachId: approach.approachId,
    discoveryId: approach.discoveryId,
    discoveryText: approach.discoveryText,
  }));
}

function missionActions(state, catalog) {
  const result = [];
  for (const missionDefinition of catalog.special) {
    const runtime = state.missions[missionDefinition.id];
    if (runtime.status !== "active") continue;
    if (!playerKnowsSpecialMission(state, missionDefinition)) continue;
    const step = currentStep(missionDefinition, runtime);
    if (!step) continue;
    const location = step.targetLocation ?? missionDefinition.targetLocations[0];
    if (location && location !== state.player.location) continue;
    if (step.targetFacilityId && step.targetFacilityId !== state.player.facilityId) continue;
    const base = {
      missionId: missionDefinition.id,
      stepId: step.id,
      difficulty: missionDefinition.difficulty,
      finalDay: missionDefinition.finalDay,
      id: `ACTION:${missionDefinition.id}:${step.id}`,
      minutes: step.type === "conversation" ? 9 + missionDefinition.difficulty * 2
        : step.type === "investigate" ? 22 + missionDefinition.difficulty * 5
          : step.type === "battle" ? 25
            : 18,
    };
    if (missionDefinition.id === "MSN-T01" && step.id === "search" && step.type === "investigate") {
      result.push(...t01SearchActions(base, runtime, step));
      continue;
    }
    result.push({
      ...base,
      type: step.type === "battle" ? "missionBattle" : step.type === "resolve" ? "resolveMission" : step.type,
      encounterId: step.encounterId,
      label: step.label,
    });
  }
  return result;
}

function localTalk(state, model, profile) {
  const dailyLimit = Number(state.tuning.maxConversationsPerDay ?? 4) + (profile.story >= 0.8 ? 2 : 0);
  if (Number(state.progress.social.byDay[state.day] ?? 0) >= dailyLimit) return null;
  const authoritativeIds = state.authoritativePresentNpcIds instanceof Set
    ? state.authoritativePresentNpcIds
    : Array.isArray(state.authoritativePresentNpcIds)
      ? new Set(state.authoritativePresentNpcIds)
      : null;
  const list = model.npcs.filter((npc) => (authoritativeIds
    ? authoritativeIds.has(npc.id)
    : npcHub(npc, state.day) === state.player.location && npcFacility(npc, state.day) === state.player.facilityId)
    && state.absoluteMinute >= Number(state.conversationAvailability[npc.id] ?? 0)
    && !/死亡/u.test(npc.initialStatus));
  if (!list.length) return null;
  const npc = list[Math.floor(unit(state.seed, state.absoluteMinute, state.player.location, state.player.facilityId) * list.length)];
  return {
    id: `TALK:${npc.id}`,
    type: "conversation",
    targetNpcId: npc.id,
    targetNpcName: npc.name,
    minutes: 8 + Math.floor(unit(npc.id, state.day) * 8),
    label: `${npc.name}に話を聞く`,
  };
}

function wildBattleAvailable(state, profile) {
  const dayCount = Number(state.progress.battles.byDay[state.day] ?? 0);
  const dailyLimit = Number(state.tuning.maxWildBattlesPerDay ?? 2) + (profile.id === "fighter" ? 1 : 0);
  const nextMinute = Number(state.encounterAvailability[state.player.location] ?? 0);
  return dayCount < dailyLimit && state.absoluteMinute >= nextMinute;
}

function utility(action, state, profile) {
  let score = unit(state.seed, state.absoluteMinute, action.id) * 0.2;
  if (["conversation", "investigate", "missionBattle", "resolveMission"].includes(action.type)) {
    const urgency = action.finalDay ? Math.max(0, 12 - (action.finalDay - state.day)) : 0;
    score += profile.story * 12 + Number(action.difficulty ?? 1) + urgency;
  }
  if (["seekBattle", "missionBattle"].includes(action.type)) score += profile.combat * 8;
  if (action.type === "seekBattle") {
    const dayCount = Number(state.progress.battles.byDay[state.day] ?? 0);
    score -= dayCount * 5;
  }
  if (action.type === "work") score += profile.trade * 7 + (state.player.gold < 20 ? 6 : 0);
  if (action.type === "rest") {
    score += profile.caution * 8 + (1 - state.player.hpRatio) * 12 + (1 - state.player.mpRatio) * 4;
    if (state.player.hpRatio < 0.6) score += 32;
    if (state.player.mpRatio < 0.25) score += 10;
  }
  if (action.type === "observe") score += profile.explore * 4;
  return score;
}

export function generateChoiceActions(state, model, data, catalog, profile = PROFILE.get(state.profileId), options = {}) {
  const candidates = missionActions(state, catalog);
  const talk = localTalk(state, model, profile);
  if (talk) candidates.push(talk);
  if (wildBattleAvailable(state, profile) && encounters(state, data, profile).length) {
    candidates.push({ id: "SEEK_BATTLE", type: "seekBattle", minutes: 90, label: `${state.player.location}周辺で魔物を探す` });
  }
  if (state.player.hpRatio < 0.82 || state.player.mpRatio < 0.55 || state.hour >= 22) {
    candidates.push({ id: "REST", type: "rest", minutes: state.hour >= 20 ? 480 : 120, label: "休息して回復する" });
  }
  if (state.player.gold < (state.tuning.workGoldThreshold ?? 30)) candidates.push({ id: "WORK", type: "work", minutes: 120, label: "仕事をして路銀を得る" });
  candidates.push({ id: "OBSERVE", type: "observe", minutes: 45, label: "周囲の噂と変化を確かめる" });
  const eligibleCandidates = typeof options.candidateFilter === "function"
    ? candidates.filter((action) => options.candidateFilter(action) !== false)
    : candidates;
  const limit = Math.max(1, Math.min(12, Number(options.limit ?? 3) || 3));
  const fillTo = Math.max(0, Math.min(limit, Number(options.fillTo ?? 3) || 0));
  const result = [...new Map(eligibleCandidates.map((action) => [action.id, action])).values()]
    .sort((left, right) => utility(right, state, profile) - utility(left, state, profile) || left.id.localeCompare(right.id))
    .slice(0, limit)
    .map((action, index) => ({ ...action, choiceId: `CHOICE-${index + 1}` }));
  while (result.length < fillTo) {
    result.push({ id: `WAIT-${result.length + 1}`, type: "observe", minutes: 45, label: "少し待つ", choiceId: `CHOICE-${result.length + 1}` });
  }
  return result;
}

function objectiveMovementAction(state, model, catalog, profile) {
  const movement = availableMovementActions(state, model);
  const active = catalog.special
    .map((missionDefinition) => ({ mission: missionDefinition, runtime: state.missions[missionDefinition.id] }))
    .filter((entry) => entry.runtime.status === "active" && playerKnowsSpecialMission(state, entry.mission))
    .map((entry) => ({ ...entry, step: currentStep(entry.mission, entry.runtime) }))
    .filter((entry) => entry.step)
    .sort((left, right) => left.mission.finalDay - right.mission.finalDay || right.mission.difficulty - left.mission.difficulty);
  if (active.length && profile.story >= 0.55) {
    const step = active[0].step;
    const targetHub = step.targetLocation ?? active[0].mission.targetLocations[0];
    if (targetHub !== state.player.location) return movement.find((action) => action.movementScope === "regional" && action.destinationHub === targetHub) ?? null;
    if (step.targetFacilityId && step.targetFacilityId !== state.player.facilityId) {
      return movement.find((action) => action.movementScope === "local" && action.destinationFacilityId === step.targetFacilityId) ?? null;
    }
  }
  if (profile.id === "explorer") {
    const local = movement.find((action) => action.movementScope === "local" && !state.progress.travel.visitedFacilities.has(action.destinationFacilityId));
    if (local) return local;
    const regional = movement
      .filter((action) => action.movementScope === "regional" && !state.progress.travel.visitedHubs.has(action.destinationHub))
      .sort((left, right) => left.minutes - right.minutes)[0];
    if (regional) return regional;
  }
  if (profile.id === "merchant" && state.player.gold >= 20) {
    const unvisitedSeller = [...new Set(state.battleData.inventory
      .filter((entry) => entry.location === state.player.location && entry.sellerId)
      .map((entry) => entry.sellerId))]
      .find((sellerId) => !state.progress.travel.visitedFacilities.has(sellerId));
    if (unvisitedSeller) return movement.find((action) => action.movementScope === "local" && action.destinationFacilityId === unvisitedSeller) ?? null;
    const destination = [...new Set(state.battleData.inventory.map((entry) => entry.location))]
      .filter((hub) => hub !== state.player.location && !state.progress.travel.visitedHubs.has(hub))
      .map((hub) => movement.find((action) => action.movementScope === "regional" && action.destinationHub === hub))
      .filter(Boolean)
      .sort((left, right) => left.minutes - right.minutes)[0];
    if (destination) return destination;
  }
  return null;
}

function choose(state, actions, profile) {
  if (profile.id === "random") return actions[Math.floor(unit(state.seed, state.absoluteMinute, state.metrics.actions, "choice") * actions.length)];
  return [...actions].sort((left, right) => utility(right, state, profile) - utility(left, state, profile) || left.id.localeCompare(right.id))[0];
}

function selectEncounter(state, data, profile, key) {
  const candidates = encounters(state, data, profile);
  const limit = dangerLimit(state, profile);
  const safeTier = Math.max(1, Math.min(limit, 1 + Math.floor((state.player.level - 1) / 4)));
  const targetTier = profile.id === "fighter" ? limit : profile.id === "cautious" ? Math.max(1, safeTier - 1) : safeTier;
  return weighted(candidates, key, (encounter) => {
    const tier = Number(encounter.dangerTier ?? 1);
    const distance = Math.abs(tier - targetTier);
    const base = Number(encounter.baseWeight || 1);
    if (profile.id === "fighter") return base * (1 + tier * 0.2);
    if (profile.caution > profile.combat) return base / (1 + distance * 1.5 + Math.max(0, tier - targetTier) * 0.5);
    return base / (1 + distance);
  });
}

function travelEncounter(state, model, data, skills, profile, action) {
  if (state.tuning.disableTravelEncounters) return null;
  const chance = (state.tuning.travelEncounterBaseChance ?? 0.12) * Math.min(1.5, action.minutes / 180);
  if (unit(state.seed, "travel", state.metrics.regionalMoves, state.metrics.battles) >= chance) return null;
  const encounter = selectEncounter(state, data, profile, `${state.seed}:travel:${state.metrics.regionalMoves}`);
  return encounter ? runBattle(state, model, data, skills, profile, encounter.id, `${state.seed}:travel:${state.metrics.regionalMoves}:${encounter.id}:${state.metrics.battles}`) : null;
}

export function resolveMovementAction(state, model, data, skills, profileInput, action) {
  const profile = typeof profileInput === "string" ? PROFILE.get(profileInput) : profileInput;
  if (!action || action.type !== "move") return { ok: false, reason: "not_movement" };
  const fromHub = state.player.location;
  const fromFacilityId = state.player.facilityId;
  if (action.movementScope === "local") {
    const facility = model.facilityById[action.destinationFacilityId];
    if (!facility || facility.hub !== state.player.location) return { ok: false, reason: "invalid_local_destination" };
    advance(state, model, action.minutes, `local-move:${fromFacilityId}->${facility.id}`);
    state.player.facilityId = facility.id;
    inc(state.progress, "travel.actions");
    inc(state.progress, "travel.localActions");
    inc(state.progress, "walkMinutes.total", action.minutes);
    state.progress.travel.visitedFacilities.add(facility.id);
    state.progress.facilities.visitedIds.add(facility.id);
    state.metrics.localMoves += 1;
    state.history.push({ type: "LOCAL_MOVE_COMPLETED", minute: state.absoluteMinute, hub: state.player.location, fromFacilityId, toFacilityId: facility.id });
    refreshMissions(state, model, state.catalog, data, skills, profile);
    return { ok: true, type: "move", movementScope: "local" };
  }
  if (action.movementScope !== "regional") return { ok: false, reason: "unknown_movement_scope" };
  const currentPlan = shortestTravelPlan(model, state, state.player.location, action.destinationHub);
  if (!currentPlan) return { ok: false, reason: "unreachable_destination" };
  const battle = travelEncounter(state, model, data, skills, profile, action);
  if (battle && !battle.won && profile.caution > 0.5) {
    const setbackMinutes = Math.max(30, Number(action.minutes ?? 0));
    advance(state, model, setbackMinutes, `regional-move-defeat:${fromHub}->${action.destinationHub}`);
    inc(state.progress, "travel.actions");
    inc(state.progress, "walkMinutes.total", setbackMinutes);
    state.history.push({
      type: "REGIONAL_MOVE_INTERRUPTED",
      minute: state.absoluteMinute,
      from: fromHub,
      intendedDestination: action.destinationHub,
      reason: "travel_defeat",
      encounterId: battle.encounterId ?? battle.encounter?.id ?? null,
    });
    refreshMissions(state, model, state.catalog, data, skills, profile);
    return { ok: false, committed: true, reason: "travel_defeat", type: "move", movementScope: "regional", battle };
  }
  advance(state, model, action.minutes, `regional-move:${fromHub}->${action.destinationHub}`);
  state.player.location = action.destinationHub;
  const arrival = action.destinationFacilityId ? model.facilityById[action.destinationFacilityId] : preferredArrivalFacility(model, action.destinationHub);
  state.player.facilityId = arrival?.id ?? null;
  state.progress.travel.visitedHubs.add(action.destinationHub);
  if (state.player.facilityId) {
    state.progress.travel.visitedFacilities.add(state.player.facilityId);
    state.progress.facilities.visitedIds.add(state.player.facilityId);
  }
  inc(state.progress, "travel.actions");
  inc(state.progress, "travel.regionalActions");
  inc(state.progress, "walkMinutes.total", action.minutes);
  for (const tag of routeTags(model, action.routeIds ?? currentPlan.routeIds)) inc(state.progress, `walkMinutes.byTag.${tag}`, action.minutes);
  state.metrics.regionalMoves += 1;
  state.history.push({ type: "REGIONAL_MOVE_COMPLETED", minute: state.absoluteMinute, from: fromHub, to: action.destinationHub, facilityId: state.player.facilityId });
  refreshMissions(state, model, state.catalog, data, skills, profile);
  return { ok: true, type: "move", movementScope: "regional", battle };
}

/**
 * Advances a deliberate battle action to the point where a player command is
 * required. The returned continuation is serializable and is settled only
 * after the interactive battle engine reports a final winner.
 */
export function beginInteractiveBattleAction(state, model, data, skills, catalog, profileInput, action) {
  const profile = typeof profileInput === "string" ? PROFILE.get(profileInput) : profileInput;
  if (!action || !["missionBattle", "seekBattle"].includes(action.type)) {
    return { ok: false, reason: "not_interactive_battle_action" };
  }
  const preHash = stateFingerprint(state);
  const missionDefinition = action.missionId ? mission(catalog, action.missionId) : null;
  const missionRuntime = missionDefinition ? state.missions[missionDefinition.id] : null;
  const step = missionDefinition ? missionDefinition.steps.find((entry) => entry.id === action.stepId) : null;
  let encounterId = null;
  let key = null;
  let situationalMultiplier = 1;

  if (action.type === "missionBattle") {
    advance(state, model, action.minutes, `mission-battle:${action.missionId}`);
    const closedReason = missionClosedAfterTimeAdvance(state, missionDefinition);
    encounterId = closedReason ? null : action.encounterId
      ?? weighted(encounters(state, data, profile, { eventOnly: true }), `${state.seed}:${action.id}`)?.id;
    if (closedReason) return { ok: false, committed: true, type: action.type, reason: closedReason };
    if (!encounterId) return { ok: false, committed: true, type: action.type, reason: "no_encounter" };
    const evidence = Number(state.player.evidenceByTrouble[missionDefinition.troubleId] ?? 0);
    const preparation = Math.min(
      Number(state.tuning.missionPreparationBonusMax ?? 0.75),
      evidence * Number(state.tuning.missionPreparationBonusPerEvidence ?? 0.16),
    );
    situationalMultiplier = 1 + preparation;
    key = `${state.seed}:mission:${action.missionId}:${state.metrics.battles}`;
  } else {
    advance(state, model, action.minutes, "seek-battle");
    const encounter = selectEncounter(state, data, profile, `${state.seed}:seek:${state.metrics.actions}:${state.player.location}`);
    if (!encounter) return { ok: false, committed: true, type: action.type, reason: "no_encounter" };
    encounterId = encounter.id;
    key = `${state.seed}:seek:${state.metrics.battles}:${encounterId}`;
    const baseCooldown = Number(state.tuning.wildEncounterCooldownMinutes ?? 540);
    const profileFactor = profile.id === "fighter" ? 0.7 : profile.id === "cautious" ? 1.2 : 1;
    state.encounterAvailability[state.player.location] = state.absoluteMinute + Math.round(baseCooldown * profileFactor);
  }

  return {
    ok: true,
    type: action.type,
    continuation: {
      version: 1,
      action: {
        id: action.id,
        type: action.type,
        missionId: action.missionId ?? null,
        stepId: action.stepId ?? null,
      },
      encounterId,
      key,
      preHash,
      prepared: prepareJourneyBattle(state, data, encounterId, key, situationalMultiplier),
      mission: missionDefinition ? { id: missionDefinition.id, stepId: step?.id ?? null } : null,
    },
  };
}

export function settleInteractiveBattleAction(state, model, data, skills, catalog, profileInput, continuation, battleResult) {
  const profile = typeof profileInput === "string" ? PROFILE.get(profileInput) : profileInput;
  if (!continuation?.prepared || !battleResult) return { ok: false, reason: "interactive_battle_result_missing" };
  const battle = settleJourneyBattle(state, model, data, skills, profile, battleResult, continuation.prepared);
  const action = continuation.action;
  if (action.type === "missionBattle" && battle.won && continuation.mission) {
    const definition = mission(catalog, continuation.mission.id);
    const missionRuntime = state.missions[definition.id];
    const step = definition.steps.find((entry) => entry.id === continuation.mission.stepId);
    if (step) finishStep(state, definition, missionRuntime, step);
  }
  const postHash = stateFingerprint(state);
  const replayKey = hash({ preHash: continuation.preHash, actionId: action.id });
  state.replayResults[replayKey] = hash({
    actionId: action.id,
    outcome: { type: action.type, ok: true, winner: battle.winner },
    postHash,
  });
  state.history.push({
    type: "PLAYER_ACTION_RESOLVED",
    minute: state.absoluteMinute,
    actionId: action.id,
    replayKey,
    preHash: continuation.preHash,
    postHash,
  });
  autoLearn(state, data, skills, profile);
  refreshMissions(state, model, catalog, data, skills, profile);
  return { ok: true, type: action.type, battle };
}

function finalizeResolvedPlayerAction(state, model, data, skills, catalog, profile, action, output, preHash, replayKey) {
  const postHash = stateFingerprint(state);
  const resultHash = hash({ actionId: action.id, outcome: { type: output.type, ok: output.ok, reason: output.reason }, postHash });
  if (state.replayResults[replayKey] && state.replayResults[replayKey] !== resultHash && !["seekBattle", "missionBattle", "investigate"].includes(action.type)) {
    state.metrics.replayMismatches += 1;
  }
  state.replayResults[replayKey] = resultHash;
  state.history.push({ type: "PLAYER_ACTION_RESOLVED", minute: state.absoluteMinute, actionId: action.id, replayKey, preHash, postHash });
  autoLearn(state, data, skills, profile);
  refreshMissions(state, model, catalog, data, skills, profile);
  return output;
}

export function settleMissionConversationAction(state, model, data, skills, catalog, profileInput, action, pendingResult) {
  const profile = typeof profileInput === "string" ? PROFILE.get(profileInput) : profileInput;
  const continuation = pendingResult?.missionConversationContinuation;
  if (!pendingResult?.missionConversationPending
    || !continuation
    || continuation.actionId !== action?.id
    || continuation.missionId !== action?.missionId
    || continuation.stepId !== action?.stepId) {
    throw new Error("Invalid deferred mission conversation continuation");
  }
  const missionDefinition = mission(catalog, continuation.missionId);
  const runtime = state.missions[missionDefinition.id];
  const step = missionDefinition.steps.find((entry) => entry.id === continuation.stepId);
  if (!runtime || !step) throw new Error("Deferred mission conversation no longer exists");

  const completed = Boolean(action.targetNpcId && String(action.requiredDisclosure ?? "").trim());
  const output = {
    ok: true,
    type: "conversation",
    missionConversationCompleted: completed,
    summary: completed
      ? `${action.speakerLabelBeforeIntroduction ?? action.targetNpcName ?? "その人物"}から「${missionDefinition.title}」の手掛かりを聞いた。`
      : "話を聞き終える前に相手がその場を離れ、ミッションの手掛かりはまだ得られなかった。",
  };
  if (completed) {
    finishStep(state, missionDefinition, runtime, step);
    publishRumor(state, model, {
      id: `RUM-PLAYER-${missionDefinition.troubleId}-HEARD`,
      troubleId: missionDefinition.troubleId,
      text: `${missionDefinition.title}の手掛かりを得た`,
    });
    inc(state.player.reputation, state.player.location, 2);
  }
  return finalizeResolvedPlayerAction(
    state,
    model,
    data,
    skills,
    catalog,
    profile,
    action,
    output,
    continuation.preHash,
    continuation.replayKey,
  );
}

export function resolvePlayerAction(state, model, data, skills, catalog, profileInput, action) {
  const profile = typeof profileInput === "string" ? PROFILE.get(profileInput) : profileInput;
  const preHash = stateFingerprint(state);
  const replayKey = hash({ preHash, actionId: action.id });
  let output = { ok: true, type: action.type };
  const missionDefinition = action.missionId ? mission(catalog, action.missionId) : null;
  const runtime = missionDefinition ? state.missions[missionDefinition.id] : null;
  const step = missionDefinition ? missionDefinition.steps.find((entry) => entry.id === action.stepId) : null;
  const deferredMissionConversation = Boolean(
    missionDefinition
    && step
    && action.type === "conversation"
    && action.deferMissionConversationCompletion === true,
  );

  if (action.type === "conversation") {
    advance(state, model, action.minutes, `conversation:${action.targetNpcId ?? action.missionId ?? "local"}`);
    inc(state.progress, "social.conversations");
    inc(state.progress, `social.byDay.${state.day}`);
    if (action.targetNpcId) state.conversationAvailability[action.targetNpcId] = state.absoluteMinute + Number(state.tuning.conversationCooldownMinutes ?? 720);
    const closedReason = missionClosedAfterTimeAdvance(state, missionDefinition);
    if (closedReason) output = { ok: false, committed: true, type: action.type, reason: closedReason };
    else if (step && !deferredMissionConversation) finishStep(state, missionDefinition, runtime, step);
    if (missionDefinition && !closedReason && !deferredMissionConversation) {
      publishRumor(state, model, { id: `RUM-PLAYER-${missionDefinition.troubleId}-HEARD`, troubleId: missionDefinition.troubleId, text: `${missionDefinition.title}の情報を得た` });
      inc(state.player.reputation, state.player.location, 2);
    } else if (!missionDefinition) inc(state.player.reputation, state.player.location, 1);
    if (deferredMissionConversation && !closedReason) {
      return {
        ...output,
        missionConversationPending: true,
        missionConversationContinuation: {
          preHash,
          replayKey,
          actionId: action.id,
          missionId: missionDefinition.id,
          stepId: step.id,
        },
      };
    }
  } else if (action.type === "investigate") {
    advance(state, model, action.minutes, `investigate:${action.missionId}`);
    const closedReason = missionClosedAfterTimeAdvance(state, missionDefinition);
    if (closedReason) output = { ok: false, committed: true, type: action.type, reason: closedReason };
    else if (step) {
      if (action.discoveryId && action.discoveryText) {
        runtime.discoveries ??= [];
        const existing = runtime.discoveries.find((entry) => entry.id === action.discoveryId);
        const discovery = existing ?? {
          id: action.discoveryId,
          text: action.discoveryText,
          missionId: missionDefinition.id,
          stepId: step.id,
          stage: Math.max(0, Math.floor(Number(action.investigationStage ?? runtime.progress[step.id] ?? 0))),
          approachId: action.approachId ?? null,
          actionId: action.id,
          discoveredAtMinute: state.absoluteMinute,
        };
        if (!existing) {
          runtime.discoveries.push(discovery);
          state.history.push({
            type: "MISSION_DISCOVERY",
            minute: state.absoluteMinute,
            missionId: missionDefinition.id,
            stepId: step.id,
            discoveryId: discovery.id,
            discoveryText: discovery.text,
            actionId: action.id,
            stage: discovery.stage,
          });
        }
        output.discovery = { ...discovery };
        output.summary = discovery.text;
      }
      finishStep(state, missionDefinition, runtime, step);
      inc(state.player.evidenceByTrouble, missionDefinition.troubleId);
      inc(state.progress, "investigation.total");
      const chance = 0.04 + missionDefinition.difficulty * 0.015;
      if (!state.tuning.probeMode && unit(state.seed, action.id, state.metrics.actions) < chance) {
        const encounter = selectEncounter(state, data, profile, `${state.seed}:investigate:${action.id}:${state.metrics.actions}`);
        if (encounter) output.battle = runBattle(state, model, data, skills, profile, encounter.id, `${state.seed}:investigate:${state.metrics.battles}:${encounter.id}`);
      }
    }
  } else if (action.type === "missionBattle") {
    advance(state, model, action.minutes, `mission-battle:${action.missionId}`);
    const closedReason = missionClosedAfterTimeAdvance(state, missionDefinition);
    const encounterId = closedReason ? null : action.encounterId ?? weighted(encounters(state, data, profile, { eventOnly: true }), `${state.seed}:${action.id}`)?.id;
    if (closedReason) output = { ok: false, committed: true, type: action.type, reason: closedReason };
    else if (!encounterId) output = { ok: false, committed: true, type: action.type, reason: "no_encounter" };
    else {
      const evidence = Number(state.player.evidenceByTrouble[missionDefinition.troubleId] ?? 0);
      const preparation = Math.min(Number(state.tuning.missionPreparationBonusMax ?? 0.75), evidence * Number(state.tuning.missionPreparationBonusPerEvidence ?? 0.16));
      const probe = state.tuning.probeMode ? Number(state.tuning.probeMissionPowerMultiplier ?? 10) : 1;
      output.battle = runBattle(state, model, data, skills, profile, encounterId, `${state.seed}:mission:${action.missionId}:${state.metrics.battles}`, (1 + preparation) * probe);
      if (output.battle.won && step) finishStep(state, missionDefinition, runtime, step);
    }
  } else if (action.type === "resolveMission") {
    advance(state, model, action.minutes, `resolve:${action.missionId}`);
    const closedReason = missionClosedAfterTimeAdvance(state, missionDefinition);
    const incomplete = !closedReason && missionDefinition.steps.filter((entry) => entry.id !== step.id)
      .some((entry) => Number(runtime.progress[entry.id] ?? 0) < Number(entry.required ?? 1));
    if (closedReason) output = { ok: false, committed: true, type: action.type, reason: closedReason };
    else if (incomplete) output = { ok: false, committed: true, type: action.type, reason: "incomplete" };
    else {
      finishStep(state, missionDefinition, runtime, step);
      transition(state, model, missionDefinition.troubleId, "resolved", "player-mission-resolution");
      claim(state, missionDefinition, runtime, data, skills, profile);
      inc(state.player.reputation, state.player.location, 8 + missionDefinition.difficulty);
    }
  } else if (action.type === "seekBattle") {
    advance(state, model, action.minutes, "seek-battle");
    const encounter = selectEncounter(state, data, profile, `${state.seed}:seek:${state.metrics.actions}:${state.player.location}`);
    if (!encounter) output = { ok: false, committed: true, type: action.type, reason: "no_encounter" };
    else output.battle = runBattle(state, model, data, skills, profile, encounter.id, `${state.seed}:seek:${state.metrics.battles}:${encounter.id}`);
    const baseCooldown = Number(state.tuning.wildEncounterCooldownMinutes ?? 540);
    const profileFactor = profile.id === "fighter" ? 0.7 : profile.id === "cautious" ? 1.2 : 1;
    state.encounterAvailability[state.player.location] = state.absoluteMinute + Math.round(baseCooldown * profileFactor);
  } else if (action.type === "rest") {
    const price = state.player.freeLodging > 0 ? 0 : (state.tuning.restPrice ?? 4);
    if (price > state.player.gold) {
      advance(state, model, Math.min(action.minutes, 180), "outdoor-rest");
      state.player.hpRatio = Math.min(1, state.player.hpRatio + 0.25);
      state.player.mpRatio = Math.min(1, state.player.mpRatio + 0.18);
    } else {
      if (price) state.player.gold -= price;
      else state.player.freeLodging -= 1;
      advance(state, model, action.minutes, "inn-rest");
      state.player.hpRatio = 1;
      state.player.mpRatio = 1;
    }
  } else if (action.type === "work") {
    advance(state, model, action.minutes, "odd-job");
    const quotedWage = Number(action.wage);
    const wage = Number.isFinite(quotedWage) && quotedWage >= 0
      ? Math.floor(quotedWage)
      : 5 + Math.floor(unit(state.seed, state.absoluteMinute, state.player.location, "wage") * 8);
    state.player.gold += wage;
    state.progress.economy.goldFromWork += wage;
  } else if (action.type === "localInvestigate") {
    advance(state, model, action.minutes ?? 45, `local-investigate:${state.player.facilityId ?? state.player.location}`);
    inc(state.progress, "investigation.total");
  } else {
    advance(state, model, action.minutes ?? 45, "observe");
  }

  return finalizeResolvedPlayerAction(state, model, data, skills, catalog, profile, action, output, preHash, replayKey);
}

function progress() {
  return {
    experience: { total: 0, bySource: { battle: 0, permanentMission: 0, specialMission: 0, other: 0 } },
    missions: {
      totalCompleted: 0,
      permanentCompleted: 0,
      specialCompleted: 0,
      completedIds: new Set(),
      attemptedTroubleIds: new Set(),
      resolvedTroubleIds: new Set(),
    },
    travel: { actions: 0, localActions: 0, regionalActions: 0, visitedHubs: new Set(["田園の村"]), visitedFacilities: new Set() },
    facilities: { visitedIds: new Set() },
    walkMinutes: { total: 0, byTag: {} },
    battles: { totalCount: 0, wins: 0, defeatCount: 0, nightCount: 0, byDaypart: { dawn: 0, day: 0, dusk: 0, night: 0 }, byDay: {}, byRegion: {} },
    combat: { totalKills: 0, physicalKills: 0, physicalSkillUses: 0, criticalHits: 0, killsByName: {} },
    economy: { goldSpent: 0, maxSinglePurchase: 0, goldEarnedFromSales: 0, goldFromBattles: 0, goldFromWork: 0, orphanageDonations: 0 },
    investigation: { total: 0, appraisals: 0 },
    social: { conversations: 0, byDay: {} },
    rumors: { npcRecipients: 0, npcReplans: 0, playerRecipients: 0, playerReplans: 0 },
    weapon: { oneHanded: {}, twoHanded: {}, axe: {}, spear: {}, bow: {}, staff: {}, book: {} },
    magic: { totalCasts: 0, mpSpent: 0 },
    debuffs: { stat: { successfulApplications: 0 } },
    buffs: { successfulApplications: 0 },
    multiHit: { actions: 0 },
    events: { grantedSkillIds: new Set(), completedTroubleIds: new Set() },
    skills: { learnedBySource: {} },
  };
}

function initialFacility(model) {
  const configuredStart = model.facilityById?.LOC_FARM_FIELD;
  if (configuredStart?.hub === "田園の村") return configuredStart;
  return preferredArrivalFacility(model, "田園の村");
}

export function createInitialJourneyState({ model, battleData, skills, profile, tuning = {}, seed = "player-journey" }) {
  const resolvedProfile = typeof profile === "string" ? PROFILE.get(profile) : profile;
  if (!resolvedProfile) throw new Error(`Unknown profile ${profile}`);
  const catalog = createMissionCatalog(model, battleData, tuning);
  const equipment = {};
  const owned = {};
  for (const id of tuning.starterEquipmentIds ?? ["EQP-W-0005", "EQP-A-0001"]) {
    const item = battleData.equipmentById.get(id);
    if (!item) continue;
    equipment[item.slot] ??= id;
    owned[id] = (owned[id] ?? 0) + 1;
  }
  const arrival = initialFacility(model);
  const state = {
    schemaVersion: "2.0.0",
    seed: String(seed),
    profileId: resolvedProfile.id,
    tuning,
    absoluteMinute: 0,
    day: 1,
    hour: 10,
    minute: 0,
    minuteOfDay: 600,
    phaseIndex: 0,
    daypart: "day",
    player: {
      location: "田園の村",
      facilityId: arrival?.id ?? null,
      level: 1,
      exp: 0,
      sp: 2,
      stats: { attack: 4, defense: 3, agility: 2, luck: 1 },
      gold: Number(tuning.startingGold ?? 0),
      hpRatio: 1,
      mpRatio: 1,
      freeMeals: Number(tuning.freeStarterMeals ?? 1),
      freeLodging: Number(tuning.freeStarterLodging ?? 1),
      inventory: { items: {}, equipment: owned },
      equipment,
      skills: new Set(),
      visibleSkillIds: new Set(),
      flagEligibleSkillIds: new Set(),
      magicSkillCount: 0,
      knownRumorIds: new Set(),
      evidenceByTrouble: {},
      reputation: {},
    },
    progress: progress(),
    troubles: Object.fromEntries(model.troubles.map((trouble) => [trouble.id, { id: trouble.id, status: "scheduled", casualtyMitigation: 0, transitions: [] }])),
    worldFlags: {
      worldTreeFallen: false,
      forestMazeOpen: false,
      elfApproval: false,
      blackridgePermit: false,
      foreignFleetLanded: false,
      secondSummoningStopped: false,
      colossusAwake: false,
      blackridgeArmyAtCapital: false,
      capitalFallen: false,
    },
    missions: createMissionRuntime(catalog),
    rumors: [],
    rumorById: {},
    routeCache: {},
    encounterAvailability: {},
    conversationAvailability: {},
    shop: createShopRuntime(battleData),
    history: [],
    replayResults: {},
    metrics: {
      actions: 0,
      localMoves: 0,
      regionalMoves: 0,
      battles: 0,
      wins: 0,
      losses: 0,
      firstLevelUpDay: null,
      choiceDeadEnds: 0,
      movementBlocked: 0,
      travelBlocked: 0,
      travelInterruptions: 0,
      replayMismatches: 0,
      purchases: 0,
      zeroTimePurchases: 0,
      terminatedByActionCap: false,
      maxActivePermanent: 0,
      maxActiveSpecial: 0,
      skillConditionViolations: 0,
      eventGrantMatchedCandidates: 0,
      eventGrantMisses: 0,
    },
    battleData,
    catalog,
  };
  if (arrival) {
    state.progress.travel.visitedFacilities.add(arrival.id);
    state.progress.facilities.visitedIds.add(arrival.id);
  }
  autoLearn(state, battleData, skills, resolvedProfile);
  updateTroubles(state, model);
  refreshMissions(state, model, catalog, battleData, skills, resolvedProfile);
  return state;
}

function shop(state, data, profile) {
  if (profile.trade < 0.2 && state.player.gold < 80) return;
  const before = state.absoluteMinute;
  const bought = autoShop(state, data, state.shop, profile, state.tuning.shop ?? {});
  state.metrics.purchases += bought.length;
  if (bought.length && state.absoluteMinute === before) state.metrics.zeroTimePurchases += bought.length;
}

function statusCounts(entries, key = "status") {
  const counts = {};
  for (const entry of entries) counts[entry[key]] = (counts[entry[key]] ?? 0) + 1;
  return counts;
}

function equipmentGrantedSkills(state, data) {
  return [...new Set(Object.values(state.player.equipment).map((id) => data.equipmentById.get(id)?.grantedSkillId).filter(Boolean))];
}

function summary(state, model, data) {
  const troubleCounts = statusCounts(Object.values(state.troubles));
  const missionCounts = statusCounts(Object.values(state.missions));
  const attempted = [...state.progress.missions.attemptedTroubleIds];
  const resolved = [...state.progress.missions.resolvedTroubleIds];
  const failedAfterAttempt = attempted.filter((id) => ["failed", "suppressed"].includes(state.troubles[id]?.status));
  const expSources = state.progress.experience.bySource;
  const missionExp = Number(expSources.permanentMission ?? 0) + Number(expSources.specialMission ?? 0);
  const totalExp = Math.max(1, Number(state.progress.experience.total ?? 0));
  return {
    seed: state.seed,
    profileId: state.profileId,
    reachedEnd: state.absoluteMinute >= GAME_END_MINUTE,
    day: state.day,
    minute: state.absoluteMinute,
    level: state.player.level,
    expIntoLevel: state.player.exp,
    nextLevelExp: experienceToNextLevel(state.player.level),
    sp: state.player.sp,
    learnedSkills: state.player.skills.size,
    spLearnedSkills: Number(state.progress.skills.learnedBySource.basic_level_up ?? 0) + Number(state.progress.skills.learnedBySource.flag_unlocked ?? 0),
    flagLearnedSkills: Number(state.progress.skills.learnedBySource.flag_unlocked ?? 0),
    flagEligibleSkills: state.player.flagEligibleSkillIds.size,
    visibleSkillCount: state.player.visibleSkillIds.size,
    eventGrantedSkills: state.progress.events.grantedSkillIds.size,
    equipmentGrantedSkills: equipmentGrantedSkills(state, data).length,
    skillConditionViolations: state.metrics.skillConditionViolations,
    eventGrantMatchedCandidates: state.metrics.eventGrantMatchedCandidates,
    eventGrantMisses: state.metrics.eventGrantMisses,
    gold: state.player.gold,
    equipment: { ...state.player.equipment },
    hpRatio: Number(state.player.hpRatio.toFixed(3)),
    mpRatio: Number(state.player.mpRatio.toFixed(3)),
    battles: state.metrics.battles,
    wins: state.metrics.wins,
    losses: state.metrics.losses,
    winRate: state.metrics.battles ? state.metrics.wins / state.metrics.battles : 0,
    actions: state.metrics.actions,
    movementActions: state.metrics.localMoves + state.metrics.regionalMoves,
    localMoves: state.metrics.localMoves,
    regionalMoves: state.metrics.regionalMoves,
    visitedHubs: state.progress.travel.visitedHubs.size,
    visitedFacilities: state.progress.travel.visitedFacilities.size,
    walkMinutes: state.progress.walkMinutes.total,
    missionsCompleted: state.progress.missions.totalCompleted,
    permanentMissionsCompleted: state.progress.missions.permanentCompleted,
    specialMissionsCompleted: state.progress.missions.specialCompleted,
    missionCounts,
    maxActivePermanent: state.metrics.maxActivePermanent,
    maxActiveSpecial: state.metrics.maxActiveSpecial,
    experienceBySource: { ...expSources },
    missionExpShare: missionExp / totalExp,
    troubleCounts,
    attemptedTroubles: attempted.length,
    resolvedTroubleIds: resolved.sort(),
    failedAfterAttemptIds: failedAfterAttempt.sort(),
    rumorCount: state.rumors.length,
    rumorRecipients: state.progress.rumors.npcRecipients,
    npcReplans: state.progress.rumors.npcReplans,
    firstLevelUpDay: state.metrics.firstLevelUpDay,
    choiceDeadEnds: state.metrics.choiceDeadEnds,
    movementBlocked: state.metrics.movementBlocked,
    travelBlocked: state.metrics.travelBlocked,
    travelInterruptions: state.metrics.travelInterruptions,
    replayMismatches: state.metrics.replayMismatches,
    purchases: state.metrics.purchases,
    zeroTimePurchases: state.metrics.zeroTimePurchases,
    shopDiagnostics: state.shop.diagnostics.length,
    terminatedByActionCap: state.metrics.terminatedByActionCap,
    fingerprint: stateFingerprint(state),
    terminalTroubles: model.troubles.length - Number(troubleCounts.active ?? 0) - Number(troubleCounts.scheduled ?? 0) - Number(troubleCounts.critical ?? 0),
  };
}

export function simulatePlayerJourney({ model, battleData, skills, profile = "balanced", tuning = {}, seed = "player-journey", endMinute = GAME_END_MINUTE, maxActions = 4000 } = {}) {
  if (!model || !battleData || !skills) throw new Error("simulatePlayerJourney requires model, battleData and skills");
  const resolvedProfile = typeof profile === "string" ? PROFILE.get(profile) : profile;
  const state = createInitialJourneyState({ model, battleData, skills, profile: resolvedProfile, tuning, seed });
  while (state.absoluteMinute < endMinute && state.metrics.actions < maxActions) {
    updateTroubles(state, model);
    propagateRumors(state, model);
    refreshMissions(state, model, state.catalog, battleData, skills, resolvedProfile);
    shop(state, battleData, resolvedProfile);
    const movement = objectiveMovementAction(state, model, state.catalog, resolvedProfile);
    if (movement) {
      const result = resolveMovementAction(state, model, battleData, skills, resolvedProfile, movement);
      if (!result.ok) {
        if (result.reason === "travel_defeat") state.metrics.travelInterruptions += 1;
        else state.metrics.movementBlocked += 1;
      }
      state.metrics.actions += 1;
      autoLearn(state, battleData, skills, resolvedProfile);
      refreshMissions(state, model, state.catalog, battleData, skills, resolvedProfile);
      continue;
    }
    const choices = generateChoiceActions(state, model, battleData, state.catalog, resolvedProfile);
    if (!choices.length) {
      state.metrics.choiceDeadEnds += 1;
      advance(state, model, 45, "dead-end");
    } else {
      resolvePlayerAction(state, model, battleData, skills, state.catalog, resolvedProfile, choose(state, choices, resolvedProfile));
    }
    state.metrics.actions += 1;
  }
  if (state.absoluteMinute < endMinute && state.metrics.actions >= maxActions) {
    state.metrics.terminatedByActionCap = true;
    state.history.push({ type: "SIMULATION_ACTION_CAP", minute: state.absoluteMinute, maxActions });
  }
  refreshMissions(state, model, state.catalog, battleData, skills, resolvedProfile);
  return {
    schemaVersion: "2.0.0",
    engineVersion: "integrated-player-journey-v2",
    rngPolicy: "state-keyed narrative; encounter and battle keyed by action attempt",
    profile: resolvedProfile,
    tuning,
    summary: summary(state, model, battleData),
    state,
  };
}

function forceMoveForProbe(state, model, data, skills, profile, targetHub, targetFacilityId) {
  if (targetHub !== state.player.location) {
    const action = availableTravelActions(state, model).find((entry) => entry.destinationHub === targetHub);
    if (!action) return { ok: false, reason: "probe_unreachable_hub", targetHub };
    const result = resolveMovementAction(state, model, data, skills, profile, action);
    if (!result.ok) return result;
  }
  if (targetFacilityId && targetFacilityId !== state.player.facilityId) {
    const action = availableLocalMovementActions(state, model).find((entry) => entry.destinationFacilityId === targetFacilityId);
    if (!action) return { ok: false, reason: "probe_unreachable_facility", targetFacilityId };
    const result = resolveMovementAction(state, model, data, skills, profile, action);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export function probeTroubleResolution({ model, battleData, skills, troubleId, tuning = {}, seed = `probe:${troubleId}` }) {
  const profile = PROFILE.get("story");
  const state = createInitialJourneyState({
    model,
    battleData,
    skills,
    profile,
    tuning: {
      ...tuning,
      probeMode: true,
      disableTravelEncounters: true,
      probeMissionPowerMultiplier: Number(tuning.probeMissionPowerMultiplier ?? 12),
    },
    seed,
  });
  Object.assign(state.worldFlags, { worldTreeFallen: true, forestMazeOpen: true, elfApproval: true, blackridgePermit: true });
  state.routeCache = {};
  state.player.level = 24;
  state.player.sp = 24;
  state.player.stats = { attack: 70, defense: 70, agility: 50, luck: 30 };
  state.player.hpRatio = 1;
  state.player.mpRatio = 1;
  const trouble = model.troubleById[troubleId];
  const missionDefinition = state.catalog.special.find((entry) => entry.troubleId === troubleId);
  if (!trouble || !missionDefinition) return { ok: false, troubleId, reason: "missing_definition" };
  state.absoluteMinute = moment(trouble.startDay, trouble.startPhase);
  syncClock(state);
  state.troubles[troubleId].status = "active";
  state.missions[missionDefinition.id].status = "active";
  autoLearn(state, battleData, skills, profile);
  const trace = [];
  let guard = 0;
  while (state.troubles[troubleId].status !== "resolved" && guard < 40) {
    guard += 1;
    const runtime = state.missions[missionDefinition.id];
    const step = currentStep(missionDefinition, runtime);
    if (!step) break;
    const targetHub = step.targetLocation ?? missionDefinition.targetLocations[0];
    const move = forceMoveForProbe(state, model, battleData, skills, profile, targetHub, step.targetFacilityId);
    if (!move.ok) return { ok: false, troubleId, reason: move.reason, trace };
    const action = missionActions(state, state.catalog).find((entry) => entry.missionId === missionDefinition.id && entry.stepId === step.id);
    if (!action) return { ok: false, troubleId, reason: "missing_action", stepId: step.id, trace };
    const result = resolvePlayerAction(state, model, battleData, skills, state.catalog, profile, action);
    trace.push({ stepId: step.id, result: { ok: result.ok, reason: result.reason, won: result.battle?.won } });
    if (!result.ok || (result.battle && !result.battle.won)) return { ok: false, troubleId, reason: result.reason ?? "battle_lost", trace };
  }
  return {
    ok: state.troubles[troubleId].status === "resolved",
    troubleId,
    missionId: missionDefinition.id,
    finalStatus: state.troubles[troubleId].status,
    level: state.player.level,
    trace,
  };
}
