import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const reportsDirectory = path.join(HERE, "reports");
const publicDirectory = path.resolve(HERE, "..", "..", "public", "TRPG");
fs.mkdirSync(reportsDirectory, { recursive: true });
fs.mkdirSync(publicDirectory, { recursive: true });

const currentReportPaths = [
  path.join(reportsDirectory, "player-v4-latest.json"),
  path.join(reportsDirectory, "player-v4-latest.md"),
  path.join(reportsDirectory, "player-latest.json"),
  path.join(reportsDirectory, "player-latest.md"),
  path.join(publicDirectory, "player-simulation-report.json"),
  path.join(publicDirectory, "player-simulation-v4-report.json"),
];
const failureJsonPath = path.join(reportsDirectory, "player-v4-failure.json");
const failureMarkdownPath = path.join(reportsDirectory, "player-v4-failure.md");

for (const outputPath of [...currentReportPaths, failureJsonPath, failureMarkdownPath]) {
  fs.rmSync(outputPath, { force: true });
}

const command = `node tools/trpg-sim/cli-player-v4.mjs ${process.argv.slice(2).join(" ")}`.trim();
const ciContext = {
  headSha: process.env.GITHUB_SHA ?? null,
  githubRunId: process.env.GITHUB_RUN_ID ?? null,
  githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  workflow: process.env.GITHUB_WORKFLOW ?? null,
  job: process.env.GITHUB_JOB ?? null,
  command,
  profile: {
    playerSeeds: Number(process.env.TRPG_PLAYER_V4_SEEDS ?? 2),
    goapSeeds: Number(process.env.TRPG_GOAP_V4_SEEDS ?? 2),
  },
};

let stage = "initialize";
let currentExecutionMarker = "PLAYER_V4_CLI_INITIALIZED";
let loadedProfileIds = null;

function normalizeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || String(error),
      stack: error.stack ?? null,
    };
  }
  return {
    name: "NonErrorThrown",
    message: typeof error === "string" ? error : JSON.stringify(error),
    stack: null,
  };
}

function renderFailureMarkdown(failure) {
  return `# TRPG integrated player simulation v4 failure\n\n- generatedAt: ${failure.generatedAt}\n- headSha: ${failure.headSha ?? "unknown"}\n- githubRunId: ${failure.githubRunId ?? "unknown"}\n- githubRunAttempt: ${failure.githubRunAttempt ?? "unknown"}\n- workflow: ${failure.workflow ?? "unknown"}\n- job: ${failure.job ?? "unknown"}\n- command: ${failure.command}\n- profile: ${JSON.stringify(failure.profile)}\n- phase: ${failure.phase}\n- stage: ${failure.stage}\n- currentExecutionMarker: ${failure.currentExecutionMarker}\n- loadedProfileIds: ${failure.loadedProfileIds ? failure.loadedProfileIds.join(", ") : "not loaded"}\n- error.name: ${failure.error.name}\n- error.message: ${failure.error.message}\n\n## stack\n\n\`\`\`text\n${failure.error.stack ?? "(no stack available)"}\n\`\`\`\n`;
}

try {
  stage = "load_modules";
  currentExecutionMarker = "PLAYER_V4_LOADING_MODULES";
  const [journeyModule, suiteModule] = await Promise.all([
    import("./lib/player-journey.mjs"),
    import("./lib/player-suite-v4.mjs"),
  ]);
  const { PLAYER_PROFILES } = journeyModule;
  const {
    renderPlayerSimulationMarkdownV4,
    runIntegratedPlayerSimulationSuiteV4,
  } = suiteModule;
  loadedProfileIds = PLAYER_PROFILES.map((profile) => profile.id);

  stage = "run_integrated_suite_v4";
  currentExecutionMarker = "PLAYER_V4_RUNNING_INTEGRATED_SUITE";
  const report = await runIntegratedPlayerSimulationSuiteV4({ profiles: PLAYER_PROFILES });

  stage = "render_report";
  currentExecutionMarker = "PLAYER_V4_RENDERING_REPORT";
  const markdown = renderPlayerSimulationMarkdownV4(report);
  const json = `${JSON.stringify(report, null, 2)}\n`;

  stage = "write_current_reports";
  currentExecutionMarker = "PLAYER_V4_WRITING_CURRENT_REPORTS";
  fs.writeFileSync(path.join(reportsDirectory, "player-v4-latest.json"), json);
  fs.writeFileSync(path.join(reportsDirectory, "player-v4-latest.md"), markdown);
  fs.writeFileSync(path.join(reportsDirectory, "player-latest.json"), json);
  fs.writeFileSync(path.join(reportsDirectory, "player-latest.md"), markdown);
  fs.writeFileSync(path.join(publicDirectory, "player-simulation-report.json"), json);
  fs.writeFileSync(path.join(publicDirectory, "player-simulation-v4-report.json"), json);

  currentExecutionMarker = "PLAYER_V4_CURRENT_REPORTS_WRITTEN";
  console.log(markdown);
  console.log(`\nPLAYER_SIM_V4_QUALITY=${report.quality.passed ? "PASS" : "BLOCKED"}`);
  if (process.argv.includes("--strict") && !report.quality.passed) process.exitCode = 1;
} catch (error) {
  const failure = {
    generatedAt: new Date().toISOString(),
    ...ciContext,
    phase: "integrated_player_simulation_v4",
    stage,
    currentExecutionMarker,
    loadedProfileIds,
    error: normalizeError(error),
  };
  fs.writeFileSync(failureJsonPath, `${JSON.stringify(failure, null, 2)}\n`);
  fs.writeFileSync(failureMarkdownPath, renderFailureMarkdown(failure));
  console.error(`[PLAYER_SIM_V4_FAILURE] stage=${stage} marker=${currentExecutionMarker}`);
  console.error(failure.error.stack ?? `${failure.error.name}: ${failure.error.message}`);
  throw error;
}
