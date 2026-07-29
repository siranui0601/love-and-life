# TRPG content architecture

The TRPG content layer is being separated from state mutation and UI presentation.

## Resolution order

1. Reviewed authored scene
2. Conditional scene pack
3. Approved replay cache
4. Generic server template
5. Gemini proposal（運営者が明示的に有効化した場合だけ）

通常運用は1〜4だけで完結する。`GEMINI_API_KEY`がサーバーに存在するだけではGeminiを呼ばず、
会話生成は`TRPG_GEMINI_NARRATIVE_ENABLED=true`を同時に設定した場合だけ課金経路を有効にする。
Geminiを使う場合も最後のfallbackであり、台詞と選択肢の表現を提案するだけで、authoritative stateを直接変更しない。

## Planned directories

- `authored/opening/` — opening and onboarding scenes
- `authored/missions/` — trouble and mission scenes
- `authored/locations/` — first visits, revisits, closures, and replacement facilities
- `authored/npcs/` — introductions and reviewed dialogue topics
- `authored/travel/` — route events and companion conversations
- `authored/survival/` — hunger, fatigue, meals, lodging, and sleep
- `authored/equipment/` — trials, loans, purchases, rewards, and crafting opportunities
- `approved-replays/` — reviewed generated scenes keyed by normalized authoritative state
- `templates/` — generic but executable scene templates

## Choice rules

Every source uses `choice-contract.js`.

A three-choice set must:

- contain executable server commands;
- reference only present NPCs and visible facilities;
- contain meaningfully different semantic fingerprints;
- contain at least two action families;
- include a progress or exit route when the scene requires one;
- declare the expected authoritative changes or facts gained.

Choice wording alone never makes two choices different.

## Multi-layer mission branching

重要場面の同時表示は原則として読みやすい三択を維持するが、事件全体の経路を三通りへ限定しない。
手書きミッションは、導入時の着眼点、代替証拠、証拠取得順、訪問地域、介入日、過去事件の結果、
解決方針内の文脈版を組み合わせて、多数の決定論的な到達経路を作る。

- 必須なのは「特定の一枚」ではなく、独立した事実分類を裏づける証拠である。
- 同じ証拠集合でも取得順や最初の着眼点が異なれば、協力者、所要時間、解決文面が変わり得る。
- 日付や別トラブルの状態は、同じ工程の施設、戦闘、危険、必要時間を変える。
- 分岐署名を有効にした事件では、導入、証拠順、解決ルート、文脈版を永続化し、後続事件が成功の仕方へ反応できる。
- 分岐数を増やすためだけの同義選択は作らず、各経路に情報、時間、倫理、危険、世界効果の差を持たせる。

## Weather rule

Weather is global canon, not save-specific randomness. It is resolved from only:

- weather ruleset version;
- Day 1–100;
- region;
- daypart.

Player ID, save ID, world seed, and playthrough number are intentionally excluded. Therefore, every player sees the same weather under the same calendar and location conditions.

## 承認済みGemini再生

- 実Gemini監査はまず通常のJSONL実行キャッシュへ保存する。
- 人が監査レポートを確認した後、`npm run trpg:narrative-approve -- --scenario <scenarioId>`で指定した場面だけを承認する。
- 承認対象は完全検証済みの`gemini`または`gemini_repaired`だけ。フォールバック、部分出力、通常キャッシュ再生は昇格できない。
- 承認済みmanifestには描写、三択、発言、提案だけを保存し、生応答、利用量、秘密情報は保存しない。
- 本番は承認済み再生、通常実行キャッシュ、決定論的テンプレートの順で解決する。運営者が
  `TRPG_GEMINI_NARRATIVE_ENABLED=true`を明示したときだけ最後にGeminiを利用し、提案は現在のresolverで毎回再検証する。
