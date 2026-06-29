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

`ability_specs.json` の `occurrences` / `examples` は runtime profiles と `.profiled.json` の集計値に同期する。手作業更新ではなく次を使う。

```bash
node tools/nohand/sync_ability_specs.mjs
node tools/nohand/sync_ability_specs.mjs --check
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

- 236-280: `tools/nohand/profile_queue/catalog_0236_0280.profiled.json` 作成済み。runtime JSON には未統合。
- 281-330: `tools/nohand/profile_queue/catalog_0281_0330.profiled.json` 作成済み。runtime JSON には未統合。
- 331-380: `tools/nohand/profile_queue/catalog_0331_0380.profiled.json` 作成済み。runtime JSON には未統合。
- 381-430: `tools/nohand/profile_queue/catalog_0381_0430.profiled.json` 作成済み。runtime JSON には未統合。
- 431-480: `tools/nohand/profile_queue/catalog_0431_0480.profiled.json` 作成済み。runtime JSON には未統合。
- 481-530: `tools/nohand/profile_queue/catalog_0481_0530.profiled.json` 作成済み。runtime JSON には未統合。
- 531-580: `tools/nohand/profile_queue/catalog_0531_0580.profiled.json` 作成済み。runtime JSON には未統合。
- 581-630: `tools/nohand/profile_queue/catalog_0581_0630.profiled.json` 作成済み。runtime JSON には未統合。
- 631-680: `tools/nohand/profile_queue/catalog_0631_0680.profiled.json` 作成済み。runtime JSON には未統合。
- 681-730: `tools/nohand/profile_queue/catalog_0681_0730.profiled.json` 作成済み。runtime JSON には未統合。
- 731-780: `tools/nohand/profile_queue/catalog_0731_0780.profiled.json` 作成済み。runtime JSON には未統合。
- 781-830: `tools/nohand/profile_queue/catalog_0781_0830.profiled.json` 作成済み。runtime JSON には未統合。
- 831-880: `tools/nohand/profile_queue/catalog_0831_0880.profiled.json` 作成済み。runtime JSON には未統合。
- 881-930: `tools/nohand/profile_queue/catalog_0881_0930.profiled.json` 作成済み。runtime JSON には未統合。
- 931-980: `tools/nohand/profile_queue/catalog_0931_0980.profiled.json` 作成済み。runtime JSON には未統合。
- 981-1030: `tools/nohand/profile_queue/catalog_0981_1030.profiled.json` 作成済み。runtime JSON には未統合。
- 1031-1080: `tools/nohand/profile_queue/catalog_1031_1080.profiled.json` 作成済み。runtime JSON には未統合。
- 1081-1130: `tools/nohand/profile_queue/catalog_1081_1130.profiled.json` 作成済み。runtime JSON には未統合。
- 1131-1180: `tools/nohand/profile_queue/catalog_1131_1180.profiled.json` 作成済み。runtime JSON には未統合。
- 次の候補: `tools/nohand/profile_queue/catalog_1181_1230.pending.json`。

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

## 881-1180 profiled queue メモ

- `🥭` 系: 柔らかい果実として `softLanding` / `slowDampen` / `flowCarry`。潰れる・流れる比喩に留め、爆発や強反射には寄せない。
- `🕰️` 系: 時計として `timedRelease` / `delayedRelease` / `stillHold`。時間差保持はcompiler-sensitiveとしてreviewに残す。
- `🦽` / `🧑‍🦽` 系: 手動車椅子は `rollCarry` / `precisionPass` / `softLanding`。車輪で運ぶが人物系なので過剰加速は避ける。
- `🧑‍🦼` 系: 電動車椅子は `rollCarry` / `precisionPass` / `dashCarry`。手動との差分として短い推進だけを足す。
- `👞` 系: 靴は踏み込み・蹴り出しとして `impactLaunch` / `pushRedirect` / `dashCarry`。
- `🦾` / `🦿` 系: 機械腕は `grabHold` / `pushRedirect` / `precisionPass`、機械脚は `impactLaunch` / `dashCarry` / `pushRedirect`。義肢の形状・動作から機械的な保持や推進に限定する。
- `👬` / `🧑‍🤝‍🧑` 系: 手つなぎは `chainPass` / `attractHold` / `softLanding`。複数人物だが分裂ではなく連結搬送として扱う。
- `👯` 系: バニー耳の跳ねとして `popLaunch` / `randomBounce` / `lightBoost`。人物本体ではなく跳ねる動作を弱めに採用。
- `🧜` 系: 人魚・水流として `flowCarry` / `curveRedirect` / `softLanding`。水中の流れで曲げる。
- `🖕` 系: 立った指のバンパーとして `snapLaunch` / `pushRedirect` / `precisionPass`。ジェスチャーの意味ではなく形状の弾きに寄せる。
- `🥷` 系: 忍者は `hiddenRoute` / `dashCarry` / `fakeRoute`。見えない経路はcompiler-sensitiveとしてreviewに残す。
- `👃` 系: 匂い・息の追跡として `aimAssist` / `breathLaunch` / `chaseCatch`。鼻の形状より追跡・呼気の役割を採用。
- `👌` / `🙆` 系: OKの輪やジェスチャーは `aimAssist` / `precisionPass` または `curveRedirect` / `softLanding`。通してよい方向へ整える。
- `👴` / `👵` / `🧓` 系: 高齢者は `slowDampen` / `stillHold` / `softLanding`。人物・外見系なので落ち着いた弱効果に抑える。
- `🚔`: 対向パトカーは `reflectShield` / `chaseCatch` / `pushRedirect`。追跡と制止の車両ギミック。
- `👐` / `🫂` / `🤼` 系: 開いた両手は `attractHold` / `softLanding` / `pushRedirect`、ハグは `attractHold` / `absorbHold` / `softLanding`、レスリングは `grabHold` / `pushRedirect` / `randomBounce`。保持系でも必ず押し出し・着地を持たせる。
- `🚴` / `🚵` 系: 自転車は `rollCarry` / `dashCarry` / `precisionPass`、マウンテンバイクは凹凸の `randomBounce` を足す。
- `⛹️` / `🤾` / `🤽` 系: ボール競技は弾ませ・投げ・水流をそれぞれ `popLaunch` / `randomBounce` / `aimAssist`、`impactLaunch` / `aimAssist` / `curveRedirect`、`flowCarry` / `popLaunch` / `aimAssist` に整理。
- `🙇` / `🤸` / `🧗` 系: お辞儀は `dropRelease` / `softLanding` / `slowDampen`、側転は `spinRedirect` / `orbitCarry` / `popLaunch`、登る動作は `grabHold` / `aimAssist` / `slowDampen`。動作由来の差分に限定する。
- `🧑‍🍼`: 授乳・哺乳瓶の流れとして `flowCarry` / `softLanding` / `delayedRelease`。人物属性ではなく瓶からの流れを採用。
- `🤺` / `🙅`: フェンシングは `precisionPass` / `pushRedirect` / `reflectShield`、NOジェスチャーは `reflectShield` / `pushRedirect` / `stillHold`。細い突きと拒否の制止で差別化。
- `💇` / `💆`: 散髪は `precisionPass` / `slowDampen` / `softLanding`、マッサージは `slowDampen` / `softLanding` / `stillHold`。人物・髪型系の過剰能力化を避ける。
- `🏌️` / `🏋️`: ゴルフは `impactLaunch` / `precisionPass` / `curveRedirect`、重量挙げは `heavyBlock` / `impactLaunch` / `pushRedirect`。スポーツ道具・重量から自然な物理だけを採用。
- `🛌` / `🧘` / `🧖` / `🕴️`: 睡眠は `sleepFloat` / `softLanding` / `slowDampen`、瞑想は `stillHold` / `silenceHold` / `softLanding`、湯気は `flowCarry` / `slowDampen` / `softLanding`、浮遊は `lowGravityField` / `stillHold` / `softLanding`。長時間停止・低重力はテンポ管理に注意。
- `🤵` / `🤹` / `🧎`: タキシードは `precisionPass` / `softLanding` / `aimAssist`、ジャグリングは `orbitCarry` / `popLaunch` / `aimAssist`、ひざまずきは `stillHold` / `softLanding` / `slowDampen`。人物系は動作や姿勢から控えめに採用。
- `🙎` / `🙋` / `🚣`: ふくれっ面は `slowDampen` / `dropRelease` / `softLanding`、挙手は `popLaunch` / `aimAssist` / `softLanding`、ボート漕ぎは `flowCarry` / `pushRedirect` / `precisionPass`。感情・ジェスチャーは弱め、道具や水流は搬送に使う。

## 731-880 profiled queue メモ

- `🚣` 系: オールで水を押すため `flowCarry` / `pushRedirect` / `precisionPass`。前回の `🚣‍♂️` と同じ安定搬送。
- `🏃` 系: 走る勢いを `dashCarry` / `aimAssist` / `lightBoost` にし、短い加速搬送に留めた。
- `👨‍🔬` 系: 実験・観察の比喩から `aimAssist` / `precisionPass` / `delayedRelease`。強いランダム実験にはしない。
- `🤷` 系: 分からない仕草として `fakeRoute` / `randomBounce` / `softLanding`。意味が抽象的なのでreview候補。
- `👨‍🎤` 系: 歌声の息と音波から `breathLaunch` / `pulseBoost` / `aimAssist`。
- `🧍` 系: 立ち止まる姿勢を `stillHold` / `softLanding` / `pushRedirect` にした。人物単体なので弱め。
- `👨‍🎓` 系: 学習・確認として `aimAssist` / `precisionPass` / `delayedRelease`。review候補。
- `🦸` 系: ヒーローの飛行・防御として `impactLaunch` / `reflectShield` / `lowGravityField`。
- `🦹` 系: 悪役として `trapHold` / `fakeRoute` / `poisonDampen`。妨害寄りだが、ワープや分裂は使わず抑制。
- `🏄` 系: 波乗りとして `flowCarry` / `curveRedirect` / `softLanding`。
- `🏊` 系: 泳ぎの推進力として `flowCarry` / `dashCarry` / `curveRedirect`。
- `👨‍🏫` 系: 教える・導く役割から `aimAssist` / `precisionPass` / `delayedRelease`。
- `👨‍💻` 系: 入力・デバッグの比喩から `precisionPass` / `aimAssist` / `delayedRelease`。
- `💁` 系: 差し出す手を案内として扱い、`aimAssist` / `curveRedirect` / `softLanding`。
- `🧛` 系: 吸血鬼として `absorbHold` / `chaseCatch` / `poisonDampen`。
- `🚶` 系: 歩行として弱い `dashCarry` / `softLanding` / `aimAssist`。走る系より控えめ。
- `👳` 系: 巻いた布の連想から `wrapHold` / `curveRedirect` / `softLanding`。意味が弱いためreview候補。
- `👰‍♂️` 系: ベールで包む連想から `wrapHold` / `softLanding` / `delayedRelease`。
- `👨‍🦯` 系: 白杖で進路を探るため `aimAssist` / `precisionPass` / `softLanding`。
- `🧟‍♂️`: ゾンビとして `chaseCatch` / `slowDampen` / `poisonDampen`。
- `👨` 髪型・肌色差分: 人物分類タグにはせず、髪型の形状から最小限の物理差分にした。坊主頭は軽い反射、ひげは弱い絡め取り、金髪は弱い光補正、巻き毛は回転補正、赤毛は弱い勢い、白髪は減速・静止。全体的にreview候補。

## 581-730 profiled queue メモ

- `🙆` 系: OKの輪として `aimAssist` / `curveRedirect` / `softLanding`。通してよい方向へ曲げる。
- `💇` 系: 散髪の精密な調整から `precisionPass` / `slowDampen` / `softLanding`。切断ではなく余分な勢いを整える解釈に抑えた。
- `💆` 系: マッサージの緩和から `slowDampen` / `softLanding` / `stillHold`。
- `🏌️` 系: ゴルフクラブのスイングとして `impactLaunch` / `precisionPass` / `curveRedirect`。
- `💂` / `👮` 系: 守る・制止する役割として `reflectShield` / `pushRedirect` / `precisionPass` または `stillHold`。
- `👨‍⚕️` 系: 攻撃ではなく安全化。`softLanding` / `slowDampen` / `aimAssist`。
- `🧘` 系: 瞑想の静止感として `stillHold` / `silenceHold` / `softLanding`。
- `👨‍🦽` / `👨‍🦼` 系: 車輪で安全に運ぶ。手動は `rollCarry` / `precisionPass` / `softLanding`、電動は `rollCarry` / `precisionPass` / `dashCarry`。
- `🧖` 系: 湯気の流れで包み、`flowCarry` / `slowDampen` / `softLanding`。
- `🤵` 系: 礼装の整った所作として `precisionPass` / `softLanding` / `aimAssist`。意味が抽象的なのでreview候補。
- `👨‍⚖️` 系: 判定して正しい方向へ通すため `precisionPass` / `stillHold` / `pushRedirect`。
- `🤹` 系: ジャグリングの周回軌道から `orbitCarry` / `popLaunch` / `aimAssist`。`multiExit` は使わず実装負荷を抑えた。
- `🧎` 系: 低姿勢で受け止めるため `stillHold` / `softLanding` / `slowDampen`。
- `🏋️` 系: 重量挙げとして `heavyBlock` / `impactLaunch` / `pushRedirect`。
- `🧙` 系: 魔法として `warpExit` / `lowGravityField` / `curveRedirect`。`warpExit` はcompilerSensitive。
- `👨‍🔧` 系: 工具で噛み合わせを調整し、`spinRedirect` / `precisionPass` / `pushRedirect`。
- `🚵` 系: 山道の凹凸を小さな `randomBounce` としつつ、`rollCarry` / `dashCarry` で運ぶ。
- `👨‍💼` 系: 会社員は抽象的なので、整理・確認の比喩で `precisionPass` / `delayedRelease` / `aimAssist`。review候補。
- `👨‍✈️` 系: 操縦として `precisionPass` / `curveRedirect` / `aimAssist`。
- `🤾` 系: 手で掴んで投げるため `impactLaunch` / `aimAssist` / `curveRedirect`。
- `🤽` 系: 水球として `flowCarry` / `popLaunch` / `aimAssist`。
- `🙎` 系: ふくれっ面の重さとして `slowDampen` / `dropRelease` / `softLanding`。顔・感情系に近いためreview候補。
- `🙋` 系: 挙手の上方向の動きとして `popLaunch` / `aimAssist` / `softLanding`。
- `🚣‍♂️`: オールで水を押すため `flowCarry` / `pushRedirect` / `precisionPass`。

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
