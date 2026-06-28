# noHand soccer emoji physics profiles

## 目的

`emoji_catalog_full_ja.json` に含まれる絵文字へ、サッカー用ピタゴラ装置としての物理プロファイルを付与する。

ここで扱う語彙は、分類タグではなく、ボールへの作用・移動・受け渡し・絵文字自身の動きに限定する。

## 参照するカタログ項目

使う項目:

- `emoji`
- `name`

無視する項目:

- `jaName`
- `shopCategory`
- `price`

`jaName` は既存カタログ上で機械翻訳由来の崩れがあるため、プロファイル側では `displayNameJa` として整理した名前を持たせる。

## 禁止するタグ方針

以下のような分類・種類タグはプロファイルに入れない。

- `animal`
- `food`
- `camera`
- `space`
- `person`
- `tool`
- `face`
- `symbol`
- `vehicle`

判断基準は次の1点。

> この語彙は「ボールをどう動かすか」を説明しているか？

説明していないものは、実装用プロファイル語彙にしない。

## ファイル構成

正式プロファイル関連ファイルは次の2つだけに統合する。

- `emoji_physics_profiles.json`
- `emoji_physics_profiles.md`

PR #226では、レビュー用の追加バッチとして `emoji_physics_profiles_131_180_draft.json` を一時的に置いている。レビュー後、正式取り込み時には `emoji_physics_profiles.json` へ統合し、このdraftファイルは削除する。

## JSON形式

`emoji_physics_profiles.json` は、人間が直接レビューできる展開済みJSONとして管理する。

- `storage` や `gzip+base64` は使わない。
- `profiles` は絵文字をキーにしたオブジェクト。
- GitHub上で差分を追いやすいよう、1絵文字を1行のプロファイルとして並べる。

```json
{
  "version": 1,
  "sourceCatalog": "public/noHand_soccer/emoji_catalog_full_ja.json",
  "profileRange": { "startIndex": 0, "count": 130 },
  "rules": { ... },
  "profiles": {
    "👽": { "sourceName": "alien", "displayNameJa": "宇宙人", ... }
  }
}
```

## 現在の登録範囲

正式登録済み: `emoji_catalog_full_ja.json` の先頭130件。

レビュー中: index 130〜179、50件。

- 001-030: 初期バッチ
- 031-055: 泣き顔、水晶玉、目、投げキス、医療系の顔など
- 056-080: 目回し、月、幽霊、手袋、笑顔系など
- 081-105: ハート、キス、ラブユーの手など
- 106-130: ラブユー手の肌色差分、facepalm、frowning、猿・ねずみ・口・新月など
- 131-180 draft: オレンジハート、パーティー顔、person facepalming/frowning、帽子の人、豚、うんち、プードル、8ボール、ドクロ、眠り、天使の輪、ハート目、角つき笑顔など

## プロファイル形式

各プロファイルは次の形式。

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

## effects と abilities の違い

- `effects`: runtimeが直接扱いやすい基本的な物理効果。
- `abilities`: 複数のeffects / receive / path / releaseを組み合わせるための汎用能力。

`abilities` には、`lemonBomb` や `roomSplit` のような絵文字固有名は入れない。絵文字固有のノリは `note` に書き、能力名は複数絵文字で再利用できるものにする。

例:

- `🍋` や `🎇` に使えそうな能力は `burstScatter` / `splitScatter`。
- `🏩` に使えそうな能力は `trapHold` / `hiddenRoute` / `multiExit` / `splitScatter` / `delayedRelease`。

## 語彙表

### receive

| 語彙 | 意味 |
|---|---|
| `softCatch` | 柔らかく受ける |
| `grabCatch` | 掴む |
| `coilCatch` | 巻きついて受ける |
| `trapCatch` | 挟む・閉じ込める |
| `bounceReceive` | 跳ねて受ける |
| `blockReceive` | 受け止めて反射する |
| `gateReceive` | 通過させる |
| `absorbCatch` | 吸収する |

