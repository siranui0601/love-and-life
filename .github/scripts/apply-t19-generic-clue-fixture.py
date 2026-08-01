from pathlib import Path

TARGET = Path("tools/trpg-sim/test/game-service.test.mjs")
SELF = Path(".github/scripts/apply-t19-generic-clue-fixture.py")
text = TARGET.read_text(encoding="utf-8")

old_definition = '''  const definition = state.catalog.special.find((entry) => {
    if (authoredMissionIds.has(entry.id)) return false;
    const hearing = entry.steps.find((step) => step.type === "conversation");
    return hearing && data.model.npcs.some((npc) =>
      npc.relatedTroubleIds.includes(entry.troubleId)
      && npc.allowedHubs.includes(hearing.targetLocation)
      && npc.disposition !== "escalate");
  });
  assert.ok(definition, "the generic clue contract needs at least one non-authored mission");
'''
new_definition = '''  let definition = state.catalog.special.find((entry) => {
    if (authoredMissionIds.has(entry.id)) return false;
    const hearing = entry.steps.find((step) => step.type === "conversation");
    return hearing && data.model.npcs.some((npc) =>
      npc.relatedTroubleIds.includes(entry.troubleId)
      && npc.allowedHubs.includes(hearing.targetLocation)
      && npc.disposition !== "escalate");
  });

  // T01-T19 are now all authored. Keep the generic conversation contract covered
  // with a test-only catalog clone instead of leaving one production mission generic.
  if (!definition) {
    const template = state.catalog.special.find((entry) => {
      const hearing = entry.steps.find((step) => step.type === "conversation");
      return hearing && data.model.npcs.some((npc) =>
        npc.relatedTroubleIds.includes(entry.troubleId)
        && npc.allowedHubs.includes(hearing.targetLocation)
        && npc.disposition !== "escalate");
    });
    assert.ok(template, "the generic clue fixture needs a conversation mission template");
    const templateHearing = template.steps.find((step) => step.type === "conversation");
    const fixtureId = `TEST-GENERIC-${template.id}`;
    const steps = template.steps.map((step) => ({
      ...step,
      id: `test-generic-${step.id}`,
    }));
    definition = {
      ...template,
      id: fixtureId,
      title: `汎用会話契約試験：${template.title}`,
      steps,
    };
    state.catalog.special.push(definition);
    state.catalog.byId.set(definition.id, definition);
    const templateMission = state.missions[template.id];
    state.missions[definition.id] = {
      ...structuredClone(templateMission),
      status: "locked",
      progress: Object.fromEntries(steps.map((step) => [step.id, 0])),
      discoveries: [],
    };
    assert.equal(
      definition.steps.find((step) => step.type === "conversation").targetFacilityId,
      templateHearing.targetFacilityId,
    );
  }
'''
old_activation = '''  state.troubles[definition.troubleId].status = "active";
  state.missions[definition.id].status = "active";
  state.missions[definition.id].progress[hearing.id] = 0;
'''
new_activation = '''  state.troubles[definition.troubleId].status = "active";
  for (const missionDefinition of state.catalog.special) {
    state.missions[missionDefinition.id].status =
      missionDefinition.id === definition.id ? "active" : "locked";
  }
  state.missions[definition.id].progress[hearing.id] = 0;
'''

if old_definition not in text:
    raise SystemExit("generic clue definition block was not found exactly")
if text.count(old_activation) != 1:
    raise SystemExit(f"generic clue activation block count was {text.count(old_activation)}, expected 1")

text = text.replace(old_definition, new_definition, 1)
text = text.replace(old_activation, new_activation, 1)
TARGET.write_text(text, encoding="utf-8")
SELF.unlink()
print("Patched generic clue fixture and removed one-time patch script.")
