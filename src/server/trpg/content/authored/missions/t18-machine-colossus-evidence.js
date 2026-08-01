import { T18_MACHINE_COLOSSUS_PACK as P } from "./t18-machine-colossus.js";

const groups = P.investigation.requiredEvidenceGroups;

export function evaluateT18EvidenceProfile(openingChoiceId, selectedEvidenceIds) {
  const selected = new Set(selectedEvidenceIds);
  return P.resolution.choices.filter((route) => {
    const readiness = route.readiness;
    const groupReady = readiness.requiredEvidenceGroups.every((group) =>
      group.some((evidenceId) => selected.has(evidenceId)));
    const support = readiness.supportingEvidenceIds.filter((id) => selected.has(id)).length;
    const openingSupport = readiness.openingChoiceIds.includes(openingChoiceId)
      ? Number(readiness.openingSupport ?? 0)
      : 0;
    return groupReady && support + openingSupport >= readiness.minimumSupport;
  }).map((route) => route.id);
}

export function auditT18EvidenceProfiles() {
  const choices = P.hearing.choices.map((choice) => choice.id);
  const results = { profiles: 0, none: 0, one: 0, multiple: 0, routes: {} };
  for (const openingChoiceId of choices) {
    for (let profile = 0; profile < 3 ** groups.length; profile += 1) {
      let cursor = profile;
      const evidenceIds = [];
      for (const group of groups) {
        evidenceIds.push(group[cursor % group.length]);
        cursor = Math.floor(cursor / group.length);
      }
      const ready = evaluateT18EvidenceProfile(openingChoiceId, evidenceIds);
      results.profiles += 1;
      if (ready.length === 0) results.none += 1;
      else if (ready.length === 1) {
        results.one += 1;
        results.routes[ready[0]] = Number(results.routes[ready[0]] ?? 0) + 1;
      } else results.multiple += 1;
    }
  }
  return results;
}
