"""Build civic-royal ramp REPLACEMENT in a staging .blend.
Do not modify the active current file before actual QA; original road,
support terrace and rail are removed together to avoid floating appendages.
"""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
data=json.loads((root/'royal-replacement-plan.staged.json').read_text(encoding='utf8'))
s=data['civicRoyalRampReplacement']
pending=root/'royal-replacement.pending.blend'
if pending.exists():raise RuntimeError('Do not clobber staged model')
deleted=[]
for name in s['oldRampRemovedMeshNames'] + s.get('openedGalleryDoorPanels',[]):
 ob=bpy.data.objects.get(name)
 if ob is None:raise RuntimeError('Historical asset absent: '+name)
 bpy.data.objects.remove(ob,do_unlink=True);deleted.append(name)
col=bpy.data.collections.new('Current Civic-Royal Cliff Stairs and Freight Lift')
bpy.context.scene.collection.children.link(col)
newnames=s['distinctMeshObjects']
mat_colors={
 'court_ashlar':(.70,.67,.60,1),
 'court_iron':(.16,.17,.19,1),
 'court_paving':(.57,.56,.52,1)}
for name in newnames:
 m=next((q for q in data['meshes']if q['name']==name),None)
 if not m:raise RuntimeError('New design mesh missing '+name)
 me=bpy.data.meshes.new(name)
 me.from_pydata(m['vertices'],[],m['faces']);me.update()
 if me.polygons:
  bm=bmesh.new();bm.from_mesh(me)
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);col.objects.link(ob)
 mn=m['material']
 mat=bpy.data.materials.get(mn)or bpy.data.materials.new(mn)
 if mat.name==mn and not mat.diffuse_color:mat.diffuse_color=mat_colors.get(mn,(.65,.65,.65,1))
 me.materials.append(mat)
scene=bpy.context.scene
scene.render.resolution_x=1380;scene.render.resolution_y=920
scene.render.resolution_percentage=100
views=[
 ('ramp-after-overview',(850,420,360),(585,665,80),520,'ORTHO'),
 ('ramp-after-ground-entry',(670,600,65),(604,648,90),None,'PERSP'),
 ('ramp-after-stair-summit',(555,710,133),(615,661,84),None,'PERSP'),
 ('ramp-after-whole-urban',(930,240,650),(555,830,110),880,'ORTHO')]
for name,pos,look,scale,kind in views:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 scene.collection.objects.link(ob);ob.location=pos
 ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.type=kind;cam.lens=24;cam.clip_start=.1;cam.clip_end=18000
 if scale:cam.ortho_scale=scale
 scene.camera=ob;scene.render.filepath=str(root/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(ob,do_unlink=True)
scene['royal_ramp_review']='PENDING QA: old 1170m road removed; stair + freight hoist modeled; game lift motor not configured'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(pending))
print('RAMP_PENDING_SAVED',len(deleted),len(newnames),pending.stat().st_size)
