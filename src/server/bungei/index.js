import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import {
  appendBungeiEntry,
  findBungeiEntryByOrder,
  findUserByEmail,
  listBungeiLinesForPlayer,
  updateBungeiPlayers,
} from "../../foundation/sheets.js";

const BASE_PROMPT = `
舞台は高校の文芸部。部員はプレイヤーとミユ・シオン・ナナのみ。明日から夏休みで、今日が部活の最終日。

PLAYER_INPUTに対する会話シーンを生成せよ。
必ずJSONのみ出力。説明禁止。コードフェンス禁止。

ルール：
dialogueは配列。台詞のみ（地の文なし）。ミユ/シオン/ナナの発話を最低1回含める。プレイヤーは含めない。
各dialogueには "mood" を含めること。moodは "positive" "neutral" "negative" のいずれか（3択の表情差分）。
relationshipは交際相手名の配列（いなければ[]）
NowThinkingとcurrentSummary は短い要約

CHARACTERS
ミユ: 幼馴染。脳天気で天才肌
シオン: 真面目委員長。実はむっつりスケベ
ナナ: おっとり不思議ちゃん。遠慮を知らない

OUTPUT_JSON_EXAMPLE
{
  "dialogue": [
    { "speaker": "ミユ/シオン/ナナ", "line": "...", "mood": "positive|neutral|negative" }
/*5~10line*/
  ],
  "NowThinking": { "ミユ": "...", "シオン": "...", "ナナ": "..." },
  "currentSummary": "...",
  "relationship": [],
  "affection": { "ミユ": 20, "シオン": 20, "ナナ": 20 }
}
`.trim();

export function mountBungeiRoutes(app) {
  app.post("/api/bungei/options", async (req, res) => {
    const email = String(req.body?.email || "").trim();
    if (!email) {
      res.status(400).json({ error: "email_required" });
      return;
    }
    const speechOrder = Array.isArray(req.body?.speechOrder) ? req.body.speechOrder : [];

    try {
      const user = await findUserByEmail(email);
      if (!user?.username) {
        res.status(404).json({ error: "user_not_found" });
        return;
      }
      const options = await listBungeiLinesForPlayer(user.username, speechOrder);
      res.json({ options });
    } catch (error) {
      console.error("❌ Sheets Error (bungei options):", error);
      res.status(500).json({ error: "sheets_failed" });
    }
  });

  app.post("/api/bungei/scene", async (req, res) => {
    const input = String(req.body?.input || "").trim();
    if (!input) {
      res.status(400).json({ error: "input_required" });
      return;
    }

    const email = String(req.body?.email || "").trim();
    if (!email) {
      res.status(400).json({ error: "email_required" });
      return;
    }

    const currentSummary = req.body?.currentSummary ?? null;
    const relationship = Array.isArray(req.body?.relationship) ? req.body.relationship : [];
    const affection = req.body?.affection ?? null;
    const speechOrder = Array.isArray(req.body?.speechOrder) ? req.body.speechOrder : [];
    const user = await findUserByEmail(email);
    const playerName = user?.username || "プレイヤー";

    if (speechOrder.length) {
      try {
        const entry = await findBungeiEntryByOrder(speechOrder);
        if (entry?.output) {
          let playersList = [];
          try {
            playersList = JSON.parse(entry.players || "[]");
          } catch {
            playersList = [];
          }
          if (!Array.isArray(playersList)) {
            playersList = [];
          }
          if (!playersList.includes(playerName)) {
            playersList.push(playerName);
            await updateBungeiPlayers(entry.rowIndex, playersList);
          }
          const cached = JSON.parse(entry.output);
          res.json({ data: cached });
          return;
        }
      } catch (error) {
        console.error("❌ Sheets Error (bungei cache):", error);
      }
    }

    const prompt = `
${BASE_PROMPT}

PLAYER_NAME
${playerName}

PLAYER_INPUT
${input}

CURRENT_SUMMARY
${currentSummary ? currentSummary : "null"}

CHARACTERS_STATE
ミユ affection:${affection?.ミユ ?? 20} NowThinking:明日から海に行くか、プールに行くか悩んでいる
シオン affection:${affection?.シオン ?? 20} NowThinking:今日が最後の活動日なので、きちんと片付けまで終わらせたいと考えている
ナナ affection:${affection?.ナナ ?? 20} NowThinking:蝶々可愛い♡蝶々ってどうして蝶々って言うの？

RELATIONSHIP
${JSON.stringify(relationship)}
`.trim();

    try {
      const text = await genWithFallback(prompt);
      const jsonString = stripJsonFence(text);
      const data = JSON.parse(jsonString);
      if (speechOrder.length) {
        try {
          await appendBungeiEntry({
            orderList: speechOrder,
            output: JSON.stringify(data),
            players: [playerName],
          });
        } catch (error) {
          console.error("❌ Sheets Error (bungei append):", error);
        }
      }
      res.json({ data });
    } catch (error) {
      console.error("❌ Gemini API Error (bungei scene):", error);
      res.status(500).json({ error: "gemini_failed" });
    }
  });
}
