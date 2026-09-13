# Living world causal completion — ongoing implementation

Starting HEAD: `5c640a2dc6ffa72d77d67f69273a004453111ad9`, branch `feat/persistent-world-rpg`; clean and equal to the remote at start. Continues PREPARED-WORLDLINES and WORLDLINE-VALIDATION. No paid/live LLM calls. No user decision required.

## Shared aftermath foundation checkpoint

Structures now carry damage, fire/fuel, blocked access, actual exposed casualties, shelter destinations, recovery records and irreversible failure history. Only living people physically present within the damaged site's exposure area are injured/trapped; nobody is spawned into an accident. Trapped actors do not appear in the public NPC projection or accept direct commands. Physical work opens access before treatment and escort. A survivor supplies a shelter destination; actual movement and co-location complete recovery. Historical event failure stays failed after rescue and repair.

T09 now binds collapse/blocked access to the existing mine structure. T02 binds a grain store to the same infrastructure and aftermath model: fuel removal before ignition, or fire, evacuation, extinguishing and structural repair afterward. These are physical slices; arsonist agency, debt adjudication and every possible T02/T09 aftermath are not complete. Fire is currently an authored ignition hazard, not a completed fire propagation simulation.

NPCs locally observe damage, retain memories with provenance, and share their known observation through normal conversation. A heard site account creates a grounded investigation destination. Evacuation uses the shared searched action-plan representation and executor. General response beyond evacuation and player-assisted rescue remains to be extended. NPC social transmission now carries a source memory where available; it does not turn hearsay into firsthand observation.

Early physical failure now applies the same economic consequences once as deadline failure. Already failed historical saves do not silently receive that charge again. Closed workplaces reject work. Failure and later recovery are separate records.

Compiler and generated content: `world-10d-ec2c41296f3c`. Exact-hash migration from the previous v2 generation and the prior recorded checkpoint is allowlisted to this reviewed generation; no wildcard future compatibility. Existing five real v1 fixtures and service contracts remain passing. Further verification of historical already-failed structures is pending.

Verification: focused suites **34 PASS / 0 FAIL / 0 SKIP**; full `npm run world:check` **100 PASS / 0 FAIL / 0 SKIP**, audit/assets/build PASS. New behavioral collapse fixture includes sleep elsewhere, observation, evacuation, conversation, preparation, freeing, treatment, escort, intermediate JSON restart and exact replay. A renamed fire fixture uses the same work/aftermath primitives. These are runtime fixture evidence, not yet a production long-worldline certificate.

First failures so far: the all-region driver assumed every hunger stop had a shop; its ordinary itinerary now provisions where shops exist and eats carried food elsewhere. The new production life driver initially requested `inspect` again at an already inspected market; it now returns for its known work offer rather than inventing progress. The live production mine continuation is still being investigated. No repeat-count workaround or injected final outcome was added.

Remaining: production failure/aftermath and longer life trace; informed NPC rescue beyond evacuation; deeper provenance/hidden-information checks; partial combined components and harbor/resonance/border. Browser visual review has not been executed. This phase is NOT complete.

## Knowledge and medical-response checkpoint

Foundation checkpoint `0eef6b52` was safely pushed. Subsequent runtime work grounds structure-related event sightings in current physical descriptions instead of disclosing the authored cause/contract explanation. Audible survivors are described only while actually near the site. Visible external injuries expose a condition affordance for approaching an injured person, while trapped occupants remain hidden. Hearsay confidence defaults remain finite, and memories carry the actual originating observation through a shelter conversation.

A professional with a known site account and actual medicine can now search the reported place, inspect from its perimeter, approach an actually visible injured person, consume medicine, and escort them to shelter. Search and treatment use the same action planner/executor as evacuation. A contextual OFFER_HELP gift transfers a real medicine item from player inventory. No profession produces medicine from nothing. A regression exposed daily work moving the helper away between inspection and rescue assessment; plan ownership now persists across that transition. Professionals use their own known account for travel rather than querying an unknown person's remote position. Broader NPC resource procurement remains pending.

