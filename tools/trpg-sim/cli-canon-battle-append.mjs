#!/usr/bin/env node
// 正本へ、装備・素材買取・天候年鑑を追記する。
//
//   docs/trpg/equipment-additions.csv → 戦闘データマスター「装備性能マスター」＋「店舗装備在庫」
//   docs/trpg/material-buyback.csv    → 戦闘データマスター「素材買取価格」（無ければ新設）
//   docs/trpg/weather-almanac.csv     → TRPG「天候年鑑」（無ければ新設）
//
// 追記のみで、既存行の書き換えと削除は一切行わない。
// 同じIDの行が既にあれば飛ばすので、何度実行しても重複しない。
// ローカルには GOOGLE_SERVICE_ACCOUNT_KEY が無いため、実書き込みは GitHub Actions から行う。

import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseCsv } from "./cli-handover-append.mjs";

const BATTLE_SPREADSHEET_ID = process.env.TRPG_BATTLE_SPREADSHEET_ID
  ?? "1-2mUA20d7h1lmv1G9fCH0EryFEYyFQ2nkamN51uCPqw";
const WORLD_SPREADSHEET_ID = process.env.TRPG_SPREADSHEET_ID
  ?? "15slftR2b-76VKaUqTisYolhN1iCpHeB7asUBoyMnmRk";

const DRY_RUN = process.argv.includes("--dry-run");

/** 装備性能マスターの列。正本の並びに合わせる。 */
export const EQUIPMENT_COLUMNS = Object.freeze([
  "装備ID", "装備名", "装備枠", "武器種", "持ち方", "防具分類", "Tier",
  "推奨Lv下限", "推奨Lv上限", "地域系統", "物理威力", "魔導威力", "防御", "魔法耐性",
  "素早さ補正", "幸運補正", "命中補正", "回避補正", "会心補正",
  "デバフ成功補正", "デバフ耐性補正", "最大HP補正", "最大MP補正",
  "付与スキルID", "パッシブ効果", "欠点", "売却率", "性能指数", "説明", "状態",
]);

/** 店舗装備在庫の列。在庫IDは追記時に採番する。 */
export const STOCK_COLUMNS = Object.freeze([
  "在庫ID", "装備ID", "装備名", "既存商品ID", "拠点", "施設ID", "施設/売り手",
  "基準価格G", "在庫", "初期販売", "解禁条件", "価格変動/条件", "合法性", "地域係数", "備考",
]);

/**
 * 追記CSVの一行から、装備性能マスター行と店舗装備在庫行の両方を作る。
 * CSVは両方の列を一枚に持っているので、ここで二つに割る。
 */
export function splitEquipmentRow(record) {
  const equipment = EQUIPMENT_COLUMNS.map((column) => String(record[column] ?? ""));
  const stock = STOCK_COLUMNS.map((column) => {
    if (column === "在庫ID") return "";
    if (column === "装備ID") return String(record["装備ID"] ?? "");
    if (column === "装備名") return String(record["装備名"] ?? "");
    if (column === "拠点") return String(record["売り場"] ?? "");
    if (column === "施設/売り手") return String(record["施設/売り手"] ?? record["売り場"] ?? "");
    if (column === "地域係数") return String(record["地域係数"] ?? "1");
    return String(record[column] ?? "");
  });
  return { equipment, stock };
}

/**
 * 行の同一性は「鍵」で決める。装備と素材は一列目のIDで足りるが、
 * 天候年鑑は Day だけでは十二地域ぶんが衝突するので Day＋地域で見る。
 */
export const KEY_BY_FIRST_COLUMN = (row) => String(row?.[0] ?? "").trim();
export const KEY_BY_DAY_AND_REGION = (row) => `${String(row?.[0] ?? "").trim()}|${String(row?.[3] ?? "").trim()}`;

export function selectNewRows(existing, incoming, keyOf, isValidKey = () => true) {
  const seen = new Set();
  for (const row of existing ?? []) {
    const key = keyOf(row);
    if (isValidKey(key)) seen.add(key);
  }
  const fresh = [];
  for (const row of incoming) {
    const key = keyOf(row);
    if (!isValidKey(key) || seen.has(key)) continue;
    seen.add(key);
    fresh.push(row);
  }
  return fresh;
}

