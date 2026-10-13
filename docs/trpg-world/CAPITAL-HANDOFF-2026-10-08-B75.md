# 王都 Blender再設計 引継ぎ — 2026-10-08 B75

作成日時：2026-10-08 22:23 JST以降。ユーザーの会話上限に伴う引継ぎ。これは完成報告ではない。

## 0. 次の担当者へ：最初に読むこと

既存TRPGオープンワールドRPGの王都を、Blenderで根本から再設計している。ユーザーは何度も「テストは通るが、求める都市・歩行体験になっていない」と指摘している。既存コード・建物数・合格テストを守ることが目的ではない。街を歩いて発見があり、高所の王城を頂点とする巨大な城郭都市として読めることが目的。

現在のBlender B75も**未完成・未受入**。本番の `/capital-review/` とBlender新設計は同じものではない。新設計のWebゲームへの移植、実際のプレイヤー操作による全経路検証は未完了。本番を見てB75の状態と判断しないこと。

直近は、孤立した小さな鍛冶場案を見直し、普通の住宅敷地14件を除いて、街路に面した80×88mの職人複合街区へ置き換えた。その東側にはまだ約1.07万m²の大きな残余地がある。ここを測量したところで、引継ぎ依頼を受けた。**東側残余地の新実装はまだない。**

次のワークでは説明や確認質問で停止せず、下記の現状確認→資料読解→敷地・街路の設計→実装→目線と俯瞰の確認を進める。正本と衝突する新設定だけはユーザーに確認する。

## 1. ユーザーが次のワークへ渡す資料

### 必須

1. この引継ぎMarkdown。
2. Deep Research PDF最新の(5)：`TRPG世界の地域設計・レベルデザイン・実装優先度に関する調査報告(5).pdf`。表示上の濁点表記が分離していても同じ資料。古い(2)〜(4)を全部添付する必要はない。
3. 王都完成イメージの2枚：`40CE1E82-F1DA-4FC5-A6AE-87DF748F821C(2).jpeg` と `86EAE026-6D6D-42ED-AB79-1C22B02CDAF3(2).jpeg`。同じ画像の(1)でもよい。高台の大城郭、積層市街、川と橋、密集した屋根、城外農地が描かれた2枚。単なる美術スタイルではなくmacro/meso都市構造の主要参考。
4. 正本スプレッドシートのURLと、必要ならGoogle Drive/Sheets連携。画像だけでは正本を代用できない。

正本URL： https://docs.google.com/spreadsheets/d/15slftR2b-76VKaUqTisYolhN1iCpHeB7asUBoyMnmRk/edit

### 補助（不足箇所を伝えるために有用）

- `image(20261007-142849).png`：危険に見える壁上スロープ、王城〜魔術塔側の空白への指摘。
- `image(20261007-101608).png`：街路沿い建築だけを置いた結果の不自然な内部空白への指摘。
- 最新B75の `Craft-block-context.png` と `Craft-block-rear-eye.png`。GitHubの `docs/trpg-world/qa/blender-b75/` に保存済みなので、PC/GitHubへ接続できれば再添付は不要。
- 最新 `.blend` はWindowsに保存済み。Remote Desktop Commanderに接続できれば毎回添付不要。接続できない場合は `design-b75` の計画JSON・敷地JSON・blend等も渡す必要がある。

PC「さつまあげ」を起動し、Remote Desktop Commander連携を利用可能にしておく。秘密鍵は添付しない。

## 2. GitHub・保存状態

- Repository：`siranui0601/love-and-life`
- 作業branch：`feat/capital-terrain-streets-pass-8`
- Draft PR： https://github.com/siranui0601/love-and-life/pull/342
- 本引継ぎ作成直前の最新HEAD：`c0c214220acc05b09eca9b95d09e0ca6a727c367`
- 上記はB75の実Blender画像とQA JSONを保存したcommit。
- その前の実装commit：`85f60293579a11bf265b77956b5afa16dde563ed`。
- さらに前：`2ce13af6465b0b65cc5c51da4b9963fb5251c007`（B71/上部見晴らし塔）、`392614fdac6bd71d8b03d9eca996b74914a3db9f`（B62）。
- `c0c2142`のCapital Review CI：run69、ID `37779993980`、**completed / success**を引継ぎ時に確認。
- この資料と東側測量JSONの追加によりHEADはさらに進む。必ずbranchの最新HEADを取得し、保存済み資料を含むtipから作業する。古いmainから作り直して作業branchを失わない。
- 今回のBlender作業でmain merge/VPS反映はしていない。本番HEADは今回再取得していないので不明。推測で「mainと一致」と報告しない。

