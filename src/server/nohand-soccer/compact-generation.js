import { genWithFallback, stripJsonFence } from "../../foundation/gemini.js";
import { hashCodeJson, readNoHandCodeSlots, saveNoHandCodeSlots } from "./sheet-log.js";

const SLOT_DEFS = [
  {
    slot: "core",
    label: "core",
    role: "主効果。1番目の絵文字らしさを、ボールの物理挙動と見た目で派手に表す。単なる加速や角度補正だけは禁止。",
    fields: ["onCatch", "update"],
  },
  {
    slot: "motion",
    label: "motion",
    role: "装置本体の周期的な動き。2番目の絵文字らしさを、ランダムではなく再現性のある運動で表す。",
    fields: ["update"],
  },
  {
    slot: "trigger",
    label: "catch",
    role: "本体接触以外の追加の拾い方。3番目の絵文字らしい、見える捕獲範囲だけを作る。本体接触は無効化しない。",
    fields: ["zones"],
  },
];

const SLOT_BY_NAME = Object.fromEntries(SLOT_DEFS.map((slot) => [slot.slot, slot]));

function targetSlots(emojis) {
  return [
    { slot: "core", emoji: emojis[0] },
    { slot: "motion", emoji: emojis[1] },
    { slot: "trigger", emoji: emojis[2] },
  ];
}

function extractFirstJsonObject(input) {
  const s = stripJsonFence(String(input || ""));
  const start = s.indexOf("{");
  if (start < 0) throw new SyntaxError("JSON object not found");
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  throw new SyntaxError("JSON object was not closed");
}

function codeBlockShape(targets) {
  return Object.fromEntries(targets.map((target) => {
    const fields = Object.fromEntries(SLOT_BY_NAME[target.slot].fields.map((field) => [field, ""]));
    return [target.slot, fields];
  }));
}

