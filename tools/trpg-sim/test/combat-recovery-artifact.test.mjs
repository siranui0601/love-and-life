import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/trpg/combat-recovery-foundation-v2.json'), 'utf8'));
const plain = fs.readFileSync(path.join(ROOT, manifest.replacement.primaryArtifact));
const encodedText = fs.readFileSync(path.join(ROOT, manifest.replacement.transportArtifact), 'utf8').trim();

test('revision20 recovery artifact is decodable and deterministic in a clean checkout', () => {
  const decoded = Buffer.from(encodedText, 'base64');
  assert.deepEqual([...decoded.subarray(0, 2)], [0x1f, 0x8b]);
  const inflated = gunzipSync(decoded);
  assert.deepEqual(inflated, plain);
  const parsed = JSON.parse(inflated.toString('utf8'));
  assert.equal(parsed.source.revisionId, '20');
  assert.equal(Object.keys(parsed.tabs).length, 11);
  assert.equal(crypto.createHash('sha256').update(inflated).digest('hex'), manifest.replacement.decodedSha256);
  assert.equal(gzipSync(plain, { level: 9, mtime: 0 }).toString('base64'), encodedText);
  assert.deepEqual(manifest.replacement.counts, {
    equipment: 142,
    shopInventory: 149,
    monsters: 77,
    monsterSkills: 96,
    monsterActions: 286,
    encounters: 76,
    materialBuyback: 61,
  });
});
