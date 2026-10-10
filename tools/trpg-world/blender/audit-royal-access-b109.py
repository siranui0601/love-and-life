import bpy,json,pathlib,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=pathlib.Path(sys.argv[sys.argv.index('--')+1]);p=json.loads((out/'plan.json').read_text())
route=p['shortRoyalAccessB108']['newRoute'];st=p['reformedRoyalAccessB109']
def tree_for(names):
 v=[];f=[];owner=[]
 for obj in bpy.data.objects:
  if obj.type!='MESH' or obj.name not in names:continue
  base=len(v);v.extend([obj.matrix_world@q.co for q in obj.data.vertices])
  for face in obj.data.polygons:
   f.append([base+i for i in face.vertices]);owner.append(obj.name)
 return BVHTree.FromPolygons(v,f),owner
old=set(p['shortRoyalAccessB108']['newMeshNames'])-set(st['deletedMeshes'])
new=set(st['newMeshes']);walls={'b107_upper_city_retaining_reconstruction','b107_upper_city_upper_guard_parapet'}
support={n for n in old|new if any(s in n for s in ['integrated_treads','rock_backing','continuous_rockcut_stair_spine','stair_turn_land','overlook_','_platform']) and 'parapet' not in n and 'stone_pier' not in n and 'guide' not in n}
# A few old hoist components never support the pedestrian staircase; exclude from rays only if removed in architecture pass.
block=(old|new|walls)-support
obstacles,owners=tree_for(block)
floors,fowners=tree_for(support)
hits=[];unsupported=[];rays=0;samples=0
for a,b in zip(route['points'],route['points'][1:]):
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 if L<.005:continue
 nx=-dy/L;ny=dx/L
 for w in (-1.1,0,1.1):
  for height in (1.05,1.8):
   st=Vector((a[0]+nx*w,a[1]+ny*w,a[2]+height))
   en=Vector((b[0]+nx*w,b[1]+ny*w,b[2]+height))
   vec=en-st
   if vec.length==0:continue
   loc,norm,idx,dist=obstacles.ray_cast(st,vec.normalized(),vec.length)
   rays+=1
   if loc is not None and .004<dist<vec.length-.004:
    hits.append(dict(mesh=owners[idx],at=[round(float(z),2)for z in loc]))
  if a[2]<=42.2 or a[2]>=111.8:continue
  samples+=1
  origin=Vector((a[0]+nx*w,a[1]+ny*w,a[2]+.65))
  loc,norm,idx,dist=floors.ray_cast(origin,Vector((0,0,-1)),1.25)
  if loc is None or abs(loc.z-a[2])>.3:
   unsupported.append([round(a[0]+nx*w,1),round(a[1]+ny*w,1),round(a[2],2)])
report=dict(status='FAIL'if hits or unsupported else 'LOCAL_PASS',rays=rays,obstructions=len(hits),floorSamples=samples,unsupported=len(unsupported),
  hitExamples=hits[:50],unsupportedExamples=unsupported[:50],
  limits=['local geometry only','discrete rays are not swept capsule','hoist not functional','visual integration is not certified'])
(out/'b109-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('QA_RESULT',json.dumps({k:v for k,v in report.items()if k not in ('hitExamples','unsupportedExamples','limits')}))
