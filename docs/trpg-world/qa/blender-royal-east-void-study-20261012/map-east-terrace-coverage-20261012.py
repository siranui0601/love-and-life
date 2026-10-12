import json,pathlib
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union
r=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');p=json.loads((r/'plan.json').read_text('utf8'))
M={m['name']:m for m in p['meshes']}
def poly(name):
 m=M[name];v=m['vertices'];a=[]
 for f in m['faces']:
  vv=[v[i]for i in f]
  if max(x[2]for x in vv)-min(x[2]for x in vv)>.05:continue
  pp=Polygon([x[:2]for x in vv])
  if pp.is_valid and pp.area>.1:a.append(pp)
 return unary_union(a)
names=['forecourt_ground','upper_city_ground','repair_royal_forecourt_west_lower_ground_apron_20261012','castle_ground']
geos={n:poly(n)for n in names}
for y in [890,900,910,920,930,940,950,960,980,1000,1020,1040]:
 print('Y',y, ' '.join(f'{x}:F{int(geos["forecourt_ground"].covers(Point(x,y)))}L{int(geos["upper_city_ground"].covers(Point(x,y)))}C{int(geos["castle_ground"].covers(Point(x,y)))}'for x in [355,370,380,387,395,407,420,440,460]),flush=True)
