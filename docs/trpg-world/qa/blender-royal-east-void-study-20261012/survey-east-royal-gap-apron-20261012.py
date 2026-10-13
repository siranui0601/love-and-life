import json,pathlib,math,collections
from shapely.geometry import Polygon,LineString,Point,box,shape
from shapely.ops import unary_union,nearest_points
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');P=json.loads((root/'plan.json').read_text('utf8'))
parcel=json.loads((root/'parcels.json').read_text('utf8'))
ms={m['name']:m for m in P['meshes']}
def floor(n):
 m=ms[n];v=m['vertices'];out=[]
 for f in m['faces']:
  z=[v[i]for i in f]
  if max(q[2]for q in z)-min(q[2]for q in z)>.05:continue
  po=Polygon([q[:2]for q in z])
  if po.is_valid and po.area>.1:out.append(po)
 return unary_union(out)
higher=max(floor('forecourt_ground').geoms,key=lambda x:x.area);low=floor('upper_city_ground')
wall=[]
for m in P['meshes']:
 v=m['vertices']
 if not v or not m['faces']:continue
 if min(q[0]for q in v)>470 or max(q[0]for q in v)<300 or max(q[1]for q in v)<840 or min(q[1]for q in v)>1040:continue
 for f in m['faces']:
  arr=[v[i]for i in f]
  if max(q[2]for q in arr)-min(q[2]for q in arr)<10:continue
  top=[q for q in arr if abs(q[2]-156)<.6]
  if len(top)==2 and math.dist(top[0][:2],top[1][:2])>.1:wall.append(LineString([top[0][:2],top[1][:2]]))
cut=higher.exterior.intersection(box(315,875,408,980)).difference(unary_union(wall).buffer(2))
lines=[cut]if cut.geom_type=='LineString'else [x for x in cut.geoms if x.geom_type=='LineString']
long=max(lines,key=lambda x:x.length)
coords=list(long.coords);triangles=[]
for a,b in zip(coords,coords[1:]):
 if math.dist(a,b)<.03:continue
 A=nearest_points(Point(a),low)[1].coords[0]
 B=nearest_points(Point(b),low)[1].coords[0]
 for trip in([a,b,B],[a,B,A]):
  pp=Polygon(trip)
  if pp.is_valid and pp.area>.1:triangles.append(pp)
fill=unary_union(triangles).buffer(1.2,join_style=2)
print('DESIGN',round(long.length,2),'area',round(fill.area,1),'lowOverlap',round(fill.intersection(low).area,1),'bounds',fill.bounds,flush=True)
collisions=[]
for x in parcel['parcels']:
 g=shape(x['geometry'])
 if not fill.intersects(g):continue
 overlap=fill.intersection(g).area
 if overlap>1:collisions.append((x['id'],round(overlap,1),x.get('district')))
print('PARCELS',len(collisions),sorted(collisions,key=lambda q:-q[1])[:15],flush=True)
for r in P['routes']:
 pts=[p for p in r['points']if abs(p[2]-112)<2]
 overlap=sum(fill.covers(Point(p[:2]))for p in pts)
 if overlap:print('OVERLAP_ROUTE112',r['id'],overlap,'kind',r['kind'],flush=True)
# contour wedge makes the visual shape; confirmed no base-road conflicts needed.
out=dict(corridorXY=[list(a)for a in coords],apronFootprintAreaM2=round(fill.area,2),existingLowOverlapM2=round(fill.intersection(low).area,2),parcelIntersections=collisions)
(root/'east-royal-gap-design-survey-20261012.json').write_text(json.dumps(out,indent=2),encoding='utf8')
