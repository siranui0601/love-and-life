import json,pathlib,math,collections
from shapely.geometry import Point,Polygon,LineString,box,shape
from shapely.ops import unary_union,nearest_points
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'));parts=json.loads((root/'parcels.json').read_text('utf8'))
m={o['name']:o for o in p['meshes']}
def poly(name):
 o=m[name];v=o['vertices'];pieces=[]
 for f in o['faces']:
  q=[v[i]for i in f]
  if max(x[2]for x in q)-min(x[2]for x in q)>.04:continue
  a=Polygon([z[:2]for z in q])
  if a.is_valid and a.area>.1:pieces.append(a)
 return unary_union(pieces)
fore=max(poly('forecourt_ground').geoms,key=lambda q:q.area)
low=poly('upper_city_ground')
wall=[]
for z in p['meshes']:
 V=z['vertices']
 if not V or not z['faces']:continue
 if min(x[0]for x in V)>10 or max(x[0]for x in V)<-150 or max(x[1]for x in V)<960 or min(x[1]for x in V)>1200:continue
 for f in z['faces']:
  v=[V[i]for i in f]
  if max(q[2]for q in v)-min(q[2]for q in v)<10:continue
  arr=[q for q in v if abs(q[2]-156)<.6]
  if len(arr)==2 and math.dist(arr[0][:2],arr[1][:2])>.1:wall.append(LineString([arr[0][:2],arr[1][:2]]))
opened=fore.exterior.intersection(box(-125,960,10,1190)).difference(unary_union(wall).buffer(2))
line=max([q for q in opened.geoms if q.geom_type=='LineString'],key=lambda x:x.length)
coords=list(line.coords)
tris=[]
for a,b in zip(coords,coords[1:]):
 if math.dist(a,b)<.05:continue
 near1=nearest_points(Point(a),low)[1].coords[0];near2=nearest_points(Point(b),low)[1].coords[0]
 for pts in ([a,b,near2],[a,near2,near1]):
  t=Polygon(pts)
  if t.is_valid and t.area>.01:tris.append(t)
fill=unary_union(tris).buffer(1.2,join_style=2)
print('APRON_AREA',round(fill.area,1),'LOW_OVERLAP',round(fill.intersection(low).area,1),'NATIVE_GAP_MAX',max(round(Point(s).distance(low),2)for s in coords))
parcels=[]
for r in parts['parcels']:
 geom=shape(r['geometry'])
 if not geom.intersects(fill):continue
 overlap=geom.intersection(fill).area
 if overlap>.25:parcels.append((r['id'],round(overlap,1),r.get('district')))
print('PARCELS_INTERSECT',len(parcels),'TOP',sorted(parcels,key=lambda z:-z[1])[:24])
for r in p['routes']:
 if r['z0']>130 and r['z1']>130:continue
 pts=[x for x in r['points']if abs(x[2]-112)<3]
 if not pts:continue
 inside=sum(fill.buffer(1.0).covers(Point(x[:2]))for x in pts)
 if inside:print('LOW_ROUTE_OVERLAP',r['id'],inside)
