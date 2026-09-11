# Playability and worldline validation — implementation record

Starting SHA: `7b8d88dfbe671730734373ade4441f697983d489`, branch `feat/persistent-world-rpg`, clean and equal to origin at start.

## Source and scope

Read TRPG / 開発引き継ぎ (sheet 9001, A1:D521) via Google Drive on 2026-09-11. Historical lessons used: row 13 (semantic identity), 128 (remove simulator repeat-count workaround), 145 (inspection unconnected to evidence), 399/429 (aggregate improvement did not fix the diagnosed loop), 438 (inspect actual available choices). Historical route schedules, three-choice movement, scores, and Human Virtue ledgers are not current design authority. No Sheet was edited.

## Phase A–C

Semantic identities use intent, target and command parameters; never wording. The developer-only replay adapter executes the authoritative simulation functions, saves the initial world and exact command/active-time stream, validates a content hash and checks every resulting state hash. JSON forks preserve intermediate state. It does not change runtime authority or create solver commands. Exact recorded time subdivisions are part of the replay contract; arbitrary HTTP batching equivalence is not yet certified.

NPC entity iteration and planner tie breaking are stable. Knowledge queries no longer re-offer unchanged acquired facts when a conversation is reopened. Read/submitted documents and completed ecological actions are removed from progress candidates. General inspection becomes an explicitly repeatable review. Leads bind known information to a physical destination and expected action, with an arrival result and grounded alternatives. They do not move the player.

Law WIP now assesses provenance, memory quality, seriousness, admission and verified possession instead of counting two witnesses. This remains an evidence-policy foundation, not a finished criminal justice simulation.

Initial baseline was actually rerun: 76 PASS / 0 FAIL / 0 SKIP, 45.36 seconds. Focused phase A–C regression: 44 PASS / 0 FAIL / 0 SKIP. Paid LLM calls: 0.

## Remaining work at first checkpoint

Run and inspect blind, aware and chaotic policies using only public observations. Add bounded structural search with legal walking/actions. Verify destination failure, new knowledge causing a traceable choice change, representative Trouble discovery/solvability, final regression and player-facing notes. Full all-event feasibility must distinguish missing causal implementations from exhausted search.
