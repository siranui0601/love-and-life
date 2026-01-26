import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import {
  appendBungeiEntry,
  findBungeiEntryByOrder,
  findUserByEmail,
  listBungeiLinesForPlayer,
  updateBungeiEpilogue,
  updateBungeiPlayers,
} from "../../foundation/sheets.js";

const EPILOGUE_BACKGROUNDS = [
  { name: "遊園地", url: "https://pbs.twimg.com/media/G_g7eOPbIAA-osB.jpg" },
  { name: "夏祭り", url: "https://pbs.twimg.com/media/G_g7eOwWQAAxwB1.jpg" },
  { name: "海辺の防波堤", url: "https://pbs.twimg.com/media/G_g7eOzXsAASVRj.jpg" },
  { name: "水族館", url: "https://pbs.twimg.com/media/G_g7eOMaoAEP5u6.jpg" },
  { name: "カフェのテラス", url: "https://pbs.twimg.com/media/G_g7e9LasAAA4_B.jpg" },
  { name: "映画館のロビー", url: "https://pbs.twimg.com/media/G_g7e9NboAA__6e.jpg" },
  { name: "ボーリング場", url: "https://pbs.twimg.com/media/G_g7e90WIAAQ37_.jpg" },
  { name: "海辺の展望台", url: "https://pbs.twimg.com/media/G_g7e9PbsAAy2Az.jpg" },
  { name: "夜の公園", url: "https://pbs.twimg.com/media/G_g7fp5bQAA15Ut.jpg" },
  { name: "星が見える丘", url: "https://pbs.twimg.com/media/G_g7fqrWcAAef_j.jpg" },
  { name: "空港のロビー", url: "https://pbs.twimg.com/media/G_g7fp7bsAAmsSA.jpg" },
  { name: "商店街", url: "https://pbs.twimg.com/media/G_g7fp6bQAA0_Sl.jpg" },
  { name: "コンビニ前", url: "https://pbs.twimg.com/media/G_g7gccbkAAT4r6.jpg" },
  { name: "田舎のバス停", url: "https://pbs.twimg.com/media/G_g7gdBX0AAQPHT.jpg" },
];

const DEFAULT_EPILOGUE_LINE = "夏の終わりは静かに訪れた。";

function getRandomEpilogueBackground() {
  return EPILOGUE_BACKGROUNDS[Math.floor(Math.random() * EPILOGUE_BACKGROUNDS.length)];
}

function parseDialogueText(text) {
  if (!text) return [];
  return String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:：]+)[:：]\s*(.+)$/);
      if (match) {
        return { speaker: match[1].trim(), line: match[2].trim() };
      }
      return { speaker: "エピローグ", line };
    });
}

function normalizeDialoguePayload(raw) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && typeof raw === "object" && Array.isArray(raw.dialogue)) {
    return raw.dialogue;
  }
  if (typeof raw === "string") {
    return parseDialogueText(raw);
  }
  return [];
}

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
    const condition = req.body?.condition && typeof req.body.condition === "object" ? req.body.condition : null;
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
舞台は高校の文芸部。部員は${playerName}とミユ・シオン・ナナのみ。明日から夏休みで、今日が部活の最終日。

${playerName}の発言「${input}」に対する会話シーンを生成せよ。
必ずJSONのみ出力。説明禁止。コードフェンス禁止。

ルール：
dialogueは配列。台詞のみ（地の文なし）
ミユ/シオン/ナナの発話を最低1回含める
${playerName} の発言は dialogue に含めない
各dialogueには "mood" を含めること（"positive"|"neutral"|"negative"）
condition.*.relationshipは、交際するならtrueにする。判定緩め
currentSummaryとNowThinkingは短い要約

CHARACTERS
ミユ: 幼馴染。脳天気で天才肌
シオン: 真面目委員長。実はむっつりスケベ
ナナ: おっとり不思議ちゃん。遠慮を知らない

OUTPUT_JSON_EXAMPLE
{
  "dialogue": [
    { "speaker": "ミユ/シオン/ナナ", "line": "...", "mood": "positive|neutral|negative" }
    /*6~10文*/
  ],
  "currentSummary": "...",
  "condition": {
    "ミユ": {"relationship": false, "NowThinking": "..." },
    "シオン": {"relationship": false, "NowThinking": "..." },
    "ナナ": {"relationship": false, "NowThinking": "..." }
  }
}

CURRENT_SUMMARY
${currentSummary ?? "null"}

