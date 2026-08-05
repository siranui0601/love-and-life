import assert from "node:assert/strict";
import test from "node:test";

import {
  HUMAN_COMPANION_AUTHORING_SPINE,
  AUTHORED_HUMAN_ROUTE_T04_PILGRIM_RELAY_INTERNALS as relay,
  applyAuthoredMissionFlowAction,
  applyAuthoredMissionFlowCatalogOverrides,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime({ weather = "clear" } = {}) {
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
      npcStates: Object.fromEntries(
        ["NPC001", "NPC003", "NPC053", "NPC060"]
          .map((id) => [id, { lifeStatus: "alive", presence: "present" }]),
      ),
    },
    playerState: {
      day: 12,
      absoluteMinute: 16_200,
      weather: { condition: weather },
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_SQUARE",
        needs: { hunger: 30, fatigue: 20 },
      },
      catalog,
      missions: {
        "MSN-T03": { id: "MSN-T03", status: "completed", progress: { resolve: 1 } },
        "MSN-T04": {
          id: "MSN-T04",
          status: "active",
          progress: { hear: 0, investigate: 0, battle: 0, resolve: 0 },
          discoveries: [],
        },
      },
      troubles: { T03: { status: "resolved" }, T04: { status: "active" } },
      worldFlags: {},
      history: [{
        type: "DAY2_HUNTER_LIVESTOCK_MOVED",
        actionId: "MISSION_FLOW:T03:DAY2:HUNTER:move_livestock",
        minute: 2_400,
      }],
      evidence: {},
      goapRequests: {},
      routeCache: {},
      authoritativePresentNpcIds: new Set(),
    },
  };
}

function choose(state, label, context = {}) {
  const actions = authoredMissionFlowExclusiveActions(state, context);
  const action = actions?.find((entry) => entry.label === label);
  assert.ok(action, `${label} must be visible`);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return { action, result };
}

test("作者用の人徳縦工程はT01からT19を重複なく含む", () => {
  const ids = HUMAN_COMPANION_AUTHORING_SPINE.flatMap((phase) => phase.troubles);
  assert.equal(ids.length, 19);
  assert.equal(new Set(ids).size, 19);
  assert.deepEqual(
    [...new Set(ids)].sort(),
    Array.from({ length: 19 }, (_, index) => `T${String(index + 1).padStart(2, "0")}`),
  );
});

test("T03解決後に生活・家族・移動の異なる短い三択を表示する", () => {
  const state = runtime();
  assert.equal(relay.initialEligible(state), true);
  assert.equal(authoredMissionFlowGuidance(state).title, "帰らない巡礼者");
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.deepEqual(
    actions.map((action) => action.label),
    ["巡礼便に加わる", "失踪者の家族を訪ねる", "村の見張りを引き継ぐ"],
  );
  assert.ok(actions.every((action) => action.label.length >= 4 && action.label.length <= 20));
  assert.ok(actions.every((action) => action.actionId === action.id));
  assert.equal(actions[0].minutes, 180);

  const rainy = runtime({ weather: "rain" });
  assert.equal(authoredMissionFlowExclusiveActions(rainy)[0].minutes, 210);
});

test("巡礼便の中心枝はNPCを停止させず三つの自主GOAPを残して神殿へ進む", () => {
  const state = runtime();
  const selected = choose(state, "巡礼便に加わる");
  assert.equal(state.playerState.player.location, "古代神殿");
  assert.equal(state.playerState.player.facilityId, "LOC_TEMPLE_ENTRANCE");
  assert.equal(state.playerState.humanT04PilgrimRelay.stage, 1);
  assert.equal(state.playerState.humanT04PilgrimRelay.closed.village.length, 2);
  assert.equal(state.playerState.goapRequests["GOAP-T04-GARO-VILLAGE-WATCH"].status, "active");
  assert.equal(
    state.playerState.goapRequests["GOAP-T04-JILL-PILGRIM-ROAD"].destination,
    "古代神殿",
  );
  assert.equal(
    state.playerState.goapRequests["GOAP-T04-FINN-RETURN-MAP"].destination,
    "田園の村",
  );
  assert.match(selected.result.summary, /三時間|古代神殿/u);
});

