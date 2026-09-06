import { flattenConditionLeaves } from './skill-progression.mjs';

export const CHECKPOINT_C_ACQUISITION_COUNTS = Object.freeze({
  basic_level_up: 63,
  flag_unlocked: 436,
  event_granted: 325,
  equipment_granted: 162,
  non_skill: 42,
  deleted: 113,
});

const CONDITION_FIELDS = Object.freeze(['revealConditions', 'eventUnlockConditions', 'learnConditions', 'grantConditions', 'activationConditions']);
const SUPPORTED_PRODUCER_SCOPES = new Set(['progress', 'world', 'player']);
const SUPPORTED_PRODUCER_OPERATORS = new Set(['contains', 'containsAny', 'notContains', 'eq', 'gte', 'lte', 'gt', 'lt', 'isTrue', 'isFalse']);

function prerequisitesOf(skill) {
  if (!skill?.prerequisites) return [];
  return Array.isArray(skill.prerequisites)
    ? skill.prerequisites.filter(Boolean)
    : String(skill.prerequisites).split(',').map((value) => value.trim()).filter(Boolean);
}

export function auditPrerequisites(skills) {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const missing = [];
  for (const skill of skills) for (const prerequisiteId of prerequisitesOf(skill)) if (!byId.has(prerequisiteId)) missing.push({ skillId: skill.id, prerequisiteId });
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];
  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const index = stack.indexOf(id);
      cycles.push([...stack.slice(index), id]);
      return;
    }
    visiting.add(id); stack.push(id);
    for (const prerequisiteId of prerequisitesOf(byId.get(id))) if (byId.has(prerequisiteId)) visit(prerequisiteId);
    stack.pop(); visiting.delete(id); visited.add(id);
  }
  for (const skill of skills) visit(skill.id);
  return { missing, cycles };
}

function producerClass(leaf) {
  const path = String(leaf?.path ?? '');
  if (path.startsWith('events.')) return 'event';
  if (path.startsWith('training.')) return 'training';
  if (path.startsWith('manuals.')) return 'manual';
  if (path.startsWith('contracts.')) return 'contract';
  if (path.startsWith('eventSkillGrants.')) return 'event_theme';
  if (leaf?.scope === 'world' || path.startsWith('skillGrants.')) return 'world_event';
  if (path.includes('grantedSkill')) return 'structured_grant';
  return 'condition';
}

function producerId(leaf) {
  return `${producerClass(leaf).toUpperCase()}:${leaf.scope}.${leaf.path}`;
}

function producerTrace(skill, resolver) {
  return flattenConditionLeaves(skill.grantConditions).map((leaf) => ({
    resolver,
    producerId: producerId(leaf),
    source: leaf.scope,
    path: leaf.path,
    operator: leaf.op,
    expected: leaf.value,
    producerClass: producerClass(leaf),
    supported: SUPPORTED_PRODUCER_SCOPES.has(leaf.scope) && SUPPORTED_PRODUCER_OPERATORS.has(leaf.op),
  }));
}

export function eventGrantProducerTrace(skill) {
  return skill?.acquisitionCode === 'event_granted'
    ? producerTrace(skill, 'player-journey.grantEventSkillFromProducer')
    : [];
}

export function equipmentGrantProducerTrace(skill) {
  return skill?.acquisitionCode === 'equipment_granted'
    ? producerTrace(skill, 'player-journey.equippedGrantedSkillIds')
    : [];
}

function getPath(root, path) {
  let cursor = root;
  for (const segment of String(path ?? '').split('.').filter(Boolean)) {
    if (cursor === null || cursor === undefined) return undefined;
    cursor = cursor instanceof Map ? cursor.get(segment) : cursor[segment];
  }
  return cursor;
}

function setPath(root, path, value) {
  const segments = String(path ?? '').split('.').filter(Boolean);
  let cursor = root;
  for (const segment of segments.slice(0, -1)) {
    if (!cursor[segment] || typeof cursor[segment] !== 'object') cursor[segment] = {};
    cursor = cursor[segment];
  }
  cursor[segments.at(-1)] = value;
}

