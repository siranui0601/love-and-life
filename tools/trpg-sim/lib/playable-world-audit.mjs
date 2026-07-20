import {
  availableGameRuntimeActions,
  createGameRuntime,
  executeGameRuntimeCommand,
  gameStateHash,
  TRPG_GAME_RESOLVER_VERSION,
} from "../../../src/server/trpg/game/service.js";
import { listInteractiveBattleCommands } from "./battle-simulator.mjs";
import { npcPopulationSummary, presentNpcsAt } from "../../../src/server/trpg/game/presence.js";
import { loadTrpgGameData } from "../../../src/server/trpg/game/game-data.js";
import { GAME_END_MINUTE } from "./player-journey.mjs";

function increment(root, key) {
  root[key] = Number(root[key] ?? 0) + 1;
}

function activeMissionStep(runtime, missionId) {
  const definition = runtime.playerState.catalog.special.find((mission) => mission.id === missionId);
  const current = runtime.playerState.missions[missionId];
  if (!definition || current?.status !== "active") return null;
  return definition.steps.find((step) => Number(current.progress[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function movementToward(actions, state, step) {
  if (!step) return null;
  const targetHub = step.targetLocation;
  if (targetHub && targetHub !== state.player.location) {
    return actions.movement.find((move) => move.movementScope === "regional" && move.destinationHub === targetHub) ?? null;
  }
  if (step.targetFacilityId && step.targetFacilityId !== state.player.facilityId) {
    return actions.movement.find((move) => move.movementScope === "local" && move.destinationFacilityId === step.targetFacilityId) ?? null;
  }
  return null;
}

function affordableUpgrade(runtime, data, stock) {
  return stock
    .filter((entry) => entry.price <= runtime.playerState.player.gold)
    .map((entry) => ({ entry, equipment: data.battleData.equipmentById.get(entry.equipmentId) }))
    .filter(({ equipment }) => equipment)
    .filter(({ equipment }) => {
      const currentId = runtime.playerState.player.equipment[equipment.slot];
      const current = currentId ? data.battleData.equipmentById.get(currentId) : null;
      return Number(equipment.performanceIndex ?? 0) > Number(current?.performanceIndex ?? 0);
    })
    .sort((left, right) => Number(right.equipment.performanceIndex ?? 0) - Number(left.equipment.performanceIndex ?? 0)
      || left.entry.price - right.entry.price)[0]?.entry ?? null;
}

function activeBattleCommand(runtime, data, counters) {
  const pending = runtime.pendingBattle;
  if (!pending?.session || pending.session.status !== "active") return null;
  const commands = listInteractiveBattleCommands({ data: data.battleData, session: pending.session });
  const selected = commands.find((command) => command.actionId === "ATTACK" && command.available)
    ?? commands.find((command) => command.available);
  if (!selected) {
    counters.invariantViolations.push({
      code: "battle_command_missing",
      minute: runtime.playerState.absoluteMinute,
      battleId: pending.id,
    });
    return null;
  }
  return {
    type: "BATTLE_ACT",
    payload: {
      battleId: pending.id,
      actionId: selected.actionId,
      targetInstanceId: selected.targets?.[0]?.instanceId ?? null,
    },
  };
}

function tutorialRequiresMovement(runtime) {
  return Boolean(runtime.tutorial && ["movement", "movement_aftermath"].includes(runtime.tutorial.stage));
}

function choosePolicyCommand(runtime, data, policy, counters) {
  const actions = availableGameRuntimeActions(runtime, data);
  const battleCommand = activeBattleCommand(runtime, data, counters);
  if (battleCommand) return battleCommand;

  if (tutorialRequiresMovement(runtime)) {
    if (actions.choices.length !== 0) {
      counters.invariantViolations.push({ code: "tutorial_movement_exposed_choices", minute: runtime.playerState.absoluteMinute });
    }
    const guidedMove = actions.movement.find((move) => move.destinationFacilityId === "LOC_FARM_SQUARE")
      ?? actions.movement[0];
    if (!guidedMove) {
      counters.invariantViolations.push({ code: "tutorial_movement_missing", minute: runtime.playerState.absoluteMinute });
      return null;
    }
    return { type: "MOVE", payload: { moveId: guidedMove.id } };
  }

  if (actions.choices.length !== 3 || new Set(actions.choices.map((choice) => choice.choiceId)).size !== 3) {
    counters.invariantViolations.push({ code: "choice_contract", minute: runtime.playerState.absoluteMinute });
  }

  const skillsUnlocked = !runtime.tutorial || runtime.tutorial.stage === "free";
  if (skillsUnlocked && actions.learnableSkills.length && counters.zeroTimeStreak < 2) {
    return { type: "LEARN_SKILL", payload: { skillId: actions.learnableSkills[0].id } };
  }

  if (policy.resolveT01 && runtime.playerState.troubles.T01.status === "active") {
    const step = activeMissionStep(runtime, "MSN-T01");
    const move = movementToward(actions, runtime.playerState, step);
    if (move) return { type: "MOVE", payload: { moveId: move.id } };
    const choice = actions.choices
      .filter((candidate) => candidate.missionId === "MSN-T01" && candidate.stepId === step?.id)
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    if (choice) return { type: "CHOOSE", payload: { choiceId: choice.choiceId, actionId: choice.id } };
  }

  const upgrade = affordableUpgrade(runtime, data, actions.stock);
  if (upgrade && counters.purchases < policy.purchaseLimit) {
    return { type: "SHOP_BUY", payload: { stockId: upgrade.id } };
  }

  if (policy.id === "merchant" && runtime.playerState.player.gold >= 8 && !actions.stock.length) {
    const seller = actions.movement
      .filter((move) => move.movementScope === "local")
      .find((move) => data.battleData.inventory.some((stock) => stock.location === runtime.playerState.player.location
        && stock.sellerId === move.destinationFacilityId));
    if (seller) return { type: "MOVE", payload: { moveId: seller.id } };
  }

  if (policy.longTravel) {
    const regional = actions.movement
      .filter((move) => move.movementScope === "regional")
      .sort((left, right) => right.minutes - left.minutes || left.id.localeCompare(right.id))[0];
    if (regional) return { type: "MOVE", payload: { moveId: regional.id } };
  }

  const safe = actions.choices
    .filter((choice) => !["seekBattle", "missionBattle", "investigate"].includes(choice.type))
    .sort((left, right) => Number(right.minutes ?? 0) - Number(left.minutes ?? 0) || left.id.localeCompare(right.id))[0]
    ?? actions.choices[0];
  if (!safe) {
    counters.invariantViolations.push({ code: "free_choice_missing", minute: runtime.playerState.absoluteMinute });
    return null;
  }
  return { type: "CHOOSE", payload: { choiceId: safe.choiceId, actionId: safe.id } };
}

function checkPresence(runtime, data, counters) {
  const present = presentNpcsAt(runtime, data);
  const ids = new Set();
  for (const npc of present) {
    if (ids.has(npc.id)) counters.invariantViolations.push({ code: "duplicate_present_npc", npcId: npc.id });
    ids.add(npc.id);
    if (npc.presence !== "present" || ["dead", "missing"].includes(npc.lifeStatus)) {
      counters.invariantViolations.push({ code: "inactive_present_npc", npcId: npc.id, presence: npc.presence, lifeStatus: npc.lifeStatus });
    }
    if (npc.locationId !== runtime.playerState.player.location || npc.facilityId !== runtime.playerState.player.facilityId) {
      counters.invariantViolations.push({ code: "remote_present_npc", npcId: npc.id });
    }
  }
  const finn = runtime.livingWorld.npcStates.NPC001;
  if (["missing", "dead"].includes(finn.lifeStatus) && ids.has("NPC001")) {
    counters.invariantViolations.push({ code: "finn_visible_while_inactive", lifeStatus: finn.lifeStatus });
  }
}

const POLICIES = Object.freeze({
  story: Object.freeze({ id: "story", profileId: "story", resolveT01: true, longTravel: true, purchaseLimit: 3 }),
  fighter: Object.freeze({ id: "fighter", profileId: "fighter", resolveT01: false, longTravel: true, purchaseLimit: 2 }),
  merchant: Object.freeze({ id: "merchant", profileId: "merchant", resolveT01: false, longTravel: false, purchaseLimit: 5 }),
});

export function runPlayableWorldScenario({
  policyId = "story",
  seed = `playable-audit:${policyId}`,
  endMinute = GAME_END_MINUTE,
  maxCommands = 5000,
  tutorial = true,
  data = loadTrpgGameData(),
} = {}) {
  const policy = POLICIES[policyId];
  if (!policy) throw new Error(`Unknown playable audit policy: ${policyId}`);
  const runtime = createGameRuntime(data, {
    seed,
    profileId: policy.profileId,
    playerName: `監査-${policyId}`,
    tutorial,
  });
  const counters = {
    commands: 0,
    byType: {},
    purchases: 0,
    rejected: 0,
    zeroTimeStreak: 0,
    invariantViolations: [],
  };

  while (runtime.playerState.absoluteMinute < endMinute && counters.commands < maxCommands) {
    checkPresence(runtime, data, counters);
    const before = runtime.playerState.absoluteMinute;
    const command = choosePolicyCommand(runtime, data, policy, counters);
    if (!command) break;
    try {
      executeGameRuntimeCommand(runtime, data, command);
      counters.commands += 1;
      increment(counters.byType, command.type);
      if (command.type === "SHOP_BUY") counters.purchases += 1;
      const after = runtime.playerState.absoluteMinute;
      counters.zeroTimeStreak = command.type === "BATTLE_ACT"
        ? 0
        : after === before
          ? counters.zeroTimeStreak + 1
          : 0;
      if (after < before) counters.invariantViolations.push({ code: "time_reversed", before, after });
      if (counters.zeroTimeStreak > 5) counters.invariantViolations.push({ code: "zero_time_loop", minute: after });
    } catch (error) {
      counters.rejected += 1;
      counters.invariantViolations.push({ code: "policy_command_rejected", command, reason: error.code ?? error.message });
      // A rejected direct-runtime command may have partially simulated a
      // battle. Audit policies are chosen to avoid this; stop if it happens.
      break;
    }
  }

  checkPresence(runtime, data, counters);
  const troubleCounts = Object.values(runtime.playerState.troubles).reduce((counts, trouble) => {
    increment(counts, trouble.status);
    return counts;
  }, {});
  const npcStates = Object.values(runtime.livingWorld.npcStates);
  const activeNpcCount = npcStates.filter((state) => Number(state.activityTicks ?? 0) > 0).length;
  const tracedNpcCount = Object.values(runtime.livingWorld.npcTraces).filter((trace) => trace.length > 0).length;
  const result = {
    policyId,
    profileId: policy.profileId,
    seed,
    contentRevision: data.contentRevision,
    resolverVersion: TRPG_GAME_RESOLVER_VERSION,
    reachedEnd: runtime.playerState.absoluteMinute >= endMinute,
    day: runtime.playerState.day,
    absoluteMinute: runtime.playerState.absoluteMinute,
    commands: counters.commands,
    commandsByType: counters.byType,
    rejectedCommands: counters.rejected,
    level: runtime.playerState.player.level,
    exp: runtime.playerState.player.exp,
    sp: runtime.playerState.player.sp,
    learnedSkills: runtime.playerState.player.skills.size,
    gold: runtime.playerState.player.gold,
    purchases: runtime.playerState.metrics.purchases,
    battles: runtime.playerState.metrics.battles,
    wins: runtime.playerState.metrics.wins,
    losses: runtime.playerState.metrics.losses,
    missionsCompleted: runtime.playerState.progress.missions.totalCompleted,
    troubleCounts,
    resolvedTroubleIds: [...runtime.playerState.progress.missions.resolvedTroubleIds].sort(),
    t01: {
      troubleStatus: runtime.playerState.troubles.T01.status,
      missionStatus: runtime.playerState.missions["MSN-T01"].status,
      finnLifeStatus: runtime.livingWorld.npcStates.NPC001.lifeStatus,
      finnPresence: runtime.livingWorld.npcStates.NPC001.presence,
      playerRescueEvent: runtime.livingWorld.lifeEvents.some((event) => event.npcId === "NPC001" && event.cause === "player-resolved-t01"),
    },
    npc: {
      total: npcStates.length,
      activeNpcCount,
      tracedNpcCount,
      population: npcPopulationSummary(runtime),
      decisions: runtime.livingWorld.decisionEvents.length,
      knowledgeEvents: runtime.livingWorld.knowledgeEvents.length,
      lifeEvents: runtime.livingWorld.lifeEvents.length,
      localMovements: runtime.livingWorld.localMovementEvents.length,
      rumorSources: runtime.livingWorld.seededTroubleFacts.size,
    },
    shopDiagnostics: runtime.playerState.shop.diagnostics.length,
    invariantViolations: counters.invariantViolations,
    stateHash: gameStateHash(runtime, data),
  };
  result.ok = result.reachedEnd
    && result.rejectedCommands === 0
    && result.invariantViolations.length === 0
    && result.npc.tracedNpcCount === result.npc.total
    && Number(result.troubleCounts.resolved ?? 0) < data.model.troubles.length;
  return result;
}

export function runPlayableWorldAudit({ data = loadTrpgGameData() } = {}) {
  const scenarios = [
    runPlayableWorldScenario({ policyId: "story", seed: "playable-audit:story", data }),
    runPlayableWorldScenario({ policyId: "fighter", seed: "playable-audit:fighter", data }),
    runPlayableWorldScenario({ policyId: "merchant", seed: "playable-audit:merchant", data }),
  ];
  const replay = runPlayableWorldScenario({ policyId: "story", seed: "playable-audit:story", data });
  const story = scenarios[0];
  return {
    schemaVersion: "playable-world-audit-v1",
    contentRevision: data.contentRevision,
    resolverVersion: TRPG_GAME_RESOLVER_VERSION,
    scenarioCount: scenarios.length,
    allPassed: scenarios.every((scenario) => scenario.ok),
    deterministicReplay: story.stateHash === replay.stateHash
      && story.commands === replay.commands
      && JSON.stringify(story.t01) === JSON.stringify(replay.t01),
    scenarios,
    findings: {
      atLeastOnePlayerResolution: scenarios.some((scenario) => Number(scenario.troubleCounts.resolved ?? 0) > 0),
      noScenarioSolvedEverything: scenarios.every((scenario) => Number(scenario.troubleCounts.resolved ?? 0) < data.model.troubles.length),
      noPlayerT01KillsFinn: scenarios.filter((scenario) => scenario.policyId !== "story")
        .every((scenario) => scenario.t01.finnLifeStatus === "dead"),
      playerT01RescueChangesFate: story.t01.troubleStatus === "resolved"
        && story.t01.playerRescueEvent
        && !["dead", "missing"].includes(story.t01.finnLifeStatus),
      allNpcsHaveCausalTrace: scenarios.every((scenario) => scenario.npc.tracedNpcCount === scenario.npc.total),
    },
  };
}
