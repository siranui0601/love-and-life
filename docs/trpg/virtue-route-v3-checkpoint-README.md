# 人徳ルート v3 静的コンパイル checkpoint

初期compiler開始Head: `5ef557144f05c73869d6a6785ed49d5f2834d379`

2026-08-16 再開開始Head: `32dcdbd5121b235e80c186e81426302c602473fe`

再現可能source checkpoint Head: `58350fb9662a8ef8709183916684eccd1cee4135`

Phase A-C で、旧 `正規台帳` 831行を deterministic compiler へ投入し、831/831件の暫定mappingを実際に生成した。そのcheckpointを捨てずにPhase Dを原因別batchで完了し、現在は831/831行を通常runtime actionへ静的compileできる。

## 現在の静的compile完了点（2026-08-16）

- static validation checkpoint Head: `cf44e5cf2c5c8b365424bd8e43dae5f8e54e537f`
- compiler: `virtue-route-v3-static-compiler-v6`
- validator: `virtue-route-v3-static-validator-v2`
- Sheet exporter: `virtue-route-v3-sheet-export-v1`
- mapped / source rows: `831 / 831`
- expanded v3 rows: `1526`
- `UNMAPPED / UNKNOWN / TODO / PARTIAL`: `0 / 0 / 0 / 0`
- static compile coverage: `100%`
- exact authored override rows: `110`
- MOVE_LOCAL / REGIONAL_MOVE: `336 / 50`
- static resource validation: `PASS`（最終34G、総EXP 39656、Lv23、残SP13）
- replay / combat execution: 未実施

`node tools/trpg-sim/compile-virtue-route-v3.mjs` →
`node tools/trpg-sim/validate-virtue-route-v3-static.mjs` →
`node tools/trpg-sim/export-virtue-route-v3-sheets.mjs` の順で、source export後のクリーンcheckoutからmapping・資源台帳・Google Sheets書込用3 CSVを決定的に再生成できる。Sheet側の正式成果タブは `正規台帳_v3`、`v2_v3対応表`、`静的検証_v3` である。

2026-08-16 の recovery checkpoint では、ライブの
`TRPG_人徳ルート正規台帳_v2` / `正規台帳` を再取得し、
`docs/trpg/virtue-route-v2-source.meta.json` の provenance とhashに固定した。
正本は非公開Sheet、repositoryは公開なので、行本文を含むCSV/mapping/unresolvedは追跡しない。
クリーンcheckoutでは認証済み環境で
`node tools/trpg-sim/export-virtue-route-v2-source.mjs` を実行してCSVを再生成し、
`--check` でライブSheetとの差分を検査できる。

- source spreadsheet: `1aSLu_pSLNsFsUm42juEyOrLDmTkJd7NPOOrQNnvnMwA`
- source sheet: `正規台帳` (`sheetId=453964624`)
- source range: `'正規台帳'!A1:AF832`
- data rows / columns: `831 / 32`
- source SHA-256: `eb26d459851f7bcc8d9d159e6f86f5da016ce70cccbdbac329e9e684b4d14120`

Head `32dcdbd` の圧縮payloadはGit blob自体が20,023 bytesで途切れていた。
復号できたprefixは差分資料として使ったが、そのままsourceへ上書きしていない。
詳細は `virtue-route-v3-payload-recovery.md` を参照。

- compiler version: `virtue-route-v3-static-compiler-recovery-v3`（recovery checkpoint時点）
- auto resolved: 594
- exact authored override rows: 7
- unresolved: 237
- provisional coverage: 71.48%
- canonical jobs loaded: 28
- canonical products loaded: 44
- work rows reallocated: 56
- proposed MOVE_LOCAL insertions: 129
- REGIONAL_MOVE mapping rows: 45
- replay / route simulation: 未実施

最初のPhase D batchでは、実在する通常runtime actionだけを使って11行を解消した。

