"""Real Blender royal castle QA: public gate-throne procession, torso/head
clearance including *all* relevant castle objects (not just new meshes),
floor continuity, world-plan invariant preservation.
"""
import bpy,math,json,pathlib,sys,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((root/'staged-castle-plan.json').read_text('utf8'))
before=json.loads((root/'plan.json').read_text('utf8'))
report=p['currentRoyalReform']
rid=report['entranceRouteId']
routes=[q for q in p['routes']if q['id']==rid]
if len(routes)!=1:raise RuntimeError('Royal axis route missing')
baseline={r['id']:r for r in before['routes']}
staged={r['id']:r for r in p['routes']}
preserved=all(staged.get(id)==route for id,route in baseline.items())
if not preserved or len(staged)!=len(baseline)+1:raise RuntimeError('Original route was changed or dropped')
names=[m['name']for m in p['meshes']]
if len(set(names))!=len(names):raise RuntimeError('Duplicate mesh names in plan')
hall=bpy.data.objects.get('b101_principal_throne_hall_block')
if hall is None or len(hall.data.polygons)<10:raise RuntimeError('Hollow palace failed')
objs=[]
floorobj=[]
for obj in bpy.data.objects:
 if obj.type!='MESH' or not obj.data.polygons:continue
 bounds=[obj.matrix_world@Vector(v) for v in obj.bound_box]
 x0,y0,z0=(min(v[i]for v in bounds)for i in range(3))
 x1,y1,z1=(max(v[i]for v in bounds)for i in range(3))
 if x1<283 or x0>297 or y1<965 or y0>1117:continue
 if z0>214 or z1<203:continue
 if obj.name in ('castle_ground','b101_royal_ceremony_court','b104_castle_outer_ground_extension') or obj.name=='current_royal_floor':
  floorobj.append(obj);continue
 if z1<=204.85:floorobj.append(obj);continue
 objs.append(obj)
def bvh(objs):
 v=[];f=[];owner=[]
 for ob in objs:
  k=len(v);v.extend([ob.matrix_world@x.co for x in ob.data.vertices])
  for face in ob.data.polygons:f.append([k+i for i in face.vertices]);owner.append(ob.name)
 return BVHTree.FromPolygons(v,f),owner,len(v),len(f)
obstacles,owners,nverts,nfaces=bvh(objs)
groundObjs=[bpy.data.objects[name]for name in ['castle_ground','b101_royal_ceremony_court','b104_castle_outer_ground_extension','current_royal_floor'] if bpy.data.objects.get(name)]
support,supportOwners,gv,gf=bvh(groundObjs)
hits=[];unsupported=[];rays=0;floorTests=0
r=routes[0]
for a,b in zip(r['points'],r['points'][1:]):
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 if L<.03:continue
 nx=-dy/L;ny=dx/L;N=max(1,math.ceil(L/1.05))
 for step in range(N):
  t=step/N;u=(step+1)/N
  x=a[0]+dx*t;y=a[1]+dy*t
  xx=a[0]+dx*u;yy=a[1]+dy*u
  for shift in (-2.0,-.9,0,.9,2.0):
   for h in (1.05,1.9):
    st=Vector((x+nx*shift,y+ny*shift,204+h))
    end=Vector((xx+nx*shift,yy+ny*shift,204+h))
    dr=end-st
    if dr.length<.001:continue
    hit,nrm,idx,d=obstacles.ray_cast(st,dr.normalized(),dr.length)
    rays+=1
    if hit is not None and .02<d<dr.length-.02:
     if len(hits)<100:hits.append(dict(mesh=owners[idx],coord=[round(q,2)for q in hit],y=round(y,1)))
   origin=Vector((x+nx*shift,y+ny*shift,205))
   hit,nrm,idx,d=support.ray_cast(origin,Vector((0,0,-1)),2)
   floorTests+=1
   if hit is None or abs(hit.z-204)>.65:
    if len(unsupported)<80:unsupported.append([round(x+nx*shift,2),round(y+ny*shift,2),round(hit.z,2)if hit is not None else None])
status='LOCAL_PASS' if not hits and not unsupported else 'FAIL'
result=dict(status=status,originalRoadsUnchanged=preserved,royalProcessionalCenterline=rid,
 hallFaces=len(hall.data.polygons),testedColliderMeshNames=[o.name for o in objs],
 obstaclesCount=len(objs),obstacleFaces=nfaces,casts=rays,rayCollisions=len(hits),
 floorSources=[ob.name for ob in groundObjs],floorSamples=floorTests,unsupported=len(unsupported),
 failures=hits,floorFailures=unsupported,
 importantLimitations=['No stairs to roof, NPC duty cycle, throne room interiors beyond basic geometry',
 'Ray casting centerline and shoulders, not continuous player capsule nor true game collision flags',
 'Exterior castle ring accessibility/door service and cart routes still pending'])
(root/'castle-procession-real-qa.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf8')
print('ROYAL_QA',json.dumps({k:v for k,v in result.items()if k not in ('failures','floorFailures','importantLimitations','testedColliderMeshNames','floorSources')}))
if hits:print('HITS',hits[:15])
if unsupported:print('UNSUPPORTED',unsupported[:15])
