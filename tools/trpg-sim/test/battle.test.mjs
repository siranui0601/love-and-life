import assert from "node:assert/strict";
import test from "node:test";

import {
  BATTLE_ASSUMPTIONS,
  calculateCriticalChance,
  calculateHitChance,
  calculateMagicDamage,
  calculatePhysicalDamage,
  createPlayerBuild,
  createSeededRng,
  effectiveAttack,
  expandEncounter,
  loadBattleData,
} from "../lib/battle-model.mjs";
import {
  beginInteractiveBattle,
  createDefaultBuilds,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
  runMonteCarlo,
  simulateBattle,
} from "../lib/battle-simulator.mjs";

const data = await loadBattleData();

function observerBuild() {
  return createPlayerBuild(data, {
    id: "observer",
    name: "Candidate exhaustion observer",
    level: 1,
    equipmentIds: [],
    skillIds: [],
    baseStats: {
      maxHp: 10_000,
      maxMp: 100,
      attack: 0,
      defense: 100,
      agility: 1,
      luck: 0,
      physicalPower: 1,
      magicPower: 1,
      magicResistance: 100,
      accuracy: 0,
      evasion: 0,
      critical: 0,
      debuffSuccess: 0,
      debuffResistance: 100,
    },
  });
}

test("battle fixture joins every combat table and all four skill shards", () => {
  assert.deepEqual({
    equipment: data.equipment.length,
    inventory: data.inventory.length,
    monsters: data.monsters.length,
    monsterSkills: data.monsterSkills.length,
    monsterActions: data.monsterActions.length,
    encounters: data.encounters.length,
    playerSkills: data.playerSkills.length,
  }, {
    equipment: 116,
    inventory: 123,
    monsters: 77,
    monsterSkills: 96,
    monsterActions: 285,
    encounters: 76,
    playerSkills: 1141,
  });
  assert.equal(data.loadDiagnostics.counts.invalidJson, undefined);
});

test("sheet damage formula and explicit hit/critical caps are stable", () => {
  assert.equal(effectiveAttack(20, 50), 30);
  assert.equal(calculatePhysicalDamage({
    weaponPower: 20,
    attack: 50,
    multiplier: 1.5,
    fixed: 2,
    defense: 10,
  }), 41);
  assert.equal(calculateMagicDamage({
    magicPower: 20,
    attack: 50,
    multiplier: 1.5,
    fixed: 2,
    magicResistance: 10,
  }), 41);

  assert.equal(BATTLE_ASSUMPTIONS.defenseCoefficient, 0.6);
  assert.equal(calculateHitChance({ accuracy: -999, targetEvasion: 999 }), 0.05);
  assert.equal(calculateHitChance({ accuracy: 999, targetEvasion: -999 }), 0.98);
  assert.equal(calculateCriticalChance({ critical: -999, targetLuck: 999 }), 0);
  assert.equal(calculateCriticalChance({ critical: 999, targetLuck: 0 }), 0.5);
});

test("seeded RNG and encounter party expansion are reproducible", () => {
  const first = createSeededRng("battle-seed");
  const second = createSeededRng("battle-seed");
  const third = createSeededRng("different-seed");
  const firstValues = Array.from({ length: 12 }, () => first());
  assert.deepEqual(firstValues, Array.from({ length: 12 }, () => second()));
  assert.notDeepEqual(firstValues, Array.from({ length: 12 }, () => third()));

  const partyOne = expandEncounter(data, "ENC-0001", createSeededRng(88));
  const partyTwo = expandEncounter(data, "ENC-0001", createSeededRng(88));
  assert.deepEqual(partyOne, partyTwo);
  assert.ok(partyOne.length >= 1);
  assert.ok(partyOne.every((monsterId) => data.monsterById.has(monsterId)));
});

test("battle data audit preserves actionable state and command inconsistencies", () => {
  assert.ok(data.audit.monstersWithoutUnconditionalAction.includes("MON-0076"));
  assert.deepEqual(
    [...new Set(data.audit.unresolvedStateReferences.map((entry) => entry.stateId))].sort(),
    ["bound", "mana_absorb膜", "overheat"],
  );
  assert.ok(data.audit.unresolvedModifierReferences.some((entry) => (
    entry.modifier === "physicalPower"
      && entry.normalized === "physical_power"
      && entry.normalizationResolves
  )));
  assert.ok(data.audit.unknownCommands.some((entry) => entry.command === "SUMMON_UNIT"));
  assert.ok(data.audit.unknownCommands.some((entry) => entry.command === "COPY_LAST_ENEMY_SKILL"));
  assert.equal(data.audit.passiveSkillsWithDamage.length, 25);
  assert.equal(data.audit.provisionalRuleSkills.length, 98);
  assert.equal(data.audit.contextualActiveSkills.length, 345);
});

