const MEANINGFUL_SCENE_MODES = new Set([
  "conversation",
  "work_generation",
  "battle_aftermath",
  "arrival",
  "exploration",
]);

const ACCEPTED_NARRATIVE_SOURCES = new Set([
  "gemini",
  "gemini_repaired",
  "approved_replay",
  "replay_cache",
]);

const WEAPON_SLOTS = new Set(["mainHand", "offHand"]);

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value) {
  return String(value ?? "").trim();
}

function appendUnique(array, value, maximum = 200) {
  if (value == null || value === "" || array.includes(value)) return;
  array.push(value);
  if (array.length > maximum) array.splice(0, array.length - maximum);
}

function normalizedLine(value) {
  return text(value)
    .normalize("NFKC")
    .replace(/[\s。、，,.!！?？「」『』（）()]/gu, "")
    .replace(/\d+/gu, "#")
    .slice(0, 180);
}

function skillIds(save) {
  const fromPlayer = save?.player?.skills;
  if (Array.isArray(fromPlayer)) return fromPlayer.map((entry) => typeof entry === "string" ? entry : entry?.id).filter(Boolean);
  return (save?.skills?.learned ?? []).map((entry) => typeof entry === "string" ? entry : entry?.id).filter(Boolean);
}

function inventoryEquipment(save) {
  return Array.isArray(save?.player?.inventory?.equipment) ? save.player.inventory.equipment : [];
}

function equippedWeaponTypes(save) {
  return inventoryEquipment(save)
    .filter((entry) => entry?.equipped === true
      || (Array.isArray(entry?.equipped) && entry.equipped.some((slot) => WEAPON_SLOTS.has(slot))))
    .map((entry) => entry.weaponType)
    .filter(Boolean);
}

export function createDay100ExperienceAudit() {
  return {
    schemaVersion: "trpg-day100-experience-audit-v1",
    narrative: {
      totalScenes: 0,
      meaningfulScenes: 0,
      acceptedMeaningfulScenes: 0,
      fallbackMeaningfulScenes: 0,
      partialMeaningfulScenes: 0,
      sourceCounts: {},
      fallbackSamples: [],
    },
    conversation: {
      turns: 0,
      topicCounts: {},
      speakers: [],
      gainedInformationTurns: 0,
      missionProgressTurns: 0,
      shopGuidanceTurns: 0,
      repeatedLineCount: 0,
      lineFingerprints: {},
      choiceIntentSignatures: {},
      consequenceSamples: [],
    },
    skills: {
      acquiredIds: [],
      firstAcquiredAt: {},
      usedIds: [],
      useCounts: {},
      availableInBattleIds: [],
    },
    equipment: {
      ownedIds: [],
      triedIds: [],
      boughtIds: [],
      borrowedIds: [],
      rewardedIds: [],
      equippedIds: [],
      weaponTypesOwned: [],
      weaponTypesEquipped: [],
      battleRoundsByWeaponType: {},
    },
    survival: {
      mealsConsumed: 0,
      mealSeekingMoves: 0,
      restsCompleted: 0,
      workCompleted: 0,
    },
  };
}

export function meaningfulNarrativeScene(input) {
  const action = input?.action ?? {};
  if (MEANINGFUL_SCENE_MODES.has(input?.sceneMode)) return true;
  if (action?.missionId || action?.firstIntroduction) return true;
  return false;
}

export function observeNarrativeExperience(audit, input, response) {
  const source = text(response?.meta?.source) || "unknown";
  const meaningful = meaningfulNarrativeScene(input);
  audit.narrative.totalScenes += 1;
  audit.narrative.sourceCounts[source] = number(audit.narrative.sourceCounts[source]) + 1;
  if (meaningful) {
    audit.narrative.meaningfulScenes += 1;
    if (ACCEPTED_NARRATIVE_SOURCES.has(source)) audit.narrative.acceptedMeaningfulScenes += 1;
    else audit.narrative.fallbackMeaningfulScenes += 1;
    if (response?.meta?.partialOutputUsed === true || source === "gemini_partial") {
      audit.narrative.partialMeaningfulScenes += 1;
    }
    if (!ACCEPTED_NARRATIVE_SOURCES.has(source)) {
      audit.narrative.fallbackSamples.push({
        scenarioId: input?.scenarioId ?? null,
        sceneMode: input?.sceneMode ?? null,
        actionId: input?.action?.id ?? null,
        source,
        validationErrors: response?.meta?.validationErrors ?? [],
      });
      if (audit.narrative.fallbackSamples.length > 30) audit.narrative.fallbackSamples.shift();
    }
  }

  if (input?.sceneMode !== "conversation") return audit;
  audit.conversation.turns += 1;
  const topic = text(input?.action?.dialogueTopic) || "unspecified";
  audit.conversation.topicCounts[topic] = number(audit.conversation.topicCounts[topic]) + 1;
  for (const speech of response?.speeches ?? []) {
    appendUnique(audit.conversation.speakers, speech?.actorId);
    const fingerprint = normalizedLine(speech?.text);
    if (!fingerprint) continue;
    const count = number(audit.conversation.lineFingerprints[fingerprint]) + 1;
    audit.conversation.lineFingerprints[fingerprint] = count;
    if (count > 1) audit.conversation.repeatedLineCount += 1;
  }
  const intentSignature = (response?.choices ?? []).map((choice) => choice?.intentType ?? "unknown").join("|");
  audit.conversation.choiceIntentSignatures[intentSignature] = number(audit.conversation.choiceIntentSignatures[intentSignature]) + 1;
  if (input?.action?.requiredDisclosure || (input?.authoritativeOutcome?.learnedRumorIds?.length ?? 0) > 0) {
    audit.conversation.gainedInformationTurns += 1;
  }
  if ((input?.authoritativeOutcome?.advancedMissionIds?.length ?? 0) > 0
    || input?.action?.missionId
    || input?.authoritativeOutcome?.mission?.statusChanged === true) {
    audit.conversation.missionProgressTurns += 1;
  }
  if (/武器屋|装備|試し|武器/u.test(`${response?.narrative ?? ""} ${(response?.speeches ?? []).map((entry) => entry?.text).join(" ")}`)) {
    audit.conversation.shopGuidanceTurns += 1;
  }
  if (input?.action?.requiredDisclosure || input?.action?.missionId) {
    audit.conversation.consequenceSamples.push({
      scenarioId: input?.scenarioId ?? null,
      topic,
      missionId: input?.action?.missionId ?? null,
      requiredDisclosure: input?.action?.requiredDisclosure ?? null,
      choiceIntents: (response?.choices ?? []).map((choice) => choice?.intentType ?? null),
    });
    if (audit.conversation.consequenceSamples.length > 40) audit.conversation.consequenceSamples.shift();
  }
  return audit;
}

