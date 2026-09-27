# 路地・地下生活空間の継続記録

開始: e3ad09cf5c6f729702e77739547b40c12097c7ce / feat/persistent-world-rpg。

## 実装した範囲

- 王都の下層街に4本、犯罪都市の荷受け庭・生活庭に5本の境界壁。描画・collision・LOSは同じ寸法を使用。
- 犯罪都市に港裏の借家と情報街の長屋。新規の見せかけ住民を生成せず、既存の長期借室住民4人に実在する居住先を割り当てた。旧saveの現在位置を新居へ移動させない。
- 犯罪都市・ドワーフ洞窟の施設にも入口の前壁を追加。
- ドワーフ洞窟の主空間を岩盤内の空洞へ変更。居住・搬送・深部の3系統の坑道を追加し、施設と既存R05へ接続。44個の統合岩盤bodyと天井を使用。箒も天井を越えられない。
- 地下では屋外用の屋根と天候描画を停止。明るさはgraybox確認用で、局所照明の完成ではない。
- 犯罪都市・洞窟の地区、既存住民の所属、通行可能な生活/搬送flowを生成。flow自体は新しい貨物・仕事・NPCを発生させない。
- 既存施設・NPC・事件・道路のsemantic IDを維持。明示hashのsave移行対象を追加。

## 検証

world:check: 212 PASS / 0 FAIL / 0 SKIP、build PASS。ログ: tools/trpg-world/reports/enclosed-world-check-final.log。
空間testは16件。旧blind workshop testもassertionやpolicyの変更なしでPASS。
初回は旧ランダム装飾岩が洞窟の通行を塞いだため1 FAIL。洞窟は岩盤/空洞authoringへ統一し、屋外用の岩散布を停止して修正。

ブラウザ: production WorldSceneを使うauthoring viewerで鉄樽亭・岩盤・天井、港の動線、追加住宅を確認。NPCの生活実走をこのviewerで証明したとは扱わない。
住宅前の近距離確認でreview cameraが庭壁へ入り込む問題を発見。レビュー用カメラの改善が必要。
画像: validation/enclosed-2026-09-27/dwarf-inn.png。

## 継続事項（完成ではない）

P1: 全地域の用途のない空白、都市の建物密度、下水道の立体接続、洞窟外から洞内への段階的approach。
P1: 旧saveのbodyが新しい大岩盤内で8m以内に空間を見つけられない場合、既存移行は明示失敗する。遠隔teleportで隠さない。
P1: 全店舗の差別化された商品・室内生活設備、交通車両の完成は別途必要。
P2: 岩盤の直方体形状、壁・床素材、音、地下の局所照明はgraybox。

ユーザーは全土地・街道の配置案に賛成。次は全地域の土地利用を機能別にauthoringし、農地・林・庭・作業空間も含めて空白を埋める。下水道はsurface alleyに名前だけ付けず、床/上下接触/出入口を備えた地下空間として設計する。
paid/live LLM: 0。USER DECISION REQUIRED: なし。
