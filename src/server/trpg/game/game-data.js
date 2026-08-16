import crypto from "node:crypto";
import { loadBattleSnapshot, loadSkills, loadWorldSnapshot } from "../../../../tools/trpg-sim/lib/fixtures.mjs";
import { buildBattleData } from "../../../../tools/trpg-sim/lib/battle-model.mjs";
import { buildWorldModel } from "../../../../tools/trpg-sim/lib/world-model.mjs";
import { applyCanonicalEncounterExtensions } from "../content/canonical-encounter-extensions.js";
import { applyCanonicalRuntimeExtensions } from "../content/canonical-runtime-extensions.js";
import { applyCanonicalWorldModelExtensions } from "../content/canonical-world-model-extensions.js";

let cached = null;

function contentHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Loads the spreadsheet snapshots once. Saves are pinned to this revision so a
 * later sheet sync cannot silently reinterpret an existing command journal.
 *
 * The checked-in world fixture keeps its original structural audit (103
 * facilities / 110 NPCs). Live canonical rows added on 2026-08-16 are bridged
 * only after that audit passes, while battle/skill rows are patched before
 * their models are built. Once snapshots are refreshed these bridges become
 * no-ops and can be deleted.
 */
export function loadTrpgGameData() {
  if (cached) return cached;
  const worldSnapshot = loadWorldSnapshot();
  const battleSnapshot = loadBattleSnapshot();
  const skills = loadSkills();
  for (const skill of skills) if (!skill.skillId) skill.skillId = skill.id;

  // Do not mutate the old world fixture until its own fixed-count audit passed.
  const model = buildWorldModel(worldSnapshot);
  applyCanonicalRuntimeExtensions({ worldSnapshot, battleSnapshot, skills });
  applyCanonicalEncounterExtensions(battleSnapshot);
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
