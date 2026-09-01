import fs from "node:fs";

const path = "tools/now-coding/apply-iteration3.mjs";
let source = fs.readFileSync(path, "utf8");
const bad = `  s = replaceOne(s,
    '  $$('[ + "'" + 'data-battle-kind' + "'" + ']').forEach((button) => button.addEventListener("click", () => setBattleKind(button.dataset.battleKind)));',
    '  $$('[ + "'" + 'data-battle-kind' + "'" + ']').forEach((button) => button.addEventListener("click", () => setBattleKind(button.dataset.battleKind)));\\n  $$("[data-mode]").forEach((button) => button.addEventListener("click", () => selectBattleMode(button.dataset.mode)));',
    "mode card events");`;
const good = `  s = replaceOne(s,
    \`  $$('[data-battle-kind]').forEach((button) => button.addEventListener("click", () => setBattleKind(button.dataset.battleKind)));\`,
    \`  $$('[data-battle-kind]').forEach((button) => button.addEventListener("click", () => setBattleKind(button.dataset.battleKind)));\\n  $$("[data-mode]").forEach((button) => button.addEventListener("click", () => selectBattleMode(button.dataset.mode)));\`,
    "mode card events");`;
if (!source.includes(bad)) throw new Error("quoted event anchor not found");
source = source.replace(bad, good);
fs.writeFileSync(path, source, "utf8");
console.log("Fixed iteration 3 script quoting.");
