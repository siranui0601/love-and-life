export function resolveMissionStepVariant(step, dayOrState) {
  if (!step || typeof step !== "object") return step;
  const day = Number(
    dayOrState && typeof dayOrState === "object"
      ? dayOrState.day
      : dayOrState,
  );
  if (!Number.isFinite(day)) return step;
  const variant = (step.timelineVariants ?? []).find((entry) => {
    const minDay = entry.minDay == null ? -Infinity : Number(entry.minDay);
    const maxDay = entry.maxDay == null ? Infinity : Number(entry.maxDay);
    return day >= minDay && day <= maxDay;
  });
  return variant ? { ...step, ...variant, timelineVariants: step.timelineVariants } : step;
}
