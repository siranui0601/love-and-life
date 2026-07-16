import {
  loadBattleSnapshot,
  loadSkillSupportSnapshot,
  loadSkills,
  loadWorldSnapshot,
} from "./fixtures.mjs";

export const CONDITION_FIELDS = [
  "revealConditions",
  "eventUnlockConditions",
  "learnConditions",
  "grantConditions",
  "activationConditions",
  "additionalEffectConditions",
];

export const SYNTHETIC_PROFILE_SPECS = [
  {
    id: "balanced",
    label: "均衡型",
    maxLevel: 20,
    focus: ["combat", "battles", "healing", "defense", "movement"],
    categories: ["汎用", "防御", "回復"],
    weaponTypes: ["oneHandedSword", "shield"],
  },
  {
    id: "martial",
    label: "物理熟練型",
    maxLevel: 24,
    focus: ["weapon", "combat", "physical", "multiHit", "critical"],
    categories: ["物理", "片手剣", "両手剣", "斧", "槍"],
    weaponTypes: ["oneHandedSword", "twoHandedSword", "axe", "spear"],
  },
  {
    id: "arcane",
    label: "魔法研究型",
    maxLevel: 22,
    focus: ["magic", "grimoire", "debuff", "fieldEffects", "mp"],
    categories: ["魔法", "魔導", "杖", "本", "デバフ"],
    weaponTypes: ["staff", "book"],
  },
  {
    id: "guardian",
    label: "守護回復型",
    maxLevel: 20,
    focus: ["defense", "guard", "shield", "substitutes", "healing", "hpTechniques"],
    categories: ["防御", "盾", "回復", "支援"],
    weaponTypes: ["oneHandedSword", "shield"],
  },
  {
    id: "ranger",
    label: "探索技巧型",
    maxLevel: 21,
    focus: ["bow", "traps", "movement", "regions", "night", "successfulDodges"],
    categories: ["弓", "罠", "探索", "技巧"],
    weaponTypes: ["bow"],
  },
  {
    id: "completionist",
    label: "網羅検証型",
    maxLevel: 24,
    focus: ["*"],
    categories: ["*"],
    weaponTypes: [
      "oneHandedSword",
      "twoHandedSword",
      "axe",
      "spear",
      "bow",
      "staff",
      "book",
      "shield",
    ],
  },
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableHash(text, seed = 1) {
  let hash = (2166136261 ^ (Number(seed) >>> 0)) >>> 0;
  for (const character of String(text)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function stableUnit(text, seed = 1) {
  return stableHash(text, seed) / 4294967296;
}

export function getPathValue(context, scope, path) {
  let value = scope ? context?.[scope] : context;
  if (!path) return value;
  for (const segment of String(path).split(".")) {
    if (value === null || value === undefined) return undefined;
    if (value instanceof Map) value = value.get(segment);
    else value = value[segment];
  }
  return value;
}

export function setPathValue(context, scope, path, value) {
  if (!context[scope] || typeof context[scope] !== "object") context[scope] = {};
  const segments = String(path).split(".");
  let cursor = context[scope];
  for (const segment of segments.slice(0, -1)) {
    if (!isObject(cursor[segment])) cursor[segment] = {};
    cursor = cursor[segment];
  }
  cursor[segments.at(-1)] = value;
  return context;
}

function asValues(value) {
  if (value instanceof Set) return [...value];
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function contains(actual, expected) {
  if (actual instanceof Set) return actual.has(expected);
  if (Array.isArray(actual)) return actual.includes(expected);
  if (typeof actual === "string") return actual.includes(String(expected));
  if (isObject(actual)) return Object.hasOwn(actual, expected);
  return false;
}

function equal(actual, expected) {
  if (Object.is(actual, expected)) return true;
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return actual.length === expected.length && actual.every((value, index) => equal(value, expected[index]));
  }
  return false;
}

export function createConditionCoverage() {
  return {
    evaluations: 0,
    byOperator: {},
    byPath: {},
  };
}

function recordCoverage(coverage, operator, pathKey, result) {
  if (!coverage) return;
  coverage.evaluations += 1;
  const operatorEntry = (coverage.byOperator[operator] ??= { evaluations: 0, true: 0, false: 0 });
  operatorEntry.evaluations += 1;
  operatorEntry[result ? "true" : "false"] += 1;
  const pathEntry = (coverage.byPath[pathKey] ??= { evaluations: 0, true: 0, false: 0 });
  pathEntry.evaluations += 1;
  pathEntry[result ? "true" : "false"] += 1;
}

function compositeValues(predicate) {
  return predicate.conditions ?? predicate.predicates ?? predicate.value ?? [];
}

export function evaluatePredicate(predicate, context, coverage = null) {
  if (predicate === null || predicate === undefined) return true;
  if (typeof predicate === "boolean") return predicate;
  if (Array.isArray(predicate)) {
    const result = predicate.every((entry) => evaluatePredicate(entry, context, coverage));
    recordCoverage(coverage, "all", "$array", result);
    return result;
  }
  if (!isObject(predicate)) return Boolean(predicate);
  if (predicate.when && !predicate.op && !predicate.scope) {
    return evaluatePredicate(predicate.when, context, coverage);
  }

  if (predicate.all !== undefined) {
    const result = asValues(predicate.all).every((entry) => evaluatePredicate(entry, context, coverage));
    recordCoverage(coverage, "all", "$composite", result);
    return result;
  }
  if (predicate.any !== undefined) {
    const result = asValues(predicate.any).some((entry) => evaluatePredicate(entry, context, coverage));
    recordCoverage(coverage, "any", "$composite", result);
    return result;
  }
  if (predicate.not !== undefined) {
    const result = !evaluatePredicate(predicate.not, context, coverage);
    recordCoverage(coverage, "not", "$composite", result);
    return result;
  }

  const operator = predicate.op ?? "eq";
  if (operator === "all" || operator === "any") {
    const values = asValues(compositeValues(predicate));
    const result = operator === "all"
      ? values.every((entry) => evaluatePredicate(entry, context, coverage))
      : values.some((entry) => evaluatePredicate(entry, context, coverage));
    recordCoverage(coverage, operator, "$composite", result);
    return result;
  }
  if (operator === "not") {
    const [value] = asValues(compositeValues(predicate));
    const result = !evaluatePredicate(value, context, coverage);
    recordCoverage(coverage, operator, "$composite", result);
    return result;
  }

  const actual = getPathValue(context, predicate.scope, predicate.path);
  const expected = predicate.value;
  let result = false;
  if (actual !== undefined) {
    switch (operator) {
      case "eq": result = equal(actual, expected); break;
      case "ne": result = !equal(actual, expected); break;
      case "gt": result = actual > expected; break;
      case "gte": result = actual >= expected; break;
      case "lt": result = actual < expected; break;
      case "lte": result = actual <= expected; break;
      case "between": {
        const minimum = Array.isArray(expected) ? expected[0] : expected?.min;
        const maximum = Array.isArray(expected) ? expected[1] : expected?.max;
        result = actual >= minimum && actual <= maximum;
        break;
      }
      case "isTrue": result = actual === true; break;
      case "isFalse": result = actual === false; break;
      case "contains": result = contains(actual, expected); break;
      case "notContains": result = !contains(actual, expected); break;
      case "containsAll": result = asValues(expected).every((value) => contains(actual, value)); break;
      case "containsAny": result = asValues(expected).some((value) => contains(actual, value)); break;
      default: throw new Error(`Unsupported predicate operator: ${operator}`);
    }
  }
  recordCoverage(coverage, operator, `${predicate.scope ?? "$root"}.${predicate.path ?? ""}`, result);
  return result;
}

export function evaluateConditions(conditions, context, coverage = null) {
  return evaluatePredicate(conditions, context, coverage);
}

export function flattenConditionLeaves(condition, output = []) {
  if (condition === null || condition === undefined) return output;
  if (Array.isArray(condition)) {
    for (const entry of condition) flattenConditionLeaves(entry, output);
    return output;
  }
  if (!isObject(condition)) return output;
  if (condition.when) flattenConditionLeaves(condition.when, output);
  if (condition.all !== undefined) flattenConditionLeaves(condition.all, output);
  if (condition.any !== undefined) flattenConditionLeaves(condition.any, output);
  if (condition.not !== undefined) flattenConditionLeaves(condition.not, output);
  if (["all", "any", "not"].includes(condition.op)) flattenConditionLeaves(compositeValues(condition), output);
  else if (condition.scope && condition.path && condition.op) output.push(condition);
  return output;
}

export function skillPointSupplyForLevel(level) {
  const normalizedLevel = Math.max(1, Math.floor(Number(level) || 1));
  return 2 + (normalizedLevel - 1);
}

function prerequisitesOf(skill) {
  if (!skill.prerequisites) return [];
  if (Array.isArray(skill.prerequisites)) return skill.prerequisites;
  return String(skill.prerequisites).split(",").map((value) => value.trim()).filter(Boolean);
}

function buildPrerequisiteDiagnostics(skills) {
  const skillMap = new Map(skills.map((skill) => [skill.id, skill]));
  const missing = [];
  for (const skill of skills) {
    for (const prerequisiteId of prerequisitesOf(skill)) {
      if (!skillMap.has(prerequisiteId)) missing.push({ skillId: skill.id, prerequisiteId });
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];
  function visit(id, stack = []) {
    if (visiting.has(id)) {
      cycles.push([...stack.slice(stack.indexOf(id)), id]);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const skill = skillMap.get(id);
    for (const prerequisiteId of prerequisitesOf(skill ?? {})) visit(prerequisiteId, [...stack, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const skill of skills) visit(skill.id);
  return { missing, cycles };
}

function collectConditionMetadata(skills) {
  const paths = new Map();
  for (const skill of skills) {
    for (const field of CONDITION_FIELDS) {
      for (const leaf of flattenConditionLeaves(skill[field])) {
        const pathKey = `${leaf.scope}.${leaf.path}`;
        const entry = paths.get(pathKey) ?? { scope: leaf.scope, path: leaf.path, leaves: [] };
        entry.leaves.push({ ...leaf, skillId: skill.id, field });
        paths.set(pathKey, entry);
      }
    }
  }
  return paths;
}

function numericTarget(entry) {
  const values = entry.leaves.flatMap((leaf) => {
    if (typeof leaf.value === "number") return [leaf.value];
    if (leaf.op === "between" && Array.isArray(leaf.value)) return leaf.value.filter(Number.isFinite);
    return [];
  });
  return values.length ? Math.max(...values.map(Math.abs), 1) : null;
}

function focusRate(profile, pathKey) {
  if (profile.focus.includes("*")) return 1.35;
  const lowered = pathKey.toLowerCase();
  if (profile.focus.some((token) => lowered.includes(token.toLowerCase()))) return 1.2;
  return 0.18;
}

function expectedSetValues(entry) {
  return [...new Set(entry.leaves.flatMap((leaf) => asValues(leaf.value)).filter((value) => typeof value !== "object"))];
}

function populateSyntheticState(state, profile, day, conditionMetadata, seed, grantPlan, equipmentGrantIds) {
  const progressRatio = (day - 1) / 99;
  for (const [pathKey, entry] of conditionMetadata) {
    if (pathKey === "player.level" || pathKey === "player.skills") continue;
    if (pathKey === "equipment.activeWeaponTypes") {
      setPathValue(state, entry.scope, entry.path, [...profile.weaponTypes]);
      continue;
    }
    if (pathKey === "equipment.grantedSkillIds") {
      const ids = [...equipmentGrantIds];
      const windowSize = profile.id === "completionist" ? 6 : 2;
      const offset = ids.length ? (day * 3 + stableHash(profile.id, seed)) % ids.length : 0;
      setPathValue(state, entry.scope, entry.path, ids.slice(offset, offset + windowSize));
      continue;
    }
    if (/\.grantedSkillIds$/.test(pathKey)) {
      const supplied = grantPlan.get(pathKey) ?? [];
      const available = supplied.filter((entryValue) => entryValue.day <= day).map((entryValue) => entryValue.skillId);
      setPathValue(state, entry.scope, entry.path, available);
      continue;
    }
    const target = numericTarget(entry);
    if (target !== null) {
      const rate = focusRate(profile, pathKey);
      const raw = target * progressRatio * rate;
      const integerLike = entry.leaves.every((leaf) => Number.isInteger(leaf.value));
      setPathValue(state, entry.scope, entry.path, integerLike ? Math.floor(raw) : raw);
      continue;
    }
    const expectedValues = expectedSetValues(entry);
    if (expectedValues.length) {
      const rate = focusRate(profile, pathKey);
      const included = expectedValues.filter((value) => {
        const unlockAt = 0.1 + 0.75 * stableUnit(`${profile.id}:${pathKey}:${value}`, seed);
        return progressRatio * rate >= unlockAt;
      });
      setPathValue(state, entry.scope, entry.path, included);
      continue;
    }
    const booleanTarget = entry.leaves.find((leaf) => ["isTrue", "isFalse"].includes(leaf.op));
    if (booleanTarget) setPathValue(state, entry.scope, entry.path, day >= 50);
  }
}

function buildGrantPlan(skills, profile, seed) {
  const plan = new Map();
  const eventSkills = skills.filter((skill) => skill.acquisitionCode === "event_granted");
  for (const [index, skill] of eventSkills.entries()) {
    const leaves = flattenConditionLeaves(skill.grantConditions);
    for (const leaf of leaves.filter((entry) => /\.grantedSkillIds$/.test(`${entry.scope}.${entry.path}`))) {
      const pathKey = `${leaf.scope}.${leaf.path}`;
      const categoryMatch = profile.categories.includes("*") || profile.categories.some((token) => String(skill.category).includes(token));
      const permitted = profile.id === "completionist" || (profile.id === "balanced" ? index % 13 === 0 : categoryMatch && index % 4 === 0);
      if (!permitted) continue;
      const day = profile.id === "completionist"
        ? 5 + Math.floor((index / Math.max(1, eventSkills.length - 1)) * 94)
        : 10 + Math.floor(stableUnit(`${profile.id}:${skill.id}`, seed) * 85);
      const values = plan.get(pathKey) ?? [];
      values.push({ skillId: skill.id, day });
      plan.set(pathKey, values);
    }
  }
  return plan;
}

function categoryScore(skill, profile, seed) {
  const category = `${skill.category ?? ""} ${skill.originalCategory ?? ""}`;
  const preferred = profile.categories.includes("*") || profile.categories.some((token) => category.includes(token));
  return (preferred ? 100 : 0) + Number(skill.rank ?? 0) * 2 - Number(skill.requiredLevel ?? 0) + stableUnit(`${profile.id}:${skill.id}`, seed);
}

function isSkillVisible(skill, state, coverage) {
  if (skill.acquisitionCode === "basic_level_up") return true;
  if (skill.acquisitionCode === "flag_unlocked") return evaluateConditions(skill.revealConditions, state, coverage);
  return false;
}

function isSkillUnlocked(skill, state, coverage) {
  if (skill.acquisitionCode === "basic_level_up") return evaluateConditions(skill.learnConditions, state, coverage);
  if (skill.acquisitionCode === "flag_unlocked") return evaluateConditions(skill.eventUnlockConditions, state, coverage);
  return false;
}

function canLearn(skill, state, learnedIds, coverage) {
  if (!evaluateConditions(skill.learnConditions, state, coverage)) return false;
  return prerequisitesOf(skill).every((id) => learnedIds.has(id));
}

function levelAtDay(day, maximumLevel) {
  return 1 + Math.floor(((day - 1) / 99) * (maximumLevel - 1));
}

function parseEquipmentGrantedIds(battle) {
  const rows = battle.tabs?.["装備性能マスター"]?.slice(4) ?? [];
  return new Set(rows.map((row) => row?.[23]).filter(Boolean));
}

function conditionDictionaryPaths(skillSupport) {
  const rows = skillSupport.tabs?.["イベントフラグ辞書"]?.slice(1) ?? [];
  return new Set(rows.filter((row) => row?.[0] && row?.[1]).map((row) => `${row[0]}.${row[1]}`));
}

function textualSkillReferences(snapshot) {
  return new Set(JSON.stringify(snapshot).match(/SKL-\d{4}/g) ?? []);
}

function simulateProfile({ skills, profile, conditionMetadata, equipmentGrantIds, seed, coverage }) {
  const permanentSkills = skills.filter((skill) => ["basic_level_up", "flag_unlocked"].includes(skill.acquisitionCode));
  const grantSkills = skills.filter((skill) => ["event_granted", "equipment_granted"].includes(skill.acquisitionCode));
  const grantPlan = buildGrantPlan(skills, profile, seed);
  const learnedIds = new Set();
  const everVisible = new Set();
  const everUnlocked = new Set();
  const everGranted = new Set();
  const learnConditionEverTrue = new Set();
  const grantConditionEverTrue = new Set();
  const milestones = [];
  let spSpent = 0;
  const state = { player: { level: 1, skills: [] } };

  for (let day = 1; day <= 100; day += 1) {
    const level = levelAtDay(day, profile.maxLevel);
    state.player.level = level;
    state.player.skills = [...learnedIds];
    populateSyntheticState(state, profile, day, conditionMetadata, seed, grantPlan, equipmentGrantIds);

    for (const skill of permanentSkills) {
      if (isSkillVisible(skill, state, coverage)) everVisible.add(skill.id);
      if (isSkillUnlocked(skill, state, coverage)) everUnlocked.add(skill.id);
      if (evaluateConditions(skill.learnConditions, state, coverage)) learnConditionEverTrue.add(skill.id);
    }
    for (const skill of grantSkills) {
      if (evaluateConditions(skill.grantConditions, state, coverage)) {
        everGranted.add(skill.id);
        grantConditionEverTrue.add(skill.id);
      }
    }

    let learnedThisPass = true;
    while (learnedThisPass && spSpent < skillPointSupplyForLevel(level)) {
      learnedThisPass = false;
      state.player.skills = [...learnedIds];
      const candidates = permanentSkills
        .filter((skill) => !learnedIds.has(skill.id) && canLearn(skill, state, learnedIds, coverage))
        .filter((skill) => Number(skill.spCost ?? 0) <= skillPointSupplyForLevel(level) - spSpent)
        .sort((left, right) => categoryScore(right, profile, seed) - categoryScore(left, profile, seed));
      const selected = candidates[0];
      if (selected) {
        learnedIds.add(selected.id);
        spSpent += Number(selected.spCost ?? 0);
        learnedThisPass = true;
      }
    }

    for (const skill of skills) {
      for (const field of ["activationConditions", "additionalEffectConditions"]) {
        if (skill[field]) evaluateConditions(skill[field], state, coverage);
      }
    }
    if ([1, 10, 25, 50, 75, 100].includes(day)) {
      milestones.push({
        day,
        level,
        spSupply: skillPointSupplyForLevel(level),
        spSpent,
        visible: everVisible.size,
        unlocked: everUnlocked.size,
        acquired: learnedIds.size,
        granted: everGranted.size,
      });
    }
  }

  return {
    id: profile.id,
    label: profile.label,
    maxLevel: profile.maxLevel,
    spSupply: skillPointSupplyForLevel(profile.maxLevel),
    spSpent,
    spRemaining: skillPointSupplyForLevel(profile.maxLevel) - spSpent,
    visibleCount: everVisible.size,
    unlockedCount: everUnlocked.size,
    acquiredCount: learnedIds.size,
    grantedCount: everGranted.size,
    acquiredSkillIds: [...learnedIds].sort(),
    learnConditionEverTrue: [...learnConditionEverTrue].sort(),
    grantConditionEverTrue: [...grantConditionEverTrue].sort(),
    milestones,
  };
}

export function auditSkillProgression({
  skills = loadSkills(),
  battle = loadBattleSnapshot(),
  world = loadWorldSnapshot(),
  skillSupport = loadSkillSupportSnapshot(),
  seed = 20260717,
  profiles = SYNTHETIC_PROFILE_SPECS,
} = {}) {
  const sortedSkills = [...skills].sort((left, right) => Number(left.no) - Number(right.no));
  const conditionMetadata = collectConditionMetadata(sortedSkills);
  const equipmentGrantIds = parseEquipmentGrantedIds(battle);
  const coverage = createConditionCoverage();
  const profileReports = profiles.map((profile) => simulateProfile({
    skills: sortedSkills,
    profile,
    conditionMetadata,
    equipmentGrantIds,
    seed,
    coverage,
  }));
  const classifications = {};
  for (const skill of sortedSkills) classifications[skill.acquisitionCode] = (classifications[skill.acquisitionCode] ?? 0) + 1;
  const learnable = sortedSkills.filter((skill) => ["basic_level_up", "flag_unlocked"].includes(skill.acquisitionCode));
  const witnessProfile = profiles.find((profile) => profile.id === "completionist") ?? SYNTHETIC_PROFILE_SPECS.at(-1);
  const witnessState = {
    player: {
      level: Math.max(24, witnessProfile.maxLevel),
      skills: learnable.map((skill) => skill.id),
    },
  };
  populateSyntheticState(
    witnessState,
    witnessProfile,
    100,
    conditionMetadata,
    seed,
    buildGrantPlan(sortedSkills, witnessProfile, seed),
    equipmentGrantIds,
  );
  witnessState.player.skills = learnable.map((skill) => skill.id);
  const prerequisiteDiagnostics = buildPrerequisiteDiagnostics(sortedSkills);
  const structurallyUnreachable = learnable
    .filter((skill) => !evaluateConditions(skill.learnConditions, witnessState))
    .map((skill) => ({
      skillId: skill.id,
      name: skill.name,
      acquisitionCode: skill.acquisitionCode,
      requiredLevel: skill.requiredLevel,
      paths: flattenConditionLeaves(skill.learnConditions).map((leaf) => `${leaf.scope}.${leaf.path}`),
    }));

  const equipmentClassified = sortedSkills.filter((skill) => skill.acquisitionCode === "equipment_granted");
  const unreferencedEquipmentSkills = equipmentClassified
    .filter((skill) => !equipmentGrantIds.has(skill.id))
    .map((skill) => ({ skillId: skill.id, name: skill.name }));
  const skillMap = new Map(sortedSkills.map((skill) => [skill.id, skill]));
  const equipmentReferenceMismatches = [...equipmentGrantIds]
    .filter((id) => skillMap.get(id)?.acquisitionCode !== "equipment_granted")
    .map((id) => ({ skillId: id, acquisitionCode: skillMap.get(id)?.acquisitionCode ?? "missing" }));

  const eventGranted = sortedSkills.filter((skill) => skill.acquisitionCode === "event_granted");
  const worldTextReferences = textualSkillReferences(world);
  const eventGrantPathCounts = {};
  for (const skill of eventGranted) {
    for (const leaf of flattenConditionLeaves(skill.grantConditions)) {
      const key = `${leaf.scope}.${leaf.path}`;
      eventGrantPathCounts[key] = (eventGrantPathCounts[key] ?? 0) + 1;
    }
  }
  const eventGrantUnsupplied = eventGranted.map((skill) => ({
    skillId: skill.id,
    name: skill.name,
    grantPaths: flattenConditionLeaves(skill.grantConditions).map((leaf) => `${leaf.scope}.${leaf.path}`),
    textuallyReferencedInWorld: worldTextReferences.has(skill.id),
  }));

  const dictionaryPaths = conditionDictionaryPaths(skillSupport);
  const skillConditionPaths = [...conditionMetadata.keys()].sort();
  const dictionaryMissingPaths = skillConditionPaths.filter((path) => !dictionaryPaths.has(path));
  const pathsWithBothOutcomes = Object.entries(coverage.byPath)
    .filter(([, entry]) => entry.true > 0 && entry.false > 0)
    .map(([path]) => path);
  const pathsNeverTrue = Object.entries(coverage.byPath)
    .filter(([, entry]) => entry.true === 0)
    .map(([path]) => path);

  return {
    seed,
    totals: {
      skills: sortedSkills.length,
      classifications,
      spAcquisitionCandidates: learnable.length,
      conditionPaths: skillConditionPaths.length,
      dictionaryPaths: dictionaryPaths.size,
    },
    spPolicy: {
      level1Supply: skillPointSupplyForLevel(1),
      perAdditionalLevel: 1,
      level24Supply: skillPointSupplyForLevel(24),
      totalCandidateCost: learnable.reduce((sum, skill) => sum + Number(skill.spCost ?? 0), 0),
    },
    profiles: profileReports,
    conditionCoverage: {
      ...coverage,
      pathsWithBothOutcomes,
      pathsNeverTrue,
      dictionaryMissingPaths,
    },
    diagnostics: {
      structurallyUnreachable,
      notAcquiredByAnyProfile: learnable
        .filter((skill) => !profileReports.some((profile) => profile.acquiredSkillIds.includes(skill.id)))
        .map((skill) => ({ skillId: skill.id, name: skill.name })),
      prerequisites: prerequisiteDiagnostics,
      equipmentGranted: {
        classifiedCount: equipmentClassified.length,
        equipmentMasterReferenceCount: equipmentGrantIds.size,
        unreferenced: unreferencedEquipmentSkills,
        referenceClassificationMismatches: equipmentReferenceMismatches,
      },
      eventGranted: {
        classifiedCount: eventGranted.length,
        structuredSourceCount: 0,
        pathCounts: eventGrantPathCounts,
        unsupplied: eventGrantUnsupplied,
        note: "world/battle snapshots contain no structured event/training/manual/contract grant source table",
      },
    },
  };
}

export const simulateSkillProgression = auditSkillProgression;
