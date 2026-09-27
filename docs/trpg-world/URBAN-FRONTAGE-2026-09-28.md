# 街区の間口再構成 — 2026-09-28

対象: feat/persistent-world-rpg。前段 a936ffc0（全11地域の土地利用と屋外仕事）。

## 実装

urban-frontage.mjsを追加。王都12施設、犯罪都市10施設の既存建物について、長屋、職住一体の店、共同宿、市場、倉庫などの用途に応じた間口をauthoringする。全建物へ一律倍率を掛けない。既存の入口・施設ID・世帯・仕事・actorは保ち、左右壁と背壁、正面開口、描画、collisionを同じ寸法から生成する。架空の住民や閉じた飾りの家は追加しない。

居室区切り・家具・上階は今回の実装に含まない。床面積が増えたことを居住人口増加や商品在庫増加とは扱わない。

## 検証

- focused spatial tests: 18 PASS / 0 FAIL / 0 SKIP。
- a936ffc0の実contentから生成したinitial saveを最新contentへ移行可能。body移動0。objective history不変、JSON save/reload後の継続一致。任意の既存プレイ済みsaveすべてを実検証したという意味ではない。
- browser: production rendererのauthoring viewerで犯罪都市の長屋入口と街区俯瞰、王都俯瞰を確認。実player操作による生活simulationの証明とは別。
- 新しいsemantic state、route flag、イベント専用commandは追加していない。paid/live LLM: 0。

## 視覚レビューの結論

未完成。間口拡張によって建物の占有面は増えたが、俯瞰ではなお独立棟が点在している。用途のない空白がなくなったとは判定しない。

次のまとまりでは、市場・下層住宅・港湾街の連続した街区を設計し直す必要がある。特に市場と住宅の間の広い空白を、搬入庭という名前だけで処理しない。建物の向き、共同入口、裏庭と生活路地、実際にそこを使う住民/店を一緒に配置する。現状の全建物南向きの入口も制約になっている。

P1: 都市街区の密度と方向性、屋内生活、下水道、洞窟の上下階、全地域の共同空間のNPC利用、街間空間/交通の継続課題。
P2: 灰色箱の表現、照明、地表patchの格子端。
USER DECISION REQUIRED: なし。

最終 world:check: 214 PASS / 0 FAIL / 0 SKIP、client build PASS、exit 0。ログ: tools/trpg-world/reports/frontage-world-check.log。content: world-10d-d4a26adbbcf1。
