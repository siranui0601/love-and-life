#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBattleData } from './lib/battle-model.mjs';
import { buildCombatContentAudit } from './lib/combat-certification.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const outputPath = path.resolve(
  process.argv[2] ?? path.join(REPO_ROOT, 'docs', 'trpg', 'combat-content-audit-v1.json'),
);
const data = await loadBattleData();
const audit = buildCombatContentAudit(data);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  outputPath,
  counts: audit.counts,
  runtimeReady: audit.runtimeContract.runtimeReady,
  unresolvedCommands: audit.runtimeContract.unresolvedCommands.length,
  monstersWithoutUnconditionalAction: audit.runtimeContract.monstersWithoutUnconditionalAction.length,
  bossCatalogIssues: audit.runtimeContract.bossCatalogIssues.length,
}, null, 2));
