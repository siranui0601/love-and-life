import { SPREADSHEET_ID } from "../../foundation/env.js";
import { getSheetsClient } from "../../foundation/sheets.js";

const SHEET_NAME = "素手以外セーフ";

export async function appendNoHandSoccerGimmickLog({ emojis, gimmick, source = "gemini" }) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:H2`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        "絵文字の組み合わせ",
        Array.isArray(emojis) ? emojis.join(" ") : String(emojis || ""),
        gimmick?.name || "",
        gimmick?.visualLabel || "",
        gimmick?.shortEffect || "",
        gimmick?.flavor || "",
        JSON.stringify(gimmick || {}),
        source,
      ]],
    },
  });
}
