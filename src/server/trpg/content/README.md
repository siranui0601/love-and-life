# TRPG content architecture

The TRPG content layer is being separated from state mutation and UI presentation.

## Resolution order

1. Reviewed authored scene
2. Conditional scene pack
3. Approved replay cache
4. Generic server template
5. Gemini proposal

Gemini is the last fallback. It may propose wording and choices, but it never directly mutates authoritative state.

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

## Weather rule

Weather is global canon, not save-specific randomness. It is resolved from only:

- weather ruleset version;
- Day 1–100;
- region;
- daypart.

Player ID, save ID, world seed, and playthrough number are intentionally excluded. Therefore, every player sees the same weather under the same calendar and location conditions.

## 承認済みGemini再生

- 実Gemini監査はまず通常のJSONL実行キャッシュへ保存する。
- 人が監査レポートを確認した後、\`npm run trpg:narrative-approve -- --scenario <scenarioId>\`で指定した場面だけを承認する。
- 承認対象は完全検証済みの\`gemini\`または\`gemini_repaired\`だけ。フォールバック、部分出力、通常キャッシュ再生は昇格できない。
- 承認済みmanifestには描写、三択、発言、提案だけを保存し、生応答、利用量、秘密情報は保存しない。
- 本番は承認済み再生、通常実行キャッシュ、Geminiの順に解決し、提案は現在のresolverで毎回再検証する。
