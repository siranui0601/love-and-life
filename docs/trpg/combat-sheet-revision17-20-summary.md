# Combat sheet revision 17 → 20 recovery

Generated: `2026-08-17T19:07:16+09:00`

This is a **recovery checkpoint artifact**, not a declaration that revision 20 balance values are correct.
No runtime combat behavior is intentionally changed by this checkpoint.

## Source

- Spreadsheet: `TRPG_戦闘データマスターβ1`
- Spreadsheet ID: `1-2mUA20d7h1lmv1G9fCH0EryFEYyFQ2nkamN51uCPqw`
- revision 17: `2026-08-16T23:24:31.016Z`
- revision 20: `2026-08-17T04:30:47.260Z`
- GitHub runtime start Head: `a74cf16422ab4348742b078391e302d1697ee2a8`

## Machine diff

Exactly **3 tabs / 237 cells** changed.

| Tab | Changed cells | Meaning |
|---|---:|---|
| 設計サマリー | 2 | displayed counts `116→142`, `123→149` |
| モンスター一覧 | 231 | 77 monsters × HP / physical power / magic power |
| モンスタースキル | 4 | barrier / regeneration / repair / ally-heal effect values |

No cell changes were found in 装備性能マスター, 店舗装備在庫, モンスター行動,
地域別エンカウント, 素材買取価格, 戦闘個性監査, ボス監査, or 戦闘認証_v1.

The equipment and stock rows already existed before revision 20; the two 設計サマリー counters were stale.

## Monster normalization classification

Expected mechanical normalization:

- `HP = round(old HP × 0.55)`
- `physicalPower = old × 1.4`
- `magicPower = old × 1.4`

Results across all 77 monsters:

- `PURE_SCALE_NORMALIZATION`: **71**
- `ADDITIONAL_BALANCE_CHANGE`: **6**
- `UNCHANGED`: **0**
- `OTHER_CHANGE`: **0**

All six additional-balance rows are bosses. The full 77-row before/expected/after dataset is in
`combat-sheet-revision17-20-diff.json.gz.b64` (base64 decode, then gunzip).

## Boss before / expected / after

Values are `HP / physicalPower / magicPower`.

| monsterId | boss | Lv | revision17 | expected scale-only | revision20 | classification | delta vs expected |
|---|---|---:|---|---|---|---|---|
| MON-0007 | 赤牙狼の群れ親 | 6 | 554 / 29 / 13 | 305 / 40.6 / 18.2 | 305 / 40.6 / 18.2 | PURE_SCALE_NORMALIZATION | +0 / +0 / +0 |
| MON-0015 | 小型キングスライム | 7 | 472 / 20 / 25 | 260 / 28 / 35 | 260 / 28 / 35 | PURE_SCALE_NORMALIZATION | +0 / +0 / +0 |
| MON-0016 | 膨張キングスライム | 14 | 2318 / 44 / 30 | 1275 / 61.6 / 42 | 1275 / 61.6 / 42 | PURE_SCALE_NORMALIZATION | +0 / +0 / +0 |
| MON-0017 | 巨大キングスライム | 22 | 4798 / 64 / 45 | 2639 / 89.6 / 63 | 2200 / 89.6 / 63 | ADDITIONAL_BALANCE_CHANGE | -439 / +0 / +0 |
| MON-0018 | 世界樹喰らいの王粘体 | 27 | 6803 / 76 / 54 | 3742 / 106.4 / 75.6 | 2850 / 100 / 72 | ADDITIONAL_BALANCE_CHANGE | -892 / -6.4 / -3.6 |
| MON-0028 | 空殻の勇者 | 22 | 5913 / 77 / 69 | 3252 / 107.8 / 96.6 | 2250 / 92 / 82 | ADDITIONAL_BALANCE_CHANGE | -1002 / -15.8 / -14.6 |
| MON-0063 | 機械巨神兵・封印残存期 | 24 | 5558 / 69 / 49 | 3057 / 96.6 / 68.6 | 2400 / 88 / 62 | ADDITIONAL_BALANCE_CHANGE | -657 / -8.6 / -6.6 |
| MON-0064 | 機械巨神兵・完全起動 | 29 | 7703 / 81 / 58 | 4237 / 113.4 / 81.2 | 2850 / 100 / 72 | ADDITIONAL_BALANCE_CHANGE | -1387 / -13.4 / -9.2 |
| MON-0077 | 黒嶺侵攻軍・隊長 | 27 | 8384 / 92 / 83 | 4611 / 128.8 / 116.2 | 2550 / 108 / 96 | ADDITIONAL_BALANCE_CHANGE | -2061 / -20.8 / -20.2 |

## Additional monster-skill changes

- `MSK-0052 魔力障壁`: barrier `maxHp*0.18 → maxHp*0.12`
- `MSK-0056 大再生`: regeneration `9% × 4 turns → 5% × 3 turns`
- `MSK-0061 自己修復`: heal `22% → 15% max HP`
- `MSK-0087 治療薬投与`: heal `20% → 15% max HP`

Descriptions for MSK-0052, MSK-0056 and MSK-0061 were not updated and are now stale.

## Derived-audit warning

`戦闘個性監査!A2` still records canonical SHA-256
`b0efc964fcf1c703b1a40f166b4cc36e03bf142525dda0a85c07980c49384365`,
the same value as revision 17. Because revision 20 changed input tabs, this derived hash is stale.

## Double-scale guard

The current runtime still applies:

- `monsterHpScale = 0.55`
- `monsterOffenceScale = 1.4`

Therefore revision 20 monster values **must not** simply be copied into the existing runtime snapshot.
For the 71 scale-only monsters that would apply the normalization twice. The recovery checkpoint
preserves revision 20 first; hidden-scale removal/canonical synchronization is a separate subsequent change.

## Recovery status

- revision 20 preserved: yes
- revision 20 declared balanced/correct: **no**
- revision 20 rolled back: **no**
- runtime behavior changed by this checkpoint: **no**
- full route replay: **not executed**

## Preserved payloads

- `combat-sheet-revision17-20-diff.json.gz.b64`: gzip+base64 canonical JSON; decoded JSON SHA-256 `57ed851f80af7d64300064f534b21901c793b2138f2ab38f6596ce7c3fa7117c`
- `combat-sheet-revision20-snapshot.json.gz.b64`: gzip+base64 canonical JSON; decoded JSON SHA-256 `ffcfbabf9f97373666e9153c0a1988cd8177e70fee032c31033b4eaad98af854`
- revision20 aggregate tab hash: `ff1e38294e02df7854ac4b7ee01f09a5fddd20e7d1e66f44c1e8166d6c4650ec`

Decode with `base64 -d` then `gzip -d` (or equivalent). This encoding is used only to keep the recovery commit compact.
