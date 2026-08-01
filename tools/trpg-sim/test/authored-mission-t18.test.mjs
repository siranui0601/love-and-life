import assert from "node:assert/strict";
import test from "node:test";
import { T18_MACHINE_COLOSSUS_PACK as P, T18_CONTINUITY_CONTRACT as C } from "../../src/server/trpg/content/authored/missions/t18-machine-colossus.js";
import { auditT18EvidenceProfiles } from "../../src/server/trpg/content/authored/missions/t18-machine-colossus-evidence.js";

test("T18 has three authored openings, eighteen independent leads, and three resolutions", () => {
  assert.equal(P.troubleId, "T18");
  assert.equal(P.hearing.choices.length, 3);
  assert.equal(P.investigation.requiredEvidenceGroups.length, 6);
  assert.deepEqual(P.investigation.requiredEvidenceGroups.map((group) => group.length), [3, 3, 3, 3, 3, 3]);
  assert.equal(P.investigation.leads.length, 18);
  assert.equal(P.resolution.choices.length, 3);
  assert.equal(C.introductionSources.length, 3);
  assert.equal(C.introductionSources.flatMap((source) => source.choices).length, 9);
  assert.equal(C.battleObjectives.length, 3);
});

test("T18 canonical timing and causal separation remain explicit", () => {
  assert.equal(P.battle.fullActivationDay, 64);
  assert.equal(P.battle.irreversibleFailureDay, 78);
  assert.equal(P.battle.earlyEncounterId, "ENC-0063");
  assert.equal(P.battle.activeEncounterId, "ENC-0064");
  const facts = P.investigation.leads.map((lead) => `${lead.discoveryText} ${lead.leadNarrative}`).join(" ");
  assert.match(facts, /世界樹/);
  assert.match(facts, /召喚/);
  assert.match(facts, /独立|一致しない|別/);
  assert.match(facts, /T19|王都防衛/);
});

test("T18 evidence audit preserves a single viable solution and no random-click clear", () => {
  const result = auditT18EvidenceProfiles();
  assert.deepEqual(result, {
    profiles: 2187,
    none: 1968,
    one: 219,
    multiple: 0,
    routes: {
      elf_root_rebinding_and_temple_reseal: 73,
      dwarf_governor_lock_and_command_rewrite: 73,
      sever_march_directive_and_joint_custody: 73,
    },
  });
});
