# Connected discoveries and freight transfer WIP

User direction 2026-10-08: walking discovery destinations, natural wall stairs, cart ramp/lift/tunnel access.

Live canonical source checked: 王都 has central market LOC_CAP_MARKET and mixed-species residential market LOC_CAP_AJIN_QUARTER; human trafficking market LOC_CRIME_SLAVE_MARKET is in crime city. Capital backcourt study adds anonymous goods, not a relocated canonical slave market.

B50 full-city discovery study: north garden 18m climbable lookout (9 physical flights/corner landings, top deck opening); 15 central market counters preserving routes; 6 small backcourt stalls at (-615.303,-840.669), entered from low_city_contour_11, no existing parcels removed. Existing cemetery concept remains unaccepted. Actual eye/context renders inspected. Tower-entry parapet collision was detected and removed. B50 width 254755 probes, zero blocked. Four missing floor samples at tower corners were detected; source now adds turning landings and extends deck opening. Must verify the next generation; B50 floor is FAIL, not accepted.

B46 freight prototype: castle forecourt 156m to castle 204m, wall-side 8x9m counterweighted platform at (144.333,981.701). Lower/upper landings connect forecourt_contour_1/castle_contour_1. Blender animation frames 1/241 low,1777/2017 high,3553 low,24fps; platform and counterweight move, rails parented. Not a walking-graph teleport. Runtime boarding, gates, permissions, load handling and failure recovery are UNIMPLEMENTED. Terrain width 213810 probes,zero blocked; connectivity 667 routes/one component. Inspected lower/upper renders; mechanism remains plain prototype.

Integration pipeline launched on Windows into B51–B59: B46 terrain/hoist -> parcels -> canonical sites -> two interior-lane/parcel passes -> orphanage backlane -> garden loop -> burial -> tower/market -> backcourt. Rebuild prevents old lots being overlaid on changed stairs. Existing versions and unsaved B23 Blender scene untouched. Pipeline source preserves every intermediate and stops on errors. Final B59 visual/collision audit pending at checkpoint.

Windows root C:\Users\inaba\Documents\TRPG-Capital-Blender. Source C:\Users\inaba\capital-pass-8-review\tools\trpg-world\blender. PR342 remains draft. No main/VPS update.

Remaining: integrated B59 audits and renders; cemetery entrance spatial hierarchy; rest terraces/shorter wall stairs; full freight route from market through upper city to forecourt; social gates; runtime traversal/NPC/event states; richer market and tower architecture; selected other discovery destinations grounded in canon. Arena/waterfall not implemented.
