import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import * as core from './battle-model-pre-normalization.mjs';

export * from './battle-model-pre-normalization.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RECOVERY_SNAPSHOT_PATH = path.resolve(
  HERE,
  '../../../docs/trpg/combat-sheet-revision20-snapshot.json.gz.b64',
);

/**
 * Public battle assumptions after canonical/runtime normalization.
 *
 * The pre-normalization implementation is kept in a deliberately named internal
 * module only so the rest of the battle engine can be migrated without an
 * unrelated rewrite. Public runtime actors do NOT apply its legacy 0.55 / 1.4
 * simulation multipliers.
 */
export const BATTLE_ASSUMPTIONS = Object.freeze({
  ...core.BATTLE_ASSUMPTIONS,
  monsterHpScale: 1,
  monsterOffenceScale: 1,
});

function normalizeMaterialBuyback(row) {
  const dropRateText = String(row['落ちる率'] ?? '').trim();
  return {
    id: row['素材ID'],
    baseCost: Number(row['原価G'] || 0),
    buybackPrice: Number(row['買取G'] || 0),
    cheapestSource: row['最安の出典'],
    referenceLevel: Number(row['基準Lv'] || 0),
    dropRatePct: dropRateText.endsWith('%') ? Number.parseFloat(dropRateText) : Number(dropRateText || 0),
    quantity: row['個数'],
    region: row['主地域'],
    sourceCount: Number(row['出典数'] || 0),
    raw: row,
  };
}

function attachCanonicalEconomy(data, battleSnapshot) {
  const materialRows = core.tableToRecords(battleSnapshot.tabs?.['素材買取価格'] ?? [], 0);
  const materialBuyback = materialRows.map(normalizeMaterialBuyback);
  data.materialBuyback = materialBuyback;
  data.materialBuybackById = new Map(materialBuyback.map((entry) => [entry.id, entry]));
  data.assumptions = BATTLE_ASSUMPTIONS;
  data.provenance = battleSnapshot.provenance ?? null;
  return data;
}

export function buildBattleData(battleSnapshot, playerSkills = [], bossCatalog = { version: null, bosses: [] }) {
  return attachCanonicalEconomy(
    core.buildBattleData(battleSnapshot, playerSkills, bossCatalog),
    battleSnapshot,
  );
}

async function loadRecoveredCanonicalSnapshot() {
  const encoded = (await fs.readFile(RECOVERY_SNAPSHOT_PATH, 'utf8')).trim();
  const recovered = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
  const tabs = Object.fromEntries(
    Object.entries(recovered.tabs ?? {}).map(([name, tab]) => [name, tab.values ?? []]),
  );
  const provenance = Object.fromEntries(
    Object.entries(recovered.tabs ?? {}).map(([name, tab]) => [name, {
      range: tab.range,
      rowCount: tab.rowCount,
      columnCount: tab.columnCount,
      sha256: tab.sha256,
    }]),
  );
  return {
    schemaVersion: '1.1.0',
    source: {
      ...(recovered.source ?? {}),
      url: 'https://docs.google.com/spreadsheets/d/1-2mUA20d7h1lmv1G9fCH0EryFEYyFQ2nkamN51uCPqw',
      valueRenderOption: 'UNFORMATTED_VALUE',
      aggregateSha256: recovered.aggregateSha256,
    },
    provenance,
    tabs,
  };
}

async function readPlayerSkillShards(fixtureDir) {
  const shardNames = [
    'skills-0001-0300.snapshot.json',
    'skills-0301-0600.snapshot.json',
    'skills-0601-0900.snapshot.json',
    'skills-0901-1141.snapshot.json',
  ];
  const shards = await Promise.all(shardNames.map(async (name) => (
    JSON.parse(await fs.readFile(path.join(fixtureDir, name), 'utf8'))
  )));
  return shards.flatMap((shard) => shard.skills ?? []);
}

export async function loadBattleData(fixtureDir = core.DEFAULT_FIXTURE_DIR) {
  const canonicalFixtureDir = path.resolve(core.DEFAULT_FIXTURE_DIR);
  const requestedFixtureDir = path.resolve(fixtureDir);
  const battleSnapshot = requestedFixtureDir === canonicalFixtureDir
    ? await loadRecoveredCanonicalSnapshot()
    : JSON.parse(await fs.readFile(path.join(fixtureDir, 'battle.snapshot.json'), 'utf8'));
  const bossCatalog = JSON.parse(
    await fs.readFile(path.join(fixtureDir, 'boss-combat-catalog.json'), 'utf8'),
  );
  const playerSkills = await readPlayerSkillShards(fixtureDir);
  return buildBattleData(battleSnapshot, playerSkills, bossCatalog);
}

/**
 * Canonical monster stats are now formal runtime values.
 * This explicit public constructor prevents revision20 from being scaled twice.
 */
export function createMonsterActor(monster, serial = 1) {
  const actor = core.createMonsterActor(monster, serial);
  const maxHp = Math.max(1, Math.round(Number(monster.maxHp || 0)));
  actor.maxHp = maxHp;
  actor.hp = maxHp;
  actor.physicalPower = Number(monster.physicalPower || 0);
  actor.magicPower = Number(monster.magicPower || 0);
  return actor;
}
