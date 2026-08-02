import { createMissionCatalog } from "../../../../tools/trpg-sim/lib/mission-model.mjs";
import {
  applyAuthoredMissionFlowCatalogOverrides,
  reconcileAuthoredMissionFlowState,
} from "../content/authored-mission-flow-registry.js";

const TYPE_KEY = "__trpgType";

function replacer(key, value) {
  if (["battleData", "catalog", "model"].includes(key)) return undefined;
  if (value instanceof Set) return { [TYPE_KEY]: "Set", values: [...value] };
  if (value instanceof Map) return { [TYPE_KEY]: "Map", entries: [...value.entries()] };
  if (value === Number.POSITIVE_INFINITY) return { [TYPE_KEY]: "Number", value: "Infinity" };
  if (value === Number.NEGATIVE_INFINITY) return { [TYPE_KEY]: "Number", value: "-Infinity" };
  if (Number.isNaN(value)) return { [TYPE_KEY]: "Number", value: "NaN" };
  return value;
}

function reviver(key, value) {
  if (!value || typeof value !== "object" || !value[TYPE_KEY]) return value;
  if (value[TYPE_KEY] === "Set") return new Set(value.values ?? []);
  if (value[TYPE_KEY] === "Map") return new Map(value.entries ?? []);
  if (value[TYPE_KEY] === "Number") {
    if (value.value === "Infinity") return Number.POSITIVE_INFINITY;
    if (value.value === "-Infinity") return Number.NEGATIVE_INFINITY;
    if (value.value === "NaN") return Number.NaN;
  }
  return value;
}

export function serializeRuntime(runtime) {
  reconcileAuthoredMissionFlowState(runtime);
  return JSON.stringify(runtime, replacer);
}

export function deserializeRuntime(serialized, data) {
  const runtime = JSON.parse(serialized, reviver);
  runtime.playerState.battleData = data.battleData;
  runtime.playerState.catalog = applyAuthoredMissionFlowCatalogOverrides(
    createMissionCatalog(data.model, data.battleData, runtime.playerState.tuning ?? {}),
  );
  runtime.livingWorld.model = data.model;
  reconcileAuthoredMissionFlowState(runtime);
  return runtime;
}

export function cloneSerializable(value) {
  return JSON.parse(JSON.stringify(value, replacer), reviver);
}
