/**
 * Shared contract for authored, cached, templated, and Gemini-proposed choices.
 * The model may propose wording, but executable authority remains on the server.
 */

export const CHOICE_CONTRACT_VERSION = "choice-contract-v1";

export const CHOICE_FAMILIES = Object.freeze([
  "talk",
  "move",
  "investigate",
  "help",
  "prepare",
  "rest",
  "eat",
  "sleep",
  "work",
  "battle",
  "wait",
  "shop",
  "equip",
  "leave",
]);

const FAMILY_SET = new Set(CHOICE_FAMILIES);
const EXIT_FAMILIES = new Set(["move", "leave"]);

function cleanToken(value) {
  return String(value ?? "").trim();
}

function uniqueSorted(values) {
  return [...new Set(values.map(cleanToken).filter(Boolean))].sort();
}

function commandOf(choice) {
  return choice?.command && typeof choice.command === "object" && !Array.isArray(choice.command)
    ? choice.command
    : {};
}

export function normalizeChoiceFamily(choice) {
  const explicit = cleanToken(choice?.family).toLowerCase();
  if (FAMILY_SET.has(explicit)) return explicit;
  const commandType = cleanToken(commandOf(choice).type ?? choice?.type).toUpperCase();
  if (/MOVE|TRAVEL|ESCORT/.test(commandType)) return "move";
  if (/TALK|CONVERS|ASK/.test(commandType)) return "talk";
  if (/INVESTIGATE|INSPECT|SEARCH|OBSERVE/.test(commandType)) return "investigate";
  if (/EAT|MEAL|FOOD/.test(commandType)) return "eat";
  if (/SLEEP|LODG|STAY_NIGHT/.test(commandType)) return "sleep";
  if (/REST|RECOVER/.test(commandType)) return "rest";
  if (/WORK|JOB/.test(commandType)) return "work";
  if (/BATTLE|FIGHT|ATTACK/.test(commandType)) return "battle";
  if (/SHOP|BUY|SELL/.test(commandType)) return "shop";
  if (/EQUIP|UNEQUIP/.test(commandType)) return "equip";
  if (/HELP|RESCUE|TREAT/.test(commandType)) return "help";
  if (/WAIT/.test(commandType)) return "wait";
  if (/LEAVE|ABANDON/.test(commandType)) return "leave";
  return "prepare";
}

function targetTokens(choice) {
  const command = commandOf(choice);
  return uniqueSorted([
    choice?.targetNpcId,
    choice?.targetFacilityId,
    choice?.targetLocationId,
    choice?.targetId,
    command.targetNpcId,
    command.npcId,
    command.companionNpcId,
    ...(Array.isArray(command.companionNpcIds) ? command.companionNpcIds : []),
    command.targetFacilityId,
    command.destinationFacilityId,
    command.targetLocationId,
    command.destinationHub,
    ...(Array.isArray(choice?.targetIds) ? choice.targetIds : []),
  ]);
}

function effectTokens(choice) {
  const command = commandOf(choice);
  return uniqueSorted([
    command.type,
    choice?.effectKind,
    choice?.gainedFactId,
    choice?.missionId,
    choice?.stepId,
    ...(Array.isArray(choice?.expectedChanges) ? choice.expectedChanges : []),
    ...(Array.isArray(choice?.gainedFactIds) ? choice.gainedFactIds : []),
  ]);
}

export function choiceSemanticFingerprint(choice) {
  return [
    normalizeChoiceFamily(choice),
    targetTokens(choice).join(",") || "no-target",
    effectTokens(choice).join(",") || "no-effect",
  ].join("|");
}

