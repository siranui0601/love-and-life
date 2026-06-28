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

`jaName` は既存カタログ上で機械翻訳由来の崩れがあるため、プロファイル側では `displayNameJa` として整理した名前を持たせる。巨大カタログ本体の `jaName` 修正は、別PRで機械的に安全な範囲を決めてから行う。

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
    "confidence": 0.8,
    "note": "採用理由"
  }
}
```

### receive

ボールの受け取り方。

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

ボールの移動スタイル。

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

### release

次への渡し方・放ち方。

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

### motion

絵文字自身の動き。

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

### effects

ボールへ与える物理効果。

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

## 現在の登録範囲

`emoji_catalog_full_ja.json` の先頭30件。

- `👽 alien`
- `👾 alien monster`
- `🫀 anatomical heart`
- `😠 angry face`
- `👿 angry face with horns`
- `😧 anguished face`
- `😰 anxious face with sweat`
- `😲 astonished face`
- `😁 beaming face with smiling eyes`
- `💓 beating heart`
- `🖤 black heart`
- `💙 blue heart`
- `🥣 bowl with spoon`
- `🥊 boxing glove`
- `💔 broken heart`
- `🤎 brown heart`
- `🐱 cat face`
- `😹 cat with tears of joy`
- `😼 cat with wry smile`
- `🤡 clown face`
- `🥶 cold face`
- `😖 confounded face`
- `😕 confused face`
- `💑 couple with heart`
- `👨‍❤️‍👨 couple with heart: man, man`
- `👩‍❤️‍👨 couple with heart: woman, man`
- `👩‍❤️‍👩 couple with heart: woman, woman`
- `🐮 cow face`
- `🤠 cowboy hat face`
- `😿 crying cat`

## 将来見直した方が良い絵文字

| 絵文字 | 理由 |
|---|---|
| `😧` | 物理的な連想が弱く、`dropPath + slowEffect` がやや暫定的。 |
| `😁` | 笑顔の物理化が抽象的で、`boostEffect` が強引に見える可能性あり。 |
| `🤎` | 茶色から土・重さへ寄せたが、絵文字単体の意味としては弱い。 |
| `😖` | 混乱系の顔は `zigzagPath` に寄りやすく、他の困惑顔との差別化が課題。 |
| `😕` | `tiltMotion + curveEffect` は自然だが、効果としては地味。 |
| `🐮` | 牛顔のみで「頭で押す」まで行くのが少し解釈寄り。大型動物系で再検討。 |

## 実装メモ

- まずは辞書を育てる段階なので、runtime本体にはまだ接続しない。
- 50〜100件ほど溜まった時点で、validatorとcompiler stubを作る。
- compilerは `receive → path → release → motion/effects` を phase に変換する。
- `kind` 的な分類タグは最後まで入れない。
- 似た意味の新語彙を増やす前に、この.mdの語彙表を必ず確認する。
