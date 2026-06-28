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

プロファイル関連ファイルは次の2つだけで管理する。

- `emoji_physics_profiles.json`
- `emoji_physics_profiles.md`

分割JSONやdraft JSONは作らない。追加バッチも必ず `emoji_physics_profiles.json` の `profiles` に統合する。

## 現在の登録範囲

`emoji_catalog_full_ja.json` の先頭230件。

- 001-030: 初期バッチ
- 031-055: 泣き顔、水晶玉、目、投げキス、医療系の顔など
- 056-080: 目回し、月、幽霊、手袋、笑顔系など
- 081-105: ハート、キス、ラブユーの手など
- 106-130: ラブユー手の肌色差分、facepalm、frowning、猿・ねずみ・口・新月など
- 131-180: オレンジハート、パーティー顔、person facepalming/frowning、帽子の人、豚、うんち、プードル、8ボール、ドクロ、眠り、天使の輪、ハート目、角つき笑顔など
- 181-230: 舌出し顔、太陽、汗しぶき、日めくり、考える顔、虎、舌、2つのハート、逆さ顔、風の顔、女性facepalm/frowning、酔い顔、あくび、目覚まし時計、アメフト、アーティスト、パレット、宇宙飛行士など

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
| `timedRelease` | 指定タイミングで放つ |
| `paintTrail` | 描いた線・塗料の流れで軌道を作る |
| `silenceHold` | 音や動きを抑えて静かに保持する |

## High confidence profiles

| 絵文字 | 理由 |
|---|---|
| `🥊` | 接触、打撃、射出が直感的。`impactLaunch` の代表にできる。 |
| `🥣` | 受ける、回す、すくう、渡す流れが自然。 |
| `🎱` | 転がり、回転、精密パスが絵文字の意味と一致する。 |
| `🌬️` | 風で押す・曲げる・流す挙動がそのまま物理化できる。 |
| `🌞` | 熱、光、上昇、放射が自然につながる。 |
| `💦` | 複数しずくなので、流れと分裂の両方が自然。 |
| `👅` / `😛` / `😜` / `😝` | 舌で引っかける、曲げる、弾く動きが明確。 |
| `⏰` | 時間差発動と振動射出の代表にできる。 |
| `🧑‍🚀` 系 | 低重力・周回・照準補正が自然。 |
| `🔮` / `👁️` / `👀` / `🤖` | 照準補正、予測、追尾の代表として安定している。 |

## Review candidates

| 絵文字 | 理由 |
|---|---|
| `🤎` | 茶色から土・重さへ寄せているが、絵文字単体の意味としてはやや弱い。 |
| `🤍` / `💛` / `🧡` / `💜` | 色違いハートの差別化が抽象的。全体的に吸着＋軽い補正へ寄りやすい。 |
| `😁` / `😀` / `😃` / `😄` / `☺️` / `😊` / `🙂` | 笑顔系は `lightBoost` / `softPass` に寄りやすく、主役ギミックになりにくい。 |
| `🙍` / `🙁` / `☹️` / `😞` / `😔` / `😟` / `😫` / `😩` | 落ち込み・疲れ顔は `slowDampen` / `dropRelease` に寄りやすく差が小さい。 |
| `👲` 系 | 帽子・頭部で反射する解釈は使えるが、絵文字本来の意味からは少し離れる。 |
| `💩` | `poisonDampen` は自然だが、演出が不快に寄りすぎないよう調整が必要。 |
| `🧑‍🎨` / `🎨` | `paintTrail` は良いが、compiler実装時に軌道定義が曖昧になりやすい。 |

## Compiler-sensitive abilities

| ability | 注意点 |
|---|---|
| `multiExit` | 出口位置の決定規則が必要。複数出口から出す場合、次actorとの接続を壊しやすい。 |
| `hiddenRoute` | 見えない経路の開始・終了位置を決めないとワープと区別しにくい。 |
| `splitScatter` | 分身をどこまで有効なボールとして扱うかを決めないと強すぎる。 |
| `burstScatter` | 放射状速度の上限と本体/分身の扱いを決める必要がある。 |
| `paintTrail` | 線に沿うのか、塗料の流れで押すのかをcompiler側で分ける必要がある。 |
| `timedRelease` | 保持時間の上限を決めないとテンポが止まる。 |
| `sleepFloat` | 低重力・減速・遅延の組み合わせが長くなりすぎないよう注意。 |
| `gravityShift` | 画面全体ではなく局所的な重力変更にしないと破綻しやすい。 |
| `phaseThrough` | すり抜け中も次actorへの接続を保証する必要がある。 |
| `magnetPull` | 引力が強すぎるとボールが吸着して止まりやすい。 |

## 181-230 追加メモ

- `🌞`: 太陽の熱と光を `heatLift` / `burnBoost` / `burstScatter` に寄せた。
- `💦`: 複数のしずくとして `slipFlow` / `flowCarry` / `splitScatter` を持たせた。
- `📆`: 日めくりの時間差を `timedRelease` / `delayedRelease` / `dropRelease` にした。
- `🙃`: 逆さ顔として `gravityShift` / `spinRedirect` を採用した。
- `🌬️`: 風で吹く顔として `breathLaunch` / `flowCarry` / `curveRedirect` にした。
- `⏰`: 目覚ましの振動と時間指定から `timedRelease` / `pulseBoost` / `burstScatter` にした。
- `🏈`: 楕円球のスピンを `spinRedirect`、ロングパスを `impactLaunch` / `precisionPass` にした。
- `🧑‍🎨` / `🎨`: 描いた線や塗料の流れを `paintTrail` で扱う。
- `🧑‍🚀`: 低重力・周回を `lowGravityField` / `orbitCarry` へ寄せた。

## 実装メモ

- runtime本体にはまだ接続しない。
- compilerは `abilities` を優先し、足りない場合に `effects` / `receive` / `path` / `release` / `motion` で補完する。
- `splitScatter` は `splitEffect` + `burstRelease` + 放射状速度へ変換する。
- `multiExit` は複数の出口候補を作り、次actorまたは安全な出口方向へ渡す。
- `hiddenRoute` は見えない経路演出を挟んで、`warpExit` に近い転送として扱う。
- `paintTrail` は表示上の塗料・線に沿って `curvePath` / `flowPath` を作る。
- 似た意味の新語彙を増やす前に、このmdの語彙表を確認する。
