import { evaluateConditionGroup } from "../resolvers/condition-evaluator.js";
import { validateChoiceSet } from "./choice-contract.js";
import { T01_RESCUE_SCENES } from "./authored/missions/t01-rescue.js";

export const AUTHORED_CONTENT_VERSION = "authored-content-v1";

export const AUTHORED_SCENES = Object.freeze([
  ...T01_RESCUE_SCENES,
].sort((left, right) => Number(right.priority ?? 0) - Number(left.priority ?? 0)
  || left.sceneId.localeCompare(right.sceneId)));

export function resolveAuthoredScene(context, { scenes = AUTHORED_SCENES } = {}) {
  return scenes.find((scene) => evaluateConditionGroup(scene.when, context)) ?? null;
}

export function validateAuthoredScene(scene, context = {}) {
  const errors = [];
  if (!scene?.sceneId) errors.push("sceneId is required");
  if (!String(scene?.narrative ?? "").trim()) errors.push("narrative is required");
  if (!Array.isArray(scene?.choices)) errors.push("choices are required");
  const choiceValidation = validateChoiceSet(scene?.choices ?? [], context);
  errors.push(...choiceValidation.errors);
  return {
    valid: errors.length === 0,
    errors,
    choiceValidation,
    contentVersion: AUTHORED_CONTENT_VERSION,
  };
}
