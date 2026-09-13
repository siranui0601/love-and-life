# Causal completion evidence, September 13

These are developer verification artifacts, not the player public projection. They may contain private world state. Do not serve these files as player knowledge.

## Checkpoints

- `7044a91deac634b0d22dcfc6e77652a6693d7316`: retired generated private-role biographies; macro activity refuses/interrupts for real danger. Full 109 tests PASS.
- `a9ef50c6e5de82eac506e768687c3a6cf3b8035b`: missed return deadlines do not cause instant death; later physical reunion preserves historical failure. Full 110 tests PASS.
- `3632dca05c21fb85e812de7ca0c698183a7d8925`: observed recipient contact and actual handoff; correct arrival information and public-danger preparation. Full 111 tests PASS. This is the runtime/content version for the final representative reruns.

All commits were fast-forward pushed only to `feat/persistent-world-rpg`. No main changes or paid/live LLM calls.

[Final manifest](3632dca0/manifest.json): prevention, ordinary Day5 with fire recovery/family handoff, and mine Day5 with actual trapped-person rescue all PASS exact replay. Both long traces PASS intermediate JSON replay, two file-store restores without offline time and exact suffix continuation. Records and intermediate states are archived beside the manifest with normalized SHA-256 hashes. `handoffs` records actual family reunion separately from structural rescue; the original summary's `rescueDemonstrated` field only counted the latter.

## Historical results retained honestly

- `cf93-ordinary-historical-summary.json`: exact replay and Day5, but affected by the subsequently discovered generated-role disclosure. Not a current information-safety certificate.
- `b235-ordinary-refined-failed-summary.json`: gameplay failed at Day1 collapse; exact replay reproduced the failure. Led to the macro/combat boundary correction.
- `7044-ordinary-boundary-failed-summary.json`: Day3, missing treatment for an NPC killed solely by a missed-return deadline. Led to the physical-life correction.
- `a9ef-ordinary-overdue-summary.json` and save summary: Day5, actual fire recovery and continued life, intermediate JSON and two real file-store restores PASS. The return-person handoff was still unfinished. Do not call this a completed rescue. `rescueDemonstrated` in the scenario summary counts structural casualty recovery only; actual family reunions must be checked separately in the objective facts.

## Reproduction and scope

From the pinned runtime checkout, run:

```text
npm run world:check
node tools/trpg-world/validate-aftermath-worldlines.mjs prevention prevention-final
node tools/trpg-world/validate-aftermath-worldlines.mjs ordinary ordinary-final
node tools/trpg-world/validate-aftermath-worldlines.mjs mine mine-final
node tools/trpg-world/verify-aftermath-save.mjs ordinary-final
node tools/trpg-world/verify-aftermath-save.mjs mine-final
```

The mine travel prefix is structural feasibility, not a blind policy: topology is known to that layer, while subsequent local choices use public offers, witnessed information, inspected services and actual movement/combat. Its fixed work/meal/rest cycle is a causal stress itinerary and does not prove natural sleep timing. The ordinary run uses public hunger/fatigue/night and paid work; it is one laborer's life, not an optimal human strategy or autonomous all-Trouble solver.

All operations execute the shared authoritative runtime. Exact recorded subdivisions and hashes are checked. File-store validation restores an actually reached intermediate state via PersistentWorldService, twice with much later wall clocks, then executes the recorded shared-runtime suffix. This is not proof of arbitrary HTTP timing equivalence. Original user save files are untouched.

Decision units distinguish movement/travel, inspection, conversation, preparation and combat. They are a diagnostic decomposition, not measured human decision density. Build/asset passes do not certify visual presentation; browser review is SKIP for this continuation.
