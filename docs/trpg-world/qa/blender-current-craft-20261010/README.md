# Restored Market Craft Quarter — current Blender, 2026-10-10

**Status: structural local QA passed; urban-design/gameplay acceptance NOT complete.**

## Why this exists
User rejected western_ascent_market_ascent_restored_ground as a large purposeless blank space.
This pass makes an actual district: interconnected circulation, shops on street frontage,
the working functions of crafts, a guild courtyard, a forge and a common herb garden.
Structures are provisional; do not write these facility names into the canonical TRPG spreadsheet without approval.

## Installed in the single shared current scene
C:\Users\inaba\Documents\TRPG-Capital-Blender\current\capital-parcel-review.blend
No numbered design-b117 etc folder was created.
- Area studied: restored former market rise, 32,072.83m².
- 17 additional connected routes, total 694.21m, with preserved existing routes.
- 6 destination/work sites with actual frontage spur paths:
  caravan wheelwright and timber repair; stonecutters and wall-repair supply;
  craft guild meeting yard; forge; textile dyeing/drying yard; communal herb court.
- 6 smaller shops along new street-frontage paths.
- 14 material-batched Blender mesh objects and 174 authored composite geometry units.
- The new sites are independent from the canonical 17,372 parcels: 0 parcel overlaps.

## Measured QA and rejections
- Original candidate REJECTED: 5 body-ray collisions, 0 floor failures.
  These were 2 rays against a badly placed road marker and 3 rays against the herb courtyard bench.
- Rebuilt current candidate LOCAL_PASS: 2,556 body/head ray casts, 0 blockers;
  1,278 floor-support probes, 0 missing ground; existing route objects unmodified.
- All six major sites and street-front shopfront routes connect to the new spines.
  Primary spines tie into market_ascent_short_lower and market_arrival_court_link.
- Blender color/camera render review conducted for east, west, birdseye and two street views.

## Deliberately NOT checked off
- District still needs denser/varied building architecture, true interior doors, work animation,
  warehouse dependencies, loaded-cart movement, game navmesh and NPC routines.
- No deep linkage between this artisan district and the farther eastern avenue yet.
- 1,170m civic-to-royal ramp, 192m noble stairs, east/west castle access,
  missing other walls, castle upper floor gameplay and the rest of the city are still open.
- Local ray tests are not full player capsule or simulation.

## Recovery
Active shared .blend is overwritten only after candidate QA. One rolling backup:
current\capital-parcel-review-last-good.blend is the previous accepted current.
The .blend binary is not in Git; it lives on the PC, while scripts/QA/images live here.
