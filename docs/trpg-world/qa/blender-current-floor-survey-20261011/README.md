# Citywide route surface audit -- 2026-10-11
Reopened actual current capital-parcel-review.blend with 1222 routes.
- 196.08km route metadata; 174,685 static downward probes.
- 35 remaining anomaly rays.
  - castle_wall_stairs: 21 (route Z202-203 versus old outer
    castle ground surface Z204; likely under-terrace landing overlap).
  - noble_east_winch_incline: 11 (recently patched noble west
    contour road sits up to 1.4m above the incline; needs real
    intersection/entry geometry, not another ad hoc overlay).
  - civic_foot_contour_1_retained_1: 2 (old stair tread interference).
  - court_wall_stairs: 1 (tread height sample >0.55m).
- Previous 272 anomalies included 237 false alarms because
  material-named (limestone/masonry) west court ramp pavement was
  not included in raycast floor BVH. That detection defect is fixed.
- 35 are anomaly rays, not verified 35 individual holes.
- Geometry/navmesh, continuous player capsule, cart sweeps and
  landscape/art approval remain outstanding.
