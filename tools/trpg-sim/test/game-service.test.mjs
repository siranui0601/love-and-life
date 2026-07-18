import assert from "node:assert/strict";
import test from "node:test";
import { TrpgGameService } from "../../../src/server/trpg/game/service.js";
import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";
import { deserializeRuntime } from "../../../src/server/trpg/game/serializer.js";
import { publicNpc } from "../../../src/server/trpg/game/presence.js";
import { trpgRequestAddress } from "../../../src/server/trpg/game/routes.js";

const owner = "test-owner";

function service(seedSupport = true, options = {}) {
  const store = new MemoryTrpgSaveStore();
  return { store, game: new TrpgGameService({ store, allowCustomSeed: seedSupport, ...options }) };
}

function commandRunner(game, initial) {
  let save = initial;
  let sequence = 0;
  return {
    get save() { return save; },
    async run(type, payload, commandId = `command-${++sequence}`) {
      const response = await game.command(owner, save.id, {
        commandId,
        expectedRevision: save.revision,
        type,
        payload,
      });
      save = response.save;
      return response;
    },
  };
}

test("playable save starts at Day1 wheat field with Finn absent and exactly three authoritative choices", async () => {
  const { game } = service();
  const save = await game.create(owner, { playerName: "旅人", profileId: "story", seed: "opening-contract" });
  assert.equal(save.clock.day, 1);
  assert.equal(save.clock.time, "10:00");
  assert.equal(save.scene.facilityId, "LOC_FARM_FIELD");
  assert.equal(save.scene.presentNpcs.some((npc) => npc.id === "NPC001"), false);
  assert.equal(save.scene.presentNpcs.some((npc) => npc.id === "NPC004"), true);
  assert.equal(save.choices.length, 3);
  assert.equal(new Set(save.choices.map((choice) => choice.choiceId)).size, 3);
  assert.equal(save.shop.available, false);
  assert.equal(save.missions.some((mission) => mission.id === "MSN-T01"), true);
  assert.equal(save.missions.some((mission) => mission.id === "MSN-T13"), false);
  assert.deepEqual(save.missions.filter((mission) => mission.kind === "permanent").map((mission) => mission.id).sort(), [
    "MSN-FACILITY-006",
    "MSN-HUB-003",
  ]);
  assert.equal(save.choices.some((choice) => choice.actionId.includes("MSN-T13")), false);
  assert.equal(save.skills.learned.length, 0);
  assert.ok(save.skills.learnable.length > 0);
});

test("public NPC data never exposes authored occupations, goals, or private beliefs", () => {
  const visible = publicNpc({
    id: "NPC006",
    name: "ダルク",
    occupation: "穀物商に雇われた放火犯",
    home: "交易都市",
    species: "人間",
    speechStyle: "軽薄。追い詰められると早口",
  }, {
    lifeStatus: "alive",
    presence: "present",
    status: "通常",
    currentGoal: "穀倉放火の証拠を消す",
    beliefs: { culprit: { kind: "fact", text: "T02_放火犯", secret: false } },
    position: { hubId: "田園の村", facilityId: "LOC_FARM_GRANARY" },
  });
  assert.equal(visible.role, "交易都市の住人");
  assert.equal(visible.currentGoal, null);
  assert.deepEqual(visible.knownLocalFacts, []);
  assert.doesNotMatch(JSON.stringify(visible), /放火犯|証拠を消す|追い詰め/u);
});

test("rate-limit identity ignores client-prepended XFF values behind the local proxy", () => {
  const proxied = {
    socket: { remoteAddress: "127.0.0.1" },
    get(name) { return name === "x-forwarded-for" ? "198.51.100.7, 203.0.113.42" : undefined; },
  };
  assert.equal(trpgRequestAddress(proxied), "203.0.113.42");
  const direct = {
    socket: { remoteAddress: "192.0.2.8" },
    get() { return "198.51.100.7"; },
  };
  assert.equal(trpgRequestAddress(direct), "192.0.2.8");
});

