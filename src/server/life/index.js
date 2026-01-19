import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";

const SYS = `#RULES
Output JSON only. No fences, no narration, no placeholders
Player first-person="俺"
No third-person descriptions.Dialogue only
Strings must be single-line
`;

const LIKE_RULE = `#LIKE_BANDS
- like <= -60: 殺意レベルの拒絶
- like <= -40: 強い拒絶
- like <= -20: 嫌悪
- like < 0: 不快・警戒
- like < 20: 知り合い
- like < 40: 好意あり
- like < 60: 超好意
- like < 80: 超恋人
- else: 恋愛感情MAX
`;

// ---------- エンディング（最終日）用：キャラ話法スタイル ----------
const CHARACTER_STYLE = {
  ミユ: `
【性格】明るく元気で素直。感情が顔に出やすい。少し甘えん坊。
【話し方】テンション高め、感嘆詞多め（〜だねっ！ 〜じゃん！ など）
【呼称】相手は基本「呼び捨て」`,
  シオン: `
【性格】無口で真面目。不器用だが根は優しい。ツンデレ傾向。
【話し方】丁寧で冷静。ちょっと心配症。
【呼称】相手は「さん」付け`,
  ナナ: `
【性格】落ち着きがあり柔らかい。時々ミステリアス。面倒見が良い。
【話し方】丁寧でやわらかい。少し含みのある冗談も。
【呼称】相手は「くん」付け`,
};

// ---------- 共通プロファイル ----------
function profileBlock(playername) {
  return {
    ミユ: `
【関係性】${playername}の幼馴染。呼び方は「${playername}」と呼び捨て。
【性格】明るく元気で素直。感情が顔に出やすい。少し甘えん坊。
【話し方】テンション高め、感嘆詞多め（〜だねっ！ 〜じゃん！ など）
【好き】海・夏祭り・ラムネ
【苦手】静かな場所・長時間の読書
【一人称】あたし
`,
    シオン: `
【関係性】${playername}のクラスメイト。呼び方は「${playername}さん」。
【性格】無口で真面目。不器用だが根は優しい。ツンデレ傾向。
【話し方】丁寧で冷静。ちょっと心配症。
【好き】神社・静かな景色・本
【苦手】騒がしい場所・大人数の会話
【一人称】私
`,
    ナナ: `
【関係性】近所のカフェで働く年上の先輩。呼び方は「${playername}くん」。
【性格】落ち着きがあり柔らかい。時々ミステリアス。面倒見が良い。
【話し方】丁寧でやわらかい。少し含みのある冗談も。
【好き】カフェ・商店街・紅茶
【苦手】騒がしい場所・虫
【一人称】私
`,
  };
}

function clampLikabilityChange(value, min = -10, max = 10) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const rounded = Math.round(num);
  return Math.max(min, Math.min(max, rounded));
}
function normalizeTagBlock(block) {
  return typeof block === "string" ? block : "";
}

function getLikeBand(like) {
  if (like <= -60) return "殺意レベルの拒絶";
  if (like <= -40) return "強い拒絶";
  if (like <= -20) return "嫌悪";
  if (like < 0) return "不快・警戒";
  if (like < 20) return "知り合い";
  if (like < 40) return "好意あり";
  if (like < 60) return "超好意";
  if (like < 80) return "超恋人";
  return "恋愛感情MAX";
}

