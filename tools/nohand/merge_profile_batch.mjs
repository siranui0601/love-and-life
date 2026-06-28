#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const DEFAULT_TARGET = 'public/noHand_soccer/emoji_physics_profiles.json';

function resolveRepoPath(repoRelativePath) {
  return path.resolve(REPO_ROOT, repoRelativePath);
}

async function readJson(repoRelativePath) {
  const raw = await readFile(resolveRepoPath(repoRelativePath), 'utf8');
  return JSON.parse(raw);
}

function formatProfileLine(emoji, profile, hasComma) {
  const suffix = hasComma ? ',' : '';
  return `    ${JSON.stringify(emoji)}: ${JSON.stringify(profile)}${suffix}`;
}

function stringifyProfileFile(profileFile) {
  const entries = Object.entries(profileFile.profiles);
  const lines = [];
  lines.push('{');
  lines.push('  "version": 1,');
  lines.push(`  "sourceCatalog": ${JSON.stringify(profileFile.sourceCatalog)},`);
  lines.push('  "profileRange": {');
  lines.push(`    "startIndex": ${profileFile.profileRange.startIndex},`);
  lines.push(`    "count": ${profileFile.profileRange.count}`);
  lines.push('  },');
  lines.push('  "rules": {');
  lines.push(`    "noKindTags": ${JSON.stringify(profileFile.rules.noKindTags)},`);
  lines.push(`    "ignoredCatalogFields": ${JSON.stringify(profileFile.rules.ignoredCatalogFields)},`);
  lines.push(`    "profileFields": ${JSON.stringify(profileFile.rules.profileFields)}`);
  lines.push('  },');
  lines.push('  "profiles": {');

  entries.forEach(([emoji, profile], index) => {
    lines.push(formatProfileLine(emoji, profile, index < entries.length - 1));
  });

  lines.push('  }');
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

function assertBatch(profileFile, batch) {
  if (!batch || typeof batch !== 'object') throw new Error('Batch must be a JSON object.');
  if (!batch.profiles || typeof batch.profiles !== 'object') throw new Error('Batch must include profiles object.');

  const existing = profileFile.profiles ?? {};
  const entries = Object.entries(batch.profiles);
  if (entries.length === 0) throw new Error('Batch profiles must not be empty.');

  for (const [emoji, profile] of entries) {
    if (existing[emoji]) throw new Error(`${emoji} already exists in target profiles.`);
    if (!profile?.sourceName) throw new Error(`${emoji} is missing sourceName.`);
    if (!profile?.displayNameJa) throw new Error(`${emoji} is missing displayNameJa.`);
  }
}

async function main() {
  const batchPath = process.argv[2];
  if (!batchPath) {
    console.error('Usage: node tools/nohand/merge_profile_batch.mjs <profile-batch.json> [target-profiles.json]');
    process.exitCode = 1;
    return;
  }

  const targetPath = process.argv[3] ?? DEFAULT_TARGET;
  const profileFile = await readJson(targetPath);
  const batch = await readJson(batchPath);
  assertBatch(profileFile, batch);

  const newProfiles = {
    ...profileFile.profiles,
    ...batch.profiles,
  };

  const nextProfileFile = {
    ...profileFile,
    profileRange: {
      ...profileFile.profileRange,
      count: Object.keys(newProfiles).length,
    },
    profiles: newProfiles,
  };

  await writeFile(resolveRepoPath(targetPath), stringifyProfileFile(nextProfileFile), 'utf8');
  console.log(`Merged ${Object.keys(batch.profiles).length} profiles into ${targetPath}.`);
  console.log(`profileRange.count = ${nextProfileFile.profileRange.count}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
