import bpy,json,pathlib,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((r/'grand-garden-plan.staged.json').read_text('utf8'))
base=json.loads((r/'plan.json').read_text('utf8'))
meta=plan['currentNewNeighborhoodParks']
known={x['id']:x for x in base['routes']}
now={x['id']:x for x in plan['routes']}
if not all(now.get(k)==v for k,v in known.items()):raise RuntimeError('Existing route modified')
newIds=[k for k in now if k not in known]
if len(newIds)!=10:raise RuntimeError('Unexpected new paths '+str(newIds))
parkObjects=[obj for obj in bpy.data.objects if obj.type=='MESH' and
 (obj.name.startswith('current_upper_grand_garden_') or obj.name.startswith('current_two_new_parks_'))]
floorObjects=[bpy.data.objects.get(n)for n in ('low_city_ground','upper_city_ground')]
floorObjects += [obj for obj in parkObjects if obj.name.endswith(('_path','_walk'))]
obstacleObjects=[obj for obj in parkObjects if not obj in floorObjects and not obj.name.endswith(('turf','grass'))]
def bvh(objects):
 vs=[];fs=[];ids=[]
 for obj in objects:
  if obj is None:continue
  k=len(vs)
  vs.extend([obj.matrix_world@q.co for q in obj.data.vertices])
  for f in obj.data.polygons:
   fs.append([k+j for j in f.vertices]);ids.append(obj.name)
 return BVHTree.FromPolygons(vs,fs),ids
floors,floornames=bvh(floorObjects)
obs,obsnames=bvh(obstacleObjects)
tested=[];floorFails=[];bodyFails=[];fSamples=0;rays=0
# All ten new routes and older street contours in a 50m buffer around parks.
near=[]
for q in base['routes']:
 if q['z0']!=q['z1'] or q['z0'] not in (14,112) or len(q['points'])<2:continue
 if any((abs(i[0]+550)<45 and abs(i[1]+900)<37 and q['z0']==14)
      or (170<i[0]<282 and 527<i[1]<640 and q['z0']==112) for i in q['points']):
  near.append(q['id'])
for id in newIds+near:
 path=now[id];z=path['z0']
 tested.append(id)
 for A,B in zip(path['points'],path['points'][1:]):
  dx=B[0]-A[0];dy=B[1]-A[1];L=math.hypot(dx,dy)
  if L<.1:continue
  nx=-dy/L;ny=dx/L
  N=max(1,math.ceil(L/1.5))
  for j in range(N):
   t=(j+.25)/N;u=(j+.75)/N
   x=A[0]+dx*t;y=A[1]+dy*t
   if not ((abs(x+550)<25 and abs(y+900)<20 and z==14)
           or (175<x<279 and 531<y<636 and z==112)):continue
   X=A[0]+dx*u;Y=A[1]+dy*u
   for sh in (-.7,0,.7):
    point=Vector((x+nx*sh,y+ny*sh,z+1.1))
    hit,n,idx,dist=floors.ray_cast(point,Vector((0,0,-1)),1.9)
    fSamples+=1
    if hit is None or abs(hit.z-z)>.42:
     if len(floorFails)<30:floorFails.append([id,round(x,2),round(y,2),None if hit is None else round(hit.z,2)])
    for h in (1.1,1.85):
     start=Vector((x+nx*sh,y+ny*sh,z+h))
     end=Vector((X+nx*sh,Y+ny*sh,z+h))
     v=end-start
     if v.length<.01:continue
     hit,n,idx,dist=obs.ray_cast(start,v.normalized(),v.length)
     rays+=1
     if hit is not None and .015<dist<v.length-.015:
      if len(bodyFails)<30:bodyFails.append([id,obsnames[idx],round(x,2),round(y,2)])
summary=dict(status='LOCAL_PASS'if not floorFails and not bodyFails else 'FAIL',
 paths=newIds,allExistingRoutesPreserved=True,
 scope='two park districts; garden paths and nearby static old streets',
 floorSamples=fSamples,floorFailures=floorFails,rays=rays,obstacleCollisions=bodyFails,
 parkMeshes=len(parkObjects),caveats=['NPC/pathfinding not operational',
 'No continuous player capsule or full-city traffic simulation',
 'Need eye-level visual review before accept'])
(r/'grand-garden-local-qa.json').write_text(json.dumps(summary,indent=2),encoding='utf8')
print('GARDEN_QA',json.dumps({k:v for k,v in summary.items()if k not in ('paths','floorFailures','obstacleCollisions','caveats')}))
if floorFails:print('FLOOR_FAIL',floorFails[:10])
if bodyFails:print('BLOCKERS',bodyFails[:10])
