# TRPG（仮題）統合プレイヤーシミュレーション v4

- 生成: 2026-07-26T23:10:37.275Z
- seed: `trpg-player-v4-20260718`
- プレイヤーrun: baseline 14 + tuned 14
- 参照: 19トラブル / 103地域内施設 / 76エンカウント / 1141スキル
- 品質判定: PASS（blocker 0, warning 2）

## 調整後の結果

| 方針 | 到達Lv | 初LvUP | 戦闘数 | 勝率 | 常駐任務 | 特別任務 | 解決T | 地域内/間移動 | フラグ/イベント技能 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 均衡型 | 19 | Day1 | 200 | 23.0% | 35 | 15 | 15 | 31/30 | 2/15 |
| 事件調査型 | 19 | Day1 | 197 | 24.9% | 35 | 15 | 15 | 31/30 | 6/15 |
| 戦闘優先型 | 18 | Day1 | 199 | 100.0% | 24 | 0 | 0 | 0/0 | 9/0 |
| 探索優先型 | 20 | Day1 | 197 | 22.7% | 38 | 16 | 16 | 178/52 | 2/16 |
| 商人型 | 15 | Day1 | 0 | 0.0% | 22 | 0 | 0 | 38/10 | 0/0 |
| 生存優先型 | 19 | Day1 | 201 | 24.9% | 35 | 15 | 15 | 31/30 | 3/15 |
| ランダム有効選択型 | 18 | Day1 | 162 | 100.0% | 24 | 0 | 0 | 0/0 | 5/0 |

## ミッション構成

- 常駐ミッション定義: 48件、12系列。初期に同時表示するのは12件。
- 特別ミッション: 19件（トラブルと1対1）。
- 常駐EXP総量: 25390 / 特別EXP総量: 2800
- 通常プレイ群で解決されたトラブル: 17/19

## スキル取得監査

- フラグ解禁定義: 436件（Lv以外の条件を持つもの 436件）
- イベント付与定義: 325件（構造化grantConditionsあり 325件）
- 装備付与定義: 162件
- 実プレイで取得: フラグ解禁 15種 / イベント付与 17種 / 装備付与 0種
- 条件不成立取得: 0件
- 静的に到達不能: 0件

## トラブル解決プローブ

- プレイヤー行動列だけで 19/19件を解決。
- 失敗:
- なし

## 検証項目

