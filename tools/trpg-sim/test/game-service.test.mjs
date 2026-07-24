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
  TRPG_GAME_RESOLVER_VERSION,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";
import { AUTHORED_MISSION_FLOW_PACKS } from "../../../src/server/trpg/content/authored-mission-flow-registry.js";
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

function commandRunner(game, initial, commandPrefix = "command") {
  let save = initial;
  let sequence = 0;
  return {
    get save() { return save; },
    async run(type, payload, commandId = `${commandPrefix}-${++sequence}`) {
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

async function acknowledgeVisibleIntroduction(runner) {
  const beat = runner.save.scene.beats.find((entry) => entry.introductionToken);
  if (!beat) return false;
  await runner.run("ACK_NPC_INTRODUCTION", { token: beat.introductionToken });
  return true;
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
  await acknowledgeVisibleIntroduction(runner);
  await choose(orientation);
  const square = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_SQUARE");
  assert.ok(square, "the movement tutorial must point to the village square");
  await runner.run("MOVE", { moveId: square.moveId });
  await choose(inquiry);
  await acknowledgeVisibleIntroduction(runner);
  return runner.save;
}

function runtimeView(runtime, data) {
  return buildGameView({
    id: "runtime-test",
    schemaVersion: "test",
    contentRevision: data.contentRevision,
    revision: 0,
    stateHash: gameStateHash(runtime, data),
    playerName: runtime.playerState.player.displayName ?? "テスト旅人",
    presentation: null,
    lastOutcome: null,
  }, runtime, data);
}

function prepareMissionClueConversation(runtime, npcId = "NPC003") {
  const state = runtime.playerState;
  runtime.tutorial = null;
  runtime.lastWorldTickMinute = 0;
  state.player.location = "田園の村";
  state.player.facilityId = "LOC_FARM_SQUARE";
  state.troubles.T02.status = "active";
  state.missions["MSN-T02"].status = "active";
  state.missions["MSN-T02"].progress.hear = 0;
  const knownRumor = {
    id: "TEST-T02-KNOWN",
    troubleId: "T02",
    text: "共同穀倉に火の気があるという噂",
    origin: "田園の村",
    originMinute: 0,
    importance: 1,
    recipients: {},
  };
  state.rumors.push(knownRumor);
  state.rumorById[knownRumor.id] = knownRumor;
  state.player.knownRumorIds.add(knownRumor.id);
  for (const npcState of Object.values(runtime.livingWorld.npcStates)) {
    for (const [factId, belief] of Object.entries(npcState.beliefs ?? {})) {
      const troubleId = belief.troubleId ?? belief.troubleIds?.[0] ?? String(belief.text ?? "").match(/^(T\d{2})[_・\s-]/u)?.[1];
      if (troubleId === "T02") delete npcState.beliefs[factId];
    }
  }
  const npcState = runtime.livingWorld.npcStates[npcId];
  npcState.lifeStatus = "alive";
  npcState.presence = "present";
  npcState.location = "田園の村";
  npcState.position = { hubId: "田園の村", facilityId: "LOC_FARM_SQUARE" };
  npcState.travel = null;
  npcState.localTravel = null;
  npcState.beliefs = {
    ...npcState.beliefs,
    "TEST-T02-CLUE": {
      factId: "TEST-T02-CLUE",
      kind: "fact",
      text: "T02_穀倉放火",
      troubleIds: ["T02"],
      importance: 1,
      learnedAt: 0,
      secret: false,
      sourceType: "sheet",
      hopCount: 0,
      path: [npcId],
    },
  };
  return npcState;
}

function preferredBattleCommand(battle) {
  const available = battle.commands.filter((command) => command.available !== false);
  return available.find((command) => command.kind === "skill")
    ?? available.find((command) => command.kind === "attack")
    ?? available.find((command) => command.kind === "defend")
    ?? available.find((command) => command.kind === "flee");
}

function battlePayload(battle, command) {
  const target = command.targets?.find((entry) => entry.side === "enemy") ?? command.targets?.[0];
  return {
    battleId: battle.id,
    actionId: command.actionId,
    ...(target ? { targetInstanceId: target.instanceId } : {}),
  };
}

function finishRuntimeBattle(runtime, data) {
  const rounds = [];
  let finalResult = null;
  for (let guard = 0; guard < 120; guard += 1) {
    const battle = runtimeView(runtime, data).battle;
    if (!battle) break;
    const action = preferredBattleCommand(battle);
    assert.ok(action, `round ${battle.round} must expose an available player command`);
    finalResult = executeGameRuntimeCommand(runtime, data, {
      type: "BATTLE_ACT",
      payload: battlePayload(battle, action),
    });
    rounds.push(finalResult);
  }
  assert.equal(runtime.pendingBattle, null, "interactive battle must finish within its turn limit");
  assert.ok(finalResult?.outcome?.battle, "the final battle command must settle the encounter");
  return { rounds, finalResult };
}

async function finishRunnerBattle(runner) {
  const rounds = [];
  let finalResponse = null;
  for (let guard = 0; guard < 120; guard += 1) {
    const battle = runner.save.battle;
    if (!battle) break;
    const action = preferredBattleCommand(battle);
    assert.ok(action, `round ${battle.round} must expose an available player command`);
    finalResponse = await runner.run("BATTLE_ACT", battlePayload(battle, action));
    rounds.push(finalResponse);
  }
  assert.equal(runner.save.battle, null, "interactive battle must finish within its turn limit");
  assert.ok(finalResponse?.save?.scene?.lastOutcome?.battle, "the final battle command must settle the encounter");
  return { rounds, finalResponse };
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
  runtime.playerKnowledge.knownHubIds.add("黒嶺連合領");
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

test("interactive real-game battle capture is deterministic and leaves runtime tuning unchanged", () => {
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
  assert.equal(firstResult.outcome.battlePending, true);
  assert.equal(secondResult.outcome.battlePending, true);
  assert.deepEqual(runtimeView(first, game.data).battle, runtimeView(second, game.data).battle);

  const firstResolution = finishRuntimeBattle(first, game.data);
  const secondResolution = finishRuntimeBattle(second, game.data);
  assert.equal(firstResolution.rounds.length, secondResolution.rounds.length);
  assert.deepEqual(
    firstResolution.rounds.map((entry) => entry.outcome),
    secondResolution.rounds.map((entry) => entry.outcome),
  );
  const { playback: firstPlayback, ...firstBattle } = firstResolution.finalResult.outcome.battle;
  const { playback: secondPlayback, ...secondBattle } = secondResolution.finalResult.outcome.battle;

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
  assert.equal(runner.save.scene.facilityType, "農地");
  assert.match(runner.save.scene.publicDescription, /麦畑/u);
  assert.doesNotMatch(JSON.stringify(runner.save.scene), /農地\/開始地点|召喚開始地点|Day1召喚|T13水不足|プレイヤー初期地点/u);
  const startMinute = runner.save.clock.absoluteMinute;
  await runner.run("CHOOSE", { choiceId: runner.save.choices.find((choice) => choice.actionId === "TUTORIAL:AWAKEN:GROUND").choiceId });
  const unknownEda = runner.save.scene.presentNpcs.find((npc) => npc.id === "NPC004");
  assert.equal(unknownEda?.name, "見知らぬ女性");
  assert.equal(unknownEda?.identified, false);
  assert.doesNotMatch(runner.save.choices.map((choice) => choice.label).join("\n"), /エダ/u);
  assert.equal(runner.save.tutorial.id, "first-conversation");
  assert.equal(runner.save.clock.absoluteMinute, startMinute + 6);
  assert.equal(runner.save.missions.length, 0);
  await runner.run("CHOOSE", { choiceId: runner.save.choices.find((choice) => choice.actionId === "TUTORIAL:CONTACT:WHO").choiceId });
  const edaIntroduction = runner.save.scene.beats.find((beat) => beat.kind === "npc" && beat.actorId === "NPC004");
  assert.equal(edaIntroduction?.speakerLabel, "見知らぬ女性");
  assert.match(edaIntroduction?.text ?? "", /エダ/u);
  assert.equal(typeof edaIntroduction?.introductionToken, "string");
  assert.equal(runner.save.scene.presentNpcs.find((npc) => npc.id === "NPC004")?.identified, false);
  await acknowledgeVisibleIntroduction(runner);
  assert.equal(runner.save.scene.presentNpcs.find((npc) => npc.id === "NPC004")?.identified, true);
  await runner.run("CHOOSE", { choiceId: runner.save.choices.find((choice) => choice.actionId === "TUTORIAL:ORIENT:FOUND").choiceId });
  assert.equal(runner.save.tutorial.id, "first-movement");
  assert.deepEqual(runner.save.tutorial.unlocked, {
    choices: false,
    movement: true,
    missions: false,
    shop: false,
    skills: false,
    battle: false,
  });
  assert.deepEqual(runner.save.choices, []);
  assert.equal(runner.save.movement.length, 1);
  assert.ok(runner.save.movement.every((move) => move.scope === "local"));
  assert.equal(runner.save.movement.some((move) => move.recommended && move.destinationFacilityId === "LOC_FARM_SQUARE"), true);
  const square = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_SQUARE");
  await runner.run("MOVE", { moveId: square.moveId });
  assert.equal(runner.save.tutorial.id, "discover-trouble");
  assert.equal(runner.save.missions.length, 0);
  assert.deepEqual(Object.fromEntries(runner.save.scene.presentNpcs
    .filter((npc) => ["NPC002", "NPC003", "NPC062"].includes(npc.id))
    .map((npc) => [npc.id, { name: npc.name, identified: npc.identified }])), {
    NPC002: { name: "取り乱した女性", identified: false },
    NPC003: { name: "年配の村人", identified: false },
    NPC062: { name: "落ち着かない少年", identified: false },
  });
  assert.doesNotMatch(runner.save.choices.map((choice) => choice.label).join("\n"), /ガロ|ミラ|コビー/u);
  assert.deepEqual(runner.save.choices.map((choice) => choice.actionId), [
    "TUTORIAL:INQUIRY:MIRA",
    "TUTORIAL:DEFER:WORK",
    "TUTORIAL:DEFER:LEAVE",
  ]);
  await runner.run("CHOOSE", { choiceId: runner.save.choices.find((choice) => choice.actionId === "TUTORIAL:INQUIRY:MIRA").choiceId });
  const miraIntroduction = runner.save.scene.beats.find((beat) => beat.kind === "npc" && beat.actorId === "NPC002");
  assert.equal(miraIntroduction?.speakerLabel, "取り乱した女性");
  assert.match(miraIntroduction?.text ?? "", /ミラ/u);
  assert.equal(runner.save.scene.presentNpcs.find((npc) => npc.id === "NPC002")?.identified, false);
  await acknowledgeVisibleIntroduction(runner);
  assert.equal(runner.save.scene.presentNpcs.find((npc) => npc.id === "NPC002")?.identified, true);
  assert.equal(runner.save.scene.presentNpcs.find((npc) => npc.id === "NPC003")?.identified, false);
  assert.equal(runner.save.scene.presentNpcs.find((npc) => npc.id === "NPC062")?.identified, false);
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

test("an unknown NPC becomes identified only after the visible self-introduction is acknowledged", async () => {
  const { game, store } = service();
  const runner = commandRunner(game, await game.create(owner, {
    playerName: "名前を聞く旅人",
    seed: "introduction-ack-boundary",
  }));
  await runner.run("CHOOSE", {
    choiceId: runner.save.choices.find((choice) => choice.actionId === "TUTORIAL:AWAKEN:LISTEN").choiceId,
  });
  await runner.run("CHOOSE", {
    choiceId: runner.save.choices.find((choice) => choice.actionId === "TUTORIAL:CONTACT:WHO").choiceId,
  });
  const introduction = runner.save.scene.beats.find((beat) => beat.actorId === "NPC004" && beat.introductionToken);
  assert.ok(introduction?.introductionToken);
  assert.equal(introduction.speakerLabel, "見知らぬ女性");
  assert.match(introduction.text, /エダ/u);
  assert.equal(runner.save.scene.presentNpcs.find((npc) => npc.id === "NPC004")?.identified, false);
  assert.doesNotMatch(runner.save.scene.lastOutcome.summary, /エダ/u);
  assert.doesNotMatch(runner.save.choices.map((choice) => choice.label).join("\n"), /エダ/u);

  const beforeMinute = runner.save.clock.absoluteMinute;
  const token = introduction.introductionToken;
  const commandId = `ack-introduction-${token.slice(0, 20)}`;
  const acknowledged = await runner.run("ACK_NPC_INTRODUCTION", { token }, commandId);
  assert.equal(acknowledged.save.clock.absoluteMinute, beforeMinute);
  assert.equal(runner.save.scene.presentNpcs.find((npc) => npc.id === "NPC004")?.identified, true);
  assert.equal(runner.save.scene.presentNpcs.find((npc) => npc.id === "NPC004")?.name, "エダ");

  const duplicate = await game.command(owner, runner.save.id, {
    commandId,
    expectedRevision: runner.save.revision,
    type: "ACK_NPC_INTRODUCTION",
    payload: { token },
  });
  assert.equal(duplicate.duplicate, true);
  await assert.rejects(() => game.command(owner, runner.save.id, {
    commandId: "stale-introduction-token",
    expectedRevision: runner.save.revision,
    type: "ACK_NPC_INTRODUCTION",
    payload: { token: `${token}-stale` },
  }), (error) => error?.code === "npc_introduction_not_available");

  const record = await store.get(runner.save.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  assert.equal(runtime.playerKnowledge.knownNpcIds.has("NPC004"), true);
  assert.equal(runtime.pendingNpcIntroduction, null);
  assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
});

test("an introduction token cannot identify an NPC after that NPC leaves the scene", () => {
  const { game } = service();
  const runtime = createGameRuntime(game.data, {
    seed: "introduction-target-left",
    profileId: "balanced",
    playerName: "待ち人",
    tutorial: false,
  });
  const talk = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.type === "conversation" && action.targetNpcId === "NPC004");
  executeGameRuntimeCommand(runtime, game.data, { type: "CHOOSE", payload: { choiceId: talk.choiceId } });
  const token = runtime.pendingNpcIntroduction?.token;
  assert.ok(token);
  const eda = runtime.livingWorld.npcStates.NPC004;
  eda.presence = "traveling";
  eda.position = { hubId: "田園の村", facilityId: "LOC_FARM_WELL" };
  assert.throws(() => executeGameRuntimeCommand(runtime, game.data, {
    type: "ACK_NPC_INTRODUCTION",
    payload: { token },
  }), (error) => error?.code === "npc_introduction_not_available");
  assert.equal(runtime.playerKnowledge.knownNpcIds.has("NPC004"), false);
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

test("opening cast remains present when guided square arrival crosses an NPC life tick", () => {
  const { game } = service();
  const runtime = createGameRuntime(game.data, {
    seed: "tick-cross-a",
    profileId: "balanced",
    playerName: "境界旅人",
    tutorial: true,
  });
  runtime.tutorial.stage = "movement";
  runtime.playerKnowledge.knownFacilityIds.add("LOC_FARM_SQUARE");
  runtime.playerState.absoluteMinute = 229;
  Object.assign(runtime.playerState, clockFromMinute(229));
  assert.deepEqual(availableGameRuntimeActions(runtime, game.data).choices, []);

  const square = availableGameRuntimeActions(runtime, game.data).movement
    .find((move) => move.destinationFacilityId === "LOC_FARM_SQUARE");
  assert.ok(square);
  executeGameRuntimeCommand(runtime, game.data, { type: "MOVE", payload: { moveId: square.id } });
  const view = runtimeView(runtime, game.data);
  assert.equal(view.clock.absoluteMinute, 240);
  const presentIds = new Set(view.scene.presentNpcs.map((npc) => npc.id));
  assert.ok(presentIds.size > 0);
  assert.ok(view.choices.every((choice) => !choice.targetNpcId || presentIds.has(choice.targetNpcId)));
  assert.deepEqual(view.choices.map((choice) => choice.actionId), [
    "TUTORIAL:INQUIRY:MIRA",
    "TUTORIAL:DEFER:WORK",
    "TUTORIAL:DEFER:LEAVE",
  ]);
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

test("opening branches preserve help, paid work and leaving as replayable choices", async () => {
  const helpService = service();
  const helpRunner = commandRunner(helpService.game, await helpService.game.create(owner, {
    playerName: "help-branch",
    seed: "opening-help-branch",
  }));
  await completeOpening(helpRunner, { inquiry: "TUTORIAL:INQUIRY:MIRA" });
  const introductionBeat = helpRunner.save.scene.beats.find((beat) => beat.kind === "npc" && beat.actorId === "NPC002");
  assert.equal(introductionBeat?.speakerLabel, "取り乱した女性");
  assert.match(introductionBeat?.text ?? "", /ミラ/u);
  const helpRecord = await helpService.store.get(helpRunner.save.id);
  const helpRuntime = deserializeRuntime(helpRecord.runtimeSnapshot, helpService.game.data);
  assert.equal(helpRuntime.tutorial.inquirySource, "TUTORIAL:INQUIRY:MIRA");
  assert.deepEqual([...helpRuntime.tutorial.openingFacts], ["T01_FINN_MAP"]);
  assert.equal(helpRuntime.playerState.player.evidenceByTrouble.T01, 1);
  const helpMission = helpRunner.save.missions.find((entry) => entry.id === "MSN-T01");
  assert.equal(helpMission.optional, false);
  assert.deepEqual(helpMission.knownClues.map((clue) => clue.id), ["T01_FINN_MAP"]);
  assert.equal((await helpService.game.verifyReplay(owner, helpRunner.save.id)).ok, true);

  const workService = service();
  const workRunner = commandRunner(workService.game, await workService.game.create(owner, {
    playerName: "work-branch",
    seed: "opening-work-branch",
  }));
  await completeOpening(workRunner, { inquiry: "TUTORIAL:DEFER:WORK" });
  assert.equal(workRunner.save.missions.find((entry) => entry.id === "MSN-T01")?.optional, true);
  assert.deepEqual(workRunner.save.choices.map((choice) => choice.actionId.split(":")[0]), [
    "WORK_CONFIRM",
    "WORK_CLARIFY",
    "WORK_DECLINE",
  ]);
  assert.equal((await workService.game.verifyReplay(owner, workRunner.save.id)).ok, true);

  const leaveService = service();
  const leaveRunner = commandRunner(leaveService.game, await leaveService.game.create(owner, {
    playerName: "leave-branch",
    seed: "opening-leave-branch",
  }));
  await completeOpening(leaveRunner, { inquiry: "TUTORIAL:DEFER:LEAVE" });
  assert.equal(leaveRunner.save.missions.find((entry) => entry.id === "MSN-T01")?.optional, true);
  assert.ok(leaveRunner.save.movement.some((move) => move.destinationFacilityId === "LOC_CAP_LOWER_INN"));
  assert.equal((await leaveService.game.verifyReplay(owner, leaveRunner.save.id)).ok, true);
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
  await acknowledgeVisibleIntroduction(runner);
  await choose("TUTORIAL:ORIENT:HELP");

  // The guided movement stage intentionally has no ordinary choices. Recreate a
  // restored save whose clock advanced while it was offline, then resolve the
  // authoritative world catch-up on the next movement command.
  let record = await store.get(runner.save.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  runtime.playerState.absoluteMinute = 3 * 1440;
  Object.assign(runtime.playerState, clockFromMinute(runtime.playerState.absoluteMinute));
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = gameStateHash(runtime, game.data);
  await store.put(record);
  const lateRunner = commandRunner(game, await game.get(owner, runner.save.id), "late-command");
  assert.deepEqual(lateRunner.save.choices, []);

  const square = lateRunner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_SQUARE");
  assert.ok(square);
  await lateRunner.run("MOVE", { moveId: square.moveId });
  assert.equal(lateRunner.save.choices.some((choice) => choice.actionId.startsWith("TUTORIAL:INQUIRY:")), false);
  assert.equal(lateRunner.save.tutorial.id, "trouble-aftermath");
  assert.doesNotMatch(lateRunner.save.choices.map((choice) => choice.label).join("\n"), /ガロ|ミラ|コビー/u);
  const aftermath = lateRunner.save.choices.find((choice) => choice.actionId === "TUTORIAL:AFTERMATH:T01");
  assert.ok(aftermath, "late arrivals need an authored way to learn what happened");
  await lateRunner.run("CHOOSE", { choiceId: aftermath.choiceId });

  record = await store.get(lateRunner.save.id);
  const resolvedRuntime = deserializeRuntime(record.runtimeSnapshot, game.data);
  assert.equal(resolvedRuntime.tutorial.stage, "free");
  assert.equal(resolvedRuntime.playerState.troubles.T01.status, "failed");
  assert.equal(resolvedRuntime.livingWorld.npcStates.NPC001.lifeStatus, "dead");
  assert.equal(lateRunner.save.choices.some((choice) => choice.actionId.startsWith("TUTORIAL:INQUIRY:")), false);
  assert.equal(lateRunner.save.missions.find((mission) => mission.id === "MSN-T01")?.status, "failed");
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

test("unknown save versions are preserved while expired saves alone are pruned", async () => {
  const obsolete = service(true, { maxSavesPerOwner: 1, maxTotalSaves: 2 });
  const old = await obsolete.game.create(owner, { seed: "obsolete-one" });
  const oldRecord = await obsolete.store.get(old.id);
  oldRecord.resolverVersion = "obsolete-resolver";
  await obsolete.store.put(oldRecord);
  assert.ok(await obsolete.game.create(owner, { seed: "obsolete-two" }));
  assert.ok(await obsolete.store.get(old.id), "an unrecognized save is retained for recovery instead of being deleted");

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

test("a v8 save migrates to v9 without losing its world state or future replay", async () => {
  const { game, store } = service();
  const runner = commandRunner(game, await game.create(owner, { playerName: "移行旅人", seed: "v8-to-v9" }));
  await completeOpening(runner);
  const before = await store.get(runner.save.id);
  const revisionBefore = before.revision;
  const v9HashBefore = before.stateHash;
  const legacyRuntime = deserializeRuntime(before.runtimeSnapshot, game.data);
  const v8HashBefore = gameStateHash(legacyRuntime, game.data, "trpg-player-world-v8");
  before.resolverVersion = "trpg-player-world-v8";
  before.stateHash = v8HashBefore;
  before.presentation = {
    ...before.presentation,
    choiceLabels: { "CHOICE-1": "移行前の古い選択肢ラベル" },
    cacheKey: "legacy-v8-cache-key",
  };
  await store.put(before);

  assert.ok((await game.list(owner)).some((entry) => entry.id === runner.save.id));
  const resumed = await game.get(owner, runner.save.id);
  const migratedRunner = commandRunner(game, resumed, "migration-command");
  assert.equal(migratedRunner.save.revision, revisionBefore);
  assert.equal(migratedRunner.save.stateHash, v9HashBefore);
  assert.notEqual(migratedRunner.save.stateHash, v8HashBefore);
  const migrated = await store.get(migratedRunner.save.id);
  assert.equal(migrated.resolverVersion, TRPG_GAME_RESOLVER_VERSION);
  assert.equal(migrated.replayBase.revision, revisionBefore);
  assert.equal(migrated.replayBase.resolverVersion, "trpg-player-world-v8");
  assert.equal(migrated.replayBase.stateHash, v8HashBefore);
  assert.equal(migrated.replayBase.runtimeSnapshot, serializeRuntime(legacyRuntime));
  assert.deepEqual(migrated.presentation.choiceLabels, {});
  assert.equal(migrated.presentation.cacheKey, null);
  assert.equal(migratedRunner.save.choices.some((choice) => choice.label === "移行前の古い選択肢ラベル"), false);
  assert.equal(migrated.commandLog.length, before.commandLog.length);

  const choice = migratedRunner.save.choices[0];
  assert.ok(choice?.actionId);
  await migratedRunner.run("CHOOSE", { choiceId: choice.choiceId, actionId: choice.actionId });
  const replay = await game.verifyReplay(owner, migratedRunner.save.id);
  assert.equal(replay.baseMatches, true);
  assert.equal(replay.ok, true);
  assert.equal(replay.revision, migratedRunner.save.revision);
});

test("first-read migration and a concurrent command cannot overwrite one another", async () => {
  const { game, store } = service();
  const runner = commandRunner(game, await game.create(owner, { playerName: "競合確認", seed: "v8-migration-lock" }));
  await completeOpening(runner);
  const before = await store.get(runner.save.id);
  const legacyRuntime = deserializeRuntime(before.runtimeSnapshot, game.data);
  before.resolverVersion = "trpg-player-world-v8";
  before.stateHash = gameStateHash(legacyRuntime, game.data, before.resolverVersion);
  await store.put(before);

  const originalPut = store.put.bind(store);
  let releaseFirstMigration;
  let markFirstMigrationStarted;
  const firstMigrationStarted = new Promise((resolve) => { markFirstMigrationStarted = resolve; });
  const firstMigrationRelease = new Promise((resolve) => { releaseFirstMigration = resolve; });
  let pauseFirstMigration = true;
  store.put = async (record) => {
    if (pauseFirstMigration && record.migratedAt && record.resolverVersion === TRPG_GAME_RESOLVER_VERSION) {
      pauseFirstMigration = false;
      markFirstMigrationStarted();
      await firstMigrationRelease;
    }
    return originalPut(record);
  };

  const firstRead = game.get(owner, runner.save.id);
  await firstMigrationStarted;
  const displayedChoice = runner.save.choices[0];
  assert.ok(displayedChoice?.actionId);
  const concurrentCommand = game.command(owner, runner.save.id, {
    commandId: "migration-concurrent-command",
    expectedRevision: before.revision,
    type: "CHOOSE",
    payload: { choiceId: displayedChoice.choiceId, actionId: displayedChoice.actionId },
  });
  releaseFirstMigration();

  const [migratedView, commandResult] = await Promise.all([firstRead, concurrentCommand]);
  assert.equal(migratedView.revision, before.revision);
  assert.equal(commandResult.save.revision, before.revision + 1);
  const persisted = await store.get(runner.save.id);
  assert.equal(persisted.revision, before.revision + 1);
  assert.equal(persisted.resolverVersion, TRPG_GAME_RESOLVER_VERSION);
  assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
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

test("a conversational job pays the quoted wage without granting player levels", async () => {
  const { game } = service();
  const initial = await game.create(owner, { playerName: "働き手", profileId: "story", seed: "balance-contract" });
  const runner = commandRunner(game, initial);
  await completeOpening(runner, { inquiry: "TUTORIAL:DEFER:WORK" });
  const offer = runner.save.choices.find((choice) => choice.actionId.startsWith("WORK_CONFIRM:"));
  assert.ok(offer);
  const quotedWage = Number(offer.label.match(/(\d+)G/u)?.[1]);
  const goldBefore = runner.save.player.gold;
  await runner.run("CHOOSE", { choiceId: offer.choiceId });
  assert.equal(runner.save.player.level, 1);
  assert.equal(runner.save.player.exp, 0);
  assert.equal(runner.save.player.gold - goldBefore, quotedWage);
  assert.match(runner.save.scene.lastOutcome.summary, new RegExp(`${quotedWage}G`, "u"));
  assert.notEqual(runner.save.missions.find((mission) => mission.id === "MSN-RUMOR-005")?.status, "completed");
});

test("a public living-world rumor becomes a mission only after the player hears it locally", async () => {
  const { game, store } = service();
  const initial = await game.create(owner, { playerName: "聞き手", profileId: "story", seed: "forest-rumor" });
  let runner = commandRunner(game, initial);
  assert.equal(runner.save.missions.some((mission) => mission.id === "MSN-T13"), false);
  await completeOpening(runner);
  const record = await store.get(runner.save.id);
  const runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  runtime.playerKnowledge.knownHubIds.add("森");
  runtime.playerKnowledge.knownFacilityIds.add("LOC_FOREST_EDGE");
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = gameStateHash(runtime, game.data);
  await store.put(record);
  runner = commandRunner(game, await game.get(owner, runner.save.id), "forest-command");
  const forest = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FOREST_EDGE");
  assert.ok(forest);
  await runner.run("MOVE", { moveId: forest.moveId });
  assert.equal(runner.save.missions.some((mission) => mission.id === "MSN-T13"), false);
  const hearLocal = runner.save.choices.find((choice) => choice.type === "localInvestigate");
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
    tutorial: false,
  });
  const eda = runtime.livingWorld.npcStates.NPC004;
  const ownBelief = {
    factId: "TEST-EDA-KNOWS",
    kind: "fact",
    text: "畑で水不足が起きて村人が困っている",
    importance: 0.9,
    confidence: 1,
    learnedAt: 0,
    secret: false,
  };
  const foreignBelief = {
    factId: "TEST-SOMEONE-ELSE-KNOWS",
    kind: "fact",
    text: "別の土地で食料不足が起きている",
    importance: 1,
    confidence: 1,
    learnedAt: 0,
    secret: false,
  };
  eda.beliefs = {};
  eda.beliefs[ownBelief.factId] = ownBelief;
  runtime.livingWorld.facilityRumors.LOC_FARM_FIELD.set(foreignBelief.factId, { belief: foreignBelief });
  const talk = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.type === "conversation" && action.targetNpcId === "NPC004");
  assert.ok(talk);

  const greeting = executeGameRuntimeCommand(runtime, game.data, {
    type: "CHOOSE",
    payload: { choiceId: talk.choiceId },
  });
  assert.equal(greeting.outcome.learnedRumorCount, undefined, "a greeting alone must not grant an unspoken rumor");
  const concern = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.dialogueTopic === "local_concern");
  assert.ok(concern);
  const result = executeGameRuntimeCommand(runtime, game.data, {
    type: "CHOOSE",
    payload: { choiceId: concern.choiceId },
  });

  assert.equal(result.outcome.learnedRumorCount, 1);
  assert.equal(runtime.playerState.player.knownRumorIds.has("RUM-LIVING-TEST-EDA-KNOWS"), true);
  assert.equal(runtime.playerState.player.knownRumorIds.has("RUM-LIVING-TEST-SOMEONE-ELSE-KNOWS"), false);
  assert.ok(runtime.playerState.history.some((entry) => entry.type === "RUMOR_LEARNED_LOCAL" && entry.sourceNpcId === "NPC004"));
});

test("mission clue choices require a co-present NPC with an authoritative public belief", () => {
  const { game } = service();
  const runtime = createGameRuntime(game.data, {
    seed: "mission-clue-authority",
    profileId: "balanced",
    playerName: "聞き手",
    tutorial: false,
  });
  const npcState = prepareMissionClueConversation(runtime);
  const available = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.id === "ACTION:MSN-T02:hear");
  assert.ok(available);
  assert.equal(available.targetNpcId, "NPC003");
  assert.equal(available.dialogueTopic, "mission_clue");
  assert.equal(available.missionBeliefFactId, "TEST-T02-CLUE");

  npcState.presence = "traveling";
  assert.equal(availableGameRuntimeActions(runtime, game.data).choices
    .some((action) => action.id === "ACTION:MSN-T02:hear"), false);
  npcState.presence = "present";
  npcState.beliefs["TEST-T02-CLUE"].secret = true;
  assert.equal(availableGameRuntimeActions(runtime, game.data).choices
    .some((action) => action.id === "ACTION:MSN-T02:hear"), false);
});

test("all generic special-mission hearings are bound to a present authoritative NPC", () => {
  const { game } = service();
  const authoredHearingMissionIds = new Set(AUTHORED_MISSION_FLOW_PACKS.map((pack) => pack.missionId));
  const authoredTroubleIds = new Set(AUTHORED_MISSION_FLOW_PACKS.map((pack) => pack.troubleId));
  const covered = [];
  for (const definitionTemplate of createGameRuntime(game.data, {
    seed: "mission-hearing-catalog",
    profileId: "balanced",
    playerName: "聞き手",
    tutorial: false,
  }).playerState.catalog.special) {
    // Data-driven authored mission flows own their own conversation contract.
    if (authoredHearingMissionIds.has(definitionTemplate.id)) continue;
    const runtime = createGameRuntime(game.data, {
      seed: `mission-hearing-${definitionTemplate.troubleId}`,
      profileId: "balanced",
      playerName: "聞き手",
      tutorial: false,
    });
    const state = runtime.playerState;
    const definition = state.catalog.special.find((entry) => entry.id === definitionTemplate.id);
    const hearing = definition.steps.find((step) => step.type === "conversation");
    for (const other of state.catalog.special) state.missions[other.id].status = "locked";
    state.missions[definition.id].status = "active";
    state.missions[definition.id].progress[hearing.id] = 0;
    state.troubles[definition.troubleId].status = "active";
    state.player.location = hearing.targetLocation;
    state.player.facilityId = hearing.targetFacilityId ?? null;
    runtime.playerKnowledge.knownHubIds.add(hearing.targetLocation);
    if (hearing.targetFacilityId) runtime.playerKnowledge.knownFacilityIds.add(hearing.targetFacilityId);

    const rumor = {
      id: `TEST-${definition.troubleId}-KNOWN`,
      troubleId: definition.troubleId,
      text: `${definition.troubleId}に関係する異変が起きている`,
      origin: hearing.targetLocation,
      originMinute: 0,
      importance: 1,
      recipients: {},
    };
    state.rumors.push(rumor);
    state.rumorById[rumor.id] = rumor;
    state.player.knownRumorIds.add(rumor.id);

    const npcState = runtime.livingWorld.npcStates.NPC003;
    npcState.lifeStatus = "alive";
    npcState.presence = "present";
    npcState.location = hearing.targetLocation;
    npcState.position = { hubId: hearing.targetLocation, facilityId: hearing.targetFacilityId ?? null };
    npcState.travel = null;
    npcState.localTravel = null;
    npcState.beliefs = {
      [`TEST-${definition.troubleId}-CLUE`]: {
        factId: `TEST-${definition.troubleId}-CLUE`,
        kind: "fact",
        text: `${definition.troubleId}_現地で確かめた手掛かり`,
        troubleIds: [definition.troubleId],
        importance: 1,
        learnedAt: 0,
        secret: false,
        sourceType: "test",
        hopCount: 0,
        path: ["NPC003"],
      },
    };

    const action = availableGameRuntimeActions(runtime, game.data).choices
      .find((entry) => entry.id === `ACTION:${definition.id}:${hearing.id}`);
    assert.ok(action, `${definition.id} must expose its hearing only through a present informed NPC`);
    assert.equal(action.targetNpcId, "NPC003");
    assert.equal(action.dialogueTopic, "mission_clue");
    const result = executeGameRuntimeCommand(runtime, game.data, {
      type: "CHOOSE",
      payload: { choiceId: action.choiceId },
    });
    assert.ok((result.resolvedAction.requiredDisclosure ?? "").length > 0);
    assert.equal(state.missions[definition.id].progress[hearing.id], 1);
    covered.push(definition.troubleId);
  }
  assert.deepEqual(
    covered,
    Array.from({ length: 19 }, (_, index) => `T${String(index + 1).padStart(2, "0")}`)
      .filter((troubleId) => !authoredTroubleIds.has(troubleId)),
  );
});

test("mission clue progress commits only after the assigned NPC actually discloses the fact", () => {
  const { game } = service();
  const successful = createGameRuntime(game.data, {
    seed: "mission-clue-spoken",
    profileId: "balanced",
    playerName: "聞き手",
    tutorial: false,
  });
  prepareMissionClueConversation(successful);
  const action = availableGameRuntimeActions(successful, game.data).choices
    .find((entry) => entry.id === "ACTION:MSN-T02:hear");
  const disclosed = executeGameRuntimeCommand(successful, game.data, {
    type: "CHOOSE",
    payload: { choiceId: action.choiceId },
  });
  assert.equal(successful.playerState.missions["MSN-T02"].progress.hear, 1);
  assert.match(disclosed.resolvedAction.requiredDisclosure, /穀倉|火/u);
  assert.doesNotMatch(disclosed.outcome.summary, /ガロ/u,
    "the result must not reveal an NPC name before the introduction is acknowledged");
  const anonymousRumor = runtimeView(successful, game.data).rumors
    .find((rumor) => rumor.id === "RUM-LIVING-TEST-T02-CLUE");
  assert.equal(anonymousRumor?.source, "年配の村人から聞いた");
  successful.playerKnowledge.knownNpcIds.add("NPC003");
  const identifiedRumor = runtimeView(successful, game.data).rumors
    .find((rumor) => rumor.id === "RUM-LIVING-TEST-T02-CLUE");
  assert.match(identifiedRumor?.source ?? "", /^ガロ.*から聞いた$/u);
  assert.equal(successful.dialogueSession?.npcId, "NPC003");
  assert.ok(availableGameRuntimeActions(successful, game.data).choices
    .every((entry) => entry.id.startsWith("DIALOGUE:NPC003:")));

  const interrupted = createGameRuntime(game.data, {
    seed: "mission-clue-interrupted",
    profileId: "balanced",
    playerName: "聞き手",
    tutorial: false,
  });
  const departingNpc = prepareMissionClueConversation(interrupted);
  departingNpc.localTravel = {
    routeId: "TEST:SQUARE->WELL",
    hubId: "田園の村",
    fromFacilityId: "LOC_FARM_SQUARE",
    toFacilityId: "LOC_FARM_WELL",
    departedAt: 0,
    arriveAt: 0.1,
  };
  const interruptedAction = availableGameRuntimeActions(interrupted, game.data).choices
    .find((entry) => entry.id === "ACTION:MSN-T02:hear");
  const noDisclosure = executeGameRuntimeCommand(interrupted, game.data, {
    type: "CHOOSE",
    payload: { choiceId: interruptedAction.choiceId },
  });
  assert.equal(interrupted.playerState.missions["MSN-T02"].progress.hear, 0);
  assert.equal(noDisclosure.resolvedAction.requiredDisclosure, null);
  assert.equal(interrupted.dialogueSession, null);
});

test("dialogue topics select a relevant fact, preserve its provenance, and never learn on farewell", () => {
  const { game } = service();
  const runtime = createGameRuntime(game.data, {
    seed: "dialogue-topic-provenance",
    profileId: "balanced",
    playerName: "聞き手",
    tutorial: false,
  });
  const eda = runtime.livingWorld.npcStates.NPC004;
  eda.beliefs = {
    "TEST-ROUTE": {
      factId: "TEST-ROUTE",
      kind: "fact",
      text: "村外れへの近道は石橋を渡る",
      troubleIds: ["T01"],
      importance: 1,
      learnedAt: 0,
      secret: false,
      sourceType: "sheet",
      hopCount: 0,
      path: ["NPC004"],
    },
    "TEST-CONCERN": {
      factId: "TEST-CONCERN",
      kind: "fact",
      text: "共同穀倉のパンが足りず村人が困っている",
      troubleIds: ["T01"],
      importance: 0.25,
      learnedAt: 0,
      secret: false,
      sourceType: "sheet",
      hopCount: 0,
      path: ["NPC004"],
    },
  };
  const talk = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.type === "conversation" && action.targetNpcId === "NPC004");
  executeGameRuntimeCommand(runtime, game.data, { type: "CHOOSE", payload: { choiceId: talk.choiceId } });
  runtime.dialogueSession.turnCount = 0;
  runtime.dialogueSession.askedTopics = new Set(["active_mission", "route_to_lead"]);
  const concern = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.dialogueTopic === "local_concern");
  assert.ok(concern);
  const learned = executeGameRuntimeCommand(runtime, game.data, { type: "CHOOSE", payload: { choiceId: concern.choiceId } });
  assert.equal(learned.outcome.learnedRumorCount, 1);
  assert.equal(runtime.playerState.player.knownRumorIds.has("RUM-LIVING-TEST-CONCERN"), true);
  assert.equal(runtime.playerState.player.knownRumorIds.has("RUM-LIVING-TEST-ROUTE"), false);
  assert.equal(learned.resolvedAction.disclosedRumorId, "RUM-LIVING-TEST-CONCERN");
  assert.match(learned.resolvedAction.requiredDisclosure, /共同穀倉|パン/u);

  runtime.dialogueSession.turnCount = 2;
  const provenanceChoice = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.dialogueTopic === "local_rumor");
  assert.ok(provenanceChoice, "the provenance question appears only after a fact was disclosed");
  const knownBeforeProvenance = runtime.playerState.player.knownRumorIds.size;
  const provenance = executeGameRuntimeCommand(runtime, game.data, {
    type: "CHOOSE",
    payload: { choiceId: provenanceChoice.choiceId },
  });
  assert.equal(provenance.outcome.learnedRumorCount, undefined);
  assert.equal(runtime.playerState.player.knownRumorIds.size, knownBeforeProvenance);
  assert.equal(provenance.resolvedAction.disclosedRumorId, "RUM-LIVING-TEST-CONCERN");
  assert.match(provenance.resolvedAction.requiredDisclosure, /という話は、.*見聞き/u);

  eda.beliefs["TEST-FAREWELL-LEAK"] = {
    factId: "TEST-FAREWELL-LEAK",
    kind: "fact",
    text: "別の深刻な被害で村人が困っている",
    importance: 1,
    learnedAt: 0,
    secret: false,
  };
  const end = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.dialogueTopic === "end_conversation");
  const historyBeforeEnd = runtime.playerState.history.filter((entry) => entry.type === "RUMOR_LEARNED_LOCAL").length;
  const farewell = executeGameRuntimeCommand(runtime, game.data, { type: "CHOOSE", payload: { choiceId: end.choiceId } });
  assert.equal(farewell.outcome.learnedRumorCount, undefined);
  assert.equal(farewell.resolvedAction.requiredDisclosure, null);
  assert.equal(runtime.playerState.player.knownRumorIds.has("RUM-LIVING-TEST-FAREWELL-LEAK"), false);
  assert.equal(runtime.playerState.history.filter((entry) => entry.type === "RUMOR_LEARNED_LOCAL").length, historyBeforeEnd);
});

test("an NPC with a hidden hostile role cannot disclose even a non-secret belief", () => {
  const { game } = service();
  const npc = game.data.model.npcById.NPC004;
  const previous = { occupation: npc.occupation, disposition: npc.disposition };
  try {
    npc.occupation = "共同穀倉の放火犯";
    npc.disposition = "escalate";
    const runtime = createGameRuntime(game.data, {
      seed: "hidden-role-disclosure",
      profileId: "balanced",
      playerName: "警戒する旅人",
      tutorial: false,
    });
    runtime.livingWorld.npcStates.NPC004.beliefs = {
      "TEST-HIDDEN-LEAK": {
        factId: "TEST-HIDDEN-LEAK",
        kind: "fact",
        text: "穀倉の火事で村人が困っている",
        importance: 1,
        learnedAt: 0,
        secret: false,
      },
    };
    const talk = availableGameRuntimeActions(runtime, game.data).choices
      .find((action) => action.type === "conversation" && action.targetNpcId === "NPC004");
    executeGameRuntimeCommand(runtime, game.data, { type: "CHOOSE", payload: { choiceId: talk.choiceId } });
    runtime.dialogueSession.turnCount = 0;
    runtime.dialogueSession.askedTopics = new Set(["active_mission", "route_to_lead"]);
    const concern = availableGameRuntimeActions(runtime, game.data).choices
      .find((action) => action.dialogueTopic === "local_concern");
    const result = executeGameRuntimeCommand(runtime, game.data, { type: "CHOOSE", payload: { choiceId: concern.choiceId } });
    assert.equal(result.outcome.learnedRumorCount, undefined);
    assert.equal(result.resolvedAction.requiredDisclosure, null);
    assert.equal(runtime.playerState.player.knownRumorIds.has("RUM-LIVING-TEST-HIDDEN-LEAK"), false);
  } finally {
    npc.occupation = previous.occupation;
    npc.disposition = previous.disposition;
  }
});

test("a conversation grants no fact when its NPC leaves before the reply is presented", () => {
  const { game } = service();
  const runtime = createGameRuntime(game.data, {
    seed: "conversation-interrupted-by-travel",
    profileId: "balanced",
    playerName: "待ち人",
    tutorial: false,
  });
  const talk = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.type === "conversation" && action.targetNpcId === "NPC004");
  executeGameRuntimeCommand(runtime, game.data, { type: "CHOOSE", payload: { choiceId: talk.choiceId } });

  runtime.playerState.absoluteMinute = 239;
  Object.assign(runtime.playerState, clockFromMinute(239));
  runtime.dialogueSession.lastInteractionAtMinute = 239;
  runtime.dialogueSession.openedAtMinute = 239;
  runtime.dialogueSession.turnCount = 0;
  runtime.dialogueSession.askedTopics = new Set(["active_mission", "route_to_lead"]);
  const eda = runtime.livingWorld.npcStates.NPC004;
  eda.beliefs = {
    "TEST-INTERRUPTED": {
      factId: "TEST-INTERRUPTED",
      kind: "fact",
      text: "畑の水不足で村人が困っている",
      importance: 1,
      learnedAt: 0,
      secret: false,
    },
  };
  eda.localTravel = {
    routeId: "TEST:FIELD->WELL",
    hubId: "田園の村",
    fromFacilityId: "LOC_FARM_FIELD",
    toFacilityId: "LOC_FARM_WELL",
    departedAt: 3.9,
    arriveAt: 4,
  };
  eda.presence = "present";
  const concern = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.dialogueTopic === "local_concern");
  assert.ok(concern);
  const result = executeGameRuntimeCommand(runtime, game.data, { type: "CHOOSE", payload: { choiceId: concern.choiceId } });
  assert.equal(runtime.livingWorld.npcStates.NPC004.position.facilityId, "LOC_FARM_WELL");
  assert.equal(result.outcome.learnedRumorCount, undefined);
  assert.equal(result.resolvedAction.requiredDisclosure, null);
  assert.equal(runtime.playerState.player.knownRumorIds.has("RUM-LIVING-TEST-INTERRUPTED"), false);
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
  const belief = (factId, text, propagationAt, importance) => ({
    factId,
    kind: "fact",
    text,
    importance,
    confidence: 1,
    learnedAt: currentHour,
    propagationAt,
    secret: false,
  });
  const ready = belief("TEST-RUMOR-READY", "パン屋へ届く小麦が減っている", currentHour, 0.99);
  const queued = belief("TEST-RUMOR-QUEUED", "夜の荷車が増えている", currentHour + 4, 1);
  const pool = runtime.livingWorld.facilityRumors.LOC_FARM_BAKERY;
  pool.set(ready.factId, { factId: ready.factId, belief: ready, propagationAt: ready.propagationAt });
  pool.set(queued.factId, { factId: queued.factId, belief: queued, propagationAt: queued.propagationAt });
  const observe = availableGameRuntimeActions(runtime, game.data).choices
    .find((action) => action.type === "localInvestigate");
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

test("the skill primer explains the risk but never blocks an underprepared player", async () => {
  const { game } = service();
  const runner = commandRunner(game, await game.create(owner, { playerName: "unprepared", seed: "skill-ack-is-not-training" }));
  await completeOpening(runner);
  await runner.run("TUTORIAL_ACK", { tutorialId: "mission-log" });
  const edge = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_EDGE");
  assert.ok(edge);
  await runner.run("MOVE", { moveId: edge.moveId });
  assert.equal(runner.save.tutorial.id, "skills");
  assert.match(runner.save.tutorial.body, /取得せず進むこともできる/u);
  assert.equal(runner.save.skills.learned.length, 0);
  await runner.run("TUTORIAL_ACK", { tutorialId: "skills" });

  for (let searchCount = 0; searchCount < 2; searchCount += 1) {
    const search = runner.save.choices.find((choice) => choice.missionId === "MSN-T01"
      && choice.stepId === "search"
      && choice.type === "investigate");
    assert.ok(search, "the investigation path remains available without learning a skill");
    await runner.run("CHOOSE", { choiceId: search.choiceId, actionId: search.actionId });
  }
  assert.equal(runner.save.skills.learned.length, 0);
  assert.equal(runner.save.choices.some((choice) => choice.danger), true);
  assert.equal(runner.save.choices.some((choice) => choice.type === "missionBattle"), true);
  assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
});

test("T01 exploration binds the displayed action and replaces all three choices after a concrete discovery", async () => {
  const { game, store } = service();
  const runner = commandRunner(game, await game.create(owner, { playerName: "探索者", seed: "t01-branch-binding" }));
  await completeOpening(runner);
  await runner.run("TUTORIAL_ACK", { tutorialId: "mission-log" });
  const edge = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_EDGE");
  assert.ok(edge);
  await runner.run("MOVE", { moveId: edge.moveId });

  const searchChoices = () => runner.save.choices.filter((choice) => choice.missionId === "MSN-T01"
    && choice.stepId === "search"
    && choice.type === "investigate");
  const firstStage = searchChoices();
  assert.equal(firstStage.length, 3);
  assert.equal(new Set(firstStage.map((choice) => choice.actionId)).size, 3);
  assert.equal(new Set(firstStage.map((choice) => choice.label)).size, 3);

  const selected = firstStage.find((choice) => choice.actionId.endsWith(":claw-marks"));
  assert.ok(selected);
  const minuteBefore = runner.save.clock.absoluteMinute;
  await runner.run("CHOOSE", { choiceId: selected.choiceId, actionId: selected.actionId });
  assert.equal(runner.save.clock.absoluteMinute - minuteBefore, selected.minutes);
  assert.equal(runner.save.scene.lastOutcome.discovery.id, "T01-CLUE-WOLF-PURSUIT");
  assert.match(runner.save.scene.lastOutcome.discovery.text, /赤牙狼.*少年/u);
  assert.match(runner.save.scene.narrative, /赤牙狼の爪痕/u);
  assert.match(runner.save.scene.narrative, /少年/u);
  assert.doesNotMatch(runner.save.scene.narrative, /見知らぬ人物|青年/u);

  const secondStage = searchChoices();
  assert.equal(secondStage.length, 3);
  assert.equal(secondStage.some((choice) => firstStage.some((previous) => previous.actionId === choice.actionId)), false);
  const record = await store.get(runner.save.id);
  assert.equal(record.presentation.source, "authored_scene");
  assert.equal(record.presentation.sceneId, "t01.search.wolf_pursuit");
  const journal = record.commandLog.at(-1);
  assert.equal(journal.payload.actionId, selected.actionId);
  assert.equal(journal.resolvedActionId, selected.actionId);

  const revisionBeforeMismatch = runner.save.revision;
  await assert.rejects(
    game.command(owner, runner.save.id, {
      commandId: "t01-mismatched-visible-action",
      expectedRevision: revisionBeforeMismatch,
      type: "CHOOSE",
      payload: { choiceId: secondStage[0].choiceId, actionId: secondStage[1].actionId },
    }),
    (error) => error?.code === "choice_action_mismatch" && error?.status === 409,
  );
  assert.equal((await game.get(owner, runner.save.id)).revision, revisionBeforeMismatch);

  const followup = secondStage.find((choice) => choice.actionId.endsWith(":faint-voice"));
  assert.ok(followup);
  await runner.run("CHOOSE", { choiceId: followup.choiceId, actionId: followup.actionId });
  assert.equal(runner.save.scene.lastOutcome.discovery.id, "T01-CLUE-FAINT-VOICE");
  assert.equal(searchChoices().length, 0);
});

test("T01 speaks through discovery, rescue, escort and reunion before completion", async () => {
  const narrativeInputs = [];
  const narrator = {
    async generate(input) {
      narrativeInputs.push(input);
      const required = new Set(input.authoritativeState?.reactionContract?.requiredActorIds ?? []);
      const speeches = [];
      if (required.has("NPC001") && input.action?.dialogueTopic === "t01_rescue_aftermath") {
        speeches.push({ actorId: "NPC001", text: "僕はフィン。足を痛めて一人では歩けない。村の広場まで一緒に戻ってほしい。", emotion: "安堵と痛み" });
      }
      if (required.has("NPC001") && input.action?.dialogueTopic === "t01_escort") {
        speeches.push({ actorId: "NPC001", text: "足を痛めて、僕一人では歩けないんだ。村の広場まで一緒に戻ってくれない？", emotion: "懇願" });
      }
      if (input.action?.dialogueTopic === "t01_reunion") {
        if (required.has("NPC001")) speeches.push({ actorId: "NPC001", text: "母さん、ただいま。助けてもらって、ここまで戻れたよ。", emotion: "安堵" });
        if (required.has("NPC002")) speeches.push({ actorId: "NPC002", text: "よかった……帰ってきてくれて。連れ帰ってくださって、ありがとうございます。", emotion: "涙" });
        if (required.has("NPC003")) speeches.push({ actorId: "NPC003", text: "村を預かる者として、救助と帰路を支えてくれたことに礼を言う。", emotion: "感謝" });
      }
      return {
        narrative: input.authoritativeOutcome?.discovery?.text
          ?? (input.action?.dialogueTopic === "t01_rescue_aftermath"
            ? "斜面の下で、救われた少年が痛む足をかばいながら顔を上げた。"
            : input.action?.dialogueTopic === "t01_reunion"
              ? "村の広場へ戻ると、待っていた家族と村人が二人を迎えた。"
              : "選んだ行動の結果が反映された。"),
        speeches,
        choices: [],
        proposals: [],
        meta: { source: "test" },
      };
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
    if (actionId !== "ACTION:MSN-T01:escort") assert.equal(choice.targetNpcId === "NPC001", false);
    return runner.run("CHOOSE", { choiceId: choice.choiceId, actionId: choice.actionId });
  };
  const chooseSearch = async (preferredApproachId = null) => {
    const available = runner.save.choices.filter((entry) => entry.missionId === "MSN-T01"
      && entry.stepId === "search");
    const choice = available.find((entry) => preferredApproachId && entry.actionId.endsWith(`:${preferredApproachId}`))
      ?? available[0];
    assert.ok(choice, "at least one T01 search approach must remain among the diverse decisions");
    const response = await runner.run("CHOOSE", { choiceId: choice.choiceId, actionId: choice.actionId });
    return { response, discoveryId: response.save.scene.lastOutcome.discovery.id };
  };

  await completeOpening(runner);
  await runner.run("TUTORIAL_ACK", { tutorialId: "mission-log" });
  await moveTo("LOC_FARM_EDGE");
  assert.equal(runner.save.tutorial.id, "skills");
  await runner.run("LEARN_SKILL", { skillId: runner.save.skills.learnable[0].id });
  const firstSearch = await chooseSearch("tracks");
  assert.match(firstSearch.response.save.scene.narrative, /小さな靴跡|赤牙狼の爪痕|青い糸/u);
  assert.doesNotMatch(firstSearch.response.save.scene.narrative, /見知らぬ人物|青年/u);
  const secondSearch = await chooseSearch("faint-voice");
  assert.match(secondSearch.response.save.scene.narrative, /フィン|子ども/u);
  assert.match(secondSearch.response.save.scene.narrative, /生きて|声|咳/u);
  assert.match(secondSearch.response.save.scene.narrative, /狼|赤牙狼/u);
  assert.doesNotMatch(secondSearch.response.save.scene.narrative, /見知らぬ人物|青年/u);
  const searchInputs = narrativeInputs.filter((input) => input.action?.stepId === "search");
  assert.equal(searchInputs.length, 0, "reviewed T01 search discoveries bypass Gemini generation");
  assert.deepEqual(runner.save.missions.find((mission) => mission.id === "MSN-T01")
    ?.discoveries.map((discovery) => discovery.id), [firstSearch.discoveryId, secondSearch.discoveryId]);
  assert.equal(runner.save.guidance.title, "赤牙狼の兆候を退ける");
  assert.equal(runner.save.guidance.actionPanel, null, "an on-site objective points at the visible choices instead of opening an unrelated panel");
  const battleStart = await chooseAction("ACTION:MSN-T01:rescue");
  assert.equal(battleStart.save.scene.lastOutcome.battlePending, true);
  assert.equal(battleStart.save.battle?.status, "active");
  const { finalResponse: battleResponse } = await finishRunnerBattle(runner);
  assert.ok(battleResponse);
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
  assert.equal(battleNarrativeInput, undefined, "a reviewed authored aftermath bypasses Gemini generation");
  assert.equal(battleRecord.presentation.source, "authored_scene");
  assert.equal(battleRecord.presentation.sceneId, "t01.rescue.after_battle");
  assert.match(battleRecord.presentation.narrative, /斜面の下.*少年/u);
  assert.doesNotMatch(battleRecord.presentation.narrative, /青年/u);
  assert.ok(battleRecord.presentation.speeches.some((speech) => speech.actorId === "NPC001"
    && /僕、フィン.*足が動かない.*置いていかないで.*村の広場/u.test(speech.text)));
  assert.equal(runner.save.tutorial?.complete, true, "the combat coach does not return after a battle was experienced");
  assert.equal(runner.save.missions.find((entry) => entry.id === "MSN-T01")?.currentStep?.id, "escort");
  assert.equal(runner.save.guidance.targetFacilityId, "LOC_FARM_EDGE");
  assert.equal(runner.save.guidance.actionPanel, null);
  await chooseAction("ACTION:MSN-T01:escort");
  const escortInput = narrativeInputs.findLast((input) => input.action?.dialogueTopic === "t01_escort");
  assert.equal(escortInput, undefined, "the reviewed escort request bypasses Gemini generation");
  const escortRecord = await store.get(runner.save.id);
  assert.equal(escortRecord.presentation.source, "authored_scene");
  assert.equal(escortRecord.presentation.sceneId, "t01.escort.request");
  assert.ok(runner.save.scene.beats.some((beat) => beat.actorId === "NPC001"
    && /足が動かない.*母さん.*肩を貸して.*置いていかないで/u.test(beat.text)));
  assert.equal(runner.save.guidance.title, "村の広場へ：少年を連れ帰る");
  assert.equal(runner.save.guidance.actionPanel, "movement");
  assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
  await moveTo("LOC_FARM_SQUARE");
  const reunionText = runner.save.scene.beats.map((beat) => beat.text).join("\n");
  assert.match(reunionText, /母さん[、……]*ただいま/u);
  assert.match(reunionText, /よかった.*ありがとうございます/u);
  assert.match(reunionText, /村を預かる者として.*礼を言う/u);
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

test("ordinary NPC conversation supports distinct multi-turn follow-ups until the player ends it", async () => {
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
  const narrativeState = inputs.at(-1).authoritativeState;
  assert.equal(narrativeState.facilityType, "広場");
  assert.match(narrativeState.publicDescription, /村人|知らせ/u);
  assert.equal("facilityFunction" in narrativeState, false);
  assert.equal("facilityNotes" in narrativeState, false);
  assert.doesNotMatch(JSON.stringify(narrativeState), /T01捜索|T02後の村会合|情報ハブ|事件導線|開始地点/u);
  assert.ok(narrativeState.npcs.every((npc) => !("occupation" in npc)));
  const firstFollowup = runner.save.choices.find((choice) => !choice.actionId.endsWith(":END"));
  assert.ok(firstFollowup);
  await runner.run("CHOOSE", { choiceId: firstFollowup.choiceId });
  const firstTopic = inputs.at(-1).action.dialogueTopic;
  assert.ok(firstTopic);
  assert.equal(inputs.at(-1).action.conversationTurn, 2);
  assert.ok(runner.save.choices.every((choice) => choice.actionId.startsWith(`DIALOGUE:${talk.targetNpcId}:`)));

  const secondFollowup = runner.save.choices.find((choice) => !choice.actionId.endsWith(":END"));
  assert.ok(secondFollowup);
  await runner.run("CHOOSE", { choiceId: secondFollowup.choiceId });
  assert.notEqual(inputs.at(-1).action.dialogueTopic, firstTopic);
  assert.equal(inputs.at(-1).action.conversationTurn, 3);
  assert.ok(inputs.at(-1).action.previouslyAskedTopics.includes(firstTopic));
  assert.ok(runner.save.choices.some((choice) => choice.actionId.startsWith(`DIALOGUE:${talk.targetNpcId}:`)));

  const endConversation = runner.save.choices.find((choice) => choice.actionId.endsWith(":END"));
  assert.ok(endConversation);
  await runner.run("CHOOSE", { choiceId: endConversation.choiceId });
  assert.equal(runner.save.choices.some((choice) => choice.actionId.startsWith(`DIALOGUE:${talk.targetNpcId}:`)), false);
  assert.equal(inputs.at(-1).action.dialogueTopic, "end_conversation");
  assert.equal((await game.verifyReplay(owner, runner.save.id)).ok, true);
});

test("the service replaces a Gemini reply that omits the fact recorded as learned", async () => {
  const narrator = {
    async generate(input) {
      const targetNpcId = input.action.targetNpcId;
      return {
        narrative: "相手は問いの意味を考え、知っている範囲を順に説明しようとした。",
        speeches: targetNpcId ? [{
          actorId: targetNpcId,
          text: "話せることはあるが、ここでは肝心の具体的な事実を意図的に省いている。別の場所も確かめてから判断してほしい。急いで決めつけるのは危険だ。",
          emotion: "慎重",
        }] : [],
        choices: input.authoritativeState.availableActionCandidates.slice(0, 3).map((choice) => ({
          id: choice.id,
          label: choice.label,
          intentType: choice.intentType,
          targetNpcId: choice.targetNpcId,
        })),
        proposals: [],
        meta: { source: "mock_gemini" },
      };
    },
  };
  const { game, store } = service(true, { narrator });
  let runner = commandRunner(game, await game.create(owner, { playerName: "記録する旅人", seed: "disclosure-guard" }));
  await completeOpening(runner);
  const talk = runner.save.choices.find((choice) => choice.type === "conversation" && !choice.missionId);
  assert.ok(talk);

  let record = await store.get(runner.save.id);
  let runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  runtime.livingWorld.npcStates[talk.targetNpcId].beliefs = {
    "TEST-GUARDED-DISCLOSURE": {
      factId: "TEST-GUARDED-DISCLOSURE",
      kind: "fact",
      text: "共同穀倉で食料不足が起きて村人が困っている",
      troubleIds: ["T02"],
      importance: 1,
      learnedAt: 0,
      secret: false,
      sourceType: "sheet",
      hopCount: 0,
      path: [talk.targetNpcId],
    },
  };
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = gameStateHash(runtime, game.data);
  await store.put(record);
  runner = commandRunner(game, await game.get(owner, runner.save.id), "guard-command");
  await runner.run("CHOOSE", { choiceId: runner.save.choices.find((choice) => choice.actionId === talk.actionId).choiceId });

  record = await store.get(runner.save.id);
  runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  runtime.dialogueSession.turnCount = 0;
  runtime.dialogueSession.askedTopics = new Set(["active_mission", "route_to_lead"]);
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = gameStateHash(runtime, game.data);
  await store.put(record);
  runner = commandRunner(game, await game.get(owner, runner.save.id), "guard-followup");
  const concern = runner.save.choices.find((choice) => choice.actionId.endsWith(":local_concern"));
  assert.ok(concern);
  await runner.run("CHOOSE", { choiceId: concern.choiceId });

  record = await store.get(runner.save.id);
  assert.equal(record.presentation.source, "mock_gemini");
  assert.ok(record.presentation.speeches.some((speech) => /肝心の具体的な事実/u.test(speech.text)));
  assert.ok(record.presentation.speeches.some((speech) => /共同穀倉|食料/u.test(speech.text)));
  assert.equal(runner.save.scene.lastOutcome.learnedRumorCount, 1);
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

test("completed work preserves a server-valid work route and sends recent work to the director", async () => {
  const inputs = [];
  const narrator = {
    async generate(input) {
      inputs.push(input);
      const candidates = input.authoritativeState.availableActionCandidates ?? [];
      const continuationIds = new Set(input.authoritativeState.continuityContract?.candidateIds ?? []);
      const ordered = [
        ...candidates.filter((candidate) => continuationIds.has(candidate.id)),
        ...candidates.filter((candidate) => !continuationIds.has(candidate.id)),
      ].slice(0, 3);
      return {
        narrative: "その場の仕事と人の動きを確かめた。",
        choices: ordered.map((candidate) => ({
          id: candidate.id,
          label: candidate.workOffer ? "この場所で別の仕事の内容を尋ねる" : candidate.label,
          intentType: candidate.intentType,
          targetNpcId: candidate.targetNpcId ?? null,
          ...(candidate.workOffer ? {
            workProposal: {
              title: "広場へ届いた木箱を商店ごとに仕分ける",
              durationClass: "short",
              riskClass: "low",
            },
          } : {}),
        })),
        speeches: [],
        proposals: [],
        meta: { source: "test" },
      };
    },
  };
  const { game } = service(true, { narrator });
  const runner = commandRunner(game, await game.create(owner, { playerName: "働き手", seed: "work-continuity-director" }));
  await completeOpening(runner, { inquiry: "TUTORIAL:DEFER:WORK" });
  const confirm = runner.save.choices.find((choice) => choice.actionId.startsWith("WORK_CONFIRM:"));
  assert.ok(confirm);
  await runner.run("CHOOSE", { choiceId: confirm.choiceId, actionId: confirm.actionId });

  const completedWorkInput = inputs.findLast((input) => input.action?.type === "work");
  assert.ok(completedWorkInput);
  assert.equal(completedWorkInput.authoritativeState.workMarket.completedToday, 1);
  assert.ok(completedWorkInput.authoritativeState.workMarket.recentWorkTitles.some((title) => /穀袋/u.test(title)));
  const nextWorkCandidates = completedWorkInput.authoritativeState.availableActionCandidates
    .filter((candidate) => candidate.workOffer === true);
  if (nextWorkCandidates.length) {
    assert.equal(completedWorkInput.authoritativeState.continuityContract.mode, "must_offer_continuation");
    assert.ok(completedWorkInput.authoritativeState.continuityContract.candidateIds
      .some((id) => nextWorkCandidates.some((candidate) => candidate.id === id)));
    assert.ok(runner.save.choices.some((choice) => /別の仕事/u.test(choice.label)));
  } else {
    assert.equal(completedWorkInput.authoritativeState.continuityContract.mode, "free");
  }
});

test("leaving for the capital removes the village T01 thread from later Gemini context", async () => {
  const inputs = [];
  const narrator = {
    async generate(input) {
      inputs.push(input);
      const choices = (input.authoritativeState.availableActionCandidates ?? []).slice(0, 3).map((candidate) => ({
        id: candidate.id,
        label: candidate.label,
        intentType: candidate.intentType,
        targetNpcId: candidate.targetNpcId ?? null,
      }));
      return {
        narrative: "現在地の人通りと建物を見渡した。",
        choices,
        speeches: [],
        proposals: [],
        meta: { source: "test" },
      };
    },
  };
  const { game } = service(true, { narrator });
  const runner = commandRunner(game, await game.create(owner, { playerName: "遠出する旅人", seed: "capital-no-village-thread" }));
  await completeOpening(runner, { inquiry: "TUTORIAL:DEFER:LEAVE" });
  if (runner.save.tutorial?.acknowledgeable) {
    await runner.run("TUTORIAL_ACK", { tutorialId: runner.save.tutorial.id });
  }
  const capital = runner.save.movement.find((move) => move.destination === "王都");
  assert.ok(capital);
  await runner.run("MOVE", { moveId: capital.moveId });
  const followup = runner.save.choices.find((choice) => !String(choice.actionId).startsWith("MOVE_REGION:"))
    ?? runner.save.choices[0];
  assert.ok(followup, "the reviewed capital arrival must still expose a next action");
  await runner.run("CHOOSE", { choiceId: followup.choiceId, actionId: followup.actionId });

  const capitalInput = inputs.findLast((input) => input.authoritativeState?.location === "王都");
  assert.ok(capitalInput);
  assert.equal(capitalInput.authoritativeState.missions.some((mission) => mission.id === "MSN-T01" || mission.troubleId === "T01"), false);
  assert.equal(capitalInput.authoritativeState.player.knownFacts.some((fact) => /フィン|少年失踪|赤牙狼/u.test(fact)), false);
  assert.equal(capitalInput.authoritativeState.availableActionCandidates.some((candidate) => /MSN-T01|フィン|少年失踪/u.test(`${candidate.id} ${candidate.label}`)), false);
});
