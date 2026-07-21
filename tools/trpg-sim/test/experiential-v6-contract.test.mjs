import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createGameRuntime, TrpgGameService } from "../../../src/server/trpg/game/service.js";
import { TRPG_NARRATIVE_PROMPT_VERSION } from "../../../src/server/trpg/narrative-contract.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

test("T01 places escort between battle and village handoff", () => {
  const data = new TrpgGameService({ allowCustomSeed: true }).data;
  const runtime = createGameRuntime(data, {
    seed: "experiential-v6-contract",
    profileId: "balanced",
    playerName: "contract",
    tutorial: true,
  });
  const mission = runtime.playerState.catalog.special.find((entry) => entry.id === "MSN-T01");
  const ids = mission.steps.map((step) => step.id);
  assert.ok(ids.includes("escort"));
  assert.ok(ids.indexOf("rescue") < ids.indexOf("escort"));
  assert.ok(ids.indexOf("escort") < ids.indexOf("decide"));
});

test("the revised prompt uses a new replay-cache namespace", () => {
  assert.equal(TRPG_NARRATIVE_PROMPT_VERSION, "trpg-narrative-v5.1-director");
});

test("the live player CLI includes all three routes and sheet sync", () => {
  const source = fs.readFileSync(path.join(root, "tools/trpg-sim/cli-experiential-player-v6.mjs"), "utf8");
  for (const token of ["rescueJourney", "workJourney", "capitalJourney", "syncNarrativeAuditToSheet", "payMatchesQuote", "reunionBeforeChoice"]) {
    assert.ok(source.includes(token), token);
  }
});
