const CLASSIFICATIONS = Object.freeze([
  'VALID_REACHABLE',
  'CONDITION_UNREACHABLE',
  'MISSING_SKILL',
  'INVALID_CONDITION',
  'BLOCKED_BY_RESOURCE',
  'NEVER_CANDIDATE',
  'CORRUPT',
]);

const STRUCTURED_OPS = new Set(['eq', '==', 'ne', '!=', 'gte', '>=', 'lte', '<=', 'gt', '>', 'lt', '<', 'contains', 'containsAny', 'isTrue']);

function compareRangeCanMatch({ min, max }, operator, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return true;
  switch (operator) {
    case '>': return max > numeric;
    case '>=': return max >= numeric;
    case '<': return min < numeric;
    case '<=': return min <= numeric;
    case '==': return min <= numeric && numeric <= max;
    case '!=': return min !== max || min !== numeric;
    default: return true;
  }
}

function scalarDomain(path) {
  if (/\.(?:hpRatio|mpRatio)$/.test(path)) return { min: 0, max: 1 };
  if (/\.agilityStage$/.test(path) || /\.modifiers\.[A-Za-z_]+$/.test(path)) return { min: -6, max: 6 };
  if (path === 'battle.turn') return { min: 1, max: Number.POSITIVE_INFINITY };
  if (path === 'battle.enemyCount' || path === 'battle.allyCount') return { min: 1, max: Number.POSITIVE_INFINITY };
  return null;
}

function inspectActionCondition(expression) {
  if (!expression) return { valid: true, reachable: true, reason: 'unconditional' };
  const text = String(expression).trim();

  if (/^(self|target|ally)\.(specialStates|debuffs)\.(contains|notContains)\('([^']+)'\)$/.test(text)) {
    return { valid: true, reachable: true, reason: 'state_witness' };
  }

  const count = text.match(/^(self|target|ally)\.(specialStates|debuffs)\.count(==|>=|<=|>|<)(\d+(?:\.\d+)?)$/);
  if (count) {
    const value = Number(count[4]);
    const reachable = compareRangeCanMatch({ min: 0, max: Number.POSITIVE_INFINITY }, count[3], value);
    return { valid: true, reachable, reason: reachable ? 'collection_count_witness' : 'impossible_collection_count' };
  }

  const modulo = text.match(/^battle\.turn%(\d+)==(\d+)$/);
  if (modulo) {
    const divisor = Number(modulo[1]);
    const remainder = Number(modulo[2]);
    const reachable = divisor > 0 && remainder >= 0 && remainder < divisor;
    return { valid: true, reachable, reason: reachable ? 'turn_modulo_witness' : 'impossible_turn_modulo' };
  }

  const scalar = text.match(/^([A-Za-z_.]+)(==|!=|>=|<=|>|<)(true|false|-?\d+(?:\.\d+)?|'.*')$/);
  if (!scalar) return { valid: false, reachable: false, reason: 'unsupported_dsl_syntax' };

  const [, path, operator, rawValue] = scalar;
  const knownPath = /^(self|target|ally)\.(hpRatio|mpRatio|agilityStage|lastActionTag)$/.test(path)
    || /^(self|target|ally)\.modifiers\.[A-Za-z_]+$/.test(path)
    || /^battle\.(turn|enemyCount|allyCount)$/.test(path)
    || path === 'history.playerLastSkillRepeatable';
  if (!knownPath) return { valid: false, reachable: false, reason: `unsupported_dsl_path:${path}` };

  const domain = scalarDomain(path);
  if (!domain) return { valid: true, reachable: true, reason: 'scalar_witness' };
  const value = Number(rawValue.replace(/^'|'$/g, ''));
  const reachable = compareRangeCanMatch(domain, operator, value);
  return { valid: true, reachable, reason: reachable ? 'scalar_range_witness' : 'outside_runtime_domain' };
}

function inspectStructuredCondition(condition) {
  if (!condition || typeof condition !== 'object') return { valid: false, reachable: false, reason: 'condition_not_object' };
  if (!STRUCTURED_OPS.has(condition.op)) return { valid: false, reachable: false, reason: `unsupported_op:${condition.op}` };
  const path = `${condition.scope}.${condition.path}`;
  const known = [
    'self.hpRatio', 'self.mpRatio', 'self.debuffs', 'self.specialStates', 'self.debuffCount',
    'target.hpRatio', 'target.mpRatio', 'target.debuffs', 'target.specialStates', 'target.debuffCount',
    'battle.turn', 'battle.enemyCount', 'battle.allyCount', 'battle.alliesAlive', 'battle.ownedFieldEffectCount',
    'field.tags', 'equipment.activeWeaponTypes', 'history.lastSkillId', 'history.lastSkillRepeatable',
  ].includes(path) || condition.scope === 'world';
  if (!known) return { valid: false, reachable: false, reason: `unsupported_structured_path:${path}` };

  const domain = scalarDomain(path === 'battle.alliesAlive' ? 'battle.allyCount' : path);
  if (domain && ['gt', '>', 'gte', '>=', 'lt', '<', 'lte', '<=', 'eq', '==', 'ne', '!='].includes(condition.op)) {
    const operator = ({ gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '==', ne: '!=' })[condition.op] ?? condition.op;
    const reachable = compareRangeCanMatch(domain, operator, condition.value);
    return { valid: true, reachable, reason: reachable ? 'structured_range_witness' : 'outside_runtime_domain' };
  }
  return { valid: true, reachable: true, reason: 'structured_witness' };
}

