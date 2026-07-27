import { evaluateConditionGroup } from "../resolvers/condition-evaluator.js";
import { validateChoiceSet } from "./choice-contract.js";
import { FARM_TO_CAPITAL_SCENES } from "./authored/journeys/farm-to-capital.js";
import { T01_RESCUE_SCENES } from "./authored/missions/t01-rescue.js";
import { AUTHORED_MISSION_FLOW_SCENES } from "./authored-mission-flow-registry.js";

export const AUTHORED_CONTENT_VERSION = "authored-content-v13";

export const AUTHORED_SCENES = Object.freeze([
  ...T01_RESCUE_SCENES,
  ...AUTHORED_MISSION_FLOW_SCENES,
  ...FARM_TO_CAPITAL_SCENES,
].sort((left, right) => Number(right.priority ?? 0) - Number(left.priority ?? 0)
  || left.sceneId.localeCompare(right.sceneId)));

export function resolveAuthoredScene(context, { scenes = AUTHORED_SCENES } = {}) {
  return scenes.find((scene) => evaluateConditionGroup(scene.when, context)) ?? null;
}

function emptyChoiceValidation() {
  return {
    valid: true,
    errors: [],
    warnings: [],
    entries: [],
    distinctFamilies: [],
  };
}

export function validateAuthoredScene(scene, context = {}) {
  const errors = [];
  if (!scene?.sceneId) errors.push("sceneId is required");
  if (!String(scene?.narrative ?? "").trim()) errors.push("narrative is required");
  if (!Array.isArray(scene?.choices)) errors.push("choices are required");
  if (scene?.presentationOnly === true && (scene?.choices?.length ?? 0) !== 0) {
    errors.push("presentation-only scenes cannot contain executable choices");
  }
  const choiceValidation = scene?.presentationOnly === true
    ? emptyChoiceValidation()
    : validateChoiceSet(scene?.choices ?? [], context);
  errors.push(...choiceValidation.errors);
  return {
    valid: errors.length === 0,
    errors,
    choiceValidation,
    contentVersion: AUTHORED_CONTENT_VERSION,
  };
}
