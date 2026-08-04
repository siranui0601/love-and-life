import { selectDay100Decision } from "./day100-player-policy.mjs";
import { selectDay100RouteDecision } from "./day100-route-strategy.mjs";

const SURVIVAL_CATEGORIES = new Set([
  "meal_consumed",
  "meal_search_move",
  "rest",
  "work",
]);
const LOCAL_SHELTER_PATTERN = /(?:宿|旅籠|食堂|酒場|茶屋|パン|市場|野営|キャンプ|小屋|INN|CAMP|HUT|MARKET)/iu;
const MEAL_PATTERN = /(?:^EAT:|食事|食べ|まかない)/iu;
const WORK_MEAL_PATTERN = /(?:^WORK_MEAL:|まかない|手伝)/iu;
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

function choiceDecision(choice, reason, category) {
  if (!choice) return null;
  const actionId = choice.actionId ?? choice.choiceId;
  return {
    type: "CHOOSE",
    payload: { choiceId: choice.choiceId ?? actionId },
    actionId,
    key: `CHOOSE:${actionId}`,
    label: choice.label,
    reason,
    category,
  };
}

function localRecoveryChoice(save) {
  const choices = save?.choices ?? [];
  const hunger = number(save?.player?.needs?.hunger);
  const fatigue = number(save?.player?.needs?.fatigue);
  const hour = number(
    save?.clock?.hour,
    Number(String(save?.clock?.time ?? "0").split(":")[0]),
  );

  if (hunger >= 45) {
    const meal = choices.find((entry) =>
      entry.type === "eat" || (MEAL_PATTERN.test(actionText(entry)) && !WORK_MEAL_PATTERN.test(actionText(entry))));
    if (meal) {
      return choiceDecision(meal, "移動を始める前に、現在地で公開されている食事を取る", "meal_consumed");
    }

    const workMeal = choices.find((entry) =>
      entry.type === "work" || WORK_MEAL_PATTERN.test(actionText(entry)));
    if (workMeal) {
      return choiceDecision(workMeal, "食事拠点を探して往復せず、現在地の公開まかない労働で食事を確保する", "work");
    }
  }

  const fatigueRequiresImmediateRest = fatigue >= 72;
  const nightRestIsSafe = hour >= 21 && hunger < 72;
  if (fatigueRequiresImmediateRest || nightRestIsSafe) {
    const rest = choices.find((entry) =>
      entry.type === "rest" || REST_PATTERN.test(actionText(entry)));
    if (rest) {
      return choiceDecision(rest, "地域越境を避け、現在地で倒れる前に休息する", "rest");
    }
  }

  return null;
}

function knownLocalMealFacilityIds(save, state) {
  const currentHub = save?.scene?.location;
  return new Set(
    Object.values(state?.knownMealSources ?? {})
      .filter((entry) => entry?.facilityId && (!entry?.hub || entry.hub === currentHub))
      .map((entry) => entry.facilityId),
  );
}

function localEmergencyAlternative(save, state) {
  const recovery = localRecoveryChoice(save);
  if (recovery) return recovery;

  const hunger = number(save?.player?.needs?.hunger);
  const knownMealFacilityIds = knownLocalMealFacilityIds(save, state);
  const localShelter = (save?.movement ?? [])
    .filter((entry) => entry.scope === "local")
    .find((entry) => {
      if (!LOCAL_SHELTER_PATTERN.test(actionText(entry))) return false;
      if (hunger < 72) return true;
      return knownMealFacilityIds.has(entry.destinationFacilityId);
    });
  if (!localShelter) return null;
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

export function selectUrgentDay100SurvivalDecision({ save, model, state }) {
  if (!urgentSurvivalRequired(save)) return null;

  const recovery = localRecoveryChoice(save);
  if (recovery) return recovery;

  const decision = selectDay100Decision({
    save: survivalOnlySave(save),
    model,
    state,
  });
  if (!SURVIVAL_CATEGORIES.has(decision?.category)) return null;

  const movement = movementForDecision(save, decision);
  if (movement?.scope === "regional") {
    return localEmergencyAlternative(save, state) ?? decision;
  }
  return decision;
}

export function selectDay100RouteDecisionWithSurvival(args) {
  return selectUrgentDay100SurvivalDecision(args)
    ?? selectDay100RouteDecision(args);
}

export const DAY100_ROUTE_SURVIVAL_PRIORITY_INTERNALS = Object.freeze({
  LOCAL_SHELTER_PATTERN,
  MEAL_PATTERN,
  REST_PATTERN,
  SURVIVAL_CATEGORIES,
  WORK_MEAL_PATTERN,
  knownLocalMealFacilityIds,
  localEmergencyAlternative,
  localRecoveryChoice,
  movementForDecision,
  survivalOnlySave,
  urgentSurvivalRequired,
});
