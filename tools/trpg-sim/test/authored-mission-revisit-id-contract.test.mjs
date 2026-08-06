import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORED_MISSION_ACTION_ID_MAX_LENGTH,
  AUTHORED_MISSION_REVISIT_ID_CONTRACT_INTERNALS,
} from "../../../src/server/trpg/content/authored-mission-flow-id-contract.js";

const { compactRevisitAction } = AUTHORED_MISSION_REVISIT_ID_CONTRACT_INTERNALS;

test("canonical first-visit action ids remain unchanged", () => {
  const action = {
    id: "MISSION_FLOW:forest-king-slime-world-tree-collapse:NAVIGATOR_FOCUS:growth_and_separation",
    authoredMissionFlowKind: "navigator_focus",
  };
  assert.equal(compactRevisitAction(action), action);
});

test("revisit and moved-evidence actions stay inside the CHOOSE id contract", () => {
  const source = {
    id: "MISSION_FLOW:forest-king-slime-world-tree-collapse:NAVIGATOR_ROUTE:core_and_ecosystem_recovery:mina_slime_core_containment:REVISIT:4200:core_cage_cracked_damage_trace",
    authoredMissionRevisit: true,
    authoredMissionRevisitKind: "evidence",
    authoredMissionRevisitStage: "route",
    authoredMissionRevisitVariant: 3,
    authoredMissionRevisitOrdinal: 4200,
    authoredMissionChoiceSetSignature: "a".repeat(800),
    authoredMissionFlowLeadId: "mina_slime_core_containment",
    authoredMissionRevisitConsequence: {
      key: "core_cage_cracked_damage_trace",
      summary: "耐魔籠は壊れ、別の物証線を追う必要がある。",
    },
    authoredMissionRevisitTargetAction: {
      id: "MISSION_FLOW:forest-king-slime-world-tree-collapse:EVIDENCE:core_and_ecosystem_recovery:mina_slime_core_containment",
    },
  };

  const compact = compactRevisitAction(source);
  assert.ok(compact.id.length <= AUTHORED_MISSION_ACTION_ID_MAX_LENGTH);
  assert.match(compact.id, /^MISSION_FLOW:T13:RV:/u);
  assert.equal(compact.authoredMissionRevisitTargetAction, source.authoredMissionRevisitTargetAction);
  assert.equal(compact.authoredMissionRevisitConsequence.summary, source.authoredMissionRevisitConsequence.summary);
});

test("different consequence variants cannot collapse to the same id", () => {
  const common = {
    authoredMissionRevisit: true,
    authoredMissionRevisitKind: "forward",
    authoredMissionRevisitStage: "route",
    authoredMissionRevisitOrdinal: 2,
    authoredMissionChoiceSetSignature: "same-choice-set",
    authoredMissionFlowLeadId: "mina_slime_core_containment",
  };
  const first = compactRevisitAction({
    ...common,
    authoredMissionRevisitVariant: 1,
    authoredMissionRevisitConsequence: { key: "core_cage_cracked" },
  });
  const second = compactRevisitAction({
    ...common,
    authoredMissionRevisitVariant: 2,
    authoredMissionRevisitConsequence: { key: "core_cage_cracked_npc_copy" },
  });
  assert.notEqual(first.id, second.id);
});
