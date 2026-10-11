# 王都・地盤と擁壁の接続性修正（2026-10-12）

## 採用状態と正本
- **採用済み／局所静的QA合格。王都全体の造形・歩行安全性は未受入。**
- 正本：`current/capital-parcel-review.blend` と `current/plan.json`。施工前バックアップは `capital-parcel-review-pre-loggia-mage-20261012.blend` / `plan-pre-loggia-mage-20261012.json`。GUIのBlenderは古いシーンを表示している可能性があり、未保存編集に注意して再読み込みすること。

## ユーザーが特定した欠陥1：空中支柱
- `wall_gallery_loggia_support_653.4526315789474_3.6` を含む同型4本はZ=42〜98mの細い柱だったが、基部のXYにはZ=42の地盤が存在しなかった。
- 施工前の自動監査でも未接地候補4本（接地地盤までXY約54〜68m）を確認。
- 4本を撤去。支柱だけ消すのではなく、行き止まりの `civic_wall_gallery_rest_3` を36m→16mに縮め、外側の旧床・側壁・屋根を撤去し、終端とベンチを移設。元の経路入口は維持。
- ロッジアの荷重を持つ石造三角支持を、既存上層市街に埋め込む根元（599.5,799.6）から構成し、地盤接続を確認。
- ベースを支えていない突き出し部分だけを保持する修正は行っていない。

## 欠陥2：魔術地区低地と高台の壁抜け
- 旧 `mage_east_retaining` は一部高台外周に存在せず、`mage_quarter_restored_low_ground` との間にZ=70→14mの巨大な空白が残存。
- 既存擁壁とZ70高台の境界を照合して、欠落の大きな連続区間約151.6mを抽出。石造壁・笠石・控え壁を追加。
- 壁だけの試作は**不合格**：基部83検査点のうち既存Z14地盤に一致したのは32点のみ（最大105m離れ）。
- Z14の低地地盤を約4,804.7㎡拡張し、既存低地との重なり約124.3㎡を確保。追加後は擁壁下端83/83地点がZ14の低地地盤と幾何学的に一致。上層市街の住宅配置には手を加えていない。
- 当該区間以外にも未受入の地形境界がある。152mを直したことは市街全体の壁連続性保証ではない。

## 比較検証
- `audit-citywide-vertical-supports-before-20261012.py`（施工前）→接地地盤なし候補4件、`audit-citywide-vertical-supports-20261012.py`（採用後）→0件。ただし名称に`support`/`pier`/`abutment`を持つ縦長構造の基部と各標高の地盤のXY接続のみを検査。他の柱・斜材・岩壁、NPC歩行は未網羅。
- 新設メッシュの経路中心線クリアランス：採用前7件の近接→接続形状を修正し、対象1,203点で0件。
- 全市道路支持監査：**1,232経路・174,749検査レイ、従来から残る14件（悪化0）**。`noble_east_winch_incline`11、`civic_foot_contour_1_retained_1`2、`court_wall_stairs`1。
- 施工後の実際の現行BLENDを再読み込みしたクリアランス：1,203点・干渉候補0。
- 同一視点前後レンダリング：ロッジア、魔術低地、魔術城壁の3視点を各before/v3で保存。

## 未完了の主な課題
- 西側の大幅に長すぎる2つの階段と`western_ascent_noble_service_restored_civic_ground`等の中途半端な敷地利用。
- 王城の`current_royal_masonry`造形、浮遊して見える基壇や空洞。
- 魔術地区の貨物斜路（水平73mに対して標高差56m）と実用的な貨物昇降機。
- 残る道路支持異常14点、全域の擁壁継ぎ目、複雑な建物構成の個別建築・レベルデザイン。
- 3Dカプセル当たり判定、NPC／荷車の通行テスト、アセットへの現地入場・退出は未検証。

## 再現性
主要スクリプト `author-loggia-mage-repair-v3-20261012.py`、`build-loggia-mage-repair-v3.py`、`audit-loggia-mage-v3-ground.py`、`audit-loggia-mage-v3-clearance.py`、`audit-loggia-mage-v3-road.py`、`audit-citywide-vertical-supports-20261012.py`。
