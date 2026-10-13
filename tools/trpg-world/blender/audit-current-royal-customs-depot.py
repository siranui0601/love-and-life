"""Customs depot local acceptance: existing routes preserved, doorway walk,
new structure does not block contour road, canonical parcel clearance, ground.
Check nearby OLD walls at person elevation too.
"""
import bpy,json,math,pathlib,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((root/'royal-customs-plan.staged.json').read_text('utf8'))
prior=json.loads((root/'plan.json').read_text('utf8'))
qaPre=json.loads((root/'royal-customs-preflight.json').read_text('utf8'))
depot=p['currentRoyalCustomsDepot']
route=next(q for q in p['routes']if q['id']==depot['accessRoute'])
priorRoad={r['id']:r for r in prior['routes']}
presentRoad={r['id']:r for r in p['routes']}
preserved=all(presentRoad.get(k)==v for k,v in priorRoad.items())
if len(presentRoad)!=len(priorRoad)+1 or not preserved:raise RuntimeError('Old roads lost or edited')
names=depot['newMeshes']
objects=[bpy.data.objects.get(s)for s in names]
if any(o is None for o in objects):raise RuntimeError('New mesh missing in Blender')
def tree_for(obs):
 vv=[];ff=[];owners=[]
 for obj in obs:
  offset=len(vv)
  vv.extend([obj.matrix_world@v.co for v in obj.data.vertices])
  for f in obj.data.polygons:
   ff.append([offset+k for k in f.vertices]);owners.append(obj.name)
 return BVHTree.FromPolygons(vv,ff),owners
floor=[o for o in objects if o.name.endswith(('_foundation','_road'))]
tr,owners=tree_for(floor+[bpy.data.objects['civic_foot_ground']])
obsNew=[o for o in objects if not o.name.endswith(('_foundation','_road'))]
tree,newOwner=tree_for(obsNew)
nearOld=[]
for ob in bpy.data.objects:
 if ob.type!='MESH' or ob.name in names or not ob.data.polygons:continue
 if ob.name in ('Parcels - street frontage first','District facade openings','Frontage entrance doors - visual only'):continue
 bb=[ob.matrix_world@Vector(v)for v in ob.bound_box]
 lo=[min(v[j]for v in bb)for j in range(3)]
 hi=[max(v[j]for v in bb)for j in range(3)]
 if lo[0]>740 or hi[0]<670 or lo[1]>735 or hi[1]<665:continue
 if lo[2]>51 or hi[2]<43:continue
 if any(u in ob.name.lower()for u in ('ground','road','contour','floor','paving','lane')):continue
 nearOld.append(ob)
floorFails=[];block=[];samples=0;rays=0
for a,b in zip(route['points'],route['points'][1:]):
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 if L<.01:continue
 nx=-dy/L;ny=dx/L
 n=max(1,math.ceil(L/.75))
 for i in range(n):
  t=(i+.5)/n;u=(i+.85)/n
  x=a[0]+dx*t;y=a[1]+dy*t
  X=a[0]+dx*u;Y=a[1]+dy*u
  for sh in (-.72,0,.72):
   loc=Vector((x+nx*sh,y+ny*sh,44))
   hit,normal,index,dist=tr.ray_cast(loc,Vector((0,0,-1)),2.5)
   samples+=1
   if hit is None or abs(hit.z-42)>.5:
    if len(floorFails)<35:floorFails.append([round(x,2),round(y,2),None if hit is None else round(hit.z,2)])
   for height in (1.05,1.85):
    start=Vector((x+nx*sh,y+ny*sh,42+height))
    end=Vector((X+nx*sh,Y+ny*sh,42+height))
    vec=end-start
    if vec.length<.005:continue
    ray,norm,index,dist=tree.ray_cast(start,vec.normalized(),vec.length)
    rays+=1
    if ray is not None and .015<dist<vec.length-.015:
     if len(block)<45:block.append(['new:'+newOwner[index],round(x,1),round(y,1)])
    for obj in nearOld:
     local=obj.matrix_world.inverted()@start
     endlocal=obj.matrix_world.inverted()@end
     vector=endlocal-local
     if vector.length<.01:continue
     ok,point,nrm,idx=obj.ray_cast(local,vector.normalized(),distance=vector.length)
     if ok:
      hitpos=obj.matrix_world@point
      ds=(hitpos-start).length
      if .015<ds<vec.length-.015:
       if len(block)<45:block.append(['old:'+obj.name,round(x,1),round(y,1)])
# Legacy contour road around the depot; check newly built architecture only,
# NOT paving, and do not reject the planned junction as a collision.
raysContour=0;contourBlocks=[]
for r in prior['routes']:
 if len(r['points'])<2 or r['z0']!=42 or r['z1']!=42:continue
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  if L<.05:continue
  n=max(1,math.ceil(L/2.5));nx=-dy/L;ny=dx/L
  for i in range(n):
   x=a[0]+dx*i/n;y=a[1]+dy*i/n
   X=a[0]+dx*(i+1)/n;Y=a[1]+dy*(i+1)/n
   if not(670<x<740 and 665<y<735):continue
   for sh in (-1,0,1):
    for h in (1.0,1.9):
     st=Vector((x+nx*sh,y+ny*sh,42+h))
     en=Vector((X+nx*sh,Y+ny*sh,42+h))
     diff=en-st
     if diff.length<.005:continue
     hit,nrm,idx,dist=tree.ray_cast(st,diff.normalized(),diff.length)
     raysContour+=1
     if hit is not None and .015<dist<diff.length-.015:
      if len(contourBlocks)<45:contourBlocks.append([r['id'],newOwner[idx],round(x),round(y)])
res=dict(status='LOCAL_PASS'if preserved and qaPre['status']=='PASS' and not floorFails and not block and not contourBlocks else 'FAIL',
 sourceRoutesPreserved=preserved,parcelOverlap=qaPre['parcelOverlapM2'],
 accessParcelOverlap=qaPre['accessParcelOverlapM2'],floorSamples=samples,floorFails=floorFails,
 accessRays=rays,accessCollisions=block,existingMeshesTested=len(nearOld),
 existingRoadRays=raysContour,existingRoadCollisions=contourBlocks,
 caveats=['Real in-game AI/pathfinding not implemented',
 'Warehouse equipment is only visual; no storage inventory/quests operational',
 'Clearance is discrete rays, not swept capsule'])
(root/'customs-depot-local-qa.json').write_text(json.dumps(res,indent=2),encoding='utf8')
print('CUSTOMS_QA',json.dumps({k:v for k,v in res.items()if k not in ('floorFails','accessCollisions','existingRoadCollisions','caveats')}))
if block:print('ACCESS_BLOCKS',block[:20])
if floorFails:print('FLOOR_ERRORS',floorFails[:20])
if contourBlocks:print('ROAD_HITS',contourBlocks[:20])
