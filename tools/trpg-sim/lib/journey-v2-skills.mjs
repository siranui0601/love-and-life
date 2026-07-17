import { evaluateConditions, flattenConditionLeaves } from "./skill-progression.mjs";

const LEVEL_CODES = new Set(["basic_level_up", "flag_unlocked", "level_up"]);
const AUTO_CODES = new Set(["automatic", "system", "initial"]);
const BATTLE_SCOPES = new Set(["self", "target", "battle", "history", "field"]);

function prerequisitesOf(skill) {
  if (!skill.prerequisites) return [];
  return Array.isArray(skill.prerequisites) ? skill.prerequisites : String(skill.prerequisites).split(",").map((value) => value.trim()).filter(Boolean);
}

function stable(value) {
  return JSON.stringify(value, (_key, item) => item instanceof Set ? [...item].sort() : item);
}

function stableNumber(text) {
  let value = 2166136261;
  for (const character of String(text)) { value ^= character.codePointAt(0); value = Math.imul(value, 16777619); }
  return value >>> 0;
}

function readPath(root, path) {
  let value = root;
  for (const segment of String(path ?? "").split(".").filter(Boolean)) {
    if (value == null) return undefined;
    value = value[segment];
  }
  return value;
}

function conditionDependencies(skills) {
  const byKey = new Map();
  const fields = ["revealConditions", "eventUnlockConditions", "grantConditions", "learnConditions"];
  for (const skill of skills) {
    for (const field of fields) {
      for (const leaf of flattenConditionLeaves(skill[field])) {
        if (!leaf?.scope || !leaf?.path) continue;
        const key = `${leaf.scope}:${leaf.path}`;
        if (!byKey.has(key)) byKey.set(key, { scope: leaf.scope, path: leaf.path });
      }
    }
  }
  return [...byKey.values()].sort((left, right) => `${left.scope}:${left.path}`.localeCompare(`${right.scope}:${right.path}`));
}

function ensureIndex(state, skills) {
  if (state.skillState.index) return state.skillState.index;
  const usable = skills.filter((skill) => !["non_skill", "none", "design_only", "deleted"].includes(String(skill.acquisitionCode ?? "")));
  const level = usable.filter((skill) => LEVEL_CODES.has(skill.acquisitionCode));
  const flags = usable.filter((skill) => skill.acquisitionCode === "flag_unlocked");
  const events = usable.filter((skill) => String(skill.acquisitionCode ?? "").includes("event") && (skill.grantConditions != null || skill.eventUnlockConditions != null));
  const automatic = usable.filter((skill) => AUTO_CODES.has(skill.acquisitionCode));
  const revealWorld = usable.filter((skill) => (skill.eventUnlockConditions != null || String(skill.acquisitionCode ?? "").includes("event")) && skill.revealConditions != null);
  const revealLevel = usable.filter((skill) => LEVEL_CODES.has(skill.acquisitionCode) && skill.revealConditions != null);
  const index = {
    byId: new Map(usable.map((skill) => [skill.id, skill])),
    level,
    flags,
    events,
    automatic,
    revealWorld,
    revealLevel,
    worldDependencies: conditionDependencies([...flags, ...events, ...automatic, ...revealWorld]),
  };
  state.skillState.index = index;
  return index;
}

export function skillContextV2(state, data) {
  const equipmentIds = Object.values(state.player.equipment).filter(Boolean);
  const activeWeaponTypes = new Set(equipmentIds.map((id) => data.equipmentById.get(id)?.weaponType).filter(Boolean));
  const grantedSkillIds = new Set(equipmentIds.map((id) => data.equipmentById.get(id)?.grantedSkillId).filter(Boolean));
  return {
    player: { level: state.player.level, skills: [...state.player.skills], reputation: state.player.reputation },
    progress: state.progress,
    equipment: { activeWeaponTypes, grantedSkillIds },
    inventory: { itemIds: new Set(Object.keys(state.player.inventory.items)), gold: state.player.gold },
    world: { ...state.worldFlags, troubles: Object.fromEntries(Object.entries(state.troubles).map(([id, runtime]) => [id, { status: runtime.status }])) },
    self: { hpRatio: state.player.hpRatio, mpRatio: state.player.mpRatio, ailments: new Set(), modifiers: {}, specialStates: new Set() },
    field: { locationId: state.player.location, facilityId: state.player.facilityId, tags: new Set() },
  };
}

