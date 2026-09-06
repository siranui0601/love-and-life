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
const gzipBytes = Buffer.from(encodedText, 'base64');
if (gzipBytes[0] !== 0x1f || gzipBytes[1] !== 0x8b) {
  throw new Error(`gzip header mismatch: ${gzipBytes.subarray(0, 4).toString('hex')}`);
}
const inflated = gunzipSync(gzipBytes);
if (!plain.equals(inflated)) throw new Error('decoded transport differs from checked-in primary JSON');
const parsed = JSON.parse(inflated.toString('utf8'));
if (parsed?.source?.revisionId !== manifest.revisionId) throw new Error(`unexpected revision ${parsed?.source?.revisionId}`);
if (Object.keys(parsed.tabs ?? {}).length !== manifest.replacement.tabCount) throw new Error('tab count mismatch');
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const plainSha256 = sha256(plain);
const gzipTransportSha256 = sha256(gzipBytes);
if (plainSha256 !== manifest.replacement.decodedSha256) throw new Error(`plain SHA-256 mismatch: ${plainSha256}`);
if (manifest.replacement.plainArtifactSha256 && plainSha256 !== manifest.replacement.plainArtifactSha256) {
  throw new Error(`plain artifact SHA-256 mismatch: ${plainSha256}`);
}
if (manifest.replacement.gzipTransportSha256 && gzipTransportSha256 !== manifest.replacement.gzipTransportSha256) {
  throw new Error(`gzip transport SHA-256 mismatch: ${gzipTransportSha256}`);
}
const regeneratedGzip = gzipSync(plain, { level: 9, mtime: 0 });
const regenerated = regeneratedGzip.toString('base64');
if (regenerated !== encodedText) throw new Error('gzip+base64 regeneration is not byte-identical');
if (!regeneratedGzip.equals(gzipBytes)) throw new Error('regenerated gzip bytes differ from checked-in transport');
console.log(JSON.stringify({
  ok: true,
  revisionId: parsed.source.revisionId,
  sourceModifiedTime: parsed.source.modifiedTime ?? null,
  tabCount: Object.keys(parsed.tabs).length,
  aggregateSha256: manifest.replacement.aggregateTabSha256,
  plainArtifactSha256: plainSha256,
  gzipTransportSha256,
  gzipBytes: gzipBytes.length,
  plainBytes: plain.length,
  transportEqualsPrimaryAfterGunzip: true,
  deterministicRegeneration: true,
}, null, 2));
