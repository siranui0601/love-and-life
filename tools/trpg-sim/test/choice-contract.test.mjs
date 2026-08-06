import assert from "node:assert/strict";
import test from "node:test";
import {
  choiceSemanticFingerprint,
  selectDiverseChoices,
  validateChoiceSet,
} from "../../../src/server/trpg/content/choice-contract.js";

const context = {
  presentNpcIds: new Set(["NPC001", "NPC002"]),
  visibleFacilityIds: new Set(["LOC_FARM_EDGE", "LOC_FARM_SQUARE", "LOC_FARM_INN"]),
};

test("three differently worded versions of the same investigation are rejected", () => {
  const choices = [
    { id: "track-shoes", family: "investigate", label: "小さな靴跡を追う", command: { type: "INVESTIGATE", targetFacilityId: "LOC_FARM_EDGE" }, expectedChanges: ["T01.searchProgress"] },
    { id: "track-thread", family: "investigate", label: "青い糸を手掛かりに探す", command: { type: "INVESTIGATE", targetFacilityId: "LOC_FARM_EDGE" }, expectedChanges: ["T01.searchProgress"] },
    { id: "track-claws", family: "investigate", label: "爪痕から経路を読む", command: { type: "INVESTIGATE", targetFacilityId: "LOC_FARM_EDGE" }, expectedChanges: ["T01.searchProgress"] },
  ];
  assert.equal(new Set(choices.map(choiceSemanticFingerprint)).size, 1);
  const result = validateChoiceSet(choices, context);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("choices must produce meaningfully different decisions"));
});

test("talk, move, and treatment form a valid rescue decision", () => {
  const choices = [
    { id: "ask-finn", family: "talk", label: "何が起きたのかフィンに聞く", targetNpcId: "NPC001", command: { type: "TALK", npcId: "NPC001" }, expectedChanges: ["facts.T01_ATTACK_DETAILS"] },
    { id: "escort-finn", family: "move", label: "フィンを支えて村の広場へ戻る", command: { type: "START_ESCORT", companionNpcId: "NPC001", targetFacilityId: "LOC_FARM_SQUARE" }, expectedChanges: ["player.facilityId", "escort.arrivedSquare"] },
    { id: "treat-finn", family: "help", label: "応急処置をしてから移動する", command: { type: "TREAT", targetNpcId: "NPC001" }, expectedChanges: ["NPC001.injury", "time.absoluteMinute"] },
  ];
  const result = validateChoiceSet(choices, { ...context, requireExitRoute: true });
  assert.equal(result.valid, true, result.errors.join("\n"));
});

test("choices cannot target an absent NPC or hidden facility", () => {
  const result = validateChoiceSet([
    { id: "talk-missing", family: "talk", label: "青年に話しかける", command: { type: "TALK", npcId: "NPC999" }, expectedChanges: ["dialogue"] },
    { id: "move-hidden", family: "move", label: "存在しない店へ向かう", command: { type: "MOVE", targetFacilityId: "LOC_CAP_BIG_STORE" }, expectedChanges: ["player.facilityId"] },
    { id: "wait", family: "wait", label: "少し待つ", command: { type: "WAIT" }, expectedChanges: ["time.absoluteMinute"] },
  ], context);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("NPC999")));
  assert.ok(result.errors.some((error) => error.includes("LOC_CAP_BIG_STORE")));
});

test("selectDiverseChoices prefers different action families and effects", () => {
  const candidates = [
    { id: "inspect-a", family: "investigate", label: "足跡を調べる", command: { type: "INVESTIGATE", targetFacilityId: "LOC_FARM_EDGE" }, expectedChanges: ["T01.searchProgress"] },
    { id: "inspect-b", family: "investigate", label: "草を調べる", command: { type: "INVESTIGATE", targetFacilityId: "LOC_FARM_EDGE" }, expectedChanges: ["T01.searchProgress"] },
    { id: "talk", family: "talk", label: "フィンに声をかける", command: { type: "TALK", npcId: "NPC001" }, expectedChanges: ["dialogue.finn"] },
    { id: "move", family: "move", label: "村の広場へ戻る", command: { type: "MOVE", targetFacilityId: "LOC_FARM_SQUARE" }, expectedChanges: ["player.facilityId"] },
    { id: "rest", family: "rest", label: "安全を確かめて休む", command: { type: "REST" }, expectedChanges: ["player.fatigue"] },
  ];
  const selected = selectDiverseChoices(candidates, context);
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((choice) => choice.family)).size, 3);
  assert.equal(new Set(selected.map(choiceSemanticFingerprint)).size, 3);
});
