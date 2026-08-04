import { DAY100_POLICY_INTERNALS } from "./day100-player-policy.mjs";
import { selectDay100RouteDecision } from "./day100-route-strategy.mjs";
import { selectUrgentDay100SurvivalDecision } from "./day100-route-survival-priority.mjs";

const { isDecisionBlocked } = DAY100_POLICY_INTERNALS;

const CONTROL_PATTERN = /:(?:NAVIGATOR_BACK|BACK|CANCEL|ABORT|RECONSIDER|DEFER)(?::|$)/u;
const AUTHORED_PATTERN = /^MISSION_FLOW:/u;
const COMPANION_TEXT_PATTERN = /(?:手伝|助け|救|守|運ぶ|見舞|仲間|一緒|伝え|話|遊|子ども|家畜|当番|共有|協力|預か|届け|見張|移す|食べる|任せる)/u;

const FAMILY_SCORE = Object.freeze({
  rescue: 120,
  coordination: 110,
  diplomacy: 100,
  social: 95,
  logistics: 90,
  living: 70,
  observation: 60,
  fieldwork: 55,
  non_intervention: 25,
});

function actionText(entry) {
  return `${entry?.actionId ?? ""} ${entry?.label ?? ""}`;
}

function guidedMissionId(save) {
  const missionId = String(save?.guidance?.missionId ?? "").trim();
  return missionId || null;
}

function choiceScore(choice) {
  const family = String(choice?.family ?? "");
  const familyScore = Number(FAMILY_SCORE[family] ?? 0);
  const textScore = COMPANION_TEXT_PATTERN.test(actionText(choice)) ? 40 : 0;
  const authoredScore = AUTHORED_PATTERN.test(String(choice?.actionId ?? "")) ? 15 : 0;
  const explicitBridgeScore = /DAY2_VILLAGE_WATCH|DAY8_FIRST_HOWL/u.test(String(choice?.actionId ?? "")) ? 80 : 0;
  return familyScore + textScore + authoredScore + explicitBridgeScore;
}

function availableCompanionChoices(save, state) {
  const choices = Array.isArray(save?.choices) ? save.choices : [];
  const guided = guidedMissionId(save);
  const authoredVisible = choices.some((entry) => AUTHORED_PATTERN.test(String(entry?.actionId ?? "")));

  return choices
    .filter((entry) => {
      const actionId = String(entry?.actionId ?? "");
      if (!actionId || CONTROL_PATTERN.test(actionId)) return false;
      if (isDecisionBlocked(state, `CHOOSE:${actionId}`, save)) return false;
      if (authoredVisible && !AUTHORED_PATTERN.test(actionId)) return false;
      if (guided && entry?.missionId && entry.missionId !== guided) return false;
      return choiceScore(entry) > 0;
    })
    .sort((left, right) => choiceScore(right) - choiceScore(left)
      || String(left.actionId).localeCompare(String(right.actionId), "ja"));
}

function companionDecision(save, state) {
  const choice = availableCompanionChoices(save, state)[0];
  if (!choice) return null;
  const actionId = choice.actionId ?? choice.choiceId;
  return {
    type: "CHOOSE",
    payload: { choiceId: choice.choiceId ?? actionId },
    actionId,
    missionId: choice.missionId ?? guidedMissionId(save),
    stepId: choice.stepId ?? null,
    key: `CHOOSE:${actionId}`,
    label: choice.label,
    reason: "関係者が自力で次の行動へ進める協力を優先する",
    category: "route_strategy",
  };
}

export function selectDay100CompanionRouteDecision(args) {
  const survival = selectUrgentDay100SurvivalDecision(args);
  if (survival) return survival;

  const { save, model, state } = args;
  if (save?.world?.ended || save?.battle || save?.tutorial?.id) {
    return selectDay100RouteDecision({ save, model, state, routeMode: "chain" });
  }

  return companionDecision(save, state)
    ?? selectDay100RouteDecision({ save, model, state, routeMode: "chain" });
}

export const DAY100_COMPANION_ROUTE_INTERNALS = Object.freeze({
  AUTHORED_PATTERN,
  COMPANION_TEXT_PATTERN,
  FAMILY_SCORE,
  actionText,
  guidedMissionId,
  choiceScore,
  availableCompanionChoices,
  companionDecision,
});