1. **DAY100_REACHABILITY**（verified）— Day100到達率 100.0% (14 runs)
2. **ACTION_CAP**（verified）— 最大行動数で停止したrun 0
3. **MOVEMENT_AVAILABILITY**（verified）— 地域内外の移動不能回数 0
4. **CHOICE_DEAD_END**（verified）— 3択候補枯渇 0
5. **KNOWN_RESULT_DETERMINISM**（verified）— 非戦闘replay不一致 0
6. **INITIAL_INTERACTION**（verified）— 3択・地域内外移動監査 正常
7. **MISSION_CATALOG**（verified）— 常駐48件（初期表示12件）＋特別19件
8. **TROUBLE_ACTION_RESOLUTION**（verified）— 隔離プローブ 19/19トラブル解決
9. **SKILL_CONDITION_SAFETY**（verified）— 取得条件不成立のスキル取得 0件
10. **LEVEL_PACING**（verified）— 到達Lv中央値 19（target 18-22）
11. **FIRST_LEVEL_UP**（verified）— 初回LvUP中央値 Day1
12. **MISSION_EXP_SHARE**（verified）— 経験値に占めるミッション中央値 79.7%
13. **STORY_INTERVENTION**（verified）— 事件調査型の特別ミッション解決中央値 15
14. **TROUBLE_COVERAGE**（verified）— 通常プレイ群で解決されたトラブル 17/19
15. **BALANCED_BATTLE_RATE**（warning）— 均衡型勝率 23.0%
16. **FIGHTER_BATTLE_DENSITY**（verified）— 戦闘優先型の戦闘数中央値 199
17. **LOCAL_AND_REGIONAL_MOVEMENT**（verified）— 探索型 地域内178回・地域間52回
18. **FLAG_SKILL_ACQUISITION**（verified）— 実プレイで取得したフラグ解禁スキル 15種
19. **EVENT_SKILL_SUPPLY**（verified）— 実プレイでイベント付与されたスキル 17種
20. **V3_MISSION_VOLUME**（verified）— 常駐ミッション48件（target 48-56）
21. **V3_INITIAL_MISSION_LOAD**（verified）— 初期同時表示12件（上限14）
22. **V3_SKILL_ACCESS**（verified）— 最終取得スキル中央値35（target 30-42）
23. **V3_NPC_RELEVANT_RESPONSE**（verified）— 関係NPC応答率中央値100.0%
24. **V3_NPC_PLAYER_RESOLUTION_RESPONSE**（verified）— プレイヤー解決後の関係NPC応答率中央値100.0%
25. **V3_NPC_CRISIS_RESPONSE**（verified）— 危機・失敗時の関係NPC応答率中央値100.0%
26. **V3_NO_STALE_ESCALATION**（verified）— 解決後にcritical/failedへ戻った件数0
27. **V3_NO_UNRELATED_REPLAN**（verified）— 無関係NPC再計画0件。情報取得・調査などstatus以外の関係事件噂による再計画1624件は関連反応として別計上
28. **V3_PLAYER_RESOLUTION_AUTHORITY**（verified）— プレイヤー最終対応以外のresolved遷移0件
29. **V3_NPC_PLAN_EXECUTION**（verified）— 期限内に実行可能なNPC計画率中央値100.0%
30. **V3_NPC_PLAN_CHANGES_AFTER_PLAYER**（verified）— プレイヤー解決後に危機計画から復旧計画へ変化した率100.0%
31. **V3_NPC_NO_STALE_CRISIS_PLAN**（verified）— 解決済み事件に残った危機計画0件
32. **V3_NPC_ROLE_APPROPRIATE_PLAN**（verified）— 職種・役割と不整合な対応計画0件
33. **V3_NPC_PLAN_REACHABILITY**（verified）— 到達不能な行動計画0件
34. **V4_GOAP_EXECUTED**（verified）— 施設行動完了8682件
35. **V4_GOAP_REACHABILITY**（verified）— 到達不能・経路なし0件
36. **V4_GOAP_NO_OVERLAP**（verified）— NPC二重行動0件
37. **V4_GOAP_CANCEL_AUTHORITY**（verified）— 取消後に完了した行動0件
38. **V4_GOAP_NO_STALE_CRISIS**（verified）— 解決情報受信後も完了した旧危機行動0件
39. **V4_GOAP_ROLE_MATCH**（verified）— 職種不一致計画0件
40. **V4_GOAP_MOVEMENT_CONTINUITY**（verified）— 移動ログ不連続0件
41. **V4_GEMINI_SCHEMA_SAFETY**（verified）— 補正後の不正出力0件
42. **V4_GEMINI_DETERMINISTIC_REPLAY**（verified）— 同一入力の再生不一致0件
43. **V4_GEMINI_CACHE_CLASSIFICATION**（verified）— キャッシュ可否未分類0件
44. **V4_GEMINI_CACHE_BYPASS**（verified）— 保存対象の2回目AI非呼出率100.0%（73/73）
45. **V4_GEMINI_TRANSIENT_RETRY**（verified）— 未保存フォールバックの次回再試行率100.0%（11/11）
46. **V4_GEMINI_LOCAL_CONTEXT**（verified）— その場にいないNPCへの出力参照0件
47. **V4_GEMINI_LIVE_SMOKE**（warning）— CIにGEMINI_API_KEYがないため実API試験は未実施。故障注入試験と本番接続コードは完了

## 実装上の前提

- 3択とは別に、地域内施設と地域間拠点を統合した移動メニューを常設する。
- 地域内移動も分単位で進み、歩行系常駐ミッションへ加算する。
- 常駐ミッションは12系列×4段階だが、同時表示は各系列の現在段階だけとする。
- 特別ミッションは情報取得、調査、必要時の戦闘、最終対応を順に満たしたときだけトラブルを解決する。
- スキル取得はサーバーがreveal/eventUnlock/learn/grant条件を再検証し、AIは取得可否を決めない。


## v3 ミッション・成長拡張

- 常駐ミッション: 48件、12系列、初期表示12件。
- 常駐EXP総量: 25390 / 特別EXP総量: 2800
- 最終Lv中央値: 19
- 最終取得スキル中央値: 35
- 5個目取得中央値: Day1 / 10個目: Day2 / 15個目: Day7
- ミッションEXP比率中央値: 79.3%
- EXP中央値: 戦闘3417 / 常駐12440 / 特別2000

