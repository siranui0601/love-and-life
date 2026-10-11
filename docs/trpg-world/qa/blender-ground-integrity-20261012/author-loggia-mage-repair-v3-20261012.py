import pathlib,json,hashlib,math
from shapely.geometry import Polygon,Point,LineString,box
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
raw=(root/'plan.json').read_bytes();plan=json.loads(raw)
baseHash=hashlib.sha256(raw).hexdigest()
byname={m['name']:m for m in plan['meshes']}
support=[n for n in byname if n.startswith('wall_gallery_loggia_support_')]
assert len(support)==4,len(support)
before=next(r for r in plan['routes']if r['id']=='civic_wall_gallery_rest_3')
assert len(before['points'])==19 and round(before['lengthM'])==36
# Trim the blind-ended 36m gallery to a wall-cantilevered 16m overlook.
removed=set(support)
for m in plan['meshes']:
 n=m['name']
 if n.startswith('wall_gallery_civic_wall_gallery_rest_3_'):
  tail=n[len('wall_gallery_civic_wall_gallery_rest_3_'):]
  try:i=int(tail.split('_')[0])
  except ValueError:continue
  if i>=8:removed.add(n)
assert all(n in byname for n in removed)
# Replace two decorative mesh anchors by translating to the new overlook endpoint.
shifted={}
for n in ('wall_gallery_rest_3_end','wall_gallery_rest_3_bench'):
 item=byname[n]
 shifted[n]=[v.copy()for v in item['vertices']]
 for v in item['vertices']:v[0]-=20.0
before['points']=before['points'][:9]
before['lengthM']=16.0
before['revision']='2026-10-12 anchored lookout rebuilt; disused outer 20m removed'
# Remove deleted objects only, retain first eight sheltered gallery modules and their floors.
plan['meshes']=[m for m in plan['meshes']if m['name']not in removed]
new=[]
def create(name,material):
 item={'name':name,'vertices':[],'faces':[],'material':material};new.append(item);return item
def add(m,v,f):
 k=len(m['vertices']);m['vertices'].extend([[float(a)for a in x]for x in v])
 m['faces'].extend([[k+i for i in face]for face in f])
def prism(m,triangle,depth):
 a,b,c=triangle
 vs=[(a[0],a[1]-depth/2,a[2]),(b[0],b[1]-depth/2,b[2]),(c[0],c[1]-depth/2,c[2]),
     (a[0],a[1]+depth/2,a[2]),(b[0],b[1]+depth/2,b[2]),(c[0],c[1]+depth/2,c[2])]
 add(m,vs,[[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]])
