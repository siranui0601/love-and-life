# 王都 Blender current — inplace file & noble quarter stairs/retaining QA
更新日: 2026-10-10 / status: Work-in-progress, **not final acceptance**

## Single active Blender scene, overwrite in place
- PC: C:\Users\inaba\Documents\TRPG-Capital-Blender\current\capital-parcel-review.blend
- Plan data and parcel data live alongside it in current\plan.json and current\parcels.json.
- From this checkpoint, do not create design-b117, design-b118, ...; open and SAVE/OVERWRITE current\capital-parcel-review.blend. Scripts in this commit are idempotent or inspect current.
- Before risky new geometry, use one rolling current\capital-parcel-review-last-good.blend as recovery, updating it only after the saved active scene passes the agreed local tests.
- Repository stores QA tools, logs, JSON evidence and sample renders, but not the 46MB active Blender binary. Git itself therefore does not fully back up the .blend binary.
- Historical design-b* copies B99-B116 were not destroyed. Changes beyond this point go into current.

## Real geometry changes
- B114 consolidated east/west noble stone steps: baseline floor support regressed 13 to 15 errors.
- B115 miter joint geometry: unsupported 2.
- B116 repaired east entry landing and rerouted top bend. Scene promoted to current.
- Added accessible-edge balustrades to both stair corridors: 94 carved stone piers, 170 wrought-iron double rail spans, 10 night lanterns. Post location/rail span design avoids nearby street crossing and stays outside a 4m walking lane.
- Added visible retaining masonry on selected outward noble district wall faces: 22 pier-like counterforts and 126 projecting ashlar stringcourse segments (two vertical bands), not fake functional entrances.
- Re-rendered overview and stair standing perspective.

## Measured checks on final active Blender (not inferred from plan)
- Post-modification four staircase / landing routes: **1857/1857 floor support points**, zero unsupported, using actual Blender meshes.
- Two noble stair routes, nearby retaining, building walls and new detail meshes: **3204 body/head rays, 0 collisions**, 32 scoped meshes (excludes giant visual-only building façade aggregate).
- Expanded noble-quarter adjacent existing roads: **22 roads, 12486 body/head rays, 0 new-detail collisions**, 7 new mesh objects.
- All tests local and discrete. They do not certify player capsule, stair foot contact in-game, collision flags, NPC navigation, freighter movement or building entrances.

## Problems deliberately not marked done
- Elevated noble retaining walls still dominate some viewpoints; wall surfaces and urban street masses still repetitive.
- South districts remain architectural greybox; real work-yards and shop functions are not playable yet.
- Palace and mage tower have real entrance hall but not full upper floors, NPCs or gameplay.
- Rejected administrative to upper plateau stairs B108/B109 are not integrated; structural route alternatives needed.
- Full city geophysical topography, bridges, alleys, river morphology and world design are still WIP.

Source: GitHub branch feat/capital-terrain-streets-pass-8. Notion running record:
https://app.notion.com/p/3f4890a55fd08109be2ade087dcedbf6