function worldKey(state, index, context) {
  return stable({
    skills: state.player.skills,
    equipment: state.player.equipment,
    values: index.worldDependencies.map((dependency) => [dependency.scope, dependency.path, readPath(context[dependency.scope], dependency.path)]),
  });
}

function levelKey(state) {
  return stable({ level: state.player.level, sp: state.player.sp, skills: state.player.skills, equipment: state.player.equipment });
}

function skillScore(skill, profile) {
  const text = `${skill.category ?? ""} ${skill.originalCategory ?? ""}`;
  let score = Number(skill.rank ?? 0) * 4 - Number(skill.requiredLevel ?? 0) * .5;
  if (profile.id === "fighter" && /物理|剣|斧|槍|弓/u.test(text)) score += 30;
  if (profile.id === "cautious" && /防御|回復|盾|支援/u.test(text)) score += 35;
  if (profile.id === "explorer" && /弓|罠|探索|技巧/u.test(text)) score += 30;
  if (profile.id === "story" && /汎用|支援|回復|デバフ/u.test(text)) score += 18;
  if (profile.id === "merchant" && /本|杖|支援|幸運/u.test(text)) score += 12;
  return score;
}

function containsBattleScope(conditions) {
  return flattenConditionLeaves(conditions).some((leaf) => BATTLE_SCOPES.has(leaf.scope));
}

function mark(state, setName, mapName, skill, type) {
  const set = state.skillState[setName];
  if (set.has(skill.id)) return false;
  set.add(skill.id);
  state.skillState[mapName][skill.id] = state.absoluteMinute;
  state.history.push({ type, minute: state.absoluteMinute, skillId: skill.id, acquisitionCode: skill.acquisitionCode });
  return true;
}

export function effectiveSkillIdsV2(state, data) {
  const equipmentGranted = Object.values(state.player.equipment).filter(Boolean).map((id) => data.equipmentById.get(id)?.grantedSkillId).filter(Boolean);
  return new Set([...state.player.skills, ...equipmentGranted]);
}

function refreshEquipmentGrants(state, data) {
  const active = new Set(Object.values(state.player.equipment).filter(Boolean).map((id) => data.equipmentById.get(id)?.grantedSkillId).filter(Boolean));
  for (const id of active) {
    if (state.skillState.equipmentEverActive.has(id)) continue;
    state.skillState.equipmentEverActive.add(id);
    state.metrics.equipmentGrantActivations += 1;
    state.history.push({ type: "SKILL_EQUIPMENT_ACTIVE", minute: state.absoluteMinute, skillId: id });
  }
  state.skillState.equipmentActive = active;
}

function refreshWorldRules(state, index, context) {
  for (const skill of index.revealWorld) if (!state.skillState.revealed.has(skill.id) && evaluateConditions(skill.revealConditions, context)) mark(state, "revealed", "revealedAt", skill, "SKILL_REVEALED");
  for (const skill of index.flags) {
    if (state.skillState.flagUnlocked.has(skill.id) || !evaluateConditions(skill.eventUnlockConditions, context)) continue;
    if (mark(state, "flagUnlocked", "flagUnlockedAt", skill, "SKILL_FLAG_UNLOCKED")) {
      for (const leaf of flattenConditionLeaves(skill.eventUnlockConditions)) {
        if (leaf?.scope && leaf?.path) state.skillState.flagUnlockPaths.add(`${leaf.scope}.${leaf.path}`);
      }
    }
  }
  for (const skill of index.events) {
    if (state.player.skills.has(skill.id)) continue;
    if (!prerequisitesOf(skill).every((id) => state.player.skills.has(id))) continue;
    const grantConditions = skill.grantConditions != null && evaluateConditions(skill.grantConditions, context);
    const flagUnlocked = skill.eventUnlockConditions != null && evaluateConditions(skill.eventUnlockConditions, context);
    const learnedConditions = evaluateConditions(skill.learnConditions, context);
    if (!(grantConditions || flagUnlocked && learnedConditions)) continue;
    state.player.skills.add(skill.id);
    state.progress.events.grantedSkillIds.add(skill.id);
    state.metrics.eventSkillGrants += 1;
    state.metrics.skillsLearnedByCode[skill.acquisitionCode] = Number(state.metrics.skillsLearnedByCode[skill.acquisitionCode] ?? 0) + 1;
    state.history.push({ type: "SKILL_GRANTED_EVENT", minute: state.absoluteMinute, skillId: skill.id, acquisitionCode: skill.acquisitionCode });
  }
  for (const skill of index.automatic) {
    if (state.player.skills.has(skill.id)) continue;
    if (!prerequisitesOf(skill).every((id) => state.player.skills.has(id))) continue;
    if (!evaluateConditions(skill.learnConditions, context)) continue;
    state.player.skills.add(skill.id);
    state.metrics.skillsLearnedByCode[skill.acquisitionCode] = Number(state.metrics.skillsLearnedByCode[skill.acquisitionCode] ?? 0) + 1;
    state.history.push({ type: "SKILL_GRANTED_AUTOMATIC", minute: state.absoluteMinute, skillId: skill.id, acquisitionCode: skill.acquisitionCode });
  }
}

