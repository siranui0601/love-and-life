# 王都 Pass 6 作業チェックポイント

## 公開検証済み（この節が最新）

- 実装PR338 merged。都市コードのmain/VPS: `b735272e9de968739af1c143ae2b0d32ea5683dd`。QA保存は `feat/capital-pass-6-production-qa` branchで実施。
- URL: https://siranui.jp/capital-review/ 。本番全監査20経路＋事件/増水5経路、朝昼夕、errors0、384.17s。配信中の全JS/CSS/HTML bytesがgit sourceと一致。通常歩行1.4m/s、低FPS elapsed保存、route消失時停止も再確認。
- 本番追加6断面レビュー:3門の外35m・儀礼路・石段・下層路地。浮いた塔の基礎0、errors0。
- 54テスト合格、1265道路勾配監査違反0（都市通常街路/橋20%、広域粗路25%）。本番画像/JSON/検証ログ: `qa/capital-pass-6/production/`。
- VPS dirty tracked3 /untracked102、dirtySHA `fdb95a3f5b15cdca2cd95e4108bd43e6e6d8189945a9def3bfcb10719e4ffe21` を更新前後で保持。`git reset/clean/stash`、stage-linebot操作、アプリrestartは実行していない。
- `verify-capital-public.mjs` のdefaultは、コミットされた本番監査をimport.meta.url基準で解決。別originのレポートは検証前に拒否する。次の変更後は実URL監査を必ず更新する。

### 次に行う具体的な都市品質作業

1. 大きな敷地をfront-wing /side-wing /courtyardへ分解し、描画と物理判定を同じcompound footprintへ統合する。中庭は空きスペースのmetadataで終わらせず、道路から実際に入れる小loopを作る。canonical施設を増やさない。
2. 斜面の生活路を短い階段flight・踊り場・手摺・擁壁に分け、上り途中で王城/魔術塔を回復できる視点を配置する。現行の連続石段は検証面であり最終形ではない。
3. 低屋根歩廊を実際の低建築へ統合し、屋根の入口・出口を同じ街路地盤へ繋ぐ。裏道・屋根・大通りの時間/情報/景観/事件時の価値を分ける。
4. 河岸の橋詰・荷役庭・倉庫mass・人と荷車の干渉を街路断面へ整理する。水系や施設を参考画像から正本へ追加しない。
5. 次も俯瞰だけでなく目線6断面→全経路→勾配/事件→PR/CI→安全VPS→実URL監査を実施。今回もgreybox改善であり「王都完成」の宣言ではない。

最後のQAのみのmain更新でSHAが変わる場合、最新SHAはGitHub mainとVPS `git rev-parse HEAD origin/main` を照合する。都市コードの上記commitと、本番監査source-head.txtの一致も確認できる。

## 公開直前の記録（履歴）

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
