"""Castle palace actual local Blender QA. Protect legacy street graph and
old main castle meshes. 3 corridor samples along each NEW route and the
existing streets near the facilities.
"""
import bpy,json,pathlib,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'royal-palace-plan-v6.staged.json').read_text('utf8'))
old=json.loads((root/'plan.json').read_text('utf8'))
meta=p['currentRoyalResidencePalaceStudy'];names=meta['newMeshBatches']
routes={r['id']:r for r in p['routes']}
olds={r['id']:r for r in old['routes']}
if len(routes)!=len(olds)+4 or any(routes.get(k)!=v for k,v in olds.items()):
 raise RuntimeError('Old roads changed')
objects=[bpy.data.objects.get(n)for n in names]
if any(o is None for o in objects):raise RuntimeError('New palace mesh missing')
def bvh(objs):
 vv=[];f=[];owners=[]
 for ob in objs:
  start=len(vv)
  vv.extend([ob.matrix_world@v.co for v in ob.data.vertices])
  for poly in ob.data.polygons:f.append([start+i for i in poly.vertices]);owners.append(ob.name)
 return BVHTree.FromPolygons(vv,f),owners
F=[bpy.data.objects[x]for x in ('castle_ground','castle_east_ramp_landing_1',
 'castle_ring_east_ramp_link','castle_lane_1')if bpy.data.objects.get(x)]
F += [o for o in objects if o.name.endswith('_buttress')]
ground,gnames=bvh(F)
obstacles=[o for o in objects if not o.name.endswith('_buttress')]
wall,wname=bvh(obstacles)
allRouteIDs=list(meta['newRouteIds'])
for r in old['routes']:
 if len(r['points'])<2 or r['z0']!=r['z1'] or r['z0']!=204:continue
 if any((265<q[0]<340 and 1135<q[1]<1210)or(173<q[0]<213 and 1104<q[1]<1154)for q in r['points']):
  allRouteIDs.append(r['id'])
floorFail=[];legacyFloorAdvisory=[];bodyFail=[];fCount=0;cCount=0
for id in allRouteIDs:
 r=routes[id];z=204
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];ll=math.hypot(dx,dy)
  if ll<.1:continue
  nx=-dy/ll;ny=dx/ll
  n=max(1,math.ceil(ll/1.2))
  for i in range(n):
   t=(i+.3)/n;u=(i+.7)/n
   x=a[0]+dx*t;y=a[1]+dy*t
   X=a[0]+dx*u;Y=a[1]+dy*u
   if not (160<x<350 and 980<y<1220):continue
   for side in(-.75,0,.75):
    p1=Vector((x+nx*side,y+ny*side,z+1.4))
    ht,nrm,idx,dist=ground.ray_cast(p1,Vector((0,0,-1)),1.9)
    fCount+=1
    if ht is None or abs(ht.z-z)>.38:
     bucket=floorFail if id in meta['newRouteIds'] else legacyFloorAdvisory
     if len(bucket)<25:bucket.append([id,round(x,2),round(y,2),None if ht is None else round(ht.z,2)])
    for hh in(1.1,1.8):
     A=Vector((x+nx*side,y+ny*side,z+hh))
     B=Vector((X+nx*side,Y+ny*side,z+hh));v=B-A
     if v.length<.002:continue
     hit,nm,index,dist=wall.ray_cast(A,v.normalized(),v.length)
     cCount+=1
     if hit is not None and .018<dist<v.length-.018:
      if len(bodyFail)<40:bodyFail.append([id,wname[index],round(x,2),round(y,2),round(hh,2)])
report=dict(status='LOCAL_PASS'if not floorFail and not bodyFail else 'FAIL',
 testedRoutes=len(allRouteIDs),preservedPriorRoutes=True,
 newBatchedMeshes=len(objects),floorRays=fCount,floorFailures=floorFail,
 preexistingRouteFloorHeightDiscrepancy=legacyFloorAdvisory,
 bodyHeadRays=cCount,collisions=bodyFail,
 caveats=['No whole-castle capsule sweep, building interior room navigation, royal NPC scripting or playable doors',
 'Palace rooftop visual/artistic acceptance requires aerial/eye review',
 'No actual castle east or western court ramp rework in this stage'])
(root/'royal-palace-local-qa.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('ROYAL_PALACE_QA',json.dumps({k:v for k,v in report.items()if k not in ('floorFailures','collisions','caveats')}))
if bodyFail:print('BODY_FAILURE',bodyFail[:17])
if floorFail:print('FLOOR_FAILURE',floorFail[:17])
