import { flattenConditionLeaves } from './skill-progression.mjs';

export const CHECKPOINT_C_ACQUISITION_COUNTS = Object.freeze({
  basic_level_up: 63,
  flag_unlocked: 436,
  event_granted: 325,
  equipment_granted: 162,
  non_skill: 42,
  deleted: 113,
});

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
    visiting.add(id);
    stack.push(id);
    for (const prerequisiteId of prerequisitesOf(byId.get(id))) if (byId.has(prerequisiteId)) visit(prerequisiteId);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }
  for (const skill of skills) visit(skill.id);
  return { missing, cycles };
}

function producerTrace(skill, resolver) {
  return flattenConditionLeaves(skill.grantConditions).map((leaf) => ({
    resolver,
    source: leaf.scope,
    path: leaf.path,
    operator: leaf.op,
    expected: leaf.value,
    producerClass: String(leaf.path ?? '').startsWith('events.') ? 'event'
      : String(leaf.path ?? '').startsWith('training.') ? 'training'
        : String(leaf.path ?? '').startsWith('manuals.') ? 'manual'
          : String(leaf.path ?? '').startsWith('contracts.') ? 'contract'
            : String(leaf.path ?? '').includes('grantedSkill') ? 'structured_grant'
              : 'condition',
  }));
}

export function eventGrantProducerTrace(skill) {
  return skill?.acquisitionCode === 'event_granted'
    ? producerTrace(skill, 'player-journey-base.grantEventSkills')
    : [];
}

export function equipmentGrantProducerTrace(skill) {
  return skill?.acquisitionCode === 'equipment_granted'
    ? producerTrace(skill, 'player-journey.equippedGrantedSkillIds')
    : [];
}

export function auditSkillAcquisitionCheckpointC(skills, battleData = null) {
  const counts = {};
  for (const skill of skills) counts[skill.acquisitionCode] = Number(counts[skill.acquisitionCode] ?? 0) + 1;
  const prerequisites = auditPrerequisites(skills);
  const eventProducerTrace = skills.filter((skill) => skill.acquisitionCode === 'event_granted').map((skill) => ({ skillId: skill.id, producers: eventGrantProducerTrace(skill) }));
  const equipmentProducerTrace = skills.filter((skill) => skill.acquisitionCode === 'equipment_granted').map((skill) => ({ skillId: skill.id, producers: equipmentGrantProducerTrace(skill) }));
  const eventWithoutProducer = eventProducerTrace.filter((entry) => entry.producers.length === 0);
  const equipmentWithoutProducer = equipmentProducerTrace.filter((entry) => entry.producers.length === 0);

  const equipmentReferences = new Map();
  for (const equipment of battleData?.equipment ?? []) {
    for (const skillId of [equipment.grantedSkillId, ...(equipment.grantedSkillIds ?? [])].filter(Boolean)) {
      const owners = equipmentReferences.get(skillId) ?? [];
      owners.push(equipment.id);
      equipmentReferences.set(skillId, owners);
    }
  }

  return {
    total: skills.length,
    counts,
    spCandidates: Number(counts.basic_level_up ?? 0) + Number(counts.flag_unlocked ?? 0),
    prerequisites,
    eventProducerTrace,
    eventWithoutProducer,
    equipmentProducerTrace,
    equipmentWithoutProducer,
    equipmentReferences,
    currentEquipmentReferenceCount: equipmentProducerTrace.filter((entry) => equipmentReferences.has(entry.skillId)).length,
  };
}
