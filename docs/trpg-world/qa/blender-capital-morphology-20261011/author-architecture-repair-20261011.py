import json,pathlib,hashlib,collections,math
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
raw=(root/'plan.json').read_bytes();plan=json.loads(raw)
prefixes=('wall_gallery_north_old_trench_fill_','wall_gallery_north_court_wall_stairs_','mage_quarter_mage_wall_short_stairs_floor_','mage_quarter_mage_wall_short_stairs_parapet_')
buckets={x:[m for m in plan['meshes'] if m['name'].startswith(x)]for x in prefixes}
expected=[286,283,362,362]
counts=[len(buckets[x])for x in prefixes]
if counts!=expected:raise RuntimeError('Unexpected original stair geometry count '+str(counts))
def combined(name,src,material):
 verts=[];faces=[]
 for obj in src:
  base=len(verts);verts.extend(obj['vertices']);faces.extend([[base+i for i in face]for face in obj['faces']])
 return dict(name=name,vertices=verts,faces=faces,material=material)
north=sorted(buckets[prefixes[1]],key=lambda a:int(a['name'].split('_')[-2]))
mage=sorted(buckets[prefixes[2]],key=lambda a:int(a['name'].split('_')[-1]))
print('ORIGINAL_SAMPLE',north[0].get('material'),mage[0].get('material'),buckets[prefixes[3]][0].get('material'))
merged=[combined('current_north_gallery_stair_unified_stone_treads',north,north[0].get('material','stone')),
        combined('current_mage_wall_stair_unified_stone_treads',mage,mage[0].get('material','stone'))]
pv=[];pf=[]
def stone_strip(a,b,z0,z1,w=.32):
 dx=b[0]-a[0];dy=b[1]-a[1]; length=math.hypot(dx,dy)
 if length<.0001:return
 nx=-dy/length*w/2;ny=dx/length*w/2
 vertices=[[a[0]+nx,a[1]+ny,z0-.55],[b[0]+nx,b[1]+ny,z1-.55],[b[0]-nx,b[1]-ny,z1-.55],[a[0]-nx,a[1]-ny,z0-.55],
  [a[0]+nx,a[1]+ny,z0+1.27],[b[0]+nx,b[1]+ny,z1+1.27],[b[0]-nx,b[1]-ny,z1+1.27],[a[0]-nx,a[1]-ny,z0+1.27]]
 start=len(pv);pv.extend(vertices)
 for face in ([0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]):pf.append([start+i for i in face])
for o in mage:
 v=o['vertices'];a=v[3];b=v[2];z=max(q[2]for q in v)
 stone_strip(a,b,z,z)
merged.append(dict(name='current_mage_wall_stair_continuous_cliff_parapet',vertices=pv,faces=pf,material='stone'))
plan['meshes']=[m for m in plan['meshes']if not any(m['name'].startswith(prefix)for prefix in prefixes)]+merged
meta=dict(status='STAGED_PENDING_3D_QA',originalPlanSha256=hashlib.sha256(raw).hexdigest(),
  removed=dict(zip(prefixes,counts)),added=[(m['name'],len(m['faces']))for m in merged],
  preservedRoutes=len(plan['routes']),note='Removed orphan old trench fill; consolidated two stepped floors and replaced fragile per-step mage wall parapets with continuous stone facade; all player routes remain unchanged')
plan['architectureRepair20261011']=meta
(root/'architecture-repair-20261011.staged.plan.json').write_text(json.dumps(plan,separators=(',',':')),encoding='utf8')
(root/'architecture-repair-20261011.study.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False),encoding='utf8')
print('STAGED',json.dumps(meta,ensure_ascii=False),flush=True)
