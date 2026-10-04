# 王都 Pass 7 引継ぎ

都市完成ではなく、生活庭の空間改善を検証した段階。

- 実装PR340 merged。都市コードmain/VPS: 1aa5f1b316a36fd6c24e4eec7a26366c58bc0235
- URL: https://siranui.jp/capital-review/
- 全14主要+9micro+3門外経路、事件/増水5経路、朝昼夕。本番errors 0。配信ソースのbyte一致確認済み。
- 56 tests、通常街路/橋20%・広域粗路25%の勾配監査1645道路、違反0。
- 76生活庭、二つの入口、4棟共通形状、庭向き窓/扉、低い奥棟、腰掛け、住宅庭木。3地区住民の往来とT16避難を同じgraphに追加。
- 成果物: qa/capital-pass-7/premerge と production。source-hashes.jsonで都市コードの一致を照合可能。
- Authoritative worktree: C:\Users\inaba\capital-pass-4。QA branch: feat/capital-pass-7-production-qa。ローカルscratchの同名実装branchはcheckpoint履歴が異なる。force pushしない。
- VPS dirty tracked3 /untracked102保持、dirty hash fdb95a3f5b15cdca2cd95e4108bd43e6e6d8189945a9def3bfcb10719e4ffe21。restartなし。

## 未完了の都市品質

1. 斜面の長い石段を短いflightと踊り場に分け、擁壁/手摺/横道と同じ物理形状へ統合。最大の高低差だけで評価しない。
2. 俯瞰の王城高台は、地区の段丘輪郭と崖面がまだ弱い。街路勾配を守りつつ、高所の権力軸を街区断面で示す。
3. 低屋根歩廊を実際の建築の入口/出口へ統合。
4. 河岸の物流庭と橋詰の人車交錯、地区ごとの断面/活動差を深める。
5. 全体完成は画像と歩行体験から別途判断。テスト・PR完了を都市完成へ読み替えない。

QA記録のみのmain更新後は最新SHAをGitHubとVPSで再照合する。実行中プロセスを再確認し、独自previewのみidentity確認後停止する。

## 次の石段断面の実測候補

| edge | 地区 | 水平長 | 上り |
|---|---|---:|---:|
| fabric_lane_217 | 市場 |159.32m|29.89m|
| fabric_lane_148 | 行政 |153.45m|29.70m|
| fabric_lane_44 | 貴族 |179.81m|30.70m|

上記は連続石段の形状改善候補。既存の勾配上限テストを弱めず、歩行面・描画・横道接続を共通の踊り場断面へ変更して目線比較する。
