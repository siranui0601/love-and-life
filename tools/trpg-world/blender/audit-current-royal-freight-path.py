"""Verify preexisting ~198m customs=>royal cliff cargo-hoist
corridor as a continuous *geometric* road path using actual Blender meshes.
This is NOT NPC/cart motion or real game navmesh acceptance.
"""
import bpy,json,math,pathlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
model=json.loads((root/'royal-freight-existing-road-surface.json').read_text('utf8'))
points=model['waypoints']
floor=[]
for obj in bpy.data.objects:
 if obj.type!='MESH' or not obj.data.polygons:continue
 n=obj.name
 if n in ('civic_foot_ground','current_royal_customs_road','western_ascent_civic_foot_contour_1_retained_0_continuous_floor'):
  floor.append(obj)
 elif n.startswith('wall_gallery_civic_wall_gallery_lower_') and n.endswith('_floor'):
  floor.append(obj)
def make_tree(objs):
 verts=[];faces=[];own=[]
 for ob in objs:
  k=len(verts);verts.extend([ob.matrix_world@v.co for v in ob.data.vertices])
  for poly in ob.data.polygons:
   faces.append([k+i for i in poly.vertices]);own.append(ob.name)
 if not faces:raise RuntimeError('No mesh faces')
 return BVHTree.FromPolygons(verts,faces),own
floorBvh,floorNames=make_tree(floor)
ignore={'Parcels - street frontage first','Frontage entrance doors - visual only','District facade openings'}
obstacles=[]
for ob in bpy.data.objects:
 if ob.type!='MESH' or not ob.data.polygons or ob in floor or ob.name in ignore:continue
 name=ob.name.lower()
 if any(s in name for s in ('_ground','_floor','_road','_paving','_contour','continuous_floor','parcels')):
  continue
 bounds=[ob.matrix_world@Vector(v) for v in ob.bound_box]
 mn=[min(q[j]for q in bounds)for j in range(3)]
 mx=[max(q[j]for q in bounds)for j in range(3)]
 if mx[0]<603 or mn[0]>730 or mx[1]<585 or mn[1]>725:continue
 if mx[2]<42.95 or mn[2]>44.7:continue
 obstacles.append(ob)
trees,owners=make_tree(obstacles)
samples=0;floorFails=[];casts=0;collision=[]
for A,B in zip(points,points[1:]):
 dx=B[0]-A[0];dy=B[1]-A[1];L=math.hypot(dx,dy)
 if L<.005:continue
 nx=-dy/L;ny=dx/L
 N=max(1,math.ceil(L/1.25))
 for i in range(N):
  t=(i+.4)/N;u=(i+.8)/N
  x=A[0]+dx*t;y=A[1]+dy*t
  X=A[0]+dx*u;Y=A[1]+dy*u
  for sh in (-1.,0.,1.):
   floorAt=Vector((x+nx*sh,y+ny*sh,44.5))
   hit,n,idx,dist=floorBvh.ray_cast(floorAt,Vector((0,0,-1)),3)
   samples+=1
   if hit is None or abs(hit.z-42)>.4:
    if len(floorFails)<30:floorFails.append([round(x,2),round(y,2),None if hit is None else round(hit.z,2)])
   for h in (1.05,1.85):
    a=Vector((x+nx*sh,y+ny*sh,42+h))
    b=Vector((X+nx*sh,Y+ny*sh,42+h))
    v=b-a
    if v.length<.01:continue
    q,n,idx,dist=trees.ray_cast(a,v.normalized(),v.length)
    casts+=1
    if q is not None and .015<dist<v.length-.015:
     if len(collision)<30:collision.append([owners[idx],round(x,2),round(y,2),round(h,2)])
passed=not floorFails and not collision and len(points)>10
result=dict(status='LOCAL_PASS'if passed else 'FAIL',routeLengthM=model['geometryLengthM'],
 pieces=model['segmentLengthsM'],start=points[0],finish=points[-1],
 bottomLevelM=42,floorSources=len(floor),staticObstacleObjectsTested=len(obstacles),
 floorSamples=samples,floorFailures=floorFails,personRays=casts,personCollisions=collision,
 routeReusesExistingRoads=True,
 caveats=['Actual Blender static mesh local rays and floor probes only; no cargo/cart capsule sweep',
 'Visual-only facade aggregate meshes excluded','No working game behavior or NPC/vehicle physics',
 'Unverified curb/turn radius limits for a physical freight cart'])
(root/'royal-existing-freight-route-3d-qa.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print('ROYAL_FREIGHT_PATH_QA',json.dumps({k:v for k,v in result.items()if k not in('floorFailures','personCollisions','caveats')}))
if floorFails:print('FLOOR_FAIL_EXAMPLES',floorFails[:12])
if collision:print('PATH_HITS',collision[:12])
