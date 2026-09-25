# Causal execution continuation — 2026-09-25

Phase 2 is **INCOMPLETE**. No Day10 all-crisis certificate has been produced.

## Checkpoints and scope

Latest resumption started at `c877926d9d12264270a7b4ff45d285f86fff652e`, matching `origin/feat/persistent-world-rpg`, with the recovered transfer/injury work uncommitted. The previous milestones were `4670ee31` (cargo), `ea6c21cb` (physical orders/assault), `bb2f67c6` (person custody) and `c877926d` (provisioned parties/recall). All were safely pushed to the dedicated branch. Main and history were not rewritten.

The commit containing this report is the powered-displacement checkpoint; use `git log --oneline -- docs/trpg-world/CAUSAL-EXECUTION-CONTINUATION-2026-09-25.md` to resolve its full SHA without embedding a self-referential hash.

## Actual runtime changes

- A damaged powered device exposes existing, physically present NPCs through a persisted windup, revalidates power/presence, consumes a finite charge and moves the same actor to an authored receiver. T04 uses this shared machine model. Isolation before exposure prevents it; isolation afterward does not delete the patient.
- Independent injury cases feed the existing treatment, escort, shelter and medical response system. Deadline failure leaves physical injuries and later rescue opportunities. Real medicine and actual arrival are required.
- A doctor arriving later observes an injured person, not the unwitnessed cause. Objective history and observation provenance remain separate. Public NPC activity no longer exposes the private reason for delivered-order/return behavior.
- New transfer definitions are dormant when migrating existing worlds. The reviewed content revision is `world-10d-8cc8c18b05b7`, parsed SHA256 `e91dabb3a30f29e81b894b81b89c11b33801f979542b8b45f3b09a9d58c47d1b`.

## Verification

- Powered-transfer focused tests: **8 PASS / 0 FAIL / 0 SKIP**.
- Final `npm run world:check`: **181 PASS / 0 FAIL / 0 SKIP**; content audit, assets and client build PASS; process exit 0. This includes the final public-activity wording changes.
- A real FileWorldStore/PersistentWorldService test saves during active exposure, restores an exact durable backup after a one-day wall-clock gap, verifies no offline calendar advance, and compares continued full state with uninterrupted execution.
- Existing replay, migration, temporal, knowledge and normal-command regression tests remain in the full suite. Focused production-map evidence is not a new-game all-crisis proof.
- Browser verification: **SKIP** (no browser/visual completion claim). No long blind or all-crisis candidate run was substituted for missing actor implementation.
- Paid/live LLM calls: **0**.

## Limits and continuation

No P0 regression was observed in the executed checks; this is not an exhaustive absence claim. P1: the machine currently handles NPC inhabitants rather than player-body exposure; a complete generated-world T04 preparation/rescue itinerary is unproved. T03 ecological actors, T10/T16 physical eviction, T15 fleet, T17/T18 evolved combat actors and T19 counterpart deployment remain incomplete. T07 full canonical guard round trip and longer institutional aftermath also remain partial. See `CAUSAL-EDGE-AUDIT.md` for all components.

Next: finish shared actor execution across these components with focused normal-command causal tests, then run the canonical continuous new-game Day10 feasibility witness, exact replay and save/restart certification. Do not improve blind navigation policy as a substitute. Art/spatial rebuild readiness is not yet established.

USER DECISION REQUIRED: none.

## Subsequent occupancy milestone

Powered displacement was committed and pushed as `2ccbcf33`. The following occupancy checkpoint adds actual document carriers, face-to-face vacate notices, walking relocation, physical site-policy enforcement, local recognition of posted orders, official visits to known shelters and informed resident return. It is shared by T10 and T16. Legal ownership is retained; a failure deadline alone no longer replaces the orphanage. Failed history remains failed after late recovery.

Seven focused cases PASS, including actual generated-world displacement of five existing residents and canonical normal-command travel/read/submit/return with save/replay. The latter is a bounded Day7 initial-clock integration test using lodging macro progression, not a natural new-game ten-day witness. A displaced resident can leave on other business; the official cannot track them remotely and waits at the known shelter.

Final `npm run world:check`: **188 PASS / 0 FAIL / 0 SKIP**, audit/assets/client build PASS, terminal exit 0. These results include the final local wake/notification, return-state synchronization and appointment corrections. Browser SKIP. Paid/live LLM 0. Explicitly reviewed content migration: `world-10d-6b5f929bc4d6`, parsed SHA256 `5f81b7b160480aab144138ce9093a339820d6e14b3ba8b1954ce9aad03cb065e`. Historical worlds receive dormant claims, not retrospective evictions.

Remaining P1 is unchanged at phase level: ecological population movement, fleet/blockade, evolved actors, counterpart deployment and the combined Day10 proof; T10/T16 further building conversion and wider civilian conflict are partial. No known P0 regression from the executed checks. P2: browser presentation and fuller resident restitution services. USER DECISION REQUIRED none.

## Subsequent physical-attempt milestone

Occupancy checkpoint `65c61e4b` was safely pushed. T02/T05 now use actual NPC travel, materials and saved temporal actions for ignition and medication administration. Cleanup, purchased antidote/medicine replacement and ordinary pickpocket removal of the source material can prevent those actions. An absent actor does not cause fire/poison merely because the calendar passes a deadline. Eight additional focused tests pass, including both generated-world actors and exact replay/save continuation.

Final full `world:check`: **196 PASS / 0 FAIL / 0 SKIP**; audit/assets/client build PASS, exit 0. Reviewed content `world-10d-b656d4dcc281`, parsed SHA256 `a56d020f664a98680ecc9cd4cf0c46b9fdcaaf22320aa801ca4cf4d384983fd7`. Browser SKIP; paid/live LLM 0. No new long worldline was run; meaningful-decision count for a Day10 witness is not applicable because it has not been obtained. Remaining ecology, fleet, evolved actors and counterpart deployment still block Phase 2 completion. USER DECISION REQUIRED none.

## Final cross-component regression

Physical-attempt checkpoint `7fb3a48840d0e646fb3573ae022979343080a4e9` was pushed. The follow-up commit containing this section connects actual `displaced` tenure to the common source/aftermath predicate; a production-map displacement test asserts that connection. Legacy `evicted` saves remain recognized. The final code again passes **196/196 tests, 0 FAIL, 0 SKIP**, content audit, assets and client build; command exit 0. Source/knowledge boundaries, deterministic replay, save/reload and historical migration contracts are included in that suite. No browser review or new long all-crisis run occurred.

Completed checkpoints this resumption: `2ccbcf33` transfer/injury, `65c61e4b` notice/displacement/restitution, `7fb3a488` ignition/medication, then the follow-up source-predicate commit. All target `feat/persistent-world-rpg` via ordinary fast-forward push. Starting HEAD was `c877926d9d12264270a7b4ff45d285f86fff652e`; final HEAD is the follow-up commit containing this section (resolve with git log).

Exact continuation: T03 requires existing creature population to move between actual habitats and routes, rather than an event-source encounter substitute. T15 requires a real vessel/crew/resource execution path. T17/T18 require one authoritative evolved creature body, not a second HP authority for the same NPC. T19 requires locally received knowledge and delivered counterpart deployment/recall. After those edges and the remaining audit entries have focused evidence, freeze canonical content and execute the continuous new-game Day10 route. Do not treat the isolated command tests or historical long traces as that gate.
