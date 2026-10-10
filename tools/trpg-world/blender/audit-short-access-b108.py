"""Discrete B108 stairs clearance/support QA; no false gameplay certification."""
import bpy,json,pathlib,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((out/'plan.json').read_text())
route=p['shortRoyalAccessB108']['newRoute']
def build(names):
 vv=[];ff=[];owner=[]
 for ob in bpy.data.objects:
  if ob.type!='MESH' or ob.name not in names:continue
  ofs=len(vv);vv.extend([ob.matrix_world@v.co for v in ob.data.vertices])
  for f in ob.data.polygons:ff.append([ofs+i for i in f.vertices]);owner.append(ob.name)
 return BVHTree.FromPolygons(vv,ff),owner
extras=set(p['shortRoyalAccessB108']['newMeshNames'])
wall={'b107_upper_city_retaining_reconstruction','b107_upper_city_upper_guard_parapet'}
obstacles={n for n in extras if not n.endswith(('_integrated_treads','_natural_rock_backing'))}|wall
support={n for n in extras if n.endswith(('_integrated_treads','_natural_rock_backing')) or '_belvedere_' in n or 'platform' in n}
blocktree,owners=build(obstacles)
floortree,fowners=build(support)
hits=[];floors=[];casts=0;floorcasts=0
pts=route['points']
for a,b in zip(pts,pts[1:]):
 dx=b[0]-a[0];dy=b[1]-a[1];l=math.hypot(dx,dy)
 if l<1e-5:continue
 nx=-dy/l;ny=dx/l
 for w in (-1.3,0,1.3):
  for height in [1.05,1.8]:
   start=Vector((a[0]+nx*w,a[1]+ny*w,a[2]+height))
   end=Vector((b[0]+nx*w,b[1]+ny*w,b[2]+height))
   diff=end-start
   hit,n,idx,dist=blocktree.ray_cast(start,diff.normalized(),diff.length)
   casts+=1
   if hit is not None and .004<dist<diff.length-.004:
    hits.append(dict(obstacle=owners[idx],at=[round(x,2)for x in hit]))
  if abs(a[2]-42)<.01 or abs(a[2]-112)<.01:continue
  floorcasts+=1
  hit,n,idx,dist=floortree.ray_cast(Vector((a[0]+nx*w,a[1]+ny*w,a[2]+.65)),Vector((0,0,-1)),1.3)
  if hit is None or abs(hit.z-a[2])>.35:
   floors.append(dict(at=[round(a[0]+nx*w,1),round(a[1]+ny*w,1),round(a[2],1)],support=owners[idx]if False else None))
report=dict(status='LOCAL_PASS'if not hits and not floors else 'FAIL',
 route='royal_civic_short_stone_stairs',rays=casts,obstructions=len(hits),
 floorSamples=floorcasts,unsupported=len(floors),examples=hits[:20],floorExamples=floors[:20],
 limitations=['Only B108 and nearby new B107 surfaces','No continuity/capsule test','No manual walk or 415-step endurance test'])
(out/'short-access-mesh-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items()if k in ('status','rays','obstructions','floorSamples','unsupported')}))
