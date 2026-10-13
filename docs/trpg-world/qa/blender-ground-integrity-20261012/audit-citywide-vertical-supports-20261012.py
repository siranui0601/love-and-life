import pathlib,json,math,collections
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'plan.json').read_text('utf8'))
levels=collections.defaultdict(list)
for m in plan['meshes']:
 if not m['name'].endswith('_ground') or not m['faces']:continue
 vs=m['vertices'];byz=collections.defaultdict(list)
 for f in m['faces']:
  v=[vs[i]for i in f]
  if max(x[2]for x in v)-min(x[2]for x in v)>.05:continue
  poly=Polygon([x[:2]for x in v])
  if not poly.is_valid or poly.area<.03:continue
  z=round(sum(x[2]for x in v)/len(v))
  byz[z].append(poly)
 for z,polys in byz.items():levels[z].extend(polys)
terrain={z:unary_union(polys)for z,polys in levels.items()}
print('GROUND_LEVELS',[(z,len(levels[z]),round(geo.area)) for z,geo in terrain.items()])
candidates=[]
for m in plan['meshes']:
 n=m['name'].lower()
 if not any(s in n for s in('support','abutment','pier')) or not m['vertices']:continue
 v=m['vertices'];lo=min(q[2]for q in v);hi=max(q[2]for q in v)
 if hi-lo<5:continue
 bottom=[q for q in v if abs(q[2]-lo)<.08]
 if not bottom:continue
 zs=sorted(terrain,key=lambda z:abs(z-lo))
 nearestZ=zs[0]
 pts=[Point(q[:2]) for q in bottom]
 g=terrain[nearestZ]
 dists=[g.distance(q)for q in pts]
 candidate={'name':m['name'],'spanZ':round(hi-lo,2),
 'baseZ':round(lo,2),'nearestFloorZ':nearestZ,
 'floorGapZ':round(abs(lo-nearestZ),2),
 'minXYFloorGapM':round(min(dists),2),'maxXYFloorGapM':round(max(dists),2),
 'baseXY':[round(sum(q[0]for q in bottom)/len(bottom),2),round(sum(q[1]for q in bottom)/len(bottom),2)]}
 if abs(lo-nearestZ)<1.5 and min(dists)>1.0:
  candidates.append(candidate)
candidates.sort(key=lambda x:(-x['minXYFloorGapM'],-x['spanZ']))
out={'scope':'support/abutment/pier meshes, plan native ground at matching elevation','candidates':candidates,
'limitations':['These are flags, NOT confirmed unsupported; a pier can be founded against a vertical rock wall or bridge support',
             'Checks only meshes ending _ground, not all retaining or structural foundations']}
(root/'citywide-support-ground-candidates-20261012.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
print('UNSUPPORTED_SUPPORT_CANDIDATES',len(candidates))
for x in candidates[:45]:print('CANDIDATE',x)
