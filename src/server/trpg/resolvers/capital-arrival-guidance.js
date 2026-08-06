export const CAPITAL_ARRIVAL_GUIDANCE_VERSION = "capital-arrival-guidance-v3";
export const CAPITAL_WEAPON_SHOP_ID = "LOC_CAP_WEAPON_SHOP";
export const CAPITAL_LOWER_INN_ID = "LOC_CAP_LOWER_INN";
export const CAPITAL_WEAPON_SHOP_GUIDANCE_WINDOW_MINUTES = 720;
export const CAPITAL_PUBLIC_ROUTE_DESTINATIONS = Object.freeze([
  "田園の村",
  "交易都市",
  "犯罪都市",
  "辺境の村",
  "北陵要塞",
  "ドワーフ洞窟",
  "古代神殿",
  "森",
]);

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ensureCapitalArrivalGuidance(runtime) {
  runtime.capitalArrivalGuidance ??= {
    version: CAPITAL_ARRIVAL_GUIDANCE_VERSION,
    suggestedAtMinute: null,
    visitedAtMinute: null,
    firstInteractionCompletedAtMinute: null,
    firstInteractionChoiceId: null,
    routeBoardDiscoveredAtMinute: null,
    routeBoardDestinationIds: [],
  };
  runtime.capitalArrivalGuidance.version = CAPITAL_ARRIVAL_GUIDANCE_VERSION;
  runtime.capitalArrivalGuidance.suggestedAtMinute ??= null;
  runtime.capitalArrivalGuidance.visitedAtMinute ??= null;
  runtime.capitalArrivalGuidance.firstInteractionCompletedAtMinute ??= null;
  runtime.capitalArrivalGuidance.firstInteractionChoiceId ??= null;
  runtime.capitalArrivalGuidance.routeBoardDiscoveredAtMinute ??= null;
  runtime.capitalArrivalGuidance.routeBoardDestinationIds = Array.isArray(runtime.capitalArrivalGuidance.routeBoardDestinationIds)
    ? runtime.capitalArrivalGuidance.routeBoardDestinationIds
    : [];
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

export function capitalWeaponShopFirstInteractionActive(runtime) {
  const guidance = ensureCapitalArrivalGuidance(runtime);
  return guidance.visitedAtMinute != null
    && guidance.firstInteractionCompletedAtMinute == null
    && runtime?.playerState?.player?.facilityId === CAPITAL_WEAPON_SHOP_ID;
}

export function capitalWeaponShopFirstChoices(runtime, { shopkeeper = null } = {}) {
  if (!capitalWeaponShopFirstInteractionActive(runtime) || !shopkeeper?.id) return null;
  return [
    {
      id: "CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE",
      family: "talk",
      type: "conversation",
      singleTurnConversation: true,
      capitalWeaponShopFirstChoice: true,
      targetNpcId: shopkeeper.id,
      targetNpcName: shopkeeper.name ?? "店主",
      dialogueTopic: "weapon_shop_first_style",
      minutes: 7,
      label: "どんな戦い方ができるか分からないと正直に話し、店主へ相談する",
      expectedChanges: ["capitalArrivalGuidance.firstInteractionCompletedAtMinute"],
    },
    {
      id: "CAPITAL_WEAPON_SHOP:FIRST:COMPARE_HANDLING",
      family: "investigate",
      type: "localInvestigate",
      capitalWeaponShopFirstChoice: true,
      localVariant: "weapon_handling_comparison",
      minutes: 18,
      label: "剣・槍・弓・杖を順に持ち、重さと間合いの違いを確かめる",
      expectedChanges: ["capitalArrivalGuidance.firstInteractionCompletedAtMinute"],
    },
    {
      id: "CAPITAL_WEAPON_SHOP:FIRST:SET_BUDGET",
      family: "prepare",
      type: "plan",
      capitalWeaponShopFirstChoice: true,
      minutes: 9,
      label: "手持ちの装備と所持金を見せ、無理なく選べる候補だけに絞る",
      expectedChanges: ["capitalArrivalGuidance.firstInteractionCompletedAtMinute"],
    },
  ];
}

export function completeCapitalWeaponShopFirstInteraction(runtime, {
  choiceId = null,
  absoluteMinute = runtime?.playerState?.absoluteMinute,
} = {}) {
  const guidance = ensureCapitalArrivalGuidance(runtime);
  if (guidance.firstInteractionCompletedAtMinute == null) {
    guidance.firstInteractionCompletedAtMinute = number(absoluteMinute);
    guidance.firstInteractionChoiceId = choiceId ? String(choiceId) : null;
  }
  return guidance;
}

export function discoverCapitalPublicRoutes(runtime, {
  reachableHubIds = [],
  absoluteMinute = runtime?.playerState?.absoluteMinute,
} = {}) {
  const guidance = ensureCapitalArrivalGuidance(runtime);
  runtime.playerKnowledge ??= {};
  const knownHubIds = runtime.playerKnowledge.knownHubIds instanceof Set
    ? runtime.playerKnowledge.knownHubIds
    : new Set(runtime.playerKnowledge.knownHubIds ?? []);
  runtime.playerKnowledge.knownHubIds = knownHubIds;
  const reachable = reachableHubIds instanceof Set ? reachableHubIds : new Set(reachableHubIds ?? []);
  const discovered = CAPITAL_PUBLIC_ROUTE_DESTINATIONS.filter((hubId) => reachable.has(hubId));
  for (const hubId of discovered) knownHubIds.add(hubId);
  guidance.routeBoardDestinationIds = [...discovered];
  if (discovered.length && guidance.routeBoardDiscoveredAtMinute == null) {
    guidance.routeBoardDiscoveredAtMinute = number(absoluteMinute);
    if (Array.isArray(runtime?.playerState?.history)) {
      runtime.playerState.history.push({
        type: "CAPITAL_ROUTE_BOARD_DISCOVERED",
        minute: guidance.routeBoardDiscoveredAtMinute,
        destinationHubIds: [...discovered],
      });
    }
  }
  return discovered;
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