Four behavioral aftermath tests now pass: player-assisted collapse recovery; fire/evacuation/repair; witness-to-non-witness rumor followed by player conversation and discovery, without hidden cause or deadline; and a real medicine gift enabling professional search/treatment/escort while the player rests. Intermediate JSON continuation and exact replay are checked. Focused aftermath + semantic tests: **16 PASS / 0 FAIL / 0 SKIP**. Full world:check: **102 PASS / 0 FAIL / 0 SKIP**, audit/assets/build PASS.

The first production continuation reached Day5 with physical restoration and 18 conversation turns, but recovered no casualties. This is explicitly NOT a rescue acceptance pass. Combat had moved the player away before the validator checked only nearby actions. The next run returns to the remembered scene and approaches visibly injured people. The fire journey also exposed an unsafe meal attempt after field work; it now walks back to its known inn before requesting the meal. These are ordinary physical actions, not bypasses of runtime danger checks. Updated production runs remain in progress.

## Return to ordinary life checkpoint

Medical response checkpoint `1d45228a` was safely pushed. Subsequent production runs reached Day5 in both regions. The mine run physically recovered NPC037, NPC086 and NPC089, preserving FAILED and matching both full replay and a JSON restart during escort. NPC036 was not present at that collapse and was not spawned into it. Mine: 3,195 operations, 158 meaningful decisions (54 travel, 3 investigations, 18 conversation turns, 43 preparation, 16 combat, 24 other), Day5 02:19. Fire: 4,169 operations, 149 decisions (65 travel, 5 investigations, 6 conversation turns, 46 preparation, 15 combat, 12 other), Day5 02:58; extinguishing and repair preserved FAILED, exact replay passed. Nobody happened to be caught in this fire; no fire rescue is claimed. These runs predate the workplace reopening changes below and must be recertified before being described as current-runtime artifacts.

The fire trace exposed the difference between killing a monster and completing the accepted attack's recovery phase. The validation action driver now continues ordinary active simulation until that visible phase ends before attempting food. It does not skip combat, modify cooldowns, or advance the calendar artificially to a target day. Environmental memories no longer fabricate a person's clothing for actorless structural damage.

After a damaged site is safe, accessible and its actual casualties recovered, generic reopening work can release the closure. Ordinary jobs then become available and pay their normal wages; the failure history remains. NPCs distinguish their temporary shelter from their workplace. Workplace availability is derived from dated seen/heard accounts, including old closure records, rather than an irreversible closure belief. Only physical sight or actual conversation/social contact transmits reopening. The former displaced-home check could falsely observe a remote workplace from a shelter; sight now uses the real facility in the NPC's region. A behavioral test evacuates a worker, repairs/reopens while the worker remains uninformed, tells them through SHARE_INFORMATION, and observes their physical return to work. A separate test earns a normal wage after repair.

Current focused aftermath suite: 6 PASS / 0 FAIL / 0 SKIP. Full world:check: 104 PASS / 0 FAIL / 0 SKIP, audit/assets/build PASS (terminal exit 0). Fresh production certificates are pending for this checkpoint. Browser verification remains SKIP. No paid/live LLM calls, no user decision required.

## Changed conditions and durable continuation

Reopening checkpoint `09679bafd4729c3ab62056e21c0558bbd34807f4` was safely pushed and verified equal to the remote. Its mine journey reached Day5 and its recorded escort state has passed two FileWorldStore/PersistentWorldService restore cycles with no offline calendar advancement. The following 702 ordinary runtime operations reached the same final hash. This checks actual durable restoration followed by shared-runtime continuation, not arbitrary HTTP timing partition equivalence.

The fire rerun stopped honestly at a new first missing affordance: a higher timber price after the disaster. Actual shop offers already exposed the correct price, but the previously inspected service could only be reviewed; the preparation driver used its stale remembered requirements. Changed real service terms now expose ordinary reinspection. The driver travels there, selects that offered inspection, and recomputes actual work/purchase requirements. It never grants money, suppresses a price increase or changes a search limit. A behavioral test lets a remote shortage fail during an inn stay, reinspects the changed price, earns wages and buys the required timber.

