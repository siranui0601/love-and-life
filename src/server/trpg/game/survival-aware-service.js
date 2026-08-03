import { CollapseAwareTrpgGameService } from "./collapse-aware-service.js";

export const SURVIVAL_AWARE_SERVICE_VERSION = "survival-aware-service-v1";

const MEAL_FACILITY_PATTERN = /(?:INN|BAKERY|MARKET|TAVERN|食堂|宿|パン|市場|酒場)/iu;
const LODGING_FACILITY_PATTERN = /(?:INN|LODGE|宿|旅籠)/iu;

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function authoredMissionScene(view) {
  return (view?.choices ?? []).some((choice) =>
    String(choice?.actionId ?? "").startsWith("MISSION_FLOW:"));
}

function urgentLifeState(view) {
  const hunger = number(view?.player?.needs?.hunger);
  const fatigue = number(view?.player?.needs?.fatigue);
  const hour = number(
    view?.clock?.hour,
    Number(String(view?.clock?.time ?? "0").split(":")[0]),
  );
  return hunger >= 72 || fatigue >= 72 || hour >= 21;
}

function choiceExists(view, actionId) {
  return (view?.choices ?? []).some((choice) => choice.actionId === actionId);
}

export function urgentLifeChoices(view, data) {
  if (!authoredMissionScene(view) || !urgentLifeState(view)) return [];
  const facilityId = String(view?.scene?.facilityId ?? "").trim();
  if (!facilityId) return [];
  const facility = data?.model?.facilityById?.[facilityId] ?? null;
  const facilityText = `${facilityId} ${facility?.name ?? ""}`;
  const choices = [];

  if (number(view?.player?.freeMeals) > 0 && MEAL_FACILITY_PATTERN.test(facilityText)) {
    const actionId = `EAT:${facilityId}:0`;
    if (!choiceExists(view, actionId)) {
      choices.push({
        choiceId: actionId,
        id: actionId,
        actionId,
        label: `${facility?.name ?? "この場所"}で用意された食事を取る`,
        type: "eat",
        intentType: "life",
        minutes: 30,
        price: 0,
        nutrition: 58,
        danger: false,
      });
    }
  }

  if (number(view?.player?.freeLodging) > 0 && LODGING_FACILITY_PATTERN.test(facilityText)) {
    const actionId = `LODGE:${facilityId}:0`;
    if (!choiceExists(view, actionId)) {
      choices.push({
        choiceId: actionId,
        id: actionId,
        actionId,
        label: `${facility?.name ?? "宿"}で今夜は休む`,
        type: "rest",
        intentType: "life",
        minutes: 480,
        price: 0,
        lodging: true,
        danger: false,
      });
    }
  }

  const restActionId = `REST_OUTDOOR:${facilityId}`;
  if (!choiceExists(view, restActionId) && !choices.some((choice) => choice.type === "rest")) {
    choices.push({
      choiceId: restActionId,
      id: restActionId,
      actionId: restActionId,
      label: "現在地で安全を確かめ、短く休息する",
      type: "rest",
      intentType: "life",
      minutes: 120,
      price: 0,
      lodging: false,
      danger: false,
    });
  }
  return choices;
}

export function applyUrgentLifeChoices(view, data) {
  const lifeChoices = urgentLifeChoices(view, data);
  if (!lifeChoices.length) return view;
  return {
    ...view,
    choices: [...lifeChoices, ...(view.choices ?? [])],
  };
}

export class SurvivalAwareTrpgGameService extends CollapseAwareTrpgGameService {
  gameViewForRecord(record) {
    return applyUrgentLifeChoices(super.gameViewForRecord(record), this.data);
  }

  health() {
    return {
      ...super.health(),
      survivalAwareServiceVersion: SURVIVAL_AWARE_SERVICE_VERSION,
    };
  }
}

export function createSurvivalAwareTrpgGameService(options = {}) {
  return new SurvivalAwareTrpgGameService(options);
}
