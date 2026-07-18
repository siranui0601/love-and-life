import crypto from "node:crypto";
import { loadBattleSnapshot, loadSkills, loadWorldSnapshot } from "../../../../tools/trpg-sim/lib/fixtures.mjs";
import { buildBattleData } from "../../../../tools/trpg-sim/lib/battle-model.mjs";
import { buildWorldModel } from "../../../../tools/trpg-sim/lib/world-model.mjs";

let cached = null;

function contentHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Loads the spreadsheet snapshots once. Saves are pinned to this revision so a
 * later sheet sync cannot silently reinterpret an existing command journal.
 */
export function loadTrpgGameData() {
  if (cached) return cached;
  const worldSnapshot = loadWorldSnapshot();
  const battleSnapshot = loadBattleSnapshot();
  const skills = loadSkills();
  const model = buildWorldModel(worldSnapshot);
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
      monsters: battleData.monsters.length,
      encounters: battleData.encounters.length,
      skills: skills.length,
    }),
  });
  return cached;
}

export function resetTrpgGameDataForTests() {
  cached = null;
}