### path

| 語彙 | 意味 |
|---|---|
| `straightPath` | 直線 |
| `arcPath` | 弧 |
| `curvePath` | 曲線 |
| `snakePath` | 蛇行軌道 |
| `snakeCarry` | 蛇行しながら運ぶ |
| `tentaclePull` | 触手で引く |
| `orbitPath` | 周回 |
| `flowPath` | 流れる |
| `slidePath` | 滑る |
| `rollPath` | 転がる |
| `dropPath` | 落ちる |
| `liftPath` | 持ち上がる |
| `warpPath` | 転移する |
| `floatPath` | 浮遊する |
| `pulsePath` | 脈動しながら進む |
| `pullPath` | 引き寄せられる |
| `splitPath` | 分かれる |
| `zigzagPath` | 左右にカクカク動く |
| `slowCarryPath` | ゆっくり運ぶ |
| `trackPath` | 狙いを補正しながら進む |
| `vomitFlowPath` | 吐き出すように粘って流れる |
| `fetchCarryPath` | 追いかけてくわえるように運ぶ |
| `glidePath` | 手紙や紙のように滑空する |
| `gallopCarryPath` | 駆け足で運ぶ |

### release

| 語彙 | 意味 |
|---|---|
| `softPass` | やさしく渡す |
| `arcPass` | 弧を描いて渡す |
| `directPass` | 直線で渡す |
| `curvePass` | 曲線で渡す |
| `snapRelease` | 溜めて弾く |
| `slingshotPass` | しならせて射出 |
| `launchShot` | 強く射出 |
| `burstRelease` | 爆発的に放つ |
| `splitRelease` | 分裂させて放つ |
| `reverseRelease` | 逆方向へ返す |
| `panicRelease` | 慌てて不規則に弾く |
| `popRelease` | ポンと弾く |
| `scoopPass` | すくって渡す |
| `slowPass` | 減速させて渡す |
| `pushPass` | 押し出して渡す |
| `kissPass` | キスや口先で軽く押し出す |
| `tongueFlickPass` | 舌でひっかけて弾く |
| `gestureFlickPass` | 指先・手振りで弾くように渡す |
| `spitPass` | 口から吐き出すように渡す |

### motion

| 語彙 | 意味 |
|---|---|
| `hopMotion` | 跳ねる |
| `swingMotion` | 振る |
| `tentacleSwing` | 触手を振る |
| `slitherMotion` | 蛇行する |
| `spinMotion` | 回る |
| `floatMotion` | 浮く |
| `shakeMotion` | 震える |
| `slideMotion` | 横滑りする |
| `dashMotion` | 突進する |
| `openCloseMotion` | 開閉する |
| `flashMotion` | 光る |
| `pulseMotion` | 脈打つ |
| `popMotion` | ポンと跳ねる |
| `punchMotion` | 打つ |
| `crackMotion` | 割れる |
| `tiltMotion` | 傾く |
| `nodMotion` | うなずく・頭で押す |
| `diveMotion` | 潜る |
| `roarMotion` | 吠える・息を吐く |
| `dripMotion` | 垂れる |
| `stillMotion` | 静止する |
| `focusMotion` | 狙いを定める |
| `steamMotion` | 蒸気を吹く |
| `tongueMotion` | 舌を伸ばす |
| `coverMotion` | 手や物で覆う |
| `bandageWrapMotion` | 包帯で巻く |
| `ribbonWrapMotion` | リボンで包む |
| `gestureFlickMotion` | 指先で弾く |
| `noseExtendMotion` | 鼻を伸ばす |
| `facepalmMotion` | 顔を覆う |
| `scurryMotion` | 小走りに動く |

### effects

