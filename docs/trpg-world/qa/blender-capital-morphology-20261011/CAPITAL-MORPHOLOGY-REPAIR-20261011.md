# 王都 修正パス：既存の溝埋め、階段集合、屋根・街区の変化、公共建築（2026-10-11）
## 正本／採用状態
- 現行：`current/capital-parcel-review.blend` (46,292,478 bytes) / `current/plan.json` (29,608,020 bytes)。
- `capital-parcel-review-last-good.blend` と `plan-last-good.json` に施工前の現行版を保持。
- 状態：**局所メッシュQA=PASS、都市全体・視覚品質=未受入**。事前・採用後の現行Blender実体から一貫して検査した。
## 今回の完成した局所変更
- **削除**：`wall_gallery_north_old_trench_fill_0…285` = 286個。オブジェクト単体名では存在しないが、286個の連番オブジェクトが残存していたものを撤去。周辺の歩行路を壊していないことを全市床支持検査で確認。
- **北側ギャラリー階段**：`wall_gallery_north_court_wall_stairs_0_floor … 282_floor` = 283個のメッシュを `current_north_gallery_stair_unified_stone_treads` 1個に統合。通行面形状は原状維持。**上り下りの長さ・美観は未改善**。
- **魔術地区階段**：床362個を `current_mage_wall_stair_unified_stone_treads` 1個に統合。高さがばらついた石手すり362個を撤去し、階段床に合わせた `current_mage_wall_stair_continuous_cliff_parapet`（1メッシュ）に置換。写真上なお長大な露出階段のため、**景観・設備上の完了判定なし**。
- **屋根・外壁連動**：下町13,635棟中8,570棟、亜人街1,118棟中728棟、市場1,064棟中691棟、河岸502棟中325棟を調整（計10,314棟）。屋根ピッチと建物高さを建物単位で変更、薄い slate / tile / weathered 色を分散、煙突を121基（単一建材群）追加。壁は接地させたままで屋根座標と一緒に更新。
- **上層市街の空き地へ視覚的な公共目的地**：中心(310,650,112)、約66m×44mの建物用地。公共記録館、鐘楼、列柱回廊、石造広場、噴水・植栽、都市公園側からの3.6m歩行路・敷地内ループ路。新規7メッシュ／2路線。正本の既存施設IDを勝手に付けず、NPC・屋内アクセスは未実装と明記。建設前のShapely検証で既存の上層住宅敷地の衝突を回避。
## QA
- 施工後の全市道路サンプル：1,231経路、174,764本の床支持レイ、14件の**既存異常は増減なし**。地形と全経路の完全歩行可能性保証ではない。
- 屋根と外壁のXYZ座標完全一致：下町198,747/198,747、亜人街16,635/16,635、市場15,963/15,963、河岸8,346/8,346 = **合計239,691/239,691**。
- 上層公共施設の地面支持7/7、再オープンした現行BLENDについて `LOCAL_PASS`。
- `current_royal_masonry`の基部24/24は`castle_ground`接地。ユーザーの「浮いて見える」問題は**巨大な台地・周辺支持の造形／視線の問題**として未解決。メッシュを漫然と削除しない。
## 現在なお不合格の点
- `upper_city_ground`の大きな空白は、今回の建築1件では**一部しか埋まらない**。街路・公共用途の配置を含め再構成が必要。別候補(-65,710)は現状の道路接続が住宅敷地に衝突するので保留。
- `west_lower_wall_stairs_support` と `west_noble_wall_stairs_support` などが長く、壁と完全に一体化していない。構造・短い複数階段／貨物導線の最優先再設計対象。
- `court_wall_stairs` `upper_wall_stairs` `mage_wall_short_stairs`も長大で未受入。魔術地区の手すりを統合したことを形態改善完了とは見なさない。
- 残存する床高不一致14件：`noble_east_winch_incline`11、`civic_foot_contour_1_retained_1`2、`court_wall_stairs`1。
- 建物1棟ごとの立面建築様式、城・宮殿クオリティ、人物視点の視界、歩行者・NPC・荷車の連続動線はまだ改修が必要。屋根の色・高さだけで探索性を獲得できたと判定しない。
## 証跡
`architecture-repair-20261011.build.json`, `architecture-repair-20261011.live-qa.json`, `architecture-repair-20261011.stage2-road-qa.json`, 施工コードと固定視点 `arch-...-before.png` / `arch-...-stage.png` / `arch-stage2-...`。
注意：Blender GUIは施工前から起動している可能性があるため、未保存変更を保護してから現行ファイルを再読込すること。