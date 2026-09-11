# CORE SIMULATION REFORMATION: PASS 2 recovery

Date: 2026-09-11. Game: TRPG（仮）. Repository name has no design authority.

## Durable source chain

Started on `feat/persistent-world-rpg`, original HEAD `c456805ae426a44d3abcda3696347599a6613aa2`.
First preservation checkpoint: `505bf20481db92deade7e1a0907cb5695f12ce93`.
At continuation recovery, HEAD was still 505bf204; no subsequent commit or remote branch existed.
The working tree contained 22 tracked modifications (one normalization-only) and 10 new source/test/fixture files plus fixture manifest; none staged. No changes reverted.
The first checkpoint classified 475 untracked files; eight temporary reports were retained locally and excluded from Git. See CHECKPOINT.md and checkpoint-inventory.json.
The continuation explicitly authorizes normal pushes to `feat/persistent-world-rpg`; main/history must not be overwritten.

## Recovered verification

| Check | Result | Evidence |
|---|---|---|
| Full world suite | PASS 62 / FAIL 0 / SKIP 0 | reports/pass2-final-check.log |
| Reformation contracts | PASS 10 | core-semantics.test.mjs |
| PASS 2 behavior/migration | PASS 12 | pass2.test.mjs |
| Simulation | PASS 19 | simulation.test.mjs |
| Playability | PASS 6 | playability.test.mjs; actual all-region and Finn journeys |
| Server contracts | PASS 12 | server.test.mjs |
| Asset contracts | PASS 3 | assets.test.mjs |
| Content audit | PASS, 5 explicit migration warnings | no numeric relationship/event-resolution authority |
| Asset inspection | PASS | exact local licensed GLBs and bindings |
| Client build | PASS | 187 outputs, 3,120,264 bytes, initial gzip 398,024 bytes |
| Browser smoke | PASS | Local isolated-save server, title/time explanation, inventory affordances, lie-down command and horizontal 3D posture |
| Real local saves | PASS 19 / 19 | loaded copies through real service; calendar unchanged; originals byte-identical |
| Paid LLM calls | 0 | default deterministic; no provider network requests |

The earlier combat test failure was an obsolete immediate-damage assertion: it attacked again after the pending action killed the target. The earlier training failure expected a single one-hour instant unlock; training now requires two half-hour lessons. Both tests were corrected to validate the new behavior. Finn's test now follows his changing physical position rather than an obsolete coordinate snapshot.
After the final full run, the crime-observation/rumor hooks changed. Their affected reformation + PASS 2 suites were rerun: PASS 22 / FAIL 0 / SKIP 0. The client was unchanged by that server-only follow-up.
Legacy TRPG audit/replay suites were not run and are not completion evidence for this rebuilt runtime.

## Authoritative paths now used

- Compiler emits explicit disclosure policies, causal bindings and partial source coverage; no trust, pressure, pressure growth, pressure dependencies or mechanism array. Recursive audit rejects resurrection. Current content revision: `world-10d-24de1ef85209`.
- WORLD_TIME is the calendar. SIMULATION_TIME is active local realtime for movement, effects and combat actions. Old combatTime/localSimulationTime values migrate into it. Closed-game elapsed time is discarded; conversation/read/menu pause; combat advances simulation but not calendar. Macro activities advance world systems explicitly. Activities truthfully expose collapse interruption only; user cancellation is not yet implemented.
- Relationship cooperation derives temporary utility from NPC-known, provenance-bearing, directly relevant history, actual fulfilled promises, needs at receipt, harm, risk/resource cost and current needs/goals. No stored universal score. Attribution conflicts and rich beliefs/obligations still need work.
- Conversation uses server-issued contextual intent IDs and session/turn validation. ASK_ABOUT, SHARE_INFORMATION/WARN, OFFER_HELP, REQUEST_HELP, MAKE_PROMISE, LIE, CHANGE_TOPIC, LEAVE are executable. Topic paging replaces a fixed choice count. ACCUSE/BARGAIN/THREATEN remain absent.
- Narrative: deterministic/mock/cache plus injected transport live adapter with schema/allowlist validation and timeout/abort. Default runtime makes no live calls. Explicit enable flag is a continuation requirement still to add; transport injection alone was the initial opt-in boundary.
- Affordances support sit/crouch/lie/stand, roll/dance/shout observable acts, dropping/recovering actual inventory and contextual pickpocket. Availability checks actor health/activity/mount/ground, presence, distance/LOS and actual possession. Lie has a basic physical client pose; expression animations are not polished.
- Theft removes actual victim money, changes player possession, records an attempt/fact, gives immediate knowledge only to witnesses, and later lets a living awake victim notice a shortage without learning the culprit telepathically. Witness claims can propagate and motivate site inspection/crime report. Money-only pickpocket still needs generalized nested property/custody.
- NPC utility chooses priority, bounded uniform-cost symbolic search builds action steps. Shared preconditions/effects/locations/resources/durations, persistent cursor, failure trace and replanning replace fixed food snippets. Search has shop/work/forage/helper alternatives, and offscreen actors execute the same plan. Region changes invalidate local plans and use destination coordinates.
- Shared causal semantics execute compound predicates, actor co-location, resource consumption, document custody and evidence-bearing milestones. T01/T10/T13 remain authored hybrid components; no five additional crises were hardcoded.
- Component resolution does not resolve other causes merged into the same event. T01 reunion, T10 institution adjudication and T13 water/core containment are tracked as partial progress. Completed components are not undone by failure of unrelated unmigrated causes.
- Rescue candidate evaluation now includes health/capability, role/personality motivation, relevant relationship evidence, hunger/fatigue/current danger/activity and resources. Actual approach/carry/treatment occurs. It remains a bespoke executor and must migrate to the shared planner, especially incapable-witness-to-helper chains.
- Treatment billing records actual medicine consumed from the rescuer and bed service used. Costs derive from medicine catalog/bed service (inn fallback matches existing 8G lodging); debt records provider and service. No fixed 12G defeat tax.
- Training records teacher facility, duration, prerequisites, equipment, completed/interrupted lessons and mastery across sessions; defaults two 30-minute lessons. Rich teacher availability and practice assessment remain pending.
- Five representative real v1 fixtures preserve simulation data with owner/session/player-name/receipts sanitized and original SHA provenance. Explicit known-version/hash and structural compatibility checks reject unknown content versions. v1 → v2 → persisted reload → equal deterministic continuation passes. Legacy trust/pressure remain archive-only.
- Player attacks persist an action instance with windup, active window, recovery, hit-volume descriptor and cancellation on death/stagger. Range/LOS/alive validation and damage execute on simulation advancement, not command receipt. No setTimeout damage. Final directional melee geometry/projectile entities remain pending.
- Client title is TRPG（仮）; obsolete offline/conversation time prose and food-as-instant-heal semantics removed. New contextual affordances use real service commands.

## Remaining priorities

P0: no known data-loss regression in exercised paths. Save migration deliberately rejects unknown revisions/hashes.
P1: belief/credit/debt semantics; context-based interpretation beyond occupation/traits; general timed WorldAction/property objects; incapable witness seeking helper through the common planner; temporal hit miss/reload/cancel behavioral coverage; institutional authority/custody depth; full causality for remaining source causes. No claim of whole-world reform completion.
P2: training assessment and scheduling, planner budgets/performance, action presentation, long-session fact retention, balancing and production art (not this pass's focus).
User decision required: none for settled design or branch push.
Next implementation step: relationship + interpretation + generalized action/property representation, followed by a separate checkpoint, then shared rescue planning and combat/save regression.
