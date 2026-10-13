"""B114 baseline noble stair floor support diagnostic.
Use true Blender mesh instead of merely the plan route height.
"""
import bpy,math,json,pathlib,sys,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((out/'plan.json').read_text(encoding='utf8'))
ids=['noble_east_wall_stair','west_noble_wall_stairs','west_noble_wall_stairs_landing_0','west_noble_wall_stairs_landing_1']
routes=[r for r in p['routes']if r['id'] in ids]
building=[]
for ob in bpy.data.objects:
 if ob.type!='MESH':continue
 name=ob.name
 if name in ['civic_foot_ground','noble_west_ground'] or name.startswith(('b116_noble_east_wall_stair','b116_west_noble_wall_stairs','b116_east_noble_stair_entry_stone_landing','west_noble_wall_stairs')):
  building.append(ob)
vv=[];ff=[];owners=[]
for ob in building:
 k=len(vv)
 vv.extend([ob.matrix_world@vert.co for vert in ob.data.vertices])
 for face in ob.data.polygons:
  ff.append([k+j for j in face.vertices]);owners.append(ob.name)
bvh=BVHTree.FromPolygons(vv,ff)
fail=[];okay=collections.Counter();tested=collections.Counter()
for route in routes:
 for a,b in zip(route['points'],route['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  if L<.03:continue
  nx=-dy/L;ny=dx/L
  N=max(1,math.ceil(L/1.0))
  for i in range(N):
   t=i/N
   center=[a[j]+(b[j]-a[j])*t for j in range(3)]
   for off in (-min(route['width']*.28,1.0),0,min(route['width']*.28,1.0)):
    x=center[0]+nx*off;y=center[1]+ny*off;z=center[2]
    hit,n,idx,dist=bvh.ray_cast(Vector((x,y,z+.7)),Vector((0,0,-1)),2.0)
    tested[route['id']]+=1
    if hit is None or abs(hit.z-z)>.35:
     fail.append(dict(route=route['id'],at=[round(x,2),round(y,2),round(z,2)],down=None if hit is None else round(hit.z,2)))
    else:okay[route['id']]+=1
res=dict(status='PASS'if not fail else 'FAIL',routes=[r['id']for r in routes],
 supportMeshCount=len(building),samples=dict(tested),supported=dict(okay),
 unsupported=len(fail),examples=fail[:90],
 limitations=['Only route/ground support meshes included','No swept actor capsule','All buildings/railings not included'])
(out/'noble-stair-support-b116.json').write_text(json.dumps(res,indent=2),encoding='utf8')
print('B116_SUPPORT_QA',json.dumps({k:v for k,v in res.items()if k not in('examples','limitations')}))



