import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../', import.meta.url));
const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
for (const name of ['@babylonjs/core', '@babylonjs/loaders']) {
  if (packageJson.dependencies[name] !== '9.25.0') throw new Error(`${name} must remain pinned to the tested Babylon 9.25.0 runtime`);
}
// Compile fully in memory: a syntax error cannot destroy the currently served client.
const result = await build({
  absWorkingDir: root, entryPoints: ['src/client/trpg-world/client.js'], bundle: true,
  format: 'esm', target: ['es2022'], platform: 'browser', minify: true, splitting: true,
  outdir: 'public/TRPG/world/dist', entryNames: 'client', chunkNames: 'chunk-[hash]',
  metafile: true, write: false, logLevel: 'warning',
});
const visited = new Set();
function visit(file) {
  if (visited.has(file)) return;
  visited.add(file);
  for (const dependency of result.metafile.outputs[file]?.imports ?? []) {
    if (!dependency.external && dependency.kind !== 'dynamic-import') visit(dependency.path);
  }
}
visit('public/TRPG/world/dist/client.js');
const outputs = Object.fromEntries(result.outputFiles.map(file => {
  const relative = path.relative(root, file.path).split(path.sep).join('/');
  return [relative, { bytes: file.contents.length, gzipBytes: gzipSync(file.contents).length, sha256: createHash('sha256').update(file.contents).digest('hex'), initial: visited.has(relative) }];
}));
const values = Object.values(outputs);
const report = {
  engine: 'Babylon.js 9.25.0', files: values.length,
  totalBytes: values.reduce((sum, file) => sum + file.bytes, 0),
  initialFiles: values.filter(file => file.initial).length,
  initialBytes: values.filter(file => file.initial).reduce((sum, file) => sum + file.bytes, 0),
  initialGzipBytes: values.filter(file => file.initial).reduce((sum, file) => sum + file.gzipBytes, 0),
  outputs,
};
if (report.totalBytes > 12 * 1024 * 1024 || report.initialGzipBytes > 2 * 1024 * 1024) throw new Error(`World bundle exceeds reviewed size budget: ${JSON.stringify({ ...report, outputs: undefined })}`);

async function atomicWrite(file, contents) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  try { await fs.writeFile(temporary, contents); await fs.rename(temporary, file); }
  finally { await fs.unlink(temporary).catch(() => {}); }
}
// Publish dependencies first, then the entry and HTML. Old hashed chunks are retained
// for already-open tabs; release deployments replace a whole immutable directory.
for (const file of result.outputFiles.filter(file => path.basename(file.path) !== 'client.js')) await atomicWrite(file.path, file.contents);
const entry = result.outputFiles.find(file => path.basename(file.path) === 'client.js');
await atomicWrite(entry.path, entry.contents);
await atomicWrite(path.join(root, 'public/TRPG/index.html'), await fs.readFile(path.join(root, 'src/client/trpg-world/index.html')));
await atomicWrite(path.join(root, 'tools/trpg-world/reports/build.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`World build: ${JSON.stringify({ ...report, outputs: undefined })}`);
