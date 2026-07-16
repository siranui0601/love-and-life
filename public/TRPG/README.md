# TRPG(仮題) public data

- `data/skills.beta.json.gz`: 全1,141件と共通命令を含むスキルJSON β版のgzip実体
- `data/skills.beta.schema.json`: JSON Schema Draft 2020-12
- 公開URL `/TRPG/data/skills.beta.json` はサーバーがgzip実体へ `Content-Encoding: gzip` を付けて配信するため、ブラウザ・Nodeから通常のJSONとして参照できる
- `app.js`: 公開JSONを実際に読み込む最小クライアント

## Runtime policy

取得表示条件、取得条件、発動条件、条件追加効果を分離する。条件判定とイベントフラグ更新はサーバー側resolverが行い、AIの会話解釈では更新しない。

`implementation.status = custom_handler_required` のスキルは構造化データには含まれるが、戦闘シミュレーション前に決定的な個別ハンドラまたは汎用命令への置換が必要。
