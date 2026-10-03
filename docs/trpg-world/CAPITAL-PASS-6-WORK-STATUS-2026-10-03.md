# 王都 Pass 6 作業チェックポイント

- Authoritative repository: `C:\Users\inaba\capital-pass-4`
- Branch: `feat/capital-block-enclosure-pass-6`
- PR: https://github.com/siranui0601/love-and-life/pull/338
- Latest spatial source commit: `4f1d19eb2616338c8b4c837af48541304fbda015`
- Base main / publicly deployed VPS: `f8f3d175760e803cecc7332f17014bdb8ae5af74` (Pass 5). Pass 6 has NOT been deployed.

## Implemented and verified before the final terrain rendering correction

3808 street-facing plots, 1419 street rows, 3879 total buildings; plot coverage 35.88% of 6.5km² core. Unequal frontage widths, 1.25m setback, .85m separation, adaptive junction depths, real facade doors/windows, level plot foundations. Castle 312.01m, market 37.82m, lower court 17.47m. Outer walls 32m high / 8m thick, 82 shared physical wall/gate towers, coping/merlons. Canonical facilities/events/NPC graph unchanged.

52/52 local and Windows tests passed. `docs/trpg-world/qa/capital-pass-6/premerge/` contains full WebGL evidence for 14 major + 3 micro + 3 entry routes and 5 event/flood walks, plus 3 time states. This evidence refers to source `06338e4`, BEFORE the added fine street-ground correction. It is not final release acceptance.

## Open quality issue / current verification

Actual screenshots revealed stair tread terrain penetration and a steep ceremonial street view dominated by the roadway. Additional source commits `aaef1ff` / `4f1d19e` remove coarse ground cells over roads, add batched 7-ring fine terrain and sample road ribbons at 1m. Initial 25-ring audit was stopped because it became too slow; no unrelated process was stopped.

- Current browser audit output: `C:\Users\inaba\capital-pass-4\qa-pass6-ground-optimized`
- Audit parent PowerShell PID: 22828. Read its output; do not launch a duplicate audit blindly.
- Own preview server: Node PID15076, parent18796, port9894. Confirm process identity before stopping.
- Partial stopped audit retained: `qa-pass6-ground` (not accepted QA).
- Latest tests output: `qa-pass6-tests.txt`; rerun if tests/code change.
- QA preservation helper: `prepare-pass6.cjs <output-folder> <premerge|production>`. It checks completion/error counts. Do not run on partial output.

## Concrete next steps

1. Read audit PID22828, review `micro-terrace-stairs-walking.png`, `market-castle-middle.png`, gate approach images and mobile performance. Fix physical/rendered geometry if still poor; test passing is insufficient.
2. Add accepted final screenshots/report with correct source SHA. Recheck all52 tests and latest PR338 CI/review threads. Merge only after quality review.
3. Deploy using `tools/trpg-world/deploy-capital-vps.py` via configured SSH key, with exact merge SHA. The script fetches, compares dirty/incoming paths and performs ff-only; preserve tracked3/untracked102 and dirty hash. No reset/clean/stash/restart.
4. Audit the real public URL again and store `qa/capital-pass-6/production/`; run `verify-capital-public.mjs` after this report exists. Default verifier now expects Pass6 production report.
5. Persist production results and current main/VPS SHA, commit/push and close the preview process. Continue courtyards, roof integration, wall walks, waterfront detail and NPC schedules. Do not call the city complete.

Local scratch checkout has a separate checkpoint history; do not force-push it over the authoritative Windows branch. Original `C:\Users\inaba\love-and-life` worktree and VPS user files remain untouched.
