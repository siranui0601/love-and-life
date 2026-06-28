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
const ABILITY_SPECS_PATH = 'tools/nohand/ability_specs.json';

const REQUIRED_ARRAY_FIELDS = ['receive', 'path', 'release', 'motion', 'effects', 'abilities'];
const REQUIRED_STRING_FIELDS = ['sourceName', 'displayNameJa', 'note'];
const ABILITY_EXAMPLE_LIMIT = 8;

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

function validateOneProfile(errors, warnings, catalogByEmoji, abilitySpecs, emoji, profile) {
  const catalogHit = catalogByEmoji.get(emoji);
  if (!catalogHit) {
    fail(errors, `${emoji}: profile emoji does not exist in catalog.`);
    return;
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

  if (Array.isArray(profile.abilities)) {
    for (const ability of profile.abilities) {
      if (typeof ability === 'string' && ability.trim() !== '' && !abilitySpecs.knownAbilities.has(ability)) {
        warnings.push(`${emoji}: ability '${ability}' is not listed in ${ABILITY_SPECS_PATH}.`);
      }
    }
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

function validateProfiles(catalog, profileFile, abilitySpecs) {
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

  if (declaredCount > catalog.length) {
    fail(errors, `profileRange.count (${declaredCount}) exceeds catalog length (${catalog.length}).`);
  }

  const catalogByEmoji = new Map(catalog.map((item, catalogIndex) => [item.emoji, { item, catalogIndex }]));

  for (const [emoji, profile] of profileEntries) {
    validateOneProfile(errors, warnings, catalogByEmoji, abilitySpecs, emoji, profile);
  }

  return { errors, warnings };
}

function validateQueueItems(errors, warnings, repoPath, catalog, items) {
  if (!Array.isArray(items) || items.length === 0) {
    fail(errors, `${repoPath}: items must be a non-empty array.`);
    return;
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
      warnings.push(`${repoPath}: ${item.emoji} does not match current catalog at index ${item.catalogIndex}; preserving queued source item.`);
    }
    for (const forbidden of ['jaName', 'shopCategory', 'price', 'codepoints', 'baseCodepoint']) {
      if (Object.prototype.hasOwnProperty.call(item, forbidden)) {
        fail(errors, `${repoPath}: ${item.emoji} includes forbidden queue field '${forbidden}'.`);
      }
    }
  }
}

function queueItems(queue) {
  return queue.status === 'profiled' ? queue.sourceItems ?? [] : queue.items ?? [];
}

function validatePendingQueue(errors, warnings, repoPath, catalog, profileFile, queue) {
  const items = queueItems(queue);
  validateQueueItems(errors, warnings, repoPath, catalog, items);
  if (queue.range?.count !== items.length) {
    fail(errors, `${repoPath}: range.count does not match items length.`);
  }
  if (queue.profiles) {
    fail(errors, `${repoPath}: pending queue must not include profiles.`);
  }

  const profiledEmoji = new Set(Object.keys(profileFile.profiles ?? {}));
  for (const item of items) {
    if (profiledEmoji.has(item.emoji)) {
      warnings.push(`${repoPath}: ${item.emoji} is already in runtime profiles; pending file may be stale.`);
    }
  }
}

function validateProfiledQueue(errors, warnings, repoPath, catalog, abilitySpecs, queue) {
  const items = queueItems(queue);
  validateQueueItems(errors, warnings, repoPath, catalog, items);
  if (queue.range?.count !== items.length) {
    fail(errors, `${repoPath}: range.count does not match sourceItems length.`);
  }
  if (!queue.profiles || typeof queue.profiles !== 'object') {
    fail(errors, `${repoPath}: profiled queue must include profiles object.`);
    return;
  }

  const catalogByEmoji = new Map(catalog.map((item, catalogIndex) => [item.emoji, { item, catalogIndex }]));
  const itemEmoji = new Set(items.map((item) => item.emoji));
  const profileEmoji = new Set(Object.keys(queue.profiles));

  for (const emoji of itemEmoji) {
    if (!profileEmoji.has(emoji)) {
      fail(errors, `${repoPath}: missing profile for source item ${emoji}.`);
    }
  }

  for (const [emoji, profile] of Object.entries(queue.profiles)) {
    if (!itemEmoji.has(emoji)) {
      fail(errors, `${repoPath}: profile ${emoji} is not listed in sourceItems.`);
    }
    validateOneProfile(errors, warnings, catalogByEmoji, abilitySpecs, emoji, profile);
  }
}

function collectCompilerSensitiveAbilities(profiles, abilitySpecs) {
  const found = new Set();
  for (const profile of Object.values(profiles ?? {})) {
    for (const ability of profile.abilities ?? []) {
      if (abilitySpecs.compilerSensitiveAbilities.has(ability)) {
        found.add(ability);
      }
    }
  }
  return found;
}

function validateCompilerSensitiveReview(errors, warnings, repoPath, queue, abilitySpecs) {
  const actual = collectCompilerSensitiveAbilities(queue.profiles, abilitySpecs);
  const reviewed = new Set(queue.review?.compilerSensitive ?? []);

  for (const ability of actual) {
    if (!reviewed.has(ability)) {
      fail(errors, `${repoPath}: review.compilerSensitive is missing '${ability}'.`);
    }
  }

  for (const ability of reviewed) {
    if (!abilitySpecs.knownAbilities.has(ability)) {
      warnings.push(`${repoPath}: review.compilerSensitive ability '${ability}' is not listed in ${ABILITY_SPECS_PATH}.`);
    } else if (!abilitySpecs.compilerSensitiveAbilities.has(ability)) {
      warnings.push(`${repoPath}: review.compilerSensitive includes non-sensitive ability '${ability}'.`);
    } else if (!actual.has(ability)) {
      warnings.push(`${repoPath}: review.compilerSensitive includes '${ability}', but no profile in this batch uses it.`);
    }
  }
}

function validateQueueCoverage(errors, queueSummaries) {
  const sorted = [...queueSummaries].sort((a, b) => a.range.startOrdinal - b.range.startOrdinal);
  const seenEmoji = new Map();
  const seenCatalogIndexes = new Map();

  for (const summary of sorted) {
    const { repoPath, range, items } = summary;
    if (range.startOrdinal !== items[0]?.ordinal || range.endOrdinal !== items.at(-1)?.ordinal) {
      fail(errors, `${repoPath}: range ordinal bounds do not match first/last item.`);
    }
    if (range.startCatalogIndex !== items[0]?.catalogIndex || range.endCatalogIndex !== items.at(-1)?.catalogIndex) {
      fail(errors, `${repoPath}: range catalogIndex bounds do not match first/last item.`);
    }

    for (const item of items) {
      const previousEmojiFile = seenEmoji.get(item.emoji);
      if (previousEmojiFile) {
        fail(errors, `${repoPath}: ${item.emoji} duplicates queue item from ${previousEmojiFile}.`);
      } else {
        seenEmoji.set(item.emoji, repoPath);
      }

      const previousIndexFile = seenCatalogIndexes.get(item.catalogIndex);
      if (previousIndexFile) {
        fail(errors, `${repoPath}: catalogIndex ${item.catalogIndex} duplicates queue item from ${previousIndexFile}.`);
      } else {
        seenCatalogIndexes.set(item.catalogIndex, repoPath);
      }
    }
  }

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (current.range.startOrdinal !== previous.range.endOrdinal + 1) {
      fail(errors, `${current.repoPath}: range starts at ${current.range.startOrdinal}; expected ${previous.range.endOrdinal + 1} after ${previous.repoPath}.`);
    }
    if (current.range.startCatalogIndex !== previous.range.endCatalogIndex + 1) {
      fail(errors, `${current.repoPath}: catalogIndex range starts at ${current.range.startCatalogIndex}; expected ${previous.range.endCatalogIndex + 1} after ${previous.repoPath}.`);
    }
  }
}

async function validateQueueFiles(catalog, profileFile, abilitySpecs) {
  const errors = [];
  const warnings = [];
  const queueSummaries = [];
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

    if (!filename.endsWith('.pending.json') && !filename.endsWith('.profiled.json')) {
      fail(errors, `${repoPath}: queue file must end with .pending.json or .profiled.json.`);
    }

    if (filename.endsWith('.pending.json') && queue.status !== 'pending') {
      fail(errors, `${repoPath}: .pending.json file must have status='pending'.`);
    }

    if (filename.endsWith('.profiled.json') && queue.status !== 'profiled') {
      fail(errors, `${repoPath}: .profiled.json file must have status='profiled'.`);
    }

    if (queue.status === 'pending') {
      validatePendingQueue(errors, warnings, repoPath, catalog, profileFile, queue);
    } else if (queue.status === 'profiled') {
      validateProfiledQueue(errors, warnings, repoPath, catalog, abilitySpecs, queue);
      validateCompilerSensitiveReview(errors, warnings, repoPath, queue, abilitySpecs);
    } else {
      fail(errors, `${repoPath}: status must be pending or profiled.`);
    }

    queueSummaries.push({ repoPath, status: queue.status, range: queue.range, items: queueItems(queue) });
  }

  validateQueueCoverage(errors, queueSummaries);

  return { errors, warnings };
}

