# Blender migration — 2026-10-06

Status: installation requested and started; Windows UAC consent pending. Do not report Blender installed yet.
Device: さつまあげ / 12fb6d7b-f35b-4020-a95f-6b1f2d2c8cb5.
winget install BlenderFoundation.Blender 5.2.2 from winget, official download.blender.org MSI; hash verified.
Remote installation shell PID34180; observed consent PID5936 and msiexec PID18800. Do not dismiss user consent programmatically.

## Design order

Reference images are morphology references. Author the whole capital's terrain and connected street hierarchy before populating buildings. Set terrace benches, retaining walls, gates, river banks and bridges together with primary routes, contour streets, life/service lanes, alleys, wall-side stairs, loops and refuge squares. Preserve canonical IDs and event/access semantics. Existing 2013 graph segments are survey material, not proof that the new network is complete or accepted.

## Prepared tools

- node tools/trpg-world/blender/export-survey.mjs OUTPUT.json
- blender --background --python tools/trpg-world/blender/import-survey.py -- INPUT.json OUTPUT.blend
- Importer requires a fresh background session, creates metre-scale collections, and refuses to overwrite an existing blend.
- Existing survey geometry is explicitly NOT ACCEPTED. Authored design collections start empty. No claim of a new city yet.
- Export tested locally: 2013 street segments, 12 canonical anchors. JS syntax and Python compilation passed; Blender execution awaits installation.

Windows source: C:\\Users\\inaba\\capital-pass-8-review\\tools\\trpg-world\\blender
Windows survey export requested: C:\\Users\\inaba\\Documents\\TRPG-Capital-Blender\\survey-pass8.json
Next: confirm installer exit and blender --version; create survey-v001.blend in that folder, verify object counts/units and save overview; then author whole-city terrace and street plan as a separate version. Preserve prior survey and all existing user files. No main merge or VPS update.

