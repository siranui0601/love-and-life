// Canonical deltas authored on 2026-08-16 while the checked-in spreadsheet
// snapshots still lag behind the live masters.  This is intentionally small:
// it bridges only rows that are already present in the live canonical Sheets.
// Once snapshots are refreshed, every upsert becomes a no-op.

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

function patchById(rows, headerKey, idKey, id, patch) {
  const h = headerIndex(rows, headerKey);
  const headers = rows[h];
  const idColumn = headers.findIndex((value) => text(value) === idKey);
  const row = rows.find((candidate, index) => index > h && text(candidate?.[idColumn]) === id);
  if (!row) return false;
  for (const [key, value] of Object.entries(patch)) {
    const column = headers.findIndex((header) => text(header) === key);
    if (column >= 0) row[column] = value;
  }
  return true;
}

const EQUIPMENT = Object.freeze([
  {
    装備ID: "EQP-W-0301", 装備名: "港警の舷側斧", 装備枠: "mainHand", 武器種: "axe", 持ち方: "oneHand", 防具分類: "none",
    Tier: 2, 推奨Lv下限: 7, 推奨Lv上限: 14, 地域系統: "交易", 物理威力: 36, 魔導威力: 0, 防御: 2, 魔法耐性: 0,
    素早さ補正: 0, 幸運補正: 0, 命中補正: 2, 回避補正: 0, 会心補正: 3, デバフ成功補正: 0, デバフ耐性補正: 0,
    最大HP補正: 0, 最大MP補正: 0, 付与スキルID: null, パッシブ効果: "船上・狭所で盾と併用しやすい", 欠点: "両手斧より瞬間火力が低い",
    売却率: 0.6, 性能指数: 44.5, 説明: "港の警備員が舷側や狭い甲板で使う片手斧。盾を捨てずに中盤火力へ更新できる交易都市の標準警備装備。", 状態: "active",
  },
  {
    装備ID: "EQP-W-0302", 装備名: "ドワーフ鍛の護衛斧", 装備枠: "mainHand", 武器種: "axe", 持ち方: "oneHand", 防具分類: "none",
    Tier: 3, 推奨Lv下限: 12, 推奨Lv上限: 20, 地域系統: "ドワーフ", 物理威力: 50, 魔導威力: 0, 防御: 4, 魔法耐性: 1,
    素早さ補正: -1, 幸運補正: 0, 命中補正: 2, 回避補正: 0, 会心補正: 5, デバフ成功補正: 0, デバフ耐性補正: 2,
    最大HP補正: 8, 最大MP補正: 0, 付与スキルID: null, パッシブ効果: "construct/armoredタグの敵へ物理威力+3", 欠点: "軽装斧より重い",
    売却率: 0.6, 性能指数: 63.5, 説明: "坑道護衛と救助隊向けの片手斧。硬い対象への打撃と盾併用を両立するドワーフの量産上級品。", 状態: "active",
  },
  {
    装備ID: "EQP-W-0303", 装備名: "黒嶺湾角斧", 装備枠: "mainHand", 武器種: "axe", 持ち方: "oneHand", 防具分類: "none",
    Tier: 4, 推奨Lv下限: 18, 推奨Lv上限: 28, 地域系統: "黒嶺", 物理威力: 64, 魔導威力: 0, 防御: 5, 魔法耐性: 3,
    素早さ補正: 0, 幸運補正: 1, 命中補正: 3, 回避補正: 0, 会心補正: 6, デバフ成功補正: 0, デバフ耐性補正: 5,
    最大HP補正: 10, 最大MP補正: 0, 付与スキルID: null, パッシブ効果: "guard中に受けるデバフ耐性+5", 欠点: "王国圏では目立つ意匠",
    売却率: 0.6, 性能指数: 79, 説明: "黒嶺の多種族警護隊が使う湾曲片手斧。高火力と防御寄り補正を持つ終盤向け一般装備。", 状態: "active",
  },
]);

const STOCK = Object.freeze([
  { 在庫ID: "STK-0201", 装備ID: "EQP-W-0301", 装備名: "港警の舷側斧", 拠点: "交易都市", 施設ID: "LOC_TRADE_SHIPYARD", "施設/売り手": "船大工通り", 基準価格G: 75, 在庫: "普通", 初期販売: true, 解禁条件: null, "価格変動/条件": "T06/T15悪化で在庫減", 合法性: "合法", 地域係数: 1 },
  { 在庫ID: "STK-0202", 装備ID: "EQP-W-0302", 装備名: "ドワーフ鍛の護衛斧", 拠点: "ドワーフ洞窟", 施設ID: "LOC_DWARF_FORGE", "施設/売り手": "名工工房", 基準価格G: 148, 在庫: "普通", 初期販売: true, 解禁条件: null, "価格変動/条件": "T09失敗で在庫減", 合法性: "合法", 地域係数: 1 },
  { 在庫ID: "STK-0203", 装備ID: "EQP-W-0303", 装備名: "黒嶺湾角斧", 拠点: "黒嶺連合領", 施設ID: "LOC_BLACKRIDGE_FORGE", "施設/売り手": "黒嶺鍛冶露店", 基準価格G: 230, 在庫: "少", 初期販売: true, 解禁条件: "黒嶺信用>=10", "価格変動/条件": "T16/T19悪化で王国向け流通停止", 合法性: "合法", 地域係数: 1 },
]);

