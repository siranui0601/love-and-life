import crypto from "node:crypto";
import { loadBattleSnapshot, loadSkills, loadWorldSnapshot } from "../../../../tools/trpg-sim/lib/fixtures.mjs";
import { buildBattleData } from "../../../../tools/trpg-sim/lib/battle-model.mjs";
import { buildWorldModel } from "../../../../tools/trpg-sim/lib/world-model.mjs";
import { applyCanonicalRuntimeExtensions } from "../content/canonical-runtime-extensions.js";

let cached = null;

function contentHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Loads the spreadsheet snapshots once. Saves are pinned to this revision so a
 * later sheet sync cannot silently reinterpret an existing command journal.
 *
 * The live masters can advance ahead of the checked-in fixtures while a design
 * PR is in flight. applyCanonicalRuntimeExtensions is an idempotent bridge for
 * rows already committed to the canonical Sheets; after fixture refresh those
 * upserts simply replace identical rows.
 */
export function loadTrpgGameData() {
  if (cached) return cached;
  const worldSnapshot = loadWorldSnapshot();
  const battleSnapshot = loadBattleSnapshot();
  const skills = loadSkills();
  // Older skill fixtures expose `id`; the live v4 sheet and bridge use the
  // explicit `skillId` name as well. Keep both until the next snapshot refresh.
  for (const skill of skills) if (!skill.skillId) skill.skillId = skill.id;
  applyCanonicalRuntimeExtensions({ worldSnapshot, battleSnapshot, skills });
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