def boxmesh(m,cx,cy,z0,w,l,z1):
 vs=[(x,y,z)for z in(z0,z1)for x,y in ((cx-w/2,cy-l/2),(cx+w/2,cy-l/2),(cx+w/2,cy+l/2),(cx-w/2,cy+l/2))]
 add(m,vs,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
lookout=create('repair_loggia_castle_wall_cantilever_20261012','stone')
# Three wedge-like masonry spurs embedded 8m into the actual upper_city retaining structure.
# Root (600,799.6) is interior to the upper-city ledge; terminal (634,799.6)
# is the planned exposed but now supported landing.
for yy in (799.6,802.7):
 prism(lookout,[(599.5,yy,77.5),(599.5,yy,97.7),(634.8,yy,97.7)],1.45)
m= create('repair_loggia_fortified_gallery_coping_20261012','stone')
boxmesh(m,632.5,799.6,97.45,5.2,8.0,98.06)
# The roof segments retained at 0..7; the end screen was relocated to x~635.
from shapely.geometry import Polygon,Point,LineString,box
from shapely.ops import unary_union
upper=byname['mage_east_ground'];V=upper['vertices']
high=unary_union([q for f in upper['faces']if (q:=Polygon([V[i][:2]for i in f])).is_valid and q.area>.1])
ret=byname['mage_east_retaining'];V=ret['vertices'];walls=[]
for f in ret['faces']:
 v=[V[i]for i in f];hi=[t for t in v if abs(t[2]-70)<.18]
 if len(hi)==2 and math.dist(hi[0][:2],hi[1][:2])>.1:walls.append(LineString([hi[0][:2],hi[1][:2]]))
wallEdges=unary_union(walls)
missing=high.boundary.difference(wallEdges.buffer(1.4)).intersection(box(1010,320,1370,560))
parts=list(missing.geoms)if hasattr(missing,'geoms')else [missing]
targets=[x for x in parts if x.geom_type=='LineString' and 148<x.length<157 and x.bounds[0]>1135 and x.bounds[1]>498 and x.bounds[2]<1275]
assert len(targets)==1,[(round(x.length),x.bounds)for x in targets]
main=targets[0]
assert (1137<main.bounds[0]<1150 and 1260<main.bounds[2]<1270),main.bounds
mWall=create('repair_mage_low_terrace_seam_retaining_20261012','stone')
mCoping=create('repair_mage_low_terrace_parapet_20261012','limestone')
mPier=create('repair_mage_low_terrace_buttress_20261012','stone')
coords=list(main.coords)
# Break long individual edges into 4m retaining wall courses.
total=0.0;counter=0
for a,b in zip(coords,coords[1:]):
 ds=math.dist(a,b)
 n=max(1,math.ceil(ds/4))
 for j in range(n):
  p1=(a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n)
  p2=(a[0]+(b[0]-a[0])*(j+1)/n,a[1]+(b[1]-a[1])*(j+1)/n)
  dx,dy=p2[0]-p1[0],p2[1]-p1[1];ll=math.hypot(dx,dy)
  if ll<.04:continue
  nx,ny=-dy/ll,dx/ll
  mid=Point((p1[0]+p2[0])/2,(p1[1]+p2[1])/2)
  # Offset masonry OUTSIDE the upper terrace, not into the player's 70m grade.
  if high.covers(Point(mid.x+nx*1.5,mid.y+ny*1.5)):nx,ny=-nx,-ny
  vv=[(p1[0]+nx*rr,p1[1]+ny*rr,z)for z in(14,70)for rr in(0,2.0)]
  # use separate p1/p2 coordinates
  verts=[]
  for z in (14.0,70.0):
   for xy in (p1,p2):
    verts.extend([(xy[0],xy[1],z),(xy[0]+nx*2.0,xy[1]+ny*2.0,z)])
  add(mWall,verts,[[0,1,3,2],[4,6,7,5],[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6]])
  add(mCoping,[(p1[0],p1[1],70),(p2[0],p2[1],70),
    (p2[0]+nx*2.7,p2[1]+ny*2.7,70),(p1[0]+nx*2.7,p1[1]+ny*2.7,70),
    (p1[0],p1[1],70.7),(p2[0],p2[1],70.7),
    (p2[0]+nx*2.7,p2[1]+ny*2.7,70.7),(p1[0]+nx*2.7,p1[1]+ny*2.7,70.7)],
    [[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])
  total+=ll;counter+=1
  if int(total//17)!=int((total-ll)//17):
   x,y=mid.x+nx*3.2,mid.y+ny*3.2
   boxmesh(mPier,x,y,14.0,5.2,4.2,69.9)
# Only the originally unsupported upper wall edge is repaired; natural low city ground may still
# need a separate infill after visual inspection.
assert 145<total<165,total
# Extend real Z=14 low terrain to the foot of the repaired elevated cliff.
# The high terrace remains a separate Z=70 layer. Do not treat a wall ending over
# empty space as grounded.
from shapely.ops import nearest_points,triangulate
from shapely.geometry import GeometryCollection
def planar(name):
 m=byname[name];vv=m['vertices'];ps=[]
 for f in m['faces']:
  v=[vv[i]for i in f]
  if max(q[2]for q in v)-min(q[2]for q in v)>.04:continue
  poly=Polygon([q[:2]for q in v])
  if poly.area>.2 and poly.is_valid:ps.append(poly)
 return unary_union(ps)
nativeLow=unary_union([planar('low_city_ground'),planar('mage_quarter_restored_low_ground')])
# Link the far unsupported end back to the actual nearest low-city terrain.
wallEnd=Point(main.coords[-1])
nativeAnchor=nearest_points(wallEnd,nativeLow)[1]
newFill=unary_union([Polygon([a,b,nativeAnchor.coords[0]]) for a,b in zip(main.coords,list(main.coords)[1:]) if math.dist(a,b)>.05])
newFill=newFill.buffer(1.6,join_style=2)
assert newFill.is_valid,newFill.is_valid
assert newFill.is_valid and 3000<newFill.area<19000,newFill.area
assert newFill.intersection(nativeLow).area>3,'Ground apron must physically overlap native low city'
apron=create('repair_mage_restored_low_ground_apron_20261012','ground')
for tri in triangulate(newFill):
 piece=tri.intersection(newFill)
 polys=[piece]if piece.geom_type=='Polygon'else [x for x in getattr(piece,'geoms',[]) if x.geom_type=='Polygon']
 for poly in polys:
  if poly.area<.005:continue
  exterior=list(poly.exterior.coords)[:-1]
  if len(exterior)<3:continue
  # Every cut triangle is either triangular or convex; fan triangulation is adequate.
  for i in range(1,len(exterior)-1):
   vs=[(*exterior[0],14.0),(*exterior[i],14.0),(*exterior[i+1],14.0)]
   add(apron,vs,[[0,1,2]])
print('LOW_GROUND_APRON',round(newFill.area,1),'m2',
      'nativeOverlap',round(newFill.intersection(nativeLow).area,1),
      'anchor',tuple(round(x,2)for x in nativeAnchor.coords[0]),flush=True)
plan['meshes'].extend(m for m in new if m['faces'])
plan['currentStructuralSeam20261012']={
 'status':'PROVISIONAL_VISUAL_AND_ACCESS_QA',
 'sourcePlanSHA256':baseHash,
 'removedMeshNames':sorted(removed),
 'changedMeshNames':list(shifted),
 'beforeLookoutLength':36,'afterLookoutLength':16,
 'observatoryAnchor':(599.5,799.6,77.5),
 'retainingSeamLengthM':round(total,2),
 'lowGroundApronAreaM2':round(newFill.area,2),
 'lowGroundNativeOverlapAreaM2':round(newFill.intersection(nativeLow).area,2),
 'newMeshes':[(m['name'],len(m['vertices']),len(m['faces']))for m in new if m['faces']],
 'limitations':['Mage 151m perimeter patch may need low-ground infill; not full citywide wall coverage',
  'Lookout reduced due absence of support footprint; preserve original route start',
  'Actor clearance and all new mesh intersection QA pending']}
(root/'loggia-mage-seam-20261012.v3.staged.plan.json').write_text(json.dumps(plan,separators=(',',':')),encoding='utf8')
(root/'loggia-mage-seam-20261012.v3.study.json').write_text(json.dumps(plan['currentStructuralSeam20261012'],indent=2),encoding='utf8')
print('STAGE',json.dumps(dict(removed=len(removed),changed=list(shifted),newFaces={m['name']:len(m['faces'])for m in new},wallMeters=round(total,1),retainingSources=len(walls)),ensure_ascii=False),flush=True)