export function observeSaveExperience(audit, before, after, decision = {}) {
  const beforeSkills = new Set(skillIds(before));
  const afterSkills = skillIds(after);
  for (const skillId of afterSkills) {
    appendUnique(audit.skills.acquiredIds, skillId, 1200);
    if (!beforeSkills.has(skillId) && !audit.skills.firstAcquiredAt[skillId]) {
      audit.skills.firstAcquiredAt[skillId] = {
        day: after?.clock?.day ?? null,
        minute: after?.clock?.absoluteMinute ?? null,
        sourceActionId: decision?.actionId ?? null,
      };
    }
  }

  const beforeEquipment = new Set(inventoryEquipment(before).map((entry) => entry.id));
  for (const entry of inventoryEquipment(after)) {
    appendUnique(audit.equipment.ownedIds, entry.id, 500);
    appendUnique(audit.equipment.weaponTypesOwned, entry.weaponType, 80);
    if (!beforeEquipment.has(entry.id)) {
      const actionId = text(decision?.actionId);
      if (/BORROW/u.test(actionId)) appendUnique(audit.equipment.borrowedIds, entry.id);
      else if (/CLAIM.*REWARD|REWARD/u.test(actionId)) appendUnique(audit.equipment.rewardedIds, entry.id);
      else if (/BUY/u.test(actionId)) appendUnique(audit.equipment.boughtIds, entry.id);
    }
    if (entry?.equipped === true || (Array.isArray(entry?.equipped) && entry.equipped.length)) {
      appendUnique(audit.equipment.equippedIds, entry.id);
      appendUnique(audit.equipment.weaponTypesEquipped, entry.weaponType, 80);
    }
  }
  if (/SHOP_TRY/u.test(text(decision?.actionId))) appendUnique(audit.equipment.triedIds, decision?.equipmentId ?? decision?.stockId ?? decision?.actionId);
  if (decision?.accepted !== false) {
    if (decision?.category === "meal_consumed") audit.survival.mealsConsumed += 1;
    if (decision?.category === "meal_search_move") audit.survival.mealSeekingMoves += 1;
    if (decision?.category === "rest") audit.survival.restsCompleted += 1;
    if (decision?.category === "work") audit.survival.workCompleted += 1;
  }
  return audit;
}

export function observeBattleExperience(audit, save, command) {
  const actionId = text(command?.actionId);
  const commandKind = text(command?.kind);
  if (commandKind === "skill" || /^SKL-/u.test(actionId)) {
    appendUnique(audit.skills.availableInBattleIds, actionId, 1200);
  }
  if (command?.selected === true && (commandKind === "skill" || /^SKL-/u.test(actionId))) {
    appendUnique(audit.skills.usedIds, actionId, 1200);
    audit.skills.useCounts[actionId] = number(audit.skills.useCounts[actionId]) + 1;
  }
  for (const weaponType of equippedWeaponTypes(save)) {
    audit.equipment.battleRoundsByWeaponType[weaponType] = number(audit.equipment.battleRoundsByWeaponType[weaponType]) + 1;
  }
  return audit;
}

export function finalizeExperienceAudit(audit) {
  const meaningful = audit.narrative.meaningfulScenes;
  const accepted = audit.narrative.acceptedMeaningfulScenes;
  return {
    ...audit,
    narrative: {
      ...audit.narrative,
      acceptedMeaningfulRatio: meaningful ? accepted / meaningful : 1,
      passed: meaningful > 0
        && audit.narrative.fallbackMeaningfulScenes === 0
        && audit.narrative.partialMeaningfulScenes === 0,
    },
    conversation: {
      ...audit.conversation,
      distinctSpeakerCount: audit.conversation.speakers.length,
      distinctTopicCount: Object.keys(audit.conversation.topicCounts).length,
      distinctChoiceIntentSignatureCount: Object.keys(audit.conversation.choiceIntentSignatures).length,
    },
    skills: {
      ...audit.skills,
      acquiredCount: audit.skills.acquiredIds.length,
      usedCount: audit.skills.usedIds.length,
    },
    equipment: {
      ...audit.equipment,
      ownedCount: audit.equipment.ownedIds.length,
      weaponTypeOwnedCount: audit.equipment.weaponTypesOwned.length,
      weaponTypeEquippedCount: audit.equipment.weaponTypesEquipped.length,
    },
  };
}