export function validateChoice(choice, context = {}) {
  const errors = [];
  const warnings = [];
  const id = cleanToken(choice?.id);
  const label = cleanToken(choice?.label);
  const family = normalizeChoiceFamily(choice);
  const command = commandOf(choice);

  if (!id) errors.push("choice.id is required");
  if (!label) errors.push("choice.label is required");
  if (label.length > Number(context.maxLabelLength ?? 180)) errors.push("choice.label is too long");
  if (!FAMILY_SET.has(family)) errors.push(`unsupported choice family: ${family}`);
  if (!cleanToken(command.type) && !cleanToken(choice?.type)) errors.push("choice.command.type or choice.type is required");

  const presentNpcIds = context.presentNpcIds instanceof Set
    ? context.presentNpcIds
    : new Set(context.presentNpcIds ?? []);
  const visibleFacilityIds = context.visibleFacilityIds instanceof Set
    ? context.visibleFacilityIds
    : new Set(context.visibleFacilityIds ?? []);
  const npcTargets = uniqueSorted([
    choice?.targetNpcId,
    command.targetNpcId,
    command.npcId,
    command.companionNpcId,
    ...(Array.isArray(command.companionNpcIds) ? command.companionNpcIds : []),
  ]);
  const facilityTargets = uniqueSorted([
    choice?.targetFacilityId,
    command.targetFacilityId,
    command.destinationFacilityId,
  ]);

  if (context.enforceNpcPresence !== false) {
    for (const npcId of npcTargets) {
      if (presentNpcIds.size && !presentNpcIds.has(npcId)) errors.push(`target NPC is not present: ${npcId}`);
    }
  }
  if (context.enforceFacilityVisibility !== false) {
    for (const facilityId of facilityTargets) {
      if (visibleFacilityIds.size && !visibleFacilityIds.has(facilityId)) errors.push(`target facility is not visible: ${facilityId}`);
    }
  }
  if (!effectTokens(choice).length) warnings.push("choice has no declared effect or state change");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    id,
    family,
    fingerprint: choiceSemanticFingerprint(choice),
  };
}

export function validateChoiceSet(choices, context = {}) {
  const expectedCount = Number(context.expectedCount ?? 3);
  const minDistinctFamilies = Number(context.minDistinctFamilies ?? 2);
  const list = Array.isArray(choices) ? choices : [];
  const entries = list.map((choice) => validateChoice(choice, context));
  const errors = entries.flatMap((entry, index) => entry.errors.map((error) => `choices[${index}]: ${error}`));
  const warnings = entries.flatMap((entry, index) => entry.warnings.map((warning) => `choices[${index}]: ${warning}`));

  if (list.length !== expectedCount) errors.push(`choice set must contain exactly ${expectedCount} choices`);

  const ids = entries.map((entry) => entry.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push("choice IDs must be unique");

  const fingerprints = entries.map((entry) => entry.fingerprint);
  if (new Set(fingerprints).size !== fingerprints.length) {
    errors.push("choices must produce meaningfully different decisions");
  }

  const families = new Set(entries.map((entry) => entry.family));
  if (families.size < Math.min(minDistinctFamilies, expectedCount)) {
    errors.push(`choice set must contain at least ${minDistinctFamilies} distinct action families`);
  }

  if (context.requireExitRoute === true && !entries.some((entry) => EXIT_FAMILIES.has(entry.family))) {
    errors.push("choice set must include a movement or leave route");
  }

  const requiredProgressEffects = new Set(context.requiredProgressEffects ?? []);
  if (requiredProgressEffects.size) {
    const offeredEffects = new Set(list.flatMap(effectTokens));
    if (![...requiredProgressEffects].some((effect) => offeredEffects.has(effect))) {
      errors.push("choice set does not include an authoritative progress route");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    entries,
    distinctFamilies: [...families],
  };
}

export function selectDiverseChoices(candidates, context = {}) {
  const expectedCount = Number(context.expectedCount ?? 3);
  const valid = (Array.isArray(candidates) ? candidates : [])
    .map((choice, index) => ({ choice, index, validation: validateChoice(choice, context) }))
    .filter((entry) => entry.validation.valid);

  const selected = [];
  const fingerprints = new Set();
  const families = new Set();

  const attempt = (preferNewFamily) => {
    for (const entry of valid) {
      if (selected.some((selectedEntry) => selectedEntry.index === entry.index)) continue;
      if (fingerprints.has(entry.validation.fingerprint)) continue;
      if (preferNewFamily && families.has(entry.validation.family)) continue;
      selected.push(entry);
      fingerprints.add(entry.validation.fingerprint);
      families.add(entry.validation.family);
      if (selected.length >= expectedCount) return true;
    }
    return false;
  };

  attempt(true);
  if (selected.length < expectedCount) attempt(false);
  return selected.slice(0, expectedCount).map((entry) => entry.choice);
}
