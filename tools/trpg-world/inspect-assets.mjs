import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const assetRoot = path.join(root, 'public/TRPG/world/assets');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function filesUnder(directory, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Asset symlinks are not allowed: ${relative}`);
    if (entry.isDirectory()) result.push(...await filesUnder(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result.sort();
}

/** GLB structural/dependency inspection, not a replacement for rendering validation. */
export function inspectGlb(bytes, assetPath) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error(`Invalid GLB header: ${assetPath}`);
  }
  let offset = 12, json, binaryBytes = 0;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error(`Truncated GLB chunk: ${assetPath}`);
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    if (length % 4 || offset + 8 + length > bytes.length) throw new Error(`Invalid GLB chunk length: ${assetPath}`);
    if (offset === 12 && type !== 0x4e4f534a) throw new Error(`GLB JSON must be first: ${assetPath}`);
    if (type === 0x4e4f534a) {
      if (json) throw new Error(`Duplicate GLB JSON: ${assetPath}`);
      json = JSON.parse(bytes.subarray(offset + 8, offset + 8 + length).toString('utf8'));
    }
    if (type === 0x004e4942) binaryBytes += length;
    offset += length + 8;
  }
  if (json?.asset?.version !== '2.0') throw new Error(`Unsupported glTF version: ${assetPath}`);
  const dependencies = [];
  for (const resource of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (!resource.uri) continue;
    if (resource.uri.startsWith('data:')) continue;
    let uri;
    try { uri = decodeURIComponent(resource.uri); } catch { throw new Error(`Invalid resource URI: ${assetPath}`); }
    if (/^[a-z][a-z0-9+.-]*:|^[/\\]|[?#\\\u0000-\u001f]/iu.test(uri)) throw new Error(`External or unsafe asset URI: ${assetPath}: ${resource.uri}`);
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(assetPath), uri));
    if (resolved.startsWith('../') || resolved === '..') throw new Error(`Asset URI escapes asset root: ${assetPath}: ${resource.uri}`);
    dependencies.push({ uri: resource.uri, path: resolved });
  }
  for (const buffer of json.buffers ?? []) {
    if (!buffer.uri && (!Number.isSafeInteger(buffer.byteLength) || buffer.byteLength > binaryBytes || buffer.byteLength < 0)) {
      throw new Error(`GLB buffer exceeds binary payload: ${assetPath}`);
    }
  }
  for (const view of json.bufferViews ?? []) {
    const buffer = json.buffers?.[view.buffer];
    if (!buffer || !Number.isSafeInteger(view.byteLength) || view.byteLength < 0 || (view.byteOffset ?? 0) < 0 || (view.byteOffset ?? 0) + view.byteLength > buffer.byteLength) {
      throw new Error(`Invalid GLB buffer view: ${assetPath}`);
    }
  }
  return {
    meshes: json.meshes?.length ?? 0,
    primitives: (json.meshes ?? []).reduce((sum, mesh) => sum + (mesh.primitives?.length ?? 0), 0),
    skins: json.skins?.length ?? 0,
    materials: json.materials?.length ?? 0,
    animations: (json.animations ?? []).map((animation, index) => animation.name ?? `animation-${index}`),
    extensionsRequired: json.extensionsRequired ?? [],
    dependencies: dependencies.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export async function inspectFile(relative) {
  const bytes = await fs.readFile(path.join(assetRoot, relative));
  return { path: relative, bytes: bytes.length, sha256: sha256(bytes), ...(relative.endsWith('.glb') ? { gltf: inspectGlb(bytes, relative) } : {}) };
}

export async function validateManifest(manifest) {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files)) throw new Error('Invalid asset manifest');
  const listed = new Set(manifest.files.map(entry => entry.path));
  if (listed.size !== manifest.files.length) throw new Error('Duplicate manifest file');
  const actualFiles = (await filesUnder(assetRoot)).filter(file => file !== 'manifest.json');
  if (JSON.stringify([...listed].sort()) !== JSON.stringify(actualFiles)) throw new Error('Asset inventory differs from manifest; run world:assets:import after reviewing sources');
  const packs = new Map(manifest.packs.map(pack => [pack.id, pack]));
  let animated = 0, totalBytes = 0;
  for (const expected of manifest.files) {
    const actual = await inspectFile(expected.path);
    if (JSON.stringify(actual) !== JSON.stringify({ path: expected.path, bytes: expected.bytes, sha256: expected.sha256, ...(expected.gltf ? { gltf: expected.gltf } : {}) })) {
      throw new Error(`Asset hash or metadata mismatch: ${expected.path}`);
    }
    const pack = packs.get(expected.pack);
    if (!pack || pack.license !== 'CC0-1.0' || !/^[a-f0-9]{64}$/u.test(pack.archiveSha256) || !expected.sourcePath || expected.sha256 !== expected.sourceSha256) {
      throw new Error(`Missing verified provenance: ${expected.path}`);
    }
    if (!listed.has(pack.licensePath)) throw new Error(`Missing license: ${pack.id}`);
    for (const dependency of actual.gltf?.dependencies ?? []) {
      if (!listed.has(dependency.path)) throw new Error(`Missing resource: ${actual.path} -> ${dependency.path}`);
    }
    if (actual.gltf?.animations.length) animated += 1;
    totalBytes += actual.bytes;
  }
  return { files: manifest.files.length, glb: manifest.files.filter(file => file.gltf).length, animated, totalBytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(await fs.readFile(path.join(assetRoot, 'manifest.json'), 'utf8'));
  const report = await validateManifest(manifest);
  await fs.mkdir(path.join(root, 'tools/trpg-world/reports'), { recursive: true });
  await fs.writeFile(path.join(root, 'tools/trpg-world/reports/assets.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`World assets verified: ${JSON.stringify(report)}`);
}
