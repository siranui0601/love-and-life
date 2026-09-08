import { createHash } from 'node:crypto';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function commandPurpose(command) {
  switch (command.command) {
    case 'DAMAGE': return command.target === 'all_enemies' ? '全体damage' : '単体damage';
    case 'HEAL': return '回復・sustain';
    case 'APPLY_DEBUFF': return `状態異常:${command.debuffId ?? 'debuff'}`;
    case 'APPLY_MODIFIER': return Number(command.stage ?? 0) < 0 ? `能力低下:${command.modifier}` : `能力強化:${command.modifier}`;
    case 'APPLY_SPECIAL_STATE': return `stance/state:${command.stateId}`;
    case 'MODIFY_CRITICAL': return '会心率変更';
    case 'MODIFY_RESOURCE': return `resource変更:${command.resource}`;
    case 'REMOVE_DEBUFF': return '状態異常解除';
    case 'REMOVE_MODIFIER': return '能力変化解除';
    case 'SUMMON_UNIT': return `召喚:${command.unitPool}`;
    case 'MODIFY_FIELD': return `field変化:${command.fieldEffect}`;
    case 'MODIFY_ESCAPE': return '撤退';
    case 'INTERRUPT_CAST': return '詠唱中断';
    case 'COPY_LAST_ENEMY_SKILL': return '直前skill模倣';
    default: return `未対応:${command.command}`;
  }
}

export function monsterSkillPurpose(skill) {
  return unique((skill.commands ?? []).map(commandPurpose));
}

function actionAudit(data, action) {
  const skill = data.monsterSkillById.get(action.skillId);
  return {
    actionId: action.id,
    skillId: action.skillId,
    skillName: skill?.name ?? action.skillName,
    useCondition: action.condition || 'always',
    priority: action.priority,
    authoredWeight: action.baseWeight,
    cooldown: action.cooldownOverride ?? skill?.cooldown ?? 0,
    battleUseLimit: action.usesPerBattle,
    resource: { type: 'MP', cost: Number(skill?.mpCost ?? 0) },
    target: action.targetPolicy === 'resolver_default' ? skill?.target : action.targetPolicy,
    purpose: monsterSkillPurpose(skill ?? { commands: [] }),
    commandTypes: unique((skill?.commands ?? []).map((command) => command.command)),
    runtimeReady: skill?.implementationStatus === 'runtime_ready',
  };
}

function tacticalIdentity(monster, purposes, boss) {
  if (boss?.intendedRole) return boss.intendedRole;
  const lead = monster.description || `${monster.name}は${monster.role}型の敵`;
  const focus = unique(purposes).slice(0, 3).join('・');
  return focus ? `${lead} 戦闘では${focus}を軸にする。` : `${lead}。`;
}

function encounterRowsForMonster(data, monsterId) {
  return data.encounters
    .filter((encounter) => encounter.composition.some((entry) => entry.monsterId === monsterId))
    .map((encounter) => ({
      encounterId: encounter.id,
      name: encounter.name,
      region: encounter.region,
      route: encounter.route,
      dangerTier: encounter.dangerTier,
      condition: encounter.condition,
    }));
}

function bossAuditRow(data, boss) {
  const monster = data.monsterById.get(boss.monsterId);
  const actions = (data.actionsByMonsterId.get(boss.monsterId) ?? []).map((action) => actionAudit(data, action));
  const authoredWeightTotal = actions.reduce((sum, action) => sum + action.authoredWeight, 0);
  for (const action of actions) {
    action.nominalWeightSharePct = authoredWeightTotal ? Number((action.authoredWeight / authoredWeightTotal * 100).toFixed(2)) : 0;
    action.runtimeProbability = 'eligible highest-priority-band actions are reweighted; conditions/cooldown/resource make probability state-dependent';
  }
  return {
    bossId: boss.bossId,
    monsterId: boss.monsterId,
    monster: monster?.name,
    incident: boss.incidentId,
    recommendedLevel: `${monster?.recommendedLevelMin}-${monster?.recommendedLevelMax}`,
    intendedRole: boss.intendedRole,
    phaseCount: boss.phases.length,
    phases: boss.phases,
    coreGimmicks: boss.coreGimmicks,
    telegraphMethods: boss.telegraphMethods,
    telegraphs: boss.telegraphs,
    playerCounterplayCandidates: boss.counterplayCandidates,
    supportedBuilds: boss.supportedBuilds,
    commonFailures: boss.commonFailures,
    enemySkills: actions,
    aiConditions: actions.map((action) => ({
      actionId: action.actionId,
      skillId: action.skillId,
      condition: action.useCondition,
      priority: action.priority,
      authoredWeight: action.authoredWeight,
      cooldown: action.cooldown,
    })),
    victoryCondition: boss.victoryCondition,
    encounters: encounterRowsForMonster(data, boss.monsterId),
  };
}

