# TRPG(仮題) public data

## Directory and public routes

The only physical game directory is `public/TRPG`.

- `/TRPG/`: direct development path
- `/TRPG(仮題)/`: public title alias served from the same directory

Do not recreate `public/TRPG(仮題)`. The Japanese-title URL is mounted by `src/server/app.js`.

## Public endpoints

- `/TRPG/data/skills.beta.json`: 全1,141件と共通命令を含むスキルJSON β版
- `/TRPG/data/skills.beta.health.json`: 読み込み・検証状態、件数、容量、チェックサム
- `/TRPG/data/skills.beta.schema.json`: JSON Schema Draft 2020-12
- `/TRPG/data/skills.beta.manifest.json`: バージョン、容量、チェックサム、分割情報

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

`src/server/app.js`は自身のモジュール位置からプロジェクトルートを解決するため、PM2の`cwd`に依存しない。初回アクセス時に8ファイルを結合し、base64復号、SHA-256検証、gzip展開、JSON構造検証を行う。検証済みの通常JSONをメモリへキャッシュして返す。

手動で`Content-Encoding: gzip`を付けたレスポンスは使わない。リバースプロキシやモバイルブラウザでの二重圧縮・展開不整合を避けるためである。

`app.js`は最初にhealth endpointを確認し、その後カタログを読み込んで件数表示と簡易検索を行う。

## Runtime policy

取得一覧への表示条件、実際の取得条件、発動条件、条件追加効果を分離する。条件判定とイベントフラグ更新はサーバー側resolverが行い、AIの会話解釈では更新しない。

状態異常という独立レイヤーは持たず、毒・麻痺・混乱・能力低下を`debuff`へ統合する。障壁・身代わり・反撃・詠唱・封印・反射などは`specialState`として扱う。

`implementation.status = custom_handler_required`のスキルは構造化データには含まれるが、戦闘シミュレーション前に決定的な個別ハンドラ、または汎用命令への置換が必要である。
