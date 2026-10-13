# 王城東外周：Z156城壁基礎とZ112低地地盤の接続（2026-10-12）
## 施工状態
- **第一段階を現行正本へ採用済み**：`current/capital-parcel-review.blend`（Blender 5.2）と`current/plan.json`。
- Blender Scene内の状態表示：`royalEastIntegratedV9=ACCEPTED_STRUCTURAL_FIRST_PASS_20261012`。
- 施工前退避：`capital-parcel-review-pre-east-v9-20261012.blend`（45,662,768 bytes）と`plan-pre-east-v9-20261012.json`（27,145,485 bytes）。試作フラグ修正直前のv9も`capital-parcel-review-pre-east-v9-scene-tag-20261012.blend`として保管。
- 元の東斜路`current_castle_east_winch_ramp`と石造階段`current_castle_east_stone_stairs`の経路データ・幅・出入口に変更なし。

## 根本原因と解決
- 空洞本体はおおむね X380〜450 / Y995〜1050、Z112〜204の城周辺に存在。従来のv1〜v5は、地盤の位置の誤認や巨大な三角形、露出支柱を生んだため不採用。
- v6は城壁最上端のZ204まで岩盤を盛り、既存`current_east_escarpment_stone`の装飾と階段外壁を隠してしまった。
- **支持すべきは城壁の下端Z156**と判明。v7以降、Z156から既存Z112低地へ下る完全に閉じた岩盤地形と地面支持を一体生成。
- v8は末端を細くしたが高いままだったので柱のような突起が発生。v9は末端の幅と高さを段階的に下げ、既存`repair_royal_cliff_tapered_revetment`の足元に収束。既存の意匠付き城壁は保持。
- 採用形状の範囲はY950〜1095（145m）。地形平面上の補修範囲6,496.4㎡、既存Z112地盤との重なり251.7㎡。50断面から一体生成、岩盤メッシュ2996面・地盤基礎1372面。
- 新メッシュ名：`repair_royal_east_pocket_integrated_rock_v9` / `repair_royal_east_pocket_integrated_footbed_v9`。元の階段・巻上げ斜路の重複立体を消さずに施工。

## 施工前後のQA
- Blender bmeshの閉鎖性：岩盤メッシュは非多様体エッジ0、境界エッジ0。
- 東側通路（石造階段・巻上げ斜路・下層踊り場・展望路）4,734個の路面中央・肩・高さ別近接サンプルで新規岩盤との干渉候補0。
- 都市全域1,232経路、174,749床支持レイの異常14件で増加なし（`noble_east_winch_incline`11、`civic_foot_contour_1_retained_1`2、`court_wall_stairs`1）。
- 現行正本の`.blend`再読込後も同じ局所・都市全域QAを実施し上記結果一致。
- 参考画像は同一カメラ比較`qa-east-ground-before.png` /`qa-east-ground-v9.png`、`qa-east-royalhigh-before.png` /`qa-east-royalhigh-v9.png`、`qa-east-underwall-before.png` /`qa-east-underwall-v9.png`。
- `parcels.json`では宮廷区画1件と平面上70.94㎡の重なり。新岩盤はZ156を超えないため宮廷地区の地上建物群と高さ方向を分離した設計だが、正確な建築設備・建物の基礎を含む全物理衝突検証ではない。

## 残課題・受入の境界
- **第9版は基盤地形の第一段階のみ受入。** 王城造形、城らしい層・門・アーチ・地下構造、建物の変化、市街側擁壁と階段の接続は依然として改善が必要。
- 新設部分のカプセル移動・ゲームエンジンNavMesh・NPC通行全幅をまだ実地検証していない。静的経路サンプル0件のみで完全安全とは言わない。
- city floor失敗14件は未解決。全市すべての空洞・地形破綻が修理完了したという判定ではない。
- Blender GUIでは古いシーンが表示されたままの可能性あり。未保存作業を保存したうえで正本を再読み込み。
- 次段階：王城の城門〜本丸の導線、魔術塔・宮殿・城壁の輪郭強化、露出反復アセットを限定的に撤去、Y950〜1095の低地側からの歩行視点検査、残存14件の局所補修。

## 再現
`author-royal-east-integrated-v9.py`（Z156を根拠とする独立一体地形）→ `build-royal-east-integrated-v9.py` → `audit-royal-east-integrated-v9-local.py` / `audit-royal-east-integrated-v9-roads.py`。保全を優先するため常に試作`.blend`に施工してQA後にバックアップ付きで正本置換。
