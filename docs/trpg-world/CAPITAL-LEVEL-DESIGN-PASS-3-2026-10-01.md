# 王都 Level-design pass 3 — 引継ぎ・検証記録

## 開始時に確認した状態

- GitHub main: `fd3ddf98b00ac5a36377ecba3222ec0b529d8db2`。PR #330 / #331 は双方マージ済み。
- VPS `/home/ubuntu/apps/judgement-ai`: 当初 `9ec5022caa05bf0f35007eb849296aa68906cb3c`、origin/main は上記main。dirty/incomingを比較して競合なしを確認し、ff-onlyでmainへ追従した。
- `/capital-review/`、`/world-blueprint/` の実ページと既存コード、既存テスト、既存設計文書を確認した。
- 指定された `src/shared/trpg-world/`、`src/client/trpg-world/`、`tools/trpg-world/` は開始時mainには存在しなかった。今回の共有ロジックは既存レビューの `public/capital-review/` に置き、監査CLIのみ `tools/trpg-world/` に新設した。本編に既存統合があるとは扱わない。
- Windowsの既存 `love-and-life` はdirtyだったため利用せず、最新mainから隔離した `capital-pass-3` を使用した。

## 設計根拠と維持した契約

添付Deep Research PDFの23ページを抽出して全体を読み、2枚の参考画像を確認した。PDFのmacro/meso/micro、Lynchの5要素、圧縮/解放、reveal、prospect/refuge、循環、生活動線を設計判断に使った。画像は密度、高台の王城、河川と橋、屋根群、周辺との連続性の参考に限定した。画像に描かれた新施設・文化は正本へ追加していない。

優先順位は正本スプレッドシート＞PDF＞実装＞画像。今回、正本スプレッドシートを再取得したとは主張せず、リポジトリに保存された正本施設・事件・広域契約を維持する。

12施設ID、T10失敗時の孤児院敷地再利用、9地区、core約6.5km²、非相似のenvelope約22km²、都市内の4橋、3門、通常16m/増水22mの局所川を維持した。R06の既存門外接続が川を横切るため、接続線上に構造物として橋を設けた。これは新しい正本facilityではない。

## 良かった点と発見した弱点

既存の意味の違う複数経路、予約された視線回廊、社会ゲート、事件の同一空間再利用は基礎として有効だった。一方、以下の実装原因が歩行レビューを損なっていた。

1. `pathPolyline()` が正方向のedge.pointsを直接shiftし、2D/NPCの再描画で道路の点列を削除していた。最終的に距離0kmになる。コピーして組み立て、edge形状をfreezeした。
2. 上り計測がedge保存方向に依存していた。進行順と8m刻みの実地形で計測する。市場→王城の距離は約1.16kmのまま、上りは約68mに訂正した。
3. グラフ上で通れる施設入口が3Dのmassに衝突していた。孤児院・役所・薬屋の進入線を入口側へ移した。
4. 低屋根道が地面の線だった。高さ4.5mの歩廊、接続斜路、欄干と足元判定を共通化した。
5. 増水とT10が同時に発生すると孤児院が孤立した。南側の生活路を避難にも使う、別の物理経路を設けた。
6. 門外の線が3D地形・川越えと一致していなかった。4広域接続まで連続した地面・道路・必要な橋を描画した。
7. 城壁・広場が斜面と合っていなかった。壁を分割し、広場も地形に沿う面へ変更した。広場の裏向き法線を修正し、俯瞰カメラのnear planeも調整して深度ちらつきを抑えた。

## 空間として実装した改善

- 均等な41m格子を廃止し、街路方向を向く前面建築と不規則な奥の建築に変更。1902 massのうち510が街路沿い。地区ごとの幅、密度、高さ、舗装、屋根色を分けた。
- 生活路幅は下層6m、河岸8m、亜人街9mなど。主要物流20m、儀礼22mとの違いを保ち、狭路から広場への落差を作る。
- 市場、駅馬車庭、王城前庭、共同井戸などの空白を建築禁止だけで終わらせず、歩ける舗装と屋台・井戸・樹木などの境界を与えた。fixtureも同じ衝突データを使う。
- 市場裏の聞き込み回遊、行政の静かな文書庭回遊、河岸の景観階段、下層の屋根接続を追加。時間だけでなく情報・景観・避難の価値を分けた。
- 王城・魔術塔へ予約された視線を維持。高さを含む遮蔽検査で、門から市場までの街路に見える/隠れる区間が両方あることを確認する。画面テレメトリーは「視線が通る」であり、FOV・霧・人間の注目を含む知覚判定ではない。
- 朝35、昼31、夕21体の代理NPC/荷車を同じ道路上で連続移動。市場、駅馬車、役所、宿の流量差を2D/3Dで比較できる。終点は滞在後に折り返し、更新のたびに終点から始点へワープしない。
- T10/T11の行政・噂動線、T16避難、T17警備迂回を同じ街路へ反映。時間帯・事件選択はレビュー用snapshotの切替であり、実ゲームのイベント進行ではない。
- 門外に既存の物流・農地・沿道要素を置き、R06/R11/R12/R13へ同じシーン内で歩く。envelope全域を高密度建築で埋めていない。

