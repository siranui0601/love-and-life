# B19 district massing checkpoint

Not accepted or deployed. Branch feat/capital-terrain-streets-pass-8, draft PR #342.

Windows: C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b19\capital-parcel-review.blend. Layers saved separately, massing hidden by default.

15,769 street-front parcels. Lower frontage 6–10m, height 5–10m; noble frontage 32–48m, height 15–25m with U-shaped wings, private gardens, open frontage gates, limestone/slate and larger windows/cornices. Market shop-house and quay warehouse size/material profiles are distinct. Still study geometry, not finished architecture.

B17 actual mesh probes exposed castle prototype overlap at stair arrival. B19 moves palace/towers into eastern plot; inspect blender-width-clearance.json for result. Audits now evaluate hidden collection transforms and include building meshes. Plan geometry remains B14.

Next: verify B19 mesh audit; courtyard-to-door paths and entrance doors; public courtyard access in shared graph; sight corridor audit with buildings; remove excessive long repetitive streets; address east open land with authored circulation; reserve remaining canonical facilities before runtime integration. Existing IDs and events unchanged. No main merge, VPS update or quality acceptance. Pixel comparisons are required, not only test counts.

Python syntax checks pass. New measured flat-road area check in parcel-city.py has not yet been run on Windows; B19 reuses B16 parcels. Prior hardcoded zero was not evidence and has been removed.
