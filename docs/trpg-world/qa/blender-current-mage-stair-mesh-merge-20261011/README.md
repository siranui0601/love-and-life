# Royal mage quarter stair: lossless abutment mesh consolidation
2026-10-11 04:20 JST. Original current BLEND atomically overwritten; rolling backup preserved.
- Consolidated 362 historical mage_quarter_mage_wall_short_stairs_abutment_{0..361} MESH objects
  into single current_mage_wall_stair_abutments_integrated_stone.
- 20,789 vertices / 5,205 faces and same stone material. Numerical
  coordinate delta vs plan (<0.0000611m) is Blender Float32 precision, not
  an intentional geometric change. Face vertex sets are identical; Blender
  face winding may differ from old JSON source because old Blender original
  normal recalculation was already present in the source scene.
- All 1,222 existing roads preserved; no changes to heights, lengths or access.
- Reopened live Blender: all old 362 absent, new mesh present, royal palace,
  parks, escarpment, castle wall stair, noble-west bridge remain; deleted old
  three long ramps remain deleted; cargo hoist Z=0/70/0 keyframe preserved.
- THIS TASK is Blender file organization and editability only. It does NOT
  solve the stair construction flaws, align tread vs ramp heights, or make
  the mage compound worthy of a royal court. Those are separate open tasks.
- Higher priority noble-east elevated bridge proof-of-concept REJECTED
  for visual acceptance despite 708 floor ray 0 error, 1,416 body ray 0,
  citywide 3 residual floor anomalies: exposed dark wall and overly high
  roadway in front of housing. Do not promote pending noble east bridge.
- All real-game safety, swept character/cart capsule, NPC and kingdom-wide
  exterior aesthetics remain unverified.
