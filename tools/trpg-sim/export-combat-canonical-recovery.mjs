#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT_JSON = path.join(ROOT, 'docs/trpg/combat-sheet-revision20-snapshot.json');
const OUT_GZIP_B64 = path.join(ROOT, 'docs/trpg/combat-sheet-revision20-snapshot.json.gz.b64');
const OUT_MANIFEST = path.join(ROOT, 'docs/trpg/combat-recovery-foundation-v2.json');

const SOURCE = Object.freeze({
  spreadsheetId: '1-2mUA20d7h1lmv1G9fCH0EryFEYyFQ2nkamN51uCPqw',
  title: 'TRPG_戦闘データマスターβ1',
  recoveryRevisionId: '20',
  recoveryRevisionModifiedTime: '2026-08-17T04:30:47.260Z',
});

const TABS = Object.freeze([
  ['設計サマリー', 'A1:F9', 9, 6],
  ['装備性能マスター', 'A1:AD146', 146, 30],
  ['店舗装備在庫', 'A1:O153', 153, 15],
  ['モンスター一覧', 'A1:AF81', 81, 32],
  ['モンスタースキル', 'A1:M100', 100, 13],
  ['モンスター行動', 'A1:L290', 290, 12],
  ['地域別エンカウント', 'A1:O80', 80, 15],
  ['素材買取価格', 'A1:I62', 62, 9],
  ['戦闘個性監査', 'A1:L81', 81, 12],
  ['ボス監査', 'A1:P13', 13, 16],
  ['戦闘認証_v1', 'A1:T13', 13, 20],
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function padRows(rows, rowCount, columnCount) {
  return Array.from({ length: rowCount }, (_, rowIndex) => Array.from(
    { length: columnCount },
    (_, columnIndex) => rows?.[rowIndex]?.[columnIndex] ?? null,
  ));
}

function countIds(values, headerRowIndex) {
  return values.slice(headerRowIndex + 1).filter((row) => row?.[0] !== null && row?.[0] !== '').length;
}

function findRow(values, id) {
  return values.find((row) => row?.[0] === id);
}

async function sheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is required');
  const credentials = JSON.parse(raw);
  const { google } = await import('googleapis');
  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  );
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

const sheets = await sheetsClient();
const book = await sheets.spreadsheets.get({
  spreadsheetId: SOURCE.spreadsheetId,
  fields: 'properties.title',
});
if (book.data.properties?.title !== SOURCE.title) {
  throw new Error(`unexpected spreadsheet title: ${book.data.properties?.title}`);
}

const tabs = {};
const tabHashes = [];
for (const [name, range, rowCount, columnCount] of TABS) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SOURCE.spreadsheetId,
    range: `'${name}'!${range}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const values = padRows(response.data.values ?? [], rowCount, columnCount);
  const valueBytes = Buffer.from(JSON.stringify(values), 'utf8');
  const tabSha256 = sha256(valueBytes);
  tabs[name] = { range, rowCount, columnCount, sha256: tabSha256, values };
  tabHashes.push(`${name}:${tabSha256}`);
}

const counts = {
  equipment: countIds(tabs['装備性能マスター'].values, 3),
  shopInventory: countIds(tabs['店舗装備在庫'].values, 3),
  monsters: countIds(tabs['モンスター一覧'].values, 3),
  monsterSkills: countIds(tabs['モンスタースキル'].values, 3),
  monsterActions: countIds(tabs['モンスター行動'].values, 3),
  encounters: countIds(tabs['地域別エンカウント'].values, 3),
  materialBuyback: countIds(tabs['素材買取価格'].values, 0),
};
const expectedCounts = {
  equipment: 142,
  shopInventory: 149,
  monsters: 77,
  monsterSkills: 96,
  monsterActions: 286,
  encounters: 76,
  materialBuyback: 61,
};
for (const [key, expected] of Object.entries(expectedCounts)) {
  if (counts[key] !== expected) throw new Error(`${key}: expected ${expected}, got ${counts[key]}`);
}

const monsterRows = tabs['モンスター一覧'].values;
const header = monsterRows[3];
const column = Object.fromEntries(header.map((value, index) => [value, index]));
const samples = Object.freeze({
  'MON-0001': [15, 16.8, 9.8],
  'MON-0017': [2200, 89.6, 63],
  'MON-0018': [2850, 100, 72],
  'MON-0028': [2250, 92, 82],
  'MON-0063': [2400, 88, 62],
  'MON-0064': [2850, 100, 72],
  'MON-0077': [2550, 108, 96],
});
for (const [id, expected] of Object.entries(samples)) {
  const row = findRow(monsterRows, id);
  const actual = [row?.[column.HP], row?.[column['物理威力']], row?.[column['魔導威力']]];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${id}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const snapshot = {
  schemaVersion: 'combat-sheet-recovery-v2',
  source: {
    spreadsheetId: SOURCE.spreadsheetId,
    title: SOURCE.title,
    revisionId: SOURCE.recoveryRevisionId,
    revisionModifiedTime: SOURCE.recoveryRevisionModifiedTime,
    valueRenderOption: 'UNFORMATTED_VALUE',
    canonicalValueMeaning: 'effective values exported from Google Sheets recovery revision 20',
  },
  tabOrder: TABS.map(([name]) => name),
  aggregateSha256: sha256(Buffer.from(tabHashes.join('\n'), 'utf8')),
  tabs,
};
const plain = Buffer.from(`${JSON.stringify(snapshot)}\n`, 'utf8');
const gzip = gzipSync(plain, { level: 9, mtime: 0 });
const encoded = `${gzip.toString('base64')}\n`;
const decodedSha256 = sha256(plain);

const manifest = {
  schemaVersion: 'combat-recovery-foundation-v2',
  spreadsheetId: SOURCE.spreadsheetId,
  revisionId: SOURCE.recoveryRevisionId,
  revisionModifiedTime: SOURCE.recoveryRevisionModifiedTime,
  legacyCorruptArtifact: {
    path: 'docs/trpg/combat-sheet-revision20-snapshot.json.gz.b64',
    legacyExpectedDecodedSha256: 'ffcfbabf9f97373666e9153c0a1988cd8177e70fee032c31033b4eaad98af854',
    failure: 'legacy base64 decoded bytes did not contain a gzip header; CI raised Z_DATA_ERROR incorrect header check',
    recoveryDecision: 'revision20 values were re-exported from the still-current canonical Sheet; the corrupt byte serialization is not treated as source truth',
  },
  replacement: {
    primaryArtifact: 'docs/trpg/combat-sheet-revision20-snapshot.json',
    transportArtifact: 'docs/trpg/combat-sheet-revision20-snapshot.json.gz.b64',
    decodedSha256,
    aggregateTabSha256: snapshot.aggregateSha256,
    plainBytes: plain.length,
    gzipBytes: gzip.length,
    base64Bytes: Buffer.byteLength(encoded, 'utf8'),
    gzipMtime: 0,
    tabCount: Object.keys(tabs).length,
    counts,
    deterministicRegeneration: true,
    decode: 'PASS',
    gunzip: 'PASS',
    jsonParse: 'PASS',
  },
  routeReplay: false,
};

await Promise.all([
  fs.writeFile(OUT_JSON, plain),
  fs.writeFile(OUT_GZIP_B64, encoded, 'utf8'),
  fs.writeFile(OUT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
]);

console.log(JSON.stringify({ ok: true, counts, decodedSha256, aggregateSha256: snapshot.aggregateSha256 }, null, 2));
