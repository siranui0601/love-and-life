#!/usr/bin/env node
// 正本（TRPGスプレッドシート）の拠点タブへ、施設行を追記する。
//
// 実装側に存在するのに正本の施設一覧に無い施設を、正本側へ揃えるための道具である。
// 正本の各拠点タブには「今後追記する主な内容」欄があり、施設の追加は想定されている。
//
// 追記のみで、既存行の書き換えと削除は一切行わない。
// 同じ施設IDの行が既にあれば飛ばすので、何度実行しても重複しない。
// ローカルには GOOGLE_SERVICE_ACCOUNT_KEY が無いため、実書き込みは GitHub Actions から行う。

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { parseCsv } from "./cli-handover-append.mjs";

const SPREADSHEET_ID = process.env.TRPG_SPREADSHEET_ID
  ?? "15slftR2b-76VKaUqTisYolhN1iCpHeB7asUBoyMnmRk";
const APPEND_DIR = process.env.TRPG_CANON_APPEND_DIR ?? "docs/trpg";
const APPEND_PREFIX = "canon-facility-append-";

const DRY_RUN = process.argv.includes("--dry-run");

// 正本の施設表の列。拠点タブごとにこの並びで書かれている。
export const FACILITY_COLUMNS = Object.freeze([
  "施設ID",
  "施設名",
  "種別",
  "機能",
  "常駐/関連NPC",
  "商品・価格特色",
  "関連T/イベント変化",
  "備考",
]);

// CSVの一列目は行き先の拠点タブ名で、残りが施設表の八列になる。
const CSV_COLUMNS = Object.freeze(["拠点タブ", ...FACILITY_COLUMNS]);

export function facilityIdOf(row) {
  return String(row?.[0] ?? "").trim();
}

// 拠点タブの中には施設ID以外の行（接続ルートや設計メモ）も混ざっているので、
// 施設IDらしい形をした一列目だけを既存扱いにする。
export function existingFacilityIds(tabRows) {
  const ids = new Set();
  for (const row of tabRows ?? []) {
    const id = facilityIdOf(row);
    if (/^LOC_[A-Z0-9_]+$/.test(id)) ids.add(id);
  }
  return ids;
}

export function selectNewFacilities(tabRows, incomingRows) {
  const seen = existingFacilityIds(tabRows);
  const fresh = [];
  for (const row of incomingRows) {
    const id = facilityIdOf(row);
    if (id === "" || seen.has(id)) continue;
    seen.add(id);
    fresh.push(row);
  }
  return fresh;
}

// 拠点タブ名ごとに施設行をまとめる。列数は必ず八列に揃える。
export function groupByTab(csvRows) {
  const grouped = new Map();
  for (const row of csvRows) {
    const tab = String(row[0] ?? "").trim();
    if (tab === "") continue;
    const facility = FACILITY_COLUMNS.map((_, index) => String(row[index + 1] ?? ""));
    if (facilityIdOf(facility) === "") continue;
    if (!grouped.has(tab)) grouped.set(tab, []);
    grouped.get(tab).push(facility);
  }
  return grouped;
}

async function collectAppendRows(rootDir) {
  const dir = path.resolve(rootDir, APPEND_DIR);
  let names = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const files = names
    .filter((name) => name.startsWith(APPEND_PREFIX) && name.endsWith(".csv"))
    .sort();

  const rows = [];
  for (const name of files) {
    const parsed = parseCsv(await readFile(path.join(dir, name), "utf8"));
    if (parsed.length === 0) continue;
    const [header, ...body] = parsed;
    const isHeader = String(header[0] ?? "").trim() === CSV_COLUMNS[0];
    rows.push(...(isHeader ? body : parsed));
  }
  return rows;
}

async function sheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません");
  const credentials = JSON.parse(raw);
  const { google } = await import("googleapis");
  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"],
  );
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

async function main() {
  const grouped = groupByTab(await collectAppendRows(process.cwd()));
  if (grouped.size === 0) {
    console.log("追記対象の施設行はありません。");
    return;
  }

  for (const [tab, rows] of grouped) {
    console.log(`追記候補 ${tab}: ${rows.length} 件`);
    for (const row of rows) console.log(`  - ${row[0]} ${row[1]}`);
  }

  if (DRY_RUN) {
    console.log("--dry-run のため書き込みは行いません。");
    return;
  }

  const sheets = await sheetsClient();
  for (const [tab, rows] of grouped) {
    const range = `'${tab}'!A:H`;
    const current = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });
    const existing = current.data.values ?? [];
    console.log(`タブ「${tab}」の既存行数: ${existing.length}`);

    const fresh = selectNewFacilities(existing, rows);
    if (fresh.length === 0) {
      console.log(`  すべて既に反映済みでした。書き込みは行いません。`);
      continue;
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: fresh },
    });
    console.log(`  ${fresh.length} 行を追記しました。`);
    for (const row of fresh) console.log(`  + ${row[0]} ${row[1]}`);
  }
}

const invokedDirectly = process.argv[1]
  && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