Damage also closes its facility in the same physical transition, before witnesses form their account. Repaired sites describe repair marks rather than indefinitely describing unremoved rubble. Focused aftermath/preparation: 17 PASS / 0 FAIL / 0 SKIP. Full world:check for these corrections: 105 PASS / 0 FAIL / 0 SKIP, audit/assets/build PASS, terminal exit 0. The new fire continuation is running; no current production fire pass is claimed until that rerun finishes.

## Versioned results and natural-life correction

Correction checkpoint `d9e0de1984278b51a440a91d96cbef39c55544ff` was safely pushed. [Pinned evidence and manifest](validation/causal-2026-09-12/README.md) now preserve the completed runs and the failed price trace.

| Runtime / trace | Result | Operations | Decision units | Travel | Investigations | Conversation | Preparation | Combat | Other |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 09679baf / mine | Day5 01:13, two actual survivors recovered, failure retained | 2930 | 152 | 51 | 3 | 18 | 42 | 16 | 22 |
| d9e0de19 / fire | Day5 03:31, extinguished, repaired, reopened, failure retained | 4298 | 163 | 66 | 14 | 8 | 46 | 15 | 14 |
| d9e0de19 / prevention | Day1 07:17, fuel removed, prevention evaluated | 59 | 3 | 1 | 1 | 0 | 0 | 0 | 1 |

All three exact recorded replays PASS. Mine intermediate JSON replay PASS; mine FileWorldStore/service round trips PASS before the final description correction. A diagnostic attempt to replay the old mine record under d9e0de19 FAILS at suffix operation 472: the isolated old runtime still matches, and the sole difference is a corrected NPC observation text describing repair marks. This is explicitly cross-code replay incompatibility, not evidence that the save lost people, plans, knowledge or calendar time.

Reviewing bedtimes exposed a driver-quality defect: the fixed cycle rested six hours after every job, including early morning and afternoon. These Day5 runs are **causal stress traces, not natural-life acceptance**. The new `ordinary` mode eats for public hunger, rests for fatigue or night, and avoids repeatedly approaching the same NPC on one day. Its bounded work-cycle budget differs because a work cycle no longer advances six artificial sleep hours; no runtime failure is bypassed or hidden deadline consulted. This is one laborer's authored life, not an optimal player or a general autonomous solver. Its live result remains pending.

Current remaining issues:

- P0: none found in the executed 105-test regression; not an exhaustive safety claim.
- P1: natural multi-day acceptance is pending; harbor/resonance/border and combined T03, T07/T08, T11/T16 remain incomplete. Fire ignition has no complete arsonist plan, propagation or player exposure model. Historical already-failed saves cannot reconstruct unknown old casualties. Fully knowledge-bounded distant discovery is not certified by a structural travel prefix.
- P2: ordinary preparation still includes many return trips and single-unit purchases; reported decision units include travel and leaving conversation, and are not measured human decision density. Replay artifacts require their pinned code version. Current fire/smoke is state/interaction text, not completed visual presentation. Browser review is SKIP.

Calendar/active-simulation policy, actual-v1 migrations, semantic stability, 10/30/60-second contracts and destination continuity remain in the passing full regression. No paid/live LLM calls. USER DECISION REQUIRED: none. This phase is not declared complete.

## Ordinary-life validation in progress

Evidence checkpoint `cf93fde7723dae9909467cd194afb4e6b90f5479` is safely pushed. The first needs-driven run has recorded Day5 with four meals, four rests, 28 paid jobs, two lessons and fire recovery/reopening. Its sleep starts were Day1 23:18, Day3 08:48 (after overnight crisis response), Day3 22:22 and Day4 23:41. Whole replay is still running, so these are recorded outcomes, not yet a completed certificate.

Decision review found 132 travel segments among 251 decision units: the driver still returned to a shop and inn every work cycle even without a need. A refined run stays at an available workplace and returns to the inn for actual hunger, fatigue or night. It uses the same public action offers and a separate output name so earlier evidence is not overwritten.

The replay recorder also stops constructing unused full-world explanation snapshots for input/resume commands. Command execution, projection, transactional state and every state hash remain unchanged. A 64-operation comparison from the recorded mine escort matched every operation hash and the full trace; the single timing sample was 3951ms before / 3735ms after and is not a general performance claim. Focused semantic/preparation/aftermath: 29 PASS / 0 FAIL / 0 SKIP. Runtime code remains the 105-test passing d9e0de19 version.

