import assert from "node:assert/strict";
import test from "node:test";
import {
  CollapseAwareTrpgGameService,
  DISCOVER_LOCAL_TROUBLE_ACTION_PREFIX,
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

async function forceUndiscoveredT05(game, store, saveId) {
  const record = await store.get(saveId);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  runtime.playerState.absoluteMinute = (37 * 1440) + (8 * 60);
  runtime.playerState.day = 38;
  runtime.playerState.hour = 8;
  runtime.playerState.minute = 0;
  runtime.playerState.player.location = "交易都市";
  runtime.playerState.player.facilityId = "LOC_TRADE_LORD_MANOR";
  runtime.playerState.troubles.T05.status = "critical";
  runtime.playerState.missions["MSN-T05"].status = "active";
  const rumor = {
    id: "RUM-T05-critical",
    troubleId: "T05",
    text: "交易都市領主の毒殺計画:critical",
    origin: "交易都市",
    originMinute: runtime.playerState.absoluteMinute - 60,
    importance: 0.95,
    playerOriginated: false,
    recipients: {},
  };
  runtime.playerState.rumors = (runtime.playerState.rumors ?? []).filter((entry) => entry.troubleId !== "T05");
  runtime.playerState.rumors.push(rumor);
  runtime.playerState.rumorById[rumor.id] = rumor;
  runtime.playerState.player.knownRumorIds.delete(rumor.id);
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

  const nextChoice = rescued.save.choices[0];
  assert.ok(nextChoice, "normal story choices must return after rescue");
  const continued = await game.command(owner, created.id, {
    commandId: "post-rescue-story-action",
    expectedRevision: rescued.save.revision,
    type: "CHOOSE",
    payload: {
      choiceId: nextChoice.choiceId,
      actionId: nextChoice.actionId,
    },
  });
  assert.equal(continued.save.revision, rescued.save.revision + 1);
  assert.equal((await game.get(owner, created.id)).revision, continued.save.revision);

  const verification = await game.verifyReplay(owner, created.id);
  assert.equal(verification.ok, true);
});

test("an active local crisis can be discovered from normal choices and continues into the authored T05 opening", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new CollapseAwareTrpgGameService({ store, allowCustomSeed: true });
  const created = await game.create(owner, { playerName: "現地危機テスト", seed: "local-trouble-discovery-test" });
  await forceUndiscoveredT05(game, store, created.id);

  const before = await game.get(owner, created.id);
  const discovery = before.choices.find((choice) =>
    choice.actionId === `${DISCOVER_LOCAL_TROUBLE_ACTION_PREFIX}T05`);
  assert.ok(discovery, "the current-region crisis must be visible without guessing a facility loop");
  assert.match(discovery.label, /療養室|継承/u);

  const discovered = await game.command(owner, created.id, {
    commandId: "discover-local-t05",
    expectedRevision: before.revision,
    type: "CHOOSE",
    payload: {
      choiceId: discovery.choiceId,
      actionId: discovery.actionId,
    },
  });
  assert.equal(discovered.save.revision, before.revision + 1);
  assert.equal(discovered.save.clock.absoluteMinute, before.clock.absoluteMinute + 8);
  assert.equal(discovered.save.choices.length, 3);
  assert.ok(discovered.save.choices.every((choice) =>
    choice.actionId.startsWith("MISSION_FLOW:trade-lord-poisoning:OPENING:")));

  const opening = discovered.save.choices[0];
  const continued = await game.command(owner, created.id, {
    commandId: "continue-authored-t05-opening",
    expectedRevision: discovered.save.revision,
    type: "CHOOSE",
    payload: {
      choiceId: opening.choiceId,
      actionId: opening.actionId,
    },
  });
  assert.equal(continued.save.revision, discovered.save.revision + 1);
  assert.equal(continued.save.missions.find((mission) => mission.id === "MSN-T05")?.status, "active");
  assert.ok(continued.save.guidance?.missionId === "MSN-T05" || continued.save.choices.some((choice) => choice.missionId === "MSN-T05"));

  const duplicate = await game.command(owner, created.id, {
    commandId: "discover-local-t05",
    expectedRevision: continued.save.revision,
    type: "CHOOSE",
    payload: {
      choiceId: discovery.choiceId,
      actionId: discovery.actionId,
    },
  });
  assert.equal(duplicate.duplicate, true);

  const verification = await game.verifyReplay(owner, created.id);
  assert.equal(verification.ok, true);
});
