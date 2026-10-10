# 王都 current 上書き施工：床・行政擁壁・王城／謁見の間
2026-10-10 / **WIP・全体未受入** / Blender 5.2 LTS

## 対象の現行ファイル
PC: C:\Users\inaba\Documents\TRPG-Capital-Blender\current\capital-parcel-review.blend
直前の復元用は同階層の capital-parcel-review-last-good.blend（単一ローテーション）。新しいdesign-b番号フォルダを増やさず、同一BLENDを上書き。GitにはBLENDバイナリは含まない。

## 実施工
1. upper_city_ground：欠損2箇所を三角面150枚・計約175.09平方メートルで既存の同じ地面メッシュへ結合。計算上の床残差約0.06平方メートル。
2. western_ascent_noble_service_restored_civic_ground：約8958平方メートルの復元地外縁に支持壁170.93m・控え壁8基を追加。既存壁と階段出入口を保護。
3. 王城の b101_principal_throne_hall_block を実際のBlender Booleanで空洞化し、南側の通り抜け入口を整備。重複する旧城館 Proposed castle palace を撤去。
4. 巨大な青い一枚屋根を三段構成の主棟（高い身廊＋側翼屋根）に置換。城門は原位置を保持したまま本物のアーチ空間を設け、門→中庭→謁見の間へと動線を再設計。旧内部塔4基と各屋根を地面のある外郭側4箇所へ配置し直した。
5. 彫刻的な装飾は素材別の7つの統合バッチメッシュとし、石材ひとつごとの個別オブジェクトを増殖させない。

## QA（局所限定）
- 上層床補修150サンプル、欠損0。
- 行政復元地の新擁壁・付近18経路：4704通行レイ、遮断0。
- 王城門～謁見の間：1420人物高さレイ、遮断0。床710点欠損0。
- 城内10経路に対する移設塔と新規建物：3372レイ、遮断0。
- 当初案の入口床5件遮断、移転先の周回路26件遮断はいずれも不合格とし、再設計した合格案のみ現行BLENDに反映した。
- これらは離散レイの局所的検査であり、連続カプセル、NPC、荷車、NavMesh、本番実装、王城全室の探索性は未保証。

## 未解決・優先タスク
- civic_royal_ramp_terrace_support：1170mの大迂回斜路（代替経路未成立のため未撤去）。
- west_noble_wall_stairs_support／west_lower_wall_stairs_support：長すぎる既存支持材の整理と短距離昇降方法。細かな階段オブジェクトの統合を含む。
- western_ascent_market_ascent_restored_ground：約32073平方メートルの空虚な地形に、街路へ接続する市場・工房・交易動線を構築する。
- 王城の内郭、王族居住棟・王庁機能、上階移動、城壁防御体系、街の各地区の発見。全域の壁・床穴、ゲーム実歩行、NPC・荷車の監査。
Notion: https://app.notion.com/p/3f4890a55fd08109be2ade087dcedbf6
