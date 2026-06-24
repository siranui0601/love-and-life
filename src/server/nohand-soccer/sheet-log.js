import { SPREADSHEET_ID } from "../../foundation/env.js";
import { getSheetsClient } from "../../foundation/sheets.js";

const SHEET_NAME = "素手以外セーフ";
const HEADER = [
  "絵文字の組み合わせ",
  "ギミック名",
  "見た目ラベル",
  "効果説明",
  "フレーバー",
  "JSON",
  "生成元",
  "生成日時",
];

async function ensureHeaderRow(sheets) {
  const range = `${SHEET_NAME}!A1:H1`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const row = res.data.values?.[0] || [];
  const isEmpty = row.every((cell) => !String(cell || "").trim());
  if (!isEmpty) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [HEADER] },
  });
}

export async function appendNoHandSoccerGimmickLog({ emojis, gimmick, source = "gemini" }) {
  const sheets = await getSheetsClient();
  await ensureHeaderRow(sheets);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:H2`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        Array.isArray(emojis) ? emojis.join(" ") : String(emojis || ""),
        gimmick?.name || "",
        gimmick?.visualLabel || "",
        gimmick?.shortEffect || "",
        gimmick?.flavor || "",
        JSON.stringify(gimmick || {}),
        source,
        new Date().toISOString(),
      ]],
    },
  });
}
