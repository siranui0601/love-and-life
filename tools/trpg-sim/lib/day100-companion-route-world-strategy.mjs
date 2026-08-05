import { DAY100_POLICY_INTERNALS } from "./day100-player-policy.mjs";
import { selectDay100RouteDecision } from "./day100-route-strategy.mjs";
import { selectUrgentDay100SurvivalDecision } from "./day100-route-survival-priority.mjs";

const { isDecisionBlocked } = DAY100_POLICY_INTERNALS;

const CONTROL_PATTERN = /:(?:NAVIGATOR_(?:ROUTE_)?BACK|BACK|CANCEL|ABORT|RECONSIDER)(?::|$)/u;
const AUTHORED_PATTERN = /^MISSION_FLOW:/u;
const COMPANION_TEXT_PATTERN = /(?:手伝|助け|救|守|運ぶ|見舞|診る|仲間|一緒|伝え|話|遊|子ども|家畜|当番|共有|協力|預か|届け|見張|移す|食べる|任せる|匿|避難|治療|返す|配る|名簿|証人)/u;
const CENTRAL_SPINE_PATTERN = /(?:巡礼便に加わる|名簿を管理棟へ運ぶ|列順を聞く|巡礼者を地上へ送る|運転簿を照合する|クロウを連れ出す|ヴェラに部屋を借りる|レンを同席させる|キリと支払線を追う|ノアを訪ねる|ヴィクトルと封鎖線を作る|証人を隠して王を逃がす)/u;
const FULL_RESCUE_LOSS_PATTERN = /(?::RV_END:|salvage|完全救済を失|救出を諦|救助を諦|見捨て|打ち切|部分救済で終)/iu;

const FAMILY_SCORE = Object.freeze({
  rescue: 120,
  coordination: 110,
  diplomacy: 100,
  social: 95,
  logistics: 90,
  living: 70,
  observation: 60,
  fieldwork: 55,
  investigate: 55,
  non_intervention: 25,
});

function text(choice) {
  return `${choice?.actionId ?? ""} ${choice?.label ?? ""}`;
}

function actionMissionId(choice, save) {
  const fromId = /^MISSION_FLOW:(T\d{2})(?::|$)/u.exec(String(choice?.actionId ?? ""));
  if (fromId) return `MSN-${fromId[1]}`;
  const explicit = String(choice?.missionId ?? "").trim();
  if (explicit) return explicit;
  return String(save?.guidance?.missionId ?? "").trim() || null;
}

function score(choice) {
  if (FULL_RESCUE_LOSS_PATTERN.test(text(choice))) return Number.NEGATIVE_INFINITY;
  const family = String(choice?.family ?? "");
  const authored = AUTHORED_PATTERN.test(String(choice?.actionId ?? ""));
  const choiceText = text(choice);
  return Number(FAMILY_SCORE[family] ?? 0)
    + (COMPANION_TEXT_PATTERN.test(choiceText) ? 40 : 0)
    + (authored ? 15 : 0)
    + (CENTRAL_SPINE_PATTERN.test(choiceText) ? 250 : 0);
}

function candidates(save, state) {
  const choices = Array.isArray(save?.choices) ? save.choices : [];
  const authoredVisible = choices.some((choice) => AUTHORED_PATTERN.test(String(choice?.actionId ?? "")));
  return choices
    .filter((choice) => {
      const actionId = String(choice?.actionId ?? "");
      if (!actionId || CONTROL_PATTERN.test(actionId)) return false;
      if (isDecisionBlocked(state, `CHOOSE:${actionId}`, save)) return false;
      if (authoredVisible && !AUTHORED_PATTERN.test(actionId)) return false;
      return Number.isFinite(score(choice));
    })
    .sort((left, right) => score(right) - score(left)
      || String(left.actionId).localeCompare(String(right.actionId), "ja"));
}

function currentWorldChoice(save, state) {
  const choice = candidates(save, state)[0];
  if (!choice) return null;
  const actionId = choice.actionId ?? choice.choiceId;
  return {
    type: "CHOOSE",
    payload: { choiceId: choice.choiceId ?? actionId },
    actionId,
    missionId: actionMissionId(choice, save),
    stepId: choice.stepId ?? null,
    key: `CHOOSE:${actionId}`,
    label: choice.label,
    reason: "現在の世界で提示された手書き行動から、関係者を生かす中心枝を取る",
    category: "route_strategy",
  };
}

export function selectDay100CompanionWorldDecision(args) {
  const survival = selectUrgentDay100SurvivalDecision(args);
  if (survival) return survival;

  const { save, model, state } = args;
  if (save?.world?.ended || save?.battle || save?.tutorial?.id) {
    return selectDay100RouteDecision({ save, model, state, routeMode: "deadline" });
  }

  const companion = currentWorldChoice(save, state);
  if (companion) return companion;
  return selectDay100RouteDecision({ save, model, state, routeMode: "deadline" });
}

export const DAY100_COMPANION_WORLD_INTERNALS = Object.freeze({
  CONTROL_PATTERN,
  AUTHORED_PATTERN,
  COMPANION_TEXT_PATTERN,
  CENTRAL_SPINE_PATTERN,
  FULL_RESCUE_LOSS_PATTERN,
  FAMILY_SCORE,
  text,
  actionMissionId,
  score,
  candidates,
  currentWorldChoice,
});