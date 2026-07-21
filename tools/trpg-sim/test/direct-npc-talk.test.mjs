import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGameView,
  createGameRuntime,
  executeGameRuntimeCommand,
  gameStateHash,
  TrpgGameError,
} from "../../../src/server/trpg/game/service.js";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";

function setup() {
  const data = loadTrpgGameData();
  const runtime = createGameRuntime(data, {
    seed: "direct-talk-test",
    profileId: "balanced",
    playerName: "会話テスト旅人",
    tutorial: false,
  });
  const record = {
    id: "direct-talk-test",
    schemaVersion: "test",
    contentRevision: data.contentRevision,
    revision: 0,
    stateHash: gameStateHash(runtime, data),
    playerName: runtime.playerState.player.displayName,
    presentation: null,
    lastOutcome: null,
  };
  return { data, runtime, record };
}

test("every present NPC exposes direct portrait conversation independently of the three choices", () => {
  const { data, runtime, record } = setup();
  const view = buildGameView(record, runtime, data);
  assert.ok(view.scene.presentNpcs.length > 0, "the opening location must have a visible NPC");
  assert.ok(view.scene.presentNpcs.every((npc) => npc.directTalkAvailable === true));
  const visibleChoiceTargets = new Set(view.choices.map((choice) => choice.targetNpcId).filter(Boolean));
  assert.ok(view.scene.presentNpcs.some((npc) => !visibleChoiceTargets.has(npc.id)) || view.scene.presentNpcs.length <= 3,
    "portrait conversation must not depend on occupying a choice slot");
});

test("TALK resolves a conversation with a visible NPC", () => {
  const { data, runtime, record } = setup();
  const view = buildGameView(record, runtime, data);
  const npc = view.scene.presentNpcs[0];
  const result = executeGameRuntimeCommand(runtime, data, {
    type: "TALK",
    payload: { npcId: npc.id },
  });
  assert.equal(result.resolvedActionId, `DIRECT_TALK:${npc.id}`);
  assert.equal(result.resolvedAction.targetNpcId, npc.id);
  assert.equal(result.resolvedAction.type, "conversation");
  assert.equal(result.outcome.ok, true);
});

test("TALK rejects absent or stale NPC targets", () => {
  const { data, runtime } = setup();
  assert.throws(() => executeGameRuntimeCommand(runtime, data, {
    type: "TALK",
    payload: { npcId: "NPC999" },
  }), (error) => error instanceof TrpgGameError && error.code === "npc_talk_not_available");
});