function scopeRoot(state, scope) {
  if (scope === 'progress') return state.progress;
  if (scope === 'world') return state.worldFlags;
  if (scope === 'player') return state.player;
  return null;
}

function values(value) { return Array.isArray(value) ? value : [value]; }

function satisfyLeaf(state, leaf) {
  const root = scopeRoot(state, leaf.scope);
  if (!root) return false;
  const current = getPath(root, leaf.path);
  switch (leaf.op) {
    case 'contains': {
      const set = current instanceof Set ? current : new Set(Array.isArray(current) ? current : []);
      set.add(leaf.value); setPath(root, leaf.path, set); return true;
    }
    case 'containsAny': {
      const set = current instanceof Set ? current : new Set(Array.isArray(current) ? current : []);
      const [first] = values(leaf.value); if (first !== undefined) set.add(first); setPath(root, leaf.path, set); return true;
    }
    case 'notContains': {
      const set = current instanceof Set ? current : new Set(Array.isArray(current) ? current : []);
      set.delete(leaf.value); setPath(root, leaf.path, set); return true;
    }
    case 'isTrue': setPath(root, leaf.path, true); return true;
    case 'isFalse': setPath(root, leaf.path, false); return true;
    case 'eq': setPath(root, leaf.path, leaf.value); return true;
    case 'gte': setPath(root, leaf.path, Math.max(Number(current ?? 0), Number(leaf.value))); return true;
    case 'gt': setPath(root, leaf.path, Math.max(Number(current ?? 0), Number(leaf.value) + 1)); return true;
    case 'lte': setPath(root, leaf.path, Math.min(Number.isFinite(Number(current)) ? Number(current) : Number(leaf.value), Number(leaf.value))); return true;
    case 'lt': setPath(root, leaf.path, Number(leaf.value) - 1); return true;
    default: return false;
  }
}

function leafSatisfied(state, leaf) {
  const root = scopeRoot(state, leaf.scope);
  if (!root) return false;
  const actual = getPath(root, leaf.path);
  switch (leaf.op) {
    case 'contains': return actual?.has?.(leaf.value) ?? actual?.includes?.(leaf.value) ?? false;
    case 'containsAny': return values(leaf.value).some((value) => actual?.has?.(value) ?? actual?.includes?.(value) ?? false);
    case 'notContains': return !(actual?.has?.(leaf.value) ?? actual?.includes?.(leaf.value) ?? false);
    case 'isTrue': return actual === true;
    case 'isFalse': return actual === false;
    case 'eq': return actual === leaf.value;
    case 'gte': return Number(actual) >= Number(leaf.value);
    case 'gt': return Number(actual) > Number(leaf.value);
    case 'lte': return Number(actual) <= Number(leaf.value);
    case 'lt': return Number(actual) < Number(leaf.value);
    default: return false;
  }
}

export function eventGrantProducerManifest(skills) {
  return skills.filter((skill) => skill.acquisitionCode === 'event_granted').map((skill) => {
    const producers = eventGrantProducerTrace(skill);
    const reachable = producers.length > 0 && producers.every((producer) => producer.supported);
    return {
      skillId: skill.id,
      name: skill.name,
      producers,
      producerIds: [...new Set(producers.map((producer) => producer.producerId))],
      reachable,
      classification: reachable ? 'VALID' : 'UNREACHABLE',
    };
  });
}

