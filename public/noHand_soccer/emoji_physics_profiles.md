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

runtime / 本番用のプロファイル関連ファイルは次の2つだけで管理する。

- `emoji_physics_profiles.json`
- `emoji_physics_profiles.md`

分割profile JSONやdraft profile JSONは作らない。追加バッチは、最後または節目で必ず `emoji_physics_profiles.json` の `profiles` に統合する。

作業用キューは `tools/nohand/profile_queue/` に置く。これは本番プロファイルではなく、AIが50件ずつ精査するための入力・作業結果である。

```txt
public/noHand_soccer/
  emoji_catalog_full_ja.json
  emoji_physics_profiles.json
  emoji_physics_profiles.md

tools/nohand/
  generate_profile_queue.mjs
  merge_all_profiled_batches.mjs
  validate_profiles.mjs
  profile_queue/
    catalog_0231_0280.pending.json
    catalog_0231_0280.profiled.json
```

## pending / profiled キュー運用

1. `generate_profile_queue.mjs` が `emoji_catalog_full_ja.json` と `emoji_physics_profiles.json` を比較する。
2. まだprofile化されていない絵文字を50件単位で `.pending.json` として作る。
3. AIは `.pending.json` を1つ読み、各絵文字の意味と効果を吟味する。
4. プロファイル化できたら同じ範囲の `.profiled.json` を作り、元の `.pending.json` は削除する。
5. `.profiled.json` には `sourceItems`、`profiles`、`review` を入れる。
6. 作業中は `emoji_physics_profiles.md` に追加範囲、見直し候補、compiler注意点を随時更新する。
7. 全部または節目までprofiled化できたら、`merge_all_profiled_batches.mjs` で `emoji_physics_profiles.json` に統合する。
8. `validate_profiles.mjs` で抜け・重複・分類タグ混入・sourceName不一致を検査する。

queue JSONには `emoji` と英語 `name` だけを入れる。`jaName` / `shopCategory` / `price` / `codepoints` はAI判断のノイズになるため入れない。

### 全pending queue生成

```bash
node tools/nohand/generate_profile_queue.mjs
```

デフォルトでは、まだprofile化されていない全絵文字を50件ずつ `.pending.json` として生成する。

```bash
node tools/nohand/generate_profile_queue.mjs --size 50 --first
```

`--first` を付けると、未処理の先頭50件だけを生成する。

### profiled queue 統合

```bash
node tools/nohand/merge_all_profiled_batches.mjs
```

`tools/nohand/profile_queue/*.profiled.json` をファイル名順・range順に読み込み、単一の `emoji_physics_profiles.json` へ統合する。

### 検証

```bash
node tools/nohand/validate_profiles.mjs
```

## 現在の登録範囲

`emoji_catalog_full_ja.json` の先頭230件。

- 001-030: 初期バッチ
- 031-055: 泣き顔、水晶玉、目、投げキス、医療系の顔など
- 056-080: 目回し、月、幽霊、手袋、笑顔系など
- 081-105: ハート、キス、ラブユーの手など
- 106-130: ラブユー手の肌色差分、facepalm、frowning、猿・ねずみ・口・新月など
- 131-180: オレンジハート、パーティー顔、person facepalming/frowning、帽子の人、豚、うんち、プードル、8ボール、ドクロ、眠り、天使の輪、ハート目、角つき笑顔など
- 181-230: 舌出し顔、太陽、汗しぶき、日めくり、考える顔、虎、舌、2つのハート、逆さ顔、風の顔、女性facepalm/frowning、酔い顔、あくび、目覚まし時計、アメフト、アーティスト、パレット、宇宙飛行士など

## 作業キュー進捗

- 231-280: `tools/nohand/profile_queue/catalog_0231_0280.profiled.json` 作成済み。runtime JSON には未統合。
- 281-330: `tools/nohand/profile_queue/catalog_0281_0330.profiled.json` 作成済み。runtime JSON には未統合。
- 331-380: `tools/nohand/profile_queue/catalog_0331_0380.profiled.json` 作成済み。runtime JSON には未統合。
- 381-430: `tools/nohand/profile_queue/catalog_0381_0430.profiled.json` 作成済み。runtime JSON には未統合。
- 431-480: `tools/nohand/profile_queue/catalog_0431_0480.profiled.json` 作成済み。runtime JSON には未統合。
- 481-530: `tools/nohand/profile_queue/catalog_0481_0530.profiled.json` 作成済み。runtime JSON には未統合。
- 531-580: `tools/nohand/profile_queue/catalog_0531_0580.profiled.json` 作成済み。runtime JSON には未統合。
- 次の候補: `tools/nohand/profile_queue/catalog_0581_0630.pending.json`。

