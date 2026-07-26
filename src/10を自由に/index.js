import crypto from "node:crypto";
import { Worker } from "node:worker_threads";
import {
  evaluateExpression,
  ExpressionError,
  isTen,
  validateDigitUsage,
} from "../../public/10を自由に/expression-engine.js";
import { findUserByUsername } from "../foundation/sheets.js";
import {
  appendTenFreelySoloResult,
  getTenFreelyRanking,
} from "./storage.js";
import {
  clearUserSessionCookie,
  readUserSession,
  requireUserSession,
  setUserSessionCookie,
} from "./storage.js";
import {
  createOnlineRoom,
  getActiveOnlineRoom,
  getOnlineRoomForUser,
  joinOnlineRoom,
  onlineConstants,
  registerTenFreelyOnlineSockets,
  startTenFreelyOnlineMaintenance,
} from "./online.js";
import {
  AVAILABLE_PROBLEM_COUNTS,
  createRandomProblem,
  createUsedProblemMap,
  UNSOLVABLE_THREE_DIGIT,
  VALID_DIGIT_LENGTHS,
} from "./problems.js";

const SOLO_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const VALID_LIVES = new Set([1, 3, 5]);
const VALID_QUESTION_COUNTS = new Set([5, 10, "infinity"]);
const soloRuns = new Map();
const solutionCache = new Map();

