from pathlib import Path


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)


registry_path = Path("src/server/trpg/content/authored-mission-flow-registry.js")
registry = registry_path.read_text(encoding="utf-8")
registry = replace_once(
    registry,
    "function resolutionContextSnapshot(runtime, choice, variant) {",
    '''function openingPlanActions(runtime, pack) {
  const hearing = pack.hearing;
  if (runtime.playerState.player.facilityId !== hearing.targetFacilityId) return null;
  return hearing.choices.map((choice) => ({
    id: actionId(pack, "OPENING", choice.id),
    family: "prepare",
    type: "plan",
    effectKind: "select_authored_mission_opening_from_known_rumor",
    missionId: pack.missionId,
    stepId: pack.investigation.stepId,
    missionTitle: pack.title,
    missionTroubleId: pack.troubleId,
    label: `聞いた噂から、${choice.label}`,
    playerUtterance: choice.playerUtterance,
    requiredDisclosure: choice.requiredDisclosure,
    minutes: Math.max(4, Math.min(8, Number(choice.minutes ?? 8))),
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "opening",
    authoredMissionFlowChoiceId: choice.id,
    authoredMissionFlowFactId: choice.factId ?? null,
    authoredMissionFlowUnlockedLeadIds: [...(choice.unlockedLeadIds ?? [])],
  }));
}

function resolutionContextSnapshot(runtime, choice, variant) {''',
    "opening plan helper",
)
registry = replace_once(
    registry,
    '''    if (step.id === pack.resolution?.stepId) {
      const actions = resolutionActions(runtime, pack, step);
      if (actions?.length === 3) return actions;
      continue;
    }
    if (step.id === pack.investigation.stepId && flow.selectedLeadId) {''',
    '''    if (step.id === pack.resolution?.stepId) {
      const actions = resolutionActions(runtime, pack, step);
      if (actions?.length === 3) return actions;
      continue;
    }
    if (step.id === pack.investigation.stepId && !flow.openingChoiceId) {
      const actions = openingPlanActions(runtime, pack);
      if (actions?.length === 3) return actions;
      continue;
    }
    if (step.id === pack.investigation.stepId && flow.selectedLeadId) {''',
    "exclusive rumor opening",
)
registry = replace_once(
    registry,
    '''  if (step?.id !== pack.investigation.stepId) return false;
  return Boolean(flow.selectedLeadId || evidenceActionForPack(runtime, pack));''',
    '''  if (step?.id !== pack.investigation.stepId) return false;
  if (!flow.openingChoiceId) return true;
  return Boolean(flow.selectedLeadId || evidenceActionForPack(runtime, pack));''',
    "generic bypass suppression",
)
registry_path.write_text(registry, encoding="utf-8")

t13_path = Path("src/server/trpg/content/authored/missions/t13-forest-king-slime-world-tree-collapse.js")
t13 = t13_path.read_text(encoding="utf-8")
t13 = replace_once(
    t13,
    'requiredDisclosure: "エダは井戸と畑の減水を記録し、リュシアは里の避難名簿を作れ、ザイードとニーヴは黒嶺が水を止めていない共同記録を出せる",',
    'requiredDisclosure: "リュシアは森入口で避難名簿を組み、ザイードは黒嶺の放水記録を公開でき、ユーリは上流に堰や軍事作業がないことを地形から示せる",',
    "downstream disclosure",
)
t13 = replace_once(
    t13,
    'unlockedLeadIds: S("eda_well_ration_plan", "zaid_water_release_record", "nene_recovery_markers"),',
    'unlockedLeadIds: S("lucia_refuge_roster", "zaid_water_release_record", "yuri_no_dam_trace"),',
    "downstream reachable leads",
)
t13 = replace_once(t13, 'facilityId: "LOC_ELF_REFUGE_PATH",', 'facilityId: "LOC_FOREST_EDGE",', "lucia facility")
t13 = replace_once(
    t13,
    'targetLocation: "エルフの隠れ里",\n        destinationName: "避難枝道・若者名簿",',
    'targetLocation: "森",\n        destinationName: "森入口・避難枝道連絡板",',
    "lucia location",
)
t13_path.write_text(t13, encoding="utf-8")
Path("tools/trpg-sim/test/zz-t13-rumor-debug.test.mjs").unlink(missing_ok=True)