// ===== 休みイベント：台詞生成（訪問／意趣返し／冷笑） =====
function jsonOnly(s){ return typeof s === "string" ? s.replace(/^```json\s*|\s*```$/g, "") : s; }
async function generateRestDialogue(payload) {
  // payload = { playername, visitors:["ミユ","シオン",...], type:"visit"|"spite"|"mock", reasonKey, reasonLabel, likabilities:{ミユ:number,シオン:number,ナナ:number} }
  const {
    playername = "プレイヤー",
    visitors = [],
    type = "visit",
    reasonLabel = "体調不良",
    likabilities = {}
  } = payload || {};

  // 来訪者が空の場合は最小のフォールバック（通常、クライアント側で呼ばれない想定）
  if (!Array.isArray(visitors) || visitors.length === 0) {
    return [{ name: playername, message: "今日はおとなしく休むしかないな……。" }];
  }

  const profiles = profileBlock(playername);
  const joinedProfiles = visitors.map(ch => `【${ch}】\n${profiles[ch] || ""}`).join("\n");
  const visitorBands = visitors
    .map((v) => `${v}:${getLikeBand(likabilities?.[v] ?? 0)}`)
    .join(", ");

  const prompt = `
${SYS}
#TASK rest-dialogue
reason:${reasonLabel}
player:${playername}
visitors:${visitors.join(",")}
bands:${visitorBands}
profiles:
${joinedProfiles}

#GUIDE
Tone per visitor strictly follows their band
Only ${playername} and visitors speak
Each visitor speaks >=2 lines.
Mention reason naturally (not every line)

#FORMAT
[
 {"name":"X","message":"..."},
 ...
]
- 6-12 lines.
`.trim();

  const text = jsonOnly(await genWithFallback(prompt));
  let arr;
  try {
    arr = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned non-JSON");
  }
  // 整形＆バリデーション
  const cleaned = (Array.isArray(arr) ? arr : [])
    .filter(l => l && typeof l.name === "string" && typeof l.message === "string")
    .map(l => ({ name: l.name.trim(), message: l.message.trim() }))
    .filter(l => l.name && l.message);

  if (!cleaned.length) {
    // フォールバック：非常に短い来訪
    const who = visitors[0];
    return [
      { name: who,        message: `${playername}、${reasonLabel}って聞いて…大丈夫？` },
      { name: playername, message: "心配かけた。来てくれて助かったよ。" }
    ];
  }
  return cleaned;
}
// 明示フォールバック（生成失敗時）
function fallbackRestDialogue(payload) {
  const { playername, visitors = [], type = "visit", reasonLabel = "体調不良" } = payload || {};
  if (!visitors.length) {
    return [{ name: playername, message: "今日は休もう……。" }];
  }
  const lines = [];
  visitors.forEach(v => {
    if (type === "visit") {
      lines.push({ name: v,          message: `${playername}、${reasonLabel}だって？無理しないで。` });
      lines.push({ name: playername, message: "ありがとな。少し元気出た。" });
    } else if (type === "spite") {
      lines.push({ name: v,          message: `${reasonLabel}ね。…前の仕返し、ってわけじゃないけど。` });
      lines.push({ name: playername, message: "今日は勘弁してくれ……。" });
    } else {
      lines.push({ name: v,          message: `${reasonLabel}？…そっか。そうなんだ。` });
      lines.push({ name: playername, message: "…………。" });
    }
  });
  return lines;
}


// ---------- 通常（1対1）イベント ----------
async function generateGameEvent(
  character,
  place,
  likability,
  playername,
  playerTagBlock,
) {
  const characterProfiles = profileBlock(playername);
  const likeBand = getLikeBand(likability);

  const prompt = `
${SYS}${LIKE_RULE}
#TASK normal-encounter
you:${character}
player:${playername}| tags:${playerTagBlock || "none"}
place:${place.name}|${place.detail}
likeBand:${likeBand}
profile:${characterProfiles[character]}

#OUTPUT
{
 "message":"(1 short line to ${playername})",
 "choices":[
  {"text":"(player reply 1, 1 line, seems good)","likabilityChange":INT(-15..15),"reaction":"(1 line, seems good)"},
  {"text":"(player reply 2, 1 line, seems good)","likabilityChange":INT(-15..15),"reaction":"(1 line, seems good)"}
 ]
}
`.trim();

  try {
     const text = await genWithFallback(prompt);
    const jsonString = text.replace(/^```json\n?|\n?```$/g, "");
    console.log(jsonString);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("❌ Gemini API Error (1v1):", error);
    return {
      message: "（AIが考え中です…少し待ってね）",
      choices: [
        { text: "うん、待つよ", likabilityChange: 0, reaction: "ありがとう！" },
        { text: "また今度で", likabilityChange: 0, reaction: "そ、そうだね…" },
      ],
    };
  }
}

