# noHand soccer emoji physics profiles 031-130

## 目的

`emoji_catalog_full_ja.json` の先頭30件に続き、次の100件へ物理プロファイルを追加する。

今回も `kind` 的な分類タグは使わず、ボールへの作用・移動・受け渡し・絵文字自身の動きだけを記録する。

## 登録範囲

`emoji_catalog_full_ja.json` の index 30〜129、合計100件。

レビューしやすいよう、25件ずつの分割ファイルにしている。

- `emoji_physics_profiles_031_055.json`
- `emoji_physics_profiles_056_080.json`
- `emoji_physics_profiles_081_105.json`
- `emoji_physics_profiles_106_130.json`

このPRでは既存の `emoji_physics_profiles.json` へ直接マージしない。辞書が育ってきた段階で、compiler / validator 側で複数ファイルを読み込むか、生成スクリプトで統合する想定。

## 基本方針

- `emoji` と `name` だけを参照し、`jaName` / `shopCategory` / `price` は使わない。
- 表情系は抽象化しすぎないが、無理に個別差を作りすぎない。
- スキントーン差分・性別差分は、物理挙動が変わらない場合は同じプロファイルを使う。
- 月・水晶玉・幽霊などは `gravityEffect` / `lowGravity` / `warpEffect` へ寄せる。
- 目・片眼鏡・メガネなどは `trackEffect` / `focusTrack` へ寄せる。
- ハート・キス系は `charmPull` / `kissBoost` を中心にする。

## 今回追加した主な語彙

### path

| 語彙 | 意味 |
|---|---|
| `trackPath` | 狙いを補正しながら進む |
| `vomitFlowPath` | 吐き出すように粘って流れる |
| `fetchCarryPath` | 追いかけてくわえるように運ぶ |
| `glidePath` | 手紙や紙のように滑空する |
| `gallopCarryPath` | 駆け足で運ぶ |

### release

| 語彙 | 意味 |
|---|---|
| `kissPass` | キスや口先で軽く押し出す |
| `tongueFlickPass` | 舌でひっかけて弾く |
| `gestureFlickPass` | 指先・手振りで弾くように渡す |
| `spitPass` | 口から吐き出すように渡す |

### motion

| 語彙 | 意味 |
|---|---|
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

## 将来見直した方が良い絵文字

| 絵文字 | 理由 |
|---|---|
| `😞` | `dropPath + slowEffect` は自然だが、他の落ち込み顔と差が薄い。 |
| `😑` | 無表情を `stillMotion + slowPass` にしたが、効果として地味。 |
| `😶` | 口がないことを `silenceHold` にしたが、ゲーム上の見栄えは要確認。 |
| `☹️` | `frowning` 系が全体的に `dropPath + slowEffect` に寄りやすい。 |
| `😀` / `😃` / `😄` | 笑顔系は `softPass + boostEffect` に寄りやすく、差別化が課題。 |
| `💟` | ハート装飾として `orbitPath` に寄せたが、装飾感の物理化が弱い可能性あり。 |
| `🏩` | `gateReceive + charmPull` はありだが、建物系としては後続の門・建物語彙と整合確認が必要。 |
| `🤟` 系 | 手の形として `gestureFlickPass` にしたが、今後の手・指系プロファイルと統合検討。 |
| `🙍` / `🙍‍♂️` 系 | 表情差分としては正しいが、単体ギミックとしては地味。 |
| `👲` 系 | 今回範囲外。次回、帽子・頭部装飾として何を物理化するか慎重に決める。 |

## 実装メモ

- 031〜130は表情・ハート・視線・キス・スキントーン差分が多いため、似たプロファイルが意図的に多い。
- 無理に全部違う挙動にすると、絵文字と挙動の対応が不自然になる。
- ただし顔系だけではゲーム内の動きが地味になりやすいので、次の動物・物体・食べ物系で強い個性を増やす。
- 次回以降も、既存語彙で自然に表せる場合は既存語彙を優先する。
