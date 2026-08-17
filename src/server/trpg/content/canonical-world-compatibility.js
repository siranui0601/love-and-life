function text(value) {
  return value == null ? "" : String(value).trim();
}

function table(snapshot, name) {
  const rows = snapshot?.tabs?.[name];
  if (!Array.isArray(rows)) throw new Error(`missing canonical snapshot tab: ${name}`);
  return rows;
}

function headerIndex(rows, key) {
  const index = rows.findIndex((row) => text(row?.[0]) === key);
  if (index < 0) throw new Error(`missing header ${key}`);
  return index;
}

function recordRow(headers, record) {
  return headers.map((header) => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : null);
}

function upsert(rows, headerKey, idKey, record) {
  const h = headerIndex(rows, headerKey);
  const headers = rows[h];
  const idColumn = headers.findIndex((value) => text(value) === idKey);
  if (idColumn < 0) throw new Error(`missing id column ${idKey}`);
  const id = text(record[idKey]);
  const next = recordRow(headers, record);
  const found = rows.findIndex((row, index) => index > h && text(row?.[idColumn]) === id);
  if (found >= 0) rows[found] = next;
  else rows.push(next);
}

const WORLD_FACILITY = Object.freeze({
  施設ID: "LOC_FARM_REPAIR", 施設名: "農具修理屋「鋤刃」", 種別: "修理屋/農具店",
  機能: "農具・簡易武器の販売、研ぎ、軽修理", "常駐/関連NPC": "オルグ",
  "商品・価格特色": "農村向け低価格。戦闘専用品より農具・護身具中心",
  "関連T/イベント変化": "T02/T03で修理依頼増、T13水不足で農具需要減",
  備考: "戦闘正本の仮売場を正式施設化。全ルート利用可",
});

const WORLD_NPC = Object.freeze({
  "NPC ID": "NPC111", 名前: "オルグ", 重要度: "B", 行動タイプ: "生活リズム型", 種族: "人間", 年齢: 56, 外見年齢: 56,
  "性別/性質": "男性", 居住拠点: "田園の村", 初期現在地: "田園の村", 許可出現範囲: "田園の村内/修理屋/広場/畑",
  "職業/立場": "農具修理職人", 関連T: "T02,T03,T13", MBTI: "ISTP",
  主GOAP: "農具と護身具を修理し、村の生産と安全を維持して生活費を得る",
  通常生活リズム: "朝:修理屋開店/昼:畑・広場へ納品/夕:修理屋/夜:自宅。火災・狼被害時は緊急修理を優先",
  "知識/関心タグ": "農具,簡易武器,修理,T02_穀倉,T03_狼,T13_水不足",
  "誤解/秘密": "王都製品は過剰品質と思う/古い農具を護身具へ転用する知恵がある",
  非介入時の運命: "非介入でも営業。T03失敗で修理需要急増、T13失敗で農具注文減少", 状態: "通常",
  会話口調: "短く実務的。道具の傷み方から使い方を言い当てる", 主施設ID: "LOC_FARM_REPAIR", "関連施設ID/出現条件": "LOC_FARM_SQUARE,LOC_FARM_FIELD",
});

/**
 * Transitional world-only compatibility for rows already authored in the
 * canonical world Sheet but not yet present in the checked-in world snapshot.
 * Battle content is deliberately not accepted by this module.
 */
export function applyCanonicalWorldCompatibility(worldSnapshot) {
  upsert(table(worldSnapshot, "田園の村"), "施設ID", "施設ID", WORLD_FACILITY);
  upsert(table(worldSnapshot, "NPC一覧"), "NPC ID", "NPC ID", WORLD_NPC);
  return { facilitiesPatched: 1, npcsPatched: 1 };
}

export const CANONICAL_WORLD_COMPATIBILITY_VERSION = "world-only-v1-2026-08-18";
