#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');

const DEFAULT_CATALOG = 'public/noHand_soccer/emoji_catalog_full_ja.json';
const DEFAULT_PROFILES = 'public/noHand_soccer/emoji_physics_profiles.json';
const DEFAULT_OUT_DIR = 'tools/nohand/profile_queue';
const DEFAULT_BATCH_SIZE = 50;

function arg(name, fallback) {
  const exact = process.argv.indexOf(name);
  if (exact >= 0 && process.argv[exact + 1]) return process.argv[exact + 1];
  const pair = process.argv.find((value) => value.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function repoPath(file) {
  return path.resolve(REPO_ROOT, file);
}

async function readJson(file) {
  return JSON.parse(await readFile(repoPath(file), 'utf8'));
}

function pad(value) {
  return String(value).padStart(4, '0');
}

function queueItem(item, index) {
  return {
    ordinal: index + 1,
    catalogIndex: index,
    emoji: item.emoji,
    name: item.name,
  };
}

async function queueFiles(dir) {
  try {
    return await readdir(repoPath(dir));
  } catch {
    return [];
  }
}

async function profiledQueueEmoji(dir) {
  const done = new Set();
  for (const file of (await queueFiles(dir)).filter((name) => name.endsWith('.profiled.json'))) {
    const queue = await readJson(path.join(dir, file));
    for (const item of queue.sourceItems ?? []) {
      if (item?.emoji) done.add(item.emoji);
    }
    for (const emoji of Object.keys(queue.profiles ?? {})) {
      done.add(emoji);
    }
  }
  return done;
}

function runtimeEmoji(catalog, profileFile) {
  const count = Number(profileFile.profileRange?.count ?? 0);
  const safeCount = Math.max(0, Math.min(count, catalog.length));
  return new Set(catalog.slice(0, safeCount).map((item) => item.emoji));
}

function buildContinuousChunks(catalog, done, size) {
  const chunks = [];
  let current = [];

  function flush() {
    if (current.length > 0) chunks.push(current);
    current = [];
  }

  for (let index = 0; index < catalog.length; index += 1) {
    const item = catalog[index];
    if (done.has(item.emoji)) {
      flush();
      continue;
    }

    current.push(queueItem(item, index));
    if (current.length === size) flush();
  }

  flush();
  return chunks;
}

async function main() {
  const catalogPath = arg('--catalog', DEFAULT_CATALOG);
  const profilesPath = arg('--profiles', DEFAULT_PROFILES);
  const outDir = arg('--out-dir', DEFAULT_OUT_DIR);
  const batchSize = Number(arg('--size', String(DEFAULT_BATCH_SIZE)));
  const firstOnly = hasFlag('--first');

  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid --size: ${batchSize}`);
  }

  const catalog = await readJson(catalogPath);
  const profileFile = await readJson(profilesPath);
  const done = new Set([
    ...runtimeEmoji(catalog, profileFile),
    ...(await profiledQueueEmoji(outDir)),
  ]);

  const chunks = buildContinuousChunks(catalog, done, batchSize);
  const selected = firstOnly ? chunks.slice(0, 1) : chunks;

  await mkdir(repoPath(outDir), { recursive: true });

  for (const items of selected) {
    const first = items[0];
    const last = items[items.length - 1];
    const filename = `catalog_${pad(first.ordinal)}_${pad(last.ordinal)}.pending.json`;
    const queue = {
      version: 1,
      status: 'pending',
      sourceCatalog: catalogPath,
      sourceProfiles: profilesPath,
      generatedFromProfileRangeCount: profileFile.profileRange?.count ?? 0,
      generatedFromRuntimeProfileObjectCount: Object.keys(profileFile.profiles ?? {}).length,
      generatedFromProfiledQueueCount: done.size - runtimeEmoji(catalog, profileFile).size,
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
    await writeFile(repoPath(outPath), `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
