"""Refine the existing one-file civic-royal freight hoist.
A true animated cabin (Blender frame 1→121→241) with counterweight/winch,
two holed landings and a proper slate roof.
SAFE staging: current BLEND is not overwritten before local QA.
"""
import bpy,bmesh,json,math,pathlib,sys
from mathutils import Vector
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
out=root/'royal-hoist.pending.blend'
if out.exists():raise RuntimeError('Pending hoist already exists')
p=json.loads((root/'plan.json').read_text(encoding='utf8'))
study=p['civicRoyalRampReplacement']
oldName='current_civic_royal_hoist_platform'
ob=bpy.data.objects.get(oldName)
if not ob or len(ob.data.vertices)!=32:raise RuntimeError('Expected 4 old platform modules = 32 vertices')
entry=next(m for m in p['meshes']if m['name']==oldName)
if len(entry['vertices'])!=32 or len(entry['faces'])!=24:raise RuntimeError('Plan hoist meshing changed')
# The first and second full slabs plugged the vertical lift shaft.
# Keep only its two roadway bridges, and replace the slabs with open rings
# so the real cabin can pass all the way through the upper station.
base8=[list(v) for v in entry['vertices'][:8]]
bridgeVerts=[list(q)for q in entry['vertices'][16:]]
# Stop both 42m and 112m access viaducts at the annular deck, not at
# the center of the lift shaft. Otherwise ~45m² of bridge floor occupies
# the moving cabin space even though a center-only ray can miss that.
for i in (1,2,5,6):
 bridgeVerts[i][0]+=.8
 bridgeVerts[i][1]-=5.6
for i in (8,11,12,15):
 bridgeVerts[i][0]-=5.5
bridgeFaces=[[j-16 for j in face]for face in entry['faces'][12:]]
entry['vertices']=bridgeVerts;entry['faces']=bridgeFaces
baseMesh=bpy.data.meshes.new(oldName+'-bridges-only')
baseMesh.from_pydata(bridgeVerts,[],bridgeFaces);baseMesh.update()
ob.data=baseMesh
col=bpy.data.collections.get('Current Civic-Royal Cliff Stairs and Freight Lift')
if not col:raise RuntimeError('Hoist collection not found')
materials={}
for key,c in {'pale_ashlar':(.77,.74,.67,1),
 'roof_slate':(.20,.28,.39,1),'iron':(.13,.16,.20,1),
 'brass':(.65,.48,.22,1),'wood':(.43,.31,.23,1)}.items():
 mat=bpy.data.materials.get('RoyalHoist '+key)or bpy.data.materials.new('RoyalHoist '+key)
 mat.diffuse_color=c;materials[key]=mat
batches={k:([],[])for k in materials}
def meshblock(k,coords,fs):
 v,f=batches[k];off=len(v);v.extend([[float(z)for z in xyz]for xyz in coords])
 f.extend([[off+j for j in face]for face in fs])
