import {
  DAY100_POLICY_INTERNALS,
  selectDay100Decision,
} from "./day100-player-policy.mjs";

const {
  TERMINAL_MISSION_STATES,
  TERMINAL_TROUBLE_STATES,
  isDecisionBlocked,
  movementToward,
} = DAY100_POLICY_INTERNALS;

const INFORMATION_PATTERN = /(?:CONCERN|CHANGE|RUMOR|CLUE|INQUIRY|TALK|DIALOGUE|INSPECT|OBSERVE|INVESTIGATE|調べ|尋ね|聞く|話しかけ|様子|噂|手掛かり)/iu;
const SHOP_PATTERN = /(?:SHOP|WEAPON|EQUIP|武器屋|装備|試着|試す)/iu;
const AUTHORED_FLOW_PATTERN = /^MISSION_FLOW:/u;
const CAPITAL_WEAPON_SHOP_FIRST_PATTERN = /^CAPITAL_WEAPON_SHOP:FIRST:/u;
const AUTHORED_FLOW_CONTROL_PATTERN = /:(?:NAVIGATOR_BACK|BACK|CANCEL|ABORT|RECONSIDER|DEFER)(?::|$)/u;

export const DAY100_ROUTE_MODES = Object.freeze([
  "deadline",
  "chain",
  "prevention",
  "regional",
]);

const ROUTE_ORDER = Object.freeze({
  chain: Object.freeze([
    "T01", "T02", "T03", "T04", "T05", "T06", "T07", "T09", "T10",
    "T11", "T12", "T08", "T13", "T14", "T15", "T16", "T17", "T18", "T19",
  ]),
  prevention: Object.freeze([
    "T01", "T02", "T03", "T04", "T07", "T09", "T05", "T06", "T11",
    "T12", "T08", "T13", "T10", "T14", "T15", "T16", "T17", "T18", "T19",
  ]),
});

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function actionText(entry) {
  return `${entry?.actionId ?? entry?.moveId ?? ""} ${entry?.label ?? ""}`;
}

function authoredFlowChoice(entry) {
  const actionId = String(entry?.actionId ?? "");
  return AUTHORED_FLOW_PATTERN.test(actionId) && !AUTHORED_FLOW_CONTROL_PATTERN.test(actionId);
}

function guidanceMissionId(save) {
  const missionId = String(save?.guidance?.missionId ?? "").trim();
  return missionId || null;
}

function missionChoiceAllowed(entry, missionId, guidedMissionId, authoredForwardVisible) {
  const actionId = String(entry?.actionId ?? "");
  if (AUTHORED_FLOW_CONTROL_PATTERN.test(actionId)) return false;
  if (authoredForwardVisible && guidedMissionId && missionId !== guidedMissionId) return false;
  if (entry?.missionId === missionId) return true;
  return (!guidedMissionId || missionId === guidedMissionId) && authoredFlowChoice(entry);
}

function modeIndex(mode) {
  const index = DAY100_ROUTE_MODES.indexOf(mode);
  return index < 0 ? 0 : index;
}

function choiceDecision(choice, reason, extras = {}) {
  return {
    type: "CHOOSE",
    payload: { choiceId: choice.choiceId },
    actionId: choice.actionId,
    missionId: choice.missionId ?? extras.missionId ?? null,
    stepId: choice.stepId ?? extras.stepId ?? null,
    key: `CHOOSE:${choice.actionId}`,
    label: choice.label,
    reason,
    category: "route_strategy",
    ...extras,
  };
}

function moveDecision(move, reason, extras = {}) {
  return {
    type: "MOVE",
    payload: { moveId: move.moveId },
    moveId: move.moveId,
    key: `MOVE:${move.moveId}`,
    label: move.label,
    reason,
    category: "route_strategy",
    ...extras,
  };
}

function availableChoices(save, state, predicate) {
  return (save?.choices ?? [])
    .filter((choice) => !isDecisionBlocked(state, `CHOOSE:${choice.actionId}`, save))
    .filter(predicate)
    .sort((left, right) => String(left.actionId).localeCompare(String(right.actionId), "en"));
}

function chooseVariant(entries, mode) {
  if (!entries.length) return null;
  return entries[modeIndex(mode) % entries.length];
}

function capitalWeaponShopFirstDecision(save, state, mode) {
  const choice = chooseVariant(
    availableChoices(save, state, (entry) =>
      CAPITAL_WEAPON_SHOP_FIRST_PATTERN.test(String(entry.actionId ?? ""))),
    mode,
  );
  return choice ? choiceDecision(
    choice,
    "王都武器屋の初回相談で、旅に持ち込む装備方針を決める",
    { routeMode: mode, category: "shop_onboarding" },
  ) : null;
}

