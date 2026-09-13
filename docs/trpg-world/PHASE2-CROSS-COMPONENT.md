# Phase 2 cross-component continuation

Starting checkpoint: `9ad51ebb4b1fa921b194f3a7f03e4b0e059887e6`.

## Shared process milestone

Four authoritative process types now accept normal player commands: device isolation/repair, actual resource deposit/distribution, poisoning/treatment of an existing person, and evidence submission/review by a present living official. The compiler binds fourteen additional source components to these types. Reading creates knowledge, submission deposits copies, reviewing creates an institutional order; no dialogue or process command directly resolves an event. Device failure closes the actual facility; subsequent repair reopens it while retaining the failed history. Combined outcomes require all bound source endpoints and previously migrated components.

Bindings: harbor (patient/payroll/customs/port machinery), resonance (three device sites), border (two inquiries), T03 (pasture gate), T07/T08 (bond/passage inquiries), T11/T16 (guard-order/civic inquiries). These are **partial migrations, not certificates of the full authored crises**. In particular, arresting traffickers, actual naval operations, pilgrim displacement, military deployment, and resident responses to every institutional order still need physical execution. The apparatus at a site does not prove that entire Trouble playable. No victory button or route flag is added.

Production generation is `world-10d-c0ca1f03faba`. Historical saves are allowed only through reviewed hash pairs. New process bindings are dormant in imported older saves; previous physical outcomes and people are preserved, without retroactively poisoning or failing new components. New games use the full new bindings.

Validation: `npm run world:check`: **115 PASS, 0 FAIL, 0 SKIP**, content audit, assets and client build PASS. Four additional process tests exercise preparation, real work, failure/reopening, document submission/present official, patient treatment and exact intermediate replay. No browser verification in this milestone. Paid/live LLM requests: **0**.

Next milestone: a knowledge-only player observation boundary and blind ordinary-life execution, including first-missing-affordance reports rather than hidden-map routing. Phase 2 is **not complete**.

## Blind observation milestone (execution still in progress)

`view.perception` separates scene geometry from encountered places/exits, observed people, inspected services, read notes and heard directions. The blind policy receives an explicit JSON allowlist; object IDs and action handles are opaque, no event catalog or regional topology is passed. Footsteps use nearby observed collision geometry and normal movement/travel commands. The policy module imports no runtime, content or validator internals. Hidden town/site/event/deadline counterfactual tests return identical blind input/decisions; inspection remains stable after 10/30/60 seconds. Meaningful action handles exclude wording and conversation receipts.

The first substantive trace reached Day2 13:58 in the trade city, then repeated a reported person's old coordinates. The runtime now distinguishes a visible person, a last-seen location, and arrival where nobody is present. It never substitutes the person's unknown current location. A real conversation and replay regression cover this case. A subsequent run was stopped because its footstep executor unnecessarily recomputed A* every frame; it is UNKNOWN, not a completed certificate. Local paths now persist until observed geometry changes. No hidden-map route was added.

Four source facility descriptions contained design notes such as T numbers or "true-cause proof". These are now server-only source notes, with authored physical descriptions replacing player-facing prose. Exact old inspection copies are archived on migration; objective history remains untouched. Reviewed generation: `world-10d-1620f79180c0`.

Full `world:check`: **119 PASS / 0 FAIL / 0 SKIP**, including assets/audit/build. An earlier full run had **118 PASS / 1 FAIL**: first projection and subsequent restore exposed different discovery bookkeeping fields. The duplicate player fields were removed; the affected real HTTP regression subsequently passed. Two later focused tests (semantic handles and archival of design inspections) also PASS. Production blind execution and its multi-day completion certificate remain pending; no claim of Phase 2 completion.