test("the same battle seed produces the same complete result", () => {
  const build = createDefaultBuilds(data)[0];
  const options = {
    data,
    seed: "deterministic-battle",
    encounterId: "ENC-0001",
    playerBuild: build,
    maxTurns: 40,
  };
  assert.deepEqual(simulateBattle(options), simulateBattle(options));
});

function interactiveBuild(overrides = {}) {
  return createPlayerBuild(data, {
    id: "interactive-player",
    name: "Interactive player",
    level: 5,
    equipmentIds: ["EQP-W-0073"],
    skillIds: ["SKL-0001", "SKL-0093"],
    baseStats: {
      maxHp: 10_000,
      maxMp: 100,
      attack: 0,
      defense: 100,
      agility: 50,
      luck: 0,
      physicalPower: 1,
      magicPower: 1,
      magicResistance: 100,
      accuracy: 0,
      evasion: 0,
      critical: 0,
      debuffSuccess: 0,
      debuffResistance: 100,
      ...overrides,
    },
  });
}

function interactiveOptions(seed = "interactive-battle") {
  return {
    data,
    seed,
    monsterIds: ["MON-0005"],
    playerBuild: interactiveBuild(),
    maxTurns: 20,
  };
}

function firstTarget(commands, actionId) {
  return commands.find((entry) => entry.actionId === actionId)?.targets?.[0]?.instanceId;
}

test("interactive battle begins before a turn and lists only authoritative first-slice commands", () => {
  const first = beginInteractiveBattle(interactiveOptions("interactive-begin"));
  const second = beginInteractiveBattle(interactiveOptions("interactive-begin"));
  const commands = listInteractiveBattleCommands({ data, session: first });

  assert.deepEqual(first, second);
  assert.equal(first.status, "active");
  assert.equal(first.state.turn, 0);
  assert.deepEqual(
    commands.filter((entry) => ["attack", "defend", "flee"].includes(entry.kind)).map((entry) => entry.actionId),
    ["ATTACK", "DEFEND", "FLEE"],
  );
  assert.ok(commands.some((entry) => entry.actionId === "SKILL:SKL-0001" && entry.available));
  assert.ok(commands.some((entry) => entry.actionId === "SKILL:SKL-0093" && entry.mpCost === 9));
  assert.equal(commands.some((entry) => entry.kind === "item"), false, "items stay absent until the sheet has combat effects");
  assert.ok(first.state.players[0].cooldowns instanceof Map);
  assert.ok(first.state.players[0].activeWeaponTypes instanceof Set);
  assert.doesNotThrow(() => structuredClone(first));
});

test("the same interactive command sequence produces the same complete state and round frames", () => {
  const play = () => {
    let session = beginInteractiveBattle(interactiveOptions("interactive-sequence"));
    for (let round = 0; round < 4 && session.status === "active"; round += 1) {
      const commands = listInteractiveBattleCommands({ data, session });
      const actionId = round === 0 ? "SKILL:SKL-0001" : round === 1 ? "DEFEND" : "ATTACK";
      const result = resolveInteractiveBattleRound({
        data,
        session,
        command: { actionId, targetInstanceId: firstTarget(commands, actionId) },
      });
      assert.equal(result.ok, true);
      session = result.session;
    }
    return session;
  };

  assert.deepEqual(play(), play());
});