function solveProblemWithoutBlocking(problem, timeoutMs = 15000) {
  const key = [...String(problem)].sort().join("");
  if (solutionCache.has(key)) return Promise.resolve(solutionCache.get(key));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./solver.js", import.meta.url), { type: "module" });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("solution_timeout"));
    }, timeoutMs);
    worker.once("message", (message) => {
      clearTimeout(timeout);
      worker.terminate();
      if (message?.ok) {
        solutionCache.set(key, message.solution);
        resolve(message.solution);
      } else reject(new Error(message?.error || "solution_failed"));
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
  if (run.status === "finished") return run.finishedResult;
  run.status = "finished";
  run.finishedAt = Date.now();
  run.finishReason = reason;
  run.averageTimeMs = run.solvedCount > 0 ? Math.round(run.totalAnswerTimeMs / run.solvedCount) : null;
  run.finishedResult = {
    ...publicRun(run),
    finishReason: reason,
    finishedAt: run.finishedAt,
    averageTimeMs: run.averageTimeMs,
    unresolvedProblem: ["completed", "all_problems_completed"].includes(reason) ? null : run.currentProblem,
    history: run.history,
  };
  return run.finishedResult;
}

async function persistRunQuietly(run) {
  if (run.persisted || !run.user?.userTrackingId) return;
  run.persisted = true;
  try {
    await appendTenFreelySoloResult({ run: { ...run, ...run.finishedResult }, user: run.user });
  } catch (error) {
    run.persisted = false;
    console.warn("[ten-freely] result persistence failed", error?.message || error);
  }
}

async function finishAndPersist(run, reason) {
  const result = finishRun(run, reason);
  await persistRunQuietly(run);
  return result;
}

function nextQuestion(run) {
  const target = run.settings.questionCount === "infinity"
    ? run.settings.maximumQuestions
    : run.settings.questionCount;
  if (run.solvedCount >= target) return null;
  const problem = createRandomProblem({
    digitLengths: run.settings.digitLengths,
    usedProblemsByLength: run.usedProblemsByLength,
  });
  if (!problem) return null;
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

function mathematicalFailure(error) {
  return error instanceof ExpressionError && [
    "division_by_zero",
    "negative_sqrt",
    "invalid_factorial",
    "invalid_permutation",
    "invalid_combination",
    "not_finite",
    "too_large",
  ].includes(error.code);
}

function knownErrorStatus(error) {
  return {
    invalid_digit_lengths: 400,
    invalid_lives: 400,
    invalid_question_count: 400,
    invalid_win_target: 400,
    run_not_found: 404,
    room_not_found: 404,
    run_finished: 409,
    run_expired: 410,
    room_not_lobby: 409,
    room_full: 409,
    forbidden: 403,
  }[error?.message];
}

function handleKnownError(res, error) {
  const status = knownErrorStatus(error);
  if (!status) return false;
  res.status(status).json({ ok: false, error: error.message });
  return true;
}

export function mountTenFreelyRoutes(app, io) {
  app.get("/api/ten-freely/meta", (req, res) => {
    res.json({
      ok: true,
      availableProblemCounts: AVAILABLE_PROBLEM_COUNTS,
      excludedThreeDigitProblems: [...UNSOLVABLE_THREE_DIGIT],
      operators: ["+", "-", "×", "÷", "^", "P", "C", "!", "√", "|", "(", ")"],
      maxConsecutiveFactorials: 9,
      online: onlineConstants,
    });
  });

  app.post("/api/ten-freely/session", async (req, res) => {
    const username = String(req.body?.username || "").trim();
    const userTrackingId = String(req.body?.userTrackingId || "").trim();
    if (!username || !userTrackingId) return res.status(400).json({ ok: false, error: "identity_required" });
    try {
      const user = await findUserByUsername(username);
      if (!user || user.userTrackingId !== userTrackingId) {
        clearUserSessionCookie(res);
        return res.status(401).json({ ok: false, error: "identity_mismatch" });
      }
      setUserSessionCookie(res, user);
      return res.json({ ok: true, user: { username: user.username, userTrackingId: user.userTrackingId } });
    } catch (error) {
      console.error("[ten-freely] session exchange failed", error);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  app.get("/api/ten-freely/me", (req, res) => {
    const session = readUserSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "login_required" });
    return res.json({ ok: true, user: session });
  });

  app.delete("/api/ten-freely/session", (req, res) => {
    clearUserSessionCookie(res);
    res.json({ ok: true });
  });

  app.post("/api/ten-freely/solo/start", (req, res) => {
    cleanupRuns();
    try {
      const settings = normalizeSettings(req.body?.settings || req.body || {});
      const session = readUserSession(req);
      const id = crypto.randomUUID();
      const run = {
        id,
        settings,
        user: session || null,
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
        usedProblemsByLength: createUsedProblemMap(settings.digitLengths),
        history: [],
        persisted: false,
      };
      soloRuns.set(id, run);
      const state = nextQuestion(run);
      res.json({ ok: true, run: state, rankingEligible: Boolean(session) });
    } catch (error) {
      if (handleKnownError(res, error)) return;
      console.error("[ten-freely] solo start failed", error);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  app.post("/api/ten-freely/solo/submit", async (req, res) => {
    try {
      const run = getActiveRun(req.body?.runId);
      const expression = String(req.body?.expression || "").trim();
      let parsed;
      try { parsed = evaluateExpression(expression); }
      catch (error) {
        if (!mathematicalFailure(error)) {
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
            result: await finishAndPersist(run, "lives_depleted"),
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

      const digitUsage = validateDigitUsage(parsed.ast, run.currentProblem);
      if (!digitUsage.valid) return res.status(400).json({ ok: false, error: "digits_not_used_exactly" });

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
            result: await finishAndPersist(run, "lives_depleted"),
          });
        }
        return res.json({ ok: true, correct: false, value: parsed.value, answerTimeMs, finished: false, run: publicRun(run) });
      }

      run.solvedCount += 1;
      run.totalAnswerTimeMs += answerTimeMs;
      const solvedProblem = run.currentProblem;
      const next = nextQuestion(run);
      if (!next) {
        const target = run.settings.questionCount === "infinity" ? run.settings.maximumQuestions : run.settings.questionCount;
        const reason = run.settings.questionCount === "infinity"
          ? "all_problems_completed"
          : run.solvedCount >= target ? "completed" : "all_problems_completed";
        return res.json({
          ok: true,
          correct: true,
          value: parsed.value,
          solvedProblem,
          expression,
          answerTimeMs,
          finished: true,
          result: await finishAndPersist(run, reason),
        });
      }
      return res.json({
        ok: true,
        correct: true,
        value: parsed.value,
        solvedProblem,
        expression,
        answerTimeMs,
        finished: false,
        run: next,
      });
    } catch (error) {
      if (handleKnownError(res, error)) return;
      console.error("[ten-freely] solo submit failed", error);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  app.post("/api/ten-freely/solo/retire", async (req, res) => {
    try {
      const run = getActiveRun(req.body?.runId);
      res.json({ ok: true, result: await finishAndPersist(run, "retired") });
    } catch (error) {
      if (handleKnownError(res, error)) return;
      console.error("[ten-freely] solo retire failed", error);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  app.get("/api/ten-freely/solution/:problem", async (req, res) => {
    const problem = String(req.params.problem || "");
    if (!/^[0-9]{2,5}$/u.test(problem)) return res.status(400).json({ ok: false, error: "invalid_problem" });
    if (problem.length === 3 && UNSOLVABLE_THREE_DIGIT.has(problem)) {
      return res.status(404).json({ ok: false, error: "unsolvable_problem" });
    }
    try {
      const solution = await solveProblemWithoutBlocking(problem);
      if (!solution) return res.status(404).json({ ok: false, error: "solution_not_found" });
      return res.json({ ok: true, solution });
    } catch (error) {
      console.error("[ten-freely] solution failed", problem, error);
      return res.status(error.message === "solution_timeout" ? 504 : 500).json({ ok: false, error: error.message || "solution_failed" });
    }
  });

  app.get("/api/ten-freely/ranking", async (req, res) => {
    try {
      const digitLengths = String(req.query.digits || "3").split(",").map(Number);
      const lives = Number(req.query.lives || 3);
      const questionCount = req.query.questions === "infinity" ? "infinity" : Number(req.query.questions || 5);
      normalizeSettings({ digitLengths, lives, questionCount });
      const internalRanking = await getTenFreelyRanking({ digitLengths, lives, questionCount, limit: req.query.limit });
      const session = readUserSession(req);
      const ranking = internalRanking.map(({ userTrackingId, ...entry }) => ({
        ...entry,
        isSelf: Boolean(session && userTrackingId === session.userTrackingId),
      }));
      const own = ranking.find((entry) => entry.isSelf) || null;
      return res.json({ ok: true, ranking, own, condition: { digitLengths, lives, questionCount } });
    } catch (error) {
      if (handleKnownError(res, error)) return;
      console.error("[ten-freely] ranking failed", error);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  app.post("/api/ten-freely/online/rooms", requireUserSession, async (req, res) => {
    try {
      const room = await createOnlineRoom({ session: req.userSession, settings: req.body?.settings || req.body || {} });
      res.json({ ok: true, room });
    } catch (error) {
      if (handleKnownError(res, error)) return;
      console.error("[ten-freely] room create failed", error);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  app.post("/api/ten-freely/online/rooms/:roomId/join", requireUserSession, async (req, res) => {
    try {
      const room = await joinOnlineRoom({ roomId: req.params.roomId, session: req.userSession });
      res.json({ ok: true, room });
    } catch (error) {
      if (handleKnownError(res, error)) return;
      console.error("[ten-freely] room join failed", error);
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  app.get("/api/ten-freely/online/active", requireUserSession, async (req, res) => {
    try { res.json({ ok: true, room: await getActiveOnlineRoom(req.userSession) }); }
    catch (error) { console.error("[ten-freely] active room failed", error); res.status(500).json({ ok: false, error: "server_error" }); }
  });

  app.get("/api/ten-freely/online/rooms/:roomId", requireUserSession, async (req, res) => {
    try { res.json({ ok: true, room: await getOnlineRoomForUser(req.params.roomId, req.userSession) }); }
    catch (error) {
      if (handleKnownError(res, error)) return;
      res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  registerTenFreelyOnlineSockets(io);
  startTenFreelyOnlineMaintenance(io);
}
