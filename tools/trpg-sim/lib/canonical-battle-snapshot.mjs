import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CANONICAL_BATTLE_ARTIFACT_PATH = path.resolve(
  HERE,
  '../../../docs/trpg/combat-sheet-revision20-snapshot.json',
);
export const CANONICAL_BATTLE_OVERLAY_PATH = path.resolve(
  HERE,
  '../../../docs/trpg/combat-sheet-canonical-overlay-2026-08-26.json',
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

function applyCanonicalBattleOverlay(snapshot, overlay) {
  if (overlay?.schemaVersion !== 'combat-sheet-canonical-overlay-v1') {
    throw new Error(`unsupported canonical battle overlay: ${overlay?.schemaVersion}`);
  }
  const tab = snapshot.tabs?.['店舗装備在庫'];
  if (!Array.isArray(tab)) throw new Error('canonical battle overlay requires 店舗装備在庫');
  const headerIndex = tab.findIndex((row) => row?.[0] === '在庫ID');
  if (headerIndex < 0) throw new Error('canonical battle overlay could not find 店舗装備在庫 header');
  const headers = tab[headerIndex];
  const stockIdIndex = headers.indexOf('在庫ID');
  const equipmentIdIndex = headers.indexOf('装備ID');
  const facilityIdIndex = headers.indexOf('施設ID');
  const sellerIndex = headers.indexOf('施設/売り手');
  if ([stockIdIndex, equipmentIdIndex, facilityIdIndex, sellerIndex].some((index) => index < 0)) {
    throw new Error('canonical battle overlay requires stock/equipment/facility/seller columns');
  }

  const rowsByStockId = new Map(tab.slice(headerIndex + 1)
    .filter((row) => row?.[stockIdIndex])
    .map((row) => [String(row[stockIdIndex]), row]));
  for (const [stockId, patch] of Object.entries(overlay.stockOverrides ?? {})) {
    const row = rowsByStockId.get(stockId);
    if (!row) throw new Error(`canonical battle overlay refers to missing stock: ${stockId}`);
    if (patch.equipmentId && String(row[equipmentIdIndex]) !== String(patch.equipmentId)) {
      throw new Error(`canonical battle overlay equipment mismatch for ${stockId}: ${row[equipmentIdIndex]} != ${patch.equipmentId}`);
    }
    row[facilityIdIndex] = patch.facilityId;
    row[sellerIndex] = patch.seller;
  }
  snapshot.source.canonicalOverlays ??= [];
  snapshot.source.canonicalOverlays.push({ ...overlay.source, schemaVersion: overlay.schemaVersion });
  return snapshot;
}

function readCanonicalBattleOverlaySync() {
  return JSON.parse(fs.readFileSync(CANONICAL_BATTLE_OVERLAY_PATH, 'utf8'));
}

async function readCanonicalBattleOverlay() {
  return JSON.parse(await fsp.readFile(CANONICAL_BATTLE_OVERLAY_PATH, 'utf8'));
}

export function loadCanonicalBattleSnapshotSync() {
  const snapshot = canonicalBattleSnapshotFromRecovery(
    JSON.parse(fs.readFileSync(CANONICAL_BATTLE_ARTIFACT_PATH, 'utf8')),
  );
  return applyCanonicalBattleOverlay(snapshot, readCanonicalBattleOverlaySync());
}

export async function loadCanonicalBattleSnapshot() {
  const snapshot = canonicalBattleSnapshotFromRecovery(
    JSON.parse(await fsp.readFile(CANONICAL_BATTLE_ARTIFACT_PATH, 'utf8')),
  );
  return applyCanonicalBattleOverlay(snapshot, await readCanonicalBattleOverlay());
}
