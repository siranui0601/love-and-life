# Blender capital redesign — 2026-10-06 checkpoint

Status: UNACCEPTED DESIGN STUDY. Not ready for PR merge or runtime deployment.

## Why redesign
Existing generated roads/building rows do not form credible blocks, terrain grading loses terrace structure, and road mesh undersides remain visible. Reference images require a dominant castle hill with asymmetric upper neighbourhoods, dense low city, meaningful river edges and streets defined before parcels. PDF explicitly derives roads from terrain/history/life.

## Actual work
Blender 5.2.2 LTS installed on さつまあげ. Existing survey imported separately with all 12 canonical IDs. New editable terrain-first studies created using metre units. No buildings populated.
A study is rejected: uniformly nested terraces read as a layered cake.
B study uses asymmetric flat domains at 14/42/70/78/112/156/204 m, six cart ramps, four stair alignments, primary rights-of-way and a market reservation before block subdivision; outer wall thickness and gate gaps projected from primary endpoints.
These elevations are proposal values, not canonical setting changes.

## Reproduce
Dependency: shapely==2.1.2. Planning/audit scripts run in Python; building runs in Blender background.
python plan-city-b.py <new-folder>/plan.json
python audit-city-b.py <new-folder>/plan.json
blender --background --python-exit-code 1 --python build-city-b.py -- <new-folder>/plan.json
Builder protects existing blend file. Audit reports FAIL in JSON but currently exits 0 intentionally to permit rendering failed studies; never interpret exit 0 as route acceptance.

Windows source: C:\Users\inaba\capital-pass-8-review\tools\trpg-world\blender
Latest artifact: C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b02\capital-city-b01.blend
Renders: Overview.png, Plan.png, Section.png, Market-eye.png in same folder.
Python dependencies isolated under TRPG-Capital-Blender\python-deps; set PYTHONPATH only for planning/audit and clear before Blender.

## Measured, not acceptance
B02: core 6.4999785 km²; 637 candidate routes; centreline burial count 0; maximum cart ramp grade 8.8608%.
Connectivity FAIL: 4 components (633,2,1,1 routes). Isolated civic_foot_contour_2 + civic_foot_lane_1, low_city_contour_6, upper_city_contour_2.
Windows same-level intersection count1288; Linux1287 (floating point difference). This needs deterministic topology snapping, not arbitrary tolerance increases.
Blender background generation and four renders completed exit0. Overview and market-eye inspected.

## Visual rejection / next work
- Eye view is dominated by long blank retaining faces. Break huge walls into structural terraces with intermediate walks, stairs/landings and authored vistas; do not merely increase elevation.
- Low-city subdivision remains too regular; derive a secondary life-street skeleton from district access, river crossings and public spaces before fine parcels.
- Three disconnected groups must be connected physically or explicitly redesigned, never hidden from the audit.
- Bridge structures, river banks/flood routing and outer wall river crossings are unfinished.
- Stairs have discrete treads but no landing/rest rhythm and no walkability verification.
- Smooth ramp buffer versus ribbon footprint can still differ around corners: inspect full-width geometry.
- Original canonical facility positions are labelled survey-only, reassignment pending. No IDs changed.
- Buildings, NPC/event integration, game collision, full routes and screenshots against references remain unaccepted.
- No runtime source or public site changed in this Blender study. main/VPS not advanced.

Do not call this a completed city or use road counts as acceptance. Keep the existing runtime PR draft until an actual eye-level and overview review succeeds.
