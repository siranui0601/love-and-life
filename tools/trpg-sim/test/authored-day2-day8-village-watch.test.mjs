import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY2_DAY8_VILLAGE_WATCH_INTERNALS as watch,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const WARNING_COMPLETED_MINUTE = 1583; // Day2 12:23, before the selected warning action advances time.

function runtime() {
  return {
    playerState: {
      absoluteMinute: WARNING_COMPLETED_MINUTE,
      player: {
        location: "森",
        facilityId: "LOC_FOREST_HUNTER_HUT",
        hunger: 34,
        fatigue: 40,
        gold: 42,
      },
      gold: 42,
      inventory: {},
      missions: [{ id: "MSN-T01", troubleId: "T01", status: "completed", completedAt: 292 }],
      worldFlags: { t01Resolved: true, t01FinnReturned: true },
      history: [{ type: "DAY2_HUNTER_WARNING_BELLS_INSPECTED" }],
      evidence: {},
      contracts: {},
      goapRequests: {},
      day2T01VillageWarning: {
        version: "authored-day2-t01-village-warning-v1",
        selectedActionId: "MISSION_FLOW:T01:DAY2_VILLAGE_WARNING:inspect_warning_bells",
        closedActionIds: [],
        completedAtMinute: WARNING_COMPLETED_MINUTE,
      },
    },
  };
}

function choose(state, action) {
  assert.ok(action);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

function chooseLabel(state, label) {
  return choose(state, authoredMissionFlowExclusiveActions(state).find((entry) => entry.label === label));
}

function reachFirstHowl(state, rosterLabel = "当番札を回す") {
  chooseLabel(state, rosterLabel);
  state.playerState.absoluteMinute = state.playerState.day2Day8VillageWatch.day8DueAtMinute;
  state.playerState.player.location = "田園の村";
  state.playerState.player.facilityId = "LOC_FARM_NORTH_FENCE";
}

test("Day2の警告完了状態から共同見張り準備三択へ到達する", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.equal(authoredMissionFlowGuidance(state).title, "村の見張りをどう繋ぐか");
  assert.deepEqual(actions.map((entry) => entry.label), [
    "当番札を回す",
    "行商便に載せる",
    "静かに見守る",
  ]);
  assert.equal(actions.length, 3);
  assert.equal(new Set(actions.map((entry) => entry.id)).size, 3);
  assert.equal(new Set(actions.map((entry) => entry.family)).size, 3);
  assert.ok(actions.every((entry) => entry.label.length >= 4 && entry.label.length <= 20));
});

test("当番札を回すとproduction epoch上のDay8 05:00に共同見張りGOAPが予定される", () => {
  const state = runtime();
  chooseLabel(state, "当番札を回す");

  const request = state.playerState.goapRequests[watch.WATCH_REQUEST_ID];
  assert.equal(request.status, "scheduled");
  assert.equal(request.actorId, "NPC060");
  assert.equal(request.goal, "coordinate_shared_watch");
  assert.equal(request.dueAtMinute, watch.DAY8_DAWN_MINUTE);
  assert.equal(watch.DAY8_DAWN_MINUTE, 9780);
  assert.equal(state.playerState.day2Day8VillageWatch.rosterClosedActionIds.length, 2);
  assert.equal(state.playerState.player.location, "田園の村");
  assert.equal(state.playerState.player.facilityId, "LOC_FARM_SQUARE");
});

test("行商便に載せるとNPC008の配送契約が保存される", () => {
  const state = runtime();
  chooseLabel(state, "行商便に載せる");

  assert.equal(
    state.playerState.contracts["CONTRACT-DAY2-RIONA-FARM-WATCH-NOTICE"].providerNpcId,
    "NPC008",
  );
  assert.equal(
    state.playerState.goapRequests[watch.WATCH_REQUEST_ID].goal,
    "carry_farm_warning",
  );
  assert.equal(
    state.playerState.history.at(-1).type,
    "DAY2_VILLAGE_WATCH_MERCHANT_NOTICE_SENT",
  );
});

test("Day8の夜明け前に更新された別三択が表示される", () => {
  const state = runtime();
  reachFirstHowl(state);
  const actions = authoredMissionFlowExclusiveActions(state);

  assert.equal(authoredMissionFlowGuidance(state).title, "夜明け前の遠吠え");
  assert.deepEqual(actions.map((entry) => entry.label), [
    "子どもを家へ返す",
    "ジルを呼ぶ",
    "松明を消して待つ",
  ]);
  assert.equal(actions.length, 3);
  assert.ok(actions.every((entry) => entry.label.length >= 4 && entry.label.length <= 20));
});

test("子どもを家へ返すと共同見張りGOAPとT03早期対応が完了する", () => {
  const state = runtime();
  reachFirstHowl(state);
  chooseLabel(state, "子どもを家へ返す");

  assert.equal(state.playerState.worldFlags["day8WolfWatch:childrenSheltered"], true);
  assert.equal(state.playerState.worldFlags.t03EarlyCommunityResponse, true);
  assert.equal(state.playerState.goapRequests[watch.WATCH_REQUEST_ID].status, "completed");
  assert.equal(state.playerState.day2Day8VillageWatch.howlClosedActionIds.length, 2);
  assert.equal(
    state.playerState.evidence["T03-EVIDENCE-DAY8-COMMUNITY-WATCH-ROSTER"].source,
    "LOC_FARM_NORTH_FENCE:WATCH_TAG_BOARD",
  );
  assert.equal(watch.howlEligible(state), false);
});

test("ジルを呼ぶ枝と消灯観察枝は異なる証拠を保存する", () => {
  const jillState = runtime();
  reachFirstHowl(jillState);
  chooseLabel(jillState, "ジルを呼ぶ");
  assert.equal(
    jillState.playerState.evidence["T03-EVIDENCE-DAY8-HOWL-TRIANGULATION"].source,
    "LOC_FARM_NORTH_FENCE:SHARED_WATCH_LOG",
  );

  const darkState = runtime();
  reachFirstHowl(darkState, "静かに見守る");
  chooseLabel(darkState, "松明を消して待つ");
  assert.equal(
    darkState.playerState.evidence["T03-EVIDENCE-DAY8-SOUTHWARD-PACK-PASSAGE"].source,
    "LOC_FARM_NORTH_FENCE:UNLIT_OBSERVATION",
  );
  assert.notEqual(
    jillState.playerState.history.at(-1).type,
    darkState.playerState.history.at(-1).type,
  );
});

test("Day8到達前と北柵以外では遠吠え三択を表示しない", () => {
  const state = runtime();
  chooseLabel(state, "当番札を回す");

  state.playerState.absoluteMinute = state.playerState.day2Day8VillageWatch.day8DueAtMinute - 1;
  assert.equal(watch.day8Pending(state), false);

  state.playerState.absoluteMinute += 1;
  assert.equal(watch.day8Pending(state), true);
  assert.equal(watch.howlEligible(state), false);

  state.playerState.player.facilityId = "LOC_FARM_NORTH_FENCE";
  assert.equal(watch.howlEligible(state), true);
});