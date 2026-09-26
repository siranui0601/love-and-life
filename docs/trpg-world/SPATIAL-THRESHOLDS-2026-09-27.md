# レベルデザイン再調査・入口と生活空間の継続記録

実装/検証: 2026-09-26、引継ぎ: 2026-09-27。Spatial Foundationは継続中。

- Starting HEAD: `57d153c6099262c09354d417b66dc92b0309e9d2`。branchは `feat/persistent-world-rpg`、開始時clean、remote一致。
- Implementation checkpoint: `6fc780f007f01b950238c93d648849e02af9e0ee`。
- この引継ぎを含む最終checkpoint SHA、remote一致、working treeはpush後のチャットで報告する。force push・main変更なし。

## 調査と判断

開発者/著者の資料5件を読み、根拠と本作への採用判断を [LEVEL-DESIGN-PRINCIPLES.md](LEVEL-DESIGN-PRINCIPLES.md) に記録した。中心は「一本道へ誘導する」ことではなく、住居・仕事・食事・荷受け・共有場所をプレイヤー自身が理解して使えること。資料の設計上の主張と、本作での実測結果は区別する。

今回の実装は、通り→戸口→室内の境界。都市全体の街区再配置、人口規模に見合った密度、全生活圏の完成ではない。

## 実装

- 村12、王都17、交易都市14、計43棟へ正面壁と戸口。17棟の住宅を含む。
- 住宅1.8m、公開service/行政3.2m、荷扱い4mの仮開口。壁のcollision/LOSと3D描画を同じデータへ接続。戸口からの視界は残す。
- 粗い屋外gridが拾えない実入口を、入口内外の接続点で通す。戸口を塞げば通れない。NPCは家から出て街路へ合流し、帰宅では逆を通る。
- 10の店/宿へ建物に付いた看板。住人名、私有情報、未来の大型店は表示しない。地域切替で専用sign texture/materialを解放。
- 全105 source施設の位置を `facility-sites.mjs` の安定IDキーに変更。Sheet行順を逆転しても配置が変わらず、同数でも未知IDへの差替えは拒否。既存座標そのものは維持。
- `world-10d-534227bca032` から新content `world-10d-0d38993b18b0` へのhash承認を追加。新content hashは `e2443c2f1f566b7ca4dc7521aa93bad8c571141571e286c52c45828998fb7f4c`。

## 検証

|項目|結果|
|---|---|
|入口focused suite|13 PASS / 0 FAIL / 0 SKIP（施設ID並替えtest追加前）|
|最終 `npm run world:check`|**210 PASS / 0 FAIL / 0 SKIP、exit 0**|
|最終空間suite|14 PASS（全体210件に含む）|
|content audit / assets / build|PASS。initial gzip 399822 bytes|
|content再生成|同revisionで再現。今回のIDキー化で座標・生成結果は変わらない|
|save/restart・旧save migration・replay・no offline advance|既存回帰PASS。出勤/帰宅のreplayもPASS|
|player知覚|正面壁越しの住民はprojectionから除外。居住者名/設計地区は追加公開しない|

ログ: `tools/trpg-world/reports/spatial-thresholds-final-check.log`（ローカル、Git対象外）。初回追加テストでは住宅の戸口が粗いgridから外れて到達不能になり、生成段階で検出。実入口接続で修正。gridに合わせて個別の家をずらして回避していない。

## ブラウザ

画像は `validation/spatial-thresholds-2026-09-26/`。

- authoring viewer: `bakery-front.png`、`farm-house-front.png`、`capital-weapons-front.png`。店名が現地で読めること、住宅の正面の狭い入口、側面の壁で室内が遮られる形を目視。これはruntime rendererの形状確認で、NPC通勤のブラウザ実走証明ではない。
- 通常HTTP serviceのnew gameを別save directoryで起動: `live-new-game.png`。3D/日常HUD/更新が表示され、console errorなし。
- 通常UIの持ち物menuを開く前は7:08から7:17へ進行。menu中は別の作業を挟んだ再観測でも7:17のまま。持ち物と状態も保持。
- このbrowser確認では全住居への歩行、店の全取引、旅の全ルートは通していない。既存の灰色箱・広い空地・街区密度の不足を「視覚的に完成」とは判定しない。

## 残件

P0: 今回の回帰で新規進行不能/データ喪失は検出なし。

P1: 生活圏単位の街区再配置、敷地/庭/路地/荷受けの結合、住宅と店舗の別入口、店舗別在庫/食事service、実住民の反復的な買物・食事、他8地域への同じ設計の展開、中間travel spaceと実車両/船/乗員。

P2: 間仕切り・鍵・入室許可、家具の物理化、看板の用途別意匠、ランドマークと高低差。新しい看板は地点識別の基盤であり、武器やパンの実陳列はまだない。

次は住宅→買物/食事→職場の生活圏を街区として組み直す。既存の位置を美術の最終条件にしない。5本の攻略固定やblind solver調整へは戻らない。

Paid/live LLM calls: **0**。USER DECISION REQUIRED: **なし**。
