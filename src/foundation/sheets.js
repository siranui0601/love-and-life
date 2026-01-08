import { google } from "googleapis";
import { serviceAccount, SPREADSHEET_ID, SHEET_NAME } from "./env.js";

export async function getSheetsClient() {
  if (!serviceAccount) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません");

  const auth = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

// email からユーザーを探す
export async function findUserByEmail(email) {
  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:C`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  const rows = res.data.values || [];
  for (const row of rows) {
    const [rowEmail, username, displayName] = row;
    if (rowEmail === email) return { email: rowEmail, username, displayName };
  }
  return null;
}

// 新規ユーザー追加
export async function addUser({ email, username, displayName }) {
  const sheets = await getSheetsClient();
  const range = `${SHEET_NAME}!A2:C2`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[email, username, displayName]] },
  });
  return { email, username, displayName };
}

export { SPREADSHEET_ID, SHEET_NAME };