- T01 composite: 既存のsearch×2 / rescue / escort / return / decideへ6分割
- T03: ライブ戦闘正本のboss encounter `ENC-0006`、`relocate_den` resolutionへ接続
- T04: `ENC-0061` と `recover_then_pause` resolutionへ分割
- エルフの隠れ里: 正本 `ITM195` 樹上客間を `elfApproval` 条件で通常公開
- エルフ里の食事3行: 所持済み `ITM023` を食べる通常actionへ接続
- 素材: Day20は確定dropだけを3Gで売却し、旧+9Gとの差6Gを静的ledgerの再配分対象として明記。Day58は3Gを一致
- 債務: `OBLIGATION:PAY:DEBT:EDA:ITM014:FULL` へ接続

recovery checkpoint時点のunresolved理由は8種だった。現在はcompiler v6で全件解消済みである。

| reason | count |
|---|---:|
| MISSING_DAILY_INTERACTION_MATCH | 87 |
| MISSING_NPC_INTERACTION | 83 |
| REST_SPLIT_REQUIRED | 33 |
| MISSING_AUTHORED_MISSION_MATCH | 28 |
| MISSING_MATERIAL_LINEAGE | 3 |
| MISSING_LODGING_PRODUCT | 1 |
| COMPOSITE_EQUIPMENT_INTERACTION | 1 |
| INVALID_LONG_LOCAL_INVESTIGATE | 1 |

## files

- `tools/trpg-sim/compile-virtue-route-v3.mjs`: v2→v3 deterministic static compiler
- `tools/trpg-sim/export-virtue-route-v2-source.mjs`: 正本Sheet→追跡可能CSV/provenance export
- `docs/trpg/virtue-route-v2-source.csv`（gitignored）: 正本から再生成する831行のcompiler input
- `docs/trpg/virtue-route-v2-source.meta.json`: source ID/範囲/取得時点/hash
- `tools/trpg-sim/lib/virtue-route-v3-runtime-catalog.json`: current Head + current masters から固定したruntime辞書
- `docs/trpg/virtue-route-v3-static-summary.json`: checkpoint集計
- `tools/trpg-sim/validate-virtue-route-v3-static.mjs`: runtime正本ID・経済・EXP/Lv/SP・装備・事件状態のdeterministic validator
- `docs/trpg/virtue-route-v3-static-validation.json`: validator v2の追跡可能な検証結果
- `tools/trpg-sim/export-virtue-route-v3-sheets.mjs`: v3台帳・対応表・静的検証の決定的Sheet payload生成
- `docs/trpg/virtue-route-v3-sheet-export-manifest.json`: Sheet行列数とCSV SHA-256
- `docs/trpg/virtue-route-v3-checkpoint-mapping-831.json.gz.b64.part-00`
- `docs/trpg/virtue-route-v3-checkpoint-mapping-831.json.gz.b64.part-01`

2つのmapping partはPhase A-C時点の初期checkpointである。連結してbase64 decode→gzip decodeすると、全831行について次の13項目を持つcompact JSONを復元できる。

`legacyRowIndex, legacyRowId, classification, status, commandType, actionId, facilityId, jobId, productId, equipmentId, skillId, unresolvedReason, replacementRowIds`

```bash
cat docs/trpg/virtue-route-v3-checkpoint-mapping-831.json.gz.b64.part-* \
  | base64 -d > /tmp/virtue-route-v3-checkpoint-mapping-831.json.gz
echo 'e1f54941124a3a1a6029f2e25daa62f28c3692772fcbe6386a6b1c60a6d882c6  /tmp/virtue-route-v3-checkpoint-mapping-831.json.gz' | sha256sum -c -
gzip -dc /tmp/virtue-route-v3-checkpoint-mapping-831.json.gz > /tmp/virtue-route-v3-checkpoint-mapping-831.json
```

最新mappingとSheet投入用CSVは非公開Sheet由来の行本文を含むためrepositoryでは追跡せず、同じsource hashからcompiler・validator・Sheet exporterで再生成する。manifestとvalidator結果は追跡する。静的compile工程は `UNMAPPED/PARTIAL/TODO/UNKNOWN=0`、coverage 100%へ到達したが、戦闘勝利可能性の実行証明はreplay禁止中のため別工程として残る。
