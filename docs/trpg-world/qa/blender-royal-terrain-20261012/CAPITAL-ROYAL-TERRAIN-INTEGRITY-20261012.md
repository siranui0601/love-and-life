# 王城周辺の段差・地盤支持監査と西宮廷外周の再施工 — 2026-10-12

## 現行採用済み
- 正本：`C:\Users\inaba\Documents\TRPG-Capital-Blender\current\capital-parcel-review.blend` と `plan.json`。
- 施工前バックアップ：`capital-parcel-review-pre-west-cliff-20261012.blend`／`plan-pre-west-cliff-20261012.json`。既存の作業差分に上書きしないため、施工直前のハッシュとファイル長を照合し、別試作を検査した後に原子的置換。
- 王城の下、宮廷地区Z156西外周の`X=-108〜-7, Y=992〜1168`の約251.25mで、地盤境界と既存擁壁を比較し壁の欠損を検出。
- 石造擁壁251.25m、笠石、8か所の広いテーパー控え壁を建築し、標高112mの低地に6,638.1㎡の追加地盤を施工。もとのZ112地盤と274.6㎡重なる。道路標高の異なる床を混同せず、高台の道路を塞がない。
- 敷地ポリゴンとの平面上の重複0。標高112mの既存道路点との交差0。
- 下端189/189地点の地盤接地（最大距離0m）、新規擁壁周辺297経路サンプルの中心線干渉0、全市1,232経路・174,749レイの床支持不整合14件（既存14→14、退行0）。施工後の実際の現行BLENDを再オープンして同じ局所検査を再実行済み。
- 同一カメラ角度で王城南西・王城下部・王城東・前庭の前後画像保存。

## 判定で区別したもの
1. Z204城壁の`X約164〜245,Y約1052〜1110`、約100mの壁上端未検出は`castle_wall_stairs`（156→204m）と上部入口に一致する。これは無条件に壁で塞いではならず、階段側壁・実際の支持・接地の設計対象。
2. Z156の東南`X約324〜391,Y約892〜965`の約113.5m欠損は、`castle_east_ramp_landing_0`／`current_castle_east_stone_stairs`／`current_castle_east_winch_ramp`と交わる。大規模な白い空洞も画像で確認でき、次の主要優先箇所。道路網を壊す無条件の壁生成はしない。
3. 上記に隣接する`X420〜449,Y946〜989`の約51.98mで補修試作を作成したが、初回の前後画像は視覚改善をほとんど示さなかった。既存`forecourt_retaining`や岩壁・内壁が視界を塞ぐ可能性があり、**この試作は現行未採用**。保留ファイル：`royal-forecourt-southeast-20261012.pending.blend`／`royal-forecourt-southeast-20261012.staged.plan.json`。数値は基部27/27・道路異常14→14・局所経路39点干渉0だが、数値だけで採用しない。
4. 道路床支持異常が14件残存：`noble_east_winch_incline`11／`civic_foot_contour_1_retained_1`2／`court_wall_stairs`1。王城下の`court_wall_stairs`で座標(101.16,769.80,138.64)の階段路面と約0.59m差がある。未修理。

## 既存の課題
- 王城・宮廷の美観、宮殿の十分な存在感、個別建物の手作り感、地下・側壁の全市連続性、長すぎる傾斜通路等は引き続き要改修。
- 今回のQAは地形メッシュへのXY接地と既存道路のサンプルであり、NPC衝突、全幅歩行、耐荷重、全壁面の閉鎖性まで保証しない。
- GUIのBlenderは古いシーンを表示している場合がある。未保存の作業を別途保護してから現行ファイルを再読込。

## 再現コード
`author-royal-forecourt-cliff-20261012.py`／`build-royal-forecourt-west-20261012.py`／`verify-royal-forecourt-west-active.py`／`verify-royal-forecourt-west-ground-active.py`／`audit-royal-forecourt-west-roads.py`。南東試作は別ファイル`author-royal-forecourt-southeast-20261012.py`／`build-royal-forecourt-southeast-20261012.py`、未採用。
