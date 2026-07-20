import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const service = read("src/server/trpg/game/service.js");
const narrator = read("src/server/trpg/gemini-narrator.js");
const contract = read("src/server/trpg/narrative-contract.js");
const app = read("public/TRPG/app.js");
const p0Ux = read("public/TRPG/p0-ux.js");

test("tutorial teaches movement once through the existing location control", () => {
  assert.match(service, /title: "村の広場へ向かおう"/u);
  assert.match(service, /画面上部の現在地を開き/u);
  assert.doesNotMatch(service, /世界は待っていない。上の現在地から広場へ/u);
  assert.doesNotMatch(app, /"world-keeps-moving"/u);
  assert.doesNotMatch(p0Ux, /progressionMovementButton/u);
});

test("opening characters speak from their own stakes instead of explaining the game", () => {
  assert.match(service, /村長である私の責任だ/u);
  assert.match(service, /怒られるのが怖くて黙ってた/u);
  assert.match(service, /今は、あの子の話をする声さえ出ない/u);
  assert.doesNotMatch(service, /決断が遅れれば、危機はこうして人の命を奪う/u);
  assert.doesNotMatch(service, /選んだ行動の途中にも、世界の時間は進んでいた/u);
});

test("Gemini contract rejects game and UI vocabulary in narration and NPC speech", () => {
  assert.match(contract, /trpg-narrative-v4\.9/u);
  assert.match(contract, /DIEGETIC_META_PATTERN/u);
  assert.match(contract, /narrative contains non-diegetic game or UI language/u);
  assert.match(contract, /text contains non-diegetic game or UI language/u);
  assert.match(narrator, /操作説明は別のチュートリアルUIが担う/u);
  assert.match(narrator, /NPCを全知の解説役やゲームルールの代弁者にせず/u);
});
