# Playability and worldline validation — implementation record

Current continuation: [living world causal completion](LIVING-WORLD-CAUSAL-COMPLETION.md), following [ordinary preparation](PREPARED-WORLDLINES.md). The results below remain the historical checkpoint evidence, not the latest test counts.

Starting SHA: `7b8d88dfbe671730734373ade4441f697983d489`, branch `feat/persistent-world-rpg`, clean and equal to origin at start.

## Source and scope

Read TRPG / 開発引き継ぎ (sheet 9001, A1:D521) via Google Drive on 2026-09-11. Historical lessons used: row 13 (semantic identity), 128 (remove simulator repeat-count workaround), 145 (inspection unconnected to evidence), 399/429 (aggregate improvement did not fix the diagnosed loop), 438 (inspect actual available choices). Historical route schedules, three-choice movement, scores, and Human Virtue ledgers are not current design authority. No Sheet was edited.

## Phase A–C

Semantic identities use intent, target and command parameters; never wording. The developer-only replay adapter executes the authoritative simulation functions, saves the initial world and exact command/active-time stream, validates a content hash and checks every resulting state hash. JSON forks preserve intermediate state. It does not change runtime authority or create solver commands. Exact recorded time subdivisions are part of the replay contract; arbitrary HTTP batching equivalence is not yet certified.

NPC entity iteration and planner tie breaking are stable. Knowledge queries no longer re-offer unchanged acquired facts when a conversation is reopened. Read/submitted documents and completed ecological actions are removed from progress candidates. General inspection becomes an explicitly repeatable review. Leads bind known information to a physical destination and expected action, with an arrival result and grounded alternatives. They do not move the player.

Law WIP now assesses provenance, memory quality, seriousness, admission and verified possession instead of counting two witnesses. This remains an evidence-policy foundation, not a finished criminal justice simulation.

Initial baseline was actually rerun: 76 PASS / 0 FAIL / 0 SKIP, 45.36 seconds. Focused phase A–C regression: 44 PASS / 0 FAIL / 0 SKIP. Paid LLM calls: 0.

## Verified second checkpoint

First checkpoint: `6a45ecd6` (semantic replay, stable options, arrival contracts). The following checkpoint adds validation drivers, player notes and the results below. Its exact SHA is the commit containing this report; no self-referential guessed SHA is embedded here. All checkpoints are on `feat/persistent-world-rpg` and are pushed normally.

Run `node tools/trpg-world/validate-worldlines.mjs` to reproduce the developer validation. Output is written to the ignored `tools/trpg-world/reports/worldline-validation/` directory. A reviewed summary is committed beside this report; five representative decision traces (the four initial policies and the institution solver) are preserved in `validation-traces/`. The production institution replay certificate is in `tools/trpg-world/fixtures/replay/institution.json`.

Policies receive a public observation adapter: visible place names/positions, offered actions, acquired text, HP and money. Target handles are opaque to policy selection. Blind explorer, evidence-first, dialogue-first and chaotic policies contain no event IDs or hidden answers. Structural search may inspect causal state for its goal/heuristic; its steps still use projected actions and actual walking. No routes or solver answers are added to game content.

Four short initial runs, six aware continuations across three representative scenario types, and three bounded structural searches were executed. These are short discovery/investigation samples, not ten-day playthroughs. The explorer and initial evidence-first sample both naturally discovered 麦と借金の火種. The social sample acquired resident information without discovering an incident; the chaotic sample changed posture without discovering one. These different outcomes are valid. Identical initial explorer/evidence behavior is reported rather than artificially diversified.

| Representative | Discovery | Aware continuation | Structural search |
|---|---|---|---|
| 北柵の遠吠え / physical rescue | Actual walk and visible investigation acquired the clue | Examination and local dialogue continued | No path in the current search domain; injury timing, escort and combat are not searched. Not a proof of impossibility. |
| 白い都の影 / institution | Actual travel from a new farm start, then local investigation | Evidence-first read and submitted documents; dialogue-first questioned residents | FOUND in 8 expanded states; 303 recorded operations; T10 component resolved. Aggregate crown status remains latent because T11/T16 are not migrated. |
| 水音を失う森 / ecology | Actual travel and visible investigation acquired the clue | Waterway inspection reached a stated material/skill requirement | No path in current search domain; preparation/purchasing/training/combat are omitted. The evidence policy reports this limitation explicitly. |