## September 13: disclosure and active-danger boundaries

Resumed at `b235394e72ce06ebe3c537481165ceff980acd60`, equal to remote `feat/persistent-world-rpg`, with the preceding boundary changes uncommitted. The original phase started at `5c640a2dc6ffa72d77d67f69273a004453111ad9`.

The earlier needs-driven ordinary run completed exact replay: Day5 05:40, 7,953 operations / 251 decision units (132 travel, 7 investigations, 16 conversation, 47 preparation, 34 combat, 15 other); 28 jobs, four meals, four rests, and actual fire repair/reopening with FAILED retained. Its refined successor stopped at Day1 22:01 with HP0: 794 operations / 49 decisions, exact replay PASS but gameplay FAIL. Neither result is concealed by a larger search budget.

Two first bad decisions required runtime/source corrections:

- **Hidden identity disclosure (P0):** generated public biographies copied private NPC roles, including an arsonist's employer, into ordinary conversation. The compiler now keeps private background private and does not invent public biographies from internal roles. Public role/work labels use explicitly authored `publicRole` or neutral wording. A one-time exact-template migration archives invalid generated knowledge, preserves objective history and physical state, and retires affected active conversation/cached response wording. The actual recorded v2 mine save verifies this path. The old Day5 record is historical causal evidence, **not** a current information-safety certificate.
- **Macro time bypass (P1):** work/travel could start beside active danger. Authoritative macro commands now refuse before payment/calendar advancement, and an emerging threat interrupts an unfinished activity without completion wages, skills or repairs. Public offers reflect the same restriction. Actual temporal attacks/guard/healing resolve danger before continuing. The all-region journey initially failed because it depended on unsafe travel; it now responds through those same legal combat actions, with no defeat flag or encounter bypass.

Generated content is `world-10d-940b5356c6a8`, service hash `5594baac95de746eb873321e3c074e6499f9f233cb32acb2e1fc8ce4fce3120f`. Reviewed previous v2 content revisions migrate only into this exact target/hash. Real saves are untouched; fixture/service tests use isolated stores. No trust/pressure authority is introduced.

Validation: focused preparation/aftermath **21 PASS / 0 FAIL / 0 SKIP**; playability **6 PASS / 0 FAIL / 0 SKIP**; final `npm run world:check` **109 PASS / 0 FAIL / 0 SKIP**, content audit/assets/client build PASS, terminal exit 0. The first full attempt was **108 PASS / 1 FAIL** (unsafe-travel dependency above); it is superseded by the passing rerun. New current-content ordinary-life trace `ordinary-boundary` is running and is not yet certified. Browser review remains SKIP. Paid/live LLM calls: 0. USER DECISION REQUIRED: none. Previously listed incomplete content and broader playability limitations remain; this phase is not declared complete.

## Overdue people remain physical inhabitants

Boundary checkpoint `7044a91deac634b0d22dcfc6e77652a6693d7316` is safely pushed. `ordinary-boundary` then failed honestly on Day3 11:58: 2,812 operations / 157 decisions, exact replay PASS, but no handover. The visible injured Finn had HP0. The return-person component killed him solely on its deadline, then continued running excursion/injury logic after death. This is a runtime cause, not a search limit.

Return-person deadlines now record the missed return and preserve FAILED, without changing health or deleting an in-progress escort. Real injury and whereabouts continue to determine available treatment/escort. Family reunion can occur later as a new objective fact; it cannot erase failure. HP0 inhabitants no longer execute the excursion component or appear as treatable injuries. Existing saves' HP0 values are retained; no retrospective resurrection. The two-renamed-scenarios behavioral contract uses ordinary inn/escort/movement commands, a mid-escort JSON restart, later reunion and continued ordinary life. It does not inject the final state.