## profiled queue 形式

```json
{
  "version": 1,
  "status": "profiled",
  "range": {
    "startOrdinal": 231,
    "endOrdinal": 280,
    "count": 50
  },
  "sourceItems": [
    { "ordinal": 231, "catalogIndex": 230, "emoji": "👶", "name": "baby" }
  ],
  "profiles": {
    "👶": {
      "sourceName": "baby",
      "displayNameJa": "赤ちゃん",
      "receive": [],
      "path": [],
      "release": [],
      "motion": [],
      "effects": [],
      "abilities": [],
      "confidence": 0.8,
      "note": "採用理由"
    }
  },
  "review": {
    "highConfidence": [],
    "reviewCandidates": [],
    "compilerSensitive": []
  }
}
```

## effects と abilities

- `effects`: runtimeが直接扱いやすい基本的な物理効果。
- `abilities`: 複数の `effects` / `receive` / `path` / `release` を組み合わせるための汎用能力。

`abilities` には、`lemonBomb` や `roomSplit` のような絵文字固有名は入れない。絵文字固有のノリは `note` に書き、能力名は複数絵文字で再利用できるものにする。

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
| `warpExit` | 出口候補を固定しないと、次actorとの接続が不安定になる。 |
| `magnetPull` | 引力が強すぎるとボールが吸着して止まりやすい。 |

## 431-580 profiled queue メモ

- `💂` 系: 衛兵として `reflectShield` / `stillHold` / `pushRedirect`。守る・止める挙動を明確化。
- `🖐️` 系: 開いた掌で受け止めるため、`reflectShield` / `pushRedirect` / `stillHold` に寄せた。
- `👜`: バッグにしまう連想から `absorbHold` / `delayedRelease` / `softLanding`。
- `🤝`: 握手の「つなぐ」意味から `chainPass` / `attractHold` / `softLanding`。
- `🧑‍⚕️` 系: 攻撃ではなく安全化。`softLanding` / `slowDampen` / `aimAssist`。
- `🙉`: 耳を塞ぐため `silenceHold` / `slowDampen` / `fakeRoute`。
- `🧑‍⚖️` 系: 判定して正しい方向へ通すため `precisionPass` / `stillHold` / `pushRedirect`。
- `🦵` 系: 脚の蹴り・踏み出しから `impactLaunch` / `dashCarry` / `pushRedirect`。
- `🫁`: 吸う・吐く循環から `breathLaunch` / `flowCarry` / `slowDampen`。
- `🧙` 系: 魔法として `warpExit` / `lowGravityField` / `curveRedirect`。`warpExit` はcompilerSensitive。
- `👨‍🎨` 系: 描画線を `paintTrail` として使う。
- `👨‍🚀` 系: 低重力・周回・狙い補正を継承。
- `🚴` 系: 車輪で `rollCarry`、走行で `dashCarry`、安定化に `precisionPass`。
- `⛹️` 系: 弾ませる動作から `popLaunch` / `randomBounce` / `aimAssist`。
- `🙇` 系: お辞儀の沈み込みを `dropRelease` / `softLanding` / `slowDampen` にした。
- `🤸` 系: 側転の回転を `spinRedirect` / `orbitCarry` / `popLaunch` にした。
- `🧗` 系: 掴んで登るため `grabHold` / `aimAssist` / `slowDampen`。
- `👷‍♂️` / `👨‍🏭` 系: 現場・機械作業として、受け止め・正確な押し出しに寄せた。
- `👨‍🍳` 系: フライパン返しから `heatLift` / `popLaunch` / `curveRedirect`。
- `🕺` 系: ダンスのステップと回転から `spinRedirect` / `curveRedirect` / `lightBoost`。
- `🕵️` 系: 探偵として `hiddenRoute` / `aimAssist` / `precisionPass`。`hiddenRoute` はcompilerSensitive。
- `🧞‍♂️`: ジーニーとして `warpExit` / `lowGravityField` / `luckyRedirect`。
- `🙅` 系: 拒否ジェスチャーで受け止め、横へ押し返す。
- `🙆‍♂️`: OKの輪で通してよい方向へ曲げる。