The production institution certificate was replayed twice: identical final hash `f3f06ddc880b8469d05f5da9f691d38f47718703c262e614c441d3cdb908fad3`. Its initial save was reached using ordinary new-game movement/travel/investigation. No final-state injection, victory command, paid language model, or mutation of real user saves was used.

## First bad decisions and corrections

1. Runtime: completed document reads, submissions and ecological modifications were still presented as progress. Availability now follows knowledge/submission/physical state; reading a place again is explicitly review. Tests assert the old progress action disappears.
2. Runtime wording: different resident facts had the identical question label 「この土地での暮らし」. Labels now identify the actual offered topic while semantic identity remains unchanged.
3. Runtime lead: a searched rescue site remained an unfinished lead. Completing that site's inspection now retires the lead; revisiting is still possible as ordinary exploration.
4. Validation driver: at return-person operation 16 it selected travel despite arrival already exposing the expected inspect action. The observation adapter now carries the actual arrival opportunity and the policy executes it. This was a driver defect, not fixed with a visited-count escape. A waterway preparation limitation is explicitly classified instead of repeatedly walking to the same point.
5. A deliberately miswired evidence object in the contract fixture is detected at its first no-progress command. Detection does not silently switch actions. Legitimate posture repetition remains allowed.

## Final validation results

`npm run world:check`: PASS. **88 PASS / 0 FAIL / 0 SKIP**. Includes 76 existing tests and 12 semantic validation tests. Content audit: PASS with the same five pending causal migrations. Asset inspection: PASS, 239 files / 214 GLB / 45 animated. Client build: PASS, 187 outputs, initial gzip 398188 bytes. `git diff --check`: PASS. Separate production certificate replay: PASS twice. Paid LLM calls: **0**.

10/30/60-second forks were tested both in paused reading and active exploration without an intervening semantic topic change; options remained stable. A real posture command creates a witnessed interpretation, then different conversation topics with traceable fact provenance. JSON save/fork plus continuation and object-order/planner-tie invariance pass. Arrival opportunity and post-investigation completion pass. Generic absence alternatives exist but a full moving/absent-NPC arrival worldline is not yet certified.

Client handoff: the journal displays acquired document/testimony notes and grounded investigation leads, and records the arrival message. Tracking does not teleport. No semantic signature, policy, solver score or fact ID is displayed. The always-updating FPS readout was removed. Browser visual verification was not performed in this phase; build success is not a visual quality certificate. Broader UI redesign is deferred.

## All-Trouble feasibility and remaining limits

**BLOCKED_BY_UNIMPLEMENTED_CONTENT**, not an asserted mathematical impossibility under ten days. Five whole event components remain without causal resolution implementations: bread-fire, harbor, deep-mine, resonance, border. Existing partial aggregates additionally omit T03, T07/T08 and T11/T16. The ten-day duration has not been artificially stretched or a solver route inserted to claim success. No large policy-by-seed sweep was performed because the current search domain does not cover preparation, combat or complete incidents.

- P0: no new syntax, save corruption or existing-test regression observed in the executed suite. This is not a whole-game P0 audit.
- P1: extend search to resource acquisition/training, escort and temporal combat; validate full absent-NPC arrival alternatives; migrate remaining causal components; replace stale authored signals that can describe a disappearance before the person actually leaves. Current public event projection also still includes deadline metadata that needs an explicit player-knowledge policy.
- P1: reproducibility is certified for the recorded command/elapsed-step stream, not arbitrary HTTP timing partitions. Fixed-step scheduling across different transport batching requires a separate compatibility change and validation.
- P1: Living Society remains partial: memory aging/attribution and property-law edge cases need deeper real-worldline coverage. This phase does not certify a completed crime system.
- P2: broaden policy horizons/seeds after inspecting the next traces; complete visual review and contextual inventory/document UX. Feasibility search is bounded and local; its exhausted frontier is not an impossibility theorem.

USER DECISION REQUIRED: none. Next major phase: legal preparation/escort/combat search and worldline coverage, using the first failing decision from these traces before expanding the run matrix.