## 共有実装の場所

| ファイル | 責務 |
| --- | --- |
| `capital-data.js` | 正本対応、地形、道路、地区、建築、空白、fixture |
| `capital-routing.js` | 状態別経路、非破壊的polyline、進行方向の距離/上り |
| `capital-surfaces.js` | 地形・道路・橋・屋根・広場の足元高さ |
| `capital-spatial.js` | swept歩行、建築/川/壁/封鎖、社会境界、視線 |
| `capital-traffic.js` | 同じ道路の時間帯別/事件別代理NPC |
| `capital-scene.js` | Babylon描画、自由歩行・経路歩行・診断 |
| `review.js` | 2D、経路選択、人流・空間価値表示 |

自由歩行1.4m/s、Shift4.5m/s。経路レビューの8x/32xは明示した時間早送りで、距離や足元の物理処理を省略しない。`?audit=1` の `__capitalAudit.advance(seconds)` も同じswept歩行を使用する。

## 検証結果と再現方法

Node: 王都23件＋世界地図13件、計36件通過。全edge・8要求経路の物理通過、32通りの事件/天候組合せの接続、複合増水+T10の物理通過、視線、非破壊的再描画、屋根・川・橋・社会境界、人流を含む。

```sh
node --test test/capital-review.test.mjs test/world-blueprint.test.mjs test/world-blueprint-ecology.test.mjs
for file in public/capital-review/*.js tools/trpg-world/*.mjs; do node --check "$file"; done
```

実ブラウザ: Windows Edge/Playwright、WebGL SwiftShaderの実Babylonレンダラーで14経路完歩、5つの事件・増水迂回完歩、3時間帯を確認。要求8経路に加え、下層南側、4門外接続、屋根接続を含む。30秒ずつ診断時間を進め、連続した眼高位置・距離・遮蔽を採取し、始点/途中/終点の実画面を観察した。実時間で数時間の手動操作をしたという意味ではない。390pxのviewport表示・タッチも確認したが、実iPhone実機検証ではない。JS pageerrorなし。

```sh
# ルートURLを指定する（末尾 /capital-review/ はCLIが付与する）
node tools/trpg-world/audit-capital-browser.mjs --url=http://localhost:9893 --out=/tmp/capital-qa --playwright=/path/to/playwright/index.mjs --browser=/path/to/msedge.exe
# 公開後も同じCLIで --url=https://siranui.jp を検証する。
```

`qa/capital-pass-3/summary.json` は実測経路・時間帯・遮蔽の記録。PNGは実レンダラーの記録で、最終アートではない。

## デプロイ・再開手順

branch: `feat/capital-level-design-pass-3`。main直編集なし。PRのCapital Review CIで同じNodeテストと構文を確認後にマージする。

VPSは必ず状態を再取得する。`git fetch origin main` → dirty/untracked一覧と `git diff --name-only HEAD..origin/main` を比較 → 競合がなければ `git merge --ff-only origin/main`。reset/clean/stashは禁止。既存dirtyはTRPG manifest・simulation report類、untrackedにもユーザー成果物がある。内容を上書きしない。

Expressは `public` をリクエストごとに読む静的配信であり、この変更ではjudgement-ai再起動不要。stage-linebotには触れない。HEADとorigin/main一致、公開JSのpass-3バージョン、公開経路監査、world-blueprintを確認する。

## 残る課題・次に行う具体的作業

1. 物理通過・遮蔽が成立しただけでは「歩いて楽しい」の証明にはならない。特に長い門外街道と市場への物流軸について、ユーザーの通常速度プレイで退屈区間・迷い・発見を記録する。今回の遠景/曲がり/空白の記録を基準に評価する。
2. 代理NPCは群衆回避・荷車との接触待ち・本番一日scheduleをまだ持たない。共有graph/surfaceを保ち、朝の駅馬車混雑と市場の交錯を本編の通行優先・回避へ接続する。
3. 騒音、照明、植生の地区profileは将来契約も含む。地区別の音源・夜間照明すべてを実装済みとは扱わない。
4. NavMesh、本編事件アダプター、施設内部、セーブ、広域atlasから本編への連続ロードは別工程。今回の門外連続性は制作レビュー内で成立している。
5. 次の都市へは建物数をコピーせず、正本から都市node/edge、生活・物流、視線回廊、空白、状態別経路を定義し、同じ物理通過・遮蔽・複合状態の契約を先に検証する。

## 作業状態の再確認

[2026-10-01のGit・プロセス・本番再検証と成果保全](CAPITAL-WORK-STATUS-2026-10-01.md)を参照。
