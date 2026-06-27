# noHand Soccer Cleanup Backlog

This file exists so the cleanup work does not get lost while feature bugs keep appearing.

## Current direction

- The AI should output the gimmick's semantic structure, not raw physics numbers.
- The runtime should convert primitive flow instructions into stable physics.
- A generated gimmick is one movable/rotatable object containing a trigger and ordered flow steps.

## Target schema

- `summary`: short card text.
- `trigger`: the visible step that starts the gimmick.
- `flow`: ordered steps. Each step combines position, actors, and primitive instructions.
- `ball`: ball-side motion such as `path`, `orbit`, `impulse`, `hold`, or `spin`.
- `device`: device-side motion such as `path` or `swing`.
- `hit`: contact-like impulse from the current step.
- `split`, `warp`, `gravity`: special effects only when they clearly make the device more interesting.
- `next`: progression policy, currently `time`, `assist`, or `terminal`. `assist` means the device should keep the Pythagorean chain moving rather than fail.

Example:

```json
{
  "summary": "鎖で岩を落とし、ハンマーが打ち返す",
  "trigger": { "step": 0, "radius": 28 },
  "flow": [
    { "step": 0, "actors": [0], "pos": [-70, -20], "ball": { "impulse": [20, -45] }, "next": "assist" },
    { "step": 1, "actors": [2], "pos": [0, -70], "device": { "path": [[0, -50], [0, 20]] }, "hit": { "impulse": [35, 35], "power": 55 }, "next": "assist" },
    { "step": 2, "actors": [1], "pos": [70, 10], "device": { "swing": { "pivot": [-25, -45], "angle": 70 } }, "hit": { "impulse": [85, -35], "power": 75 }, "next": "terminal" }
  ]
}
```

## Completed cleanup

- Removed the legacy server generator route.
- Removed the obsolete fixed-gimmick client.
- Removed client fetch-normalizer shims.
- Removed the runtime postfix shim.
- Moved generation-wait behavior into the runtime boot patch.

## Remaining cleanup

- Fold `app-runtime-boot.js` into `app-runtime.js` when the primitive flow runtime stabilizes.
- Consider formatting or splitting the one-line `style.css` for maintainability.
- Review old notes files and either move them under `docs/` or delete them.
- Remove legacy `motors` fallback from client/server once no compatibility paths need it.
