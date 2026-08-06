function text(value) {
  return String(value ?? "").trim();
}

export function choiceSetSignature(save) {
  const actionIds = (save?.choices ?? [])
    .map((choice) => text(choice?.actionId))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en"));
  return actionIds.length ? actionIds.join("|") : null;
}

export function createChoiceSetAudit() {
  return {
    schemaVersion: "trpg-choice-set-once-audit-v1",
    consumedSetIds: new Set(),
    consumedCount: 0,
    duplicateEncounterCount: 0,
    duplicateSetIds: new Set(),
    duplicateExamples: [],
  };
}

export function inspectChoiceSetBeforeSelection(audit, save) {
  const signature = choiceSetSignature(save);
  if (!signature) return { signature: null, duplicate: false };
  const duplicate = audit.consumedSetIds.has(signature);
  if (duplicate) {
    audit.duplicateEncounterCount += 1;
    audit.duplicateSetIds.add(signature);
    if (audit.duplicateExamples.length < 20) {
      audit.duplicateExamples.push({
        signature,
        day: save?.clock?.day ?? null,
        time: save?.clock?.time ?? null,
        minute: save?.clock?.absoluteMinute ?? null,
        location: save?.scene?.location ?? null,
        facilityId: save?.scene?.facilityId ?? null,
        choices: (save?.choices ?? []).map((choice) => ({
          actionId: choice?.actionId ?? null,
          label: choice?.label ?? null,
        })),
      });
    }
  }
  return { signature, duplicate };
}

export function recordChoiceSetSelection(audit, signature, accepted = true) {
  if (!accepted || !signature) return false;
  const wasKnown = audit.consumedSetIds.has(signature);
  audit.consumedSetIds.add(signature);
  if (!wasKnown) audit.consumedCount += 1;
  return !wasKnown;
}

export function finalizeChoiceSetAudit(audit) {
  return {
    schemaVersion: audit.schemaVersion,
    consumedCount: audit.consumedCount,
    duplicateEncounterCount: audit.duplicateEncounterCount,
    duplicateUniqueSetCount: audit.duplicateSetIds.size,
    duplicateExamples: audit.duplicateExamples.map((entry) => ({ ...entry })),
    passed: audit.duplicateEncounterCount === 0,
  };
}
