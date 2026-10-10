# Blender wall/stair revision — B07 checkpoint

User correction: high, oppressive walls are desired morphology, confirmed against both reference images. Preserve their height and monumental character. Evaluate readable wall-side circulation, landings, vistas and controlled upper-district access. Do not lower walls merely because they feel imposing.

Latest Windows artifact:
C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b07\capital-city-b01.blend
Source: C:\Users\inaba\capital-pass-8-review\tools\trpg-world\blender

Changes since B02:
- Added three wall-following stair connections for isolated street pockets.
- Seven stair alignments now have discrete treads (riser <=0.17m) and landings after about3m rise.
- Corrected profile-height interpolation in connectivity audit.
- Added explicit lower passage openings in noble ramp support faces.
- Widened/re-aligned northern switchback after actual mesh probe collisions; reject self-intersecting centreline input.
- Landing connectors reject sampled higher terrain rather than simply taking the nearest street.
- Added audit-blender-clearance.py: actual Blender terrain/support mesh BVH, torso probes at centre and +/-0.3m.

Windows B07 results:
core6.4999785km²;637 routes;1 connected component;0 sampled buried routes;cart grade maximum8.8608%.
Actual mesh torso probes117921; blocked0. This only checks a0.6m corridor; NOT full-width, cart clearance, headroom, floor support or gameplay acceptance.
Blender generation and8 renders completed. B04 stair-entry renders visually inspected; B07 full image review still pending.
Audit overall status deliberately REQUIRES_3D_REVIEW, not completed-city PASS.

Known unresolved:
- Linux generates595 routes vs Windows637 from nominally same Shapely version. Geometry subdivision needs deterministic precision/tie-breaking before runtime integration.
- Full-width collision/headroom/floor continuity and stair exit review pending.
- River bridges/banks/flood routing, district structure and secondary streets still need authored review.
- Social gates/events/NPC/facility reassignment remain unintegrated; canonical IDs unchanged.
- No buildings populated. No main merge or VPS change.
- Existing dirty runtime QA files are unrelated and preserved.

Next: inspect B07 stair exits and overview; widen collision probes; verify river crossings structurally; checkpoint each Blender version without overwriting user-open unsaved scenes.
