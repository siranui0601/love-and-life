# Spatial Foundation 継続記録 — 2026-09-26

## Checkpoints

- Starting HEAD: `2ef031aeb90f1fc58d333bf989aad6ba3f80ddbc`、`feat/persistent-world-rpg`。既存の未コミット空間作業を回収し、破棄せず継続。
- `deae4ebb94f3eaa2454235ca31ac64ba5c952d93`: 機能地区、街路接続、入口到着、生息地、限定したgeometry移行。remoteへsafe push済み。
- Implementation HEAD: `df81881e2048060dbc5c7cf435eee27449134c4f`: 明示的な住居、出勤・帰宅、生成content/client、画像証跡。実装コミット後のworking treeはclean。
- この記録を追加するコミットが報告用checkpoint。push後の最終SHAとlocal/remote一致はチャットで報告する。main変更・force pushなし。

## 実装の意味

`SPATIAL-FOUNDATION.md` にWorld Design / Level Design / Systemic Spatial Designを分けて記述した。村・王都・交易都市では、生産、輸入、荷受け、市場、旅人、警備、住民が使う施設と動線を定義した。人口レンジは都市を設計する目安であり、実装人口と混同しない。

村・王都・交易都市・犯罪都市・森の5地域に街路loopとapproachがある。描画とNPC通常移動は同じ街路を使用し、平面交差とT字路も接続する。緊急追跡等は衝突回避を優先する。王都の荷捌き囲いと側道は実collision/LOSへ接続した。ただし地区を高密度な市街として完成させたものではない。

R01–R15に地形、交通用途、中継、適性、途中区間の記述とjourney progressを付けた。到着は同一路線の相手側出入口。R08は船のbaselineとして保持する。中間区間の3D traversal、途中下車、同乗、実車両は未完成。貨物は既存の実carrier/journeyを使い、新たな設計flow線そのものは貨物を生成しない。

## 住まい

全111 actorを74の明示的な居住・滞在・拠点レコードへ割り当てた。NPC行番号から機械的にhomeを選ぶ処理を置き換えた。

- 村6棟、王都6棟、交易都市5棟、合計17棟の住宅grayboxを追加。実入口・壁・室内到達位置を持つ。
- フィンと母は同じ家。孤児院の居住者は孤児院。王は城。衛兵は宿舎。職人は店舗併設住居または職場に通う長屋。
- 同じ宿にいる店主、長期借室者、旅人は居住レコードを分ける。出典にない家族関係を同居だけで作らない。
- 行商・使者・巡礼等の一時滞在、野営、亡命先、非人間actorの生息地/格納場所を区別。
- `homeFacilityId / residenceId / roomId / residenceMode` はcanonical authoring。帰宅plannerは実際のhome座標へ歩く。全員のhomeからworkまで到達可能。
- roomIdは生活拠点の区分。個室の壁、戸締り、鍵、賃貸契約、家財所有権まで実装した意味ではない。residence割当から法的所有権を付与しない。
- 既存saveの現在地を新居へresetしない。次の通常帰宅でcanonical homeを使う。立退き中の代替homeは既存の優先関係を維持する。

## 今回見つけた問題

- FORESTという文字中のRESTに施設分類が反応し、川や巣を宿にしていた。token境界で判定するよう修正。
- 汎用事件を目撃済みの住民が同じ現場へ反復移動し、仕事へ戻れなかった。既存の当日観察記録を用いて反復を抑えた。
- 街路の途中交差がgraph上でつながらない、空pathを保持して再探索しない問題を修正。
- 護送テストの旧中心spawn前提では帰路に時間不足。実入口を往復する合法な休息commandの予算を増やした。逮捕・護送の成否を注入していない。
- 夜間帰宅の追加テストは16時開始でplayerを襲撃現場へ放置し、帰宅確認前に倒れていた。夜間通勤テストをmonsterなしの初期content fixtureとして明記して隔離した。これは通常new-gameの生存worldline証明ではない。既存の戦闘・救助回帰は別に通した。

