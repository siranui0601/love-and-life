# Royal West Court Short Escarpment 窶・Blender WIP, 2026-10-10
Source .blend: C:\Users\inaba\Documents\TRPG-Capital-Blender\current\capital-parcel-review.blend, on user's Windows PC ONLY.
**Saved and reopened current after a rolling last-good backup**.
- Removed the 559.81m court_west_ramp, 2 dangling old landings: 3 route objects and 7 old meshes.
- Replaced with an integrated solid-stone escarpment near X[-166,-110],Y[961,987]. Directly ties city Z112 to court Z156 with a roofless 99.563m stair and separate 99.99m winch cargo incline.
- Two genuine horizontal mid-ascent landings support accessible side trails to two discovery overlooks; both ways have physically separate gate/exit lanes.
- Added 8 consolidated material meshes. 220 stair treads are in one batch, not independent scene objects. Four gateway turrets tied down to the masonry base, with slate roofs, heraldic pennants.
- V1-V3 repeatedly rejected for collisions/uneven floor; V4 fixed geometry and first passed local tests; V5 added more credible stone gate landmarks.
- Blender QA: 1020 floor probes with 0 missing, 2040 body/head rays with 0 new collisions; 93 separate existing street checks all clear. Old city routes unchanged except explicitly retired spurs.
- Canonical parcels tested against 1124 projected 2D polygon faces. 0 protected parcel intersection candidates or destructive demolition.
- Reopened the current BLEND. Old west/east long ramps absent. Both new ascent routes and overlooks, 8 meshes, existing palace, parks, lower-floor repair, and animated royal freight hoist 0/70/0 still present.
**Not final**:
- Surrounding residential facades remain repetitive; discovery, wall, tower, court architecture below target quality. Some eye views are blocked by original district massing. Further reconstruction of buildings/entrance sightlines and context is needed.
- Steep grade (~43 degrees on non-landing runs) is only suitable for an unimplemented winch-assisted freight system; NOT independent loaded handcart safe transport. No game NPC/pathfinding, cart swept volume or crowd dynamics tested.
- Other missing wall/floor zones, mage school/court, markets/guilds/cemetery/multiple neighborhood public spaces and full castle exterior remain open tasks.
