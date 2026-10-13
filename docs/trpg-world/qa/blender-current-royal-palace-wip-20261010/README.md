# Royal residential palace and citywide P0 road-floor survey (WIP)
2026-10-10 PC current/capital-parcel-review.blend saved in-place and reopened.
- Added a royal residence centered at (300,1173,204), a separate court chapel
  centered at (195,1129,204), plus a facade architectural pass for existing
  throne hall. Eight material-batched meshes added, plus four palace/chapel
  routes leading to independent doors.
- Ornament includes stone/buttress and slate roof compositions, two octagonal
  residential turrets, ritual chapel bell lantern, Gothic glazing, a royal
  crest, window rhythms and chimneys; distinguish palace spaces from housing.
- Two new structures were chosen only after surveying the canonical parcels
  and actual castle ground (81/81 supported central, chapel plots).
- Initial V1-V3 routes failed due blocked portals and the older east-ramp
  junction. V4-V6 corrected architecture (including a banner obstructing a
  palace entrance) and passed local actual Blender 3D QA.
- Final local QA: 6 routes, 402 floor probes, 804 body/head ray collisions 0.
  One PREEXISTING old castle east-ramp landing point has a +1m floor height
  discrepancy versus its route data: preserve as separate unresolved P0 task.
- Reopened promoted current BLEND verified all eight meshes/four routes,
  preexisting neighborhood parks and ground repairs, original removed civic
  ramp absent and cargo hoist keyframes unchanged.
- IMPORTANT: This is not a completed castle. Main silhouette still too plain,
  walls and courtyard architecture insufficient, royal interiors/game NPCs
  not working, roof visual massing remains stage 1. Four frontage routes are
  modeled but no game NPC/capsule simulation has been done.
- Citywide support audit 1,214 routes, 196.62km, 175,351 rays, 2,439 anomalies.
  Two historical very long ramps (court_west_ramp 560m and castle_east_ramp
  523m) dominate the mismatches: likely ramp-route/3D-surface registration,
  NOT proof of 2,439 actual floor holes. Requires scoped ray and mesh QA.
- BLEND binary is not in Git. The source is on the remote Windows PC only.
