export const CAPITAL_ARRIVAL_GUIDANCE_VERSION = "capital-arrival-guidance-v1";
export const CAPITAL_WEAPON_SHOP_ID = "LOC_CAP_WEAPON_SHOP";
export const CAPITAL_LOWER_INN_ID = "LOC_CAP_LOWER_INN";
export const CAPITAL_WEAPON_SHOP_GUIDANCE_WINDOW_MINUTES = 720;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ensureCapitalArrivalGuidance(runtime) {
  runtime.capitalArrivalGuidance ??= {
    version: CAPITAL_ARRIVAL_GUIDANCE_VERSION,
    suggestedAtMinute: null,
    visitedAtMinute: null,
  };
  runtime.capitalArrivalGuidance.version = CAPITAL_ARRIVAL_GUIDANCE_VERSION;
  runtime.capitalArrivalGuidance.suggestedAtMinute ??= null;
  runtime.capitalArrivalGuidance.visitedAtMinute ??= null;
  return runtime.capitalArrivalGuidance;
}

export function recordCapitalArrivalGuidance(runtime, {
  hubId = runtime?.playerState?.player?.location,
  facilityId = runtime?.playerState?.player?.facilityId,
  absoluteMinute = runtime?.playerState?.absoluteMinute,
} = {}) {
  const guidance = ensureCapitalArrivalGuidance(runtime);
  const minute = number(absoluteMinute);
  if (facilityId === CAPITAL_WEAPON_SHOP_ID) {
    guidance.visitedAtMinute ??= minute;
    return guidance;
  }
  if (hubId === "王都"
    && facilityId === CAPITAL_LOWER_INN_ID
    && guidance.suggestedAtMinute == null) {
    guidance.suggestedAtMinute = minute;
  }
  return guidance;
}

export function capitalWeaponShopGuidanceActive(runtime, {
  absoluteMinute = runtime?.playerState?.absoluteMinute,
} = {}) {
  const guidance = ensureCapitalArrivalGuidance(runtime);
  if (guidance.suggestedAtMinute == null || guidance.visitedAtMinute != null) return false;
  return number(absoluteMinute) - number(guidance.suggestedAtMinute) <= CAPITAL_WEAPON_SHOP_GUIDANCE_WINDOW_MINUTES;
}

export function prioritizeCapitalWeaponShopMovement(actions, runtime) {
  const entries = Array.isArray(actions) ? actions : [];
  if (!capitalWeaponShopGuidanceActive(runtime)) return entries;
  const index = entries.findIndex((action) => action?.destinationFacilityId === CAPITAL_WEAPON_SHOP_ID);
  if (index < 0) return entries;
  const guided = {
    ...entries[index],
    capitalArrivalGuidance: true,
    label: "王都武器屋へ行き、扱っている武器を見せてもらう",
  };
  return [guided, ...entries.slice(0, index), ...entries.slice(index + 1)];
}

export function ensureCapitalWeaponShopChoice(selected, candidates, runtime) {
  const current = Array.isArray(selected) ? [...selected] : [];
  if (!capitalWeaponShopGuidanceActive(runtime)) return current;
  const guided = (Array.isArray(candidates) ? candidates : [])
    .find((action) => action?.capitalArrivalGuidance === true
      || action?.destinationFacilityId === CAPITAL_WEAPON_SHOP_ID);
  if (!guided || current.some((action) => action?.id === guided.id)) return current;
  if (!current.length) return [guided];
  const replaceIndex = [...current].map((action, index) => ({ action, index })).reverse()
    .find(({ action }) => !action?.missionId)?.index ?? current.length - 1;
  current[replaceIndex] = {
    ...guided,
    capitalArrivalGuidance: true,
    label: "王都武器屋へ行き、扱っている武器を見せてもらう",
  };
  return current;
}
