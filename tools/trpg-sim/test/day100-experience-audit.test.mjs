import assert from "node:assert/strict";
import test from "node:test";
import {
  createDay100ExperienceAudit,
  finalizeExperienceAudit,
  meaningfulNarrativeScene,
  observeNarrativeExperience,
  observeSaveExperience,
} from "../lib/day100-experience-audit.mjs";

test("conversation and mission scenes are meaningful while routine free-roam is not", () => {
  assert.equal(meaningfulNarrativeScene({ sceneMode: "conversation", action: {} }), true);
  assert.equal(meaningfulNarrativeScene({ sceneMode: "free_roam", action: { missionId: "MSN-T02" } }), true);
  assert.equal(meaningfulNarrativeScene({ sceneMode: "free_roam", action: { type: "eat" } }), false);
});

test("a deterministic policy fallback makes meaningful conversation quality fail", () => {
  const audit = createDay100ExperienceAudit();
  observeNarrativeExperience(audit, {
    scenarioId: "conversation-1",
    sceneMode: "conversation",
    action: { id: "DIALOGUE", dialogueTopic: "local_concern" },
  }, {
    narrative: "定型文",
    speeches: [],
    choices: [],
    meta: { source: "day100_policy_fallback", partialOutputUsed: false },
  });
  const result = finalizeExperienceAudit(audit);
  assert.equal(result.narrative.meaningfulScenes, 1);
  assert.equal(result.narrative.fallbackMeaningfulScenes, 1);
  assert.equal(result.narrative.passed, false);
});

test("Gemini conversation records information, choice diversity, and repeated speech", () => {
  const audit = createDay100ExperienceAudit();
  const input = {
    scenarioId: "conversation-2",
    sceneMode: "conversation",
    action: {
      id: "DIALOGUE",
      dialogueTopic: "mission_clue",
      missionId: "MSN-T02",
      requiredDisclosure: "穀倉で油の臭いがした",
    },
  };
  const response = {
    narrative: "相手は辺りを見てから声を落とした。",
    speeches: [{ actorId: "NPC-A", text: "穀倉で油の臭いがした。" }],
    choices: [
      { intentType: "investigate" },
      { intentType: "talk" },
      { intentType: "move" },
    ],
    meta: { source: "gemini", partialOutputUsed: false },
  };
  observeNarrativeExperience(audit, input, response);
  observeNarrativeExperience(audit, input, response);
  const result = finalizeExperienceAudit(audit);
  assert.equal(result.narrative.passed, true);
  assert.equal(result.conversation.gainedInformationTurns, 2);
  assert.equal(result.conversation.missionProgressTurns, 2);
  assert.equal(result.conversation.repeatedLineCount, 1);
  assert.equal(result.conversation.distinctChoiceIntentSignatureCount, 1);
});

test("save audit separates consumed meals from meal-seeking movement and records weapon breadth", () => {
  const audit = createDay100ExperienceAudit();
  const before = {
    clock: { day: 1, absoluteMinute: 100 },
    player: { inventory: { equipment: [] } },
    skills: { learned: [] },
  };
  const after = {
    clock: { day: 2, absoluteMinute: 1600 },
    player: {
      inventory: {
        equipment: [
          { id: "EQ-SPEAR", weaponType: "spear", equipped: ["mainHand"] },
          { id: "EQ-BOW", weaponType: "bow", equipped: [] },
        ],
      },
    },
    skills: { learned: [{ id: "SKL-A" }, { id: "SKL-B" }] },
  };
  observeSaveExperience(audit, before, after, { accepted: true, category: "meal_search_move", actionId: "MOVE:INN" });
  observeSaveExperience(audit, after, after, { accepted: true, category: "meal_consumed", actionId: "EAT:INN" });
  const result = finalizeExperienceAudit(audit);
  assert.equal(result.survival.mealSeekingMoves, 1);
  assert.equal(result.survival.mealsConsumed, 1);
  assert.deepEqual(result.skills.acquiredIds.sort(), ["SKL-A", "SKL-B"]);
  assert.deepEqual(result.equipment.weaponTypesOwned.sort(), ["bow", "spear"]);
  assert.deepEqual(result.equipment.weaponTypesEquipped, ["spear"]);
});
