import bpy,json,pathlib,math,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'royal-forecourt-east-ascent-20261012.staged.plan.json').read_text('utf8'))
meta=p['royalEastAscentSeam20261012']
names=[a[0]for a in meta['newMeshes'] if 'apron' not in a[0]]
v=[];f=[];src=[]
for name in names:
 ob=bpy.data.objects.get(name)
 if ob is None:raise RuntimeError('Missing '+name)
 base=len(v);v.extend([ob.matrix_world@x.co for x in ob.data.vertices])
 for face in ob.data.polygons:
  f.append([base+i for i in face.vertices]);src.append(name)
bvh=BVHTree.FromPolygons(v,f)
tested=0;hits=[]
targetIds=['current_castle_east_stone_stairs','current_castle_east_winch_ramp','castle_east_ramp_landing_0','castle_east_ramp_landing_1','current_castle_east_overlook_1','current_castle_east_overlook_2']
routes={r['id']:r for r in p['routes']}
for ident in targetIds:
 r=routes[ident]
 for aa,bb in zip(r['points'],r['points'][1:]):
  dx=bb[0]-aa[0];dy=bb[1]-aa[1];dist=math.hypot(dx,dy)
  if dist<.01:continue
  nx=-dy/dist;ny=dx/dist
  N=max(1,math.ceil(dist/1))
  for j in range(N):
   t=(j+.5)/N
   x=aa[0]+t*dx;y=aa[1]+t*dy;z=aa[2]+t*(bb[2]-aa[2])
   for offset in (-r['width']*.31,0,r['width']*.31):
    for h in(.45,1.1,1.9):
     start=Vector((x+nx*offset,y+ny*offset,z+h));point,norm,idx,gap=bvh.find_nearest(start,1.0)
     tested+=1
     if point is not None and gap<.68:
      if len(hits)<50:hits.append(dict(route=ident,xyz=(round(x,2),round(y,2),round(z+h,2)),part=src[idx],distance=round(gap,2)))
# all new wall/pier bodies are evaluated, but ground apron is a floor, not a blocker.
print('EAST_ASSEMBLY_BODY_SWEEP',tested,'HITS',len(hits),flush=True)
for a in hits[:30]:print('BODY_HIT',a,flush=True)
out=dict(status='PASS'if not hits else 'POTENTIAL_PATH_BLOCK',tested=tested,
 collisions=len(hits),examples=hits,newMeshCount=len(names),
 untouchedRoutes=all(any(r['id']==orig['id'] and r==orig for r in p['routes']) for orig in
 json.loads((root/'plan.json').read_text('utf8'))['routes']),
 limitations='Discrete 3-point shoulder and body-height static nearest-point scan, NOT player capsule runtime')
(root/'east-royal-ascent-20261012.clearance.json').write_text(json.dumps(out,indent=2),encoding='utf8')
print('RESULT',json.dumps({k:v for k,v in out.items()if k!='examples'}),flush=True)
