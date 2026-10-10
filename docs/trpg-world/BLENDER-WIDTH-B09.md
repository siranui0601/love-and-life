# Blender B09 — 2026-10-07 JST
Status: unaccepted city design study. Supersedes B07 for width diagnostics, not a completed city.

User-confirmed design direction: monumental, oppressive walls are desirable; keep their height. Make circulation readable and physically possible alongside them.

Changes:
- Wall gaps use actual primary/entrance road footprint plus3m clearance.
- Wall towers excluded when their footprints intersect gate corridors.
- Road ribbon corner joins preserve width using miter offsets.
- Cart ramp bends use quadratic transition curves; this resolved remaining castle ramp support/edge collision.
- Added audit-blender-width.py (centre,+/-0.3m,road edges minus0.4m, torso height).

Windows B09:
647 candidate routes;1 component;0 sampled buried routes;maximum cart grade0.08946186000503827.
198040 mesh torso ray probes;0 blocked. B07 width check had10 hits;B08 had1;B09 has0.
Overall audit still REQUIRES_3D_REVIEW. Neither ray counts nor connected graph certify city quality or player/cart physics.
8 rendered views generated; B09 overview inspected. Low-city street subdivision still reads too regular and river integration is weak.

Artifact:
C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b09\capital-city-b01.blend
Also plan.json, audit.json, connectivity-audit.json, blender-width-clearance.json,8 PNGs.
Existing user-open Blender scenes were preserved; generated candidates use new version folders.

Outstanding:
1. Author riverbank/bridge approaches and low-city secondary street structure before parcels/buildings.
2. Deterministic cross-platform geometry (B07 Linux595 roads vs Windows637 remains unresolved).
3. Full-width swept-volume collisions, headroom, floor support and actual walking.
4. Stair exits, vista/reveal, social access, four canonical bridge mapping and flood/event states.
5. Facility position reassignment with all12 IDs preserved; no new canonical cultural/facility assumptions.
6. No main merge/VPS deployment; runtime city unchanged.

Source reproducible from scripts under tools/trpg-world/blender. Shapely2.1.2 planner; Blender5.2.2 LTS builder. Use fresh output directory to avoid overwrite. Diagnostics write JSON and exit0 even when their status fails; inspect status fields.
