"""B113 real entrance carved into existing 12-face Mage Tower mesh using
Blender exact booleans; interior chamber and palace-grade exterior articulation.
Distinct new model. B112 stays untouched.
"""
import bpy,bmesh,math,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
dst=out/'capital-parcel-review.blend'
if dst.exists():raise RuntimeError('Never overwrite a B113 render blend')
data=json.loads((out/'plan.json').read_text(encoding='utf8'))
study=data['towerEntranceB113']
tower=bpy.data.objects.get(study['targetSceneObject'])
if tower is None or tower.type!='MESH':raise RuntimeError('Missing original mage tower')
if len(tower.data.polygons)!=14:raise RuntimeError('Unexpected mage tower: abort geometry')
collection=bpy.data.collections.new('B113 actual court Mage Tower entry, foyer and gothic stonework')
bpy.context.scene.collection.children.link(collection)
colors={'stone':(.66,.65,.60),'light':(.86,.82,.70),
 'blue':(.16,.30,.48),'gold':(.78,.56,.19),'night':(.12,.14,.20)}
mats={}
for name,c in colors.items():
 mat=bpy.data.materials.new('B113 '+name)
 mat.diffuse_color=(*c,1)
 mats[name]=mat
def cuboid(name,location,dim,mat='stone',temporary=False):
 bpy.ops.mesh.primitive_cube_add(size=1, location=location)
 ob=bpy.context.object;ob.name=name;ob.dimensions=dim
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if not temporary:
  for c in list(ob.users_collection):c.objects.unlink(ob)
  collection.objects.link(ob)
  ob.data.materials.append(mats[mat])
 return ob
# Cut one public south threshold, a covered audience foyer, and east archive
# gallery. Unlike a surface-painted rectangle, the volume is actually empty.
for entry in study['cutoutVoids']:
 cutter=cuboid('TEMP_BOOLEAN_'+entry['id'],entry['center'],entry['dims'],temporary=True)
 bpy.ops.object.select_all(action='DESELECT')
 tower.select_set(True);bpy.context.view_layer.objects.active=tower
 mod=tower.modifiers.new('B113 actual void: '+entry['id'],'BOOLEAN')
 mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
 bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.data.objects.remove(cutter,do_unlink=True)
 if len(tower.data.polygons)<=14:raise RuntimeError('Void failed: '+entry['id'])
print('MAGE_REAL_CARVING_DONE',len(tower.data.polygons),'polygons')
# Geometric court gate threshold, large stone portal and arch crown at z89.
for side,x in [('left',1044.1),('right',1055.9)]:
 cuboid('Portal_'+side+'_square_buttress',(x,624,79.5),(1.8,3.3,19),'light')
 cuboid('Portal_'+side+'_outer_post',(x,614,78.5),(1.8,2,17),'light')
cuboid('Royal_mage_portal_lintel',(1050,623,89.5),(14.5,4,2.5),'light')
cuboid('Palace_portal_blue_hood',(1050,620,92),(17.4,10.5,2.7),'blue')
cuboid('Crown_archive_gold_insignia',(1050,614.4,91.9),(5,1,2.8),'gold')
# Subdivide the huge blank cylindrical elevation into structural gothic ribs
# and three masonry belt courses, not merely more detached towers.
cx,cy=1050,650;radius=23.15
for i in range(12):
 a=2*math.pi*i/12
 x=cx+radius*math.cos(a);y=cy+radius*math.sin(a)
 if y<630 and abs(x-cx)<10:continue  # preserve south door clearance
 cuboid('MageTower_face_rib_'+str(i),(x,y,114),(1.65,1.65,83),'light')
for level in [99,123,146]:
 for i in range(12):
  a=2*math.pi*i/12;b=2*math.pi*(i+1)/12
  x0=cx+radius*math.cos(a);y0=cy+radius*math.sin(a)
  x1=cx+radius*math.cos(b);y1=cy+radius*math.sin(b)
  length=math.hypot(x1-x0,y1-y0)
  if length<.1:continue
  ob=cuboid('MageTower_masonry_course_'+str(level)+'_'+str(i),
    ((x0+x1)/2,(y0+y1)/2,level),(length+1.2,1.6,1.8),'light')
  ob.rotation_euler[2]=math.atan2(y1-y0,x1-x0)
# An actual entrance gallery, floor and ceremonial chamber:
# plinth stands outside the traffic link so players can walk in.
cuboid('Court_audience_paved_foyer',(1050,648,70.10),(18,23,.17),'stone')
cuboid('Mage_audience_oath_dais',(1046,657,70.68),(5,4,1.2),'light')
cuboid('Mage_oath_inlaid_gold',(1046,657,71.3),(4,3,.1),'gold')
for i,y in enumerate([643,654]):
 for side,x in [('west',1040.65),('east',1059.35)]:
  cuboid('Audience_gallery_'+side+'_recessed_stone_'+str(i),
         (x,y,76.1),(.4,3,8),'night')
  cuboid('Audience_gallery_'+side+'_luminous_tablet_'+str(i),
         (x+(0.2 if side=='west'else -.2),y,78),(.4,1.7,2),'gold')
# The east-side archive doorway is a physically cut through-corridor.
for side,y in [('north',656.2),('south',645.8)]:
 cuboid('Archive_exit_'+side+'_buttress',(1074.8,y,76),(1.4,1.4,12),'light')
cuboid('Archive_exit_gothic_lintel',(1074.8,651,84),(2.5,14,2),'light')
# Register independent street meshes already authored in B113 JSON plan.
for n in study['newMeshes']:
 m=next(q for q in data['meshes']if q['name']==n)
 mesh=bpy.data.meshes.new(n)
 mesh.from_pydata(m['vertices'],[],m['faces']);mesh.update()
 ob=bpy.data.objects.new(n,mesh);collection.objects.link(ob)
 ob.data.materials.append(mats['stone'])
# Humans-eye checks, outside gate + carved chamber, not fly-through collision.
scene=bpy.context.scene;scene.render.resolution_x=1310;scene.render.resolution_y=840
views=[
 ('B113-palace-mage-front',(1050,596,74),(1050,637,87),25),
 ('B113-palace-mage-entry',(1050,614,74),(1050,632,81),29),
 ('B113-palace-mage-audience',(1050,636,73.4),(1048,652,78),21),
 ('B113-palace-mage-east-exit',(1058,651,74),(1076,651,77),25)]
for name,pos,look,lens in views:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 scene.collection.objects.link(ob);ob.location=pos
 ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.lens=lens;cam.clip_end=20000;cam.clip_start=.1
 scene.camera=ob;scene.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 ob.hide_set(True)
scene.camera=bpy.data.objects.get('B113-palace-mage-front')
scene['status']='B113 court Mage Tower physically carved ground vestibule; requires full route, roof and floor QA'
bpy.ops.wm.save_as_mainfile(filepath=str(dst))
print('B113_MODEL_SAVED',dst.stat().st_size,'tower_faces',len(tower.data.polygons))