function buildApiPrompt() {
  return `使用可能スコープ:
ctx = {
  comboKey, timeMs, dtMs, seed, rng,
  field: { w, h, gravity, wallBounce, fallLine, goals, ballRadius },
  baseDevice: { x, y, radius, angle },
  device: { x, y, vx, vy, radius, angle, scaleX, scaleY },
  ball,
  balls,
  state
}

api = { math, rng, vec, body, path, zone, hit, effect, field }

apiは完成済み能力リストではない。物理操作・幾何・描画の低レイヤー工作道具である。
既存効果名を選ぶのではなく、絵文字から連想される装置挙動をJSで組み立てること。

slot別の権限:
- core.onCatch / core.update: ボール操作、分身、スピン、重力、位置変更、effect、ctx.stateの使用が可能。
- motion.update: 装置の現在位置/角度/拡大率/半径をreturnするだけ。body/effect/ctx.stateで副作用を作らない。
- trigger.zones: 追加捕獲zone配列をreturnするだけ。body/effect/ctx.stateで副作用を作らない。

api.math:
- clamp(v,min,max)
- lerp(a,b,t)
- easeInOut(t)
- sin(timeMs,periodMs,amplitude,phase=0)
- cos(timeMs,periodMs,amplitude,phase=0)

api.rng:
- unit(key): 0以上1未満。comboKeyとkeyで固定
- range(key,min,max)
- int(key,min,max)

api.vec:
- fromAngle(deg,length=1)
- toward(a,b,length=1)
- rotate(v,deg)
- length(v)
- normalize(v,length=1)

api.body: core専用。第1引数は必ずball。
- applyForce(ball,x,y)
- applyForceVec(ball,vec,amount)
- applyImpulse(ball,x,y)
- applyImpulseVec(ball,vec,amount)
- setVelocity(ball,x,y)
- setVelocityVec(ball,vec,speed)
- addVelocity(ball,x,y)
- addVelocityVec(ball,vec,speed)
- launchToward(ball,point,speed)
- setPosition(ball,x,y)
- pullTo(ball,point,strength=0.12)
- addSpin(ball,amount,ms=900)
- setGravity(ball,x,y,ms=900)
- setGravityVec(ball,vec,ms=900)
- resetGravity(ball)
- clone(ball,options): options={x,y,vx,vy,r,temporaryMs,main}
- remove(ball)
- markTemporary(ball,ms)
- stop(ball)

api.path:
- circlePoint(center,radius,angleDeg)
- spiralPoint(center,radiusStart,radiusEnd,angleDeg,t)
- bezierPoint(p0,p1,p2,p3,t)
- orbit(ball,{center,radius,angleDeg,strength})
- follow(ball,point,strength)

api.zone: trigger専用。trigger.zonesでは追加範囲だけ返す。装置本体zoneは実行側が自動で足す。
- circle({x,y,r,label,visible})
- ring({x,y,r,thickness,label,visible})
- fan({x,y,r,angleDeg,spreadDeg,label,visible})
- line({x1,y1,x2,y2,width,label,visible})
- rect({x,y,w,h,label,visible})
- capsule({x1,y1,x2,y2,r,label,visible})

api.effect: core専用。onCatch/update中だけ実行され、編集中は無効。
- ring({x,y,r,color,ms})
- arc({x,y,r,startDeg,endDeg,color,ms})
- line({x1,y1,x2,y2,color,ms})
- particles({x,y,emoji,count,speed,ms})
- emoji({x,y,emoji,size,ms})
- trail({ball,color,ms})
- flash({x,y,r,color,ms})
- text({x,y,text,color,ms})
- ghostBall({x,y,r,ms})

api.field:
- goalCenter()
- fallLine()
- clampToCourt(point,padding=30)
- isNearDeathLine(ball,margin=120)

motion.updateの必須:
- 必ず { x, y, angle, scaleX, scaleY, radius } の一部または全部をreturnする。
- x/yはctx.baseDeviceを中心にした周期運動にする。
- ランダムは禁止。api.rngかctx.seedで固定されたphaseのみ使う。

trigger.zonesの必須:
- 必ずreturnで配列を返す。
- 例: return [api.zone.circle({x:ctx.device.x+90,y:ctx.device.y,r:70,label:'拾',visible:true})];
- 本体と重なるだけは禁止。本体より80px以上離す、扇形を広げる、ラインを伸ばすなど、拾い方が見える形にする。
- zoneは1〜3個にする。大量生成は禁止。

coreの必須:
- onCatchは触れた瞬間の開始処理。updateは捕獲後/継続処理。
- ctx.stateを使って多段処理を作ってよい。
- 「速度を少し変えるだけ」は禁止。
- 最低でも、捕獲/周回/分裂/ワープ的移動/強射出/スピン/重力変化/見える粒子演出のうち2つ以上を組み合わせる。
- 分身を出す場合はtemporaryMsを設定する。
- effectは毎フレーム大量追加せず、ctx.stateで一度だけ出す。`;
}

function buildPrompt({ comboKey, targets }) {
  const roles = targets.map((target, index) => {
    const def = SLOT_BY_NAME[target.slot];
    return `${index + 1}つ目: ${def.label}。${def.role} 対象絵文字: ${target.emoji}`;
  }).join("\n");

  const outputShape = {
    version: 1,
    apiVersion: "combo-code-v1",
    code: codeBlockShape(targets),
  };

  return `JSONのみ返してください。説明文は禁止。

${targets.length}絵文字合成装置のJSスニペットを生成してください。

生成対象:
${roles}

鉄則:
- ここに記載されていないslotは出力しない。
- 出力JSONのcodeには、生成対象slotだけを含める。
- draw、summary、name、flavor、description、説明文は禁止。
- 本体接触は必ず発火する。
- triggerは追加捕獲のみ。本体接触を無効化しない。
- triggerの追加捕獲範囲は必ず可視化できる形にする。
- Math.randomは禁止。ctx.rngまたはapi.rngのみ使う。
- Date、window、document、fetch、eval、Function、importは禁止。
- whileは禁止。
- コート、重力、壁、ゴール、落下ラインはctx.fieldに従う。
- 少し角度を変えるだけは禁止。
- coreは派手な大変化を含める。
- 選択肢から能力名を選ぶのではなく、工作道具APIで自由に組み立てる。

${buildApiPrompt()}

comboKeyは実行時にctx.comboKeyで渡される。
今回の生成管理用comboKey: ${comboKey}

出力形式:
${JSON.stringify(outputShape, null, 2)}`;
}

