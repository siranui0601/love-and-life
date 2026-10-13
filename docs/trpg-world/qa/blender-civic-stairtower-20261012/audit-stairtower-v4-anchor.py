import json,pathlib,math
from shapely.geometry import shape,Polygon,LineString,Point
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'civic-stairtower-20261012.v4.staged.plan.json').read_text('utf8'))
par=json.loads((root/'parcels.json').read_text('utf8'))
route=next(x for x in plan['routes'] if x['id']=='repair_civic_stairtower_middle_secondary_access')
path=LineString([x[:2]for x in route['points']])
boundary=path.buffer(2.3)
overlap=[]
for q in par['parcels']:
 gg=shape(q['geometry'])
 if gg.intersects(boundary):
  inter=gg.intersection(boundary).area
  if inter>.1:overlap.append((q['id'],q.get('district'),round(inter,2)))
meshes={m['name']:m for m in plan['meshes']}
for n in ['civic_foot_ground','upper_city_ground','b107_civic_foot_retaining_reconstruction','b107_upper_city_retaining_reconstruction']:
 m=meshes[n];verts=m['vertices']
 flat=[]
 for f in m['faces']:
  vv=[verts[i]for i in f]
  if max(x[2]for x in vv)-min(x[2]for x in vv)>.03:continue
  g=Polygon([v[:2]for v in vv])
  if g.is_valid and g.area>.1:flat.append(g)
 uni=unary_union(flat)
 print('ANCHOR',n,'pathEndDistance',round(uni.distance(Point(route['points'][-1][:2])),2),
 'endCovered',uni.covers(Point(route['points'][-1][:2])),flush=True)
print('ACCESS_PARCEL_INTERSECTIONS',len(overlap),overlap[:15])
