import crypto from "node:crypto";
import { Worker } from "node:worker_threads";
import {
  evaluateExpression,
  ExpressionError,
  isTen,
  validateDigitUsage,
} from "../../../public/ten-freely/expression-engine.js";

const SOLO_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const VALID_DIGIT_LENGTHS = new Set([3, 4, 5]);
const VALID_LIVES = new Set([1, 3, 5]);
const VALID_QUESTION_COUNTS = new Set([5, 10, "infinity"]);
const UNSOLVABLE_THREE_DIGIT = new Set(["000", "001", "010", "100", "011", "101", "110", "111"]);
const AVAILABLE_PROBLEM_COUNTS = Object.freeze({ 3: 992, 4: 10000, 5: 100000 });

const soloRuns = new Map();

function solveProblemWithoutBlocking(problem, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./solution-worker.js", import.meta.url), { type: "module" });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("solution_timeout"));
    }, timeoutMs);

    worker.once("message", (message) => {
      clearTimeout(timeout);
      worker.terminate();
      if (message?.ok) resolve(message.solution);
      else reject(new Error(message?.error || "solution_failed"));
    });
    worker.once("error", (error) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(error);
    });
    worker.postMessage(problem);
  });
}

function normalizeSettings(raw = {}) {
  const digitLengths = [...new Set((Array.isArray(raw.digitLengths) ? raw.digitLengths : [])
    .map(Number)
    .filter((value) => VALID_DIGIT_LENGTHS.has(value)))]
    .sort((a, b) => a - b);
  const lives = Number(raw.lives);
  const questionCount = raw.questionCount === "infinity" ? "infinity" : Number(raw.questionCount);

  if (!digitLengths.length) throw new Error("invalid_digit_lengths");
  if (!VALID_LIVES.has(lives)) throw new Error("invalid_lives");
  if (!VALID_QUESTION_COUNTS.has(questionCount)) throw new Error("invalid_question_count");

  const maximumQuestions = digitLengths.reduce((sum, length) => sum + AVAILABLE_PROBLEM_COUNTS[length], 0);
  return { digitLengths, lives, questionCount, maximumQuestions };
}

function randomProblemOfLength(length) {
  const upper = 10 ** length;
  return String(crypto.randomInt(0, upper)).padStart(length, "0");
}

