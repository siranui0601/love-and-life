# B27 canonical everyday-site pilot — NOT ACCEPTED
Date: 2026-10-07
Source: https://docs.google.com/spreadsheets/d/15slftR2b-76VKaUqTisYolhN1iCpHeB7asUBoyMnmRk/edit

## Read and design implications
Live reads: 総合設計書 A1:H240 (bounded sections), 王都 A1:N80, 世界史 A1:L45, プレイヤー設定 A1:L45, トラブル一覧 A1:N90, relevant capital NPC rows and capital jobs.
The revised comprehensive design supersedes legacy 100/85-day schedules: use event/state dependencies, not those old fixed dates. World activity uses physical shared routes. Rumours require place/time/contact and provenance. No public signage revealing hidden summoning/assassination facts.
World history describes a politically rewritten conflict and competing interests, not a simple good kingdom/evil outsiders binary.

王都 rows 23–24 and T10: 白鈴孤児院 occupies desirable commercial land; eviction enables LOC_CAP_BIG_STORE on exactly the same site. Matilda's office/donor errands and children's alley knowledge connect everyday life to T10/T11. T16 changes the safety of mixed-species residents; T17 involves upper political/magic power. These require paths, public thresholds and refuges in the existing city, not incident stages.
王都 row19 / NPC064: lower inn is a daily arrival/lodging/rumour node. Capital jobs include market carrying, stable maintenance, newspaper distribution and orphanage help: route design must support these routines before NPC scheduling.

## Actual change
author-capital-sites.py consumes B25 plan/parcels into a new version. Two proposed plots are selected from street-bounded blocks; canonical IDs remain unchanged. Ordinary overlapping parcels are removed, modest courtyard wings replace them, and paved 4m entry branches join the same physical route graph.
- LOC_CAP_ORPHANAGE: 36 x 27.9m plot near (-355,-130), low_city_contour_6. Market-side location is a design proposal, not a spreadsheet coordinate.
- LOC_CAP_LOWER_INN: 32 x 27.9m plot near (-693,-888), low_city_contour_9.
- LOC_CAP_BIG_STORE: exact same orphanage polygon recorded as T10-failure alternative; alternate building geometry is NOT implemented.
- 11 ordinary parcels removed, 2 facility masses added: 15,644 total records.
- 652 routes, one centreline component, 1,794 same-level intersections.
- Replacement footprints checked against all level-14 public road footprints; no overlap above .01m².
- B26 visual review caught inward facade detail on newly created wing polygons. B27 normalizes winding to the existing renderer convention.
- ASCII-safe JSON prevents Windows cp932 decoding errors found during B26 audit.

## Reproduce on PC
Scripts: C:\Users\inaba\capital-pass-8-review\tools\trpg-world\blender
Output: C:\Users\inaba\Documents\TRPG-Capital-Blender\design-b27
Use Blender-bundled Python with isolated python-deps for author-capital-sites.py B25 B27, audit-city-b.py; remove PYTHONPATH before Blender.
Run build-city-b.py, then build-parcel-review.py, then render-canonical-sites.py. Never overwrite earlier scenes.
Separate source/camera scripts are checked in; B27 .blend remains on PC. Existing unsaved Blender windows preserved.

## Acceptance and next work
NOT city completion. Two facility frontage/plot studies only. Camera renders are not player walkthroughs.
Rear alley / child routes, office plot/public counter, permission-controlled upper access and full 12-facility placement remain. No NPC schedules, enterable interiors, event state application or runtime export yet.
Next: connect orphanage rear access to a distinct local loop without opening unrestricted noble access; author public office counter versus controlled archives; measure Matilda/Noah/Kiri/Petra daily and incident routes on this same graph.
Run actual Blender width/floor validation for new branches and eye/context comparisons before any merge/deploy. B25 width-ray result must not be claimed as B27 validation.
Main/VPS unchanged. Draft PR342, branch feat/capital-terrain-streets-pass-8.