function normalizeSnippet(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function repairTriggerZonesSnippet(code) {
  if (!code || /\breturn\b/.test(code)) return code;
  const calls = code
    .split(";")
    .map((part) => part.trim())
    .filter((part) => /^api\.zone\./.test(part));
  if (!calls.length) return code;
  return `return [${calls.join(",")}];`;
}

function normalizeGeneratedCode(raw, targets) {
  const codeRoot = raw?.code && typeof raw.code === "object" ? raw.code : raw;
  const out = [];
  for (const target of targets) {
    const def = SLOT_BY_NAME[target.slot];
    const rawSlot = codeRoot?.[target.slot];
    if (!rawSlot || typeof rawSlot !== "object") throw new Error(`Missing generated slot: ${target.slot}`);
    const code = {};
    for (const field of def.fields) {
      let snippet = normalizeSnippet(rawSlot[field]);
      if (target.slot === "trigger" && field === "zones") snippet = repairTriggerZonesSnippet(snippet);
      code[field] = snippet;
    }
    if (!Object.values(code).some(Boolean)) throw new Error(`Generated slot has no code: ${target.slot}`);
    out.push({ slot: target.slot, emoji: target.emoji, code });
  }
  return out;
}

function composeDevice({ emojis, existing, generatedEntries = [] }) {
  const all = { ...existing };
  for (const entry of generatedEntries) {
    all[entry.slot] = {
      slot: entry.slot,
      emoji: entry.emoji,
      code: entry.code,
      codeHash: hashCodeJson(entry.code),
      source: "gemini-code-toolbox",
    };
  }

  const code = {};
  const slots = {};
  for (const target of targetSlots(emojis)) {
    const entry = all[target.slot];
    if (!entry?.code) throw new Error(`Missing required slot after generation: ${target.slot}:${target.emoji}`);
    code[target.slot] = entry.code;
    slots[target.slot] = {
      emoji: target.emoji,
      codeHash: entry.codeHash || hashCodeJson(entry.code),
      source: entry.source || "",
    };
  }

  return {
    version: 1,
    apiVersion: "combo-code-v1",
    comboKey: emojis.join("|"),
    name: emojis.join(""),
    visualLabel: emojis.join(""),
    shortEffect: "主効果 / 動き / 拾い方",
    slots,
    code,
    generatedSlots: generatedEntries.map((entry) => entry.slot),
    reusedSlots: Object.keys(existing).filter((slot) => !generatedEntries.some((entry) => entry.slot === slot)),
    conceptKey: hashCodeJson({ emojis, code }),
  };
}

export function mountCompactNoHandSoccerRoutes(app) {
  app.post("/api/nohand-soccer/gimmick", async (req, res) => {
    const emojis = Array.isArray(req.body?.emojis) ? req.body.emojis.slice(0, 3).map(String) : [];
    if (emojis.length !== 3 || emojis.some((emoji) => !emoji.trim())) {
      return res.status(400).json({ error: "emojis must contain exactly 3 items." });
    }

    const comboKey = emojis.join("|");
    const targets = targetSlots(emojis);
    try {
      const existing = await readNoHandCodeSlots(targets);
      const missing = targets.filter((target) => !existing[target.slot]?.code);

      if (missing.length === 0) {
        return res.json(composeDevice({ emojis, existing }));
      }

      const output = await genWithFallback(buildPrompt({ comboKey, targets: missing }), {
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.98,
        },
      });
      const raw = JSON.parse(extractFirstJsonObject(output));
      const generatedEntries = normalizeGeneratedCode(raw, missing);

      await saveNoHandCodeSlots({
        entries: generatedEntries,
        comboKey,
        source: "gemini-code-toolbox",
      });

      return res.json(composeDevice({ emojis, existing, generatedEntries }));
    } catch (error) {
      console.warn("[noHand-soccer] code toolbox generation failed", error);
      return res.status(500).json({
        error: "nohand code generation failed",
        message: String(error?.message || error),
      });
    }
  });
}
