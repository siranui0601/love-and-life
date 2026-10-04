import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseCsv } from "../cli-handover-append.mjs";
import {
  FACILITY_COLUMNS,
  existingFacilityIds,
  groupByTab,
  selectNewFacilities,
} from "../cli-canon-facility-append.mjs";

// 正本への書き込みは取り返しがつかないので、追記のみ・冪等をここで固定する。

const VILLAGE_TAB = [
  ["田園の村", null, null, null, null, null, null, null],
  ["分類", "近郊村"],
  ["接続ルート"],
  ["行先", "所要時間(h)", "表示", "手段"],
  ["王都", 1, "1時間", "徒歩"],
  ["施設ID", "施設名", "種別", "機能", "常駐/関連NPC", "商品・価格特色", "関連T/イベント変化", "備考"],
  ["LOC_FARM_SQUARE", "村の広場", "広場/掲示板", "村の噂", "ガロ村長", "無料情報が多い", "T01捜索", "情報ハブ"],
  ["LOC_FARM_EDGE", "村外れ・見張り小屋道", "村外/事件導線", "T01捜索", "フィン", "商品なし", "T01救出", "森方面への入口"],
];

function facility(id, name = "追加施設") {
  return [id, name, "村境/夜番", "見張り", "ジル", "販売なし", "T03", "備考"];
}

test("既存の施設IDだけを拾い、接続ルートや設計メモの行は施設と見なさない", () => {
  const ids = existingFacilityIds(VILLAGE_TAB);
  assert.deepEqual([...ids].sort(), ["LOC_FARM_EDGE", "LOC_FARM_SQUARE"]);
  assert.equal(ids.has("王都"), false, "接続ルートの行先を施設に数えない");
  assert.equal(ids.has("分類"), false);
});

test("既にある施設は二度書かない", () => {
  const fresh = selectNewFacilities(VILLAGE_TAB, [
    facility("LOC_FARM_SQUARE", "村の広場"),
    facility("LOC_FARM_NORTH_FENCE", "村の北柵"),
  ]);
  assert.deepEqual(fresh.map((row) => row[0]), ["LOC_FARM_NORTH_FENCE"]);
});

test("二度流しても増えない", () => {
  const once = selectNewFacilities(VILLAGE_TAB, [facility("LOC_FARM_NORTH_FENCE")]);
  assert.equal(once.length, 1);

  const after = [...VILLAGE_TAB, ...once];
  assert.deepEqual(selectNewFacilities(after, [facility("LOC_FARM_NORTH_FENCE")]), []);
});

test("同じCSVの中で施設IDが重複していても一度しか出さない", () => {
  const fresh = selectNewFacilities(VILLAGE_TAB, [
    facility("LOC_FARM_NORTH_FENCE", "村の北柵"),
    facility("LOC_FARM_NORTH_FENCE", "北柵（別案）"),
  ]);
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0][1], "村の北柵", "先に書いた方を採る");
});

test("拠点タブごとに分け、列は必ず正本の八列に揃える", () => {
  const grouped = groupByTab([
    ["田園の村", "LOC_FARM_NORTH_FENCE", "村の北柵"],
    ["王都", "LOC_CAP_TEST", "試験施設", "種別", "機能", "NPC", "価格", "関連T", "備考", "余分"],
    ["", "LOC_ORPHAN", "行き先の無い行"],
    ["田園の村", "", "施設IDの無い行"],
  ]);

  assert.deepEqual([...grouped.keys()], ["田園の村", "王都"]);
  for (const rows of grouped.values()) {
    for (const row of rows) assert.equal(row.length, FACILITY_COLUMNS.length);
  }
  assert.equal(grouped.get("田園の村").length, 1, "施設IDの無い行は落とす");
  assert.equal(grouped.get("王都")[0].at(-1), "備考", "九列目以降は切り捨てる");
});

test("追記CSVが正本の列数と拠点名に沿っている", async () => {
  const text = await readFile("docs/trpg/canon-facility-append-2026-08-08.csv", "utf8");
  const [header, ...body] = parseCsv(text);

  assert.deepEqual(header, ["拠点タブ", ...FACILITY_COLUMNS]);
  assert.ok(body.length > 0);
  for (const row of body) {
    assert.equal(row.length, header.length);
    assert.match(row[1], /^LOC_[A-Z0-9_]+$/);
  }
});

test("北柵が実装と同じ施設IDで正本へ行く", async () => {
  const text = await readFile("docs/trpg/canon-facility-append-2026-08-08.csv", "utf8");
  const grouped = groupByTab(parseCsv(text).slice(1));
  const village = grouped.get("田園の村") ?? [];

  const northFence = village.find((row) => row[0] === "LOC_FARM_NORTH_FENCE");
  assert.ok(northFence, "実装8モジュールが参照している施設が追記対象に入っていること");
  assert.equal(northFence[1], "村の北柵");
});
