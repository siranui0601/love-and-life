import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assetRoot, inspectGlb, validateManifest } from './inspect-assets.mjs';

function glb(json) {
  const data = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, ...json }));
  const padded = Buffer.alloc(Math.ceil(data.length / 4) * 4, 0x20); data.copy(padded);
  const result = Buffer.alloc(20 + padded.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20);
  return result;
}
test('GLB dependency inspection resolves textures and rejects remote or escaping URIs', () => {
  const metadata = inspectGlb(glb({ images: [{ uri: '../shared/palette.png' }], animations: [{ name: 'idle' }, { name: 'walk' }] }), 'actors/hero.glb');
  assert.deepEqual(metadata.dependencies, [{ uri: '../shared/palette.png', path: 'shared/palette.png' }]);
  assert.deepEqual(metadata.animations, ['idle', 'walk']);
  for (const uri of ['https://example.com/texture.png', '//example.com/t.png', '../../secret', '%2e%2e/%2e%2e/secret', '..\\secret', '/texture.png']) {
    assert.throws(() => inspectGlb(glb({ images: [{ uri }] }), 'actors/hero.glb'), /unsafe|escapes/u);
  }
});
test('GLB inspection rejects truncated payloads and out of bounds buffer views', () => {
  assert.throws(() => inspectGlb(glb({}).subarray(0, 22), 'broken.glb'), /header/u);
  assert.throws(() => inspectGlb(glb({ buffers: [{ byteLength: 100 }] }), 'broken.glb'), /payload/u);
  assert.throws(() => inspectGlb(glb({ buffers: [{ byteLength: 4, uri: 'buffer.bin' }], bufferViews: [{ buffer: 0, byteOffset: 2, byteLength: 8 }] }), 'broken.glb'), /buffer view/u);
});
test('committed model inventory, animations, original hashes and every texture are complete', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(assetRoot, 'manifest.json'), 'utf8'));
  const summary = await validateManifest(manifest);
  assert.ok(summary.glb >= 200);
  assert.ok(summary.animated >= 40);
  const hero = manifest.files.find(file => file.path === 'characters/character-a.glb');
  assert.ok(hero?.gltf.animations.includes('idle'));
  assert.ok(hero?.gltf.animations.includes('walk'));
});
