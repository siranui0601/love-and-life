# B112–B113 Court Mage Tower: palace-magic identity and first real interior — WIP
Date 2026-10-10 JST. This is a safe intermediate checkpoint, NOT gameplay-complete.

## B112 palace identity architecture
- Previous 20m archive, ritual annexe and guardhouse changed to high roof silhouettes, Ashlar/gothic buttresses, narrow lancet details, shield finials.
- A separate astronomical turret, 4 palace ward watchtowers, crest on parapets and a ground-level ceremonial seal add institutional hierarchy.
- Source canonical location id LOC_CAP_MAGE_TOWER is untouched; no school/unverified institution is canonized.
- Local collision study 9 streets, 2568 discrete body/head ray casts against new B112 structures: 0 hits. Base street centerlines and parcel IDs preserved.
- Important deficiency: standing eye renders exposed the main tower's blank, inaccessible outer wall; B112 itself NOT ACCEPTED.

## B113 physical entrance and foyer
- Instead of painting a door on the shaft, Blender exact Boolean DIFFERENCE was applied to the original Proposed mage tower mesh (14 old polygons; 26 after cut).
- Three physically adjoining voids: south entry, actual audience chamber and lateral archive corridor. Lower slab/route surfaced.
- Added gothic stone portal, belt courses, vertical face ribs, court insignia, an entrance lintel, interior oath dais and wall reliefs.
- New court approach, foyer and archive routes use ground at elevation 70m and are designed as public walking links; access to higher floors is NOT implemented.
- Local real-mesh QA: 3 approach/interior paths, 438 body/head rays, 0 blockers; 219 surface checks, 0 unsupported. Uses actual saved Blender boolean mesh.
- Images: bird's-eye, standing front view and chamber view. Current interiors remain very plain and lack actual magical operation details, research furniture, guards and NPC logic.

## Significant outstanding work
- Main court mage tower has no modeled multi-floor vertical circulation, research floor rooms, desk/book stacks or live game portals.
- All other previous terrain/retaining/road safety issues, city visual quality, graded ramps, palace functional interior and south side urban life are unresolved.
- Tests are discrete, not a swept player capsule or game integration: DO NOT mark the Notion acceptance checklist complete.
- Prior versions B99–B112 retained separately; no main merge or live website changes.

PC: C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b113\capital-parcel-review.blend
Notion: https://app.notion.com/p/3f4890a55fd08109be2ade087dcedbf6?pvs=204
