"""User-designated P0: nine ground gaps and four wall gaps at 12 unique coordinates.
Write staged plan only. No modifications to active Blender file, routes or facilities.
"""
import json,pathlib,math,hashlib
from shapely.geometry import Point,LineString,Polygon
from shapely.ops import unary_union,nearest_points,triangulate,substring
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
base=(root/'plan.json').read_bytes()
P=json.loads(base)
M={m['name']:m for m in P['meshes']}
def floor_union(name):
 m=M[name];V=m['vertices'];polygons=[]
 for face in m['faces']:
  xyz=[V[j]for j in face]
  if max(q[2]for q in xyz)-min(q[2]for q in xyz)>.02:continue
  poly=Polygon([x[:2]for x in xyz])
  if poly.is_valid and poly.area>.05:polygons.append(poly)
 return unary_union(polygons)
tier_names=['low_city_ground','civic_foot_ground','upper_city_ground','forecourt_ground','mage_east_ground']
G={n:floor_union(n)for n in tier_names}
# Treat the Blender cursor's Z as a hint, not necessarily finished-floor Z.
# Each grade is instead inherited from its adjoining district ground.
floor_spec=[
 ('F01',-654.298,1076.59,14,'low_city_ground',15),
 ('F02',-784.298,756.89,42,'civic_foot_ground',13),
 ('F03',-124.498,219.29,14,'low_city_ground',15),
 ('F04W01',-127.198,914.99,112,'upper_city_ground',32),
 ('F05',353.602,960.79,156,'forecourt_ground',13),
 ('F06',424.202,1126.79,112,'upper_city_ground',13),
 ('F07',271.202,1239.89,112,'upper_city_ground',5),
 ('F08',405.302,1180.19,14,'low_city_ground',9),
 ('F09',584.702,925.49,14,'low_city_ground',18),
 ('W02_BASE',552.002,878.49,14,'low_city_ground',31),
 ('W03_TOE',329.64,1241.88,14,'low_city_ground',12),
]
def mesh(name,mat):
 assert name not in M
 m={'name':name,'vertices':[],'faces':[],'material':mat}
 P['meshes'].append(m);M[name]=m
 return m
def flat_mesh(poly,z,name,material='ground'):
 m=mesh(name,material)
 # Our input geometries are round-capped straight corridors (convex).
 # Delaunay triangulation has no exterior fringe in a convex polygon.
 assert poly.is_valid and poly.geom_type=='Polygon'
 positions={}
 for tri in triangulate(poly):
  if not poly.covers(tri.representative_point()):continue
  face=[]
  for x,y in list(tri.exterior.coords)[:3]:
   key=(round(x,4),round(y,4))
   if key not in positions:
    positions[key]=len(m['vertices'])
    m['vertices'].append([key[0],key[1],float(z)])
   face.append(positions[key])
  if len(set(face))==3:m['faces'].append(face)
 assert len(m['faces'])>10
 return m
floor_studies=[]
for tag,x,y,z,source,thick in floor_spec:
 pt=Point(x,y);native=G[source]
 near=nearest_points(pt,native)[1];dd=pt.distance(native)
 # Don't build unsupported flat rectangles. An apron reaches the true
 # surface and overlaps it at the full width at the join.
 corridor=LineString([(x,y),near.coords[0]]).buffer(thick,resolution=12,cap_style=1)
 assert corridor.covers(pt)
 overlap=corridor.intersection(native).area
 assert overlap>1, (tag,overlap)
 name='repair_user_p0_'+tag+'_ground_20261012'
 m=flat_mesh(corridor,z,name)
 floor_studies.append(dict(tag=tag,source=source,height=z,
  nativeDistanceM=round(dd,2),areaM2=round(corridor.area,2),
  actualOverlapNativeM2=round(overlap,2),meshName=name,
  centerIsCovered=corridor.covers(pt),nearSource=[round(t,2)for t in near.coords[0]],
  triangleCount=len(m['faces'])))
print('FLOORS_BUILT',len(floor_studies),flush=True)
# Exposed upper-tier boundary sampled as continuous wall belt.
# Each wall connects its real upper terrace edge to the intended lower grade.
walls=[
 ('W01',-127.198,914.99,'forecourt_ground',112,156,24),
 ('W02',552.002,878.49,'upper_city_ground',14,112,29),
 ('W03',355.702,1226.39,'upper_city_ground',14,112,32),
 ('W04',1175.8,492.69,'mage_east_ground',14,70,30),
]
def find_edge(geo,pt):
 choices=list(geo.geoms) if geo.geom_type=='MultiPolygon'else[geo]
 polys=sorted(choices,key=lambda q:q.exterior.distance(pt))
 ring=LineString(polys[0].exterior.coords)
 location=ring.project(pt)
 return ring,location
