import json,pathlib
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union,nearest_points
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');p=json.loads((root/'plan.json').read_text('utf8'))
m={x['name']:x for x in p['meshes']}
def poly(name):
 o=m[name];v=o['vertices'];g=[]
 for f in o['faces']:
  q=[v[i] for i in f]
  if max(x[2]for x in q)-min(x[2]for x in q)>.05:continue
  item=Polygon([x[:2]for x in q])
  if item.area>.05 and item.is_valid:g.append(item)
 return unary_union(g)
surfaces={n:poly(n)for n in ('castle_ground','forecourt_ground','upper_city_ground')}
for y in(965,980,990,1000,1010,1020,1030,1040,1050,1060):
 print('Y',y)
 for x in (375,385,395,410,420,430,450,470):
  pt=Point(x,y)
  a=[]
  for n,g in surfaces.items():
   nearest=nearest_points(pt,g)[1]
   a.append((n.replace('_ground',''),int(g.covers(pt)),round(pt.distance(g),1),tuple(round(t)for t in nearest.coords[0])))
  print(' ',x,a,flush=True)
