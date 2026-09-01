import fs from "node:fs";

const path = "public/now-coding/app.js";
let source = fs.readFileSync(path, "utf8");
const before = `function clearOptionalTutorialFocus() {\n  $(".lesson-target").forEach((node) => node.classList.remove("lesson-target"));\n}`;
const after = `function clearOptionalTutorialFocus() {\n  document.querySelectorAll(".lesson-target").forEach((node) => node.classList.remove("lesson-target"));\n}`;
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`tutorial focus anchor mismatch: ${count}`);
source = source.replace(before, after);
fs.writeFileSync(path, source, "utf8");
console.log("Optional tutorial focus cleanup fixed with querySelectorAll.");