wall_studies=[]
for tag,x,y,highsource,zfoot,ztop,half in walls:
 pt=Point(x,y);edge,mid=find_edge(G[highsource],pt)
 segment=substring(edge,max(0,mid-half),min(edge.length,mid+half))
 coords=[segment.interpolate(segment.length*i/max(2,math.ceil(segment.length/3))).coords[0]
   for i in range(max(2,math.ceil(segment.length/3))+1)]
 m=mesh('repair_user_p0_'+tag+'_retaining_20261012','stone')
 footing=mesh('repair_user_p0_'+tag+'_wall_foot_20261012','stone')
 cap=mesh('repair_user_p0_'+tag+'_parapet_20261012','limestone')
 def continuous_stone_belt(mm,zlow,zhigh,half_width):
  # 4 shared ring vertices at each sampled knot, instead of many disconnected
  # boxlets that would let retaining-wall seams become gaps.
  rings=[]
  for i,(xx,yy) in enumerate(coords):
   p0=coords[max(0,i-1)];p1=coords[min(len(coords)-1,i+1)]
   dx=p1[0]-p0[0];dy=p1[1]-p0[1];length=math.hypot(dx,dy)
   assert length>.01
   nx=-dy/length*half_width;ny=dx/length*half_width
   ring=[len(mm['vertices'])+j for j in range(4)]
   mm['vertices'].extend([
    [xx-nx,yy-ny,zlow],[xx+nx,yy+ny,zlow],
    [xx-nx,yy-ny,zhigh],[xx+nx,yy+ny,zhigh]])
   rings.append(ring)
  for a,b in zip(rings,rings[1:]):
   al,ar,au,av=a;bl,br,bu,bv=b
   mm['faces'].extend([
    [al,bl,bu,au], [ar,av,bv,br],
    [au,bu,bv,av], [al,ar,br,bl]])
  first=rings[0];last=rings[-1]
  mm['faces'].append([first[0],first[2],first[3],first[1]])
  mm['faces'].append([last[0],last[1],last[3],last[2]])
 continuous_stone_belt(m,zfoot,ztop-.25,.9)
 continuous_stone_belt(footing,zfoot-.25,zfoot+.8,1.2)
 continuous_stone_belt(cap,ztop-.25,ztop+.55,1.3)
 wall_studies.append(dict(tag=tag,source=highsource,
  wallMeters=round(segment.length,2),minZ=zfoot,maxZ=ztop,
  nearestNativeHighEdgeDistanceM=round(edge.distance(pt),2),
  meshNames=[m['name'],footing['name'],cap['name']],
  positions=len(coords),start=[round(i,2) for i in coords[0]],
  end=[round(i,2)for i in coords[-1]]))
print('WALLS_BUILT',len(wall_studies),flush=True)
meta=dict(status='PENDING_LOCAL_QA_NO_PROMOTION',
 sourcePlanSHA256=hashlib.sha256(base).hexdigest(),
 uniqueSpots=12,reportedGroundGaps=9,reportedWallGaps=4,
 floors=floor_studies,walls=wall_studies,
 protectedRoutes=len(P['routes']),warnings=[
  'F09 is a long apron to reach native Z14 floor: inspect large visual footprint',
  'W02 includes an extra Z14 native foundation apron because Z42 old ground is distant',
  'User cursor Z can lie inside an empty space, not at grade',
  'Before promotion, locally ray check floor and wall meshes, original roads, and visual before/after',
  'Do not move onto palace or unrelated QA while any coordinate is unverified'])
P['userReportedPriority12_20261012']=meta
stage=root/'user-p0-12-gaps-v4-20261012.staged.plan.json'
assert not stage.exists()
stage.write_text(json.dumps(P,separators=(',',':')),encoding='utf8')
(root/'user-p0-12-gaps-v4-20261012.study.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
print('STAGED',stage.stat().st_size,'newMeshes',len(P['meshes'])-len(json.loads(base)['meshes']),flush=True)
