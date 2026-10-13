import bpy,json,pathlib,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
c=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((c/'craft-working-plan-v2.staged.json').read_text('utf8'))
before=json.loads((c/'plan.json').read_text('utf8'))
study=p['currentCraftWorkingQuarter'];news=study['newRoutes']
oldRoutes={x['id']:x for x in before['routes']}
newRoutes={x['id']:x for x in p['routes']}
assert len(newRoutes)==len(oldRoutes)+4 and all(newRoutes[k]==v for k,v in oldRoutes.items())
def makeBVH(obs):
 vertices=[];polys=[];src=[]
 for ob in obs:
  if not ob or ob.type!='MESH':continue
  start=len(vertices)
  vertices.extend([ob.matrix_world@v.co for v in ob.data.vertices])
  for f in ob.data.polygons:
   polys.append([start+j for j in f.vertices]);src.append(ob.name)
 return BVHTree.FromPolygons(vertices,polys),src
names=study['newMaterialBatches']
newObjs=[bpy.data.objects[n]for n in names]
groundNames=['western_ascent_market_ascent_restored_ground','low_city_ground',
 'current_craft_active_ashlar']
floor,fns=makeBVH([bpy.data.objects.get(n)for n in groundNames])
fresh,fn=makeBVH(newObjs)
oldSolid=[]
for ob in bpy.data.objects:
 if ob.type!='MESH' or ob.name in names or not ob.data.polygons:continue
 if ob.name in ('Parcels - street frontage first','District facade openings','Frontage entrance doors - visual only'):continue
 if any(t in ob.name.lower()for t in ('_ground','_floor','_road','_lane','_contour','paving','roofs')):continue
 bb=[ob.matrix_world@Vector(v)for v in ob.bound_box]
 lo=[min(v[i]for v in bb)for i in range(3)]
 hi=[max(v[i]for v in bb)for i in range(3)]
 if lo[0]>-315 or hi[0]<-466 or lo[1]>195 or hi[1]<88 or lo[2]>40 or hi[2]<14.5:continue
 oldSolid.append(ob)
obstacles,obNames=makeBVH(oldSolid)
existingIDs=[r['id']for r in before['routes']
 if r['z0']==r['z1']==14 and len(r['points'])>1
 and any(-465<q[0]<-315 and 90<q[1]<195 for q in r['points'])]
probes=0;checks=0;priorChecks=0
holes=[];freshBlocks=[];legacyBlocks=[]
for id in news+existingIDs:
 r=newRoutes[id];new=id in news
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];ll=math.hypot(dx,dy)
  if ll<.01:continue
  nx=-dy/ll;ny=dx/ll
  n=max(1,math.ceil(ll/1))
  for i in range(n):
   t=(i+.3)/n;u=(i+.7)/n
   x=a[0]+dx*t;y=a[1]+dy*t
   X=a[0]+dx*u;Y=a[1]+dy*u
   if not(-468<x<-310 and 85<y<192):continue
   for sh in(-.70,0,.70):
    xp=x+nx*sh;yp=y+ny*sh
    if new:
     h,nm,fi,dist=floor.ray_cast(Vector((xp,yp,15.25)),Vector((0,0,-1)),2)
     probes+=1
     if h is None or abs(h.z-14)>.47:
      if len(holes)<40:holes.append([id,round(xp,2),round(yp,2),None if h is None else round(h.z,2)])
    for z in(15.1,15.8):
     start=Vector((xp,yp,z));end=Vector((X+nx*sh,Y+ny*sh,z))
     diff=end-start
     if diff.length<.01:continue
     if new:
      for tree,nn in ((fresh,fn),(obstacles,obNames)):
       hit,normal,i2,dist=tree.ray_cast(start,diff.normalized(),diff.length)
       checks+=1
       if hit is not None and .02<dist<diff.length-.02:
        if len(freshBlocks)<30:freshBlocks.append([id,nn[i2],round(xp,2),round(yp,2),z])
     else:
      hit,normal,i2,dist=fresh.ray_cast(start,diff.normalized(),diff.length)
      priorChecks+=1
      if hit is not None and .02<dist<diff.length-.02:
       if len(legacyBlocks)<30:legacyBlocks.append([id,fn[i2],round(xp,2),round(yp,2),z])
result=dict(status='LOCAL_PASS'if not(holes or freshBlocks or legacyBlocks)else 'FAIL',
 routesAdded=4,materialBatchesAdded=len(newObjs),existingRoutesPreserved=True,
 preservedRoadsChecked=len(existingIDs),legacySolidMeshed=len(oldSolid),
 floorRays=probes,missingFloor=holes,
 newStreetBodyHeadRays=checks,newStreetBlockers=freshBlocks,
 previousStreetBodyHeadRays=priorChecks,existingStreetBlockers=legacyBlocks,
 limitations=['No continuous player capsule, cart wheelbase / turning-radius simulation',
 'Static furnace and workshop machines; no fires, NPCs, inventory, sound or smoke systems',
 'This is only a manufacturing-district pilot and does not complete city exploration'])
(c/'craft-working-local-qa.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print('CRAFT_WORKING_QA',json.dumps({k:v for k,v in result.items()if k not in('missingFloor','newStreetBlockers','existingStreetBlockers','limitations')}))
if holes:print('HOLES',holes[:18])
if freshBlocks:print('NEW_BLOCKS',freshBlocks[:20])
if legacyBlocks:print('OLD_BLOCKS',legacyBlocks[:20])
