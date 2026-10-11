import json,pathlib
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union,nearest_points
p=json.loads((pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')/'plan.json').read_text('utf8'))
pt=Point(636,664)
for m in p['meshes']:
 name=m['name']
 if not(any(q in name.lower() for q in ('ground','rock','cliff','terrace','retaining','wall gallery','court'))):continue
 if not m['vertices'] or len(m['vertices'])<3:continue
 V=m['vertices']
 # only roughly nearby in XY
 if min(q[0]for q in V)>760 or max(q[0]for q in V)<520 or min(q[1]for q in V)>800 or max(q[1]for q in V)<520:continue
 polys=[]
 for f in m['faces']:
  if len(f)<3:continue
  vv=[V[i]for i in f]
  if max(q[2]for q in vv)-min(q[2]for q in vv)>.05:continue
  geom=Polygon([q[:2]for q in vv])
  if geom.is_valid and geom.area>.01:polys.append(geom)
 if not polys:continue
 g=unary_union(polys)
 a,b=nearest_points(pt,g)
 dist=round(pt.distance(g),2)
 if dist<110:print('TERRAIN_NEAR',name,round(g.area),dist,'near',tuple(round(x,1)for x in b.coords[0]),'z',round(min(x[2]for x in V),1))
