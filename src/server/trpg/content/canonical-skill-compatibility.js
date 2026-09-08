const SKILL_OVERRIDES = Object.freeze({
  "SKL-0050": { revealConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 5 }], eventUnlockConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 12 }, { scope: "progress", path: "combat.physicalKills", op: "gte", value: 5 }] },
  "SKL-0051": { revealConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 8 }], eventUnlockConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 16 }, { scope: "progress", path: "debuffs.stat.successfulApplications", op: "gte", value: 3 }] },
  "SKL-0052": { revealConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 4 }], eventUnlockConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 6 }, { scope: "progress", path: "combat.criticalHits", op: "gte", value: 2 }] },
  "SKL-0054": { revealConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 12 }], eventUnlockConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 24 }, { scope: "progress", path: "debuffs.stat.successfulApplications", op: "gte", value: 5 }] },
  "SKL-0055": { revealConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 4 }], eventUnlockConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 8 }, { scope: "progress", path: "combat.physicalSkillUses", op: "gte", value: 8 }] },
  "SKL-0056": { revealConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 12 }], eventUnlockConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 22 }, { scope: "progress", path: "combat.physicalKills", op: "gte", value: 8 }] },
  "SKL-0141": { revealConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 2 }], eventUnlockConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 3 }, { scope: "equipment", path: "activeWeaponTypes", op: "containsAny", value: ["shield"] }, { scope: "progress", path: "combat.physicalSkillUses", op: "gte", value: 6 }] },
  "SKL-0143": { revealConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 6 }], eventUnlockConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 8 }, { scope: "equipment", path: "activeWeaponTypes", op: "containsAny", value: ["shield"] }, { scope: "progress", path: "combat.physicalSkillUses", op: "gte", value: 18 }] },
  "SKL-0146": { revealConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 4 }], eventUnlockConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 6 }, { scope: "equipment", path: "activeWeaponTypes", op: "containsAny", value: ["shield"] }, { scope: "progress", path: "combat.physicalSkillUses", op: "gte", value: 12 }] },
  "SKL-0149": { revealConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 3 }], eventUnlockConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 5 }, { scope: "equipment", path: "activeWeaponTypes", op: "containsAny", value: ["shield"] }, { scope: "progress", path: "combat.physicalSkillUses", op: "gte", value: 10 }] },
});

function patchSkill(skill) {
  const patch = SKILL_OVERRIDES[skill?.skillId ?? skill?.id];
  if (!patch) return false;
  Object.assign(skill, patch);
  const structural = Array.isArray(skill.learnConditions)
    ? skill.learnConditions.filter((condition) => condition?.scope === "player" && ["level", "skills"].includes(condition?.path))
    : [];
  skill.learnConditions = structural.concat(patch.eventUnlockConditions);
  return true;
}

/**
 * Transitional player-skill-only compatibility.  This module cannot mutate
 * battle or world snapshots; it exists solely until these ten gates are moved
 * into the common skill Source of Truth/compiler.
 */
export function applyCanonicalSkillCompatibility(skills) {
  let skillsPatched = 0;
  for (const skill of skills) if (patchSkill(skill)) skillsPatched += 1;
  return { skillsPatched };
}

export const CANONICAL_SKILL_COMPATIBILITY_VERSION = "skill-only-v1-2026-08-18";