function missionTrouble(model, mission) {
  return model.troubles.find((trouble) => trouble.id === mission.troubleId) ?? null;
}

function routeOrderIndex(mode, troubleId) {
  const order = ROUTE_ORDER[mode];
  if (!order) return Number.POSITIVE_INFINITY;
  const index = order.indexOf(troubleId);
  return index < 0 ? order.length + 10 : index;
}

function missionSortTuple(mission, model, save, mode) {
  const trouble = missionTrouble(model, mission);
  const deadline = number(mission.deadlineDay ?? trouble?.deadlineDay, 999);
  const finalDay = number(mission.finalDay ?? trouble?.finalDay, 999);
  const currentHub = save?.scene?.location;
  const targets = [
    mission.currentStep?.targetLocation,
    mission.targetLocation,
    ...(trouble?.primaryLocations ?? []),
  ].filter(Boolean);
  const localPenalty = targets.includes(currentHub) ? 0 : 1;
  const order = routeOrderIndex(mode, mission.troubleId);
  if (mode === "regional") return [localPenalty, deadline, finalDay, order, mission.id];
  if (mode === "chain" || mode === "prevention") return [order, deadline, finalDay, localPenalty, mission.id];
  return [deadline, finalDay, localPenalty, order, mission.id];
}

function compareTuple(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === b) continue;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), "ja");
  }
  return 0;
}

function activeMissionDecision(save, model, state, mode) {
  const guidedMissionId = guidanceMissionId(save);
  const authoredForwardVisible = (save?.choices ?? []).some(authoredFlowChoice);
  const missions = (save?.missions ?? [])
    .filter((mission) => mission.kind === "special" && !TERMINAL_MISSION_STATES.has(mission.status))
    .sort((left, right) => Number(right.id === guidedMissionId) - Number(left.id === guidedMissionId)
      || compareTuple(
        missionSortTuple(left, model, save, mode),
        missionSortTuple(right, model, save, mode),
      ));

  for (const mission of missions) {
    const choice = chooseVariant(
      availableChoices(
        save,
        state,
        (entry) => missionChoiceAllowed(
          entry,
          mission.id,
          guidedMissionId,
          authoredForwardVisible,
        ),
      ),
      mode,
    );
    if (choice) {
      return choiceDecision(choice, `${mode}方針で「${mission.title}」を優先する`, {
        routeMode: mode,
        missionId: mission.id,
        troubleId: mission.troubleId,
        stepId: mission.currentStep?.id ?? null,
      });
    }

    const trouble = missionTrouble(model, mission);
    const guided = mission.id === guidedMissionId ? save?.guidance : null;
    const targetFacilityId = guided?.targetFacilityId
      ?? mission.currentStep?.targetFacilityId
      ?? mission.targetFacilityId
      ?? null;
    const targetHub = guided?.targetLocation
      ?? mission.currentStep?.targetLocation
      ?? mission.targetLocation
      ?? trouble?.primaryLocations?.[0]
      ?? null;
    const move = movementToward(save, model, state, { facilityId: targetFacilityId, hub: targetHub });
    if (move) {
      return moveDecision(move, `${mode}方針で「${mission.title}」の次地点へ向かう`, {
        routeMode: mode,
        missionId: mission.id,
        troubleId: mission.troubleId,
        stepId: mission.currentStep?.id ?? null,
      });
    }

    if (!targetHub || targetHub === save?.scene?.location) {
      const information = chooseVariant(
        availableChoices(save, state, (entry) => !AUTHORED_FLOW_PATTERN.test(String(entry.actionId ?? ""))
          && (entry.missionId == null || entry.missionId === mission.id)
          && INFORMATION_PATTERN.test(actionText(entry))
          && !SHOP_PATTERN.test(actionText(entry))
          && !/:END$/iu.test(String(entry.actionId))),
        mode,
      );
      if (information) {
        return choiceDecision(information, `${mode}方針で「${mission.title}」の現地情報を集める`, {
          routeMode: mode,
          missionId: mission.id,
          troubleId: mission.troubleId,
          stepId: mission.currentStep?.id ?? null,
        });
      }
    }
  }
  return null;
}

function missionForTrouble(save, troubleId) {
  return (save?.missions ?? []).find((mission) => mission.troubleId === troubleId) ?? null;
}

