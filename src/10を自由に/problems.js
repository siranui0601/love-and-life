import crypto from "node:crypto";

export const VALID_DIGIT_LENGTHS = new Set([3, 4, 5]);
export const UNSOLVABLE_THREE_DIGIT = new Set(["000", "001", "010", "100", "011", "101", "110", "111"]);
export const AVAILABLE_PROBLEM_COUNTS = Object.freeze({ 3: 992, 4: 10000, 5: 100000 });

export function createUsedProblemMap(digitLengths) {
  return new Map(digitLengths.map((length) => [Number(length), new Set()]));
}

export function createRandomProblem({ digitLengths, usedProblemsByLength }) {
  const availableLengths = digitLengths.filter((length) => {
    const used = usedProblemsByLength.get(length)?.size || 0;
    return used < AVAILABLE_PROBLEM_COUNTS[length];
  });
  if (!availableLengths.length) return null;

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const length = availableLengths[crypto.randomInt(0, availableLengths.length)];
    const problem = String(crypto.randomInt(0, 10 ** length)).padStart(length, "0");
    if (length === 3 && UNSOLVABLE_THREE_DIGIT.has(problem)) continue;
    const used = usedProblemsByLength.get(length);
    if (used.has(problem)) continue;
    used.add(problem);
    return problem;
  }

  for (const length of availableLengths) {
    const used = usedProblemsByLength.get(length);
    for (let number = 0; number < 10 ** length; number += 1) {
      const problem = String(number).padStart(length, "0");
      if (length === 3 && UNSOLVABLE_THREE_DIGIT.has(problem)) continue;
      if (used.has(problem)) continue;
      used.add(problem);
      return problem;
    }
  }
  return null;
}
