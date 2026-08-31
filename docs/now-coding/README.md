# Now Coding

Scratch-like visual programming battle game for siranui.jp.

## UX contract

- `Now Coding` is the product name, not a persistent page header on mobile.
- Authentication is required. Reuse the existing siranui.jp login/signup flow and user identity (`userTrackingId`).
- Mobile primary navigation prioritizes the three frequent destinations: `ホーム` / `駒を作る` / `対戦`. Secondary destinations live in the drawer.
- UI labels are primarily Japanese. English is decorative only when it does not reduce comprehension.
- Cyberpunk styling comes from typography, geometry, motion, surfaces, grid/noise, restrained glow and SVG forms — not emoji or cryptic labels.
- Battle is observation-only; code editing is available after the result screen, not during battle.
- Tutorial is embedded into the real program editor as contextual onboarding rather than a separate top-level destination.
- Breadcrumbs are reserved for genuine hierarchy. Linear battle setup uses a step/progress pattern instead.
- `prefers-reduced-motion` disables nearly all nonessential motion.

## Common programming model

The language is intended to stay reusable across game modes. A program must not receive a direct `MODE` value.

Currently implemented language/runtime foundation:

- physical actions: `進む`, `左に90°旋回`, `右に90°旋回`
- front / left / right cell sensors
- variables (`set` / `change`)
- seeded random values
- boolean `and` / `or` / `not`
- arithmetic `+ - * / %`
- comparison `== != < <= > >=`
- logical processing costs 0 ticks; one physical action ends the current tick
- per-tick instruction budget protects the runtime from non-terminating logic

The first editor UI deliberately exposes a smaller subset of this AST while the underlying runtime already supports the wider expression set.

## Game concepts

Common visual-programming language with mode-specific physics:

- 陣取り
- コブラ
- 床抜け
- スプラ

Only **陣取り** is playable in the first foundation implementation. Other cards are visible as future modes but cannot be selected yet.

### 陣取り v1

- square gray grid; 15×15 / 21×21 / 31×31 selectable in the current UI
- 2–4 pieces
- balanced spawn candidates; assignment is seed-deterministic
- an unclaimed cell becomes the moving player's territory
- own territory is passable
- enemy territory is an impassable wall and is not overwritten
- moving beyond the board is a cliff fall and eliminates the piece
- turning consumes one tick and does not move the piece
- simultaneous movement is resolved without player-order priority
- same-target / head-swap collision eliminates both involved pieces
- match ends on board filled / all pieces eliminated / prolonged no-capture stagnation / tick limit
- most occupied cells wins

## Current user flow

1. Root siranui.jp game card
2. Existing login modal if necessary
3. `/now-coding/`
4. Home
5. Create/edit a piece in the real editor
6. Test it on a live grid
7. Configure a territory match
8. Observe the match (no editing)
9. Result
10. Rematch or return directly to code editing

First-time users receive contextual coaching inside steps 5–6. Progress is persisted and the coaching does not remain a permanent top-level menu item.

## Persistence

Uses the existing spreadsheet `不知火遊技場の様々なゲームの管理` and the existing `Users.userTrackingId`. It does not create a second password store.

Created tabs:

### `NowCoding_profiles`

`user_tracking_id | username_snapshot | tutorial_step | tutorial_done | prefs_json | created_at | updated_at | schema_version`

### `NowCoding_programs`

`program_id | user_tracking_id | name | blocks_json | created_at | updated_at | version | archived | last_used_at | notes`

### `NowCoding_matches`

`match_id | mode | seed | settings_json | participants_json | results_json | winner_tracking_ids_json | created_at | rule_version | replay_id | duration_ticks | finish_reason`

### `NowCoding_replays`

`replay_id | match_id | mode | seed | settings_json | programs_json | spawn_json | result_json | created_at | rule_version | owner_tracking_ids_json | checksum`

Replays store the deterministic inputs (seed, programs, spawn and rule version), rather than a cell-heavy snapshot for every tick.

## Current implementation boundary

The first playable battle UI runs the signed-in player's saved program against deterministic CPU programs. The persistence/replay schema is already participant-oriented, but authoritative Socket.IO human-vs-human room execution is not implemented in this foundation yet.

This boundary is intentional: the visual language, tick semantics, persistence and deterministic replay are being fixed before network room orchestration is allowed to become another source of rules.

## Isolation from TRPG work

Now Coding production code lives under:

- `public/now-coding/`
- `src/server/now-coding/`
- `tools/now-coding/`

The only shared server change is importing and mounting `mountNowCodingRoutes` in `src/server/shared/index.js`. No `public/TRPG/`, `src/TRPG/`, TRPG data, simulation or workflow code is modified by this PR.
