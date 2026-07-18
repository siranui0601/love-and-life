import assert from "node:assert/strict";
import test from "node:test";
import {
  availableGameRuntimeActions,
  buildGameView,
  compactPlayableRuntime,
  createGameRuntime,
  executeGameRuntimeCommand,
  gameStateHash,
  safeBattlePlayback,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";
import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";
import { deserializeRuntime, serializeRuntime } from "../../../src/server/trpg/game/serializer.js";
import { publicNpc } from "../../../src/server/trpg/game/presence.js";
import { trpgRequestAddress } from "../../../src/server/trpg/game/routes.js";
import { clockFromMinute, GAME_END_MINUTE } from "../lib/player-journey.mjs";

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

async function completeOpening(runner, {
  awakening = "TUTORIAL:AWAKEN:LISTEN",
  contact = "TUTORIAL:CONTACT:WHERE",
  orientation = "TUTORIAL:ORIENT:VOICES",
  inquiry = "TUTORIAL:INQUIRY:MIRA",
} = {}) {
  const choose = async (actionId) => {
    const action = runner.save.choices.find((entry) => entry.actionId === actionId);
    assert.ok(action, `${actionId} must be available during the opening`);
    await runner.run("CHOOSE", { choiceId: action.choiceId });
  };
  await choose(awakening);
  await choose(contact);
  await choose(orientation);
  const square = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_SQUARE");
  assert.ok(square, "the movement tutorial must point to the village square");
  await runner.run("MOVE", { moveId: square.moveId });
  await choose(inquiry);
  return runner.save;
}

test("playable save starts alone in the Day1 wheat field with a progressive, profile-free opening", async () => {
  const { game } = service();
  const save = await game.create(owner, { playerName: "旅人", profileId: "story", seed: "opening-contract" });
  assert.equal(save.clock.day, 1);
  assert.equal(save.clock.time, "10:00");
  assert.equal(save.scene.facilityId, "LOC_FARM_FIELD");
  assert.equal(save.scene.presentNpcs.some((npc) => npc.id === "NPC001"), false);
  assert.equal(save.scene.presentNpcs.length, 0);
  assert.equal(save.choices.length, 3);
  assert.equal(new Set(save.choices.map((choice) => choice.choiceId)).size, 3);
  assert.deepEqual(save.choices.map((choice) => choice.actionId), [
    "TUTORIAL:AWAKEN:BODY",
    "TUTORIAL:AWAKEN:LISTEN",
    "TUTORIAL:AWAKEN:GROUND",
  ]);
  assert.equal(save.tutorial.id, "first-choice");
  assert.deepEqual(save.tutorial.unlocked, {
    choices: true,
    movement: false,
    missions: false,
    shop: false,
    skills: false,
    battle: false,
  });
  assert.equal(save.guidance.title, "目を覚まし、自分の状況を確かめる");
  assert.equal(save.movement.length, 0);
  assert.equal(save.shop.available, false);
  assert.equal(save.missions.some((mission) => mission.id === "MSN-T01"), false);
  assert.equal(save.missions.some((mission) => mission.id === "MSN-T13"), false);
  assert.deepEqual(save.missions, []);
  assert.equal(save.choices.some((choice) => choice.actionId.includes("MSN-T13")), false);
  assert.equal(save.skills.learned.length, 0);
  assert.ok(save.skills.learnable.length > 0);
  assert.equal(save.skills.locked.some((skill) => skill.reasons?.includes("not_visible")), false);
  assert.equal(save.skills.learnable[0].recommended, true);
  assert.equal(save.skills.learnable[0].category, "斧");
  assert.match(save.skills.learnable[0].equipmentNote, /農具鉈/u);
  assert.equal("profileId" in save.player, false);
  assert.equal("profileLabel" in save.player, false);
});

test("locked tutorial features cannot be bypassed through direct commands", async () => {
  const { game } = service();
  const save = await game.create(owner, { playerName: "先走り", seed: "tutorial-command-gate" });
  const skill = save.skills.learnable[0];
  assert.ok(skill);
  await assert.rejects(() => game.command(owner, save.id, {
    commandId: "direct-skill-before-unlock",
    expectedRevision: save.revision,
    type: "LEARN_SKILL",
    payload: { skillId: skill.id },
  }), (error) => error.code === "tutorial_feature_locked" && error.details?.feature === "skills");
  const unchanged = await game.get(owner, save.id);
  assert.equal(unchanged.revision, save.revision);
  assert.equal(unchanged.player.sp, save.player.sp);
  assert.deepEqual(unchanged.skills.learned, []);
});

test("Day100 ending is immutable and has an explicit player-facing conclusion", () => {
  const { game } = service();
  const runtime = createGameRuntime(game.data, {
    seed: "day100-ending",
    profileId: "balanced",
    playerName: "百日の旅人",
    tutorial: true,
  });
  runtime.playerState.absoluteMinute = GAME_END_MINUTE;
  Object.assign(runtime.playerState, clockFromMinute(GAME_END_MINUTE));
  const record = {
    id: "ended-save",
    schemaVersion: "test",
    contentRevision: game.data.contentRevision,
    revision: 0,
    stateHash: "ended",
    playerName: "百日の旅人",
    presentation: null,
    lastOutcome: null,
  };
  const view = buildGameView(record, runtime, game.data);
  assert.equal(view.world.ended, true);
  assert.equal(view.world.endedAt, "Day 100 24:00");
  assert.equal(view.clock.time, "24:00");
  assert.deepEqual(view.choices, []);
  assert.deepEqual(view.movement, []);
  assert.equal(view.tutorial, null);
  assert.match(view.guidance.title, /100日間/u);
  assert.deepEqual(availableGameRuntimeActions(runtime, game.data), {
    choices: [],
    movement: [],
    stock: [],
    learnableSkills: [],
  });
  assert.throws(() => executeGameRuntimeCommand(runtime, game.data, {
    type: "LEARN_SKILL",
    payload: { skillId: view.skills.learnable[0]?.id ?? "SKL-0001" },
  }), (error) => error.code === "game_ended");
});

test("playable snapshots compact audit-only history while retaining current NPC state and causal totals", () => {
  const { game } = service();
  const runtime = createGameRuntime(game.data, {
    seed: "playable-compaction",
    profileId: "balanced",
    playerName: "長旅",
    tutorial: true,
  });
  runtime.livingWorld.decisionEvents = Array.from({ length: 2_000 }, (_, id) => ({ id, detail: "x".repeat(200) }));
  runtime.livingWorld.knowledgeEvents = Array.from({ length: 1_000 }, (_, id) => ({ id, detail: "y".repeat(200) }));
  runtime.livingWorld.localMovementEvents = Array.from({ length: 1_000 }, (_, id) => ({ id, detail: "z".repeat(120) }));
  runtime.livingWorld.populationByTick = Array.from({ length: 100 }, (_, id) => ({ id }));
  for (const npcId of Object.keys(runtime.livingWorld.npcTraces)) {
    runtime.livingWorld.npcTraces[npcId] = Array.from({ length: 20 }, (_, tick) => ({ tick, action: "work" }));
  }
  runtime.playerState.history = Array.from({ length: 1_000 }, (_, id) => ({ id, type: "TEST" }));
  runtime.playerState.replayResults = Object.fromEntries(Array.from({ length: 500 }, (_, id) => [`key-${id}`, `hash-${id}`]));
  const npcStateBefore = runtime.livingWorld.npcStates.NPC004;

  compactPlayableRuntime(runtime);

  assert.equal(runtime.livingWorld.decisionEvents.length, 128);
  assert.equal(runtime.livingWorld.knowledgeEvents.length, 256);
  assert.equal(runtime.livingWorld.localMovementEvents.length, 256);
  assert.equal(runtime.livingWorld.populationByTick.length, 8);
  assert.ok(Object.values(runtime.livingWorld.npcTraces).every((traces) => traces.length === 4));
  assert.equal(runtime.playerState.history.length, 256);
  assert.equal(Object.keys(runtime.playerState.replayResults).length, 128);
  assert.equal(runtime.livingWorld.npcStates.NPC004, npcStateBefore);
  assert.ok(runtime.livingWorld.playableCompaction.decisionEventsRemoved > 0);
  const serialized = serializeRuntime(runtime);
  assert.ok(Buffer.byteLength(serialized) < 2_000_000);
  compactPlayableRuntime(runtime);
  assert.equal(serializeRuntime(runtime), serialized);
});

test("a compacted playable journey reaches Day100 within the persisted snapshot budget", () => {
  const { game } = service();
  const runtime = createGameRuntime(game.data, {
    seed: "day100-compact-budget",
    profileId: "balanced",
    playerName: "百日の旅人",
    tutorial: false,
  });
  let commandCount = 0;
  while (runtime.playerState.absoluteMinute < GAME_END_MINUTE && commandCount < 5_000) {
    const actions = availableGameRuntimeActions(runtime, game.data).choices;
    const safe = actions
      .filter((action) => !action.danger && !["seekBattle", "missionBattle"].includes(action.type))
      .sort((left, right) => Number(right.minutes ?? 0) - Number(left.minutes ?? 0)
        || String(left.id).localeCompare(String(right.id)))[0];
    assert.ok(safe, `a safe time-advancing action must remain available at command ${commandCount}`);
    executeGameRuntimeCommand(runtime, game.data, {
      type: "CHOOSE",
      payload: { choiceId: safe.choiceId },
    });
    compactPlayableRuntime(runtime);
    commandCount += 1;
  }
  assert.equal(runtime.playerState.absoluteMinute, GAME_END_MINUTE);
  assert.ok(commandCount < 5_000);
  assert.ok(Buffer.byteLength(serializeRuntime(runtime)) < 3_000_000);
  assert.equal(runtime.livingWorld.decisionEvents.length, 128);
  assert.equal(runtime.livingWorld.knowledgeEvents.length, 256);
  assert.equal(runtime.playerState.history.length, 256);
});

test("two-handed weapons and off-hand equipment cannot remain equipped together", () => {
  const { game } = service();
  const runtime = createGameRuntime(game.data, {
    seed: "two-hand-equipment",
    profileId: "balanced",
    playerName: "装備確認",
  });
  const axeId = "EQP-W-0006";
  const shieldId = "EQP-S-0001";
  runtime.playerState.player.inventory.equipment[axeId] = 1;
  runtime.playerState.player.inventory.equipment[shieldId] = 1;
  runtime.playerState.player.equipment.offHand = shieldId;

  executeGameRuntimeCommand(runtime, game.data, { type: "EQUIP", payload: { equipmentId: axeId } });
  assert.equal(runtime.playerState.player.equipment.mainHand, axeId);
  assert.equal(runtime.playerState.player.equipment.offHand, undefined);

  executeGameRuntimeCommand(runtime, game.data, { type: "EQUIP", payload: { equipmentId: shieldId } });
  assert.equal(runtime.playerState.player.equipment.mainHand, undefined);
  assert.equal(runtime.playerState.player.equipment.offHand, shieldId);
  assert.deepEqual(
    runtime.playerState.history.filter((entry) => entry.type === "EQUIPMENT_UNEQUIPPED").map((entry) => entry.cause),
    ["two-handed-main-equipped", "off-hand-equipped"],
  );
});

test("a defeated regional journey persists its battle and elapsed time instead of rolling back", async () => {
  const { game, store } = service();
  const initial = await game.create(owner, { playerName: "撤退者", seed: "travel-defeat-lowhp-9" });
  const record = await store.get(initial.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  runtime.tutorial = null;
  const startMinute = 49 * 1440;
  runtime.playerState.absoluteMinute = startMinute;
  Object.assign(runtime.playerState, clockFromMinute(startMinute));
  runtime.playerState.player.location = "犯罪都市";
  runtime.playerState.player.facilityId = "LOC_CRIME_DOCK";
  runtime.playerState.player.level = 10;
  runtime.playerState.player.hpRatio = 0.01;
  const move = availableGameRuntimeActions(runtime, game.data).movement
    .find((entry) => entry.id === "MOVE_REGION:黒嶺連合領");
  assert.ok(move);
  const expectedElapsed = move.minutes + Number(runtime.playerState.tuning.defeatRecoveryMinutes ?? 360);
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = gameStateHash(runtime, game.data);
  await store.put(record);

  const result = await game.command(owner, initial.id, {
    commandId: "persist-travel-defeat",
    expectedRevision: 0,
    type: "MOVE",
    payload: { moveId: move.id },
  });
  assert.equal(result.save.scene.lastOutcome.ok, false);
  assert.equal(result.save.scene.lastOutcome.committed, true);
  assert.equal(result.save.scene.lastOutcome.reason, "travel_defeat");
  assert.equal(result.save.scene.location, "犯罪都市");
  assert.equal(result.save.clock.absoluteMinute, startMinute + expectedElapsed);
  assert.match(result.save.scene.narrative, /退いた|撤退/u);
  assert.doesNotMatch(result.save.scene.narrative, /着いた/u);
  const persisted = deserializeRuntime((await store.get(initial.id)).runtimeSnapshot, game.data);
  assert.equal(persisted.playerState.metrics.battles, 1);
  assert.equal(persisted.playerState.metrics.losses, 1);
  assert.ok(persisted.playerState.history.some((entry) => entry.type === "REGIONAL_MOVE_INTERRUPTED"));
});

test("real-game battle capture is ephemeral, deterministic, and leaves runtime tuning unchanged", () => {
  const { game } = service();
  const source = createGameRuntime(game.data, {
    seed: "cap-reward-0",
    profileId: "balanced",
    playerName: "記録係",
    tutorial: false,
  });
  source.playerState.player.skills.add("SKL-0001");
  const first = deserializeRuntime(serializeRuntime(source), game.data);
  const second = deserializeRuntime(serializeRuntime(source), game.data);
  const action = availableGameRuntimeActions(first, game.data).choices.find((entry) => entry.id === "SEEK_BATTLE");
  assert.ok(action);

  const firstResult = executeGameRuntimeCommand(first, game.data, {
    type: "CHOOSE",
    payload: { choiceId: action.choiceId },
  });
  const secondResult = executeGameRuntimeCommand(second, game.data, {
    type: "CHOOSE",
    payload: { choiceId: action.choiceId },
  });
  const { playback: firstPlayback, ...firstBattle } = firstResult.outcome.battle;
  const { playback: secondPlayback, ...secondBattle } = secondResult.outcome.battle;

  assert.ok(firstPlayback);
  assert.deepEqual(firstPlayback, secondPlayback);
  assert.deepEqual(firstBattle, secondBattle);
  assert.equal(Object.hasOwn(first.playerState.tuning, "captureBattleTimeline"), false);
  assert.equal(Object.hasOwn(second.playerState.tuning, "captureBattleTimeline"), false);
  assert.deepEqual({
    hp: first.playerState.player.hpRatio,
    mp: first.playerState.player.mpRatio,
    gold: first.playerState.player.gold,
    exp: first.playerState.player.exp,
    wins: first.playerState.metrics.wins,
    losses: first.playerState.metrics.losses,
  }, {
    hp: second.playerState.player.hpRatio,
    mp: second.playerState.player.mpRatio,
    gold: second.playerState.player.gold,
    exp: second.playerState.player.exp,
    wins: second.playerState.metrics.wins,
    losses: second.playerState.metrics.losses,
  });
});

test("truncated battle playback carries a deterministic checkpoint across the omitted middle", () => {
  const { game } = service();
  const frames = Array.from({ length: 120 }, (_, index) => ({
    seq: index + 1,
    round: Math.floor(index / 2) + 1,
    phase: "action",
    actorInstanceId: "PLAYER#1",
    actorSide: "player",
    action: { kind: "attack", actionId: "__normal__", skillId: null, name: "こうげき" },
    primaryTargetInstanceId: "MON-0001#1",
    hits: 1,
    criticals: 0,
    damage: 1,
    healing: 0,
    effects: [{
      targetInstanceId: "MON-0001#1",
      hpBefore: 300 - index,
      hpAfter: 299 - index,
      mpBefore: 0,
      mpAfter: 0,
      aliveBefore: true,
      aliveAfter: true,
    }],
  }));
  const playback = safeBattlePlayback({
    encounterId: "ENC-0001",
    timeline: {
      combatants: [
        { instanceId: "PLAYER#1", id: "PLAYER", name: "Player", side: "player", hp: 200, maxHp: 200, mp: 20, maxMp: 20, alive: true },
        { instanceId: "MON-0001#1", id: "MON-0001", name: "Enemy", side: "enemy", hp: 300, maxHp: 300, mp: 0, maxMp: 0, alive: true },
      ],
      frames,
    },
  }, game.data);

  assert.ok(playback.frames.length <= 96);
  assert.equal(playback.truncatedFrames, 120 - playback.frames.length);
  const gapFrame = playback.frames.find((frame) => frame.omittedBefore > 0);
  assert.ok(gapFrame);
  assert.equal(gapFrame.checkpoint.find((actor) => actor.instanceId === "MON-0001#1").hp, gapFrame.effects[0].hpBefore);
  const actors = new Map(playback.combatants.map((actor) => [actor.instanceId, { ...actor }]));
  playback.frames.forEach((frame) => {
    frame.checkpoint?.forEach((checkpoint) => Object.assign(actors.get(checkpoint.instanceId), checkpoint));
    frame.effects.forEach((effect) => Object.assign(actors.get(effect.targetInstanceId), {
      hp: effect.hpAfter,
      mp: effect.mpAfter,
      alive: effect.aliveAfter,
    }));
  });
  assert.equal(actors.get("MON-0001#1").hp, 180);
  assert.ok(Buffer.byteLength(JSON.stringify(playback), "utf8") <= 60 * 1024);
});

test("the authored opening reveals Eda, movement and T01 in that order and survives replay", async () => {
  const { game } = service();
  const runner = commandRunner(game, await game.create(owner, { playerName: "初見", seed: "opening-order" }));
  const startMinute = runner.save.clock.absoluteMinute;
  await runner.run("CHOOSE", { choiceId: runner.save.choices.find((choice) => choice.actionId === "TUTORIAL:AWAKEN:GROUND").choiceId });
  assert.equal(runner.save.scene.presentNpcs.some((npc) => npc.id === "NPC004"), true);
  assert.equal(runner.save.tutorial.id, "first-conversation");
  assert.equal(runner.save.clock.absoluteMinute, startMinute + 6);
  assert.equal(runner.save.missions.length, 0);
  await runner.run("CHOOSE", { choiceId: runner.save.choices.find((choice) => choice.actionId === "TUTORIAL:CONTACT:WHO").choiceId });
  await runner.run("CHOOSE", { choiceId: runner.save.choices.find((choice) => choice.actionId === "TUTORIAL:ORIENT:FOUND").choiceId });
  assert.equal(runner.save.tutorial.id, "first-movement");
  assert.deepEqual(runner.save.tutorial.unlocked, {
    choices: true,
    movement: true,
    missions: false,
    shop: false,
    skills: false,
    battle: false,
  });
  assert.ok(runner.save.movement.length > 0);
  assert.ok(runner.save.movement.every((move) => move.scope === "local"));
  assert.equal(runner.save.movement.some((move) => move.recommended && move.destinationFacilityId === "LOC_FARM_SQUARE"), true);
  const square = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_SQUARE");
  await runner.run("MOVE", { moveId: square.moveId });
  assert.equal(runner.save.tutorial.id, "discover-trouble");
  assert.equal(runner.save.missions.length, 0);
  assert.ok(runner.save.scene.presentNpcs.some((npc) => npc.id === "NPC002"));
  await runner.run("CHOOSE", { choiceId: runner.save.choices.find((choice) => choice.actionId === "TUTORIAL:INQUIRY:COBY").choiceId });
  assert.equal(runner.save.tutorial.id, "mission-log");
  assert.deepEqual(runner.save.tutorial.unlocked, {
    choices: true,
    movement: true,
    missions: true,
    shop: true,
    skills: true,
    battle: true,
  });
  assert.ok(runner.save.missions.some((mission) => mission.id === "MSN-T01"));
  assert.equal(runner.save.guidance.targetFacilityId, "LOC_FARM_EDGE");
  assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
});

test("replay verification rejects journal outcome, sequence and revision tampering", async () => {
  const { game, store } = service();
  const initial = await game.create(owner, { playerName: "検証者", seed: "journal-integrity" });
  const runner = commandRunner(game, initial);
  await runner.run("CHOOSE", { choiceId: initial.choices[0].choiceId });
  assert.equal((await game.verifyReplay(owner, initial.id)).ok, true);

  const original = await store.get(initial.id);
  const outcomeTampered = structuredClone(original);
  outcomeTampered.commandLog[0].outcome = { ok: false, reason: "tampered" };
  await store.put(outcomeTampered);
  const outcomeVerification = await game.verifyReplay(owner, initial.id);
  assert.equal(outcomeVerification.ok, false);
  assert.equal(outcomeVerification.checks[0].outcomeMatches, false);

  const sequenceTampered = structuredClone(original);
  sequenceTampered.commandLog[0].seq = 999;
  sequenceTampered.commandLog[0].revisionBefore = 77;
  sequenceTampered.commandLog[0].revisionAfter = 88;
  await store.put(sequenceTampered);
  const sequenceVerification = await game.verifyReplay(owner, initial.id);
  assert.equal(sequenceVerification.ok, false);
  assert.equal(sequenceVerification.checks[0].sequenceMatches, false);
  assert.equal(sequenceVerification.checks[0].revisionMatches, false);
});

test("opening cast remains present when square arrival crosses an NPC life tick", async () => {
  const { game } = service();
  const runner = commandRunner(game, await game.create(owner, { playerName: "境界旅人", seed: "tick-cross-a" }));
  const choose = async (actionId) => {
    const choice = runner.save.choices.find((entry) => entry.actionId === actionId);
    assert.ok(choice, `${actionId} must be available at the boundary setup`);
    await runner.run("CHOOSE", { choiceId: choice.choiceId });
  };

  for (const actionId of [
    "TUTORIAL:AWAKEN:GROUND",
    "TUTORIAL:CONTACT:WHERE",
    "TUTORIAL:ORIENT:FOUND",
    "WORK",
    "OBSERVE",
    "OBSERVE",
  ]) await choose(actionId);
  assert.equal(runner.save.clock.absoluteMinute, 229);

  const square = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_SQUARE");
  assert.ok(square);
  await runner.run("MOVE", { moveId: square.moveId });
  assert.equal(runner.save.clock.absoluteMinute, 240);
  const presentIds = new Set(runner.save.scene.presentNpcs.map((npc) => npc.id));
  assert.ok(presentIds.size > 0);
  assert.ok(runner.save.choices.every((choice) => !choice.targetNpcId || presentIds.has(choice.targetNpcId)));
  assert.deepEqual(runner.save.choices.map((choice) => choice.actionId), [
    "TUTORIAL:INQUIRY:GARO",
    "TUTORIAL:INQUIRY:MIRA",
    "TUTORIAL:INQUIRY:COBY",
  ]);
  assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
});

test("an opening inquiry crossing Finn's rescue deadline becomes aftermath instead of stale progress", () => {
  const { game } = service();
  const runtime = createGameRuntime(game.data, {
    seed: "opening-deadline-cross",
    profileId: "balanced",
    playerName: "遅い聞き手",
    tutorial: true,
  });
  runtime.tutorial.stage = "mission_intro";
  runtime.playerState.player.facilityId = "LOC_FARM_SQUARE";
  runtime.playerState.absoluteMinute = 2151;
  Object.assign(runtime.playerState, clockFromMinute(2151));
  runtime.playerState.troubles.T01.status = "active";
  runtime.playerState.missions["MSN-T01"].status = "active";

  const result = executeGameRuntimeCommand(runtime, game.data, {
    type: "CHOOSE",
    payload: { choiceId: "CHOICE-1" },
  });

  assert.equal(result.outcome.ok, false);
  assert.equal(result.outcome.committed, true);
  assert.equal(result.outcome.reason, "mission_expired");
  assert.equal(runtime.playerState.troubles.T01.status, "failed");
  assert.equal(runtime.tutorial.stage, "aftermath_intro");
  assert.equal(runtime.tutorial.inquirySource, null);
  assert.deepEqual([...runtime.tutorial.openingFacts], []);
  assert.equal(runtime.livingWorld.npcStates.NPC001.lifeStatus, "dead");
});

test("each opening inquiry records only its authoritative clue and survives replay", async () => {
  const branches = [
    { inquiry: "TUTORIAL:INQUIRY:GARO", factId: "T01_SEARCH_BOUNDARY", evidence: 1 },
    { inquiry: "TUTORIAL:INQUIRY:MIRA", factId: "T01_FINN_MAP", evidence: 1 },
    { inquiry: "TUTORIAL:INQUIRY:COBY", factId: "T01_LOOKOUT_CLUE", evidence: 2 },
  ];
  const authoritativeOutcomes = [];

  for (const branch of branches) {
    const { game, store } = service();
    const runner = commandRunner(game, await game.create(owner, {
      playerName: "clue-tester",
      seed: `opening-clue-${branch.factId}`,
    }));
    await completeOpening(runner, { inquiry: branch.inquiry });

    const record = await store.get(runner.save.id);
    const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
    assert.equal(runtime.tutorial.inquirySource, branch.inquiry);
    assert.deepEqual([...runtime.tutorial.openingFacts], [branch.factId]);
    assert.equal(runtime.playerState.player.evidenceByTrouble.T01, branch.evidence);

    const mission = runner.save.missions.find((entry) => entry.id === "MSN-T01");
    assert.ok(mission, "hearing an opening clue must reveal T01 to the player");
    assert.deepEqual(mission.knownClues.map((clue) => clue.id), [branch.factId]);
    assert.equal(typeof mission.knownClues[0].text, "string");
    assert.ok(mission.knownClues[0].text.trim().length > 0);

    authoritativeOutcomes.push(JSON.stringify({
      inquirySource: runtime.tutorial.inquirySource,
      facts: [...runtime.tutorial.openingFacts],
      knownClues: mission.knownClues,
      evidence: runtime.playerState.player.evidenceByTrouble.T01,
    }));
    assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
  }

  assert.equal(new Set(authoritativeOutcomes).size, branches.length);
});

test("a late arrival sees T01 aftermath instead of stale Day1 inquiry and can finish onboarding", async () => {
  const { game, store } = service();
  const runner = commandRunner(game, await game.create(owner, { playerName: "late-arrival", seed: "late-t01-opening" }));
  const choose = async (actionId) => {
    const choice = runner.save.choices.find((entry) => entry.actionId === actionId);
    assert.ok(choice, `${actionId} must be available`);
    await runner.run("CHOOSE", { choiceId: choice.choiceId });
  };

  await choose("TUTORIAL:AWAKEN:BODY");
  await choose("TUTORIAL:CONTACT:MEMORY");
  await choose("TUTORIAL:ORIENT:HELP");

  // The player can legitimately ignore the recommended destination while the world clock keeps moving.
  while (runner.save.clock.day < 4) {
    const longestSafeChoice = [...runner.save.choices]
      .filter((choice) => !choice.danger && !choice.actionId.startsWith("TUTORIAL:INQUIRY:"))
      .sort((left, right) => right.minutes - left.minutes)[0];
    assert.ok(longestSafeChoice, "onboarding must retain a non-combat way to spend time");
    await runner.run("CHOOSE", { choiceId: longestSafeChoice.choiceId });
  }

  let record = await store.get(runner.save.id);
  let runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  assert.equal(runtime.playerState.troubles.T01.status, "failed");
  assert.equal(runtime.livingWorld.npcStates.NPC001.lifeStatus, "dead");

  const square = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_SQUARE");
  assert.ok(square);
  await runner.run("MOVE", { moveId: square.moveId });
  assert.equal(runner.save.choices.some((choice) => choice.actionId.startsWith("TUTORIAL:INQUIRY:")), false);
  assert.equal(runner.save.tutorial.id, "trouble-aftermath");
  const aftermath = runner.save.choices.find((choice) => choice.actionId === "TUTORIAL:AFTERMATH:T01");
  assert.ok(aftermath, "late arrivals need an authored way to learn what happened");
  await runner.run("CHOOSE", { choiceId: aftermath.choiceId });

  record = await store.get(runner.save.id);
  runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  assert.equal(runtime.tutorial.stage, "free");
  assert.equal(runner.save.choices.some((choice) => choice.actionId.startsWith("TUTORIAL:INQUIRY:")), false);
  assert.equal(runner.save.missions.find((mission) => mission.id === "MSN-T01")?.status, "failed");
  assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
});

test("public game view does not expose omniscient population or trouble aggregates", async () => {
  const { game } = service();
  const save = await game.create(owner, { playerName: "limited-view", seed: "no-omniscient-world-summary" });
  assert.ok(save.world);
  assert.equal("population" in save.world, false);
  assert.equal("troubleCounts" in save.world, false);
  assert.equal(save.world.dayLimit, 100);
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

test("a save with an obsolete schema is rejected before hydration", async () => {
  const { game, store } = service();
  const save = await game.create(owner, { seed: "obsolete-schema-read" });
  const record = await store.get(save.id);
  record.schemaVersion = "0.0.0-obsolete";
  await store.put(record);
  await assert.rejects(
    () => game.get(owner, save.id),
    (error) => error.code === "save_content_version_mismatch"
      && error.status === 409
      && error.details?.saveSchemaVersion === "0.0.0-obsolete",
  );
});

test("shop stock is facility-scoped and a duplicate command cannot advance a save twice", async () => {
  const { game, store } = service();
  const initial = await game.create(owner, { playerName: "商人", profileId: "merchant", seed: "shop-contract" });
  const runner = commandRunner(game, initial);
  await completeOpening(runner);
  assert.equal(runner.save.scene.facilityId, "LOC_FARM_SQUARE");
  assert.ok(runner.save.shop.stock.length > 0);
  assert.ok(runner.save.shop.stock.every((stock) => stock.sellerId === "LOC_FARM_SQUARE"));
  assert.ok(runner.save.shop.saleQuotes.some((quote) => Number.isFinite(quote.price)));
  const unlimitedStockId = runner.save.shop.stock[0].stockId;
  const unlimitedRecord = await store.get(runner.save.id);
  const unlimitedRuntime = deserializeRuntime(unlimitedRecord.runtimeSnapshot, game.data);
  unlimitedRuntime.playerState.shop.quantities[unlimitedStockId] = Infinity;
  const unlimitedView = buildGameView(unlimitedRecord, unlimitedRuntime, game.data);
  assert.deepEqual(
    unlimitedView.shop.stock.find((stock) => stock.stockId === unlimitedStockId),
    { ...runner.save.shop.stock[0], quantity: null, unlimited: true },
  );
  const inn = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_INN");
  const first = await runner.run("MOVE", { moveId: inn.moveId, ignored: "x".repeat(20_000) }, "same-command");
  const revision = first.save.revision;
  const duplicate = await game.command(owner, first.save.id, {
    commandId: "same-command",
    expectedRevision: 0,
    type: "MOVE",
    payload: { moveId: inn.moveId },
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.save.revision, revision);
  assert.deepEqual((await store.get(first.save.id)).commandLog.at(-1).payload, { moveId: inn.moveId });
  await assert.rejects(() => game.command(owner, first.save.id, {
    commandId: "same-command",
    expectedRevision: revision,
    type: "TUTORIAL_ACK",
    payload: { tutorialId: "mission-log" },
  }), (error) => error.code === "command_id_conflict" && error.status === 409);
});

test("world-originated rumor spread does not grant player levels during an ordinary job", async () => {
  const { game } = service();
  const initial = await game.create(owner, { playerName: "働き手", profileId: "story", seed: "balance-contract" });
  const runner = commandRunner(game, initial);
  await completeOpening(runner);
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
  await completeOpening(runner);
  const forest = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FOREST_EDGE");
  assert.ok(forest);
  await runner.run("MOVE", { moveId: forest.moveId });
  assert.equal(runner.save.missions.some((mission) => mission.id === "MSN-T13"), false);
  const hearLocal = runner.save.choices.find((choice) => choice.type === "observe");
  assert.ok(hearLocal);
  const response = await runner.run("CHOOSE", { choiceId: hearLocal.choiceId });
  assert.equal(response.save.scene.lastOutcome.learnedRumorCount, 1);
  assert.equal(runner.save.missions.some((mission) => mission.id === "MSN-T13"), true);
  const endConversation = runner.save.choices.find((choice) => choice.actionId.endsWith(":END"));
  if (endConversation) await runner.run("CHOOSE", { choiceId: endConversation.choiceId });
  assert.equal(runner.save.choices.some((choice) => choice.actionId.includes("MSN-T13")), true);
});

test("conversation reveals only beliefs held by the NPC who is actually speaking", () => {
  const { game } = service();
  const runtime = createGameRuntime(game.data, {
    seed: "npc-rumor-provenance",
    profileId: "balanced",
    playerName: "聞き分ける旅人",
  });
  const eda = runtime.livingWorld.npcStates.NPC004;
  const ownBelief = {
    factId: "TEST-EDA-KNOWS",
    kind: "fact",
    text: "エダだけが知る畑の出来事",
    importance: 0.9,
    confidence: 1,
    learnedAt: 0,
    secret: false,
  };
  const foreignBelief = {
    factId: "TEST-SOMEONE-ELSE-KNOWS",
    kind: "fact",
    text: "別の人物だけが知る出来事",
    importance: 1,
    confidence: 1,
    learnedAt: 0,
    secret: false,
  };
  eda.beliefs[ownBelief.factId] = ownBelief;
  runtime.livingWorld.facilityRumors.LOC_FARM_FIELD.set(foreignBelief.factId, { belief: foreignBelief });
  const talk = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.type === "conversation" && action.targetNpcId === "NPC004");
  assert.ok(talk);

  const result = executeGameRuntimeCommand(runtime, game.data, {
    type: "CHOOSE",
    payload: { choiceId: talk.choiceId },
  });

  assert.equal(result.outcome.learnedRumorCount, 1);
  assert.equal(runtime.playerState.player.knownRumorIds.has("RUM-LIVING-TEST-EDA-KNOWS"), true);
  assert.equal(runtime.playerState.player.knownRumorIds.has("RUM-LIVING-TEST-SOMEONE-ELSE-KNOWS"), false);
  assert.ok(runtime.playerState.history.some((entry) => entry.type === "RUMOR_LEARNED_LOCAL" && entry.sourceNpcId === "NPC004"));
});

test("local observation cannot reveal a facility rumor before its propagation time", () => {
  const { game } = service();
  const runtime = createGameRuntime(game.data, {
    seed: "rumor-propagation-boundary",
    profileId: "balanced",
    playerName: "噂を待つ旅人",
    tutorial: false,
  });
  runtime.playerState.player.location = "田園の村";
  runtime.playerState.player.facilityId = "LOC_FARM_BAKERY";
  const currentHour = runtime.playerState.absoluteMinute / 60;
  const belief = (factId, propagationAt, importance) => ({
    factId,
    kind: "fact",
    text: factId,
    importance,
    confidence: 1,
    learnedAt: currentHour,
    propagationAt,
    secret: false,
  });
  const ready = belief("TEST-RUMOR-READY", currentHour, 0.99);
  const queued = belief("TEST-RUMOR-QUEUED", currentHour + 4, 1);
  const pool = runtime.livingWorld.facilityRumors.LOC_FARM_BAKERY;
  pool.set(ready.factId, { factId: ready.factId, belief: ready, propagationAt: ready.propagationAt });
  pool.set(queued.factId, { factId: queued.factId, belief: queued, propagationAt: queued.propagationAt });
  const observe = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.type === "observe");
  assert.ok(observe);

  executeGameRuntimeCommand(runtime, game.data, {
    type: "CHOOSE",
    payload: { choiceId: observe.choiceId },
  });

  assert.equal(runtime.playerState.player.knownRumorIds.has("RUM-LIVING-TEST-RUMOR-READY"), true);
  assert.equal(runtime.playerState.player.knownRumorIds.has("RUM-LIVING-TEST-RUMOR-QUEUED"), false);
});

test("manual skill acquisition spends SP once and survives deterministic replay", async () => {
  const { game } = service();
  const initial = await game.create(owner, { playerName: "学徒", profileId: "balanced", seed: "skill-replay" });
  const runner = commandRunner(game, initial);
  await completeOpening(runner);
  const candidate = runner.save.skills.learnable[0];
  const spBefore = runner.save.player.sp;
  await runner.run("LEARN_SKILL", { skillId: candidate.id });
  assert.equal(runner.save.player.sp, spBefore - candidate.spCost);
  assert.ok(runner.save.skills.learned.some((skill) => skill.id === candidate.id));
  const verification = await game.verifyReplay(owner, runner.save.id);
  assert.equal(verification.ok, true);
  assert.ok(verification.checks.every((entry) => entry.beforeMatches && entry.actionMatches && entry.afterMatches));
});

test("acknowledging the skill primer without learning a skill never unlocks deliberate battle choices", async () => {
  const { game } = service();
  const runner = commandRunner(game, await game.create(owner, { playerName: "unprepared", seed: "skill-ack-is-not-training" }));
  await completeOpening(runner);
  await runner.run("TUTORIAL_ACK", { tutorialId: "mission-log" });
  const edge = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_EDGE");
  assert.ok(edge);
  await runner.run("MOVE", { moveId: edge.moveId });
  assert.equal(runner.save.tutorial.id, "skills");
  assert.equal(runner.save.skills.learned.length, 0);
  await runner.run("TUTORIAL_ACK", { tutorialId: "skills" });

  const assertNoDeliberateBattle = () => {
    assert.equal(runner.save.skills.learned.length, 0);
    assert.equal(runner.save.choices.some((choice) => choice.danger), false);
    assert.equal(runner.save.choices.some((choice) => ["missionBattle", "seekBattle"].includes(choice.type)), false);
  };
  assertNoDeliberateBattle();

  // Investigation may uncover the encounter, but the resolver must not offer a deliberate fight until a skill is learned.
  for (let searchCount = 0; searchCount < 2; searchCount += 1) {
    const search = runner.save.choices.find((choice) => choice.actionId === "ACTION:MSN-T01:search");
    assert.ok(search, "the non-combat investigation path must remain available");
    await runner.run("CHOOSE", { choiceId: search.choiceId });
    assertNoDeliberateBattle();
  }
  assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
});

test("T01 can be played from inquiry through battle and rescue without ever speaking as missing Finn", async () => {
  const narrativeInputs = [];
  const narrator = {
    async generate(input) {
      narrativeInputs.push(input);
      return { narrative: "選んだ行動の結果が反映された。", speeches: [], choices: [], proposals: [], meta: { source: "test" } };
    },
  };
  const { game, store } = service(true, { narrator });
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

  await completeOpening(runner);
  await runner.run("TUTORIAL_ACK", { tutorialId: "mission-log" });
  await moveTo("LOC_FARM_EDGE");
  assert.equal(runner.save.tutorial.id, "skills");
  await runner.run("LEARN_SKILL", { skillId: runner.save.skills.learnable[0].id });
  await chooseAction("ACTION:MSN-T01:search");
  await chooseAction("ACTION:MSN-T01:search");
  await chooseAction("ACTION:MSN-T01:rescue");
  assert.equal(runner.save.scene.lastOutcome.battle.won, true);
  const playback = runner.save.scene.lastOutcome.battle.playback;
  assert.ok(playback, "a real-game battle must expose its deterministic playback");
  assert.equal(playback.encounter.name, game.data.battleData.encounterById.get(playback.encounter.id).name);
  assert.ok(playback.frames.length > 0);
  assert.ok(playback.frames.length <= 96);
  assert.ok(playback.frames.some((frame) => frame.phase === "action"));
  assert.ok(playback.combatants.some((actor) => actor.side === "player"));
  for (const enemy of playback.combatants.filter((actor) => actor.side === "enemy")) {
    assert.equal(enemy.name, game.data.battleData.monsterById.get(enemy.actorId).name);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(playback), "utf8") <= 64 * 1024);
  const battleRecord = await store.get(runner.save.id);
  const battleJournal = battleRecord.commandLog.findLast((entry) => entry.outcome?.battle);
  const battleNarrativeInput = narrativeInputs.findLast((input) => input.authoritativeOutcome?.battle);
  assert.ok(battleRecord.lastOutcome?.battle?.playback, "latest presentation keeps playback");
  assert.equal(battleJournal.outcome.battle.playback, undefined, "replay journal stays compatible with v4 outcomes");
  assert.ok(battleNarrativeInput, "battle outcome reaches the narrator");
  assert.equal(battleNarrativeInput.authoritativeOutcome.battle.playback, undefined, "playback is excluded from Gemini input");
  assert.equal(battleNarrativeInput.authoritativeState.authoritativeOutcome.battle.playback, undefined);
  assert.equal(runner.save.tutorial?.complete, true, "the combat coach does not return after a battle was experienced");
  assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
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

test("playable profile input is ignored and tutorial acknowledgement is journaled without time passing", async () => {
  const left = service();
  const right = service();
  const a = await left.game.create(owner, { playerName: "自由", profileId: "fighter", seed: "neutral-profile" });
  const b = await right.game.create(owner, { playerName: "自由", profileId: "merchant", seed: "neutral-profile" });
  assert.equal(a.stateHash, b.stateHash);
  assert.deepEqual(a.choices.map((choice) => choice.actionId), b.choices.map((choice) => choice.actionId));

  const runner = commandRunner(left.game, a);
  await completeOpening(runner);
  const before = runner.save.clock.absoluteMinute;
  assert.equal(runner.save.tutorial.id, "mission-log");
  await runner.run("TUTORIAL_ACK", { tutorialId: "mission-log" });
  assert.equal(runner.save.clock.absoluteMinute, before);
  assert.notEqual(runner.save.tutorial.id, "mission-log");
  assert.equal((await left.game.verifyReplay(owner, runner.save.id)).ok, true);
});

test("ordinary NPC conversation offers one meaningful follow-up and passes the resolved action to narration", async () => {
  const inputs = [];
  const narrator = {
    async generate(input) {
      inputs.push(input);
      return { narrative: "会話が続いた。", speeches: [], choices: [], proposals: [], meta: { source: "test" } };
    },
  };
  const { game } = service(true, { narrator });
  const runner = commandRunner(game, await game.create(owner, { playerName: "話し手", seed: "dialogue-followup" }));
  await completeOpening(runner);
  const talk = runner.save.choices.find((choice) => choice.type === "conversation" && !choice.missionId);
  assert.ok(talk, "a local NPC conversation must be available after the opening");
  await runner.run("CHOOSE", { choiceId: talk.choiceId });
  assert.equal(runner.save.choices.length, 3);
  assert.ok(runner.save.choices.every((choice) => choice.actionId.startsWith(`DIALOGUE:${talk.targetNpcId}:`)));
  assert.equal(inputs.at(-1).action.id, talk.actionId);
  assert.equal(inputs.at(-1).action.targetNpcId, talk.targetNpcId);
  const rumorFollowup = runner.save.choices.find((choice) => choice.actionId.endsWith(":RUMOR"));
  await runner.run("CHOOSE", { choiceId: rumorFollowup.choiceId });
  assert.equal(runner.save.choices.some((choice) => choice.actionId.startsWith(`DIALOGUE:${talk.targetNpcId}:`)), false);
  assert.equal(inputs.at(-1).action.dialogueTopic, "local_rumor");
  assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
});

test("an unanswered dialogue follow-up expires instead of resurfacing hours later", async () => {
  const { game, store } = service();
  const runner = commandRunner(game, await game.create(owner, { playerName: "slow-reply", seed: "dialogue-expiry" }));
  await completeOpening(runner);
  const talk = runner.save.choices.find((choice) => choice.type === "conversation" && !choice.missionId);
  assert.ok(talk);
  await runner.run("CHOOSE", { choiceId: talk.choiceId });
  assert.ok(runner.save.choices.every((choice) => choice.actionId.startsWith(`DIALOGUE:${talk.targetNpcId}:`)));

  const record = await store.get(runner.save.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  assert.equal(runtime.dialogueSession.npcId, talk.targetNpcId);
  runtime.playerState.absoluteMinute += 180;
  const hoursLater = buildGameView(record, runtime, game.data);
  assert.equal(hoursLater.choices.some((choice) => choice.actionId.startsWith(`DIALOGUE:${talk.targetNpcId}:`)), false);
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
