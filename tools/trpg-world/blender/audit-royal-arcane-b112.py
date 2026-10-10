"""B112 independent local 3D collision + semantic preservation checks."""
import bpy,json,pathlib,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
base=pathlib.Path(sys.argv[sys.argv.index('--')+2])
p=json.loads((out/'plan.json').read_text())
q=json.loads((base/'plan.json').read_text())
d=json.loads((out/'parcels.json').read_text())
e=json.loads((base/'parcels.json').read_text())
assert len(p['routes'])==len(q['routes']) and p['routes']==q['routes']
assert set((x['id'],x.get('canonicalFacilityId'))for x in d['parcels']if x.get('canonicalFacilityId'))==set((x['id'],x.get('canonicalFacilityId'))for x in e['parcels']if x.get('canonicalFacilityId'))
names=set(p['arcaneRoyalB112']['newMeshes'])
vv=[];ff=[];own=[]
for ob in bpy.data.objects:
 if ob.type!='MESH' or ob.name not in names or ob.name.endswith('_seal'):continue
 start=len(vv)
 vv.extend([ob.matrix_world@v.co for v in ob.data.vertices])
 for face in ob.data.polygons:ff.append([start+i for i in face.vertices]);own.append(ob.name)
tree=BVHTree.FromPolygons(vv,ff)
hits=[];rays=0;routes=0
for r in p['routes']:
 if abs(r['z0']-70)>.1 or abs(r['z1']-70)>.1:continue
 pts=r['points']
 if not any(965<a[0]<1160 and 550<a[1]<755 for a in pts):continue
 routes+=1
 for a,b in zip(pts,pts[1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];ln=math.hypot(dx,dy)
  if ln<.01:continue
  nx=-dy/ln;ny=dx/ln
  N=max(1,math.ceil(ln/2.8))
  for i in range(N):
   x=a[0]+dx*i/N;y=a[1]+dy*i/N
   if not 965<x<1160 or not 550<y<755:continue
   xx=a[0]+dx*(i+1)/N;yy=a[1]+dy*(i+1)/N
   for shoulder in (-min(r['width']*.26,1.1),0,min(r['width']*.26,1.1)):
    for height in (1.15,1.85):
     v0=Vector((x+nx*shoulder,y+ny*shoulder,70+height))
     v1=Vector((xx+nx*shoulder,yy+ny*shoulder,70+height))
     vec=v1-v0
     if vec.length<.01:continue
     at,norm,idx,dist=tree.ray_cast(v0,vec.normalized(),vec.length)
     rays+=1
     if at is not None and .02<dist<vec.length-.02:
      hits.append(dict(route=r['id'],object=own[idx],at=[round(t,2)for t in at]))
res=dict(status='LOCAL_PASS'if not hits else 'FAIL',rays=rays,roads=routes,
 hits=len(hits),examples=hits[:30],canonicalParcelsPreserved=True,
 roadCenterlinesPreserved=True,
 warnings=['No full actor capsule or NPC logic','Other legacy district geometry not included',
           'No automated proof of interior existence or evocative ceremonial experience'])
(out/'mage-court-3d-route-audit.json').write_text(json.dumps(res,indent=2))
print('MAGE_QA',json.dumps({k:v for k,v in res.items()if k not in ('examples','warnings')}))