function refreshLevelRules(state, index, context, profile) {
  for (const skill of index.revealLevel) if (!state.skillState.revealed.has(skill.id) && evaluateConditions(skill.revealConditions, context)) mark(state, "revealed", "revealedAt", skill, "SKILL_REVEALED");
  while (state.player.sp > 0) {
    context = { ...context, player: { ...context.player, level: state.player.level, skills: [...state.player.skills] } };
    const candidates = index.level
      .filter((skill) => !state.player.skills.has(skill.id))
      .filter((skill) => Number(skill.spCost ?? 0) > 0 && Number(skill.spCost ?? 0) <= state.player.sp)
      .filter((skill) => prerequisitesOf(skill).every((id) => state.player.skills.has(id)))
      .filter((skill) => evaluateConditions(skill.learnConditions, context))
      .filter((skill) => skill.acquisitionCode !== "flag_unlocked" || evaluateConditions(skill.eventUnlockConditions, context));
    const unlockedFlags = candidates.filter((skill) => skill.acquisitionCode === "flag_unlocked");
    const learnedSpendSkills = [...state.player.skills].filter((id) => LEVEL_CODES.has(index.byId.get(id)?.acquisitionCode)).length;
    const reserve = Math.max(0, Number(state.tuning.skillPointReserve ?? 1));
    const starterMinimum = Math.max(0, Number(state.tuning.starterSkillMinimum ?? 3));
    if (!unlockedFlags.length && learnedSpendSkills >= starterMinimum && state.player.sp <= reserve) break;
    const pool = unlockedFlags.length ? unlockedFlags : candidates;
    const selected = pool.sort((left, right) => skillScore(right, profile) - skillScore(left, profile) || left.id.localeCompare(right.id))[0];
    if (!selected) break;
    const valid = evaluateConditions(selected.learnConditions, context) && (selected.acquisitionCode !== "flag_unlocked" || evaluateConditions(selected.eventUnlockConditions, context));
    if (!valid) {
      state.metrics.skillAcquisitionViolations += 1;
      break;
    }
    state.player.skills.add(selected.id);
    state.player.sp -= Number(selected.spCost ?? 0);
    state.metrics.skillsLearnedByCode[selected.acquisitionCode] = Number(state.metrics.skillsLearnedByCode[selected.acquisitionCode] ?? 0) + 1;
    if (selected.acquisitionCode === "flag_unlocked") state.metrics.flagSkillsLearned += 1;
    state.history.push({ type: "SKILL_LEARNED", minute: state.absoluteMinute, skillId: selected.id, acquisitionCode: selected.acquisitionCode });
  }
}

export function refreshSkillStateV2(state, data, skills, profile) {
  const index = ensureIndex(state, skills);
  refreshEquipmentGrants(state, data);
  let context = skillContextV2(state, data);
  const nextWorldKey = worldKey(state, index, context);
  const nextLevelKey = levelKey(state);
  if (state.skillState.lastWorldKey !== nextWorldKey) {
    refreshWorldRules(state, index, context);
    state.skillState.lastWorldKey = nextWorldKey;
    context = skillContextV2(state, data);
  }
  if (state.skillState.lastLevelKey !== nextLevelKey || state.player.sp > 0) {
    refreshLevelRules(state, index, context, profile);
    state.skillState.lastLevelKey = nextLevelKey;
  }
  state.skillState.effective = effectiveSkillIdsV2(state, data);
  state.player.magicSkillCount = [...state.skillState.effective].filter((id) => /魔法|魔導|杖|本/u.test(`${data.playerSkillById.get(id)?.category ?? ""}`)).length;
  state.metrics.maxEffectiveSkills = Math.max(state.metrics.maxEffectiveSkills, state.skillState.effective.size);
  return state.skillState.effective;
}

