# 王都 引継ぎ 2026-10-03 (JST)

## 実装と公開

pass 5実装branch: `feat/capital-street-terrain-pass-5`。最新feature commit: `489154bb7328429c385599b0cff26421cc2975f5`。PR #336はCI成功後にmerge済み。実装のmain merge / VPS反映SHA: `ff4db8575e618410d2e56baa116ae9d3f4630d2d`。

本番証拠のbranch: `feat/capital-pass-5-production-qa`。この文書・本番監査・deployログを追加するのみで、都市の静的ソースはPR #336のものを保持する。最新main/branchのSHAはGitHubで実確認すること。

公開URL: https://siranui.jp/capital-review/ と https://siranui.jp/world-blueprint/。

## 完了した内容

非対称の城丘5段、擁壁と横断石段、等高方向の生活街路、下層の裏道回遊、両岸歩廊を実物理graphへ接続。建築散在を街路前面の敷地配置へ変更。道路交点は同じjunctionを持ち、孤立路地を除外する。河床を一定datumに保ち、広域水面の粗地形被覆と橋詰の断面を修正。

分割街路に重複して置かれていた事件検問柵、同一endpoint選択の経路エラー、石段と坂舗装の描画交差を修正。正本ID・事件・社会通行条件・NPC共有graph・world接続を維持。PR #332/#333の3件のP2は解決済みであり、今回も低FPS・経路消失・正しい監査JSON位置を検証した。

## QA

49テスト成功。主要14経路＋下層裏道・段丘石段・河岸の3経路をBabylon/WebGLで連続歩行。増水/T10/T11/T16/T17の5経路も完歩、朝昼夕の表示も確認。歩行診断時間は加速しており実時間の全経路踏破ではない。最終石段修正後も全監査を再実行しエラー0。

検証手順とデータは `CAPITAL-STREET-TERRAIN-PASS-5-2026-10-03.md` と `qa/capital-pass-5/{premerge,production}/`。本番結果の成否は保存した `browser-audit.json` と `verify-public.txt` が証拠。本番確認コマンド: `node tools/trpg-world/verify-capital-public.mjs`。

## VPS保全

`tools/trpg-world/deploy-capital-vps.py` を専用SSH経由で実行。dirty/incoming重複0を確認したff-only反映。tracked dirty 3ファイル、untracked 102ファイルを保全。dirty SHA256 `fdb95a3f5b15cdca2cd95e4108bd43e6e6d8189945a9def3bfcb10719e4ffe21` が反映前後一致。静的配信のためjudgement-ai再起動なし。stage-linebotとユーザー既存worktreeに変更なし。

## 未完了と次の具体作業

これは最終美術都市ではない。次は生活街路の代表点を自由歩行し、曲がり角の見通し・入口と中庭の認識・段丘の休息着地・橋の進入景観を人の目で評価する。現在の生活路は実接続されているが、全路地を一つずつ目視評価したわけではない。

地区polygon境界に頼らない地区判定、道路近接時の複数街区の接合、地形へ埋まる低屋根の景観、断面が急な石段のlandingを次の重点とする。路地の価値を時間・安全・情報・景観・事件避難で分類し、NPC scheduleはこの共有道路上へ乗せる。本番AI・NPC schedule・最終素材・河岸荷役アニメーションは未実装。

Windows作業worktree: `C:\Users\inaba\capital-pass-4`。プレビュー・失敗QA・同期補助スクリプトは未追跡で保持されるが、正しい完成ソースと受入証拠はGitへcommit/pushされている。無関係な未追跡ファイルをcleanしない。
