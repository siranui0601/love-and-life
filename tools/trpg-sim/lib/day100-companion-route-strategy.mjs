import { DAY100_POLICY_INTERNALS } from "./day100-player-policy.mjs";
import { selectDay100RouteDecision } from "./day100-route-strategy.mjs";
import { selectUrgentDay100SurvivalDecision } from "./day100-route-survival-priority.mjs";

const { isDecisionBlocked } = DAY100_POLICY_INTERNALS;

const CONTROL_PATTERN = /:(?:NAVIGATOR_(?:ROUTE_)?BACK|BACK|CANCEL|ABORT|RECONSIDER|DEFER)(?::|$)/u;
const AUTHORED_PATTERN = /^MISSION_FLOW:/u;
const COMPANION_TEXT_PATTERN = /(?:手伝|助け|救|守|運ぶ|見舞|診る|仲間|一緒|伝え|話|遊|子ども|家畜|当番|共有|協力|預か|届け|見張|移す|食べる|任せる)/u;
const HUMAN_ROUTE_BRIDGE_PATTERN = /(?:ミラを手伝う|パンをちぎる|ミラの家で眠る|荷ほどきを手伝う|三Gを受け取る|猟師の荷を預かる|狩人小屋へ向かう|罠を直す|村へ知らせる|家畜を移す|当番札を回す|子どもを家へ返す|牝馬を診る)/u;
const RESCUE_CONTINUATION_PATTERN = /(?::RV_CAN:|完全救済|救出を続け|救助を続け|助けに向か|保護する|支える)/u;
const RESCUE_LOSS_PATTERN = /(?::RV_END:|salvage|完全救済を失|救出を諦|救助を諦|見捨て|打ち切|部分救済で終)/iu;
const TERMINAL_MISSION_STATES = new Set(["completed", "failed", "resolved", "terminal", "abandoned"]);
const FOCUS_STATE_KEY = "companionRouteFocusMissionId";

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

function missionById(save, missionId) {
  return (Array.isArray(save?.missions) ? save.missions : [])
    .find((mission) => mission?.id === missionId) ?? null;
}

function activeMission(save, missionId) {
  const mission = missionById(save, missionId);
  return mission && mission.kind === "special"
    && !TERMINAL_MISSION_STATES.has(String(mission.status ?? ""))
    ? mission
    : null;
}

function focusedMissionId(save, state) {
  const missionId = String(state?.[FOCUS_STATE_KEY] ?? "").trim();
  if (!missionId) return null;
  if (activeMission(save, missionId)) return missionId;
  delete state[FOCUS_STATE_KEY];
  return null;
}

function saveFocusedOnMission(save, missionId) {
  if (!missionId || !activeMission(save, missionId)) return save;
  return {
    ...save,
    guidance: guidedMissionId(save) === missionId
      ? save.guidance
      : { missionId },
    missions: (Array.isArray(save?.missions) ? save.missions : [])
      .filter((mission) => mission?.id === missionId),
  };
}

function rememberMissionFocus(save, state, decision) {
  const missionId = String(
    decision?.missionId ?? missionIdFromActionId(decision?.actionId),
  ).trim();
  if (missionId && activeMission(save, missionId)) {
    state[FOCUS_STATE_KEY] = missionId;
  }
  return decision;
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
  const humanBridgeScore = HUMAN_ROUTE_BRIDGE_PATTERN.test(text) ? 400 : 0;
  const explicitBridgeScore = /DAY2_VILLAGE_WATCH|DAY8_FIRST_HOWL|DAY8_COMMUNITY/u.test(String(choice?.actionId ?? "")) ? 80 : 0;
  const rescueContinuationScore = RESCUE_CONTINUATION_PATTERN.test(text) ? 180 : 0;
  return familyScore + textScore + authoredScore + humanBridgeScore
    + explicitBridgeScore + rescueContinuationScore;
}

function candidateChoices(save, state) {
  const choices = Array.isArray(save?.choices) ? save.choices : [];
  const guided = guidedMissionId(save);
  const authoredVisible = choices.some((entry) => AUTHORED_PATTERN.test(String(entry?.actionId ?? "")));
  const candidates = choices.filter((entry) => {
    const actionId = String(entry?.actionId ?? "");
    if (!actionId || CONTROL_PATTERN.test(actionId)) return false;
    if (isDecisionBlocked(state, `CHOOSE:${actionId}`, save)) return false;
    if (authoredVisible && !AUTHORED_PATTERN.test(actionId)) return false;
    return true;
  });

  if (authoredVisible) {
    if (guided) {
      const guidedCandidates = candidates.filter((entry) => (
        missionIdFromActionId(entry.actionId) === guided
      ));
      if (guidedCandidates.length) return guidedCandidates;
    }
    return candidates;
  }

  return candidates.filter((entry) => {
    const actionId = String(entry?.actionId ?? "");
    const inferredMissionId = missionIdFromActionId(actionId);
    if (guided && entry?.missionId && entry.missionId !== guided) return false;
    if (guided && inferredMissionId && inferredMissionId !== guided) return false;
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
    missionId: missionIdFromActionId(actionId) ?? guidedMissionId(save) ?? choice.missionId,
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

  const focusMissionId = focusedMissionId(save, state);
  const focusedSave = saveFocusedOnMission(save, focusMissionId);
  const companion = companionDecision(focusedSave, state);
  if (companion) return rememberMissionFocus(save, state, companion);
  if (authoredChoicesLoseFullRescue(focusedSave, state)) return null;

  const routeDecision = selectDay100RouteDecision({
    save: focusedSave,
    model,
    state,
    routeMode: "deadline",
  });
  return rememberMissionFocus(save, state, routeDecision);
}

export const DAY100_COMPANION_ROUTE_INTERNALS = Object.freeze({
  AUTHORED_PATTERN,
  COMPANION_TEXT_PATTERN,
  HUMAN_ROUTE_BRIDGE_PATTERN,
  RESCUE_CONTINUATION_PATTERN,
  RESCUE_LOSS_PATTERN,
  TERMINAL_MISSION_STATES,
  FOCUS_STATE_KEY,
  FAMILY_SCORE,
  actionText,
  guidedMissionId,
  missionIdFromActionId,
  missionById,
  activeMission,
  focusedMissionId,
  saveFocusedOnMission,
  rememberMissionFocus,
  isRescueLossChoice,
  choiceScore,
  candidateChoices,
  availableCompanionChoices,
  authoredChoicesLoseFullRescue,
  companionDecision,
});