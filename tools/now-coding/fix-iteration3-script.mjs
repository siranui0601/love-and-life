import fs from "node:fs";

const path = "tools/now-coding/apply-iteration3.mjs";
let source = fs.readFileSync(path, "utf8");

const badQuotedEvent = `  s = replaceOne(s,
    '  $$('[ + "'" + 'data-battle-kind' + "'" + ']').forEach((button) => button.addEventListener("click", () => setBattleKind(button.dataset.battleKind)));',
    '  $$('[ + "'" + 'data-battle-kind' + "'" + ']').forEach((button) => button.addEventListener("click", () => setBattleKind(button.dataset.battleKind)));\\n  $$("[data-mode]").forEach((button) => button.addEventListener("click", () => selectBattleMode(button.dataset.mode)));',
    "mode card events");`;
const goodQuotedEvent = `  s = replaceOne(s,
    \`  $$('[data-battle-kind]').forEach((button) => button.addEventListener("click", () => setBattleKind(button.dataset.battleKind)));\`,
    \`  $$('[data-battle-kind]').forEach((button) => button.addEventListener("click", () => setBattleKind(button.dataset.battleKind)));\\n  $$("[data-mode]").forEach((button) => button.addEventListener("click", () => selectBattleMode(button.dataset.mode)));\`,
    "mode card events");`;
if (!source.includes(badQuotedEvent)) throw new Error("quoted event anchor not found");
source = source.replace(badQuotedEvent, goodQuotedEvent);

const ambiguousStep = `  s = replaceOne(s,
    '    stepTerritory(state);',
    '    stepGame(state);',
    "battle generic step");`;
const preciseStep = `  s = replaceOne(s,
    '  appState.battleTimer = setInterval(() => {\\n    const previous = cloneBoard(state.board);\\n    stepTerritory(state);\\n    renderBoard($("#battleBoard"), state, previous);',
    '  appState.battleTimer = setInterval(() => {\\n    const previous = cloneBoard(state.board);\\n    stepGame(state);\\n    renderBoard($("#battleBoard"), state, previous);',
    "battle generic step");`;
if (!source.includes(ambiguousStep)) throw new Error("ambiguous battle step anchor not found");
source = source.replace(ambiguousStep, preciseStep);

fs.writeFileSync(path, source, "utf8");
console.log("Fixed iteration 3 script quoting and battle-step anchor.");
