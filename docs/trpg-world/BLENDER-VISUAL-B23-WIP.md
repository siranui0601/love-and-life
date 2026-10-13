# Blender B23 visual review — NOT ACCEPTED

## Saved work and location

Branch: feat/capital-terrain-streets-pass-8; draft PR #342. No runtime, main or VPS deployment.
Windows output: C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b23\capital-parcel-review.blend.
B21 generated 15,763 parcels from the existing B14 terrain/street plan. B22 added the castle compound; B23 closes courtyard-facing roof edges. B23 reuses B21 residential parcels and regenerates the castle site only. Full regeneration remains parcel-city.py plan.json then build-parcel-review.py in Blender with the B14 terrain scene. Shapely 2.1.2 is in the isolated Windows python-deps directory. Preserve all older scenes and unsaved GUI sessions.

## Changes

- Irregular footprints now receive pitched roofs clipped to their real footprint. Courtyard holes remain open. Previously non-four-sided houses silently became flat roofs.
- Frontage widths vary deterministically within district proportions; buildings still obey retained street-facing parcels.
- Noble gardens have gate-to-courtyard paths and larger entrance stonework. Lower houses and warehouses have different visual entrance proportions. Doors are visual surfaces, not enterable interiors.
- Castle circulation is reserved before placement. A small standalone keep failed visual review despite zero collisions. Three compound wings now occupy street-free palace plots around courts, retaining the central keep and towers.
- Saved city is visible by default; separate collections retain the building-free review.

## Evidence and limits

- B21 actual flat-road footprint overlap: 0.0 m2 (measured; no longer a hardcoded assertion).
- B21 and B22 actual Blender terrain/retaining/building torso-ray probes: 209,135, zero blocked. This is not swept-capsule physics, headroom, roof-route or full walk acceptance.
- Roof test: rectangle, concave parcel, skewed parcel and courtyard-hole parcel all preserve exact projected coverage and nonzero bounded pitch. Windows test passed.
- B22 Market-eye ray to main castle tower hits that tower, not intervening city geometry. This is one sightline only; no claim of full sight-corridor compliance.
- Inspected B21 overview, noble courtyard, lower street; B22 overview and market eye. B23 differs by courtyard roof-edge closure, not city topology.
- Previously reported 40 castle circulation hits are resolved in B21/B22, not merely ignored.

## Visual verdict: FAIL / further design required

The images show a coherent dense street frontage and clearer tiered city, but are not an acceptable capital yet:
1. Long straight lower streets still repeat facades with insufficient turns, pocket squares and purposeful termination.
2. Noble estates remain overly repeated U forms. They need a small authored family of compounds rather than facade noise.
3. Terraced edges read too uniformly and road-facing upper masses resemble continuous barracks.
4. Castle compound now has width but needs an authored hierarchy of halls, keeps, roof towers and open forecourt; road clearance alone cannot choose the final silhouette.
5. Eastern unbuilt space has no demonstrated landscape/circulation purpose.
6. Market lacks stalls, unloading edges and a readable pedestrian gathering arrangement.
7. Outer gates and river approaches lack full architectural composition; outskirts remain absent.
8. Canonical non-landmark facilities, event spaces, public courtyard routes, NPC circulation and sight corridors must be carried through before runtime integration.

Next concrete task: redesign selected long low-town street blocks with connected bends, pocket squares and public courtyard entries FIRST, then regenerate their parcels; compare the same walking cameras. Also author the castle compound silhouette on its already reserved plots. Do not fix repetition by randomly scattering buildings. Do not merge/deploy this checkpoint as complete.
