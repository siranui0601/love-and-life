# TRPG legacy archive（蔵）

この配下は、現行runtimeから退役した実装・snapshot・bridgeを調査可能な形で保存するための「蔵」です。

## 強い契約

- `archive/trpg/**` を production / simulator / validator / test の実行コードから import してはいけません。
- 現行の正本は Google Sheet → deterministic export → checked-in canonical artifact → active loader の順で構築します。
- archive内のコードは歴史資料であり、balance値・runtime semantics・件数の正本ではありません。
- 再利用したいロジックがある場合はarchiveを直接importせず、characterization testを作ったうえでactive sourceへ移植します。

個別の由来・最終利用commit・replacementは `manifest.json` を参照してください。