| 語彙 | 意味 |
|---|---|
| `holdEffect` | 一時保持 |
| `pullEffect` | 引き寄せ |
| `pushEffect` | 押し出し |
| `curveEffect` | 軌道を曲げる |
| `boostEffect` | 加速 |
| `slowEffect` | 減速 |
| `gravityEffect` | 重力変更 |
| `lowGravity` | 低重力 |
| `burstEffect` | 爆発 |
| `splitEffect` | 分裂 |
| `warpEffect` | 転移 |
| `trackEffect` | 照準補正・追尾 |
| `shieldEffect` | 反射・防御 |
| `pulseEffect` | 鼓動・脈動で小刻みに押す |
| `charmPull` | ハート系の引き寄せ・吸着 |
| `crackSplit` | 割れることで分裂させる |
| `rageBurst` | 怒りで爆発的に弾く |
| `panicJolt` | 驚き・不安で急に跳ねさせる |
| `freezeSlow` | 冷気で減速・滑走化する |
| `clownBounce` | 予測不能なコミカル反発 |
| `flowEffect` | 液体・涙などで流す |
| `electricEffect` | 電気的に加速・痺れさせる |
| `dizzySpin` | めまい・星回りで回転させる |
| `fireBreath` | 炎や息で強く押し出す |
| `monocleAim` | 片眼鏡のように精密照準する |
| `steamBurst` | 蒸気で瞬間的に押す |
| `heatMeasure` | 熱を測るように一瞬抑える |
| `silenceHold` | 音も動きも抑えて保持する |
| `luckyBounce` | 幸運っぽく軽快に跳ねる |
| `growBoost` | 成長・膨張で持ち上げる |
| `arrowShot` | 矢のように直線射出する |
| `heatBoost` | 熱気で持ち上げる・加速する |
| `hugHold` | 抱きしめるように保持する |
| `kissBoost` | キスで軽く吸着・押し出しを行う |
| `tensionHold` | 歯を食いしばるように一瞬こらえる |
| `coinMagnet` | 金貨・お金の磁力のように引き寄せる |
| `poisonSlow` | 毒・気持ち悪さで粘って減速させる |
| `focusTrack` | 計算・注視で精密に照準補正する |

### abilities

| 語彙 | 意味 |
|---|---|
| `absorbHold` | 吸い込んで一時保持する |
| `aimAssist` | 次の対象へ狙いを補正する |
| `attractHold` | 引き寄せて保持する |
| `breathLaunch` | 息や噴出で射出する |
| `burnBoost` | 熱や火で加速する |
| `burstScatter` | 中心から放射状に飛ばす |
| `chainPass` | 連鎖的に渡す |
| `chaseCatch` | 追いかけて捕まえる |
| `curveRedirect` | 曲線的に方向転換する |
| `dashCarry` | 突進しながら運ぶ |
| `delayedRelease` | 時間差で放つ |
| `diveDrop` | 潜るように下へ運ぶ |
| `dropRelease` | 下へ落として放つ |
| `electricJolt` | 電撃で弾く |
| `fakeRoute` | フェイント軌道を作る |
| `flowCarry` | 流れで運ぶ |
| `freezeSlip` | 凍結・滑走させる |
| `glideCarry` | 滑空して運ぶ |
| `grabHold` | 掴んで一時保持する |
| `gravityShift` | 重力方向を変える |
| `growthLift` | 膨張・成長で持ち上げる |
| `heatLift` | 熱気で持ち上げる |
| `heavyBlock` | 重く受け止める |
| `hiddenRoute` | 見えない経路を通す |
| `hookPull` | 引っかけて引く |
| `impactLaunch` | 衝撃で強く射出する |
| `lightBoost` | 軽い勢いを足す |
| `lowGravityField` | 低重力領域を作る |
| `luckyRedirect` | 予測しづらい好転方向へ曲げる |
| `magnetPull` | 磁力のように引き寄せる |
| `multiExit` | 複数出口から出す |
| `orbitCarry` | 周回させながら運ぶ |
| `panicKick` | 慌てて不規則に弾く |
| `phaseThrough` | すり抜けさせる |
| `poisonDampen` | 毒や粘りで減速させる |
| `popLaunch` | ポンと射出する |
| `precisionPass` | 精密な直線パスを作る |
| `pulseBoost` | 脈動で押し出す |
| `pushRedirect` | 押して方向転換する |
| `randomBounce` | 予測不能に跳ね返す |
| `reflectShield` | 反射・防御する |
| `rollCarry` | 転がしながら運ぶ |
| `scoopRedirect` | すくって方向転換する |
| `silenceHold` | 静かに保持する |
| `sleepFloat` | 眠るように浮遊・減速させる |
| `slingLaunch` | しならせて射出する |
| `slipFlow` | 滑る液体で流す |
| `slowDampen` | 勢いを減衰させる |
| `snapLaunch` | 溜めて弾く |
| `softLanding` | やわらかく着地・減速させる |
| `spinRedirect` | 回転で方向転換する |
| `splitScatter` | 本体・分身を分けて散らす |
| `stillHold` | 静止して保持する |
| `timedRelease` | タイミングを合わせて放つ |
| `trapHold` | 閉じ込めて保持する |
| `warpExit` | 別地点から出す |
| `wrapHold` | 巻き付けて保持する |
| `zigzagRedirect` | ジグザグに方向転換する |

