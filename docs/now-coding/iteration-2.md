# Now Coding — iteration 2

PR #299 merged the first playable foundation. This follow-up iteration develops the same product without touching TRPG runtime files.

## Scope

- Rename rotation labels to 左に旋回 / 右に旋回.
- Save programs through an explicit naming modal and return home after success.
- Strengthen first-run tutorial and lock unrelated navigation until completion.
- Support tap, desktop drag-and-drop, and touch drag placement in the real editor.
- Keep reorder controls visible and add an explicit delete control.
- Expand the visual language with forever/repeat, variables, arithmetic, logical AND/OR/NOT and seeded random operations.
- Add NPC difficulty levels: 弱 / 中 / 強.
- Add online room creation/join flow with public/private rooms, room IDs and optional NPC seat filling.

## Safety boundary

This iteration stays in Now Coding-specific files plus the single shared server mount line. It does not edit `public/TRPG/**` or `src/server/trpg/**`.
