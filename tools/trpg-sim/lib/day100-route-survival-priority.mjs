import { selectDay100Decision } from "./day100-player-policy.mjs";
import { selectDay100RouteDecision } from "./day100-route-strategy.mjs";

const SURVIVAL_CATEGORIES = new Set([
  "meal_consumed",
  "meal_search_move",
  "rest",
  "work",
]);

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function urgentSurvivalRequired(save) {
  const hunger = number(save?.player?.needs?.hunger);
  const fatigue = number(save?.player?.needs?.fatigue);
  const hour = number(
    save?.clock?.hour,
    Number(String(save?.clock?.time ?? "0").split(":")[0]),
  );
  const gold = number(save?.player?.gold);
  const freeMeals = number(save?.player?.freeMeals);
  return hunger >= 72
    || fatigue >= 72
    || hour >= 21
    || (gold < 12 && freeMeals <= 0 && hunger >= 45);
}

function survivalOnlySave(save) {
  return {
    ...save,
    skills: {
      ...(save?.skills ?? {}),
      learnable: [],
      learnableSkills: [],
    },
    shop: {
      ...(save?.shop ?? {}),
      available: false,
      stock: [],
      rewards: [],
      loans: [],
    },
  };
}

export function selectUrgentDay100SurvivalDecision({ save, model, state }) {
  if (!urgentSurvivalRequired(save)) return null;
  const decision = selectDay100Decision({
    save: survivalOnlySave(save),
    model,
    state,
  });
  return SURVIVAL_CATEGORIES.has(decision?.category) ? decision : null;
}

export function selectDay100RouteDecisionWithSurvival(args) {
  return selectUrgentDay100SurvivalDecision(args)
    ?? selectDay100RouteDecision(args);
}

export const DAY100_ROUTE_SURVIVAL_PRIORITY_INTERNALS = Object.freeze({
  SURVIVAL_CATEGORIES,
  survivalOnlySave,
  urgentSurvivalRequired,
});
