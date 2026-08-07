import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_T05_TO_T07_BRIDGE_INTERNALS as bridge,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const DAY24_MIDDAY = 23 * 1440 + 13 * 60;

function runtime(t05Route = null) {
  return {
    playerState: {
      absoluteMinute: DAY24_MIDDAY,
      player: { location: "交易都市", facilityId: "LOC_TRADE_LORD_MANOR" },
      missions: [
        { id: "MSN-T05", troubleId: "T05", status: "completed", completedAt: DAY24_MIDDAY - 6000 },
        { id: "MSN-T07", troubleId: "T07", status: "active", progress: { hear: 0, investigate: 0 } },
      ],
      troubles: { T05: { status: "resolved" }, T07: { status: "active" } },
      worldFlags: t05Route ? { t05ResolutionRoute: t05Route } : {},
      history: [],
      evidence: {},
    },
    authoredMissionFlows: {},
    livingWorld: { npcStates: { NPC027: { status: "alive" } } },
  };
}

function choose(state, actionId) {
  const action = authoredMissionFlowExclusiveActions(state)
    .find((entry) => entry.id === actionId);
  assert.ok(action, `action not offered: ${actionId}`);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

test("settling the poisoning opens a shipping-side view of the trafficking", () => {
  const state = runtime("buy_crime_ledger_antidote");
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.deepEqual(actions.map((action) => action.label), [
    "セレス船長に積荷を聞く",
    "税関の通行記録を当たる",
    "王都行きの早馬を押さえる",
  ]);
  assert.deepEqual(actions.map((action) => action.family), ["talk", "investigate", "prepare"]);
  for (const action of actions) {
    assert.equal(action.actionId, action.id);
    assert.equal(action.missionId, "MSN-T07");
    assert.equal(action.targetLocation, "交易都市");
  }
  assert.equal(authoredMissionFlowGuidance(state).title, "息をする荷");
});

test("each way of ending the poisoning notices the cargo from a different angle", () => {
  const kickers = new Set();
  const contextIds = new Set();
  for (const route of [
    "protect_nicolas_and_treat",
    "buy_crime_ledger_antidote",
    "royal_physician_public_indictment",
  ]) {
    const state = runtime(route);
    kickers.add(authoredMissionFlowGuidance(state).kicker);
    contextIds.add(bridge.t05ContextFor(state).id);
  }
  assert.equal(kickers.size, 3);
  assert.equal(contextIds.size, 3);

  const unknown = runtime();
  assert.equal(bridge.t05ContextFor(unknown).id, "port_rumor");
  assert.equal(bridge.eligible(unknown), true, "an unrecorded route still gets a way in");
});

test("each choice hands exactly one canonical T07 lead to the real investigation", () => {
  const expected = [
    ["crime_dock_manifest"],
    ["damian_false_contract"],
    ["capital_inn_order"],
  ];
  for (const [index, leads] of expected.entries()) {
    const state = runtime("protect_nicolas_and_treat");
    choose(state, bridge.actionIdFor(bridge.BRIDGE_CHOICES[index]));
    const flow = state.authoredMissionFlows[bridge.FLOW_ID];
    assert.deepEqual(flow.unlockedLeadIds, leads);
  }
});

test("no shipping-side choice ever completes the hearing Serie owes the player", () => {
  for (const choice of bridge.BRIDGE_CHOICES) {
    const state = runtime("buy_crime_ledger_antidote");
    choose(state, bridge.actionIdFor(choice));
    assert.equal(state.playerState.missions[1].progress.hear, 0,
      "the canonical hearing belongs to Serie in the forest camp");
    const flow = state.authoredMissionFlows[bridge.FLOW_ID];
    assert.deepEqual(flow.knownFactIds, [],
      "seeing the freight side is not the same as being told the story");
  }
});

test("the three choices record three different pieces of evidence", () => {
  const ids = [];
  for (const choice of bridge.BRIDGE_CHOICES) {
    const state = runtime("royal_physician_public_indictment");
    choose(state, bridge.actionIdFor(choice));
    assert.equal(state.playerState.worldFlags.t07SeenFromTheShippingSide, true);
    ids.push(...Object.keys(state.playerState.evidence));
  }
  assert.equal(new Set(ids).size, 3);
});

test("asking Ceres records the refused charter and moves the player to the port", () => {
  const state = runtime("protect_nicolas_and_treat");
  const result = choose(state, bridge.actionIdFor(bridge.BRIDGE_CHOICES[0]));

  assert.equal(state.playerState.worldFlags.t07CeresRefusedTheJob, true);
  assert.ok(state.playerState.evidence["T07-EVIDENCE-BRIDGE-BREATHING-CARGO"]);
  assert.equal(state.playerState.player.facilityId, "LOC_TRADE_PORT");
  assert.equal(result.speeches[0].actorId, "NPC052");
});

test("the bridge waits for the poisoning to be settled", () => {
  const open = runtime("buy_crime_ledger_antidote");
  open.playerState.missions[0].status = "active";
  open.playerState.troubles.T05.status = "active";
  assert.equal(bridge.eligible(open), false);
});

test("the bridge steps aside once the forest camp hearing has begun", () => {
  const started = runtime("buy_crime_ledger_antidote");
  started.authoredMissionFlows[bridge.FLOW_ID] = { openingChoiceId: "serie_opening" };
  assert.equal(bridge.eligible(started), false);

  const withEvidence = runtime("buy_crime_ledger_antidote");
  withEvidence.authoredMissionFlows[bridge.FLOW_ID] = { evidenceIds: ["T07-SOMETHING"] };
  assert.equal(bridge.eligible(withEvidence), false);
});

test("the bridge is absent outside the city, outside Day20-37, and once Lucia is beyond reach", () => {
  const away = runtime("buy_crime_ledger_antidote");
  away.playerState.player.location = "王都";
  assert.equal(bridge.eligible(away), false);

  const early = runtime("buy_crime_ledger_antidote");
  early.playerState.absoluteMinute = 18 * 1440;
  assert.equal(bridge.eligible(early), false);

  const late = runtime("buy_crime_ledger_antidote");
  late.playerState.absoluteMinute = 38 * 1440;
  assert.equal(bridge.eligible(late), false);

  const sold = runtime("buy_crime_ledger_antidote");
  sold.livingWorld.npcStates.NPC027.status = "sold";
  assert.equal(bridge.eligible(sold), false);
});

test("the bridge is spent once and closes the two roads not taken", () => {
  const state = runtime("buy_crime_ledger_antidote");
  const chosen = bridge.actionIdFor(bridge.BRIDGE_CHOICES[1]);
  choose(state, chosen);

  assert.equal(bridge.eligible(state), false);
  const saved = state.playerState.t05ToT07Bridge;
  assert.equal(saved.selectedActionId, chosen);
  assert.equal(saved.t05ContextId, "crime_ledger");
  assert.deepEqual(saved.closedActionIds, [
    bridge.actionIdFor(bridge.BRIDGE_CHOICES[0]),
    bridge.actionIdFor(bridge.BRIDGE_CHOICES[2]),
  ]);
});

test("the handoff merges into leads the canonical flow already holds", () => {
  const state = runtime("buy_crime_ledger_antidote");
  state.authoredMissionFlows[bridge.FLOW_ID] = {
    flowId: bridge.FLOW_ID,
    unlockedLeadIds: ["tia_departure_letter"],
    evidenceIds: [],
  };
  choose(state, bridge.actionIdFor(bridge.BRIDGE_CHOICES[0]));

  assert.deepEqual(
    [...state.authoredMissionFlows[bridge.FLOW_ID].unlockedLeadIds].sort(),
    ["crime_dock_manifest", "tia_departure_letter"]);
});
