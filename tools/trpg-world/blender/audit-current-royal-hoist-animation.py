import bpy,math,json,pathlib,sys,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((root/'royal-hoist-upgrade-plan.staged.json').read_text('utf8'))
h=p['hoistOperation']
scene=bpy.context.scene
cab=bpy.data.objects.get(h['movingPlatform'])
cw=bpy.data.objects.get(h['counterweight'])
winch=bpy.data.objects.get(h['winch'])
if not all((cab,cw,winch)):raise RuntimeError('Animated components missing')
def worldbb(ob):
 q=[ob.matrix_world@Vector(v)for v in ob.bound_box]
 return [(min(v[j]for v in q),max(v[j]for v in q))for j in range(3)]
frames=[]
for f in [1,61,121,181,241]:
 scene.frame_set(f);bpy.context.view_layer.update()
 bounds=worldbb(cab)
 frames.append(dict(frame=f,zBottom=round(bounds[2][0],2),zTop=round(bounds[2][1],2),
                  counterWeightZ=round(cw.location.z,2),
                  winchAngle=round(winch.rotation_euler.y,3)))
scene.frame_set(1)
# verify frame1 and 121 difference exactly70; animation in same active Blender file.
start=frames[0]['zBottom'];top=frames[2]['zBottom'];end=frames[-1]['zBottom']
heightPass=(abs((top-start)-70)<.01 and abs(start-end)<.01)
# Animating shaft must not hit four 2.4m corner columns.
pillarCoords=[(605+dx,692+dy) for dx in (-5.4,5.4)for dy in (-5.4,5.4)]
minClear=999.
for x,y in pillarCoords:
 # moving load boundary: box spans [600.95,609.05] x [687.95,696.05]
 dx=max(0,abs(x-605)-1.2-4.05)
 dy=max(0,abs(y-692)-1.2-4.05)
 clearance=math.hypot(dx,dy)
 minClear=min(minClear,clearance)
# On the mid-point line a 1/1 logical support collision test must
# show the roof clear and no static deck closing the vertical shaft.
static=bpy.data.objects.get('current_civic_royal_hoist_platform')
ringnames=[n for n in h.get('createdMeshes',[]) if 'archi' in n]
allstatic=[ob for ob in bpy.data.objects if ob.type=='MESH' and ob.name.startswith('current_royal_hoist_architecture_')]+[static]
staticverts=[];staticfaces=[];owners=[]
for ob in allstatic:
 if not ob:continue
 k=len(staticverts)
 staticverts.extend([ob.matrix_world@v.co for v in ob.data.vertices])
 for f in ob.data.polygons:
  staticfaces.append([k+i for i in f.vertices]);owners.append(ob.name)
tree=BVHTree.FromPolygons(staticverts,staticfaces)
# Static decks shouldn't seal x605 y692 even at the highest dock.
slotFree=True
slotSamples=0
slotObstructions=[]
# Full moving floor footprint sampled in 2m grid at BOTH elevations.
# Center-only ray had missed a >40m² bridge-into-shaft overlap.
for z in (42.7,112.7):
 for x in range(602,609,2):
  for y in range(689,696,2):
   hit,n,idx,dist=tree.ray_cast(Vector((x,y,z)),Vector((0,0,-1)),1.0)
   slotSamples+=1
   if hit is not None:
    slotFree=False
    slotObstructions.append(dict(x=x,y=y,z=z,mesh=owners[idx] if idx is not None else None))
# Test cargo cabin floor from above at both docks.
platformResults=[]
for frame,dock in [(1,42.12),(121,112.12)]:
 scene.frame_set(frame);bpy.context.view_layer.update()
 floorverts=[cab.matrix_world@v.co for v in cab.data.vertices]
 floorfaces=[list(face.vertices)for face in cab.data.polygons]
 floorBvh=BVHTree.FromPolygons(floorverts,floorfaces)
 hit,n,idx,dist=floorBvh.ray_cast(Vector((605,692,dock+1.2)),Vector((0,0,-1)),3.0)
 platformResults.append(dict(frame=frame,dock=dock,hit=None if hit is None else round(hit.z,3),ok=hit is not None and abs(hit.z-dock)<.35))
scene.frame_set(1)
# Adjacent level roads at both z=42 and112 must remain passable with
# new ring, winch housing and static new freight architectural structures.
nearRoutes=[]
results=[]
nearobjs=[ob for ob in allstatic if ob and len(ob.data.polygons)>0]
for r in p['routes']:
 if len(r['points'])<2 or r['z0']!=r['z1'] or r['z0'] not in(42,112):continue
 if not any(570<v[0]<670 and 630<v[1]<735 for v in r['points']):continue
 nearRoutes.append(r)
hitExamples=[];rays=0
for r in nearRoutes:
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy)
  if length<.05:continue
  nx=-dy/length;ny=dx/length
  for i in range(max(1,math.ceil(length/2.5))):
   N=max(1,math.ceil(length/2.5))
   x=a[0]+dx*i/N;y=a[1]+dy*i/N
   xx=a[0]+dx*(i+1)/N;yy=a[1]+dy*(i+1)/N
   if not(565<x<675 and 620<y<745):continue
   for w in (-min(1,r['width']*.18),0,min(1,r['width']*.18)):
    for hgt in (1.1,1.9):
     st=Vector((x+nx*w,y+ny*w,r['z0']+hgt))
     en=Vector((xx+nx*w,yy+ny*w,r['z0']+hgt))
     direction=en-st
     if direction.length<.01:continue
     hit,n,idx,dist=tree.ray_cast(st,direction.normalized(),direction.length)
     rays+=1
     if hit is not None and .015<dist<direction.length-.015:
      if len(hitExamples)<20:hitExamples.append(dict(route=r['id'],ob=owners[idx],pos=[round(q,2)for q in hit]))
res=dict(status='PASS'if heightPass and slotFree and all(q['ok']for q in platformResults) and not hitExamples else 'FAIL',
 travelFrames=frames,shaftColumnCornerClearanceM=round(minClear,3),
 threeLevelStations=platformResults,
 staticShaftSlotClear=slotFree,staticShaftFloorSamples=slotSamples,
 staticShaftFloorBlockers=slotObstructions,hoistTravelExactly70m=heightPass,
 nearbyRoadCount=len(nearRoutes),nearbyRoadRays=rays,nearbyRoadHits=len(hitExamples),
 obstacleExamples=hitExamples,
 limitations=['Animation does not provide collision, NPC or cargo movement in the game runtime',
 'No doors or safety interlocks','Physics and traffic simulation not performed'])
(root/'royal-hoist-animated-qa.json').write_text(json.dumps(res,indent=2),encoding='utf8')
print('ANIM_HOIST_QA',json.dumps({k:v for k,v in res.items()if k not in ('obstacleExamples','limitations')}))
