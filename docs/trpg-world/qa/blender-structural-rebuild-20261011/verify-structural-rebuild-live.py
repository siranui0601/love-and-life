import bpy,json,pathlib,collections,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
meta=p['structuralIntegrityPass20261011']
names=[x for x in meta['newMeshFaces'] if 'open_stairs' not in x]
verts=[];faces=[];src=[]
for name in names:
 ob=bpy.data.objects.get(name)
 if not ob:raise RuntimeError('Missing '+name)
 start=len(verts);verts.extend(ob.matrix_world@v.co for v in ob.data.vertices)
 for f in ob.data.polygons:
  faces.append([start+i for i in f.vertices]);src.append(name)
tree=BVHTree.FromPolygons(verts,faces)
near=[];count=0;byid=collections.Counter()
for r in p['routes']:
 for v in r['points'][::max(1,len(r['points'])//150)]:
  q=Vector((v[0],v[1],v[2]+1))
  loc,n,idx,dist=tree.find_nearest(q,2.0)
  count+=1
  if loc and dist<.94:
   byid[r['id']]+=1
   if len(near)<80:near.append(dict(route=r['id'],xyz=[round(x,1)for x in v],cliffMesh=src[idx],distance=round(dist,2)))
report=dict(status='CLEAR'if not near else'CENTERLINE_CONTACT_POSSIBLE',samples=count,
 countNear=sum(byid.values()),byRoute=dict(byid),nearExamples=near,limitations=['Static nearest surface only, no swept actor capsule or collision BVH physics'])
(root/'structural-rebuild-20261011.live-center-clearance.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('CLEARANCE',json.dumps({k:v for k,v in report.items()if k not in('nearExamples','limitations')}))
for n in near[:18]:print('COLLISION',n)