/** 既存の STK-#### の最大値の次から採番する。 */
export function nextStockId(existing) {
  let max = 0;
  for (const row of existing ?? []) {
    const match = /^STK-(\d{4})$/.exec(String(row?.[0] ?? "").trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  let cursor = max;
  return () => {
    cursor += 1;
    return `STK-${String(cursor).padStart(4, "0")}`;
  };
}

async function readRecords(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return [];
  }
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const [header, ...body] = rows;
  return body
    .filter((row) => row.some((cell) => String(cell).trim() !== ""))
    .map((row) => Object.fromEntries(header.map((column, index) => [column, row[index] ?? ""])));
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

/** タブが無ければ作る。ある場合は何もしない。 */
async function ensureTab(sheets, spreadsheetId, title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const found = (meta.data.sheets ?? []).some((sheet) => sheet.properties?.title === title);
  if (found) return false;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  console.log(`タブ「${title}」を新設しました。`);
  return true;
}

async function appendTo(sheets, spreadsheetId, tab, lastColumn, header, rows, keyOf, isValidKey) {
  const range = `'${tab}'!A:${lastColumn}`;
  const current = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const existing = current.data.values ?? [];
  console.log(`タブ「${tab}」の既存行数: ${existing.length}`);

  const values = [];
  if (existing.length === 0 && header) values.push(header);
  values.push(...selectNewRows(existing, rows, keyOf, isValidKey));
  if (values.length === 0) {
    console.log("  すべて既に反映済みでした。書き込みは行いません。");
    return 0;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
  console.log(`  ${values.length} 行を追記しました。`);
  return values.length;
}

/**
 * 宛先ごとに独立して走らせる。片方のスプレッドシートに権限が無くても、
 * 権限のあるほうは反映させたい。失敗は集めて最後にまとめて報告し、
 * 一つでも落ちていれば異常終了する（黙って握り潰さない）。
 */
async function attempt(label, task, failures) {
  try {
    await task();
    return true;
  } catch (error) {
    const message = String(error?.message ?? error);
    console.error(`× ${label}: ${message}`);
    if (/caller does not have permission|PERMISSION_DENIED|not found/i.test(message)) {
      console.error(`  → サービスアカウントにこのスプレッドシートの編集権限が無い可能性が高い。`);
      console.error(`     GOOGLE_SERVICE_ACCOUNT_KEY の client_email を、対象のシートに「編集者」で共有すること。`);
    }
    failures.push(label);
    return false;
  }
}

async function main() {
  const root = process.cwd();
  const equipmentRecords = await readRecords(path.join(root, "docs/trpg/equipment-additions.csv"));
  const materialRows = parseCsv(await readFile(path.join(root, "docs/trpg/material-buyback.csv"), "utf8"));
  const weatherRows = parseCsv(await readFile(path.join(root, "docs/trpg/weather-almanac.csv"), "utf8"));

  const split = equipmentRecords.map(splitEquipmentRow);
  console.log(`装備 ${split.length} 件 ／ 素材 ${materialRows.length - 1} 行 ／ 天候 ${weatherRows.length - 1} 行`);

  if (DRY_RUN) {
    for (const { equipment } of split) console.log(`  - ${equipment[0]} ${equipment[1]}`);
    console.log("--dry-run のため書き込みは行いません。");
    return;
  }

  const sheets = await sheetsClient();
  const failures = [];

  // 1. 装備性能マスター
  await attempt("戦闘データマスター/装備性能マスター", () => appendTo(
    sheets, BATTLE_SPREADSHEET_ID, "装備性能マスター", "AD",
    null, split.map((entry) => entry.equipment),
    KEY_BY_FIRST_COLUMN, (key) => /^EQP-[A-Z]-\d{4}$/.test(key),
  ), failures);

  // 2. 店舗装備在庫（在庫IDを既存の続きから採番する）
  await attempt("戦闘データマスター/店舗装備在庫", async () => {
    const range = "'店舗装備在庫'!A:O";
    const current = await sheets.spreadsheets.values.get({ spreadsheetId: BATTLE_SPREADSHEET_ID, range });
    const existing = current.data.values ?? [];
    const known = new Set(existing.map((row) => String(row?.[1] ?? "").trim()));
    const mint = nextStockId(existing);
    const fresh = split
      .filter((entry) => !known.has(entry.stock[1]))
      .map((entry) => { const row = [...entry.stock]; row[0] = mint(); return row; });
    if (fresh.length === 0) {
      console.log("タブ「店舗装備在庫」: すべて既に反映済みでした。");
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: BATTLE_SPREADSHEET_ID, range,
        valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
        requestBody: { values: fresh },
      });
      console.log(`タブ「店舗装備在庫」: ${fresh.length} 行を追記しました（${fresh[0][0]}〜${fresh.at(-1)[0]}）。`);
    }
  }, failures);

  // 3. 素材買取価格（新設タブ）
  await attempt("戦闘データマスター/素材買取価格", async () => {
    await ensureTab(sheets, BATTLE_SPREADSHEET_ID, "素材買取価格");
    await appendTo(sheets, BATTLE_SPREADSHEET_ID, "素材買取価格", "I",
      materialRows[0], materialRows.slice(1),
      KEY_BY_FIRST_COLUMN, (key) => /^MAT_[A-Z0-9_]+$/.test(key));
  }, failures);

  // 4. 天候年鑑（世界側のスプレッドシートへ新設）
  await attempt("TRPG/天候年鑑", async () => {
    await ensureTab(sheets, WORLD_SPREADSHEET_ID, "天候年鑑");
    // Day だけでは十二地域ぶんが衝突するので、Day＋地域を鍵にする。
    await appendTo(sheets, WORLD_SPREADSHEET_ID, "天候年鑑", "M",
      weatherRows[0], weatherRows.slice(1),
      KEY_BY_DAY_AND_REGION, (key) => /^\d{1,3}\|.+$/.test(key));
  }, failures);

  if (failures.length) {
    throw new Error(`${failures.length} 件の宛先へ反映できなかった: ${failures.join(" / ")}`);
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
