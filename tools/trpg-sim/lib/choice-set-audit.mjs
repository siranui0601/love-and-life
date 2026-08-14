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

/** 重複した画面を、並んでいた行動の種類で束ねる。`WORK+WORK+EAT` のような形になる。 */
export function duplicateFamilyOf(signature) {
  return String(signature ?? "")
    .split("|")
    .map((entry) => entry.split(":")[0])
    .sort((left, right) => left.localeCompare(right, "en"))
    .join("+");
}

export function createChoiceSetAudit() {
  return {
    schemaVersion: "trpg-choice-set-once-audit-v1",
    consumedSetIds: new Set(),
    consumedCount: 0,
    duplicateEncounterCount: 0,
    duplicateSetIds: new Set(),
    duplicateExamples: [],
    // 例は先頭20件しか残らない。**先頭20件は無作為標本ではない。**
    // 走り始めの数十分は同じ場所にいるので、そこで多い種類が20件を占める。
    // （実際、それを全体の内訳と読み違えて、6%しか減らない修正を「大半が消える」と報告した。）
    // 内訳は全件から数える。
    duplicateFamilies: new Map(),
  };
}

export function inspectChoiceSetBeforeSelection(audit, save) {
  const signature = choiceSetSignature(save);
  if (!signature) return { signature: null, duplicate: false };
  const duplicate = audit.consumedSetIds.has(signature);
  if (duplicate) {
    audit.duplicateEncounterCount += 1;
    audit.duplicateSetIds.add(signature);
    const family = duplicateFamilyOf(signature);
    audit.duplicateFamilies.set(family, (audit.duplicateFamilies.get(family) ?? 0) + 1);
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
    duplicateFamilies: Object.fromEntries(
      [...audit.duplicateFamilies.entries()].sort((left, right) => right[1] - left[1]),
    ),
    duplicateExamples: audit.duplicateExamples.map((entry) => ({ ...entry })),
    passed: audit.duplicateEncounterCount === 0,
  };
}