ローカルscratch clone：`/workspace/scratch/e4d8602957e3/capital-pass-8`

これは古いHEAD `e52669a99286353c05ab404243abf7dc93e417e4`。sourceは手動更新、GitHubの最新保存はAPI経由。**local HEADだけで進捗を判断しない**。scratchは消える可能性がある。

既存dirty（ユーザー所有として保護、無関係なstageをしない）：

- `docs/trpg-world/qa/capital-pass-6/release/grade-audit.json`
- `docs/trpg-world/qa/capital-pass-7/premerge/inn-castle-middle.png`
- `docs/trpg-world/qa/capital-pass-7/production/micro-courtyard-ajin-end.png`
- 他に未追跡のBlender scripts・作業報告・ログがある。GitHub保存済みの同名ファイルもあり、未追跡＝未保存とは限らない。

既存作業場所をreset/clean/stashしない。必要なら別clone/worktreeでGitHub最新branchを取得し、差分を確認して進める。`__pycache__`はcommitしない。

## 3. Windows・Blenderの現物

Device：さつまあげ / `12fb6d7b-f35b-4020-a95f-6b1f2d2c8cb5`

| 用途 | パス |
|---|---|
| Windows作業repo | `C:\Users\inaba\capital-pass-8-review` |
| scripts | `C:\Users\inaba\capital-pass-8-review\tools\trpg-world\blender` |
| Blender 5.2.2 LTS | `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` |
| bundled Python | `C:\Program Files\Blender Foundation\Blender 5.2\5.2\python\bin\python.exe` |
| Shapely dependencies | `C:\Users\inaba\Documents\TRPG-Capital-Blender\python-deps` |
| B75全体データ | `C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b75` |
| 保存済み統合モデル | `design-b75\capital-parcel-review.blend` |
| GUI確認用の別コピー | `design-b75\capital-discovery-review.blend` |

統合モデル約44.38MB。GUI確認コピーは職人街区を見やすくフレーミングした別ファイル。

引継ぎ時に実際に動作確認したBlender：

- **PID9244**：`* capital-parcel-review ... design-b23 ...`。先頭`*`＝未保存。絶対に閉じる・上書きする・終了させるな。
- **PID38304**：`capital-discovery-review ... design-b75 ...`。今回別ウィンドウとして開いた最新版。
- PIDは次回変わりうるので再確認する。

Windows repoのGit HEADも古い。scriptsの最新版はGitHubbranchと比較する。`tools/trpg-world/blender/README.md`冒頭の「インストール待ち」は古い記録で、現状はBlender導入済み・稼働済み。再インストールしない。

版ごとの `.blend`、`plan.json` を上書きしない。生成scriptsは同名の既存出力を拒否する。新設計は空いている番号の別 `design-bNN` を作る。B76を使う前に存在確認。

## 4. 正本とユーザーの設計要求

優先順位：スプレッドシート正本 ＞ Deep Research PDF ＞ 現在実装 ＞ 画像。ただし画像は都市構造の要求として尊重する。画像の施設名や文化をそのまま正本へ追加しない。

固定ID：`LOC_CAP_CASTLE`, `LOC_CAP_MAGE_TOWER`, `LOC_CAP_LOWER_INN`, `LOC_CAP_MARKET`, `LOC_CAP_WEAPON_SHOP`, `LOC_CAP_APOTHECARY`, `LOC_CAP_ORPHANAGE`, `LOC_CAP_BIG_STORE`, `LOC_CAP_OFFICE`, `LOC_CAP_NEWSPAPER`, `LOC_CAP_STABLE`, `LOC_CAP_AJIN_QUARTER`。

T10失敗後大型店は孤児院と同じ敷地を再利用する。T10/T11/T16/T17は同一都市の封鎖・捜査・避難・噂・警備・社会ゲート・人流変化として扱う。専用事件ステージを作らない。

王城＞魔術塔＞門/橋/市場＞地区固有目印の視覚階層。王城は北のnodeではなく、地形・社会階層・街路の頂点。低地14m、行政側42m、魔術塔段丘70m、貴族78m、上層112m、城前156m、城204mの現設計。ただし**高さの数値があるだけでは合格ではない**。

