#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const manifestPath = path.join(ROOT, 'docs/trpg/combat-recovery-foundation-v2.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const plainPath = path.join(ROOT, manifest.replacement.primaryArtifact);
const encodedPath = path.join(ROOT, manifest.replacement.transportArtifact);
const plain = await fs.readFile(plainPath);
const encodedText = (await fs.readFile(encodedPath, 'utf8')).trim();
const decoded = Buffer.from(encodedText, 'base64');
if (decoded[0] !== 0x1f || decoded[1] !== 0x8b) {
  throw new Error(`gzip header mismatch: ${decoded.subarray(0, 4).toString('hex')}`);
}
const inflated = gunzipSync(decoded);
if (!plain.equals(inflated)) throw new Error('decoded transport differs from checked-in primary JSON');
const parsed = JSON.parse(inflated.toString('utf8'));
if (parsed?.source?.revisionId !== manifest.revisionId) throw new Error(`unexpected revision ${parsed?.source?.revisionId}`);
if (Object.keys(parsed.tabs ?? {}).length !== manifest.replacement.tabCount) throw new Error('tab count mismatch');
const sha256 = crypto.createHash('sha256').update(inflated).digest('hex');
if (sha256 !== manifest.replacement.decodedSha256) throw new Error(`decoded SHA-256 mismatch: ${sha256}`);
const regenerated = gzipSync(plain, { level: 9, mtime: 0 }).toString('base64');
if (regenerated !== encodedText) throw new Error('gzip+base64 regeneration is not byte-identical');
console.log(JSON.stringify({
  ok: true,
  revisionId: parsed.source.revisionId,
  tabCount: Object.keys(parsed.tabs).length,
  decodedSha256: sha256,
  gzipBytes: decoded.length,
  plainBytes: plain.length,
  deterministicRegeneration: true,
}, null, 2));
