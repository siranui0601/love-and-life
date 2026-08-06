import assert from "node:assert/strict";
import test from "node:test";

import { parseCsv, rowKey, selectNewRows } from "../cli-handover-append.mjs";

test("the parser keeps commas, quotes and newlines inside quoted cells", () => {
  const rows = parseCsv([
    '日時,項目,内容,補足',
    '2026-08-06,実装,"三択は、意味を変える。""同義""は禁止",PASS',
    '2026-08-07,検証,"一行目\n二行目",OK',
  ].join("\n"));

  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], [
    "2026-08-06", "実装", '三択は、意味を変える。"同義"は禁止', "PASS",
  ]);
  assert.equal(rows[2][2], "一行目\n二行目");
});

test("blank lines never become rows", () => {
  const rows = parseCsv("日時,項目,内容,補足\n\n2026-08-06,a,b,c\n,,,\n");
  assert.equal(rows.length, 2);
});

test("a row is identified by its date and heading, not by its prose", () => {
  const a = ["2026-08-06 22:00 JST", "日常生活層の新設", "最初に書いた文", "PASS"];
  const b = ["2026-08-06 22:00 JST", "日常生活層の新設", "推敲した別の文", "PASS 691/691"];
  assert.equal(rowKey(a), rowKey(b));
});

test("re-running appends nothing when every row is already on the sheet", () => {
  const existing = [
    ["日時", "項目", "内容", "補足"],
    ["2026-08-06 22:00 JST", "検証状況", "691件全成功", "PASS"],
  ];
  const incoming = [
    ["2026-08-06 22:00 JST", "検証状況", "691件全成功（推敲後）", "PASS"],
  ];
  assert.deepEqual(selectNewRows(existing, incoming), []);
});

test("only genuinely new rows are appended, in order", () => {
  const existing = [
    ["2026-08-05 18:35 JST", "T11証人保護", "既存", ""],
  ];
  const incoming = [
    ["2026-08-05 18:35 JST", "T11証人保護", "重複", ""],
    ["2026-08-06 22:00 JST", "T02夜明け分岐の実装", "新規1", ""],
    ["2026-08-06 22:00 JST", "日常生活層の新設", "新規2", ""],
  ];
  assert.deepEqual(selectNewRows(existing, incoming).map((row) => row[1]), [
    "T02夜明け分岐の実装",
    "日常生活層の新設",
  ]);
});

test("a duplicate inside one batch is only appended once", () => {
  const incoming = [
    ["2026-08-06", "次作業", "一度目", ""],
    ["2026-08-06", "次作業", "二度目", ""],
  ];
  assert.equal(selectNewRows([], incoming).length, 1);
});

test("an empty sheet takes every incoming row", () => {
  const incoming = [["2026-08-06", "初回", "本文", ""]];
  assert.deepEqual(selectNewRows([], incoming), incoming);
});
