// Equipment rows added to the live battle master after the checked-in fixture
// was cut. These are not route-only items: they are ordinary shop stock in the
// canonical world. Remove this bridge after the battle snapshot is refreshed.

function text(value) {
  return value == null ? "" : String(value).trim();
}

function table(snapshot, name) {
  const rows = snapshot?.tabs?.[name];
  if (!Array.isArray(rows)) throw new Error(`missing canonical snapshot tab: ${name}`);
  return rows;
}

function upsert(rows, headerKey, idKey, record) {
  const headerIndex = rows.findIndex((row) => text(row?.[0]) === headerKey);
  if (headerIndex < 0) throw new Error(`missing header ${headerKey}`);
  const headers = rows[headerIndex];
  const idColumn = headers.findIndex((value) => text(value) === idKey);
  const row = headers.map((header) => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : null);
  const index = rows.findIndex((candidate, rowIndex) => rowIndex > headerIndex && text(candidate?.[idColumn]) === text(record[idKey]));
  if (index >= 0) rows[index] = row;
  else rows.push(row);
}

const EQUIPMENT = Object.freeze([
  { 装備ID:"EQP-W-0201", 装備名:"麦刈り鎌", 装備枠:"mainHand", 武器種:"axe", 持ち方:"oneHand", 防具分類:"none", Tier:0, 推奨Lv下限:1, 推奨Lv上限:5, 地域系統:"田園", 物理威力:16, 魔導威力:0, 防御:0, 魔法耐性:0, 素早さ補正:1, 幸運補正:0, 命中補正:4, 回避補正:0, 会心補正:0, デバフ成功補正:0, デバフ耐性補正:0, 最大HP補正:0, 最大MP補正:0, 付与スキルID:null, パッシブ効果:null, 欠点:"両手斧より一撃が軽い", 売却率:0.45, 性能指数:17.2, 説明:"穂を刈るための小鎌。軽くてよく当たるが、獣の骨は断てない。", 状態:"active" },
  { 装備ID:"EQP-A-0201", 装備名:"麦藁の胴当て", 装備枠:"body", 武器種:null, 持ち方:null, 防具分類:"light", Tier:0, 推奨Lv下限:1, 推奨Lv上限:5, 地域系統:"田園", 物理威力:0, 魔導威力:0, 防御:4, 魔法耐性:0, 素早さ補正:2, 幸運補正:0, 命中補正:0, 回避補正:3, 会心補正:0, デバフ成功補正:0, デバフ耐性補正:0, 最大HP補正:0, 最大MP補正:0, 付与スキルID:null, パッシブ効果:null, 欠点:"雨に弱い", 売却率:0.45, 性能指数:6.4, 説明:"編んだ麦藁を革紐で束ねた胴当て。綿入り上着より軽く、守りは薄い。", 状態:"active" },
  { 装備ID:"EQP-S-0201", 装備名:"樽蓋の盾", 装備枠:"offHand", 武器種:null, 持ち方:null, 防具分類:"shield", Tier:0, 推奨Lv下限:1, 推奨Lv上限:6, 地域系統:"王都", 物理威力:0, 魔導威力:0, 防御:8, 魔法耐性:0, 素早さ補正:-1, 幸運補正:0, 命中補正:0, 回避補正:0, 会心補正:0, デバフ成功補正:0, デバフ耐性補正:6, 最大HP補正:0, 最大MP補正:0, 付与スキルID:null, パッシブ効果:null, 欠点:null, 売却率:0.45, 性能指数:9.2, 説明:"酒樽の蓋に持ち手を付けた盾。木蓋の盾より一回り大きい。", 状態:"active" },
  { 装備ID:"EQP-W-0207", 装備名:"網舟の手鉤", 装備枠:"mainHand", 武器種:"axe", 持ち方:"oneHand", 防具分類:"none", Tier:1, 推奨Lv下限:2, 推奨Lv上限:8, 地域系統:"交易", 物理威力:24, 魔導威力:0, 防御:0, 魔法耐性:0, 素早さ補正:1, 幸運補正:0, 命中補正:0, 回避補正:0, 会心補正:6, デバフ成功補正:0, デバフ耐性補正:0, 最大HP補正:0, 最大MP補正:0, 付与スキルID:null, パッシブ効果:null, 欠点:"水に濡れると滑る", 売却率:0.45, 性能指数:25.4, 説明:"網を手繰る鉤。斧として振れる形をしている。薪割り斧より軽い。", 状態:"active" },
  { 装備ID:"EQP-A-0203", 装備名:"荷役の詰め襟", 装備枠:"body", 武器種:null, 持ち方:null, 防具分類:"medium", Tier:1, 推奨Lv下限:2, 推奨Lv上限:9, 地域系統:"交易", 物理威力:0, 魔導威力:0, 防御:10, 魔法耐性:0, 素早さ補正:0, 幸運補正:0, 命中補正:0, 回避補正:0, 会心補正:0, デバフ成功補正:0, デバフ耐性補正:0, 最大HP補正:10, 最大MP補正:0, 付与スキルID:null, パッシブ効果:"荷運びの労働で疲労増加を軽減", 欠点:null, 売却率:0.45, 性能指数:12.4, 説明:"荷役夫が着る厚手の上着。守りは並だが、担いでも肩が痛まない。", 状態:"active" },
]);

