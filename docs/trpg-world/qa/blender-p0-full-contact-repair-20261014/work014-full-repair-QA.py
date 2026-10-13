import bpy,bmesh,pathlib,json,hashlib,sys,math
sys.path.insert(0,r'C:\Users\inaba\Documents\TRPG-Capital-Blender\python-deps')
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union
from mathutils import Vector
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
P=json.loads((R/'work014-p0-sealed.staged.plan.json').read_text('utf8'));A=json.loads((R/'plan.json').read_text('utf8'))
assert hashlib.sha256((R/'plan.json').read_bytes()).hexdigest()==P['work014WallBaseRepair']['canonicalSHA256']
assert P['routes']==A['routes'] and P['landDomains']==A['landDomains']
M={m['name']:m for m in P['meshes']};O={m['name']:m for m in A['meshes']}
changed=[n for n in M.keys()&O.keys() if M[n]!=O[n]]
assert changed==['repair_user_p0_W03_TOE_ground_20261012'],changed
removed=sorted(O.keys()-M.keys())
assert len(removed)==11 and all(n.startswith('repair_user_p0_') for n in removed),removed
def flat(m,z):
 out=[]
 for f in m['faces']:
  vs=[m['vertices'][i] for i in f]
  if all(abs(v[2]-z)<.06 for v in vs):
   q=Polygon([v[:2] for v in vs])
   if q.is_valid and q.area>1e-7:out.append(q)
 return unary_union(out)
newNames=list(M.keys()-O.keys())+changed
for n in newNames:
 obj=bpy.data.objects.get(n);assert obj,n
 m=M[n];assert len(obj.data.vertices)==len(m['vertices']) and len(obj.data.polygons)==len(m['faces']),n
 maxerr=max((obj.matrix_world@obj.data.vertices[i].co-Vector(v)).length for i,v in enumerate(m['vertices']))
 assert maxerr<.001,(n,maxerr)
 bm=bmesh.new();bm.from_mesh(obj.data);bad=sum(not e.is_manifold for e in bm.edges);bm.free()
 assert bad==0,(n,'open edges',bad)
sites=[('F01',-654.298,1076.59,14,'repair_user_p0_F01_terrace_footed_lowland_v23'),('F02',-784.298,756.89,42,'repair_user_p0_F02_full_infill_v19'),('F03',-124.498,219.29,14,'repair_user_p0_F03_full_infill_v19'),('F04W01',-127.198,914.99,112,'repair_user_p0_F04W01_full_infill_v22'),('F05',353.602,960.79,156,'repair_user_p0_F05_full_infill_v22'),('F06',424.202,1126.79,112,'repair_user_p0_F06_full_infill_v20'),('F07',271.202,1239.89,112,'repair_user_p0_F07_full_infill_v21'),('F08',405.302,1180.19,14,'repair_user_p0_F08_terrace_footed_lowland_v23'),('F09',584.702,925.49,14,'repair_user_p0_F09_W02_full_gap_mass_v18')]
from mathutils.bvhtree import BVHTree
results=[]
for tag,x,y,z,n in sites:
 poly=flat(M[n],z);assert poly.covers(Point(x,y)),tag
 ob=bpy.data.objects[n];bvh=BVHTree.FromPolygons([ob.matrix_world@v.co for v in ob.data.vertices],[list(f.vertices) for f in ob.data.polygons])
 tests=0;bad=0
 for ix in range(math.floor(poly.bounds[0]/2),math.ceil(poly.bounds[2]/2)+1):
  for iy in range(math.floor(poly.bounds[1]/2),math.ceil(poly.bounds[3]/2)+1):
   q=Point(ix*2,iy*2)
   if not poly.contains(q):continue
   hit=bvh.ray_cast(Vector((q.x,q.y,z+.2)),Vector((0,0,-1)),.4)[0];tests+=1
   if hit is None or abs(hit.z-z)>.02:bad+=1
 assert bad==0,(tag,bad)
 results.append(dict(site=tag,areaM2=poly.area,actualMeshRays=tests,missing=bad))
walls=[]
for tag,lo,hi in [('W01',112,156),('W03',14,112),('W04',14,70)]:
 foot=flat(M['repair_user_p0_'+tag+'_retaining_20261012'],lo)
 low=unary_union([flat(m,lo) for m in P['meshes'] if any(s in m['name'] for s in ('ground','infill','lowland','mass_v18'))])
 missing=foot.difference(low).area
 assert missing<.005,(tag,missing)
 walls.append(dict(site=tag,baseAreaM2=foot.area,unsupportedM2=missing))
qa=dict(status='LOCAL_STRUCTURAL_PASS_NOT_CITYWIDE_ACCEPTANCE',siteResults=results,wallBaseResults=walls,newClosedMeshes=len(newNames),removedObsoletePatches=removed,routesUnchanged=True,scenePlanMeshAgreement=True,remainingStaticRouteAnomalies=14)
(R/'work014-full-repair-QA.json').write_text(json.dumps(qa,indent=2),encoding='utf8')
print('FULL_REPAIR_QA',json.dumps(qa),flush=True)
