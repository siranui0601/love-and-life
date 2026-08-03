import assert from "node:assert/strict";
import test from "node:test";
import {
  CollapseAwareTrpgGameService,
  RESOLVE_COLLAPSE_CHOICE_ID,
  RESOLVE_COLLAPSE_COMMAND,
} from "../../../src/server/trpg/game/collapse-aware-service.js";
import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";
import { deserializeRuntime, serializeRuntime } from "../../../src/server/trpg/game/serializer.js";
import { gameStateHash, TrpgGameError } from "../../../src/server/trpg/game/service.js";

const owner = "collapse-service-owner";

async function forceCollapse(game, store, saveId) {
  const record = await store.get(saveId);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  runtime.playerState.player.needs.hunger = 100;
  runtime.playerState.player.needs.fatigue = 100;
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = gameStateHash(runtime, game.data);
  await store.put(record);
}

test("collapse-aware service persists the incident, locks normal UI, rescues once and keeps replay valid", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new CollapseAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create(owner, { playerName: "救助テスト", seed: "collapse-service-test" });
  await forceCollapse(game, store, created.id);

  const collapsed = await game.get(owner, created.id);
  assert.equal(collapsed.player.needs.collapsePending, true);
  assert.equal(collapsed.collapseRescue.active, true);
  assert.equal(collapsed.collapseRescue.command.type, RESOLVE_COLLAPSE_COMMAND);
  assert.equal(collapsed.choices.length, 1);
  assert.equal(collapsed.choices[0].choiceId, RESOLVE_COLLAPSE_CHOICE_ID);
  assert.equal(collapsed.choices[0].actionId, RESOLVE_COLLAPSE_COMMAND);
  assert.deepEqual(collapsed.movement, []);
  assert.equal(collapsed.shop.available, false);
  assert.deepEqual(collapsed.availableActions, []);

  await assert.rejects(
    game.command(owner, created.id, {
      commandId: "blocked-move",
      expectedRevision: collapsed.revision,
      type: "MOVE",
      payload: { moveId: "not-used" },
    }),
    (error) => error instanceof TrpgGameError
      && error.status === 409
      && error.code === "player_collapse_pending_rescue",
  );

  const rescued = await game.command(owner, created.id, {
    commandId: "resolve-collapse",
    expectedRevision: collapsed.revision,
    type: "CHOOSE",
    payload: {
      choiceId: RESOLVE_COLLAPSE_CHOICE_ID,
      actionId: RESOLVE_COLLAPSE_COMMAND,
    },
  });
  assert.equal(rescued.save.revision, collapsed.revision + 1);
  assert.equal(rescued.save.player.needs.collapsePending, false);
  assert.equal(rescued.save.collapseRescue, undefined);
  assert.ok(rescued.save.clock.absoluteMinute >= collapsed.clock.absoluteMinute + 180);
  assert.match(rescued.save.scene.narrative, /救助/u);

  const duplicate = await game.command(owner, created.id, {
    commandId: "resolve-collapse",
    expectedRevision: rescued.save.revision,
    type: "CHOOSE",
    payload: {
      choiceId: RESOLVE_COLLAPSE_CHOICE_ID,
      actionId: RESOLVE_COLLAPSE_COMMAND,
    },
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.save.revision, rescued.save.revision);

  const verification = await game.verifyReplay(owner, created.id);
  assert.equal(verification.ok, true);
});
