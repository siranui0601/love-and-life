#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');

const CATALOG_PATH = 'public/noHand_soccer/emoji_catalog_full_ja.json';
const PROFILES_PATH = 'public/noHand_soccer/emoji_physics_profiles.json';
const QUEUE_DIR = 'tools/nohand/profile_queue';

const REQUIRED_ARRAY_FIELDS = ['receive', 'path', 'release', 'motion', 'effects', 'abilities'];
const REQUIRED_STRING_FIELDS = ['sourceName', 'displayNameJa', 'note'];
const DISALLOWED_PROFILE_TERMS = new Set([
  'animal',
  'food',
  'camera',
  'space',
  'person',
  'tool',
  'face',
  'symbol',
  'vehicle',
]);

function resolveRepoPath(repoRelativePath) {
  return path.resolve(REPO_ROOT, repoRelativePath);
}

async function readJson(repoRelativePath) {
  const raw = await readFile(resolveRepoPath(repoRelativePath), 'utf8');
  return JSON.parse(raw);
}

function fail(errors, message) {
  errors.push(message);
}

function checkArrayField(errors, emoji, profile, field) {
  const value = profile[field];
  if (!Array.isArray(value)) {
    fail(errors, `${emoji}: ${field} must be an array.`);
    return;
  }
  if (value.length === 0) {
    fail(errors, `${emoji}: ${field} must not be empty.`);
  }
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      fail(errors, `${emoji}: ${field} contains a non-string or empty entry.`);
      continue;
    }
    if (DISALLOWED_PROFILE_TERMS.has(entry)) {
      fail(errors, `${emoji}: ${field} contains disallowed classification term '${entry}'.`);
    }
  }
}

function validateProfiles(catalog, profileFile) {
  const errors = [];
  const warnings = [];
  const profiles = profileFile.profiles ?? {};
  const profileEntries = Object.entries(profiles);
  const profileCount = profileEntries.length;
  const declaredCount = profileFile.profileRange?.count;

  if (profileFile.profileRange?.startIndex !== 0) {
    fail(errors, `profileRange.startIndex must be 0, got ${profileFile.profileRange?.startIndex}.`);
  }

  if (declaredCount !== profileCount) {
    fail(errors, `profileRange.count (${declaredCount}) does not match profiles count (${profileCount}).`);
  }

  for (let index = 0; index < declaredCount; index += 1) {
    const catalogItem = catalog[index];
    if (!catalogItem) {
      fail(errors, `profileRange.count points past catalog length at index ${index}.`);
      continue;
    }
    if (!profiles[catalogItem.emoji]) {
      fail(errors, `Missing profile for catalog ordinal ${index + 1}: ${catalogItem.emoji} ${catalogItem.name}.`);
    }
  }

  const catalogByEmoji = new Map(catalog.map((item, catalogIndex) => [item.emoji, { item, catalogIndex }]));

  for (const [emoji, profile] of profileEntries) {
    const catalogHit = catalogByEmoji.get(emoji);
    if (!catalogHit) {
      fail(errors, `${emoji}: profile emoji does not exist in catalog.`);
      continue;
    }

    if (profile.sourceName !== catalogHit.item.name) {
      fail(errors, `${emoji}: sourceName '${profile.sourceName}' does not match catalog name '${catalogHit.item.name}'.`);
    }

    for (const field of REQUIRED_STRING_FIELDS) {
      if (typeof profile[field] !== 'string' || profile[field].trim() === '') {
        fail(errors, `${emoji}: ${field} must be a non-empty string.`);
      }
    }

    for (const field of REQUIRED_ARRAY_FIELDS) {
      checkArrayField(errors, emoji, profile, field);
    }

    if (typeof profile.confidence !== 'number' || profile.confidence < 0 || profile.confidence > 1) {
      fail(errors, `${emoji}: confidence must be a number between 0 and 1.`);
    }

    const holdOnlyAbilities = ['absorbHold', 'attractHold', 'grabHold', 'stillHold', 'trapHold', 'wrapHold', 'silenceHold'];
    if (
      Array.isArray(profile.abilities) &&
      profile.abilities.length > 0 &&
      profile.abilities.every((ability) => holdOnlyAbilities.includes(ability))
    ) {
      warnings.push(`${emoji}: abilities are hold-only; ensure release/path provide a terminal action.`);
    }
  }

  return { errors, warnings };
}

async function validateQueueFiles(catalog, profileFile) {
  const errors = [];
  const warnings = [];
  const profiles = profileFile.profiles ?? {};
  const profiledEmoji = new Set(Object.keys(profiles));
  const queueDir = resolveRepoPath(QUEUE_DIR);

  let files = [];
  try {
    files = await readdir(queueDir);
  } catch {
    warnings.push(`${QUEUE_DIR} does not exist yet.`);
    return { errors, warnings };
  }

  for (const filename of files.filter((file) => file.endsWith('.json'))) {
    const repoPath = path.join(QUEUE_DIR, filename);
    const queue = await readJson(repoPath);
    const items = queue.items ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      fail(errors, `${repoPath}: items must be a non-empty array.`);
      continue;
    }

    if (queue.range?.count !== items.length) {
      fail(errors, `${repoPath}: range.count does not match items length.`);
    }

    for (const item of items) {
      const catalogItem = catalog[item.catalogIndex];
      if (!catalogItem) {
        fail(errors, `${repoPath}: catalogIndex ${item.catalogIndex} is out of range.`);
        continue;
      }
      if (item.ordinal !== item.catalogIndex + 1) {
        fail(errors, `${repoPath}: ${item.emoji} ordinal must equal catalogIndex + 1.`);
      }
      if (item.emoji !== catalogItem.emoji || item.name !== catalogItem.name) {
        fail(errors, `${repoPath}: ${item.emoji} does not match catalog at index ${item.catalogIndex}.`);
      }
      if (profiledEmoji.has(item.emoji)) {
        fail(errors, `${repoPath}: ${item.emoji} is already profiled and should not be queued.`);
      }
      for (const forbidden of ['jaName', 'shopCategory', 'price', 'codepoints', 'baseCodepoint']) {
        if (Object.prototype.hasOwnProperty.call(item, forbidden)) {
          fail(errors, `${repoPath}: ${item.emoji} includes forbidden queue field '${forbidden}'.`);
        }
      }
    }
  }

  return { errors, warnings };
}

async function main() {
  const catalog = await readJson(CATALOG_PATH);
  const profileFile = await readJson(PROFILES_PATH);

  const profileResult = validateProfiles(catalog, profileFile);
  const queueResult = await validateQueueFiles(catalog, profileFile);
  const errors = [...profileResult.errors, ...queueResult.errors];
  const warnings = [...profileResult.warnings, ...queueResult.warnings];

  for (const warning of warnings) {
    console.warn(`warning: ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`error: ${error}`);
    }
    console.error(`Validation failed with ${errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }

  console.log('noHand profile validation passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
