# TRPG（仮題）統合プレイヤーシミュレーション v2

- 生成: 2026-07-17T12:31:23.794Z
- seed: `trpg-player-v2-20260717`
- プレイヤーrun: baseline 28 + tuned 28
- 参照: 19トラブル / 103地域内施設 / 76エンカウント / 1141スキル
- 品質判定: PASS（blocker 0, warning 1）

## 調整後の結果

| 方針 | 到達Lv | 初LvUP | 戦闘数 | 勝率 | 常駐任務 | 特別任務 | 解決T | 地域内/間移動 | フラグ/イベント技能 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 均衡型 | 16 | Day1 | 207 | 24.6% | 21 | 15 | 15 | 30/30 | 2/15 |
| 事件調査型 | 16 | Day1 | 234 | 22.6% | 21 | 15 | 15 | 30/30 | 9/15 |
| 戦闘優先型 | 13 | Day2 | 200 | 100.0% | 9 | 0 | 0 | 0/0 | 5/0 |
| 探索優先型 | 16 | Day1 | 200 | 21.2% | 23 | 14 | 14 | 171/52 | 3/14 |
| 商人型 | 8 | Day1 | 0 | 0.0% | 11 | 0 | 0 | 37/10 | 0/0 |
| 生存優先型 | 16 | Day1 | 228 | 21.2% | 21 | 15 | 15 | 30/30 | 2/15 |
| ランダム有効選択型 | 13 | Day2 | 178 | 100.0% | 9 | 0 | 0 | 0/0 | 5/0 |

## ミッション構成

- 常駐ミッション定義: 24件、8系列。初期に同時表示するのは8件。
- 特別ミッション: 19件（トラブルと1対1）。
- 常駐EXP総量: 4530 / 特別EXP総量: 2080
- 通常プレイ群で解決されたトラブル: 16/19

## スキル取得監査

- フラグ解禁定義: 436件（Lv以外の条件を持つもの 436件）
- イベント付与定義: 325件（構造化grantConditionsあり 325件）
- 装備付与定義: 162件
- 実プレイで取得: フラグ解禁 17種 / イベント付与 16種 / 装備付与 5種
- 条件不成立取得: 0件
- 静的に到達不能: 0件

## トラブル解決プローブ

- プレイヤー行動列だけで 19/19件を解決。
- 失敗: なし

## 検証項目

1. **DAY100_REACHABILITY**（verified）— Day100到達率 100.0% (28 runs)
2. **ACTION_CAP**（verified）— 最大行動数で停止したrun 0
3. **MOVEMENT_AVAILABILITY**（verified）— 地域内外の移動不能回数 0
4. **CHOICE_DEAD_END**（verified）— 3択候補枯渇 0
5. **KNOWN_RESULT_DETERMINISM**（verified）— 非戦闘replay不一致 0
6. **INITIAL_INTERACTION**（verified）— 3択・地域内外移動監査 正常
7. **MISSION_CATALOG**（verified）— 常駐24件（初期表示8件）＋特別19件
8. **TROUBLE_ACTION_RESOLUTION**（verified）— 隔離プローブ 19/19トラブル解決
9. **SKILL_CONDITION_SAFETY**（verified）— 取得条件不成立のスキル取得 0件
10. **LEVEL_PACING**（verified）— 到達Lv中央値 16（target 13-21）
11. **FIRST_LEVEL_UP**（verified）— 初回LvUP中央値 Day1
12. **MISSION_EXP_SHARE**（verified）— 経験値に占めるミッション中央値 49.6%
13. **STORY_INTERVENTION**（verified）— 事件調査型の特別ミッション解決中央値 15
14. **TROUBLE_COVERAGE**（verified）— 通常プレイ群で解決されたトラブル 16/19
15. **BALANCED_BATTLE_RATE**（warning）— 均衡型勝率 24.6%
16. **FIGHTER_BATTLE_DENSITY**（verified）— 戦闘優先型の戦闘数中央値 200
17. **LOCAL_AND_REGIONAL_MOVEMENT**（verified）— 探索型 地域内171回・地域間52回
18. **FLAG_SKILL_ACQUISITION**（verified）— 実プレイで取得したフラグ解禁スキル 17種
19. **EVENT_SKILL_SUPPLY**（verified）— 実プレイでイベント付与されたスキル 16種

## 実装上の前提

- 3択とは別に、地域内施設と地域間拠点を統合した移動メニューを常設する。
- 地域内移動も分単位で進み、歩行系常駐ミッションへ加算する。
- 常駐ミッションは8系列×3段階だが、同時表示は各系列の現在段階だけとする。
- 特別ミッションは情報取得、調査、必要時の戦闘、最終対応を順に満たしたときだけトラブルを解決する。
- スキル取得はサーバーがreveal/eventUnlock/learn/grant条件を再検証し、AIは取得可否を決めない。
