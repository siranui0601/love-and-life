import bpy,math,json,pathlib,bmesh,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
P=json.loads((root/'user-p0-12-gaps-eastrock-b-20261012.staged.plan.json').read_text('utf8'))
names=['repair_user_p0_'+tag+'_retaining_20261012'for tag in ('W01','W02','W03','W04')]
names.append('repair_user_p0_F05_east_rock_taper_B')
coords=[(-127.198,914.99),(552.002,878.49),(355.702,1226.39),(1175.8,492.69),(353.602,960.79)]
v=[];f=[];owners=[]
for name in names:
 ob=bpy.data.objects[name]
 bm=bmesh.new();bm.from_mesh(ob.data)
 nm=sum(not e.is_manifold for e in bm.edges);bound=sum(e.is_boundary for e in bm.edges)
 assert nm==0,(name,nm,bound)
 bm.free()
 base=len(v)
 v.extend([ob.matrix_world @ a.co for a in ob.data.vertices])
 for face in ob.data.polygons:
  f.append([base+i for i in face.vertices]);owners.append(name)
tree=BVHTree.FromPolygons(v,f)
probes=0;hits=[];nroute=0
for route in P['routes']:
 pts=route['points'];W=route.get('width') or 3
 if not any(min(math.hypot(q[0]-x,q[1]-y)for x,y in coords)<100 for q in pts):continue
 nroute+=1
 for a,b in zip(pts,pts[1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  if L<1e-6:continue
  count=max(1,math.ceil(L/1.5))
  nx=-dy/L;ny=dx/L
  for j in range(count):
   t=(j+.5)/count
   cx=a[0]+dx*t;cy=a[1]+dy*t;cz=a[2]+(b[2]-a[2])*t
   if min(math.hypot(cx-x,cy-y)for x,y in coords)>65:continue
   for lat in (-.42*W,0,.42*W):
    for high in (.25,1.1,2.05):
     point=Vector((cx+nx*lat,cy+ny*lat,cz+high))
     q,n,i,dist=tree.find_nearest(point,1.35)
     probes+=1
     if q is not None and dist<.70:
      if len(hits)<60:hits.append(dict(route=route['id'],wall=owners[i],
       point=[round(z,2)for z in point],dist=round(dist,2)))
out=dict(candidateCount=len(hits),sampleCount=probes,routeCount=nroute,hits=hits,
limitations='Discrete snapshots not swept capsule or navmesh; 0 candidates is not complete walkability')
(root/'user-p0-12-gaps-eastrock-b-allwall-clearance.json').write_text(json.dumps(out,indent=2),encoding='utf8')
print('WALL_COLLISION',out,flush=True)
