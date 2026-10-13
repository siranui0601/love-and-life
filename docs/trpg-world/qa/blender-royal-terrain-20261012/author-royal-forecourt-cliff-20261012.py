import json,pathlib,math,hashlib
from shapely.geometry import Polygon,LineString,Point,box
from shapely.ops import unary_union,nearest_points,triangulate
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
raw=(root/'plan.json').read_bytes();plan=json.loads(raw)
native={m['name']:m for m in plan['meshes']}
def floor(n):
 m=native[n];v=m['vertices'];polys=[]
 for f in m['faces']:
  q=[v[i]for i in f]
  if max(z[2]for z in q)-min(z[2]for z in q)>.05:continue
  poly=Polygon([x[:2]for x in q])
  if poly.is_valid and poly.area>.1:polys.append(poly)
 return unary_union(polys)
fore=max(floor('forecourt_ground').geoms,key=lambda a:a.area)
lower=floor('upper_city_ground')
wallFaces=[]
for m in plan['meshes']:
 V=m['vertices']
 if not V or not m['faces']:continue
 if min(x[0]for x in V)>10 or max(x[0]for x in V)<-150 or max(x[1]for x in V)<960 or min(x[1]for x in V)>1200:continue
 for face in m['faces']:
  vertices=[V[k]for k in face]
  if max(x[2]for x in vertices)-min(x[2]for x in vertices)<10:continue
  top=[q for q in vertices if abs(q[2]-156)<.6]
  if len(top)==2 and math.dist(top[0][:2],top[1][:2])>.1:wallFaces.append(LineString([top[0][:2],top[1][:2]]))
missing=fore.exterior.intersection(box(-125,960,10,1190)).difference(unary_union(wallFaces).buffer(2))
valid=[q for q in missing.geoms if q.geom_type=='LineString'and q.length>100]
assert len(valid)==1,len(valid)
line=valid[0]
assert 248<line.length<255
coords=list(line.coords)
triangles=[]
for a,b in zip(coords,coords[1:]):
 if math.dist(a,b)<.05:continue
 u=nearest_points(Point(a),lower)[1].coords[0]
 v=nearest_points(Point(b),lower)[1].coords[0]
 for polygon in ([a,b,v],[a,v,u]):
  t=Polygon(polygon)
  if t.is_valid and t.area>.01:triangles.append(t)
apronPoly=unary_union(triangles).buffer(1.2,join_style=2)
assert apronPoly.is_valid and 6400<apronPoly.area<7000
nativeOverlap=apronPoly.intersection(lower).area
assert nativeOverlap>200,nativeOverlap
# No existing route points at the low terrace level may require new road relocation.
for route in plan['routes']:
 if route['z0']>131 and route['z1']>131:continue
 for xyz in route['points']:
  if abs(xyz[2]-112)<2 and apronPoly.buffer(.3).covers(Point(xyz[:2])):
   raise RuntimeError('Low grade road overlap '+route['id'])
new=[]
def create(n,mat):
 o=dict(name=n,material=mat,vertices=[],faces=[]);new.append(o);return o
masonry=create('repair_royal_forecourt_west_solid_retaining_20261012','stone')
coping=create('repair_royal_forecourt_west_coping_20261012','limestone')
buttress=create('repair_royal_forecourt_west_tapered_buttresses_20261012','stone')
ground=create('repair_royal_forecourt_west_lower_ground_apron_20261012','ground')
def add(mesh,v,faces):
 start=len(mesh['vertices']);mesh['vertices'].extend([list(map(float,p))for p in v])
 mesh['faces'].extend([[start+j for j in f]for f in faces])
def prism(m,a,b,width,z0,z1):
 # main masonry wall centered on the missing high plateau boundary
 dx=b[0]-a[0];dy=b[1]-a[1];ll=math.hypot(dx,dy)
 if ll<.1:return
 nx=-dy/ll;ny=dx/ll
 mid=Point((a[0]+b[0])/2,(a[1]+b[1])/2)
 if fore.covers(Point(mid.x+nx*2,mid.y+ny*2)):nx,ny=-nx,-ny
 v=[]
 for z in(z0,z1):
  for pt in(a,b):
   v.extend([(pt[0],pt[1],z),(pt[0]+nx*width,pt[1]+ny*width,z)])
 add(m,v,[[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]])
 return nx,ny
