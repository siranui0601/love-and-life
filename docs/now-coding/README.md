# Now Coding

Scratch-like visual programming battle game for siranui.jp.

## Agreed UX direction

- `Now Coding` is the product name, not a persistent page header on mobile.
- Authentication is required. Reuse the existing siranui.jp login/signup flow and user identity (`userTrackingId`).
- Mobile primary navigation should prioritize the three frequent destinations: home, program creation, and battle. Secondary destinations belong in a menu.
- UI labels are primarily Japanese. English is decorative only when it does not reduce comprehension.
- Cyberpunk styling comes from typography, geometry, motion, surfaces, grid/noise, and restrained glow — not emoji or cryptic labels.
- Battle is observation-only; code editing is available after the result screen, not during battle.
- Tutorial is embedded into the real program editor as contextual onboarding rather than being a separate top-level destination.
- Breadcrumbs are reserved for genuine hierarchy. Linear battle setup uses a step/progress pattern instead.

## Initial game concepts

Common visual-programming language with mode-specific physics.

- 陣取り
- コブラ
- 床抜け
- スプラ

The language should remain reusable across modes; a program should not receive a direct `MODE` value. Mode inference should come from observable game state and results of actions.

## Persistence proposal

Use the existing spreadsheet `不知火遊技場の様々なゲームの管理` and the existing user identity rather than creating a second account system.

Proposed tabs:

- `NowCoding_profiles`: per-user onboarding/tutorial progress and lightweight preferences.
- `NowCoding_programs`: saved program metadata plus serialized block/program data.
- `NowCoding_matches`: one row per completed match / participant result summary.
- `NowCoding_replays`: deterministic replay payloads or replay references, including seed and rule version.

Exact schemas will be finalized against runtime needs before writes are added.

## Authentication constraint

Now Coding must consume the existing authentication system. It must not create or duplicate a separate password store.