function createProblem(run) {
  const availableLengths = run.settings.digitLengths.filter((length) => {
    const usedForLength = run.usedProblemsByLength.get(length)?.size ?? 0;
    return usedForLength < AVAILABLE_PROBLEM_COUNTS[length];
  });
  if (!availableLengths.length) return null;

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const length = availableLengths[crypto.randomInt(0, availableLengths.length)];
    const problem = randomProblemOfLength(length);
    if (length === 3 && UNSOLVABLE_THREE_DIGIT.has(problem)) continue;
    const used = run.usedProblemsByLength.get(length);
    if (used.has(problem)) continue;
    used.add(problem);
    return problem;
  }

  // 終盤で乱数の衝突が増えた場合だけ、残っている問題を順に探す。
  for (const length of availableLengths) {
    const used = run.usedProblemsByLength.get(length);
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

function publicRun(run) {
  const targetQuestions = run.settings.questionCount === "infinity"
    ? run.settings.maximumQuestions
    : run.settings.questionCount;
  return {
    runId: run.id,
    settings: run.settings,
    problem: run.currentProblem,
    questionStartedAt: run.questionStartedAt,
    lives: run.lives,
    solvedCount: run.solvedCount,
    questionIndex: run.questionIndex,
    targetQuestions,
    totalAnswerTimeMs: run.totalAnswerTimeMs,
    status: run.status,
  };
}

function finishRun(run, reason) {
  run.status = "finished";
  run.finishedAt = Date.now();
  run.finishReason = reason;
  const averageTimeMs = run.solvedCount > 0 ? Math.round(run.totalAnswerTimeMs / run.solvedCount) : null;
  return {
    ...publicRun(run),
    finishReason: reason,
    finishedAt: run.finishedAt,
    averageTimeMs,
    unresolvedProblem: reason === "completed" ? null : run.currentProblem,
    history: run.history,
  };
}

function nextQuestion(run) {
  const target = run.settings.questionCount === "infinity"
    ? run.settings.maximumQuestions
    : run.settings.questionCount;
  if (run.solvedCount >= target) return finishRun(run, "completed");

  const problem = createProblem(run);
  if (!problem) return finishRun(run, "all_problems_completed");
  run.currentProblem = problem;
  run.questionIndex += 1;
  run.questionStartedAt = Date.now();
  run.updatedAt = Date.now();
  return publicRun(run);
}

function getActiveRun(runId) {
  const run = soloRuns.get(String(runId || ""));
  if (!run) throw new Error("run_not_found");
  if (run.status !== "playing") throw new Error("run_finished");
  if (Date.now() - run.updatedAt > SOLO_SESSION_TTL_MS) {
    soloRuns.delete(run.id);
    throw new Error("run_expired");
  }
  return run;
}

function cleanupRuns() {
  const now = Date.now();
  for (const [runId, run] of soloRuns) {
    const reference = run.updatedAt || run.finishedAt || run.createdAt;
    if (now - reference > SOLO_SESSION_TTL_MS) soloRuns.delete(runId);
  }
}

function sendKnownError(res, error) {
  const statusByCode = {
    invalid_digit_lengths: 400,
    invalid_lives: 400,
    invalid_question_count: 400,
    run_not_found: 404,
    run_finished: 409,
    run_expired: 410,
  };
  const status = statusByCode[error.message];
  if (!status) return false;
  res.status(status).json({ ok: false, error: error.message });
  return true;
}

export function mountTenFreelyRoutes(app) {
  app.get("/api/ten-freely/meta", (req, res) => {
    res.json({
      ok: true,
      availableProblemCounts: AVAILABLE_PROBLEM_COUNTS,
      excludedThreeDigitProblems: [...UNSOLVABLE_THREE_DIGIT],
      operators: ["+", "-", "×", "÷", "^", "P", "C", "!", "√", "|", "(", ")"],
      maxConsecutiveFactorials: 9,
    });
  });

  app.post("/api/ten-freely/solo/start", (req, res) => {
    cleanupRuns();
    try {
      const settings = normalizeSettings(req.body?.settings || req.body || {});
      const id = crypto.randomUUID();
      const run = {
        id,
        settings,
        user: {
          username: String(req.body?.username || "guest").slice(0, 40),
          userTrackingId: String(req.body?.userTrackingId || "").slice(0, 80),
        },
        status: "playing",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        finishedAt: null,
        currentProblem: null,
        questionStartedAt: null,
        questionIndex: 0,
        solvedCount: 0,
        lives: settings.lives,
        totalAnswerTimeMs: 0,
        usedProblemsByLength: new Map(settings.digitLengths.map((length) => [length, new Set()])),
        history: [],
      };
      soloRuns.set(id, run);
      const state = nextQuestion(run);
      res.json({ ok: true, run: state });
    } catch (error) {
      if (sendKnownError(res, error)) return;
      console.error("[ten-freely] solo start failed", error);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  app.post("/api/ten-freely/solo/submit", (req, res) => {
    try {
      const run = getActiveRun(req.body?.runId);
      const expression = String(req.body?.expression || "").trim();
      let parsed;

      try {
        parsed = evaluateExpression(expression);
      } catch (error) {
        if (error instanceof ExpressionError) {
          const mathematicalFailure = [
            "division_by_zero",
            "negative_sqrt",
            "invalid_factorial",
            "invalid_permutation",
            "invalid_combination",
            "not_finite",
            "too_large",
          ].includes(error.code);

          if (!mathematicalFailure) {
            return res.status(400).json({
              ok: false,
              error: "invalid_expression",
              expressionError: { code: error.code, message: error.message },
            });
          }

          run.lives -= 1;
          run.updatedAt = Date.now();
          run.history.push({
            problem: run.currentProblem,
            expression,
            correct: false,
            errorCode: error.code,
            at: run.updatedAt,
          });
          if (run.lives <= 0) {
            return res.json({
              ok: true,
              correct: false,
              expressionError: { code: error.code, message: error.message },
              finished: true,
              result: finishRun(run, "lives_depleted"),
            });
          }
          return res.json({
            ok: true,
            correct: false,
            expressionError: { code: error.code, message: error.message },
            finished: false,
            run: publicRun(run),
          });
        }
        throw error;
      }

      const digitUsage = validateDigitUsage(parsed.ast, run.currentProblem);
      if (!digitUsage.valid) {
        return res.status(400).json({ ok: false, error: "digits_not_used_exactly" });
      }

      const answeredAt = Date.now();
      const answerTimeMs = Math.max(0, answeredAt - run.questionStartedAt);
      const correct = isTen(parsed.value);
      run.updatedAt = answeredAt;
      run.history.push({
        problem: run.currentProblem,
        expression,
        result: parsed.value,
        correct,
        answerTimeMs,
        at: answeredAt,
      });

      if (!correct) {
        run.lives -= 1;
        if (run.lives <= 0) {
          return res.json({
            ok: true,
            correct: false,
            value: parsed.value,
            answerTimeMs,
            finished: true,
            result: finishRun(run, "lives_depleted"),
          });
        }
        return res.json({
          ok: true,
          correct: false,
          value: parsed.value,
          answerTimeMs,
          finished: false,
          run: publicRun(run),
        });
      }

      run.solvedCount += 1;
      run.totalAnswerTimeMs += answerTimeMs;
      const solvedProblem = run.currentProblem;
      const next = nextQuestion(run);
      const finished = next.status === "finished";
      return res.json({
        ok: true,
        correct: true,
        value: parsed.value,
        solvedProblem,
        expression,
        answerTimeMs,
        finished,
        ...(finished ? { result: next } : { run: next }),
      });
    } catch (error) {
      if (sendKnownError(res, error)) return;
      console.error("[ten-freely] solo submit failed", error);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  app.post("/api/ten-freely/solo/retire", (req, res) => {
    try {
      const run = getActiveRun(req.body?.runId);
      res.json({ ok: true, result: finishRun(run, "retired") });
    } catch (error) {
      if (sendKnownError(res, error)) return;
      console.error("[ten-freely] solo retire failed", error);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  app.get("/api/ten-freely/solution/:problem", async (req, res) => {
    const problem = String(req.params.problem || "");
    if (!/^[0-9]{3,5}$/u.test(problem)) {
      return res.status(400).json({ ok: false, error: "invalid_problem" });
    }
    if (problem.length === 3 && UNSOLVABLE_THREE_DIGIT.has(problem)) {
      return res.status(404).json({ ok: false, error: "unsolvable_problem" });
    }

    try {
      const solution = await solveProblemWithoutBlocking(problem);
      if (!solution) return res.status(404).json({ ok: false, error: "solution_not_found" });
      return res.json({ ok: true, problem, solution });
    } catch (error) {
      console.error("[ten-freely] solution failed", { problem, error });
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });
}
