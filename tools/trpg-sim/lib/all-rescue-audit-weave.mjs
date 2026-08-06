import {
  ALL_RESCUE_FINAL_WINDOW_MINUTES,
  ALL_RESCUE_WEAVE_VERSION,
  REQUIRED_ACTION_FAMILIES,
  REQUIRED_RESCUE_STRANDS,
  configuredIds,
  finite,
} from "./all-rescue-audit-core.mjs";

const clean = (value) => String(value ?? "").trim();
const list = (value) => value instanceof Set ? [...value] : Array.isArray(value) ? value : [];

export function evaluateRescueWeave(input = {}) {
  const weave = input.rescueWeave ?? {};
  const milestones = Array.isArray(weave.milestones) ? weave.milestones
    .filter((entry) => entry && Number.isFinite(Number(entry.minute)))
    .map((entry) => ({
      ...entry,
      minute: Number(entry.minute),
      strandId: clean(entry.strandId),
      actionFamily: clean(entry.actionFamily),
      troubleIds: list(entry.troubleIds).map(String),
    }))
    .sort((a, b) => a.minute - b.minute)
    : [];
  const requiredStrands = list(weave.requiredStrands).length
    ? list(weave.requiredStrands).map(String)
    : [...REQUIRED_RESCUE_STRANDS];
  const requiredFamilies = list(weave.requiredActionFamilies).length
    ? list(weave.requiredActionFamilies).map(String)
    : [...REQUIRED_ACTION_FAMILIES];
  const strandSet = new Set(milestones.map((entry) => entry.strandId).filter(Boolean));
  const familySet = new Set(milestones.map((entry) => entry.actionFamily).filter(Boolean));
  const troubleCoverage = new Set(milestones.flatMap((entry) => entry.troubleIds));
  const configuredTroubleIds = configuredIds(input);
  const firstMinute = milestones[0]?.minute ?? null;
  const lastMinute = milestones.at(-1)?.minute ?? null;
  const gameEndMinute = Math.max(1, finite(input.gameEndMinute, 100 * 1440));
  const absoluteMinute = Math.max(0, finite(input.absoluteMinute, gameEndMinute));
  const finalWindowMinutes = Math.max(1,
    finite(input.finalWindowMinutes, ALL_RESCUE_FINAL_WINDOW_MINUTES));
  const minimumSpanMinutes = Math.max(1,
    finite(weave.minimumSpanMinutes, 95 * 1440));
  const distinctDays = new Set(milestones.map((entry) => Math.floor(entry.minute / 1440) + 1));
  const minimumDistinctDays = Math.max(1, finite(weave.minimumDistinctDays, 20));
  const missingStrands = requiredStrands.filter((id) => !strandSet.has(id));
  const missingActionFamilies = requiredFamilies.filter((id) => !familySet.has(id));
  const uncoveredTroubleIds = configuredTroubleIds.filter((id) => !troubleCoverage.has(id));
  const futureMilestones = milestones.filter((entry) => entry.minute > absoluteMinute);
  const spanMinutes = firstMinute == null || lastMinute == null ? 0 : lastMinute - firstMinute;
  const startsEarlyEnough = firstMinute != null && firstMinute <= 5 * 1440;
  const reachesFinalWindow = lastMinute != null
    && lastMinute >= gameEndMinute - finalWindowMinutes
    && lastMinute <= gameEndMinute;
  const usesFullCampaign = spanMinutes >= minimumSpanMinutes
    && distinctDays.size >= minimumDistinctDays;
  const ready = milestones.length > 0
    && !missingStrands.length
    && !missingActionFamilies.length
    && !uncoveredTroubleIds.length
    && !futureMilestones.length
    && startsEarlyEnough
    && reachesFinalWindow
    && usesFullCampaign;
  return {
    version: clean(weave.version) || ALL_RESCUE_WEAVE_VERSION,
    routeId: clean(weave.routeId),
    milestones,
    milestoneCount: milestones.length,
    requiredStrands,
    missingStrands,
    requiredActionFamilies: requiredFamilies,
    missingActionFamilies,
    uncoveredTroubleIds,
    futureMilestones,
    firstMinute,
    lastMinute,
    spanMinutes,
    distinctDayCount: distinctDays.size,
    minimumSpanMinutes,
    minimumDistinctDays,
    startsEarlyEnough,
    reachesFinalWindow,
    usesFullCampaign,
    ready,
  };
}
