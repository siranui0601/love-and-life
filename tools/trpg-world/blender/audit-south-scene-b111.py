"""B111 real scene local ray QA at human torso/head height against the newly
added buildings. Excludes planar plaza paving; does not certify pathfindability.
"""
import bpy,json,pathlib,math,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((out/'plan.json').read_text())
study=p['southernCityB111']
sites=[s['bbox']for s in study['areas']]
verts=[];faces=[];owners=[]
for ob in bpy.data.objects:
 if ob.type!='MESH' or not ob.name.startswith('b111_') or 'permeable_square' in ob.name:continue
 off=len(verts);verts.extend([ob.matrix_world@v.co for v in ob.data.vertices])
 for f in ob.data.polygons:faces.append([off+k for k in f.vertices]);owners.append(ob.name)
tree=BVHTree.FromPolygons(verts,faces)
hits=[];rays=0;routeCount=0
for route in p['routes']:
 if abs(route['z0']-14)>1 or abs(route['z1']-14)>1:continue
 v=route['points']
 if not v:continue
 if not any(any(s[0]-20<=q[0]<=s[2]+20 and s[1]-20<=q[1]<=s[3]+20 for s in sites) for q in v):continue
 routeCount+=1
 for a,b in zip(v,v[1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];ll=math.hypot(dx,dy)
  if ll<.01:continue
  N=max(1,math.ceil(ll/3))
  nx=-dy/ll;ny=dx/ll
  for i in range(N):
   x=a[0]+dx*i/N;y=a[1]+dy*i/N
   xx=a[0]+dx*(i+1)/N;yy=a[1]+dy*(i+1)/N
   if not any(s[0]-6<=x<=s[2]+6 and s[1]-6<=y<=s[3]+6 for s in sites):continue
   for shoulder in (-min(route['width']*.22,1.3),0,min(route['width']*.22,1.3)):
    for head in (1.2,1.85):
     origin=Vector((x+nx*shoulder,y+ny*shoulder,14+head))
     vec=Vector((xx-x,yy-y,0))
     if vec.length<=.001:continue
     hit,norm,idx,dist=tree.ray_cast(origin,vec.normalized(),vec.length)
     rays+=1
     if hit is not None and .02<dist<vec.length-.02:
      hits.append(dict(route=route['id'],object=owners[idx],pos=[round(z,1)for z in hit]))
report=dict(status='LOCAL_PASS'if not hits else 'FAIL',routesSampled=routeCount,rays=rays,obstructionCount=len(hits),
 examples=hits[:40],limitations=['Only B111 additions, no pre-existing obstacles','Ray not swept capsule','No actual character walk or foot traffic','No interactive storefronts'])
(out/'b111-scene-clearance.json').write_text(json.dumps(report,indent=2))
print('QA_B111',json.dumps({k:v for k,v in report.items()if k not in ('examples','limitations')}))
