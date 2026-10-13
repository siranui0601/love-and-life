import bpy,json,pathlib,math,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'loggia-mage-seam-20261012.v3.staged.plan.json').read_text('utf8'))
audit=plan['currentStructuralSeam20261012']
for n in audit['removedMeshNames']:
 if bpy.data.objects.get(n):raise RuntimeError('Removed object still exists '+n)
names=[n for n,vc,fc in audit['newMeshes'] if not n.endswith('ground_apron_20261012')]
vs=[];fs=[];source=[]
for name in names:
 obj=bpy.data.objects.get(name)
 if not obj:raise RuntimeError('Missing '+name)
 start=len(vs);vs.extend([obj.matrix_world @ v.co for v in obj.data.vertices])
 for f in obj.data.polygons:fs.append([start+i for i in f.vertices]);source.append(name)
tree=BVHTree.FromPolygons(vs,fs)
cnt=0;hits=[];byroute=collections.Counter()
for r in plan['routes']:
 if not any((570<v[0]<730 and 740<v[1]<860) or (1040<v[0]<1390 and 365<v[1]<575) for v in r['points']):continue
 for v in r['points']:
  if not ((570<v[0]<730 and 740<v[1]<860) or (1040<v[0]<1390 and 365<v[1]<575)):continue
  origin=Vector((v[0],v[1],v[2]+1.08))
  loc,n,face,dist=tree.find_nearest(origin,1.15)
  cnt+=1
  if loc is not None and dist<1.02:
   byroute[r['id']]+=1
   if len(hits)<45:hits.append({'route':r['id'],'xyZ':[round(x,2)for x in v],'mesh':source[face],'distance':round(dist,3)})
report=dict(status='CLEAR'if not byroute else 'COLLISION_NEAR_ROUTE_CENTER',sampled=cnt,collisions=sum(byroute.values()),byRoute=dict(byroute),examples=hits)
(root/'loggia-mage-seam-20261012.v3-clearance.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('ROUTE_CENTER_CLEARANCE',json.dumps({k:v for k,v in report.items() if k!='examples'}),flush=True)
for item in hits[:20]:print('HIT',item,flush=True)
