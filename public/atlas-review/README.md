# Continuous Geographic World — 3D spatial review

This replaces the earlier \`/atlas-review\` miniature-marker model with one geographic
terrain, all eleven non-identical settlements, and off-road movement in the same
scene. The **attached illustrated world map is art direction**; canonical region IDs
and all fifteen route endpoints are from the sanitized public manifest, derived
from the game's generated content.

## Source files

- \`geography.js\`: signed irregular coastline; independent criminal island;
  continuous relief, tectonic north/volcanic northeast, river valleys, biomes
  with an organic eastern forest; authored road waypoints and route semantics.
- \`architecture.js\`: *terrain-relative* capital (actual castle and districts),
  port, island metropolis, fortress, occupied Blackridge, dwarven gate, ruins,
  farms, dry outpost and giant elven world tree. Forest trees use instances.
- \`continuous-world.js\`: exactly one Babylon scene/terrain; water, road
  surfaces, rivers, coastal foam, landmarks, terrain-relative architecture,
  orbit/focus cameras and free-roaming preview avatar.
- \`main.js\` and \`index.html\`: desktop and mobile controls.

**World coordinates remain canonical.** Presentation uses a single 1.40×
horizontal geographic display transform to better resemble the wide attached
reference: it is NOT a new metric scale. The spreadsheet's walking hours and
mode/skill restrictions must not be replaced by these illustration coordinates.

## How to view

- \`/atlas-review\`: complete world (north at top, west on the left).
- \`/atlas-review/?focus=capital\`: move the camera close to the full castle,
  curtain wall, occupied quarter and forest interface without loading a second scene.
- \`/atlas-review/?walk=farm\`: road-independent third-person review avatar in
  farm country. WASD/arrow keys move, Shift runs, dragging rotates the camera,
  Esc returns to full overview. Sea, steep hills and building footprints block
  movement; the paths are convenient surfaces, not movement-only rails.
- Region dropdown focuses any of the eleven communities. **現地を歩く** enters the
  same continuous world from that region.

Routes: R08 is a visible sea passage; R05 underground tunnel and R14/R15
conditional/danger corridors have distinct illustrative strokes. This page
is an **authoring review** and does not issue route permission, NPC simulation
or save commands. A walkable visible landscape alone does not imply story
access to intact World Tree's restricted routes.

## Validation and deployment

Run \`node --test test/atlas-review.test.mjs test/continuous-world.test.mjs\`
and \`node --check\` against all new scripts. The public-atlas PR Actions job
runs these checks. Browser QA used real Chromium/Edge WebGL through an isolated
port-forward staging copy (without modifying production):

- Whole-world screenshot: geography and capital/port/island/ranges all visible;
  the standalone page does not black out the ocean.
- Capital close view: central 27-unit keep, towers, perimeter, housing and
  cathedral appear as distinct objects rather than one city-sized icon.
- Farm walk view: third-person capsule is on shared terrain near genuine
  village buildings and cultivated plots.
- Route audit samples every corridor's landness and catches land routes such
  as the initial R04 crossing the sea.

This is a **substantial world-space prototype**, not the final integrated RPG
open world. Do not claim that the public review avatar shares the current
game's player/NPC simulation, inventories, quests or saved world. Live RPG
integration needs:

1. Translate all region-local positions and portal mouths to this shared
   world frame without changing stable semantic IDs.
2. Replace isolated region ground/portals with streamed world terrain and
   actual road/off-road pathfinding, retaining real sea/cliff barriers.
3. Model physically traversed route sections and travel times from the
   spreadsheet, including ship R08, underground R05 and guide/knowledge
   conditions for R14 and R15.
4. Place the existing facility/house interiors, entrances and NPC work/home
   routines in each geographic town rather than spawning invented actors.
5. Migrate and replay old save geometry deterministically. Compare actual
   3D street-level walks, collision and performance, not just JSON counts.
