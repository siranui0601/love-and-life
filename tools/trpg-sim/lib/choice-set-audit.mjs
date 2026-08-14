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
    // ## 測ってから直すための欄（2026-08-14）
    //
    // 「同じ三択が二度出た」だけでは、どう直すかが決まらない。
    //   **同じ施設で二度出た**なら、その場面の作り方そのものが同じ札を返している
    //   **違う施設で二度出た**なら、札のIDに現在地が入っていないだけ
    // 直し方が正反対なので、**先にどちらが多いかを数える。**
    // （推定して直してから測る、を二度やって、6%と0%だった。）
    firstFacilityBySignature: new Map(),
    duplicateSameFacilityCount: 0,
    duplicateCrossFacilityCount: 0,
    duplicateCrossFacilityFamilies: new Map(),
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
    const facilityId = text(save?.scene?.facilityId) || null;
    const firstFacilityId = audit.firstFacilityBySignature.get(signature) ?? null;
    if (firstFacilityId !== null && facilityId !== null && firstFacilityId !== facilityId) {
      audit.duplicateCrossFacilityCount += 1;
      audit.duplicateCrossFacilityFamilies.set(
        family,
        (audit.duplicateCrossFacilityFamilies.get(family) ?? 0) + 1,
      );
    } else {
      audit.duplicateSameFacilityCount += 1;
    }
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

export function recordChoiceSetSelection(audit, signature, accepted = true, save = null) {
  if (!accepted || !signature) return false;
  const wasKnown = audit.consumedSetIds.has(signature);
  audit.consumedSetIds.add(signature);
  if (!wasKnown) {
    audit.consumedCount += 1;
    const facilityId = text(save?.scene?.facilityId);
    if (facilityId) audit.firstFacilityBySignature.set(signature, facilityId);
  }
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
    duplicateSameFacilityCount: audit.duplicateSameFacilityCount,
    duplicateCrossFacilityCount: audit.duplicateCrossFacilityCount,
    duplicateCrossFacilityFamilies: Object.fromEntries(
      [...audit.duplicateCrossFacilityFamilies.entries()].sort((left, right) => right[1] - left[1]),
    ),
    passed: audit.duplicateEncounterCount === 0,
  };
}
