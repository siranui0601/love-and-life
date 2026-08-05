import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  AUTHORED_T11_WITNESS_NETWORK_ENTRY_INTERNALS as entry,
} from "../../../src/server/trpg/content/authored-mission-flow-t11-witness-network-entry.js";

function runtime(overrides = {}) {
  return {
    authoredMissionFlows: {
      "capital-assassination-plot": {
        evidenceIds: ["T11-EVIDENCE-CROW-INTERMEDIARY-LEDGER"],
      },
    },
    playerState: {
      absoluteMinute: 41_000,
      player: {
        location: "犯罪都市",
        facilityId: "LOC_CRIME_INFO_STREET",
      },
      missions: {
        "MSN-T11": { id: "MSN-T11", status: "active" },
      },
      evidence: {
        "T11-EVIDENCE-CROW-INTERMEDIARY-LEDGER": {
          id: "T11-EVIDENCE-CROW-INTERMEDIARY-LEDGER",
          source: "LOC_CRIME_INFO_STREET:CROW_LEDGER",
        },
      },
      history: [],
      worldFlags: {},
      ...overrides,
    },
  };
}

test("T11単体監査ではクロウ台帳だけで証人保護縦sceneへ割り込まない", () => {
  const state = runtime();
  assert.equal(entry.hasPriorCompanionCausality(state), false);
  const actions = authoredMissionFlowExclusiveActions(state, {});
  assert.equal(
    (actions ?? []).some((action) => action.authoredT11WitnessNetworkChoice === true),
    false,
  );
});

test("Day1救助後の生活履歴があればクロウ台帳から手書き縦sceneを開く", () => {
  const state = runtime({
    day1T01Aftercare: {
      version: "authored-day1-t01-square-aftercare-v4",
      aftercareCompletedAtMinute: 840,
      aftercareSelectedActionId: "MISSION_FLOW:T01:SQUARE_AFTERCARE:help_mira",
      supperCompletedAtMinute: 884,
    },
  });
  assert.equal(entry.hasPriorCompanionCausality(state), true);
  const actions = authoredMissionFlowExclusiveActions(state, {});
  assert.equal(actions.length, 3);
  assert.equal(actions.every((action) => action.authoredT11WitnessNetworkChoice === true), true);
  assert.deepEqual(actions.map((action) => action.label), [
    "クロウを連れ出す",
    "台帳を三部に写す",
    "裏口を見張る",
  ]);
  assert.deepEqual(actions.map((action) => action.family), [
    "rescue",
    "observation",
    "observation",
  ]);
});

test("証人保護縦scene開始後はDay1履歴が別表現でも保存stateから継続する", () => {
  const state = runtime({
    player: {
      location: "犯罪都市",
      facilityId: "LOC_CRIME_BACK_INN",
    },
    t11WitnessNetworkFlow: {
      version: "authored-t11-witness-network-v1",
      stage: 1,
      selectedActionIds: [
        "MISSION_FLOW:T11:WITNESS_NETWORK:t11-crow-ledger-aftermath:escort_crow",
      ],
      closedActionIdsByScene: {},
      routePlanCompletedAtMinute: null,
      preferredResolution: null,
      aftermathCompletedAtMinute: null,
    },
  });
  assert.equal(entry.witnessStateStarted(state), true);
  const actions = authoredMissionFlowExclusiveActions(state, {});
  assert.equal(actions.length, 3);
  assert.equal(actions[0].authoredT11WitnessNetworkSceneId, "t11-black-lamp-shelter");
  assert.deepEqual(actions.map((action) => action.family), [
    "rescue",
    "coordination",
    "logistics",
  ]);
});

test("手書きsceneで得た正史証拠を既存T11進捗へ同期する", () => {
  const state = runtime({
    player: {
      location: "犯罪都市",
      facilityId: "LOC_CRIME_BACK_INN",
    },
    t11WitnessNetworkFlow: {
      version: "authored-t11-witness-network-v1",
      stage: 1,
      selectedActionIds: [
        "MISSION_FLOW:T11:WITNESS_NETWORK:t11-crow-ledger-aftermath:escort_crow",
      ],
      closedActionIdsByScene: {},
      routePlanCompletedAtMinute: null,
      preferredResolution: null,
      aftermathCompletedAtMinute: null,
    },
  });
  const action = authoredMissionFlowExclusiveActions(state, {})
    .find((entryAction) => entryAction.authoredT11WitnessNetworkChoiceId === "ask_vera_for_room");
  assert.ok(action);
  state.playerState.absoluteMinute += action.minutes;
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  assert.equal(result.evidenceId, "T11-EVIDENCE-VERA-BLACK-LAMP-GUEST-REGISTER");
  assert.equal(
    state.authoredMissionFlows["capital-assassination-plot"].evidenceIds.includes(
      "T11-EVIDENCE-VERA-BLACK-LAMP-GUEST-REGISTER",
    ),
    true,
  );
  assert.equal(new Set(
    state.authoredMissionFlows["capital-assassination-plot"].evidenceIds,
  ).size, 2);
});