function troubleCandidateTuple(definition, save, state, mode) {
  const ledger = state.trouble?.[definition.id] ?? {};
  const known = ledger.firstRumorMinute != null || ledger.firstMissionMinute != null;
  const currentHub = save?.scene?.location;
  const localPenalty = definition.primaryLocations.includes(currentHub) ? 0 : 1;
  const order = routeOrderIndex(mode, definition.id);
  const deadline = number(definition.deadlineDay, 999);
  const finalDay = number(definition.finalDay, 999);
  const discoveryPenalty = known ? 1 : 0;
  if (mode === "regional") return [localPenalty, discoveryPenalty, deadline, order, definition.id];
  if (mode === "chain" || mode === "prevention") return [order, discoveryPenalty, deadline, localPenalty, definition.id];
  return [deadline, discoveryPenalty, localPenalty, finalDay, definition.id];
}

function discoveryDecision(save, model, state, mode) {
  const day = number(save?.clock?.day, 1);
  const candidates = model.troubles
    .filter((definition) => definition.startDay <= day && day <= definition.finalDay)
    .filter((definition) => {
      const mission = missionForTrouble(save, definition.id);
      if (mission && TERMINAL_MISSION_STATES.has(mission.status)) return false;
      return !TERMINAL_TROUBLE_STATES.has(state.trouble?.[definition.id]?.finalTroubleStatus);
    })
    .sort((left, right) => compareTuple(
      troubleCandidateTuple(left, save, state, mode),
      troubleCandidateTuple(right, save, state, mode),
    ));
  const target = candidates[0];
  if (!target) return null;

  const currentHub = save?.scene?.location;
  if (!target.primaryLocations.includes(currentHub)) {
    for (const hub of target.primaryLocations) {
      const move = movementToward(save, model, state, { hub });
      if (move) {
        return moveDecision(move, `${mode}方針で${target.id}の発生地域へ向かう`, {
          routeMode: mode,
          troubleId: target.id,
        });
      }
    }
  }

  const information = chooseVariant(
    availableChoices(save, state, (entry) => (authoredFlowChoice(entry) || INFORMATION_PATTERN.test(actionText(entry)))
      && !SHOP_PATTERN.test(actionText(entry))
      && !/:END$/iu.test(String(entry.actionId))),
    mode,
  );
  if (information) {
    return choiceDecision(information, `${mode}方針で${target.id}の噂と変化を確かめる`, {
      routeMode: mode,
      troubleId: target.id,
    });
  }

  const localMoves = (save?.movement ?? [])
    .filter((move) => move.scope === "local")
    .filter((move) => !isDecisionBlocked(state, `MOVE:${move.moveId}`, save))
    .sort((left, right) => number(state.visitedFacilities?.[left.destinationFacilityId])
      - number(state.visitedFacilities?.[right.destinationFacilityId])
      || String(left.moveId).localeCompare(String(right.moveId), "en"));
  const local = chooseVariant(localMoves, mode);
  return local ? moveDecision(local, `${mode}方針で${target.id}の聞き込み先を変える`, {
    routeMode: mode,
    troubleId: target.id,
  }) : null;
}

function shouldKeepBaseForSurvival(save, base) {
  const hunger = number(save?.player?.needs?.hunger);
  const fatigue = number(save?.player?.needs?.fatigue);
  const hour = number(save?.clock?.hour, Number(String(save?.clock?.time ?? "0").split(":")[0]));
  const gold = number(save?.player?.gold);
  const freeMeals = number(save?.player?.freeMeals);
  const urgent = hunger >= 72 || fatigue >= 72 || hour >= 21 || (gold < 12 && freeMeals <= 0 && hunger >= 45);
  if (!urgent) return false;
  return ["meal_consumed", "meal_search_move", "rest", "work"].includes(base?.category)
    || /食|宿|休|仕事|路銀/u.test(String(base?.reason ?? ""));
}

function isBaseOnlyPhase(save, base) {
  if (!base) return true;
  if (base.type === "BATTLE") return true;
  if (["ACK_NPC_INTRODUCTION", "TUTORIAL_ACK"].includes(base.type)) return true;
  if (save?.tutorial?.id) return true;
  return false;
}

export function selectDay100RouteDecision({
  save,
  model,
  state,
  routeMode = "deadline",
}) {
  const mode = DAY100_ROUTE_MODES.includes(routeMode) ? routeMode : "deadline";
  const base = selectDay100Decision({ save, model, state });
  if (isBaseOnlyPhase(save, base) || shouldKeepBaseForSurvival(save, base)) return base;

  return capitalWeaponShopFirstDecision(save, state, mode)
    ?? activeMissionDecision(save, model, state, mode)
    ?? discoveryDecision(save, model, state, mode)
    ?? base;
}

export const DAY100_ROUTE_STRATEGY_INTERNALS = Object.freeze({
  ROUTE_ORDER,
  authoredFlowChoice,
  capitalWeaponShopFirstDecision,
  guidanceMissionId,
  missionChoiceAllowed,
  missionSortTuple,
  troubleCandidateTuple,
  shouldKeepBaseForSurvival,
});
