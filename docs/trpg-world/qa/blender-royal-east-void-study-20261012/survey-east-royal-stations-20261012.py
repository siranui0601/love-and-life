import json,pathlib,math
from shapely.geometry import Polygon,LineString,Point,box,shape
from shapely.ops import unary_union,nearest_points
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');plan=json.loads((root/'plan.json').read_text('utf8'))
ms={m['name']:m for m in plan['meshes']}
def fl(n):
 m=ms[n];V=m['vertices'];f=[]
 for face in m['faces']:
  v=[V[i]for i in face]
  if max(x[2]for x in v)-min(x[2]for x in v)>.03:continue
  poly=Polygon([x[:2]for x in v])
  if poly.is_valid and poly.area>.1:f.append(poly)
 return unary_union(f)
fore=max(fl('forecourt_ground').geoms,key=lambda x:x.area);low=fl('upper_city_ground')
walls=[]
for m in plan['meshes']:
 v=m['vertices']
 if not v or not m['faces']:continue
 if min(q[0]for q in v)>470 or max(q[0]for q in v)<300 or max(q[1]for q in v)<840 or min(q[1]for q in v)>1040:continue
 for f in m['faces']:
  vv=[v[i]for i in f]
  if max(q[2]for q in vv)-min(q[2]for q in vv)<10:continue
  top=[q for q in vv if abs(q[2]-156)<.6]
  if len(top)==2 and math.dist(top[0][:2],top[1][:2])>.1:walls.append(LineString([top[0][:2],top[1][:2]]))
parts=fore.exterior.intersection(box(315,875,408,980)).difference(unary_union(walls).buffer(2))
arr=[parts]if parts.geom_type=='LineString'else [a for a in parts.geoms if a.geom_type=='LineString']
gap=max(arr,key=lambda x:x.length)
print('GAP',round(gap.length,2),list(gap.coords)[::max(1,len(gap.coords)//12)],flush=True)
routes=[r for r in plan['routes']if r['id']in ['current_castle_east_stone_stairs','current_castle_east_winch_ramp','castle_east_ramp_landing_0']]
for k in range(17):
 pt=gap.interpolate(gap.length*k/16)
 near=nearest_points(pt,low)[1]
 nearby=[]
 for r in routes:
  ll=LineString([x[:2]for x in r['points']]);dd=pt.distance(ll)
  if dd<55:nearby.append((r['id'],round(dd,1),round(r['points'][min(range(len(r['points'])),key=lambda i:math.dist(r['points'][i][:2],pt.coords[0]))][2],1)))
 print('STATION',k,tuple(round(a,1)for a in pt.coords[0]),'floor112Dist',round(pt.distance(low),1),'near',tuple(round(a,1)for a in near.coords[0]),'routes',nearby,flush=True)
# closest building footprints at grades, for collisions.
par=json.loads((root/'parcels.json').read_text('utf8'))
for r in routes:
 buf=LineString([x[:2]for x in r['points']]).buffer(r['width']/2+1)
 crossing=[]
 for x in par['parcels']:
  g=shape(x['geometry'])
  if g.intersects(buf):
   a=g.intersection(buf).area
   if a>1:crossing.append((x['id'],round(a,1)))
 print('ROUTE_PARCEL',r['id'],len(crossing),crossing[:8])
