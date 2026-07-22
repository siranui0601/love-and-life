import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promoteApprovedNarrativeResults } from "./lib/approved-narrative-promotion.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPORT = path.join(HERE, "reports", "gemini-live-v5-latest.json");
const DEFAULT_MANIFEST = path.resolve(HERE, "../../src/server/trpg/content/approved-narrative-replays.json");

function argumentsFrom(argv) {
  const options = { reportPath: DEFAULT_REPORT, manifestPath: DEFAULT_MANIFEST, scenarioIds: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--report") options.reportPath = path.resolve(argv[++index]);
    else if (token === "--manifest") options.manifestPath = path.resolve(argv[++index]);
    else if (token === "--scenario") options.scenarioIds.push(argv[++index]);
    else throw new Error(`unknown_argument:${token}`);
  }
  return options;
}

const options = argumentsFrom(process.argv.slice(2));
const report = JSON.parse(fs.readFileSync(options.reportPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(options.manifestPath, "utf8"));
const promotion = promoteApprovedNarrativeResults({
  manifest,
  report,
  scenarioIds: options.scenarioIds,
});
fs.writeFileSync(options.manifestPath, `${JSON.stringify(promotion.manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  manifestPath: options.manifestPath,
  added: promotion.added,
  skipped: promotion.skipped,
  totalEntries: promotion.manifest.entries.length,
}, null, 2));
