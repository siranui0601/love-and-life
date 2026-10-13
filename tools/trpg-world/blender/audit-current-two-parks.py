"""Local park route clearance + floor QA against new sculptures and existing
urban buildings. Reject if new route/old road blocked. Staging only."""
import bpy,json,pathlib,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'two-parks-plan.staged.json').read_text('utf8'))
old=json.loads((root/'plan.json').read_text('utf8'))
park=p['currentNewNeighborhoodParks']
prev={r['id']:r for r in old['routes']}
curr={r['id']:r for r in p['routes']}
preserved=all(curr.get(k)==v for k,v in prev.items())
if len(curr)!=len(prev)+5 or not preserved:raise RuntimeError('Source roads mutated')
N=park['newMeshes']
objs=[bpy.data.objects.get(n)for n in N]
if any(x is None for x in objs):raise RuntimeError('Missing park geometry')
def bvh(items):
 v=[];f=[];own=[]
 for ob in items:
  j=len(v);v.extend([ob.matrix_world@q.co for q in ob.data.vertices])
  for face in ob.data.polygons:f.append([j+i for i in face.vertices]);own.append(ob.name)
 return BVHTree.FromPolygons(v,f),own
not_floor=[o for o in objs if not o.name.endswith(('_walk','_grass'))]
colliders,owners=bvh(not_floor)
floorSources=[bpy.data.objects.get('low_city_ground'),bpy.data.objects.get('upper_city_ground')]
floorSources += [o for o in objs if o.name.endswith('_walk')]
floors,flOwner=bvh(floorSources)
newIDs=[id for id in curr if id not in prev]
checks=newIDs+[r['id']for r in old['routes'] if len(r['points'])>1 and r['z0']==r['z1'] and r['z0'] in(14,112) and any((abs(q[0]+550)<27 and abs(q[1]+900)<25)or(abs(q[0]-200)<28 and abs(q[1]-610)<25)for q in r['points'])]
floorMissing=[];hits=[];s=0;c=0;ids=set()
for routeId in checks:
 r=curr[routeId]
 pts=r['points'];z=r['z0']
 if r['z1']!=z:continue
 if z not in (14,112):continue
 for a,b in zip(pts,pts[1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  if L<.05:continue
  nx=-dy/L;ny=dx/L;n=max(1,math.ceil(L/1.3))
  for k in range(n):
   t=(k+.25)/n;u=(k+.75)/n
   x=a[0]+dx*t;y=a[1]+dy*t
   xx=a[0]+dx*u;yy=a[1]+dy*u
   if not ((abs(x+550)<20 and abs(y+900)<17)or(abs(x-200)<22 and abs(y-610)<16)):continue
   ids.add(routeId)
   for sh in (-.64,0,.64):
    hit,nrm,ind,dist=floors.ray_cast(Vector((x+nx*sh,y+ny*sh,z+1.5)),Vector((0,0,-1)),2.0)
    s+=1
    if hit is None or abs(hit.z-z)>.44:
     if len(floorMissing)<50:floorMissing.append((routeId,round(x),round(y)))
    for h in (1.05,1.85):
     st=Vector((x+nx*sh,y+ny*sh,z+h))
     ed=Vector((xx+nx*sh,yy+ny*sh,z+h));v=ed-st
     if v.length<.003:continue
     hit,nrm,ind,dist=colliders.ray_cast(st,v.normalized(),v.length)
     c+=1
     if hit is not None and .015<dist<v.length-.015:
      if len(hits)<50:hits.append((routeId,owners[ind],round(x,2),round(y,2)))
report=dict(status='LOCAL_PASS'if preserved and not floorMissing and not hits else 'FAIL',
 existingRoadsUntouched=preserved,publicGardensAdded=2,newParkRoutes=5,
 parkRouteIds=newIDs,routeCountTested=len(ids),floorProbes=s,floorFailures=floorMissing,
 bodyHeadRays=c,obstructions=hits,
 limitations=['Adjacent aggregate city facades not tested for full swept capsule','Actual accessibility and landscaping quality needs visual review',
 'No NPC use, game park events or city-wide park coverage audit'])
(root/'two-new-parks-3d-qa.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('TWO_PARK_QA',json.dumps({k:v for k,v in report.items()if k not in ('floorFailures','obstructions','limitations')}))
if floorMissing:print('FLOOR_MISSING',floorMissing[:17])
if hits:print('PATH_BLOCK',hits[:17])
