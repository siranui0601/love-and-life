#!/usr/bin/env node
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');

const DEFAULT_CATALOG = 'public/noHand_soccer/emoji_catalog_full_ja.json';
const DEFAULT_PROFILES = 'public/noHand_soccer/emoji_physics_profiles.json';
const DEFAULT_OUT_DIR = 'tools/nohand/profile_queue';
const DEFAULT_BATCH_SIZE = 50;

function readArg(name, fallback = null) {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0 && process.argv[exactIndex + 1]) return process.argv[exactIndex + 1];
  const paired = process.argv.find((arg) => arg.startsWith(prefix));
  return paired ? paired.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function resolveRepoPath(repoRelativePath) {
  return path.resolve(REPO_ROOT, repoRelativePath);
}

async function readJson(repoRelativePath) {
  const raw = await readFile(resolveRepoPath(repoRelativePath), 'utf8');
  return JSON.parse(raw);
}

function padOrdinal(value) {
  return String(value).padStart(4, '0');
}

function toQueueItem(catalogItem, catalogIndex) {
  return {
    ordinal: catalogIndex + 1,
    catalogIndex,
    emoji: catalogItem.emoji,
    name: catalogItem.name,
  };
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function main() {
  const catalogPath = readArg('--catalog', DEFAULT_CATALOG);
  const profilesPath = readArg('--profiles', DEFAULT_PROFILES);
  const outDir = readArg('--out-dir', DEFAULT_OUT_DIR);
  const batchSize = Number(readArg('--size', String(DEFAULT_BATCH_SIZE)));
  const firstOnly = hasFlag('--first');

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid --size: ${batchSize}`);
  }

  const catalog = await readJson(catalogPath);
  const profileFile = await readJson(profilesPath);
  const profiles = profileFile.profiles ?? {};
  const profiledEmoji = new Set(Object.keys(profiles));

  const missing = catalog
    .map((item, catalogIndex) => ({ item, catalogIndex }))
    .filter(({ item }) => !profiledEmoji.has(item.emoji))
    .map(({ item, catalogIndex }) => toQueueItem(item, catalogIndex));

  if (missing.length === 0) {
    console.log('No unprofiled emoji remain.');
    return;
  }

  const chunks = firstOnly ? [missing.slice(0, batchSize)] : chunkItems(missing, batchSize);
  await mkdir(resolveRepoPath(outDir), { recursive: true });

  for (const items of chunks) {
    const first = items[0];
    const last = items[items.length - 1];
    const filename = `catalog_${padOrdinal(first.ordinal)}_${padOrdinal(last.ordinal)}.pending.json`;
    const queue = {
      version: 1,
      status: 'pending',
      sourceCatalog: catalogPath,
      sourceProfiles: profilesPath,
      generatedFromProfileCount: Object.keys(profiles).length,
      range: {
        startOrdinal: first.ordinal,
        endOrdinal: last.ordinal,
        startCatalogIndex: first.catalogIndex,
        endCatalogIndex: last.catalogIndex,
        count: items.length,
      },
      itemFields: ['ordinal', 'catalogIndex', 'emoji', 'name'],
      items,
    };

    const outPath = path.join(outDir, filename);
    await writeFile(resolveRepoPath(outPath), `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
