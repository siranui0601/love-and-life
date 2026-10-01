# 王都 Pass 4 引継ぎ
都市形態実装は PR #334 で main へマージ済み。実装branch: feat/capital-urban-morphology-pass-4、実装HEAD: 4ab834d02d4592aa9220e8510826bf1c1ac5d3ef。公開実装main/VPS HEAD: 1daa8a0afe0054f0b3b65663704ab1fc626e3900。後続のproduction監査PRは資料のみで、配信実装は同一。

## 完了
添付2画像と23頁PDF、旧公開2D/3Dの比較から15項目の不足を整理。高台王城群、密集街区、段丘、街路前面、等高回遊、中庭、物理屋根/階段/河岸/壁沿い、屈曲水系、門圧縮と城外低密度を実装。Urban FormとTopology/Debugを分離。正本12ID、T10用地、4事件、NPC共通道路、世界接続を維持。3件の既存P2を修正し解決。

44テスト成功、Capital Review CI成功。本番 https://siranui.jp/capital-review/ で14経路、8状態のBabylon/WebGL連続歩行成功。経路消失停止、10FPSの1秒1.4m、道路描画/物理面一致、モバイル、world-blueprintを確認。記録: qa/capital-pass-4/production/browser-audit.json。

VPSはincoming31ファイルとdirtyの非競合を確認してff-only。未コミット3ファイル/未追跡102ファイルと差分hash/metadata保持を検証。reset/clean/stash/削除なし、restartなし、stage-linebot操作なし。Windows原作業ツリーの未コミット内容も変更していない。専用worktree: C:\Users\inaba\capital-pass-4。作成した一時同期スクリプトと各QA作業ディレクトリは消さず保存。

## 再実行
node --test test/capital-review.test.mjs test/capital-clock.test.mjs test/capital-morphology.test.mjs test/world-blueprint.test.mjs test/world-blueprint-ecology.test.mjs

node tools/trpg-world/verify-capital-public.mjs

実ブラウザ監査と安全VPS手順は CAPITAL-URBAN-MORPHOLOGY-PASS-4-2026-10-02.md と tools/trpg-world/audit-capital-browser.mjs / deploy-capital-vps.py を参照。秘密鍵内容は読まない。

## 次の工程
実装・公開パイプラインは完了。都市は最終美術ではなく歩行検証greybox。次は通常速度での人による長時間プレイレビューから、迷い/退屈/ランドマーク回復の質を追加評価する。レビュー用の時間帯NPC流量を本編schedule/群衆回避へ統合し、事件・saveとの本編接続を行う。正本にない施設は追加しない。都市形態変更を他都市へ展開する際も道路だけ先に引く方式に戻さない。