function compositionRoles(data, encounter) {
  return encounter.composition.map((entry) => {
    const monster = data.monsterById.get(entry.monsterId);
    return {
      monsterId: entry.monsterId,
      monsterName: monster?.name ?? entry.monsterName,
      role: monster?.role ?? null,
      countMin: Number(entry.countMin ?? 1),
      countMax: Number(entry.countMax ?? entry.countMin ?? 1),
      includeChance: Number(entry.includeChance ?? 1),
    };
  });
}

export function buildCombatContentAudit(data) {
  const canonicalPayload = {
    monsters: data.monsters.map((entry) => entry.raw),
    monsterSkills: data.monsterSkills.map((entry) => entry.raw),
    monsterActions: data.monsterActions.map((entry) => entry.raw),
    encounters: data.encounters.map((entry) => entry.raw),
  };
  const sourceHash = createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
  const monsters = data.monsters.map((monster) => {
    const actions = (data.actionsByMonsterId.get(monster.id) ?? []).map((action) => actionAudit(data, action));
    const authoredWeightTotal = actions.reduce((sum, action) => sum + action.authoredWeight, 0);
    for (const action of actions) {
      action.nominalWeightSharePct = authoredWeightTotal ? Number((action.authoredWeight / authoredWeightTotal * 100).toFixed(2)) : 0;
      action.runtimeProbability = 'eligible highest-priority-band actions are reweighted; conditions/cooldown/resource make probability state-dependent';
    }
    const purposes = actions.flatMap((action) => action.purpose);
    const boss = data.bossByMonsterId.get(monster.id);
    return {
      monsterId: monster.id,
      name: monster.name,
      level: monster.level,
      recommendedLevelMin: monster.recommendedLevelMin,
      recommendedLevelMax: monster.recommendedLevelMax,
      role: monster.role,
      intelligenceProfile: monster.aiProfile,
      boss: monster.boss,
      tacticalIdentity: tacticalIdentity(monster, purposes, boss),
      actionCount: actions.length,
      skillCount: new Set(actions.map((action) => action.skillId)).size,
      unconditionalActionCount: actions.filter((action) => action.useCondition === 'always').length,
      actions,
      encounterCount: encounterRowsForMonster(data, monster.id).length,
    };
  });
  const commandTypes = unique(data.monsterSkills.flatMap((skill) => skill.commands.map((command) => command.command))).sort();
  const multiRoleEncounters = data.encounters.filter((encounter) => (
    new Set(compositionRoles(data, encounter).map((entry) => entry.role)).size >= 2
  )).length;
  return {
    schemaVersion: 'combat-content-audit-v1',
    generatedAt: '2026-08-16',
    source: data.source,
    canonicalCombatSource: {
      spreadsheetId: data.source.spreadsheetId,
      sheets: {
        'モンスター一覧': { rows: data.monsters.length, columns: 32 },
        'モンスタースキル': { rows: data.monsterSkills.length, columns: 13 },
        'モンスター行動': { rows: data.monsterActions.length, columns: 12 },
        '地域別エンカウント': { rows: data.encounters.length, columns: 15 },
      },
      amendedAt: '2026-08-16',
      sha256: sourceHash,
    },
    counts: {
      monsters: data.monsters.length,
      bosses: data.monsters.filter((monster) => monster.boss).length,
      monsterSkills: data.monsterSkills.length,
      monsterActions: data.monsterActions.length,
      encounters: data.encounters.length,
      multiRoleEncounters,
    },
    runtimeContract: {
      enemySelection: data.assumptions.enemySelection,
      priorityBand: data.assumptions.enemyPriorityBand,
      candidateExhaustion: data.assumptions.candidateExhaustion,
      supportedCommandTypes: commandTypes,
      unresolvedCommands: data.audit.unknownCommands,
      unresolvedSpecialStateSemantics: data.audit.unknownSpecialStateSemantics,
      unresolvedDebuffSemantics: data.audit.unknownDebuffSemantics,
      unresolvedStateReferences: data.audit.unresolvedStateReferences,
      unresolvedModifierReferences: data.audit.unresolvedModifierReferences,
      monstersWithoutUnconditionalAction: data.audit.monstersWithoutUnconditionalAction,
      bossesMissingCombatCatalog: data.audit.bossesMissingCombatCatalog,
      bossCatalogIssues: data.audit.bossCatalogIssues,
      runtimeReady: data.audit.unknownCommands.length === 0
        && data.audit.unknownSpecialStateSemantics.length === 0
        && data.audit.unknownDebuffSemantics.length === 0
        && data.audit.unresolvedStateReferences.length === 0
        && data.audit.unresolvedModifierReferences.length === 0
        && data.audit.monstersWithoutUnconditionalAction.length === 0
        && data.audit.bossesMissingCombatCatalog.length === 0
        && data.audit.bossCatalogIssues.length === 0,
    },
    monsters,
    bosses: data.bossCatalog.bosses.map((boss) => bossAuditRow(data, boss)),
    encounters: data.encounters.map((encounter) => ({
      encounterId: encounter.id,
      name: encounter.name,
      region: encounter.region,
      route: encounter.route,
      dangerTier: encounter.dangerTier,
      composition: compositionRoles(data, encounter),
      distinctRoles: new Set(compositionRoles(data, encounter).map((entry) => entry.role)).size,
    })),
    unassignedGenericSkills: data.audit.unusedMonsterSkills.map((skillId) => {
      const skill = data.monsterSkillById.get(skillId);
      return {
        skillId,
        name: skill?.name,
        purpose: monsterSkillPurpose(skill ?? { commands: [] }),
        status: 'runtime_ready_unassigned_generic',
      };
    }),
  };
}

