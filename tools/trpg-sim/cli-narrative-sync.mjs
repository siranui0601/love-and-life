import { syncNarrativeAuditToSheet } from "../../src/server/trpg/narrative-audit.js";

try {
  const result = await syncNarrativeAuditToSheet();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.error("TRPG narrative audit sheet sync failed");
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
