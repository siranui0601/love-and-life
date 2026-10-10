"""Validate staged real Blender floor patch and revived civic escarpment wall,
with 3D collision probes on all adjacent z14/z42 route segments.
"""
import bpy,math,json,pathlib,sys,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((root/'staged-ground-plan.json').read_text())
wall=bpy.data.objects.get('current_civic_restored_exposed_cliff_support')
upper=bpy.data.objects.get('upper_city_ground')
if not wall or not upper:raise RuntimeError('Staged meshes absent')
wm=wall.data;fm=upper.data
if len(wm.polygons)<20 or len(fm.polygons)<=3065:raise RuntimeError('Mesh replacement failed')
v=[wall.matrix_world@vert.co for vert in wm.vertices]
f=[list(face.vertices)for face in wm.polygons]
tree=BVHTree.FromPolygons(v,f)
hits=[];rays=0;routes=set()
for r in p['routes']:
 if len(r['points'])<2 or max(r['z0'],r['z1'])<11 or min(r['z0'],r['z1'])>48:continue
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  if L<.005:continue
  nx=-dy/L;ny=dx/L
  for i in range(max(1,math.ceil(L/2.5))):
   t=i/max(1,math.ceil(L/2.5));u=(i+1)/max(1,math.ceil(L/2.5))
   x=a[0]+dx*t;y=a[1]+dy*t;z=a[2]+(b[2]-a[2])*t
   if not(-915<x<-680 and 378<y<780):continue
   routes.add(r['id'])
   xx=a[0]+dx*u;yy=a[1]+dy*u;zz=a[2]+(b[2]-a[2])*u
   for shoulder in (-min(r['width']*.25,1.2),0,min(r['width']*.25,1.2)):
    for h in (1.15,1.9):
     origin=Vector((x+nx*shoulder,y+ny*shoulder,z+h))
     end=Vector((xx+nx*shoulder,yy+ny*shoulder,zz+h))
     vec=end-origin
     if vec.length<.001:continue
     point,normal,idx,dist=tree.ray_cast(origin,vec.normalized(),vec.length)
     rays+=1
     if point is not None and .015<dist<vec.length-.015:
      hits.append(dict(route=r['id'],at=[round(q,2)for q in point]))
# Exact new floor faces top z112 covered by downward rays at centroid locations.
mesh=next(q for q in p['meshes']if q['name']=='upper_city_ground')
newFaces=mesh['faces'][3065:]
floorBvh=BVHTree.FromPolygons([upper.matrix_world@v.co for v in upper.data.vertices],[list(q.vertices)for q in upper.data.polygons])
samples=0;fail=[]
for face in newFaces:
 coords=[mesh['vertices'][i]for i in face]
 ctr=[sum(q[j]for q in coords)/len(coords)for j in range(3)]
 if len(coords)<3:continue
 origin=Vector((ctr[0],ctr[1],114.5))
 point,normal,idx,dist=floorBvh.ray_cast(origin,Vector((0,0,-1)),4)
 samples+=1
 if point is None or abs(point.z-112)>.05:fail.append(ctr)
report=dict(status='LOCAL_PASS'if not hits and not fail else 'FAIL',wallRoadRaySamples=rays,wallIntersections=len(hits),sampledRouteCount=len(routes),
 wallHitExamples=hits[:25],upperGroundPatchSamples=samples,upperPatchFailedFloor=len(fail),
 upperPatchExamples=fail[:25],wallFaces=len(wm.polygons),floorFaces=len(fm.polygons),
 caveats=['Only added wall, not all prior structures','No continuous swept player collision',
 'Paving/wall visual integration and actual access need human review'])
(root/'pending-structural-3d-qa.json').write_text(json.dumps(report,indent=2))
print('PENDING_QA',json.dumps({k:v for k,v in report.items()if k not in ('wallHitExamples','upperPatchExamples','caveats')}))