test("anonymous save capacity is bounded per owner", async () => {
  const { game } = service(true, { maxSavesPerOwner: 1, maxTotalSaves: 2 });
  const first = await game.create(owner, { seed: "quota-one" });
  await assert.rejects(() => game.create(owner, { seed: "quota-two" }), (error) => error.code === "owner_save_quota_reached" && error.status === 429);
  await game.delete(owner, first.id);
  assert.ok(await game.create(owner, { seed: "quota-after-delete" }));
});

test("obsolete saves are pruned and global capacity preserves existing saves", async () => {
  const obsolete = service(true, { maxSavesPerOwner: 1, maxTotalSaves: 2 });
  const old = await obsolete.game.create(owner, { seed: "obsolete-one" });
  const oldRecord = await obsolete.store.get(old.id);
  oldRecord.resolverVersion = "obsolete-resolver";
  await obsolete.store.put(oldRecord);
  assert.ok(await obsolete.game.create(owner, { seed: "obsolete-two" }));
  assert.equal(await obsolete.store.get(old.id), null);

  const bounded = service(true, { maxSavesPerOwner: 2, maxTotalSaves: 1 });
  const first = await bounded.game.create("owner-a", { seed: "lru-one" });
  await assert.rejects(() => bounded.game.create("owner-b", { seed: "capacity-two" }), (error) => error.code === "global_save_capacity_reached" && error.status === 503);
  assert.ok(await bounded.store.get(first.id));

  const expired = service(true, { saveRetentionDays: 1 });
  const stale = await expired.game.create(owner, { seed: "expired-one" });
  const staleRecord = await expired.store.get(stale.id);
  staleRecord.updatedAt = "2000-01-01T00:00:00.000Z";
  await expired.store.put(staleRecord);
  await assert.rejects(() => expired.game.get(owner, stale.id), (error) => error.code === "save_expired" && error.status === 404);
  assert.equal(await expired.store.get(stale.id), null);
});

