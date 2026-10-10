import bpy,math,json,pathlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'mage-royal-cloister-plan.staged.json').read_text('utf8'))
src=json.loads((root/'plan.json').read_text('utf8'))
meta=p['currentRoyalMageCloister']
before={r['id']:r for r in src['routes']}
after={r['id']:r for r in p['routes']}
assert all(after.get(id)==road for id,road in before.items()),'Changed preexisting roads'
assert len(after)==len(before)+2
def BVH(obs):
 vs=[];fs=[];names=[]
 for o in obs:
  if o is None or o.type!='MESH':continue
  j=len(vs)
  vs.extend([o.matrix_world@v.co for v in o.data.vertices])
  for f in o.data.polygons:
   fs.append([j+i for i in f.vertices]);names.append(o.name)
 if not fs:raise RuntimeError('No geometry')
 return BVHTree.FromPolygons(vs,fs),names
floor=[bpy.data.objects[n]for n in ('mage_east_ground','b113_court_mage_tower_archive_gallery','b113_court_mage_tower_interdomestic_audience_hall') if bpy.data.objects.get(n)]
floor += [bpy.data.objects[n]for n in meta['newMeshes'] if n.endswith('_stone')]
ff,_=BVH(floor)
obs=[]
for o in bpy.data.objects:
 if o.type!='MESH' or not o.data.polygons or o in floor:continue
 if o.name in ('Parcels - street frontage first','District facade openings','Frontage entrance doors - visual only'):continue
 n=o.name.lower()
 if any(k in n for k in ('_ground','_floor','lane','contour','road','roofs','_retaining')):continue
 bb=[o.matrix_world@Vector(q)for q in o.bound_box]
 lo=[min(v[i] for v in bb)for i in range(3)];hi=[max(v[i] for v in bb)for i in range(3)]
 if hi[0]<1029 or lo[0]>1122 or hi[1]<626 or lo[1]>719 or hi[2]<70.2 or lo[2]>93:continue
 obs.append(o)
allObs,labels=BVH(obs)
newObs=[bpy.data.objects[n]for n in meta['newMeshes'] if not n.endswith(('_stone','_garden'))]
newSolid,newLabels=BVH(newObs)
newIds=meta['newRoutes']
oldIds=['court_mage_tower_archive_gallery','court_mage_tower_interdomestic_audience_hall','mage_east_lane_3','mage_east_lane_14']
floorBad=[];newBlocks=[];oldBlocks=[];floorCount=0;bodyCount=0
for name in newIds+oldIds:
 route=after[name]
 for a,b in zip(route['points'],route['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
  if L<.05:continue
  nx=-dy/L;ny=dx/L
  for k in range(max(1,math.ceil(L/1.1))):
   N=max(1,math.ceil(L/1.1));t=(k+.2)/N;u=(k+.8)/N
   x=a[0]+dx*t;y=a[1]+dy*t
   X=a[0]+dx*u;Y=a[1]+dy*u
   if not(1020<x<1120 and 620<y<712):continue
   for off in(-.75,0,.75):
    if name in newIds:
     hit,normal,index,d=ff.ray_cast(Vector((x+nx*off,y+ny*off,71.4)),Vector((0,0,-1)),2.5)
     floorCount+=1
     if hit is None or abs(hit.z-70)>.38:
      if len(floorBad)<24:floorBad.append([name,round(x,2),round(y,2),None if hit is None else round(hit.z,2)])
    for h in(1.12,1.92):
     a0=Vector((x+nx*off,y+ny*off,70+h))
     b0=Vector((X+nx*off,Y+ny*off,70+h));v=b0-a0
     if v.length<.01:continue
     tree,nn=(allObs,labels)if name in newIds else(newSolid,newLabels)
     hit,normal,index,d=tree.ray_cast(a0,v.normalized(),v.length)
     bodyCount+=1
     if hit is not None and .02<d<v.length-.02:
      bucket=newBlocks if name in newIds else oldBlocks
      if len(bucket)<36:bucket.append([name,nn[index],round(x,2),round(y,2),round(h,2)])
result=dict(status='LOCAL_PASS'if not floorBad and not newBlocks and not oldBlocks else'FAIL',newRoutes=newIds,existingRoadsPreserved=len(before),oldWallsRemoved=meta['oldWallMeshes'],floorProbes=floorCount,bodyHeadRays=bodyCount,floorFailures=floorBad,newPathCollisions=newBlocks,oldRoadNewCollisions=oldBlocks,caveats=['Only 6 routes were checked, not all city routes','No playable interiors or navigation mesh','No NPC academy magic events'])
(root/'mage-royal-cloister-local-qa.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print('ROYAL_MAGE_CLOISTER_QA',json.dumps({k:v for k,v in result.items()if k not in('floorFailures','newPathCollisions','oldRoadNewCollisions','caveats')}))
if floorBad:print('FLOOR_FAIL',floorBad[:12])
if newBlocks:print('BLOCK_NEW',newBlocks[:12])
if oldBlocks:print('BLOCK_OLD',oldBlocks[:12])
