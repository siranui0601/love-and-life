import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORED_HUMAN_ROUTE_T04_T17_AFTERMATH_INTERNALS as aftermath,
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime() {
  return {
    authoredMissionFlows: {},
    livingWorld: {
      npcStates: {
        NPC053: { lifeStatus: "alive", presence: "present" },
        NPC056: { lifeStatus: "alive", presence: "present" },
        NPC060: { lifeStatus: "alive", presence: "present" },
      },
    },
    playerState: {
      day: 24,
      absoluteMinute: 34_500,
      player: {
        location: "古代神殿",
        facilityId: "LOC_TEMPLE_SEALED",
        needs: { hunger: 34, fatigue: 41 },
      },
      humanT04PilgrimRelay: {
        version: "authored-human-route-t04-pilgrim-relay-v1",
        stage: 3,
        selected: [],
        closed: {},
        completedAtMinute: 31_000,
      },
      missions: {
        "MSN-T04": {
          id: "MSN-T04",
          status: "completed",
          progress: { hear: 1, investigate: 3, battle: 1, resolve: 1 },
          discoveries: [],
        },
        "MSN-T17": {
          id: "MSN-T17",
          status: "active",
          progress: { hear: 0, investigate: 0, resolve: 0 },
          discoveries: [],
        },
      },
      troubles: {
        T04: { status: "resolved" },
        T17: { status: "active" },
      },
      worldFlags: {},
      history: [],
      evidence: {},
      goapRequests: {},
    },
  };
}

function choose(state, label) {
  const actions = authoredMissionFlowExclusiveActions(state);
  const action = actions?.find((entry) => entry.label === label);
  assert.ok(action, `${label} must be visible`);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return { action, result };
}

test("T04解決後に救助後の責任を三つの短い行動として表示する", () => {
  const state = runtime();
  assert.equal(aftermath.eligibleRecovery(state), true);
  assert.equal(authoredMissionFlowGuidance(state).title, "救助の後に残ったもの");
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.deepEqual(actions.map((action) => action.label), [
    "巡礼者を地上へ送る",
    "共鳴板を写す",
    "装置を二重に封じる",
  ]);
  assert.ok(actions.every((action) => action.label.length >= 4 && action.label.length <= 20));
  assert.ok(actions.every((action) => action.actionId === action.id));
  assert.ok(actions.every((action) => action.missionId === "MSN-T17"));
});

test("巡礼者の帰還はファルコ・ジル・ルカの自主行動を同時に開始する", () => {
  const state = runtime();
  const selected = choose(state, "巡礼者を地上へ送る");
  assert.equal(state.playerState.player.facilityId, "LOC_TEMPLE_ENTRANCE");
  assert.equal(state.playerState.humanT04T17Aftermath.stage, 1);
  assert.equal(state.playerState.humanT04T17Aftermath.closedActionIdsByScene["t04-rescue-aftermath"].length, 2);
  assert.equal(state.playerState.goapRequests["GOAP-T04-FALCO-ACCOUNT-SURVIVORS"].status, "active");
  assert.equal(state.playerState.goapRequests["GOAP-T04-JILL-ESCORT-SURVIVORS"].status, "active");
  assert.equal(state.playerState.goapRequests["GOAP-T04-LUCA-COMPARE-SUMMONING-WAVE"].status, "scheduled");
  assert.match(selected.result.summary, /名簿|生存/u);
});

test("共鳴板の枝は正本T17証拠を所持・mission・flowへ保存する", () => {
  const state = runtime();
  choose(state, "共鳴板を写す");
  const id = "T17-EVIDENCE-SEALED-QUARTER-RESONANCE-PLATE";
  assert.ok(state.playerState.evidence[id]);
  assert.ok(state.playerState.missions["MSN-T17"].discoveries.some((entry) => entry.id === id));
  assert.ok(state.authoredMissionFlows[aftermath.T17_FLOW].evidenceIds.includes(id));
  assert.equal(state.playerState.player.facilityId, "LOC_TEMPLE_SEALED");
});

test("第二sceneは王都待機ではなく古代神殿でT17の三つの証明を作る", () => {
  const state = runtime();
  choose(state, "巡礼者を地上へ送る");
  assert.equal(authoredMissionFlowGuidance(state).title, "第二召喚へ渡す証明");
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.deepEqual(actions.map((action) => action.label), [
    "運転簿を照合する",
    "回廊の光を追う",
    "ルカに逆算を頼む",
  ]);
  assert.ok(actions.every((action) => action.targetLocation === "古代神殿"));
});

test("運転簿の中心枝はT17神殿原因分離を開始し既存調査へ返す", () => {
  const state = runtime();
  choose(state, "巡礼者を地上へ送る");
  const selected = choose(state, "運転簿を照合する");
  const evidenceId = "T17-EVIDENCE-T04-TRANSFER-DEVICE-LOG";
  assert.ok(state.playerState.evidence[evidenceId]);
  assert.ok(state.authoredMissionFlows[aftermath.T17_FLOW].evidenceIds.includes(evidenceId));
  assert.equal(state.authoredMissionFlows[aftermath.T17_FLOW].openingChoiceId, "separate_temple_causes");
  assert.equal(state.playerState.missions["MSN-T17"].progress.hear, 1);
  assert.equal(state.playerState.worldFlags.t17TempleSeparationOpening, true);
  assert.equal(state.playerState.humanT04T17Aftermath.completedAtMinute, 34_500);
  assert.equal(selected.result.sceneTransition, "t17-temple-separation-investigation");
  assert.ok(!authoredMissionFlowExclusiveActions(state)?.some(
    (action) => action.authoredHumanT04T17AftermathChoice,
  ));
});

test("三つの証明枝は別の証拠・施設・NPC会話になる", () => {
  const logState = runtime();
  choose(logState, "巡礼者を地上へ送る");
  const log = choose(logState, "運転簿を照合する");

  const corridorState = runtime();
  choose(corridorState, "巡礼者を地上へ送る");
  const corridor = choose(corridorState, "回廊の光を追う");

  const mapState = runtime();
  choose(mapState, "巡礼者を地上へ送る");
  const map = choose(mapState, "ルカに逆算を頼む");

  assert.notEqual(log.result.evidenceId, corridor.result.evidenceId);
  assert.notEqual(corridor.result.evidenceId, map.result.evidenceId);
  assert.equal(logState.playerState.player.facilityId, "LOC_TEMPLE_ADMIN");
  assert.equal(corridorState.playerState.player.facilityId, "LOC_TEMPLE_CORRIDOR");
  assert.equal(mapState.playerState.player.facilityId, "LOC_TEMPLE_ADMIN");
  assert.equal(log.result.speeches[0].actorId, "NPC056");
  assert.equal(corridor.result.speeches[0].actorId, "NPC053");
});

test("選択済みsceneは保存復元後も反復しない", () => {
  const state = runtime();
  choose(state, "巡礼者を地上へ送る");
  choose(state, "運転簿を照合する");
  const saved = structuredClone(state);
  assert.equal(saved.playerState.humanT04T17Aftermath.closedActionIdsByScene["t04-rescue-aftermath"].length, 2);
  assert.equal(saved.playerState.humanT04T17Aftermath.closedActionIdsByScene["t04-t17-temple-proof"].length, 2);
  assert.ok(!authoredMissionFlowExclusiveActions(saved)?.some(
    (action) => action.authoredHumanT04T17AftermathChoice,
  ));
});