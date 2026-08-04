import { DAY100_POLICY_INTERNALS } from "./day100-player-policy.mjs";
import { selectDay100RouteDecision } from "./day100-route-strategy.mjs";
import { selectUrgentDay100SurvivalDecision } from "./day100-route-survival-priority.mjs";

const { isDecisionBlocked } = DAY100_POLICY_INTERNALS;

const CONTROL_PATTERN = /:(?:NAVIGATOR_BACK|BACK|CANCEL|ABORT|RECONSIDER|DEFER)(?::|$)/u;
const AUTHORED_PATTERN = /^MISSION_FLOW:/u;
const COMPANION_TEXT_PATTERN = /(?:手伝|助け|救|守|運ぶ|見舞|仲間|一緒|伝え|話|遊|子ども|家畜|当番|共有|協力|預か|届け|見張|移す|食べる|任せる)/u;
const RESCUE_CONTINUATION_PATTERN = /(?::RV_CAN:|完全救済|救出を続け|救助を続け|助けに向か|保護する|支える)/u;
const RESCUE_LOSS_PATTERN = /(?::RV_END:|salvage|完全救済を失|救出を諦|救助を諦|見捨て|打ち切|部分救済で終)/iu;

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

function missionIdFromActionId(actionId) {
  const match = /^MISSION_FLOW:(T\d{2})(?::|$)/u.exec(String(actionId ?? ""));
  return match ? `MSN-${match[1]}` : null;
}

function isRescueLossChoice(choice) {
  return RESCUE_LOSS_PATTERN.test(actionText(choice));
}

function choiceScore(choice) {
  if (isRescueLossChoice(choice)) return Number.NEGATIVE_INFINITY;
  const family = String(choice?.family ?? "");
  const familyScore = Number(FAMILY_SCORE[family] ?? 0);
  const text = actionText(choice);
  const textScore = COMPANION_TEXT_PATTERN.test(text) ? 40 : 0;
  const authoredScore = AUTHORED_PATTERN.test(String(choice?.actionId ?? "")) ? 15 : 0;
  const explicitBridgeScore = /DAY2_VILLAGE_WATCH|DAY8_FIRST_HOWL/u.test(String(choice?.actionId ?? "")) ? 80 : 0;
  const rescueContinuationScore = RESCUE_CONTINUATION_PATTERN.test(text) ? 180 : 0;
  return familyScore + textScore + authoredScore + explicitBridgeScore + rescueContinuationScore;
}

function candidateChoices(save, state) {
  const choices = Array.isArray(save?.choices) ? save.choices : [];
  const guided = guidedMissionId(save);
  const authoredVisible = choices.some((entry) => AUTHORED_PATTERN.test(String(entry?.actionId ?? "")));

  return choices.filter((entry) => {
    const actionId = String(entry?.actionId ?? "");
    if (!actionId || CONTROL_PATTERN.test(actionId)) return false;
    if (isDecisionBlocked(state, `CHOOSE:${actionId}`, save)) return false;
    if (authoredVisible && !AUTHORED_PATTERN.test(actionId)) return false;
    const inferredMissionId = missionIdFromActionId(actionId);
    if (!authoredVisible && guided && entry?.missionId && entry.missionId !== guided) return false;
    if (!authoredVisible && guided && inferredMissionId && inferredMissionId !== guided) return false;
    return true;
  });
}

function availableCompanionChoices(save, state) {
  return candidateChoices(save, state)
    .filter((entry) => Number.isFinite(choiceScore(entry)) && choiceScore(entry) > 0)
    .sort((left, right) => choiceScore(right) - choiceScore(left)
      || String(left.actionId).localeCompare(String(right.actionId), "ja"));
}

function authoredChoicesLoseFullRescue(save, state) {
  const candidates = candidateChoices(save, state)
    .filter((entry) => AUTHORED_PATTERN.test(String(entry?.actionId ?? "")));
  return candidates.length > 0 && candidates.every(isRescueLossChoice);
}

function companionDecision(save, state) {
  const choice = availableCompanionChoices(save, state)[0];
  if (!choice) return null;
  const actionId = choice.actionId ?? choice.choiceId;
  return {
    type: "CHOOSE",
    payload: { choiceId: choice.choiceId ?? actionId },
    actionId,
    missionId: missionIdFromActionId(actionId) ?? choice.missionId ?? guidedMissionId(save),
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
    return selectDay100RouteDecision({ save, model, state, routeMode: "deadline" });
  }

  const companion = companionDecision(save, state);
  if (companion) return companion;
  if (authoredChoicesLoseFullRescue(save, state)) return null;
  return selectDay100RouteDecision({ save, model, state, routeMode: "deadline" });
}

export const DAY100_COMPANION_ROUTE_INTERNALS = Object.freeze({
  AUTHORED_PATTERN,
  COMPANION_TEXT_PATTERN,
  RESCUE_CONTINUATION_PATTERN,
  RESCUE_LOSS_PATTERN,
  FAMILY_SCORE,
  actionText,
  guidedMissionId,
  missionIdFromActionId,
  isRescueLossChoice,
  choiceScore,
  candidateChoices,
  availableCompanionChoices,
  authoredChoicesLoseFullRescue,
  companionDecision,
});
