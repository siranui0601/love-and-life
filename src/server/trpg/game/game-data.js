import crypto from "node:crypto";
import { loadBattleSnapshot, loadBossCombatCatalog, loadSkills, loadWorldSnapshot } from "../../../../tools/trpg-sim/lib/fixtures.mjs";
import { buildBattleData } from "../../../../tools/trpg-sim/lib/battle-model.mjs";
import { buildWorldModel } from "../../../../tools/trpg-sim/lib/world-model.mjs";
import { applyCanonicalSkillCompatibility } from "../content/canonical-skill-compatibility.js";
import { applyCanonicalWorldModelExtensions } from "../content/canonical-world-model-extensions.js";

let cached = null;

function contentHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Production battle data is built directly from the checked-in canonical
 * battle artifact. World compatibility is applied only after the base world
 * fixture passes its structural audit; player-skill compatibility is scoped to
 * the skill definitions and neither bridge can mutate battleSnapshot.
 */
export function loadTrpgGameData() {
  if (cached) return cached;
  const worldSnapshot = loadWorldSnapshot();
  const battleSnapshot = loadBattleSnapshot();
  const bossCombatCatalog = loadBossCombatCatalog();
  const skills = loadSkills();
  for (const skill of skills) if (!skill.skillId) skill.skillId = skill.id;

  applyCanonicalSkillCompatibility(skills);

  const model = buildWorldModel(worldSnapshot);
  applyCanonicalWorldModelExtensions(model);

  const battleData = buildBattleData(battleSnapshot, skills, bossCombatCatalog);
  const contentRevision = contentHash({ worldSnapshot, battleSnapshot, bossCombatCatalog, skills }).slice(0, 24);
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
      bosses: battleData.bossByMonsterId.size,
    }),
  });
  return cached;
}

export function resetTrpgGameDataForTests() {
  cached = null;
}
