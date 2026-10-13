"""Castle local all-route regression on moved defense towers and new architecture.
Assesses new and relocated meshes only, excluding unchanged baseline walls.
"""
import bpy,math,json,pathlib,sys,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((root/'staged-castle-plan.json').read_text())
names=set(p['currentRoyalReform']['batchedGeometry'])
names.update(n for n,dx,dy in p['currentRoyalReform']['relocatedCornerTowers'])
names.update(p['currentRoyalReform']['movedGateObjects'])
names.update(p['currentRoyalReform']['shiftedOffices'])
objlist=[]
for name in names:
 obj=bpy.data.objects.get(name)
 if obj is None:raise RuntimeError('Missing relocated/new object '+name)
 if obj.type!='MESH':continue
 if obj.name=='current_royal_floor' or obj.name.endswith('high_roof'):continue
 objlist.append(obj)
v=[];f=[];owner=[]
for ob in objlist:
 ix=len(v);v.extend([ob.matrix_world@q.co for q in ob.data.vertices])
 for face in ob.data.polygons:f.append([ix+i for i in face.vertices]);owner.append(ob.name)
bvh=BVHTree.FromPolygons(v,f)
hits=[];rays=0;roads=set()
for r in p['routes']:
 if len(r['points'])<2 or abs(r['z0']-204)>.1 or abs(r['z1']-204)>.1:continue
 if not any(95<q[0]<460 and 925<q[1]<1250 for q in r['points']):continue
 roads.add(r['id'])
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  if L<.05:continue
  nx=-dy/L;ny=dx/L;N=max(1,math.ceil(L/3))
  for i in range(N):
   x=a[0]+dx*i/N;y=a[1]+dy*i/N
   xx=a[0]+dx*(i+1)/N;yy=a[1]+dy*(i+1)/N
   if not(95<x<460 and 925<y<1250):continue
   for shoulder in (-min(r['width']*.25,1.4),0,min(r['width']*.25,1.4)):
    for h in (1.2,1.85):
     start=Vector((x+nx*shoulder,y+ny*shoulder,204+h))
     end=Vector((xx+nx*shoulder,yy+ny*shoulder,204+h))
     dv=end-start
     if dv.length<.001:continue
     point,n,idx,dist=bvh.ray_cast(start,dv.normalized(),dv.length)
     rays+=1
     if point is not None and .02<dist<dv.length-.02:
      if len(hits)<60:hits.append(dict(route=r['id'],mesh=owner[idx],pos=[round(a,2)for a in point]))
res=dict(status='LOCAL_PASS'if not hits else 'FAIL',
 scopedRoutes=len(roads),sampleRays=rays,relocatedAndNewObjects=len(objlist),collisions=len(hits),
 examples=hits,caveats=['3D rays not swept actor capsule','Does not include unchanged building meshes','Roof line and architectural visual quality review separately'])
(root/'castle-new-buildings-route-regression.json').write_text(json.dumps(res,indent=2))
print('CASTLE_REGRESSION',json.dumps({k:v for k,v in res.items()if k not in ('examples','caveats')}))
if hits:print('COLLISIONS',hits[:15])
