import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BATTLE_ASSUMPTIONS,
  createMonsterActor,
  loadBattleData,
} from './lib/battle-model.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.resolve(ROOT, 'docs/trpg/combat-canonical-sync-v1.json');

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([value]) => value).sort();
}

const data = await loadBattleData();
const equipmentIds = data.equipment.map((entry) => entry.id);
const inventoryIds = data.inventory.map((entry) => entry.id);
const materialIds = data.materialBuyback.map((entry) => entry.id);
const equipmentIdSet = new Set(equipmentIds);
const materialIdSet = new Set(materialIds);
const stockOrphans = data.inventory
  .filter((entry) => !equipmentIdSet.has(entry.equipmentId))
  .map((entry) => ({ inventoryId: entry.id, equipmentId: entry.equipmentId }));
const materialDropIds = [...new Set(data.monsters.flatMap((monster) => (
  monster.drops.map((drop) => drop.itemId).filter((id) => String(id ?? '').startsWith('MAT_'))
)))].sort();
const missingMaterialBuyback = materialDropIds.filter((id) => !materialIdSet.has(id));
const orphanMaterialBuyback = materialIds.filter((id) => !materialDropIds.includes(id));

const actorMismatches = [];
for (const monster of data.monsters) {
  const actor = createMonsterActor(monster);
  if (
    actor.maxHp !== Math.max(1, Math.round(monster.maxHp))
    || actor.physicalPower !== monster.physicalPower
    || actor.magicPower !== monster.magicPower
  ) {
    actorMismatches.push({
      monsterId: monster.id,
      canonical: {
        maxHp: monster.maxHp,
        physicalPower: monster.physicalPower,
        magicPower: monster.magicPower,
      },
      runtime: {
        maxHp: actor.maxHp,
        physicalPower: actor.physicalPower,
        magicPower: actor.magicPower,
      },
    });
  }
}

const result = {
  schemaVersion: 'combat-canonical-sync-v1',
  generatedBy: 'tools/trpg-sim/audit-combat-canonical-sync.mjs',
  source: data.source,
  counts: {
    equipment: data.equipment.length,
    shopInventory: data.inventory.length,
    materialBuyback: data.materialBuyback.length,
    monsters: data.monsters.length,
    bosses: data.monsters.filter((monster) => monster.boss).length,
    monsterSkills: data.monsterSkills.length,
    monsterActions: data.monsterActions.length,
    encounters: data.encounters.length,
    playerSkillsLoaded: data.playerSkills.length,
  },
  integrity: {
    duplicateEquipmentIds: duplicates(equipmentIds),
    duplicateInventoryIds: duplicates(inventoryIds),
    duplicateMaterialIds: duplicates(materialIds),
    shopEquipmentOrphans: stockOrphans,
    missingMaterialBuyback,
    orphanMaterialBuyback,
  },
  runtimeScale: {
    monsterHpScale: BATTLE_ASSUMPTIONS.monsterHpScale,
    monsterOffenceScale: BATTLE_ASSUMPTIONS.monsterOffenceScale,
    canonicalActorMismatchCount: actorMismatches.length,
    actorMismatches,
  },
  provenance: data.provenance,
  routeReplay: false,
};

const expected = {
  equipment: 142,
  shopInventory: 149,
  materialBuyback: 61,
  monsters: 77,
  bosses: 9,
  monsterSkills: 96,
  monsterActions: 286,
  encounters: 76,
  playerSkillsLoaded: 1141,
};
const failures = [];
for (const [key, value] of Object.entries(expected)) {
  if (result.counts[key] !== value) failures.push(`${key}: expected ${value}, got ${result.counts[key]}`);
}
for (const [key, values] of Object.entries(result.integrity)) {
  if (values.length) failures.push(`${key}: ${values.length}`);
}
if (BATTLE_ASSUMPTIONS.monsterHpScale !== 1) failures.push('monsterHpScale must be 1');
if (BATTLE_ASSUMPTIONS.monsterOffenceScale !== 1) failures.push('monsterOffenceScale must be 1');
if (actorMismatches.length) failures.push(`canonical actor mismatches: ${actorMismatches.length}`);

await fs.writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures, result }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, output: path.relative(ROOT, OUT), counts: result.counts }, null, 2));
}
