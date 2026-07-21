export function readConditionPath(source, path) {
  if (!path) return undefined;
  return String(path).split(".").reduce((value, key) => value?.[key], source);
}

export function evaluateCondition(condition, source) {
  if (!condition || typeof condition !== "object") return true;
  const actual = readConditionPath(source, condition.path);
  const expected = condition.value;
  switch (condition.op ?? "eq") {
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    case "gt": return Number(actual) > Number(expected);
    case "gte": return Number(actual) >= Number(expected);
    case "lt": return Number(actual) < Number(expected);
    case "lte": return Number(actual) <= Number(expected);
    case "in": return Array.isArray(expected) && expected.includes(actual);
    case "notIn": return Array.isArray(expected) && !expected.includes(actual);
    case "contains": return Array.isArray(actual)
      ? actual.includes(expected)
      : actual instanceof Set
        ? actual.has(expected)
        : String(actual ?? "").includes(String(expected ?? ""));
    case "isTrue": return actual === true;
    case "isFalse": return actual === false;
    case "exists": return actual !== undefined && actual !== null;
    case "missing": return actual === undefined || actual === null;
    default: throw new RangeError(`Unsupported condition operator: ${condition.op}`);
  }
}

export function evaluateConditionGroup(group, source) {
  if (!group) return true;
  if (Array.isArray(group)) return group.every((condition) => evaluateCondition(condition, source));
  if (Array.isArray(group.all) && !group.all.every((condition) => evaluateCondition(condition, source))) return false;
  if (Array.isArray(group.any) && group.any.length && !group.any.some((condition) => evaluateCondition(condition, source))) return false;
  if (Array.isArray(group.none) && group.none.some((condition) => evaluateCondition(condition, source))) return false;
  return true;
}
