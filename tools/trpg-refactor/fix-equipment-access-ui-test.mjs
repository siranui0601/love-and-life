import fs from "node:fs";

const targetPath = "tools/trpg-sim/test/trpg-equipment-access-ui-contract.test.mjs";
const selfPath = "tools/trpg-refactor/fix-equipment-access-ui-test.mjs";

fs.writeFileSync(targetPath, `import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("shop UI exposes trial used loan return and reward commands", () => {
  const app = fs.readFileSync("public/TRPG/app.js", "utf8");
  const css = fs.readFileSync("public/TRPG/style.css", "utf8");
  for (const command of ["SHOP_TRY", "SHOP_BUY_USED", "SHOP_BORROW", "SHOP_RETURN_LOAN", "CLAIM_EQUIPMENT_REWARD"]) {
    assert.ok(app.includes(command), command + " must be rendered by the playable UI");
  }
  assert.ok(app.includes("item.access?.trial"));
  assert.ok(app.includes("item.access?.used"));
  assert.ok(app.includes("item.access?.loan"));
  assert.ok(app.includes("shop.rewards"));
  assert.ok(app.includes("shop.loans"));
  assert.ok(css.includes(".shop-actions"));
});

test("borrowed inventory items remain equipable but are excluded from sale", () => {
  const app = fs.readFileSync("public/TRPG/app.js", "utf8");
  assert.ok(app.includes("!item.borrowed"));
  assert.ok(app.includes('"借用品"'));
  assert.ok(app.includes('"EQUIP"'));
});
`);

fs.rmSync(selfPath, { force: true });