async function generateShiftEncounterEvent(payload) {
  const {
    playername = "プレイヤー",
    character = "ミユ",
    job = {},
    place = {},
    likability = 0,
    fishingDayCount = null,
    playerTagBlock = "",
    newlyAcquiredTagDetail = null,
  } = payload || {};
  const characterProfiles = profileBlock(playername);
  const likeBand = getLikeBand(likability);
  const jobLabel = job.label || "バイト";
  const placeInfo = place.name ? place : job.place || { name: "職場", detail: "" };
  const placeLine = `${placeInfo.name}|${placeInfo.detail}`;
  const payoutLabel = job.payoutLabel || "不明";

  const prompt = `
${SYS}${LIKE_RULE}
#TASK shift-encounter
player:${playername}| tags:${playerTagBlock || "none"}
job:${jobLabel}
${job.type==="weekly" ? `day:${fishingDayCount||1}/7` : ""}
${job.type==="dark" ? `result:${payoutLabel}` : `place:${placeLine}`}
you:${character}
likeBand:${likeBand}
profile:${characterProfiles[character]}
${newlyAcquiredTagDetail ? `newTrait:${newlyAcquiredTagDetail.detail}` : ""}

#OUTPUT
{
 "likabilityChange":INT(-10..10),
 "lines":[
  {"name":"X","message":"..."},
  ...
 ]
}
Rules:
- 10 lines approx.
- Only player/you/workplace people.`.trim();

  try {
    const text = stripJsonFence(await genWithFallback(prompt));
    return JSON.parse(text);
  } catch (error) {
    console.error("❌ Gemini API Error (shift encounter):", error);
    return {
      likabilityChange: 2,
      lines: [
        { name: character, message: "ここで働いてるんだ、ちょっと意外かも。" },
        { name: playername, message: "まあね、今はここが落ち着くんだ。" },
        { name: character, message: "忙しそうだけど、無理してない？" },
        { name: playername, message: "今日はまあまあ。手は動かしてるよ。" },
        { name: character, message: "じゃあ邪魔しないように、手短に話すね。" },
        { name: playername, message: "助かる。今ちょうど区切りだったし。" },
        { name: character, message: "仕事終わったら、少し休めるといいね。" },
        { name: playername, message: "うん、閉店作業までが勝負かな。" },
        { name: character, message: "また今度、ゆっくり話そう。" },
        { name: playername, message: "ああ、またな。" },
      ],
    };
  }
}

// ---------- 盆踊り（選択肢なし・甘々会話：台詞配列） ----------
async function generateFestivalDialogue(
  characters,
  place,
  likabilities,
  playername,
  condition,
  playerTagBlock
) {
  const profiles = profileBlock(playername);
  const joinedProfiles = characters
    .map((ch) => `【${ch}】\n${profiles[ch]}`)
    .join("\n");
  const likeTable = Object.entries(likabilities || {})
    .map(([ch, v]) => `${ch}: ${v}`)
    .join(", ");

  const condLine = condition
    ? `- ${playername}は現在「${condition}」。体調／不調の様子に軽く触れつつ、からかいすぎたり重くしすぎない。`
    : "- 特筆する不調はなし。";

  const prompt = `
あなたは恋愛イベントの脚本家です。出力は必ず指定のJSONのみ。

【登場キャラ】${characters.join("・")}（プレイヤー: ${playername}）
【好感度】${likeTable || "不明"}
【場所】${place.name}（詳細: ${place.detail}）
${condLine}

【性格・話し方】
${joinedProfiles}

【要件】
- 盆踊り当夜の「甘めの会話」。
- キャラが複数なら、全員が最低2回は話す。プレイヤー（${playername}）も適度に応じる。
- 三人称の地の文は不可。必ず話し言葉（1行目のみ）。
- プレースホルダー、コードフェンス禁止。余計なキー禁止。
- 登場キャラ以外のキャラは絶対に出現させない。

【出力の形】
[
  { "name": "ミユ", "message": "～" },
  { "name": "${playername}", "message": "～" },
  { "name": "ナナ", "message": "～" }
  *全体で6行以上
]
${playerTagBlock}`.trim();

  try {
    const text = stripJsonFence(await genWithFallback(prompt));
    return JSON.parse(text);
  } catch (e) {
    console.error("❌ Gemini API Error (festival lines):", e);
    const who = characters[0] || "ミユ";
    return [
      { name: who,         message: `${playername}${who === "シオン" ? "さん" : who === "ナナ" ? "くん" : ""}、隣、いい？` },
      { name: playername,  message: "もちろん。…手、繋いでもいい？" },
      { name: who,         message: "…うん。太鼓、近くで一緒に聞こ？" },
    ];
  }
}


