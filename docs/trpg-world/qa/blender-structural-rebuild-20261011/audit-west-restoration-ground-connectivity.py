import json,pathlib
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union
p=json.loads((pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')/'plan.json').read_text('utf8'))
mesh={m['name']:m for m in p['meshes']}
def area(n):
 m=mesh[n];v=m['vertices'];pp=[]
 for f in m['faces']:
  if abs(max(v[k][2]for k in f)-min(v[k][2]for k in f))>0.3:continue
  x=Polygon([v[k][:2]for k in f])
  if x.area>.05 and x.is_valid:pp.append(x)
 return unary_union(pp)
for target,base in [('western_ascent_noble_service_restored_civic_ground','civic_foot_ground'),('western_ascent_noble_service_restored_low_ground','low_city_ground')]:
 a=area(target);b=area(base)
 gap=a.difference(b.buffer(.15))
 co=[gap] if gap.geom_type=='Polygon' else [x for x in getattr(gap,'geoms',[])if x.geom_type=='Polygon']
 co=sorted((x for x in co if x.area>4),key=lambda x:-x.area)
 print('GROUND_PATCH',target,'area',round(a.area),'overlapBase',round(a.intersection(b).area),'UNIQUE',round(gap.area),'islands',len(co))
 for q in co[:8]:print(' ISLAND',round(q.area),'bounds',tuple(round(z,1)for z in q.bounds))
for name in ('castle_ground','forecourt_ground','upper_city_ground'):
 a=area(name);print('GROUND',name,'area',round(a.area),'bounds',a.bounds)
