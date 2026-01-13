import dotenv from "dotenv";
dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });

export const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
  : null;

export const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
export const SHEET_NAME = process.env.SHEET_NAME || "Users";

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const PORT = process.env.PORT || 3000;