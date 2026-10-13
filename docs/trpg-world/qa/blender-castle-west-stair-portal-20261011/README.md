# Castle west stair: open buried upper mouth, add continuous stone guard
2026-10-11, checked in actual Blender 5.2.2.
Scope: historic castle_wall_stairs route last section Z~201-204.
- Original b104_castle_outer_ground_extension flat elevation Z204.02
  had 34 faces physically overlapping the final 21 citywide floor probes
  along the staircase ascending from Z202.42 through Z203.42.
- Used plan-aligned 2D constrained polygon cut along 200.8<=z<=203.62,
  clearance width 5.1m. Cut 38.291m2 and removed 34 occluding ground
  triangles. Existing 593 staircase treads unchanged.
- Integrated two solid limestone vertical edge/guard liners,
  one Blender batch mesh (204 faces), extending from step-level up to
  205.32m without a roof or overhead footway obstruction.
- Stage actual QA: 170 stair-floor probes 0 missing, protected edge 68
  outward rays with 0 gaps, new guard head/torso 0 collisions and adjacent
  existing upper castle streets 0 new obstructions.
- Whole-city same configured diagnostic: 1,222 routes, 174,685 rays,
  anomalies decreased 35 -> 14 (castle_wall_stairs 21 -> 0). The other
  14 include genuine ramp/contour overlaps still needing correction.
- Atomically replaced current/capital-parcel-review.blend preserving
  last-good rolling backup. Reopened live Blend and verified stair ground
  404 faces, two guard liners as 204 faces, old 593 stair tread faces,
  preexisting residence and park meshes, deleted long ramps, hoist
  animation Z0/70/0 at frames 1/121/241.
- This is local geometry/safety proof only. Other citywide wall and
  fall-edge QA, visual architectural refinement, swept player/cart
  collision and NPC pathfinding remain unfinished.
