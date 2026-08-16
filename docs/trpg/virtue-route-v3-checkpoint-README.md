# 人徳ルート v3 静的コンパイル checkpoint

開始Head: `5ef557144f05c73869d6a6785ed49d5f2834d379`

Phase A-C で、旧 `正規台帳` 831行を deterministic compiler へ投入し、831/831件の暫定mappingを実際に生成した。

- auto resolved: 583
- unresolved: 248
- provisional coverage: 70.16%
- canonical jobs loaded: 28
- work rows reallocated: 56
- proposed MOVE_LOCAL insertions: 123
- legacy REGIONAL_MOVE rows: 44
- replay / route simulation: 未実施

## files

- `tools/trpg-sim/compile-virtue-route-v3.mjs`: v2→v3 deterministic static compiler
- `tools/trpg-sim/lib/virtue-route-v3-runtime-catalog.json`: current Head + current masters から固定したruntime辞書
- `docs/trpg/virtue-route-v3-static-summary.json`: checkpoint集計
- `docs/trpg/virtue-route-v3-checkpoint-mapping-831.json.gz.b64.part-00`
- `docs/trpg/virtue-route-v3-checkpoint-mapping-831.json.gz.b64.part-01`

2つのmapping partを連結してbase64 decode→gzip decodeすると、全831行について次の13項目を持つcompact JSONを復元できる。

`legacyRowIndex, legacyRowId, classification, status, commandType, actionId, facilityId, jobId, productId, equipmentId, skillId, unresolvedReason, replacementRowIds`

```bash
cat docs/trpg/virtue-route-v3-checkpoint-mapping-831.json.gz.b64.part-* \
  | base64 -d > /tmp/virtue-route-v3-checkpoint-mapping-831.json.gz
echo 'e1f54941124a3a1a6029f2e25daa62f28c3692772fcbe6386a6b1c60a6d882c6  /tmp/virtue-route-v3-checkpoint-mapping-831.json.gz' | sha256sum -c -
gzip -dc /tmp/virtue-route-v3-checkpoint-mapping-831.json.gz > /tmp/virtue-route-v3-checkpoint-mapping-831.json
```

これは作業完了点ではない。Phase Dで理由別unresolved集合をまとめて解消し、最終成果物では `UNMAPPED/PARTIAL/TODO=0` と `STATIC_COMPILE_COVERAGE=100%` を要求する。replayは次工程まで禁止する。
