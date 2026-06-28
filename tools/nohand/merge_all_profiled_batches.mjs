#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');

const DEFAULT_QUEUE_DIR = 'tools/nohand/profile_queue';
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

function readArg(name, fallback = null) {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0 && process.argv[exactIndex + 1]) return process.argv[exactIndex + 1];
  const paired = process.argv.find((arg) => arg.startsWith(prefix));
  return paired ? paired.slice(prefix.length) : fallback;
}

function assertProfiledQueue(file, queue) {
  if (queue.status !== 'profiled') {
    throw new Error(`${file}: expected status='profiled'.`);
  }
  if (!Array.isArray(queue.sourceItems) || queue.sourceItems.length === 0) {
    throw new Error(`${file}: profiled queue must include sourceItems.`);
  }
  if (!queue.profiles || typeof queue.profiles !== 'object') {
    throw new Error(`${file}: profiled queue must include profiles.`);
  }

  for (const item of queue.sourceItems) {
    if (!queue.profiles[item.emoji]) {
      throw new Error(`${file}: missing profile for ${item.emoji}.`);
    }
  }
}

async function main() {
  const queueDir = readArg('--queue-dir', DEFAULT_QUEUE_DIR);
  const targetPath = readArg('--target', DEFAULT_TARGET);
  const profileFile = await readJson(targetPath);
  const existingProfiles = profileFile.profiles ?? {};

  const filenames = (await readdir(resolveRepoPath(queueDir)))
    .filter((file) => file.endsWith('.profiled.json'))
    .sort();

  if (filenames.length === 0) {
    console.log('No profiled queue files to merge.');
    return;
  }

  const profiledQueues = [];
  for (const filename of filenames) {
    const repoPath = path.join(queueDir, filename);
    const queue = await readJson(repoPath);
    assertProfiledQueue(repoPath, queue);
    profiledQueues.push({ filename, queue });
  }

  profiledQueues.sort((a, b) => a.queue.range.startOrdinal - b.queue.range.startOrdinal);

  const mergedProfiles = { ...existingProfiles };
  for (const { filename, queue } of profiledQueues) {
    for (const item of queue.sourceItems) {
      if (mergedProfiles[item.emoji]) {
        throw new Error(`${filename}: ${item.emoji} already exists in ${targetPath}.`);
      }
      mergedProfiles[item.emoji] = queue.profiles[item.emoji];
    }
  }

  const nextProfileFile = {
    ...profileFile,
    profileRange: {
      ...profileFile.profileRange,
      count: Object.keys(mergedProfiles).length,
    },
    profiles: mergedProfiles,
  };

  await writeFile(resolveRepoPath(targetPath), stringifyProfileFile(nextProfileFile), 'utf8');
  console.log(`Merged ${filenames.length} profiled queue file(s) into ${targetPath}.`);
  console.log(`profileRange.count = ${nextProfileFile.profileRange.count}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
