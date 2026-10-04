import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCanonicalBattleSnapshotSync } from "./canonical-battle-snapshot.mjs";
import { compilePlayerSkills } from "./player-skill-compiler.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const simulationRoot = path.resolve(moduleDirectory, "..");
export const fixturesDirectory = path.join(simulationRoot, "fixtures");

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDirectory, fileName), "utf8"));
}

function applyWorldCanonicalOverlay(snapshot, overlay) {
  if (!overlay?.tabs) return snapshot;
  snapshot.source ??= {};
  snapshot.source.canonicalOverlays ??= [];
  snapshot.source.canonicalOverlays.push({ ...overlay.source, schemaVersion: overlay.schemaVersion ?? null });
  for (const [tabName, patch] of Object.entries(overlay.tabs)) {
    const tab = snapshot.tabs?.[tabName];
    if (!Array.isArray(tab)) {
      throw new Error(`Canonical world overlay refers to missing tab: ${tabName}`);
    }
    for (const row of patch?.appendRows ?? []) {
      const id = String(row?.[0] ?? "").trim();
      if (!id) throw new Error(`Canonical world overlay contains an empty row id in ${tabName}`);
      if (tab.some((existing) => String(existing?.[0] ?? "").trim() === id)) continue;
      tab.push([...row]);
    }
  }
  return snapshot;
}

export function loadWorldSnapshot() {
  const snapshot = readJson("world.snapshot.json");
  return applyWorldCanonicalOverlay(snapshot, readJson("world.canonical-overlay.json"));
}

/**
 * The production server, simulator and validators all enter battle content
 * through the same checked-in canonical artifact.  The historical
 * battle.snapshot.json is no longer an active Source of Truth.
 */
export function loadBattleSnapshot() {
  return loadCanonicalBattleSnapshotSync();
}

export function loadBossCombatCatalog() {
  return readJson("boss-combat-catalog.json");
}

export function loadSkillSupportSnapshot() {
  return readJson("skills-support.snapshot.json");
}

export function loadSkills() {
  const raw = [
    "skills-0001-0300.snapshot.json",
    "skills-0301-0600.snapshot.json",
    "skills-0601-0900.snapshot.json",
    "skills-0901-1141.snapshot.json",
  ].flatMap((fileName) => readJson(fileName).skills);
  return compilePlayerSkills(raw);
}

export function tableFromTab(tab, headerRowIndex = 3, { idColumn = 0 } = {}) {
  const headers = tab[headerRowIndex] ?? [];
  return tab
    .slice(headerRowIndex + 1)
    .filter((row) => row?.[idColumn] !== null && row?.[idColumn] !== undefined && row?.[idColumn] !== "")
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row?.[index] ?? null]))
    );
}

export function loadAllFixtures() {
  return {
    world: loadWorldSnapshot(),
    battle: loadBattleSnapshot(),
    bossCombat: loadBossCombatCatalog(),
    skillSupport: loadSkillSupportSnapshot(),
    skills: loadSkills(),
  };
}