export function battleSkillIdsV2(state, data) {
  const context = skillContextV2(state, data);
  return [...effectiveSkillIdsV2(state, data)].filter((id) => {
    const skill = data.playerSkillById.get(id);
    if (!skill || ["non_skill", "deleted"].includes(skill.acquisitionCode)) return false;
    if (containsBattleScope(skill.activationConditions)) return true;
    return evaluateConditions(skill.activationConditions, context);
  });
}

function grantSignalLeaf(skill) {
  return flattenConditionLeaves(skill.grantConditions).find((leaf) =>
    leaf?.scope === "progress" && leaf.op === "contains" && leaf.value === skill.id
    || leaf?.scope === "world" && leaf.op === "isTrue"
  ) ?? null;
}

function ensureSetAt(root, path) {
  const segments = String(path).split(".");
  let cursor = root;
  for (const segment of segments.slice(0, -1)) cursor = cursor[segment] ??= {};
  const key = segments.at(-1);
  if (!(cursor[key] instanceof Set)) cursor[key] = new Set();
  return cursor[key];
}

function setBooleanAt(root, path) {
  const segments = String(path).split(".");
  let cursor = root;
  for (const segment of segments.slice(0, -1)) cursor = cursor[segment] ??= {};
  cursor[segments.at(-1)] = true;
}

function grantChannel(leaf) {
  if (leaf.scope === "world") return "world";
  return String(leaf.path).split(".")[0];
}

export function issueEventSkillRewardV2(state, data, skills, profile, source = {}) {
  const index = ensureIndex(state, skills);
  const eligible = index.events
    .filter((skill) => !state.player.skills.has(skill.id))
    .filter((skill) => prerequisitesOf(skill).every((id) => state.player.skills.has(id)))
    .map((skill) => ({ skill, leaf: grantSignalLeaf(skill) }))
    .filter((entry) => entry.leaf);
  if (!eligible.length) return null;
  const difficulty = Number(source.difficulty ?? 1);
  const preferredChannels = difficulty >= 8
    ? new Set(["world", "eventSkillGrants"])
    : difficulty >= 5
      ? new Set(["manuals", "contracts", "eventSkillGrants"])
      : new Set(["training", "events", "manuals"]);
  const preferred = eligible.filter((entry) => preferredChannels.has(grantChannel(entry.leaf)));
  const ranked = (preferred.length ? preferred : eligible).sort((left, right) =>
    skillScore(right.skill, profile) - skillScore(left.skill, profile)
    || Number(left.skill.requiredLevel ?? 1) - Number(right.skill.requiredLevel ?? 1)
    || left.skill.id.localeCompare(right.skill.id)
  );
  const window = ranked.slice(0, Math.min(12, ranked.length));
  const selected = window[stableNumber(`${state.seed}:${source.missionId ?? "event"}:${source.troubleId ?? ""}:${state.metrics.eventGrantSignals}`) % window.length];
  if (selected.leaf.scope === "progress") ensureSetAt(state.progress, selected.leaf.path).add(selected.leaf.value);
  else setBooleanAt(state.worldFlags, selected.leaf.path);
  state.metrics.eventGrantSignals += 1;
  state.history.push({
    type: "SKILL_GRANT_SIGNAL", minute: state.absoluteMinute, skillId: selected.skill.id,
    channel: grantChannel(selected.leaf), missionId: source.missionId ?? null, troubleId: source.troubleId ?? null,
  });
  refreshSkillStateV2(state, data, skills, profile);
  return state.player.skills.has(selected.skill.id) ? selected.skill.id : null;
}

export function auditSkillCatalogV2(skills, data) {
  const ids = new Set(skills.map((skill) => skill.id));
  const missingPrerequisites = [];
  const equipmentGrantMissing = [];
  const eventWithoutStructuredGrant = [];
  for (const skill of skills) {
    for (const id of prerequisitesOf(skill)) if (!ids.has(id)) missingPrerequisites.push({ skillId: skill.id, prerequisiteId: id });
    if (String(skill.acquisitionCode ?? "").includes("event") && skill.grantConditions == null && skill.eventUnlockConditions == null) eventWithoutStructuredGrant.push(skill.id);
  }
  for (const equipment of data.equipment) if (equipment.grantedSkillId && !ids.has(equipment.grantedSkillId)) equipmentGrantMissing.push({ equipmentId: equipment.id, skillId: equipment.grantedSkillId });
  const byCode = {};
  for (const skill of skills) byCode[skill.acquisitionCode ?? "unknown"] = Number(byCode[skill.acquisitionCode ?? "unknown"] ?? 0) + 1;
  return { total: skills.length, byCode, missingPrerequisites, equipmentGrantMissing, eventWithoutStructuredGrant };
}