## 検証結果

|検査|結果|範囲|
|---|---|---|
|旧baseline|196 PASS / 0 FAIL / 0 SKIP|既存ログ、今回開始前|
|街路checkpoint world:check|204 PASS / 0 FAIL / 0 SKIP|監査、asset、全suite、build完了|
|住居focused|28 PASS / 0 FAIL / 0 SKIP|空間・occupancy・custody・playability。夜間帰宅追加前|
|最終 `npm run world:check`|**207 PASS / 0 FAIL / 0 SKIP、exit 0**|監査・asset check・全test・client build|
|空間suite|11 PASS|全入口、全home/work、実出勤/帰宅、街路交差、LOS、旅、habitat、geometry移行|
|migration/save/replay|PASS|実v1の5世代、既存v2、JSON分岐、service restart、offline進行なしを含む|
|git diff --check|PASS|空白エラーなし|
|ブラウザgeometry review|PARTIAL|3地域の配置と王都の遮蔽/側道。NPC生活のブラウザ実走ではない|

最終ログ: `tools/trpg-world/reports/spatial-homes-final-check.log`（ローカル検証ログ、Git対象外）。Babylon.js 9.25.0、initial gzip 398280 bytes。生成contentは `world-10d-534227bca032`。reviewed content hashでsave移行を制限し、geometryがbodyを塞ぐ場合のみ8m以内の安全位置へ補正する。過去の観測座標・履歴・所有権を再解釈しない。

## ブラウザ観察

localhostのauthoring viewerがproductionのWorldSceneとcanonical contentを読み込む。開発用の動線線を描くが、simulationを動かしていない。画像は `validation/spatial-2026-09-26/`。

- `farm-residences.png`: 畑・集荷・住宅の間を曲がる複数の道が見える。畑境界/水路/敷地の連続性はまだ弱い。
- `capital-residences.png`: 住宅、市場、荷改めの迂回を確認。現在の密度と街区の囲いでは大都市感は不足。
- `capital-arrival.png` / `capital-side-passage.png`: 到着側で囲いに遮られ、横へ進むと次の通りが見える。巨大都市のvista完成ではなく遮蔽契約の実例。
- `trade-residences.png`: 港から税関・倉庫・陸路への動線と住居を確認。まだ空き地が多く、港湾街区の形態は未完成。
- rendererはinstanceへのreceiveShadows設定警告を出す。今回の動作停止はない。描画品質として後続で整理する。

## 残件と継続地点

P0: 今回の検証で新たな進行不能・データ消失は検出していない。ただしSpatial Foundation全体の完了を意味しない。

P1:

1. 住宅地→食料調達→職場→帰宅の生活圏を、専用の店舗在庫・食事service・日常plannerへ統合する。武器屋、宿、食事場所があることと、全ての用途が遊べることを分けて検証する。
2. 村/王都/交易都市の敷地境界、住宅密度、街区の入口、職住の分離。他8地域の同じ機能設計contractへの展開。
3. 地域外に本拠を持つ旅人の本宅と現在の宿、部屋選択、帰郷を別に扱う。今は一時滞在を明示するところまで。
4. R12/R06等の中間travel space、馬の現在地、実車両・船・御者・乗員・schedule・cargo・途中contact。交通速度倍率だけで終えない。
5. habitatの群れ・移住とmacro時間の整合、軍/船団/物流と同じ空間上の接触。
6. 通常playerのブラウザで通勤・店舗利用・交通・遭遇まで実走する。authoring viewerをその証明としない。

P2: 部屋の仕切り、家財/戸締り/入室許可、地形高低差と遠景reveal、影設定とproxy表現。

次は生活圏と街区を実体化する。5本のDay10攻略固定、最終美術、blind policy微調整へは移らない。

Paid/live LLM calls: **0**。USER DECISION REQUIRED: **なし**。
