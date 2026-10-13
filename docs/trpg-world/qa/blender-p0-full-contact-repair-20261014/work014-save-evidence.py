import pathlib,json,shutil
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
T=pathlib.Path(r'C:\Users\inaba\capital-b96-publish\docs\trpg-world\qa\blender-p0-full-contact-repair-20261014')
assert json.loads((R/'work014-promotion.json').read_text('utf8'))['status']=='APPLIED_AND_REOPEN_VERIFIED_LOCAL_STRUCTURAL_PASS'
T.mkdir(parents=True,exist_ok=False)
for p in R.glob('work014-*'):
 if p.suffix not in ('.py','.json','.log','.png') or '.staged.plan.' in p.name:continue
 shutil.copy2(p,T/p.name)
A=json.loads((R/'old/20261014-p0-before-contact-repair/plan.json').read_text('utf8'))
B=json.loads((R/'plan.json').read_text('utf8'))
old={m['name']:m for m in A['meshes']};now={m['name']:m for m in B['meshes']}
patch=dict(removed=sorted(old.keys()-now.keys()),addedOrReplaced=[m for n,m in now.items() if n not in old or m!=old[n]],routesUnchanged=A['routes']==B['routes'],domainsUnchanged=A['landDomains']==B['landDomains'],sourcePlanSHA256=B['work014WallBaseRepair']['canonicalSHA256'])
(T/'mesh-repair-delta.json').write_text(json.dumps(patch,separators=(',',':')),encoding='utf8')
(T/'README.md').write_text("""# P0 floor and retaining contact repair — 2026-10-14
Applied to Windows current/capital-parcel-review.blend and current/plan.json; reopened and verified.

The earlier center-only 12-site claim was withdrawn. The v23 area repairs were not yet applied.
This pass applied those nine complete footprint solids and removed 11 obsolete narrow patches.
W03's unsupported retaining base was 33.0966 m²; extending its foundation reduced it to zero.
A visible slot adjacent to W03 and uncovered noble-west boundary segments were closed with solids anchored to upper and lower terrain.

Validation after reopening the canonical Blender:
- Nine repaired floors: 22,381 actual mesh ray tests, zero misses.
- W01/W03/W04 base area coverage: zero uncovered m².
- All added/replaced meshes: closed manifold geometry, plan/Blender vertices agree within 1 mm.
- Existing 1,232 routes and landDomains preserved.
- Entire-city static road audit: 174,749 rays, 14 pre-existing anomalies, no new failures.

Backup: current/old/20261014-p0-before-contact-repair/ (Blender and plan).
Binary Blender stays on the PC. mesh-repair-delta.json records the geometry delta.

Limitations: this is local structural repair. It does not certify all city holes, actual player/NPC/cart movement,
or the aesthetic quality of the large flat retaining walls. The existing 14 road anomalies remain unresolved.
""",encoding='utf8')
print('EVIDENCE',T,len(list(T.iterdir())),flush=True)