地形・擁壁 → 壁沿いの階段/折返し/荷車用坂 → 幹線/生活路/サービス路/裏道 → 閉じた街区/敷地 → 地区らしい建物の順。平地に同じ家を列状に並べるだけでも不十分。階段と坂の途中に休憩、曲がり、再展望、別経路を作る。

小さい隙間に施設を押し込む必要はない。**普通の住宅や道路を消して再構成してよい**という明示許可あり。ただし正本施設、事件、到達性を守り、旧経路の変更は根拠と代替経路を記録する。

巨大空白を建物で埋めるだけは禁止。公園・市場・作業場・墓地・物見・裏露店等を、周囲の生活/物流/探索/事件との関係から設計する。全て高速近道にせず、情報・景観・安全性・NPC接触の価値を分ける。

NPCはプレイヤーと同じ物理graph。塔/階段/昇降機は実際に接続し、ワープで解決しない。荷車用の昇降機や地形内の坂もユーザー提案に含まれるが、輸送の全経路と操作を実装して初めて機能する。

core約6.5km²を密集都市として構成し、外側activity envelope約22km²で徐々に疎にする。相似拡大に戻さない。通常歩行1.4m/s、Shift約4.5m/s。巨大さをカメラの広角だけで演出しない。

### 直近に正本から読んだ根拠

2026-10-08に総合設計書、王都等を連携で範囲読取済み。次回は関係箇所の現行内容を確認する。

- 総合設計書117付近：建築機能・文化・素材・階級・気候・防衛・歴史が形や配置に現れる。鍛冶場/宿/市場/役所等は外観と周辺から用途が分かること。
- 総合設計書15付近：店/宿/ギルド等をUIだけで済ませず物理空間へ。ただし特定の王都ギルドの制度は未確定。
- 王都21付近：正本武器店、T09失敗でドワーフ供給減、T14失敗で粗悪品増。職人街区の修理・受注・品質検査という用途の根拠。
- 市場にはT02食料、T06物流。T11王族暗殺/戒厳、T16差別/避難、T17召喚事件調査。
- `LOC_CRIME_SLAVE_MARKET` は犯罪都市。王都へ勝手に移さない。
- 火葬の世界観・制度は未確認。墓地案も宗教・固有人物・葬儀慣習を創作して正本化していない。
- 世界史の古代魔術・宗教の秘史を、公共の看板などで勝手にネタバレしない。

## 5. B75で実装済みの内容

### 職人複合街区

- 元街区 `low_city_852` の実ポリゴン・街路から80×88m=7040m²を確保。
- 普通の住宅敷地14件、旧敷地面積1630.803m²を除去。正本施設は未移動。ID一覧は `craft-block-study.json`。
- 大通り側の受注/展示2棟、左側の長い開放鍛冶場（炉2、煙突2、金床、冷却槽）、右側の資材倉庫、奥の組立/サービス棟。
- 7mの表入口：`low_city_contour_1` 接続。
- 6mの裏搬入路：`low_city_contour_1_frontage_east_quay_gate` 接続。奥棟に実8m開口。
- 中庭の荷車通路と3.2mの歩行回遊路、各作業場への枝道。
- 敷地/アプローチを `negativeSpaces` と `programmedSpacesStudy` に登録して再建築から保護。
- 正本武器店を移したものではなく、現地工芸/修繕の形態提案。公式ギルド・NPC・経済/事件stateは未追加。

実画像確認：建築用途とまとまりは以前より明確。裏口から小見晴らし塔と魔術塔段丘が見え、方向を回復できる構図がある。一方、作業中庭がまだ疎で、周囲の住宅が反復的、東側に大きな残余地がある。最終アートではない。

### 保持した他の要素

- B62全市街、壁沿いの主階段2系統、孤児院と宿の実敷地、街区内部補修2回分。
- 王城貨物昇降機：156→204m、8×9m台、対重/上下接岸のレビュー用animation。**runtime操作と輸送は未実装**。
- 北側庭園の歩行ループ、東側墓地案80×60m、庭園の小塔18m。
- 中央市場15屋台、裏庭市場6屋台、孤児院裏道。
- 魔術塔段丘の小見晴らし塔36m。実階段25flight、折返し、上部床接続を修正済み。王城/魔術塔の測定視線あり。
- 小塔のIDは `mage_river_watchtower` だが、実測では川は見えていない。名前を根拠に川の展望地点と報告しない。

## 6. B75の検証結果と限界

保存場所：`docs/trpg-world/qa/blender-b75/`

