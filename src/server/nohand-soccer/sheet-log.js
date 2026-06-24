import { SPREADSHEET_ID } from "../../foundation/env.js";
import { getSheetsClient } from "../../foundation/sheets.js";

const NO_HAND_SOCCER_SHEET_NAME = "素手以外セーフ";

function sheetRange(a1) {
  const escaped = NO_HAND_SOCCER_SHEET_NAME.replace(/'/g, "''");
  return `'${escaped}'!${a1}`;
}

export async function appendNoHandSoccerGimmickEntry({ description, emojis, gimmick }) {
  const sheets = await getSheetsClient();
  const createdAt = new Date().toISOString();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetRange("A2:I2"),
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        description,
        Array.isArray(emojis) ? emojis.join(" ") : "",
        gimmick?.name || "",
        gimmick?.visualLabel || "",
        gimmick?.shortEffect || "",
        gimmick?.shape || "",
        JSON.stringify(gimmick?.effects || []),
        JSON.stringify(gimmick || {}),
        createdAt,
      ]],
    },
  });
}
