import { autoShop } from "./shop-runtime.mjs";
import {
  GAME_END_MINUTE, PLAYER_PROFILES_V2, availableLocalMovementActionsV2,
  availableMovementActionsV2, availableRegionalMovementActionsV2,
  advanceV2, profileByIdV2, propagateRumorsV2, updateTroublesV2,
} from "./journey-v2-core.mjs";
import { refreshSkillStateV2 } from "./journey-v2-skills.mjs";
import { refreshMissionsV2 } from "./journey-v2-missions.mjs";
import { createInitialJourneyStateV2, summarizeJourneyV2 } from "./journey-v2-state.mjs";
import {
  chooseActionV2, chooseMovementActionV2, generateChoiceActionsV2,
  movementObjectiveV2,
} from "./journey-v2-choices.mjs";
import {
  canSeekBattleV2, resolveMovementActionV2, resolvePlayerActionV2,
} from "./journey-v2-resolver.mjs";

export {
  GAME_END_MINUTE, PLAYER_PROFILES_V2, availableLocalMovementActionsV2,
  availableMovementActionsV2, availableRegionalMovementActionsV2,
  createInitialJourneyStateV2, generateChoiceActionsV2,
};

function dedupeDiagnostics(state) {
  const seen = new Set();
  state.shop.diagnostics = state.shop.diagnostics.filter((entry) => {
    const key = JSON.stringify(entry); if (seen.has(key)) return false; seen.add(key); return true;
  });
}

function shop(state, data, skills, profile) {
  if (profile.trade < .2 && state.player.gold < 80) return;
  if (!data.inventory.some((stock) => stock.location === state.player.location)) return;
  const before = state.absoluteMinute;
  const bought = autoShop(state, data, state.shop, profile, state.tuning.shop ?? {});
  state.metrics.purchases += bought.length;
  if (bought.length && state.absoluteMinute === before) state.metrics.zeroTimePurchases += bought.length;
  dedupeDiagnostics(state);
  if (bought.length) refreshSkillStateV2(state, data, skills, profile);
}

export function simulatePlayerJourneyV2({
  model, battleData, skills, profile = "balanced", tuning = {},
  seed = "player-journey-v2", endMinute = GAME_END_MINUTE, maxActions = 5000,
} = {}) {
  if (!model || !battleData || !skills) throw new Error("simulatePlayerJourneyV2 requires model, battleData and skills");
  const selected = typeof profile === "string" ? profileByIdV2(profile) : profile;
  if (!selected) throw new Error(`Unknown profile ${profile}`);
  const state = createInitialJourneyStateV2({ model, battleData, skills, profile: selected, tuning, seed });

  while (state.absoluteMinute < endMinute && state.metrics.actions < maxActions) {
    updateTroublesV2(state, model);
    propagateRumorsV2(state, model);
    refreshMissionsV2(state, battleData, skills, selected);
    refreshSkillStateV2(state, battleData, skills, selected);
    shop(state, battleData, skills, selected);

    const objective = movementObjectiveV2(state, model, battleData, selected);
    if (objective) {
      const movement = chooseMovementActionV2(state, model, objective);
      if (movement) {
        resolveMovementActionV2(state, model, battleData, skills, selected, movement);
        state.metrics.actions += 1;
        refreshMissionsV2(state, battleData, skills, selected);
        continue;
      }
      if (objective.hub !== state.player.location || objective.facilityId && objective.facilityId !== state.player.facilityId) state.metrics.movementBlocked += 1;
    }

    const choices = generateChoiceActionsV2(state, model, battleData, selected, () => canSeekBattleV2(state, selected));
    if (!choices.length) {
      state.metrics.choiceDeadEnds += 1;
      advanceV2(state, model, 30, "choice-dead-end");
    } else {
      resolvePlayerActionV2(state, model, battleData, skills, selected, chooseActionV2(state, choices, selected));
    }
    state.metrics.actions += 1;
    refreshSkillStateV2(state, battleData, skills, selected);
    refreshMissionsV2(state, battleData, skills, selected);
  }

  if (state.absoluteMinute < endMinute && state.metrics.actions >= maxActions) {
    state.metrics.terminatedByActionCap = true;
    state.history.push({ type: "SIMULATION_ACTION_CAP", minute: state.absoluteMinute, maxActions });
  }
  refreshMissionsV2(state, battleData, skills, selected);
  return {
    schemaVersion: "2.0.0",
    engineVersion: "integrated-player-journey-v2",
    rngPolicy: "state-keyed non-combat outcomes; encounters and battles keyed by action attempt",
    profile: selected,
    tuning,
    summary: summarizeJourneyV2(state, model),
    state,
  };
}
