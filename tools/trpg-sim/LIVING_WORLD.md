# Living-world simulation contract

The no-player world run is a closed, deterministic simulation. It does not
assume that a player supplies missing evidence, combat power, money, diplomacy,
or travel. In no-player mode, NPCs may search, warn, evacuate, treat, conceal,
exploit, or reduce secondary damage, but they cannot set an authored trouble to
`resolved`. Avoiding those crises is the player's game responsibility. The
canonical 100-day run therefore follows the source non-intervention outcomes;
NPC agency changes who learns, moves, survives, disappears, or is harmed.

## NPC state

Every source NPC has a persistent state for all 400 ticks:

- hub and facility position, plus route travel when applicable;
- life state (`alive`, `injured`, `dead`) and presence (`present`, `traveling`,
  `missing`, `departed`, `sealed`, `not-present`);
- health, fatigue, stress, and current goal;
- beliefs and acquired facts with time, place, confidence, and provenance;
- a decision/action record, including an explicit reason when the NPC stays in
  place or cannot act.

Death is terminal. Missing, departed, sealed, and not-yet-present NPCs cannot
contribute on stage. A later return or awakening requires a logged source rule.

## Tick order

Each day has morning, afternoon, evening, and night ticks. A tick is resolved in
this order:

1. complete due travel;
2. activate story events and crisis state changes;
3. evaluate source-backed lifecycle/fate rules;
4. observe facts at the NPC's current facility;
5. exchange at most one hop of information;
6. score all NPC intents against the same pre-action snapshot;
7. resolve intents in stable NPC-ID order;
8. progress crises and write full trace snapshots.

Random choices use keys derived from the root seed, NPC ID, tick, and purpose.
They never consume a shared mutable random stream. Reordering the source NPC
rows therefore cannot change another NPC's result.

## Movement

The 103 source facilities remain distinct. Movement is either:

- local: facility to facility inside one hub;
- regional: an existing source route between hubs, with its configured duration;
- offstage: a logged disappearance, capture, departure, or sealed state.

No state transition may place an NPC in two locations, bypass a route, or allow
an NPC outside their source-backed movement range without a crisis/fate reason.

## Knowledge and planning

Crisis awareness is not global. A rumor begins at a specific facility and tick,
then propagates over time through co-location, local public notices, and later
through routes or carriers. There is no same-tick multi-hop broadcast. NPCs only
accept rumors matching their interests unless the rumor's importance exceeds
their attention threshold. Every acquired fact keeps its source fact/event/NPC,
availability time, and hop count. New relevant knowledge forces a plan review;
the trace records either a new goal or the reason the old goal was retained.

The baseline schedule competes with survival, evacuation, investigation,
warning, rescue, treatment, defence, exploitation, sabotage, and crisis support.
Utility includes urgency, personal relevance, belief confidence, occupation and
goal alignment, needs, risk, travel cost, and plan-switch cost.

## Required invariants

- 110 NPC traces and 44,000 state snapshots for a 100-day run;
- one decision/action or explicit unavailable state for every NPC and tick;
- no unexplained teleport, route-duration violation, or range violation;
- no future-event knowledge and no knowledge without provenance;
- no normal action, movement, contribution, or communication after death;
- no on-stage contribution while missing, departed, sealed, or not present;
- every life transition has a time, place, cause, and source rule;
- all source non-intervention fates are evaluated or explicitly recorded as
  narrative-only;
- identical input, tuning, and seed produce identical world and per-NPC hashes;
- a no-player run resolves no authored crisis; NPC actions only alter its
  consequences. In particular, unassisted T01 ends with Finn's death and may
  severely injure villagers who attempt a rescue.
