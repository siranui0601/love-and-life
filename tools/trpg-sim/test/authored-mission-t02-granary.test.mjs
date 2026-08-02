import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORED_MISSION_T02_GRANARY_INTERNALS,
  AUTHORED_MISSION_T02_GRANARY_VERSION,
  AUTHORED_MISSION_T02_GRANARY_CHOICE_ORDER_VERSION,
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
} from "../../../src/server/trpg/content/authored-mission-t02-granary-choice-order.js";
import { cloneSerializable } from "../../../src/server/trpg/game/serializer.js";

const MISSION_ID = "MSN-T02";

function runtime() {
  return {
    playerState: {
      absoluteMinute: 6270,
      player: { location: "田園の村", facilityId: "LOC_FARM_GRANARY" },
      catalog: {
        byId: new Map([[MISSION_ID, {
          id: MISSION_ID,
          kind: "special",
          troubleId: "T02",
          steps: [
            { id: "hear", type: "conversation", required: 1 },
            { id: "investigate", type: "investigate", required: 3 },
            { id: "resolve", type: "resolve", required: 1 },
          ],
        }]]),
      },
      missions: {
        [MISSION_ID]: {
          id: MISSION_ID,
          status: "active",
          progress: { hear: 1, investigate: 0, resolve: 0 },
          completedAt: null,
          failedAt: null,
        },
      },
      troubles: { T02: { status: "active" } },
      worldFlags: {},
      history: [],
    },
    authoredMissionFlows: {},
  };
}

function ids(actions) {
  return actions.map((action) => action.id);
}

test("T02 granary opens with two evidence routes and one costly village choice", () => {
  assert.equal(AUTHORED_MISSION_T02_GRANARY_VERSION, "authored-mission-t02-granary-v1");
  assert.equal(AUTHORED_MISSION_T02_GRANARY_CHOICE_ORDER_VERSION, "authored-mission-t02-granary-choice-order-v1");
  const state = runtime();
  const choices = authoredMissionFlowExclusiveActions(state, {});
  assert.equal(choices.length, 3);
  assert.equal(choices.filter((action) => action.type === "investigate").length, 2);
  assert.equal(choices.filter((action) => action.type === "plan").length, 1);
  assert.ok(choices.every((action) => action.authoredT02GranaryChoice));
  assert.ok(choices.every((action) => action.missionId === MISSION_ID));
  assert.ok(choices.every((action) => action.id.length <= 120));
  assert.equal(new Set(ids(choices)).size, 3);
  assert.equal(ids(choices).some((id) => id.startsWith("INSPECT:LOC_FARM_GRANARY")), false);
});

test("choosing emergency grain permanently changes the scene and fire evidence route", () => {
  const state = runtime();
  const first = authoredMissionFlowExclusiveActions(state, {});
  const release = first.find((action) => action.t02SideChoice === "release_emergency_grain");
  assert.ok(release);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, release, result), true);
  assert.equal(state.playerState.worldFlags.t02EmergencyGrainReleased, true);
  assert.equal(state.playerState.worldFlags.t02PristineFloorEvidenceLost, true);
  assert.match(result.summary, /床の油筋/u);

  const second = authoredMissionFlowExclusiveActions(state, {});
  assert.equal(ids(second).includes(release.id), false);
  const fire = second.find((action) => action.t02EvidenceClass === "fire_origin");
  assert.ok(fire);
  assert.match(fire.id, /SOOT_LAYER/u);
  assert.match(fire.label, /灯皿の煤層/u);
});

test("recorded evidence never returns in the same causal state", () => {
  const state = runtime();
  const first = authoredMissionFlowExclusiveActions(state, {});
  const fire = first.find((action) => action.t02EvidenceClass === "fire_origin");
  assert.ok(fire);
  state.playerState.missions[MISSION_ID].progress.investigate = 1;
  assert.equal(applyAuthoredMissionFlowAction(state, fire, { ok: true }), true);

  const second = authoredMissionFlowExclusiveActions(state, {});
  assert.equal(second.some((action) => action.t02EvidenceClass === "fire_origin"), false);
  assert.equal(second.some((action) => action.id === fire.id), false);
  assert.deepEqual(state.t02GranaryContinuity.evidenceClasses, ["fire_origin"]);
  assert.equal(state.playerState.history.at(-1).type, "T02_GRANARY_SCENE_RESOLVED");
});

test("T02 causal scene state survives a serializable save round trip", () => {
  const state = runtime();
  const first = authoredMissionFlowExclusiveActions(state, {});
  const release = first.find((action) => action.t02SideChoice === "release_emergency_grain");
  assert.ok(release);
  applyAuthoredMissionFlowAction(state, release, { ok: true });
  const saved = cloneSerializable(state);

  assert.deepEqual(saved.t02GranaryContinuity, state.t02GranaryContinuity);
  assert.equal(saved.playerState.worldFlags.t02EmergencyGrainReleased, true);
  const next = authoredMissionFlowExclusiveActions(saved, {});
  assert.equal(next.some((action) => action.id === release.id), false);
  assert.match(next.find((action) => action.t02EvidenceClass === "fire_origin")?.id ?? "", /SOOT_LAYER/u);
});

test("finishing three evidence classes yields to the canonical resolve step", () => {
  const state = runtime();
  state.playerState.missions[MISSION_ID].progress.investigate = 3;
  state.t02GranaryContinuity = {
    version: "t02-granary-continuity-v1",
    evidenceClasses: ["fire_origin", "hired_hand", "merchant_contract"],
    sideChoices: [],
    terminalChoiceId: null,
    selectedActionIds: [],
    sceneRevision: 3,
  };
  assert.equal(authoredMissionFlowExclusiveActions(state, {}), null);
});

test("exhausted investigation offers irreversible outcomes that close only the player mission", () => {
  const state = runtime();
  state.t02GranaryContinuity = {
    version: "t02-granary-continuity-v1",
    evidenceClasses: ["fire_origin", "hired_hand"],
    sideChoices: [...AUTHORED_MISSION_T02_GRANARY_INTERNALS.SIDE_ORDER],
    terminalChoiceId: null,
    selectedActionIds: [],
    sceneRevision: 5,
  };
  state.playerState.missions[MISSION_ID].progress.investigate = 2;
  const choices = authoredMissionFlowExclusiveActions(state, {});
  const terminal = choices.find((action) => action.t02TerminalChoice);
  assert.ok(terminal);
  assert.equal(applyAuthoredMissionFlowAction(state, terminal, { ok: true }), true);
  assert.equal(state.playerState.missions[MISSION_ID].status, "failed");
  assert.match(state.playerState.missions[MISSION_ID].failureReason, /^player_closed_t02_/u);
  assert.equal(state.playerState.worldFlags.t02PlayerMissionClosed, true);
  assert.equal(state.playerState.troubles.T02.status, "active");
  assert.equal(authoredMissionFlowExclusiveActions(state, {}), null);
});