function collectAbilityUsageFromProfiles(target, profiles) {
  for (const [emoji, profile] of Object.entries(profiles ?? {})) {
    for (const ability of profile.abilities ?? []) {
      if (typeof ability !== 'string' || ability.trim() === '') continue;
      if (!target.has(ability)) target.set(ability, { occurrences: 0, examples: [] });
      const usage = target.get(ability);
      usage.occurrences += 1;
      if (usage.examples.length < ABILITY_EXAMPLE_LIMIT) usage.examples.push(emoji);
    }
  }
}

async function validateAbilitySpecsSync(errors, profileFile, abilitySpecsFile) {
  const actualUsage = new Map();
  collectAbilityUsageFromProfiles(actualUsage, profileFile.profiles);

  const queueDir = resolveRepoPath(QUEUE_DIR);
  let files = [];
  try {
    files = await readdir(queueDir);
  } catch {
    files = [];
  }

  for (const filename of files.filter((file) => file.endsWith('.profiled.json')).sort()) {
    const queue = await readJson(path.join(QUEUE_DIR, filename));
    collectAbilityUsageFromProfiles(actualUsage, queue.profiles);
  }

  for (const ability of actualUsage.keys()) {
    if (!Object.prototype.hasOwnProperty.call(abilitySpecsFile.abilities ?? {}, ability)) {
      fail(errors, `${ABILITY_SPECS_PATH}: missing ability spec for '${ability}'.`);
    }
  }

  for (const [ability, spec] of Object.entries(abilitySpecsFile.abilities ?? {})) {
    const actual = actualUsage.get(ability) ?? { occurrences: 0, examples: [] };
    if (spec.occurrences !== actual.occurrences) {
      fail(errors, `${ABILITY_SPECS_PATH}: ${ability}.occurrences is ${spec.occurrences}, expected ${actual.occurrences}. Run node tools/nohand/sync_ability_specs.mjs.`);
    }
    const expectedExamples = actual.examples;
    if (JSON.stringify(spec.examples ?? []) !== JSON.stringify(expectedExamples)) {
      fail(errors, `${ABILITY_SPECS_PATH}: ${ability}.examples are stale. Run node tools/nohand/sync_ability_specs.mjs.`);
    }
  }
}

async function main() {
  const catalog = await readJson(CATALOG_PATH);
  const profileFile = await readJson(PROFILES_PATH);
  const abilitySpecsFile = await readJson(ABILITY_SPECS_PATH);
  const abilitySpecs = {
    knownAbilities: new Set(Object.keys(abilitySpecsFile.abilities ?? {})),
    compilerSensitiveAbilities: new Set(
      Object.entries(abilitySpecsFile.abilities ?? {})
        .filter(([, spec]) => spec?.compilerSensitive === true)
        .map(([ability]) => ability),
    ),
  };

  const profileResult = validateProfiles(catalog, profileFile, abilitySpecs);
  const queueResult = await validateQueueFiles(catalog, profileFile, abilitySpecs);
  const abilitySpecSyncErrors = [];
  await validateAbilitySpecsSync(abilitySpecSyncErrors, profileFile, abilitySpecsFile);
  const errors = [...profileResult.errors, ...queueResult.errors, ...abilitySpecSyncErrors];
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
