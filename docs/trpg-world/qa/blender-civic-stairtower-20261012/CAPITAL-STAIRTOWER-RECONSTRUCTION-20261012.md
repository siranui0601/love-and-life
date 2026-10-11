# 王都・城壁階段塔の局所的再設計（2026-10-12）

## 適用
- 現行正本：`C:\Users\inaba\Documents\TRPG-Capital-Blender\current\capital-parcel-review.blend` / `plan.json`。
- 前版バックアップ：`capital-parcel-review-pre-stairtower-20261012.blend` および `plan-pre-stairtower-20261012.json`。
- **局所静的QA=PASS。ただし王都全体・NPC通行・建築デザイン全体は未受入。**

## 構造設計
以前の `current_civic_upper_short_stair_east`（標高42→112m、5飛行区間、約350段）のむき出し鉄骨／支持材は、市街で大きな空白に架かっていた。調査により塔中心(636,664)で地盤が欠損し、最短の既存地盤は上層約34m・中層約50m・下層約99mと確認した。
- 鉄骨支持 `current_civic_upper_short_support` と露出手すり `current_civic_upper_short_rail` を撤去（元の階段床・橋・歩行経路は維持）。
- 未完成リフト試作のPlan内8メッシュとBlender単体のwinchを撤去。`hoistOperation.status` は `VISUAL_PROTOTYPE_DECOMMISSIONED`。**エレベーターのプレイヤー操作も貨物輸送も未実装。**
- 16角石造階段塔（中心636,664、半径約20m、標高14〜122m、頂点138m）を新設。変化のある3基の屋根付き小塔、石造扉口、周囲の段状バンド、採光窓、内部の安全手すり、上層橋および中層のアクセス路・石造支脚を設置。
- 地盤の空白を安易な薄い床で覆わず、中層の実在する `civic_foot_ground` と上層の城壁へ構造的に接続。中層歩行経路 `repair_civic_stairtower_middle_secondary_access` を1本追加し、終点を既存地盤内 (685,647,Z42) まで延長。既存住宅区画との重複0。
- この補強はゲーム物理による荷重計算をしたものではなく、「構造として読める外観」の局所形状である。

## QA
- 実施した試作でインテリア手すり干渉46→1→0、外付け小塔の旧ギャラリー階段干渉11→0へ是正。
- 最終候補および**現行Blenderを再読み込み**した局所静的中心線クリアランス：4,070サンプル、干渉0。
- 全市床支持検査：1,232経路（新設経路+1）、174,779レイ、既存不整合14件のまま（11件 noble_east_winch_incline、2件 civic_foot_contour_1_retained_1、1件 court_wall_stairs）。悪化0、異常そのものの修復は未了。
- 出口：下層南西、中層東、上層北・西の門口を床・通路高に合わせ配置。
- 完了判定を禁ずる未確認点：NPC／カプセルの全幅衝突、扉開閉、階段快適性、手すりの跳び越え、建築内部および真の貨物昇降機、屋根裏アクセス、周辺の自然地形全体。
- 人物視点に寄せた現地ウォークスルー・建築意匠のユーザー受入は未実施。

## 未解決・優先度高
1. 西側の長階段 `west_lower_wall_stairs_support`、`west_noble_wall_stairs_support` とその周辺地盤・復旧広場。
2. 王城 `current_royal_masonry`、段状の基壇と宮殿造形、その他空中階段。
3. 魔術地区の貨物斜路は水平73mに対して56m上昇し、荷車としては成立しない。
4. 個々の地区建物の階数・アーチ接続・目的地・発見性、壁面連続性、道路階層・空地用途。
5. 上記14件の床支持不整合の個別修理。

## 証跡
`author-civic-stairtower-v6-20261012.py`, `build-stairtower-v6.py`, `audit-stairtower-v6-clearance.py`, `verify-stairtower-active-20261012.py`, `audit-stairtower-v6-road.py`, `audit-stairtower-v4-anchor.py`, `civic-stairtower-20261012.v6.study.json`, `civic-stairtower-20261012.active-clearance.json`, `civic-stairtower-20261012.v6.road-qa.json`、同一視点のbefore/v6画像6点。
