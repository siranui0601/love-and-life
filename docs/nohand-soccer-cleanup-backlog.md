# noHand Soccer Cleanup Backlog

This file exists so the cleanup work does not get lost while feature bugs keep appearing.

## Current direction

- The AI should output the gimmick's semantic structure, not raw physics numbers.
- The runtime should convert semantic modes into stable physics.
- A generated gimmick is one movable/rotatable object containing actor positions, units, trigger, and beat sequence.

## Target schema

- `motion`: short summary for the card.
- `layout`: local actor positions for the three emojis.
- `units`: optional grouping of adjacent actors, such as `👊🏻💥` as one unit.
- `trigger`: the unit/actor that starts the gimmick.
- `beats`: semantic steps using modes such as `ride`, `guide`, `hit`, `bounce`, `hold`, `release`, `split`, `warp`, `gravity`, `spin`.

## Remaining cleanup

- Fold `app-runtime-boot.js` into `app-runtime.js` when the semantic runtime stabilizes.
- Move generation-wait behavior into the runtime instead of monkey-patching `fetch`.
- Consider formatting or splitting the one-line `style.css` for maintainability.
- Review old notes files and either move them under `docs/` or delete them.
- Remove legacy `motors` fallback from client/server once no compatibility paths need it.
