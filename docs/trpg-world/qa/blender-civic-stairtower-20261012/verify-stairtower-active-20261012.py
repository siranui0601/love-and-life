import bpy,json,pathlib,collections,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
meta=p['civicStairTower20261012']
names=[x[0]for x in meta['newMeshes'] if not x[0].endswith('_road')]
vs=[];fs=[];src=[]
for name in names:
 ob=bpy.data.objects.get(name)
 if not ob:raise RuntimeError('Missing '+name)
 start=len(vs);vs.extend([ob.matrix_world@v.co for v in ob.data.vertices])
 for f in ob.data.polygons:fs.append([start+i for i in f.vertices]);src.append(name)
bvh=BVHTree.FromPolygons(vs,fs)
count=0;near=[];per=collections.Counter()
for r in p['routes']:
 if not any(math.hypot(v[0]-636,v[1]-664)<80 for v in r['points']):continue
 for v in r['points']:
  loc,n,idx,dist=bvh.find_nearest(Vector((v[0],v[1],v[2]+1.05)),2.3)
  count+=1
  if loc and dist<1.0:
   per[r['id']]+=1
   if len(near)<60:
    near.append(dict(route=r['id'],point=[round(t,2)for t in v],hit=src[idx],distance=round(dist,3)))
res=dict(status='CLEAR' if not per else 'POSSIBLE_CENTERLINE_CONTACT',tested=count,total=sum(per.values()),byRoute=dict(per),examples=near)
(root/'civic-stairtower-20261012.active-clearance.json').write_text(json.dumps(res,indent=2),encoding='utf8')
print('CLEARANCE',json.dumps({k:v for k,v in res.items()if k!='examples'}),flush=True)
for e in near[:20]:print('HIT',e,flush=True)
