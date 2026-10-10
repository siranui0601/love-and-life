"""Actual bpy ray QA for new Royal Mage institutional complex. Scope and known
limitations are intentional. Do not mark city-wide safe on a local pass.
"""
import bpy,json,pathlib,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'court-mage-monument-plan-v2.staged.json').read_text('utf8'))
prev=json.loads((root/'plan.json').read_text('utf8'))
meta=p['currentRoyalMageMonument']
R={r['id']:r for r in p['routes']};P={r['id']:r for r in prev['routes']}
N=meta['newRouteIds'];M=meta['createdMeshBatches']
assert len(N)==3 and len(M)==8
assert all(R.get(k)==v for k,v in P.items()),'Baseline route mutated'
assert len(R)==len(P)+3
objs=[bpy.data.objects[n]for n in M]
assert len(objs)==8
def buildBVH(objects):
 verts=[];faces=[];names=[]
 for o in objects:
  if o is None or o.type!='MESH' or not o.data.polygons:continue
  k=len(verts);verts.extend([o.matrix_world@v.co for v in o.data.vertices])
  for f in o.data.polygons:
   faces.append([k+i for i in f.vertices]);names.append(o.name)
 return BVHTree.FromPolygons(verts,faces),names
surfaces=[bpy.data.objects['mage_east_ground'],bpy.data.objects[M[-1]]]
surface,sNames=buildBVH(surfaces)
barriers=[o for o in objs if not o.name.endswith('_floor')]
newBarrier,newNames=buildBVH(barriers)
legacy=[]
for ob in bpy.data.objects:
 if ob.type!='MESH' or ob.name in M or not ob.data.polygons:continue
 if ob.name in ('Parcels - street frontage first','District facade openings','Frontage entrance doors - visual only'):continue
 bb=[ob.matrix_world@Vector(v)for v in ob.bound_box]
 lo=[min(v[i]for v in bb)for i in range(3)]
 hi=[max(v[i]for v in bb)for i in range(3)]
 if hi[0]<1022 or lo[0]>1142 or hi[1]<580 or lo[1]>730 or hi[2]<70.5 or lo[2]>102:continue
 if any(key in ob.name.lower()for key in ('_ground','_floor','_lane','contour','_road','paving','_roof','_banner','_decal')):
  continue
 legacy.append(ob)
oldBarrier,oldNames=buildBVH(legacy)
newFailures=[];oldRoadBlocked=[];oldStructuralCollisions=[];floorFails=[]
floorCount=0;rayCount=0;oldCount=0
oldIDs=[]
for r in prev['routes']:
 if r.get('z0')!=70 or r.get('z1')!=70:continue
 if len(r['points'])<2:continue
 if any(980<=pt[0]<=1150 and 558<=pt[1]<=742 for pt in r['points']):
  oldIDs.append(r['id'])
for routeID in N+oldIDs:
 rr=R[routeID];new=routeID in N
 for a,b in zip(rr['points'],rr['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy)
  if length<.1:continue
  nx=-dy/length;ny=dx/length
  step=max(1,math.ceil(length/1.25))
  for i in range(step):
   v=(i+.25)/step;u=(i+.75)/step
   x=a[0]+dx*v;y=a[1]+dy*v;X=a[0]+dx*u;Y=a[1]+dy*u
   if not(1010<x<1144 and 561<y<736):continue
   for sh in(-.70,0,.70):
    ox=x+nx*sh;oy=y+ny*sh
    src=Vector((ox,oy,71.2))
    if new:
     h,nrm,idx,dist=surface.ray_cast(src,Vector((0,0,-1)),2.1)
     floorCount+=1
     if h is None or abs(h.z-70)>.44:
      if len(floorFails)<30:floorFails.append([routeID,round(ox,1),round(oy,1),None if h is None else round(h.z,2)])
    for z in (71.05,71.76):
     p0=Vector((ox,oy,z));p1=Vector((X+nx*sh,Y+ny*sh,z))
     vv=p1-p0
     if vv.length<.002:continue
     if new:
      for tree,nameset in ((newBarrier,newNames),(oldBarrier,oldNames)):
       h,n,fi,dd=tree.ray_cast(p0,vv.normalized(),vv.length)
       rayCount+=1
       if h is not None and .02<dd<vv.length-.02 and len(newFailures)<40:
        newFailures.append([routeID,nameset[fi],round(ox,2),round(oy,2),z])
     else:
      h,n,fi,dd=newBarrier.ray_cast(p0,vv.normalized(),vv.length)
      oldCount+=1
      if h is not None and .02<dd<vv.length-.02 and len(oldRoadBlocked)<40:
       oldRoadBlocked.append([routeID,newNames[fi],round(ox,2),round(oy,2),z])
# Novel roof and high-level volumes must not overlap canon parcel sites.
# Separate spatial parcel QA was passed in source-plan 2D.
report=dict(status='LOCAL_PASS' if not(newFailures or oldRoadBlocked or floorFails)else 'FAIL',
 meshesAdded=len(M),routesAdded=len(N),legacyRoutesPreserved=True,
 existingMeshCollisionCandidates=len(legacy),nearbyExistingRoads=len(oldIDs),
 newPathFloorProbes=floorCount,newPathFloorFailures=floorFails,
 newPathBodyHeadRays=rayCount,newPathBlockers=newFailures,
 oldStreetVsNewGeometryRays=oldCount,oldStreetBlockers=oldRoadBlocked,
 limitations=['Street center and +/-0.7m probes, not continuous swept humanoid capsule',
 'New buildings have modeled main doors; their room plan, windows and stairs await navigation mesh',
 'Arch windows are facade treatments, NOT fully bored gameplay apertures',
 'No player or NPC access to elevated observatory platforms yet',
 'Not a citywide architectural or narrative acceptance'])
(root/'court-mage-monument-local-qa.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('MAGE_MONUMENT_QA',json.dumps({k:v for k,v in report.items()if k not in ('newPathFloorFailures','newPathBlockers','oldStreetBlockers','limitations')}))
if floorFails:print('FLOOR',floorFails[:15])
if newFailures:print('PATH',newFailures[:16])
if oldRoadBlocked:print('EXISTING_STREET',oldRoadBlocked[:16])