export function grantEventSkillFromProducer(state, skills, skillId, producer) {
  const skill = skills.find((entry) => entry.id === skillId);
  if (!skill) return { ok: false, reason: 'unknown_skill' };
  if (skill.acquisitionCode !== 'event_granted') return { ok: false, reason: 'not_event_granted' };
  const manifest = eventGrantProducerManifest([skill])[0];
  if (!manifest?.reachable) return { ok: false, reason: 'event_grant_unreachable', manifest };
  if (!manifest.producerIds.includes(producer)) return { ok: false, reason: 'invalid_event_producer', expectedProducerIds: manifest.producerIds };
  const leaves = flattenConditionLeaves(skill.grantConditions);
  for (const leaf of leaves) if (!satisfyLeaf(state, leaf)) return { ok: false, reason: 'unsupported_event_grant_condition', leaf };
  if (!leaves.every((leaf) => leafSatisfied(state, leaf))) return { ok: false, reason: 'event_grant_condition_not_committed' };
  if (!(state.player.skills instanceof Set)) state.player.skills = new Set(state.player.skills ?? []);
  state.player.skills.add(skill.id);
  state.progress.events ??= {};
  if (!(state.progress.events.grantedSkillIds instanceof Set)) state.progress.events.grantedSkillIds = new Set(state.progress.events.grantedSkillIds ?? []);
  state.progress.events.grantedSkillIds.add(skill.id);
  state.history ??= [];
  state.history.push({ type: 'SKILL_GRANTED_STRUCTURED', minute: state.absoluteMinute ?? 0, skillId: skill.id, producer });
  return { ok: true, skillId: skill.id, producer, classification: 'VALID' };
}

function conditionLeavesForSkill(skill) {
  return CONDITION_FIELDS.flatMap((field) => flattenConditionLeaves(skill[field]).map((leaf) => ({ ...leaf, field })));
}

function equipmentGateAudit(skill, battleData) {
  const leaves = conditionLeavesForSkill(skill).filter((leaf) => leaf.scope === 'equipment' && leaf.path === 'activeWeaponTypes');
  const expectedWeaponTypes = [...new Set(leaves.flatMap((leaf) => values(leaf.value)).filter(Boolean))];
  const missingWeaponTypes = expectedWeaponTypes.filter((weaponType) => !(battleData?.equipment ?? []).some((equipment) => equipment.weaponType === weaponType && equipment.status !== 'disabled'));
  return { leaves, expectedWeaponTypes, missingWeaponTypes, valid: missingWeaponTypes.length === 0 };
}

export function spCandidateManifest(skills, battleData = null) {
  const prerequisites = auditPrerequisites(skills);
  const missingBySkill = new Map(prerequisites.missing.map((entry) => [entry.skillId, entry]));
  const cycleIds = new Set(prerequisites.cycles.flat());
  return skills.filter((skill) => ['basic_level_up', 'flag_unlocked'].includes(skill.acquisitionCode)).map((skill) => {
    const gate = equipmentGateAudit(skill, battleData);
    const invalid = missingBySkill.has(skill.id) || cycleIds.has(skill.id) || !gate.valid;
    return {
      skillId: skill.id,
      name: skill.name,
      acquisitionCode: skill.acquisitionCode,
      requiredLevel: Number(skill.requiredLevel ?? 1),
      spCost: Math.max(1, Number(skill.spCost ?? 1)),
      prerequisiteIds: prerequisitesOf(skill),
      revealConditions: skill.revealConditions ?? [],
      unlockConditions: skill.eventUnlockConditions ?? [],
      learnConditions: skill.learnConditions ?? [],
      equipmentGate: gate,
      stateMachine: ['HIDDEN', 'REVEALED_LOCKED', 'LEARNABLE', 'LEARNED'],
      autoLearnAllowed: false,
      classification: invalid ? 'INVALID_WEAPON_GATE' : 'VALID',
    };
  });
}

