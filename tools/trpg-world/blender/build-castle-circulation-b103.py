"""Apply B103 royal ring/wing to B102 without modifying B102."""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('B103 blend already exists')
p=json.loads((out/'plan.json').read_text())
study=p['castleCirculationB103']
ring=next(x for x in p['meshes']if x['name']=='castle_contour_1')
obj=bpy.data.objects.get('castle_contour_1')
if obj is None:raise RuntimeError('Expected old contour object')
oldMaterial=obj.data.materials[0] if obj.data.materials else None
mes=bpy.data.meshes.new('B103 Royal circuit stone paving')
mes.from_pydata(ring['vertices'],[],ring['faces']);mes.update()
obj.data=mes
if oldMaterial:mes.materials.append(oldMaterial)
shifted=0
for ob in bpy.data.objects:
 if ob.name.startswith('b101_western_residence_wing_'):
  ob.location.x+=study['wingShiftM'][0];ob.location.y+=study['wingShiftM'][1];shifted+=1
if shifted!=7:raise RuntimeError('Expected 7 wing meshes to move, observed '+str(shifted))
col=bpy.data.collections.new('B103 ring and level connections')
bpy.context.scene.collection.children.link(col)
for name in study['insertedMeshes']:
 m=next(x for x in p['meshes']if x['name']==name)
 me=bpy.data.meshes.new(name);me.from_pydata(m['vertices'],[],m['faces']);me.update()
 o=bpy.data.objects.new(name,me);col.objects.link(o)
 if oldMaterial:me.materials.append(oldMaterial)
s=bpy.context.scene
s.render.resolution_x=1260;s.render.resolution_y=830
for name,pos,look,scale in [
 ('B103-castle-ring',(600,620,415),(291,1080,233),565),
 ('B103-western-approach',(155,870,335),(285,1090,221),None),
 ('B103-castle-wider',(1000,480,620),(250,1090,204),1010)]:
 cam=bpy.data.cameras.new(name)
 o=bpy.data.objects.new(name,cam);s.collection.objects.link(o)
 o.location=pos;o.rotation_euler=(Vector(look)-o.location).to_track_quat('-Z','Y').to_euler()
 cam.clip_end=20000;cam.lens=30
 if scale:cam.type='ORTHO';cam.ortho_scale=scale
 s.camera=o;s.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True);o.hide_set(True)
s.camera=bpy.data.objects['B102-castle-clean']
s['status']='B103 castle circulation redistributed, localized QA pending'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B103_SAVED',target.stat().st_size,'moved',shifted)
