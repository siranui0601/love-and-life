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
