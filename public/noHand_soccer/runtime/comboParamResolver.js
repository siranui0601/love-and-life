export const COMBO_RUNTIME_VERSION = 'combo-runtime:v1';

const UINT32_MAX_PLUS_ONE = 4294967296;

export function hashStringToUint32(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createParamResolver({ comboKey, version = COMBO_RUNTIME_VERSION } = {}) {
  if (!comboKey || typeof comboKey !== 'string') throw new Error('comboKey is required for deterministic combo params.');
  const unit = (actionName, paramName) => hashStringToUint32(`${version}|combo:v1|${comboKey}|${actionName}|${paramName}`) / UINT32_MAX_PLUS_ONE;
  return {
    comboKey,
    version,
    number(actionName, paramName, min, max, decimals = 3) {
      const value = min + unit(actionName, paramName) * (max - min);
      const scale = 10 ** decimals;
      return Math.round(value * scale) / scale;
    },
    integer(actionName, paramName, min, max) {
      return Math.floor(min + unit(actionName, paramName) * (max - min + 1));
    },
    choice(actionName, paramName, choices) {
      if (!Array.isArray(choices) || choices.length === 0) throw new Error(`${actionName}.${paramName} choices must be non-empty.`);
      return choices[this.integer(actionName, paramName, 0, choices.length - 1)];
    },
  };
}

export function resolveComboParams(comboKey, paramSpec, options = {}) {
  const resolver = createParamResolver({ comboKey, version: options.version ?? COMBO_RUNTIME_VERSION });
  const out = {};
  for (const [actionName, params] of Object.entries(paramSpec ?? {})) {
    out[actionName] = {};
    for (const [paramName, spec] of Object.entries(params ?? {})) {
      if (spec.type === 'int' || spec.type === 'integer') out[actionName][paramName] = resolver.integer(actionName, paramName, spec.min, spec.max);
      else if (spec.type === 'choice') out[actionName][paramName] = resolver.choice(actionName, paramName, spec.choices);
      else out[actionName][paramName] = resolver.number(actionName, paramName, spec.min, spec.max, spec.decimals ?? 3);
    }
  }
  return { comboKey, version: resolver.version, params: out };
}
