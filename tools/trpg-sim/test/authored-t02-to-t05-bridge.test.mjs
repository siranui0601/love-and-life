import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_T02_TO_T05_BRIDGE_INTERNALS as bridge,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const DAY16_MIDDAY = 15 * 1440 + 11 * 60;

function runtime(t02Route = null) {
  return {
    playerState: {
      absoluteMinute: DAY16_MIDDAY,
      player: { location: "交易都市", facilityId: "LOC_TRADE_GUILD" },
      missions: [
        { id: "MSN-T02", troubleId: "T02", status: "completed", completedAt: DAY16_MIDDAY - 4000 },
        { id: "MSN-T05", troubleId: "T05", status: "active" },
      ],
      troubles: { T02: { status: "resolved" }, T05: { status: "active" } },
      worldFlags: t02Route ? { t02ResolutionRoute: t02Route } : {},
      history: [],
      evidence: {},
    },
    livingWorld: { npcStates: { NPC009: { status: "alive" } } },
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

test("the bridge opens in the trade city once the granary case is settled", () => {
  const state = runtime("public_prosecution_and_contract_void");
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.equal(actions.length, 3);
  assert.deepEqual(actions.map((action) => action.label), [
    "領主館へ足を運ぶ",
    "厨房の仕入れ帳を見る",
    "薬草商へ買い出しに行く",
  ]);
  assert.equal(new Set(actions.map((action) => action.family)).size, 3);
  for (const action of actions) {
    assert.equal(action.actionId, action.id);
    assert.equal(action.missionId, "MSN-T05");
    assert.equal(action.targetLocation, "交易都市");
  }
});

test("each T02 resolution opens the same three doors through a different introduction", () => {
  const seen = new Map();
  for (const route of [
    "public_prosecution_and_contract_void",
    "restitution_grain_and_debt_compact",
    "village_grain_cooperative_and_open_ledger",
  ]) {
    const state = runtime(route);
    const guidance = authoredMissionFlowGuidance(state);
    const context = bridge.t02ContextFor(state);
    seen.set(route, { kicker: guidance.kicker, contextId: context.id });
    assert.equal(guidance.missionId, "MSN-T05");
    assert.equal(guidance.title, "領主館の静けさ");
  }

  const kickers = [...seen.values()].map((entry) => entry.kicker);
  const contextIds = [...seen.values()].map((entry) => entry.contextId);
  assert.equal(new Set(kickers).size, 3, "each granary outcome needs its own opening line");
  assert.equal(new Set(contextIds).size, 3);
});

test("a player who never settled T02 in the city still gets a usable outsider opening", () => {
  const state = runtime();
  assert.equal(bridge.t02ContextFor(state).id, "outsider");
  assert.equal(authoredMissionFlowExclusiveActions(state).length, 3);
});

test("the chosen door records its own evidence and closes the other two", () => {
  const state = runtime("restitution_grain_and_debt_compact");
  const chosen = bridge.actionIdFor(bridge.BRIDGE_CHOICES[1]);
  const result = choose(state, chosen);

  assert.equal(state.playerState.worldFlags.t05SeparateProcurementFound, true);
  assert.equal(state.playerState.worldFlags.t05DiscoveredViaGranaryBridge, true);
  assert.ok(state.playerState.evidence["T05-EVIDENCE-BRIDGE-SERVANT-ONLY-RECEIPTS"]);
  assert.equal(state.playerState.player.facilityId, "LOC_TRADE_WAREHOUSE");

  const saved = state.playerState.t02ToT05Bridge;
  assert.equal(saved.selectedActionId, chosen);
  assert.equal(saved.t02ContextId, "grain_account");
  assert.deepEqual(saved.closedActionIds, [
    bridge.actionIdFor(bridge.BRIDGE_CHOICES[0]),
    bridge.actionIdFor(bridge.BRIDGE_CHOICES[2]),
  ]);

  assert.equal(result.speeches.length, 2);
  assert.equal(result.speeches[1].actorId, "NPC076");
});

test("the three doors record three different leads into the poisoning", () => {
  const evidence = [];
  for (const choice of bridge.BRIDGE_CHOICES) {
    const state = runtime("public_prosecution_and_contract_void");
    choose(state, bridge.actionIdFor(choice));
    evidence.push(Object.keys(state.playerState.evidence));
  }
  const flat = evidence.flat();
  assert.equal(new Set(flat).size, 3, "each door must yield a distinct canonical lead");
});

test("the bridge is absent outside the city, outside its window, and after the lord dies", () => {
  const away = runtime("public_prosecution_and_contract_void");
  away.playerState.player.location = "王都";
  assert.equal(bridge.eligible(away), false);

  const early = runtime("public_prosecution_and_contract_void");
  early.playerState.absoluteMinute = 12 * 1440;
  assert.equal(bridge.eligible(early), false);

  const late = runtime("public_prosecution_and_contract_void");
  late.playerState.absoluteMinute = 24 * 1440;
  assert.equal(bridge.eligible(late), false);

  const dead = runtime("public_prosecution_and_contract_void");
  dead.livingWorld.npcStates.NPC009.status = "dead";
  assert.equal(bridge.eligible(dead), false);
});

test("the bridge requires the granary case to be settled first", () => {
  const unsettled = runtime("public_prosecution_and_contract_void");
  unsettled.playerState.missions[0].status = "active";
  unsettled.playerState.troubles.T02.status = "active";
  assert.equal(bridge.eligible(unsettled), false);
});

test("the bridge never replays after it is spent", () => {
  const state = runtime("village_grain_cooperative_and_open_ledger");
  choose(state, bridge.actionIdFor(bridge.BRIDGE_CHOICES[0]));

  assert.equal(bridge.eligible(state), false);
  const offered = (authoredMissionFlowExclusiveActions(state) ?? []).map((action) => action.id);
  for (const choice of bridge.BRIDGE_CHOICES) {
    assert.equal(offered.includes(bridge.actionIdFor(choice)), false);
  }
});

// 扉で分かったことが、正史のT05調査へ実際に渡っているか。
// 手掛かりを水増しせず、見たものだけを正史側の名前で登録し直す契約。

test("meeting Mariel completes the canonical hearing, the other two doors do not", () => {
  const physician = runtime("public_prosecution_and_contract_void");
  physician.playerState.missions[1].progress = { hear: 0, investigate: 0 };
  choose(physician, bridge.actionIdFor(bridge.BRIDGE_CHOICES[0]));
  assert.equal(physician.playerState.missions[1].progress.hear, 1,
    "the bedside account is the canonical hearing");

  for (const index of [1, 2]) {
    const other = runtime("public_prosecution_and_contract_void");
    other.playerState.missions[1].progress = { hear: 0, investigate: 0 };
    choose(other, bridge.actionIdFor(bridge.BRIDGE_CHOICES[index]));
    assert.equal(other.playerState.missions[1].progress.hear, 0,
      "a player who never met Mariel still owes the hearing");
  }
});

test("each door unlocks exactly the canonical leads it actually saw", () => {
  const expected = [
    ["bedside_symptoms", "antidote_formula"],
    ["warehouse_manifest"],
    ["antidote_formula", "crime_ledger"],
  ];
  for (const [index, leads] of expected.entries()) {
    const state = runtime("restitution_grain_and_debt_compact");
    choose(state, bridge.actionIdFor(bridge.BRIDGE_CHOICES[index]));
    const flow = state.authoredMissionFlows[bridge.FLOW_ID];
    assert.deepEqual([...flow.unlockedLeadIds].sort(), [...leads].sort());
  }
});

test("only the bedside account records a canonical fact", () => {
  const physician = runtime("public_prosecution_and_contract_void");
  choose(physician, bridge.actionIdFor(bridge.BRIDGE_CHOICES[0]));
  assert.deepEqual(
    physician.authoredMissionFlows[bridge.FLOW_ID].knownFactIds,
    ["T05-FACT-NONNATURAL-POISON"]);

  const ledger = runtime("public_prosecution_and_contract_void");
  choose(ledger, bridge.actionIdFor(bridge.BRIDGE_CHOICES[1]));
  assert.deepEqual(ledger.authoredMissionFlows[bridge.FLOW_ID].knownFactIds, []);
});

test("the handoff builds a complete canonical flow state, not a partial one", () => {
  const state = runtime("public_prosecution_and_contract_void");
  choose(state, bridge.actionIdFor(bridge.BRIDGE_CHOICES[2]));
  const flow = state.authoredMissionFlows[bridge.FLOW_ID];

  assert.equal(flow.flowId, bridge.FLOW_ID);
  for (const field of ["openingChoiceId", "selectedLeadId", "evidenceIds", "prematureResolutionCount"]) {
    assert.ok(Object.hasOwn(flow, field), `canonical flow state must keep ${field}`);
  }
});

test("the handoff adds to leads a canonical flow already holds instead of replacing them", () => {
  const state = runtime("public_prosecution_and_contract_void");
  state.authoredMissionFlows = {};
  state.authoredMissionFlows[bridge.FLOW_ID] = {
    flowId: bridge.FLOW_ID,
    unlockedLeadIds: ["port_meeting"],
    knownFactIds: ["T05-FACT-EXISTING"],
    evidenceIds: [],
  };
  choose(state, bridge.actionIdFor(bridge.BRIDGE_CHOICES[1]));

  const flow = state.authoredMissionFlows[bridge.FLOW_ID];
  assert.deepEqual([...flow.unlockedLeadIds].sort(), ["port_meeting", "warehouse_manifest"]);
  assert.deepEqual(flow.knownFactIds, ["T05-FACT-EXISTING"]);
});
