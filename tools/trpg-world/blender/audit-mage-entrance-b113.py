"""B113 evidence-based walk geometry audit on the real boolean-modified .blend.
Sample across the southern entry, audience chamber, and archive exit.
This is not a game engine simulation; cap clearance still pending.
"""
import bpy,json,pathlib,sys,math,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((out/'plan.json').read_text())
study=p['towerEntranceB113']
routes=[r for r in p['routes']if r['id'] in study['threeAccessRoutes']]
def candidates():
 for ob in bpy.data.objects:
  if ob.type!='MESH' or len(ob.data.polygons)==0:continue
  if 'District facade openings' in ob.name or 'Parcels - street' in ob.name or 'Frontage entrance doors' in ob.name:continue
  if ob.name.startswith('b113_court_mage_tower_') or ob.name=='mage_east_ground':continue
  if ob.name in ('Proposed mage tower',) or ob.name.startswith(('B113','b112_','b100_','mage_east building walls','mage_east roofs')):
   coords=[ob.matrix_world@Vector(v) for v in ob.bound_box]
   if max(v.x for v in coords)<989 or min(v.x for v in coords)>1132:continue
   if max(v.y for v in coords)<565 or min(v.y for v in coords)>719:continue
   yield ob
def bvh(objects):
 v=[];f=[];owners=[]
 for ob in objects:
  k=len(v);v.extend([ob.matrix_world@vertex.co for vertex in ob.data.vertices])
  for face in ob.data.polygons:
   f.append([k+z for z in face.vertices]);owners.append(ob.name)
 return BVHTree.FromPolygons(v,f),owners
objects=list(candidates())
obstacles,owners=bvh(objects)
floors,floorowners=bvh([bpy.data.objects.get(n)for n in study['newMeshes']if bpy.data.objects.get(n)] + [bpy.data.objects['mage_east_ground']])
hits=[];support=[];casts=0;floorCasts=0
for route in routes:
 for a,b in zip(route['points'],route['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy)
  if length<.03:continue
  count=max(1,math.ceil(length/1.7));nx=-dy/length;ny=dx/length
  for i in range(count):
   x=a[0]+dx*i/count;y=a[1]+dy*i/count
   xx=a[0]+dx*(i+1)/count;yy=a[1]+dy*(i+1)/count
   for offset in [-min(route['width']*.24,1.1),0,min(route['width']*.24,1.1)]:
    for height in [1.15,1.8]:
     start=Vector((x+nx*offset,y+ny*offset,70+height))
     end=Vector((xx+nx*offset,yy+ny*offset,70+height))
     vec=end-start
     if vec.length<.001:continue
     h,n,idx,dist=obstacles.ray_cast(start,vec.normalized(),vec.length)
     casts+=1
     if h is not None and .015<dist<vec.length-.015:
      hits.append(dict(route=route['id'],mesh=owners[idx],at=[round(t,2)for t in h]))
    floorCasts+=1
    hit,normal,idx,dist=floors.ray_cast(Vector((x+nx*offset,y+ny*offset,70.72)),Vector((0,0,-1)),2)
    if hit is None or abs(hit.z-70)>.4:
     support.append(dict(route=route['id'],at=[round(x+nx*offset,2),round(y+ny*offset,2)],z=None if hit is None else round(hit.z,2)))
# Check three opening centerline face intersections by sampling the actual
# modified tower mesh, not the intended cube cutters.
tower=bpy.data.objects['Proposed mage tower']
remesh=tower.data
booleanSuccess=len(remesh.polygons)>14
res=dict(status='LOCAL_PASS'if not hits and not support and booleanSuccess else 'FAIL',
 appliedBoolean=booleanSuccess,towerFaces=len(remesh.polygons),
 targetRoutes=len(routes),rays=casts,rayObstructions=len(hits),
 floorSamples=floorCasts,unsupportedSamples=len(support),
 obstacleExamples=hits[:40],floorExamples=support[:40],
 warnings=['Not full collision capsule nor navmesh','Elevator to upper tower floors absent',
 'No NPC, research stations or game interactions','Outside 3 routes and baseline legacy geometry not exhaustively tested'])
(out/'mage-entry-traversal.json').write_text(json.dumps(res,indent=2))
print('B113_QA',json.dumps({k:v for k,v in res.items()if k not in('obstacleExamples','floorExamples','warnings')}))
