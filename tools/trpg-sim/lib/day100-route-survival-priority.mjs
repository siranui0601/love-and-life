import { selectDay100Decision } from "./day100-player-policy.mjs";
import { selectDay100RouteDecision } from "./day100-route-strategy.mjs";

const SURVIVAL_CATEGORIES = new Set([
  "meal_consumed",
  "meal_search_move",
  "rest",
  "work",
]);
const LOCAL_SHELTER_PATTERN = /(?:宿|旅籠|食堂|酒場|茶屋|パン|市場|野営|キャンプ|小屋|INN|CAMP|HUT|MARKET)/iu;
const REST_PATTERN = /(?:LODGE|SLEEP|CAMP|REST|宿泊|眠|休む|野営)/iu;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function actionText(entry) {
  return `${entry?.actionId ?? entry?.moveId ?? ""} ${entry?.label ?? ""} ${entry?.destinationFacilityName ?? ""}`;
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

function movementForDecision(save, decision) {
  if (decision?.type !== "MOVE") return null;
  return (save?.movement ?? []).find((entry) => entry.moveId === decision.moveId) ?? null;
}

function localEmergencyAlternative(save) {
  const localShelter = (save?.movement ?? [])
    .filter((entry) => entry.scope === "local")
    .find((entry) => LOCAL_SHELTER_PATTERN.test(actionText(entry)));
  if (localShelter) {
    return {
      type: "MOVE",
      payload: { moveId: localShelter.moveId },
      moveId: localShelter.moveId,
      key: `MOVE:${localShelter.moveId}`,
      label: localShelter.label,
      reason: "行動不能になる前に、同じ地域の食事・休息拠点へ退避する",
      category: "meal_search_move",
    };
  }

  const rest = (save?.choices ?? []).find((entry) =>
    entry.type === "rest" || REST_PATTERN.test(actionText(entry)));
  if (!rest) return null;
  return {
    type: "CHOOSE",
    payload: { choiceId: rest.choiceId },
    actionId: rest.actionId,
    key: `CHOOSE:${rest.actionId}`,
    label: rest.label,
    reason: "地域越境を避け、現在地で倒れる前に休息する",
    category: "rest",
  };
}

export function selectUrgentDay100SurvivalDecision({ save, model, state }) {
  if (!urgentSurvivalRequired(save)) return null;
  const decision = selectDay100Decision({
    save: survivalOnlySave(save),
    model,
    state,
  });
  if (!SURVIVAL_CATEGORIES.has(decision?.category)) return null;

  const movement = movementForDecision(save, decision);
  if (movement?.scope === "regional") {
    return localEmergencyAlternative(save) ?? decision;
  }
  return decision;
}

export function selectDay100RouteDecisionWithSurvival(args) {
  return selectUrgentDay100SurvivalDecision(args)
    ?? selectDay100RouteDecision(args);
}

export const DAY100_ROUTE_SURVIVAL_PRIORITY_INTERNALS = Object.freeze({
  LOCAL_SHELTER_PATTERN,
  SURVIVAL_CATEGORIES,
  localEmergencyAlternative,
  movementForDecision,
  survivalOnlySave,
  urgentSurvivalRequired,
});
