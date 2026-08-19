// Checkpoint C keeps the checked-in skill master immutable.  These are explicit
// runtime semantics for authored rows whose canonical snapshot intentionally
// stores prose/provisional structure instead of executable numeric fields.
//
// Do not turn this into a generic prose interpreter: each entry is reviewed by
// skill id and exists only to make the authored intent executable.

const RESOURCE_TECHNIQUE = 'RESOURCE_TECHNIQUE';

function hasFamily(skill, family) {
  return (skill?.runtimeMechanics ?? []).some((entry) => entry?.family === family);
}

function withoutFamily(skill, family) {
  const runtimeMechanics = (skill?.runtimeMechanics ?? []).filter((entry) => entry?.family !== family);
  return runtimeMechanics.length === (skill?.runtimeMechanics ?? []).length
    ? skill
    : { ...skill, runtimeMechanics };
}

function ashBreath(skill) {
  // SKL-0665 「灰燼の息」 canonical prose:
  //   敵全体へ炎ダメージと命中を2段階下げる。
  // The provisional registry already classifies it as DAMAGE + APPLY_DEBUFF.
  // Rank 4 is converted here to a deterministic 1.45x fire-magic witness while
  // preserving the authored accuracy -2 / 3T semantics.
  return {
    ...skill,
    damage: {
      ...skill.damage,
      formula: 'fixedMultiplier',
      perHitMultiplier: 1.45,
      hits: 1,
      totalMultiplier: 1.45,
      accuracyModifier: Number(skill.damage?.accuracyModifier ?? 0) || 0,
      criticalModifier: Number(skill.damage?.criticalModifier ?? 0) || 0,
    },
    debuffs: [
      ...(skill.debuffs ?? []),
      { type: 'statStage', stat: 'accuracy', stage: -2, durationTurns: 3 },
    ],
  };
}

export function prepareCheckpointCClosureSkill(skill) {
  if (!skill) return skill;
  if (skill.id === 'SKL-0665') return ashBreath(skill);

  // An all-current-MP resource technique must remain at MP=0 after payment.
  // The generic RESOURCE_TECHNIQUE executor restores MP, which is correct for
  // ordinary resource techniques but contradicts SKL-0258's authored contract.
  // Remove only that generic family from the execution envelope; the explicit
  // post-success handler below applies this skill's actual temporary power-up.
  if (skill.costs?.mpMode === 'all_current' && hasFamily(skill, RESOURCE_TECHNIQUE)) {
    return withoutFamily(skill, RESOURCE_TECHNIQUE);
  }
  return skill;
}

function addModifier(actor, stat, stage, duration) {
  if (!actor?.modifiers) return;
  const current = actor.modifiers.get(stat);
  actor.modifiers.set(stat, {
    stage: Math.max(-6, Math.min(6, Number(current?.stage ?? 0) + Number(stage ?? 0))),
    duration: Math.max(Number(current?.duration ?? 0), Math.max(1, Number(duration ?? 1))),
  });
}

function frameFor(round, skillId) {
  return (round?.frames ?? []).find((frame) => frame?.phase === 'action'
    && frame.actorSide === 'player' && frame.action?.skillId === skillId) ?? null;
}

function attachEvent(session, round, event) {
  const frame = frameFor(round, event.skillId);
  if (frame) frame.events = [...(frame.events ?? []), event];
  const runtime = session.playerRuntimeMechanics;
  runtime.extendedEvents ??= [];
  runtime.extendedEvents.push({ turn: session.state?.turn ?? null, ...event });
}

export function applyCheckpointCClosureSuccess({ originalSkill, session, round }) {
  if (!originalSkill || !session || !round) return [];
  if (!(originalSkill.costs?.mpMode === 'all_current' && hasFamily(originalSkill, RESOURCE_TECHNIQUE))) return [];

  const actor = session.state?.players?.[0];
  if (!actor) return [];

  // SKL-0258 「魔導炉心解放」: all current MP is spent, then magic power is
  // raised for the authored 3-turn technique window.  Crucially, no MP is
  // restored by the technique itself.
  actor.mp = 0;
  const authored = (originalSkill.specialStates ?? []).find((entry) => entry?.type === 'resourceTechnique');
  const durationTurns = Math.max(1, Number(authored?.durationTurns ?? 3) || 3);
  const magnitudeRank = Math.max(1, Number(authored?.magnitudeRank ?? originalSkill.rank ?? 1) || 1);
  const magicPowerStageDelta = Math.min(3, Math.max(1, Math.ceil(magnitudeRank / 2)));
  addModifier(actor, 'magic_power', magicPowerStageDelta, durationTurns);

  const event = {
    type: 'player_runtime_mechanic',
    family: RESOURCE_TECHNIQUE,
    skillId: originalSkill.id,
    resource: 'mp',
    mpAfter: 0,
    magicPowerStageDelta,
    durationTurns,
  };
  attachEvent(session, round, event);
  return [event];
}