CURRENT_CONDITION
${JSON.stringify(
      {
        ミユ: {
          relationship: condition?.ミユ?.relationship ?? false,
          NowThinking:
            condition?.ミユ?.NowThinking ??
            "明日から海に行くか、プールに行くか悩んでいる",
        },
        シオン: {
          relationship: condition?.シオン?.relationship ?? false,
          NowThinking:
            condition?.シオン?.NowThinking ??
            "今日が最後の活動日なので、きちんと片付けまで終わらせたいと考えている",
        },
        ナナ: {
          relationship: condition?.ナナ?.relationship ?? false,
          NowThinking:
            condition?.ナナ?.NowThinking ??
            "蝶々可愛い♡蝶々ってどうして蝶々って言うの？",
        },
      },
      null,
      0
    )}
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

  app.post("/api/bungei/epilogue", async (req, res) => {
    const email = String(req.body?.email || "").trim();
    if (!email) {
      res.status(400).json({ error: "email_required" });
      return;
    }
    const relationship = Array.isArray(req.body?.relationship) ? req.body.relationship : [];
    const condition =
      req.body?.condition && typeof req.body.condition === "object" ? req.body.condition : null;
    const speechOrder = Array.isArray(req.body?.speechOrder) ? req.body.speechOrder : [];

    try {
      const user = await findUserByEmail(email);
      if (!user?.username) {
        res.status(404).json({ error: "user_not_found" });
        return;
      }
      const playerName = user.username;
      if (speechOrder.length) {
        try {
          const entry = await findBungeiEntryByOrder(speechOrder);
          if (entry?.epilogue) {
            let cachedPayload = null;
            try {
              cachedPayload = JSON.parse(entry.epilogue);
            } catch {
              cachedPayload = entry.epilogue;
            }
            const dialogue = normalizeDialoguePayload(cachedPayload);
            const backgroundName =
              cachedPayload && typeof cachedPayload === "object"
                ? cachedPayload.backgroundName
                : null;
            const background =
              EPILOGUE_BACKGROUNDS.find((item) => item.name === backgroundName) ||
              getRandomEpilogueBackground();
            res.json({
              epilogue: dialogue.length
                ? dialogue
                : [{ speaker: playerName, line: DEFAULT_EPILOGUE_LINE }],
              background,
            });
            return;
          }
        } catch (error) {
          console.error("❌ Sheets Error (bungei epilogue cache):", error);
        }
      }

      const background = getRandomEpilogueBackground();
      const conditionSource =
        condition ??
        Object.fromEntries(relationship.map((name) => [name, { relationship: true }]));
      const loverEntries = Object.entries(conditionSource || {}).filter(
        ([_, v]) => v?.relationship
      );
      const loverNames = loverEntries.map(([name]) => name);
      const loverCondition = Object.fromEntries(loverEntries);
      const lovers = Object.entries(conditionSource || {}).filter(([_, v]) => v?.relationship);
      let prompt;

      if (lovers.length > 0) {
        prompt = `
舞台は高校の夏休み。文芸部の活動はすでに終わっている。
BACKGROUND_NAMEでの${playerName}と交際中キャラとの超甘々エピローグ会話を生成せよ。必ず全員が1回以上発話すること。${
  loverNames.length > 1 ? "修羅場感を含めても良い" : ""
}

必ずJSONのみ出力。説明禁止。コードフェンス禁止。

ルール:
dialogueは配列。台詞のみ（地の文なし）
speaker は ${playerName} 、${loverNames.join("、")}のみ
8~15行

${playerName}と交際中のキャラ
${loverNames
  .map((name) => {
    if (name === "ミユ") return "ミユ: 幼馴染。脳天気で天才肌";
    if (name === "シオン") return "シオン: 真面目委員長。実はむっつりスケベ";
    if (name === "ナナ") return "ナナ: おっとり不思議ちゃん。遠慮を知らない";
    return "";
  })
  .join("\n")}

OUTPUT_JSON_EXAMPLE
{
  "dialogue": [
    { "speaker": "${loverNames[0] ?? playerName}", "line": "..." },
    { "speaker": "${playerName}", "line": "..." }
  ]
}

BACKGROUND_NAME
${background.name}

CURRENT_CONDITION
${JSON.stringify(loverCondition, null, 0)}
`.trim();
      } else {
        prompt = `
舞台は高校の夏休み。文芸部の活動はすでに終わっている。

BACKGROUND_NAME での、${playerName}の独り言によるエピローグを生成せよ。
少し切なく、しかし前向きな余韻を残す内容にすること。

必ずJSONのみ出力。説明禁止。コードフェンス禁止。

ルール:
dialogueは配列
speaker は必ず ${playerName} のみ
台詞のみ（地の文なし）
5~10行程度

OUTPUT_JSON_EXAMPLE
{
  "dialogue": [
    { "speaker": "${playerName}", "line": "..." }
  ]
}

BACKGROUND_NAME
${background.name}
`.trim();
      }

      const text = await genWithFallback(prompt);
      const cleaned = stripJsonFence(text);
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = cleaned;
      }
      const dialogue = normalizeDialoguePayload(parsed);
      const epiloguePayload = JSON.stringify({
        dialogue: dialogue.length
          ? dialogue
          : [{ speaker: playerName, line: DEFAULT_EPILOGUE_LINE }],
        backgroundName: background.name,
      });

      if (speechOrder.length) {
        try {
          const entry = await findBungeiEntryByOrder(speechOrder);
          if (entry?.rowIndex) {
            await updateBungeiEpilogue(entry.rowIndex, epiloguePayload);
          } else {
            await appendBungeiEntry({
              orderList: speechOrder,
              output: "",
              players: [playerName],
              epilogue: epiloguePayload,
            });
          }
        } catch (error) {
          console.error("❌ Sheets Error (bungei epilogue update):", error);
        }
      }

      res.json({
        epilogue: dialogue.length
          ? dialogue
          : [{ speaker: playerName, line: DEFAULT_EPILOGUE_LINE }],
        background,
      });
    } catch (error) {
      console.error("❌ Gemini API Error (bungei epilogue):", error);
      res.status(500).json({ error: "gemini_failed" });
    }
  });
}
