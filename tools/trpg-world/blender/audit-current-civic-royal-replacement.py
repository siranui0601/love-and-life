"""Strict-scoped real-mesh QA of 181m replacement stair and freight tower.
Discrete body/head casting plus actual tread/bridge supporting rays.
Do not claim elevator is animated/playable.
"""
import bpy,math,json,pathlib,sys,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((root/'royal-replacement-plan.staged.json').read_text(encoding='utf8'))
study=p['civicRoyalRampReplacement']
route=next(q for q in p['routes']if q['id']==study['routeId'])
stair=bpy.data.objects.get('current_civic_upper_short_stair')
if stair is None:raise RuntimeError('Actual unified stair mesh missing')
newnames=study['distinctMeshObjects']
newobjects=[bpy.data.objects.get(n)for n in newnames]
if any(q is None for q in newobjects):raise RuntimeError('New meshes missing')
floorNames=[n for n in newnames if n.endswith(('short_stair','short_bridge','hoist_platform'))]
if 'current_civic_upper_short_stair'not in floorNames:raise RuntimeError('No stair surface')
def world_bvh(objs):
 vertices=[];faces=[];owners=[]
 for ob in objs:
  k=len(vertices);vertices.extend([ob.matrix_world@v.co for v in ob.data.vertices])
  for face in ob.data.polygons:
   faces.append([k+i for i in face.vertices]);owners.append(ob.name)
 return BVHTree.FromPolygons(vertices,faces),owners
floorobjs=[bpy.data.objects[n]for n in floorNames]
floortree,floorowners=world_bvh(floorobjs)
all_existing=[]
for ob in bpy.data.objects:
 if ob.type!='MESH' or not ob.data.polygons or ob.name in newnames:continue
 if len(ob.data.polygons)>100000:continue
 if ob.name in ('Parcels - street frontage first','Frontage entrance doors - visual only','District facade openings'):continue
 bounds=[ob.matrix_world@Vector(c) for c in ob.bound_box]
 if min(q.x for q in bounds)>680 or max(q.x for q in bounds)<560:continue
 if min(q.y for q in bounds)>735 or max(q.y for q in bounds)<585:continue
 if min(q.z for q in bounds)>122 or max(q.z for q in bounds)<39:continue
 if any(n in ob.name for n in ['ground','road','lane','deck','surface','tread','landing','parapet','stair','floor','slope','bridge']):continue
 all_existing.append(ob)
newObstacleObjs=[bpy.data.objects[n]for n in newnames if n not in floorNames and not n.endswith('_support')]
all_obstacles=all_existing+newObstacleObjs
hits=[];supportFails=[];casts=0;supportRays=0
# per-object ray casts rather than 1m giant BVH through compound city geometry
for a,b in zip(route['points'],route['points'][1:]):
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 if L<.003:continue
 nx=-dy/L;ny=dx/L
 N=max(1,math.ceil(L/.90))
 for step in range(N):
  t=(step+.5)/N
  u=(step+.85)/N
  x=a[0]+dx*t;y=a[1]+dy*t;z=a[2]+(b[2]-a[2])*t
  xx=a[0]+dx*u;yy=a[1]+dy*u;zz=a[2]+(b[2]-a[2])*u
  for lateral in (-.55,0,.55):
   base=Vector((x+nx*lateral,y+ny*lateral,z+.77))
   hit,n,idx,dist=floortree.ray_cast(base,Vector((0,0,-1)),1.55)
   supportRays+=1
   if hit is None or abs(hit.z-z)>.36:
    if len(supportFails)<80:supportFails.append(dict(where=[round(x,2),round(y,2),round(z,2)],hitZ=None if hit is None else round(hit.z,2)))
   for h in (1.1,1.85):
    start=Vector((x+nx*lateral,y+ny*lateral,z+h))
    end=Vector((xx+nx*lateral,yy+ny*lateral,zz+h))
    dv=end-start
    if dv.length<.0005:continue
    for obj in all_obstacles:
     mat=obj.matrix_world.inverted()
     local=mat@start
     vect=mat.to_3x3()@dv
     if vect.length<.0002:continue
     success,point,norm,poly=obj.ray_cast(local,vect.normalized(),distance=vect.length)
     if success:
      distance=((obj.matrix_world@point)-start).length
      if .015<distance<dv.length-.015:
       if len(hits)<80:hits.append(dict(ob=obj.name,at=[round(x,2),round(y,2),round(z,2)]))
    casts+=1
# Check level roads near same cliff for contacts with new construction;
# do NOT falsely classify the staircase joining each existing road.
roadNew=[o for o in newobjects if 'hoist_'in o.name or o.name.endswith('_short_support')]
treeRoad,roadOwners=world_bvh(roadNew)
neighborHits=[];neighborSamples=0;roads=set()
for r in p['routes']:
 if r['id']==route['id'] or len(r['points'])<2:continue
 if r['z0'] not in (42,112) or r['z1']!=r['z0']:continue
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  if L<.2:continue
  N=max(1,math.ceil(L/3.0))
  nx=-dy/L;ny=dx/L
  for i in range(N):
   t=i/N;u=(i+1)/N
   x=a[0]+dx*t;y=a[1]+dy*t
   if not(555<x<680 and 590<y<745):continue
   roads.add(r['id'])
   xx=a[0]+dx*u;yy=a[1]+dy*u
   for shift in (-min(1.0,r['width']*.2),0,min(1.0,r['width']*.2)):
    for h in (1.05,1.85):
     st=Vector((x+nx*shift,y+ny*shift,r['z0']+h))
     ed=Vector((xx+nx*shift,yy+ny*shift,r['z0']+h))
     dv=ed-st
     if dv.length<.001:continue
     hit,normal,idx,dist=treeRoad.ray_cast(st,dv.normalized(),dv.length)
     neighborSamples+=1
     if hit is not None and .015<dist<dv.length-.015:
      if len(neighborHits)<70:neighborHits.append(dict(route=r['id'],mesh=roadOwners[idx],x=round(x),y=round(y)))
result=dict(status='PASS'if not hits and not supportFails and not neighborHits else 'FAIL',
 oldRampRemoved=all(bpy.data.objects.get(x)is None for x in study['oldRampRemovedMeshNames']),
 oldRampLengthM=1170.3,newStairLengthM=study['routeLength3dM'],
 floorTests=supportRays,unsupported=len(supportFails),personRays=casts,personCollisions=len(hits),
 existingMeshCandidates=len(all_existing),
 nearbyRoads=len(roads),nearbyNewStructureRays=neighborSamples,nearbyNewStructureCollisions=len(neighborHits),
 floorExamples=supportFails,personExamples=hits,neighborExamples=neighborHits,
 limitations=['Hoist structural model only, not a working motor/gameplay transport',
 'Discrete rays not true swept player/cargo capsule','Historic city facades aggregate excluded',
 'All city retaining wall gaps and all access routes not audited'])
(root/'royal-replacement-3d-qa.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print('ROYAL_REPLACEMENT_QA',json.dumps({k:v for k,v in result.items()if k not in ('floorExamples','personExamples','neighborExamples','limitations')}))
if hits:print('PERSON',hits[:20])
if supportFails:print('FLOORS',supportFails[:20])
if neighborHits:print('ADJACENT',neighborHits[:20])
