# B108–B111 王都・南側街区と行政↔上層階段のレビュー（未受入）
2026-10-10 / all drafts are saved as distinct local Blender versions.

## B108–B109 steep royal access: REJECTED
- B108: 1170m civic royal ramp alternative, horizontal route approx 206m with 415 steps, cargo/person hoist represented only as physical props. Existing 1170m ramp preserved; no transport simulation.
- B108 geometry audit: 3,000 obstacle rays, 27 blocking intersections; 1,338 floor samples, 28 unsupported.
- B109 improved parapet bends + four side overlook decks but real audit: 3,000 rays, 16 blocks; 1,332 floor samples, **83 unsupported** (regression).
- Therefore the B108/B109 models were **not used** as the base for B110/B111. The live alternative is NOT traversable or accepted. Need cut-into-rock masonry stair or usable hoist with real landing and walkway tests.

## B110–B111 Southern living quarters
- Intent: Replace soulless houses and empty spacing with four purpose-based districts along existing road net: south gate caravan arrival, west public commons, eastern artisan guild/work yard, river-adjacent timber/rope works.
- B110 removed 389 ordinary lots, produced large empty squares. **REJECTED visual review.**
- B111 revision uses narrower sites, perimeter streetside halls, smaller courtyard cores; 295 ordinary lots replotted; 206 new meshes. This is still a **WIP appearance and gameplay test**, not accepted concept art quality.
- Named canonical parcel IDs preserved (2 in this parcel study; not a claim to cover the entire official TRPG data).
- Preserved 1,184 baseline B107 routes bit-for-bit. B111 2D overlap test 772 building-road comparisons: 0 intersections.
- B111 3D local head/body route samples: 55 targeted roads, 9,480 rays, 0 collisions with NEW B111 building objects. Does not examine old houses, live gameplay capsule, route interiors, NPCs or freight operations.
- Remaining visual flaws: freshly added roofs and workshops look repetitive, masonry/door/function needs real detail; roads still too mechanically neat and district differentiation weak; palace/mage and upper city weaknesses all pending.

## Files (PC)
- B108: C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b108\capital-parcel-review.blend
- B109: C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b109\capital-parcel-review.blend
- B110: C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b110\capital-parcel-review.blend
- B111: C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b111\capital-parcel-review.blend
- B99 and B107 sources protected; main branch / runtime deployment untouched.

## Next quality gates
1. Royal access: stair continuity, riser height, landing support, cart/person service operations; no construction blocks existing gate roads.
2. Southern shops: windows/door stoops, shopfront variety, material and scale, working courtyards, carts/materials and nighttime/light quality.
3. Revisit mage court and royal castle with castle walls, architecture, real 3D elevation and authentic play loops.
4. All-city existing floor holes, old stairs/foundations, road/bridge distribution + tested exploration routes.

Notion: https://app.notion.com/p/3f4890a55fd08109be2ade087dcedbf6?pvs=204
