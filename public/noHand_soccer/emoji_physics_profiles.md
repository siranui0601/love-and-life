# noHand soccer emoji physics profiles

## 目的

`emoji_catalog_full_ja.json` の絵文字に、サッカー用ピタゴラ装置としての物理プロファイルを付ける。

プロファイル語彙は分類タグではなく、ボールへの作用・移動・受け渡し・絵文字自身の動き・汎用能力に限定する。

## 参照するカタログ項目

使う項目:

- `emoji`
- `name`

無視する項目:

- `jaName`
- `shopCategory`
- `price`

既存の `jaName` は崩れが多いため、プロファイル側では `displayNameJa` を持つ。

## 禁止するタグ

以下のような種類・分類タグは使わない。

- `animal`
- `food`
- `camera`
- `space`
- `person`
- `tool`
- `face`
- `symbol`
- `vehicle`

判断基準は「この語彙はボールをどう動かすかを説明しているか？」。

## ファイル構成

正式には次の2ファイル運用にする。

- `emoji_physics_profiles.json`
- `emoji_physics_profiles.md`

PR #226では、レビュー用の追加バッチとして `emoji_physics_profiles_131_180_draft.json` を一時的に置いている。レビュー後、正式取り込み時に `emoji_physics_profiles.json` へ統合し、このdraftファイルは削除する。

## 現在の登録範囲

正式登録済み: `emoji_catalog_full_ja.json` の先頭130件。

レビュー中: index 130〜179、50件。

## プロファイル形式

```json
{
  "emoji": {
    "sourceName": "catalog name",
    "displayNameJa": "整理した日本語名",
    "receive": [],
    "path": [],
    "release": [],
    "motion": [],
    "effects": [],
    "abilities": [],
    "confidence": 0.8,
    "note": "採用理由"
  }
}
```

## effects と abilities

- `effects`: runtimeが直接扱いやすい基本的な物理効果。
- `abilities`: 複数の `effects` / `receive` / `path` / `release` を組み合わせるための汎用能力。

`abilities` には、`lemonBomb` や `roomSplit` のような絵文字固有名は入れない。絵文字固有のノリは `note` に書き、能力名は複数絵文字で再利用できるものにする。

例:

- `🍋` や `🎇` に使えそうな能力は `burstScatter` / `splitScatter`。
- `🏩` に使えそうな能力は `trapHold` / `hiddenRoute` / `multiExit` / `splitScatter` / `delayedRelease`。

## 主要 abilities 語彙

| 語彙 | 意味 |
|---|---|
| `absorbHold` | 吸い込んで一時保持する |
| `aimAssist` | 次の対象へ狙いを補正する |
| `attractHold` | 引き寄せて保持する |
| `burstScatter` | 中心から放射状に飛ばす |
| `splitScatter` | 本体・分身を分けて散らす |
| `multiExit` | 複数出口から出す |
| `hiddenRoute` | 見えない経路を通す |
| `warpExit` | 別地点から出す |
| `orbitCarry` | 周回させながら運ぶ |
| `rollCarry` | 転がしながら運ぶ |
| `flowCarry` | 流れで運ぶ |
| `dashCarry` | 突進しながら運ぶ |
| `chaseCatch` | 追いかけて捕まえる |
| `trapHold` | 閉じ込めて保持する |
| `grabHold` | 掴んで一時保持する |
| `wrapHold` | 巻き付けて保持する |
| `reflectShield` | 反射・防御する |
| `impactLaunch` | 衝撃で強く射出する |
| `popLaunch` | ポンと射出する |
| `snapLaunch` | 溜めて弾く |
| `slingLaunch` | しならせて射出する |
| `curveRedirect` | 曲線的に方向転換する |
| `zigzagRedirect` | ジグザグに方向転換する |
| `spinRedirect` | 回転で方向転換する |
| `pushRedirect` | 押して方向転換する |
| `slowDampen` | 勢いを減衰させる |
| `softLanding` | やわらかく着地・減速させる |
| `poisonDampen` | 毒や粘りで減速させる |
| `sleepFloat` | 眠るように浮遊・減速させる |
| `lowGravityField` | 低重力領域を作る |
| `gravityShift` | 重力方向を変える |
| `randomBounce` | 予測不能に跳ね返す |
| `fakeRoute` | フェイント軌道を作る |
| `delayedRelease` | 時間差で放つ |

## 131-180 draftメモ

今回のdraftでは、量より正確性を優先して50件のみ追加した。

- `🥳`: パーティークラッカー的に `burstScatter` / `randomBounce`。
- `👲` 系: 人物分類ではなく、帽子・頭部で受けて上へ弾く `reflectShield` / `popLaunch`。
- `💩`: 不快になりすぎない範囲で、粘り・毒による `poisonDampen`。
- `🎱`: ビリヤード球として `rollCarry` / `precisionPass` / `spinRedirect`。
- `💀` / `☠️`: 骨・危険標識として `splitScatter` / `poisonDampen`。
- `😴`: 眠り系の標準候補として `sleepFloat`。

## 実装メモ

- runtime本体にはまだ接続しない。
- compilerは `abilities` を優先し、足りない場合に `effects` / `receive` / `path` / `release` / `motion` で補完する。
- `splitScatter` は `splitEffect` + `burstRelease` + 放射状速度へ変換する。
- `multiExit` は複数の出口候補を作り、次actorまたは安全な出口方向へ渡す。
- `hiddenRoute` は見えない経路演出を挟んで、`warpExit` に近い転送として扱う。
- 似た意味の新語彙を増やす前に、このmdの語彙表を確認する。
