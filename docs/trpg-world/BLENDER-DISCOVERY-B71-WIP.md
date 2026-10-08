# B71 — working court and usable lookout; city remains unaccepted

Branch: feat/capital-terrain-streets-pass-8. Draft PR342. No main or VPS deployment.

## Rebuild / preserved files

Windows source: C:\Users\inaba\capital-pass-8-review\tools\trpg-world\blender.
Blender5.2.2 / bundled Python with Shapely dependencies in C:\Users\inaba\Documents\TRPG-Capital-Blender\python-deps.

From preserved B62: author-upper-lookout.py design-b62 design-b68; author-craft-court.py design-b68 design-b71; build-city-b.py -- design-b71/plan.json; open terrain .blend and run build-parcel-review.py -- design-b71/parcels.json.
Final scene: C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b71\capital-parcel-review.blend.
Unsaved B23 remains untouched. B63 vacant-site trial failed. B64 12m tower had no useful view and its entry crossed the shaft. B65 resolved height/entry but missed the final floor connection. B66 fixed top connection. B67/B69 forge prototype faced north arbitrarily and blocked cargo entry. B70 reoriented the building but a notice board clipped the loop. B71 moves the board clear. All intermediate files remain; no resets, cleaning, stashing or unrelated-file edits.

## Design / source

Live canonical workbook 15slftR2b-76VKaUqTisYolhN1iCpHeB7asUBoyMnmRk: 総合設計書117 requires recognizable building function/culture/history; 王都21 ties weapon supply to T09/T14. 王都14 establishes a stratified dense capital. No new canonical facility ID, guild authority, named NPC, religion or funeral practice was created. Local repair/forge courtyard is a proposed urban detail; existing LOC_CAP_WEAPON_SHOP is not reassigned. T10 orphanage/store plot reuse and two physically authored canonical plots are preserved.

A 36m modest lookout on mage terrace (1112,440,z70) replaces one ordinary residential parcel, retains the same existing street and uses independent physical stair flights, level turns, 1.2m parapets and a top landing outside the stairwell cut. Stair width2.1m, max riser1/6m. One 12m prototype was too low relative to surrounding houses. The higher tower now reveals roofs and actual castle/mage-tower meshes from deck eye height, restoring orientation. Actual river remains obscured by distant lower-city roofs; this is not a successful river vista. Garden tower remains a local garden destination and has a castle glimpse, not a river panorama.

Measured eastern residual plot low_city_852 at (1228.374,-29.480,z14) hosts an open workshop with chimney, furnace mouth/hearth, anvil, bellows, quench basin and material stocks. 5m cargo approach from low_city_contour_1, separate 2.4m loop, 3m open workshop threshold. Workshop orientation derives from real approach street rather than cardinal alignment. No housing removed for workshop. Intended T09 repair demand / T14 stock inspection remains design metadata; NPC production, prices, schedules and incident behavior are not implemented.

Both new sites reserve actual footprints/approaches against future parcel generation. Residual inventory excludes only these explicitly proposed areas and labels them unaccepted, rather than calling all gaps parks. Existing garden, burial court, markets, hoist and baseline streets remain.

## Acceptance / next work

Actual eye/context images and floor/width/connectivity/preservation JSON are saved under qa/blender-b71. Ray tests do not certify swept capsule/headroom, cart loading or manual runtime playability. Rooftop repetition, large blank retaining faces, excessive open plateau regions, unresolved freight chain and river vistas remain. No overall city completion claim.

Next: (1) use residual-inventory.json to author each largest void, beginning with remaining eastern work-quarter space and low-city pockets beneath the civic retaining structure; determine street subdivision, service yards or public/refuge uses from access and canon, (2) replace the visually exposed civic freight loop with an authored terrain/transport solution and verify complete market→upper→forecourt freight access, (3) shorten/shape ascent experiences with turns/rest spaces and social entry thresholds, (4) build river/bridge-level vistas and NPC/event runtime, (5) export for actual game walking before considering main/VPS release. Guild hall and cremation facility are not established; their institutional/cultural meaning needs further canonical grounding. Arena/waterfall remain absent.