function actionId(frame) {
  return frame.action?.skillId ?? frame.action?.actionId ?? frame.action?.kind ?? null;
}

function maximumConsecutiveRun(frames) {
  let maximum = 0;
  let current = 0;
  let previous = null;
  for (const frame of frames) {
    const id = actionId(frame);
    if (!id) continue;
    current = id === previous ? current + 1 : 1;
    previous = id;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function maximumConsecutiveRunPerActor(frames) {
  const byActor = new Map();
  for (const frame of frames) {
    const actorFrames = byActor.get(frame.actorInstanceId) ?? [];
    actorFrames.push(frame);
    byActor.set(frame.actorInstanceId, actorFrames);
  }
  return Math.max(0, ...[...byActor.values()].map(maximumConsecutiveRun));
}

function distribution(frames) {
  const counts = new Map();
  for (const frame of frames) {
    const id = actionId(frame);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

/**
 * Analyze a deterministic timeline.  This deliberately reports evidence and
 * does not impose a brittle "same action three times = failure" threshold.
 */
export function certifyBattleTimeline(result, metadata = {}) {
  const frames = result.timeline?.frames ?? [];
  const playerActions = frames.filter((frame) => frame.phase === 'action' && frame.actorSide === 'player');
  const enemyActions = frames.filter((frame) => frame.phase === 'action' && frame.actorSide === 'enemy');
  const events = frames.flatMap((frame) => frame.events ?? []);
  const changedStatuses = frames.filter((frame) => frame.effects?.some((effect) => (
    effect.statusesBefore || effect.statusesAfter
  )));
  const resourceDecisions = playerActions.filter((frame) => frame.effects?.some((effect) => (
    effect.mpBefore !== effect.mpAfter || effect.hpBefore !== effect.hpAfter
  )));
  const meaningfulChoices = playerActions.filter((frame) => (
    new Set(frame.availablePlayerActionIds ?? []).size >= 2
  ));
  const gimmickEvents = events.filter((event) => [
    'phase_transition', 'telegraph', 'summon', 'field_change', 'copy_skill', 'escape', 'interrupt',
  ].includes(event.type));
  return {
    certificationId: metadata.certificationId ?? null,
    bossId: metadata.bossId ?? null,
    monsterId: metadata.monsterId ?? null,
    seed: result.seed,
    winner: result.winner,
    battleRounds: result.turns,
    meaningfulPlayerChoiceCount: meaningfulChoices.length,
    playerActionCount: playerActions.length,
    enemyActionCount: enemyActions.length,
    enemySkillUseCount: enemyActions.filter((frame) => frame.action?.kind === 'skill').length,
    enemyActionVariety: new Set(enemyActions.map(actionId).filter(Boolean)).size,
    playerSkillVariety: new Set(playerActions.filter((frame) => frame.action?.kind === 'skill').map(actionId)).size,
    maximumConsecutivePlayerAction: maximumConsecutiveRunPerActor(playerActions),
    maximumConsecutiveEnemyAction: maximumConsecutiveRunPerActor(enemyActions),
    playerActionDistribution: distribution(playerActions),
    enemyActionDistribution: distribution(enemyActions),
    phaseTransitions: events.filter((event) => event.type === 'phase_transition'),
    statusBuffDebuffFrames: changedStatuses.length,
    resourceDecisionCount: resourceDecisions.length,
    gimmickInteractionCount: gimmickEvents.length,
    gimmickEvents,
    basicRecoveryAttacks: Number(result.diagnostics?.counts?.basicRecoveryAttack ?? 0),
    fallbackAttacks: result.fallbackAttacks,
    candidateExhaustion: result.candidateExhaustion,
  };
}
