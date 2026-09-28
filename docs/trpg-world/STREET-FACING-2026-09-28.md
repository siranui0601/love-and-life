# 街路に向けた入口 — 2026-09-28

Starting HEAD: 9e6bdf29。庭の段階の開始HEAD: ec335dc4266b1b13d09497c828befd93608f5a61。
Branch: feat/persistent-world-rpg。

## 設計と実装

全建物の正面が南固定だった制約をbuilding-orientation.mjsで分離。4方位のauthoringが可能。施設ID/世帯/在庫/事件を変えず、建物中心に対する扉・施設前の行動地点・左右背面の壁・正面開口・看板・屋根・室内什器・灯りを整合させる。worldの占有AABBと描画を同じshellWallsから供給し、描画だけを回さない。

今回の配置:
- 王都薬屋: 西の市場・街路側。
- 王都の河岸住居: 北の生活通り側。
- 犯罪都市の情報街: 東の表通り側。
- 交易都市の宿: 北の岸壁・魚市場から来る側。

既存NPCの仕事先は新しい入口前から生成される。住居内のroom IDは維持。道路は占有footprintと入口に従って再生成される。新規NPCや商品を作った変更ではない。

全93建物の描画壁が同じauthoritative shellを参照する。旧content用描画fallbackは保持。

## 検証

focused spatial: 20 PASS / 0 FAIL / 0 SKIP。方位別の入口位置、描画用壁とcollisionの同一性、通常通勤/帰宅、door LOS、経路、save/replayを含む。

9e6bdf29の実contentから生成した初期saveで、移行許可、history保持、geometry reconciliation、JSON save/reload後の2秒継続一致を確認。body移動0。全プレイ済みsaveの長時間検証とは区別する。

ブラウザ: production rendererのauthoring viewerで西向き薬屋の入口・看板・室内を確認。画像はvalidation/courtyards-2026-09-28/apothecary-west-door.png。前段の二都市の庭も同じdirectory。

## 制約と未完成

庭のauthoringは現在の8庭の南向き配置に限定。庭付き施設の向きを変更した場合、誤った場所に庭を生成しないようcompile errorとする。新方位の庭は通用口・通過路を含めて設計が必要。自動的に全敷地を庭で埋めない。

P1: 建物と住宅の連続した街区密度、共同庭の自律生活行動、残る空白の土地利用、屋内生活、下水道、洞窟の多層化、街間交通。
P2: 灰色箱の形、道と地面の素材、照明。

用途のない空白が世界全体からなくなったという完成報告ではない。入口方向を固定せず街区を詰められる段階まで進めた。
Paid/live LLM: 0。
USER DECISION REQUIRED: なし。

最終 world:check: 216 PASS / 0 FAIL / 0 SKIP、client build PASS、exit 0。ログ: tools/trpg-world/reports/orientation-world-check.log。content world-10d-cb0642bbdfaf（再生成で同一revision）。既知P0なし。
