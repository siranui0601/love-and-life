function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableText(value) {
  return String(value ?? "").trim();
}

export function resultApprovalEligibility(result) {
  const reasons = [];
  if (!result || typeof result !== "object") reasons.push("result_missing");
  if (!stableText(result?.cacheKey)) reasons.push("cache_key_missing");
  if (!new Set(["gemini", "gemini_repaired"]).has(result?.source)) reasons.push("source_not_model_validated");
  if (result?.cachePersisted !== true) reasons.push("runtime_cache_not_persisted");
  if (result?.usedFallback === true) reasons.push("fallback_used");
  if (result?.partialOutputUsed === true) reasons.push("partial_output_used");
  if (!stableText(result?.narrative)) reasons.push("narrative_missing");
  if (!Array.isArray(result?.choices) || result.choices.length !== 3) reasons.push("choices_not_three");
  if (!Array.isArray(result?.speeches)) reasons.push("speeches_missing");
  if (!Array.isArray(result?.proposals)) reasons.push("proposals_missing");
  return { eligible: reasons.length === 0, reasons };
}

export function approvedEntryFromResult(report, result, { approvedAt = new Date().toISOString() } = {}) {
  const eligibility = resultApprovalEligibility(result);
  if (!eligibility.eligible) {
    const error = new Error(`narrative_result_not_eligible:${eligibility.reasons.join(",")}`);
    error.reasons = eligibility.reasons;
    throw error;
  }
  return {
    key: stableText(result.cacheKey),
    response: {
      narrative: result.narrative,
      choices: clone(result.choices),
      speeches: clone(result.speeches),
      proposals: clone(result.proposals),
    },
    metadata: {
      scenarioId: stableText(result.scenarioId),
      sourceRunId: stableText(report?.runId),
      model: stableText(report?.model),
      promptVersion: stableText(report?.promptVersion),
      originalSource: result.source,
    },
    approvedAt,
  };
}

export function promoteApprovedNarrativeResults({ manifest, report, scenarioIds, approvedAt = new Date().toISOString() }) {
  if (manifest?.schemaVersion !== "approved-narrative-replays-v1" || !Array.isArray(manifest.entries)) {
    throw new Error("approved_manifest_invalid");
  }
  const requested = [...new Set((scenarioIds ?? []).map(stableText).filter(Boolean))];
  if (!requested.length) throw new Error("scenario_ids_required");
  const results = new Map((report?.results ?? []).map((entry) => [stableText(entry.scenarioId), entry]));
  const existingByKey = new Map(manifest.entries.map((entry) => [stableText(entry.key), entry]));
  const added = [];
  const skipped = [];
  for (const scenarioId of requested) {
    const result = results.get(scenarioId);
    if (!result) throw new Error(`scenario_not_found:${scenarioId}`);
    const entry = approvedEntryFromResult(report, result, { approvedAt });
    const existing = existingByKey.get(entry.key);
    if (existing) {
      const sameResponse = JSON.stringify(existing.response) === JSON.stringify(entry.response);
      if (!sameResponse) throw new Error(`approved_key_conflict:${scenarioId}`);
      skipped.push({ scenarioId, key: entry.key, reason: "already_approved" });
      continue;
    }
    existingByKey.set(entry.key, entry);
    added.push({ scenarioId, key: entry.key });
  }
  const entries = [...existingByKey.values()].sort((left, right) => String(left.key).localeCompare(String(right.key), "en"));
  return {
    manifest: { schemaVersion: "approved-narrative-replays-v1", entries },
    added,
    skipped,
  };
}
