import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_T11_WITNESS_NETWORK_INTERNALS as flow,
  AUTHORED_T11_WITNESS_NETWORK_VERSION,
} from "../../../src/server/trpg/content/authored-mission-flow-t11-witness-network.js";

function baseRuntime() {
  return {
    playerState: {
      absoluteMinute: 41_000,
      player: {
        location: "犯罪都市",
        facilityId: "LOC_CRIME_INFO_STREET",
        needs: { hunger: 24, fatigue: 31 },
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
      goapRequests: {},
    },
  };
}

function select(runtime, choiceId) {
  const actions = flow.actions(runtime);
  assert.ok(actions, `stage ${flow.readState(runtime).stage} should expose actions`);
  assert.equal(actions.length, 3);
  assert.equal(new Set(actions.map((entry) => entry.id)).size, 3);
  for (const action of actions) {
    assert.ok(action.label.length >= 4 && action.label.length <= 20, `${action.label} must remain short`);
    assert.equal(action.id, action.actionId);
  }
  const action = actions.find((entry) => entry.authoredT11WitnessNetworkChoiceId === choiceId);
  assert.ok(action, `choice ${choiceId} should exist`);
  runtime.playerState.absoluteMinute += Number(action.minutes ?? 0);
  const result = { ok: true };
  assert.equal(flow.consume(runtime, action, result), true);
  assert.ok(result.summary);
  assert.ok(Array.isArray(result.speeches) && result.speeches.length >= 1);
  assert.equal(result.closedActionIds.length, 2);
  return { action, result };
}

test("クロウの台帳から証人保護・資金線・目撃地図・封鎖線・介入方針まで七sceneを縦に進める", () => {
  const runtime = baseRuntime();
  const beforeRead = JSON.stringify(runtime);
  assert.equal(flow.currentScene(runtime)?.id, "t11-crow-ledger-aftermath");
  assert.equal(JSON.stringify(runtime), beforeRead, "eligibility reads must not mutate the save");

  select(runtime, "escort_crow");
  assert.equal(flow.currentScene(runtime)?.id, "t11-black-lamp-shelter");
  assert.equal(runtime.playerState.player.facilityId, "LOC_CRIME_BACK_INN");
  assert.equal(runtime.playerState.goapRequests["GOAP-T11-CROW-WITNESS-PROTECTION"].status, "active");

  select(runtime, "ask_vera_for_room");
  assert.equal(flow.currentScene(runtime)?.id, "t11-ren-crow-witness-table");
  assert.ok(runtime.playerState.evidence["T11-EVIDENCE-VERA-BLACK-LAMP-GUEST-REGISTER"]);

  select(runtime, "seat_ren_with_crow");
  assert.equal(flow.currentScene(runtime)?.id, "t11-kiri-payment-relay");
  assert.equal(runtime.playerState.player.location, "王都");
  assert.equal(runtime.playerState.player.facilityId, "LOC_CAP_LOWER_INN");
  assert.ok(runtime.playerState.evidence["T11-EVIDENCE-REN-CONTRACT-TOKEN"]);

  select(runtime, "trace_with_kiri");
  assert.equal(flow.currentScene(runtime)?.id, "t11-street-witness-route");
  assert.ok(runtime.playerState.evidence["T11-EVIDENCE-KIRI-PAYMENT-CHAIN"]);

  select(runtime, "visit_noah");
  assert.equal(flow.currentScene(runtime)?.id, "t11-victor-counterline");
  assert.equal(runtime.playerState.player.facilityId, "LOC_CAP_ORPHANAGE");
  assert.ok(runtime.playerState.evidence["T11-EVIDENCE-NOAH-ALLEY-ROUTE-MAP"]);

  select(runtime, "build_victor_counterline");
  assert.equal(flow.currentScene(runtime)?.id, "t11-companion-counterplot-briefing");
  assert.equal(runtime.playerState.player.facilityId, "LOC_CAP_CASTLE");
  assert.ok(runtime.playerState.evidence["T11-EVIDENCE-VICTOR-COUNTER-ROUTE-PLAN"]);

  select(runtime, "protect_witnesses_and_move_king");
  const state = flow.readState(runtime);
  assert.equal(state.version, AUTHORED_T11_WITNESS_NETWORK_VERSION);
  assert.equal(state.stage, 7);
  assert.equal(state.selectedActionIds.length, 7);
  assert.equal(state.preferredResolution, "silent_counterplot_and_protect_king");
  assert.ok(state.routePlanCompletedAtMinute != null);
  assert.equal(flow.actions(runtime), null, "completed briefing must not repeat");
  assert.equal(runtime.playerState.goapRequests["GOAP-T11-WITNESS-PROTECTION-COUNTERPLOT"].status, "active");

  const restored = JSON.parse(JSON.stringify(runtime));
  assert.equal(flow.actions(restored), null, "save and restore must preserve non-repeat state");
  assert.equal(flow.readState(restored).selectedActionIds.length, 7);
  assert.equal(Object.keys(restored.playerState.t11WitnessNetworkFlow.closedActionIdsByScene).length, 7);
});

test("各sceneの別枝も異なる正史証拠と状態を保存する", () => {
  const runtime = baseRuntime();
  runtime.playerState.player.location = "王都";
  runtime.playerState.player.facilityId = "LOC_CAP_LOWER_INN";
  runtime.playerState.t11WitnessNetworkFlow = {
    version: AUTHORED_T11_WITNESS_NETWORK_VERSION,
    stage: 3,
    selectedActionIds: [],
    closedActionIdsByScene: {},
    routePlanCompletedAtMinute: null,
    preferredResolution: null,
    aftermathCompletedAtMinute: null,
  };

  const { action } = select(runtime, "verify_coded_bill");
  assert.ok(runtime.playerState.evidence["T11-EVIDENCE-LEONARDO-CODED-BILL-OF-EXCHANGE"]);
  assert.equal(runtime.playerState.worldFlags["t11WitnessNetwork:codedBillVerified"], true);
  assert.equal(runtime.playerState.t11WitnessNetworkFlow.closedActionIdsByScene["t11-kiri-payment-relay"].length, 2);
  assert.ok(!runtime.playerState.t11WitnessNetworkFlow.closedActionIdsByScene["t11-kiri-payment-relay"].includes(action.id));
});

test("T11解決後は証人を生活へ戻す後日sceneが一度だけ表示される", () => {
  const runtime = baseRuntime();
  runtime.playerState.player.location = "王都";
  runtime.playerState.player.facilityId = "LOC_CAP_CASTLE";
  runtime.playerState.missions["MSN-T11"].status = "resolved";
  runtime.playerState.worldFlags.t11ResolutionRoute = "silent_counterplot_and_protect_king";
  runtime.playerState.t11WitnessNetworkFlow = {
    version: AUTHORED_T11_WITNESS_NETWORK_VERSION,
    stage: 7,
    selectedActionIds: ["completed-plan"],
    closedActionIdsByScene: {},
    routePlanCompletedAtMinute: 42_000,
    preferredResolution: "silent_counterplot_and_protect_king",
    aftermathCompletedAtMinute: null,
  };

  assert.equal(flow.currentScene(runtime)?.id, "t11-witness-network-aftermath");
  select(runtime, "return_noah_map");
  assert.equal(runtime.playerState.player.facilityId, "LOC_CAP_ORPHANAGE");
  assert.equal(runtime.playerState.worldFlags["t11WitnessNetwork:noahMapReturned"], true);
  assert.equal(flow.actions(runtime), null);
});

test("クロウの正史台帳がなければ新しい縦sceneを開かない", () => {
  const runtime = baseRuntime();
  delete runtime.playerState.evidence["T11-EVIDENCE-CROW-INTERMEDIARY-LEDGER"];
  assert.equal(flow.currentScene(runtime), null);
  assert.equal(flow.actions(runtime), null);
});
