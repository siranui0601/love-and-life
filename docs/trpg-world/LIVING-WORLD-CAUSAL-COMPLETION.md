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
