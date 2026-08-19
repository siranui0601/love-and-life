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
  for (const skill of skills) {
    for (const prerequisiteId of prerequisitesOf(skill)) {
      if (!byId.has(prerequisiteId)) missing.push({ skillId: skill.id, prerequisiteId });
    }
  }
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

export function eventGrantProducerTrace(skill) {
  if (skill?.acquisitionCode !== 'event_granted') return [];
  return flattenConditionLeaves(skill.grantConditions).map((leaf) => ({
    resolver: 'player-journey-base.grantEventSkills',
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

export function auditSkillAcquisitionCheckpointC(skills, battleData = null) {
  const counts = {};
  for (const skill of skills) counts[skill.acquisitionCode] = Number(counts[skill.acquisitionCode] ?? 0) + 1;
  const prerequisites = auditPrerequisites(skills);
  const eventGranted = skills.filter((skill) => skill.acquisitionCode === 'event_granted');
  const eventProducerTrace = eventGranted.map((skill) => ({
    skillId: skill.id,
    producers: eventGrantProducerTrace(skill),
  }));
  const eventWithoutProducer = eventProducerTrace.filter((entry) => entry.producers.length === 0);

  const equipmentRows = battleData?.equipment ?? [];
  const equipmentReferences = new Map();
  for (const equipment of equipmentRows) {
    const ids = [equipment.grantedSkillId, ...(equipment.grantedSkillIds ?? [])].filter(Boolean);
    for (const skillId of ids) {
      const owners = equipmentReferences.get(skillId) ?? [];
      owners.push(equipment.id);
      equipmentReferences.set(skillId, owners);
    }
  }
  const equipmentGranted = skills.filter((skill) => skill.acquisitionCode === 'equipment_granted');
  const unreferencedEquipmentGrants = battleData
    ? equipmentGranted.filter((skill) => !equipmentReferences.has(skill.id)).map((skill) => skill.id)
    : [];

  return {
    total: skills.length,
    counts,
    spCandidates: Number(counts.basic_level_up ?? 0) + Number(counts.flag_unlocked ?? 0),
    prerequisites,
    eventProducerTrace,
    eventWithoutProducer,
    equipmentReferences,
    unreferencedEquipmentGrants,
  };
}