// ---------- キャラごとの呼称（呼び捨て／さん／くん） ----------
function formatNameFor(character, playername) {
  if (!playername) return "";
  if (character === "シオン") return `${playername}さん`;
  if (character === "ナナ") return `${playername}くん`;
  return playername; // ミユ=呼び捨て
}

function rejectionBandFromLike(like) {
  // 好感度に応じてトーンを4段階に
  if (like >= 0) return 0;        // 0〜：ふつうの拒絶
  if (like >= -30) return 1;      // -1〜-30：冷たく/嫌いを明言
  if (like >= -60) return 2;      // -31〜-60：強い拒絶＋距離/通報の示唆
  return 3;                       // -61以下：非常に強い拒絶＋通報を明言
}

// ---------- 各キャラの最終返事モノローグ（台詞配列） ----------
async function generateEndingMonologue(
  character,
  entries,
  okName,
  playerTagBlock,
) {
  if (!entries || entries.length === 0) return [];

  const style = CHARACTER_STYLE[character] || "";
  const names = entries.map((e) => e.playername);
  const listForPrompt = names.map((n) => `- ${n}`).join("\n"); // ← 名前のみ
  const isSingle = entries.length === 1;
  const soleName = isSingle ? names[0] : null;
  const okToName = okName ? formatNameFor(character, okName) : null;

  // ---- ケース分岐：お断り（accepted が null） ----
  if (!okName) {
    // 単独告白への丁寧なお断り
    if (isSingle) {
      const toSole = formatNameFor(character, soleName);
      const finalLike = Number(entries[0]?.finalLike ?? 0);
      const band = rejectionBandFromLike(finalLike);
      try {
        const prompt = `
あなたは${character}です。以下の条件で台詞を返してください。
${style}

【状況】
告白してきたのは${toSole}。
今は付き合えないため、お断りします。
相手への最終好感度は ${finalLike} です。拒絶トーンの強さは次のLEVELに従ってください：
LEVEL 0: 丁寧に感謝し、穏やかにお断り。
LEVEL 1: はっきり嫌い/合わないと伝え、突き放す。
LEVEL 2: 非常に強い拒絶。即時に関わりを断つことを厳しく明言。「これ以上は警察に通報します」を明言。
LEVEL 3: さらに強い拒絶。泥を投げるなどの行為も行ってください。
採用するLEVELは ${band} です。

【要件】
- 出力はJSON配列のみ。各要素は {"name":"${character}","message":"…"} 形式。
- ${toSole}に話しかけてください。
- 三人称の地の文やプレースホルダー禁止。

【出力の形】
[
  {"name":"${character}","message":"…"},
  {"name":"${character}","message":"…"},
  *全体で6行以上
]
${playerTagBlock}`.trim();
         const text = stripJsonFence(await genWithFallback(prompt));
        const arr = JSON.parse(text);
        return arr
          .map((l) => ({
            name: character,
            message: String(l.message || "").trim(),
          }))
          .filter((l) => l.message);
      } catch (e) {
        console.error("❌ Gemini API Error (ending reject/single):", e);
        return [
          {
            name: character,
            message: `${toSole}、想いを伝えてくれて本当にありがとう。`,
          },
          {
            name: character,
            message: "でも、今は気持ちに応えられないの。ごめんね。",
          },
          {
            name: character,
            message: "大切に思ってるからこそ、曖昧にはできないんだ。",
          },
        ];
      }
    }
    // 複数から来たがお断り
    try {
      const prompt = `
あなたは${character}です。以下の条件で「丁寧なお断り」だけを台詞で返してください。
${style}

【状況】
複数人から告白されたが、今は誰にもOKを出さないと決めている。
【告白してきた相手】
${listForPrompt}
全員への感謝(告白してきた人の名前をちゃんと呼ぶこと)→今は答えられない旨→優しい締め　という流れにすること

【出力の形】
[
  {"name":"${character}","message":"…"},
  {"name":"${character}","message":"…"},
  *全体で6行以上
]
${playerTagBlock}`.trim();
       const text = stripJsonFence(await genWithFallback(prompt));
      const arr = JSON.parse(text);
      return arr
        .map((l) => ({
          name: character,
          message: String(l.message || "").trim(),
        }))
        .filter((l) => l.message);
    } catch (e) {
      console.error("❌ Gemini API Error (ending reject/multi):", e);
      return [
        { name: character, message: "想いを伝えてくれて…本当にありがとう。" },
        {
          name: character,
          message: "ごめんね、今は誰にも『はい』って言えないの。",
        },
        {
          name: character,
          message: "大切に受け取ったから、きっと忘れないよ。",
        },
      ];
    }
  }

  // ---- ケース分岐：OK を伝える（accepted が存在） ----
  const winnerAddress = okToName;

  // 単独告白 → 誰かと「比べる・選ぶ」表現は禁止
  if (isSingle) {
    const toSole = formatNameFor(character, soleName);
    try {
      const prompt = `
あなたは${character}です。以下の条件で「OKの返事」だけを台詞で返してください。
${style}

【状況】
告白してきたのは「${toSole}」
あなたは既に ${winnerAddress} にOKを伝えると決めています。

【要件】
- 感謝→少しの照れ→最後に「${winnerAddress}」の名前を入れてはっきりOK。
- 「誰を選ぶ／迷う／比較する」趣旨の表現は絶対に使わない。
- プレースホルダー、三人称の地の文は禁止。

【出力の形】
[
  {"name":"${character}","message":"…"},
  {"name":"${character}","message":"…"},
  *全体で6行以上
]
${playerTagBlock}`.trim();
       const text = stripJsonFence(await genWithFallback(prompt));
      const arr = JSON.parse(text);
      const out = arr
        .map((l) => ({
          name: character,
          message: String(l.message || "").trim(),
        }))
        .filter((l) => l.message);

      const last = out[out.length - 1]?.message || "";
      if (!last.includes(okName)) {
        out.push({
          name: character,
          message: `${winnerAddress}——私の答えは、OKだよ。これから、よろしくね。`,
        });
      }
      return out;
    } catch (e) {
      console.error("❌ Gemini API Error (ending ok/single):", e);
      return [
        { name: character, message: `${winnerAddress}、告白…嬉しかった。` },
        { name: character, message: "私もね、ずっと君のことを考えてたの。" },
        {
          name: character,
          message: `${winnerAddress}、私の答えはOK。これから、よろしくね。`,
        },
      ];
    }
  }

  // 複数からの告白 → 少し迷いOK。ただしOK相手は固定で明示。
  const prompt = `
あなたは${character}です。以下の条件で、セリフだけの短い台本（JSON配列）を作成してください。
${style}

【告白してきた相手（名前のみ）】
${listForPrompt}

【必ずOKを出す相手（確定済み・変更不可）】
- ${okName}（呼び方は「${winnerAddress}」）

【要件】
- 最初は全員への感謝(全員の名前をちゃんと呼ぶ))中盤で“少しだけ”迷いをにじませる→最後は「${winnerAddress}」を名指しでOK。
- プレイヤー側の台詞は入れない。三人称の地の文とプレースホルダーは禁止。

【出力の形】
[
  {"name":"${character}","message":"…"},
  {"name":"${character}","message":"…"},
  *全体で6行以上
]
${playerTagBlock}`.trim();

  try {
    const text = stripJsonFence(await genWithFallback(prompt));
    const arr = JSON.parse(text);
    const out = arr
      .map((l) => ({
        name: character,
        message: String(l.message || "").trim(),
      }))
      .filter((l) => l.message);
    const last = out[out.length - 1]?.message || "";
    if (!last.includes(okName)) {
      out.push({
        name: character,
        message: `${winnerAddress}——私の答えは、OKだよ。これから、よろしくね。`,
      });
    }
    return out;
  } catch (e) {
    console.error("❌ Gemini API Error (ending ok/multi):", e);
    return [
      {
        name: character,
        message: "みんな、想いを伝えてくれて…本当にありがとう。",
      },
      { name: character, message: "たくさん考えたけど、やっと決められた。" },
      {
        name: character,
        message: `${winnerAddress}——私の気持ちは、あなたに向いてる。よろしくね。`,
      },
    ];
  }
}