test("invalid interactive commands do not mutate state, advance rounds, or consume future randomness", () => {
  const initial = beginInteractiveBattle(interactiveOptions("interactive-invalid"));
  initial.state.players[0].cooldowns.set("SKL-0001", 2);
  const snapshot = structuredClone(initial);
  const invalid = resolveInteractiveBattleRound({
    data,
    session: initial,
    command: { actionId: "SKILL:SKL-0001", targetInstanceId: "not-an-enemy" },
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.reason, "cooldown");
  assert.strictEqual(invalid.session, initial);
  assert.deepEqual(initial, snapshot);

  const afterInvalidCommands = listInteractiveBattleCommands({ data, session: initial });
  const afterInvalid = resolveInteractiveBattleRound({
    data,
    session: initial,
    command: { actionId: "ATTACK", targetInstanceId: firstTarget(afterInvalidCommands, "ATTACK") },
  });
  const direct = resolveInteractiveBattleRound({
    data,
    session: structuredClone(snapshot),
    command: { actionId: "ATTACK", targetInstanceId: firstTarget(afterInvalidCommands, "ATTACK") },
  });
  assert.deepEqual(afterInvalid, direct);
});

test("interactive skills spend MP and obey cooldowns without changing the auto simulator", () => {
  const autoOptions = {
    data,
    seed: "auto-stays-stable",
    monsterIds: ["MON-0010"],
    playerBuild: interactiveBuild(),
    maxTurns: 5,
  };
  const autoBefore = simulateBattle(autoOptions);
  let session = beginInteractiveBattle(interactiveOptions("interactive-skill-cost"));
  let commands = listInteractiveBattleCommands({ data, session });
  const skillTarget = firstTarget(commands, "SKILL:SKL-0093");
  const skillRound = resolveInteractiveBattleRound({
    data,
    session,
    command: { actionId: "SKILL:SKL-0093", targetInstanceId: skillTarget },
  });
  assert.equal(skillRound.ok, true);
  session = skillRound.session;
  assert.equal(session.state.players[0].mp, 91);
  assert.equal(session.state.players[0].cooldowns.get("SKL-0093"), 2);
  assert.equal(listInteractiveBattleCommands({ data, session })
    .find((entry) => entry.actionId === "SKILL:SKL-0093").disabledReason, "cooldown");

  commands = listInteractiveBattleCommands({ data, session });
  session = resolveInteractiveBattleRound({
    data,
    session,
    command: { actionId: "ATTACK", targetInstanceId: firstTarget(commands, "ATTACK") },
  }).session;
  assert.equal(listInteractiveBattleCommands({ data, session })
    .find((entry) => entry.actionId === "SKILL:SKL-0093").available, true);
  assert.deepEqual(simulateBattle(autoOptions), autoBefore);
});

test("interactive defend applies a one-round guard before later enemy actions", () => {
  const session = beginInteractiveBattle({
    ...interactiveOptions("interactive-defend"),
    playerBuild: interactiveBuild({ agility: 10_000, defense: 0, magicResistance: 0 }),
  });
  const defended = resolveInteractiveBattleRound({ data, session, command: { actionId: "DEFEND" } });
  const player = defended.session.state.players[0];
  const guard = player.specialStates.get("guard");
  const enemyDamage = defended.round.frames
    .filter((frame) => frame.actorSide === "enemy")
    .reduce((sum, frame) => sum + Number(frame.damage || 0), 0);

  assert.equal(defended.ok, true);
  assert.equal(guard?.params?.damageReduction, 0.5);
  assert.ok(enemyDamage > 0, "the fixture enemy must land damage so guard is exercised");
  assert.ok(defended.round.frames.some((frame) => frame.action?.kind === "defend"));
});

test("interactive flee is deterministic and a successful escape ends without inventing a victory", () => {
  let successful = null;
  for (let attempt = 0; attempt < 50 && !successful; attempt += 1) {
    const session = beginInteractiveBattle({
      ...interactiveOptions(`interactive-flee:${attempt}`),
      playerBuild: interactiveBuild({ agility: 10_000 }),
    });
    const result = resolveInteractiveBattleRound({ data, session, command: { actionId: "FLEE" } });
    if (result.session.winner === "fled") successful = { session, result };
  }

  assert.ok(successful, "a 90% escape chance must yield a deterministic success in the bounded seed search");
  const replay = resolveInteractiveBattleRound({ data, session: successful.session, command: { actionId: "FLEE" } });
  assert.deepEqual(replay, successful.result);
  assert.equal(successful.result.session.status, "finished");
  assert.equal(successful.result.result.winner, "fled");
  assert.equal(successful.result.result.actionUsage.__flee__, 1);
  assert.ok(successful.result.round.frames.some((frame) => frame.action?.kind === "flee" && frame.escapeSucceeded === true));
});

test("timeline capture is deterministic and does not change battle resolution", () => {
  const build = createDefaultBuilds(data)[0];
  const options = {
    data,
    seed: "timeline-determinism",
    encounterId: "ENC-0001",
    playerBuild: build,
    maxTurns: 40,
  };
  const withoutTimeline = simulateBattle(options);
  const first = simulateBattle({ ...options, captureTimeline: true });
  const second = simulateBattle({ ...options, captureTimeline: true });
  const { timeline, ...capturedResult } = first;

  assert.equal("timeline" in withoutTimeline, false, "bulk simulations must not capture playback by default");
  assert.deepEqual(capturedResult, withoutTimeline, "capture must not consume RNG or alter combat rewards/results");
  assert.deepEqual(first.timeline, second.timeline);
  assert.equal(timeline.version, 1);
  assert.ok(timeline.combatants.length >= 2);
  assert.ok(timeline.frames.length > 0);
  assert.deepEqual(timeline.frames.map((frame) => frame.seq), timeline.frames.map((_, index) => index + 1));
  assert.ok(timeline.frames.every((frame, index, frames) => index === 0 || frame.round >= frames[index - 1].round));

  const finalByInstance = new Map(timeline.combatants.map((actor) => [actor.instanceId, {
    hp: actor.hp,
    mp: actor.mp,
    alive: actor.alive,
  }]));
  for (const frame of timeline.frames) {
    for (const effect of frame.effects) {
      const current = finalByInstance.get(effect.targetInstanceId);
      assert.ok(current, `${effect.targetInstanceId} must be one of the initial combatants`);
      assert.equal(effect.hpBefore, current.hp);
      assert.equal(effect.mpBefore, current.mp);
      assert.equal(effect.aliveBefore, current.alive);
      finalByInstance.set(effect.targetInstanceId, {
        hp: effect.hpAfter,
        mp: effect.mpAfter,
        alive: effect.aliveAfter,
      });
    }
  }
  const finalActors = [...first.players, ...first.enemies];
  timeline.combatants.forEach((combatant, index) => {
    const final = finalByInstance.get(combatant.instanceId);
    assert.equal(final.hp, finalActors[index].hp);
    assert.equal(final.mp, finalActors[index].mp ?? combatant.mp);
    assert.equal(final.alive, finalActors[index].alive);
  });
});

test("timeline includes deterministic end-of-round resource effects", () => {
  const first = simulateBattle({
    data,
    seed: "round-effect-4",
    monsterIds: ["MON-0010"],
    playerBuild: observerBuild(),
    maxTurns: 5,
    captureTimeline: true,
  });
  const second = simulateBattle({
    data,
    seed: "round-effect-4",
    monsterIds: ["MON-0010"],
    playerBuild: observerBuild(),
    maxTurns: 5,
    captureTimeline: true,
  });
  const roundEffects = first.timeline.frames.filter((frame) => frame.phase === "round_end");

  assert.deepEqual(first.timeline, second.timeline);
  assert.ok(roundEffects.length > 0);
  assert.ok(roundEffects.some((frame) => frame.effects.some((effect) => effect.hpAfter < effect.hpBefore)));
});

test("MON-0076 candidate exhaustion is diagnosed and falls back to normal attacks", () => {
  const result = simulateBattle({
    data,
    seed: "blackridge-wing-scout-regression",
    monsterIds: ["MON-0076"],
    playerBuild: observerBuild(),
    maxTurns: 5,
  });

  assert.equal(result.winner, "draw");
  assert.equal(result.turns, 5);
  assert.equal(result.actionUsage["MSK-0016"], 1, "the turn-one-only action must not repeat");
  assert.equal(result.candidateExhaustion, 4);
  assert.equal(result.fallbackAttacks, 4);
  assert.equal(result.diagnostics.counts.candidateExhaustion, 4);
  assert.ok(result.actionUsage.__normal__ >= result.fallbackAttacks);
  assert.ok(result.players[0].alive, "fallback behavior must progress battle without crashing");
});

test("Monte Carlo reports win, turns, MP, usage and exhaustion per build", () => {
  const builds = createDefaultBuilds(data).slice(0, 2);
  assert.equal(new Set(builds.map((build) => build.level)).size, 2);
  assert.ok(builds.every((build) => build.equipmentIds.length > 0));

  const options = {
    data,
    seed: "battle-monte-carlo-regression",
    encounterId: "ENC-0001",
    builds,
    runs: 16,
    maxTurns: 50,
  };
  const first = runMonteCarlo(options);
  const second = runMonteCarlo(options);
  assert.deepEqual(first, second);
  assert.equal(first.runsPerBuild, 16);
  assert.equal(first.builds.length, 2);

  for (const report of first.builds) {
    assert.equal(report.wins + report.losses + report.draws, 16);
    assert.ok(report.winRate >= 0 && report.winRate <= 1);
    assert.ok(report.averageTurns >= 1 && report.averageTurns <= 50);
    assert.ok(report.averageMpSpent >= 0);
    assert.ok(report.averageMpRemaining >= 0);
    assert.ok(Object.keys(report.actionUsage).length > 0);
    assert.ok(report.candidateExhaustionBattleRate >= 0);
    assert.ok(report.candidateExhaustionBattleRate <= 1);
    assert.ok(report.playerResourceExhaustionBattleRate >= 0);
    assert.ok(report.playerResourceExhaustionBattleRate <= 1);
    assert.ok(Number.isFinite(report.playerResourceExhaustionEvents));
    assert.ok(Number.isFinite(report.fallbackAttacks));
  }
});
