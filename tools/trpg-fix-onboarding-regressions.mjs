import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function replace(relativePath, before, after) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  if (!source.includes(before)) throw new Error(`Missing replacement source in ${relativePath}`);
  fs.writeFileSync(filename, source.replace(before, after));
}

replace("src/server/trpg/game/service.js", `  if (tutorial.stage === "movement_aftermath") return {
    ...base,
    id: null,
    title: null,
    body: null,
    progressLabel: null,
    emphasisTarget: null,
  };`, `  if (tutorial.stage === "movement_aftermath") return {
    ...base,
    id: "world-keeps-moving",
    visible: false,
    title: null,
    body: null,
    progressLabel: null,
    emphasisTarget: null,
  };`);

replace("src/server/trpg/game/service.js", `  if (tutorial.stage === "aftermath_intro") return {
    ...base,
    id: null,
    title: null,
    body: null,
    progressLabel: null,
    emphasisTarget: null,
  };`, `  if (tutorial.stage === "aftermath_intro") return {
    ...base,
    id: "trouble-aftermath",
    visible: false,
    title: null,
    body: null,
    progressLabel: null,
    emphasisTarget: null,
  };`);

replace("src/server/trpg/game/service.js", '    actionLabel: "ミッションを確認",', '    actionLabel: "依頼を確認",');
replace("src/server/trpg/game/service.js", `    actionPanel: "skills",
    acknowledgeable: false,
    emphasisTarget: "skills",`, `    actionPanel: "skills",
    acknowledgeable: !acknowledged.has("skills"),
    emphasisTarget: "skills",`);
replace("public/TRPG/app.js", '  const visible = Boolean(value && value.complete !== true && (value.id || value.emphasisTarget));', '  const visible = Boolean(value && value.visible !== false && value.complete !== true && (value.id || value.emphasisTarget));');

console.log("Onboarding compatibility fixes applied.");
