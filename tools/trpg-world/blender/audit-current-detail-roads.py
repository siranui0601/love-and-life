"""Regression QA on current in-place city .blend: all local access roads
near noble retaining structures, tested against newly installed masonry
& railing. Does not include old city meshes (checked separately).
"""
import bpy,json,math,pathlib,sys,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((root/'plan.json').read_text())
vv=[];ff=[];owners=[]
for ob in bpy.data.objects:
 if ob.type!='MESH' or not ob.name.startswith(('Current NobleRailing','CurrentRetaining')):continue
 k=len(vv)
 vv.extend([ob.matrix_world@v.co for v in ob.data.vertices])
 for poly in ob.data.polygons:
  ff.append([k+i for i in poly.vertices]);owners.append(ob.name)
tree=BVHTree.FromPolygons(vv,ff)
roads=[];rays=0;hits=[];counts=collections.Counter()
for r in p['routes']:
 if not (len(r['points'])>1 and min(r['z0'],r['z1'])<=80 and max(r['z0'],r['z1'])>=41):continue
 if not any(-938<q[0]<-510 and 480<q[1]<892 for q in r['points']):continue
 roads.append(r['id'])
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];ll=math.hypot(dx,dy)
  if ll<.03:continue
  nx=-dy/ll;ny=dx/ll
  N=max(1,math.ceil(ll/2.3))
  for i in range(N):
   t=i/N;u=(i+1)/N
   x=a[0]+dx*t;y=a[1]+dy*t;z=a[2]+(b[2]-a[2])*t
   X=a[0]+dx*u;Y=a[1]+dy*u;Z=a[2]+(b[2]-a[2])*u
   if not(-938<x<-510 and 480<y<892):continue
   for shoulder in (-min(r['width']*.21,1.1),0,min(r['width']*.21,1.1)):
    for h in (1.1,1.9):
     start=Vector((x+nx*shoulder,y+ny*shoulder,z+h))
     end=Vector((X+nx*shoulder,Y+ny*shoulder,Z+h))
     vec=end-start
     if vec.length<.001:continue
     loc,nrm,j,dist=tree.ray_cast(start,vec.normalized(),vec.length)
     rays+=1
     if loc is not None and .012<dist<vec.length-.012:
      counts[r['id']]+=1
      if len(hits)<80:hits.append(dict(route=r['id'],mesh=owners[j],at=[round(a,2)for a in loc]))
res=dict(status='PASS'if not counts else 'FAIL',routesNearNoble=len(roads),
 rays=rays,addedMeshes=len(set(owners)),collisions=sum(counts.values()),
 hitRoutes=counts.most_common(),examples=hits,
 caveats=['Discrete body/head ray, no swept capsule',
 'Current geometry only; baseline city obstructions checked separately',
 'Sampling on listed routes, no NPC or actual game pathfinding'])
(root/'current-new-details-road-clearance.json').write_text(json.dumps(res,indent=2),encoding='utf8')
print('CURRENT_DETAILS_QA',json.dumps({k:v for k,v in res.items()if k not in ('examples','caveats')}))
