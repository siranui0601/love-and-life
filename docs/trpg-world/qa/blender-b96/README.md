# 王都 B96 分散高低差アクセス：未受入の実制作記録（2026-10-10）

## 結論
**WIP / NOT ACCEPTED.** B94を土台とする別案B96。貴族街の東側に、既存西側アクセスから約260m離れた巻上機牽引の貨物用45°級斜路と独立した折返し階段をBlender実メッシュとして追加した。古いB23/B75/B82は変更しない。B95は前段の失敗試案として別保存。巨大な立体都市としての完成認定は不可。

## 実データ
- PC保存：C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b96
- モデル：capital-parcel-review.blend（約47MB）
- ベース：design-b94。正本施設12個のIDは変更なし
- noble_east_winch_incline：約66.16m、42m→78m、幅10m、36m上昇の急勾配輸送路。牽引機構のruntimeは未実装
- noble_east_wall_stair：約130.66m、42m→78m、幅4m、折返し＋踊り場を設けた歩行者ルート
- 一般住宅敷地5個を再編。正本施設は移動・削除なし
- 5枚の視点/俯瞰画像を保存

## 自動検証
- 通常時：1172 routes、1 component、centrelineConnectivityPass=true、階段プロファイル検査PASS
- 増水時：1171 routes、1 component、同PASS
- B96新規2路のみの実mesh rayテスト：胴体/頭上の遮断0。床支持は15箇所 FAIL。
- B94にもwest_noble_wall_stairsの床支持失敗2箇所あり。解決済みと見なさない
- 検証限界：連続capsule、荷車旋回、巻上機の状態、手動プレイヤー歩行、NPCの交通需要は未検証。

## 目線画像レビュー
Noble-east-cargo-eye.pngは構造上の通路を写せる一方、擁壁が大きく画面を占める。Noble-east-ped-eye.pngでは階段が空中に浮いた構図となり、断面支持・壁取り合いが不十分。Noble-east-upper-eye.pngは近接部材にほぼ視界を塞がれる。参考画像の「街路と段丘を一体に持つ生きた都市」にはまだ達していない。

## 次に必要な修正
1. B97は断面計画に戻って石壁・市街の接続を一体再設計する。浮いた階段や薄い橋梁状の斜路を撤去・埋め戻し・支持し、壁沿いと地区内に馴染ませる。
2. distributed-mesh-audit.json の床支持FAIL15箇所を全解消し、B94の既存2箇所も修正する。
3. 階段・貨物台・荷解き・迂回を共通の道路graph上で成立させ、周辺街区への接続を実際に歩行する。
4. 多数NPC/店舗は最終的に増設する方針。ただしTRPGスプレッドシート正本を、この試作で勝手に書き換えない。
5. 俯瞰・複数目線・主要経路の実歩行とゲームruntime、全施設到達性を検証してから受入を判断する。

## 安全な保存
- B23 GUIの未保存状態は保護。B75/B82/B94/B95は触れない。
- 本制作は design-b96 を新設。大型.blendや数十MBのparcels.json/plan.jsonはPCに残す。
- Draft PR #342上へコードと検証結果・画像だけをWIPとして保存。本番へは反映しない。
