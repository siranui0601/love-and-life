"""B107 local collision probes for three new cliff-support constructions.
Ray test is diagnostic and DOES NOT certify player passage.
"""
import bpy,math,json,pathlib,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((out/'plan.json').read_text())
new=set(p['retainingClosureB107']['newMeshes'])
verts=[];faces=[];owner=[]
for obj in bpy.data.objects:
 if obj.name not in new or obj.type!='MESH':continue
 k=len(verts)
 verts.extend([obj.matrix_world@v.co for v in obj.data.vertices])
 for f in obj.data.polygons:
  faces.append([k+i for i in f.vertices]);owner.append(obj.name)
bvh=BVHTree.FromPolygons(verts,faces)
hits=[];probes=0;checked=set()
for r in p['routes']:
 if r['z0'] not in (42,78,112) and r['z1'] not in(42,78,112):continue
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];ln=math.hypot(dx,dy)
  if ln<.02:continue
  N=max(1,math.ceil(ln/3))
  nx=-dy/ln;ny=dx/ln
  for i in range(N):
   x=a[0]+dx*i/N;y=a[1]+dy*i/N
   xx=a[0]+dx*(i+1)/N;yy=a[1]+dy*(i+1)/N
   for w in (-min(1.25,r['width']*.26),0,min(1.25,r['width']*.26)):
    for z in [1.25,1.85]:
     h0=a[2]+(b[2]-a[2])*i/N+z
     h1=a[2]+(b[2]-a[2])*(i+1)/N+z
     aa=Vector((x+nx*w,y+ny*w,h0));bb=Vector((xx+nx*w,yy+ny*w,h1))
     v=bb-aa
     point,norm,idx,dist=bvh.ray_cast(aa,v.normalized(),v.length)
     probes+=1
     if point is not None and .01<dist<v.length-.01:
      checked.add(r['id'])
      hits.append(dict(route=r['id'],mesh=owner[idx],point=[round(q,2)for q in point]))
report=dict(status='LOCAL_PASS'if not hits else 'FAIL',
  obstructionCount=len(hits),probeCount=probes,affectedRoutes=sorted(checked),
  hits=hits[:65],limitations=['Discrete single line ray not capsule', 'Parapet and shell limited to B107',
                               'Does not include existing buildings','No actor simulation'])
(out/'retaining-route-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items()if k in ('status','obstructionCount','probeCount','affectedRoutes')}))
