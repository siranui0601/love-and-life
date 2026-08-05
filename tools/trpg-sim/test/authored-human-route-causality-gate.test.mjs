import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_HUMAN_ROUTE_CAUSALITY_GATE_INTERNALS as gate,
  applyAuthoredMissionFlowAction,
  applyAuthoredMissionFlowCatalogOverrides,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime({ withHistory = false } = {}) {
  const mission = {
    id: "MSN-T04",
    steps: [
      { id: "hear", type: "conversation", targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_ADMIN", required: 1 },
      { id: "investigate", type: "investigate", targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_CORRIDOR", required: 3 },
      { id: "battle", type: "battle", targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_CORRIDOR", required: 1 },
      { id: "resolve", type: "resolve", targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_SEAL", required: 1 },
    ],
  };
  const catalog = { special: [mission], byId: new Map([[mission.id, mission]]) };
  applyAuthoredMissionFlowCatalogOverrides(catalog);
  return {
    authoredMissionFlows: {},
    narrativeMemory: { semanticFlags: {}, localFacts: [] },
    playerKnowledge: { knownHubIds: new Set(), knownFacilityIds: new Set() },
    livingWorld: {
      npcStates: Object.fromEntries(["NPC001", "NPC003", "NPC053", "NPC060"].map((id) => [id, { lifeStatus: "alive", presence: "present" }])),
    },
    playerState: {
      day: 12,
      absoluteMinute: 16_200,
      player: { location: "田園の村", facilityId: "LOC_FARM_SQUARE", needs: { hunger: 30, fatigue: 20 } },
      catalog,
      missions: {
        "MSN-T03": { id: "MSN-T03", status: "completed", progress: { resolve: 1 } },
        "MSN-T04": { id: "MSN-T04", status: "active", progress: { hear: 0, investigate: 0, battle: 0, resolve: 0 }, discoveries: [] },
      },
      troubles: { T03: { status: "resolved" }, T04: { status: "active" } },
      worldFlags: {},
      history: withHistory ? [{ type: "DAY2_HUNTER_LIVESTOCK_MOVED", actionId: "MISSION_FLOW:T03:DAY2:HUNTER:move_livestock" }] : [],
      evidence: {},
      goapRequests: {},
      routeCache: {},
      authoritativePresentNpcIds: new Set(),
    },
  };
}

test("T03完了だけの局所監査には新しいT04人徳入口を割り込ませない", () => {
  const state = runtime();
  assert.equal(gate.hasCompanionCausality(state), false);
  const actions = authoredMissionFlowExclusiveActions(state, { presentNpcs: [] });
  assert.ok(!actions?.some((action) => action.authoredHumanT04RelayChoice));
  assert.notEqual(authoredMissionFlowGuidance(state)?.title, "帰らない巡礼者");
});

test("Day1から保存された一般行動履歴がある時だけT04人徳入口を開く", () => {
  const state = runtime({ withHistory: true });
  assert.equal(gate.hasCompanionCausality(state), true);
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.deepEqual(actions.map((action) => action.label), [
    "巡礼便に加わる",
    "失踪者の家族を訪ねる",
    "村の見張りを引き継ぐ",
  ]);
  assert.equal(authoredMissionFlowGuidance(state).title, "帰らない巡礼者");
});

test("因果履歴なしの偽造T04 relay actionはサーバー側でも拒否する", () => {
  const state = runtime();
  const forged = {
    id: "MISSION_FLOW:T04:HUMAN_SPINE:village:join_caravan",
    actionId: "MISSION_FLOW:T04:HUMAN_SPINE:village:join_caravan",
    authoredHumanT04RelayChoice: true,
    relayScene: "village",
    relayChoice: "join_caravan",
  };
  assert.equal(applyAuthoredMissionFlowAction(state, forged, { ok: true }), false);
  assert.equal(state.playerState.player.location, "田園の村");
});

test("一度正式にT04 relayへ入った保存は履歴が圧縮されても続行できる", () => {
  const state = runtime();
  state.playerState.humanT04PilgrimRelay = {
    version: "authored-human-route-t04-pilgrim-relay-v1",
    stage: 1,
    selected: ["MISSION_FLOW:T04:HUMAN_SPINE:village:join_caravan"],
    closed: { village: [] },
    completedAtMinute: null,
  };
  state.playerState.player.location = "古代神殿";
  state.playerState.player.facilityId = "LOC_TEMPLE_ENTRANCE";
  assert.equal(gate.hasCompanionCausality(state), true);
  assert.deepEqual(authoredMissionFlowExclusiveActions(state).map((action) => action.label), [
    "名簿を管理棟へ運ぶ",
    "巡礼者へ水を配る",
    "鈴と荷車を数える",
  ]);
});