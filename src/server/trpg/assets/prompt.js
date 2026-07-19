import crypto from "node:crypto";

export const TRPG_ASSET_PROMPT_VERSION = "trpg-visual-style-v2";

function clean(value, maximum = 120) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, maximum);
}

function hashBytes(value) {
  return crypto.createHash("sha256").update(String(value)).digest();
}

function pick(items, bytes, index) {
  return items[bytes[index % bytes.length] % items.length];
}

function publicVisualRole(npc) {
  // Occupation is an internal resolver field and can be the mystery's answer.
  // Image generation receives only a neutral, public identity.
  return `${clean(npc.home, 40) || clean(npc.initialLocation, 40) || "その土地"}の住人`;
}

export function deterministicVisualProfile(npc, previous = null) {
  if (previous?.hair && previous?.eyes && previous?.build && previous?.palette) return previous;
  const bytes = hashBytes(`${TRPG_ASSET_PROMPT_VERSION}:${npc.id}:${npc.name}`);
  const occupation = publicVisualRole(npc);
  const clothing = /農|畑|牧/u.test(occupation) ? "実用的な農村服と革靴"
    : /騎士|兵|衛兵/u.test(occupation) ? "使い込まれた軽装鎧と地域色の外套"
      : /魔|術|司祭|神官/u.test(occupation) ? "機能的な法衣と小さな術具"
        : /商|店|宿|女将/u.test(occupation) ? "丈夫で清潔な町人服と商売道具"
          : "旅に耐える中世ファンタジーの実用服";
  return {
    hair: pick(["黒髪", "焦げ茶の髪", "栗色の髪", "灰褐色の髪", "淡い金髪", "赤褐色の髪"], bytes, 0),
    eyes: pick(["琥珀色の瞳", "灰色の瞳", "濃茶の瞳", "青灰色の瞳", "緑褐色の瞳"], bytes, 1),
    build: pick(["細身", "標準的な体格", "小柄", "しなやかな体格", "骨太"], bytes, 2),
    palette: pick(["麦色と焦げ茶", "藍色と灰色", "えんじと革色", "苔色と茶色", "生成りと濃紺"], bytes, 3),
    identifyingFeature: pick(["目元に意志の強さがある", "使い込んだ革の小物を持つ", "髪留めが特徴的", "片側の袖を実用的に留めている", "小さな護符を身につける"], bytes, 4),
    clothing,
  };
}

export function selectPortraitKeyColor(visualProfile) {
  const text = `${visualProfile?.hair ?? ""} ${visualProfile?.palette ?? ""} ${visualProfile?.clothing ?? ""}`;
  if (/緑|苔|若草|翠|ピンク|桃|紅/u.test(text)) return "pink";
  return "green";
}

export function buildPortraitPrompt(npc, { visualProfile = null, keyColor = null } = {}) {
  const profile = deterministicVisualProfile(npc, visualProfile);
  const selectedKey = keyColor === "pink" || keyColor === "green" ? keyColor : selectPortraitKeyColor(profile);
  const keyHex = selectedKey === "pink" ? "#FF00FF" : "#00FF00";
  const forbiddenColors = selectedKey === "pink" ? "ピンク、マゼンタ、桃色" : "緑、黄緑、蛍光グリーン";
  const age = Number.isFinite(Number(npc.age)) ? `${Number(npc.age)}歳` : "年齢相応";
  return {
    keyColor: selectedKey,
    visualProfile: profile,
    prompt: [
      "日本のダークファンタジーTRPG用のキャラクター全身立ち絵。写実寄りの重厚な手描き・絵画調。既存の参考画像と同じ世界観、塗り、光、顔の密度を厳守。",
      `人物:${clean(npc.name, 40)}。種族:${clean(npc.species, 30) || "人間"}。年齢:${age}。性別:${clean(npc.gender, 20) || "設定に従う"}。役割:${publicVisualRole(npc)}。`,
      `外見固定:${profile.build}、${profile.hair}、${profile.eyes}、${profile.clothing}、基調色は${profile.palette}、${profile.identifyingFeature}。`,
      "正面からやや斜め、自然な待機姿勢、頭頂から足先まで完全に入れる。縦長2:3。輪郭の外側に8〜12%の余白。武器や小物は役割に必要な物だけ。",
      `背景は完全で均一な${keyHex}単色。背景に影、床、模様、グラデーション、光輪、文字、UI、風景を絶対に描かない。人物本体には${forbiddenColors}を使用しない。`,
      "性的誇張なし。秘密、未来の運命、事件の真相は描かない。画像は人物一人だけ。",
    ].join("\n"),
  };
}

export function buildBackgroundPrompt(facility) {
  return {
    prompt: [
      "日本のダークファンタジーTRPG用の横長背景。写実寄りの重厚な手描き・絵画調。既存の参考画像と同じ世界観、色調、建築密度、自然光を厳守。",
      `地域:${clean(facility.hub, 40)}。場所:${clean(facility.name, 60)}。施設種別:${clean(facility.type, 40)}。`,
      "16:9、人物なし、怪物なし、文字なし、UIなし。ゲーム画面の台詞・選択肢を重ねられるよう下部は暗めで情報量を抑える。入口と移動方向が読み取りやすい構図。",
      "事件の真相、秘密、将来の被害、未発生イベントを描かない。平常時の公開された景観だけを描く。",
    ].join("\n"),
  };
}

/**
 * Builds a public, spoiler-free combat cutout prompt. Monster stats, drop
 * tables, hidden appearance conditions and AI rules are deliberately omitted:
 * the image only needs the identity that the player has already encountered.
 */
export function buildMonsterPrompt(monster, { keyColor = null } = {}) {
  const publicDescription = clean(monster?.raw?.["説明"] ?? monster?.description, 180);
  const visibleText = `${monster?.name ?? ""} ${publicDescription}`;
  const selectedKey = keyColor === "pink" || keyColor === "green"
    ? keyColor
    : /緑|翠|苔|植物|スライム/iu.test(visibleText) ? "pink" : "green";
  const keyHex = selectedKey === "pink" ? "#FF00FF" : "#00FF00";
  const forbiddenColors = selectedKey === "pink"
    ? "pink, magenta, fuchsia"
    : "green, lime, neon green";
  return {
    keyColor: selectedKey,
    prompt: [
      "Japanese dark-fantasy TRPG monster battle cutout, painterly hand-painted game art, matching one coherent medieval-fantasy visual style.",
      `Monster: ${clean(monster?.name, 60) || "unknown creature"}. Classification: ${clean(monster?.classification, 30) || "monster"}. Public role: ${clean(monster?.role, 30) || "creature"}. Region: ${clean(monster?.region, 50)}. Habitat: ${clean(monster?.zone, 50)}.`,
      publicDescription ? `Visible bestiary description: ${publicDescription}.` : "Design a readable silhouette appropriate to its public name and habitat.",
      "Show exactly one complete creature (or one tightly composed swarm when the public name explicitly says it is a group), full body, front three-quarter view, grounded combat stance, readable at smartphone size, vertical 2:3 framing, 8-12% clear margin around the silhouette.",
      `The entire background must be one perfectly uniform flat ${keyHex} chroma-key color. No scenery, ground plane, shadows outside the creature, text, labels, border, UI, particles, gradient, or texture in the background. Do not use ${forbiddenColors} anywhere on the creature.`,
      "No humans, no rider, no extra unrelated creatures, no gore, no hidden story event, no future form, and no secret weakness.",
    ].join("\n"),
  };
}
