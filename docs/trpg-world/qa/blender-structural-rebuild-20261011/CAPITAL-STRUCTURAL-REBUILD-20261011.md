# 王都・城壁／階段／基壇の構造改修 — 2026-10-11

## 結果
**現行Blender・planへ局所採用。都市全体・美観は未受入。**
- 現行：`capital-parcel-review.blend`／`plan.json`。施工直前版：`capital-parcel-review-last-good.blend`／`plan-last-good.json`。
- **階段の旧1741メッシュを撤去**：`wall_gallery_civic_wall_gallery_stairs_*` は床451、屋根451、側壁839。床の三角面は1メッシュにまとめて残し、開放型石造側壁と既存上層擁壁への斜材16本へ置換。中間出口5箇所の側壁を開放し通行を維持した。
- **魔術地区の旧擁壁89パーツを撤去**：`mage_quarter_mage_wall_freight_abutment_*` を取り除き、視界を塞ぐ連続板状の壁から石造側壁・既存擁壁への斜材3本へ改修。従来の大きな斜路とその路線は維持。
- **王城基壇の見かけの浮遊対策（第一段階）**：標高204mの`castle_ground`外周のうち約995.4mに、下層の標高156/112mまで延びる台形支持壁・石積みの控え材を新設。ただし入口との交差を避けるため外周42区間は空けたままであり、完全な崖面処理／立体的美観としては不合格。
- 新規5つの複合メッシュ。旧オブジェクト1830個を削除。今回、住宅個別建築や西側長階段は未施工。

## 検証ゲート
- 棄却した初期案では、新設支持材・側壁が既存の分岐に最大15地点干渉していた。**v5で40,926サンプル中0候補**となり、採用後の現行BLENDを再読込して同じ検査で0。
- 全1,231経路・174,764レイの既存床支持監査で、既存の異常候補14→14（退行0）。残14の修正は未完。
- 地面の連続歩行・NPC・荷車、落下防止（側壁開口部を含む）、物理シミュレーション、完全な経路幅に対する当たり判定は未検証。静的な経路中心線距離・床支持を「通行保証」と扱わない。
- Blenderに開いたGUIはモデル再読込前の表示である可能性があるので、GUIで未保存変更を確認してから再読込。

## 画像比較からなお不合格の問題
1. **巨大ギャラリーの「足場」**：縦柱群は今回の階段側壁だけが原因ではない。別施設 `current_civic_royal_hoist_*` や `current_civic_upper_short_*` に分散している。前者の`hoistOperation.status`は **BLENDER_ANIMATION_ONLY**、後者は **PENDING_3D_ROAD_COLLISION_AND_VISUAL** で、稼働する交通施設だと主張できない。ここを石造の階段塔と実用リフトとして一体設計し、重複アセットを排除する必要がある。
2. **魔術地区貨物用斜路**：`mage_wall_freight`は水平73mで56m上昇、縦／横勾配76.7%。通常の荷車に使えない。専用昇降機／荷役場を設計するまで貨物搬送は未合格。残る斜路も空間・景観として未合格。
3. **西側2系統長階段**：`west_lower_wall_stairs`約193m、`west_noble_wall_stairs`約192m。ユーザー指摘の`west_lower_wall_stairs_support`・`west_noble_wall_stairs_support`は残存。短階段の候補地における敷地重複0の候補があるが、正本保護・入口・路面の連続移動試験が必要。
4. **西側復旧地盤の謎空間**：`western_ascent_noble_service_restored_civic_ground`は約8958㎡、`...restored_low_ground`は約14867㎡の独立地盤。現在の基準地盤とは重なっていないため無検証の削除は床抜け再発につながる。土地利用・道路・生活施設に再区画する。
5. **王城／宮殿の造形**：`current_royal_masonry`の基部24地点は`castle_ground`に接地するが、外側では多段壁や屋根のプロポーション・後付け連絡路が建築として不自然。今回の外周補修は完全な王城再設計ではない。
6. **住宅の反復**：量的な屋根色・高さのばらつきでは不足。正本の地区役割、路地・通行視界、建物機能、階数、連結アーチ、中庭、修繕状態等を住戸／街区単位で設計する必要あり。

## 採用したコード／証跡
- `author-critical-wall-reconstruction-v5-20261011.py`
- `build-critical-wall-v5.py`
- `audit-structural-v5-clearance.py`
- `verify-structural-rebuild-live.py`
- `audit-critical-wall-v5-roads.py`
- `structural-rebuild-20261011.v5.study.json`
- `structural-rebuild-20261011.live-center-clearance.json`
- `structural-rebuild-20261011.v5.road-qa.json`
- `critical-*-original.png`／`critical-*-v4.png` は構造の比較用で最終v5とは側壁開口が微差あり。v5の完全な絵柄証跡ではない。
