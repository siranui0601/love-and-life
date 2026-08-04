import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_DAY8_T03_COMMUNITY_FOLLOWTHROUGH_INTERNALS as followthrough,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 10260,
      player: {
        location: "田園の村",
        facilityId: "LOC_FARM_NORTH_FENCE",
        hunger: 44,
        fatigue: 31,
        needs: { hunger: 44, fatigue: 31 },
      },
      hunger: 44,
      fatigue: 31,
      missions: {
        "MSN-T01": { id: "MSN-T01", status: "completed" },
        "MSN-T03": { id: "MSN-T03", status: "active", progress: { hear: 0 } },
      },
      day2Day8VillageWatch: {
        version: "authored-day2-day8-village-watch-v1",
        rosterCompletedAtMinute: 1860,
        day8DueAtMinute: 10200,
        howlSelectedActionId: "MISSION_FLOW:T03:DAY8_HOWL:call_jill_to_fence",
        howlClosedActionIds: [],
        howlCompletedAtMinute: 10260,
      },
      worldFlags: {
        t01Resolved: true,
        t01FinnReturned: true,
        "day8WolfWatch:jillTriangulatedHowls": true,
      },
      history: [{
        type: "DAY8_WOLF_WATCH_JILL_TRIANGULATED_HOWLS",
        minute: 10260,
        troubleId: "T03",
      }],
      evidence: {
        "T03-EVIDENCE-DAY8-HOWL-TRIANGULATION": {
          id: "T03-EVIDENCE-DAY8-HOWL-TRIANGULATION",
          source: "LOC_FARM_NORTH_FENCE:SHARED_WATCH_LOG",
          acquiredAtMinute: 10260,
        },
      },
      goapRequests: {},
    },
  };
}

function choose(state, label) {
  const actions = authoredMissionFlowExclusiveActions(state);
  const action = actions?.find((candidate) => candidate.label === label);
  assert.ok(action, `${label} must be visible`);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return { action, result };
}

test("Day8の遠吠え後に短い三択で共同調査を引き継ぐ", () => {
  const state = runtime();
  assert.equal(followthrough.eligible(state), true);
  assert.equal(authoredMissionFlowGuidance(state).title, "夜明けの引継ぎ");
  const actions = authoredMissionFlowExclusiveActions(state);
  assert.deepEqual(actions.map((action) => action.label), [
    "牝馬を診る",
    "見張りへ朝食を配る",
    "フィンの地図を見る",
  ]);
  assert.equal(new Set(actions.map((action) => action.id)).size, 3);
  assert.ok(actions.every((action) => action.label.length >= 4 && action.label.length <= 20));
  assert.ok(actions.every((action) => action.actionId === action.id));
  assert.ok(actions.every((action) => action.missionId === "MSN-T03"));
});

test("牝馬の治療は傷の物証とジルの自主調査へ接続する", () => {
  const state = runtime();
  const { action, result } = choose(state, "牝馬を診る");
  assert.equal(action.t03OpeningChoice, "stable_bells");
  assert.equal(state.playerState.player.facilityId, "LOC_FARM_STABLE");
  assert.equal(state.playerState.player.needs.hunger, 47);
  assert.equal(state.playerState.player.needs.fatigue, 36);
  assert.equal(state.playerState.worldFlags["day8WolfFollowthrough:mareTreated"], true);
  assert.equal(state.playerState.worldFlags.t03CommunityInquiryStarted, true);
  assert.equal(state.t03WolfContinuity.openingChoiceId, "stable_bells");
  assert.deepEqual(state.playerState.evidence["T03-EVIDENCE-DAY8-MARE-WOUND-TRIAGE"], {
    id: "T03-EVIDENCE-DAY8-MARE-WOUND-TRIAGE",
    source: "LOC_FARM_STABLE:MARE_REAR_HOOF_WOUND",
    acquiredAtMinute: 10260,
  });
  assert.equal(result.speeches[0].actorId, "NPC060");
  assert.equal(result.closedActionIds.length, 2);
  assert.equal(state.playerState.goapRequests["GOAP-DAY8-T03-FOLLOWUP-TRIAGE_MARE"].status, "active");
  assert.equal(followthrough.eligible(state), false);
});

test("朝食と地図は別の生活状態・証拠・NPC行動を保存する", () => {
  const mealState = runtime();
  const meal = choose(mealState, "見張りへ朝食を配る");
  assert.equal(meal.action.t03OpeningChoice, "loss_ledger");
  assert.equal(mealState.playerState.player.needs.hunger, 34);
  assert.equal(mealState.playerState.player.facilityId, "LOC_FARM_NORTH_FENCE");
  assert.equal(meal.result.speeches[0].actorId, "NPC003");
  assert.ok(mealState.playerState.evidence["T03-EVIDENCE-DAY8-WATCH-MEAL-LEDGER"]);

  const mapState = runtime();
  const map = choose(mapState, "フィンの地図を見る");
  assert.equal(map.action.t03OpeningChoice, "finn_edge_map");
  assert.equal(mapState.playerState.player.needs.hunger, 46);
  assert.equal(mapState.playerState.player.facilityId, "LOC_FARM_SQUARE");
  assert.equal(map.result.speeches[0].actorId, "NPC001");
  assert.ok(mapState.playerState.evidence["T03-EVIDENCE-DAY8-FINN-EDGE-MAP-COPY"]);

  assert.notEqual(meal.result.evidenceId, map.result.evidenceId);
  assert.notEqual(meal.result.goapRequestId, map.result.goapRequestId);
  assert.notEqual(meal.result.sceneTransition, map.result.sceneTransition);
});

test("選択済みの引継ぎsceneは再表示せず、閉じた枝は保存される", () => {
  const state = runtime();
  choose(state, "牝馬を診る");
  const saved = JSON.parse(JSON.stringify(state));
  assert.equal(saved.playerState.day8T03CommunityFollowthrough.completedAtMinute, 10260);
  assert.equal(saved.playerState.day8T03CommunityFollowthrough.closedActionIds.length, 2);
  assert.equal(saved.playerState.history.at(-1).sceneId, "t03-day8-community-followthrough");
  assert.equal(followthrough.eligible(saved), false);
  assert.ok(!authoredMissionFlowExclusiveActions(saved)?.some(
    (action) => action.authoredDay8T03CommunityFollowthroughChoice,
  ));
});

test("遠吠え未確認・別施設・T03終端では引継ぎsceneを表示しない", () => {
  const beforeHowl = runtime();
  beforeHowl.playerState.day2Day8VillageWatch.howlCompletedAtMinute = null;
  assert.equal(followthrough.eligible(beforeHowl), false);

  const away = runtime();
  away.playerState.player.facilityId = "LOC_FARM_SQUARE";
  assert.equal(followthrough.eligible(away), false);

  const terminal = runtime();
  terminal.playerState.missions["MSN-T03"].status = "completed";
  assert.equal(followthrough.eligible(terminal), false);
});
