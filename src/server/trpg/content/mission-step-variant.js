function normalizedState(dayOrState) {
  if (dayOrState && typeof dayOrState === "object") return dayOrState;
  return { day: dayOrState };
}

function troubleStatus(state, troubleId) {
  const entry = state?.troubles?.[troubleId]
    ?? state?.world?.troubles?.[troubleId]
    ?? state?.worldState?.troubles?.[troubleId];
  return typeof entry === "string" ? entry : entry?.status;
}

function variantConditionsMatch(entry, state) {
  if (entry.flagKey) {
    const flags = state?.worldFlags ?? state?.flags ?? state?.world?.flags ?? {};
    const value = flags[entry.flagKey];
    if (entry.flagValue == null ? !value : value !== entry.flagValue) return false;
  }
  if (entry.troubleId) {
    const status = troubleStatus(state, entry.troubleId);
    const accepted = entry.troubleStatuses
      ?? (entry.troubleStatus ? [entry.troubleStatus] : []);
    if (accepted.length ? !accepted.includes(status) : !status) return false;
  }
  return true;
}

export function resolveMissionStepVariant(step, dayOrState) {
  if (!step || typeof step !== "object") return step;
  const state = normalizedState(dayOrState);
  const day = Number(state?.day);
  if (!Number.isFinite(day)) return step;
  const variant = (step.timelineVariants ?? []).find((entry) => {
    const minDay = entry.minDay == null ? -Infinity : Number(entry.minDay);
    const maxDay = entry.maxDay == null ? Infinity : Number(entry.maxDay);
    return day >= minDay && day <= maxDay && variantConditionsMatch(entry, state);
  });
  return variant ? { ...step, ...variant, timelineVariants: step.timelineVariants } : step;
}
