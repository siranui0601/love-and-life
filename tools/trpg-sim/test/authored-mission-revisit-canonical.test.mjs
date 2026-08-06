import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORED_MISSION_REVISIT_CANONICAL_INTERNALS,
  AUTHORED_MISSION_REVISIT_CANONICAL_VERSION,
} from "../../../src/server/trpg/content/authored-mission-flow-revisit-canonical.js";

const {
  ensureCanonicalState,
  canonicalFingerprint,
  canonicalizeAction,
  filterCanonicalActions,
  consumeCanonicalScene,
} = AUTHORED_MISSION_REVISIT_CANONICAL_INTERNALS;

const FLOW_ID = "forest-king-slime-world-tree-collapse";

function flow() {
  return { flowId: FLOW_ID };
}

function action({ location, facility, target = "world_tree_and_recovery", variant = 1 } = {}) {
  return {
    id: `temporary:${location}:${facility}:${target}:${variant}`,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowKind: "navigator_focus",
    authoredMissionFlowNavigatorFocusId: target,
    authoredMissionRevisit: true,
    authoredMissionRevisitStage: "focus",
    authoredMissionRevisitVariant: variant,
    authoredMissionRevisitTargetKey: `focus:${target}`,
    authoredMissionRevisitSceneKey: `temporary:${location}:${target}`,
    authoredMissionRevisitContextFingerprint: [
      "stage=focus",
      "opening=world_tree_spirits_and_seal",
      "focus=",
      "group=",
      "lead=",
      "evidence=T13-EV-SEAL-CHAIN,T13-EV-WORLD-TREE-PAIN",
      "progress=MSN-T13-HEAR:1,MSN-T13-INVESTIGATE:2",
      "trouble=active",
      `location=${location}`,
      `facility=${facility}`,
    ].join("|"),
    authoredMissionRevisitConsequence: {
      key: "root_pain_moved_markers",
      label: "移された結界標を追う",
      summary: "結界標は別の場所へ移された。",
      extraMinutes: 18,
    },
  };
}

test("canonical state is versioned and serializable", () => {
  const state = ensureCanonicalState(flow());
  assert.equal(state.version, AUTHORED_MISSION_REVISIT_CANONICAL_VERSION);
  assert.deepEqual(state.consumedSceneKeys, []);
  assert.doesNotThrow(() => JSON.stringify(state));
});

test("candidate identity ignores the last evidence location and acquisition-order navigation residue", () => {
  const left = action({
    location: "エルフの隠れ里",
    facility: "LOC_FOREST_EDGE",
  });
  const right = {
    ...action({
      location: "田園の村",
      facility: "LOC_FARM_WELL",
    }),
    authoredMissionRevisitContextFingerprint: action({
      location: "田園の村",
      facility: "LOC_FARM_WELL",
    }).authoredMissionRevisitContextFingerprint
      .replace("focus=", "focus=growth_and_separation")
      .replace("group=", "group=growth_source")
      .replace("lead=", "lead=jill_slime_residue_layers"),
  };

  assert.equal(
    canonicalFingerprint(left.authoredMissionRevisitContextFingerprint),
    canonicalFingerprint(right.authoredMissionRevisitContextFingerprint),
  );
  assert.equal(canonicalizeAction(left).id, canonicalizeAction(right).id);
  assert.equal(
    canonicalizeAction(left).authoredMissionRevisitSceneKey,
    canonicalizeAction(right).authoredMissionRevisitSceneKey,
  );
});

test("a consumed causal scene cannot recur after moving elsewhere", () => {
  const state = flow();
  const first = canonicalizeAction(action({
    location: "エルフの隠れ里",
    facility: "LOC_FOREST_EDGE",
  }));
  assert.equal(consumeCanonicalScene(state, first), true);

  const elsewhere = [
    action({
      location: "田園の村",
      facility: "LOC_FARM_WELL",
    }),
    action({
      location: "田園の村",
      facility: "LOC_FARM_WELL",
      target: "growth_and_separation",
    }),
    action({
      location: "田園の村",
      facility: "LOC_FARM_WELL",
      target: "border_truth_and_survival",
    }),
  ];
  const choices = filterCanonicalActions(state, elsewhere);

  assert.equal(choices.some((candidate) =>
    candidate.authoredMissionFlowNavigatorFocusId === "world_tree_and_recovery"), false);
  assert.equal(choices.length, 3);
  assert.ok(choices.some((candidate) => candidate.authoredMissionRevisitTerminal));
});

test("new completed evidence classes create a new canonical scene", () => {
  const first = canonicalizeAction(action({
    location: "エルフの隠れ里",
    facility: "LOC_FOREST_EDGE",
  }));
  const changed = action({
    location: "田園の村",
    facility: "LOC_FARM_WELL",
    variant: 2,
  });
  changed.authoredMissionRevisitContextFingerprint = changed.authoredMissionRevisitContextFingerprint
    .replace(
      "evidence=T13-EV-SEAL-CHAIN,T13-EV-WORLD-TREE-PAIN",
      "evidence=T13-EV-SEAL-CHAIN,T13-EV-SPIRIT-POOL,T13-EV-WORLD-TREE-PAIN",
    )
    .replace("MSN-T13-INVESTIGATE:2", "MSN-T13-INVESTIGATE:3");
  const second = canonicalizeAction(changed);

  assert.notEqual(first.id, second.id);
  assert.notEqual(first.authoredMissionRevisitSceneKey, second.authoredMissionRevisitSceneKey);
  assert.equal(second.authoredMissionRevisitVariant, 2);
  assert.ok(second.id.length <= 120);
});