def cube(k,x,y,z,w,d,h):
 coords=[(x-w/2,y-d/2),(x+w/2,y-d/2),(x+w/2,y+d/2),(x-w/2,y+d/2)]
 vv=[(*xy,level)for level in (z-h/2,z+h/2)for xy in coords]
 meshblock(k,vv,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def roof(k,cx,cy,width,depth,z,peak):
 x0=cx-width/2;x1=cx+width/2;y0=cy-depth/2;y1=cy+depth/2
 vv=[[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z],[cx,y0,z+peak],[cx,y1,z+peak]]
 meshblock(k,vv,[[0,1,4],[3,5,2],[0,4,5,3],[4,1,2,5]])
# Narrow annular stone landings (14m square minus an 8.4m moving gap).
# No static floor seals the freight hoist's vertical shaft.
for level in (42.12,112.12):
 for dy in (-5.1,5.1):
  cube('pale_ashlar',605,692+dy,level,14.0,1.8,.42)
 for dx in (-5.1,5.1):
  cube('pale_ashlar',605+dx,692,level,1.8,8.4,.42)
 # 4 formal plinths outside the cargo opening.
 for dx in (-6.4,6.4):
  for dy in (-6.4,6.4):
   cube('pale_ashlar',605+dx,692+dy,level+1.05,1.1,1.1,2.1)
# Roof, drum hall and hanging lanterns above 112m receiving platform.
for xx in (599,611):
 cube('pale_ashlar',xx,692,116.0,1.4,13.0,8.0)
for yy in (686,698):
 cube('pale_ashlar',605,yy,116.0,11.5,1.1,8.0)
cube('pale_ashlar',605,692,120.2,14.7,15.0,1.1)
roof('roof_slate',605,692,17.0,17.5,121.2,7.3)
# Royal hoist ornament / winch canopies, keep passable upper bridge clear.
for xx in (598.5,611.5):
 cube('brass',xx,692,118.3,.7,1.6,1.9)
for dy in (-7.2,7.2):
 cube('brass',605,692+dy,117.7,2.0,.4,2.0)
# Reduce the original 9m floor to 8.1m for genuine clearance through
# 4 stone main uprights, instead of moving through them.
cabinBase=[]
for x,y,z in base8:
 cabinBase.append([605+(x-605)*.9,692+(y-692)*.9,z])
faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
# Rail supports are part of one mesh animated together with the cargo deck;
# west and south have open approach gates.
cv=[list(q)for q in cabinBase];cf=[list(face)for face in faces]
def cargoBox(x,y,z,w,d,h):
 offset=len(cv)
 coords=[(x-w/2,y-d/2),(x+w/2,y-d/2),(x+w/2,y+d/2),(x-w/2,y+d/2)]
 cv.extend([[a,b,level]for level in (z-h/2,z+h/2)for a,b in coords])
 cf.extend([[offset+j for j in f]for f in faces])
for sx,sy in [(3.5,3.5),(3.5,-3.5),(-3.5,3.5)]:
 cargoBox(605+sx,692+sy,43.75,.22,.22,3.0)
for y in (692-3.65,692+3.65):
 cargoBox(608.6,y,44.6,.2,7.5,.22)
cargoBox(605,695.6,44.6,7.4,.2,.22)
def create(name,verts,faces,mat):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 obj=bpy.data.objects.new(name,me);col.objects.link(obj);me.materials.append(materials[mat])
 return obj
cabinName='current_royal_freight_hoist_animated_cabin'
cab=create(cabinName,cv,cf,'wood')
cab['transport_role']='freight_lift_carriage'
cab['capacity_note']='visual only; no load physics / game navmesh'
# Local keyframes: object vertex Z already in 42m world coords,
# object base transform moves 0→+70→0.
for frame,dz in [(1,0),(121,70),(241,0)]:
 cab.location.z=dz;cab.keyframe_insert(data_path='location',frame=frame)
# Counted static landing (new meshes) plus counterweight visual.
cwName='current_royal_freight_hoist_counterweight'
cwVerts=[];cwFaces=[]
# counterweight 1.5x1.5x4 at x616.9 y692, initially z112.
def appendBox(vv,ff,cx,cy,cz,w,d,h):
 start=len(vv);coords=[(cx-w/2,cy-d/2),(cx+w/2,cy-d/2),(cx+w/2,cy+d/2),(cx-w/2,cy+d/2)]
 vv.extend([[x,y,z]for z in (cz-h/2,cz+h/2)for x,y in coords])
 ff.extend([[start+j for j in f]for f in faces])
appendBox(cwVerts,cwFaces,616.9,692,108,1.5,1.5,6.0)
cw=create(cwName,cwVerts,cwFaces,'iron')
for frame,dz in [(1,0),(121,-66),(241,0)]:
 cw.location.z=dz;cw.keyframe_insert(data_path='location',frame=frame)
# Animated bronze winding wheel in the upper machinery loft.
gearName='current_royal_freight_hoist_winch'
gearverts=[];gearfaces=[]
N=24
for iy,y in enumerate((-1.0,1.0)):
 for rr in (2.4,3.0):
  for i in range(N):
   a=2*math.pi*i/N
   gearverts.append([rr*math.cos(a),y,rr*math.sin(a)])
for i in range(N):
 j=(i+1)%N
 for rings in ((0,N),(2*N,3*N),(0,2*N),(N,3*N)):
  a,b=rings;gearfaces.append([a+i,a+j,b+j,b+i])
gear=create(gearName,gearverts,gearfaces,'brass')
gear.location=(605,692,119.0)
for frame,rotation in [(1,0),(121,2*math.pi*5),(241,0)]:
 gear.rotation_euler.y=rotation;gear.keyframe_insert(data_path='rotation_euler',frame=frame)
# Blender 5.2 uses layered Actions (fcurves no longer exposed on Action).
# Default Bezier interpolation intentionally eases the elevator at both docks.
created=[]
for k,(vertices,faces_)in batches.items():
 if not vertices:continue
 name='current_royal_hoist_architecture_'+k
 create(name,vertices,faces_,k)
 p['meshes'].append(dict(name=name,vertices=vertices,faces=faces_,material=materials[k].name))
 created.append(name)
for obj,name,vertices,faces_,m in [(cab,cabinName,cv,cf,'wood'),(cw,cwName,cwVerts,cwFaces,'iron')]:
 p['meshes'].append(dict(name=name,vertices=vertices,faces=faces_,material=materials[m].name))
p['hoistOperation']=dict(status='BLENDER_ANIMATION_ONLY',shaftCenter=[605,692],
 travelM=70,lowerDockZ=42,upperDockZ=112,frameStart=1,frameTop=121,frameReturn=241,
 movingPlatform=cabinName,counterweight=cwName,winch=gearName,
 approachFloorRemainsOpen=True,
 caveats=['No lift doors interlocks or game state','No physics/cargo collision during motion','Still needs actual transport mechanic'])
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=241
scene.frame_set(1)
scene['royal_hoist_status']='animated Blender mock-up, game mechanic pending'
scene.render.resolution_x=1280;scene.render.resolution_y=840
for name,pos,target,frame in [
 ('royal-hoist-bottom',(720,600,190),(607,689,87),1),
 ('royal-hoist-at-top',(720,600,190),(607,689,90),121)]:
 scene.frame_set(frame)
 cam=bpy.data.cameras.new(name);co=bpy.data.objects.new(name,cam);scene.collection.objects.link(co)
 co.location=pos;co.rotation_euler=(Vector(target)-co.location).to_track_quat('-Z','Y').to_euler()
 cam.type='ORTHO';cam.ortho_scale=210;cam.clip_end=19000
 scene.camera=co;scene.render.filepath=str(root/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(co,do_unlink=True)
scene.frame_set(1)
(root/'royal-hoist-upgrade-plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('HOIST_PENDING_SAVED',out.stat().st_size,'geoMeshes',len(created)+2,'movingFrames',3)