// ---------- エンディング（最終日）全体台本 ----------
async function generateEndingDialogue(groups, accepted, playerTagBlocks = {}) {
  // groups: { ミユ:[{playername,steps,bonus,baseLike,finalLike}], シオン:[...], ナナ:[...] }
  const order = ["ミユ", "シオン", "ナナ"]; // ミユ→シオン→ナナの順に返事
  const allLines = [];

  for (const ch of order) {
    const entries = Array.isArray(groups?.[ch]) ? groups[ch] : [];
    if (!entries.length) continue; // ← 追加：ゼロはスキップ
    const okName = accepted?.[ch] ?? null;
    const playername = entries[0]?.playername || "プレイヤー";
    const playerTagBlock = normalizeTagBlock(playerTagBlocks?.[playername]);
    const lines = await generateEndingMonologue(
      ch,
      entries,
      okName,
      playerTagBlock,
    );
    allLines.push(...lines);
  }
  return allLines;
}

// ---------- 逆告白（割り込み） ----------
async function generateReverseMonologue(character, playername) {
  const style = CHARACTER_STYLE[character] || "";
  const toName = formatNameFor(character, playername);

  const prompt = `
あなたは${character}です。以下の条件で短い逆告白のセリフ台本（JSON配列）を出力してください。
${style}

【状況】
エンディング後、${toName}に向けて呼び止め、あなたのほうから逆告白をする。

【出力要件】
- 1行目は必ず「まって！！」で始めてください。
- 最後の台詞では、${toName}に「好き」「付き合って」等を明言し、必ず名前（${toName}）を含めてください。
- プレースホルダー（〇〇など）と三人称ナレーションは禁止です。

【出力の形】
[
  {"name":"${character}","message":"まって！！"},
  {"name":"${character}","message":"…"},
  {"name":"${character}","message":"…"},
  *全体で6行以上
]
`.trim();

  try {
    const text = stripJsonFence(await genWithFallback(prompt));
    let arr = JSON.parse(text);

    // 空メッセージ除去
    arr = (Array.isArray(arr) ? arr : []).filter(
      (l) => l && typeof l.message === "string" && l.message.trim(),
    );

    // 不正 or 全部空ならフォールバック
    if (!arr.length) throw new Error("Empty reverse confession lines");

    // name 正規化 & 文面トリム
    return arr.map((l) => ({
      name: character,
      message: String(l.message).trim(),
    }));
  } catch (e) {
    console.error("❌ Gemini API Error (reverse confession):", e);
    return [
      { name: character, message: "まって！！" },
      {
        name: character,
        message: `${toName}…私から言わせて。ずっと、あなたが好き。`,
      },
      { name: character, message: "よかったら…わたしと、付き合ってください。" },
    ];
  }
}

