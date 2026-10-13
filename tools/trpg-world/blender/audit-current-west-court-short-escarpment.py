"""West court short ascent local Blender QA. Fails on real floor, new
obstacle intrusion, existing street blocking, or unexpected old route
mutation. Stage does not override current until visual review.
"""
import bpy,json,pathlib,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'west-court-short-plan-v5.staged.json').read_text('utf8'))
old=json.loads((root/'plan.json').read_text('utf8'))
info=p['currentWestCourtShortEscarpment']
before={r['id']:r for r in old['routes']}
now={r['id']:r for r in p['routes']}
expected=(set(before)-set(info['removedRoutes']))|set(info['newRoutes'])
if set(now)!=expected:raise RuntimeError('Unexpected route graph mutation')
if any(now[id]!=obj for id,obj in before.items() if id not in info['removedRoutes']):
 raise RuntimeError('Unexpected existing route modifications')
def bvh(objs):
 vv=[];faces=[];names=[]
 for ob in objs:
  if ob is None or ob.type!='MESH':continue
  j=len(vv)
  vv.extend([ob.matrix_world@v.co for v in ob.data.vertices])
  for face in ob.data.polygons:
   faces.append([j+i for i in face.vertices])
   names.append(ob.name)
 if not faces:raise RuntimeError('No faces for BVH')
 return BVHTree.FromPolygons(vv,faces),names
newNames=info['newMeshes']
newObjs=[bpy.data.objects.get(n)for n in newNames]
if any(x is None for x in newObjs):raise RuntimeError('Missing new mesh')
floorObjects=[bpy.data.objects.get(n)for n in [
 'upper_city_ground','forecourt_ground','upper_city_contour_1','forecourt_contour_1']]
floorObjects += [o for o in newObjs if o.name.endswith(('_stair','_limestone','_masonry'))]
# Add pre-existing road surfaces without hundreds of scattered irrelevant
# decorative meshes.
floorObjects += [o for o in bpy.data.objects if o.type=='MESH' and
 (o.name.startswith('wall_gallery_court_west_ramp_') and o.name.endswith('_floor'))]
floor,fNames=bvh(floorObjects)
oldObs=[]
for ob in bpy.data.objects:
 if ob.type!='MESH' or not ob.data.polygons or ob.name in newNames or ob in floorObjects:continue
 if ob.name in ('Parcels - street frontage first','District facade openings','Frontage entrance doors - visual only'):continue
 nm=ob.name.lower()
 if any(q in nm for q in ('_ground','_floor','road','contour','paving','_landing')):continue
 bound=[ob.matrix_world@Vector(q) for q in ob.bound_box]
 low=[min(v[j] for v in bound)for j in range(3)]
 high=[max(v[j]for v in bound)for j in range(3)]
 if low[0]>-77 or high[0]<-183 or low[1]>1005 or high[1]<948 or low[2]>161 or high[2]<112.6:continue
 oldObs.append(ob)
newObstacles=[o for o in newObjs if o.name.endswith(('_parapet','_gold','_gate_stone','_gate_slate','_banner'))]
blocker,bNames=bvh(oldObs+newObstacles)
newBlocker,newBNames=bvh(newObstacles+[o for o in newObjs if o.name.endswith('_masonry')])
routes=info['newRoutes'][:]
existing=[]
for r in old['routes']:
 if r['id'] in info['removedRoutes'] or r['z0']!=r['z1'] or r['z0'] not in (112,156):continue
 if any(-187<v[0]<-80 and 947<v[1]<1005 for v in r['points']):
  existing.append(r['id'])