function effectiveCooldown(action, skill) {
  return Number(action.cooldownOverride ?? skill?.cooldown ?? 0);
}

function permanentlyDominates(data, targetAction, sibling) {
  if (sibling.id === targetAction.id) return false;
  if (sibling.priority <= targetAction.priority + Number(data.assumptions.enemyPriorityBand ?? 20)) return false;
  if (sibling.baseWeight <= 0 || sibling.condition) return false;
  if (sibling.usesPerBattle !== null && sibling.usesPerBattle !== undefined) return false;
  const skill = data.monsterSkillById.get(sibling.skillId);
  if (!skill || skill.mpCost > 0 || effectiveCooldown(sibling, skill) > 0) return false;
  if ((skill.conditions ?? []).length) return false;
  return true;
}

export function classifyEnemyAction(data, action) {
  if (!action?.id || !action.monsterId || !action.skillId) {
    return { classification: 'CORRUPT', reason: 'missing_required_identifier' };
  }
  const monster = data.monsterById.get(action.monsterId);
  if (!monster) return { classification: 'CORRUPT', reason: 'missing_monster' };
  const skill = data.monsterSkillById.get(action.skillId);
  if (!skill) return { classification: 'MISSING_SKILL', reason: 'skill_link_not_found' };
  if (skill.implementationStatus !== 'runtime_ready') {
    return { classification: 'CORRUPT', reason: `skill_not_runtime_ready:${skill.implementationStatus}` };
  }
  const unsupportedCommand = data.audit.unknownCommands.find((entry) => entry.skillId === skill.id);
  const unsupportedState = data.audit.unknownSpecialStateSemantics.find((entry) => entry.skillId === skill.id);
  const unsupportedDebuff = data.audit.unknownDebuffSemantics.find((entry) => entry.skillId === skill.id);
  if (unsupportedCommand || unsupportedState || unsupportedDebuff || (skill.commands ?? []).some((command) => !command?.command)) {
    return { classification: 'CORRUPT', reason: 'skill_has_unsupported_runtime_semantics' };
  }

  const actionCondition = inspectActionCondition(action.condition);
  if (!actionCondition.valid) return { classification: 'INVALID_CONDITION', reason: actionCondition.reason };
  if (!actionCondition.reachable) return { classification: 'CONDITION_UNREACHABLE', reason: actionCondition.reason };
  for (const condition of skill.conditions ?? []) {
    const inspected = inspectStructuredCondition(condition);
    if (!inspected.valid) return { classification: 'INVALID_CONDITION', reason: inspected.reason };
    if (!inspected.reachable) return { classification: 'CONDITION_UNREACHABLE', reason: inspected.reason };
  }

  if (Number(skill.mpCost ?? 0) > Number(monster.maxMp ?? 0)) {
    return { classification: 'BLOCKED_BY_RESOURCE', reason: `mp_cost_${skill.mpCost}_gt_max_${monster.maxMp}` };
  }
  if (Number(action.baseWeight ?? 0) <= 0) return { classification: 'NEVER_CANDIDATE', reason: 'non_positive_weight' };
  if (action.usesPerBattle !== null && action.usesPerBattle !== undefined && Number(action.usesPerBattle) <= 0) {
    return { classification: 'NEVER_CANDIDATE', reason: 'non_positive_battle_use_limit' };
  }
  const siblings = data.actionsByMonsterId.get(action.monsterId) ?? [];
  const dominator = siblings.find((candidate) => permanentlyDominates(data, action, candidate));
  if (dominator) return { classification: 'NEVER_CANDIDATE', reason: `permanent_priority_dominator:${dominator.id}` };

  return { classification: 'VALID_REACHABLE', reason: actionCondition.reason };
}

export function auditEnemyActionReachability(data) {
  const rows = data.monsterActions.map((action) => ({
    actionId: action.id,
    monsterId: action.monsterId,
    skillId: action.skillId,
    ...classifyEnemyAction(data, action),
  }));
  const counts = Object.fromEntries(CLASSIFICATIONS.map((name) => [name, 0]));
  for (const row of rows) counts[row.classification] += 1;
  return {
    total: rows.length,
    unknown: rows.filter((row) => !CLASSIFICATIONS.includes(row.classification)).length,
    counts,
    rows,
  };
}

export { CLASSIFICATIONS as ENEMY_ACTION_CLASSIFICATIONS };