| 検証 | 結果 |
|---|---|
| 通常graph | 1127 routes、1 component |
| 増水graph | 1126 routes、1 component |
| 実mesh胴体高さのray | 258545 probes、遮断0 |
| 路面サンプル | 18741 samples、失敗0 |
| B52比較 | 669 baseline routesと正本物理敷地/事件metadataを保持 |
| 大きな残余地 | 31箇所、計72339.25m² |
| 残余地総面積 | 対象低地/行政/魔術塔側で670602.91m² |

`connectivity-audit.json` の成功相当statusは `REQUIRES_3D_REVIEW`。完成証明ではない。胴体rayは連続capsule、頭上、荷車旋回を保証しない。床は全フレーム連続検査ではない。正本物理敷地比較も、全12施設のゲーム内到達性認証ではない。UI/手動歩行/WebGL、事件・社会ゲート・NPC生活は別途必要。

`discovery-vista-audit.json` は実meshへの限定的な点視線診断。小塔から城と魔術塔は見えるが、河川16サンプルは0可視。ランドマーク全体の見え方や散策の楽しさは画像・実歩行で別評価する。

保存QA：`blender-floor-audit.json`, `blender-width-clearance.json`, `discovery-preservation-audit.json`, `discovery-vista-audit.json`, `craft-block-study.json`, `connectivity-audit.json`, `connectivity-flood-audit.json`, `residual-inventory.json`、俯瞰/裏口目線2PNG。

## 7. 次に着手する場所と未解決問題

### 直前まで測定していた場所

東側残余地：`low_city_852`、10673.38m²、中心 `[1306.78858, 1.13009, 14]`、内接半径32.27m。鍛冶街区の外側。

測量結果 `east-survey.json` には周辺街路26件、敷地、実街区形状、予約敷地、地形domainを格納。Windows B75フォルダとGitHub QAに保存する。**測量のみ。ここに新施設はまだ作っていない。**

元街区の範囲：約x1159〜1494、y-95〜74。北側生活路 `low_city_contour_1`、南東に `east_quay_gate` とその沿道経路、さらに `east_gate_market`。近くに `mage_civic_ramp` の下端。鍛冶街区の表と裏を結ぶ物流/修繕/荷解き、一般歩行の選択を周辺街路と一緒に設計する。広大な土地を丸ごと「公園」と命名して欠陥を消した扱いにしない。

他の大きな残余地：

| block | 面積m² | 中心x,y,z |
|---|---:|---|
| low_city_580 | 8335.78 | 728.50,768.66,14 |
| low_city_792 | 7211.70 | 1056.12,21.53,14 |
| low_city_816 | 6785.55 | 1158.92,71.73,14 |
| low_city_441 | 3220.05 | 115.85,138.91,14 |

### 優先度の高い未完了

1. 街区内部を道路・用途・建築のまとまりとして再編。単体小物を置いて数を増やさない。
2. `civic_royal_ramp` 等、残る貨物坂4系統の形態。巨大な露出loop/盛土benchは不自然。壁沿い・地形内・階段・実輸送経路を再検討。
3. 巨大で無表情な擁壁面と長く単調な階段。人の目線の圧迫/休憩/展望/折返し/枝道として組み直す。
4. 川・橋・河岸からのvista、物流、段差、増水時の意味。川の展望が取れない小塔を「解決」と扱わない。
5. 地区固有の建物形/庭/入口/素材/高さ/生活の差。周囲の家がまだ繰返しに見える。
6. NPC生活とプレイヤーの干渉、事件時の変化、身分/許可による社会ゲート。
7. Blenderの形態をゲーム側へ移す方法、collision、階段歩行、荷車/昇降機、ロード/描画性能。
8. 実目線・俯瞰・主要全経路の手動歩行。テストと固定カメラだけで合格しない。
9. 全体品質確認後にPR/CI/main merge/VPS安全更新/公開検証。現時点ではDraft維持。

## 8. 生成・検証の実務

現行B75は **B62 → author-upper-lookout.py → B68 → author-craft-block.py → B75**。B71小鍛冶場から拡張したものではない。B71と重ねると重複するので注意。

主なscripts（すべて `tools/trpg-world/blender/`）：

