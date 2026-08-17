import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CANONICAL_BATTLE_ARTIFACT_PATH = path.resolve(
  HERE,
  '../../../docs/trpg/combat-sheet-revision20-snapshot.json',
);

export function canonicalBattleSnapshotFromRecovery(recovered) {
  if (recovered?.schemaVersion !== 'combat-sheet-recovery-v2') {
    throw new Error(`unsupported canonical battle artifact: ${recovered?.schemaVersion}`);
  }
  const tabs = Object.fromEntries(
    Object.entries(recovered.tabs ?? {}).map(([name, tab]) => [name, tab.values ?? []]),
  );
  const provenance = Object.fromEntries(
    Object.entries(recovered.tabs ?? {}).map(([name, tab]) => [name, {
      range: tab.range,
      rowCount: tab.rowCount,
      columnCount: tab.columnCount,
      sha256: tab.sha256,
    }]),
  );
  return {
    schemaVersion: '1.1.0-canonical',
    source: {
      ...(recovered.source ?? {}),
      artifactPath: 'docs/trpg/combat-sheet-revision20-snapshot.json',
      aggregateSha256: recovered.aggregateSha256,
    },
    provenance,
    tabs,
  };
}

export function loadCanonicalBattleSnapshotSync() {
  return canonicalBattleSnapshotFromRecovery(
    JSON.parse(fs.readFileSync(CANONICAL_BATTLE_ARTIFACT_PATH, 'utf8')),
  );
}

export async function loadCanonicalBattleSnapshot() {
  return canonicalBattleSnapshotFromRecovery(
    JSON.parse(await fsp.readFile(CANONICAL_BATTLE_ARTIFACT_PATH, 'utf8')),
  );
}
