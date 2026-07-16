# TRPG(仮題) public data

## Public endpoints

- `/TRPG/data/skills.beta.json`: 全1,141件と共通命令を含む、実際に参照可能なスキルJSON β版
- `/TRPG/data/skills.beta.schema.json`: JSON Schema Draft 2020-12
- `/TRPG/data/skills.beta.manifest.json`: バージョン、容量、チェックサム、分割情報
- `/TRPG(仮題)/`: 開発中のゲーム入口

## Repository storage

GitHub上ではgzip済みカタログを、次の8個のbase64テキストへ分割して保持する。

- `data/skills.beta.json.gz.b64.part-01`
- `data/skills.beta.json.gz.b64.part-02`
- `data/skills.beta.json.gz.b64.part-03`
- `data/skills.beta.json.gz.b64.part-04`
- `data/skills.beta.json.gz.b64.part-05`
- `data/skills.beta.json.gz.b64.part-06`
- `data/skills.beta.json.gz.b64.part-07`
- `data/skills.beta.json.gz.b64.part-08`

`src/server/app.js`が起動後の初回アクセス時に8ファイルを結合し、base64を復号する。復号後のgzipデータをSHA-256で検証し、`Content-Encoding: gzip`を付けて返す。ブラウザやNodeの`fetch()`からは通常のJSONとして参照できる。

`app.js`は公開JSONを実際に読み込み、件数表示と簡易検索を行う最小クライアントである。

## Runtime policy

取得一覧への表示条件、実際の取得条件、発動条件、条件追加効果を分離する。条件判定とイベントフラグ更新はサーバー側resolverが行い、AIの会話解釈では更新しない。

状態異常という独立レイヤーは持たず、毒・麻痺・混乱・能力低下を`debuff`へ統合する。障壁・身代わり・反撃・詠唱・封印・反射などは`specialState`として扱う。

`implementation.status = custom_handler_required`のスキルは構造化データには含まれるが、戦闘シミュレーション前に決定的な個別ハンドラ、または汎用命令への置換が必要である。
