#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

export const SOURCE = Object.freeze({
  spreadsheetId: "1aSLu_pSLNsFsUm42juEyOrLDmTkJd7NPOOrQNnvnMwA",
  spreadsheetTitle: "TRPG_人徳ルート正規台帳_v2",
  sheetName: "正規台帳",
  sheetId: 453964624,
  range: "'正規台帳'!A1:AF832",
  totalRows: 832,
  dataRows: 831,
  columns: 32,
});

const CSV_PATH = path.join(ROOT, "docs/trpg/virtue-route-v2-source.csv");
const META_PATH = path.join(ROOT, "docs/trpg/virtue-route-v2-source.meta.json");
const EXPECTED_HEADER = Object.freeze([
  "Day", "開始", "終了", "場所", "移動元", "移動先", "行動", "選択",
  "action ID", "runtime action", "NPC", "事件", "移動時間分", "空腹前",
  "空腹後", "疲労前", "疲労後", "HP", "MP", "所持金前", "収入", "支出",
  "所持金後", "SP(累計/使用/残)", "取得可能/見送り", "取得スキル", "装備",
  "消耗品/素材", "NPC状態", "世界状態", "事件状態", "Lv",
]);

export function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function canonicalCsv(rows) {
  if (!Array.isArray(rows) || rows.length !== SOURCE.totalRows) {
    throw new Error(`expected ${SOURCE.totalRows} sheet rows, got ${rows?.length ?? "invalid"}`);
  }
  const normalized = rows.map((row) => Array.from(
    { length: SOURCE.columns },
    (_, index) => row?.[index] ?? "",
  ));
  const header = normalized[0].map(String);
  if (JSON.stringify(header) !== JSON.stringify(EXPECTED_HEADER)) {
    throw new Error(`unexpected source header: ${JSON.stringify(header)}`);
  }
  if (normalized.slice(1).some((row) => row.every((value) => String(value) === ""))) {
    throw new Error("source contains a blank data row");
  }
  return `${normalized.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value !== ""));
}

export function localMetadata(csv, fetchedAt, spreadsheetTitle = SOURCE.spreadsheetTitle) {
  const rows = parseCsv(csv);
  return {
    exporterVersion: "virtue-route-v2-sheet-export-v1",
    spreadsheetId: SOURCE.spreadsheetId,
    spreadsheetTitle,
    sheetName: SOURCE.sheetName,
    sheetId: SOURCE.sheetId,
    range: SOURCE.range,
    totalRows: rows.length,
    dataRows: rows.length - 1,
    columns: Math.max(...rows.map((row) => row.length)),
    fetchedAt,
    sourceHashAlgorithm: "sha256",
    sourceHash: sha256(csv),
  };
}

export async function verifyLocalSource() {
  const [csv, rawMeta] = await Promise.all([
    readFile(CSV_PATH, "utf8"),
    readFile(META_PATH, "utf8"),
  ]);
  const meta = JSON.parse(rawMeta);
  const rows = parseCsv(csv);
  const actual = {
    rows: rows.length - 1,
    columns: Math.max(...rows.map((row) => row.length)),
    sourceHash: sha256(csv),
  };
  if (rows.length !== SOURCE.totalRows) throw new Error(`local source rows ${rows.length - 1} != ${SOURCE.dataRows}`);
  if (actual.columns !== SOURCE.columns) throw new Error(`local source columns ${actual.columns} != ${SOURCE.columns}`);
  if (actual.sourceHash !== meta.sourceHash) throw new Error(`local source hash ${actual.sourceHash} != metadata ${meta.sourceHash}`);
  if (meta.spreadsheetId !== SOURCE.spreadsheetId || meta.sheetName !== SOURCE.sheetName) {
    throw new Error("local source metadata points at a different canonical sheet");
  }
  return { ...actual, spreadsheetId: meta.spreadsheetId, sheetName: meta.sheetName };
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
    ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  );
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

async function fetchCanonicalRows() {
  const sheets = await sheetsClient();
  const [book, values] = await Promise.all([
    sheets.spreadsheets.get({
      spreadsheetId: SOURCE.spreadsheetId,
      fields: "properties.title,sheets.properties(sheetId,title,gridProperties)",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: SOURCE.spreadsheetId,
      range: SOURCE.range,
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    }),
  ]);
  if (book.data.properties?.title !== SOURCE.spreadsheetTitle) {
    throw new Error(`unexpected spreadsheet title: ${book.data.properties?.title}`);
  }
  const tab = book.data.sheets?.find((sheet) => sheet.properties?.title === SOURCE.sheetName);
  if (tab?.properties?.sheetId !== SOURCE.sheetId) throw new Error("canonical sheetId changed");
  return {
    rows: values.data.values ?? [],
    spreadsheetTitle: book.data.properties.title,
  };
}

async function main() {
  if (process.argv.includes("--verify-local")) {
    console.log(JSON.stringify(await verifyLocalSource(), null, 2));
    return;
  }
  const checkOnly = process.argv.includes("--check");
  const { rows, spreadsheetTitle } = await fetchCanonicalRows();
  const csv = canonicalCsv(rows);
  const metadata = localMetadata(csv, new Date().toISOString(), spreadsheetTitle);
  if (checkOnly) {
    const tracked = await readFile(CSV_PATH, "utf8");
    if (tracked !== csv) throw new Error(`tracked source differs from live sheet (${sha256(tracked)} != ${metadata.sourceHash})`);
    console.log(JSON.stringify(metadata, null, 2));
    return;
  }
  await Promise.all([
    writeFile(CSV_PATH, csv, "utf8"),
    writeFile(META_PATH, `${JSON.stringify(metadata, null, 2)}\n`, "utf8"),
  ]);
  console.log(JSON.stringify(metadata, null, 2));
}

const invokedDirectly = process.argv[1]
  && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
