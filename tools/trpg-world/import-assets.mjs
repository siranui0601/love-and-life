import fs from 'node:fs/promises';
import path from 'node:path';
import { assetRoot, root, filesUnder, inspectFile, sha256, validateManifest } from './inspect-assets.mjs';

// Import is explicit: validate checks the committed manifest without trusting or fetching a new upstream release.
const sourceRoot = path.resolve(process.argv[2] ?? path.join(root, '../asset-sources'));
const specifications = [
  { id: 'town', name: 'Fantasy Town Kit', version: '2.0', source: 'fantasy-town', page: 'fantasy-town-kit' },
  { id: 'characters', name: 'Blocky Characters', version: '2.0', source: 'blocky', page: 'blocky-characters' },
  { id: 'creatures', name: 'Cube Pets', version: '2.0', source: 'pets', page: 'cube-pets' },
  { id: 'prototype', name: 'Prototype Kit', version: '1.0', source: 'prototype', page: 'prototype-kit' },
];
const packs = [], files = [];
for (const spec of specifications) {
  const sourceDirectory = path.join(sourceRoot, spec.source), hashes = new Map();
  for (const file of await filesUnder(sourceDirectory)) {
    if (!/\.(glb|png|jpg|jpeg|bin|txt)$/iu.test(file)) continue;
    const hash = sha256(await fs.readFile(path.join(sourceDirectory, file)));
    if (!hashes.has(hash)) hashes.set(hash, file);
  }
  packs.push({ id: spec.id, name: spec.name, version: spec.version, creator: 'Kenney', sourceUrl: `https://kenney.nl/assets/${spec.page}`, license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', licensePath: `${spec.id}/LICENSE.txt`, archiveName: `${spec.source}.zip`, archiveSha256: sha256(await fs.readFile(path.join(sourceRoot, `${spec.source}.zip`))) });
  for (const file of await filesUnder(path.join(assetRoot, spec.id))) {
    const actual = await inspectFile(`${spec.id}/${file}`), sourcePath = hashes.get(actual.sha256);
    if (!sourcePath) throw new Error(`Deployed file has no byte-identical source in ${spec.source}: ${actual.path}`);
    files.push({ ...actual, pack: spec.id, sourcePath, sourceSha256: actual.sha256 });
  }
}
files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const manifest = { schemaVersion: 1, packs, files };
const report = await validateManifest(manifest);
await fs.writeFile(path.join(assetRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Recorded verified original asset provenance: ${JSON.stringify(report)}`);
