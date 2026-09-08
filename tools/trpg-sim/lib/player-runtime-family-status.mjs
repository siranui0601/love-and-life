import { GENERIC_RUNTIME_EXECUTED_FAMILIES } from './player-runtime-generic.mjs';
import { EXTENDED_RUNTIME_EXECUTED_FAMILIES } from './player-runtime-extended.mjs';

export const PLAYER_RUNTIME_FAMILY_STATUS = Object.freeze({
  EXECUTED: 'EXECUTED',
  COMPILED_ONLY: 'COMPILED_ONLY',
  PARTIAL: 'PARTIAL',
  UNMODELED: 'UNMODELED',
});

const BASE_EXECUTED = new Set([
  'ALL_MP_COST', 'APPLY_BUFF', 'APPLY_DEBUFF', 'BARRIER', 'CLEANSE_DEBUFF', 'COUNTER', 'DAMAGE',
  'DAMAGE_REDUCTION', 'GUARD', 'HEAL', 'HP_COST_MODE', 'MANA_SHIELD', 'MULTI_HIT', 'REFLECT',
  'REGENERATION', 'RESTORE_RESOURCE', 'SURVIVE_LETHAL',
]);

const CHECKPOINT_C_EXECUTED = new Set([
  'CONSUME_OWNED_FIELD', 'CREATE_OWNED_FIELD', 'GOLD_COST', 'GOLD_SPEND_SCALING',
  'REPEAT_LAST_SKILL', 'REPEAT_WHILE_HIT',
  ...GENERIC_RUNTIME_EXECUTED_FAMILIES,
  ...EXTENDED_RUNTIME_EXECUTED_FAMILIES,
]);

export function classifyPlayerRuntimeFamily(family) {
  if (BASE_EXECUTED.has(family) || CHECKPOINT_C_EXECUTED.has(family)) return PLAYER_RUNTIME_FAMILY_STATUS.EXECUTED;
  return PLAYER_RUNTIME_FAMILY_STATUS.UNMODELED;
}

export function auditPlayerRuntimeFamilies(mechanicCounts) {
  const rows = Object.entries(mechanicCounts).sort(([left], [right]) => left.localeCompare(right)).map(([family, count]) => ({
    family,
    count,
    status: classifyPlayerRuntimeFamily(family),
  }));
  const summary = Object.fromEntries(Object.values(PLAYER_RUNTIME_FAMILY_STATUS).map((status) => [status, rows.filter((row) => row.status === status).length]));
  return {
    rows,
    summary,
    unresolved: rows.filter((row) => row.status !== PLAYER_RUNTIME_FAMILY_STATUS.EXECUTED),
    partial: [],
  };
}

export const PLAYER_RUNTIME_BASE_EXECUTED_FAMILIES = BASE_EXECUTED;
export const PLAYER_RUNTIME_CHECKPOINT_C_EXECUTED_FAMILIES = CHECKPOINT_C_EXECUTED;