export function auditSkillAcquisitionCheckpointC(skills, battleData = null) {
  const counts = {};
  for (const skill of skills) counts[skill.acquisitionCode] = Number(counts[skill.acquisitionCode] ?? 0) + 1;
  const prerequisites = auditPrerequisites(skills);
  const eventProducerTrace = skills.filter((skill) => skill.acquisitionCode === 'event_granted').map((skill) => ({ skillId: skill.id, producers: eventGrantProducerTrace(skill) }));
  const eventManifest = eventGrantProducerManifest(skills);
  const eventWithoutProducer = eventManifest.filter((entry) => entry.producers.length === 0);
  const equipmentProducerTrace = skills.filter((skill) => skill.acquisitionCode === 'equipment_granted').map((skill) => ({ skillId: skill.id, producers: equipmentGrantProducerTrace(skill) }));
  const equipmentWithoutProducer = equipmentProducerTrace.filter((entry) => entry.producers.length === 0);
  const equipmentReferences = new Map();
  for (const equipment of battleData?.equipment ?? []) {
    for (const skillId of [equipment.grantedSkillId, ...(equipment.grantedSkillIds ?? [])].filter(Boolean)) {
      const owners = equipmentReferences.get(skillId) ?? [];
      owners.push(equipment.id); equipmentReferences.set(skillId, owners);
    }
  }
  const equipmentManifest = skills.filter((skill) => skill.acquisitionCode === 'equipment_granted').map((skill) => ({
    skillId: skill.id,
    equipmentIds: equipmentReferences.get(skill.id) ?? [],
    lifecycle: ['UNEQUIPPED_INACTIVE', 'EQUIPPED_ACTIVE', 'UNEQUIPPED_INACTIVE'],
    persistentLearned: false,
    classification: equipmentReferences.has(skill.id) ? 'VALID' : 'UNREACHABLE',
  }));
  const spManifest = spCandidateManifest(skills, battleData);
  return {
    total: skills.length,
    counts,
    spCandidates: spManifest.length,
    spManifest,
    prerequisites,
    eventProducerTrace,
    eventManifest,
    eventWithoutProducer,
    eventUnreachable: eventManifest.filter((entry) => !entry.reachable),
    equipmentProducerTrace,
    equipmentWithoutProducer,
    equipmentManifest,
    equipmentReferences,
    currentEquipmentReferenceCount: equipmentManifest.filter((entry) => entry.classification === 'VALID').length,
  };
}

export function classifyAllPlayerSkillsCheckpointC(skills, battleData, runtimeFamilyStatusByFamily = new Map()) {
  const acquisition = auditSkillAcquisitionCheckpointC(skills, battleData);
  const sp = new Map(acquisition.spManifest.map((entry) => [entry.skillId, entry]));
  const events = new Map(acquisition.eventManifest.map((entry) => [entry.skillId, entry]));
  const equipment = new Map(acquisition.equipmentManifest.map((entry) => [entry.skillId, entry]));
  return skills.map((skill) => {
    if (skill.acquisitionCode === 'deleted') return { skillId: skill.id, classification: 'DELETED', acquisitionCode: skill.acquisitionCode };
    if (skill.acquisitionCode === 'non_skill') return { skillId: skill.id, classification: 'NON_SKILL', acquisitionCode: skill.acquisitionCode };
    const missingFamily = (skill.runtimeMechanics ?? []).find((entry) => runtimeFamilyStatusByFamily.size && runtimeFamilyStatusByFamily.get(entry.family) !== 'EXECUTED');
    if (missingFamily) return { skillId: skill.id, classification: 'MISSING_HANDLER', acquisitionCode: skill.acquisitionCode, family: missingFamily.family };
    if (sp.has(skill.id)) return { skillId: skill.id, classification: sp.get(skill.id).classification, acquisitionCode: skill.acquisitionCode };
    if (events.has(skill.id)) return { skillId: skill.id, classification: events.get(skill.id).classification, acquisitionCode: skill.acquisitionCode };
    if (equipment.has(skill.id)) return { skillId: skill.id, classification: equipment.get(skill.id).classification, acquisitionCode: skill.acquisitionCode };
    return { skillId: skill.id, classification: 'DEAD_SKILL', acquisitionCode: skill.acquisitionCode };
  });
}