Focused aftermath/playability **13 PASS / 0 FAIL / 0 SKIP**; full `world:check` **110 PASS / 0 FAIL / 0 SKIP**, audit/assets/build PASS, terminal exit 0. New `ordinary-overdue` has recorded Day5 / 3,600 operations with no first missing affordance; full replay is pending. The current prevention record `prevention-safe` PASS: Day1 07:43, 611 operations / 26 decisions (5 travel, 1 inspection, 2 preparation, 17 combat, 1 physical cleanup), actual PREVENTED and exact replay. Its longer prefix is genuine nearby combat, not extra calendar waiting.

The structural travel driver also encountered the now-legitimate danger restriction at the first road exit. It now fights through the same public attack/guard/healing options and physically returns to that exit. Inter-region topology remains an explicitly structural prefix, not a blind policy claim. A fresh `mine-safe` run is pending. No new source-content generation, paid LLM calls, UI changes or user decisions in this checkpoint.

## Finding the recipient and certifying handoff

Overdue-person checkpoint `a9ef50c6e5de82eac506e768687c3a6cf3b8035b` is safely pushed. Its `ordinary-overdue` completed Day5 05:19, exact replay and intermediate JSON restart; two FileWorldStore/service restores followed by 808 recorded operations also PASS with zero offline advancement. Counts: 3,600 operations / 195 decision units (55 travel, 7 investigations, 11 conversation, 63 preparation, 41 combat, 18 other). It repaired/reopened the burnt store and continued life, but **did not finish Finn's handoff**. The previous script ended its bounded companion wait and resumed work without asserting delivery. This certificate proves life/fire aftermath and persistence, not a completed person rescue.

The next runtime correction distinguishes a slow companion from an absent recipient. The companion's actual statement names the family member; it does not reveal that person's current position. Public arrival explains when the recipient must be found. A recipient who actually sees the relative walks to the last observed position; a lost contact invalidates that response. They can meet outside the original home. The reunion fact records both actual positions, and the all-region gameplay test checks physical proximity at that fact rather than asserting every reunion occurred at an authored home coordinate. Old response assignments without an observation safely release to ordinary planning rather than obtaining hidden current coordinates.

The worldline driver must now verify actual completed handoff. When the named recipient is visible, the player can approach them through ordinary movement; when absent, the trace reports the missing affordance instead of waiting longer or pretending delivery. The two-role behavioral scenario explicitly encounters a family member away at work and reunites through real movement. Focused aftermath/semantic/preparation: 35 PASS; final focused aftermath/playability: 14 PASS, both 0 FAIL / 0 SKIP. Full regression is being recertified after updating the old home-only assertion.

`mine-safe` exposed a further legitimate danger restriction on return to the support-repair site. Shared local action preparation now resolves visible danger using actual combat and returns physically to the intended work location before rechecking the offer. The new mine/ordinary traces are in progress. This is not removal of a hazard or a solver-only macro action.

Final handoff regression: `npm run world:check` **111 PASS / 0 FAIL / 0 SKIP**, content audit/assets/build PASS, terminal exit 0. The preceding attempt was 110 PASS / 1 FAIL solely at the superseded home-position assertion. Browser verification: SKIP. Paid/live LLM calls: 0. USER DECISION REQUIRED: none. Runtime and content are now frozen for the representative certificate reruns.

## Final verified checkpoint results — September 13

Phase starting HEAD: `5c640a2dc6ffa72d77d67f69273a004453111ad9`. This continuation resumed at `b235394e72ce06ebe3c537481165ceff980acd60`. Final implementation HEAD: **`3632dca05c21fb85e812de7ca0c698183a7d8925`**, verified equal to the dedicated remote branch. This report/evidence is committed afterward without changing that runtime. The following three runs executed against that exact implementation and completed with terminal exit 0. [Pinned records, intermediate saves and hashes](validation/causal-2026-09-13/3632dca0/manifest.json) are the current certificates; earlier sections are chronological evidence, not competing current claims.

| Worldline | Verified outcome | Operations | Decisions | Travel | Investigation | Conversation | Preparation | Combat | Other |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ordinary-final | Day5 05:35; fire repaired/reopened, overdue child handed to living family, FAILED retained | 3537 | 197 | 55 | 7 | 11 | 65 | 41 | 18 |
| mine-final | Day5 00:33; actual trapped NPC086 rescued to inn, FAILED retained | 2847 | 159 | 52 | 12 | 12 | 42 | 21 | 20 |
| prevention-final | Day1 07:43; inspected fuel cleaned after real combat, PREVENTED | 611 | 26 | 5 | 1 | 0 | 2 | 17 | 1 |