- `author-craft-block.py`：敷地選定、14住宅削除、表裏路と職人工房生成。
- `author-upper-lookout.py`：上段小塔、階段、deck接続、予約敷地。
- `build-city-b.py`：planから地形/街路/構造物を生成。出力 `capital-city-b01.blend`。overview等もrenderする。
- `build-parcel-review.py`：そのblendを開いてparcelsを追加、`capital-parcel-review.blend` 保存。
- `render-discovery-review.py`：実統合モデルから目線/俯瞰画像。元blendを上書きしない。
- `prepare-discovery-layout.py`：別GUI review copy作成。既存出力を拒否。
- `audit-city-b.py`：通常/`--flood` のgraphと階段断面。
- `audit-blender-width.py`, `audit-blender-floor.py`：実mesh検査。
- `audit-discovery-preservation.py`：B52等のbaselineと新設計比較。
- `audit-discovery-vistas.py`：実mesh視線。
- `measure-block-residuals.py`：残余地。意図的空間の登録＝受入合格ではない。

PowerShell実行例（新しい出力フォルダにのみ生成）：

```powershell
$root = 'C:\Users\inaba\Documents\TRPG-Capital-Blender'
$scripts = 'C:\Users\inaba\capital-pass-8-review\tools\trpg-world\blender'
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$py = 'C:\Program Files\Blender Foundation\Blender 5.2\5.2\python\bin\python.exe'
$env:PYTHONPATH = "$root\python-deps"
# 接続/階段診断。生成前にscriptの引数を読むこと。
& $py "$scripts\audit-city-b.py" "$root\design-b75\plan.json"
& $py "$scripts\audit-city-b.py" "$root\design-b75\plan.json" --flood
# Blenderにbundled依存を混入させない
$env:PYTHONPATH = $null
& $blender --background "$root\design-b75\capital-parcel-review.blend" --python "$scripts\audit-blender-width.py" -- "$root\design-b75\plan.json"
```

既に検証済みの同一モデルを無意味に全再検査しない。変更点に関係するriskから検証を広げる。Blenderのscript tracebackがあってもプロセスexit0の場合があるので、ログ/JSONを読む。

### 実装上の注意

- `author-backcourt-market.py` は現状予約negativeSpacesを十分に登録していない。全域再parcel化する前に既存の著作者配置を保護する。
- `repair-block-interiors.py` の無差別再実行は避ける。既存工房/塔/市場/正本plotを敷地生成が侵食しないことを確認。
- preservation testは旧669路の完全保持を要求する。ユーザーは普通の道の改変も許可しているので、必要な再編は変更理由・旧新対応・代替到達性を明示して監査設計を改める。テストに合わせて不自然な道を温存しない。
- Windows Pythonの複雑な処理は `.py` に書いて実行。PowerShellの複雑な `python -c` quotingは壊れた実績あり。
- Remote toolがrunning/call_id/PIDを返したら状態を確認し、同じ生成を重複起動しない。
- この会話のtool storeやscratchファイルの存続を前提にしない。GitHubとWindows保存物が引継ぎの基準。

## 9. VPS運用（今は公開しない）

VPS：`ubuntu@153.121.58.71`、app：`/home/ubuntu/apps/judgement-ai`

公開： https://siranui.jp/capital-review/ 、 https://siranui.jp/world-blueprint/

Windows SSH：`C:\Program Files\Git\usr\bin\ssh.exe`、鍵ファイル `C:\Users\inaba\.ssh\siranui_codex_ed25519`。鍵の中身を読まない/表示しない/添付させない。

VPSにはユーザー所有dirty/untrackedがある。禁止：`git reset --hard`、`git clean`、stash、未コミット削除、無関係上書き。更新するときはfetch→dirtyとincomingのpath比較→非競合を確認→`git merge --ff-only origin/main`。stage-linebotなど他processには触れない。静的更新だけならrestart不要か確認する。

## 10. 次ワークへ貼る開始文

> 添付の「CAPITAL-HANDOFF-2026-10-08-B75.md」を読み、王都Blender再設計を継続してください。参考画像2枚は都市形態の基準で、Deep Research PDFとTRPGスプレッドシート正本も設計判断に使ってください。GitHubは siranui0601/love-and-life、作業branch feat/capital-terrain-streets-pass-8、Draft PR #342です。B75と未保存B23を保護し、最新branchとWindowsの実ファイルを確認してください。まず職人街区の東側残余地の測量結果から再開し、周辺街路・物流・探索の意味を持つ街区へ再構成してください。必要なら普通の家や道を作り直して構いません。テスト合格だけで完成扱いせず、Blenderの実目線と俯瞰を確認し、危険に見える残存スロープや巨大擁壁、川の体験も改善してください。既存の正本施設IDと事件を保持し、コードと検証画像を作業branchへ継続保存してください。
