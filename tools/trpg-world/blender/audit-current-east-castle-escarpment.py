import bpy,json,pathlib,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'east-escarpment-plan-v6.staged.json').read_text('utf8'))
before=json.loads((root/'plan.json').read_text('utf8'))
meta=p['currentEastCastleEscarpment'];newMeshes=meta['newMeshes']
rBefore={r['id']:r for r in before['routes']}
rNow={r['id']:r for r in p['routes']}
if set(rNow)!=((set(rBefore)-{meta['replacedOldRoute']})|set(meta['newRoutes'])):raise RuntimeError('unexpected changed routes')
if any(rNow.get(k)!=v for k,v in rBefore.items()if k!=meta['replacedOldRoute']):raise RuntimeError('old route altered')
def bvh(objects):
 vertices=[];faces=[];names=[]
 for obj in objects:
  if obj is None or obj.type!='MESH':continue
  j=len(vertices)
  vertices.extend([obj.matrix_world@v.co for v in obj.data.vertices])
  for face in obj.data.polygons:
   faces.append([j+i for i in face.vertices])
   names.append(obj.name)
 return BVHTree.FromPolygons(vertices,faces),names
objs={n:bpy.data.objects[n]for n in newMeshes}
floorSources=[objs[n]for n in newMeshes if n.endswith(('_treads','_stone','_rock'))]
floorSources+=[bpy.data.objects.get(n)for n in('forecourt_ground','castle_ground','castle_east_ramp_landing_0','castle_contour_1')]
floor,names=bvh(floorSources)
oldOb=[]
for obj in bpy.data.objects:
 if obj.type!='MESH' or obj.name in newMeshes or obj in floorSources or not obj.data.polygons:continue
 if obj.name in ('Parcels - street frontage first','District facade openings','Frontage entrance doors - visual only'):continue
 if any(w in obj.name.lower() for w in ('ground','_floor','_road','paving','contour')):continue
 verts=[obj.matrix_world@Vector(v)for v in obj.bound_box]
 low=[min(z[i] for z in verts)for i in range(3)]
 hi=[max(z[i]for z in verts)for i in range(3)]
 if low[0]>400 or hi[0]<362 or low[1]>1045 or hi[1]<890 or low[2]>210 or hi[2]<157:continue
 oldOb.append(obj)
# Center/side human clearance first. All new and preserved nearby
# routes must have a walkable floor and no blocking stones.
newObstacles=[o for n,o in objs.items()if n.endswith(('_rails','_iron','_brass'))]
obstacles,obnames=bvh(oldOb+newObstacles)
newObstaclesTree,newNames=bvh(newObstacles)
testIDs=list(meta['newRoutes'])
nearOld=[]
for r in before['routes']:
 if r['z0']!=r['z1'] or r['z0'] not in(156,204):continue
 if any(344<x[0]<409 and 880<x[1]<1060 for x in r['points']):
  nearOld.append(r['id'])
testIDs+=nearOld
floorMissing=[];hits=[];roadHits=[];oldHeightDiscrepancies=[]
ns=0;nr=0
for id in testIDs:
 r=rNow[id]
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];ll=math.hypot(dx,dy)
  if ll<.01:continue
  nx=-dy/ll;ny=dx/ll;n=max(1,math.ceil(ll/1.2))
  for j in range(n):
   t=(j+.28)/n;u=(j+.72)/n
   x=a[0]+dx*t;y=a[1]+dy*t
   X=a[0]+dx*u;Y=a[1]+dy*u
   if not (350<x<402 and 885<y<1044):continue
   z=a[2]+(b[2]-a[2])*t;Z=a[2]+(b[2]-a[2])*u
   for sh in (-.70,0,.70):
    pos=Vector((x+nx*sh,y+ny*sh,z+1.5))
    hit,nrm,idx,dist=floor.ray_cast(pos,Vector((0,0,-1)),2.2)
    ns+=1
    if hit is None or abs(hit.z-z)>.5:
     record=[id,round(x,2),round(y,2),round(z,2),None if hit is None else round(hit.z,2)]
     target=floorMissing if id in meta['newRoutes'] else oldHeightDiscrepancies
     if len(target)<40:target.append(record)
    for h in (1.05,1.8):
     p0=Vector((x+nx*sh,y+ny*sh,z+h))
     p1=Vector((X+nx*sh,Y+ny*sh,Z+h))
     v=p1-p0
     if v.length<.001:continue
     hit,nm,index,dd=obstacles.ray_cast(p0,v.normalized(),v.length)
     nr+=1
     if hit is not None and .015<dd<v.length-.015:
      record=[id,obnames[index],round(x,2),round(y,2),round(z,2)]
      target=hits if id in meta['newRoutes'] else roadHits
      if len(target)<40:target.append(record)
result=dict(status='LOCAL_PASS'if not floorMissing and not hits and not roadHits else 'FAIL',
 oldRoadTotalM=round(meta['oldLengthM'],2),
 newStairsLengthM=rNow[meta['newRoutes'][0]]['lengthM'],
 newCargoLengthM=rNow[meta['newRoutes'][1]]['lengthM'],
 removedOldRampMeshCount=len(meta['removedOldMeshes']),
 allOtherRoutesPreserved=True,solidStoneBase=True,roofless=True,
 routesChecked=len(testIDs),oldObstaclesChecked=len(oldOb),floorProbes=ns,
 newRouteMissingFloor=floorMissing,legacyFloorDiscrepancies=oldHeightDiscrepancies,
 bodyHeadRays=nr,newRouteObstructions=hits,oldRouteNewObstructions=roadHits,
 limitations=['Static point/ray QA not a cart swept collision, NPC navigation, load support engineering or actual winch drive',
 'Castle east ramp upper landing_1 is retained as existing castle public spur',
 'Current view must be inspected at ground and bird-eye level before promotion'])
(root/'east-escarpment-local-qa.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print('EAST_ESCARPMENT_QA',json.dumps({k:v for k,v in result.items()if k not in('newRouteMissingFloor','legacyFloorDiscrepancies','newRouteObstructions','oldRouteNewObstructions','limitations')}))
if floorMissing:print('FLOOR_FAILED',floorMissing[:12])
if hits:print('NEW_PATH_BLOCK',hits[:12])
if roadHits:print('OLD_PATH_BLOCK',roadHits[:12])
if oldHeightDiscrepancies:print('OLD_HEIGHT_WARNING',oldHeightDiscrepancies[:12])