test("門前の三択は生活・物流・観察で異なる証拠と次施設を作る", () => {
  const rolls = runtime();
  choose(rolls, "巡礼便に加わる");
  assert.deepEqual(
    authoredMissionFlowExclusiveActions(rolls).map((action) => action.label),
    ["名簿を管理棟へ運ぶ", "巡礼者へ水を配る", "鈴と荷車を数える"],
  );
  choose(rolls, "名簿を管理棟へ運ぶ");
  assert.equal(rolls.playerState.player.facilityId, "LOC_TEMPLE_ADMIN");

  const water = runtime();
  choose(water, "巡礼便に加わる");
  choose(water, "巡礼者へ水を配る");
  assert.ok(water.playerState.evidence["T04-EVIDENCE-PILGRIM-CARAVAN-HEADCOUNT"]);
  assert.equal(water.playerState.player.facilityId, "LOC_TEMPLE_REST");

  const bells = runtime();
  choose(bells, "巡礼便に加わる");
  choose(bells, "鈴と荷車を数える");
  assert.ok(bells.playerState.evidence["T04-EVIDENCE-TEMPLE-ROAD-ARRIVAL-GAPS"]);
  assert.equal(bells.playerState.player.facilityId, "LOC_TEMPLE_ENTRANCE");
});

test("ファルコへの短い三択が既存T04聞き取りへ正式接続する", () => {
  const state = runtime();
  choose(state, "巡礼便に加わる");
  choose(state, "名簿を管理棟へ運ぶ");
  const context = { presentNpcs: [{ id: "NPC053" }], movementActions: [] };
  const actions = authoredMissionFlowExclusiveActions(state, context);
  assert.deepEqual(
    actions.map((action) => action.label),
    ["列順を聞く", "隠蔽を問いただす", "Day1の異常を聞く"],
  );
  assert.ok(actions.every((action) => action.actionId === action.id));

  const selected = choose(state, "列順を聞く", context);
  assert.equal(state.playerState.missions["MSN-T04"].progress.hear, 1);
  assert.equal(
    state.authoredMissionFlows[relay.FLOW_ID].openingChoiceId,
    "disappearance_pattern",
  );
  assert.equal(state.playerState.humanT04PilgrimRelay.stage, 3);
  assert.equal(state.playerState.humanT04PilgrimRelay.closed.falco.length, 2);
  assert.equal(selected.result.speeches[0].actorId, "NPC053");
  assert.ok(
    !authoredMissionFlowExclusiveActions(state, context)
      ?.some((action) => action.authoredHumanT04FalcoProxy),
  );
});

test("家族枝は正本のエイダ日記証拠を保存し、死亡NPCを表示しない", () => {
  const state = runtime();
  choose(state, "失踪者の家族を訪ねる");
  assert.equal(state.playerState.player.location, "辺境の村");
  assert.ok(state.playerState.evidence["T04-EVIDENCE-EDA-DIARY-GLYPH"]);
  assert.ok(
    state.authoredMissionFlows[relay.FLOW_ID].evidenceIds
      .includes("T04-EVIDENCE-EDA-DIARY-GLYPH"),
  );
  assert.ok(
    state.playerState.missions["MSN-T04"].discoveries
      .some((entry) => entry.id === "T04-EVIDENCE-EDA-DIARY-GLYPH"),
  );

  const dead = runtime();
  dead.livingWorld.npcStates.NPC060.lifeStatus = "dead";
  assert.equal(relay.initialEligible(dead), false);
  assert.ok(
    !authoredMissionFlowExclusiveActions(dead)
      ?.some((action) => action.authoredHumanT04RelayChoice),
  );
});

test("選択済みsceneと閉じた枝は保存復元後も復活しない", () => {
  const state = runtime();
  choose(state, "巡礼便に加わる");
  choose(state, "名簿を管理棟へ運ぶ");
  const saved = structuredClone(state);
  assert.equal(saved.playerState.humanT04PilgrimRelay.closed.village.length, 2);
  assert.equal(saved.playerState.humanT04PilgrimRelay.closed.arrival.length, 2);
  assert.ok(
    !authoredMissionFlowExclusiveActions(saved, { presentNpcs: [{ id: "NPC053" }] })
      .some((action) => action.relayScene === "village"),
  );
});