const SKILL_OVERRIDES = Object.freeze({
  "SKL-0050": { revealConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 5 }], eventUnlockConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 12 }, { scope: "progress", path: "combat.physicalKills", op: "gte", value: 5 }] },
  "SKL-0051": { revealConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 8 }], eventUnlockConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 16 }, { scope: "progress", path: "debuffs.stat.successfulApplications", op: "gte", value: 3 }] },
  "SKL-0052": { revealConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 4 }], eventUnlockConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 6 }, { scope: "progress", path: "combat.criticalHits", op: "gte", value: 2 }] },
  "SKL-0054": { revealConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 12 }], eventUnlockConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 24 }, { scope: "progress", path: "debuffs.stat.successfulApplications", op: "gte", value: 5 }] },
  "SKL-0055": { revealConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 4 }], eventUnlockConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 8 }, { scope: "progress", path: "combat.physicalSkillUses", op: "gte", value: 8 }] },
  "SKL-0056": { revealConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 12 }], eventUnlockConditions: [{ scope: "progress", path: "weapon.axe.skillUses", op: "gte", value: 22 }, { scope: "progress", path: "combat.physicalKills", op: "gte", value: 8 }] },
  "SKL-0141": { revealConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 2 }], eventUnlockConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 3 }, { scope: "equipment", path: "activeWeaponTypes", op: "containsAny", value: ["shield"] }, { scope: "progress", path: "combat.physicalSkillUses", op: "gte", value: 6 }] },
  "SKL-0143": { revealConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 6 }], eventUnlockConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 8 }, { scope: "equipment", path: "activeWeaponTypes", op: "containsAny", value: ["shield"] }, { scope: "progress", path: "combat.physicalSkillUses", op: "gte", value: 18 }] },
  "SKL-0146": { revealConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 4 }], eventUnlockConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 6 }, { scope: "equipment", path: "activeWeaponTypes", op: "containsAny", value: ["shield"] }, { scope: "progress", path: "combat.physicalSkillUses", op: "gte", value: 12 }] },
  "SKL-0149": { revealConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 3 }], eventUnlockConditions: [{ scope: "progress", path: "battles.totalCount", op: "gte", value: 5 }, { scope: "equipment", path: "activeWeaponTypes", op: "containsAny", value: ["shield"] }, { scope: "progress", path: "combat.physicalSkillUses", op: "gte", value: 10 }] },
});

function patchSkill(skill) {
  const patch = SKILL_OVERRIDES[skill?.skillId];
  if (!patch) return;
  Object.assign(skill, patch);
  // learnConditions in v4 are the real purchase gate.  Keep the original level
  // and prerequisite-skill clauses, but replace stale progress clauses with the
  // newly canonical unlock clauses.
  const structural = Array.isArray(skill.learnConditions)
    ? skill.learnConditions.filter((condition) => condition?.scope === "player" && ["level", "skills"].includes(condition?.path))
    : [];
  skill.learnConditions = structural.concat(patch.eventUnlockConditions);
}

export function applyCanonicalRuntimeExtensions({ worldSnapshot, battleSnapshot, skills }) {
  const equipmentRows = table(battleSnapshot, "装備性能マスター");
  const stockRows = table(battleSnapshot, "店舗装備在庫");
  for (const record of EQUIPMENT) upsert(equipmentRows, "装備ID", "装備ID", record);
  for (const record of STOCK) upsert(stockRows, "在庫ID", "在庫ID", record);
  for (const id of ["STK-0001", "STK-0002", "STK-0005"]) {
    patchById(stockRows, "在庫ID", "在庫ID", id, { 施設ID: "LOC_FARM_REPAIR", "施設/売り手": "農具修理屋「鋤刃」" });
  }

  upsert(table(worldSnapshot, "田園の村"), "施設ID", "施設ID", {
    施設ID: "LOC_FARM_REPAIR", 施設名: "農具修理屋「鋤刃」", 種別: "修理屋/農具店",
    機能: "農具・簡易武器の販売、研ぎ、軽修理", "常駐/関連NPC": "オルグ",
    "商品・価格特色": "農村向け低価格。戦闘専用品より農具・護身具中心",
    "関連T/イベント変化": "T02/T03で修理依頼増、T13水不足で農具需要減",
    備考: "戦闘正本の仮売場を正式施設化。全ルート利用可",
  });
  upsert(table(worldSnapshot, "NPC一覧"), "NPC ID", "NPC ID", {
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

  for (const skill of skills) patchSkill(skill);
  return { equipmentAdded: EQUIPMENT.length, stockAdded: STOCK.length, skillsPatched: Object.keys(SKILL_OVERRIDES).length };
}

export const CANONICAL_RUNTIME_EXTENSION_VERSION = "virtue-route-v2-2026-08-16";
