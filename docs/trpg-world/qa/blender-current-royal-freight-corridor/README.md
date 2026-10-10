# Royal freight corridor via EXISTING roads, not another made-up street
Working BLEND: C:\Users\inaba\Documents\TRPG-Capital-Blender\current\capital-parcel-review.blend
WIP; 2026-10-10 JST. Maintains the single-current-file overwrite policy.

Existing three-road concatenation:
- civic_wall_gallery_lower = 88.36m
- civic_foot_contour_1_retained_0 = 87.21m
- current_civic_customs_road = 22.76m
- Geometric total = 198.70m, lower elevation z42m; this joins the freight landing bridge entry (610.579,650) to the customs building in the accessible lane.
- Route joining requires NO new road mass or demolitions, but the older pedestrian stair gate had 2 body/head rays colliding with the outer post at (619.1,645.5).
- Moved south gateway pier to (619.1,639.5) and extended lintel to make 13m free portal; one existing consolidated mesh modified, other geometry left as-is.
- Staged revised BLEND was locally tested; **591 floor probe samples and 1182 person-height obstacle rays, both 0 failures**, over all three roads. Then saved to active BLEND with last-good backup and reopened to verify hoist 0/70/0 frame keyframes, customs building and missing old 1170m ramp.

## Incomplete (do not check overall completion)
- This tests discrete Blender static geometry, not a real freight cart's swept collision or turning radius, NPC pathfinding, or game inventory logistics. The lift is keyframed in Blender but NOT connected to runtime cargo transport.
- Current staircase still looks like a tall exposed scaffold in the rendered scene; architectural side walls, arched masonry, guardrails and cliff integration need major visual redesign, despite the local passage QA.
- The warehouse remains partly screened by monotonous multi-storey housing; improve landmark visibility, lighting, small plaza use and interaction rewards.
