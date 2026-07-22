import fs from "node:fs";

const files = [
  "src/server/trpg/game/service.js",
  "public/TRPG/app.js",
];
const needles = [
  "quoteEquipmentSale",
  "availableStockAt(",
  "shop: {",
  "export function buildGameView",
  "function renderShop",
  "function renderInventory",
];
let output = "";
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  output += `\n===== ${file} =====\n`;
  for (const needle of needles) {
    let offset = 0;
    let found = 0;
    while (true) {
      const index = source.indexOf(needle, offset);
      if (index < 0) break;
      found += 1;
      const line = source.slice(0, index).split("\n").length;
      output += `\n--- ${needle} #${found} line ${line} ---\n`;
      output += source.slice(Math.max(0, index - 900), Math.min(source.length, index + 1900));
      output += "\n";
      offset = index + needle.length;
    }
    if (!found) output += `\n--- ${needle}: not found ---\n`;
  }
}
fs.writeFileSync("tools/trpg-refactor/equipment-access-anchors.log", output);
