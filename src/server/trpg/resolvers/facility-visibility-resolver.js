import { evaluateConditionGroup } from "./condition-evaluator.js";

export const FACILITY_VISIBILITY_RULESET_VERSION = "facility-timeline-v1";

export const FACILITY_TIMELINE_RULES = Object.freeze({
  LOC_CAP_ORPHANAGE: Object.freeze({
    exclusiveGroup: "CAP_ORPHANAGE_SITE",
    visibleWhen: Object.freeze({
      none: Object.freeze([
        Object.freeze({ path: "troubles.T10.status", op: "eq", value: "failed" }),
      ]),
    }),
    hiddenReason: "T10失敗後は白鈴孤児院が閉鎖される",
  }),
  LOC_CAP_BIG_STORE: Object.freeze({
    exclusiveGroup: "CAP_ORPHANAGE_SITE",
    visibleWhen: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "troubles.T10.status", op: "eq", value: "failed" }),
        Object.freeze({ path: "day", op: "gte", value: 70 }),
      ]),
    }),
    hiddenReason: "孤児院跡地大型店はT10失敗後かつDay70以降のみ開業する",
  }),
});

function normalizedFacilityId(facilityOrId) {
  return typeof facilityOrId === "string" ? facilityOrId : facilityOrId?.id;
}

export function facilityVisibility(facilityOrId, worldState) {
  const facilityId = normalizedFacilityId(facilityOrId);
  const rule = FACILITY_TIMELINE_RULES[facilityId];
  if (!rule) {
    return {
      facilityId,
      visible: true,
      exclusiveGroup: null,
      reason: null,
      rulesetVersion: FACILITY_VISIBILITY_RULESET_VERSION,
    };
  }
  const visible = evaluateConditionGroup(rule.visibleWhen, worldState);
  return {
    facilityId,
    visible,
    exclusiveGroup: rule.exclusiveGroup ?? null,
    reason: visible ? null : rule.hiddenReason ?? "施設の時系列条件を満たしていない",
    rulesetVersion: FACILITY_VISIBILITY_RULESET_VERSION,
  };
}

export function filterVisibleFacilities(facilities, worldState) {
  return (Array.isArray(facilities) ? facilities : [])
    .filter((facility) => facilityVisibility(facility, worldState).visible);
}

export function findExclusiveFacilityConflicts(facilities, worldState) {
  const byGroup = new Map();
  for (const facility of filterVisibleFacilities(facilities, worldState)) {
    const visibility = facilityVisibility(facility, worldState);
    if (!visibility.exclusiveGroup) continue;
    const members = byGroup.get(visibility.exclusiveGroup) ?? [];
    members.push(normalizedFacilityId(facility));
    byGroup.set(visibility.exclusiveGroup, members);
  }
  return [...byGroup.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([exclusiveGroup, facilityIds]) => ({ exclusiveGroup, facilityIds }));
}
