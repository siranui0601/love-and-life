"""Blender QA of the actual protected west castle stair top opening:
foot clearance, floor continuity and side wall fall protection.
"""
import bpy,json,pathlib,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'castle-stair-upper-guard-plan.staged.json').read_text('utf8'))
b=p['currentCastleWestStairTopCut']
route=next(r for r in p['routes']if r['id']=='castle_wall_stairs')
oldroutes=len(p['routes'])
new=bpy.data.objects.get(b['guardName'])
assert new is not None
assert len(new.data.polygons)==b['guardBatchedMeshFaces']
assert len(bpy.data.objects[b['groundObject']].data.polygons)==b['untouchedOriginalFaces']+b['replacementGroundFaces']
F=[bpy.data.objects[q]for q in ('castle_wall_stairs_treads','castle_wall_stairs',
 'b104_castle_outer_ground_extension','castle_ground','castle_wall_stairs_landing_1')]
def tree(objects):
 v=[];f=[];source=[]
 for obj in objects:
  ofs=len(v);v.extend([obj.matrix_world@a.co for a in obj.data.vertices])
  for face in obj.data.polygons:f.append([ofs+i for i in face.vertices]);source.append(obj.name)
 return BVHTree.FromPolygons(v,f),source
floors,ids=tree(F)
guard,_=tree([new])
samples=0;floorFails=[];headFails=[];protected=0;missingProtection=[]
routepts=[q for q in route['points']if 200.8<=q[2]<=203.62]
for A,B in zip(routepts,routepts[1:]):
 dx=B[0]-A[0];dy=B[1]-A[1];L=math.hypot(dx,dy)
 if L<.01:continue
 nx=-dy/L;ny=dx/L
 for phase in (.25,.75):
  x=A[0]+dx*phase;y=A[1]+dy*phase;z=A[2]+(B[2]-A[2])*phase
  for lateral in (-1.7,-.85,0,.85,1.7):
   hit,n,idx,dist=floors.ray_cast(Vector((x+nx*lateral,y+ny*lateral,z+1.4)),Vector((0,0,-1)),2.0)
   samples+=1
   if hit is None or abs(hit.z-z)>.52:
    if len(floorFails)<35:floorFails.append([round(x,3),round(y,3),round(z,3),
                          None if hit is None else round(hit.z,3)])
   # Human head/torso at same location should not overlap new protection
   for h in (1.1,1.8):
    hit,n,idx,dist=guard.ray_cast(Vector((x+nx*lateral,y+ny*lateral,z+h)),
                                Vector((0,0,1)),.30)
    if hit is not None:headFails.append([round(x,2),round(y,2),lateral,h])
  # outward test must strike protective wall in both directions, no open side
  for direction in (-1,1):
   h=z+1.05
   source=Vector((x,y,h))
   ray=Vector((nx*direction,ny*direction,0))
   hit,n,idx,dist=guard.ray_cast(source,ray,3.6)
   protected+=1
   if hit is None and len(missingProtection)<30:
    missingProtection.append([round(x,2),round(y,2),round(z,2),direction])
# Sample adjacent existing street routes against new wall mesh.
oldNearby=[];roadIntersections=[]
for route in p['routes']:
 if route['id']=='castle_wall_stairs' or len(route['points'])<2:continue
 if route['z0']!=route['z1'] or route['z0']!=204:continue
 if not any(171<q[0]<215 and 1045<q[1]<1100 for q in route['points']):continue
 oldNearby.append(route['id'])
 for a,bb in zip(route['points'],route['points'][1:]):
  dx=bb[0]-a[0];dy=bb[1]-a[1];L=math.hypot(dx,dy)
  if L<.001:continue
  N=max(1,math.ceil(L/1.5))
  for k in range(N):
   t=k/N;u=(k+1)/N;x=a[0]+dx*t;y=a[1]+dy*t
   if not 178<x<205 or not 1063<y<1091:continue
   x1=a[0]+dx*u;y1=a[1]+dy*u
   for height in (1.0,1.85):
    st=Vector((x,y,204+height))
    v=Vector((x1-x,y1-y,0))
    hit,n,idx,dist=guard.ray_cast(st,v.normalized(),v.length)
    if hit is not None and .01<dist<v.length-.01:
     if len(roadIntersections)<25:roadIntersections.append(route['id'])
status='LOCAL_PASS'if not floorFails and not headFails and not missingProtection and not roadIntersections else 'FAIL'
result=dict(status=status,groundOpenAreaM2=b['openCutAreaSqM'],
 groundFacesRemoved=b['sourceGroundFaces']-len(bpy.data.objects[b['groundObject']].data.polygons),
 newGuardFaces=len(new.data.polygons),newStairFloorProbes=samples,floorFailures=floorFails,
 newGuardBodyHeadObstructions=headFails,sideFallBarrierRays=protected,
 sideBarrierNotDetected=missingProtection,nearbyOriginalRoadIDs=oldNearby,
 nearbyRoadGuardIntersections=roadIntersections,
 note='Localized stair upper mouth; game swept capsule/citywide wall inspection remains untested')
(root/'castle-stair-upper-guard-local-qa.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print('CASTLE_STAIR_GUARD_LOCAL_QA',json.dumps({k:v for k,v in result.items() if k not in('floorFailures','newGuardBodyHeadObstructions','sideBarrierNotDetected','nearbyRoadGuardIntersections')}))
if floorFails:print('FLOOR_MISSING',floorFails[:10])
if headFails:print('HEAD_COLLISION',headFails[:10])
if missingProtection:print('GUARD_GAP',missingProtection[:10])
if roadIntersections:print('ROADS_HIT',roadIntersections[:10])