# Subdivide only for robust watertight construction; the entire 251m is ONE masonry object.
length=0.;nextButtress=24.;buttressCount=0
for a,b in zip(coords,coords[1:]):
 ll=math.dist(a,b)
 if ll<.04:continue
 N=max(1,math.ceil(ll/4))
 for k in range(N):
  p1=(a[0]+(b[0]-a[0])*k/N,a[1]+(b[1]-a[1])*k/N)
  p2=(a[0]+(b[0]-a[0])*(k+1)/N,a[1]+(b[1]-a[1])*(k+1)/N)
  nx,ny=prism(masonry,p1,p2,2.5,112,155.95)
  # Massive coping emphasizes the masonry silhouette without leaning over roads.
  prism(coping,p1,p2,2.9,155.9,156.52)
  ds=math.dist(p1,p2)
  if length+ds>=nextButtress and buttressCount<9:
   u=(nextButtress-length)/ds
   x=p1[0]+u*(p2[0]-p1[0]);y=p1[1]+u*(p2[1]-p1[1])
   # Wide tapered pier rather than a vertical unsupported metal column.
   tx,ty=-ny,nx
   verts=[]
   for zz,rad in((112,7.0),(153.5,3.7)):
    for side,off in ((-1,1.0),(-1,rad),(1,rad),(1,1.0)):
     verts.append((x+nx*off+tx*side*3.25,y+ny*off+ty*side*3.25,zz))
   add(buttress,verts,[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])
   buttressCount+=1
   nextButtress+=[27,31,23,35,29,32,25,34,27][buttressCount-1]
  length+=ds
assert 248<length<255 and buttressCount>=7,(length,buttressCount)
# Triangulate only the previously empty lowland gap. New land meets the preexisting Z112 floor.
for tri in triangulate(apronPoly):
 cut=tri.intersection(apronPoly)
 polys=[cut]if cut.geom_type=='Polygon'else [g for g in getattr(cut,'geoms',[])if g.geom_type=='Polygon']
 for poly in polys:
  if poly.area<.02:continue
  v=list(poly.exterior.coords)[:-1]
  if len(v)<3:continue
  for k in range(1,len(v)-1):
   add(ground,[(*v[0],112),(*v[k],112),(*v[k+1],112)],[[0,1,2]])
# Survey and capture exact provenance.
assert ground['faces'] and masonry['faces']
plan['meshes'].extend(new)
name='royalForecourtWestSeam20261012'
plan[name]=dict(status='STAGED_NEEDS_VISUAL_AND_TRAFFIC_QA',sourcePlanSHA256=hashlib.sha256(raw).hexdigest(),
 boundaryM=round(length,2),buttresses=buttressCount,
 lowGroundApronM2=round(apronPoly.area,1),overlapWithNativeZ112M2=round(nativeOverlap,1),
 material='limestone and solid coursed stone',wallTopZ=156,wallBaseZ=112,
 place='western cliff edge below royal castle, X -108..-7, Y 992..1168',
 newMeshes=[(m['name'],len(m['vertices']),len(m['faces']))for m in new],
 notResolved=['204m castle west stair opening (intentional, must not be sealed)',
 'Other forecourt cliff openings to survey independently','Whole city capsule physics',
 'Castle palace detail and architecture'])
(root/'royal-forecourt-west-20261012.staged.plan.json').write_text(json.dumps(plan,separators=(',',':')),encoding='utf8')
(root/'royal-forecourt-west-20261012.study.json').write_text(json.dumps(plan[name],ensure_ascii=False,indent=2),encoding='utf8')
print('STAGED',json.dumps(plan[name],ensure_ascii=False),flush=True)