All three full deterministic replays PASS. Both long traces also PASS JSON restart during escort and **two FileWorldStore/PersistentWorldService restores** with zero offline calendar change. Recorded continuation afterward: ordinary **745 operations**, mine **494 operations**, exactly the same final hash. Five representative real-v1 generations still pass migration/save/reload/continuation in the **111 PASS / 0 FAIL / 0 SKIP** regression; the actual recorded v2 source migration also passes. Content audit, assets and client build PASS. No original player save is edited.

The ordinary run's actual family-reunion fact is `social:13323`, Day3 at 208777.3528 calendar seconds; Finn and NPC002 met near the inn, approximately 2.18 metres apart, after physical escort. Its legacy summary field `rescueDemonstrated:false` counts only structural casualties; the manifest separately includes the actual family-reunion evidence. The mine run's `social:18611` records player rescue of NPC086 at the real dwarven inn, sourced to collapse fact `physical:15813`. Only NPC086 was physically caught in this run. No other named worker is spawned or moved into danger to satisfy a scenario.

Both runs obtain their response destination through conversation: Finn's seen account of grain-store damage reaches the player through `conversation:11906`; NPC036's actual observation of the shaft reaches the player through `conversation:16873`. Origin facts, speaker, original observer and testimony chain are retained. Neither trace fabricated a remote deadline, culprit or future event. These particular conversations retain clear firsthand accounts; a new production misunderstanding chain is **not** claimed (the existing focused hearsay/interpretation tests still pass).

Natural-life scope: ordinary uses 45 completed paid work activities, four meals and four rests selected for public hunger/fatigue/night. It reaches Day5 05:35 with HP140, continuing ordinary work after fire failure, repair and family handoff. This is a laborer's life with substantial repetitive work, not proof of broad profession balance or a ten-day complete game. Mine remains an explicitly fixed macro stress itinerary, not a second natural-life certificate. The mine is physically accessible/recovered but still not operating because this player did not subsequently choose reopening; that consequence persists. Ordinary ignores the remote mine, whose real trapped inhabitants remain unrescued.

Checkpoint chain safely pushed in this continuation: `7044a91d` → `a9ef50c6` → `3632dca0`. The earlier phase chain is recorded above. No force-push or main change. UI changes are limited to truthful interaction availability, neutral public occupation wording and recipient-aware arrival text; no graphics/art polish. Browser/visual verification remains **SKIP**, not inferred from build success. NarrativeProvider architecture is unchanged and paid/live LLM calls remain **0**.

Current remaining issues and next step:

- **P0:** the observed private-role disclosure is fixed in compiler, public projection and reviewed save migration. No further P0 found by these sampled traces/tests; this is not a whole-world proof.
- **P1:** harbor/resonance/border and combined T03, T07/T08, T11/T16 still need shared causal migration. T02 ignition still lacks complete arsonist/debt agency and fire propagation/player exposure; rubble affects access/actions but does not fully replace static navigation collision. Historical HP0 people are intentionally not resurrected. Fully blind long-distance discovery and arbitrary HTTP timing equivalence remain uncertified. Repeated escort episodes and more diverse family/professional response contexts need broader behavioral coverage.
- **P2:** ordinary work/price/profession balance and human decision density need play review; 197 diagnostic decisions are not 197 independent human dilemmas. Visual feedback for fire, smoke, evacuation and recipient handoff needs browser review. Recorded certificates require pinned runtime code, not merely a content hash.
- **Next implementation:** use a differently shaped remaining crisis to extend the already working physical aftermath/resource/information primitives, beginning with an actual public discovery trace and its first missing affordance. Preserve these three certificates and add one targeted regression per actual new cause; do not expand to dozens of simulation seeds or add a dedicated victory button.

USER DECISION REQUIRED: **none**. The phase has verified prevention, failure/aftermath, conversation-derived discovery, rescue and continued multi-day life. Whole-world causal completion is **not** declared finished.
