#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const DEFAULT_SPECS = 'tools/nohand/ability_specs.json';
const DEFAULT_RUNTIME_PROFILES = 'public/noHand_soccer/emoji_physics_profiles.json';
const DEFAULT_QUEUE_DIR = 'tools/nohand/profile_queue';
const EXAMPLE_LIMIT = 8;

function resolveRepoPath(repoRelativePath) { return path.resolve(REPO_ROOT, repoRelativePath); }
async function readJson(repoRelativePath) { return JSON.parse(await readFile(resolveRepoPath(repoRelativePath), 'utf8')); }
function readArg(name, fallback = null) {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0 && process.argv[exactIndex + 1]) return process.argv[exactIndex + 1];
  const paired = process.argv.find((arg) => arg.startsWith(prefix));
  return paired ? paired.slice(prefix.length) : fallback;
}
function hasFlag(name) { return process.argv.includes(name); }
function collectAbilityUsage(target, profiles) {
  for (const [emoji, profile] of Object.entries(profiles ?? {})) {
    for (const ability of profile.abilities ?? []) {
      if (!target.has(ability)) target.set(ability, { occurrences: 0, examples: [] });
      const usage = target.get(ability);
      usage.occurrences += 1;
      if (usage.examples.length < EXAMPLE_LIMIT) usage.examples.push(emoji);
    }
  }
}
async function collectUsage(runtimeProfilesPath, queueDir) {
  const usage = new Map();
  const sourceProfiles = [runtimeProfilesPath];
  const runtimeProfiles = await readJson(runtimeProfilesPath);
  collectAbilityUsage(usage, runtimeProfiles.profiles);
  let files = [];
  try { files = await readdir(resolveRepoPath(queueDir)); } catch { files = []; }
  for (const file of files.filter((name) => name.endsWith('.profiled.json')).sort()) {
    const repoPath = path.join(queueDir, file);
    const queue = await readJson(repoPath);
    sourceProfiles.push(repoPath);
    collectAbilityUsage(usage, queue.profiles);
  }
  return { usage, sourceProfiles };
}
function syncSpecs(specsFile, usage, sourceProfiles) {
  const next = { ...specsFile, sourceProfiles: [...sourceProfiles], abilities: { ...specsFile.abilities } };
  for (const ability of Object.keys(next.abilities).sort()) {
    const actual = usage.get(ability) ?? { occurrences: 0, examples: [] };
    next.abilities[ability] = { ...next.abilities[ability], occurrences: actual.occurrences, examples: actual.examples };
  }
  return next;
}
async function main() {
  const specsPath = readArg('--specs', DEFAULT_SPECS);
  const runtimeProfilesPath = readArg('--profiles', DEFAULT_RUNTIME_PROFILES);
  const queueDir = readArg('--queue-dir', DEFAULT_QUEUE_DIR);
  const check = hasFlag('--check');
  const specsFile = await readJson(specsPath);
  const { usage, sourceProfiles } = await collectUsage(runtimeProfilesPath, queueDir);
  const unknown = [...usage.keys()].filter((ability) => !specsFile.abilities?.[ability]).sort();
  if (unknown.length > 0) throw new Error(`Unknown abilities in profiles: ${unknown.join(', ')}`);
  const next = syncSpecs(specsFile, usage, sourceProfiles);
  const currentText = `${JSON.stringify(specsFile, null, 2)}\n`;
  const nextText = `${JSON.stringify(next, null, 2)}\n`;
  if (check) {
    if (currentText !== nextText) throw new Error(`${specsPath} is not synchronized. Run: node tools/nohand/sync_ability_specs.mjs`);
    console.log(`${specsPath} is synchronized.`);
    return;
  }
  await writeFile(resolveRepoPath(specsPath), nextText, 'utf8');
  console.log(`Synchronized ${specsPath}.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
