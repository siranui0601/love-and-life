import assert from "node:assert/strict";
import test from "node:test";

import { DAY100_EATERY_PATTERN } from "../lib/day100-player-policy.mjs";
import { readFileSync } from "node:fs";

// 正本で食料か食事を売っている施設は、通し再生の食事処探索から一つも漏れてはいけない。
// 漏れると、その土地で腹を空かせたプレイヤーは食える町まで地方移動を繰り返す。
// 実際、以前は十八施設のうち八つが漏れており、その中に出発の村で唯一まともに
// 食える麦穂亭が入っていた。
function foodFacilities() {
  const snapshot = JSON.parse(readFileSync(
    new URL("../fixtures/world.snapshot.json", import.meta.url), "utf8"));
  const rows = snapshot.tabs["商品・価格表"] ?? [];
  const seen = new Map();
  for (const row of rows) {
    const [, hub, facilityId, facilityName, category] = row;
    if (category !== "食事" && category !== "食料") continue;
    if (typeof facilityName !== "string" || !facilityName) continue;
    seen.set(`${hub}|${facilityId}`, { hub, facilityId, facilityName });
  }
  return [...seen.values()];
}

test("every canonical food seller is recognisable as somewhere to eat", () => {
  const missed = foodFacilities()
    .filter((entry) => !DAY100_EATERY_PATTERN.test(entry.facilityName))
    .map((entry) => `${entry.hub}/${entry.facilityName}`);
  assert.deepEqual(missed, [], "これらの施設で食べられることに気づけない");
});

test("the village inn in particular, because the whole opening eats there", () => {
  assert.ok(DAY100_EATERY_PATTERN.test("麦穂亭"));
  assert.ok(DAY100_EATERY_PATTERN.test("狩人小屋/野営地"));
  assert.ok(DAY100_EATERY_PATTERN.test("鉄樽亭"));
  assert.ok(DAY100_EATERY_PATTERN.test("神殿案内所/休憩所"));
});

test("the pattern still declines places that sell no food", () => {
  for (const name of ["王城", "宮廷魔術塔", "領主館", "共同穀倉", "村長宅", "名工工房"]) {
    assert.equal(DAY100_EATERY_PATTERN.test(name), false, `${name} は食事処ではない`);
  }
});
