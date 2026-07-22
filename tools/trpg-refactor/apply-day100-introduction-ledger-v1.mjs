import fs from "node:fs";

const path = "tools/trpg-sim/lib/day100-player-policy.mjs";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`missing_anchor:${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`duplicate_anchor:${label}`);
  source = `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

replaceOnce(
  `    recentDecisionKeys: [],
    actionCount: 0,`,
  `    recentDecisionKeys: [],
    acknowledgedIntroductionTokens: [],
    actionCount: 0,`,
  "introduction-ledger-state",
);

replaceOnce(
  `    state.recentDecisionKeys.push(key);
    if (state.recentDecisionKeys.length > 18) state.recentDecisionKeys.shift();
    if (decision.missionId) {`,
  `    state.recentDecisionKeys.push(key);
    if (state.recentDecisionKeys.length > 18) state.recentDecisionKeys.shift();
    if (decision.type === "ACK_NPC_INTRODUCTION") {
      appendUnique(state.acknowledgedIntroductionTokens, decision.payload?.token, 80);
    }
    if (decision.missionId) {`,
  "record-introduction-token",
);

replaceOnce(
  `  const introduction = (save.scene?.beats ?? []).find((beat) => beat.introductionToken);`,
  `  const acknowledgedIntroductionTokens = state.acknowledgedIntroductionTokens ?? [];
  const introduction = (save.scene?.beats ?? []).find((beat) => beat.introductionToken
    && !acknowledgedIntroductionTokens.includes(beat.introductionToken));`,
  "skip-acknowledged-introduction",
);

fs.writeFileSync(path, source, "utf8");
fs.rmSync(import.meta.filename);
console.log("Day100 introduction acknowledgement ledger applied");
