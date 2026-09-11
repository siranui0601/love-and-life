# Persistent World RPG architecture

`/TRPG/` is the new game entry point. `legacy.html` is a separately retained
text and choice experience; it is not part of the persistent-world simulation.

## Runtime boundary

The browser uses Babylon.js 9.25.0 and glTF/GLB assets. Babylon was selected
after checking the existing Node/Express deployment and the web constraints of
Godot and Unity: it keeps the current JavaScript delivery path, while its scene,
animation, camera, lighting and loader systems provide a real 3D runtime. The
authoritative state remains engine-neutral in `src/shared/trpg-world/` so a
native client can replace the browser renderer without changing saves or rules.

The Node service owns elapsed time, commands, collision-safe movement, NPC
decisions, event pressure, combat, inventory, skills, transport, knowledge and
durable saves. A client submits bounded intent (`input`, `interact`, `attack`,
`travel`, and similar commands); it never submits a position, clock, state or
reward. Every accepted command is sequenced, receipt-recorded and persisted
before acknowledgement. See `docs/trpg-world/PRODUCTION.md` for the single
writer storage and release constraints.

## World model

The compiled private catalog contains 11 connected regions and 15 physical
routes. Each region has authored facility footprints, roads, exits, water or
ridges where appropriate, collision-aware foliage, NPC residences and work
sites. The browser loads one region at a time but receives a shared world clock;
NPCs continue to choose goals, walk, work, rest, talk and travel while the
player is elsewhere.

The new baseline is 10 game days at 60 game seconds per real second. Nineteen
source trouble rows are regrouped into eight larger crises with independent
deadlines, pressure, aftermath and five causal intervention families:
community, logistics, investigation, coercion and misunderstanding. A route
flag is never assigned. A resolution is recorded only after its requirements,
evidence and world effects are true. Physical defeat of an event instigator is
the evidence for a coercive solution; witnessed odd behaviour propagates as a
rumor, causes NPCs to inspect the site, and can create a public warning that
enables the misunderstanding solution. Accepted events become urgent quests
near their live deadline, while dangerous routes can produce deterministic
travel hazards that survival preparation mitigates. Physical workshops expose
recipes that turn gathered or purchased materials into supplies, medicine and
reinforced tools; crafting consumes authoritative time and resources and feeds
the same crisis and economy systems.

## Source and art pipeline

`tools/trpg-world/sources/` contains bounded snapshots of the requested world,
combat and skill sheets. The compiler preserves source row IDs and provenance
while reauthoring layout, timing and balance. The generated content is private
server data and is not copied to `public/`.

All visible buildings, actors and creatures are loaded from semantic GLB asset
roles. The current deployable library is the verified Kenney Fantasy Town,
Blocky Characters, Cube Pets and Prototype packs. `public/TRPG/world/assets/manifest.json`
records hashes, source archives, licenses, animation names and texture
dependencies. Replaceable roles keep art changes independent from world saves;
the prototype broom and some creature mappings are deliberately marked as
blockout art in the production notes.

## Verification

Run `npm run world:check` for content topology and evidence audit, GLB/hash and
  texture validation, 39 authority and world tests, and the bounded browser build.
Run `node tools/trpg-world/browser-smoke.mjs` with `npm run world:serve` for the
Edge/WebGL smoke path. That smoke test also checks keyboard movement, inventory,
the 11-region map, reload persistence and browser request errors.
