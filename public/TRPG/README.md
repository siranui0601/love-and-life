# TRPG(仮題) public data

## Directory and public routes

The only physical game directory is `public/TRPG`.

- `/TRPG/`: direct development path
- `/TRPG(仮題)/`: public title alias served from the same directory

Do not recreate `public/TRPG(仮題)`. The Japanese-title URL is mounted by `src/server/app.js`.

## Public endpoints

- `/TRPG/api/game/health`: playable runtime、resolver、tutorial version
- `/TRPG/api/game/saves`: 端末所有のセーブ一覧と新規作成
- `/TRPG/api/game/saves/:saveId`: セーブ取得・削除
- `/TRPG/api/game/saves/:saveId/commands`: 3択、移動、売買、装備、技能取得、案内確認
- `/TRPG/api/game/saves/:saveId/replay-verification`: command journal の決定論的再生検証
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

実プレイは、固定された中立初期状態から始める。開始前に「型」は選ばず、装備、技能、会話、行動の積み重ねによってプレイヤーごとの遊び方が形成される。AIは台詞と選択肢の表現だけを担当し、時刻、移動、戦闘、所持品、報酬、フラグ、NPCの在席はサーバー側resolverだけが確定する。

初回導入は次の順に段階解放する。

1. Day 1 10:00、異世界の麦畑で一人で目覚め、現場を確かめる3択
2. エダとの複数ターン会話
3. 3択とは独立した施設移動
4. 村の広場でT01を会話から発見し、ミッションを行動指針として記録
5. 店のある施設で、時間を進めない購入・売却の案内
6. 危険地域で、現在の装備に適合する技能取得と戦闘の案内

未確認の危機、噂、遠隔・失踪・死亡NPCは画面やGemini入力へ出さない。NPC由来の噂は発生源から生活圏へ広がった後、同じ施設で会話・観察したときだけプレイヤーが知る。同一content revision、seed、command列は同じstate hashへ到達し、Geminiの応答再利用の有無でゲーム結果を変えない。

Day 100 24:00で旅は完結し、それ以降の状態変更コマンドは受理しない。実プレイ用saveはNPCの現在状態、個別知識、累積因果ハッシュを保持し、詳細な判断・移動・知識イベントは直近分へ決定的に圧縮する。全110 NPC×100日分の完全トレースは`playable-world-audit.json`とシミュレーター出力側へ分離する。

resolver v4以前の限定公開alpha saveは、導入・期限・NPC在席契約が異なるため互換性がない。新しいresolverの初回利用時に旧saveは一覧から除外・整理されるので、新規に旅を開始する。

取得一覧への表示条件、実際の取得条件、発動条件、条件追加効果を分離する。条件判定とイベントフラグ更新はサーバー側resolverが行い、AIの会話解釈では更新しない。

状態異常という独立レイヤーは持たず、毒・麻痺・混乱・能力低下を`debuff`へ統合する。障壁・身代わり・反撃・詠唱・封印・反射などは`specialState`として扱う。

`implementation.status = custom_handler_required`のスキルは構造化データには含まれるが、戦闘シミュレーション前に決定的な個別ハンドラ、または汎用命令への置換が必要である。
