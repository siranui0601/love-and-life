import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const HERE = path.dirname(SELF);
const ROOT = path.resolve(HERE, '../../..');
const ACTIVE_ROOTS = [
  path.join(ROOT, 'tools/trpg-sim'),
  path.join(ROOT, 'src/server/trpg'),
];
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json']);

function activeFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'archive' || entry.name === 'node_modules' || entry.name === 'reports') continue;
      files.push(...activeFiles(full));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function scan(pattern) {
  const matches = [];
  for (const root of ACTIVE_ROOTS) {
    for (const file of activeFiles(root)) {
      // This test necessarily contains the forbidden tokens as search
      // patterns. Exclude only this scanner itself; all other active sources
      // remain in scope.
      if (path.resolve(file) === path.resolve(SELF)) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (pattern.test(text)) matches.push(path.relative(ROOT, file));
      pattern.lastIndex = 0;
    }
  }
  return matches;
}

test('active battle runtime contains no pre-normalization hidden scale or archive dependency', () => {
  assert.deepEqual(scan(/monsterHpScale\s*:\s*0\.55\b/g), [], 'active monsterHpScale 0.55 occurrence must be zero');
  assert.deepEqual(scan(/monsterOffenceScale\s*:\s*1\.4\b/g), [], 'active monsterOffenceScale 1.4 occurrence must be zero');
  assert.deepEqual(scan(/(?:from\s+|import\s*\()["'][^"']*archive\/trpg\//g), [], 'active archive/trpg imports must be zero');
});

test('battle-core no longer exports the legacy scaled monster actor factory', () => {
  const core = fs.readFileSync(path.join(ROOT, 'tools/trpg-sim/lib/battle-core.mjs'), 'utf8');
  assert.equal(/export\s+function\s+createMonsterActor\s*\(/.test(core), false);
  assert.equal(/monsterHpScale|monsterOffenceScale/.test(core), false);
});

test('production runtime has no mixed canonical battle mutation bridge', () => {
  assert.deepEqual(scan(/canonical-runtime-extensions\.js/g), []);
  assert.equal(fs.existsSync(path.join(ROOT, 'src/server/trpg/content/canonical-runtime-extensions.js')), false);
});
