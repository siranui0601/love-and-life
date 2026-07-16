export function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function quantile(values, probability) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function summarize(values, digits = 3) {
  const round = (value) => Number(value.toFixed(digits));
  return {
    count: values.length,
    mean: round(mean(values)),
    p10: round(quantile(values, 0.1)),
    median: round(quantile(values, 0.5)),
    p90: round(quantile(values, 0.9)),
    min: values.length ? round(Math.min(...values)) : 0,
    max: values.length ? round(Math.max(...values)) : 0,
  };
}

export function createRng(seed = 1) {
  let state = Number(seed) >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    integer(minimum, maximum) {
      return Math.floor(this.next() * (maximum - minimum + 1)) + minimum;
    },
    pick(values) {
      return values.length ? values[this.integer(0, values.length - 1)] : undefined;
    },
    get state() {
      return state;
    },
  };
}