## 281-430 profiled queue メモ

- `🤙` 系: 親指と小指の形をフックにして、`curveRedirect` / `snapLaunch` / `aimAssist` にした。
- `🧒` / `👧` 系: 人物分類にはせず、子どもらしい小走りと軽い受け渡しとして `dashCarry` / `softLanding` に寄せた。review候補。
- `🚸`: 標識なので、安全ゲートとして `slowDampen` / `softLanding` / `pushRedirect` に寄せた。
- `👏` 系: 両手で挟む衝撃を拍手パルスとして `pulseBoost` / `popLaunch` / `impactLaunch` にした。
- `👷` / `🧑‍🏭` 系: ヘルメット・工場機械の連想から、受け止めて安全方向または直線方向へ押し出す。
- `🧑‍🍳` / `🍳`: フライパン返しと熱から `heatLift` / `popLaunch` / `curveRedirect` にした。
- `🍚`: 粘りで勢いを吸収するため `slowDampen` / `softLanding` にした。
- `🍪` / `🌽` / `🥠`: 割れ・粒・中身の連想から `splitScatter` を採用。compilerSensitiveとして要注意。
- `🤞` 系: 幸運のジェスチャーとして `luckyRedirect` を使うが、強すぎない補正に留める。
- `🧏` / `👂` / `🦻` 系: 聴覚・補聴の連想から、静音化・狙い補正・精密パスに寄せた。
- `🧝` / `🧚` / `🧞`: ファンタジー系は低重力・曲線・ワープに寄せたが、`warpExit` は実装要注意。
- `👪` 以降の家族系: 多人数を `multiExit` ではなく `chainPass` / `attractHold` / `softLanding` に抑え、実装の複雑化を避けた。
- `🧑‍🌾`: 農作業として `growthLift` / `flowCarry` / `slowDampen` にした。
- `🙏` 系: 祈り・静止感から `stillHold` / `softLanding` / `delayedRelease` にした。
- `🦶` 系: 足として `impactLaunch` / `pushRedirect` / `dashCarry`。明確な蹴りギミック。
- `⚙️`: 歯車として `spinRedirect` / `precisionPass` / `pushRedirect` にした。
- `💂`: 衛兵として `reflectShield` / `stillHold` / `pushRedirect` にした。

## 231-280 profiled queue メモ

- `👶` / `👶` 肌色差分: 強い発射ではなく `softLanding` / `slowDampen` / `delayedRelease` に寄せた。赤ちゃんらしい軽さと安全性を優先。
- `👼` 系: 羽と輪から `lowGravityField` / `reflectShield` を採用。天使性が明確なので確信度は高め。
- `🍼`: 哺乳瓶の中に受けて傾けて流すため、`absorbHold` / `flowCarry` が自然。
- `🐤`: 小さく跳ねるひよことして `popLaunch` を採用。過剰な加速ではなく短いポップにする。
- `🚼`: 標識なので直接的な物理性は弱い。安全ゲートとして `softLanding` / `slowDampen` に寄せた。
- `👇` / `👈` / `👉` / `👆` 系: 指差し方向をそのまま `pushRedirect` として扱う。下は `gravityShift`、上は `popLaunch`、左右は `snapLaunch` に寄せた。
- `🐻`: 大きな体で受けて抱え、押し返すため `grabHold` / `impactLaunch` を採用。
- `🦴`: 硬さ・転がり・割れの連想から `rollCarry` / `splitScatter` / `reflectShield` にした。
- `👦` 系: 人物分類タグにはせず、小走りで運ぶ `dashCarry` と軽い `aimAssist` にした。意味が広いためreview候補。
- `🧠`: 判断・神経パルスの連想から `aimAssist` / `timedRelease` / `hiddenRoute` にした。
- `👤` / `👥`: 影として実体を薄くし、`hiddenRoute` / `warpExit` / `multiExit` に寄せた。

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
