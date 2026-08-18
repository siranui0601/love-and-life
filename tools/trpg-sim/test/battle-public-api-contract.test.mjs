import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const BATTLE_MODEL = path.join(ROOT, 'tools/trpg-sim/lib/battle-model.mjs');
const ACTIVE_ROOTS = [path.join(ROOT, 'tools/trpg-sim'), path.join(ROOT, 'src/server/trpg')];
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

function activeFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (['archive', 'node_modules', 'reports'].includes(entry.name)) continue;
      files.push(...activeFiles(full));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function importedBattleModelNames() {
  const requirements = new Map();
  const importPattern = /import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]*battle-model\.mjs)['"]/g;
  for (const root of ACTIVE_ROOTS) {
    for (const file of activeFiles(root)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(importPattern)) {
        const names = match[1]
          .split(',')
          .map((part) => part.replace(/\/\*[\s\S]*?\*\//g, '').trim())
          .filter(Boolean)
          .map((part) => part.split(/\s+as\s+/)[0].trim());
        for (const name of names) {
          const consumers = requirements.get(name) ?? [];
          consumers.push(path.relative(ROOT, file));
          requirements.set(name, consumers);
        }
      }
    }
  }
  return requirements;
}

function scanActive(pattern) {
  const matches = [];
  for (const root of ACTIVE_ROOTS) {
    for (const file of activeFiles(root)) {
      const source = fs.readFileSync(file, 'utf8');
      if (pattern.test(source)) matches.push(path.relative(ROOT, file));
      pattern.lastIndex = 0;
    }
  }
  return matches;
}

test('battle-model public API satisfies every active named import', async () => {
  const battleModel = await import(pathToFileURL(BATTLE_MODEL).href);
  const requirements = importedBattleModelNames();
  const missing = [...requirements.entries()]
    .filter(([name]) => !(name in battleModel))
    .map(([name, consumers]) => ({ name, consumers }));

  assert.ok(requirements.size > 0, 'contract scanner must discover active battle-model consumers');
  assert.deepEqual(missing, [], `missing battle-model exports: ${JSON.stringify(missing)}`);
  assert.equal(typeof battleModel.inferPlayerDamageType, 'function');
});

test('active battle-model consumers do not depend on archive or legacy actor implementation', () => {
  assert.deepEqual(
    scanActive(/(?:from\s+|import\s*\()["'][^"']*archive\/trpg\//g),
    [],
    'active archive/trpg dependency must remain zero',
  );
  const core = fs.readFileSync(path.join(ROOT, 'tools/trpg-sim/lib/battle-core.mjs'), 'utf8');
  assert.equal(/export\s+function\s+createMonsterActor\s*\(/.test(core), false);
  assert.equal(/monsterHpScale\s*:\s*0\.55\b|monsterOffenceScale\s*:\s*1\.4\b/.test(core), false);
});