export function registerLifeSocketHandlers(socket) {
  // 休みイベントの生成
  socket.on("requestRestEvent", async (payload) => {
    try {
      const lines = await generateRestDialogue(payload);
      socket.emit("restGenerated", lines);
    } catch (err) {
      console.error("[requestRestEvent] generation failed:", err);
      socket.emit("restGenerated", fallbackRestDialogue(payload || {}));
    }
  });

  // 通常イベント
  socket.on("requestEvent", async (data) => {
    console.log("📩 Event requested:", data);
    const { characterName, place, likability, playername, playerTagBlock } = data;

    const { requestId } = data; // ★ 追加

    const eventData = await generateGameEvent(
      characterName,
      place,
      likability,
      playername,
      normalizeTagBlock(playerTagBlock),
    );
    socket.emit("eventGenerated", { requestId, data: eventData }); // ★ 追加：IDごと返す
  });

  // バイトイベント
  socket.on("requestShiftEvent", async (data) => {
    const {
      requestId,
      playername,
      job,
      encounter,
      characterName,
      likability = 0,
      fishingDayCount = null,
      newlyAcquiredTagDetail = null,
      playerTagBlock,
    } = data || {};

    if (!encounter || !characterName) {
      return;
    }

    try {
      const event = await generateShiftEncounterEvent({
        playername,
        character: characterName,
        job,
        place: job?.place,
        likability,
        fishingDayCount,
        playerTagBlock: normalizeTagBlock(playerTagBlock),
        newlyAcquiredTagDetail,
      });
      const normalizedEvent = {
        ...event,
        likabilityChange: clampLikabilityChange(event?.likabilityChange),
      };
      socket.emit("shiftEventGenerated", {
        requestId,
        data: {
          kind: "encounter",
          event: normalizedEvent,
          newlyAcquiredTagDetail,
        },
      });
    } catch (error) {
      console.error("❌ Gemini API Error (shift event):", error);
      socket.emit("shiftEventGenerated", {
        requestId,
        data: {
          kind: "encounter",
          event: {
            likabilityChange: 0,
            lines: [
              { name: characterName, message: "今ちょっと手が離せなくて、また後で。" },
              { name: playername || "俺", message: "ああ、了解。" },
            ],
          },
          newlyAcquiredTagDetail,
        },
      });
    }
  });

  // 盆踊りイベント（台詞配列）
  socket.on("requestFestivalEvent", async (data) => {
    const {
      characters,
      place,
      likabilities,
      playername,
      condition = null,
      playerTagBlock,
    } = data;
    const lines = await generateFestivalDialogue(
      characters,
      place,
      likabilities,
      playername,
      condition,
      normalizeTagBlock(playerTagBlock),
    );
    socket.emit("festivalGenerated", lines);
  });

  // 最終日エンディング（告白返事）
  socket.on("requestEndingEvent", async (payload) => {
    try {
      // payload: { groups, accepted }  ← クライアント確定済み
      const { groups = {}, accepted = {}, playerTagBlocks = {} } = payload || {};
      const lines = await generateEndingDialogue(groups, accepted, playerTagBlocks);
      socket.emit("endingGenerated", lines); // クライアントの event handler へ
    } catch (e) {
      console.error("❌ Ending generation error:", e);
      // 失敗時は簡易フォールバック
      const lines = [
        {
          name: "ミユ",
          message:
            "ごめん、今はうまく言葉にできないや…でも、気持ちはちゃんと受け取ったから！",
        },
        {
          name: "シオン",
          message: "……混み合っているようです。少しだけ、待っていただけますか。",
        },
        {
          name: "ナナ",
          message:
            "ふふ、最後の最後で焦らしちゃったね。またすぐに、返事を届けるよ。",
        },
      ];
      socket.emit("endingGenerated", lines);
    }
  });

  // 逆告白
  socket.on("requestReverseConfession", async (data) => {
    try {
      console.log("🔁 Reverse confession requested:", data);
      const lines = await generateReverseMonologue(
        data.character,
        data.playername,
      );
      console.log("🔁 Reverse lines:", lines);
      //socket.emit("reverseGenerated", lines);
      socket.emit("reverseConfessionGenerated", { lines });
    } catch (e) {
      console.error("❌ Reverse confession error:", e);
      socket.emit("reverseConfessionGenerated", { lines: [] });
    }
  });
}
