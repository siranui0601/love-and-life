# East castle wall ascent: accepted local structural revision, not final art or gameplay
Date: 2026-10-10 (19:10 JST). Windows original:
C:\Users\inaba\Documents\TRPG-Capital-Blender\current\capital-parcel-review.blend.
The rolling capital-parcel-review-last-good.blend contains the prior
18:03 palace build. The current file was saved IN PLACE after QA and reopened.

- Removed old castle_east_ramp (523.37m) and FIVE obsolete related meshes.
- New pedestrian stair 141.53m, 240 treads as ONE mesh batch.
- Separate roofless freight incline 148.43m, approximately 22.5deg.
  Do NOT treat as ordinary self-propelled cart road; winch drive, stopping,
  loading controls and game-level NPC transport remain unimplemented.
- Added fully backed, embankment-type stone landform, heavy portal crossing
  at royal castle parapet, dressed buttress bands and two intermediate lookout
  bays reached via two new pedestrian side routes.
- Existing castle west pedestrian stair and east upper landing remain
  unchanged, so future level-design must verify congestion/wayfinding.
- LOCAL Blender QA 6 relevant routes, 1,146 floor probes 0 missing,
  2,292 body/head rays 0 collision; all other authored route IDs unchanged.
- Canonical parcel survey for x=390..415,y=900..1015 showed zero area overlap.
  A bounding-vertex inside-solid audit of nearby 8 grouped legacy meshes,
  including forecourt buildings/facades, found 0 candidates, but this is
  NOT a comprehensive BVH mesh-intersection test.
- Actual Blender reopened with 1,221 authored routes, previous palace meshes,
  parks, ground fixes, and cargo-hoist animation retained (Z 0/70/0).
- Citywide floor/road survey re-run using extended floor-mesh recognition:
  1,221 routes/196.48km, 175,111 floor-probe rays, 33 anomalies.
  This is NOT a direct 2,439->33 floor repair delta, because mesh eligibility
  and route-name recognition differ from the previous audit. Current anomalies:
  castle_wall_stairs (21, route below raised ground), noble_west_contour_1 (9),
  civic_foot_contour_1_retained_1 (2), court_wall_stairs (1).
- Visual status: improved over spindly slab/barren ramp, BUT WIP:
  black 48m buttressed wall flank and wider ravine remain too geometric.
  Need proper castle integrated stone/terrain transitions, doors and public
  activity at overlooks, player camera/navmesh/cart simulations and royal
  landmark composition. Keep the global Notion task unchecked.