test("shop stock is facility-scoped and a duplicate command cannot advance a save twice", async () => {
  const { game, store } = service();
  const initial = await game.create(owner, { playerName: "商人", profileId: "merchant", seed: "shop-contract" });
  const runner = commandRunner(game, initial);
  const square = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_SQUARE");
  const first = await runner.run("MOVE", { moveId: square.moveId, ignored: "x".repeat(20_000) }, "same-command");
  assert.equal(first.save.scene.facilityId, "LOC_FARM_SQUARE");
  assert.ok(first.save.shop.stock.length > 0);
  assert.ok(first.save.shop.stock.every((stock) => stock.sellerId === "LOC_FARM_SQUARE"));
  const revision = first.save.revision;
  const duplicate = await game.command(owner, first.save.id, {
    commandId: "same-command",
    expectedRevision: 0,
    type: "MOVE",
    payload: { moveId: square.moveId },
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.save.revision, revision);
  assert.deepEqual((await store.get(first.save.id)).commandLog[0].payload, { moveId: square.moveId });
});

test("world-originated rumor spread does not grant player levels during an ordinary job", async () => {
  const { game } = service();
  const initial = await game.create(owner, { playerName: "働き手", profileId: "story", seed: "balance-contract" });
  const runner = commandRunner(game, initial);
  const square = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_SQUARE");
  await runner.run("MOVE", { moveId: square.moveId });
  const work = runner.save.choices.find((choice) => choice.actionId === "WORK");
  assert.ok(work);
  await runner.run("CHOOSE", { choiceId: work.choiceId });
  assert.equal(runner.save.player.level, 1);
  assert.equal(runner.save.player.exp, 0);
  assert.ok(runner.save.player.gold > 0);
  assert.notEqual(runner.save.missions.find((mission) => mission.id === "MSN-RUMOR-005")?.status, "completed");
});

test("a public living-world rumor becomes a mission only after the player hears it locally", async () => {
  const { game } = service();
  const initial = await game.create(owner, { playerName: "聞き手", profileId: "story", seed: "forest-rumor" });
  const runner = commandRunner(game, initial);
  assert.equal(runner.save.missions.some((mission) => mission.id === "MSN-T13"), false);
  const forest = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FOREST_EDGE");
  assert.ok(forest);
  await runner.run("MOVE", { moveId: forest.moveId });
  assert.equal(runner.save.missions.some((mission) => mission.id === "MSN-T13"), false);
  const hearLocal = runner.save.choices.find((choice) => ["conversation", "observe"].includes(choice.type));
  assert.ok(hearLocal);
  const response = await runner.run("CHOOSE", { choiceId: hearLocal.choiceId });
  assert.equal(response.save.scene.lastOutcome.learnedRumorCount, 1);
  assert.equal(runner.save.missions.some((mission) => mission.id === "MSN-T13"), true);
  assert.equal(runner.save.choices.some((choice) => choice.actionId.includes("MSN-T13")), true);
});

test("manual skill acquisition spends SP once and survives deterministic replay", async () => {
  const { game } = service();
  const initial = await game.create(owner, { playerName: "学徒", profileId: "balanced", seed: "skill-replay" });
  const runner = commandRunner(game, initial);
  const candidate = runner.save.skills.learnable[0];
  const spBefore = runner.save.player.sp;
  await runner.run("LEARN_SKILL", { skillId: candidate.id });
  assert.equal(runner.save.player.sp, spBefore - candidate.spCost);
  assert.ok(runner.save.skills.learned.some((skill) => skill.id === candidate.id));
  const verification = await game.verifyReplay(owner, runner.save.id);
  assert.equal(verification.ok, true);
  assert.ok(verification.checks.every((entry) => entry.beforeMatches && entry.actionMatches && entry.afterMatches));
});

test("T01 can be played from inquiry through battle and rescue without ever speaking as missing Finn", async () => {
  const { game, store } = service();
  const initial = await game.create(owner, { playerName: "救助者", profileId: "story", seed: "t01-success" });
  const runner = commandRunner(game, initial);
  const moveTo = async (facilityId) => {
    const movement = runner.save.movement.find((entry) => entry.destinationFacilityId === facilityId);
    assert.ok(movement, `movement to ${facilityId} must be available`);
    await runner.run("MOVE", { moveId: movement.moveId });
  };
  const chooseAction = async (actionId) => {
    const choice = runner.save.choices.find((entry) => entry.actionId === actionId);
    assert.ok(choice, `${actionId} must be one of the three current choices`);
    assert.equal(choice.targetNpcId === "NPC001", false);
    await runner.run("CHOOSE", { choiceId: choice.choiceId });
  };

  await moveTo("LOC_FARM_SQUARE");
  await chooseAction("ACTION:MSN-T01:hear");
  await moveTo("LOC_FARM_EDGE");
  await chooseAction("ACTION:MSN-T01:search");
  await chooseAction("ACTION:MSN-T01:search");
  await chooseAction("ACTION:MSN-T01:rescue");
  assert.equal(runner.save.scene.lastOutcome.battle.won, true);
  await moveTo("LOC_FARM_SQUARE");
  await chooseAction("ACTION:MSN-T01:decide");

  const mission = runner.save.missions.find((entry) => entry.id === "MSN-T01");
  assert.equal(mission.status, "completed");
  assert.ok(runner.save.scene.presentNpcs.some((npc) => npc.id === "NPC001" && npc.lifeStatus === "injured"));
  const record = await store.get(runner.save.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  assert.equal(runtime.livingWorld.npcStates.NPC001.lifeStatus, "injured");
  assert.equal(runtime.playerState.troubles.T01.status, "resolved");
  assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
});

test("the same content revision, seed and command sequence produce the same state hash", async () => {
  const left = service();
  const right = service();
  const a = commandRunner(left.game, await left.game.create(owner, { playerName: "同じ旅人", profileId: "balanced", seed: "same-sequence" }));
  const b = commandRunner(right.game, await right.game.create(owner, { playerName: "同じ旅人", profileId: "balanced", seed: "same-sequence" }));
  assert.equal(a.save.stateHash, b.save.stateHash);
  for (let index = 0; index < 3; index += 1) {
    assert.deepEqual(a.save.choices.map((choice) => choice.actionId), b.save.choices.map((choice) => choice.actionId));
    await a.run("CHOOSE", { choiceId: a.save.choices[0].choiceId });
    await b.run("CHOOSE", { choiceId: b.save.choices[0].choiceId });
    assert.equal(a.save.stateHash, b.save.stateHash);
  }
});
