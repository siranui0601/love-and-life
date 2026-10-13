# B76 東側作業・生活街区 — 2026-10-09

Status: MORPHOLOGY_PROPOSAL_NOT_ACCEPTED. Blender only; no Web runtime, main merge or VPS deployment.

## Source and protection
- Parent branch tip: `398d991bbfa4f7447d4503faede4ff2e8ec5d0b8`; branch `feat/capital-terrain-streets-pass-8`, Draft PR #342.
- Read full supplied B75 handoff; extracted supplied research PDF and reviewed relevant requirements (urban hierarchy, meaningful route alternatives, physical facilities, dynamic incidents and acceptance).
- Live canon reads: TRPG `王都!A1:N35`, `総合設計書!A110:H120` on 2026-10-08 JST. Canon governs; new work uses unnamed functional morphology proposals.
- Windows B75 source preserved. Unsaved B23 PID9244 and B75 GUI PID38304 were observed and left untouched.
- New output: `C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b76\capital-parcel-review.blend` (44,339,129 bytes).
- Source plan hash: `366c50a99c709bcf5a73bf9dc1fb1c5715dab82496af27e0bef8703a5135b93b`.

## Why this layout
The measured residual in low_city_852 sits between a north living street, a south quay/gate connection, and the existing western craft compound. Its tapered shape is used for a sequence of working courts, not a single named park or another tiny isolated forge. The existing craft compound and all original routes remain unchanged.

Six buildings create a long repair hall, dry stock house, commission frontage, low covered sorting hall, small trade/rest frontage and an east unloading store. Heights are 5–10m plus roofs. They have real door gaps and floor meshes. The repair hall is not a relocation of LOC_CAP_WEAPON_SHOP; the rest frontage is not a new canonical inn or guild.

| Element | Design intent | Implemented shape |
| --- | --- | --- |
| South cargo passage | Cargo enters from existing street and reaches unloading/service doors | 6m width; connected to north-east lane as a through route |
| North living lane | Pedestrian entry, shopfronts and choice of slower social route | 3.2m width; turns through the interior and rejoins cargo road |
| Court cross-link | Switch routes within block without a dead end | 3.5m width |
| Repair court | Waiting and open-air repair | Clear court, next to repair hall |
| Unloading court | Receiving, sorting and disputed stock | Clear apron away from the living lane |
| Rest pocket | Small pause off the main circulation | Two benches; no claim of a city park |

9 routes added including 6 building entries. 30 ordinary residential parcels removed where they intersect new buildings, approaches or courtyards. Their exact IDs are in the study JSON. No canonical parcel or original route removed. Removed ordinary plot area: 3633.80m². New building footprint: 2248.00m². Authored union (buildings/routes/yards): 5461.89m² before preservation buffer. This is not a claim that all 10,673m² residual is solved. Remaining ground and the rest of the city need further design.

## Event intent, not runtime implementation
- T06: delayed deliveries can alter stock and work activity.
- T09/T14: repair and contested quality can relate to canonical weapon supply changes.
- T11/T16/T17: closing work premises should preserve ordinary public circulation. Existing incident metadata and canonical facilities are retained.
- No new named NPC, guild institution, religion, cremation custom or canon facility was added.

## Verification and visual assessment
- Normal graph: 1,136 routes, one component. Flood graph: 1,135 routes, one component. Audit status remains REQUIRES_3D_REVIEW.
- Actual Blender mesh checks cover the affected area including 25 nearby routes: 4,218 torso/head rays, zero blocked; 2,109 floor samples, zero unsupported.
- Audit explicitly includes the new east-block collection. Earlier generic width audit would omit this collection, so it is not used as proof for this change.
- Inspected rendered context, north entry and court eye images from the saved model. Additional cargo-eye rendered on disk.
- Positive: coherent route choice and entry points now exist in the former empty interior; large and small working volumes break the repeated residential row.
- **Still weak:** the court-eye view is dominated by the material hall's blank west wall; work activity is poorly visible; some exterior gaps remain too broad; generic roofs and facades are still a greybox. North entry and court views do not establish a castle/river reveal.
- Next design correction: open the sorting hall toward the pedestrian court, add structurally supported work bays and visible repair equipment, tighten leftover side yards into bounded service enclosures, then re-evaluate the approach sequence. Do not solve this by scattering props over the whole residual.
- Local rays do not certify continuous capsules, cart turning envelopes, NPC behavior, all canonical facility routes or gameplay. No manual player traversal or WebGL acceptance yet.

## Reproduce
1. Use the B75 plan/parcels and pinned parent branch source. Run author-east-service-block.py with B75 directory and a *new* empty output path. Existing output directories are rejected.
2. Open B75/capital-parcel-review.blend in background Blender and run build-east-service-review.py with output directory and the pinned build-parcel-review.py at the parent commit above.
3. The renderer applies only added plan meshes and regenerates the parcel collections, preserving the B75 terrain and all prior authored content. It runs the builder prefix up to the explicit rendering marker; inspect if that source changes.
4. Run audit-city-b.py normally and with --flood; run audit-east-service-review.py in background Blender against the new saved blend.
5. Source dependencies: Blender 5.2 and existing Shapely install in python-deps. No reinstall of Blender required.

The unrelated dirty Windows repo state remains protected. Do not judge the Blender proposal by the public /capital-review/ site, which was not updated.
