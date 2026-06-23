import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";

const ALLOWED_TEMPLATES = new Set([
  "BOUNCE",
  "LAUNCH",
  "FLOW",
  "SHAPE",
  "WARP",
  "ATTACH",
  "ROTATE",
  "CARRY",
  "PHASE",
  "SWITCH",
]);

const TEMPLATE_GUIDE = {
  BOUNCE: "反発。触れたボールを強く跳ね返す。バンパー、トランポリン、太鼓など。",
  LAUNCH: "発射。触れたボールを矢印方向へ飛ばす。大砲、ロケット、キック装置など。",
  FLOW: "風・流れ。範囲内のボールを継続的に押す。送風機、竜巻、水流など。",
  SHAPE: "地形。坂や板としてボールの進路を変える。すべり台、壁、レールなど。",
  WARP: "ワープ。入口に触れたボールを別地点へ逃がす。扉、穴、ポータルなど。",
  ATTACH: "糸・連結。近くのボールをゆるく引き寄せる。糸、クモの巣、鎖など。",
  ROTATE: "回転。回る棒や羽根でボールを弾く。歯車、扇、時計など。",
  CARRY: "運搬。乗ったボールを少し運ぶ。リフト、雲、鳥、台車など。",
  PHASE: "透過・幽霊。触れたボールを少し浮かせたり逃がす。幽霊門、透明化など。",
  SWITCH: "切替。近くのギミックの向きを変える。ボタン、レバー、信号など。",
};

function localFallback(emojis = [], fallbackTemplate = "BOUNCE") {
  const template = ALLOWED_TEMPLATES.has(fallbackTemplate) ? fallbackTemplate : "BOUNCE";
  return {
    name: `合法${emojis.join("")}`.slice(0, 24),
    flavor: `${emojis.join("")}を使った、審議中のサッカー装置。`,
    template,
    visualLabel: template === "LAUNCH" ? "大砲" : template === "FLOW" ? "送風機" : template === "SHAPE" ? "坂" : "装置",
    shortEffect: TEMPLATE_GUIDE[template].split("。")[1] || "ボールの動きを変える。",
  };
}

function normalizeString(value, fallback, maxLength) {
  const text = String(value || fallback || "").replace(/[\r\n\t]+/g, " ").trim();
  return text.slice(0, maxLength);
}

function normalizeResult(raw, fallback) {
  const template = ALLOWED_TEMPLATES.has(raw?.template) ? raw.template : fallback.template;
  return {
    name: normalizeString(raw?.name, fallback.name, 24),
    flavor: normalizeString(raw?.flavor, fallback.flavor, 80),
    template,
    visualLabel: normalizeString(raw?.visualLabel, fallback.visualLabel, 12),
    shortEffect: normalizeString(raw?.shortEffect, fallback.shortEffect, 34),
  };
}

export function mountNoHandSoccerRoutes(app) {
  app.post("/api/nohand-soccer/gimmick", async (req, res) => {
    const emojis = Array.isArray(req.body?.emojis) ? req.body.emojis.slice(0, 3).map(String) : [];
    const fallback = localFallback(emojis, req.body?.fallbackTemplate);

    if (emojis.length !== 3 || emojis.some((emoji) => !emoji.trim())) {
      return res.status(400).json({ error: "emojis must contain exactly 3 items." });
    }

    const prompt = `
あなたは物理パズルゲーム「サッカーはハンド以外セーフ？」のギミック設計AIです。
プレイヤーが選んだ絵文字3つから、ボールをゴールへ導く設置物を1つ作ってください。

重要方針:
- ユーザビリティ最優先。プレイヤーが一目で効果を理解できる名前と説明にする。
- ふざけた味は出してよいが、効果説明は短く具体的にする。
- 無限加速、永久ワープ、永続生成、即クリア、スコア直接加算は禁止。
- 物理数値はシステム側で決めるので、数値を書かない。
- template は必ず下記のいずれか1つ。

テンプレート:
${Object.entries(TEMPLATE_GUIDE).map(([key, desc]) => `- ${key}: ${desc}`).join("\n")}

選択絵文字: ${emojis.join(" ")}

JSONのみ返してください。Markdown禁止。
形式:
{
  "name": "12文字前後のギミック名",
  "flavor": "1文だけの短い説明",
  "template": "BOUNCE等の許可テンプレート",
  "visualLabel": "大砲、坂、送風機など見た目を表す短い名詞",
  "shortEffect": "触れると何が起きるかを短く説明"
}
`.trim();

    try {
      const text = await genWithFallback(prompt, {
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.55,
        },
      });
      const parsed = JSON.parse(stripJsonFence(text));
      return res.json(normalizeResult(parsed, fallback));
    } catch (error) {
      console.warn("[noHand-soccer] Gemini gimmick fallback", error);
      return res.json({ ...fallback, source: "fallback" });
    }
  });
}
