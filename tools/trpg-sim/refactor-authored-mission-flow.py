from pathlib import Path


def replace_once(source, before, after, label):
    if before not in source:
        raise RuntimeError(f"missing patch anchor: {label}")
    return source.replace(before, after, 1)


service_path = Path("src/server/trpg/game/service.js")
service = service_path.read_text(encoding="utf-8")

service = replace_once(
    service,
    '''import {
  applyT17SecondSummoningAction,
  suppressGenericT17MissionAction,
  t17SecondSummoningEvidenceAction,
  t17SecondSummoningExclusiveActions,
  t17SecondSummoningGuidance,
} from "../content/authored/missions/t17-second-summoning.js";''',
    '''import {
  applyAuthoredMissionFlowAction,
  applyAuthoredMissionFlowCatalogOverrides,
  authoredMissionFlowEvidenceAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  suppressGenericAuthoredMissionAction,
} from "../content/authored-mission-flow-registry.js";''',
    "generic mission-flow import",
)

service = replace_once(
    service,
    '''  const t17 = catalog.special.find((mission) => mission.id === "MSN-T17");
  const t17Hear = t17?.steps.find((step) => step.id === "hear");
  if (t17Hear) {
    t17Hear.targetLocation = "王都";
    t17Hear.targetFacilityId = "LOC_CAP_LOWER_INN";
    t17Hear.label = "王都下層で、第二召喚を止めようとする人物と接触する";
  }
  return catalog;''',
    '''  return applyAuthoredMissionFlowCatalogOverrides(catalog);''',
    "catalog override delegation",
)

service = service.replace(
    "const t17Exclusive = t17SecondSummoningExclusiveActions(runtime, {",
    "const authoredFlowExclusive = authoredMissionFlowExclusiveActions(runtime, {",
)
service = service.replace(
    "if (t17Exclusive) return t17Exclusive;",
    "if (authoredFlowExclusive) return authoredFlowExclusive;",
)
service = service.replace(
    "suppressGenericT17MissionAction(runtime, action)",
    "suppressGenericAuthoredMissionAction(runtime, action)",
)
service = service.replace(
    "const t17Evidence = t17SecondSummoningEvidenceAction(runtime);",
    "const authoredFlowEvidence = authoredMissionFlowEvidenceAction(runtime);",
)
service = service.replace(
    "...(t17Evidence ? [t17Evidence] : []),",
    "...(authoredFlowEvidence ? [authoredFlowEvidence] : []),",
)
service = service.replace(
    "action.t17ExclusiveChoice === true",
    "action.authoredMissionFlowExclusiveChoice === true",
)
service = service.replace(
    "applyT17SecondSummoningAction(runtime, resolvedPlayerAction, result)",
    "applyAuthoredMissionFlowAction(runtime, resolvedPlayerAction, result)",
)
service = service.replace(
    "const t17Guidance = t17SecondSummoningGuidance(runtime);",
    "const authoredFlowGuidance = authoredMissionFlowGuidance(runtime);",
)
service = service.replace("if (t17Guidance) {", "if (authoredFlowGuidance) {")
service = service.replace("...t17Guidance,", "...authoredFlowGuidance,")
service = service.replace(
    "const targetName = t17Guidance.targetFacilityId ? facilityName(t17Guidance.targetFacilityId) : null;",
    "const targetName = authoredFlowGuidance.targetFacilityId ? facilityName(authoredFlowGuidance.targetFacilityId) : null;",
)

service = replace_once(
    service,
    '''function playerUtterance(action) {
  if (!action || action.type !== "conversation") return null;
  const authored = {''',
    '''function playerUtterance(action) {
  if (!action || action.type !== "conversation") return null;
  if (action.playerUtterance) return cleanText(action.playerUtterance, 240);
  const authored = {''',
    "generic authored player utterance",
)

for line in [
    '    t17_when_where: "二度目の召喚は、いつ、どこで行われるんですか？",\n',
    '    t17_why_player: "なぜ私にその話を？　私と召喚に、どんな関係があるんですか？",\n',
    '    t17_demand_proof: "あなたたちの話だけでは動けません。私自身が確かめられる証拠を示してください。",\n',
]:
    if line not in service:
        raise RuntimeError(f"missing old T17 utterance line: {line.strip()}")
    service = service.replace(line, "", 1)

if "t17SecondSummoning" in service or "T17SecondSummoning" in service:
    raise RuntimeError("T17-specific runtime integration remains in service.js")

service_path.write_text(service, encoding="utf-8")

registry_path = Path("src/server/trpg/content/authored-scene-registry.js")
registry = registry_path.read_text(encoding="utf-8")
registry = replace_once(
    registry,
    'import { T17_SECOND_SUMMONING_SCENES } from "./authored/missions/t17-second-summoning.js";',
    'import { AUTHORED_MISSION_FLOW_SCENES } from "./authored-mission-flow-registry.js";',
    "scene registry import",
)
registry = registry.replace(
    'export const AUTHORED_CONTENT_VERSION = "authored-content-v4";',
    'export const AUTHORED_CONTENT_VERSION = "authored-content-v5";',
)
registry = registry.replace(
    "  ...T17_SECOND_SUMMONING_SCENES,",
    "  ...AUTHORED_MISSION_FLOW_SCENES,",
)
if "T17_SECOND_SUMMONING" in registry:
    raise RuntimeError("T17-specific scene import remains")
registry_path.write_text(registry, encoding="utf-8")

test_path = Path("tools/trpg-sim/test/game-service.test.mjs")
test_source = test_path.read_text(encoding="utf-8")
test_source = replace_once(
    test_source,
    '''} from "../../../src/server/trpg/game/service.js";
import { MemoryTrpgSaveStore }''',
    '''} from "../../../src/server/trpg/game/service.js";
import { AUTHORED_MISSION_FLOW_PACKS } from "../../../src/server/trpg/content/authored-mission-flow-registry.js";
import { MemoryTrpgSaveStore }''',
    "generic flow test import",
)
test_source = replace_once(
    test_source,
    '''  const authoredHearingMissionIds = new Set(["MSN-T17"]);
  const covered = [];''',
    '''  const authoredHearingMissionIds = new Set(AUTHORED_MISSION_FLOW_PACKS.map((pack) => pack.missionId));
  const authoredTroubleIds = new Set(AUTHORED_MISSION_FLOW_PACKS.map((pack) => pack.troubleId));
  const covered = [];''',
    "generic authored hearing ids",
)
test_source = replace_once(
    test_source,
    '''    // T17 uses its own reviewed Layla conversation triad; the dedicated T17
    // test owns that stricter presence and disclosure contract.
    if (authoredHearingMissionIds.has(definitionTemplate.id)) continue;''',
    '''    // Data-driven authored mission flows own their own conversation contract.
    if (authoredHearingMissionIds.has(definitionTemplate.id)) continue;''',
    "generic authored hearing comment",
)
test_source = replace_once(
    test_source,
    '''  assert.deepEqual(covered, Array.from({ length: 19 }, (_, index) => `T${String(index + 1).padStart(2, "0")}`).filter((troubleId) => troubleId !== "T17"));''',
    '''  assert.deepEqual(
    covered,
    Array.from({ length: 19 }, (_, index) => `T${String(index + 1).padStart(2, "0")}`)
      .filter((troubleId) => !authoredTroubleIds.has(troubleId)),
  );''',
    "generic authored trouble exclusion",
)
test_path.write_text(test_source, encoding="utf-8")

Path("src/server/trpg/content/authored/missions/t17-second-summoning.js").unlink()
Path("tools/trpg-sim/test/t17-second-summoning.test.mjs").unlink()
