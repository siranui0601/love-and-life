#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abilityCatalog, resolveCatalogAbility } from '../../public/noHand_soccer/runtime/abilityCatalog.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const RUNTIME_PROFILES = 'public/noHand_soccer/emoji_physics_profiles.json';
const QUEUE_DIR = 'tools/nohand/profile_queue';

// Force-replacements for abilities that should not remain as standalone combo vocabulary,
// even if the catalog still has a selectable compatibility entry.
const REPLACEMENTS = Object.freeze({
  fakeRoute: ['hiddenRoute'],
  luckyRedirect: ['aimAssist'],
  heavyBlock: ['reflectShield'],
  poisonDampen: ['burstScatter'],
  randomBounce: ['spinRedirect'],
});

const FALLBACK_BY_EFFECT = Object.freeze([
  ['warpEffect', 'warpExit'],
  ['splitEffect', 'splitScatter'],
  ['boostEffect', 'lightBoost'],
  ['curveEffect', 'curveRedirect'],
  ['holdEffect', 'trapHold'],
  ['flowEffect', 'flowCarry'],
  ['slowEffect', 'softLanding'],
]);

function repoPath(file) { return path.resolve(REPO_ROOT, file); }
function hasFlag(flag) { return process.argv.includes(flag); }
function argValue(name, fallback = null) {
  const exact = process.argv.indexOf(name);
  if (exact >= 0 && process.argv[exact + 1]) return process.argv[exact + 1];
  const prefix = `${name}=`;
  const paired = process.argv.find((arg) => arg.startsWith(prefix));
  return paired ? paired.slice(prefix.length) : fallback;
}
async function readJson(file) { return JSON.parse(await readFile(repoPath(file), 'utf8')); }
async function writeJson(file, data) { await writeFile(repoPath(file), `${JSON.stringify(data, null, 2)}\n`, 'utf8'); }
function dedupe(values) { return [...new Set(values.filter(Boolean))]; }

function fallbackAbility(profile) {
  for (const [effect, ability] of FALLBACK_BY_EFFECT) {
    if ((profile.effects || []).includes(effect)) return ability;
  }
  return 'hiddenRoute';
}

function compilerSensitiveAbilities(profiles) {
  const found = new Set();
  for (const profile of Object.values(profiles || {})) {
    for (const ability of profile.abilities || []) {
      if (abilityCatalog[ability]?.compilerSensitive || abilityCatalog[ability]?.status === 'alias') continue;
      const resolved = resolveCatalogAbility(ability);
      if (resolved?.entry?.compilerSensitive) found.add(resolved.name);
    }
  }
  return [...found].sort();
}

function syncCompilerSensitiveReview(container, stats, file) {
  if (!container.review || !container.profiles) return;
  const before = Array.isArray(container.review.compilerSensitive) ? container.review.compilerSensitive : [];
  const actual = compilerSensitiveAbilities(container.profiles);
  const merged = dedupe([...before, ...actual]).sort();
  if (JSON.stringify(before) === JSON.stringify(merged)) return;
  container.review.compilerSensitive = merged;
  const added = merged.filter((ability) => !before.includes(ability));
  for (const ability of added) {
    const key = `review.compilerSensitive:${ability}`;
    stats.changes.set(key, (stats.changes.get(key) || 0) + 1);
  }
  if (stats.reviewExamples.length < 20) stats.reviewExamples.push({ file, before, after: merged, added });
}

function migrateAbilities(profile) {
  const before = Array.isArray(profile.abilities) ? profile.abilities : [];
  const after = [];
  const notes = [];
  for (const ability of before) {
    if (REPLACEMENTS[ability]) {
      notes.push({ ability, type: 'replacement', to: REPLACEMENTS[ability] });
      after.push(...REPLACEMENTS[ability]);
      continue;
    }
    const resolved = resolveCatalogAbility(ability);
    if (!resolved) {
      notes.push({ ability, type: 'missing', to: ability });
      after.push(ability);
      continue;
    }
    const resolvedEntry = resolved.entry;
    if (resolvedEntry.status === 'deprecated') {
      notes.push({ ability, type: 'deprecatedWithoutReplacement', to: null });
      continue;
    }
    if (resolved.aliasFrom) {
      notes.push({ ability, type: 'alias', to: resolved.name });
      after.push(resolved.name);
      continue;
    }
    if (resolvedEntry.status === 'active' || resolvedEntry.status === 'rework') {
      after.push(resolved.name);
      continue;
    }
    notes.push({ ability, type: resolvedEntry.status || 'unknown', to: null });
  }
  const normalized = dedupe(after);
  if (!normalized.length) {
    const fallback = fallbackAbility(profile);
    normalized.push(fallback);
    notes.push({ ability: null, type: 'emptyFallback', to: fallback });
  }
  return { before, after: normalized, notes, changed: JSON.stringify(before) !== JSON.stringify(normalized) };
}

function migrateProfileSet(container, stats, file) {
  const profiles = container.profiles || {};
  for (const [emoji, profile] of Object.entries(profiles)) {
    const result = migrateAbilities(profile);
    stats.profileCount += 1;
    if (!result.changed) continue;
    profile.abilities = result.after;
    stats.changedProfiles += 1;
    for (const note of result.notes) {
      const key = `${note.type}:${note.ability ?? 'none'}=>${Array.isArray(note.to) ? note.to.join('+') : note.to}`;
      stats.changes.set(key, (stats.changes.get(key) || 0) + 1);
    }
    if (stats.examples.length < 30) {
      stats.examples.push({ file, emoji, before: result.before, after: result.after, notes: result.notes });
    }
  }
  syncCompilerSensitiveReview(container, stats, file);
}

async function collectFiles() {
  const includeQueue = !hasFlag('--runtime-only');
  const files = [argValue('--profiles', RUNTIME_PROFILES)];
  if (!includeQueue) return files;
  const queueDir = argValue('--queue-dir', QUEUE_DIR);
  let queueFiles = [];
  try { queueFiles = await readdir(repoPath(queueDir)); } catch { return files; }
  for (const name of queueFiles.filter((item) => item.endsWith('.profiled.json')).sort()) {
    files.push(path.join(queueDir, name));
  }
  return files;
}

function printReport(stats, write) {
  console.log(`noHand ability migration ${write ? 'wrote files' : 'dry-run only'}`);
  console.log(`profiles: ${stats.profileCount}`);
  console.log(`changedProfiles: ${stats.changedProfiles}`);
  console.log('changes:');
  for (const [key, count] of [...stats.changes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count} ${key}`);
  }
  console.log('examples:');
  for (const example of stats.examples) {
    console.log(`  ${example.file} ${example.emoji}: ${example.before.join(',')} -> ${example.after.join(',')}`);
  }
  if (stats.reviewExamples.length) {
    console.log('review.compilerSensitive examples:');
    for (const example of stats.reviewExamples) {
      console.log(`  ${example.file}: +${example.added.join(',')}`);
    }
  }
}

async function main() {
  const write = hasFlag('--write');
  const files = await collectFiles();
  const stats = { profileCount: 0, changedProfiles: 0, changes: new Map(), examples: [], reviewExamples: [] };
  for (const file of files) {
    const data = await readJson(file);
    migrateProfileSet(data, stats, file);
    if (write) await writeJson(file, data);
  }
  printReport(stats, write);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
