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
