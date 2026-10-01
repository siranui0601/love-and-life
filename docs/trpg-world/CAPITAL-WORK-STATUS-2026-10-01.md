# 王都作業状態 — 2026-10-01

確認時刻: 2026-10-01 23:35:00 JST。これは確認時のsnapshotである。

## Git・公開状態

- 開発branch: feat/capital-level-design-pass-3
- 今回確認開始時の開発HEAD/リモートHEAD: 7b6ea4a424100c868376849586210ebd311f5df5
- 確認開始時のGitHub main / VPS main / origin/main: 9be98c2567760e11db20e34b9ae17b67eeb0aa0b
- PR #332はマージ済み。制作コードに未コミット差分はなかった。
- 未追跡のうち、変更前画像と本番監査のJSON・主要画面をqa/capital-pass-3/baseline、production、production-currentへ保全した。
- 重複sync JSON、調査用probe、作業用スクリプトは一時ファイルとしてWindows作業フォルダに保持。削除していない。

## 再検証

- 王都23件＋世界地図/生態13件、36テスト再通過。
- 公開9ファイルは検証済みローカル内容とbyte一致。
- 公開ブラウザ監査: 2026-10-01T14:32:52.130Z、14経路完歩、5事件/増水迂回完歩、朝昼夕3状態、390px表示/タッチ、JS pageerrorなし。
- 同じ歩行/衝突処理を診断時間で早送りした結果。通常速度での主観的遊び心地や実iPhone検証まで済んだとは扱わない。

## プロセス・ユーザー成果物

- 作業のテスト・ブラウザ監査は終了。親だけ終了して残っていたpreview.cjs子PID33496を、command lineが本作業のファイルであると確認して停止した。port9893のlistenも解除。
- その他のWindows Node/Edge、VPS稼働プロセスは変更していない。judgement-ai/stage-linebotの再起動なし。
- VPSのユーザー所有dirtyはTRPG manifest・simulation report・player-latest.mdの3ファイル、untrackedも従前の一覧と一致。王都作業とは別のためstage/commitしない。
- 3dirtyファイルの差分SHA256: fdb95a3f5b15cdca2cd95e4108bd43e6e6d8189945a9def3bfcb10719e4ffe21（前回更新前後・今回で一致）。

## 残る工程

今回のpass 3の実装・PR・CI・main反映・安全なVPS反映・公開確認は完了。今回の追加は検証成果の保存のみ。次の開発は通常速度での退屈区間/方向回復のプレイ評価、NPC群衆回避・本編schedule接続、NavMesh/施設内部/事件アダプターである。詳細はCAPITAL-LEVEL-DESIGN-PASS-3-2026-10-01.mdを参照。