## 将来見直した方が良い絵文字

| 絵文字 | 理由 |
|---|---|
| `😧` | 物理的な連想が弱く、`dropPath + slowEffect` がやや暫定的。 |
| `😁` / `😀` / `😃` / `😄` | 笑顔系は `lightBoost` に寄りやすく、差別化が課題。 |
| `🤎` | 茶色から土・重さへ寄せたが、絵文字単体の意味としては弱い。 |
| `😖` / `😕` / `😞` / `☹️` | 困惑・落ち込み系は `dropPath` / `slowEffect` / `slowDampen` に寄りやすい。 |
| `🐮` | 牛顔のみで「頭で押す」まで行くのが少し解釈寄り。大型動物系で再検討。 |
| `😶` | 口がないことを `stillHold` / `silenceHold` にしたが、ゲーム上の見栄えは要確認。 |
| `💟` | ハート装飾として `orbitCarry` に寄せたが、装飾感の物理化が弱い可能性あり。 |
| `🏩` | `hiddenRoute` / `multiExit` / `splitScatter` を追加した。建物・ゲート系の基準として後続と整合確認が必要。 |
| `🤟` 系 | 手の形として `grabHold` / `pushRedirect` にした。今後の手・指系プロファイルと統合検討。 |
| `🙍` / `🙍‍♂️` 系 | 表情差分としては正しいが、単体ギミックとしては地味。 |
| `👲` 系 | 帽子・頭部で弾く解釈にした。人物系ではなく装備系として見ているが、今後の帽子系と整合確認。 |
| `💩` | `poisonDampen` は自然だが、ゲーム内で不快になりすぎない演出調整が必要。 |
| `😴` | `sleepFloat` が新規。眠り系の標準能力として妥当か要確認。 |

## 実装メモ

- runtime本体にはまだ接続しない。
- `abilities` は compiler が flow / phase へ変換するための中間語彙。
- compilerは `abilities` を優先し、足りない場合に `effects` / `receive` / `path` / `release` / `motion` で補完する。
- 例: `splitScatter` は `splitEffect` + `burstRelease` + 放射状速度へ変換する。
- 例: `multiExit` は複数の出口候補を作り、次actorまたは安全な出口方向へ渡す。
- 例: `hiddenRoute` は見えない経路演出を挟んで、`warpExit` に近い転送として扱う。
- 131-180 draftは、レビュー後に `emoji_physics_profiles.json` へ統合してdraftファイルを削除する。
- `kind` 的な分類タグは最後まで入れない。
- 似た意味の新語彙を増やす前に、この.mdの語彙表を必ず確認する。
- スキントーン差分・性別差分は、物理挙動が変わらない場合は同じプロファイルを使う。