const STOCK = Object.freeze([
  { 在庫ID:"STK-0124", 装備ID:"EQP-W-0201", 装備名:"麦刈り鎌", 既存商品ID:null, 拠点:"田園の村", 施設ID:"LOC_FARM_REPAIR", "施設/売り手":"農具修理屋「鋤刃」", 基準価格G:10, 在庫:"普通", 初期販売:true, 解禁条件:null, "価格変動/条件":"T02失敗で14G", 合法性:null, 地域係数:1, 備考:null },
  { 在庫ID:"STK-0127", 装備ID:"EQP-A-0201", 装備名:"麦藁の胴当て", 既存商品ID:null, 拠点:"田園の村", 施設ID:"LOC_FARM_BAKERY", "施設/売り手":"田園の村", 基準価格G:6, 在庫:"多", 初期販売:true, 解禁条件:null, "価格変動/条件":null, 合法性:null, 地域係数:1, 備考:"麦藁の副産物流通" },
  { 在庫ID:"STK-0134", 装備ID:"EQP-S-0201", 装備名:"樽蓋の盾", 既存商品ID:null, 拠点:"王都", 施設ID:"LOC_CAP_LOWER_INN", "施設/売り手":"王都", 基準価格G:13, 在庫:"多", 初期販売:true, 解禁条件:null, "価格変動/条件":null, 合法性:null, 地域係数:1, 備考:null },
  { 在庫ID:"STK-0136", 装備ID:"EQP-W-0207", 装備名:"網舟の手鉤", 既存商品ID:null, 拠点:"交易都市", 施設ID:"LOC_TRADE_FISH_MARKET", "施設/売り手":"交易都市", 基準価格G:29, 在庫:"普通", 初期販売:true, 解禁条件:null, "価格変動/条件":null, 合法性:null, 地域係数:1, 備考:null },
  { 在庫ID:"STK-0138", 装備ID:"EQP-A-0203", 装備名:"荷役の詰め襟", 既存商品ID:null, 拠点:"交易都市", 施設ID:"LOC_TRADE_STABLE", "施設/売り手":"交易都市", 基準価格G:34, 在庫:"多", 初期販売:true, 解禁条件:null, "価格変動/条件":null, 合法性:null, 地域係数:1, 備考:null },
]);

export function applyCanonicalLiveEquipmentV2(battleSnapshot) {
  const equipment = table(battleSnapshot, "装備性能マスター");
  const stock = table(battleSnapshot, "店舗装備在庫");
  for (const row of EQUIPMENT) upsert(equipment, "装備ID", "装備ID", row);
  for (const row of STOCK) upsert(stock, "在庫ID", "在庫ID", row);
  return battleSnapshot;
}

export const CANONICAL_LIVE_EQUIPMENT_V2_VERSION = "route-equipment-sync-2026-08-16";
