import bpy,json,pathlib,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
meta=p['royalForecourtWestSeam20261012']
names=[x[0]for x in meta['newMeshes'] if not 'apron' in x[0]]
verts=[];faces=[];source=[]
for name in names:
 ob=bpy.data.objects.get(name)
 if not ob:raise RuntimeError('Missing new mesh '+name)
 base=len(verts);verts.extend([ob.matrix_world@v.co for v in ob.data.vertices])
 for f in ob.data.polygons:
  faces.append([base+i for i in f.vertices]);source.append(name)
tree=BVHTree.FromPolygons(verts,faces)
hits=[];counts=collections.Counter();n=0
for r in p['routes']:
 for xyz in r['points']:
  if not(-150<xyz[0]<40 and 930<xyz[1]<1210):continue
  n+=1
  at=Vector((xyz[0],xyz[1],xyz[2]+1.0))
  q,norm,idx,dist=tree.find_nearest(at,1.05)
  if q is not None and dist<1.0:
   counts[r['id']]+=1
   if len(hits)<45:
    hits.append(dict(route=r['id'],xyz=[round(z,2)for z in xyz],mesh=source[idx],gap=round(dist,2)))
report=dict(status='CLEAR' if not counts else 'NEAR_CENTERLINE',sampled=n,total=sum(counts.values()),byRoute=dict(counts),examples=hits)
(root/'royal-forecourt-west-20261012.active-clearance.json').write_text(json.dumps(report,indent=2))
print('CLEARANCE',json.dumps({k:v for k,v in report.items()if k!='examples'}),flush=True)
for x in hits[:20]:print('HIT',x,flush=True)
