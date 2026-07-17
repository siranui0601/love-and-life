# TRPG autonomous simulation laboratory

This directory contains a deterministic, source-independent simulation harness.
It intentionally lives outside `src/`: production resolvers can adopt the
validated contracts later, while the prototype remains safe to run from the
repository or CI.

## Authoritative inputs

The checked-in fixtures are read-only snapshots taken on 2026-07-17 with
`UNFORMATTED_VALUE` from the three Google Sheets named by the game designer:

- `TRPG` — world, routes, 19 troubles, 110 NPCs, facilities and prices
- `TRPG_スキル設計マスターv4_イベントフラグ再設計` — 1,141 skills and 118 flag paths
- `TRPG_戦闘データマスターβ1` — equipment, stock, monsters, weighted enemy AI and encounters

Every snapshot stores its spreadsheet ID and source URL. Trailing empty rows and
columns were removed; cell values and row order were otherwise preserved.

## Safety policy

- Simulation never writes back to Google Sheets.
- Generated prose never decides state, prices, combat or flags.
- A seed reproduces world and battle results.
- Unknown commands and malformed source contracts become diagnostics and a
  deterministic fallback, never invented behavior.
- Runtime aliases and assumptions are reported explicitly.

## Intended commands

```text
npm run trpg:check
npm run trpg:simulate
npm run trpg:test
```

`trpg:simulate` writes the full machine-readable result and a compact public
report used by `public/TRPG/simulation.html`.

The no-player NPC state, rumor propagation, movement, lifecycle, and
determinism requirements are defined in [`LIVING_WORLD.md`](./LIVING_WORLD.md).

The default run performs two 100-seed Day1–100 world sweeps plus 304,000
combat trials across all 76 encounters: fixed comparison builds,
recommended-level matched builds, and four-character parties. Run
`node tools/trpg-sim/cli.mjs --quick` for a smoke check.

Generated output:

- `tools/trpg-sim/reports/latest.json`: full evidence and matrices
- `tools/trpg-sim/reports/latest.md`: human-readable balance report
- `public/TRPG/simulation-report.json`: compact browser payload

`config/tuning.v1.json` contains simulator/runtime safeguards only. It never
silently rewrites a spreadsheet master.