## NPC介入反応監査

- 関係NPC応答率中央値: 100.0%
- プレイヤー解決後応答率中央値: 100.0%
- 危機・失敗時応答率中央値: 100.0%
- 期待応答/実応答: 8706/8706
- 関係外再計画: 0
- status以外の関連事件噂による再計画: 1624
- 解決後の再悪化: 0
- resolved権限違反: 0
- 上流解決による後続抑止中央値: 1
- 危機時にNPC軽減が入ったトラブル中央値: 2

| NPC反応計画 | 件数 |
|---|---:|
| defend_or_escort | 2174 |
| observe_and_replan | 1550 |
| supply_response | 1550 |
| evacuate_or_mitigate | 962 |
| reassess_and_recover | 698 |
| investigate_response | 474 |
| medical_response | 430 |
| stand_down_and_patrol | 418 |
| recovery_supply | 358 |
| recovery_care | 92 |


## NPC行動計画リプレイ

関係NPCが噂を受信した時点から、現在地、目的地までの経路、職種、事件状態、重要度を用いて行動計画を再構成した。

- 対象run: 7
- 生成計画: 4353件
- 期限内実行可能: 4353件（中央値100.0%）
- 状況変化による計画改訂: 2547件
- 危機対応から解決後対応への変更: 783/783件（100.0%）
- 解決済み事件に残った危機計画: 0件
- 職種・役割不一致: 0件
- 到達不能計画: 0件
- 低優先度の古い情報を無視した回数: 812件
- NPC行動による被害軽減寄与中央値: 16.5322

| 実行計画 | 件数 |
|---|---:|
| observe_and_replan | 1487 |
| evacuate_or_mitigate | 895 |
| reassess_and_recover | 594 |
| supply_response | 399 |
| defend_or_escort | 258 |
| stand_down_and_monitor | 220 |
| medical_response | 176 |
| investigate_response | 135 |
| recovery_supply | 90 |
| stand_down_and_patrol | 61 |
| recovery_care | 38 |


## v4 GOAP実行ログ検証

v3の行動計画を、予定表だけで終わらせず、出発、街道区間、到着、施設入場、施設行動、GOAP状態更新まで実行した。

- 対象プレイヤー行程: 14
- 入力計画: 8706件
- 行動開始: 8706件
- 目的地到着: 8695件
- 施設入場: 8695件
- 施設行動完了: 8682件
- 開始前取消: 0件
- 移動・行動中の計画変更: 24件
- 到達不能: 0件
- 二重行動: 0件
- 取消後の行動完了: 0件
- 解決情報受信後に残った危機行動: 0件
- 職種不一致: 0件
- 移動ログ不連続: 0件
- 生成した実行ログ: 72888件

## v4 Gemini接続・故障注入試験

使用契約モデルは `gemini-2.5-flash-lite`。AIは文章、3択文面、同席NPCの発言、候補提案だけを生成し、ゲーム状態を直接更新しない。

- 故障注入シナリオ: 84件
- 旧式の緩い受入れで不正となる出力: 61件
- 検証・再生成・フォールバック後の有効出力: 84/84
- 修正プロンプトで回復: 26件
- 決定論的フォールバック: 11件
- 却下した権限外提案: 10件
- 入力から除外した遠隔NPCレコード: 504件
- 出力に残った遠隔NPC参照: 0件
- 保存可能な同一入力の2回目でキャッシュ使用: 73/73
- 一時フォールバックを保存せず次回再試行: 11/11
- 同一入力の結果不一致: 0件

同一のローカル状態、確定済み行動結果、プロンプト版、モデルが一致し、検証済みの完全な出力が保存されている場合はJSONL再生台帳から返し、Geminiを呼び出さない。一時的な通信失敗や不完全JSONのフォールバックは台帳を汚染せず、次の独立リクエストでGeminiを再試行する。戦闘・遭遇などの乱数結果は、先にサーバーresolverが確定した結果をキーへ含める。

## 実Gemini API試験

- 未実施: live Gemini smoke requires GEMINI_API_KEY and TRPG_GEMINI_NARRATIVE_ENABLED=true

CIにAPIキーがない場合も、実接続コード、JSON Schema、ローカル文脈制限、再試行、修正プロンプト、権限検証、再生キャッシュを自動試験する。本番環境では同じCLIをAPIキー付きで再実行できる。