routes.extend(existing)
fail=[];hit=[];oldblocked=[];oldFloor=[];n=0;k=0;nOld=0
for id in routes:
 r=now[id]
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  if L<.02:continue
  nx=-dy/L;ny=dx/L
  count=max(1,math.ceil(L/1.2))
  for i in range(count):
   t=(i+.25)/count;u=(i+.75)/count
   x=a[0]+dx*t;y=a[1]+dy*t
   X=a[0]+dx*u;Y=a[1]+dy*u
   if not(-184<x<-80 and 946<y<1008):continue
   z=a[2]+(b[2]-a[2])*t;Z=a[2]+(b[2]-a[2])*u
   for sh in (-.67,0,.67):
    q=Vector((x+nx*sh,y+ny*sh,z+1.45))
    h,nm,idx,dist=floor.ray_cast(q,Vector((0,0,-1)),2.05)
    n+=1
    if h is None or abs(h.z-z)>.48:
     bad=[id,round(x,2),round(y,2),round(z,2),None if h is None else round(h.z,2)]
     target=fail if id in info['newRoutes'] else oldFloor
     if len(target)<35:target.append(bad)
    for height in (1.05,1.85):
     origin=Vector((x+nx*sh,y+ny*sh,z+height))
     end=Vector((X+nx*sh,Y+ny*sh,Z+height))
     v=end-origin
     if v.length<.005:continue
     q,nm,idx,dd=blocker.ray_cast(origin,v.normalized(),v.length)
     k+=1
     if q is not None and .015<dd<v.length-.015:
      bad=[id,bNames[idx],round(x,2),round(y,2),round(z,2)]
      target=hit if id in info['newRoutes'] else oldblocked
      if len(target)<35:target.append(bad)
# New physical retaining sections must NOT invade any pre-existing
# contour street, rather than treating only decorative railings as hits.
for id in existing:
 r=now[id]
 for a,b in zip(r['points'],r['points'][1:]):
  L=math.hypot(b[0]-a[0],b[1]-a[1])
  if L<.01:continue
  step=max(1,math.ceil(L/1.5))
  for i in range(step):
   t=(i+.25)/step;u=(i+.75)/step
   xx=a[0]+(b[0]-a[0])*t;yy=a[1]+(b[1]-a[1])*t
   XX=a[0]+(b[0]-a[0])*u;YY=a[1]+(b[1]-a[1])*u
   if not(-184<xx<-80 and 946<yy<1008):continue
   start=Vector((xx,yy,r['z0']+1.3));stop=Vector((XX,YY,r['z0']+1.3))
   v=stop-start
   if v.length<.005:continue
   q,nm,idx,d=newBlocker.ray_cast(start,v.normalized(),v.length)
   nOld+=1
   if q is not None and .012<d<v.length-.012:
    if len(oldblocked)<40:oldblocked.append([id,newBNames[idx],round(xx,2),round(yy,2),'foundation'])
report=dict(status='LOCAL_PASS'if not(fail or hit or oldblocked)else'FAIL',
 oldLengthM=info['previousRampM'],
 newStairLengthM=now[info['newRoutes'][0]]['lengthM'],
 newInclineLengthM=now[info['newRoutes'][1]]['lengthM'],
 oldRoadRoutesRemoved=len(info['removedRoutes']),
 newRoutesAdded=len(info['newRoutes']),
 oldRoadsUnchanged=True,
 floorProbes=n,newRouteMissingFloor=fail,existingRoadFloorAdvisory=oldFloor,
 bodyHeadRays=k,newRouteObstacles=hit,
 existingStreetBlockedByNew=oldblocked,existingStreetExtraRays=nOld,
 actualExistingObstacleMeshes=len(oldObs),
 notes=['Point/ray floor test, not full vehicle swept path or physically feasible 30 degree cart',
 'Artistic acceptance and level-design interest require image review',
 'Other citywide wall/floor holes and other ramps remain incomplete'])
(root/'west-court-short-local-qa.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('WEST_COURT_SHORT_QA',json.dumps({k:v for k,v in report.items() if k not in('newRouteMissingFloor','existingRoadFloorAdvisory','newRouteObstacles','existingStreetBlockedByNew','notes')}))
if fail:print('NEW_FLOOR_FAILS',fail[:13])
if hit:print('NEW_OBSTACLES',hit[:13])
if oldblocked:print('OLD_ROAD_INTRUSIONS',oldblocked[:13])
if oldFloor:print('OLD_FLOOR_ADVISORY',oldFloor[:7])
