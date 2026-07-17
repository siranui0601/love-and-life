import assert from "node:assert/strict";
import test from "node:test";

import { loadWorldModel } from "../lib/world-model.mjs";

const model = loadWorldModel();

test("all source facilities retain their canonical hub ownership", () => {
  assert.equal(model.facilities.length, 103);
  assert.equal(Object.keys(model.facilityById).length, 103);
  assert.deepEqual(
    Object.fromEntries(Object.entries(model.facilitiesByHub).map(([hub, facilities]) => [hub, facilities.length])),
    {
      "北陵要塞": 9,
      "ドワーフ洞窟": 9,
      "交易都市": 10,
      "犯罪都市": 9,
      "辺境の村": 8,
      "古代神殿": 9,
      "田園の村": 9,
      "王都": 12,
      "森": 9,
      "エルフの隠れ里": 9,
      "黒嶺連合領": 10,
    },
  );
  assert.ok(model.facilities.every((facility) => model.facilityById[facility.id] === facility));
  assert.ok(model.facilities.every((facility) => Array.isArray(facility.relatedNpcIds)));
  assert.ok(model.facilities.every((facility) => Array.isArray(facility.relatedTroubleIds)));
  assert.equal(model.facilities.reduce((sum, facility) => sum + facility.relatedNpcIds.length, 0), 76);
});

test("every NPC has a non-collapsed initial facility and valid movement scope", () => {
  assert.equal(model.npcs.length, 110);
  for (const npc of model.npcs) {
    const initialFacility = model.facilityById[npc.initialFacilityId];
    assert.ok(initialFacility, `${npc.id} initial facility`);
    assert.equal(initialFacility.hub, npc.initialLocation, `${npc.id} initial hub`);
    assert.ok(model.facilityById[npc.mainFacilityId], `${npc.id} main facility`);
    assert.ok(npc.relatedFacilityIds.every((id) => model.facilityById[id]), `${npc.id} related facilities`);
    assert.ok(npc.allowedHubs.includes(npc.home), `${npc.id} home allowance`);
    assert.ok(npc.allowedHubs.includes(npc.initialLocation), `${npc.id} initial allowance`);
  }

  const merchant = model.npcById.NPC008;
  assert.equal(merchant.sourceMainFacilityId, "行商ルート");
  assert.equal(merchant.mainFacilityId, "LOC_TRADE_INN");
  assert.equal(merchant.initialFacilityId, "LOC_FARM_INN");
  assert.deepEqual(merchant.allowedHubs, ["交易都市", "田園の村", "王都"]);

  const souvenirSeller = model.npcById.NPC095;
  assert.equal(souvenirSeller.sourceInitialLocation, "神殿土産屋");
  assert.equal(souvenirSeller.initialFacilityId, "LOC_BORDER_SOUVENIR");
  assert.equal(souvenirSeller.initialLocation, "辺境の村");
});

test("only the two known stale facility references receive audited fallbacks", () => {
  const diagnostics = model.diagnostics.filter((entry) => entry.code === "NPC_FACILITY_REFERENCE_FALLBACK");
  assert.deepEqual(
    diagnostics.map((entry) => entry.details),
    [
      {
        npcId: "NPC003",
        field: "relatedFacilities",
        sourceId: "LOC_FARM_BOARD",
        fallbackId: "LOC_FARM_SQUARE",
      },
      {
        npcId: "NPC015",
        field: "relatedFacilities",
        sourceId: "LOC_TRADE_DOCK",
        fallbackId: "LOC_TRADE_PORT",
      },
    ],
  );
  assert.ok(model.npcById.NPC003.relatedFacilityIds.includes("LOC_FARM_SQUARE"));
  assert.ok(!model.npcById.NPC003.relatedFacilityIds.includes("LOC_FARM_BOARD"));
  assert.ok(model.npcById.NPC015.relatedFacilityIds.includes("LOC_TRADE_PORT"));
  assert.ok(!model.npcById.NPC015.relatedFacilityIds.includes("LOC_TRADE_DOCK"));
  assert.ok(model.npcs.every((npc) => npc.unknownFacilityIds.length === 0));
});

test("knowledge fields split into facts, interests, misconceptions and secrets without loss", () => {
  const totals = model.npcs.reduce((result, npc) => {
    result.facts += npc.initialKnowledge.facts.length;
    result.interests += npc.initialKnowledge.interests.length;
    result.misconceptions += npc.initialKnowledge.misconceptions.length;
    result.secrets += npc.initialKnowledge.secrets.length;
    return result;
  }, { facts: 0, interests: 0, misconceptions: 0, secrets: 0 });
  assert.deepEqual(totals, { facts: 277, interests: 242, misconceptions: 110, secrets: 110 });

  assert.deepEqual(model.npcById.NPC008.initialKnowledge, {
    facts: ["rumor_player", "T13_水量低下", "T02_食料"],
    interests: ["噂", "商売"],
    misconceptions: ["黒嶺の話は怖い噂として誇張"],
    secrets: ["裏商人の名前を知る"],
  });
});

test("fate hints retain narrative provenance and deterministic anchors", () => {
  const lord = model.npcById.NPC009;
  assert.equal(lord.fateHints.sourceText, lord.nonInterventionFate);
  assert.deepEqual(lord.fateHints.dayAnchors, [38]);
  assert.deepEqual(lord.fateHints.troubleIds, []);
  assert.deepEqual(lord.fateHints.outcomeKeywords, ["死亡"]);

  const elder = model.npcById.NPC028;
  assert.deepEqual(elder.fateHints.dayAnchors, [60]);
  assert.deepEqual(elder.fateHints.outcomeKeywords, ["死亡", "行方不明"]);

  const defender = model.npcById.NPC104;
  assert.deepEqual(defender.fateHints.troubleIds, ["T13"]);
  assert.deepEqual(defender.fateHints.outcomeKeywords, ["戦死", "避難"]);
});
