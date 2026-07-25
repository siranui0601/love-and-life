import { parentPort } from "node:worker_threads";
import { solveTenProblem } from "./solver.js";

parentPort?.on("message", (problem) => {
  try {
    parentPort.postMessage({ ok: true, solution: solveTenProblem(problem) });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
