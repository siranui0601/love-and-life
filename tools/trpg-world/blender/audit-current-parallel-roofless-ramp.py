"""Route/old-street 3D Blender QA: open roofless cargo ramp.
No acceptance of unassisted carts on 31° grade or game physics.
"""
import bpy,math,json,pathlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'roofless-ramp-r7-plan.staged.json').read_text('utf8'))
prior=json.loads((root/'plan.json').read_text('utf8'))
s=p['currentRooflessCartIncline']
new=s['meshes']
curr={r['id']:r for r in p['routes']}
existing={r['id']:r for r in prior['routes']}
if not all(curr.get(id)==route for id,route in existing.items()):raise RuntimeError('Old routes changed')
route=curr[s['routeID']]
def BVH(objs):
 v=[];f=[];names=[]
 for obj in objs:
  k=len(v);v.extend([obj.matrix_world@i.co for i in obj.data.vertices])
  for face in obj.data.polygons:
   f.append([k+j for j in face.vertices]);names.append(obj.name)
 if not f:raise RuntimeError('Empty BVH')
 return BVHTree.FromPolygons(v,f),names
rampDeck=bpy.data.objects.get('current_civic_parallel_roofless_ramp_deck')
if not rampDeck:raise RuntimeError('Missing actual deck')
floors=[rampDeck]+[bpy.data.objects[x]for x in ['civic_foot_ground','upper_city_ground','current_civic_upper_short_bridge','current_civic_upper_short_stair']if bpy.data.objects.get(x)]
floors += [ob for ob in bpy.data.objects if ob.name.startswith('wall_gallery_civic_wall_gallery_lower_')and ob.name.endswith('_floor')]
floorTree,fnames=BVH(floors)
oldObjects=[]
for ob in bpy.data.objects:
 if ob.type!='MESH' or not ob.data.polygons or ob.name in new or ob in floors:continue
 if ob.name in ['Parcels - street frontage first','District facade openings','Frontage entrance doors - visual only']:continue
 bb=[ob.matrix_world@Vector(v)for v in ob.bound_box]
 lo=[min(q[i]for q in bb)for i in range(3)];hi=[max(q[i]for q in bb)for i in range(3)]
 if hi[0]<570 or lo[0]>660 or hi[1]<623 or lo[1]>710 or hi[2]<43 or lo[2]>115:continue
 if any(w in ob.name.lower()for w in ('ground','_floor','road','contour','paving')):continue
 oldObjects.append(ob)
newOb=[bpy.data.objects[n]for n in new if n!=rampDeck.name]
obst,owner=BVH(oldObjects+newOb)
floorFails=[];hits=[];supportTests=0;casts=0
for a,b in zip(route['points'],route['points'][1:]):
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 if L<.002:continue
 nx=-dy/L;ny=dx/L;N=max(1,math.ceil(L/1.0))
 for i in range(N):
  t=(i+.28)/N;u=(i+.72)/N
  x=a[0]+dx*t;y=a[1]+dy*t;z=a[2]+(b[2]-a[2])*t
  xx=a[0]+dx*u;yy=a[1]+dy*u;zz=a[2]+(b[2]-a[2])*u
  for sh in (-.9,0,.9):
   st=Vector((x+nx*sh,y+ny*sh,z+1.0))
   hit,n,idx,dist=floorTree.ray_cast(st,Vector((0,0,-1)),2.0)
   supportTests+=1
   if hit is None or abs(hit.z-z)>.50:
    if len(floorFails)<45:floorFails.append([round(x,2),round(y,2),round(z,2),None if hit is None else round(hit.z,2)])
   for h in (1.05,1.85):
    beg=Vector((x+nx*sh,y+ny*sh,z+h))
    end=Vector((xx+nx*sh,yy+ny*sh,zz+h))
    dr=end-beg
    if dr.length<.002:continue
    hit,n,idx,dist=obst.ray_cast(beg,dr.normalized(),dr.length)
    casts+=1
    if hit is not None and .02<dist<dr.length-.02:
     if len(hits)<50:hits.append([owner[idx],round(x,2),round(y,2),round(z,2)])
# existing routes must not be blocked by ramp props (new masonry/curbs).
existingHits=[];rays=0
newBvh,newNames=BVH(newOb)
for r in prior['routes']:
 if r['z0']!=r['z1'] or r['z0']not in(42,112) or len(r['points'])<2:continue
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  if L<.05:continue
  N=max(1,math.ceil(L/3))
  for j in range(N):
   t=j/N;u=(j+1)/N;x=a[0]+dx*t;y=a[1]+dy*t
   if not(570<x<665 and 620<y<714):continue
   X=a[0]+dx*u;Y=a[1]+dy*u
   for h in(1.1,1.9):
    start=Vector((x,y,r['z0']+h));end=Vector((X,Y,r['z0']+h))
    v=end-start
    if v.length<.001:continue
    hit,n,idx,d=newBvh.ray_cast(start,v.normalized(),v.length)
    rays+=1
    if hit is not None and .02<d<v.length-.02:
     if len(existingHits)<50:existingHits.append([r['id'],newNames[idx],round(x,1),round(y,1)])
result=dict(status='LOCAL_PASS'if not floorFails and not hits and not existingHits else 'FAIL',
 routeLengthM=route['lengthM'],maxGrade=s['grade'],roofless=True,stairPreserved=True,
 floorTests=supportTests,floorMissing=floorFails,
 bodyHeadRayTests=casts,routeBlockers=hits,preexistingRouteTests=rays,preexistingRoadBlockers=existingHits,
 obstacleMeshesTested=len(oldObjects),
 limitations=['31° ramp only winch-assisted cart concept; no physical cart load simulation',
 'No pedestrian wheelchair-accessible 5% route','Curb/landing turns require swept cart body and NPC testing'])
(root/'roofless-ramp-3d-qa.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print('ROOFLESS_RAMP_QA',json.dumps({k:v for k,v in result.items()if k not in('floorMissing','routeBlockers','preexistingRoadBlockers','limitations')}))
if floorFails:print('MISSING',floorFails[:12])
if hits:print('HITS',hits[:12])
if existingHits:print('ROAD_BLOCK',existingHits[:12])
