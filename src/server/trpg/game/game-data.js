import crypto from "node:crypto";
import { loadBattleSnapshot, loadSkills, loadWorldSnapshot } from "../../../../tools/trpg-sim/lib/fixtures.mjs";
import { buildBattleData } from "../../../../tools/trpg-sim/lib/battle-model.mjs";
import { buildWorldModel } from "../../../../tools/trpg-sim/lib/world-model.mjs";
import { applyCanonicalRuntimeExtensions } from "../content/canonical-runtime-extensions.js";
import { applyCanonicalWorldModelExtensions } from "../content/canonical-world-model-extensions.js";

let cached = null;

function contentHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Production battle data is built directly from the same checked-in canonical
 * artifact used by validators and simulators.  Historical battle bridges are
 * allowed to maintain world/skill compatibility only on a throwaway clone;
 * they never mutate the battle snapshot used to construct production actors.
 */
export function loadTrpgGameData() {
  if (cached) return cached;
  const worldSnapshot = loadWorldSnapshot();
  const battleSnapshot = loadBattleSnapshot();
  const skills = loadSkills();
  for (const skill of skills) if (!skill.skillId) skill.skillId = skill.id;

  const model = buildWorldModel(worldSnapshot);
  const compatibilityOnlyBattleClone = structuredClone(battleSnapshot);
  applyCanonicalRuntimeExtensions({
    worldSnapshot,
    battleSnapshot: compatibilityOnlyBattleClone,
    skills,
  });
  applyCanonicalWorldModelExtensions(model);

  const battleData = buildBattleData(battleSnapshot, skills);
  const contentRevision = contentHash({ worldSnapshot, battleSnapshot, skills }).slice(0, 24);
  cached = Object.freeze({
    contentRevision,
    model,
    battleData,
    skills,
    skillById: battleData.playerSkillById,
    counts: Object.freeze({
      locations: model.locations.length,
      facilities: model.facilities.length,
      npcs: model.npcs.length,
      troubles: model.troubles.length,
      equipment: battleData.equipment.length,
      stock: battleData.inventory.length,
      materialBuyback: battleData.materialBuyback.length,
      monsters: battleData.monsters.length,
      monsterSkills: battleData.monsterSkills.length,
      monsterActions: battleData.monsterActions.length,
      encounters: battleData.encounters.length,
      skills: skills.length,
    }),
  });
  return cached;
}

export function resetTrpgGameDataForTests() {
  cached = null;
}
