# 王都 Pass 6 作業チェックポイント

## 継続作業の現在地（10月3日後半）

以下の旧チェックポイントは履歴。最大91%の坂と地形の尖りは、その後の修正で解消した。最新の空間コードは `fde63b8b8f8acfdbe6cd0f62044050dfdda52dc0`。同じPass6 branch /PR338で継続している。

- 道路と街区地盤を河岸から王城へ連続する共通地盤へ統合。都市道路・橋の最大20%を保証、広域の粗い接続のみ25%以内。監査1265道路、違反0。
- 王城歩行地盤249.2m、市場47.75m、差201.46m。河岸地盤14m、橋の取付32m。段丘は共通地盤上の局所±10mの擁壁段差となり、道路脇の旧92m cliffは残さない。
- 54/54 tests、全20経路＋事件/増水5経路・朝昼夕に成功。`qa/capital-pass-6/release/` は共通地盤修正後の全監査。
- 3門の35m外側・路地・石段・儀礼路を実描画確認。塔の全82基で基礎が地面に入っていることをWebGL上で検査し、浮き0。追加証拠は `release/sections/`、partial visual reviewを完歩監査と混同しない。
- Own preview Node PID29916 /parent9260、port9894。全監査PowerShell37476・追加断面5488は終了済み。公開反映後にidentity確認してpreviewだけ停止する。
- Latest full test log: `qa-pass6-city-tests.txt`、最新勾配JSON: `qa-pass6-city-grades.json`。full audit output: `qa-pass6-city-final`、supplement: `qa-pass6-foundation-sections`。
- main/VPSはまだPass5 `f8f3d175760e803cecc7332f17014bdb8ae5af74`。最新PR CI/reviewを確認→merge→safe ff-only VPS反映→実URLで全監査、の段階。

次の都市品質タスク: 中庭・小広場の敷地統合、斜面の生活路に踊り場と手摺、低屋根の建築統合、河岸の物流動作、城壁上の歩行、NPC本番schedule。現在も検証用greyboxであり、都市完成を宣言しない。

## 以前のチェックポイント（初期Pass6）

- Authoritative repository: `C:\Users\inaba\capital-pass-4`
- Branch: `feat/capital-block-enclosure-pass-6`
- PR: https://github.com/siranui0601/love-and-life/pull/338
- Latest code commit: `becb693400f1b60b8eebfd03306310fd340f81ca` (street geometry is the earlier `4f1d19e`; subsequent fixes make surveyed plot IDs unique and verify report origins).
- Base main / publicly deployed VPS: `f8f3d175760e803cecc7332f17014bdb8ae5af74` (Pass 5). Pass 6 has NOT been deployed.

## Implemented and verified before the final terrain rendering correction

3808 street-facing plots, 1419 street rows, 3879 total buildings; plot coverage 35.88% of 6.5km² core. Unequal frontage widths, 1.25m setback, .85m separation, adaptive junction depths, real facade doors/windows, level plot foundations. Castle 312.01m, market 37.82m, lower court 17.47m. Outer walls 32m high / 8m thick, 82 shared physical wall/gate towers, coping/merlons. Canonical facilities/events/NPC graph unchanged.

52/52 local and Windows tests passed. `docs/trpg-world/qa/capital-pass-6/premerge/` contains full WebGL evidence for 14 major + 3 micro + 3 entry routes and 5 event/flood walks, plus 3 time states. This evidence refers to source `06338e4`, BEFORE the added fine street-ground correction. It is not final release acceptance.

## Open quality issue / current verification

Actual screenshots revealed stair tread terrain penetration and a steep ceremonial street view dominated by the roadway. Additional source commits `aaef1ff` / `4f1d19e` remove coarse ground cells over roads, add batched 7-ring fine terrain and sample road ribbons at 1m. Initial 25-ring audit was stopped because it became too slow; no unrelated process was stopped.

- Current browser audit output: `C:\Users\inaba\capital-pass-4\qa-pass6-ground-optimized`
- Audit parent PowerShell PID: 22828 finished successfully: 20 routes and 5 event/flood walks, errors0, runtime502s. Visual quality still fails the slope acceptance criterion, and this is slower than the earlier271s audit. Do not mistake completion for quality approval.
- Own preview server Node PID15076 /parent18796 was identified and stopped after the audit. No audit or preview process remains running. Restart `node preview.cjs` for port9894 when continuing.
- Partial stopped audit retained: `qa-pass6-ground` (not accepted QA).
- Latest tests output: `qa-pass6-tests.txt`, 53/53 passed after the P2 fixes; rerun if tests/code change. Committed copy: `qa/capital-pass-6/latest-tests.txt`.
- QA preservation helper: `prepare-pass6.cjs <output-folder> <premerge|production>`. It checks completion/error counts. Do not run on partial output.

## Concrete next steps

1. Review the finished audit committed under `qa/capital-pass-6/geometry-review/`, especially `micro-terrace-stairs-walking.png`, `market-castle-middle.png`, gate approach images and mobile performance. Fix physical/rendered geometry if still poor; test passing is insufficient. The optimized castle-middle image STILL shows road dominating the view. Physical 2m grade analysis found ceremonial-road maxima: `castle_court__castle` 90.74%, `royal_approach__royal_gate__part_1` 79.46%, `royal_gate__castle_court` 62.18%. This is a topology/longitudinal-profile release blocker, not merely camera pitch. Keep the high castle apex but lengthen contour/switchback approaches and add proper landings; do not fake a fix by tilting the camera. Run `node tools/trpg-world/audit-capital-grades.mjs --strict` (currently expected to fail: 121 of1265 ordinary roads exceed the20% review target).
2. Add accepted final screenshots/report with correct source SHA. Recheck all52 tests and latest PR338 CI/review threads. Merge only after quality review.
3. Deploy using `tools/trpg-world/deploy-capital-vps.py` via configured SSH key, with exact merge SHA. The script fetches, compares dirty/incoming paths and performs ff-only; preserve tracked3/untracked102 and dirty hash. No reset/clean/stash/restart.
4. Audit the real public URL again and store `qa/capital-pass-6/production/`; run `verify-capital-public.mjs --report=<real-production-report>` after this report exists. The default now resolves the committed Pass6 premerge report and explicitly rejects a different origin before checking deployed assets. Change the default to real production only when that report is committed.
5. Persist production results and current main/VPS SHA, commit/push and close the preview process. Continue courtyards, roof integration, wall walks, waterfront detail and NPC schedules. Do not call the city complete.

Local scratch checkout has a separate checkpoint history; do not force-push it over the authoritative Windows branch. Original `C:\Users\inaba\love-and-life` worktree and VPS user files remain untouched.
